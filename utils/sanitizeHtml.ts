/**
 * Sanificazione dell'HTML generato dall'AI o importato dall'utente, senza dipendenze esterne (usa DOMParser).
 *
 * Difesa a strati per le note HTML:
 *  1. questa funzione rimuove script, iframe, embed, form, meta refresh, gestori on*, URL javascript:, risorse remote;
 *  2. la nota viene mostrata in un <iframe sandbox=""> (origine opaca, nessuno script, nessun accesso a localStorage/API key);
 *  3. dentro l'iframe viene iniettata una Content-Security-Policy restrittiva (vedi buildSafeSrcDoc).
 */

import { invertHex, isHex } from './color';

const FORBIDDEN_TAGS = new Set([
  'script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'form', 'input', 'button', 'select', 'textarea',
  'link', 'base', 'meta', 'audio', 'video', 'source', 'track', 'portal', 'template', 'noscript',
]);

const URL_ATTRS = new Set(['href', 'src', 'srcset', 'action', 'formaction', 'xlink:href', 'poster', 'background', 'data', 'ping']);

/** Solo ancore interne e data:image sono ammesse; niente http(s) (nessun caricamento remoto / tracking). */
const isSafeUrl = (value: string): boolean => {
  const v = value.trim().toLowerCase().replace(/[\u0000-\u0020]/g, '');
  return v.startsWith('#') || v.startsWith('data:image/png') || v.startsWith('data:image/jpeg') || v.startsWith('data:image/gif') || v.startsWith('data:image/webp');
};

/** Neutralizza le costruzioni CSS che caricano risorse remote o eseguono codice (su testo con le escape già decodificate). */
const stripDangerousCss = (css: string): string =>
  css
    .replace(/@import[^;]*;?/gi, '')
    .replace(/expression\s*\(/gi, '(')
    // image-set("http://...") e src("http://...") caricano risorse SENZA url(): si invalidano (una parentesi sola = valore non valido)
    .replace(/(?:-webkit-)?image-set\s*\(/gi, '(')
    .replace(/(?<![\w-])src\s*\(/gi, '(')
    .replace(/(?:-webkit-)?cross-fade\s*\(/gi, '(')
    .replace(/url\s*\(\s*(['"]?)\s*(?!data:image\/)[^)]*\)/gi, 'none')
    .replace(/behavior\s*:[^;}]*/gi, '')
    .replace(/-moz-binding\s*:[^;}]*/gi, '');

/**
 * Decodifica le escape CSS (`\75 rl(`, `@\69mport`) FUORI da stringhe e commenti. Serve solo al RILEVAMENTO: il browser interpreta
 * `\75rl(` come url( e `@\69mport` come @import, quindi le espressioni regolari che cercano il testo letterale venivano aggirate.
 * Dentro le stringhe le escape sono innocue (non formano funzioni né at-rule) e restano come sono.
 */
export function decodeCssEscapes(css: string): string {
  let out = '';
  let quote: string | null = null;
  let i = 0;
  while (i < css.length) {
    const ch = css[i];
    if (quote) {
      out += ch;
      if (ch === '\\' && i + 1 < css.length) {
        out += css[i + 1];
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i++;
      continue;
    }
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      const stop = end === -1 ? css.length : end + 2;
      out += css.slice(i, stop);
      i = stop;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      i++;
      continue;
    }
    if (ch === '\\') {
      const hex = /^\\([0-9a-fA-F]{1,6})[ \t\r\n\f]?/.exec(css.slice(i, i + 9));
      if (hex) {
        const cp = parseInt(hex[1], 16);
        out += cp === 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff) ? '\ufffd' : String.fromCodePoint(cp);
        i += hex[0].length;
        continue;
      }
      if (i + 1 < css.length) {
        out += css[i + 1];
        i += 2;
        continue;
      }
    }
    out += ch;
    i++;
  }
  return out;
}

/**
 * Ripulisce un blocco CSS. Il testo originale resta intatto se non contiene nulla di pericoloso (anche quando usa escape legittime,
 * come i selettori `.md\:flex`); se invece il pericolo compare solo dopo aver decodificato le escape, si restituisce la versione ripulita
 * del testo decodificato.
 */
export function sanitizeCss(css: string): string {
  const direct = stripDangerousCss(css);
  if (!css.includes('\\')) return direct;
  const decoded = decodeCssEscapes(css);
  const decodedClean = stripDangerousCss(decoded);
  return decodedClean !== decoded ? decodedClean : direct;
}

export function sanitizeHtml(html: string): string {
  if (typeof DOMParser === 'undefined') return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');

  // Il <style> interno è ammesso (il prompt lo richiede) ma ripulito
  doc.querySelectorAll('style').forEach((style) => {
    style.textContent = sanitizeCss(style.textContent ?? '');
  });

  const all = Array.from(doc.querySelectorAll('*'));
  for (const el of all) {
    const tag = el.tagName.toLowerCase();
    if (FORBIDDEN_TAGS.has(tag)) {
      el.remove();
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
      } else if (URL_ATTRS.has(name) && !isSafeUrl(attr.value)) {
        el.removeAttribute(attr.name);
      } else if (name === 'style') {
        el.setAttribute('style', sanitizeCss(attr.value));
      }
    }
  }
  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
}

/**
 * Documento da mettere in `srcDoc`: HTML sanificato + CSP interna (nessuno script, nessuna rete, solo stili e immagini data:).
 * La CSP viene inserita come primo elemento dell'<head>.
 */
export function buildSafeSrcDoc(html: string, options?: { darkSurface?: string }): string {
  const clean = sanitizeHtml(html);
  const csp =
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:; font-src data:;">';
  // Tema scuro: le note HTML hanno i propri colori (quasi sempre chiari). Si invertono luminosità e si ruota la tinta di 180°
  // (i colori restano riconoscibili), le immagini vengono ri-invertite per tornare naturali e lo sfondo è calcolato
  // in modo da risultare uguale a quello delle schede del tema. Il colore passa da invertHex: è sempre un esadecimale valido.
  const adapt =
    options?.darkSurface && isHex(options.darkSurface)
      ? `<style>html{background:${invertHex(options.darkSurface)};filter:invert(1) hue-rotate(180deg)}img,svg{filter:invert(1) hue-rotate(180deg)}</style>`
      : '';
  return clean.replace(/<head[^>]*>/i, (m) => `${m}${csp}${adapt}`);
}
