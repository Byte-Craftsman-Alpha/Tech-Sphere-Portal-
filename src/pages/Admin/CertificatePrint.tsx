import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { QRCodeSVG } from 'qrcode.react';
import supabase from '../../lib/supabase';
import { Skeleton } from '../../components/Skeleton';

const CertificatePrint = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [certificate, setCertificate] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCertificate = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Session expired');
        const res = await fetch(`/api/admin-certificates?id=${encodeURIComponent(id || '')}`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Certificate not found');
        setCertificate(data.certificate);
      } catch (err: any) {
        setError(err.message || 'Failed to load certificate');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchCertificate();
  }, [id]);

  const verificationUrl = certificate?.credential
    ? `${window.location.origin}/certificates/verify?credential=${encodeURIComponent(certificate.credential)}`
    : '';

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !certificate) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
        <Icon icon="solar:danger-triangle-bold" className="text-red-500 mx-auto mb-4" fontSize={36} />
        <p className="text-sm font-bold text-gray-700">{error || 'Certificate not found'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <style>
        {`@media print {\n  .no-print { display: none !important; }\n  body { background: white; }\n}`}
      </style>

      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2230]">Print Certificate</h1>
          <p className="text-xs text-gray-500 font-medium">Preview and print the certificate verification card.</p>
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest"
        >
          Print
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-xl p-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Certificate Verification</p>
            <h2 className="text-3xl font-bold text-[#1A2230]">{certificate.holder_name}</h2>
            <p className="text-sm font-semibold text-gray-600">{certificate.event_name} - {certificate.certificate_type}</p>
            <p className="text-xs text-gray-400 font-semibold">Credential: {certificate.credential}</p>
            <p className="text-xs text-gray-400 font-semibold">
              Issued on {certificate.issued_at ? new Date(certificate.issued_at).toLocaleDateString() : '-'}
            </p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl">
              <QRCodeSVG value={verificationUrl} size={180} />
            </div>
            <p className="text-[10px] text-gray-400 font-semibold">Scan to verify</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CertificatePrint;
