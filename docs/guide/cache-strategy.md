# 缓存策略

`@prefetch-sdk/core` 提供了灵活的缓存策略，支持多种存储方式。

## withCache

为请求函数添加缓存能力：

```tsx
import { withCache } from '@prefetch-sdk/core';

const cachedFetcher = withCache(
  fetchData,    // 原始请求函数
  strategy,     // 缓存策略
  {
    prefix: 'prefetch:', // 缓存 key 前缀
    storage: localStorageAdapter, // 存储适配器
  }
);
```

## 内置缓存策略

### todayCacheStrategy

当天有效的缓存策略：

```tsx
import { todayCacheStrategy } from '@prefetch-sdk/core';

const cachedFetcher = withCache(
  fetchData,
  todayCacheStrategy((params) => `data:${params.id}`)
);

// 缓存 key 会自动加上日期：prefetch:data:1:2024-1-15
```

### ttlCacheStrategy

基于 TTL（生存时间）的缓存策略：

```tsx
import { ttlCacheStrategy } from '@prefetch-sdk/core';

const cachedFetcher = withCache(
  fetchData,
  ttlCacheStrategy(
    (params) => `data:${params.id}`,
    5 * 60 * 1000 // 5分钟
  )
);
```

## 自定义缓存策略

```tsx
import { CacheStrategy } from '@prefetch-sdk/core';

const customStrategy: CacheStrategy<MyData> = {
  // 生成缓存 key
  getKey: (...args) => `custom:${JSON.stringify(args)}`,

  // 验证缓存是否有效
  isValid: (cached) => {
    const age = Date.now() - cached.timestamp;
    return age < 60 * 1000; // 1分钟内有效
  },

  // 清理过期缓存（可选）
  cleanup: () => {
    // 清理逻辑
  },
};
```

## 存储适配器

### 内置适配器

```tsx
import {
  localStorageAdapter,   // localStorage
  sessionStorageAdapter, // sessionStorage
  createMemoryAdapter,   // 内存存储
} from '@prefetch-sdk/core';
```

### 自定义适配器

```tsx
import { CacheStorageAdapter } from '@prefetch-sdk/core';

const customAdapter: CacheStorageAdapter = {
  get: (key) => {
    // 返回缓存数据或 null
    return myStorage.get(key);
  },
  set: (key, value) => {
    // 存储缓存数据
    myStorage.set(key, value);
  },
  remove: (key) => {
    // 删除缓存数据
    myStorage.delete(key);
  },
};
```

## 缓存数据结构

```tsx
interface CachedData<TData> {
  data: TData;       // 缓存的数据
  timestamp: number; // 缓存时间戳
  key: string;       // 缓存 key
}
```

## 使用示例

```tsx
import {
  withCache,
  todayCacheStrategy,
  ttlCacheStrategy,
  localStorageAdapter,
  sessionStorageAdapter,
} from '@prefetch-sdk/core';

// 当天缓存，存在 localStorage
const dailyCachedFetcher = withCache(
  fetchDailyData,
  todayCacheStrategy(() => 'daily-data'),
  { storage: localStorageAdapter }
);

// 5分钟缓存，存在 sessionStorage
const shortCachedFetcher = withCache(
  fetchUserData,
  ttlCacheStrategy((params) => `user:${params.id}`, 5 * 60 * 1000),
  { storage: sessionStorageAdapter }
);
```

## 最佳实践

1. **选择合适的存储方式**：
   - `localStorage`: 持久化缓存
   - `sessionStorage`: 会话级缓存
   - `memory`: 单次访问缓存

2. **设置合理的过期时间**：根据数据更新频率设置

3. **使用有意义的缓存 key**：便于调试和手动清理
