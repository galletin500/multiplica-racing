import { CFG } from './config';

/**
 * Reloj del juego. Convierte las marcas de requestAnimationFrame en pasos de simulación (dt):
 *  - independiente de los FPS (siempre segundos reales),
 *  - con tope (CFG.maxDt) para que un parón no provoque saltos ni derrotas injustas,
 *  - con pausa real (mientras está en pausa devuelve 0 y no acumula tiempo).
 */
export class GameClock {
  private last: number | null = null;
  private _paused = false;

  get paused(): boolean {
    return this._paused;
  }

  pause(): void {
    this._paused = true;
    this.last = null;
  }

  resume(): void {
    this._paused = false;
    this.last = null; // el siguiente tick no mide el tiempo que estuvo en pausa
  }

  tick(nowMs: number): number {
    if (this._paused) {
      this.last = null;
      return 0;
    }
    if (this.last === null) {
      this.last = nowMs;
      return 0;
    }
    const dt = Math.min(Math.max((nowMs - this.last) / 1000, 0), CFG.maxDt);
    this.last = nowMs;
    return dt;
  }
}

/**
 * Plazo de decisión. Cuenta tiempo de SIMULACIÓN (no de render), así que son
 * exactamente 5 s a cualquier FPS. No se muestra en pantalla.
 */
export class DecisionTimer {
  elapsed = 0;
  active = false;

  constructor(private readonly limit: number = CFG.decisionTime) {}

  start(initialElapsed = 0): void {
    this.elapsed = initialElapsed;
    this.active = true;
  }

  stop(): void {
    this.active = false;
  }

  /** Avanza dt. Devuelve el tiempo sobrante si el plazo se ha agotado, o null si sigue abierto. */
  advance(dt: number): number | null {
    if (!this.active) return null;
    this.elapsed += dt;
    if (this.elapsed >= this.limit) {
      const leftover = this.elapsed - this.limit;
      this.elapsed = this.limit;
      this.active = false;
      return leftover;
    }
    return null;
  }

  get remaining(): number {
    return Math.max(0, this.limit - this.elapsed);
  }
}
