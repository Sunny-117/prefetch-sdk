# 请求池

`PrefetchPool` 用于统一管理多个预请求，支持依赖关系和条件执行。

## 创建请求池

```tsx
import { createPrefetchPool } from '@prefetch-sdk/core';

const pool = createPrefetchPool({
  namespace: '__MY_POOL__', // 可选，挂载到 window 的命名空间
  debug: true,              // 可选，开启调试日志
});
```

## 执行预请求

### 单个请求

```tsx
await pool.execute({
  name: 'userData',         // 唯一标识
  fetcher: fetchUser,       // 请求函数
  params: { id: 1 },        // 请求参数
});
```

### 带依赖的请求

```tsx
// 先执行用户信息请求
await pool.execute({
  name: 'user',
  fetcher: fetchUser,
  params: { id: 1 },
});

// 依赖用户信息的请求
await pool.execute({
  name: 'userTodos',
  fetcher: fetchTodos,
  params: {},
  dependencies: ['user'],  // 等待 user 请求完成
  condition: (results) => results[0]?.isActive, // 条件执行
});
```

### 批量执行

```tsx
// 并行执行（默认）
const results = await pool.executeAll([
  { name: 'user', fetcher: fetchUser, params: { id: 1 } },
  { name: 'config', fetcher: fetchConfig, params: {} },
]);

// 串行执行
const results = await pool.executeAll(configs, { parallel: false });
```

## 消费预请求

```tsx
// 消费并清除
const data = await pool.consume('userData');

// 消费但保留
const data = await pool.consume('userData', false);
```

## 管理请求池

```tsx
// 检查是否存在
pool.has('userData');       // boolean

// 获取请求条目
pool.get('userData');       // PrefetchEntry | undefined

// 获取来源信息
pool.getSource('userData'); // { config, params } | undefined

// 获取所有 key
pool.keys();                // string[]

// 获取数量
pool.size;                  // number

// 删除单个
pool.delete('userData');    // boolean

// 清空所有
pool.clear();
```

## 挂载到 window

```tsx
pool.mountToWindow();
// 可通过 window.__MY_POOL__ 访问
```

## 请求条目结构

```tsx
interface PrefetchEntry<TData> {
  promise: Promise<TData>;           // 请求 Promise
  config: PrefetchConfig<TData>;     // 配置信息
  timestamp: number;                 // 开始时间
  status: 'pending' | 'fulfilled' | 'rejected'; // 状态
  data?: TData;                      // 成功后的数据
  error?: Error;                     // 失败后的错误
}
```

## 全局请求池

```tsx
import { getGlobalPool } from '@prefetch-sdk/core';

// 获取全局单例请求池
const pool = getGlobalPool();
```

## 使用示例

```tsx
import { createPrefetchPool, type PrefetchConfig } from '@prefetch-sdk/core';

const pool = createPrefetchPool({ debug: true });

// 页面初始化时预请求
async function initPrefetch() {
  // 并行预请求用户信息和配置
  await pool.executeAll([
    {
      name: 'user',
      fetcher: fetchUser,
      params: { id: getCurrentUserId() },
    },
    {
      name: 'config',
      fetcher: fetchConfig,
      params: {},
    },
  ]);

  // 根据用户信息决定是否预请求权限
  await pool.execute({
    name: 'permissions',
    fetcher: fetchPermissions,
    params: {},
    dependencies: ['user'],
    condition: ([user]) => user?.needPermissionCheck,
  });
}

// 组件中消费
function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    pool.consume('user').then(setUser);
  }, []);

  return <div>{user?.name}</div>;
}
```

## 最佳实践

1. **合理规划依赖关系**：避免循环依赖
2. **及时清理已消费的请求**：避免内存泄漏
3. **使用 debug 模式调试**：便于排查问题
4. **考虑使用全局请求池**：跨组件共享预请求
