import { useState } from 'react';
import { SWRConfig } from 'swr';
import {
  createPrefetchPool,
  withCache,
  todayCacheStrategy,
  uuid,
  formatDate,
  type PrefetchConfig,
} from '@prefetch-sdk/core';
import { getPrefetchSource, consumePrefetch } from '@prefetch-sdk/html-script';
import { useRequestBySwr, preloadBySwr } from '@prefetch-sdk/swr';

// Create a prefetch pool
const pool = createPrefetchPool({ debug: true, namespace: '__DEMO_POOL__' });

// Example fetchers
async function fetchUser(params: { id: number }) {
  const response = await fetch(`https://jsonplaceholder.typicode.com/users/${params.id}`);
  return response.json();
}

async function fetchTodos() {
  const response = await fetch('https://jsonplaceholder.typicode.com/todos?_limit=5');
  return response.json();
}

// Demo: HTML Prefetch Consumption
function HtmlPrefetchDemo() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const source = getPrefetchSource('user:1');

  const handleConsume = async () => {
    setLoading(true);
    const result = await consumePrefetch<Record<string, unknown>>('user:1');
    setData(result ?? null);
    setLoading(false);
  };

  return (
    <div className="demo-section">
      <h3>HTML Prefetch Consumption</h3>
      <p>This data was prefetched in HTML &lt;head&gt; before React loaded.</p>
      {source && <p style={{ fontSize: '0.875rem', color: '#666' }}>Source: {source.path}</p>}
      <button onClick={handleConsume} disabled={loading}>
        {loading ? 'Loading...' : 'Consume Prefetch'}
      </button>
      {data !== null && (
        <div className="data-display">
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

// Demo: SWR Preload
function SwrPreloadDemo() {
  const [preloaded, setPreloaded] = useState(false);

  const { data, pending, refresh } = useRequestBySwr(
    fetchUser,
    preloaded ? { id: 2 } : null,
    { metadata: { levelType: 'user' } }
  );

  const handlePreload = async () => {
    await preloadBySwr(fetchUser, { id: 2 }, { metadata: { levelType: 'user' } });
    setPreloaded(true);
  };

  return (
    <div className="demo-section">
      <h3>
        SWR Preload
        {pending && <span className="status loading">Loading...</span>}
        {data && <span className="status success">Loaded</span>}
      </h3>
      <p>Preload data into SWR cache, then use it with useSWR hook.</p>
      <button onClick={handlePreload} disabled={preloaded}>
        {preloaded ? 'Preloaded' : 'Preload User #2'}
      </button>
      <button onClick={refresh} disabled={!preloaded} className="btn-secondary">
        Refresh
      </button>
      {data !== null && (
        <div className="data-display">
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

// Demo: Cache Strategy
function CacheDemo() {
  const [data, setData] = useState<unknown>(null);
  const [fromCache, setFromCache] = useState(false);

  const cachedFetcher = withCache(
    fetchTodos,
    todayCacheStrategy(() => 'todos-demo'),
    { prefix: 'demo:' }
  );

  const handleFetch = async () => {
    const start = Date.now();
    const result = await cachedFetcher({});
    setData(result);
    setFromCache(Date.now() - start < 50);
  };

  return (
    <div className="demo-section">
      <h3>
        Cache Strategy
        {fromCache && <span className="status success">From Cache</span>}
      </h3>
      <p>Uses today's date as cache key. Data is cached in localStorage.</p>
      <button onClick={handleFetch}>Fetch with Cache</button>
      {data !== null && (
        <div className="data-display">
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

// Demo: Pool API
function PoolDemo() {
  const [poolSize, setPoolSize] = useState(0);
  const [data, setData] = useState<unknown>(null);

  const handlePrefetch = async () => {
    await pool.execute({
      name: `pool-${uuid().slice(0, 8)}`,
      fetcher: fetchUser,
      params: { id: Math.floor(Math.random() * 10) + 1 },
    } as PrefetchConfig);
    setPoolSize(pool.size);
  };

  const handleConsume = async () => {
    const keys = pool.keys();
    if (keys.length > 0) {
      const result = await pool.consume(keys[0]);
      setData(result);
      setPoolSize(pool.size);
    }
  };

  return (
    <div className="demo-section">
      <h3>
        Prefetch Pool
        <span className="status" style={{ background: '#e9ecef', color: '#495057' }}>
          Size: {poolSize}
        </span>
      </h3>
      <p>Manage multiple prefetch requests in a pool.</p>
      <button onClick={handlePrefetch}>Add to Pool</button>
      <button onClick={handleConsume} className="btn-secondary" disabled={poolSize === 0}>
        Consume First
      </button>
      <button onClick={() => { pool.clear(); setPoolSize(0); setData(null); }} className="btn-secondary">
        Clear
      </button>
      {data !== null && (
        <div className="data-display">
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

// Main App
export default function App() {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <SWRConfig value={{ revalidateOnFocus: false }}>
      <div className="container">
        <h1>Prefetch SDK Playground</h1>
        <p className="subtitle">
          A prefetch solution for modern web apps. Today: {formatDate()}
        </p>

        <div className="feature-list">
          <div className="feature-card">
            <h4>HTML Prefetch</h4>
            <p>Start fetching before JS loads.</p>
          </div>
          <div className="feature-card">
            <h4>SWR Integration</h4>
            <p>Preload into SWR cache.</p>
          </div>
          <div className="feature-card">
            <h4>Cache Strategies</h4>
            <p>Flexible caching options.</p>
          </div>
        </div>

        <h2>Examples</h2>
        <HtmlPrefetchDemo />
        <SwrPreloadDemo />

        <h2>Advanced</h2>
        <button onClick={() => setShowAdvanced(!showAdvanced)}>
          {showAdvanced ? 'Hide' : 'Show'} Advanced
        </button>

        {showAdvanced && (
          <>
            <CacheDemo />
            <PoolDemo />
          </>
        )}
      </div>
    </SWRConfig>
  );
}
