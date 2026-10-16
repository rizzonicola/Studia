/**
 * Gemini a volte scrive le formule con \( ... \) e \[ ... \] invece di $ ... $ e $$ ... $$.
 * Le converte nella sintassi supportata da remark-math, lasciando intatti i blocchi di codice.
 * Funzione pura (nessuna dipendenza): testabile e caricabile senza KaTeX.
 */
export function normalizeMath(markdown: string): string {
  return markdown
    .split(/(```[\s\S]*?```|`[^`\n]*`)/g)
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part
            .replace(/\\\[([\s\S]+?)\\\]/g, (_m, f: string) => `\n$$\n${f.trim()}\n$$\n`)
            .replace(/\\\(([\s\S]+?)\\\)/g, (_m, f: string) => `$${f.trim()}$`)
    )
    .join('');
}
