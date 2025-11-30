/**
 * Ljos Standard Library - Collections Module (JS Runtime)
 * 集合类型的 JavaScript 实现
 */

// ============ Vec - 动态数组 ============

export class Vec {
  constructor() {
    this._data = [];
  }
  
  static from(items) {
    const vec = new Vec();
    vec._data = [...items];
    return vec;
  }
  
  len() {
    return this._data.length;
  }
  
  isEmpty() {
    return this._data.length === 0;
  }
  
  push(item) {
    this._data.push(item);
  }
  
  pop() {
    if (this._data.length === 0) {
      return null;
    }
    return this._data.pop();
  }
  
  get(index) {
    if (index < 0 || index >= this._data.length) {
      return null;
    }
    return this._data[index];
  }
  
  set(index, value) {
    if (index < 0 || index >= this._data.length) {
      return false;
    }
    this._data[index] = value;
    return true;
  }
  
  first() {
    return this.get(0);
  }
  
  last() {
    return this.get(this._data.length - 1);
  }
  
  clear() {
    this._data = [];
  }
  
  toArray() {
    return [...this._data];
  }
  
  map(f) {
    const result = new Vec();
    result._data = this._data.map(f);
    return result;
  }
  
  filter(predicate) {
    const result = new Vec();
    result._data = this._data.filter(predicate);
    return result;
  }
  
  forEach(f) {
    this._data.forEach(f);
  }
  
  find(predicate) {
    return this._data.find(predicate) ?? null;
  }
  
  contains(item) {
    return this._data.includes(item);
  }
  
  reverse() {
    const result = new Vec();
    result._data = [...this._data].reverse();
    return result;
  }
  
  [Symbol.iterator]() {
    return this._data[Symbol.iterator]();
  }
}

// ============ LjosMap - 键值映射 ============

export class LjosMap {
  constructor() {
    this._map = new Map();
  }
  
  len() {
    return this._map.size;
  }
  
  isEmpty() {
    return this._map.size === 0;
  }
  
  set(key, value) {
    this._map.set(key, value);
  }
  
  get(key) {
    return this._map.has(key) ? this._map.get(key) : null;
  }
  
  has(key) {
    return this._map.has(key);
  }
  
  delete(key) {
    return this._map.delete(key);
  }
  
  keys() {
    return [...this._map.keys()];
  }
  
  values() {
    return [...this._map.values()];
  }
  
  clear() {
    this._map.clear();
  }
  
  getOrDefault(key, defaultValue) {
    return this._map.has(key) ? this._map.get(key) : defaultValue;
  }
  
  [Symbol.iterator]() {
    return this._map[Symbol.iterator]();
  }
}

// Export as Map for Ljos
export { LjosMap as Map };

// ============ LjosSet - 集合 ============

export class LjosSet {
  constructor() {
    this._set = new Set();
  }
  
  static from(items) {
    const set = new LjosSet();
    for (const item of items) {
      set.add(item);
    }
    return set;
  }
  
  len() {
    return this._set.size;
  }
  
  isEmpty() {
    return this._set.size === 0;
  }
  
  add(item) {
    const hadItem = this._set.has(item);
    this._set.add(item);
    return !hadItem;
  }
  
  has(item) {
    return this._set.has(item);
  }
  
  delete(item) {
    return this._set.delete(item);
  }
  
  clear() {
    this._set.clear();
  }
  
  toArray() {
    return [...this._set];
  }
  
  union(other) {
    const result = new LjosSet();
    for (const item of this._set) {
      result.add(item);
    }
    for (const item of other._set) {
      result.add(item);
    }
    return result;
  }
  
  intersection(other) {
    const result = new LjosSet();
    for (const item of this._set) {
      if (other.has(item)) {
        result.add(item);
      }
    }
    return result;
  }
  
  difference(other) {
    const result = new LjosSet();
    for (const item of this._set) {
      if (!other.has(item)) {
        result.add(item);
      }
    }
    return result;
  }
  
  [Symbol.iterator]() {
    return this._set[Symbol.iterator]();
  }
}

// Export as Set for Ljos
export { LjosSet as Set };

// ============ Stack - 栈 ============

export class Stack {
  constructor() {
    this._data = [];
  }
  
  len() {
    return this._data.length;
  }
  
  isEmpty() {
    return this._data.length === 0;
  }
  
  push(item) {
    this._data.push(item);
  }
  
  pop() {
    if (this._data.length === 0) {
      return null;
    }
    return this._data.pop();
  }
  
  peek() {
    if (this._data.length === 0) {
      return null;
    }
    return this._data[this._data.length - 1];
  }
  
  clear() {
    this._data = [];
  }
}

// ============ Queue - 队列 ============

export class Queue {
  constructor() {
    this._data = [];
  }
  
  len() {
    return this._data.length;
  }
  
  isEmpty() {
    return this._data.length === 0;
  }
  
  enqueue(item) {
    this._data.push(item);
  }
  
  dequeue() {
    if (this._data.length === 0) {
      return null;
    }
    return this._data.shift();
  }
  
  peek() {
    if (this._data.length === 0) {
      return null;
    }
    return this._data[0];
  }
  
  clear() {
    this._data = [];
  }
}
