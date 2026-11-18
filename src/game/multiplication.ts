import { type Rng, shuffle } from './rng';
import type { Question, Side } from './types';

export const TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/**
 * Posibles resultados equivocados "con sentido" para a × b:
 * múltiplos vecinos, desfases de 10, ±1 (solo cuando no es evidente) y cifras invertidas.
 * Todos son cercanos al resultado correcto.
 */
function wrongCandidates(a: number, b: number): Map<number, number> {
  const c = a * b;
  const maxDiff = Math.max(2 * a + 1, 10);
  const out = new Map<number, number>();
  const add = (value: number, weight: number) => {
    if (!Number.isInteger(value) || value <= 0 || value === c) return;
    if (Math.abs(value - c) > maxDiff) return;
    out.set(value, (out.get(value) ?? 0) + weight);
  };

  add(a * (b - 1), 4);
  add(a * (b + 1), 4);
  add(a * (b - 2), 1.5);
  add(a * (b + 2), 1.5);
  add(c + 10, 1);
  add(c - 10, 1);
  // ±1 solo si no delata la respuesta (en las tablas pares/5/10 serían obvias).
  if (![2, 4, 5, 6, 8, 10].includes(a)) {
    add(c + 1, 2);
    add(c - 1, 2);
  }
  // Cifras invertidas (24 ↔ 42, 21 ↔ 12): error clásico a esta edad.
  if (c >= 10 && c < 100) {
    const reversed = Number(String(c).split('').reverse().join(''));
    add(reversed, 1.5);
  }
  return out;
}

export function generateWrongAnswer(a: number, b: number, rng: Rng): number {
  const c = a * b;
  const pool = wrongCandidates(a, b);
  if (pool.size === 0) return c + a; // nunca debería ocurrir; red de seguridad
  let total = 0;
  pool.forEach((w) => (total += w));
  let r = rng() * total;
  for (const [value, weight] of pool) {
    r -= weight;
    if (r <= 0) return value;
  }
  return pool.keys().next().value as number;
}

export function buildQuestion(a: number, b: number, rng: Rng): Question {
  const correct = a * b;
  const wrong = generateWrongAnswer(a, b, rng);
  const correctSide: Side = rng() < 0.5 ? -1 : 1;
  const options: [number, number] = correctSide === -1 ? [correct, wrong] : [wrong, correct];
  return { a, b, correct, wrong, options, correctSide };
}

/** Diez multiplicaciones (×1 … ×10), una sola vez cada una y en orden aleatorio. */
export function buildLevelQuestions(table: number, rng: Rng): Question[] {
  const factors = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], rng);
  return factors.map((b) => buildQuestion(table, b, rng));
}

/** Comprueba que la pregunta es coherente: exactamente una opción correcta, sin repetidas. */
export function validateQuestion(q: Question): boolean {
  const [l, r] = q.options;
  if (q.correct !== q.a * q.b) return false;
  if (l === r) return false;
  if (q.options.filter((o) => o === q.a * q.b).length !== 1) return false;
  if (q.options[q.correctSide === -1 ? 0 : 1] !== q.correct) return false;
  if (q.wrong <= 0) return false;
  return true;
}
