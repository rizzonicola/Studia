import type it from './locales/it';

/** Chiavi di traduzione (derivate dal dizionario italiano, che è il riferimento). */
export type TranslationKey = keyof typeof it;

/** Ogni lingua deve avere ESATTAMENTE le stesse chiavi: chiave mancante o in più = errore di compilazione. */
export type Dictionary = { readonly [K in TranslationKey]: string };

/** Chiavi plurali: "x_one" / "x_other" → base "x". */
export type PluralBase = Extract<TranslationKey, `${string}_other`> extends infer K
  ? K extends `${infer B}_other`
    ? B
    : never
  : never;

export type Params = Record<string, string | number>;
