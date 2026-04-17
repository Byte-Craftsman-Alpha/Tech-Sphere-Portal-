import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

const TopProgressBar = () => {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<number | null>(null);
  const firstRenderRef = useRef(true);

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }

    const start = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      setVisible(true);
      setProgress(12);

      const first = window.setTimeout(() => setProgress(48), 90);
      const second = window.setTimeout(() => setProgress(76), 180);
      const third = window.setTimeout(() => {
        setProgress(100);
        timerRef.current = window.setTimeout(() => {
          setVisible(false);
          setProgress(0);
        }, 140);
      }, 320);

      timerRef.current = third;

      return () => {
        window.clearTimeout(first);
        window.clearTimeout(second);
        window.clearTimeout(third);
      };
    };

    const cleanup = start();
    return cleanup;
  }, [location.pathname, location.search, location.hash]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[70] pointer-events-none">
      <div className="h-1 bg-transparent">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-fuchsia-500 shadow-[0_0_18px_rgba(79,70,229,0.45)] transition-[width,opacity] duration-200 ease-out"
          style={{ width: `${progress}%`, opacity: progress === 100 ? 0 : 1 }}
        />
      </div>
    </div>
  );
};

export default TopProgressBar;
