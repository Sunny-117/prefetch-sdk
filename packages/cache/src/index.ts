/**
 * @prefetch-sdk/cache
 * Cache strategies and storage adapters
 */

import type { CacheStrategy, CachedData, Fetcher } from '@prefetch-sdk/core';

/**
 * Cache storage adapter interface
 */
export interface CacheStorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  keys(): string[];
  clear(): void;
}

/**
 * LocalStorage adapter
 */
export const localStorageAdapter: CacheStorageAdapter = {
  get: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('localStorage.setItem failed:', e);
    }
  },
  remove: (key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
  keys: () => {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) keys.push(key);
      }
      return keys;
    } catch {
      return [];
    }
  },
  clear: () => {
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
  },
};

/**
 * SessionStorage adapter
 */
export const sessionStorageAdapter: CacheStorageAdapter = {
  get: (key) => {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key, value) => {
    try {
      sessionStorage.setItem(key, value);
    } catch (e) {
      console.warn('sessionStorage.setItem failed:', e);
    }
  },
  remove: (key) => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
  keys: () => {
    try {
      const keys: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) keys.push(key);
      }
      return keys;
    } catch {
      return [];
    }
  },
  clear: () => {
    try {
      sessionStorage.clear();
    } catch {
      // ignore
    }
  },
};

/**
 * Memory cache adapter (for non-browser environments)
 */
export function createMemoryAdapter(): CacheStorageAdapter {
  const store = new Map<string, string>();
  return {
    get: (key) => store.get(key) ?? null,
    set: (key, value) => store.set(key, value),
    remove: (key) => { store.delete(key); },
    keys: () => Array.from(store.keys()),
    clear: () => store.clear(),
  };
}

/**
 * Cache options
 */
export interface CacheOptions {
  /** Cache key prefix */
  prefix?: string;
  /** Storage adapter */
  storage?: CacheStorageAdapter;
  /** TTL in milliseconds */
  ttl?: number;
  /** Custom serializer */
  serialize?: (data: unknown) => string;
  /** Custom deserializer */
  deserialize?: (str: string) => unknown;
}

const DEFAULT_PREFIX = 'prefetch:';

/**
 * Create a cached fetcher wrapper
 */
export function withCache<TData = unknown, TParams = unknown>(
  fetcher: Fetcher<TData, TParams>,
  strategy: CacheStrategy<TData>,
  options: CacheOptions = {}
): Fetcher<TData, TParams> {
  const {
    prefix = DEFAULT_PREFIX,
    storage = typeof window !== 'undefined' ? localStorageAdapter : createMemoryAdapter(),
    serialize = JSON.stringify,
    deserialize = JSON.parse,
  } = options;

  return async (params: TParams): Promise<TData> => {
    // Get cache key
    const key = `${prefix}${strategy.getKey(params)}`;

    // Try to get from cache
    try {
      const cached = storage.get(key);
      if (cached) {
        const parsed = deserialize(cached) as CachedData<TData>;
        if (!strategy.isValid || strategy.isValid(parsed)) {
          return parsed.data;
        }
      }
    } catch (e) {
      console.warn('Cache read failed:', e);
    }

    // Run cleanup if defined
    if (strategy.cleanup) {
      try {
        strategy.cleanup();
      } catch (e) {
        console.warn('Cache cleanup failed:', e);
      }
    }

    // Fetch data
    const data = await fetcher(params);

    // Store in cache
    try {
      const cached: CachedData<TData> = {
        data,
        timestamp: Date.now(),
        key,
      };
      storage.set(key, serialize(cached));
    } catch (e) {
      console.warn('Cache write failed:', e);
    }

    return data;
  };
}

/**
 * Today cache strategy - cache valid for current day
 */
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
      if (!cached) return false;
      const cachedDate = new Date(cached.timestamp);
      const today = new Date();
      return (
        cachedDate.getFullYear() === today.getFullYear() &&
        cachedDate.getMonth() === today.getMonth() &&
        cachedDate.getDate() === today.getDate()
      );
    },
    cleanup: () => {
      // Remove old entries with different dates
      if (typeof localStorage === 'undefined') return;
      const today = getToday();
      const keysToRemove: string[] = [];
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith('prefetch:') && !key.includes(today)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    },
  };
}

/**
 * TTL cache strategy - cache valid for specified duration
 */
export function ttlCacheStrategy<TData = unknown>(
  keyFn: (...args: unknown[]) => string,
  ttl: number
): CacheStrategy<TData> {
  return {
    getKey: keyFn,
    isValid: (cached) => {
      if (!cached) return false;
      return Date.now() - cached.timestamp < ttl;
    },
  };
}

/**
 * Session cache strategy - cache valid for browser session
 */
export function sessionCacheStrategy<TData = unknown>(
  keyFn: (...args: unknown[]) => string
): CacheStrategy<TData> {
  return {
    getKey: keyFn,
    isValid: () => true, // Always valid within session
  };
}

/**
 * User-scoped cache strategy - cache keyed by user ID
 */
export function userScopedCacheStrategy<TData = unknown>(
  keyFn: (...args: unknown[]) => string,
  getUserId: () => string | number
): CacheStrategy<TData> {
  return {
    getKey: (...args) => `${getUserId()}:${keyFn(...args)}`,
    isValid: () => true,
  };
}
