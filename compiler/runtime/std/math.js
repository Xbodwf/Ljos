/**
 * Ljos Standard Library - Math Module (JS Runtime)
 * 数学函数的 JavaScript 实现
 */

// ============ 常量 ============

export const PI = Math.PI;
export const E = Math.E;
export const TAU = Math.PI * 2;
export const LN2 = Math.LN2;
export const LN10 = Math.LN10;
export const LOG2E = Math.LOG2E;
export const LOG10E = Math.LOG10E;
export const SQRT2 = Math.SQRT2;
export const SQRT1_2 = Math.SQRT1_2;

export const MAX_INT = Number.MAX_SAFE_INTEGER;
export const MIN_INT = Number.MIN_SAFE_INTEGER;
export const MAX_FLOAT = Number.MAX_VALUE;
export const MIN_FLOAT = Number.MIN_VALUE;
export const INFINITY = Infinity;
export const NEG_INFINITY = -Infinity;
export const NAN = NaN;

// ============ 基本运算 ============

export function abs(x) {
  return Math.abs(x);
}

export function sign(x) {
  return Math.sign(x);
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

// ============ 取整函数 ============

export function floor(x) {
  return Math.floor(x);
}

export function ceil(x) {
  return Math.ceil(x);
}

export function round(x) {
  return Math.round(x);
}

export function trunc(x) {
  return Math.trunc(x);
}

// ============ 幂和根 ============

export function pow(base, exp) {
  return Math.pow(base, exp);
}

export function sqrt(x) {
  return Math.sqrt(x);
}

export function cbrt(x) {
  return Math.cbrt(x);
}

export function exp(x) {
  return Math.exp(x);
}

export function expm1(x) {
  return Math.expm1(x);
}

// ============ 对数函数 ============

export function log(x) {
  return Math.log(x);
}

export function log2(x) {
  return Math.log2(x);
}

export function log10(x) {
  return Math.log10(x);
}

export function log1p(x) {
  return Math.log1p(x);
}

// ============ 三角函数 ============

export function sin(x) {
  return Math.sin(x);
}

export function cos(x) {
  return Math.cos(x);
}

export function tan(x) {
  return Math.tan(x);
}

export function asin(x) {
  return Math.asin(x);
}

export function acos(x) {
  return Math.acos(x);
}

export function atan(x) {
  return Math.atan(x);
}

export function atan2(y, x) {
  return Math.atan2(y, x);
}

// ============ 双曲函数 ============

export function sinh(x) {
  return Math.sinh(x);
}

export function cosh(x) {
  return Math.cosh(x);
}

export function tanh(x) {
  return Math.tanh(x);
}

export function asinh(x) {
  return Math.asinh(x);
}

export function acosh(x) {
  return Math.acosh(x);
}

export function atanh(x) {
  return Math.atanh(x);
}

// ============ 角度转换 ============

export function toRadians(degrees) {
  return degrees * Math.PI / 180;
}

export function toDegrees(radians) {
  return radians * 180 / Math.PI;
}

// ============ 其他函数 ============

export function hypot(x, y) {
  return Math.hypot(x, y);
}

export function fmod(x, y) {
  return x % y;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function isNaN_(x) {
  return Number.isNaN(x);
}

export function isFinite_(x) {
  return Number.isFinite(x);
}

export function isInfinite(x) {
  return !Number.isFinite(x) && !Number.isNaN(x);
}

// Export with Ljos names
export { isNaN_ as isNaN, isFinite_ as isFinite };

// ============ 随机数 ============

export function random() {
  return Math.random();
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}
