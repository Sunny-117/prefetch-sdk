/// <reference types="vite/client" />

interface Window {
  __PREFETCH_SDK__?: {
    [key: string]: Promise<unknown> & { clear?: () => void };
    $source: Record<string, { $path: string; $params: unknown }>;
    $data?: Record<string, unknown>;
  };
  __DEMO_POOL__?: unknown;
}
