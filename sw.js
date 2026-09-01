/* ══════════════════════════════════════════════════════════════
   2PROVI Tools — Service Worker
   ทำให้เว็บใช้งานได้เต็มรูปแบบแม้ไม่มีอินเทอร์เน็ต
   รวมถึงการสร้าง PDF (ไลบรารีถูกเก็บไว้ในเครื่องแล้ว)

   กลยุทธ์:
   • หน้า HTML          → network-first  (ได้ของใหม่เสมอเมื่อออนไลน์, ออฟไลน์ใช้แคช)
   • CSS / JS / ไอคอน   → stale-while-revalidate (เปิดไว ค่อยอัปเดตเบื้องหลัง)
   • ฟอนต์ Google       → cache-first     (ไม่ค่อยเปลี่ยน)
   ══════════════════════════════════════════════════════════════ */

const VERSION    = 'v1.0.0';
const CORE_CACHE = '2provi-core-' + VERSION;
const RUN_CACHE  = '2provi-runtime-' + VERSION;

/* ไฟล์ที่ต้องมีครบตั้งแต่ติดตั้ง เพื่อให้เปิดออฟไลน์ได้ทันที */
const CORE_ASSETS = [
  './',
  './index.html',
  './irr.html',
  './fna.html',
  './savings.html',
  './offline.html',
  './assets/theme.css',
  './assets/common.js',
  './assets/vendor/html2canvas.min.js',
  './assets/vendor/jspdf.umd.min.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CORE_CACHE);
    // เพิ่มทีละไฟล์ เพื่อไม่ให้ไฟล์เดียวพังแล้วการติดตั้งล้มทั้งชุด
    await Promise.all(CORE_ASSETS.map(async (url) => {
      try { await cache.add(new Request(url, { cache: 'reload' })); }
      catch (e) { console.warn('[sw] ข้ามไฟล์', url, e); }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k.startsWith('2provi-') && k !== CORE_CACHE && k !== RUN_CACHE)
          .map(k => caches.delete(k))
    );
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch (e) {}
    }
    await self.clients.claim();
  })());
});

/* ให้หน้าเว็บสั่งอัปเดตทันทีได้ */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'GET_VERSION' && event.source) event.source.postMessage({ version: VERSION });
});

const isFont = (url) =>
  url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  /* ── หน้าเว็บ: network-first ── */
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const preload = await event.preloadResponse;
        const fresh = preload || await fetch(req);
        const cache = await caches.open(CORE_CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        const cached = await caches.match(req, { ignoreSearch: true });
        return cached
          || await caches.match('./index.html')
          || await caches.match('./offline.html')
          || new Response('ออฟไลน์', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  /* ── ฟอนต์ Google: cache-first ── */
  if (isFont(url)) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        const cache = await caches.open(RUN_CACHE);
        cache.put(req, res.clone());
        return res;
      } catch (e) {
        return cached || Response.error();
      }
    })());
    return;
  }

  if (!sameOrigin) return;

  /* ── ไฟล์ในเว็บเอง: stale-while-revalidate ── */
  event.respondWith((async () => {
    const cache = await caches.open(CORE_CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then((res) => {
      if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    return cached || (await network) || new Response('', { status: 504 });
  })());
});
