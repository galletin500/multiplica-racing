import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CFG } from '../config';
import type { Pose } from '../sim';
import { toon } from './materials';

const WHEEL_R = 0.46;

interface WheelRig {
  steer: THREE.Group;
  spin: THREE.Group;
  front: boolean;
}

/** Coche de carreras de dibujos animados: redondeado, con ojos y sonrisa. El morro apunta a -Z. */
export class Car {
  /** Posición + giro (yaw). */
  readonly root = new THREE.Group();
  private readonly pivot = new THREE.Group();
  private readonly model = new THREE.Group();
  private readonly wheels: WheelRig[] = [];
  private readonly shadow: THREE.Mesh;
  private bobTime = 0;

  constructor() {
    this.root.add(this.pivot);
    this.pivot.position.y = 0.9; // pivote central: giros y vuelcos alrededor del centro
    this.pivot.add(this.model);
    this.model.position.y = -0.9;

    const red = toon('#ff4b3e');
    const white = toon('#ffffff');
    const glass = toon('#8fe3ff');
    const yellow = toon('#ffd23f');
    const navy = toon('#1d2b6b');
    const dark = toon('#2b2f4a');

    const box = (w: number, h: number, d: number, r: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh => {
      const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat);
      m.position.set(x, y, z);
      this.model.add(m);
      return m;
    };

    // Carrocería
    box(2.0, 0.78, 3.7, 0.32, red, 0, 0.78, 0);
    box(2.06, 0.22, 3.76, 0.1, white, 0, 0.5, 0); // faldón blanco
    // Cabina de cristal + techo
    box(1.5, 0.72, 1.55, 0.3, glass, 0, 1.4, 0.45);
    box(1.58, 0.14, 1.66, 0.07, white, 0, 1.78, 0.45);
    // Franja de carreras en el capó
    box(0.42, 0.04, 1.25, 0.02, white, 0, 1.18, -1.1);
    // Alerón
    box(0.1, 0.5, 0.12, 0.03, navy, -0.7, 1.3, 1.62);
    box(0.1, 0.5, 0.12, 0.03, navy, 0.7, 1.3, 1.62);
    box(2.2, 0.1, 0.6, 0.05, yellow, 0, 1.58, 1.7);

    // Ojos grandes en el capó
    for (const sx of [-0.5, 0.5]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), white);
      eye.position.set(sx, 1.3, -1.12);
      this.model.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), navy);
      pupil.position.set(sx * 0.9, 1.3, -1.42);
      this.model.add(pupil);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      glint.position.set(sx * 0.9 + 0.06, 1.36, -1.57);
      this.model.add(glint);
    }
    // Sonrisa
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.065, 8, 20, Math.PI), navy);
    smile.rotation.z = Math.PI;
    smile.position.set(0, 0.86, -1.87);
    this.model.add(smile);
    // Faros y pilotos
    const lamp = new THREE.MeshBasicMaterial({ color: '#fff3a8' });
    const tail = new THREE.MeshBasicMaterial({ color: '#ff2a3a' });
    for (const sx of [-0.72, 0.72]) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), lamp);
      l.position.set(sx, 0.9, -1.8);
      this.model.add(l);
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.08), tail);
      t.position.set(sx, 0.95, 1.86);
      this.model.add(t);
    }

    // Ruedas
    const tireGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.44, 18);
    tireGeo.rotateZ(Math.PI / 2);
    const hubGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.48, 12);
    hubGeo.rotateZ(Math.PI / 2);
    const capGeo = new THREE.BoxGeometry(0.5, 0.08, 0.12);
    for (const [sx, sz, front] of [
      [-1.06, -1.2, true],
      [1.06, -1.2, true],
      [-1.06, 1.18, false],
      [1.06, 1.18, false],
    ] as [number, number, boolean][]) {
      const steer = new THREE.Group();
      steer.position.set(sx, WHEEL_R, sz);
      const spin = new THREE.Group();
      spin.add(new THREE.Mesh(tireGeo, dark), new THREE.Mesh(hubGeo, yellow));
      // Una "pala" en el buje para que se vea girar la rueda
      const spoke = new THREE.Mesh(capGeo, white);
      spoke.position.x = sx > 0 ? 0.0 : 0.0;
      spin.add(spoke);
      steer.add(spin);
      this.model.add(steer);
      this.wheels.push({ steer, spin, front });
    }

    // Sombra blanda
    const shGeo = new THREE.CircleGeometry(1.0, 20);
    shGeo.rotateX(-Math.PI / 2);
    this.shadow = new THREE.Mesh(
      shGeo,
      new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.22, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    );
    this.shadow.scale.set(1.6, 1, 2.5);
    this.shadow.position.y = 0.04;
    this.root.add(this.shadow);
  }

  setPose(p: Pose, dt: number, idle = false): void {
    this.bobTime += dt;
    this.root.position.set(p.x, p.y, p.z);
    this.root.rotation.set(0, p.yaw, 0);
    this.pivot.rotation.set(p.pitch, 0, p.roll, 'YXZ');
    // Pequeño bote de la suspensión (más con la velocidad)
    const bob = Math.sin(this.bobTime * (idle ? 3 : 17)) * (idle ? 0.025 : 0.018 + 0.012 * p.speedRatio);
    this.model.position.y = -0.9 + bob;

    const spinRate = (p.speedRatio * CFG.speed) / WHEEL_R;
    const steerAngle = Math.max(-0.5, Math.min(0.5, -p.steer * 0.045));
    for (const w of this.wheels) {
      w.spin.rotation.x -= spinRate * dt;
      w.steer.rotation.y = w.front ? steerAngle : 0;
    }
    this.shadow.visible = Math.abs(p.y) < 0.01; // sin sombra mientras vuela o cae
    const lift = Math.max(0, p.y);
    this.shadow.scale.set(1.6 / (1 + lift * 0.3), 1, 2.5 / (1 + lift * 0.3));
  }
}
