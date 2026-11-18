import * as THREE from 'three';
import { mulberry32, range } from '../rng';
import { PAL } from './palette';
import { makeSunTexture } from './textures';

/**
 * Cielo diurno: degradado, sol sonriente, arcoíris, nubes y montañas lejanas.
 * Se mueve con la cámara (x,z) para parecer infinito. No le afecta la niebla.
 */
export class Sky {
  readonly group = new THREE.Group();
  private readonly clouds = new THREE.Group();
  private t = 0;

  constructor() {
    // Cúpula con degradado
    const geo = new THREE.SphereGeometry(620, 24, 16);
    const col: number[] = [];
    const top = new THREE.Color(PAL.skyTop);
    const mid = new THREE.Color(PAL.sky);
    const hor = new THREE.Color(PAL.fog);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const h = pos.getY(i) / 620; // -1..1
      const c = new THREE.Color();
      if (h > 0.25) c.copy(mid).lerp(top, Math.min(1, (h - 0.25) / 0.6));
      else if (h > -0.02) c.copy(hor).lerp(mid, Math.max(0, h + 0.02) / 0.27);
      else c.copy(hor);
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    dome.renderOrder = -10;
    this.group.add(dome);

    // Sol sonriente
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeSunTexture(), fog: false, depthWrite: false }));
    sun.position.set(-190, 230, -480);
    sun.scale.set(120, 120, 1);
    this.group.add(sun);

    // Arcoíris
    const colors = ['#ff4b3e', '#ff9a3a', '#ffd23f', '#6cdc4f', '#3fb6ff', '#5b6bff', '#b07cff'];
    colors.forEach((c, i) => {
      const r = 230 - i * 7.5;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, 3.9, 6, 56, Math.PI),
        new THREE.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: 0.78, depthWrite: false }),
      );
      ring.position.set(95, -40, -520);
      this.group.add(ring);
    });

    // Montañas lejanas (silueta azulada)
    const rng = mulberry32(77);
    const far = new THREE.MeshLambertMaterial({ color: '#a8c6f2', fog: false });
    const far2 = new THREE.MeshLambertMaterial({ color: '#bcd3f7', fog: false });
    const snow = new THREE.MeshLambertMaterial({ color: '#ffffff', fog: false });
    const coneGeo = new THREE.ConeGeometry(1, 1, 6);
    for (let i = 0; i < 26; i++) {
      const ang = (-1 + (2 * i) / 25) * 1.45 + range(rng, -0.05, 0.05);
      const dist = range(rng, 430, 520);
      const R = range(rng, 70, 130);
      const H = range(rng, 90, 170);
      const m = new THREE.Mesh(coneGeo, i % 2 ? far : far2);
      m.scale.set(R, H, R);
      m.position.set(Math.sin(ang) * dist, H / 2 - 40, -Math.cos(ang) * dist);
      this.group.add(m);
      const cap = new THREE.Mesh(coneGeo, snow);
      cap.scale.set(R * 0.3, H * 0.3, R * 0.3);
      cap.position.set(m.position.x, H - 40 - H * 0.15 + 0.5, m.position.z);
      this.group.add(cap);
    }

    // Nubes
    const cloudMat = new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false });
    const puff = new THREE.IcosahedronGeometry(1, 1);
    for (let i = 0; i < 22; i++) {
      const c = new THREE.Group();
      const n = 4 + Math.floor(rng() * 3);
      for (let j = 0; j < n; j++) {
        const m = new THREE.Mesh(puff, cloudMat);
        const r = range(rng, 9, 17);
        m.scale.set(r * 1.2, r * 0.8, r);
        m.position.set((j - n / 2) * 15 + range(rng, -4, 4), range(rng, -3, 5), range(rng, -5, 5));
        c.add(m);
      }
      const ang = range(rng, -1.7, 1.7);
      const dist = range(rng, 300, 480);
      c.position.set(Math.sin(ang) * dist, range(rng, 70, 190), -Math.cos(ang) * dist);
      this.clouds.add(c);
    }
    this.group.add(this.clouds);
  }

  update(cam: THREE.Vector3, dt: number): void {
    this.t += dt;
    this.group.position.set(cam.x, 0, cam.z);
    this.clouds.position.x = Math.sin(this.t * 0.05) * 25;
  }
}
