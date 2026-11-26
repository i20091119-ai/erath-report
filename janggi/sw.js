/* 오프라인 지원: 한 번 열어 본 뒤에는 인터넷이 없어도 AI 대국·둘이서·배우기를 쓸 수 있게 한다.
   코드(HTML·JS·CSS)는 항상 새 것을 먼저 받고, 안 될 때만 저장해 둔 것을 쓴다. 이미지와 글꼴은 저장해 둔 것을 먼저 쓴다. */
const CACHE = 'jgxq-v1';
const CORE = ['./', './index.html', './style.css', './config.js', './engine.js', './app.js', './learn.js', './ai-worker.js', './manifest.webmanifest',
  './img/hero.jpg', './img/board-jg.jpg', './img/board-xq.jpg', './img/frame.jpg', './img/piece-jg.jpg', './img/piece-xq.jpg', './img/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const put = (req, res) => { if (res && (res.ok || res.type === 'opaque')) caches.open(CACHE).then(c => c.put(req, res.clone())); return res; };

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !font) return; // 대전 서버 등은 건드리지 않음
  const stored = /\.(png|jpe?g|webp|woff2?)$/.test(url.pathname) || font;
  if (stored) e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => put(req, res))));
  else e.respondWith(fetch(req).then(res => put(req, res)).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html'))));
});
