# Prefetch SDK

通用的预请求 SDK，支持跨项目公用。

## 包结构

| 包名 | 描述 |
|------|------|
| `@prefetch-sdk/core` | 核心工具包 - 请求池、缓存策略、工具函数 |
| `@prefetch-sdk/html-script` | HTML 内联脚本 - 在 JS 加载前提前发起请求 |
| `@prefetch-sdk/swr` | SWR 集成 - 预热/预加载到 SWR 缓存 |

## 安装

```bash
# 核心包
pnpm add @prefetch-sdk/core

# HTML 预请求
pnpm add @prefetch-sdk/html-script

# SWR 集成
pnpm add @prefetch-sdk/swr
```

## 快速开始

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

在 React 中消费：

```tsx
import { consumePrefetch } from '@prefetch-sdk/html-script';

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

### 3. 缓存策略

```tsx
import { withCache, todayCacheStrategy, ttlCacheStrategy } from '@prefetch-sdk/core';

// 当天缓存
const cachedFetcher = withCache(
  fetchData,
  todayCacheStrategy((params) => `data:${params.id}`)
);

// TTL 缓存 (5分钟)
const ttlFetcher = withCache(
  fetchData,
  ttlCacheStrategy((params) => `data:${params.id}`, 5 * 60 * 1000)
);
```

### 4. 请求池

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

## 开发

```bash
# 安装依赖
pnpm install

# 构建
pnpm build

# 启动 playground
pnpm playground
```

## License

MIT
