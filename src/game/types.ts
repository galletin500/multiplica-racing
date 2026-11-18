/** -1 = izquierda, 1 = derecha */
export type Side = -1 | 1;

export interface Question {
  /** Tabla (primer factor). */
  a: number;
  /** Segundo factor (1..10). */
  b: number;
  correct: number;
  wrong: number;
  /** Resultados mostrados [izquierda, derecha]. */
  options: [number, number];
  correctSide: Side;
}
