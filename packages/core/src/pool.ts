/**
 * Prefetch Pool - Core storage and management
 */

import type {
  PrefetchConfig,
  PrefetchEntry,
  PrefetchPoolConfig,
  PrefetchPoolEvent,
  PrefetchEventHandler,
  Logger,
  MiddlewareContext,
} from './types';

const DEFAULT_NAMESPACE = '__PREFETCH_SDK__';

/**
 * Default console logger
 */
const defaultLogger: Logger = {
  debug: (...args) => console.debug('[prefetch-sdk]', ...args),
  info: (...args) => console.info('[prefetch-sdk]', ...args),
  warn: (...args) => console.warn('[prefetch-sdk]', ...args),
  error: (...args) => console.error('[prefetch-sdk]', ...args),
};

/**
 * No-op logger for production
 */
const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

/**
 * Compose middleware functions
 */
function composeMiddlewares(
  middlewares: Array<(result: unknown, ctx: MiddlewareContext) => unknown> = []
): (initial: unknown, ctx: MiddlewareContext) => unknown {
  return (initial, ctx) => {
    let result = initial;
    for (const middleware of middlewares) {
      result = middleware(result, ctx);
    }
    return result;
  };
}

/**
 * PrefetchPool - manages prefetch requests and their lifecycle
 */
export class PrefetchPool {
  private entries: Map<string, PrefetchEntry> = new Map();
  private source: Map<string, { config: PrefetchConfig; params: unknown }> = new Map();
  private eventHandlers: Set<PrefetchEventHandler> = new Set();
  private config: Required<PrefetchPoolConfig>;
  private logger: Logger;

  constructor(config: PrefetchPoolConfig = {}) {
    this.config = {
      namespace: config.namespace ?? DEFAULT_NAMESPACE,
      maxConcurrent: config.maxConcurrent ?? 6,
      timeout: config.timeout ?? 30000,
      debug: config.debug ?? false,
      logger: config.logger ?? (config.debug ? defaultLogger : noopLogger),
    };
    this.logger = this.config.logger;
  }

  /**
   * Get the global namespace key
   */
  get namespace(): string {
    return this.config.namespace;
  }

  /**
   * Check if a prefetch exists
   */
  has(name: string): boolean {
    return this.entries.has(name);
  }

  /**
   * Get a prefetch entry
   */
  get<TData = unknown>(name: string): PrefetchEntry<TData> | undefined {
    return this.entries.get(name) as PrefetchEntry<TData> | undefined;
  }

  /**
   * Get source config for a name
   */
  getSource(name: string): { config: PrefetchConfig; params: unknown } | undefined {
    return this.source.get(name);
  }

  /**
   * Execute a prefetch configuration
   */
  async execute<TData = unknown, TParams = unknown>(
    config: PrefetchConfig<TData, TParams>
  ): Promise<TData> {
    const { name, fetcher, params, dependencies, condition, middlewares } = config;

    // Check if already exists
    const existing = this.entries.get(name);
    if (existing && existing.status === 'pending') {
      this.logger.debug(`Prefetch "${name}" already pending, returning existing promise`);
      this.emit('prefetch:hit', { name });
      return existing.promise as Promise<TData>;
    }

    // Wait for dependencies
    let dependencyResults: unknown[] = [];
    if (dependencies && dependencies.length > 0) {
      this.logger.debug(`Prefetch "${name}" waiting for dependencies:`, dependencies);
      dependencyResults = await Promise.all(
        dependencies.map(dep => {
          const entry = this.entries.get(dep);
          if (!entry) {
            this.logger.warn(`Dependency "${dep}" not found for "${name}"`);
            return undefined;
          }
          return entry.promise;
        })
      );
    }

    // Check condition
    if (condition && !condition(dependencyResults)) {
      this.logger.debug(`Prefetch "${name}" skipped due to condition`);
      return Promise.resolve(undefined as unknown as TData);
    }

    // Apply middlewares to params
    const ctx: MiddlewareContext = { name, params, dependencyResults };
    const composedMiddleware = composeMiddlewares(middlewares);
    const transformedParams = middlewares
      ? composedMiddleware(dependencyResults, ctx)
      : params;
    const finalParams = { ...params, ...(transformedParams as object) } as TParams;

    // Store source config
    this.source.set(name, { config: config as PrefetchConfig, params: finalParams });

    // Create the promise
    const startTime = Date.now();
    this.emit('prefetch:start', { name });

    const promise = Promise.resolve()
      .then(() => fetcher(finalParams))
      .then(data => {
        const entry = this.entries.get(name);
        if (entry) {
          entry.status = 'fulfilled';
          entry.data = data;
        }
        const duration = Date.now() - startTime;
        this.logger.debug(`Prefetch "${name}" completed in ${duration}ms`);
        this.emit('prefetch:success', { name, data, duration });
        return data;
      })
      .catch(error => {
        const entry = this.entries.get(name);
        if (entry) {
          entry.status = 'rejected';
          entry.error = error;
        }
        this.logger.error(`Prefetch "${name}" failed:`, error);
        this.emit('prefetch:error', { name, error });
        throw error;
      });

    // Store entry
    const entry: PrefetchEntry<TData> = {
      promise,
      config: config as PrefetchConfig<TData>,
      timestamp: startTime,
      status: 'pending',
      clear: () => this.delete(name),
    };
    this.entries.set(name, entry as PrefetchEntry);

    return promise;
  }

  /**
   * Execute multiple prefetch configs
   */
  async executeAll<TData = unknown>(
    configs: Array<PrefetchConfig<TData>>,
    options: { parallel?: boolean } = {}
  ): Promise<TData[]> {
    const { parallel = true } = options;

    if (parallel) {
      return Promise.all(configs.map(config => this.execute(config)));
    }

    // Sequential execution
    const results: TData[] = [];
    for (const config of configs) {
      results.push(await this.execute(config));
    }
    return results;
  }

  /**
   * Consume a prefetch - get data and optionally clear
   */
  async consume<TData = unknown>(
    name: string,
    options: { clear?: boolean } = {}
  ): Promise<TData | undefined> {
    const { clear = true } = options;
    const entry = this.entries.get(name);

    if (!entry) {
      this.logger.debug(`Prefetch "${name}" not found for consumption`);
      return undefined;
    }

    try {
      const data = await entry.promise;
      this.emit('prefetch:hit', { name, data });
      return data as TData;
    } catch (error) {
      this.logger.warn(`Prefetch "${name}" consumption failed:`, error);
      return undefined;
    } finally {
      if (clear) {
        this.delete(name);
      }
    }
  }

  /**
   * Delete a prefetch entry
   */
  delete(name: string): boolean {
    const deleted = this.entries.delete(name);
    if (deleted) {
      this.logger.debug(`Prefetch "${name}" deleted`);
    }
    return deleted;
  }

  /**
   * Clear all prefetch entries
   */
  clear(): void {
    this.entries.clear();
    this.source.clear();
    this.logger.debug('Prefetch pool cleared');
    this.emit('pool:clear', {});
  }

  /**
   * Get all entry names
   */
  keys(): string[] {
    return Array.from(this.entries.keys());
  }

  /**
   * Get pool size
   */
  get size(): number {
    return this.entries.size;
  }

  /**
   * Add event listener
   */
  on(handler: PrefetchEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * Remove event listener
   */
  off(handler: PrefetchEventHandler): void {
    this.eventHandlers.delete(handler);
  }

  /**
   * Emit event
   */
  private emit(type: PrefetchPoolEvent, data: Omit<Parameters<PrefetchEventHandler>[0], 'type'>): void {
    const event = { type, ...data };
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        this.logger.error('Event handler error:', error);
      }
    }
  }

  /**
   * Mount pool to window for global access
   */
  mountToWindow(): void {
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>)[this.namespace] = {
        pool: this,
        entries: this.entries,
        source: Object.fromEntries(this.source),
      };
      this.logger.debug(`Pool mounted to window.${this.namespace}`);
    }
  }

  /**
   * Create a prefetch pool from window (if exists)
   */
  static fromWindow(namespace: string = DEFAULT_NAMESPACE): PrefetchPool | undefined {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const stored = (window as unknown as Record<string, unknown>)[namespace] as { pool?: PrefetchPool } | undefined;
    return stored?.pool;
  }
}

/**
 * Create a new prefetch pool
 */
export function createPrefetchPool(config?: PrefetchPoolConfig): PrefetchPool {
  return new PrefetchPool(config);
}

/**
 * Default global pool instance
 */
let globalPool: PrefetchPool | undefined;

/**
 * Get or create the global prefetch pool
 */
export function getGlobalPool(config?: PrefetchPoolConfig): PrefetchPool {
  if (!globalPool) {
    globalPool = createPrefetchPool(config);
  }
  return globalPool;
}

/**
 * Set the global prefetch pool
 */
export function setGlobalPool(pool: PrefetchPool): void {
  globalPool = pool;
}
