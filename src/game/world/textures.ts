import * as THREE from 'three';
import { FONT_STACK, PAL } from './palette';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function finish(c: HTMLCanvasElement, repeatT = false, aniso = 4): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeatT) {
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  return t;
}

/** Longitud (en unidades) de una repetición de la textura del asfalto. */
export const ROAD_TILE = 8;

/** Asfalto con bordillos rojiblancos, líneas blancas de borde y (opcional) línea central discontinua. */
export function makeRoadTexture(widthUnits: number, centerDash: boolean): THREE.CanvasTexture {
  const W = 256;
  const H = 256;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = PAL.asphalt;
  ctx.fillRect(0, 0, W, H);

  // Granulado sutil
  for (let i = 0; i < 900; i++) {
    const v = Math.random();
    ctx.fillStyle = v < 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.07)';
    ctx.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 3, 2 + Math.random() * 3);
  }

  const px = (units: number) => (units / widthUnits) * W;
  const curb = px(0.55);
  // Bordillos: mitad roja / mitad blanca a lo largo de la repetición
  for (const x0 of [0, W - curb]) {
    ctx.fillStyle = PAL.red;
    ctx.fillRect(x0, 0, curb, H / 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x0, H / 2, curb, H / 2);
  }
  // Líneas blancas de borde
  const lineW = px(0.3);
  const lineX = px(1.05);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(lineX, 0, lineW, H);
  ctx.fillRect(W - lineX - lineW, 0, lineW, H);
  // Línea central discontinua
  if (centerDash) {
    const cw = px(0.38);
    ctx.fillStyle = '#ffe566';
    ctx.fillRect(W / 2 - cw / 2, 0, cw, H / 2);
  }
  return finish(c, true, 8);
}

export const GRASS_TILE = 12;

export function makeGrassTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 128);
  ctx.fillStyle = PAL.grassA;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = PAL.grassB;
  ctx.fillRect(0, 64, 128, 64);
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,70,0,0.10)';
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 5);
  }
  return finish(c, true, 4);
}

export interface BoardStyle {
  w: number;
  h: number;
  bg: string;
  fg: string;
  border: string;
  outline: string;
  font: number;
}

/** Cartel con texto grande y legible (multiplicación o resultado). */
export function makeBoardTexture(text: string, s: BoardStyle): THREE.CanvasTexture {
  const [c, ctx] = canvas(s.w, s.h);
  const r = s.h * 0.16;
  const bw = s.h * 0.06;
  const rr = (x: number, y: number, w: number, h: number, rad: number) => {
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  };
  ctx.fillStyle = s.border;
  rr(0, 0, s.w, s.h, r);
  ctx.fill();
  ctx.fillStyle = s.bg;
  rr(bw, bw, s.w - bw * 2, s.h - bw * 2, r * 0.7);
  ctx.fill();
  // brillo superior
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  rr(bw * 1.6, bw * 1.6, s.w - bw * 3.2, (s.h - bw * 2) * 0.32, r * 0.5);
  ctx.fill();

  ctx.font = `900 ${s.font}px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = s.font * 0.14;
  ctx.strokeStyle = s.outline;
  ctx.strokeText(text, s.w / 2, s.h / 2 + s.font * 0.04);
  ctx.fillStyle = s.fg;
  ctx.fillText(text, s.w / 2, s.h / 2 + s.font * 0.04);
  return finish(c, false, 8);
}

export function makeCheckerTexture(cols: number, rows: number): THREE.CanvasTexture {
  const [c, ctx] = canvas(cols * 32, rows * 32);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : '#1d2b6b';
      ctx.fillRect(x * 32, y * 32, 32, 32);
    }
  }
  const t = finish(c, false, 4);
  t.magFilter = THREE.NearestFilter;
  return t;
}

export function makeSunTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(256, 256);
  ctx.translate(128, 128);
  ctx.fillStyle = '#ffe27a';
  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6);
    ctx.beginPath();
    ctx.moveTo(-14, -86);
    ctx.lineTo(14, -86);
    ctx.lineTo(0, -122);
    ctx.closePath();
    ctx.fill();
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.beginPath();
  ctx.arc(128, 128, 78, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd23f';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#ffb81f';
  ctx.stroke();
  // cara sonriente
  ctx.fillStyle = '#1d2b6b';
  ctx.beginPath();
  ctx.arc(104, 112, 9, 0, Math.PI * 2);
  ctx.arc(152, 112, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(128, 128, 38, 0.25 * Math.PI, 0.75 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,120,120,0.45)';
  ctx.beginPath();
  ctx.arc(88, 142, 12, 0, Math.PI * 2);
  ctx.arc(168, 142, 12, 0, Math.PI * 2);
  ctx.fill();
  return finish(c, false, 2);
}

export function makeLollipopTexture(a: string, b: string): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 128);
  ctx.translate(64, 64);
  ctx.fillStyle = a;
  ctx.beginPath();
  ctx.arc(0, 0, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = b;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let t = 0; t < 9.5; t += 0.1) {
    const r = 4 + t * 5.6;
    const x = Math.cos(t * 1.1) * r;
    const y = Math.sin(t * 1.1) * r;
    if (t === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  return finish(c, false, 2);
}
