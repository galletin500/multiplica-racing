import { CFG } from './config';
import { DecisionTimer } from './clock';
import { buildLevelQuestions } from './multiplication';
import { defaultRng, type Rng } from './rng';
import { Score } from './score';
import {
  STEM_LANE,
  axisSlope,
  axisX,
  branchCenterLat,
  buildTrackLayout,
  type ForkLayout,
  type TrackLayout,
} from './track';
import type { Question, Side } from './types';

export type Phase = 'driving' | 'deciding' | 'resolving' | 'finishing' | 'falling' | 'won' | 'lost';
export type FallKind = 'cliff' | 'timeout';

export interface SimEvents {
  /** Los carteles aparecen (0,4 s antes de que empiece el plazo). */
  onQuestion?(index: number, q: Question): void;
  /** Empieza el plazo de cinco segundos (carteles completamente visibles). */
  onWindowOpen?(index: number): void;
  onChoice?(side: Side, index: number): void;
  /** El coche llega al vértice de la Y: se evalúa la elección. */
  onCorrect?(index: number): void;
  onWrong?(index: number, timedOut: boolean): void;
  onFallStart?(kind: FallKind): void;
  onForkDone?(index: number): void;
  onGameOver?(info: { index: number; question: Question; timedOut: boolean; correct: number }): void;
  onVictory?(info: { correct: number; total: number }): void;
}

export interface Pose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  /** Velocidad actual / velocidad máxima (0..1.25). */
  speedRatio: number;
  /** Velocidad lateral suavizada (para ruedas e inclinación). */
  steer: number;
}

interface FallState {
  t: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  kind: FallKind;
}

const GRAVITY = 30;

/**
 * Simulación pura de una partida (sin Three.js, sin DOM):
 * estados, plazo de 5 s, elección, resolución, caída y victoria.
 * Todo avanza con dt de simulación, por eso es independiente de los FPS.
 */
export class RaceSim {
  readonly questions: Question[];
  readonly layout: TrackLayout;
  readonly score: Score;
  readonly timer = new DecisionTimer();

  phase: Phase = 'driving';
  s = 0;
  latX = 0;
  forkIndex = 0;
  choice: Side | null = null;
  doomed = false;
  lastFallKind: FallKind | null = null;
  time = 0;

  private latVs = 0;
  private speedNow = 0;
  private signShown = false;
  private fall: FallState | null = null;
  private readonly poseOut: Pose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, speedRatio: 0, steer: 0 };

  constructor(
    readonly table: number,
    private readonly events: SimEvents = {},
    rng: Rng = defaultRng,
    questions?: Question[],
  ) {
    this.questions = questions ?? buildLevelQuestions(table, rng);
    this.layout = buildTrackLayout(
      this.questions.length,
      this.questions.map((q) => q.correctSide),
    );
    this.score = new Score(this.questions.length);
    this.latX = 0;
    this.s = 0;
  }

  get currentFork(): ForkLayout | undefined {
    return this.layout.forks[this.forkIndex];
  }

  get currentQuestion(): Question | undefined {
    return this.questions[this.forkIndex];
  }

  /** Elección de carretera. Solo vale durante el plazo y solo una vez por bifurcación. */
  choose(side: Side): boolean {
    if (this.phase !== 'deciding' || this.choice !== null) return false;
    if (side !== -1 && side !== 1) return false;
    this.choice = side;
    this.events.onChoice?.(side, this.forkIndex);
    return true;
  }

  update(rawDt: number): void {
    const dt = Math.min(Math.max(rawDt, 0), CFG.maxDt);
    if (dt <= 0) return;
    this.time += dt;

    switch (this.phase) {
      case 'driving':
        this.updateDriving(dt);
        break;
      case 'deciding':
        this.updateDeciding(dt);
        break;
      case 'resolving':
        this.updateResolving(dt);
        break;
      case 'finishing':
        this.updateFinishing(dt);
        break;
      case 'falling':
        this.updateFalling(dt);
        break;
      case 'won':
        this.speedNow *= Math.exp(-2.2 * dt);
        this.s += this.speedNow * dt;
        this.steerTowards(0, dt);
        break;
      case 'lost':
        break;
    }
  }

  // ───────────── fases ─────────────

  private updateDriving(dt: number): void {
    const f = this.currentFork;
    // Arranque suave durante el primer segundo.
    const ramp = Math.min(1, this.time / 1.1);
    this.speedNow = CFG.speed * ramp;
    this.s += this.speedNow * dt;
    this.steerTowards(0, dt);
    if (!f) return;

    if (!this.signShown && this.s >= f.windowStartS - CFG.speed * CFG.signLead) {
      this.signShown = true;
      this.events.onQuestion?.(f.index, this.questions[f.index]);
    }
    if (this.s >= f.windowStartS) {
      if (!this.signShown) {
        this.signShown = true;
        this.events.onQuestion?.(f.index, this.questions[f.index]);
      }
      // Empieza el plazo. Conservamos el sobrante de este paso para no perder precisión.
      this.phase = 'deciding';
      this.choice = null;
      this.timer.start((this.s - f.windowStartS) / CFG.speed);
      this.s = f.windowStartS + CFG.speed * this.timer.elapsed;
      this.events.onWindowOpen?.(f.index);
    }
  }

  private updateDeciding(dt: number): void {
    const f = this.currentFork!;
    this.speedNow = CFG.speed;
    const leftover = this.timer.advance(dt);
    if (leftover === null) {
      this.s = f.windowStartS + CFG.speed * this.timer.elapsed;
    } else {
      this.s = f.apexS; // el coche llega exactamente al vértice al agotarse el plazo
    }
    this.steerTowards(this.choice === null ? 0 : this.choice * STEM_LANE, dt);
    if (leftover !== null) this.resolveApex(f);
  }

  private resolveApex(f: ForkLayout): void {
    const q = this.questions[f.index];
    if (this.choice === null) {
      // No eligió: el coche sigue recto, se sale de la carretera y cae.
      this.events.onWrong?.(f.index, true);
      this.startFall('timeout');
      return;
    }
    this.doomed = this.choice !== q.correctSide;
    if (this.doomed) {
      this.events.onWrong?.(f.index, false);
    } else {
      this.score.addCorrect();
      this.events.onCorrect?.(f.index);
    }
    this.phase = 'resolving';
  }

  private updateResolving(dt: number): void {
    const f = this.currentFork!;
    const side = this.choice as Side;
    const mult = this.doomed ? CFG.doomedSpeedFactor : 1;
    this.speedNow = CFG.speed * mult;
    this.s += this.speedNow * dt;

    if (this.doomed && this.s >= f.cutS) {
      this.s = f.cutS;
      this.steerTowards(branchCenterLat(f, side, this.s, false), dt);
      this.startFall('cliff');
      return;
    }
    this.steerTowards(branchCenterLat(f, side, this.s, !this.doomed), dt);

    if (!this.doomed && this.s >= f.mergeS) {
      this.events.onForkDone?.(f.index);
      this.forkIndex++;
      this.choice = null;
      this.signShown = false;
      this.phase = this.forkIndex >= this.questions.length ? 'finishing' : 'driving';
    }
  }

  private updateFinishing(dt: number): void {
    this.speedNow = CFG.speed;
    this.s += this.speedNow * dt;
    this.steerTowards(0, dt);
    if (this.s >= this.layout.finishS) {
      this.phase = 'won';
      this.events.onVictory?.({ correct: this.score.correct, total: this.score.total });
    }
  }

  private startFall(kind: FallKind): void {
    const vf = this.speedNow > 1 ? this.speedNow : CFG.speed;
    const slope = axisSlope(this.layout, this.s) + this.latVs / CFG.speed;
    this.fall = {
      t: 0,
      x: axisX(this.layout, this.s) + this.latX,
      y: 0,
      z: -this.s,
      vx: slope * vf,
      vy: 3.2, // saltito divertido al salir del borde
      vz: -vf,
      yaw: -Math.atan(slope),
      kind,
    };
    this.lastFallKind = kind;
    this.phase = 'falling';
    this.events.onFallStart?.(kind);
  }

  private updateFalling(dt: number): void {
    const fl = this.fall!;
    fl.t += dt;
    fl.x += fl.vx * dt;
    fl.z += fl.vz * dt;
    fl.vy -= GRAVITY * dt;
    fl.y += fl.vy * dt;
    fl.vx *= Math.exp(-0.35 * dt);
    fl.vz *= Math.exp(-0.35 * dt);
    if (fl.t >= CFG.fallDuration) {
      this.phase = 'lost';
      const q = this.questions[this.forkIndex];
      this.events.onGameOver?.({
        index: this.forkIndex,
        question: q,
        timedOut: fl.kind === 'timeout',
        correct: this.score.correct,
      });
    }
  }

  private steerTowards(target: number, dt: number): void {
    const next = target + (this.latX - target) * Math.exp(-CFG.steerRate * dt);
    const v = (next - this.latX) / dt;
    this.latVs += (v - this.latVs) * (1 - Math.exp(-14 * dt));
    this.latX = next;
  }

  // ───────────── pose para el render ─────────────

  getPose(): Pose {
    const p = this.poseOut;
    const fl = this.fall;
    if ((this.phase === 'falling' || this.phase === 'lost') && fl) {
      p.x = fl.x;
      p.y = fl.y;
      p.z = fl.z;
      p.yaw = fl.yaw;
      p.pitch = -fl.t * 1.7;
      p.roll = fl.t * 2.6;
      p.speedRatio = 0.4;
      p.steer = 0;
      return p;
    }
    const slope = axisSlope(this.layout, this.s) + (this.speedNow > 1 ? this.latVs / this.speedNow : 0);
    p.x = axisX(this.layout, this.s) + this.latX;
    p.y = 0;
    p.z = -this.s;
    p.yaw = -Math.atan(slope);
    p.pitch = 0;
    p.roll = Math.max(-0.28, Math.min(0.28, this.latVs * 0.014));
    p.speedRatio = this.speedNow / CFG.speed;
    p.steer = this.latVs;
    return p;
  }
}
