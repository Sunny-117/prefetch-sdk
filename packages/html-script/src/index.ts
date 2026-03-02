/**
 * @prefetch-sdk/html-script
 * Tools to generate inline HTML script for early prefetch
 */

import type { HtmlPrefetchConfig, PrefetchDatasource } from './runtime';
export type { HtmlPrefetchConfig, PrefetchDatasource, CacheInfo } from './runtime';

/**
 * Options for generating HTML script
 */
export interface GenerateScriptOptions {
  /** Global namespace for prefetch data */
  namespace?: string;
  /** Minify the output script */
  minify?: boolean;
  /** API prefix for requests */
  apiPrefix?: string;
  /** Headers to include in requests */
  headers?: Record<string, string>;
  /** Custom authentication function code */
  authCode?: string;
}

/**
 * Default fetch implementation code
 */
const DEFAULT_FETCH_CODE = `
async function prefetchFetch(path, params) {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    throw new Error('Prefetch failed: ' + response.status);
  }
  return response.json();
}
`;

/**
 * Generate inline script code for HTML
 */
export function generateInlineScript(
  configs: HtmlPrefetchConfig[],
  options: GenerateScriptOptions = {}
): string {
  const {
    namespace = '__PREFETCH_SDK__',
    minify = false,
    apiPrefix = '',
    authCode = '',
  } = options;

  const configsJson = JSON.stringify(configs, (_key, value) => {
    // Serialize functions as strings
    if (typeof value === 'function') {
      return `__FUNC__${value.toString()}__FUNC__`;
    }
    return value;
  });

  // Restore function strings to actual functions
  const configsCode = configsJson.replace(
    /"__FUNC__(.*?)__FUNC__"/g,
    (_, fn) => fn.replace(/\\n/g, '\n').replace(/\\"/g, '"')
  );

  const script = `
(function() {
  if (!window.fetch) return;

  var NAMESPACE = '${namespace}';
  var API_PREFIX = '${apiPrefix}';

  // Initialize datasource
  var datasource = window[NAMESPACE] = { $source: {} };

  // Utils
  function guid() {
    var s4 = function() {
      return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    };
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
  }

  function parseCookies() {
    var cookies = {};
    document.cookie.split(/;\\s*/).forEach(function(pair) {
      var idx = pair.indexOf('=');
      if (idx >= 0) {
        var key = pair.substring(0, idx).trim();
        var val = pair.substring(idx + 1).trim();
        if (val[0] === '"') val = val.slice(1, -1);
        try { cookies[key] = decodeURIComponent(val); }
        catch (e) { cookies[key] = val; }
      }
    });
    return cookies;
  }

  function getCookie(key) {
    return parseCookies()[key];
  }

  ${authCode}

  // Cache strategy wrapper
  function withCache(fn, strategy) {
    return async function(path, params, opts) {
      var cacheInfo;
      try {
        cacheInfo = strategy.getCache(path, JSON.stringify(params));
        if (cacheInfo && cacheInfo.remove) cacheInfo.remove();
        if (cacheInfo && cacheInfo.key) {
          var cached = localStorage.getItem(cacheInfo.key);
          if (cached) {
            var parsed = JSON.parse(cached);
            if (!cacheInfo.isValid || cacheInfo.isValid(parsed)) {
              return parsed.data;
            }
          }
        }
      } catch (e) { console.warn('Cache read failed:', e); }

      var data = await fn(path, params, opts);

      try {
        if (cacheInfo && cacheInfo.key) {
          localStorage.setItem(cacheInfo.key, JSON.stringify({ data: data, timestamp: Date.now() }));
        }
      } catch (e) { console.warn('Cache write failed:', e); }

      return data;
    };
  }

  // Compose middlewares
  function compose(middlewares) {
    return function(initial) {
      var result = initial;
      for (var i = 0; i < middlewares.length; i++) {
        result = middlewares[i](result);
      }
      return result;
    };
  }

  ${DEFAULT_FETCH_CODE}

  // Prefetch configs
  var configs = ${configsCode};

  // Execute prefetches
  configs.forEach(async function(config) {
    var name = config.name;
    var path = API_PREFIX + config.path;
    var params = config.params || {};
    var dependencies = config.dependencies || [];
    var condition = config.condition;
    var middlewares = config.middlewares || [];
    var cacheStrategy = config.cacheStrategy;

    // Wait for dependencies
    var depResults = [];
    if (dependencies.length) {
      depResults = await Promise.all(dependencies.map(function(dep) {
        return datasource[dep];
      }));
    }

    // Check condition
    var shouldPrefetch = condition == null;
    if (typeof condition === 'function') {
      shouldPrefetch = !!condition(depResults);
    }

    // Apply middlewares
    var transformed = compose(middlewares)(depResults);
    var finalParams = Object.assign({}, params, transformed || {});

    // Store source
    datasource.$source[name] = { $path: path, $params: finalParams };

    // Execute
    if (shouldPrefetch) {
      var fetchFn = prefetchFetch;
      if (cacheStrategy) {
        fetchFn = withCache(prefetchFetch, { getCache: cacheStrategy });
      }
      var promise = fetchFn(path, finalParams);
      promise.clear = function() { delete datasource[name]; };
      datasource[name] = promise;
    }
  });
})();
`.trim();

  if (minify) {
    // Basic minification - remove comments and extra whitespace
    return script
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\n\s*\n/g, '\n')
      .replace(/^\s+/gm, '')
      .trim();
  }

  return script;
}

/**
 * Generate HTML script tag
 */
export function generateScriptTag(
  configs: HtmlPrefetchConfig[],
  options: GenerateScriptOptions = {}
): string {
  const script = generateInlineScript(configs, options);
  return `<script>\n${script}\n</script>`;
}

/**
 * Consume prefetch from window datasource
 */
export async function consumePrefetch<TData = unknown>(
  name: string,
  options: {
    namespace?: string;
    clear?: boolean;
    fallback?: () => Promise<TData>;
  } = {}
): Promise<TData | undefined> {
  const { namespace = '__PREFETCH_SDK__', clear = true, fallback } = options;

  if (typeof window === 'undefined') {
    return fallback?.();
  }

  const datasource = (window as unknown as Record<string, unknown>)[namespace] as PrefetchDatasource | undefined;
  if (!datasource) {
    return fallback?.();
  }

  const promise = datasource[name] as (Promise<unknown> & { clear?: () => void }) | undefined;
  if (!promise) {
    return fallback?.();
  }

  try {
    const data = await promise;
    return data as TData;
  } catch (error) {
    console.warn(`Prefetch "${name}" consumption failed:`, error);
    return fallback?.();
  } finally {
    if (clear && promise.clear) {
      promise.clear();
    }
  }
}

/**
 * Get prefetch source config
 */
export function getPrefetchSource(
  name: string,
  options: { namespace?: string } = {}
): { path: string; params: unknown } | undefined {
  const { namespace = '__PREFETCH_SDK__' } = options;

  if (typeof window === 'undefined') return undefined;

  const datasource = (window as unknown as Record<string, unknown>)[namespace] as PrefetchDatasource | undefined;
  if (!datasource?.$source) return undefined;

  const source = datasource.$source[name];
  if (!source) return undefined;

  return {
    path: source.$path,
    params: source.$params,
  };
}

/**
 * Check if prefetch params match
 */
export function isPrefetchParamsMatch(
  name: string,
  params: unknown,
  options: {
    namespace?: string;
    comparator?: (a: unknown, b: unknown) => boolean;
  } = {}
): boolean {
  const {
    namespace = '__PREFETCH_SDK__',
    comparator = (a, b) => JSON.stringify(a) === JSON.stringify(b),
  } = options;

  const source = getPrefetchSource(name, { namespace });
  if (!source) return false;

  return comparator(params, source.params);
}
