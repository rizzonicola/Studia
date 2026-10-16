// Sostituto di services/gemini: ogni chiamata resta "in volo" finché la prova non la risolve; rispetta il segnale di annullamento.
const gen = ((window as any).__gen ??= { calls: [] as any[] });
const call = (kind: string, opts: { signal: AbortSignal }) =>
  new Promise((resolve, reject) => {
    gen.calls.push({ kind, resolve, reject });
    opts.signal.addEventListener('abort', () => reject(Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' })));
  });
export const generateQuizData = (opts: { signal: AbortSignal }) => call('quiz', opts);
export const generateMapData = (opts: { signal: AbortSignal }) => call('map', opts);
export const generateNotesFromFiles = () => Promise.reject(new Error('non usata'));
export const processImageToHtml = () => Promise.reject(new Error('non usata'));
