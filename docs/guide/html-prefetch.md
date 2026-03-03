# HTML 预请求

HTML 预请求是 Prefetch SDK 的核心功能，它允许在 JS bundle 加载完成前就开始请求数据。

## 原理

在 HTML 的 `<head>` 标签中插入内联脚本，这段脚本会：

1. 立即执行（不需要等待 JS bundle）
2. 发起 fetch 请求
3. 将 Promise 存储在 `window.__PREFETCH_SDK__` 上
4. React 应用加载后可以直接消费这个 Promise

## 生成内联脚本

使用 `generateInlineScript` 或 `generateScriptTag` 生成内联脚本：

```tsx
import { generateInlineScript, generateScriptTag } from '@prefetch-sdk/html-script';

const configs = [
  {
    name: 'user',
    path: '/api/user',
    params: { id: 1 },
  },
  {
    name: 'todos',
    path: '/api/todos',
    params: { limit: 10 },
    dependencies: ['user'], // 依赖 user 请求完成
    condition: (results) => results[0]?.isAdmin, // 条件执行
  },
];

// 生成纯脚本内容
const script = generateInlineScript(configs);

// 生成带 <script> 标签的完整内容
const scriptTag = generateScriptTag(configs);
```

## 配置选项

```tsx
interface HtmlPrefetchConfig {
  name: string;                    // 唯一标识
  path: string;                    // 请求路径
  params?: Record<string, unknown>;// 请求参数
  dependencies?: string[];         // 依赖的其他预请求
  condition?: (results: unknown[]) => boolean; // 条件函数
  middlewares?: Array<(results: unknown[]) => Record<string, unknown>>; // 中间件
  cacheStrategy?: (path: string, params: string) => CacheInfo; // 缓存策略
}
```

## 消费预请求数据

```tsx
import { consumePrefetch, getPrefetchSource, isPrefetchParamsMatch } from '@prefetch-sdk/html-script';

// 消费预请求数据
const data = await consumePrefetch<User>('user', {
  clear: true, // 消费后清除（默认 true）
  fallback: () => fetch('/api/user').then(r => r.json()), // 降级函数
});

// 获取预请求来源信息
const source = getPrefetchSource('user');
// { path: '/api/user', params: { id: 1 } }

// 检查参数是否匹配
const isMatch = isPrefetchParamsMatch('user', { id: 1 });
```

## 在构建工具中使用

### Vite

```ts
// vite.config.ts
import { generateScriptTag } from '@prefetch-sdk/html-script';

export default defineConfig({
  plugins: [
    {
      name: 'prefetch-inject',
      transformIndexHtml(html) {
        const scriptTag = generateScriptTag([
          { name: 'user', path: '/api/user' },
        ]);
        return html.replace('</head>', `${scriptTag}\n</head>`);
      },
    },
  ],
});
```

### EJS 模板

```ejs
<!DOCTYPE html>
<html>
<head>
  <%- prefetchScript %>
</head>
<body>
  <div id="root"></div>
</body>
</html>
```

## 最佳实践

1. **只预请求关键数据**：首屏必需的数据才需要预请求
2. **注意请求顺序**：使用 dependencies 管理依赖关系
3. **设置合理的条件**：避免不必要的请求
4. **处理降级情况**：总是提供 fallback 函数
