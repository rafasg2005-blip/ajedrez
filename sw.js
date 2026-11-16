// Service worker: permite instalar la app y usarla sin conexión.
// Estrategia: responde con la copia guardada y la actualiza en segundo plano.
const CACHE = 'ajedrez-v1';
const CORE = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest',
  'js/app.js', 'js/util.js', 'js/storage.js', 'js/engine.js', 'js/book.js', 'js/coach.js', 'js/bot.js',
  'js/board.js', 'js/sound.js', 'js/play.js', 'js/puzzles.js', 'js/openings.js', 'js/review.js', 'js/history.js',
  'vendor/chess.js', 'vendor/chessground/chessground.js', 'vendor/chessground/chessground.base.css',
  'vendor/chessground/chessground.brown.css', 'vendor/chessground/chessground.cburnett.css',
  'vendor/stockfish/stockfish.js', 'vendor/stockfish/stockfish.wasm',
  'data/openings.json', 'data/puzzles.json', 'icons/icon-192.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true });
      const net = fetch(req).then((res) => {
        if (res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => hit);
      return hit || net;
    }),
  );
});
