<p align="center">
  <img src="./docs/public/logo.svg" width="120" height="120" alt="Prefetch SDK Logo">
</p>

<h1 align="center">Prefetch SDK</h1>

<p align="center">
  通用的预请求解决方案，在 JS 加载前提前发起请求，大幅提升首屏性能
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@prefetch-sdk/core"><img src="https://img.shields.io/npm/v/@prefetch-sdk/core.svg?style=flat&colorA=18181B&colorB=42b883" alt="npm version"></a>
  <a href="https://github.com/Sunny-117/prefetch-sdk/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@prefetch-sdk/core.svg?style=flat&colorA=18181B&colorB=42b883" alt="license"></a>
</p>

---

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

## 发包

### 手动发包

```bash
# 1. 创建 changeset (记录变更)
pnpm changeset

# 2. 更新版本号和 CHANGELOG
pnpm version

# 3. 构建并发布
pnpm release
```

### 自动发包 (CI)

推送到 main 分支后，GitHub Actions 会自动：
- 若有 changeset：创建 Release PR
- 合并 Release PR 后：自动发布到 npm

**注意**：需在 GitHub 仓库设置 `NPM_TOKEN` Secret。

## License

MIT
