/**
 * Sonido 100 % sintetizado con WebAudio (sin archivos externos que puedan fallar).
 * Volúmenes moderados y timbres suaves, pensados para niños.
 */
const STORAGE_KEY = 'multiplica-racing:muted';

type Wave = OscillatorType;

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  private engine: { o1: OscillatorNode; o2: OscillatorNode; filter: BiquadFilterNode; gain: GainNode; lfo: OscillatorNode } | null = null;

  private musicTimer: number | null = null;
  private musicStep = 0;
  private musicNext = 0;

  muted: boolean;

  constructor() {
    let stored = false;
    try {
      stored = localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      /* modo privado */
    }
    this.muted = stored;
  }

  /** Debe llamarse dentro de un gesto del usuario (iOS/Safari lo exige). */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain();
      this.sfx.gain.value = 0.9;
      this.sfx.connect(this.master);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.5;
      this.musicGain.connect(this.master);
      // ruido blanco para "whoosh"
      const len = this.ctx.sampleRate * 1;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    try {
      localStorage.setItem(STORAGE_KEY, m ? '1' : '0');
    } catch {
      /* ignorar */
    }
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.02);
    }
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  // ───────────── utilidades ─────────────

  private tone(freq: number, start: number, dur: number, type: Wave, vol: number, slideTo?: number, dest?: AudioNode): void {
    if (!this.ctx || !this.sfx) return;
    const t0 = this.ctx.currentTime + start;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.02, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(dest ?? this.sfx);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  private noise(start: number, dur: number, vol: number, fFrom: number, fTo: number): void {
    if (!this.ctx || !this.sfx || !this.noiseBuf) return;
    const t0 = this.ctx.currentTime + start;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(fFrom, t0);
    f.frequency.exponentialRampToValueAtTime(fTo, t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  // ───────────── efectos ─────────────

  click(): void {
    this.tone(660, 0, 0.09, 'triangle', 0.18, 880);
  }

  select(): void {
    this.tone(523, 0, 0.1, 'triangle', 0.2);
    this.tone(784, 0.08, 0.16, 'triangle', 0.2);
  }

  /** Cartel que aparece. */
  pop(): void {
    this.tone(420, 0, 0.12, 'sine', 0.16, 840);
  }

  /** El niño elige carretera. */
  steer(): void {
    this.noise(0, 0.38, 0.22, 500, 1800);
    this.tone(300, 0, 0.18, 'triangle', 0.08, 520);
  }

  correct(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => {
      this.tone(n, i * 0.085, 0.22, 'triangle', 0.2);
      this.tone(n * 2, i * 0.085, 0.16, 'sine', 0.05);
    });
  }

  wrong(): void {
    this.tone(392, 0, 0.2, 'triangle', 0.22, 330);
    this.tone(311, 0.2, 0.2, 'triangle', 0.22, 262);
    this.tone(233, 0.4, 0.38, 'triangle', 0.22, 196);
  }

  /** Caída: silbato descendente con vibrato + "boing" final. */
  fall(): void {
    if (!this.ctx || !this.sfx) return;
    const t0 = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const lfo = this.ctx.createOscillator();
    const lg = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(1250, t0);
    o.frequency.exponentialRampToValueAtTime(180, t0 + 1.7);
    lfo.frequency.value = 9;
    lg.gain.value = 26;
    lfo.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.75);
    o.connect(g).connect(this.sfx);
    o.start(t0);
    lfo.start(t0);
    o.stop(t0 + 1.8);
    lfo.stop(t0 + 1.8);
    this.tone(160, 1.85, 0.4, 'sine', 0.3, 60); // "poof" blando
    this.noise(1.85, 0.3, 0.12, 900, 200);
  }

  win(): void {
    const seq = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5];
    seq.forEach((n, i) => {
      this.tone(n, i * 0.13, 0.3, 'triangle', 0.22);
      this.tone(n * 1.5, i * 0.13, 0.2, 'sine', 0.06);
    });
    [1568, 1760, 2093, 1760, 2349].forEach((n, i) => this.tone(n, 0.95 + i * 0.08, 0.18, 'sine', 0.07));
  }

  // ───────────── motor ─────────────

  startEngine(): void {
    if (!this.ctx || !this.sfx || this.engine) return;
    const o1 = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    o1.type = 'sawtooth';
    o2.type = 'square';
    o1.frequency.value = 58;
    o2.frequency.value = 87;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.0001;
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 24;
    lfoGain.gain.value = 0.012;
    lfo.connect(lfoGain).connect(gain.gain);
    o1.connect(filter);
    o2.connect(filter);
    filter.connect(gain).connect(this.sfx);
    o1.start();
    o2.start();
    lfo.start();
    gain.gain.setTargetAtTime(0.05, this.ctx.currentTime, 0.2);
    this.engine = { o1, o2, filter, gain, lfo };
  }

  setEngineSpeed(ratio: number): void {
    if (!this.ctx || !this.engine) return;
    const r = Math.max(0, Math.min(1.3, ratio));
    const t = this.ctx.currentTime;
    this.engine.o1.frequency.setTargetAtTime(52 + 44 * r, t, 0.08);
    this.engine.o2.frequency.setTargetAtTime(78 + 66 * r, t, 0.08);
    this.engine.filter.frequency.setTargetAtTime(260 + 260 * r, t, 0.1);
    this.engine.gain.gain.setTargetAtTime(0.03 + 0.03 * r, t, 0.1);
  }

  stopEngine(): void {
    if (!this.ctx || !this.engine) return;
    const e = this.engine;
    this.engine = null;
    e.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.12);
    const stopAt = this.ctx.currentTime + 0.6;
    e.o1.stop(stopAt);
    e.o2.stop(stopAt);
    e.lfo.stop(stopAt);
  }

  // ───────────── música ─────────────

  startMusic(): void {
    if (!this.ctx || this.musicTimer !== null) return;
    this.musicStep = 0;
    this.musicNext = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 120);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private scheduleMusic(): void {
    if (!this.ctx || !this.musicGain) return;
    const stepDur = 60 / 128 / 2; // corcheas a 128 bpm
    const bass = [130.81, 110.0, 87.31, 98.0]; // Do La Fa Sol
    const melody = [
      [4, 7, 9, 7, 4, 2, 4, -1],
      [9, 9, 12, 9, 7, 4, 7, -1],
      [9, 7, 4, 7, 9, 4, 2, 0],
      [7, 7, 9, 7, 4, 2, 0, -1],
    ];
    while (this.musicNext < this.ctx.currentTime + 0.35) {
      const step = this.musicStep % 32;
      const bar = Math.floor(step / 8);
      const inBar = step % 8;
      const t = this.musicNext - this.ctx.currentTime;
      if (inBar % 2 === 0) this.tone(bass[bar], t, stepDur * 1.7, 'triangle', 0.11, undefined, this.musicGain);
      const m = melody[bar][inBar];
      if (m >= 0) this.tone(523.25 * Math.pow(2, m / 12), t, stepDur * 0.9, 'square', 0.035, undefined, this.musicGain);
      if (inBar === 4) this.tone(1200, t, 0.03, 'square', 0.02, 600, this.musicGain); // pequeño "hi-hat"
      this.musicStep++;
      this.musicNext += stepDur;
    }
  }
}
