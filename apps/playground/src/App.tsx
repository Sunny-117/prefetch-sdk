import { useState } from 'react';
import {
  createPrefetchPool,
  type PrefetchConfig,
} from '@prefetch-sdk/core';
import {
  useConsumePrefetch,
  usePrefetch,
  usePrefetchOnIdle,
  PrefetchProvider,
} from '@prefetch-sdk/react';
import { getPrefetchSource } from '@prefetch-sdk/html-script';
import { todayCacheStrategy, withCache } from '@prefetch-sdk/cache';
import { uuid, formatDate } from '@prefetch-sdk/utils';

// Create a prefetch pool
const pool = createPrefetchPool({ debug: true, namespace: '__DEMO_POOL__' });

// Example fetcher
async function fetchUser(params: { id: number }) {
  const response = await fetch(`https://jsonplaceholder.typicode.com/users/${params.id}`);
  return response.json();
}

async function fetchTodos() {
  const response = await fetch('https://jsonplaceholder.typicode.com/todos?_limit=5');
  return response.json();
}

// Demo component for HTML prefetch consumption
function HtmlPrefetchDemo() {
  const { data, isLoading, error } = useConsumePrefetch<{ id: number; name: string; email: string }>('user:1');

  const source = getPrefetchSource('user:1');

  return (
    <div className="demo-section">
      <h3>
        HTML Prefetch Consumption
        {isLoading && <span className="status loading">Loading...</span>}
        {Boolean(data) && <span className="status success">Success</span>}
        {error && <span className="status error">Error</span>}
      </h3>
      <p>This data was prefetched in the HTML &lt;head&gt; before React loaded.</p>
      {source && (
        <p style={{ fontSize: '0.875rem', color: '#666' }}>
          Source: {source.path}
        </p>
      )}
      {data !== null && data !== undefined && (
        <div className="data-display">
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

// Demo component for React prefetch
function ReactPrefetchDemo() {
  const config: PrefetchConfig<unknown, { id: number }> = {
    name: 'react-user-2',
    fetcher: fetchUser,
    params: { id: 2 },
  };

  const { prefetch, data, isLoading, error } = usePrefetch(config);

  return (
    <div className="demo-section">
      <h3>
        React Prefetch
        {isLoading && <span className="status loading">Loading...</span>}
        {Boolean(data) && <span className="status success">Success</span>}
        {error && <span className="status error">Error</span>}
      </h3>
      <p>Click the button to prefetch user data using React hook.</p>
      <button onClick={prefetch} disabled={isLoading}>
        {isLoading ? 'Loading...' : 'Prefetch User #2'}
      </button>
      {data !== null && data !== undefined && (
        <div className="data-display">
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

// Demo component for idle prefetch
function IdlePrefetchDemo() {
  const [status, setStatus] = useState<'idle' | 'scheduled' | 'done'>('idle');

  const config: PrefetchConfig<unknown, { id: number }> = {
    name: 'idle-user-3',
    fetcher: async (params) => {
      const data = await fetchUser(params);
      setStatus('done');
      return data;
    },
    params: { id: 3 },
  };

  const { prefetch, cancel } = usePrefetchOnIdle(config, {
    timeout: 2000,
    delay: 1000,
  });

  const handleSchedule = () => {
    setStatus('scheduled');
    prefetch();
  };

  return (
    <div className="demo-section">
      <h3>
        Idle Prefetch
        <span className="status" style={{
          background: status === 'idle' ? '#e9ecef' : status === 'scheduled' ? '#fff3cd' : '#d4edda',
          color: status === 'idle' ? '#495057' : status === 'scheduled' ? '#856404' : '#155724',
        }}>
          {status}
        </span>
      </h3>
      <p>Prefetch will be executed when browser is idle (after 1s delay).</p>
      <button onClick={handleSchedule} disabled={status !== 'idle'}>
        Schedule Idle Prefetch
      </button>
      <button onClick={cancel} className="btn-secondary" disabled={status !== 'scheduled'}>
        Cancel
      </button>
    </div>
  );
}

// Demo component for cache strategy
function CacheDemo() {
  const [data, setData] = useState<unknown>(null);
  const [fromCache, setFromCache] = useState(false);

  // Create cached fetcher
  const cachedFetcher = withCache(
    fetchTodos,
    todayCacheStrategy(() => 'todos-demo'),
    { prefix: 'demo:' }
  );

  const handleFetch = async () => {
    const start = Date.now();
    const result = await cachedFetcher({});
    setData(result);
    setFromCache(Date.now() - start < 50); // If very fast, likely from cache
  };

  return (
    <div className="demo-section">
      <h3>
        Cache Strategy
        {fromCache && <span className="status success">From Cache</span>}
      </h3>
      <p>Uses today's date as cache key. Data is cached in localStorage.</p>
      <button onClick={handleFetch}>Fetch with Cache</button>
      {data !== null && data !== undefined && (
        <div className="data-display">
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

// Demo component for pool API
function PoolDemo() {
  const [poolSize, setPoolSize] = useState(0);
  const [data, setData] = useState<unknown>(null);

  const handlePrefetch = async () => {
    await pool.execute({
      name: `pool-request-${uuid().slice(0, 8)}`,
      fetcher: fetchUser,
      params: { id: Math.floor(Math.random() * 10) + 1 },
    });
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

  const handleClear = () => {
    pool.clear();
    setPoolSize(0);
    setData(null);
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
      <button onClick={handleClear} className="btn-secondary">
        Clear Pool
      </button>
      {data !== null && data !== undefined && (
        <div className="data-display">
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

// Main App component
export default function App() {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <PrefetchProvider pool={pool}>
      <div className="container">
        <h1>Prefetch SDK Playground</h1>
        <p className="subtitle">
          A comprehensive prefetch solution for modern web applications.
          Today: {formatDate()}
        </p>

        <div className="feature-list">
          <div className="feature-card">
            <h4>HTML Prefetch</h4>
            <p>Start fetching before JS loads for maximum performance.</p>
          </div>
          <div className="feature-card">
            <h4>React Integration</h4>
            <p>Hooks for easy integration with React applications.</p>
          </div>
          <div className="feature-card">
            <h4>Cache Strategies</h4>
            <p>Flexible caching with localStorage, sessionStorage, or memory.</p>
          </div>
          <div className="feature-card">
            <h4>SWR Support</h4>
            <p>Seamless integration with SWR for data fetching.</p>
          </div>
        </div>

        <h2>Basic Examples</h2>
        <HtmlPrefetchDemo />
        <ReactPrefetchDemo />

        <h2>Advanced Examples</h2>
        <button onClick={() => setShowAdvanced(!showAdvanced)}>
          {showAdvanced ? 'Hide' : 'Show'} Advanced Examples
        </button>

        {showAdvanced && (
          <>
            <IdlePrefetchDemo />
            <CacheDemo />
            <PoolDemo />
          </>
        )}
      </div>
    </PrefetchProvider>
  );
}
