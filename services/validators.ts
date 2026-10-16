import type { MapData, MapEdge, MapNode, QuizData, QuizQuestion } from '../types';

/**
 * Validazione difensiva dei JSON provenienti da Gemini o da file importati dall'utente.
 * Non traduce e non modifica lo schema: scarta gli elementi malformati e normalizza i valori.
 * Restituiscono null se il risultato non è utilizzabile.
 */

const MAX_QUESTIONS = 100;
const MAX_OPTIONS = 8;
const MAX_NODES = 300;
const MAX_EDGES = 600;
const MAX_TEXT = 2000;
const MAX_LABEL = 200;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const cleanString = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
};

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function sanitizeQuiz(input: unknown): QuizData | null {
  if (!isRecord(input)) return null;
  const title = cleanString(input.title, MAX_LABEL);
  if (!title || !Array.isArray(input.questions)) return null;

  const questions: QuizQuestion[] = [];
  for (const raw of input.questions.slice(0, MAX_QUESTIONS)) {
    if (!isRecord(raw)) continue;
    const questionText = cleanString(raw.questionText, MAX_TEXT);
    const correct = cleanString(raw.correctAnswer, MAX_TEXT);
    if (!questionText || !correct || !Array.isArray(raw.options)) continue;

    const options: string[] = [];
    for (const o of raw.options) {
      const s = cleanString(o, MAX_TEXT);
      if (s && !options.includes(s)) options.push(s);
      if (options.length >= MAX_OPTIONS) break;
    }
    if (options.length < 2) continue;

    // "correctAnswer" deve coincidere con un'opzione: tolleriamo differenze di maiuscole/spazi
    const correctAnswer =
      options.find((o) => o === correct) ?? options.find((o) => o.toLowerCase() === correct.toLowerCase());
    if (!correctAnswer) continue;

    questions.push({
      questionText,
      options,
      correctAnswer,
      explanation: cleanString(raw.explanation, MAX_TEXT) ?? '',
    });
  }
  return questions.length > 0 ? { title, questions } : null;
}

export function sanitizeMap(input: unknown): MapData | null {
  if (!isRecord(input) || !isRecord(input.graph)) return null;
  const title = cleanString(input.title, MAX_LABEL);
  const { nodes: rawNodes, edges: rawEdges } = input.graph;
  if (!title || !Array.isArray(rawNodes) || !Array.isArray(rawEdges)) return null;

  const nodes: MapNode[] = [];
  const idByKey = new Map<string, number | string>();
  for (const raw of rawNodes.slice(0, MAX_NODES)) {
    if (!isRecord(raw)) continue;
    const id = typeof raw.id === 'number' && Number.isFinite(raw.id) ? raw.id : cleanString(raw.id, 100);
    const label = cleanString(raw.label, MAX_LABEL);
    if (id === null || !label || idByKey.has(String(id))) continue;
    idByKey.set(String(id), id);

    const node: MapNode = { id, label };
    if (typeof raw.color === 'string' && HEX_COLOR.test(raw.color.trim())) node.color = raw.color.trim();
    if (typeof raw.mass === 'number' && Number.isFinite(raw.mass) && raw.mass > 0) node.mass = Math.min(raw.mass, 100);
    nodes.push(node);
  }
  if (nodes.length === 0) return null;

  const edges: MapEdge[] = [];
  for (const raw of rawEdges.slice(0, MAX_EDGES)) {
    if (!isRecord(raw)) continue;
    const from = idByKey.get(String(raw.from));
    const to = idByKey.get(String(raw.to));
    if (from === undefined || to === undefined) continue; // archi verso nodi inesistenti romperebbero il grafo
    const edge: MapEdge = { from, to };
    const label = cleanString(raw.label, MAX_LABEL);
    if (label) edge.label = label;
    edges.push(edge);
  }
  return { title, graph: { nodes, edges } };
}

/** Parsing JSON sicuro: null invece di eccezioni. */
export function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
