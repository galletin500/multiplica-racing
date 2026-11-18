import { TABLES } from '../game/multiplication';

export type ScreenName = 'title' | 'levels' | 'gameover' | 'victory' | 'pause';

export interface UIHandlers {
  onPlay(): void;
  onBack(): void;
  onPickTable(table: number): void;
  onRetry(): void;
  onMenu(): void;
  onAgain(): void;
  onLevels(): void;
  onResume(): void;
  onPause(): void;
  onToggleMute(): void;
}

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Falta #${id}`);
  return el as T;
};

/** Controla todo el HTML: pantallas, marcadores, cartel de la multiplicación y mensajes. */
export class UI {
  private readonly screens: Record<ScreenName, HTMLElement>;
  private readonly hud = $('hud');
  private readonly touch = $('touch');
  private readonly question = $('hud-question');
  private readonly questionText = $('hud-question-text');
  private readonly flashEl = $('hud-flash');
  private readonly dots = $('hud-dots');
  private flashTimer = 0;

  constructor(private readonly h: UIHandlers) {
    this.screens = {
      title: $('screen-title'),
      levels: $('screen-levels'),
      gameover: $('screen-gameover'),
      victory: $('screen-victory'),
      pause: $('screen-pause'),
    };

    // Selector de tablas
    const grid = $('level-grid');
    TABLES.forEach((t, i) => {
      const b = document.createElement('button');
      b.className = `btn level c${i}`;
      b.dataset.table = String(t);
      b.setAttribute('aria-label', `Tabla del ${t}`);
      b.innerHTML = `<small>TABLA DEL</small><b>${t}</b>`;
      grid.appendChild(b);
    });
    grid.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-table]');
      if (b) this.h.onPickTable(Number(b.dataset.table));
    });

    // Botones con data-action
    $('app').addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (!el) return;
      switch (el.dataset.action) {
        case 'play': return this.h.onPlay();
        case 'back': return this.h.onBack();
        case 'retry': return this.h.onRetry();
        case 'menu': return this.h.onMenu();
        case 'again': return this.h.onAgain();
        case 'levels': return this.h.onLevels();
        case 'resume': return this.h.onResume();
      }
    });
    document.querySelectorAll<HTMLElement>('[data-mute]').forEach((b) => b.addEventListener('click', () => this.h.onToggleMute()));
    $('btn-pause').addEventListener('click', () => this.h.onPause());
  }

  show(name: ScreenName | null): void {
    (Object.keys(this.screens) as ScreenName[]).forEach((k) => this.screens[k].classList.toggle('active', k === name));
  }

  setPlaying(on: boolean): void {
    this.hud.classList.toggle('active', on);
    this.touch.classList.toggle('active', on);
    if (!on) this.hideQuestion();
  }

  setMuted(m: boolean): void {
    document.querySelectorAll<HTMLElement>('[data-mute]').forEach((b) => {
      b.textContent = m ? '🔇' : '🔊';
      b.setAttribute('aria-label', m ? 'Activar sonido' : 'Silenciar sonido');
    });
  }

  startRun(table: number, total: number): void {
    $('hud-table').textContent = `TABLA DEL ${table}`;
    this.dots.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const d = document.createElement('span');
      d.className = 'dot';
      this.dots.appendChild(d);
    }
    this.setScore(0, total, 0);
    this.hideQuestion();
    this.flashEl.classList.remove('go');
  }

  setScore(correct: number, total: number, current: number): void {
    $('hud-score').textContent = `ACIERTOS: ${correct}/${total}`;
    this.dots.querySelectorAll('.dot').forEach((d, i) => {
      d.classList.toggle('done', i < correct);
      d.classList.toggle('now', i === current && i >= correct);
    });
  }

  showQuestion(a: number, b: number): void {
    this.questionText.textContent = `${a} × ${b} = ?`;
    this.question.classList.add('show');
  }

  hideQuestion(): void {
    this.question.classList.remove('show');
  }

  flash(text: string): void {
    this.flashEl.textContent = text;
    this.flashEl.classList.remove('go');
    void this.flashEl.offsetWidth; // reinicia la animación
    this.flashEl.classList.add('go');
    window.clearTimeout(this.flashTimer);
  }

  showGameOver(opts: { answer: number; timedOut: boolean; correct: number; total: number }): void {
    $('over-answer').innerHTML = opts.timedOut
      ? `¡Hay que elegir una carretera! La respuesta era <b>${opts.answer}</b>.`
      : `La respuesta correcta era <b>${opts.answer}</b>.`;
    $('over-score').textContent = `Aciertos: ${opts.correct} de ${opts.total}`;
    this.show('gameover');
  }

  showVictory(table: number, correct: number, total: number): void {
    $('win-title').textContent = `¡HAS COMPLETADO LA TABLA DEL ${table}!`;
    $('win-score').textContent = `${correct} DE ${total} ACIERTOS`;
    this.show('victory');
  }
}
