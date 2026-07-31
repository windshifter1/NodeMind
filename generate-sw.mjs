import { readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const distDir = path.resolve('dist');
const basePath = '/NodeMind/';
const ignoredFiles = new Set(['sw.js']);

async function listFiles(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.posix.join(prefix, entry.name);
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath, relativePath)));
    } else if (!ignoredFiles.has(relativePath)) {
      const info = await stat(fullPath);
      if (info.isFile()) files.push(relativePath);
    }
  }

  return files;
}

const files = await listFiles(distDir);
const urls = [...new Set([basePath, ...files.map((file) => `${basePath}${file}`)])].sort();
const cacheName = `nodemind-${Date.now()}`;

const serviceWorker = `const CACHE_NAME = ${JSON.stringify(cacheName)};
const BASE_PATH = ${JSON.stringify(basePath)};
const PRECACHE_URLS = ${JSON.stringify(urls, null, 2)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isAppRequest(request) {
  const url = new URL(request.url);
  return request.method === 'GET' && url.origin === self.location.origin && url.pathname.startsWith(BASE_PATH);
}

async function networkThenCache(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    return cached || cache.match(BASE_PATH) || cache.match(\`\${BASE_PATH}index.html\`);
  }
}

async function cacheThenNetwork(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const cache = await caches.open(CACHE_NAME);
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  if (!isAppRequest(event.request)) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(networkThenCache(event.request));
    return;
  }

  event.respondWith(cacheThenNetwork(event.request));
});
`;

await writeFile(path.join(distDir, 'sw.js'), serviceWorker);
console.log(`Generated service worker with ${urls.length} precached URLs.`);
