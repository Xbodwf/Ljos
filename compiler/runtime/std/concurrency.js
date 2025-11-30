/**
 * Ljos Standard Library - Concurrency Module (JS Runtime)
 * 并发编程支持的 JavaScript 实现
 */

// ============ Channel - 通道 ============

export class Channel {
  constructor(capacity = 0) {
    this._buffer = [];
    this._capacity = capacity;
    this._closed = false;
    this._receivers = [];
    this._senders = [];
  }
  
  async send(value) {
    if (this._closed) {
      return false;
    }
    
    // If there's a waiting receiver, deliver directly
    if (this._receivers.length > 0) {
      const receiver = this._receivers.shift();
      receiver(value);
      return true;
    }
    
    // If buffer has space, add to buffer
    if (this._capacity === 0 || this._buffer.length < this._capacity) {
      this._buffer.push(value);
      return true;
    }
    
    // Wait for space
    return new Promise((resolve) => {
      this._senders.push(() => {
        this._buffer.push(value);
        resolve(true);
      });
    });
  }
  
  async receive() {
    // If buffer has items, return from buffer
    if (this._buffer.length > 0) {
      const value = this._buffer.shift();
      
      // Wake up a waiting sender if any
      if (this._senders.length > 0) {
        const sender = this._senders.shift();
        sender();
      }
      
      return value;
    }
    
    // If closed and empty, return null
    if (this._closed) {
      return null;
    }
    
    // Wait for a value
    return new Promise((resolve) => {
      this._receivers.push(resolve);
    });
  }
  
  close() {
    this._closed = true;
    // Wake up all waiting receivers with null
    for (const receiver of this._receivers) {
      receiver(null);
    }
    this._receivers = [];
  }
  
  isClosed() {
    return this._closed;
  }
  
  len() {
    return this._buffer.length;
  }
  
  isEmpty() {
    return this._buffer.length === 0;
  }
}

// ============ WaitGroup - 等待组 ============

export class WaitGroup {
  constructor() {
    this._count = 0;
    this._resolvers = [];
  }
  
  add(delta = 1) {
    this._count += delta;
    if (this._count < 0) {
      throw new Error("WaitGroup counter is negative");
    }
    if (this._count === 0) {
      for (const resolve of this._resolvers) {
        resolve();
      }
      this._resolvers = [];
    }
  }
  
  done() {
    this.add(-1);
  }
  
  async wait() {
    if (this._count === 0) {
      return;
    }
    return new Promise((resolve) => {
      this._resolvers.push(resolve);
    });
  }
}

// ============ Mutex - 互斥锁 ============

export class Mutex {
  constructor() {
    this._locked = false;
    this._waiters = [];
  }
  
  async lock() {
    if (!this._locked) {
      this._locked = true;
      return;
    }
    return new Promise((resolve) => {
      this._waiters.push(resolve);
    });
  }
  
  unlock() {
    if (this._waiters.length > 0) {
      const next = this._waiters.shift();
      next();
    } else {
      this._locked = false;
    }
  }
  
  tryLock() {
    if (this._locked) {
      return false;
    }
    this._locked = true;
    return true;
  }
  
  async withLock(fn) {
    await this.lock();
    try {
      return await fn();
    } finally {
      this.unlock();
    }
  }
}

// ============ RWMutex - 读写锁 ============

export class RWMutex {
  constructor() {
    this._readers = 0;
    this._writer = false;
    this._readWaiters = [];
    this._writeWaiters = [];
  }
  
  async rLock() {
    if (!this._writer && this._writeWaiters.length === 0) {
      this._readers++;
      return;
    }
    return new Promise((resolve) => {
      this._readWaiters.push(resolve);
    });
  }
  
  rUnlock() {
    this._readers--;
    if (this._readers === 0 && this._writeWaiters.length > 0) {
      this._writer = true;
      const next = this._writeWaiters.shift();
      next();
    }
  }
  
  async lock() {
    if (!this._writer && this._readers === 0) {
      this._writer = true;
      return;
    }
    return new Promise((resolve) => {
      this._writeWaiters.push(resolve);
    });
  }
  
  unlock() {
    this._writer = false;
    
    // Prefer readers
    while (this._readWaiters.length > 0 && this._writeWaiters.length === 0) {
      this._readers++;
      const next = this._readWaiters.shift();
      next();
    }
    
    // Or wake a writer
    if (this._readers === 0 && this._writeWaiters.length > 0) {
      this._writer = true;
      const next = this._writeWaiters.shift();
      next();
    }
  }
}

// ============ Once - 单次执行 ============

export class Once {
  constructor() {
    this._done = false;
  }
  
  do(fn) {
    if (!this._done) {
      this._done = true;
      fn();
    }
  }
}

// ============ Atomic - 原子操作 ============

export class Atomic {
  constructor(value) {
    this._value = value;
    this._mutex = new Mutex();
  }
  
  load() {
    return this._value;
  }
  
  async store(value) {
    await this._mutex.lock();
    this._value = value;
    this._mutex.unlock();
  }
  
  async swap(value) {
    await this._mutex.lock();
    const old = this._value;
    this._value = value;
    this._mutex.unlock();
    return old;
  }
  
  async compareAndSwap(expected, desired) {
    await this._mutex.lock();
    if (this._value === expected) {
      this._value = desired;
      this._mutex.unlock();
      return true;
    }
    this._mutex.unlock();
    return false;
  }
}

// ============ 辅助函数 ============

export function spawn(fn) {
  setTimeout(fn, 0);
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function yield_() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// Export with Ljos name
export { yield_ as yield };
