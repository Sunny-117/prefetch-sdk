/**
 * @prefetch-sdk/core
 * Core types and interfaces for prefetch SDK
 */

/**
 * Fetcher function type
 */
export type Fetcher<TData = unknown, TParams = unknown> = (
  params: TParams
) => Promise<TData> | TData;

/**
 * Prefetch request configuration
 */
export interface PrefetchConfig<TData = unknown, TParams = unknown> {
  /** Unique identifier for this prefetch request */
  name: string;
  /** Request fetcher function */
  fetcher: Fetcher<TData, TParams>;
  /** Request parameters */
  params?: TParams;
  /** Dependencies - names of other prefetch configs that must complete first */
  dependencies?: string[];
  /** Condition function - return false to skip this prefetch */
  condition?: (dependencyResults: unknown[]) => boolean;
  /** Middleware functions to transform params */
  middlewares?: Array<(result: unknown, ctx: MiddlewareContext) => unknown>;
  /** Custom options passed to fetcher */
  options?: Record<string, unknown>;
}

/**
 * Context passed to middleware functions
 */
export interface MiddlewareContext {
  name: string;
  params?: unknown;
  dependencyResults?: unknown[];
}

/**
 * Prefetch pool entry - stores promise and metadata
 */
export interface PrefetchEntry<TData = unknown> {
  /** The prefetch promise */
  promise: Promise<TData>;
  /** Original config */
  config: PrefetchConfig<TData>;
  /** Timestamp when prefetch was initiated */
  timestamp: number;
  /** Status of the prefetch */
  status: 'pending' | 'fulfilled' | 'rejected';
  /** Resolved data (if fulfilled) */
  data?: TData;
  /** Error (if rejected) */
  error?: Error;
  /** Clear this entry from pool */
  clear: () => void;
}

/**
 * Prefetch pool configuration
 */
export interface PrefetchPoolConfig {
  /** Global namespace for window storage */
  namespace?: string;
  /** Maximum concurrent requests */
  maxConcurrent?: number;
  /** Default timeout for requests (ms) */
  timeout?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Custom logger */
  logger?: Logger;
}

/**
 * Logger interface
 */
export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/**
 * Prefetch scheduler options
 */
export interface SchedulerOptions {
  /** Run prefetches in parallel (default: true) */
  parallel?: boolean;
  /** Priority order (higher = executed first) */
  priority?: number;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Cache strategy interface
 */
export interface CacheStrategy<TData = unknown> {
  /** Get cache key for this request */
  getKey: (...args: unknown[]) => string;
  /** Check if cached data is valid */
  isValid?: (cached: CachedData<TData>) => boolean;
  /** Optional cleanup function */
  cleanup?: () => void;
}

/**
 * Cached data wrapper
 */
export interface CachedData<TData = unknown> {
  data: TData;
  timestamp: number;
  key: string;
}

/**
 * Prefetch result with metadata
 */
export interface PrefetchResult<TData = unknown> {
  data: TData;
  fromCache: boolean;
  cacheKey?: string;
  duration: number;
}

/**
 * Batch prefetch configuration
 */
export interface BatchConfig {
  /** Array of prefetch configs */
  configs: Array<PrefetchConfig | (() => Promise<PrefetchConfig>)>;
  /** Dependency data for dynamic configs */
  dependencies?: unknown[] | (() => Promise<unknown[]>);
}

/**
 * Pool events
 */
export type PrefetchPoolEvent =
  | 'prefetch:start'
  | 'prefetch:success'
  | 'prefetch:error'
  | 'prefetch:hit'
  | 'pool:clear';

/**
 * Event handler type
 */
export type PrefetchEventHandler = (event: {
  type: PrefetchPoolEvent;
  name?: string;
  data?: unknown;
  error?: Error;
  duration?: number;
}) => void;
