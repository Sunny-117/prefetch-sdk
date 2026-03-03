# @prefetch-sdk/html-script

HTML 内联脚本，在 JS 加载前提前发起请求。

## 类型

### HtmlPrefetchConfig

```tsx
interface HtmlPrefetchConfig {
  name: string;
  path: string;
  params?: Record<string, unknown>;
  dependencies?: string[];
  condition?: (results: unknown[]) => boolean;
  middlewares?: Array<(results: unknown[]) => Record<string, unknown>>;
  cacheStrategy?: (path: string, params: string) => CacheInfo;
}
```

### CacheInfo

```tsx
interface CacheInfo {
  key: string;
  isValid?: (cached: { data: unknown; timestamp: number }) => boolean;
  remove?: () => void;
}
```

### PrefetchDatasource

```tsx
interface PrefetchDatasource {
  $source: Record<string, { $path: string; $params: unknown }>;
  $data?: Record<string, unknown>;
  [name: string]: unknown;
}
```

### GenerateScriptOptions

```tsx
interface GenerateScriptOptions {
  namespace?: string;
  minify?: boolean;
  apiPrefix?: string;
  authCode?: string;
}
```

## 常量

### NAMESPACE

默认命名空间。

```tsx
const NAMESPACE = '__PREFETCH_SDK__';
```

## 脚本生成

### generateInlineScript

生成内联脚本内容。

```tsx
function generateInlineScript(
  configs: HtmlPrefetchConfig[],
  options?: GenerateScriptOptions
): string;
```

**参数：**
- `configs` - 预请求配置数组
- `options.namespace` - 命名空间，默认 `__PREFETCH_SDK__`
- `options.minify` - 是否压缩，默认 `false`
- `options.apiPrefix` - API 前缀
- `options.authCode` - 认证代码片段

### generateScriptTag

生成带 `<script>` 标签的完整内容。

```tsx
function generateScriptTag(
  configs: HtmlPrefetchConfig[],
  options?: GenerateScriptOptions
): string;
```

## 消费函数

### consumePrefetch

消费预请求数据。

```tsx
async function consumePrefetch<TData = unknown>(
  name: string,
  options?: {
    namespace?: string;
    clear?: boolean;
    fallback?: () => Promise<TData>;
  }
): Promise<TData | undefined>;
```

**参数：**
- `name` - 预请求名称
- `options.namespace` - 命名空间，默认 `__PREFETCH_SDK__`
- `options.clear` - 消费后是否清除，默认 `true`
- `options.fallback` - 降级函数，预请求不存在时调用

### getPrefetchSource

获取预请求来源信息。

```tsx
function getPrefetchSource(
  name: string,
  options?: { namespace?: string }
): { path: string; params: unknown } | undefined;
```

### isPrefetchParamsMatch

检查预请求参数是否匹配。

```tsx
function isPrefetchParamsMatch(
  name: string,
  params: unknown,
  options?: {
    namespace?: string;
    comparator?: (a: unknown, b: unknown) => boolean;
  }
): boolean;
```

## 使用示例

```tsx
import {
  generateInlineScript,
  generateScriptTag,
  consumePrefetch,
  getPrefetchSource,
} from '@prefetch-sdk/html-script';

// 生成脚本
const script = generateInlineScript([
  { name: 'user', path: '/api/user', params: { id: 1 } },
  { name: 'config', path: '/api/config' },
], {
  apiPrefix: 'https://api.example.com',
  minify: true,
});

// 消费数据
const user = await consumePrefetch<User>('user', {
  fallback: () => fetch('/api/user?id=1').then(r => r.json()),
});

// 获取来源
const source = getPrefetchSource('user');
// { path: 'https://api.example.com/api/user', params: { id: 1 } }
```
