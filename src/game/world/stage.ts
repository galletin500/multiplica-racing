import * as THREE from 'three';
import { CFG } from '../config';
import { PAL } from './palette';

/** Renderizador, escena, luces y cámara. */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.3, 1000);

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene.background = new THREE.Color(PAL.fog);
    this.scene.fog = new THREE.Fog(PAL.fog, CFG.fogNear, CFG.fogFar);

    const hemi = new THREE.HemisphereLight('#ffffff', '#9ed6a0', 1.55);
    const sun = new THREE.DirectionalLight('#fff4d6', 2.1);
    sun.position.set(-30, 60, 40);
    this.scene.add(hemi, sun);
    this.resize();
  }

  resize(): void {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Campo de visión vertical adaptado: queremos ~80° horizontales, entre 55° y 80° verticales.
    const aspect = w / h;
    const vfov = (2 * Math.atan(Math.tan((80 * Math.PI) / 360) / aspect) * 180) / Math.PI;
    this.baseFov = Math.max(55, Math.min(80, vfov));
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
  }

  baseFov = 62;

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
