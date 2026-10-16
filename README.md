<p align="center">
  <img src="public/icons/icon-192.png" alt="StudIA Logo" width="96" height="96">
</p>

<h1 align="center">StudIA</h1>

<p align="center">
  AI-powered study notes, quizzes, and concept maps.<br>
  Turn PDFs, photos, and recorded lectures into study material with Google Gemini.
</p>

<p align="center">
  <a href="https://studia.poppi.cc"><strong>Open the app → studia.poppi.cc</strong></a>
</p>

<p align="center">
  <img src="docs/screenshots/desktop.png" alt="StudIA on desktop" width="64%">
  &nbsp;
  <img src="docs/screenshots/mobile.png" alt="StudIA on mobile" width="22%">
</p>

## Features

- **Study Notes** from PDFs, images, audio, and video.
- **Quizzes** with explanations for effective review.
- **Concept Maps** generated from your notes.
- **Folders**, plus full import and export of your study materials.
- **Customizable Themes** with light and dark palettes.
- **Multilingual:** English, Italian, and French.

## Privacy

No account and no backend server: your notes remain strictly in your browser and you use your personal, free API key from [Google AI Studio](https://aistudio.google.com/), stored locally on your device.

## Installation

StudIA is an installable Progressive Web App (PWA): you can install it via Chrome, Edge, Samsung Internet, and Brave, or via Safari on iPhone/iPad using the *Share* menu. Saved notes are fully accessible offline; an internet connection is only needed when generating new AI content.

## Developers

```bash
npm install
npm run dev     # http://localhost:3000
npm test
npm run build   # outputs to dist/
```

Stack: Vite, React, TypeScript, Tailwind CSS, IndexedDB. Technical documentation (deployments, SEO, PWA, themes, AI models): [`docs/SVILUPPO.md`](docs/SVILUPPO.md).

## Author & License

Created by [Nicola Rizzo](https://github.com/rizzonicola). Released under the [PolyForm Strict License 1.0.0](LICENSE): non-commercial use permitted, no distribution or modification rights granted. The codebase is visible (*source-available*), but not open source under the OSI definition.
