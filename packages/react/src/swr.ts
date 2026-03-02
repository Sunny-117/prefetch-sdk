/**
 * @prefetch-sdk/react/swr
 * SWR integration for prefetch SDK
 */

import { useCallback, useMemo } from 'react';
import useSWR, { useSWRConfig, preload as swrPreload } from 'swr';
import type { Fetcher } from '@prefetch-sdk/core';

/**
 * Log types for cache events
 */
export enum LogType {
  createCache = 'createCache',
  hitCache = 'hitCache',
  hitPreloadCache = 'hitPreloadCache',
  resourceFinished = 'resourceFinished',
  createPreloadCache = 'createPreloadCache',
}

/**
 * Logger function type
 */
export type LogFunction = (type: LogType, data?: Record<string, unknown>) => void;

/**
 * Default no-op logger
 */
const defaultLog: LogFunction = () => {};

/**
 * Metadata for request identification
 */
export interface RequestMetadata {
  levelType: string;
  [key: string]: unknown;
}

/**
 * Options for useRequestBySwr hook
 */
export interface UseRequestBySwrOptions {
  metadata: RequestMetadata;
  log?: LogFunction;
  noMutateIfHitPreloadCache?: boolean;
  weirwoodIgnored?: boolean;
}

/**
 * Hook to use SWR with prefetch support
 */
export function useRequestBySwr<TData = unknown, TParams = Record<string, unknown>>(
  task: Fetcher<TData, TParams>,
  params: TParams | null,
  options: UseRequestBySwrOptions
) {
  const { metadata, log = defaultLog } = options;
  const serializedKey = params ? JSON.stringify({ metadata, ...params }) : null;

  const { cache } = useSWRConfig();

  // Check if hit cache for logging
  const isHit = useMemo(() => {
    if (!serializedKey) return false;
    return cache.get(serializedKey) !== undefined;
  }, [cache, serializedKey]);

  // Log cache hit
  useMemo(() => {
    if (isHit) {
      log(LogType.hitCache, { key: serializedKey });
    }
  }, [isHit, log, serializedKey]);

  const fetcher = useCallback(async (key: string) => {
    const parsed = JSON.parse(key);
    const { metadata: _m, ...restParams } = parsed;
    const result = await task(restParams as TParams);
    if (!isHit) {
      log(LogType.resourceFinished);
    }
    return result;
  }, [task, isHit, log]);

  const { data, error, mutate, isLoading } = useSWR<TData>(
    serializedKey,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: true,
    }
  );

  const refresh = useCallback(() => {
    mutate(undefined, { revalidate: true });
  }, [mutate]);

  return { refresh, data, pending: isLoading, error, mutate };
}

/**
 * Preload data into SWR cache
 */
export async function preloadBySwr<TData = unknown, TParams = Record<string, unknown>>(
  fetcher: Fetcher<TData, TParams>,
  params: TParams,
  options: UseRequestBySwrOptions & { key?: string }
): Promise<TData> {
  const { metadata, log = defaultLog, key } = options;
  const serializedKey = JSON.stringify({ metadata, ...params });

  const wrappedFetcher = async () => {
    return fetcher({ ...params, weirwoodIgnored: true } as TParams);
  };

  const data = await swrPreload(serializedKey, wrappedFetcher);
  log(LogType.createPreloadCache, { key });

  return data as TData;
}

/**
 * Hook to get preload callback
 */
export function usePreloadBySwrCallback() {
  const { cache } = useSWRConfig();

  return useCallback(
    async <TData = unknown, TParams = Record<string, unknown>>(
      fetcher: Fetcher<TData, TParams>,
      params: TParams,
      options: UseRequestBySwrOptions
    ): Promise<TData> => {
      const { metadata } = options;
      const serializedKey = JSON.stringify({ metadata, ...params });

      const cached = cache.get(serializedKey);
      if (cached !== undefined) {
        const cachedData = cached as { data?: TData };
        if (cachedData?.data !== undefined) {
          return cachedData.data;
        }
      }

      return preloadBySwr(fetcher, params, options);
    },
    [cache]
  );
}

/**
 * Preloader configuration type
 */
export interface IPreloader<TData = unknown, TParams = Record<string, unknown>> {
  fetcher: Fetcher<TData, TParams>;
  params: TParams;
  options: UseRequestBySwrOptions;
}

/**
 * Hook to use SWR with preload config
 */
export function useRequestBySwrWithPreloadConfig<TData = unknown, TParams = Record<string, unknown>>(
  preloadConfig: IPreloader<TData, TParams>
) {
  const { fetcher, params, options } = preloadConfig;
  return useRequestBySwr<TData, TParams>(fetcher, params, options);
}

/**
 * Create a prefetch config for SWR preloading
 */
export function createSwrPreloadConfig<TData = unknown, TParams = Record<string, unknown>>(
  fetcher: Fetcher<TData, TParams>,
  params: TParams,
  metadata: RequestMetadata
): IPreloader<TData, TParams> {
  return {
    fetcher,
    params,
    options: { metadata },
  };
}
