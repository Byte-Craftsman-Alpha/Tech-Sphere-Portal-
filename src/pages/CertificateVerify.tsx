import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { useSearchParams } from 'react-router-dom';

const CertificateVerify = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [credential, setCredential] = useState(searchParams.get('credential') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const handleVerify = async (value?: string) => {
    const toVerify = (value ?? credential).trim();
    if (!toVerify) {
      setError('Please enter a certificate credential.');
      setResult(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/certificate-verify?credential=${encodeURIComponent(toVerify)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Certificate not found');
      setResult(data.certificate);
      setSearchParams({ credential: toVerify });
    } catch (err: any) {
      setResult(null);
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const preset = searchParams.get('credential');
    if (preset && preset !== credential) {
      setCredential(preset);
      handleVerify(preset);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center">
      <div className="w-full max-w-3xl bg-white border border-gray-100 rounded-2xl shadow-xl p-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Public Certificate Check</p>
            <h1 className="text-3xl font-bold text-[#1A2230] tracking-tight">Validate A Credential</h1>
            <p className="text-sm text-gray-500 font-medium">Paste the credential ID printed on the certificate to verify authenticity.</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Icon icon="solar:shield-check-bold" fontSize={26} />
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 flex flex-col sm:flex-row gap-3 items-center">
          <input
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            placeholder="Enter credential (e.g., TS-2026-ABC123)"
            className="w-full flex-1 px-4 py-3 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <button
            onClick={() => handleVerify()}
            disabled={loading}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
          >
            {loading ? 'Checking...' : 'Verify'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-red-600 text-sm font-semibold flex items-center gap-2">
            <Icon icon="solar:danger-triangle-bold" fontSize={18} /> {error}
          </div>
        )}

        {result && (
          <div className="border border-emerald-100 rounded-2xl p-6 bg-emerald-50/40 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <Icon icon="solar:check-circle-bold" fontSize={22} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-500">Certificate Verified</p>
                <p className="text-lg font-bold text-[#1A2230]">{result.holder_name}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white border border-gray-100 rounded-xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Event</p>
                <p className="text-sm font-semibold text-gray-700">{result.event_name}</p>
              </div>
              <div className="bg-white border border-gray-100 rounded-xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Certificate Type</p>
                <p className="text-sm font-semibold text-gray-700">{result.certificate_type}</p>
              </div>
              <div className="bg-white border border-gray-100 rounded-xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Credential</p>
                <p className="text-sm font-semibold text-gray-700 break-all">{result.credential}</p>
              </div>
              <div className="bg-white border border-gray-100 rounded-xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Issued On</p>
                <p className="text-sm font-semibold text-gray-700">{result.issued_at ? new Date(result.issued_at).toLocaleDateString() : '—'}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CertificateVerify;

