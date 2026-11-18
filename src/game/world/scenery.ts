import * as THREE from 'three';
import { axisX, type TrackLayout } from '../track';
import { type Rng, pick, range } from '../rng';
import type { Side } from '../types';
import { toon } from './materials';
import type { BankInfo } from './road';
import { makeLollipopTexture } from './textures';

const CHUNK = 180;

interface Kind {
  name: string;
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
}

interface Bucket {
  kind: Kind;
  mats: number[];
  cols: number[];
}

const GREENS = ['#2f9e4f', '#38b255', '#2a8f55', '#46bf5a', '#3aa86a'];
const CANOPY = ['#58c94a', '#7ad84a', '#ff7aa8', '#ffa63d', '#3fb86a', '#9ae04a'];
const ROCKS = ['#a9a2a0', '#968f95', '#b9a692', '#8b8794'];
const FLOWERS = ['#ff4b3e', '#ffd23f', '#ff7ab8', '#ffffff', '#b07cff', '#ff9a3a'];
const BALLOONS = ['#ff4b3e', '#ffd23f', '#3fb6ff', '#6cdc4f', '#ff7ab8', '#b07cff'];
const MOUNTAINS = ['#5fbf72', '#4fb08c', '#6fc27c', '#79b8d6'];

/**
 * Decorado: árboles, arbustos, rocas, flores, globos, balizas, colinas, montañas y nubes.
 * Todo se agrupa en mallas instanciadas por "trozos" de pista, de modo que Three.js
 * solo dibuja lo que está cerca de la cámara (importante en móviles).
 */
export class Scenery {
  readonly group = new THREE.Group();
  private readonly buckets = new Map<string, Bucket>();
  private readonly kinds: Record<string, Kind>;

  private readonly m4 = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly p = new THREE.Vector3();
  private readonly sc = new THREE.Vector3();
  private readonly color = new THREE.Color();

  constructor(
    private readonly layout: TrackLayout,
    private readonly banks: BankInfo[],
    private readonly rng: Rng,
    /** Posiciones s donde hay vallas con carteles: el decorado deja libre ese tramo del arcén. */
    private readonly keepClear: readonly number[] = [],
  ) {
    const k = (name: string, geo: THREE.BufferGeometry, mat: THREE.Material): Kind => ({ name, geo, mat });
    const white = (): THREE.MeshToonMaterial => toon('#ffffff');
    this.kinds = {
      trunk: k('trunk', new THREE.CylinderGeometry(0.26, 0.34, 1.3, 7), toon('#8a5a3c')),
      pine1: k('pine1', new THREE.ConeGeometry(1.75, 2.7, 8), white()),
      pine2: k('pine2', new THREE.ConeGeometry(1.3, 2.3, 8), white()),
      canopy: k('canopy', new THREE.IcosahedronGeometry(1.75, 1), white()),
      bush: k('bush', new THREE.IcosahedronGeometry(0.95, 1), white()),
      rock: k('rock', new THREE.DodecahedronGeometry(0.95, 0), white()),
      flower: k('flower', new THREE.SphereGeometry(0.24, 7, 5), white()),
      bollard: k('bollard', new THREE.CylinderGeometry(0.2, 0.24, 1.0, 8), white()),
      balloon: k('balloon', new THREE.SphereGeometry(0.95, 10, 8), white()),
      string: k('string', new THREE.CylinderGeometry(0.03, 0.03, 4.4, 4), new THREE.MeshBasicMaterial({ color: '#ffffff' })),
      hill: k('hill', new THREE.IcosahedronGeometry(1, 2), toon('#ffffff')),
      mountain: k('mountain', new THREE.ConeGeometry(1, 1, 6), toon('#ffffff')),
      snow: k('snow', new THREE.ConeGeometry(1, 1, 6), toon('#ffffff')),
      puff: k('puff', new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#ffffff' })),
    };
  }

  private add(kind: string, x: number, y: number, z: number, rotY: number, sx: number, sy: number, sz: number, color: string, chunkSrc?: number): void {
    const K = this.kinds[kind];
    const chunk = Math.floor((chunkSrc ?? -z) / CHUNK);
    const key = `${chunk}:${kind}`;
    let b = this.buckets.get(key);
    if (!b) {
      b = { kind: K, mats: [], cols: [] };
      this.buckets.set(key, b);
    }
    this.e.set(0, rotY, 0);
    this.q.setFromEuler(this.e);
    this.p.set(x, y, z);
    this.sc.set(sx, sy, sz);
    this.m4.compose(this.p, this.q, this.sc);
    b.mats.push(...this.m4.elements);
    this.color.set(color);
    b.cols.push(this.color.r, this.color.g, this.color.b);
  }

  build(): THREE.Group {
    this.placeBanks();
    this.placeLandscape();
    this.placeLollipops();

    for (const b of this.buckets.values()) {
      const count = b.mats.length / 16;
      if (count === 0) continue;
      const mesh = new THREE.InstancedMesh(b.kind.geo, b.kind.mat, count);
      const arr = mesh.instanceMatrix.array as Float32Array;
      arr.set(b.mats);
      const col = new Float32Array(b.cols);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(col, 3);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      this.group.add(mesh);
    }
    return this.group;
  }

  // ───────────── arcenes ─────────────

  private placeBanks(): void {
    const rng = this.rng;
    for (const b of this.banks) {
      let s = b.s0 + range(rng, 0.5, 3);
      let bollardS = b.s0 + 4;
      while (s < b.s1 - 1) {
        const edgeX = b.edge(s);
        const bw = b.width(s);
        if (bw < 3.5) {
          s += 3;
          continue;
        }
        const at = (off: number) => edgeX + b.out * off;
        const z = -s;
        if (b.width(s) > 0 && this.keepClear.some((k) => Math.abs(k - s) < 6.5)) {
          s += 3;
          continue;
        }
        const r = rng();
        if (r < 0.4) this.tree(at(range(rng, 3.4, bw - 1.5)), z, range(rng, 0.85, 1.45));
        else if (r < 0.58) {
          const k = range(rng, 0.7, 1.4);
          this.add('bush', at(range(rng, 1.8, bw - 1)), 0.4 * k, z, rng() * 6, k, k * 0.72, k, pick(rng, GREENS));
        } else if (r < 0.7) {
          const k = range(rng, 0.7, 1.5);
          this.add('rock', at(range(rng, 1.9, bw - 1)), 0.3 * k, z, rng() * 6, k * 1.2, k * 0.7, k, pick(rng, ROCKS));
        } else if (r < 0.9) {
          const cx = at(range(rng, 1.8, bw - 1.2));
          const color = pick(rng, FLOWERS);
          for (let i = 0; i < 5; i++) {
            this.add('flower', cx + range(rng, -0.8, 0.8), 0.3, z + range(rng, -0.8, 0.8), 0, 1, 1, 1, color);
          }
        } else {
          this.balloons(at(range(rng, 3, bw - 1.5)), z);
        }
        s += range(rng, 3.4, 7.2);
      }
      // balizas rojiblancas junto al asfalto (dan sensación de velocidad)
      let alt = 0;
      for (; bollardS < b.s1 - 1; bollardS += 9) {
        const bw = b.width(bollardS);
        if (bw < 3.5) continue;
        this.add('bollard', b.edge(bollardS) + b.out * 1.5, 0.5, -bollardS, 0, 1, 1, 1, alt++ % 2 === 0 ? '#ff4b3e' : '#ffffff');
      }
    }
  }

  private tree(x: number, z: number, k: number): void {
    const rng = this.rng;
    if (rng() < 0.62) {
      const g = pick(rng, GREENS);
      this.add('trunk', x, 0.65 * k, z, 0, k, k, k, '#8a5a3c');
      this.add('pine1', x, (1.0 + 1.35) * k, z, rng() * 6, k, k, k, g);
      this.add('pine2', x, (2.5 + 1.15) * k, z, rng() * 6, k, k, k, g);
    } else {
      this.add('trunk', x, 0.65 * k, z, 0, k, 1.35 * k, k, '#8a5a3c');
      this.add('canopy', x, 2.55 * k, z, rng() * 6, k, k * 0.95, k, pick(rng, CANOPY));
    }
  }

  private balloons(x: number, z: number): void {
    const rng = this.rng;
    const n = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const bx = x + range(rng, -1.6, 1.6);
      const bz = z + range(rng, -1.6, 1.6);
      const by = range(rng, 6, 9.5);
      this.add('balloon', bx, by, bz, 0, 1, 1.2, 1, pick(rng, BALLOONS));
      this.add('string', bx, by - 1.2 - 2.2, bz, 0, 1, 1, 1, '#ffffff');
    }
  }

  // ───────────── paisaje lejano ─────────────

  private placeLandscape(): void {
    const rng = this.rng;
    const end = this.layout.endS;
    for (let s = -80; s < end + 120; s += 36) {
      for (const side of [-1, 1] as Side[]) {
        const ax = axisX(this.layout, Math.max(0, Math.min(end, s)));
        // Colinas redondeadas
        const hr = range(rng, 13, 24);
        this.add('hill', ax + side * range(rng, 64, 98), range(rng, -9, -4), -s + range(rng, -10, 10), 0, hr, hr * range(rng, 0.55, 0.8), hr, pick(rng, GREENS));
      }
    }
    for (let s = -80; s < end + 160; s += 58) {
      for (const side of [-1, 1] as Side[]) {
        const ax = axisX(this.layout, Math.max(0, Math.min(end, s)));
        const R = range(rng, 28, 46);
        const H = range(rng, 66, 105);
        const base = -58;
        const x = ax + side * range(rng, 86, 135);
        const z = -s + range(rng, -14, 14);
        const color = pick(rng, MOUNTAINS);
        this.add('mountain', x, base + H / 2, z, rng() * 6, R, H, R, color);
        const top = base + H;
        if (top > 6) {
          const f = 0.3;
          this.add('snow', x, base + H - (H * f) / 2 + 0.2, z, 0, R * f * 1.02, H * f, R * f * 1.02, '#ffffff');
        }
      }
    }
    // Nubes bajas dentro del barranco (dan profundidad bajo la carretera)
    for (let s = -40; s < end + 40; s += 22) {
      const ax = axisX(this.layout, Math.max(0, Math.min(end, s)));
      const n = 2 + Math.floor(rng() * 2);
      for (let i = 0; i < n; i++) {
        const r = range(rng, 5, 9);
        this.add('puff', ax + range(rng, -55, 55), range(rng, -48, -26), -s + range(rng, -10, 10), 0, r * 1.5, r * 0.8, r, '#ffffff');
      }
    }
  }

  private placeLollipops(): void {
    const rng = this.rng;
    const texA = makeLollipopTexture('#ff7ab8', '#ffffff');
    const texB = makeLollipopTexture('#ffa63d', '#fff3c4');
    const texC = makeLollipopTexture('#5fd3ff', '#ffffff');
    const stickMat = toon('#ffffff');
    const stickGeo = new THREE.CylinderGeometry(0.13, 0.13, 3.6, 6);
    const diskGeo = new THREE.CircleGeometry(1.9, 28);
    let flip = 1;
    const texes = [texA, texB, texC];
    let n = 0;
    for (const b of this.banks) {
      if (b.s1 - b.s0 < 60) continue;
      const s = b.s0 + range(rng, 20, b.s1 - b.s0 - 20);
      const bw = b.width(s);
      if (bw < 8) continue;
      const x = b.edge(s) + b.out * range(rng, 3.4, 6);
      const grp = new THREE.Group();
      const stick = new THREE.Mesh(stickGeo, stickMat);
      stick.position.y = 1.8;
      const disk = new THREE.Mesh(
        diskGeo,
        new THREE.MeshBasicMaterial({ map: texes[n++ % 3], side: THREE.DoubleSide, transparent: true, alphaTest: 0.4 }),
      );
      disk.position.y = 4.4;
      disk.rotation.y = -b.out * 0.45 * flip;
      flip *= -1;
      grp.add(stick, disk);
      grp.position.set(x, 0, -s);
      this.group.add(grp);
    }
    for (const t of texes) t.userData.shared = false;
  }
}
