# SEO

Strategia, implementazione e verifiche per il posizionamento di StudIA su motori di ricerca. Dominio di produzione: `https://studia.poppi.cc`.

**Indice:** [Impostazione](#impostazione) · [Limiti della SPA](#limiti-della-spa-e-contromisure) · [Implementazione](#implementazione) · [Dopo il deploy](#dopo-il-deploy) · [Autorevolezza esterna](#autorevolezza-esterna) · [Possibili sviluppi](#possibili-sviluppi) · [Limiti noti](#limiti-noti)

## Impostazione

**Separazione tra prodotto e contenuto.** L'applicazione resta una SPA: un rendering lato server richiederebbe un lavoro rilevante senza benefici per le schermate private. I contenuti destinati al posizionamento sono **pagine HTML statiche prerenderizzate al build**: testo reale, nessun JavaScript, CSS inline (~2 KB) e tema chiaro/scuro coerente con l'app.

**Mercato.** L'italiano è la lingua di riferimento del progetto, seguito da inglese e francese. Ogni lingua ha URL proprie (`/it/`, `/en/`, `/fr/`) con hreflang reciproci e `x-default` → `/en/`, che è la lingua di ripiego dell'app.

**Intenti intercettati**

| Intento | Contenuto |
|---|---|
| Passaggio obbligato | Con il modello «porta la tua chiave» ogni utente deve ottenerne una: guida «chiave API Gemini gratis» (IT, EN, FR). Ricerca informativa con intento chiaro e conversione naturale verso l'app |
| Funzione | Appunti AI da PDF, foto e audio; quiz da appunti; mappe concettuali (IT) |
| Brand | Landing per ciascuna lingua |

**Cluster.** La landing è l'hub e le guide sono i contenuti satellite, collegati da link bidirezionali nel testo, briciole di pane, footer, sezione «Altre guide» e sitemap. Non esistono pagine orfane, come verifica il controllo automatico.

**Affidabilità (E-E-A-T).** Titolare ed email sono visibili, con disclaimer su Google e Gemini; la privacy è descritta con le stesse parole dei testi legali. I testi descrivono il comportamento reale dell'applicazione (limiti, formati, etichette dei pulsanti) e non promettono nulla sui costi di Google, rimandando ai limiti da lui indicati.

## Limiti della SPA e contromisure

| Limite tipico di una SPA | Contromisura |
|---|---|
| L'HTML iniziale contiene solo `<div id="root">` e un avviso sulla necessità di JavaScript: nessun testo indicizzabile | Pagine statiche prerenderizzate al build (`seo/`) |
| `OnboardingGate` copre ogni rotta, tranne `/terms` e `/privacy`, con un modale che contiene i Termini di Servizio: per un crawler la home parlerebbe di clausole legali | Schermata di benvenuto che precede i Termini, con unico `<h1>` e descrizione del prodotto |
| Un `path="*"` che mostra la home con stato 200 genera soft-404 e URL duplicati | `NotFoundPage` con `noindex` per le rotte sconosciute |
| La lingua dipende dal dispositivo, senza URL per lingua né hreflang: Googlebot vede solo l'inglese | URL dedicate `/it/`, `/en/`, `/fr/` con hreflang reciproci |
| Le schermate private non hanno `noindex` e il canonical punta alla home | `noindex` da `DocumentMeta` e da `X-Robots-Tag`; canonical per rotta |
| Assenza di dati strutturati; `lastmod` della sitemap uguale alla data del build | JSON-LD collegato da `@id`; sitemap con `lastmod` reale |
| Dopo l'esecuzione del JavaScript il titolo si riduce a «StudIA» | Titolo descrittivo per la home impostato da `DocumentMeta` |

Contribuiscono inoltre alla qualità tecnica del sito: CSP e HSTS, dominio unico in `config/site.ts`, Open Graph e Twitter Card, PWA, cache immutabile, tema senza lampo di colore e accessibilità (target da 44 px, skip link).

## Implementazione

- **9 pagine statiche**: landing ×3, guida alla chiave API ×3, guide su appunti, quiz e mappe (IT). Testi in `seo/content.ts`, template in `seo/render.ts`, generatore in `seo/generate.ts` (richiamato da `vite.config.ts`).
- **Dati strutturati** collegati da `@id`: Organization, WebSite, WebApplication (home), Article e BreadcrumbList (guide), FAQPage. Sono presenti anche nella shell dell'app (`index.html`).
- **Sitemap** con `lastmod` reale (data di modifica del testo) e alternate hreflang; `robots.txt` generato.
- **Benvenuto alla prima visita** (`components/OnboardingGate.tsx`): prima dei Termini compare una schermata che spiega a cosa serve StudIA (unico `<h1>` della home, quattro punti, pulsante «Inizia», link a `/it/`, `/en/` o `/fr/`). Chi ha già accettato i Termini non la rivede e può riaprirla dal link «Guide» nel footer. Googlebot non conserva localStorage, quindi su `/` vede questa schermata e non i Termini.
- **`DocumentMeta`**: `robots` e `canonical` per rotta. Sono indicizzabili solo `/`, `/terms` e `/privacy`; la home ha un titolo descrittivo.
- **Canonical della shell**: `index.html` non contiene un canonical nell'HTML iniziale. Lo imposta `DocumentMeta`: su `/`, `/terms` e `/privacy` punta alla pagina stessa, mentre sulle rotte private è assente. In questo modo HTML e DOM non divergono per `/terms` e `/privacy`; di conseguenza la home ha il canonical solo via JavaScript. `check:seo` fallisce se il canonical compare nella shell.
- **Favicon quadrata**: `public/favicon.svg` ha un `viewBox` 418×418 con il logo centrato (Google richiede un'icona quadrata). `tools/generate-icons.mjs` (`npm run icons`) legge solo i `<path>` e il `<g transform>`, non il `viewBox`, quindi le icone PNG/ICO restano invariate.
- **Ancore dei link alla guida chiave** dalla home: testo descrittivo («guida alla chiave API Gemini gratuita»). Le traduzioni EN e FR sono da sottoporre a revisione ([vedi checklist](#dopo-il-deploy)).
- **Rotte sconosciute**: `NotFoundPage` con `noindex`, senza duplicare la home.
- **`_headers`**: `X-Robots-Tag: noindex, nofollow` su `/note/*`, `/folder/*`, `/settings`, `/upload` e `/camera`. Si usa l'header e non `Disallow`, perché altrimenti il crawler non leggerebbe il `noindex`.
- **Service worker**: le pagine `/it/`, `/en/` e `/fr/` non vengono intercettate; offline aprirebbero altrimenti l'app su un indirizzo sconosciuto al router.
- **Collegamenti interni dall'app**: link «Guide» nel footer e link alla guida nel passo «chiave API» dell'onboarding, utile anche alla conversione di chi arriva da Google. Su telefono il footer è compatto (*Guide · Termini · Privacy · Info*): «Guide» resta visibile a ogni larghezza, come Termini e Privacy, mentre autore (`rel="author"`) e licenza (`rel="license"`) restano nell'HTML e sono visibili da `sm` in su (su telefono si leggono in Informazioni). Vedi il commento in `components/Footer.tsx`.
- **`<noscript>`** con link alle tre lingue.
- **Controllo automatico** `npm run check:seo`: titoli e description, unico H1, canonical, noindex, hreflang reciproci, JSON-LD valido, link rotti, immagini social, pagine orfane, testo minimo.

## Dopo il deploy

1. Eseguire `npm run typecheck && npm run build && npm run check:seo`. Il build fallisce se testi e rotte non coincidono.
2. Aprire `/it/` e `/it/guide/chiave-api-gemini-gratis/`: devono mostrare la pagina statica (il testo è visibile nel sorgente). Se mostrassero l'app, eliminare `public/_redirects` (vedi il commento nel file).
3. In Search Console, «Controllo URL» su `https://studia.poppi.cc/` → «Prova URL live» → «Visualizza pagina sottoposta a scansione»: deve comparire il benvenuto, non i Termini.
4. **Google Search Console**: proprietà di dominio `poppi.cc` (record TXT su Cloudflare), invio di `https://studia.poppi.cc/sitemap.xml` e «Richiedi indicizzazione» per `/it/`, `/en/`, `/fr/` e la guida alla chiave API.
5. **Bing Webmaster Tools**, con importazione da Search Console.
6. Redirect da `*.pages.dev` al dominio personalizzato per evitare duplicati ([`SVILUPPO.md`](SVILUPPO.md#deploy-su-cloudflare-pages), punto 5).
7. Cloudflare Web Analytics (senza cookie) per la misurazione.
8. Revisione dei testi EN e FR e dei testi legali ([`SVILUPPO.md`](SVILUPPO.md#testi-legali)).

## Autorevolezza esterna

- Link dal dominio radice `poppi.cc` e dai profili del titolare: è la leva più rapida per un sottodominio nuovo.
- Presentazioni mirate (Product Hunt, Show HN, community di studenti, elenchi di strumenti AI), senza acquisto di link.
- Un video «Come ottenere la chiave API Gemini» con link in descrizione.
- Il repository pubblico rimanda al sito, che va mantenuto aggiornato.

## Possibili sviluppi

In ordine di impatto:

1. Traduzione in EN e FR delle guide su appunti, quiz e mappe: testo in `seo/content.ts` e lingua in `PAGE_LANGS` (`config/seoRoutes.ts`).
2. Nuove guide: riassumere un PDF con l'AI, trascrivere una lezione registrata, convertire in testo la foto di una pagina, errori Gemini (429 e quota) e relative soluzioni, preparare un esame con quiz e mappe.
3. Screenshot reali con `alt` nelle guide e immagine social localizzata (`og-image.png` è attualmente in inglese).
4. Dopo 4–6 settimane, analisi di query e CTR in Search Console e rifinitura di titoli e description delle pagine con molte impressioni e pochi clic.

## Limiti noti

- **Lingua della home.** Googlebot scansiona senza lingua preferita, quindi `/` viene indicizzata in inglese. Le ricerche in italiano e francese sono servite da `/it/` e `/fr/`; il benvenuto non le sostituisce.
- **404 HTTP reale non implementato.** Gli URL sconosciuti restano 200 con `noindex` (impostato dall'app). Un vero 404 richiederebbe un `404.html` più rewrite per ogni rotta dell'app, con il rischio di rompere i link diretti.
- **Dati strutturati.** Google ha limitato i risultati arricchiti per le FAQ e rimosso quelli per HowTo: qui servono alla chiarezza semantica, non a ottenere snippet più ampi.
