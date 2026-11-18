import * as THREE from 'three';
import { CFG } from '../config';
import { axisX, branchEdges, type ForkLayout, type TrackLayout } from '../track';
import type { Question, Side } from '../types';
import { toon } from './materials';
import { makeBoardTexture, makeCheckerTexture } from './textures';

const POST_H = 5.6;

/** Cartel con marco; el pivote está en el centro de la base, así crece hacia arriba. */
class Board {
  readonly pivot = new THREE.Group();
  private pop = 0;
  private shown = false;
  private readonly baseScale: number;

  constructor(
    texture: THREE.Texture,
    readonly w: number,
    readonly h: number,
    /** El cartel crece con la distancia para seguir siendo legible desde lejos. */
    private readonly distanceBoost: boolean,
    frameColor = '#1d2b6b',
    private readonly maxBoost = 2.1,
  ) {
    this.baseScale = 1;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, h + 0.5, 0.35), toon(frameColor));
    frame.position.y = h / 2;
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: texture, fog: false, toneMapped: false }),
    );
    face.position.set(0, h / 2, 0.19);
    this.pivot.add(frame, face);
    this.pivot.visible = false;
    this.pivot.scale.setScalar(0.001);
  }

  show(): void {
    this.shown = true;
    this.pivot.visible = true;
  }

  hide(): void {
    this.shown = false;
    this.pop = 0;
    this.pivot.visible = false;
  }

  update(cam: THREE.Vector3, dt: number): void {
    if (!this.shown) return;
    this.pop = Math.min(1, this.pop + dt / 0.32);
    // easeOutBack
    const c1 = 1.70158;
    const c3 = c1 + 1;
    const k = 1 + c3 * Math.pow(this.pop - 1, 3) + c1 * Math.pow(this.pop - 1, 2);
    let boost = 1;
    if (this.distanceBoost) {
      const d = this.pivot.position.distanceTo(cam);
      boost = Math.min(this.maxBoost, Math.max(1, d / 46));
    }
    this.pivot.scale.setScalar(Math.max(0.001, k) * boost * this.baseScale);
  }
}

function post(x: number, z: number, height: number, color = '#e9edf7', r = 0.17): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.2, height, 8), toon(color));
  m.position.set(x, height / 2, z);
  return m;
}

/**
 * Los carteles de una bifurcación:
 *  - dos vallas con la multiplicación, a ambos lados del tronco (no tapan los resultados),
 *  - un cartel con el resultado sobre cada rama, a la misma altura y con el mismo aspecto.
 * (El cartel grande fijo de la multiplicación está además en la interfaz, arriba.)
 */
export class ForkSigns {
  readonly group = new THREE.Group();
  private readonly boards: Board[] = [];
  /** Posición s de las vallas laterales (el decorado deja ese hueco libre). */
  readonly questionS: number;

  constructor(layout: TrackLayout, f: ForkLayout, q: Question) {
    this.questionS = f.apexS - CFG.questionSignBefore;
    const sq = this.questionS;
    const qx = axisX(layout, sq);
    const qz = -sq;
    for (const side of [-1, 1] as Side[]) {
      const x = qx + side * (CFG.halfRoad + 6.5);
      const qTex = makeBoardTexture(`${q.a} × ${q.b} = ?`, {
        w: 1024,
        h: 384,
        bg: '#1f4fd8',
        fg: '#ffffff',
        border: '#ffd23f',
        outline: '#102a7a',
        font: 230,
      });
      this.group.add(post(x - 2.6, qz, 3.6, '#1d2b6b', 0.22), post(x + 2.6, qz, 3.6, '#1d2b6b', 0.22));
      const board = new Board(qTex, 8.6, 3.2, true, '#ffd23f', 1.5);
      board.pivot.position.set(x, 3.6, qz);
      board.pivot.rotation.y = -side * 0.38; // mira hacia la carretera
      this.group.add(board.pivot);
      this.boards.push(board);
    }

    // Carteles de resultado, uno por rama
    const su = f.apexS + CFG.answerSignU;
    for (const side of [-1, 1] as Side[]) {
      const e = branchEdges(layout, f, side, su, true);
      const cx = (e.outer + e.inner) / 2;
      const z = -su;
      this.group.add(post(e.outer + side * 0.9, z, POST_H, '#1d2b6b', 0.22), post(e.inner - side * 0.9, z, POST_H, '#1d2b6b', 0.22));
      const bm = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(e.outer - e.inner) + 2.2, 0.4, 0.4), toon('#1d2b6b'));
      bm.position.set(cx, POST_H, z);
      this.group.add(bm);
      const value = q.options[side === -1 ? 0 : 1];
      const tex = makeBoardTexture(String(value), {
        w: 512,
        h: 320,
        bg: '#ffd23f',
        fg: '#1d2b6b',
        border: '#ff4b3e',
        outline: '#ffffff',
        font: 250,
      });
      const board = new Board(tex, 7.0, 4.4, true, '#ff4b3e', 2.8);
      board.pivot.position.set(cx, POST_H + 0.2, z);
      this.group.add(board.pivot);
      this.boards.push(board);
    }
  }

  show(): void {
    for (const b of this.boards) b.show();
  }

  hide(): void {
    for (const b of this.boards) b.hide();
  }

  update(cam: THREE.Vector3, dt: number): void {
    for (const b of this.boards) b.update(cam, dt);
  }
}

/** Pórtico con la meta a cuadros. */
export function buildFinishGantry(layout: TrackLayout): THREE.Group {
  const g = new THREE.Group();
  const s = layout.finishS;
  const x = axisX(layout, s);
  const z = -s;
  g.add(post(x - CFG.halfRoad - 1.2, z, 8), post(x + CFG.halfRoad + 1.2, z, 8));
  const tex = makeBoardTexture('¡META!', {
    w: 1024,
    h: 300,
    bg: '#ffffff',
    fg: '#ff4b3e',
    border: '#1d2b6b',
    outline: '#1d2b6b',
    font: 220,
  });
  const board = new Board(tex, 15, 4.4, false, '#1d2b6b');
  board.pivot.position.set(x, 7.4, z);
  board.pivot.visible = true;
  board.pivot.scale.setScalar(1);
  g.add(board.pivot);
  const checker = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.halfRoad * 2 + 2.4, 1.2),
    new THREE.MeshBasicMaterial({ map: makeCheckerTexture(20, 2), fog: false }),
  );
  checker.position.set(x, 7.0, z + 0.15);
  g.add(checker);
  return g;
}
