import { copyFile, readdir, stat, writeFile } from 'node:fs/promises';
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

async function precache() {
  const cache = await caches.open(CACHE_NAME);
  // Prefer individual puts so one missing asset cannot abort SW install.
  await Promise.all(
    PRECACHE_URLS.map(async (url) => {
      try {
        const response = await fetch(url, { cache: 'reload' });
        if (response && response.ok) await cache.put(url, response.clone());
      } catch (error) {
        /* ignore individual precache failures */
      }
    })
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
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

function isNavigationRequest(request) {
  return request.mode === 'navigate' || request.destination === 'document';
}

function isHashedAsset(request) {
  const url = new URL(request.url);
  return url.pathname.includes('/assets/');
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

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  if (cached) {
    networkPromise.catch(() => {});
    return cached;
  }

  const network = await networkPromise;
  return network || cache.match(BASE_PATH) || cache.match(\`\${BASE_PATH}index.html\`);
}

self.addEventListener('fetch', (event) => {
  if (!isAppRequest(event.request)) return;

  // Always prefer network for HTML so hashed asset references stay current.
  if (isNavigationRequest(event.request) || event.request.url.endsWith('/NodeMind/') || event.request.url.endsWith('/NodeMind/index.html')) {
    event.respondWith(networkThenCache(event.request));
    return;
  }

  // Hashed assets can be cache-first; everything else revalidates.
  if (isHashedAsset(event.request)) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  event.respondWith(networkThenCache(event.request));
});
`;

await writeFile(path.join(distDir, 'sw.js'), serviceWorker);
// GitHub Pages: unknown paths like /NodeMind/mockup1 serve this SPA shell.
await copyFile(path.join(distDir, 'index.html'), path.join(distDir, '404.html'));
console.log(`Generated service worker with ${urls.length} precached URLs.`);
