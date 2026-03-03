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

// 创建预请求池
const pool = createPrefetchPool({ debug: true, namespace: '__DEMO_POOL__' });

// 示例请求函数
async function fetchUser(params: { id: number }) {
  const response = await fetch(`https://jsonplaceholder.typicode.com/users/${params.id}`);
  return response.json();
}

async function fetchTodos() {
  const response = await fetch('https://jsonplaceholder.typicode.com/todos?_limit=5');
  return response.json();
}

// 演示: HTML 预请求消费
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
      <h3>HTML 预请求消费</h3>
      <p>此数据在 HTML &lt;head&gt; 中预请求，React 加载前已开始请求。</p>
      {source && <p style={{ fontSize: '0.875rem', color: '#666' }}>来源: {source.path}</p>}
      <button onClick={handleConsume} disabled={loading}>
        {loading ? '加载中...' : '消费预请求'}
      </button>
      {data !== null && (
        <div className="data-display">
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

// 演示: SWR 预加载
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
        SWR 预加载
        {pending && <span className="status loading">加载中...</span>}
        {data && <span className="status success">已加载</span>}
      </h3>
      <p>预加载数据到 SWR 缓存，然后通过 useSWR hook 使用。</p>
      <button onClick={handlePreload} disabled={preloaded}>
        {preloaded ? '已预加载' : '预加载用户 #2'}
      </button>
      <button onClick={refresh} disabled={!preloaded} className="btn-secondary">
        刷新
      </button>
      {data !== null && (
        <div className="data-display">
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

// 演示: 缓存策略
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
        缓存策略
        {fromCache && <span className="status success">来自缓存</span>}
      </h3>
      <p>使用当天日期作为缓存 key，数据缓存在 localStorage 中。</p>
      <button onClick={handleFetch}>带缓存请求</button>
      {data !== null && (
        <div className="data-display">
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

// 演示: 请求池 API
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
        预请求池
        <span className="status" style={{ background: '#e9ecef', color: '#495057' }}>
          数量: {poolSize}
        </span>
      </h3>
      <p>在请求池中管理多个预请求。</p>
      <button onClick={handlePrefetch}>添加到池</button>
      <button onClick={handleConsume} className="btn-secondary" disabled={poolSize === 0}>
        消费第一个
      </button>
      <button onClick={() => { pool.clear(); setPoolSize(0); setData(null); }} className="btn-secondary">
        清空
      </button>
      {data !== null && (
        <div className="data-display">
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

// 主应用
export default function App() {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <SWRConfig value={{ revalidateOnFocus: false }}>
      <div className="container">
        <h1>Prefetch SDK 演示</h1>
        <p className="subtitle">
          现代 Web 应用的预请求解决方案。今日: {formatDate()}
        </p>

        <div className="feature-list">
          <div className="feature-card">
            <h4>HTML 预请求</h4>
            <p>JS 加载前开始请求</p>
          </div>
          <div className="feature-card">
            <h4>SWR 集成</h4>
            <p>预加载到 SWR 缓存</p>
          </div>
          <div className="feature-card">
            <h4>缓存策略</h4>
            <p>灵活的缓存选项</p>
          </div>
        </div>

        <h2>示例</h2>
        <HtmlPrefetchDemo />
        <SwrPreloadDemo />

        <h2>高级功能</h2>
        <button onClick={() => setShowAdvanced(!showAdvanced)}>
          {showAdvanced ? '隐藏' : '显示'} 高级功能
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
