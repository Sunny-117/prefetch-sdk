/**
 * @prefetch-sdk/react
 * React hooks and utilities for prefetch SDK
 */

import {
  useEffect,
  useCallback,
  useRef,
  useState,
  createContext,
  useContext,
  type ReactNode,
} from 'react';
import {
  PrefetchPool,
  createPrefetchPool,
  getGlobalPool,
  type PrefetchConfig,
  type PrefetchPoolConfig,
} from '@prefetch-sdk/core';
import { consumePrefetch, getPrefetchSource } from '@prefetch-sdk/html-script';

/**
 * Prefetch context
 */
const PrefetchContext = createContext<PrefetchPool | null>(null);

/**
 * Prefetch provider props
 */
export interface PrefetchProviderProps {
  children: ReactNode;
  pool?: PrefetchPool;
  config?: PrefetchPoolConfig;
}

/**
 * Prefetch provider component
 */
export function PrefetchProvider({
  children,
  pool,
  config,
}: PrefetchProviderProps) {
  const poolRef = useRef(pool ?? createPrefetchPool(config));

  return (
    <PrefetchContext.Provider value={poolRef.current}>
      {children}
    </PrefetchContext.Provider>
  );
}

/**
 * Hook to get the prefetch pool
 */
export function usePrefetchPool(): PrefetchPool {
  const pool = useContext(PrefetchContext);
  return pool ?? getGlobalPool();
}

/**
 * Hook to prefetch data
 */
export function usePrefetch<TData = unknown, TParams = unknown>(
  config: PrefetchConfig<TData, TParams> | null,
  options: {
    immediate?: boolean;
    onSuccess?: (data: TData) => void;
    onError?: (error: Error) => void;
  } = {}
): {
  prefetch: () => Promise<TData | undefined>;
  data: TData | undefined;
  error: Error | undefined;
  isLoading: boolean;
} {
  const { immediate = false, onSuccess, onError } = options;
  const pool = usePrefetchPool();
  const [data, setData] = useState<TData | undefined>();
  const [error, setError] = useState<Error | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const prefetch = useCallback(async () => {
    if (!config) return undefined;

    setIsLoading(true);
    setError(undefined);

    try {
      const result = await pool.execute(config);
      setData(result);
      onSuccess?.(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
      return undefined;
    } finally {
      setIsLoading(false);
    }
  }, [config, pool, onSuccess, onError]);

  useEffect(() => {
    if (immediate && config) {
      prefetch();
    }
  }, [immediate, config, prefetch]);

  return { prefetch, data, error, isLoading };
}

/**
 * Hook to consume HTML prefetch
 */
export function useConsumePrefetch<TData = unknown>(
  name: string,
  options: {
    namespace?: string;
    clear?: boolean;
    fallback?: () => Promise<TData>;
  } = {}
): {
  data: TData | undefined;
  error: Error | undefined;
  isLoading: boolean;
  consume: () => Promise<TData | undefined>;
} {
  const [data, setData] = useState<TData | undefined>();
  const [error, setError] = useState<Error | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const consumed = useRef(false);

  const consume = useCallback(async () => {
    if (consumed.current) return data;

    setIsLoading(true);
    try {
      const result = await consumePrefetch<TData>(name, options);
      setData(result);
      consumed.current = true;
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      return undefined;
    } finally {
      setIsLoading(false);
    }
  }, [name, options, data]);

  // Auto-consume on mount
  useEffect(() => {
    consume();
  }, []);

  return { data, error, isLoading, consume };
}

/**
 * Hook to prefetch on idle
 */
export function usePrefetchOnIdle<TData = unknown, TParams = unknown>(
  config: PrefetchConfig<TData, TParams>,
  options: {
    timeout?: number;
    delay?: number;
  } = {}
): {
  prefetch: () => void;
  cancel: () => void;
} {
  const { timeout = 2000, delay = 0 } = options;
  const pool = usePrefetchPool();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleCallbackRef = useRef<number | null>(null);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (idleCallbackRef.current && typeof cancelIdleCallback !== 'undefined') {
      cancelIdleCallback(idleCallbackRef.current);
      idleCallbackRef.current = null;
    }
  }, []);

  const prefetch = useCallback(() => {
    cancel();

    timeoutRef.current = setTimeout(() => {
      if (typeof requestIdleCallback !== 'undefined') {
        idleCallbackRef.current = requestIdleCallback(
          (idle) => {
            if (idle.timeRemaining() > 0) {
              pool.execute(config);
            }
          },
          { timeout }
        );
      } else {
        pool.execute(config);
      }
    }, delay);
  }, [pool, config, timeout, delay, cancel]);

  // Cleanup on unmount
  useEffect(() => {
    return cancel;
  }, [cancel]);

  return { prefetch, cancel };
}

/**
 * Hook to prefetch on mount
 */
export function usePrefetchOnMount<TData = unknown>(
  configs: Array<PrefetchConfig<TData>>,
  options: {
    parallel?: boolean;
    enabled?: boolean;
  } = {}
): void {
  const { parallel = true, enabled = true } = options;
  const pool = usePrefetchPool();
  const executed = useRef(false);

  useEffect(() => {
    if (!enabled || executed.current || configs.length === 0) return;

    executed.current = true;
    pool.executeAll(configs as Array<PrefetchConfig>, { parallel });
  }, [enabled, configs, parallel, pool]);
}

/**
 * Hook to get prefetch source params
 */
export function usePrefetchSource(
  name: string,
  options: { namespace?: string } = {}
): { path: string; params: unknown } | undefined {
  const [source, setSource] = useState<{ path: string; params: unknown } | undefined>();

  useEffect(() => {
    const result = getPrefetchSource(name, options);
    setSource(result);
  }, [name, options]);

  return source;
}

// Re-export types and utilities
export type { PrefetchConfig, PrefetchPoolConfig } from '@prefetch-sdk/core';
export { consumePrefetch, getPrefetchSource, isPrefetchParamsMatch } from '@prefetch-sdk/html-script';
