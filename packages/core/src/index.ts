/**
 * @prefetch-sdk/core
 * Core utilities - pool, cache strategies, and helpers
 */

// ============ Types ============

export type Fetcher<TData = unknown, TParams = unknown> = (params: TParams) => Promise<TData> | TData;

export interface PrefetchConfig<TData = unknown, TParams = unknown> {
  name: string;
  fetcher: Fetcher<TData, TParams>;
  params?: TParams;
  dependencies?: string[];
  condition?: (dependencyResults: unknown[]) => boolean;
}

export interface PrefetchEntry<TData = unknown> {
  promise: Promise<TData>;
  config: PrefetchConfig<TData>;
  timestamp: number;
  status: 'pending' | 'fulfilled' | 'rejected';
  data?: TData;
  error?: Error;
}

export interface CacheStrategy<TData = unknown> {
  getKey: (...args: unknown[]) => string;
  isValid?: (cached: CachedData<TData>) => boolean;
  cleanup?: () => void;
}

export interface CachedData<TData = unknown> {
  data: TData;
  timestamp: number;
  key: string;
}

// ============ PrefetchPool ============

export class PrefetchPool {
  private entries: Map<string, PrefetchEntry> = new Map();
  private source: Map<string, { config: PrefetchConfig; params: unknown }> = new Map();
  private namespace: string;
  private debug: boolean;

  constructor(config: { namespace?: string; debug?: boolean } = {}) {
    this.namespace = config.namespace ?? '__PREFETCH_SDK__';
    this.debug = config.debug ?? false;
  }

  private log(...args: unknown[]) {
    if (this.debug) console.debug('[prefetch-sdk]', ...args);
  }

  has(name: string): boolean {
    return this.entries.has(name);
  }

  get<TData = unknown>(name: string): PrefetchEntry<TData> | undefined {
    return this.entries.get(name) as PrefetchEntry<TData> | undefined;
  }

  getSource(name: string) {
    return this.source.get(name);
  }

  async execute<TData = unknown, TParams = unknown>(
    config: PrefetchConfig<TData, TParams>
  ): Promise<TData> {
    const { name, fetcher, params, dependencies, condition } = config;

    // Check if already pending
    const existing = this.entries.get(name);
    if (existing?.status === 'pending') {
      this.log(`"${name}" already pending`);
      return existing.promise as Promise<TData>;
    }

    // Wait for dependencies
    let depResults: unknown[] = [];
    if (dependencies?.length) {
      this.log(`"${name}" waiting for dependencies:`, dependencies);
      depResults = await Promise.all(
        dependencies.map(dep => this.entries.get(dep)?.promise)
      );
    }

    // Check condition
    if (condition && !condition(depResults)) {
      this.log(`"${name}" skipped due to condition`);
      return undefined as unknown as TData;
    }

    // Store source
    this.source.set(name, { config: config as PrefetchConfig, params });

    // Execute
    const startTime = Date.now();
    const promise = Promise.resolve()
      .then(() => fetcher(params as TParams))
      .then(data => {
        const entry = this.entries.get(name);
        if (entry) {
          entry.status = 'fulfilled';
          entry.data = data;
        }
        this.log(`"${name}" completed in ${Date.now() - startTime}ms`);
        return data;
      })
      .catch(error => {
        const entry = this.entries.get(name);
        if (entry) {
          entry.status = 'rejected';
          entry.error = error;
        }
        throw error;
      });

    this.entries.set(name, {
      promise,
      config: config as PrefetchConfig<TData>,
      timestamp: startTime,
      status: 'pending',
    } as PrefetchEntry);

    return promise;
  }

  async executeAll<TData = unknown>(
    configs: Array<PrefetchConfig<TData>>,
    options: { parallel?: boolean } = {}
  ): Promise<TData[]> {
    if (options.parallel !== false) {
      return Promise.all(configs.map(c => this.execute(c)));
    }
    const results: TData[] = [];
    for (const config of configs) {
      results.push(await this.execute(config));
    }
    return results;
  }

  async consume<TData = unknown>(name: string, clear = true): Promise<TData | undefined> {
    const entry = this.entries.get(name);
    if (!entry) return undefined;

    try {
      const data = await entry.promise;
      return data as TData;
    } catch {
      return undefined;
    } finally {
      if (clear) this.delete(name);
    }
  }

  delete(name: string): boolean {
    return this.entries.delete(name);
  }

  clear(): void {
    this.entries.clear();
    this.source.clear();
  }

  keys(): string[] {
    return Array.from(this.entries.keys());
  }

  get size(): number {
    return this.entries.size;
  }

  mountToWindow(): void {
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>)[this.namespace] = {
        pool: this,
        entries: this.entries,
        source: Object.fromEntries(this.source),
      };
    }
  }
}

export function createPrefetchPool(config?: { namespace?: string; debug?: boolean }): PrefetchPool {
  return new PrefetchPool(config);
}

let globalPool: PrefetchPool | undefined;

export function getGlobalPool(): PrefetchPool {
  if (!globalPool) globalPool = createPrefetchPool();
  return globalPool;
}

// ============ Cache Strategies ============

export interface CacheStorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export const localStorageAdapter: CacheStorageAdapter = {
  get: (key) => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (key, value) => { try { localStorage.setItem(key, value); } catch { /* ignore */ } },
  remove: (key) => { try { localStorage.removeItem(key); } catch { /* ignore */ } },
};

export const sessionStorageAdapter: CacheStorageAdapter = {
  get: (key) => { try { return sessionStorage.getItem(key); } catch { return null; } },
  set: (key, value) => { try { sessionStorage.setItem(key, value); } catch { /* ignore */ } },
  remove: (key) => { try { sessionStorage.removeItem(key); } catch { /* ignore */ } },
};

export function createMemoryAdapter(): CacheStorageAdapter {
  const store = new Map<string, string>();
  return {
    get: (key) => store.get(key) ?? null,
    set: (key, value) => { store.set(key, value); },
    remove: (key) => { store.delete(key); },
  };
}

export function withCache<TData = unknown, TParams = unknown>(
  fetcher: Fetcher<TData, TParams>,
  strategy: CacheStrategy<TData>,
  options: {
    prefix?: string;
    storage?: CacheStorageAdapter;
  } = {}
): Fetcher<TData, TParams> {
  const {
    prefix = 'prefetch:',
    storage = typeof window !== 'undefined' ? localStorageAdapter : createMemoryAdapter(),
  } = options;

  return async (params: TParams): Promise<TData> => {
    const key = `${prefix}${strategy.getKey(params)}`;

    // Try cache
    try {
      const cached = storage.get(key);
      if (cached) {
        const parsed = JSON.parse(cached) as CachedData<TData>;
        if (!strategy.isValid || strategy.isValid(parsed)) {
          return parsed.data;
        }
      }
    } catch { /* ignore */ }

    strategy.cleanup?.();

    // Fetch
    const data = await fetcher(params);

    // Store
    try {
      storage.set(key, JSON.stringify({ data, timestamp: Date.now(), key }));
    } catch { /* ignore */ }

    return data;
  };
}

export function todayCacheStrategy<TData = unknown>(
  keyFn: (...args: unknown[]) => string
): CacheStrategy<TData> {
  const getToday = () => {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  };

  return {
    getKey: (...args) => `${keyFn(...args)}:${getToday()}`,
    isValid: (cached) => {
      const cachedDate = new Date(cached.timestamp);
      const today = new Date();
      return (
        cachedDate.getFullYear() === today.getFullYear() &&
        cachedDate.getMonth() === today.getMonth() &&
        cachedDate.getDate() === today.getDate()
      );
    },
  };
}

export function ttlCacheStrategy<TData = unknown>(
  keyFn: (...args: unknown[]) => string,
  ttl: number
): CacheStrategy<TData> {
  return {
    getKey: keyFn,
    isValid: (cached) => Date.now() - cached.timestamp < ttl,
  };
}

// ============ Utilities ============

export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function parseCookies(cookieString?: string): Record<string, string> {
  const str = cookieString ?? (typeof document !== 'undefined' ? document.cookie : '');
  const cookies: Record<string, string> = {};
  str.split(/;\s*/).forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx >= 0) {
      const key = pair.substring(0, idx).trim();
      let val = pair.substring(idx + 1).trim();
      if (val.startsWith('"')) val = val.slice(1, -1);
      try { cookies[key] = decodeURIComponent(val); } catch { cookies[key] = val; }
    }
  });
  return cookies;
}

export function getCookie(key: string): string | undefined {
  return parseCookies()[key];
}

export function encodeParams(params: Record<string, unknown>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

export function formatDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function runWhenIdle(callback: () => void, timeout = 2000): () => void {
  if (typeof requestIdleCallback !== 'undefined') {
    const id = requestIdleCallback(() => callback(), { timeout });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(callback, 0);
  return () => clearTimeout(id);
}
