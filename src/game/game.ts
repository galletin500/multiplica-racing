import { AudioManager } from './audio';
import { GameClock } from './clock';
import { InputManager } from './input';
import { defaultRng } from './rng';
import { RaceSim, type Pose, type SimEvents } from './sim';
import { axisX } from './track';
import { CameraRig } from './world/cameraRig';
import { Stage } from './world/stage';
import { World } from './world/world';
import { Confetti } from '../ui/confetti';
import { UI } from '../ui/ui';
import * as THREE from 'three';

type Mode = 'title' | 'levels' | 'playing' | 'paused' | 'over' | 'victory';

const PRAISE = ['¡Muy bien!', '¡Genial!', '¡Perfecto!', '¡Eso es!', '¡Campeón!', '¡Qué bien conduces!'];

/**
 * Orquestador: máquina de estados (menús ⇄ partida ⇄ pausa ⇄ fin), bucle de juego,
 * y conexión entre simulación, mundo 3D, interfaz y sonido.
 */
export class Game {
  private readonly stage: Stage;
  private readonly world: World;
  private readonly rig: CameraRig;
  private readonly audio = new AudioManager();
  private readonly clock = new GameClock();
  private readonly ui: UI;
  private readonly input: InputManager;
  private readonly confetti: Confetti;

  private mode: Mode = 'title';
  private sim: RaceSim | null = null;
  private worldKind: 'menu' | 'level' | 'none' = 'none';
  private table = 2;
  private menuT = 0;
  private readonly menuPose: Pose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, speedRatio: 0, steer: 0 };
  private readonly menuCenter = new THREE.Vector3();

  constructor() {
    const canvas = document.getElementById('game') as HTMLCanvasElement;
    this.stage = new Stage(canvas);
    this.world = new World(this.stage);
    this.rig = new CameraRig(this.stage.camera, () => this.stage.baseFov);
    this.confetti = new Confetti(document.getElementById('confetti') as HTMLCanvasElement);

    this.ui = new UI({
      onPlay: () => {
        this.audio.unlock();
        this.audio.click();
        this.showLevels();
      },
      onBack: () => {
        this.audio.click();
        this.showTitle();
      },
      onPickTable: (t) => {
        if (this.mode === 'levels') this.startLevel(t);
      },
      onRetry: () => {
        if (this.mode === 'over') this.startLevel(this.table);
      },
      onMenu: () => {
        this.audio.unlock();
        this.audio.click();
        this.showTitle();
      },
      onAgain: () => {
        if (this.mode === 'victory') this.startLevel(this.table);
      },
      onLevels: () => {
        this.audio.click();
        this.showLevels();
      },
      onResume: () => this.resume(),
      onPause: () => this.pause(),
      onToggleMute: () => {
        this.audio.unlock();
        this.audio.setMuted(!this.audio.muted);
        this.ui.setMuted(this.audio.muted);
        if (!this.audio.muted) this.audio.click();
      },
    });
    this.ui.setMuted(this.audio.muted);

    const touchLeft = document.getElementById('btn-left') as HTMLElement;
    const touchRight = document.getElementById('btn-right') as HTMLElement;
    this.input = new InputManager(document.getElementById('app') as HTMLElement, touchLeft, touchRight);
    this.input.onChoose = (side) => {
      if (this.mode === 'playing') this.sim?.choose(side);
    };

    window.addEventListener('resize', () => this.stage.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.stage.resize(), 250));
    // Si se pierde el foco o se suspende la página, pausamos para evitar una derrota injusta.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.autoPause();
    });
    window.addEventListener('blur', () => this.autoPause());
    window.addEventListener('pagehide', () => this.autoPause());
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    this.showTitle();
    requestAnimationFrame(this.frame);
  }

  // ───────────── pantallas ─────────────

  private ensureMenuWorld(): void {
    if (this.worldKind !== 'menu') {
      this.world.buildMenu();
      this.worldKind = 'menu';
      const s = 8;
      this.menuPose.x = axisX(this.world.layout!, s);
      this.menuPose.z = -s;
      this.menuPose.yaw = Math.PI; // el coche mira a la cámara
      this.menuCenter.set(this.menuPose.x, 0, this.menuPose.z);
    }
    this.sim = null;
    this.rig.reset();
  }

  private leavePlay(): void {
    this.input.enabled = false;
    this.audio.stopEngine();
    this.audio.stopMusic();
    this.confetti.stop();
    this.ui.setPlaying(false);
    this.clock.resume();
  }

  private showTitle(): void {
    this.leavePlay();
    this.ensureMenuWorld();
    this.mode = 'title';
    this.ui.show('title');
  }

  private showLevels(): void {
    this.leavePlay();
    this.ensureMenuWorld();
    this.mode = 'levels';
    this.ui.show('levels');
  }

  // ───────────── partida ─────────────

  private startLevel(table: number): void {
    this.audio.unlock();
    this.audio.select();
    this.leavePlay();
    this.table = table;

    const sim = new RaceSim(table, this.simEvents(), defaultRng);
    this.sim = sim;
    this.world.buildLevel(sim.layout, sim.questions, (Math.random() * 1e9) | 0);
    this.worldKind = 'level';
    this.rig.reset();

    this.ui.show(null);
    this.ui.setPlaying(true);
    this.ui.startRun(table, sim.questions.length);
    this.ui.flash('¡A conducir!');

    this.mode = 'playing';
    this.clock.resume();
    this.input.enabled = true;
    this.audio.startEngine();
    this.audio.startMusic();
  }

  private simEvents(): SimEvents {
    return {
      onQuestion: (i, q) => {
        this.world.showSigns(i);
        this.ui.showQuestion(q.a, q.b);
        this.ui.setScore(this.sim!.score.correct, this.sim!.score.total, i);
        this.audio.pop();
      },
      onChoice: () => this.audio.steer(),
      onCorrect: () => {
        const sc = this.sim!.score;
        this.ui.hideQuestion();
        this.ui.setScore(sc.correct, sc.total, this.sim!.forkIndex + 1);
        this.ui.flash(PRAISE[Math.floor(Math.random() * PRAISE.length)]);
        this.audio.correct();
      },
      onWrong: (_i, timedOut) => {
        this.ui.hideQuestion();
        if (!timedOut) this.audio.wrong();
      },
      onFallStart: () => {
        this.audio.stopEngine();
        this.audio.fall();
      },
      onForkDone: (i) => this.world.hideSigns(i),
      onGameOver: (info) => {
        this.mode = 'over';
        this.input.enabled = false;
        this.audio.stopMusic();
        this.ui.setPlaying(false);
        this.ui.showGameOver({
          answer: info.question.correct,
          timedOut: info.timedOut,
          correct: info.correct,
          total: this.sim!.score.total,
        });
      },
      onVictory: (info) => {
        this.mode = 'victory';
        this.input.enabled = false;
        this.audio.stopEngine();
        this.audio.stopMusic();
        this.audio.win();
        this.ui.setPlaying(false);
        this.ui.showVictory(this.table, info.correct, info.total);
        this.confetti.start();
      },
    };
  }

  // ───────────── pausa ─────────────

  private pause(): void {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.clock.pause();
    this.input.enabled = false;
    this.audio.suspend();
    this.ui.show('pause');
  }

  private autoPause(): void {
    this.pause();
  }

  private resume(): void {
    if (this.mode !== 'paused') return;
    this.mode = 'playing';
    this.ui.show(null);
    this.clock.resume();
    this.input.enabled = true;
    this.audio.resume();
    this.audio.unlock();
  }

  // ───────────── bucle ─────────────

  private frame = (now: number): void => {
    requestAnimationFrame(this.frame);
    const dt = this.clock.tick(now);
    const sim = this.sim;

    if (sim && (this.mode === 'playing' || this.mode === 'over' || this.mode === 'victory' || this.mode === 'paused')) {
      if (this.mode !== 'paused') sim.update(dt);
      const pose = sim.getPose();
      this.rig.follow(pose, sim.phase, dt);
      this.world.update(pose, dt);
      if (this.mode === 'playing') this.audio.setEngineSpeed(pose.speedRatio);
    } else {
      this.menuT += dt;
      this.rig.orbit(this.menuCenter, this.menuT, this.mode === 'levels' ? 'levels' : 'title');
      this.world.update(this.menuPose, dt, true);
    }
    this.stage.render();
  };

  // ───────────── depuración / pruebas en navegador ─────────────

  debugState(): Record<string, unknown> {
    const s = this.sim;
    return {
      mode: this.mode,
      phase: s?.phase ?? null,
      s: s?.s ?? null,
      forkIndex: s?.forkIndex ?? null,
      choice: s?.choice ?? null,
      timerElapsed: s?.timer.elapsed ?? null,
      correct: s?.score.correct ?? null,
      question: s?.currentQuestion ?? null,
    };
  }

  /** Solo para pruebas automáticas: elige un lado desde fuera. */
  debugChoose(side: -1 | 1): boolean {
    return this.sim?.choose(side) ?? false;
  }

  /** Solo para pruebas: avanza la simulación N segundos sin esperar al render. */
  debugAdvance(seconds: number): void {
    const sim = this.sim;
    if (!sim || this.mode === 'paused') return;
    let left = seconds;
    while (left > 1e-9) {
      const step = Math.min(1 / 30, left);
      sim.update(step);
      const pose = sim.getPose();
      this.rig.follow(pose, sim.phase, step);
      this.world.update(pose, step);
      left -= step;
    }
  }

  debugStart(table: number): void {
    this.audio.unlock();
    this.startLevel(table);
  }
}
