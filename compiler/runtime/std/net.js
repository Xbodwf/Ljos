/**
 * Ljos Standard Library - Network Module (JS Runtime)
 * 网络操作的 JavaScript 实现
 */

// ============ HTTP 请求 ============

// GET 请求
export async function httpGet(url, options = {}) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: options.headers || {},
    });
    
    return {
      statusCode: response.status,
      body: await response.text(),
      headers: Object.fromEntries(response.headers.entries()),
      ok: () => response.ok,
    };
  } catch (e) {
    return null;
  }
}

// POST 请求
export async function httpPost(url, data, options = {}) {
  try {
    const contentType = options.contentType || 'application/json';
    const body = typeof data === 'string' ? data : JSON.stringify(data);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        ...(options.headers || {}),
      },
      body,
    });
    
    return {
      statusCode: response.status,
      body: await response.text(),
      headers: Object.fromEntries(response.headers.entries()),
      ok: () => response.ok,
    };
  } catch (e) {
    return null;
  }
}

// PUT 请求
export async function httpPut(url, data, options = {}) {
  try {
    const contentType = options.contentType || 'application/json';
    const body = typeof data === 'string' ? data : JSON.stringify(data);
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        ...(options.headers || {}),
      },
      body,
    });
    
    return {
      statusCode: response.status,
      body: await response.text(),
      headers: Object.fromEntries(response.headers.entries()),
      ok: () => response.ok,
    };
  } catch (e) {
    return null;
  }
}

// DELETE 请求
export async function httpDelete(url, options = {}) {
  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: options.headers || {},
    });
    
    return {
      statusCode: response.status,
      body: await response.text(),
      headers: Object.fromEntries(response.headers.entries()),
      ok: () => response.ok,
    };
  } catch (e) {
    return null;
  }
}

// 通用请求
export async function request(url, options = {}) {
  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body,
    });
    
    return {
      statusCode: response.status,
      body: await response.text(),
      headers: Object.fromEntries(response.headers.entries()),
      ok: () => response.ok,
    };
  } catch (e) {
    return null;
  }
}

// ============ JSON 请求 ============

export async function getJson(url, options = {}) {
  const response = await httpGet(url, options);
  if (!response) return null;
  try {
    return JSON.parse(response.body);
  } catch (e) {
    return null;
  }
}

export async function postJson(url, data, options = {}) {
  const response = await httpPost(url, data, { ...options, contentType: 'application/json' });
  if (!response) return null;
  try {
    return JSON.parse(response.body);
  } catch (e) {
    return null;
  }
}

// ============ 下载 ============

export async function download(url, filePath) {
  // Node.js 环境
  if (typeof require !== 'undefined') {
    const fs = require('fs');
    const https = require('https');
    const http = require('http');
    
    return new Promise((resolve) => {
      const protocol = url.startsWith('https') ? https : http;
      const file = fs.createWriteStream(filePath);
      
      protocol.get(url, (response) => {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(true);
        });
      }).on('error', (err) => {
        fs.unlink(filePath, () => {});
        resolve(false);
      });
    });
  }
  
  // 浏览器环境
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    
    // 创建下载链接
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filePath.split('/').pop();
    a.click();
    URL.revokeObjectURL(a.href);
    return true;
  } catch (e) {
    return false;
  }
}

// ============ URL 编码 ============

export function urlEncode(str) {
  return encodeURIComponent(str);
}

export function urlDecode(str) {
  return decodeURIComponent(str);
}

// ============ 查询字符串 ============

export function buildQuery(params) {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

export function parseQuery(queryString) {
  const params = {};
  const pairs = queryString.replace(/^\?/, '').split('&');
  
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key) {
      params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
    }
  }
  
  return params;
}

// ============ WebSocket (浏览器) ============

export function createWebSocket(url) {
  if (typeof WebSocket === 'undefined') {
    return null;
  }
  
  const ws = new WebSocket(url);
  
  return {
    onOpen: (callback) => { ws.onopen = callback; },
    onMessage: (callback) => { ws.onmessage = (e) => callback(e.data); },
    onClose: (callback) => { ws.onclose = callback; },
    onError: (callback) => { ws.onerror = callback; },
    send: (data) => ws.send(typeof data === 'string' ? data : JSON.stringify(data)),
    close: () => ws.close(),
    get readyState() { return ws.readyState; },
  };
}
