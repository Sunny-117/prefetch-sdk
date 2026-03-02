# Prefetch SDK

A comprehensive prefetch solution for modern web applications. Optimize your app's performance by starting data fetching before JavaScript loads.

## Features

- **HTML Prefetch**: Start fetching in `<head>` before JS bundle loads
- **React Integration**: Hooks and components for easy React integration
- **SWR Support**: Seamless integration with SWR for data fetching
- **Cache Strategies**: Flexible caching (localStorage, sessionStorage, memory)
- **Dependency Support**: Prefetch requests that depend on other requests
- **Idle Prefetch**: Prefetch data when browser is idle

## Packages

| Package | Description |
|---------|-------------|
| `@prefetch-sdk/core` | Core prefetch pool and scheduler |
| `@prefetch-sdk/cache` | Cache strategies and storage adapters |
| `@prefetch-sdk/html-script` | HTML inline script generation |
| `@prefetch-sdk/react` | React hooks and components |
| `@prefetch-sdk/utils` | Utility functions |

## Installation

```bash
# Using pnpm
pnpm add @prefetch-sdk/core @prefetch-sdk/react

# Using npm
npm install @prefetch-sdk/core @prefetch-sdk/react

# Using yarn
yarn add @prefetch-sdk/core @prefetch-sdk/react
```

## Quick Start

### 1. HTML Prefetch (Inline Script)

Add a script to your HTML `<head>` to start prefetching before React loads:

```html
<!DOCTYPE html>
<html>
<head>
  <script>
    (function() {
      if (!window.fetch) return;

      window.__PREFETCH_SDK__ = { $source: {} };

      var promise = fetch('/api/user')
        .then(function(res) { return res.json(); });
      promise.clear = function() { delete window.__PREFETCH_SDK__['user']; };

      window.__PREFETCH_SDK__['user'] = promise;
      window.__PREFETCH_SDK__.$source['user'] = {
        $path: '/api/user',
        $params: {}
      };
    })();
  </script>
</head>
<body>
  <div id="root"></div>
</body>
</html>
```

### 2. Consume in React

```tsx
import { useConsumePrefetch } from '@prefetch-sdk/react';

function UserProfile() {
  const { data, isLoading } = useConsumePrefetch<User>('user');

  if (isLoading) return <Loading />;
  return <div>{data?.name}</div>;
}
```

### 3. React Prefetch

```tsx
import { usePrefetch, PrefetchProvider } from '@prefetch-sdk/react';

function App() {
  return (
    <PrefetchProvider>
      <UserList />
    </PrefetchProvider>
  );
}

function UserList() {
  const { prefetch, data } = usePrefetch({
    name: 'users',
    fetcher: async () => {
      const res = await fetch('/api/users');
      return res.json();
    },
  });

  useEffect(() => {
    prefetch();
  }, []);

  return <div>{JSON.stringify(data)}</div>;
}
```

### 4. SWR Integration

```tsx
import { useRequestBySwr, preloadBySwr } from '@prefetch-sdk/react/swr';

// Preload data
await preloadBySwr(
  fetchUsers,
  { page: 1 },
  { metadata: { levelType: 'userList' } }
);

// Use in component
function UserList() {
  const { data, refresh, pending } = useRequestBySwr(
    fetchUsers,
    { page: 1 },
    { metadata: { levelType: 'userList' } }
  );

  return (
    <div>
      {pending ? 'Loading...' : JSON.stringify(data)}
      <button onClick={refresh}>Refresh</button>
    </div>
  );
}
```

### 5. Cache Strategies

```tsx
import { withCache, todayCacheStrategy, ttlCacheStrategy } from '@prefetch-sdk/cache';

// Cache for today
const cachedFetcher = withCache(
  fetchData,
  todayCacheStrategy((params) => `data:${params.id}`)
);

// Cache for 5 minutes
const ttlCachedFetcher = withCache(
  fetchData,
  ttlCacheStrategy((params) => `data:${params.id}`, 5 * 60 * 1000)
);
```

## Advanced Usage

### Dependency Chain

```tsx
import { createPrefetchPool } from '@prefetch-sdk/core';

const pool = createPrefetchPool({ debug: true });

// First prefetch
await pool.execute({
  name: 'auth',
  fetcher: fetchAuth,
});

// Depends on auth
await pool.execute({
  name: 'userData',
  fetcher: fetchUserData,
  dependencies: ['auth'],
  condition: (results) => results[0]?.isAuthenticated,
});
```

### Idle Prefetch

```tsx
import { usePrefetchOnIdle } from '@prefetch-sdk/react';

function App() {
  const { prefetch, cancel } = usePrefetchOnIdle(
    { name: 'background-data', fetcher: fetchBackgroundData },
    { timeout: 2000, delay: 1000 }
  );

  useEffect(() => {
    prefetch();
    return cancel;
  }, []);
}
```

### Generate HTML Script

```tsx
import { generateScriptTag } from '@prefetch-sdk/html-script';

const script = generateScriptTag([
  {
    name: 'user',
    path: '/api/user',
    params: { id: 1 },
  },
  {
    name: 'posts',
    path: '/api/posts',
    dependencies: ['user'],
    condition: (results) => !!results[0],
  },
]);

// Use in your HTML template
```

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run playground
pnpm playground

# Run tests
pnpm test
```

## Architecture

```
prefetch-sdk/
├── packages/
│   ├── core/           # Core pool and scheduler
│   ├── cache/          # Cache strategies
│   ├── html-script/    # HTML script generation
│   ├── react/          # React hooks and components
│   └── utils/          # Utility functions
├── apps/
│   ├── playground/     # Demo application
│   └── docs/           # Documentation (VitePress)
└── turbo.json          # Turbo configuration
```

## License

MIT
