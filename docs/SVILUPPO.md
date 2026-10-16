# StudIA — Guida allo sviluppo

Documentazione tecnica del progetto: comandi, struttura, dati, sicurezza, temi, modelli, lingue, test e deploy.
Gli approfondimenti su PWA e SEO sono in [`PWA.md`](PWA.md) e [`SEO.md`](SEO.md).

**Indice:** [Panoramica](#panoramica) · [Comandi](#comandi) · [Struttura](#struttura-del-progetto) · [Dati nel browser](#dati-salvati-nel-browser) · [Sicurezza](#sicurezza) · [Temi](#temi-e-personalizzazione) · [Modelli Gemini](#modelli-gemini) · [Lingue e prompt](#lingue-e-prompt) · [PWA](#pwa) · [SEO](#seo-e-pagine-informative) · [Test e controlli](#test-e-controlli) · [Deploy](#deploy-su-cloudflare-pages) · [Testi legali](#testi-legali) · [Autore e licenza](#autore-e-licenza)

## Panoramica

| | |
|---|---|
| Sito | <https://studia.poppi.cc> |
| Stack | Vite 7, React 19, TypeScript, Tailwind 4, react-router 7, `@google/genai`, IndexedDB (`idb`) |
| Lingue | Italiano, English, Français, più «Sistema» |
| Architettura | Applicazione interamente lato client, senza backend né account. La chiave API di Google AI Studio è fornita dall'utente e salvata solo nel browser |
| Licenza | [PolyForm Strict License 1.0.0](https://polyformproject.org/licenses/strict/1.0.0) |
| Autore | [Nicola Rizzo](https://github.com/rizzonicola) |

## Comandi

| Comando | Descrizione |
|---|---|
| `npm install` | Installa le dipendenze. `.npmrc` abilita `legacy-peer-deps` perché `react-graph-vis` dichiara React ≤ 17 |
| `npm run dev` | Server di sviluppo su <http://localhost:3000> |
| `npm run build` | Build di produzione in `dist/` |
| `npm run preview` | Anteprima del build di produzione |
| `npm run typecheck` | Controllo dei tipi dell'intera applicazione |
| `npm run typecheck:strict` | `strict: true` sui moduli senza dipendenze grafiche (elenco in `tsconfig.strict.json`) |
| `npm test` | Unit test con Vitest (configurazione in `vitest.config.ts`) |
| `npm run audit:prod` | `npm audit` sulle sole dipendenze di produzione, soglia *high* |

Il service worker viene registrato solo in produzione (`npm run build && npm run preview`).

## Struttura del progetto

```
config/      site.ts (dominio, autore, licenza), appConfig.ts (costanti e chiavi di storage), seoRoutes.ts (pagine statiche SEO)
seo/         content.ts (testi), render.ts (HTML), generate.ts (pagine, sitemap e robots generati al build)
i18n/        core.ts, I18nProvider.tsx, resolve.ts, locales/{it,en,fr}.ts
services/    gemini.ts (caricato in lazy), prompts.ts + prompts/*, errors.ts, rateLimit.ts, uploadCache.ts, validators.ts,
             apiKey.ts, apiKeyStore.ts, fallbackPreference.ts,
             notesDb.ts (IndexedDB) + notesData.ts (parte pura: validazione, albero, formato precedente)
hooks/       useSettings, useTheme (motore dei temi), useNotesStore, useAIProcessor
legal/       LegalDocuments.tsx, content/{it,en,fr}.tsx
pages/ components/ utils/
public/      _headers, _redirects, service-worker.js, manifest.json + manifests/ (uno per sfondo di palette),
             favicon.svg/.ico, icons/, og-image.png
tests/       test Vitest (vedi «Test e controlli»); vitest.config.ts nella radice
docs/        SVILUPPO.md, PWA.md, SEO.md e screenshots/ (immagini del README, escluse dalla build)
tools/       import-graph.mjs, pwa-check.mjs, sw-manifest-check.mjs, seo-check.mjs, generate-icons.mjs,
             generate-manifests.mjs e browser-checks/ (prove con un browser reale)
LICENSE      avviso di licenza (PolyForm Strict License 1.0.0)
```

## Dati salvati nel browser

| Dove | Cosa | Note |
|---|---|---|
| IndexedDB `studia_db` v1 | `notes`, `folders` | Scritture a patch (un campo alla volta), lettura tollerante ai dati corrotti, sincronizzazione fra schede (`services/notesDb.ts`) |
| localStorage | Impostazioni, modello, tema, lingua, vista, accettazione dei testi legali, prompt personalizzati (max 20.000 caratteri ciascuno), chiave API (se «Ricorda» è attivo) | Chiavi elencate in `config/appConfig.ts` (`STORAGE_KEYS`) |
| sessionStorage | Chiave API, se «Ricorda la chiave su questo dispositivo» è disattivato | Eliminata alla chiusura della scheda |
| Cache Storage | File dell'applicazione (service worker) | Versione corrente e precedente (`public/service-worker.js`) |
| Memoria | Riferimenti ai file caricati su Google, foto in elaborazione | Mai persistiti |

## Sicurezza

- **CSP** rigorosa in `public/_headers`: `script-src 'self'`, `connect-src` limitato a `generativelanguage.googleapis.com`. `style-src` richiede `'unsafe-inline'` per KaTeX, vis-network e gli attributi `style` di React.
- **HTML generato dall'AI**: sanificato con `utils/sanitizeHtml.ts` (DOMParser, nessuna dipendenza; il CSS viene ripulito anche dalle sequenze di escape come `\75rl(`) e mostrato in un `<iframe sandbox="">` con CSP interna. I tre livelli sono indipendenti e verificati singolarmente da `npm run check:sanitize`.
- **Chiave API**: mai presente in URL o messaggi d'errore (`redactSecrets`); può essere conservata solo in `sessionStorage`.
- **Markdown**: nessun HTML grezzo (`rehype-raw` non è usato).
- **JSON di quiz e mappe**: validato in `services/validators.ts`.

## Temi e personalizzazione

Impostazioni → **Aspetto**. Il motore dei temi è codice proprio, senza librerie aggiuntive: `config/themes.ts`, `utils/color.ts`, `utils/themeEngine.ts`, `hooks/useTheme.tsx`, `components/ThemeSettings.tsx`.

| Area | Opzioni |
|---|---|
| Modalità | Automatica (segue il dispositivo), chiaro, scuro, oppure a orario (scuro in una fascia oraria, anche a cavallo della mezzanotte) |
| Tavolozze | 7 chiare e 9 scure. Il chiaro *Classico* corrisponde all'aspetto originale e non sovrascrive nulla; lo scuro predefinito *Ardesia* usa `#20232a`, `#282c35` e il verde acqua `#0c9488` |
| Colori | 12 accenti più un colore libero, e 5 colori di base modificabili (sfondo, schede, testo, testo secondario, bordi). Da questi derivano scala dei grigi, toni di note e cartelle, stato hover e colore del testo sui pulsanti, con contrasto WCAG AA verificato |
| Testo | Caratteri di sistema (nessun font scaricato, la CSP resta invariata), dimensione e spaziatura, dimensione, interlinea e larghezza degli appunti |
| Forma e layout | Angoli, dimensione delle schede, motivo dello sfondo, animazioni, contrasto elevato, intensità dei colori di note e cartelle, adattamento delle note HTML al tema scuro |
| Temi salvati | Fino a 12, con esportazione e importazione JSON e ripristino |

**Funzionamento.** Tailwind 4 legge variabili CSS (`--color-gray-*`, `--radius-*`, …). Il motore le sovrascrive su `<html>`, quindi l'intera interfaccia cambia senza modificare le classi. I componenti usano i token semantici `bg-surface`, `bg-accent`, `text-accent-fg`, `text-accent-ink`, `bg-accent-soft` e `bg-danger`, definiti in `index.css`. `public/theme-init.js` applica il tema prima del primo render, evitando il lampo di colore. Tutto ciò che proviene da localStorage o da file importati passa da `sanitizeThemeConfig`: nel CSS finiscono solo esadecimali validati, numeri limitati e valori di elenchi chiusi.

**Chiavi localStorage.** `studia_theme_config` (configurazione) e `studia_theme_boot` (istantanea per l'avvio). La chiave precedente `studia_theme` viene migrata e rimossa.

## Modelli Gemini

### Modello principale

`DEFAULT_MODEL` in `config/appConfig.ts` (attualmente `gemini-3.8-flash`), selezionabile da Impostazioni → Modello.

### Modello di riserva

- Il nome predefinito è `DEFAULT_FALLBACK_MODEL` (attualmente `gemini-3.7-flash`) e la funzione è attiva di default (`DEFAULT_FALLBACK_ENABLED`).
- Se il modello principale è sovraccarico o ha esaurito i limiti, la richiesta viene ripetuta con quello di riserva, usando la stessa chiave API. L'interruttore in Impostazioni → Modello la disattiva.
- I Termini di Servizio (punto 3) e la Privacy (punti 3.1 e 3.2) descrivono questo comportamento. Una modifica al predefinito o all'attivazione richiede l'aggiornamento preventivo dei testi legali e di `LEGAL_VERSION`, così che gli utenti accettino di nuovo i testi. `tests/logic.test.ts` fallisce se i testi dichiarano il contrario.
- Il nome della riserva deve restare diverso da `DEFAULT_MODEL`, altrimenti non potrebbe mai attivarsi (verificato da `tests/logic.test.ts`).

### Persistenza delle scelte

- I valori predefiniti non vengono scritti nel browser: in localStorage restano solo le scelte esplicite (`studia_gemini_model`, `studia_fallback_model`, `studia_fallback_enabled`). Una modifica ai predefiniti nel codice si applica quindi agli utenti che non hanno personalizzato nulla; «Predefinito» in Impostazioni rimuove la scelta del nome.
- `studia_fallback_enabled` vale `0` quando la riserva è disattivata dall'utente; il valore `1`, scritto dalle versioni precedenti, equivale ad «attiva». La logica è in `services/fallbackPreference.ts`. Il nome della riserva non influisce sull'attivazione, che dipende solo dall'interruttore.

### Parametro `temperature`

I modelli Gemini 3.6 e successivi ignorano `temperature` senza generare errori; Google ha annunciato che le generazioni future lo rifiuteranno con un errore 400. In quel caso il parametro va rimosso da `services/gemini.ts`, dove compare una sola volta (`generateNotesFromFiles`).

## Lingue e prompt

- **Preferenza di lingua** in localStorage (`studia_language`): `system` (predefinita), `it`, `en` o `fr`. «Sistema» usa `navigator.languages`, riconosce le varianti regionali e ripiega su English, la lingua più diffusa per un pubblico non italiano né francese. Segue l'evento `languagechange`.
- **Dizionari** tipizzati in `i18n/locales/`, caricati in lazy. `it.ts` è il riferimento: `en.ts` e `fr.ts` devono avere le stesse chiavi, altrimenti la compilazione fallisce.
- **Prompt predefiniti** in `services/prompts/{it,en,fr}.ts`. Il prompt personalizzato dell'utente, se presente, sostituisce sempre quello predefinito in qualunque lingua e non viene modificato dal cambio di lingua.
- **Lingua dei contenuti generati** (Impostazioni): *Come il documento* (predefinita) oppure *Come l'app*. All'input viene aggiunta un'unica riga tecnica («Language: …»); il prompt di sistema non viene mai modificato. Quiz e mappe aggiungono inoltre la nota che le chiavi JSON non si traducono.

## PWA

L'applicazione è installabile (Chrome, Edge, Samsung Internet, Brave; Safari su iPhone e iPad dal menu Condividi) e dispone di icone adattive e monocromatiche (icone a tema di Android 13+), avviso offline e colore delle barre di sistema legato al tema scelto. La barra di stato (in alto) cambia subito; la barra di navigazione di Android (in basso) è colorata dal browser a partire dal manifest, per cui esiste un manifest per ogni sfondo di palette e il colore si allinea all'installazione o all'aggiornamento dell'app. Dettagli e limiti in [`PWA.md`](PWA.md).

| Comando | Descrizione |
|---|---|
| `npm run icons` | Rigenera tutte le icone dal logo `public/favicon.svg` (richiede `npm i -D sharp`) |
| `npm run manifests` | Rigenera i manifest per tema in `public/manifests/` dalle palette di `config/themes.ts` |
| `npm run check:manifests` | Verifica che i manifest per tema siano aggiornati |
| `npm run check:pwa` | Controlla manifest di base e per tema, icone con zona sicura misurata e coerenza con lo script di avvio e il motore dei temi (solo Node) |

## SEO e pagine informative

L'applicazione è una SPA: i contenuti destinati al posizionamento sono **pagine HTML statiche** generate al build (`seo/`), con landing e guide in `/it/`, `/en/` e `/fr/`. Strategia, implementazione e checklist post-deploy sono in [`SEO.md`](SEO.md).

- **Testi**: `seo/content.ts`. **Template**: `seo/render.ts`. **Generatore** di pagine, `sitemap.xml` con hreflang e `robots.txt`: `seo/generate.ts`.
- **Rotte e lingue disponibili**: `config/seoRoutes.ts`, usato anche da footer e onboarding. Per aggiungere una guida servono una nuova chiave con il relativo slug in quel file e il testo in `seo/content.ts`; il build fallisce se i due non coincidono.
- **Date di modifica**: dopo ogni modifica sostanziale a un testo va aggiornato il relativo `modified`, che finisce in `<lastmod>` e nei dati strutturati.
- **Verifica**: `npm run build && npm run check:seo` controlla titoli, description, H1, canonical, hreflang, JSON-LD, link interni e pagine orfane.
- **Prima visita**: `OnboardingGate` mostra una schermata di benvenuto (testi `onboarding.welcome.*`) prima dei Termini; è ciò che vedono anche i crawler su `/`.
- **Schermate private**: `noindex` sia da `components/DocumentMeta.tsx` sia da `X-Robots-Tag` in `public/_headers`.

## Test e controlli

| Comando | Verifica | Ambiente |
|---|---|---|
| `npm test` | Unit test (`tests/logic.test.ts`): errori Google, rate limit, validatori, normalizzazione dei dati, importazione ed esportazione, chiave API, attivazione del modello di riserva e coerenza dei testi legali con il suo predefinito, sanificazione CSS | Vitest 4 |
| `npm run check:sw-manifest` | Service worker in ambiente simulato: manifest «rete per prima», richieste da non intercettare, pulizia delle cache | Node |
| `npm run check:imports` | Analisi statica del grafo degli import: cosa entra nel download iniziale e cosa viene caricato in lazy. Non misura i byte, per i quali serve `npm run build` | Node |
| `npm run check:pwa` | Manifest, icone, coerenza con script di avvio e motore dei temi | Node |
| `npm run check:manifests` | Manifest per tema allineati alle palette | Node + esbuild |
| `npm run check:seo` | Pagine statiche generate dal build | Node, dopo `npm run build` |
| `npm run check:sw` | Service worker | Chromium (Playwright) |
| `npm run check:select` | Menu a tendina personalizzato | Chromium (Playwright) |
| `npm run check:status` | Indicatore di elaborazione nell'intestazione | Chromium (Playwright) |
| `npm run check:theme-color` | Colore delle barre di sistema e manifest per tema | Chromium (Playwright) |
| `npm run check:idb` | Livello dati IndexedDB e sincronizzazione fra schede | Chromium (Playwright) |
| `npm run check:sanitize` | Sanificatore HTML contro un corpus di vettori XSS | Chromium (Playwright) |
| `npm run check:react`, `npm run check:ai-task` | Provider React con storage reale, compresa l'attivazione del modello di riserva | Chromium (Playwright) |

Le prove nel browser (`tools/browser-checks/`) coprono ciò che Node non può verificare. Richiedono `npm i -D playwright && npx playwright install chromium` (esbuild è già incluso con Vite) e non fanno parte della build né del deploy.

## Deploy su Cloudflare Pages

Configurazione per `studia.poppi.cc`.

1. **Pages → Create → Connect to Git** e selezione del repository.
2. Impostazioni di build: *Framework preset* `None`, *Build command* `npm run build`, *Build output directory* `dist`.
3. Variabili d'ambiente: nessuna obbligatoria, perché il bundle non contiene chiavi API. La versione di Node (22) è letta da `.node-version`; in alternativa si imposta `NODE_VERSION=22`.
4. **Dominio personalizzato**: progetto → *Custom domains* → *Set up a custom domain* → `studia.poppi.cc`. Se `poppi.cc` è già gestito da Cloudflare, il record `CNAME studia → <progetto>.pages.dev` (proxied) viene creato in automatico; altrimenti va aggiunto nel DNS del provider.
5. **Redirect da `*.pages.dev`** al dominio personalizzato: non è configurabile dal repository e le Redirect Rules della zona `poppi.cc` non coprono il dominio `pages.dev`. In alternativa si possono disattivare le anteprime pubbliche e proteggere le preview con Cloudflare Access. Il `<link rel="canonical">`, già impostato sul dominio personalizzato, limita comunque i contenuti duplicati per i motori di ricerca.
6. **Brotli e HTTP/3**: Cloudflare Pages comprime con Brotli e serve HTTP/2 e HTTP/3 in automatico sui domini proxati. Verifica da dominio → *Speed → Optimization → Protocol Optimization*.
7. **Web Analytics** (facoltativo, senza cookie): progetto → *Metrics → Enable Web Analytics*. Lo snippet viene iniettato dalla piattaforma, senza modifiche al codice. Con lo snippet manuale vanno aggiunti `https://static.cloudflareinsights.com` a `script-src` e `https://cloudflareinsights.com` a `connect-src` in `public/_headers`.

**File di deploy**: `public/_headers` (header, CSP, cache), `public/_redirects` (fallback SPA), `public/service-worker.js`, `public/manifest.json`.

**Dominio**: definito esclusivamente in `config/site.ts` (`SITE_URL`). Da lì vengono generati al build `canonical`, Open Graph, `robots.txt` e `sitemap.xml`.

## Testi legali

> **Nota.** Le traduzioni inglese e francese di Termini di Servizio e Privacy (`legal/content/`) non hanno ricevuto una revisione professionale; si raccomanda la revisione di tutte e tre le versioni prima della pubblicazione.

- Titolare del trattamento (`OWNER_NAME`) ed email di riferimento (`CONTACT_EMAIL`) sono definiti in `config/appConfig.ts`.
- Ogni modifica ai testi richiede l'aggiornamento di `LEGAL_VERSION`, in modo che gli utenti accettino la nuova versione.

## Autore e licenza

StudIA è un progetto di [Nicola Rizzo](https://github.com/rizzonicola) (GitHub: [github.com/rizzonicola](https://github.com/rizzonicola)).

Il codice è distribuito con licenza **[PolyForm Strict License 1.0.0](https://polyformproject.org/licenses/strict/1.0.0)**. In sintesi (riassunto non vincolante: fa fede il testo della licenza), consente l'uso per scopi non commerciali e non concede il diritto di distribuire o modificare il software. È una licenza *source-available*, non una licenza open source nel senso della definizione OSI. Il file [`LICENSE`](../LICENSE) riporta l'avviso di licenza.

Autore e licenza compaiono anche nell'interfaccia: nel footer dell'app da `sm` (640 px) in su, nella voce Impostazioni → Informazioni e Dipendenze (sempre visibile, anche su telefono, dove il footer è compatto), nelle pagine statiche e nei dati strutturati. `config/site.ts` è l'unica fonte dei valori.

Le librerie di terze parti restano sotto le rispettive licenze (elenco in Impostazioni → Informazioni e Dipendenze). Titolare del trattamento dei dati e gestore del sito sono indicati in `config/appConfig.ts`.
