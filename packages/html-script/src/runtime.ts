/**
 * @prefetch-sdk/html-script
 * Runtime code for inline HTML script (minimal, no dependencies)
 * This code will be inlined in HTML <head> for early execution
 */

/**
 * HTML Prefetch configuration
 */
export interface HtmlPrefetchConfig {
  /** Unique name for this prefetch */
  name: string;
  /** API path */
  path: string;
  /** Request parameters */
  params?: Record<string, unknown>;
  /** Dependencies - names of other prefetches to wait for */
  dependencies?: string[];
  /** Condition function - receives dependency results, return false to skip */
  condition?: (results: unknown[]) => boolean;
  /** Middleware to transform params based on dependency results */
  middlewares?: Array<(results: unknown[]) => Record<string, unknown>>;
  /** Custom fetch options */
  fetchOptions?: RequestInit;
  /** Cache strategy function */
  cacheStrategy?: (path: string, params: string) => CacheInfo;
}

/**
 * Cache info returned by cache strategy
 */
export interface CacheInfo {
  key: string;
  isValid?: (cached: { data: unknown; timestamp: number }) => boolean;
  remove?: () => void;
}

/**
 * Prefetch datasource structure stored on window
 */
export interface PrefetchDatasource {
  /** Source configurations */
  $source: Record<string, { $path: string; $params: unknown }>;
  /** Resolved data cache */
  $data?: Record<string, unknown>;
  /** Prefetch promises by name (using index signature for dynamic keys) */
  [name: string]: unknown;
}

/**
 * Global namespace
 */
export const NAMESPACE = '__PREFETCH_SDK__';

/**
 * Generate GUID
 */
export function guid(): string {
  const s4 = () =>
    Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

/**
 * URL encode object to query string
 */
export function encodeParams(data: Record<string, unknown>): string {
  return Object.keys(data)
    .filter(key => data[key] !== undefined && data[key] !== null)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(String(data[key]))}`)
    .join('&');
}

/**
 * Parse cookies
 */
export function parseCookies(): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (typeof document === 'undefined') return cookies;

  document.cookie.split(/;\s*/).forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx >= 0) {
      const key = pair.substring(0, idx).trim();
      let val = pair.substring(idx + 1).trim();
      if (val.startsWith('"')) val = val.slice(1, -1);
      try {
        cookies[key] = decodeURIComponent(val);
      } catch {
        cookies[key] = val;
      }
    }
  });
  return cookies;
}

/**
 * Get cookie value
 */
export function getCookie(key: string): string | undefined {
  return parseCookies()[key];
}

/**
 * Create cache-enhanced fetcher
 */
export function withCacheStrategy(
  fn: (path: string, params: string, options: Record<string, unknown>) => Promise<unknown>,
  strategy: { getCache: HtmlPrefetchConfig['cacheStrategy'] }
) {
  return async (path: string, params: string, options: Record<string, unknown>) => {
    let cacheInfo: CacheInfo | undefined;

    try {
      cacheInfo = strategy.getCache?.(path, params);
      if (cacheInfo?.remove) {
        cacheInfo.remove();
      }
      if (cacheInfo?.key) {
        const cached = localStorage.getItem(cacheInfo.key);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (!cacheInfo.isValid || cacheInfo.isValid(parsed)) {
            return parsed.data;
          }
        }
      }
    } catch (e) {
      console.warn('Cache read failed:', e);
    }

    const data = await fn(path, params, options);

    try {
      if (cacheInfo?.key) {
        localStorage.setItem(
          cacheInfo.key,
          JSON.stringify({ data, timestamp: Date.now() })
        );
      }
    } catch (e) {
      console.warn('Cache write failed:', e);
    }

    return data;
  };
}

/**
 * Compose middleware functions
 */
export function compose(middlewares: Array<(result: unknown) => unknown> = []) {
  return (initial: unknown) => {
    let result = initial;
    for (const mw of middlewares) {
      result = mw(result);
    }
    return result;
  };
}

/**
 * Create the HTML prefetch runtime
 */
export function createHtmlPrefetchRuntime(options: {
  namespace?: string;
  fetcher: (path: string, params: Record<string, unknown>) => Promise<unknown>;
}) {
  const { namespace = NAMESPACE, fetcher } = options;

  // Initialize datasource on window
  const datasource: PrefetchDatasource = { $source: {} };
  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>)[namespace] = datasource;
  }

  /**
   * Execute prefetch configs
   */
  async function execute(configs: HtmlPrefetchConfig[]): Promise<void> {
    for (const config of configs) {
      const {
        name,
        path,
        params = {},
        dependencies,
        condition,
        middlewares,
        cacheStrategy,
      } = config;

      // Wait for dependencies
      let dependencyResults: unknown[] = [];
      if (dependencies?.length) {
        dependencyResults = await Promise.all(
          dependencies.map(dep => datasource[dep])
        );
      }

      // Check condition
      let shouldPrefetch = condition == null;
      if (typeof condition === 'function') {
        shouldPrefetch = !!condition(dependencyResults);
      }

      // Apply middlewares
      const transformed = compose(middlewares as Array<(r: unknown) => unknown>)(dependencyResults);
      const finalParams = { ...params, ...(transformed as object) };

      // Store source
      datasource.$source[name] = { $path: path, $params: finalParams };

      // Execute prefetch
      if (shouldPrefetch) {
        let fetcherFn = (p: string, ps: Record<string, unknown>) => fetcher(p, ps);

        if (cacheStrategy) {
          const wrapped = withCacheStrategy(
            (p, ps, _) => fetcher(p, JSON.parse(ps)),
            { getCache: cacheStrategy }
          );
          fetcherFn = (p, ps) => wrapped(p, JSON.stringify(ps), {});
        }

        const promise = fetcherFn(path, finalParams) as Promise<unknown> & { clear?: () => void };
        promise.clear = () => {
          delete datasource[name];
        };
        datasource[name] = promise;
      }
    }
  }

  return {
    datasource,
    execute,
    namespace,
  };
}
