import * as THREE from 'three';
import { CFG } from '../config';
import type { Phase, Pose } from '../sim';

/** Cámara de tercera persona detrás del coche, y órbita para el menú. */
export class CameraRig {
  private readonly pos = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private initialized = false;
  private fovKick = 0;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly getBaseFov: () => number,
  ) {}

  reset(): void {
    this.initialized = false;
    this.wasFalling = false;
    this.fovKick = 0;
  }

  private readonly touchLayout = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  private wasFalling = false;
  private readonly anchor = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();

  /** Cámara de seguimiento: tras el coche, algo elevada, mirando hacia delante. */
  follow(p: Pose, phase: Phase, dt: number): void {
    // En pantallas táctiles los botones ocupan la parte baja: subimos la imagen para que no tapen el coche.
    if (this.touchLayout) this.setOffset(0, this.camera.aspect < 1 ? -0.05 : -0.08);
    else this.clearOffset();
    const falling = phase === 'falling' || phase === 'lost';

    if (falling) {
      // En la caída la cámara sube un poco y se adelanta sobre el vacío (así el borde de la
      // carretera no tapa al coche) y mira cómo el coche se pierde en la niebla.
      if (!this.wasFalling) {
        this.anchor.copy(this.camera.position);
        this.anchor.y = Math.max(this.anchor.y, 4.5);
        this.wasFalling = true;
      }
      const cp = this.camera.position;
      cp.x += (p.x * 0.8 - cp.x) * (1 - Math.exp(-2 * dt));
      cp.y += (this.anchor.y + 5 - cp.y) * (1 - Math.exp(-1.6 * dt));
      cp.z += (Math.max(Math.min(this.anchor.z, p.z + 7), this.anchor.z - 12) - cp.z) * (1 - Math.exp(-2.4 * dt));
      // La inclinación hacia abajo se limita (~40°) para ver barranco y montañas, no el asfalto.
      const hd = Math.hypot(p.x - cp.x, p.z - cp.z);
      const lookY = Math.max(p.y + 0.6, cp.y - hd * 0.85);
      this.look.lerp(this.tmp.set(p.x, lookY, p.z), 1 - Math.exp(-8 * dt));
      this.camera.lookAt(this.look);
      this.pos.copy(cp);
      const fov = this.getBaseFov() - Math.min(12, Math.max(0, -p.y) * 0.2); // pequeño "zoom" al caer
      if (Math.abs(this.camera.fov - fov) > 0.01) {
        this.camera.fov = fov;
        this.camera.updateProjectionMatrix();
      }
      return;
    }
    this.wasFalling = false;

    const portrait = this.camera.aspect < 1;
    const back = portrait ? 11.5 : 9.2;
    const height = portrait ? 5.6 : 4.5;

    const wantX = p.x * 0.78;
    const wantY = height;
    const wantZ = p.z + back;
    if (!this.initialized) {
      this.pos.set(wantX, wantY, wantZ);
      this.look.set(p.x, 1.7, p.z - 15);
      this.initialized = true;
    }
    this.pos.x += (wantX - this.pos.x) * (1 - Math.exp(-5 * dt));
    this.pos.y += (wantY - this.pos.y) * (1 - Math.exp(-4 * dt));
    this.pos.z = wantZ;
    this.camera.position.copy(this.pos);

    this.look.set(p.x * 0.9 + (this.pos.x - p.x) * 0.1, 1.7, p.z - 15);
    this.camera.lookAt(this.look);

    // Un poco de "sensación de velocidad" con el campo de visión
    const target = 3 * Math.min(1, p.speedRatio);
    this.fovKick += (target - this.fovKick) * (1 - Math.exp(-3 * dt));
    const fov = this.getBaseFov() + this.fovKick;
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  private hasOffset = false;

  /** Desplaza la imagen (fracción del ancho/alto) para dejar sitio a los textos de los menús. */
  private setOffset(fx: number, fy: number): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (fx === 0 && fy === 0) {
      if (this.hasOffset) {
        this.camera.clearViewOffset();
        this.hasOffset = false;
      }
      return;
    }
    this.camera.setViewOffset(w, h, -w * fx, -h * fy, w, h);
    this.hasOffset = true;
  }

  clearOffset(): void {
    this.setOffset(0, 0);
  }

  /**
   * Órbita lenta (±35°) alrededor del coche, que mira hacia la cámara (pantallas de menú).
   * En "title" la imagen se desplaza para que el coche no quede detrás del título.
   */
  orbit(center: THREE.Vector3, t: number, screen: 'title' | 'levels'): void {
    const a = Math.sin(t * 0.35) * 0.62;
    const portrait = this.camera.aspect < 1;
    const r = portrait ? 10.5 : 8.2;
    this.camera.position.set(center.x + Math.sin(a) * r, 2.6 + Math.sin(t * 0.5) * 0.25, center.z + Math.cos(a) * r);
    this.camera.lookAt(center.x, 1.15, center.z);
    const fov = this.getBaseFov() - 8;
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    if (screen === 'title') this.setOffset(portrait ? 0 : 0.2, portrait ? 0.2 : 0);
    else this.setOffset(0, 0);
  }
}

void CFG;
