import { useEffect, useState } from 'react';

const getReduceMotion = () => {
  if (typeof window === 'undefined') return false;

  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const saveData = Boolean((navigator as any)?.connection?.saveData);
  const lowMemory = Number((navigator as any)?.deviceMemory || 8) <= 4;
  const lowCores = Number((navigator as any)?.hardwareConcurrency || 8) <= 4;

  return prefersReducedMotion || saveData || lowMemory || lowCores;
};

export const usePerformanceMode = () => {
  const [reduceMotion, setReduceMotion] = useState(getReduceMotion);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(getReduceMotion());

    update();
    media?.addEventListener?.('change', update);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);

    return () => {
      media?.removeEventListener?.('change', update);
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return {
    reduceMotion,
    lowPowerMode: reduceMotion
  };
};
