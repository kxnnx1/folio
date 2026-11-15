/* Folio 서비스 워커 — 설치형 웹앱(PWA)
   - 앱 화면(index.html): 인터넷이 되면 늘 새로 받고, 안 되면 저장해 둔 것으로 열어요 (업데이트가 바로 반영돼요)
   - 글꼴: 한 번 받으면 저장해 두고 오프라인에서도 써요
   - AI 번역 · 구글 번역 같은 API 요청은 건드리지 않아요 (저장하지 않아요)
   index.html을 고쳐도 이 파일은 그대로 둬도 돼요. 아래 목록(SHELL)을 바꿀 때만 VERSION을 올려 주세요. */
const VERSION = 'folio-v3';
const SHELL_CACHE = `${VERSION}-shell`;
const FONT_CACHE = 'folio-fonts';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'fonts/PretendardVariable.woff2',
  'img/icon-192.png',
  'img/icon-512.png',
  'img/apple-touch-icon.png',
  'img/favicon-64.png',
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL_CACHE);
    // 하나가 실패해도 나머지는 저장해요
    await Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, FONT_CACHE]);
    for (const k of await caches.keys()) if (!keep.has(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 앱 화면: 네트워크 먼저 → 실패하면 저장본
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req, { cache: 'no-cache' });
        if (res.ok) (await caches.open(SHELL_CACHE)).put('index.html', res.clone());
        return res;
      } catch {
        return (await caches.match('index.html', { cacheName: SHELL_CACHE }))
          || (await caches.match('./', { cacheName: SHELL_CACHE }))
          || Response.error();
      }
    })());
    return;
  }

  // 같은 주소의 파일(글꼴 · 아이콘): 저장본 먼저, 없으면 받아서 저장
  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      const hit = await caches.match(req, { cacheName: SHELL_CACHE });
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) (await caches.open(SHELL_CACHE)).put(req, res.clone());
      return res;
    })());
    return;
  }

  // 인터넷 글꼴: 저장본으로 바로 보여 주고, 뒤에서 새로 받아 두기
  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith((async () => {
      const c = await caches.open(FONT_CACHE);
      const hit = await c.match(req);
      const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => null);
      if (hit) { e.waitUntil(net); return hit; }
      return (await net) || Response.error();
    })());
  }
  // 그 밖(API 요청 등)은 브라우저에 맡겨요
});
