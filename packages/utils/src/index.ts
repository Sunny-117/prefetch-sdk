/**
 * @prefetch-sdk/utils
 * Utility functions for prefetch SDK
 */

/**
 * Generate a UUID v4
 */
export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate a short random ID
 */
export function shortId(length = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Parse cookies from document.cookie string
 */
export function parseCookies(cookieString?: string): Record<string, string> {
  const str = cookieString ?? (typeof document !== 'undefined' ? document.cookie : '');
  const cookies: Record<string, string> = {};

  str.split(/;\s*/).forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx >= 0) {
      const key = pair.substring(0, idx).trim();
      let val = pair.substring(idx + 1).trim();
      if (val.startsWith('"')) val = val.slice(1, -1);
      try {
        cookies[key] = decodeURIComponent(val);
      } catch {
        cookies[key] = val;
      }
    }
  });

  return cookies;
}

/**
 * Get a specific cookie value
 */
export function getCookie(key: string, cookieString?: string): string | undefined {
  return parseCookies(cookieString)[key];
}

/**
 * URL encode object to query string
 */
export function encodeParams(params: Record<string, unknown>): string {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
}

/**
 * Parse query string to object
 */
export function parseQueryString(queryString: string): Record<string, string> {
  const params: Record<string, string> = {};
  const searchParams = new URLSearchParams(queryString);
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

/**
 * Get query parameter from URL
 */
export function getQueryParam(name: string, url?: string): string | null {
  const searchString = url ?? (typeof window !== 'undefined' ? window.location.search : '');
  const params = new URLSearchParams(searchString);
  return params.get(name);
}

/**
 * Deep clone an object using JSON serialization
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Deep equal comparison
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object') return false;

  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
      return false;
    }
  }

  return true;
}

/**
 * Stable JSON stringify (sorted keys)
 */
export function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map(stableStringify).join(',') + ']';
  }

  const keys = Object.keys(obj).sort();
  const pairs = keys.map(
    (key) => `${JSON.stringify(key)}:${stableStringify((obj as Record<string, unknown>)[key])}`
  );
  return '{' + pairs.join(',') + '}';
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, wait);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Create a deferred promise
 */
export function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    factor?: number;
  } = {}
): Promise<T> {
  const { maxRetries = 3, initialDelay = 1000, maxDelay = 30000, factor = 2 } = options;

  let lastError: unknown;
  let delay = initialDelay;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(delay * factor, maxDelay);
      }
    }
  }

  throw lastError;
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Subtract days from a date
 */
export function subDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Check if code is running in browser
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Check if requestIdleCallback is available
 */
export function hasIdleCallback(): boolean {
  return typeof requestIdleCallback !== 'undefined';
}

/**
 * Run callback when idle (with fallback to setTimeout)
 */
export function runWhenIdle(
  callback: () => void,
  options: { timeout?: number } = {}
): () => void {
  const { timeout = 2000 } = options;

  if (hasIdleCallback()) {
    const id = requestIdleCallback(
      (idle) => {
        if (idle.timeRemaining() > 0) {
          callback();
        }
      },
      { timeout }
    );
    return () => cancelIdleCallback(id);
  }

  const id = setTimeout(callback, 0);
  return () => clearTimeout(id);
}
