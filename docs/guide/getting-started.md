# 快速开始

## 安装

```bash
# 核心包
pnpm add @prefetch-sdk/core

# HTML 预请求
pnpm add @prefetch-sdk/html-script

# SWR 集成
pnpm add @prefetch-sdk/swr
```

## 基础使用

### 1. HTML 预请求

在 HTML `<head>` 中内联脚本，JS 加载前就开始请求：

```html
<head>
  <script>
    (function() {
      window.__PREFETCH_SDK__ = { $source: {} };
      var promise = fetch('/api/user').then(r => r.json());
      promise.clear = function() { delete window.__PREFETCH_SDK__['user']; };
      window.__PREFETCH_SDK__['user'] = promise;
      window.__PREFETCH_SDK__.$source['user'] = { $path: '/api/user', $params: {} };
    })();
  </script>
</head>
```

在 React 中消费预请求数据：

```tsx
import { consumePrefetch } from '@prefetch-sdk/html-script';

// 消费预请求的数据
const data = await consumePrefetch<User>('user');
```

### 2. SWR 预热

```tsx
import { preloadBySwr, useRequestBySwr } from '@prefetch-sdk/swr';

// 预热到 SWR 缓存
await preloadBySwr(fetchUser, { id: 1 }, { metadata: { levelType: 'user' } });

// 组件中使用
function UserProfile() {
  const { data, pending, refresh } = useRequestBySwr(
    fetchUser,
    { id: 1 },
    { metadata: { levelType: 'user' } }
  );
  return <div>{data?.name}</div>;
}
```

### 3. 使用缓存策略

```tsx
import { withCache, todayCacheStrategy, ttlCacheStrategy } from '@prefetch-sdk/core';

// 当天缓存
const cachedFetcher = withCache(
  fetchData,
  todayCacheStrategy((params) => `data:${params.id}`)
);

// TTL 缓存（5分钟）
const ttlFetcher = withCache(
  fetchData,
  ttlCacheStrategy((params) => `data:${params.id}`, 5 * 60 * 1000)
);
```

### 4. 使用请求池

```tsx
import { createPrefetchPool } from '@prefetch-sdk/core';

const pool = createPrefetchPool({ debug: true });

// 添加预请求
await pool.execute({
  name: 'userData',
  fetcher: fetchUser,
  params: { id: 1 },
});

// 消费
const data = await pool.consume('userData');
```

## 下一步

- [HTML 预请求详解](/guide/html-prefetch)
- [SWR 集成详解](/guide/swr-integration)
- [缓存策略](/guide/cache-strategy)
- [请求池](/guide/prefetch-pool)
