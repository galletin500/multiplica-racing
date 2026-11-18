import { describe, expect, it } from 'vitest';
import { CFG, DECISION_DISTANCE } from './config';
import { GameClock } from './clock';
import { TABLES, buildLevelQuestions, buildQuestion, validateQuestion } from './multiplication';
import { mulberry32 } from './rng';
import { RaceSim, type SimEvents } from './sim';
import { axisX, branchEdges, branchCenterLat, buildTrackLayout } from './track';
import type { Side } from './types';

describe('1-3. Generador de multiplicaciones', () => {
  it('cada tabla tiene 10 multiplicaciones distintas (×1…×10), todas correctas y con una sola respuesta válida', () => {
    for (const table of TABLES) {
      for (let seed = 1; seed <= 40; seed++) {
        const qs = buildLevelQuestions(table, mulberry32(seed * 977 + table));
        expect(qs).toHaveLength(10);
        expect(new Set(qs.map((q) => q.b)).size).toBe(10);
        expect([...qs.map((q) => q.b)].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        for (const q of qs) {
          expect(q.a).toBe(table);
          expect(q.correct).toBe(q.a * q.b);
          expect(validateQuestion(q)).toBe(true);
          expect(q.options[0]).not.toBe(q.options[1]);
          expect(q.options.filter((o) => o === q.a * q.b)).toHaveLength(1);
          // la respuesta incorrecta es cercana y positiva
          expect(q.wrong).toBeGreaterThan(0);
          expect(Math.abs(q.wrong - q.correct)).toBeLessThanOrEqual(Math.max(2 * q.a + 1, 10));
        }
      }
    }
  });

  it('el orden de las multiplicaciones es aleatorio', () => {
    const orders = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      orders.add(buildLevelQuestions(3, mulberry32(seed)).map((q) => q.b).join(','));
    }
    expect(orders.size).toBeGreaterThan(25);
  });

  it('la respuesta correcta cambia de lado aleatoriamente (~50 %) sin rachas imposibles', () => {
    const rng = mulberry32(2025);
    let left = 0;
    let streak = 0;
    let maxStreak = 0;
    let prev: Side | 0 = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const q = buildQuestion(7, 1 + (i % 10), rng);
      if (q.correctSide === -1) left++;
      streak = q.correctSide === prev ? streak + 1 : 1;
      prev = q.correctSide;
      maxStreak = Math.max(maxStreak, streak);
    }
    expect(left / N).toBeGreaterThan(0.47);
    expect(left / N).toBeLessThan(0.53);
    expect(maxStreak).toBeLessThan(25);
  });

  it('los distractores no delatan la respuesta en las tablas pares, del 5 y del 10', () => {
    const rng = mulberry32(7);
    for (const table of [2, 4, 5, 6, 8, 10]) {
      for (let b = 1; b <= 10; b++) {
        for (let k = 0; k < 50; k++) {
          const q = buildQuestion(table, b, rng);
          // en estas tablas nunca se usa ±1
          expect(Math.abs(q.wrong - q.correct)).not.toBe(1);
        }
      }
    }
  });
});

// ───────────── ayudante de simulación ─────────────

interface Log {
  windowOpens: { index: number; t: number; s: number }[];
  falls: { kind: string; t: number; s: number }[];
  correct: number[];
  wrong: { index: number; timedOut: boolean }[];
  victory: boolean;
  gameOver: boolean;
  choices: number;
}

/** Avanza la simulación con un dt fijo. `policy` decide qué hacer en cada paso. */
function run(
  sim: RaceSim,
  log: Log,
  dt: number,
  policy: (sim: RaceSim, t: number) => void,
  maxSeconds = 600,
): number {
  let t = 0;
  while (t < maxSeconds && sim.phase !== 'lost' && sim.phase !== 'won') {
    policy(sim, t);
    sim.update(dt);
    t += dt;
  }
  return t;
}

function makeSim(table: number, seed = 1): { sim: RaceSim; log: Log; clockRef: { t: number } } {
  const clockRef = { t: 0 };
  const log: Log = { windowOpens: [], falls: [], correct: [], wrong: [], victory: false, gameOver: false, choices: 0 };
  const events: SimEvents = {
    onWindowOpen: (index) => log.windowOpens.push({ index, t: clockRef.t, s: simRef.s }),
    onFallStart: (kind) => log.falls.push({ kind, t: clockRef.t, s: simRef.s }),
    onCorrect: (i) => log.correct.push(i),
    onWrong: (index, timedOut) => log.wrong.push({ index, timedOut }),
    onChoice: () => log.choices++,
    onVictory: () => (log.victory = true),
    onGameOver: () => (log.gameOver = true),
  };
  const simRef: RaceSim = new RaceSim(table, events, mulberry32(seed));
  return { sim: simRef, log, clockRef };
}

const answer = (kind: 'correct' | 'wrong', delay = 1) => {
  let decidedFor = -1;
  return (sim: RaceSim) => {
    if (sim.phase === 'deciding' && sim.choice === null && sim.timer.elapsed >= delay) {
      const q = sim.currentQuestion!;
      const side: Side = kind === 'correct' ? q.correctSide : ((-q.correctSide) as Side);
      sim.choose(side);
      decidedFor = sim.forkIndex;
    }
    void decidedFor;
  };
};

describe('4-5. Plazo de cinco segundos', () => {
  for (const fps of [10, 20, 30, 60, 90, 144, 240]) {
    it(`el plazo dura exactamente 5 s de simulación a ${fps} FPS y el coche llega al vértice justo entonces`, () => {
      const dt = 1 / fps;
      const step = Math.min(dt, CFG.maxDt); // el juego recorta pasos enormes (tirones)
      const { sim, log } = makeSim(5, 3);
      let t = 0; // tiempo de SIMULACIÓN
      let openedAt = -1;
      let openedElapsed = 0;
      let fellAt = -1;
      while (sim.phase !== 'lost') {
        sim.update(dt);
        t += step;
        if (openedAt < 0 && sim.phase === 'deciding') {
          openedAt = t;
          openedElapsed = sim.timer.elapsed;
        }
        if (fellAt < 0 && sim.phase === 'falling') {
          fellAt = t;
          // sin elegir nada, el coche está en el vértice de la primera bifurcación
          expect(sim.s).toBeCloseTo(sim.layout.forks[0].apexS, 6);
        }
        if (t > 60) throw new Error('la partida no terminó');
      }
      // tiempo entre apertura y vértice = 5 s (con la precisión de un paso)
      const measured = fellAt - openedAt + openedElapsed;
      expect(Math.abs(measured - CFG.decisionTime)).toBeLessThanOrEqual(step + 1e-9);
      expect(log.falls[0].kind).toBe('timeout');
    });
  }

  it('la distancia recorrida durante el plazo es velocidad × 5 s', () => {
    expect(DECISION_DISTANCE).toBe(CFG.speed * 5);
    const layout = buildTrackLayout(10, new Array(10).fill(1));
    for (const f of layout.forks) expect(f.apexS - f.windowStartS).toBe(DECISION_DISTANCE);
  });

  it('con FPS bajos el paso se limita (no hay derrotas injustas por un tirón)', () => {
    const { sim } = makeSim(5, 3);
    // un único paso enorme de 5 s equivale como mucho a maxDt
    sim.update(5);
    expect(sim.time).toBeCloseTo(CFG.maxDt, 9);
  });

  it('la pausa del reloj no acumula tiempo', () => {
    const clock = new GameClock();
    expect(clock.tick(1000)).toBe(0);
    expect(clock.tick(1016)).toBeCloseTo(0.016, 6);
    clock.pause();
    expect(clock.tick(60000)).toBe(0);
    clock.resume();
    expect(clock.tick(120000)).toBe(0); // primer tick tras reanudar: sin salto
    expect(clock.tick(120016)).toBeCloseTo(0.016, 6);
  });
});

describe('6-9. Reglas de partida', () => {
  it('elegir siempre bien completa el nivel: 10 aciertos y victoria', () => {
    for (const table of TABLES) {
      const { sim, log } = makeSim(table, table * 11);
      run(sim, log, 1 / 60, answer('correct', 1.3));
      expect(sim.phase).toBe('won');
      expect(log.victory).toBe(true);
      expect(log.gameOver).toBe(false);
      expect(sim.score.correct).toBe(10);
      expect(log.correct).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(log.windowOpens).toHaveLength(10);
    }
  });

  it('elegir mal provoca la caída por el precipicio (al final de la rama) y termina la partida', () => {
    const { sim, log } = makeSim(4, 9);
    run(sim, log, 1 / 60, answer('wrong', 0.5));
    expect(sim.phase).toBe('lost');
    expect(log.gameOver).toBe(true);
    expect(log.victory).toBe(false);
    expect(log.falls[0].kind).toBe('cliff');
    expect(log.falls[0].s).toBeCloseTo(sim.layout.forks[0].cutS, 6);
    expect(sim.score.correct).toBe(0);
  });

  it('fallar en la séptima multiplicación deja seis aciertos', () => {
    const { sim, log } = makeSim(6, 21);
    let k = 0;
    run(sim, log, 1 / 60, (s) => {
      if (s.phase === 'deciding' && s.choice === null && s.timer.elapsed >= 1) {
        const q = s.currentQuestion!;
        s.choose(s.forkIndex === 6 ? ((-q.correctSide) as Side) : q.correctSide);
        k++;
      }
    });
    expect(sim.phase).toBe('lost');
    expect(sim.score.correct).toBe(6);
    expect(sim.forkIndex).toBe(6);
  });

  it('no responder también termina la partida', () => {
    const { sim, log } = makeSim(7, 5);
    // 3 bien y luego no responde
    run(sim, log, 1 / 60, (s) => {
      if (s.phase === 'deciding' && s.choice === null && s.timer.elapsed >= 1 && s.forkIndex < 3) {
        s.choose(s.currentQuestion!.correctSide);
      }
    });
    expect(sim.phase).toBe('lost');
    expect(sim.score.correct).toBe(3);
    expect(log.falls[0].kind).toBe('timeout');
    expect(log.wrong[0].timedOut).toBe(true);
  });

  it('una vez elegida una dirección no se puede cambiar, y los toques repetidos se ignoran', () => {
    const { sim, log } = makeSim(3, 2);
    while (sim.phase !== 'deciding') sim.update(1 / 60);
    const q = sim.currentQuestion!;
    expect(sim.choose(q.correctSide)).toBe(true);
    expect(sim.choose(q.correctSide)).toBe(false);
    expect(sim.choose((-q.correctSide) as Side)).toBe(false);
    expect(sim.choice).toBe(q.correctSide);
    expect(log.choices).toBe(1);
  });

  it('las elecciones fuera del plazo no se registran', () => {
    const { sim } = makeSim(3, 2);
    expect(sim.choose(1)).toBe(false); // al arrancar (recta inicial)
    while (sim.phase !== 'deciding') sim.update(1 / 60);
    sim.choose(sim.currentQuestion!.correctSide);
    while (sim.phase === 'deciding') sim.update(1 / 60);
    expect(sim.phase).toBe('resolving');
    expect(sim.choose(1)).toBe(false); // ya en la rama
  });

  it('el resultado correcto no se puede deducir del lado: el mismo lado no es siempre el bueno', () => {
    const { sim } = makeSim(9, 13);
    const sides = new Set(sim.questions.map((q) => q.correctSide));
    // con esta semilla hay de ambos lados (si no, cambia la semilla: la prueba comprueba la variedad)
    expect(sides.size).toBe(2);
  });

  it('elegir a la última décima de segundo sigue siendo válido', () => {
    const { sim, log } = makeSim(5, 4);
    run(sim, log, 1 / 60, (s) => {
      if (s.phase === 'deciding' && s.choice === null && s.timer.elapsed >= CFG.decisionTime - 0.05) {
        s.choose(s.currentQuestion!.correctSide);
      }
    });
    expect(sim.score.correct).toBeGreaterThanOrEqual(1);
  });
});

describe('Geometría de la bifurcación', () => {
  const sides: Side[] = [1, -1, 1, 1, -1, -1, 1, -1, 1, -1];
  const layout = buildTrackLayout(10, sides);

  it('las ramas arrancan pegadas en el vértice y la correcta empalma con el tronco siguiente', () => {
    for (const f of layout.forks) {
      for (const side of [-1, 1] as Side[]) {
        const a = branchEdges(layout, f, side, f.apexS, true);
        const ax = axisX(layout, f.apexS);
        expect(a.inner).toBeCloseTo(ax, 6); // borde interior en el vértice = eje
        expect(a.outer).toBeCloseTo(ax + side * CFG.halfRoad, 6);

        const m = branchEdges(layout, f, side, f.mergeS, true);
        const mx = axisX(layout, f.mergeS);
        expect(m.outer).toBeCloseTo(mx + side * CFG.halfRoad, 6);
        expect(m.inner).toBeCloseTo(mx - side * CFG.halfRoad, 6); // ensancha hasta el otro borde del tronco
        expect(branchCenterLat(f, side, f.mergeS, true)).toBeCloseTo(0, 6);
      }
    }
  });

  it('la rama equivocada acaba antes de que la correcta empiece a ensancharse (no se solapan)', () => {
    expect(CFG.cutU).toBeLessThan(CFG.branchLength - CFG.widenLength);
  });

  it('el final de la rama equivocada queda más lejos que la niebla en el instante del vértice', () => {
    // La cámara va unos 9 u por detrás del coche.
    expect(CFG.cutU + 9).toBeGreaterThanOrEqual(CFG.fogFar);
  });
});
