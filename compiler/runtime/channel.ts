/**
 * Ljos Runtime - Channel implementation
 * Provides Go-style channel communication for async operations
 */

interface Resolver<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

export class Channel<T = any> {
  private buffer: T[] = [];
  private bufferSize: number;
  private closed = false;
  private receivers: Resolver<T>[] = [];
  private senders: { value: T; resolver: Resolver<void> }[] = [];
  
  constructor(bufferSize = 0) {
    this.bufferSize = bufferSize;
  }

  /**
   * Send a value to the channel
   * If the channel is buffered and not full, returns immediately
   * Otherwise, blocks until a receiver is ready
   */
  async send(value: T): Promise<void> {
    if (this.closed) {
      throw new Error('Cannot send on closed channel');
    }

    // If there's a waiting receiver, send directly
    if (this.receivers.length > 0) {
      const receiver = this.receivers.shift()!;
      receiver.resolve(value);
      return;
    }

    // If buffer has space, add to buffer
    if (this.buffer.length < this.bufferSize) {
      this.buffer.push(value);
      return;
    }

    // Otherwise, wait for a receiver
    return new Promise((resolve, reject) => {
      this.senders.push({ value, resolver: { resolve, reject } });
    });
  }

  /**
   * Receive a value from the channel
   * Blocks until a value is available
   */
  async receive(): Promise<T> {
    // If there's a buffered value, return it
    if (this.buffer.length > 0) {
      const value = this.buffer.shift()!;
      
      // If there's a waiting sender, move their value to buffer
      if (this.senders.length > 0) {
        const sender = this.senders.shift()!;
        this.buffer.push(sender.value);
        sender.resolver.resolve();
      }
      
      return value;
    }

    // If there's a waiting sender, receive directly
    if (this.senders.length > 0) {
      const sender = this.senders.shift()!;
      sender.resolver.resolve();
      return sender.value;
    }

    // If channel is closed and empty, throw
    if (this.closed) {
      throw new Error('Channel is closed');
    }

    // Otherwise, wait for a sender
    return new Promise((resolve, reject) => {
      this.receivers.push({ resolve, reject });
    });
  }

  /**
   * Try to receive without blocking
   * Returns undefined if no value is available
   */
  tryReceive(): T | undefined {
    if (this.buffer.length > 0) {
      const value = this.buffer.shift()!;
      
      if (this.senders.length > 0) {
        const sender = this.senders.shift()!;
        this.buffer.push(sender.value);
        sender.resolver.resolve();
      }
      
      return value;
    }

    if (this.senders.length > 0) {
      const sender = this.senders.shift()!;
      sender.resolver.resolve();
      return sender.value;
    }

    return undefined;
  }

  /**
   * Close the channel
   * No more values can be sent, but buffered values can still be received
   */
  close(): void {
    this.closed = true;
    
    // Reject all waiting receivers
    for (const receiver of this.receivers) {
      receiver.reject(new Error('Channel closed'));
    }
    this.receivers = [];
    
    // Reject all waiting senders
    for (const sender of this.senders) {
      sender.resolver.reject(new Error('Channel closed'));
    }
    this.senders = [];
  }

  /**
   * Check if the channel is closed
   */
  isClosed(): boolean {
    return this.closed;
  }

  /**
   * Get the number of buffered values
   */
  get length(): number {
    return this.buffer.length;
  }

  /**
   * Async iterator support for for-await-of loops
   */
  async *[Symbol.asyncIterator](): AsyncIterableIterator<T> {
    while (!this.closed || this.buffer.length > 0 || this.senders.length > 0) {
      try {
        yield await this.receive();
      } catch {
        break;
      }
    }
  }
}

/**
 * Select from multiple channels (like Go's select statement)
 * Returns the first available value and its channel index
 */
export async function select<T>(...channels: Channel<T>[]): Promise<{ index: number; value: T }> {
  return new Promise((resolve, reject) => {
    const cleanup: (() => void)[] = [];
    let resolved = false;

    for (let i = 0; i < channels.length; i++) {
      const channel = channels[i];
      
      // Try to receive immediately
      const value = channel.tryReceive();
      if (value !== undefined) {
        resolve({ index: i, value });
        return;
      }
    }

    // Set up receivers for all channels
    for (let i = 0; i < channels.length; i++) {
      const channel = channels[i];
      
      channel.receive().then(value => {
        if (!resolved) {
          resolved = true;
          cleanup.forEach(fn => fn());
          resolve({ index: i, value });
        }
      }).catch(err => {
        // Ignore errors from closed channels
      });
    }
  });
}

export default Channel;
