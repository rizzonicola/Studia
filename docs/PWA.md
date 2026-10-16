# PWA

Funzionamento della PWA di StudIA: colore delle barre di sistema, icone, installazione, modalità offline e verifiche.

**Indice:** [Barra di navigazione](#colore-della-barra-di-navigazione-di-android) · [Icone](#icone) · [Barra di stato](#colore-della-barra-di-stato) · [Installazione](#installazione) · [Offline](#modalità-offline) · [Funzionalità non incluse](#funzionalità-non-incluse) · [Verifica](#verifica) · [Riferimenti](#riferimenti)

## Colore della barra di navigazione di Android

La barra di navigazione è la striscia di sistema sotto l'app, quella con la maniglia dei gesti. Il suo colore è deciso dal **browser**, non dalla pagina.

### Comportamento dei browser

- Chrome e Brave recenti (da Chromium 153) la dipingono con il `theme_color` del manifest, letto **al momento dell'installazione** e, per le app installate da Chrome come WebAPK, durante il controllo degli aggiornamenti (circa una volta al giorno, all'avvio).
- **Nessuna API web modifica il colore mentre l'app è aperta.** `<meta name="theme-color">` colora solo la barra di *stato* (in alto) e si aggiorna a runtime.
- Android non supporta varianti scure nel manifest (`color_scheme_dark` è sperimentale e non disponibile su Android): il manifest dichiara **un solo colore**.
- Se `theme_color` manca, il browser sceglie autonomamente: nero con Chromium 153–155, colore del tema del telefono dalla 156.
- Chrome fino alla versione 152 ignora il manifest e segue il tema del telefono.

### Soluzione adottata

Un manifest **per ogni colore di sfondo delle palette**, selezionato in base al tema in uso nell'app.

| File | Descrizione |
|---|---|
| `public/manifest.json` | Manifest di base: tema chiaro «Classico», `theme_color` = `background_color` = `#f9fafb` |
| `public/manifests/<colore>.json` | 14 varianti, una per ciascun altro sfondo delle 16 palette. Identiche al manifest di base salvo `theme_color` e `background_color`: stessi `id`, `scope` e icone, quindi per il browser è sempre la stessa app |
| `utils/manifestVariants.ts` | Sceglie la variante con lo sfondo più vicino al tema in uso, anche per i colori personalizzati |
| `public/theme-init.js` | Prima del primo render collega al `<link rel="manifest">` il manifest del tema, a partire dall'istantanea salvata |
| `utils/themeEngine.ts` | Esegue la stessa operazione a ogni cambio di tema (`applyManifestLink`) |
| `public/service-worker.js` | Serve tutti i manifest con strategia «rete per prima», così il browser vede subito il file aggiornato |

Il colore è sempre lo **sfondo della palette** (quello visibile in fondo alla pagina), non la superficie delle schede. Per la barra di stato in alto si usa invece la superficie (il colore dell'intestazione), tramite `<meta name="theme-color">`.

Dopo ogni modifica alle palette in `config/themes.ts`: `npm run manifests` rigenera i file e `npm run check:manifests` ne verifica l'allineamento.

### Limiti noti

Il colore della barra corrisponde alla palette attiva **nel momento in cui il browser legge il manifest**: un cambio di tema non si riflette subito sulla barra.

| Browser | Comportamento |
|---|---|
| Chrome (app installata come WebAPK) | Il colore si allinea con il controllo di aggiornamento, in circa un giorno |
| Brave e altri browser che installano come «scorciatoia» sulla schermata Home | Nessun aggiornamento automatico: per cambiare colore l'app va rimossa dalla schermata Home e installata di nuovo con il tema già scelto |

Per Brave sono aperte segnalazioni specifiche su questa barra: il colore risulta errato all'avvio a freddo e si corregge dopo aver mandato l'app in background e richiamata (issue brave-browser #59047 e #59130). Impostazioni → App riporta le stesse informazioni all'utente.

### Procedura di reinstallazione

1. Selezionare il tema (Impostazioni → Aspetto) **prima** dell'installazione.
2. Rimuovere l'app dalla schermata Home.
3. Aprire il sito dal browser e installare di nuovo l'app (Impostazioni → App → Installa app, oppure dal menu del browser).

## Icone

| File | Uso | Note |
|---|---|---|
| `icons/icon-192.png`, `icon-512.png` | `any` | Logo largo il 75 % del lato, su sfondo bianco |
| `icons/maskable-192.png`, `maskable-512.png` | `maskable` | Sfondo a tutto campo, logo **entro il 30 % del lato dal centro** |
| `icons/monochrome-512.png` | `monochrome` | Forma nera su trasparente: Android 13+ la colora con il tema |
| `icons/apple-touch-icon.png` | iOS | 180 px, senza trasparenza (iOS riempirebbe di nero le aree trasparenti) |
| `favicon.svg`, `favicon.ico` | Scheda del browser | L'SVG segue il tema scuro; l'ICO è destinata a browser datati e crawler |

**Zona sicura delle maskable.** Android ritaglia l'icona con una maschera (cerchio, squircle, …) che lascia visibile circa il 66 % del lato, cioè un cerchio di raggio ~33 % dal centro. Un logo che si estende fino al 35,5 % verrebbe tagliato alle estremità e l'icona apparirebbe ingrandita. Per questo tutto il logo deve rientrare nel ~30 % del lato dal centro. La specifica W3C indica una zona sicura più ampia (raggio 40 % del lato), ma non è sufficiente: il cerchio effettivamente visualizzato da Android è più stretto.

**Rigenerazione.** Tutte le icone derivano dal logo vettoriale `public/favicon.svg` con `npm run icons` (`tools/generate-icons.mjs`, richiede `npm i -D sharp`). `npm run check:pwa` misura le maskable e fallisce se il logo esce dalla zona sicura.

**Cache.** Le icone hanno una cache di 7 giorni (`public/_headers`): se il disegno cambia, conviene assegnare ai file un nome nuovo, altrimenti il browser continua a servire la copia precedente.

## Colore della barra di stato

La barra di stato è quella in alto.

- `index.html` contiene **due** `<meta name="theme-color">` (chiaro `#ffffff`, scuro `#282c35`, con `media="(prefers-color-scheme: …)"`), usati solo per il primo disegno in base al tema del dispositivo.
- `public/theme-init.js` (prima del primo render) e poi `utils/themeEngine.ts` (`applyThemeColorMeta`) le **uniscono in un unico tag** senza `media`, con il colore della superficie del tema scelto. Con l'attributo `media` il browser userebbe sempre il tema del dispositivo, ignorando quello dell'app.
- Le due implementazioni (JavaScript semplice e TypeScript) devono restare equivalenti: lo verificano `npm run check:pwa` e `npm run check:theme-color`.

## Installazione

`pwa.ts` ascolta `beforeinstallprompt` fin dall'avvio (l'evento scatta una sola volta e in anticipo) e `appinstalled`. L'interfaccia è in Impostazioni → **App** (`components/AppInstallPanel.tsx`, hook `hooks/usePwaInstall.ts`):

| Contesto | Comportamento |
|---|---|
| Chrome, Edge, Samsung Internet | Pulsante «Installa app»; la finestra di conferma è mostrata dal browser (il banner automatico è disattivato) |
| Safari su iPhone e iPad | Nessuna finestra di installazione: viene spiegato il percorso Condividi → «Aggiungi alla schermata Home» |
| Altri browser | Indicazioni sul menu del browser |
| App già installata | Messaggio di stato e spiegazione di quando la barra di navigazione assume il colore del tema ([vedi sopra](#colore-della-barra-di-navigazione-di-android)) |

## Modalità offline

Note, cartelle e impostazioni risiedono sul dispositivo. Il service worker serve la shell e i file con hash dalla cache (dettagli nell'intestazione di `public/service-worker.js`). `components/OfflineBanner.tsx` mostra una striscia sotto l'intestazione quando il browser è offline: la generazione con l'AI richiede la rete, tutto il resto no.

## Funzionalità non incluse

| Funzionalità | Motivo |
|---|---|
| «Condividi con StudIA» da altre app (`share_target`) | Funziona solo con le app installate da Chrome come WebAPK su Android; non con Brave (che installa come scorciatoia) né su iPhone. I file si caricano da «Carica» o dalla fotocamera |
| `screenshots` nel manifest (installazione «ricca» su Android e desktop) | Richiedono immagini dell'app con dati di esempio: due file (uno stretto, uno largo) in `public/screenshots/`, dichiarati con `form_factor: "narrow"` e `"wide"` in tutti i manifest (`npm run manifests` li deriva da quello di base) |
| Schermate di avvio iOS (`apple-touch-startup-image`) | Richiedono decine di dimensioni; iOS genera già una schermata dal colore di sfondo e dall'icona |

## Verifica

### Controlli automatici

Non richiedono un deploy.

```bash
npm run check:pwa          # manifest, icone (zona sicura misurata), manifest per tema, coerenza con script e motore dei temi (solo Node)
npm run check:manifests    # i manifest per tema corrispondono alle palette (richiede esbuild, già incluso)
npm run check:sw-manifest  # service worker: manifest «rete per prima» (solo Node)
npm run check:theme-color  # barra di stato e manifest per ciascuna delle 16 palette (Chromium reale, Playwright)
npm run check:status       # indicatore di elaborazione o errore nell'intestazione (Chromium reale)
npm run build && npm run check:seo   # include autore e licenza nella shell e nelle pagine statiche
```

### Prove manuali su telefono

Da eseguire dopo il deploy.

| Prova | Esito atteso |
|---|---|
| Scegliere il tema (Impostazioni → Aspetto), rimuovere l'app dalla schermata Home e reinstallarla | L'app si installa con il tema selezionato |
| Barra in basso | Colore di sfondo del tema scelto. Se il colore risulta corretto solo dopo aver mandato l'app in background e richiamata, e non all'avvio a freddo, si tratta del comportamento segnalato per Brave |
| Cambio di tema con l'app installata | La barra in basso **non** cambia subito (limite del browser); si aggiorna dopo la reinstallazione o, con Chrome, dopo l'aggiornamento automatico |
| Barra di stato (in alto) | Cambia colore immediatamente al cambio di tema |
| Icona nel launcher | Il logo sta interamente nel cerchio con un po' di margine; su Android 13+ è disponibile anche «Icone a tema» |
| Modalità aereo | L'app si apre, gli appunti sono leggibili e compare la striscia «Sei offline» |
| Elaborazione | All'avvio di una generazione compare l'indicatore accanto alle Impostazioni; un tocco apre i dettagli e «Annulla» |

## Riferimenti

- Comportamento di Chrome su barra di stato e barra di navigazione delle PWA installate: <https://github.com/whisper-money/whisper-money/pull/1080>
- Approccio analogo, con un manifest per tema che si allinea dopo l'aggiornamento o la reinstallazione: <https://github.com/hpmine42/enough/pull/123>
- Segnalazioni su Brave: <https://github.com/brave/brave-browser/issues/59047> e <https://github.com/brave/brave-browser/issues/59130>
- Icone maskable e zona sicura: <https://web.dev/articles/maskable-icon>
- PolyForm Strict License 1.0.0: <https://polyformproject.org/licenses/strict/1.0.0>
