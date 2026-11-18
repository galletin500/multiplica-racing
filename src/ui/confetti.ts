interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  color: string;
  star: boolean;
}

const COLORS = ['#ff4b3e', '#ffd23f', '#3fb6ff', '#6cdc4f', '#ff7ab8', '#b07cff', '#ff8a1f'];

/** Lluvia de confeti y estrellas sobre un canvas 2D. */
export class Confetti {
  private pieces: Piece[] = [];
  private running = false;
  private ctx: CanvasRenderingContext2D;
  private last = 0;
  private spawnLeft = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  private fit(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  start(): void {
    this.fit();
    this.pieces = [];
    this.spawnLeft = 4.5; // segundos generando
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  stop(): void {
    this.running = false;
    this.pieces = [];
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private spawn(n: number): void {
    const W = this.canvas.width;
    const s = Math.max(1, W / 900);
    for (let i = 0; i < n; i++) {
      this.pieces.push({
        x: Math.random() * W,
        y: -20 * s,
        vx: (Math.random() - 0.5) * 140 * s,
        vy: (120 + Math.random() * 220) * s,
        rot: Math.random() * 6.28,
        vr: (Math.random() - 0.5) * 9,
        size: (8 + Math.random() * 11) * s,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        star: Math.random() < 0.28,
      });
    }
  }

  private frame(now: number): void {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (this.spawnLeft > 0) {
      this.spawnLeft -= dt;
      this.spawn(Math.ceil(dt * 90));
    }
    for (const p of this.pieces) {
      p.x += p.vx * dt + Math.sin(p.y * 0.02 + p.rot) * 0.6;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.star) {
        this.star(p.size);
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6);
      }
      ctx.restore();
    }
    this.pieces = this.pieces.filter((p) => p.y < canvas.height + 40);
    if (this.spawnLeft > 0 || this.pieces.length > 0) requestAnimationFrame((t) => this.frame(t));
    else this.running = false;
  }

  private star(r: number): void {
    const { ctx } = this;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : r * 0.45;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fill();
  }
}
