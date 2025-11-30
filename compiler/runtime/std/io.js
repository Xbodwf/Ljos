/**
 * Ljos Standard Library - IO Module (JS Runtime)
 * 输入输出操作的 JavaScript 实现
 */

// ============ 标准输出 ============

export function println(...args) {
  console.log(...args);
}

export function print(...args) {
  if (typeof process !== 'undefined' && process.stdout) {
    process.stdout.write(args.join(''));
  } else {
    console.log(...args);
  }
}

export function printf(format, ...args) {
  print(formatString(format, ...args));
}

// ============ 标准输入 ============

// Node.js 环境
let readlineInterface = null;

function getReadlineInterface() {
  if (readlineInterface) return readlineInterface;
  
  if (typeof require !== 'undefined') {
    const readline = require('readline');
    readlineInterface = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }
  return readlineInterface;
}

export async function readln() {
  return new Promise((resolve) => {
    const rl = getReadlineInterface();
    if (rl) {
      rl.question('', (answer) => {
        resolve(answer);
      });
    } else if (typeof prompt !== 'undefined') {
      // Browser environment
      resolve(prompt('') || '');
    } else {
      resolve('');
    }
  });
}

export async function readInt() {
  const line = await readln();
  const parsed = parseInt(line, 10);
  return isNaN(parsed) ? null : parsed;
}

export async function readFloat() {
  const line = await readln();
  const parsed = parseFloat(line);
  return isNaN(parsed) ? null : parsed;
}

// ============ 标准错误 ============

export function eprintln(...args) {
  console.error(...args);
}

export function eprint(...args) {
  if (typeof process !== 'undefined' && process.stderr) {
    process.stderr.write(args.join(''));
  } else {
    console.error(...args);
  }
}

// ============ 格式化 ============

export function format(template, ...args) {
  return formatString(template, ...args);
}

function formatString(template, ...args) {
  let index = 0;
  return template.replace(/%[sdifob%]/g, (match) => {
    if (match === '%%') return '%';
    if (index >= args.length) return match;
    
    const arg = args[index++];
    switch (match) {
      case '%s': return String(arg);
      case '%d':
      case '%i': return parseInt(arg, 10);
      case '%f': return parseFloat(arg);
      case '%o': return JSON.stringify(arg);
      case '%b': return arg ? 'true' : 'false';
      default: return match;
    }
  });
}

// ============ 调试输出 ============

export function dbg(value) {
  console.log('[DEBUG]', value);
  return value;
}
