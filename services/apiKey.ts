import { t } from '../i18n/core';

/**
 * Nessun controllo di sintassi, lunghezza o regex: la chiave viene accettata così com'è,
 * eliminando solo gli spazi a inizio/fine. Restituisce null se la stringa non è vuota.
 */
export function validateApiKeyFormat(raw: string): string | null {
  return raw.trim() ? null : t('error.apiKeyEmpty');
}

/** Verifica online (facoltativa): chiede a Google l'elenco dei modelli con la chiave indicata. */
export async function verifyApiKey(apiKey: string): Promise<{ ok: boolean; message: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', {
      headers: { 'x-goog-api-key': apiKey.trim() },
      signal: controller.signal,
    });
    if (res.ok) return { ok: true, message: t('verify.ok') };
    if (res.status === 400 || res.status === 401 || res.status === 403) return { ok: false, message: t('verify.rejected') };
    if (res.status === 429) return { ok: false, message: t('verify.rateLimit') };
    return { ok: false, message: t('verify.failed', { status: res.status }) };
  } catch {
    return { ok: false, message: t('verify.network') };
  } finally {
    clearTimeout(timer);
  }
}
