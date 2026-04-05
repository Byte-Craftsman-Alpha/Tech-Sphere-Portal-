import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface CacheEntry {
  data: any;
  timestamp: number;
}

interface CacheContextType {
  getCache: (key: string) => any | null;
  setCache: (key: string, data: any) => void;
  clearCache: (key: string) => void;
  invalidateAll: () => void;
}

const CacheContext = createContext<CacheContextType | undefined>(undefined);

// Cache TTL (Time To Live) - default 10 minutes
const CACHE_TTL = 10 * 60 * 1000;

export const CacheProvider = ({ children }: { children: ReactNode }) => {
  const [cache, setCacheState] = useState<Record<string, CacheEntry>>({});

  const getCache = useCallback((key: string) => {
    const entry = cache[key];
    if (!entry) return null;
    
    // Check if cache is stale
    const isStale = Date.now() - entry.timestamp > CACHE_TTL;
    if (isStale) return null;
    
    return entry.data;
  }, [cache]);

  const setCache = useCallback((key: string, data: any) => {
    setCacheState((prev) => ({
      ...prev,
      [key]: {
        data,
        timestamp: Date.now(),
      },
    }));
  }, []);

  const clearCache = useCallback((key: string) => {
    setCacheState((prev) => {
      const newCache = { ...prev };
      delete newCache[key];
      return newCache;
    });
  }, []);

  const invalidateAll = useCallback(() => {
    setCacheState({});
  }, []);

  return (
    <CacheContext.Provider value={{ getCache, setCache, clearCache, invalidateAll }}>
      {children}
    </CacheContext.Provider>
  );
};

export const useCache = () => {
  const context = useContext(CacheContext);
  if (context === undefined) {
    throw new Error('useCache must be used within a CacheProvider');
  }
  return context;
};
