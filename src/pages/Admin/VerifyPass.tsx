import { useState } from 'react';
import { Icon } from '@iconify/react';
import supabase from '../../lib/supabase';

const PassVerification = () => {
  const [qrData, setQrData] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!qrData) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Find registration and related data
      const { data: reg, error: regError } = await supabase
        .from('ts_v2025_registrations')
        .select(`
          *,
          user:ts_v2025_profiles(*),
          event:ts_v2025_events(*)
        `)
        .eq('qr_data', qrData)
        .maybeSingle(); // Safe: handles invalid QR without 406

      if (regError || !reg) {
        throw new Error('Invalid Pass: Registration not found or database sync pending.');
      }

      // Increment scan count
      const { data: updatedReg, error: updateError } = await supabase
        .from('ts_v2025_registrations')
        .update({ scan_count: (reg.scan_count || 0) + 1 })
        .eq('id', reg.id)
        .select()
        .maybeSingle();

      if (updateError || !updatedReg) throw updateError || new Error('Failed to update scan count');

      setResult({
        ...reg,
        scan_count: updatedReg.scan_count,
        user: reg.user,
        event: reg.event
      });
      setQrData(''); // Clear for next scan
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-10">
      <header className="text-center">
        <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 mx-auto mb-4">
          <Icon icon="solar:shield-check-bold" fontSize={40} />
        </div>
        <h1 className="text-3xl font-bold text-[#212B36]">Pass Verification</h1>
        <p className="text-gray-500 font-medium">Scan or enter the Pass ID to verify attendee entry.</p>
      </header>

      <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-500 ml-1 uppercase tracking-wider">Pass QR Data / ID</label>
            <div className="relative">
              <Icon icon="solar:qr-code-bold" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" fontSize={20} />
              <input 
                type="text" 
                required 
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600 transition-all text-sm" 
                placeholder="pass_user_event_id..." 
                value={qrData}
                onChange={e => setQrData(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3.5 bg-[#212B36] text-white rounded-lg font-bold text-sm hover:bg-[#161C24] transition-all flex items-center justify-center gap-2 uppercase tracking-wider disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Verify Pass'} <Icon icon="solar:check-read-bold" />
          </button>
        </form>

        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-lg flex items-center gap-3 text-red-600 animate-in fade-in slide-in-from-top-2">
            <Icon icon="solar:danger-bold" fontSize={24} />
            <p className="text-sm font-bold">{error}</p>
          </div>
        )}

        {result && (
          <div className="mt-6 p-6 bg-green-50 border border-green-100 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3 text-green-700">
              <Icon icon="solar:check-circle-bold" fontSize={32} />
              <div>
                <h3 className="text-lg font-bold">Pass Verified!</h3>
                <p className="text-xs font-bold uppercase">Total Scans: {result.scan_count}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-green-200/50">
              <div>
                <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Attendee</p>
                <p className="font-bold text-[#212B36]">{result.user?.full_name}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Event</p>
                <p className="font-bold text-[#212B36]">{result.event?.title}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Branch</p>
                <p className="font-bold text-[#212B36]">{result.user?.branch}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Roll No</p>
                <p className="font-bold text-[#212B36]">{result.user?.roll_no}</p>
              </div>
            </div>

            {result.scan_count > 1 && (
              <div className="p-3 bg-amber-100 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-700">
                <Icon icon="solar:info-circle-bold" fontSize={20} />
                <p className="text-xs font-bold uppercase">Warning: This pass has been scanned {result.scan_count} times!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PassVerification;
