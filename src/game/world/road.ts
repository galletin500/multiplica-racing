import * as THREE from 'three';
import { CFG } from '../config';
import { axisX, branchEdges, smoothstep, type ForkLayout, type TrackLayout } from '../track';
import type { Side } from '../types';
import { PAL } from './palette';
import { GRASS_TILE, ROAD_TILE, makeCheckerTexture, makeGrassTexture, makeRoadTexture } from './textures';

const STEP = 2.5;

type RGB = [number, number, number];
const rgb = (hex: string): RGB => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
const WHITE: RGB = [1, 1, 1];

/** Acumulador de geometría con atributos de posición, normal, uv y color. */
class Geo {
  private pos: number[] = [];
  private nor: number[] = [];
  private uv: number[] = [];
  private col: number[] = [];
  private idx: number[] = [];

  vert(x: number, y: number, z: number, nx: number, ny: number, nz: number, u: number, v: number, c: RGB): number {
    this.pos.push(x, y, z);
    this.nor.push(nx, ny, nz);
    this.uv.push(u, v);
    this.col.push(c[0], c[1], c[2]);
    return this.pos.length / 3 - 1;
  }

  tri(a: number, b: number, c: number): void {
    this.idx.push(a, b, c);
  }

  get empty(): boolean {
    return this.idx.length === 0;
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(this.idx), 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

type EdgeFn = (s: number) => number;

function samples(s0: number, s1: number): number[] {
  const n = Math.max(2, Math.ceil((s1 - s0) / STEP));
  const out: number[] = [];
  for (let k = 0; k <= n; k++) out.push(s0 + ((s1 - s0) * k) / n);
  return out;
}

/** Superficie horizontal entre dos bordes (izquierdo/derecho), orientada hacia arriba. */
function addTop(g: Geo, s0: number, s1: number, left: EdgeFn, right: EdgeFn, y: number, tile: number, c: RGB = WHITE): void {
  const ss = samples(s0, s1);
  let prev: [number, number] | null = null;
  for (const s of ss) {
    const z = -s;
    const v = s / tile;
    const a = g.vert(left(s), y, z, 0, 1, 0, 0, v, c);
    const b = g.vert(right(s), y, z, 0, 1, 0, 1, v, c);
    if (prev) {
      g.tri(prev[0], prev[1], a);
      g.tri(prev[1], b, a);
    }
    prev = [a, b];
  }
}

interface Band {
  y0: number;
  y1: number;
  c0: RGB;
  c1: RGB;
}

/** Pared vertical lateral. out = -1 mira hacia -X (borde izquierdo), +1 hacia +X (derecho). */
function addWall(g: Geo, s0: number, s1: number, edge: EdgeFn, out: Side, bands: Band[]): void {
  const ss = samples(s0, s1);
  for (const band of bands) {
    let prev: [number, number] | null = null;
    for (const s of ss) {
      const x = edge(s);
      const z = -s;
      const t = g.vert(x, band.y0, z, out, 0, 0, 0, 0, band.c0);
      const b = g.vert(x, band.y1, z, out, 0, 0, 0, 1, band.c1);
      if (prev) {
        if (out === -1) {
          g.tri(prev[0], t, prev[1]);
          g.tri(t, b, prev[1]);
        } else {
          g.tri(prev[0], prev[1], t);
          g.tri(t, prev[1], b);
        }
      }
      prev = [t, b];
    }
  }
}

/** Pared frontal (mira hacia -Z): el borde de un precipicio. */
function addCap(g: Geo, s: number, xl: number, xr: number, bands: Band[]): void {
  const z = -s;
  for (const band of bands) {
    const a = g.vert(xl, band.y0, z, 0, 0, -1, 0, 0, band.c0);
    const b = g.vert(xr, band.y0, z, 0, 0, -1, 1, 0, band.c0);
    const c = g.vert(xr, band.y1, z, 0, 0, -1, 1, 1, band.c1);
    const d = g.vert(xl, band.y1, z, 0, 0, -1, 0, 1, band.c1);
    g.tri(a, c, b);
    g.tri(a, d, c);
  }
}

export interface BankInfo {
  s0: number;
  s1: number;
  /** Borde del asfalto junto al que nace el arcén. */
  edge: EdgeFn;
  out: Side;
  width: EdgeFn;
}

interface RoadMats {
  stem: THREE.MeshLambertMaterial;
  branch: THREE.MeshLambertMaterial;
  grass: THREE.MeshLambertMaterial;
  wall: THREE.MeshLambertMaterial;
  checker: THREE.MeshBasicMaterial;
}

let shared: RoadMats | null = null;

function roadMats(): RoadMats {
  if (shared) return shared;
  const stemTex = makeRoadTexture(CFG.halfRoad * 2, true);
  const branchTex = makeRoadTexture(CFG.halfRoad, false);
  const grassTex = makeGrassTexture();
  const checkerTex = makeCheckerTexture(16, 2);
  for (const t of [stemTex, branchTex, grassTex, checkerTex]) t.userData.shared = true;
  const mk = <T extends THREE.Material>(m: T): T => {
    m.userData.shared = true;
    return m;
  };
  shared = {
    stem: mk(new THREE.MeshLambertMaterial({ map: stemTex })),
    branch: mk(new THREE.MeshLambertMaterial({ map: branchTex })),
    grass: mk(new THREE.MeshLambertMaterial({ map: grassTex, vertexColors: true })),
    wall: mk(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })),
    checker: mk(new THREE.MeshBasicMaterial({ map: checkerTex, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })),
  };
  // Las texturas del asfalto necesitan vértices sin color
  return shared;
}

const T = CFG.slabDepth;
const WALL_BANDS: Band[] = [
  { y0: -0.04, y1: -0.9, c0: rgb(PAL.lip), c1: rgb('#3fa633') },
  { y0: -0.9, y1: -T * 0.5, c0: rgb(PAL.rockTop), c1: rgb(PAL.rockMid) },
  { y0: -T * 0.5, y1: -T, c0: rgb(PAL.rockMid), c1: rgb(PAL.rockDeep) },
];
/** Bandas para la pared interior (sin arcén de césped): roca desde el borde del asfalto. */
const INNER_BANDS: Band[] = [
  { y0: 0, y1: -0.45, c0: rgb('#f2e3c6'), c1: rgb('#f2e3c6') }, // bordillo claro
  { y0: -0.45, y1: -T * 0.5, c0: rgb(PAL.rockTop), c1: rgb(PAL.rockMid) },
  { y0: -T * 0.5, y1: -T, c0: rgb(PAL.rockMid), c1: rgb(PAL.rockDeep) },
];

/**
 * Construye las mallas de la carretera: tronco, ramas de la Y (la correcta se
 * vuelve a unir; la incorrecta acaba en un precipicio), arcenes y paredes de roca.
 */
export class RoadBuilder {
  readonly group = new THREE.Group();
  readonly banks: BankInfo[] = [];
  private readonly mats = roadMats();

  constructor(
    private readonly layout: TrackLayout,
    private readonly correctSides: readonly Side[],
  ) {}

  build(): THREE.Group {
    const { forks } = this.layout;
    for (const f of forks) {
      this.stem(f.stemStartS, f.apexS, f.prevCorrectSide === 0 ? 0 : ((-f.prevCorrectSide) as Side), false);
      for (const side of [-1, 1] as Side[]) {
        this.branch(f, side, side === this.correctSides[f.index]);
      }
    }
    const last = forks[forks.length - 1];
    this.stem(last.mergeS, this.layout.endS, (-this.correctSides[last.index]) as Side, true);
    this.startLine();
    return this.group;
  }

  private mesh(g: Geo, mat: THREE.Material): void {
    if (g.empty) return;
    const m = new THREE.Mesh(g.build(), mat);
    this.group.add(m);
  }

  private stem(s0: number, s1: number, taperSide: Side | 0, capEnd: boolean): void {
    const L: EdgeFn = (s) => axisX(this.layout, s) - CFG.halfRoad;
    const R: EdgeFn = (s) => axisX(this.layout, s) + CFG.halfRoad;
    const taper: EdgeFn = (s) => CFG.bankWidth * smoothstep((s - s0) / 10);
    const bwL: EdgeFn = taperSide === -1 ? taper : () => CFG.bankWidth;
    const bwR: EdgeFn = taperSide === 1 ? taper : () => CFG.bankWidth;
    const outL: EdgeFn = (s) => L(s) - bwL(s);
    const outR: EdgeFn = (s) => R(s) + bwR(s);

    const asphalt = new Geo();
    addTop(asphalt, s0, s1, L, R, 0, ROAD_TILE);
    this.mesh(asphalt, this.mats.stem);

    const grass = new Geo();
    const green = rgb('#ffffff');
    addTop(grass, s0, s1, outL, L, -0.04, GRASS_TILE, green);
    addTop(grass, s0, s1, R, outR, -0.04, GRASS_TILE, green);
    this.mesh(grass, this.mats.grass);

    const walls = new Geo();
    addWall(walls, s0, s1, outL, -1, WALL_BANDS);
    addWall(walls, s0, s1, outR, 1, WALL_BANDS);
    if (capEnd) addCap(walls, s1, outL(s1), outR(s1), WALL_BANDS);
    this.mesh(walls, this.mats.wall);

    this.banks.push({ s0, s1, edge: L, out: -1, width: bwL });
    this.banks.push({ s0, s1, edge: R, out: 1, width: bwR });
  }

  private branch(f: ForkLayout, side: Side, correct: boolean): void {
    const s0 = f.apexS;
    const s1 = correct ? f.mergeS : f.cutS;
    const outer: EdgeFn = (s) => branchEdges(this.layout, f, side, s, correct).outer;
    const inner: EdgeFn = (s) => branchEdges(this.layout, f, side, s, correct).inner;
    const bank: EdgeFn = () => CFG.bankWidth;
    const bankOuter: EdgeFn = (s) => outer(s) + side * CFG.bankWidth;

    const left = side === -1 ? outer : inner;
    const right = side === -1 ? inner : outer;

    const asphalt = new Geo();
    addTop(asphalt, s0, s1, left, right, 0, ROAD_TILE);
    this.mesh(asphalt, this.mats.branch);

    const grass = new Geo();
    if (side === -1) addTop(grass, s0, s1, bankOuter, outer, -0.04, GRASS_TILE);
    else addTop(grass, s0, s1, outer, bankOuter, -0.04, GRASS_TILE);
    this.mesh(grass, this.mats.grass);

    const walls = new Geo();
    addWall(walls, s0, s1, bankOuter, side, WALL_BANDS);
    // pared interior: mira hacia el barranco que queda entre las dos ramas
    addWall(walls, s0, s1, inner, (-side) as Side, INNER_BANDS);
    if (!correct) {
      const xl = side === -1 ? bankOuter(s1) : inner(s1);
      const xr = side === -1 ? inner(s1) : bankOuter(s1);
      addCap(walls, s1, xl, xr, INNER_BANDS);
    }
    this.mesh(walls, this.mats.wall);

    this.banks.push({ s0, s1, edge: outer, out: side, width: bank });
  }

  private startLine(): void {
    const geo = new THREE.PlaneGeometry(CFG.halfRoad * 2 - 2.2, 1.6);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, this.mats.checker);
    const s = 16;
    m.position.set(axisX(this.layout, s), 0.02, -s);
    this.group.add(m);
  }

  /** Línea de meta pintada sobre el asfalto. */
  finishLine(): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(CFG.halfRoad * 2 - 2.2, 2.4);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, this.mats.checker);
    const s = this.layout.finishS;
    m.position.set(axisX(this.layout, s), 0.02, -s);
    return m;
  }
}
