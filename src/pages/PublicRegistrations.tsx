import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';

const PublicRegistrations = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<any>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPublic = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/public-registrations?token=${encodeURIComponent(token || '')}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load');
        setEvent(data.event);
        setRegistrations(data.registrations || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchPublic();
  }, [token]);

  const total = registrations.length;
  const present = useMemo(() => registrations.filter(r => r.attended).length, [registrations]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-6 w-80" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
        <Icon icon="solar:danger-triangle-bold" className="text-red-500 mx-auto mb-4" fontSize={36} />
        <p className="text-sm font-bold text-gray-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 font-sans">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Shared Registration View</p>
          <h1 className="text-3xl font-bold text-[#1A2230] tracking-tight mb-1">{event?.title || 'Event'}</h1>
          <p className="text-gray-500 text-sm font-medium">
            {event?.description || 'Public registration list'}
          </p>
        </div>
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Stats</p>
          <p className="text-sm font-bold text-[#1A2230]">{total} Registrations</p>
          <p className="text-xs font-semibold text-gray-500">{present} Attended</p>
        </div>
      </header>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#1A2230]">Registrations</h2>
          {event?.date && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              {new Date(event.date).toLocaleDateString()}
            </span>
          )}
        </div>

        {registrations.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-gray-100 bg-gray-50/30">
                  <th className="py-4 px-6 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Participant</th>
                  <th className="py-4 px-6 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Details</th>
                  <th className="py-4 px-6 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Attendance</th>
                  <th className="py-4 px-6 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {registrations.map((reg: any) => (
                  <tr key={reg.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center text-gray-500 font-bold text-xs">
                          {reg.profile?.avatar_url ? (
                            <img src={reg.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            (reg.profile?.full_name || 'U')[0]
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-[#1A2230]">{reg.profile?.full_name || 'Unknown'}</p>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 whitespace-nowrap">
                            {reg.profile?.branch || 'General'} • {reg.profile?.semester || 'NA'}
                          </p>
                          <p className="text-[10px] font-semibold text-gray-400">{reg.profile?.email || 'No email'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {Object.entries(reg.form_responses || {}).length > 0 ? (
                        <div className="max-w-md grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                          {Object.entries(reg.form_responses || {}).map(([key, val]: [string, any]) => {
                            const field = event?.custom_form?.find((f: any) => f.id === key);
                            return (
                              <div key={key} className="flex flex-col">
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">{field?.label || 'Field'}</span>
                                <span className="text-[11px] font-medium text-gray-600 truncate">
                                  {Array.isArray(val) ? val.join(', ') : (val?.toString() || '-')}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-400 font-medium">No extra details</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${reg.attended ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-500'}`}>
                        {reg.attended ? 'Present' : 'Absent'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${reg.status === 'attended' ? 'bg-green-50 text-green-600' : reg.status === 'cancelled' ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>
                        {reg.status || 'registered'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10">
            <EmptyState
              icon="solar:users-group-rounded-bold"
              title="No Registrations Yet"
              description="This event has no registrations to display."
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicRegistrations;
