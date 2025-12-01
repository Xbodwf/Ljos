/**
 * Ljos Standard Library - Core Module (JS Runtime)
 * 核心类型和基础操作的 JavaScript 实现
 */

// ============ Ljos typeof 实现 ============

/**
 * Ljos 的 typeof 实现
 * 返回 Ljos 类型名称而非 JS 类型名称
 * @param {*} value - 要检查的值
 * @returns {string} Ljos 类型名称
 */
export function typeOf(value) {
  if (value === null || value === undefined) {
    return 'Nul';
  }
  if (typeof value === 'boolean') {
    return 'Bool';
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return 'Int';
    }
    return 'Float';
  }
  if (typeof value === 'string') {
    return 'Str';
  }
  if (typeof value === 'function') {
    return 'Fn';
  }
  if (Array.isArray(value)) {
    return 'Array';
  }
  if (typeof value === 'object') {
    // 检查是否有自定义类名
    const className = value.constructor?.name;
    if (className && className !== 'Object') {
      return className;
    }
    return 'Object';
  }
  if (typeof value === 'symbol') {
    return 'Symbol';
  }
  if (typeof value === 'bigint') {
    return 'BigInt';
  }
  return 'Unknown';
}

// ============ 类型检查函数 ============

export function isInt(value) {
  return typeof value === 'number' && Number.isInteger(value);
}

export function isFloat(value) {
  return typeof value === 'number';
}

export function isStr(value) {
  return typeof value === 'string';
}

export function isBool(value) {
  return typeof value === 'boolean';
}

export function isNul(value) {
  return value === null || value === undefined;
}

// ============ 类型转换函数 ============

export function toInt(value) {
  if (typeof value === 'number') {
    return Math.floor(value);
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

export function toFloat(value) {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

export function toStr(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
}

export function toBool(value) {
  return Boolean(value);
}

// ============ 数学常量 ============

export const PI = Math.PI;
export const E = Math.E;
export const TAU = Math.PI * 2;

// ============ 数学函数 ============

export function abs(x) {
  return Math.abs(x);
}

export function min(a, b) {
  return Math.min(a, b);
}

export function max(a, b) {
  return Math.max(a, b);
}

export function clamp(value, minVal, maxVal) {
  return Math.min(Math.max(value, minVal), maxVal);
}

// ============ 范围生成 ============

export function range(start, end, step = 1) {
  const result = [];
  if (step > 0) {
    for (let i = start; i < end; i += step) {
      result.push(i);
    }
  } else if (step < 0) {
    for (let i = start; i > end; i += step) {
      result.push(i);
    }
  }
  return result;
}

export function rangeInclusive(start, end, step = 1) {
  return range(start, end + 1, step);
}

// ============ 断言 ============

export function assert(condition, message = "Assertion failed") {
  if (!condition) {
    throw new Error(message);
  }
}

export function unreachable(message = "Unreachable code") {
  throw new Error(message);
}

// ============ 错误类型 ============

export class LjosError extends Error {
  constructor(message = "") {
    super(message);
    this.name = 'Error';
  }
  
  toString() {
    return `Error: ${this.message}`;
  }
}

export class TypeError extends LjosError {
  constructor(message = "Type error") {
    super(message);
    this.name = 'TypeError';
  }
}

export class ValueError extends LjosError {
  constructor(message = "Value error") {
    super(message);
    this.name = 'ValueError';
  }
}

export class IndexError extends LjosError {
  constructor(message = "Index out of bounds") {
    super(message);
    this.name = 'IndexError';
  }
}

// Re-export Error as the default error class
export { LjosError as Error };
