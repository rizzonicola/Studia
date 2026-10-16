/*
 * StudIA - script di avvio del tema.
 *
 * Viene eseguito in modo sincrono nell'<head>, PRIMA del primo render, così la pagina appare subito con i colori
 * giusti (nessun lampo di tema chiaro per chi usa quello scuro). Non calcola nulla: rilegge l'istantanea che l'app
 * salva in localStorage ("studia_theme_boot", prodotta da utils/themeEngine.ts → buildBootSnapshot) e la applica.
 *
 * Aggiorna anche il colore della barra di stato (<meta name="theme-color">): l'HTML ne contiene due, scelte dal tema del
 * dispositivo (servono al primo disegno); qui diventano UNA sola, senza media query, con il colore del tema scelto nell'app
 * (stessa logica di applyThemeColorMeta in utils/themeEngine.ts: se cambi una, cambia l'altra).
 *
 * Collega anche il manifest del tema in uso (<link rel="manifest">): la barra di navigazione di Android prende il colore dal manifest,
 * letto dal browser quando installa o aggiorna l'app (applyManifestLink in utils/themeEngine.ts; vedi utils/manifestVariants.ts e docs/PWA.md).
 *
 * È un file esterno (non uno script inline) perché la Content-Security-Policy consente solo `script-src 'self'`.
 * Nessuna rete, nessun cookie, nessun dato inviato: legge solo il localStorage del tuo browser.
 * Se l'istantanea manca o ha un formato diverso, non fa nulla (poi ci pensa l'app).
 */
(function () {
  try {
    var root = document.documentElement;
    var prefersDark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

    var setThemeColor = function (color) {
      var metas = document.querySelectorAll('meta[name="theme-color"]');
      var meta = metas[0];
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'theme-color');
        document.head.appendChild(meta);
      }
      for (var i = 1; i < metas.length; i++) metas[i].parentNode.removeChild(metas[i]);
      meta.removeAttribute('media');
      meta.setAttribute('content', color);
    };

    // Solo i manifest che esistono davvero (/manifest.json e /manifests/<colore>.json): l'istantanea viene dal localStorage
    var setManifest = function (href) {
      if (href !== '/manifest.json' && !/^\/manifests\/[0-9a-f]{6}\.json$/.test(href)) return;
      var link = document.querySelector('link[rel="manifest"]');
      if (link && link.getAttribute('href') !== href) link.setAttribute('href', href);
    };

    var snap = null;
    try {
      var raw = window.localStorage.getItem('studia_theme_boot');
      if (raw) snap = JSON.parse(raw);
    } catch (e) {
      snap = null;
    }

    if (!snap || snap.v !== 1 || !snap.light || !snap.dark) {
      // Prima visita: si evita solo il lampo bianco per chi ha il dispositivo in modalità scura.
      if (prefersDark) {
        root.style.setProperty('--color-gray-50', '#20232a');
        root.setAttribute('data-scheme', 'dark');
        root.setAttribute('data-tone', 'dark');
        setManifest('/manifests/20232a.json'); // sfondo del tema scuro predefinito («Ardesia»)
      }
      return;
    }

    var scheme;
    if (snap.mode === 'light' || snap.mode === 'dark') {
      scheme = snap.mode;
    } else if (snap.mode === 'schedule') {
      var toMin = function (s) {
        var p = String(s).split(':');
        return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
      };
      var now = new Date();
      var m = now.getHours() * 60 + now.getMinutes();
      var a = toMin(snap.from);
      var b = toMin(snap.to);
      var isDark = a === b ? false : a < b ? m >= a && m < b : m >= a || m < b;
      scheme = isDark ? 'dark' : 'light';
    } else {
      scheme = prefersDark ? 'dark' : 'light';
    }

    var t = snap[scheme];
    if (!t || !t.vars) return;

    for (var name in t.vars) {
      if (Object.prototype.hasOwnProperty.call(t.vars, name) && name.indexOf('--') === 0) {
        root.style.setProperty(name, String(t.vars[name]));
      }
    }
    var allowed = { 'data-scheme': 1, 'data-tone': 1, 'data-pattern': 1, 'data-motion': 1 };
    for (var attr in t.attrs) {
      if (Object.prototype.hasOwnProperty.call(t.attrs, attr) && allowed[attr]) {
        root.setAttribute(attr, String(t.attrs[attr]));
      }
    }
    if (t.themeColor) setThemeColor(String(t.themeColor));
    if (t.manifest) setManifest(String(t.manifest));
  } catch (e) {
    /* mai bloccare l'avvio dell'app */
  }
})();

/*
 * Precarico del dizionario dell'interfaccia (i18n/locales/<lingua>.ts).
 *
 * Il dizionario è un import() dinamico dell'app: il browser lo scopre solo dopo aver scaricato ed eseguito il bundle principale, e
 * il primo render lo aspetta (index.tsx). Qui, che gira prima, si avvia lo scarico in parallelo con il bundle: un <link rel="modulepreload">
 * solo per la lingua che l'app userà. Il file ha un hash nel nome, quindi la mappa lingua → file la scrive la build (vite.config.ts,
 * plugin studia-pwa) al posto del segnaposto; con `vite dev` il segnaposto resta una stringa e questo blocco non fa nulla.
 *
 * Regola per scegliere la lingua = quella di i18n/resolve.ts (resolveLanguage) e i18n/core.ts (readLanguagePreference): preferenza salvata
 * ("studia_language") se è it/en/fr, altrimenti la prima lingua supportata del dispositivo (anche varianti: "fr-CA", "IT_ch"), altrimenti
 * inglese. Se la lingua indovinata fosse diversa da quella risolta, si sprecano ~9 KB: nient'altro. È un blocco a sé, con il suo try/catch:
 * qualunque errore qui non tocca il tema né blocca l'avvio.
 */
(function () {
  try {
    var chunks = '__LOCALE_CHUNKS__';
    if (!chunks || typeof chunks !== 'object') return;

    var supported = { it: 1, en: 1, fr: 1 };
    var lang = null;
    try {
      var pref = window.localStorage.getItem('studia_language');
      if (pref && Object.prototype.hasOwnProperty.call(supported, pref)) lang = pref;
    } catch (e) {
      lang = null;
    }
    if (!lang) {
      var device = navigator.languages && navigator.languages.length > 0 ? navigator.languages : navigator.language ? [navigator.language] : [];
      for (var i = 0; i < device.length && !lang; i++) {
        var primary = String(device[i]).toLowerCase().split(/[-_]/)[0];
        if (Object.prototype.hasOwnProperty.call(supported, primary)) lang = primary;
      }
      if (!lang) lang = 'en';
    }

    var href = Object.prototype.hasOwnProperty.call(chunks, lang) ? chunks[lang] : null;
    // Solo file della cartella degli asset di build (lo stesso indirizzo che l'app richiederà con import())
    if (typeof href !== 'string' || !/^\/assets\/[\w.-]+\.js$/.test(href)) return;

    var link = document.createElement('link');
    link.rel = 'modulepreload';
    link.crossOrigin = ''; // come i modulepreload che genera Vite: stessa richiesta, nessun secondo scarico
    link.href = href;
    document.head.appendChild(link);
  } catch (e) {
    /* mai bloccare l'avvio dell'app */
  }
})();
