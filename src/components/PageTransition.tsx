import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { usePerformanceMode } from '../hooks/usePerformanceMode';

interface PageTransitionProps {
  children: ReactNode;
}

const PageTransition = ({ children }: PageTransitionProps) => {
  const prefersReduced = useReducedMotion();
  const { reduceMotion } = usePerformanceMode();
  const compactMotion = prefersReduced || reduceMotion;

  if (compactMotion) {
    return <div className="w-full">{children}</div>;
  }

  return (
    <motion.div
      className="w-full"
      initial={{ opacity: 0, y: 8, filter: 'blur(2px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -6, filter: 'blur(2px)' }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
};

export default PageTransition;
