/**
 * @prefetch-sdk/html-script
 * HTML inline script for early prefetch before JS loads
 */

// ============ Types ============

export interface HtmlPrefetchConfig {
  name: string;
  path: string;
  params?: Record<string, unknown>;
  dependencies?: string[];
  condition?: (results: unknown[]) => boolean;
  middlewares?: Array<(results: unknown[]) => Record<string, unknown>>;
  cacheStrategy?: (path: string, params: string) => CacheInfo;
}

export interface CacheInfo {
  key: string;
  isValid?: (cached: { data: unknown; timestamp: number }) => boolean;
  remove?: () => void;
}

export interface PrefetchDatasource {
  $source: Record<string, { $path: string; $params: unknown }>;
  $data?: Record<string, unknown>;
  [name: string]: unknown;
}

export const NAMESPACE = '__PREFETCH_SDK__';

// ============ Script Generation ============

export interface GenerateScriptOptions {
  namespace?: string;
  minify?: boolean;
  apiPrefix?: string;
  authCode?: string;
}

const FETCH_CODE = `
async function prefetchFetch(path, params) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) throw new Error('Prefetch failed: ' + response.status);
  return response.json();
}
`;

export function generateInlineScript(
  configs: HtmlPrefetchConfig[],
  options: GenerateScriptOptions = {}
): string {
  const { namespace = NAMESPACE, minify = false, apiPrefix = '', authCode = '' } = options;

  const configsJson = JSON.stringify(configs, (_key, value) => {
    if (typeof value === 'function') return `__FUNC__${value.toString()}__FUNC__`;
    return value;
  });

  const configsCode = configsJson.replace(
    /"__FUNC__(.*?)__FUNC__"/g,
    (_, fn) => fn.replace(/\\n/g, '\n').replace(/\\"/g, '"')
  );

  const script = `
(function() {
  if (!window.fetch) return;

  var NAMESPACE = '${namespace}';
  var API_PREFIX = '${apiPrefix}';
  var datasource = window[NAMESPACE] = { $source: {} };

  function parseCookies() {
    var cookies = {};
    document.cookie.split(/;\\s*/).forEach(function(pair) {
      var idx = pair.indexOf('=');
      if (idx >= 0) {
        var key = pair.substring(0, idx).trim();
        var val = pair.substring(idx + 1).trim();
        if (val[0] === '"') val = val.slice(1, -1);
        try { cookies[key] = decodeURIComponent(val); } catch (e) { cookies[key] = val; }
      }
    });
    return cookies;
  }

  function getCookie(key) { return parseCookies()[key]; }

  ${authCode}

  function withCache(fn, strategy) {
    return async function(path, params) {
      var cacheInfo;
      try {
        cacheInfo = strategy.getCache(path, JSON.stringify(params));
        if (cacheInfo && cacheInfo.remove) cacheInfo.remove();
        if (cacheInfo && cacheInfo.key) {
          var cached = localStorage.getItem(cacheInfo.key);
          if (cached) {
            var parsed = JSON.parse(cached);
            if (!cacheInfo.isValid || cacheInfo.isValid(parsed)) return parsed.data;
          }
        }
      } catch (e) {}
      var data = await fn(path, params);
      try {
        if (cacheInfo && cacheInfo.key) {
          localStorage.setItem(cacheInfo.key, JSON.stringify({ data: data, timestamp: Date.now() }));
        }
      } catch (e) {}
      return data;
    };
  }

  function compose(mws) {
    return function(initial) {
      var result = initial;
      for (var i = 0; i < mws.length; i++) result = mws[i](result);
      return result;
    };
  }

  ${FETCH_CODE}

  var configs = ${configsCode};

  configs.forEach(async function(config) {
    var name = config.name;
    var path = API_PREFIX + config.path;
    var params = config.params || {};
    var deps = config.dependencies || [];
    var condition = config.condition;
    var mws = config.middlewares || [];
    var cacheStrategy = config.cacheStrategy;

    var depResults = [];
    if (deps.length) depResults = await Promise.all(deps.map(function(d) { return datasource[d]; }));

    var shouldPrefetch = condition == null || condition(depResults);
    var transformed = compose(mws)(depResults);
    var finalParams = Object.assign({}, params, transformed || {});

    datasource.$source[name] = { $path: path, $params: finalParams };

    if (shouldPrefetch) {
      var fetchFn = cacheStrategy ? withCache(prefetchFetch, { getCache: cacheStrategy }) : prefetchFetch;
      var promise = fetchFn(path, finalParams);
      promise.clear = function() { delete datasource[name]; };
      datasource[name] = promise;
    }
  });
})();
`.trim();

  if (minify) {
    return script.replace(/\/\/.*$/gm, '').replace(/\n\s*\n/g, '\n').replace(/^\s+/gm, '').trim();
  }
  return script;
}

export function generateScriptTag(configs: HtmlPrefetchConfig[], options?: GenerateScriptOptions): string {
  return `<script>\n${generateInlineScript(configs, options)}\n</script>`;
}

// ============ Consumption ============

export async function consumePrefetch<TData = unknown>(
  name: string,
  options: { namespace?: string; clear?: boolean; fallback?: () => Promise<TData> } = {}
): Promise<TData | undefined> {
  const { namespace = NAMESPACE, clear = true, fallback } = options;

  if (typeof window === 'undefined') return fallback?.();

  const datasource = (window as unknown as Record<string, unknown>)[namespace] as PrefetchDatasource | undefined;
  if (!datasource) return fallback?.();

  const promise = datasource[name] as (Promise<unknown> & { clear?: () => void }) | undefined;
  if (!promise) return fallback?.();

  try {
    const data = await promise;
    return data as TData;
  } catch {
    return fallback?.();
  } finally {
    if (clear && promise.clear) promise.clear();
  }
}

export function getPrefetchSource(
  name: string,
  options: { namespace?: string } = {}
): { path: string; params: unknown } | undefined {
  const { namespace = NAMESPACE } = options;
  if (typeof window === 'undefined') return undefined;

  const datasource = (window as unknown as Record<string, unknown>)[namespace] as PrefetchDatasource | undefined;
  const source = datasource?.$source?.[name];
  if (!source) return undefined;

  return { path: source.$path, params: source.$params };
}

export function isPrefetchParamsMatch(
  name: string,
  params: unknown,
  options: { namespace?: string; comparator?: (a: unknown, b: unknown) => boolean } = {}
): boolean {
  const { namespace = NAMESPACE, comparator = (a, b) => JSON.stringify(a) === JSON.stringify(b) } = options;
  const source = getPrefetchSource(name, { namespace });
  return source ? comparator(params, source.params) : false;
}
