/**
 * Ljos Standard Library - String Module (JS Runtime)
 * 字符串操作的 JavaScript 实现
 */

// ============ 字符串工具函数 ============

export function len(s) {
  return s.length;
}

export function isEmpty(s) {
  return s.length === 0;
}

export function startsWith(s, prefix) {
  return s.startsWith(prefix);
}

export function endsWith(s, suffix) {
  return s.endsWith(suffix);
}

export function contains(s, sub) {
  return s.includes(sub);
}

export function indexOf(s, sub) {
  return s.indexOf(sub);
}

export function lastIndexOf(s, sub) {
  return s.lastIndexOf(sub);
}

export function substring(s, start, end = -1) {
  if (end === -1) {
    return s.substring(start);
  }
  return s.substring(start, end);
}

export function charAt(s, index) {
  if (index < 0 || index >= s.length) {
    return null;
  }
  return s.charAt(index);
}

export function toUpperCase(s) {
  return s.toUpperCase();
}

export function toLowerCase(s) {
  return s.toLowerCase();
}

export function trim(s) {
  return s.trim();
}

export function trimStart(s) {
  return s.trimStart();
}

export function trimEnd(s) {
  return s.trimEnd();
}

export function split(s, delimiter) {
  return s.split(delimiter);
}

export function join(parts, separator = "") {
  return parts.join(separator);
}

export function replace(s, old, newStr) {
  return s.replace(old, newStr);
}

export function replaceAll(s, old, newStr) {
  return s.replaceAll(old, newStr);
}

export function repeat(s, count) {
  return s.repeat(count);
}

export function padStart(s, length, pad = " ") {
  return s.padStart(length, pad);
}

export function padEnd(s, length, pad = " ") {
  return s.padEnd(length, pad);
}

export function reverse(s) {
  return s.split('').reverse().join('');
}

// ============ 字符串解析 ============

export function parseInt_(s, radix = 10) {
  const result = parseInt(s, radix);
  return isNaN(result) ? null : result;
}

export function parseFloat_(s) {
  const result = parseFloat(s);
  return isNaN(result) ? null : result;
}

// Export with Ljos names
export { parseInt_ as parseInt, parseFloat_ as parseFloat };

// ============ StringBuilder ============

export class StringBuilder {
  constructor() {
    this._parts = [];
  }
  
  append(s) {
    this._parts.push(s);
    return this;
  }
  
  appendLine(s = "") {
    this._parts.push(s);
    this._parts.push("\n");
    return this;
  }
  
  clear() {
    this._parts = [];
    return this;
  }
  
  toString() {
    return this._parts.join('');
  }
  
  len() {
    return this._parts.reduce((acc, part) => acc + part.length, 0);
  }
}
