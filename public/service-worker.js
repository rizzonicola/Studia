// StudIA Service Worker
// - Versione della cache legata alla build: __BUILD_ID__ e __PRECACHE__ vengono sostituiti da vite.config.ts (plugin "studia-pwa")
//   dopo la build. Non serve più cambiare il nome della cache a mano.
// - Nessuna dipendenza da CDN: tutti gli asset sono generati da Vite e serviti da Cloudflare Pages.
// - Le chiamate verso Google (generativelanguage.googleapis.com) sono cross-origin e NON vengono mai intercettate né messe in cache.
// - Offline: shell dell'app + tutti i file JS/CSS/font precaricati; le note (IndexedDB) restano consultabili.
//
// Strategie:
//   navigazione        → rete per prima (HTML sempre fresco) con tempo massimo: se la rete è assente OPPURE troppo lenta
//                         si apre subito la shell in cache (l'app non ha bisogno di rete per partire); un file statico non HTML già
//                         in cache (es. THIRD-PARTY-NOTICES.txt) si apre così com'è;
//   /assets/* (hash)   → prima la cache, poi la rete (i file sono immutabili);
//   manifest           → rete per prima (con tempo massimo), cache solo se manca la rete. Sono /manifest.json e i manifest per tema in
//                         /manifests/<colore>.json (vedi docs/PWA.md): quando il browser installa o controlla se aggiornare l'app
//                         (icone, colori della barra) deve vedere subito il file nuovo, non quello vecchio in cache;
//   tutto il resto     → stale-while-revalidate.
// Installazione: i file con hash già presenti in una cache precedente vengono COPIATI, non riscaricati: a ogni deploy si scarica
// solo ciò che è cambiato davvero. Le risposte HTML non vengono mai salvate al posto di un file statico (vedi isCacheable).

const BUILD_ID = '__BUILD_ID__';
const PRECACHE = '__PRECACHE__';
const CACHE_PREFIX = 'studia-';
const CACHE = CACHE_PREFIX + BUILD_ID;
const SHELL_URL = '/index.html';
/**
 * Oltre questo tempo senza risposta, la navigazione ricade sulla shell in cache (rete debole). Era 4 s: con una rete che perde
 * pacchetti l'app installata, pur avendo tutto in cache, restava vuota fino a 4 s. Con 1,5 s il caso peggiore si riduce; con una rete
 * normale non cambia nulla (la rete risponde prima e l'HTML resta sempre fresco).
 */
const NAVIGATION_TIMEOUT_MS = 1500;
/** Download simultanei durante l'installazione: scaricare tutto il bundle in una volta fa concorrenza alla pagina appena aperta. */
const PRECACHE_CONCURRENCY = 6;
/** Il manifest è piccolo: con rete debole non si aspetta più di così prima di usare la copia in cache. */
const MANIFEST_TIMEOUT_MS = 3000;
const MANIFEST_PATH = '/manifest.json';
/** Manifest per tema (uno per colore di sfondo delle palette): /manifests/20232a.json, ecc. */
const MANIFEST_VARIANT_PATH = /^\/manifests\/[0-9a-f]{6}\.json$/;
const isManifest = (pathname) => pathname === MANIFEST_PATH || MANIFEST_VARIANT_PATH.test(pathname);

const isHashedAsset = (pathname) => pathname.startsWith('/assets/');
const looksLikeHtml = (response) => /text\/html/i.test(response.headers.get('content-type') || '');

/**
 * Una risposta si salva in cache solo se è un 200 e, quando non si tratta di un documento, NON è HTML.
 * Perché: per un file inesistente Cloudflare Pages risponde con index.html (regola SPA di _redirects) e stato 200. Salvarlo come
 * "/assets/vecchio-hash.js" avvelenerebbe la cache: da quel momento il browser riceverebbe HTML al posto dello script.
 */
function isCacheable(request, response) {
  if (!response || response.status !== 200) return false;
  return request.destination === 'document' || !looksLikeHtml(response);
}

/** Salva una copia in cache; se fallisce (spazio esaurito, ecc.) l'app funziona lo stesso, solo senza copia offline. */
async function putInCache(request, response) {
  try {
    const cache = await caches.open(CACHE);
    await cache.put(request, response);
  } catch (_) {
    /* ignorato di proposito */
  }
}

async function precache(cache, url) {
  const hashed = isHashedAsset(url);
  if (hashed) {
    // Il nome contiene l'hash del contenuto: stesso nome = stesso file. Se una versione precedente lo ha già, lo si copia.
    const previous = await caches.match(url);
    if (previous && previous.status === 200 && !looksLikeHtml(previous)) {
      await cache.put(url, previous);
      return;
    }
  }
  // Con hash la cache HTTP del browser va bene (è immutabile, e alla prima visita evita di scaricare due volte lo stesso file);
  // senza hash (icone, manifest, theme-init.js) si rivalida sempre con il server.
  const request = new Request(url, { cache: hashed ? 'default' : 'reload' });
  const response = await fetch(request);
  if (!isCacheable(request, response)) throw new Error('precache: risposta non valida per ' + url);
  await cache.put(request, response);
}

/** Come Promise.allSettled ma con al massimo `limit` operazioni in corso; l'errore su un file non ferma gli altri (best effort). */
async function runLimited(items, limit, task) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      try {
        await task(item);
      } catch (_) {
        /* ignorato di proposito: un file mancante non deve bloccare l'aggiornamento */
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker));
}

self.addEventListener('install', (event) => {
  // Nessun skipWaiting automatico: il client attiva il nuovo SW solo quando non ci sono generazioni AI in corso.
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // La shell è indispensabile: se non si scarica, l'installazione fallisce e verrà ritentata.
      await cache.add(new Request(SHELL_URL, { cache: 'reload' }));
      // Il resto è "best effort": un file mancante non deve bloccare l'aggiornamento.
      const list = Array.isArray(PRECACHE) ? PRECACHE : [];
      await runLimited(list, PRECACHE_CONCURRENCY, (url) => precache(cache, url));
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Precarica della navigazione: la richiesta della pagina parte in parallelo all'avvio del service worker
      // (dove supportata; Firefox non la offre).
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.enable();
        } catch (_) {
          /* non essenziale */
        }
      }
      // Si conservano la cache corrente e quella PRECEDENTE: una scheda ancora aperta sulla versione
      // vecchia può così caricare in lazy i suoi file senza errori. Le più vecchie vengono eliminate.
      const keys = (await caches.keys()).filter((k) => k.startsWith(CACHE_PREFIX));
      const others = keys.filter((k) => k !== CACHE);
      const stale = others.slice(0, Math.max(0, others.length - 1));
      await Promise.all(stale.map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

/** Navigazione: rete per prima, ma con tempo massimo. Se la rete cade o tarda troppo, shell dalla cache. */
async function handleNavigation(event) {
  const network = (async () => (await event.preloadResponse) || fetch(event.request))();
  network.catch(() => undefined); // l'esito tardivo, se la gara è persa, non deve produrre "unhandled rejection"
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('navigation timeout')), NAVIGATION_TIMEOUT_MS);
  });
  try {
    return await Promise.race([network, timeout]);
  } catch (_) {
    // Un file statico che non è una pagina (es. THIRD-PARTY-NOTICES.txt) e che è in cache si apre così com'è, non al posto della shell
    const exact = await caches.match(event.request);
    if (exact && exact.status === 200 && !looksLikeHtml(exact)) return exact;
    const shell = await caches.match(SHELL_URL);
    if (shell) return shell;
    // Nessuna shell in cache (installazione incompleta): se la rete era solo lenta, si continua ad aspettarla
    return network.catch(() => Response.error());
  } finally {
    clearTimeout(timer);
  }
}

/** File con hash nel nome (/assets/*): immutabili → prima la cache, poi la rete. */
async function cacheFirst(event) {
  const cached = await caches.match(event.request);
  if (cached) return cached;
  const response = await fetch(event.request);
  if (isCacheable(event.request, response)) event.waitUntil(putInCache(event.request, response.clone()));
  return response;
}

/** Icone, manifest, theme-init.js...: subito dalla cache se c'è, e intanto si aggiorna in background. */
async function staleWhileRevalidate(event) {
  const cached = await caches.match(event.request);
  const update = fetch(event.request).then((response) => {
    if (isCacheable(event.request, response)) event.waitUntil(putInCache(event.request, response.clone()));
    return response;
  });
  if (cached) {
    event.waitUntil(update.catch(() => undefined));
    return cached;
  }
  return update.catch(() => Response.error());
}

/** Manifest: rete per prima con tempo massimo; se la rete manca o tarda, la copia in cache. */
async function networkFirstManifest(event) {
  const network = fetch(event.request);
  network.catch(() => undefined); // l'esito tardivo, se la gara è persa, non deve produrre "unhandled rejection"
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('manifest timeout')), MANIFEST_TIMEOUT_MS);
  });
  try {
    const response = await Promise.race([network, timeout]);
    if (isCacheable(event.request, response)) event.waitUntil(putInCache(event.request, response.clone()));
    return response;
  } catch (_) {
    const cached = await caches.match(event.request);
    return cached || network.catch(() => Response.error());
  } finally {
    clearTimeout(timer);
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // solo risorse same-origin (Google Gemini escluso)
  if (url.pathname === '/service-worker.js') return;
  // Pagine informative statiche (/it/, /en/, /fr/ e guide): non fanno parte dell'app. Alla rete, mai la shell in cache al loro posto
  // (altrimenti, offline o con rete lenta, aprirebbero l'app su un indirizzo che il router non conosce).
  if (/^\/(it|en|fr)(\/|$)/.test(url.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(event));
  } else if (isManifest(url.pathname)) {
    event.respondWith(networkFirstManifest(event));
  } else if (isHashedAsset(url.pathname)) {
    event.respondWith(cacheFirst(event));
  } else {
    event.respondWith(staleWhileRevalidate(event));
  }
});
