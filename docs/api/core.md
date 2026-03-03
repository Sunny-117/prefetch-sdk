# @prefetch-sdk/core

核心工具包，包含请求池、缓存策略和工具函数。

## 类型

### Fetcher

```tsx
type Fetcher<TData = unknown, TParams = unknown> = (params: TParams) => Promise<TData> | TData;
```

### PrefetchConfig

```tsx
interface PrefetchConfig<TData = unknown, TParams = unknown> {
  name: string;
  fetcher: Fetcher<TData, TParams>;
  params?: TParams;
  dependencies?: string[];
  condition?: (dependencyResults: unknown[]) => boolean;
}
```

### PrefetchEntry

```tsx
interface PrefetchEntry<TData = unknown, TParams = unknown> {
  promise: Promise<TData>;
  config: PrefetchConfig<TData, TParams>;
  timestamp: number;
  status: 'pending' | 'fulfilled' | 'rejected';
  data?: TData;
  error?: Error;
}
```

### CacheStrategy

```tsx
interface CacheStrategy<TData = unknown> {
  getKey: (...args: unknown[]) => string;
  isValid?: (cached: CachedData<TData>) => boolean;
  cleanup?: () => void;
}
```

### CachedData

```tsx
interface CachedData<TData = unknown> {
  data: TData;
  timestamp: number;
  key: string;
}
```

### CacheStorageAdapter

```tsx
interface CacheStorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}
```

## 请求池

### createPrefetchPool

创建预请求池实例。

```tsx
function createPrefetchPool(config?: {
  namespace?: string;
  debug?: boolean;
}): PrefetchPool;
```

### getGlobalPool

获取全局单例请求池。

```tsx
function getGlobalPool(): PrefetchPool;
```

### PrefetchPool

```tsx
class PrefetchPool {
  has(name: string): boolean;
  get<TData, TParams>(name: string): PrefetchEntry<TData, TParams> | undefined;
  getSource(name: string): { config: PrefetchConfig; params: unknown } | undefined;
  execute<TData, TParams>(config: PrefetchConfig<TData, TParams>): Promise<TData | undefined>;
  executeAll<TData>(configs: PrefetchConfig<TData>[], options?: { parallel?: boolean }): Promise<Array<TData | undefined>>;
  consume<TData>(name: string, clear?: boolean): Promise<TData | undefined>;
  delete(name: string): boolean;
  clear(): void;
  keys(): string[];
  get size(): number;
  mountToWindow(): void;
}
```

## 缓存策略

### withCache

为请求函数添加缓存能力。

```tsx
function withCache<TData, TParams>(
  fetcher: Fetcher<TData, TParams>,
  strategy: CacheStrategy<TData>,
  options?: {
    prefix?: string;
    storage?: CacheStorageAdapter;
  }
): Fetcher<TData, TParams>;
```

### todayCacheStrategy

当天有效的缓存策略。

```tsx
function todayCacheStrategy<TData>(
  keyFn: (...args: unknown[]) => string
): CacheStrategy<TData>;
```

### ttlCacheStrategy

基于 TTL 的缓存策略。

```tsx
function ttlCacheStrategy<TData>(
  keyFn: (...args: unknown[]) => string,
  ttl: number
): CacheStrategy<TData>;
```

### 存储适配器

```tsx
const localStorageAdapter: CacheStorageAdapter;
const sessionStorageAdapter: CacheStorageAdapter;
function createMemoryAdapter(): CacheStorageAdapter;
```

## 工具函数

### uuid

生成 UUID。

```tsx
function uuid(): string;
```

### parseCookies

解析 cookie 字符串。

```tsx
function parseCookies(cookieString?: string): Record<string, string>;
```

### getCookie

获取指定 cookie。

```tsx
function getCookie(key: string): string | undefined;
```

### encodeParams

编码 URL 参数。

```tsx
function encodeParams(params: Record<string, unknown>): string;
```

### formatDate

格式化日期。

```tsx
function formatDate(date?: Date): string;
```

### runWhenIdle

在空闲时执行回调。

```tsx
function runWhenIdle(callback: () => void, timeout?: number): () => void;
```
