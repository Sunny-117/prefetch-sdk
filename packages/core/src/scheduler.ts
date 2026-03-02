/**
 * Scheduler - orchestrates prefetch execution
 */

import type { PrefetchConfig, SchedulerOptions, BatchConfig } from './types';
import { PrefetchPool, getGlobalPool } from './pool';

/**
 * Prefetch scheduler for managing complex prefetch flows
 */
export class PrefetchScheduler {
  private pool: PrefetchPool;
  private abortController: AbortController | null = null;

  constructor(pool?: PrefetchPool) {
    this.pool = pool ?? getGlobalPool();
  }

  /**
   * Schedule a single prefetch
   */
  async schedule<TData = unknown, TParams = unknown>(
    config: PrefetchConfig<TData, TParams>,
    options: SchedulerOptions = {}
  ): Promise<TData> {
    if (options.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    return this.pool.execute(config);
  }

  /**
   * Schedule multiple prefetches
   */
  async scheduleAll<TData = unknown>(
    configs: Array<PrefetchConfig<TData>>,
    options: SchedulerOptions = {}
  ): Promise<TData[]> {
    const { parallel = true, signal } = options;

    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    return this.pool.executeAll(configs, { parallel });
  }

  /**
   * Schedule a batch of prefetches with dependencies
   */
  async scheduleBatch<TData = unknown>(
    batch: BatchConfig,
    options: SchedulerOptions = {}
  ): Promise<TData[]> {
    const { parallel = true, signal } = options;

    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    // Resolve dependencies first
    let dependencyData: unknown[] = [];
    if (batch.dependencies) {
      if (typeof batch.dependencies === 'function') {
        dependencyData = await batch.dependencies();
      } else {
        dependencyData = batch.dependencies;
      }
    }

    // Resolve configs
    const resolvedConfigs: Array<PrefetchConfig<TData>> = [];
    for (let i = 0; i < batch.configs.length; i++) {
      const config = batch.configs[i];
      if (typeof config === 'function') {
        const resolved = await config();
        resolvedConfigs.push(resolved as PrefetchConfig<TData>);
      } else {
        resolvedConfigs.push(config as PrefetchConfig<TData>);
      }
    }

    // Use dependency data if needed (for future expansion)
    void dependencyData;

    return this.pool.executeAll(resolvedConfigs, { parallel });
  }

  /**
   * Create an abortable prefetch flow
   */
  createAbortableFlow(): {
    schedule: <TData = unknown, TParams = unknown>(
      config: PrefetchConfig<TData, TParams>,
      options?: SchedulerOptions
    ) => Promise<TData>;
    scheduleAll: <TData = unknown>(
      configs: Array<PrefetchConfig<TData>>,
      options?: SchedulerOptions
    ) => Promise<TData[]>;
    abort: () => void;
    signal: AbortSignal;
  } {
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    return {
      schedule: <TData = unknown, TParams = unknown>(
        config: PrefetchConfig<TData, TParams>,
        options: SchedulerOptions = {}
      ) => this.schedule(config, { ...options, signal }),
      scheduleAll: <TData = unknown>(
        configs: Array<PrefetchConfig<TData>>,
        options: SchedulerOptions = {}
      ) => this.scheduleAll(configs, { ...options, signal }),
      abort: () => this.abortController?.abort(),
      signal,
    };
  }

  /**
   * Abort current flow
   */
  abort(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  /**
   * Get the underlying pool
   */
  getPool(): PrefetchPool {
    return this.pool;
  }
}

/**
 * Create a new scheduler
 */
export function createScheduler(pool?: PrefetchPool): PrefetchScheduler {
  return new PrefetchScheduler(pool);
}

/**
 * Convenient prefetch function
 */
export async function prefetch<TData = unknown, TParams = unknown>(
  config: PrefetchConfig<TData, TParams>,
  options: SchedulerOptions & { pool?: PrefetchPool } = {}
): Promise<TData> {
  const { pool, ...schedulerOptions } = options;
  const scheduler = new PrefetchScheduler(pool);
  return scheduler.schedule(config, schedulerOptions);
}

/**
 * Convenient batch prefetch function with abort support
 */
export function createPrefetchController<TData = unknown>(
  configs: Array<PrefetchConfig<TData>>,
  options: SchedulerOptions & { pool?: PrefetchPool } = {}
): Promise<TData[]> & { abort: () => void } {
  const { pool, ...schedulerOptions } = options;
  const scheduler = new PrefetchScheduler(pool);
  const flow = scheduler.createAbortableFlow();

  const promise = flow.scheduleAll(configs, schedulerOptions) as Promise<TData[]> & {
    abort: () => void;
  };
  promise.abort = flow.abort;

  return promise;
}
