/**
 * Ljos Runtime Library
 * Provides runtime support for Ljos language features
 */

export { Channel, select } from './channel';
export { createDeferContext, withDefer, withDeferAsync } from './defer';

// Re-export common utilities
export const println = console.log;
export const print = (msg: string) => process.stdout.write(msg);

// Type checking utilities
export function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

export function isFloat(value: unknown): value is number {
  return typeof value === 'number';
}

export function isStr(value: unknown): value is string {
  return typeof value === 'string';
}

export function isBool(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isNul(value: unknown): value is null {
  return value === null;
}

// Safe type conversion
export function toInt(value: unknown): number | null {
  if (typeof value === 'number') {
    return Math.floor(value);
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

export function toFloat(value: unknown): number | null {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

export function toStr(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
}

// Range utility
export function range(start: number, end: number, inclusive = false): number[] {
  const length = end - start + (inclusive ? 1 : 0);
  return Array.from({ length }, (_, i) => start + i);
}

// WaitGroup implementation (like Go's sync.WaitGroup)
export class WaitGroup {
  private count = 0;
  private resolvers: (() => void)[] = [];

  add(delta = 1): void {
    this.count += delta;
    if (this.count < 0) {
      throw new Error('WaitGroup counter is negative');
    }
    if (this.count === 0) {
      for (const resolve of this.resolvers) {
        resolve();
      }
      this.resolvers = [];
    }
  }

  done(): void {
    this.add(-1);
  }

  async wait(): Promise<void> {
    if (this.count === 0) {
      return;
    }
    return new Promise(resolve => {
      this.resolvers.push(resolve);
    });
  }
}

// Mutex implementation
export class Mutex {
  private locked = false;
  private waiters: (() => void)[] = [];

  async lock(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }
    return new Promise(resolve => {
      this.waiters.push(resolve);
    });
  }

  unlock(): void {
    if (this.waiters.length > 0) {
      const next = this.waiters.shift()!;
      next();
    } else {
      this.locked = false;
    }
  }

  async withLock<T>(fn: () => T | Promise<T>): Promise<T> {
    await this.lock();
    try {
      return await fn();
    } finally {
      this.unlock();
    }
  }
}
