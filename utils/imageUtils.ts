import { MAX_IMAGE_SIDE } from '../config/appConfig';

/**
 * Ridimensiona e comprime un'immagine (JPEG) prima di inviarla a Gemini e di salvarla.
 *  - lato massimo MAX_IMAGE_SIDE (2000 px): una foto da 12 MP passa da ~5 MB a ~300-500 kB;
 *  - usa un object URL (non un dataURL intermedio da milioni di caratteri) e lo libera SEMPRE;
 *  - rifiuta con un Error se il browser non riesce a decodificare il file (es. HEIC su Chrome/Firefox).
 */
export function compressImageToDataUrl(file: File, maxSide = MAX_IMAGE_SIDE, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    const cleanup = () => {
      img.onload = null;
      img.onerror = null;
      URL.revokeObjectURL(url);
    };

    img.onload = () => {
      try {
        const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        const width = Math.max(1, Math.round(img.naturalWidth * scale));
        const height = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas not available');
        // Sfondo bianco: i PNG trasparenti diventerebbero neri in JPEG
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        // Libera subito la memoria del canvas
        canvas.width = 0;
        canvas.height = 0;
        cleanup();
        resolve(dataUrl);
      } catch (err) {
        cleanup();
        reject(err instanceof Error ? err : new Error('Image processing failed'));
      }
    };
    img.onerror = () => {
      cleanup();
      reject(new Error('Image decode failed'));
    };
    img.src = url;
  });
}
