/**
 * Registro di moduli caricati con `import()`: tiene i moduli già risolti (lettura SINCRONA con `peek`) e una sola promessa per chiave
 * finché il caricamento è in corso (identità stabile: serve a `use()` di React, che non deve ricevere una promessa nuova a ogni render).
 *
 * Perché esiste: `lazy()` sospende SEMPRE, anche quando il modulo è già in memoria, e React tiene a schermo un fallback appena mostrato
 * per almeno ~300 ms. Leggendo prima il modulo risolto si evita del tutto la sospensione (vedi legal/LegalDocuments.tsx).
 * Se il caricamento fallisce la promessa viene scartata: il tentativo successivo riparte da capo (niente errore "incollato").
 */
export interface ModuleRegistry<K extends string, M> {
  /** Il modulo, se è già stato caricato; altrimenti undefined. Mai asincrono. */
  peek(key: K): M | undefined;
  /** Avvia il caricamento (una volta sola) e restituisce la stessa promessa finché è in corso. */
  load(key: K): Promise<M>;
}

export function createModuleRegistry<K extends string, M>(loaders: Record<K, () => Promise<M>>): ModuleRegistry<K, M> {
  const resolved = new Map<K, M>();
  const pending = new Map<K, Promise<M>>();
  return {
    peek: (key) => resolved.get(key),
    load(key) {
      const ready = resolved.get(key);
      if (ready !== undefined) return Promise.resolve(ready);
      let promise = pending.get(key);
      if (!promise) {
        promise = loaders[key]().then(
          (loaded) => {
            resolved.set(key, loaded);
            pending.delete(key);
            return loaded;
          },
          (error: unknown) => {
            pending.delete(key);
            throw error;
          }
        );
        pending.set(key, promise);
      }
      return promise;
    },
  };
}
