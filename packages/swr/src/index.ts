/**
 * @prefetch-sdk/swr
 * SWR 集成 - 预热/预加载到 SWR 缓存
 */

import { useCallback, useMemo } from 'react';
import useSWR, { useSWRConfig, preload as swrPreload, type Cache, type State } from 'swr';

// ============ 类型定义 ============

export type Fetcher<TData = unknown, TParams = unknown> = (params: TParams) => Promise<TData> | TData;

export interface RequestMetadata {
  levelType: string;
  [key: string]: unknown;
}

export interface UseRequestBySwrOptions {
  metadata: RequestMetadata;
  log?: LogFunction;
}

export enum LogType {
  createCache = 'createCache',
  hitCache = 'hitCache',
  hitPreloadCache = 'hitPreloadCache',
  resourceFinished = 'resourceFinished',
  createPreloadCache = 'createPreloadCache',
}

export type LogFunction = (type: LogType, data?: Record<string, unknown>) => void;

const defaultLog: LogFunction = () => {};

// ============ 预加载配置 ============

export interface IPreloader<TData = unknown, TParams = Record<string, unknown>> {
  fetcher: Fetcher<TData, TParams>;
  params: TParams;
  options: UseRequestBySwrOptions;
}

export function createPreloadConfig<TData = unknown, TParams = Record<string, unknown>>(
  fetcher: Fetcher<TData, TParams>,
  params: TParams,
  metadata: RequestMetadata
): IPreloader<TData, TParams> {
  return { fetcher, params, options: { metadata } };
}

// ============ 缓存类型辅助 ============

type SWRCache = Cache<State<unknown, unknown>>;

function getCacheData<TData>(cache: SWRCache, key: string): TData | undefined {
  const cached = cache.get(key);
  if (cached !== undefined) {
    const state = cached as State<TData, unknown>;
    return state.data;
  }
  return undefined;
}

// ============ Hooks ============

/**
 * 使用 SWR 进行数据请求的 Hook，支持预请求
 */
export function useRequestBySwr<TData = unknown, TParams = Record<string, unknown>>(
  task: Fetcher<TData, TParams>,
  params: TParams | null,
  options: UseRequestBySwrOptions
) {
  const { metadata, log = defaultLog } = options;
  const serializedKey = params ? JSON.stringify({ metadata, ...params }) : null;

  const { cache } = useSWRConfig();

  const isHit = useMemo(() => {
    if (!serializedKey) return false;
    return cache.get(serializedKey) !== undefined;
  }, [cache, serializedKey]);

  useMemo(() => {
    if (isHit) log(LogType.hitCache, { key: serializedKey });
  }, [isHit, log, serializedKey]);

  const fetcher = useCallback(async (key: string) => {
    const parsed = JSON.parse(key) as Record<string, unknown>;
    const { metadata: _m, ...restParams } = parsed;
    const result = await task(restParams as TParams);
    if (!isHit) log(LogType.resourceFinished);
    return result;
  }, [task, isHit, log]);

  const { data, error, mutate, isLoading } = useSWR<TData>(serializedKey, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: true,
  });

  const refresh = useCallback(() => {
    mutate(undefined, { revalidate: true });
  }, [mutate]);

  return { refresh, data, pending: isLoading, error, mutate };
}

/**
 * 使用预加载配置的 SWR Hook
 */
export function useRequestBySwrWithPreloadConfig<TData = unknown, TParams = Record<string, unknown>>(
  config: IPreloader<TData, TParams>
) {
  return useRequestBySwr<TData, TParams>(config.fetcher, config.params, config.options);
}

// ============ 预加载函数 ============

/**
 * 预加载数据到 SWR 缓存
 */
export async function preloadBySwr<TData = unknown, TParams = Record<string, unknown>>(
  fetcher: Fetcher<TData, TParams>,
  params: TParams,
  options: UseRequestBySwrOptions & { key?: string }
): Promise<TData> {
  const { metadata, log = defaultLog, key } = options;
  const serializedKey = JSON.stringify({ metadata, ...params });

  const data = await swrPreload<TData, string>(serializedKey, () =>
    fetcher({ ...params, weirwoodIgnored: true } as TParams) as Promise<TData>
  );
  log(LogType.createPreloadCache, { key });

  return data;
}

/**
 * 获取预加载回调的 Hook
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

      const cachedData = getCacheData<TData>(cache, serializedKey);
      if (cachedData !== undefined) {
        return cachedData;
      }

      return preloadBySwr(fetcher, params, options);
    },
    [cache]
  );
}

// ============ 批量预加载 ============

export type PreloadPoolConfig = [
  Array<IPreloader | (() => Promise<(data: unknown) => IPreloader>)>,
  Array<Record<string, unknown>> | (() => Promise<Array<Record<string, unknown>>>)
];

/**
 * 执行 SWR 预加载池 - 批量预加载多个请求
 */
export async function executePreloadPool(
  preloadReqList: PreloadPoolConfig[0],
  dependenciesList: PreloadPoolConfig[1],
  options: { parallel?: boolean } = {}
): Promise<unknown[]> {
  const { parallel = true } = options;

  const dependencies = typeof dependenciesList === 'function'
    ? await dependenciesList()
    : dependenciesList;

  const executeOne = async (reqInfo: PreloadPoolConfig[0][number], index: number) => {
    const config = typeof reqInfo === 'function'
      ? (await reqInfo())(dependencies[index])
      : reqInfo;
    return preloadBySwr(config.fetcher, config.params, config.options);
  };

  if (parallel) {
    return Promise.all(preloadReqList.map(executeOne));
  }

  const results: unknown[] = [];
  for (let i = 0; i < preloadReqList.length; i++) {
    results.push(await executeOne(preloadReqList[i], i));
  }
  return results;
}
