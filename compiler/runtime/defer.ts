/**
 * Ljos Runtime - Defer implementation
 * Provides Go-style defer functionality
 */

/**
 * Creates a defer context for a function
 * Usage:
 * ```
 * const { defer, runDeferred } = createDeferContext();
 * defer(() => cleanup());
 * try {
 *   // ... function body
 * } finally {
 *   runDeferred();
 * }
 * ```
 */
export function createDeferContext() {
  const deferred: (() => void | Promise<void>)[] = [];

  return {
    defer(fn: () => void | Promise<void>) {
      deferred.push(fn);
    },
    
    async runDeferred() {
      // Run in reverse order (LIFO)
      while (deferred.length > 0) {
        const fn = deferred.pop()!;
        try {
          await fn();
        } catch (error) {
          console.error('Error in deferred function:', error);
        }
      }
    },
    
    runDeferredSync() {
      // Run in reverse order (LIFO) - synchronous version
      while (deferred.length > 0) {
        const fn = deferred.pop()!;
        try {
          fn();
        } catch (error) {
          console.error('Error in deferred function:', error);
        }
      }
    }
  };
}

/**
 * Decorator for functions that use defer
 * Automatically runs deferred functions on exit
 */
export function withDefer<T extends (...args: any[]) => any>(
  fn: (defer: (fn: () => void) => void, ...args: Parameters<T>) => ReturnType<T>
): T {
  return ((...args: Parameters<T>) => {
    const { defer, runDeferredSync } = createDeferContext();
    try {
      return fn(defer, ...args);
    } finally {
      runDeferredSync();
    }
  }) as T;
}

/**
 * Async version of withDefer
 */
export function withDeferAsync<T extends (...args: any[]) => Promise<any>>(
  fn: (defer: (fn: () => void | Promise<void>) => void, ...args: Parameters<T>) => ReturnType<T>
): T {
  return (async (...args: Parameters<T>) => {
    const { defer, runDeferred } = createDeferContext();
    try {
      return await fn(defer, ...args);
    } finally {
      await runDeferred();
    }
  }) as T;
}

export default createDeferContext;
