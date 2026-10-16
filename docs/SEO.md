# SEO

Search engine optimization strategy, technical implementation, and verification for StudIA. Production domain: `https://studia.poppi.cc`.

**Table of Contents:** [Strategy & Approach](#strategy--approach) · [SPA Limitations & Countermeasures](#spa-limitations--countermeasures) · [Implementation](#implementation) · [Post-Deployment Checklist](#post-deployment-checklist) · [External Authority](#external-authority) · [Future Improvements](#future-improvements) · [Known Limitations](#known-limitations)

## Strategy & Approach

**Separation of product and content.** The application remains a Single Page Application (SPA): server-side rendering (SSR) would introduce substantial complexity without providing benefits to private operational screens. Public content meant for search indexation consists of **prerendered static HTML pages generated during build**: real text, zero client-side JavaScript, minimal inline CSS (~2 KB), and consistent light/dark theme styling matching the app.

**Target markets.** Italian is the primary reference language for the project, followed by English and French. Each language has dedicated URLs (`/it/`, `/en/`, `/fr/`) configured with reciprocal `hreflang` tags and `x-default` pointing to `/en/`, which serves as the global fallback language.

**Target search intents**

| Intent | Content Strategy |
|---|---|
| Mandatory step | Under the "bring your own API key" model, every user must obtain a key: guide "Free Gemini API Key" (available in IT, EN, FR). High-intent informational search with natural conversion to the app |
| Features | AI notes from PDFs, photos, and audio; quizzes from notes; concept maps (IT) |
| Brand | Dedicated landing page for each supported language |

**Content clusters.** The language landing page acts as the hub, with guides serving as satellite articles connected via bidirectional contextual links, breadcrumbs, footers, a "Related Guides" section, and the XML sitemap. No orphan pages exist, as verified by automated checks.

**Credibility & E-E-A-T.** Site owner identity and contact email are visible, accompanied by clear disclaimers regarding Google and Gemini. Privacy practices are documented using the exact same wording as the official legal policies. Technical limits, supported file formats, and UI labels reflect reality accurately without making speculative claims about Google's pricing, deferring instead to official quota guidelines.

## SPA Limitations & Countermeasures

| Classic SPA Issue | Implemented Countermeasure |
|---|---|
| Initial HTML only contains `<div id="root">` and a `<noscript>` warning: no indexable text | Prerendered static HTML pages generated at build time (`seo/`) |
| `OnboardingGate` covers all routes (except `/terms` and `/privacy`) with a modal for Terms of Service: search crawlers would see only legal terms on the homepage | Welcome screen preceding the Terms with a unique `<h1>` and concise product overview |
| A fallback `path="*"` serving the homepage with HTTP 200 causes soft-404s and duplicate URLs | Dedicated `NotFoundPage` with `noindex` for unknown routes |
| Language depends on browser headers without distinct URLs or hreflang: Googlebot indexes only English | Dedicated language URLs (`/it/`, `/en/`, `/fr/`) with reciprocal `hreflang` alternates |
| Private app screens lack `noindex` and canonical tags mistakenly point to root | `noindex` injected via `DocumentMeta` and HTTP `X-Robots-Tag`; route-specific canonical tags |
| Missing structured data; sitemap `lastmod` set uniformly to build timestamp | Linked Schema.org JSON-LD entities via `@id`; sitemap populated with authentic `lastmod` modification dates |
| Post-hydration page title collapses to generic "StudIA" | Contextual, descriptive homepage title injected via `DocumentMeta` |

Additional technical quality factors: strict CSP and HSTS headers, single source of truth in `config/site.ts`, Open Graph and Twitter Card tags, PWA support, immutable asset caching, flash-free theme rendering, and accessibility standards (44 px touch targets, skip links).

## Implementation

- **9 static pages**: 3 language landings, 3 API key setup guides, and 3 feature guides for notes, quizzes, and maps (IT). Content lives in `seo/content.ts`, templates in `seo/render.ts`, and the generator in `seo/generate.ts` (triggered during `vite build`).
- **Structured data** linked via `@id`: `Organization`, `WebSite`, `WebApplication` (homepage), `Article`, `BreadcrumbList` (guides), and `FAQPage`. Present in both prerendered pages and the SPA shell (`index.html`).
- **XML Sitemap** with real `lastmod` dates (tracking actual text update timestamps) and reciprocal `hreflang` tags; auto-generated `robots.txt`.
- **First-time welcome screen** (`components/OnboardingGate.tsx`): before presenting the Terms of Service, a screen explains StudIA's core value proposition (the homepage's unique `<h1>`, four bullet points, a "Get Started" button, and links to `/it/`, `/en/`, or `/fr/`). Returning users who accepted the Terms bypass this screen and can access guides via the footer link. Googlebot does not persist `localStorage`, ensuring it indexes this descriptive welcome screen rather than legal clauses.
- **`DocumentMeta`**: dynamically sets `robots` and `canonical` per route. Only `/`, `/terms`, and `/privacy` are indexable.
- **SPA shell canonical handling**: `index.html` omits a static canonical link. `DocumentMeta` injects it dynamically: pointing to itself on `/`, `/terms`, and `/privacy`, and omitting it on private routes. This prevents discrepancies between initial HTML and DOM on legal pages. Automated check `npm run check:seo` fails if a hardcoded canonical tag is placed into the shell.
- **Square favicon**: `public/favicon.svg` uses a 418×418 `viewBox` with a centered icon (Google requires a square favicon). The icon generator `tools/generate-icons.mjs` (`npm run icons`) parses only `<path>` and `<g transform>` tags, keeping PNG and ICO files consistent.
- **Descriptive anchor text**: links to the API key guide use clear anchor copy.
- **Unknown routes**: served with `NotFoundPage` including `noindex`, preventing homepage duplicate indexing.
- **`_headers`**: sets `X-Robots-Tag: noindex, nofollow` on `/note/*`, `/folder/*`, `/settings`, `/upload`, and `/camera`. HTTP headers are used instead of `robots.txt` Disallow directives so search bots can process the `noindex` directive properly.
- **Service worker routing**: static pages under `/it/`, `/en/`, and `/fr/` bypass the service worker cache-first shell routing, ensuring fresh content from network.
- **Internal application links**: "Guides" link in the footer and setup links within the onboarding wizard assist user navigation and search discoverability. On mobile screens, the footer remains compact (*Guides · Terms · Privacy · Info*): "Guides" remains always visible across all viewports, while author (`rel="author"`) and license (`rel="license"`) attributes remain present in the DOM and visible from `sm` breakpoint upwards.
- **`<noscript>` fallback** providing direct links to all three language landing pages.
- **Automated verification** via `npm run check:seo`: verifies titles, descriptions, single H1 presence, canonicals, noindex rules, reciprocal hreflangs, valid JSON-LD, broken internal links, social preview images, orphan pages, and minimum word count.

## Post-Deployment Checklist

1. Run `npm run typecheck && npm run build && npm run check:seo`. The build fails automatically if routes and content mappings diverge.
2. Open `/it/` and `/it/guide/chiave-api-gemini-gratis/`: confirm that static HTML is returned (inspect page source). If the SPA shell is loaded instead, inspect or remove `public/_redirects` (refer to comments in the file).
3. In Google Search Console, inspect `https://studia.poppi.cc/` → "Test Live URL" → "View Tested Page": verify that the welcome screen is parsed, not the legal terms modal.
4. **Google Search Console**: configure domain property `poppi.cc` (DNS TXT record on Cloudflare), submit `https://studia.poppi.cc/sitemap.xml`, and request indexing for `/it/`, `/en/`, `/fr/`, and the API key guides.
5. **Bing Webmaster Tools**: import configuration directly from Google Search Console.
6. Configure redirects from `*.pages.dev` to the primary custom domain to prevent canonical cannibalization ([`SVILUPPO.md`](SVILUPPO.md#deploy-to-cloudflare-pages), step 5).
7. Enable cookie-free Cloudflare Web Analytics for privacy-preserving telemetry.
8. Proofread EN and FR content and legal notices ([`SVILUPPO.md`](SVILUPPO.md#legal-documents)).

## External Authority

- Contextual links from the apex domain `poppi.cc` and developer portfolio profiles establish fast initial authority for a new subdomain.
- Targeted community announcements (Product Hunt, Show HN, student discussion forums, AI tool directories) without artificial backlink schemes.
- Tutorial video covering "How to get a Google Gemini API Key" linking back in description.
- Keep the public repository README and documentation synchronized with production.

## Future Improvements

Prioritized by organic impact:

1. Translate note-taking, quiz, and concept map guides to English and French: configure content in `seo/content.ts` and declare language codes in `PAGE_LANGS` (`config/seoRoutes.ts`).
2. Publish additional student-centric guides: summarizing long PDFs with AI, lecture transcription workflows, OCR text extraction from textbook photos, troubleshooting Gemini rate limits (HTTP 429 and quotas), and exam preparation strategies.
3. Add illustrated step-by-step screenshots with descriptive `alt` tags and localized social preview images (`og-image.png` is currently English).
4. After 4–6 weeks, review query impressions and CTR within Google Search Console to refine meta titles and descriptions for high-impression, low-CTR queries.

## Known Limitations

- **Root URL language indexing.** Googlebot crawls without language preference headers, resulting in `/` being indexed in English. Italian and French organic searches are targeted by `/it/` and `/fr/`; the onboarding screen does not replace localized landing pages.
- **Simulated 404 responses.** Unknown SPA client URLs return HTTP 200 with `noindex` handled in React. Returning a native HTTP 404 would require a custom `404.html` paired with rewrite rules for every valid client route, risking broken deep links.
- **Rich snippet availability.** Google has deprecated HowTo rich results and restricted FAQ rich snippets to select authority domains; structured data here serves semantic clarity rather than guaranteed visual enhancements in SERPs.
