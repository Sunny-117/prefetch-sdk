# SWR 集成

`@prefetch-sdk/swr` 包提供了与 SWR 的深度集成，支持预热数据到 SWR 缓存。

## 安装

```bash
pnpm add @prefetch-sdk/swr swr
```

## useRequestBySwr

封装了 useSWR 的 Hook，支持预请求场景：

```tsx
import { useRequestBySwr } from '@prefetch-sdk/swr';

function UserProfile() {
  const { data, pending, error, refresh, mutate } = useRequestBySwr(
    fetchUser,           // 请求函数
    { id: 1 },          // 参数，传 null 则不发起请求
    {
      metadata: { levelType: 'user' }, // 元数据，用于生成缓存 key
      log: (type, data) => console.log(type, data), // 日志函数
    }
  );

  if (pending) return <div>加载中...</div>;
  if (error) return <div>加载失败</div>;

  return (
    <div>
      <h1>{data.name}</h1>
      <button onClick={refresh}>刷新</button>
    </div>
  );
}
```

## preloadBySwr

预加载数据到 SWR 缓存：

```tsx
import { preloadBySwr } from '@prefetch-sdk/swr';

// 在路由切换前预加载
async function onRouteChange(nextRoute) {
  if (nextRoute === '/user') {
    await preloadBySwr(fetchUser, { id: 1 }, { metadata: { levelType: 'user' } });
  }
}

// 在页面初始化时预加载
useEffect(() => {
  preloadBySwr(fetchUser, { id: 1 }, { metadata: { levelType: 'user' } });
}, []);
```

## usePreloadBySwrCallback

获取预加载回调，会自动检查缓存：

```tsx
import { usePreloadBySwrCallback } from '@prefetch-sdk/swr';

function App() {
  const preload = usePreloadBySwrCallback();

  const handleMouseEnter = async () => {
    // 鼠标悬停时预加载，如果已有缓存则直接返回
    await preload(fetchUser, { id: 1 }, { metadata: { levelType: 'user' } });
  };

  return (
    <button onMouseEnter={handleMouseEnter}>
      查看用户
    </button>
  );
}
```

## 批量预加载

使用 `executePreloadPool` 批量预加载多个请求：

```tsx
import { executePreloadPool, createPreloadConfig } from '@prefetch-sdk/swr';

const preloadList = [
  createPreloadConfig(fetchUser, { id: 1 }, { levelType: 'user' }),
  createPreloadConfig(fetchTodos, { limit: 10 }, { levelType: 'todos' }),
];

// 并行执行
await executePreloadPool(preloadList, [], { parallel: true });

// 串行执行
await executePreloadPool(preloadList, [], { parallel: false });
```

## 日志类型

```tsx
enum LogType {
  createCache = 'createCache',        // 创建缓存
  hitCache = 'hitCache',              // 命中缓存
  hitPreloadCache = 'hitPreloadCache',// 命中预加载缓存
  resourceFinished = 'resourceFinished', // 请求完成
  createPreloadCache = 'createPreloadCache', // 创建预加载缓存
}
```

## 配合 SWRConfig 使用

```tsx
import { SWRConfig } from 'swr';

function App() {
  return (
    <SWRConfig value={{
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }}>
      <UserProfile />
    </SWRConfig>
  );
}
```

## 最佳实践

1. **使用 metadata 区分请求类型**：便于调试和监控
2. **合理使用预加载时机**：路由切换、鼠标悬停等
3. **配合 SWRConfig 调整策略**：根据业务需求调整重验证策略
