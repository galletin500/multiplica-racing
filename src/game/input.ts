import type { Side } from './types';

/**
 * Controles: flechas (←/→ o A/D), clic/toque en la mitad izquierda/derecha de la pantalla
 * y dos botones táctiles grandes. Los eventos se resuelven en `pointerdown` para que la
 * respuesta sea inmediata en móviles.
 */
export class InputManager {
  onChoose: ((side: Side) => void) | null = null;
  enabled = false;

  constructor(
    stage: HTMLElement,
    leftBtn: HTMLElement,
    rightBtn: HTMLElement,
  ) {
    window.addEventListener('keydown', (e) => {
      if (!this.enabled || e.repeat) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        this.fire(-1);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        this.fire(1);
      }
    });

    const press = (side: Side) => (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      this.fire(side);
    };
    leftBtn.addEventListener('pointerdown', press(-1));
    rightBtn.addEventListener('pointerdown', press(1));

    stage.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      const target = e.target as HTMLElement;
      if (target.closest('button, .screen, .hud-btn')) return;
      this.fire(e.clientX < window.innerWidth / 2 ? -1 : 1);
    });
  }

  private fire(side: Side): void {
    if (this.enabled) this.onChoose?.(side);
  }
}
