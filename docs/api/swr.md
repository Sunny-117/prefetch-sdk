# @prefetch-sdk/swr

SWR 集成，预热/预加载到 SWR 缓存。

## 类型

### Fetcher

```tsx
type Fetcher<TData = unknown, TParams = unknown> = (params: TParams) => Promise<TData> | TData;
```

### RequestMetadata

```tsx
interface RequestMetadata {
  levelType: string;
  [key: string]: unknown;
}
```

### UseRequestBySwrOptions

```tsx
interface UseRequestBySwrOptions {
  metadata: RequestMetadata;
  log?: LogFunction;
}
```

### LogType

```tsx
enum LogType {
  createCache = 'createCache',
  hitCache = 'hitCache',
  hitPreloadCache = 'hitPreloadCache',
  resourceFinished = 'resourceFinished',
  createPreloadCache = 'createPreloadCache',
}
```

### LogFunction

```tsx
type LogFunction = (type: LogType, data?: Record<string, unknown>) => void;
```

### IPreloader

```tsx
interface IPreloader<TData = unknown, TParams = Record<string, unknown>> {
  fetcher: Fetcher<TData, TParams>;
  params: TParams;
  options: UseRequestBySwrOptions;
}
```

## Hooks

### useRequestBySwr

使用 SWR 进行数据请求的 Hook，支持预请求。

```tsx
function useRequestBySwr<TData, TParams>(
  task: Fetcher<TData, TParams>,
  params: TParams | null,
  options: UseRequestBySwrOptions
): {
  data: TData | undefined;
  pending: boolean;
  error: Error | undefined;
  refresh: () => void;
  mutate: KeyedMutator<TData>;
};
```

**参数：**
- `task` - 请求函数
- `params` - 请求参数，传 `null` 则不发起请求
- `options.metadata` - 元数据，用于生成缓存 key
- `options.log` - 日志函数

### useRequestBySwrWithPreloadConfig

使用预加载配置的 SWR Hook。

```tsx
function useRequestBySwrWithPreloadConfig<TData, TParams>(
  config: IPreloader<TData, TParams>
): ReturnType<typeof useRequestBySwr<TData, TParams>>;
```

### usePreloadBySwrCallback

获取预加载回调的 Hook。

```tsx
function usePreloadBySwrCallback(): <TData, TParams>(
  fetcher: Fetcher<TData, TParams>,
  params: TParams,
  options: UseRequestBySwrOptions
) => Promise<TData>;
```

## 预加载函数

### preloadBySwr

预加载数据到 SWR 缓存。

```tsx
async function preloadBySwr<TData, TParams>(
  fetcher: Fetcher<TData, TParams>,
  params: TParams,
  options: UseRequestBySwrOptions & { key?: string }
): Promise<TData>;
```

### createPreloadConfig

创建预加载配置。

```tsx
function createPreloadConfig<TData, TParams>(
  fetcher: Fetcher<TData, TParams>,
  params: TParams,
  metadata: RequestMetadata
): IPreloader<TData, TParams>;
```

### executePreloadPool

执行 SWR 预加载池，批量预加载多个请求。

```tsx
async function executePreloadPool(
  preloadReqList: Array<IPreloader | (() => Promise<(data: unknown) => IPreloader>)>,
  dependenciesList: Array<Record<string, unknown>> | (() => Promise<Array<Record<string, unknown>>>),
  options?: { parallel?: boolean }
): Promise<unknown[]>;
```

## 使用示例

```tsx
import {
  useRequestBySwr,
  preloadBySwr,
  usePreloadBySwrCallback,
  createPreloadConfig,
  executePreloadPool,
} from '@prefetch-sdk/swr';

// 基础使用
function UserProfile() {
  const { data, pending, refresh } = useRequestBySwr(
    fetchUser,
    { id: 1 },
    { metadata: { levelType: 'user' } }
  );

  if (pending) return <div>加载中...</div>;
  return <div>{data?.name}</div>;
}

// 预加载
async function preloadData() {
  await preloadBySwr(
    fetchUser,
    { id: 1 },
    { metadata: { levelType: 'user' } }
  );
}

// 批量预加载
async function batchPreload() {
  await executePreloadPool([
    createPreloadConfig(fetchUser, { id: 1 }, { levelType: 'user' }),
    createPreloadConfig(fetchConfig, {}, { levelType: 'config' }),
  ], []);
}

// 使用预加载回调
function App() {
  const preload = usePreloadBySwrCallback();

  return (
    <button onMouseEnter={() => preload(fetchUser, { id: 1 }, { metadata: { levelType: 'user' } })}>
      查看用户
    </button>
  );
}
```
