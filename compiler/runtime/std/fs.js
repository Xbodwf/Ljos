/**
 * Ljos Standard Library - File System Module (JS Runtime)
 * 文件系统操作的 JavaScript 实现
 */

// Node.js fs module
let fs = null;
let path = null;

function getFs() {
  if (fs) return fs;
  if (typeof require !== 'undefined') {
    fs = require('fs');
    path = require('path');
  }
  return fs;
}

function getPath() {
  if (path) return path;
  if (typeof require !== 'undefined') {
    path = require('path');
  }
  return path;
}

// ============ 文件读写 ============

export function readFile(filePath) {
  const fs = getFs();
  if (!fs) return null;
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    return null;
  }
}

export async function readFileAsync(filePath) {
  const fs = getFs();
  if (!fs) return null;
  try {
    return await fs.promises.readFile(filePath, 'utf-8');
  } catch (e) {
    return null;
  }
}

export function writeFile(filePath, content) {
  const fs = getFs();
  if (!fs) return false;
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch (e) {
    return false;
  }
}

export async function writeFileAsync(filePath, content) {
  const fs = getFs();
  if (!fs) return false;
  try {
    await fs.promises.writeFile(filePath, content, 'utf-8');
    return true;
  } catch (e) {
    return false;
  }
}

export function appendFile(filePath, content) {
  const fs = getFs();
  if (!fs) return false;
  try {
    fs.appendFileSync(filePath, content, 'utf-8');
    return true;
  } catch (e) {
    return false;
  }
}

export function readLines(filePath) {
  const content = readFile(filePath);
  if (content === null) return [];
  return content.split('\n');
}

// ============ 文件信息 ============

export function exists(filePath) {
  const fs = getFs();
  if (!fs) return false;
  return fs.existsSync(filePath);
}

export function isFile(filePath) {
  const fs = getFs();
  if (!fs) return false;
  try {
    return fs.statSync(filePath).isFile();
  } catch (e) {
    return false;
  }
}

export function isDir(filePath) {
  const fs = getFs();
  if (!fs) return false;
  try {
    return fs.statSync(filePath).isDirectory();
  } catch (e) {
    return false;
  }
}

export function fileSize(filePath) {
  const fs = getFs();
  if (!fs) return -1;
  try {
    return fs.statSync(filePath).size;
  } catch (e) {
    return -1;
  }
}

export function extension(filePath) {
  const path = getPath();
  if (!path) return '';
  return path.extname(filePath);
}

export function filename(filePath) {
  const path = getPath();
  if (!path) return filePath;
  return path.basename(filePath);
}

export function parent(filePath) {
  const path = getPath();
  if (!path) return '';
  return path.dirname(filePath);
}

// ============ 目录操作 ============

export function mkdir(dirPath) {
  const fs = getFs();
  if (!fs) return false;
  try {
    fs.mkdirSync(dirPath);
    return true;
  } catch (e) {
    return false;
  }
}

export function mkdirp(dirPath) {
  const fs = getFs();
  if (!fs) return false;
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    return true;
  } catch (e) {
    return false;
  }
}

export function remove(filePath) {
  const fs = getFs();
  if (!fs) return false;
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch (e) {
    try {
      fs.rmdirSync(filePath);
      return true;
    } catch (e2) {
      return false;
    }
  }
}

export function removeAll(dirPath) {
  const fs = getFs();
  if (!fs) return 0;
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
    return 1;
  } catch (e) {
    return 0;
  }
}

export function listDir(dirPath) {
  const fs = getFs();
  if (!fs) return [];
  try {
    return fs.readdirSync(dirPath);
  } catch (e) {
    return [];
  }
}

export function copy(src, dst) {
  const fs = getFs();
  if (!fs) return false;
  try {
    fs.copyFileSync(src, dst);
    return true;
  } catch (e) {
    return false;
  }
}

export function move(src, dst) {
  const fs = getFs();
  if (!fs) return false;
  try {
    fs.renameSync(src, dst);
    return true;
  } catch (e) {
    return false;
  }
}

// ============ 路径操作 ============

export function join(...parts) {
  const path = getPath();
  if (!path) return parts.join('/');
  return path.join(...parts);
}

export function absolute(filePath) {
  const path = getPath();
  if (!path) return filePath;
  return path.resolve(filePath);
}

export function cwd() {
  return process.cwd();
}

export function chdir(dirPath) {
  try {
    process.chdir(dirPath);
    return true;
  } catch (e) {
    return false;
  }
}
