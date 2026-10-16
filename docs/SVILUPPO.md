# StudIA — Developer Guide

Technical project documentation: commands, architecture, storage, security, themes, models, internationalization, testing, and deployment.
Deep dives on PWA and SEO are available in [`PWA.md`](PWA.md) and [`SEO.md`](SEO.md).

**Table of Contents:** [Overview](#overview) · [Commands](#commands) · [Project Structure](#project-structure) · [Browser Storage](#browser-storage) · [Security](#security) · [Themes & Customization](#themes--customization) · [Gemini Models](#gemini-models) · [Languages & Prompts](#languages--prompts) · [PWA](#pwa) · [SEO & Static Pages](#seo--static-pages) · [Tests & Verification](#tests--verification) · [Cloudflare Pages Deployment](#cloudflare-pages-deployment) · [Legal Documents](#legal-documents) · [Author & License](#author--license)

## Overview

| | |
|---|---|
| Website | <https://studia.poppi.cc> |
| Tech Stack | Vite 7, React 19, TypeScript, Tailwind CSS 4, react-router 7, `@google/genai`, IndexedDB (`idb`) |
| Supported Languages | English, Italian, French, plus "System" automatic detection |
| Architecture | 100% client-side application without backend server or account database. The Google AI Studio API key is provided by the user and stored exclusively in the browser |
| License | [PolyForm Strict License 1.0.0](https://polyformproject.org/licenses/strict/1.0.0) |
| Author | [Nicola Rizzo](https://github.com/rizzonicola) |

## Commands

| Command | Description |
|---|---|
| `npm install` | Installs dependencies. `.npmrc` sets `legacy-peer-deps=true` due to `react-graph-vis` peer dependency on React ≤ 17 |
| `npm run dev` | Local development server on <http://localhost:3000> |
| `npm run build` | Production bundle output to `dist/` |
| `npm run preview` | Previews the production build locally |
| `npm run typecheck` | Type-checks the entire TypeScript codebase |
| `npm run typecheck:strict` | Enforces `strict: true` on modules without visual/DOM dependencies (`tsconfig.strict.json`) |
| `npm test` | Runs unit and integration test suite via Vitest (`vitest.config.ts`) |
| `npm run audit:prod` | Audits production dependencies only (`npm audit --omit=dev --audit-level=high`) |

The service worker is registered only in production builds (`npm run build && npm run preview`).

## Project Structure

```
config/      site.ts (domain, author, license), appConfig.ts (constants & storage keys), seoRoutes.ts (SEO static route definitions)
seo/         content.ts (copy), render.ts (HTML rendering), generate.ts (static pages, sitemap, and robots.txt generated at build)
i18n/        core.ts, I18nProvider.tsx, resolve.ts, locales/{it,en,fr}.ts
services/    gemini.ts (lazy-loaded), prompts.ts + prompts/*, errors.ts, rateLimit.ts, uploadCache.ts, validators.ts,
             apiKey.ts, apiKeyStore.ts, fallbackPreference.ts,
             notesDb.ts (IndexedDB) + notesData.ts (pure validation, tree hierarchy, migration)
hooks/       useSettings, useTheme (theme engine), useNotesStore, useAIProcessor
legal/       LegalDocuments.tsx, content/{it,en,fr}.tsx
pages/ components/ utils/
public/      _headers, _redirects, service-worker.js, manifest.json + manifests/ (one per palette background),
             favicon.svg/.ico, icons/, og-image.png
tests/       Vitest test suite (see "Tests & Verification"); vitest.config.ts in root
docs/        SVILUPPO.md, PWA.md, SEO.md, and screenshots/ (README imagery, excluded from build)
tools/       import-graph.mjs, pwa-check.mjs, sw-manifest-check.mjs, seo-check.mjs, generate-icons.mjs,
             generate-manifests.mjs, and browser-checks/ (automated browser checks)
LICENSE      License file (PolyForm Strict License 1.0.0)
```

## Browser Storage

| Storage Engine | Stored Data | Notes |
|---|---|---|
| IndexedDB `studia_db` v1 | `notes`, `folders` | Granular patch writes (one field at a time), resilient parsing against corrupt records, cross-tab broadcast synchronization (`services/notesDb.ts`) |
| localStorage | Preferences, model selection, theme config, UI language, view mode, legal terms acceptance, custom prompts (max 20,000 characters each), API key (if "Remember" is enabled) | Storage keys declared in `config/appConfig.ts` (`STORAGE_KEYS`) |
| sessionStorage | Google Gemini API key, when "Remember key on this device" is turned off | Destroyed on tab closure |
| Cache Storage | Web application assets (service worker) | Retains current and immediately previous build versions (`public/service-worker.js`) |
| Memory | Transient upload file handles on Google servers, temporary camera captures | Never written to disk or storage |

## Security

- **Strict CSP** defined in `public/_headers`: `script-src 'self'`, `connect-src` locked to `generativelanguage.googleapis.com`. `style-src` permits `'unsafe-inline'` for KaTeX math styling, vis-network canvas labels, and React inline style properties.
- **AI-Generated HTML Sanitization**: sanitized via `utils/sanitizeHtml.ts` (DOMParser implementation without third-party dependencies; CSS escapes like `\75rl(` are purged) and sandboxed inside an `<iframe sandbox="">` with an internal restrictive CSP. All three defensive tiers are validated in automated tests via `npm run check:sanitize`.
- **API Key Protection**: excluded from query parameters and error strings (`redactSecrets`); stored optionally in ephemeral `sessionStorage`.
- **Markdown Rendering**: raw HTML tags are strictly ignored (`rehype-raw` is omitted).
- **JSON Schemas**: quizzes and concept maps are strictly validated in `services/validators.ts`.

## Themes & Customization

Configured under Settings → **Appearance**. The theme engine is custom-built without external dependencies: `config/themes.ts`, `utils/color.ts`, `utils/themeEngine.ts`, `hooks/useTheme.tsx`, `components/ThemeSettings.tsx`.

| Area | Available Options |
|---|---|
| Mode | Automatic (follows operating system), light, dark, or schedule-based (switches to dark mode during specified evening hours, including past midnight) |
| Palettes | 7 light and 9 dark palettes. "Classic" light preserves standard styling without variable overrides; default dark "Slate" uses `#20232a`, `#282c35`, and teal accent `#0c9488` |
| Colors | 12 accent colors plus custom color picker, and 5 editable base tokens (background, card surface, foreground text, muted text, border). Generates semantic grayscale ramps, folder tones, hover effects, and button text contrast verified against WCAG AA standards |
| Typography | System font families (zero external font downloads, keeping CSP intact), font scale, letter spacing, line height, reader width, and reader font styles |
| Geometry & Visuals | Corner radius, card sizes, subtle background patterns, animations, high contrast mode, note tint saturation, and dark mode adaptations for imported HTML notes |
| Saved Themes | Save up to 12 custom presets, complete with JSON export, import, and reset features |

**Engine Mechanics.** Tailwind CSS 4 reads CSS variables (`--color-gray-*`, `--radius-*`, etc.). The theme engine assigns these at the `<html>` root, allowing dynamic theme updates without changing React class names. Components use semantic utility tokens `bg-surface`, `bg-accent`, `text-accent-fg`, `text-accent-ink`, `bg-accent-soft`, and `bg-danger` defined in `index.css`. `public/theme-init.js` evaluates and applies the theme before initial React hydration, preventing flashes of unstyled content. All inputs from `localStorage` pass through `sanitizeThemeConfig` to guarantee only valid hexadecimal strings and safe values reach the CSS stylesheet.

**Storage Keys.** `studia_theme_config` (complete theme settings) and `studia_theme_boot` (fast startup snapshot). Legacy key `studia_theme` is automatically migrated and purged.

## Gemini Models

### Primary Model

Defined by `DEFAULT_MODEL` in `config/appConfig.ts` (currently `gemini-3.8-flash`), selectable under Settings → Model.

### Fallback Model

- Defined by `DEFAULT_FALLBACK_MODEL` (currently `gemini-3.7-flash`) with fallback switching enabled by default (`DEFAULT_FALLBACK_ENABLED`).
- If the primary model encounters rate limits (HTTP 429), daily quota exhaustion, or temporary server overload, requests automatically retry using the secondary fallback model with the same API key. This behavior can be disabled under Settings → Model.
- Terms of Service (section 3) and Privacy Policy (sections 3.1 and 3.2) explicitly document this mechanism. Changing model defaults or fallback behaviors requires updating legal texts and incrementing `LEGAL_VERSION` to trigger user re-acceptance. `tests/logic.test.ts` automatically asserts consistency between legal texts and default fallback configurations.
- The fallback model identifier must remain distinct from `DEFAULT_MODEL` to guarantee fallback utility (asserted by tests).

### Preference Persistence

- Default settings are omitted from browser storage: `localStorage` stores only explicit user overrides (`studia_gemini_model`, `studia_fallback_model`, `studia_fallback_enabled`). Updating defaults in application code seamlessly propagates to users who haven't set explicit overrides; clicking "Default" in Settings clears custom selections.
- `studia_fallback_enabled` stores `0` when disabled by the user; `1` represents active. Logic resides in `services/fallbackPreference.ts`.

### `temperature` Parameter

Gemini 3.6+ models ignore the `temperature` parameter without throwing errors; Google has announced that upcoming model generations will reject requests specifying `temperature` with an HTTP 400 response. If needed, the parameter is isolated to a single function in `services/gemini.ts` (`generateNotesFromFiles`).

## Languages & Prompts

- **Language Selection** in localStorage (`studia_language`): `system` (default), `it`, `en`, or `fr`. "System" queries `navigator.languages`, accounts for regional locales, and falls back to English. Dynamically reacts to browser `languagechange` events.
- **Typed Dictionaries** located in `i18n/locales/`, lazy-loaded at runtime. `it.ts` serves as the baseline: `en.ts` and `fr.ts` are strongly typed to match keys identically, preventing missing translations at compile time.
- **Default Prompts** located in `services/prompts/{it,en,fr}.ts`. User-customized prompts override defaults regardless of active language and persist across UI language switches.
- **Generated Content Language** (Settings): *Match Document* (default) or *Match App*. Injects a directive line ("Language: …") into user inputs without modifying system instructions. Quiz and map generation directives reinforce preserving JSON keys across translations.

## PWA

The application is installable across Chrome, Edge, Samsung Internet, Brave, and Safari on iOS/iPadOS (Share → Add to Home Screen). It provides adaptive maskable and monochrome themed icons (Android 13+), offline detection, and matching system bar coloring. The top status bar updates immediately at runtime; the Android navigation bar adopts the theme background matching the installed manifest. See [`PWA.md`](PWA.md) for architecture details.

| Command | Description |
|---|---|
| `npm run icons` | Generates all raster icon sizes from `public/favicon.svg` (requires `sharp`) |
| `npm run manifests` | Regenerates theme-specific manifests in `public/manifests/` from `config/themes.ts` |
| `npm run check:manifests` | Verifies that all theme manifest variants remain synchronized with palettes |
| `npm run check:pwa` | Validates manifest properties, measured icon safe zones, and theme-engine synchronization (Node.js) |

## SEO & Static Pages

StudIA uses prerendered static HTML pages for organic search indexing (`seo/`), providing localized landing pages and guides across `/it/`, `/en/`, and `/fr/`. Full SEO architecture and post-deploy steps are documented in [`SEO.md`](SEO.md).

- **Content**: `seo/content.ts`. **Templates**: `seo/render.ts`. **Generator** for static pages, `sitemap.xml` with hreflang, and `robots.txt`: `seo/generate.ts`.
- **Route Definitions**: `config/seoRoutes.ts`. Adding a guide requires declaring its slug in route configuration and adding localized text in `seo/content.ts`; build fails if declarations diverge.
- **Modification Timestamps**: each content change should update its corresponding `modified` date, which populates `<lastmod>` and structured data entities.
- **Verification**: `npm run build && npm run check:seo` audits titles, meta descriptions, single H1 tags, canonicals, hreflang alternates, JSON-LD, and internal links.
- **Onboarding UX**: `OnboardingGate` displays an indexable welcome screen on the homepage (`/`) for crawlers and first-time visitors before displaying Terms of Service.
- **Private Routes**: protected with `noindex` via `DocumentMeta` and HTTP `X-Robots-Tag` headers in `public/_headers`.

## Tests & Verification

| Command | Scope | Environment |
|---|---|---|
| `npm test` | Unit & integration tests (`tests/logic.test.ts`): API errors, rate limiters, schema validators, tree normalization, import/export, API keys, fallback model activation, legal text alignment, CSS sanitization | Vitest 4 |
| `npm run check:sw-manifest` | Simulated service worker environment: Network-First manifest handling, bypass rules, cache purge logic | Node.js |
| `npm run check:imports` | Static import graph analysis: verifies initial bundle footprint versus lazy-loaded chunks | Node.js |
| `npm run check:pwa` | Validates manifests, icons, and theme engine synchronization | Node.js |
| `npm run check:manifests` | Verifies all theme manifests against palette configurations | Node.js + esbuild |
| `npm run check:seo` | Audits generated static HTML pages, structured data, and links | Node.js (post-build) |
| `npm run check:sw` | Service worker verification | Chromium (Playwright) |
| `npm run check:select` | Custom dropdown accessibility and interaction | Chromium (Playwright) |
| `npm run check:status` | Generation status and error indicator in header | Chromium (Playwright) |
| `npm run check:theme-color` | System bar coloring and manifest variants across all 16 palettes | Chromium (Playwright) |
| `npm run check:idb` | IndexedDB data layer and cross-tab synchronization | Chromium (Playwright) |
| `npm run check:sanitize` | HTML sanitizer tested against XSS vector test suites | Chromium (Playwright) |
| `npm run check:react`, `npm run check:ai-task` | React context providers with real storage engines and fallback triggers | Chromium (Playwright) |

Browser-based integration checks (`tools/browser-checks/`) cover functionality that Node cannot test directly. They require `npm i -D playwright && npx playwright install chromium` and are optional during standard local builds.

## Cloudflare Pages Deployment

Production deployment configuration for `studia.poppi.cc`:

1. **Pages → Create → Connect to Git** and connect the repository.
2. Build configuration: *Framework preset* `None`, *Build command* `npm run build`, *Build output directory* `dist`.
3. Environment variables: no API keys required in build environments. Node runtime version is specified in `.node-version` (`NODE_VERSION=22`).
4. **Custom domain**: project settings → *Custom domains* → *Set up a custom domain* → `studia.poppi.cc`. If `poppi.cc` is managed via Cloudflare DNS, the proxied CNAME record is created automatically.
5. **Redirects from `*.pages.dev`**: configure a redirect from the `*.pages.dev` default domain to the custom domain to prevent duplicate indexing. Alternatively, restrict public preview access via Cloudflare Access. `<link rel="canonical">` points to the custom domain.
6. **Brotli & HTTP/3**: Cloudflare Pages automatically handles Brotli compression alongside HTTP/2 and HTTP/3 on proxied domains (*Speed → Optimization → Protocol Optimization*).
7. **Web Analytics** (optional, cookie-free): *Metrics → Enable Web Analytics*. Injected at edge without modifying code. If using manual scripts, add `https://static.cloudflareinsights.com` to `script-src` and `https://cloudflareinsights.com` to `connect-src` in `public/_headers`.

**Deployment artifacts**: `public/_headers` (HTTP security headers, CSP, caching rules), `public/_redirects` (SPA route fallback), `public/service-worker.js`, `public/manifest.json`.

**Domain Authority**: defined solely in `config/site.ts` (`SITE_URL`), which drives canonical tags, Open Graph meta, `robots.txt`, and `sitemap.xml`.

## Legal Documents

> **Note:** English and French translations of the Terms of Service and Privacy Policy (`legal/content/`) should undergo legal review before official commercial deployment.

- The legal site owner (`OWNER_NAME`) and contact email (`CONTACT_EMAIL`) are declared in `config/appConfig.ts`.
- Any material updates to legal texts require incrementing `LEGAL_VERSION`, which prompts users to review and accept the revised terms upon their next visit.

## Author & License

StudIA is created by [Nicola Rizzo](https://github.com/rizzonicola) (GitHub: [github.com/rizzonicola](https://github.com/rizzonicola)).

The codebase is licensed under the **[PolyForm Strict License 1.0.0](https://polyformproject.org/licenses/strict/1.0.0)**. In summary (non-binding convenience summary: the full text of the license prevails), it permits non-commercial personal and educational use while strictly withholding rights to distribute, sublicense, or modify the software. It is a *source-available* license, not an open source license under the OSI definition. The [`LICENSE`](../LICENSE) file contains the complete legal text.

Author credits and license terms appear in the application footer (`sm` viewport and above), under Settings → About & Dependencies (accessible across all device sizes), in static SEO pages, and in JSON-LD structured data. `config/site.ts` acts as the single source of truth for these values.

Third-party dependencies remain subject to their respective open source licenses (detailed in Settings → About & Dependencies). Data controllers and website operators are defined in `config/appConfig.ts`.
