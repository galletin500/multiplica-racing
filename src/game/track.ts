import { CFG, DECISION_DISTANCE } from './config';
import type { Side } from './types';

/**
 * La carretera se describe como funciones de "s" (distancia recorrida).
 * El mundo avanza hacia -Z: posición del coche = (axisX(s) + lateral, 0, -s).
 *
 *   tronco ──────────────┐ vértice (apexS)
 *                        ├── rama izquierda ─┐
 *                        └── rama derecha ───┘ unión (mergeS)
 *
 * La rama correcta vuelve a unirse; la incorrecta acaba en un precipicio (cutS).
 */
export interface ForkLayout {
  index: number;
  stemStartS: number;
  /** Aquí empiezan los cinco segundos. */
  windowStartS: number;
  /** Vértice de la Y: aquí acaba el plazo. */
  apexS: number;
  mergeS: number;
  cutS: number;
  /** Lado de la rama correcta de la bifurcación anterior (0 en la primera). */
  prevCorrectSide: Side | 0;
}

export interface TrackLayout {
  forks: ForkLayout[];
  finishS: number;
  endS: number;
}

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

export function smoothstep(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

export function buildTrackLayout(count: number, correctSides: readonly Side[]): TrackLayout {
  const forks: ForkLayout[] = [];
  let cursor = 0;
  for (let i = 0; i < count; i++) {
    const windowStartS = i === 0 ? CFG.startStraight : cursor + CFG.preludeAfterMerge;
    const apexS = windowStartS + DECISION_DISTANCE;
    const mergeS = apexS + CFG.branchLength;
    forks.push({
      index: i,
      stemStartS: i === 0 ? -60 : cursor,
      windowStartS,
      apexS,
      mergeS,
      cutS: apexS + CFG.cutU,
      prevCorrectSide: i === 0 ? 0 : correctSides[i - 1],
    });
    cursor = mergeS;
  }
  const finishS = cursor + CFG.finishExtra;
  return { forks, finishS, endS: finishS + 70 };
}

/** Eje de la carretera: curvas suaves, rectas en las zonas de decisión. */
export function axisX(layout: TrackLayout, s: number): number {
  let flat = 0;
  for (const f of layout.forks) {
    const rise = smoothstep((s - (f.apexS - 125)) / 30);
    const fall = 1 - smoothstep((s - f.apexS) / 20);
    flat = Math.max(flat, rise * fall);
  }
  const amp = 1 - flat;
  const base = 5 * Math.sin(0.018 * s) + 2.5 * Math.sin(0.04 * s + 2);
  return amp * base;
}

/** Pendiente dx/ds del eje (para orientar el coche). */
export function axisSlope(layout: TrackLayout, s: number): number {
  const h = 0.5;
  return (axisX(layout, s + h) - axisX(layout, s - h)) / (2 * h);
}

/** Separación de las ramas respecto al vértice. */
export function branchSpread(u: number): number {
  const x = Math.sin((Math.PI * u) / CFG.branchLength);
  return CFG.branchSpread * x * x;
}

/** Ensanche final de la rama correcta al volver a unirse al tronco (0..1). */
export function widen(u: number): number {
  return smoothstep((u - (CFG.branchLength - CFG.widenLength)) / CFG.widenLength);
}

export interface Edges {
  outer: number;
  inner: number;
}

/** Bordes ABSOLUTOS (x de mundo) del asfalto de una rama. */
export function branchEdges(layout: TrackLayout, f: ForkLayout, side: Side, s: number, correct: boolean): Edges {
  const u = s - f.apexS;
  const g = branchSpread(u);
  const w = correct ? widen(u) : 0;
  const ax = axisX(layout, s);
  return {
    outer: ax + side * (CFG.halfRoad + g),
    inner: ax + side * (g - CFG.halfRoad * w),
  };
}

/** Desplazamiento lateral (respecto al eje) del centro de una rama: objetivo del coche. */
export function branchCenterLat(f: ForkLayout, side: Side, s: number, correct: boolean): number {
  const u = s - f.apexS;
  const g = branchSpread(u);
  const w = correct ? widen(u) : 0;
  return side * ((CFG.halfRoad / 2) * (1 - w) + g);
}

/** Centro del carril en el tronco al elegir un lado. */
export const STEM_LANE = CFG.halfRoad / 2;
