# PWA

Technical documentation for StudIA's Progressive Web App: system bar theming, icon specifications, installation flows, offline capabilities, and verification procedures.

**Table of Contents:** [Android Navigation Bar](#android-navigation-bar-color) · [Icons](#icons) · [Status Bar](#status-bar-color) · [Installation](#installation) · [Offline Support](#offline-support) · [Omitted Features](#omitted-features) · [Verification](#verification) · [References](#references)

## Android Navigation Bar Color

The system navigation bar is the bottom bar containing gesture handles or navigation buttons. Its color is controlled exclusively by the **browser**, not the web page.

### Browser Behavior

- Recent versions of Chrome and Brave (Chromium 153+) color the navigation bar using the `theme_color` specified in the web app manifest, which is evaluated **at install time** and, for Chrome WebAPKs, during background update checks (typically once per day upon launch).
- **No runtime Web API can recolor the navigation bar while the app is active.** `<meta name="theme-color">` only tints the top *status bar* at runtime.
- Android does not support dark mode variant manifest properties (`color_scheme_dark` remains experimental and unavailable on mobile Android): a manifest can declare only **one single color**.
- If `theme_color` is omitted from the manifest, browsers apply defaults: black in Chromium 153–155, and the system accent color starting with Chromium 156.
- Chrome versions prior to 152 ignore manifest theme colors for the navigation bar and follow the operating system theme.

### Adopted Architecture

A dedicated web app manifest is provided **for every palette background color**, dynamically linked based on the active in-app theme.

| File | Purpose |
|---|---|
| `public/manifest.json` | Default base manifest: "Classic" light theme, `theme_color` = `background_color` = `#f9fafb` |
| `public/manifests/<color>.json` | 14 theme variants, covering every background color across the 16 themes. Identical to the base manifest except for `theme_color` and `background_color` (matching `id`, `scope`, and icons ensure the browser treats it as the same application) |
| `utils/manifestVariants.ts` | Resolves the closest palette background variant, including for custom user color themes |
| `public/theme-init.js` | Injects the matching theme manifest into `<link rel="manifest">` before initial render from the saved boot snapshot |
| `utils/themeEngine.ts` | Dynamically updates the manifest link on theme change (`applyManifestLink`) |
| `public/service-worker.js` | Serves all manifests via a "Network-First" caching strategy, ensuring browsers fetch updated files immediately |

The color used is always the **palette background** (the color visible at the bottom of the viewport), not card surfaces. For the top status bar, the card surface color is used instead via `<meta name="theme-color">`.

After modifying theme definitions in `config/themes.ts`: run `npm run manifests` to regenerate variant files and `npm run check:manifests` to verify consistency.

### Known Platform Limitations

The navigation bar color corresponds to the palette active **when the browser processes the manifest**: theme changes within the app do not instantaneously restyle the bottom navigation bar.

| Platform | Update Behavior |
|---|---|
| Chrome (installed as WebAPK) | Color synchronizes during the daily background update cycle |
| Brave and browsers creating standard "Home screen shortcuts" | No automatic background update: updating the bar color requires removing the shortcut from the Home screen and reinstalling with the desired theme already selected |

Brave has documented issues regarding cold boot styling: the navigation bar may display an incorrect color on launch until the application is backgrounded and resumed (issues brave-browser #59047 and #59130). In-app guidance is provided under Settings → App.

### Reinstallation Workflow

1. Select your preferred theme under Settings → Appearance **before** installing.
2. Remove any existing app icon from your device's Home screen.
3. Open the website in your browser and reinstall (Settings → App → Install App, or via browser menu).

## Icons

| File | Purpose | Specifications |
|---|---|---|
| `icons/icon-192.png`, `icon-512.png` | `any` | Centered logo occupying 75% of side length, white background |
| `icons/maskable-192.png`, `maskable-512.png` | `maskable` | Full-bleed background with logo constrained **within 30% of side length from center** |
| `icons/monochrome-512.png` | `monochrome` | Black shape on transparent background: tinted dynamically by Android 13+ themed icons |
| `icons/apple-touch-icon.png` | iOS | 180×180 px without transparency (iOS renders transparent areas as solid black) |
| `favicon.svg`, `favicon.ico` | Browser tabs | Vector SVG with dark mode support; ICO provided for legacy crawlers and browsers |

**Maskable Icon Safe Zone.** Android clips maskable icons using various manufacturer shapes (circle, squircle, rounded rectangle) that expose approximately 66% of side length (~33% radius from center). An asset extending to 35.5% radius suffers perimeter clipping and appears disproportionately large. Therefore, all primary logo artwork is strictly kept within a ~30% radius. The official W3C specification suggests a 40% safe radius, which proves insufficient across real-world Android launchers.

**Asset Generation.** All icons are derived deterministically from the vector asset `public/favicon.svg` using `npm run icons` (`tools/generate-icons.mjs`, powered by `sharp`). Automated check `npm run check:pwa` analyzes maskable geometries and fails if shapes exceed safe margins.

**HTTP Caching.** Static icon assets carry a 7-day cache header (`public/_headers`). When updating artwork, rename the file paths to ensure immediate cache invalidation across client devices.

## Status Bar Color

The status bar sits at the top of the mobile screen.

- `index.html` ships with **two** `<meta name="theme-color">` elements (light `#ffffff`, dark `#282c35`, scoped with `media="(prefers-color-scheme: …)"`), used for initial paint before JavaScript execution.
- `public/theme-init.js` (prior to first React render) and `utils/themeEngine.ts` (`applyThemeColorMeta`) **consolidate these into a single element** without `media` attributes, set to the active theme's surface color. Retaining the `media` attribute would cause mobile OSs to override custom app themes in favor of system light/dark mode.
- Both implementations (vanilla script and TypeScript engine) must remain functionally identical, enforced by `npm run check:pwa` and `npm run check:theme-color`.

## Installation

`pwa.ts` captures `beforeinstallprompt` on startup (an early, single-fire event) along with `appinstalled`. The user interface is located in Settings → **App** (`components/AppInstallPanel.tsx`, powered by `hooks/usePwaInstall.ts`):

| Environment | UX Flow |
|---|---|
| Chrome, Edge, Samsung Internet | "Install App" button triggers browser-native install dialog (default mini-infobar is suppressed) |
| Safari on iOS / iPadOS | Guided instructions explaining the Share → "Add to Home Screen" workflow |
| Other mobile browsers | Contextual instructions pointing to browser installation controls |
| Installed state | Displays installation confirmation and explains navigation bar color synchronization ([see above](#android-navigation-bar-color)) |

## Offline Support

Notes, folder structures, and settings reside locally on the device in IndexedDB and localStorage. The service worker serves the app shell and version-hashed static bundles directly from Cache Storage (see header documentation in `public/service-worker.js`). `components/OfflineBanner.tsx` displays an unobtrusive indicator when connectivity drops: AI generation requires network connectivity, whereas all editing, browsing, quizzing, and map exploration operate completely offline.

## Omitted Features

| Candidate Feature | Architectural Decision |
|---|---|
| Native Share Target (`share_target`) | Restrictive platform support: functions only with Chrome WebAPKs on Android; unsupported on Brave (shortcut installs) and iOS Safari. Ingest flows operate reliably via file upload or integrated camera view |
| Manifest `screenshots` (Rich install previews) | Requires managing localized mock screenshots across narrow and wide aspect ratios; omitted to keep manifest payloads minimal |
| iOS Splash Screens (`apple-touch-startup-image`) | Requires generating dozens of device-specific resolution variants; modern iOS generates startup screens automatically from the theme background and app icon |

## Verification

### Automated CLI Checks

Can be executed locally without running a live deployment:

```bash
npm run check:pwa          # Verifies manifests, measured icon safe zones, and theme-engine sync (Node.js)
npm run check:manifests    # Validates all theme manifest variants against config/themes.ts
npm run check:sw-manifest  # Asserts service worker Network-First routing logic for manifests (Node.js)
npm run check:theme-color  # Verifies system bars across all 16 palettes in headless Chromium (Playwright)
npm run check:status       # Tests active generation and error indicator states in header (Playwright)
npm run build && npm run check:seo   # Verifies author, license, and PWA metadata in shell and static outputs
```

### Manual Device Testing

Recommended after production deployments:

| Test Case | Expected Behavior |
|---|---|
| Select theme (Settings → Appearance), delete home screen shortcut, reinstall | App launches with selected theme applied |
| Bottom navigation bar | Matches the background tone of the selected theme palette |
| Runtime theme switching | Navigation bar remains on initial color until reinstalled or background update (browser constraint); status bar updates instantly |
| Status bar (top) | Immediately transitions color to match newly applied theme surface |
| Launcher icon | Artwork fits inside circle mask with margin; themed icon tinting functions on Android 13+ |
| Airplane mode | Application opens instantly, existing notes remain readable, and "Offline" banner appears |
| Active AI generation | Header indicator pulses during generation; tapping displays status and "Cancel" action |

## References

- Chrome status and navigation bar behavior in installed PWAs: <https://github.com/whisper-money/whisper-money/pull/1080>
- Manifest theme synchronization architecture: <https://github.com/hpmine42/enough/pull/123>
- Brave navigation bar issues: <https://github.com/brave/brave-browser/issues/59047> and <https://github.com/brave/brave-browser/issues/59130>
- Maskable icon safe zone guidelines: <https://web.dev/articles/maskable-icon>
- PolyForm Strict License 1.0.0: <https://polyformproject.org/licenses/strict/1.0.0>
