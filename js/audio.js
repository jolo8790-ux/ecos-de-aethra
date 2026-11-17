// Efectos de sonido sintetizados (sin archivos). Se activa con el primer clic.
export class Audio {
  constructor() { this.ctx = null; this.volume = 0.7; }
  unlock() {
    try {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) { this.ctx = null; }
  }
  tone(freq, dur, type = 'sine', vol = 0.12, slide = 0, delay = 0) {
    const c = this.ctx; if (!c || this.volume <= 0) return;
    try {
      const t0 = c.currentTime + delay;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
      g.gain.setValueAtTime(vol * this.volume, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(this.dest || c.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) {}
  }
  noise(dur, vol = 0.08, freq = 800) {
    const c = this.ctx; if (!c || this.volume <= 0) return;
    try {
      const n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol * this.volume;
      s.buffer = buf; s.connect(f); f.connect(g); g.connect(this.dest || c.destination); s.start();
    } catch (e) {}
  }
  play(name) {
    switch (name) {
      case 'jump': this.tone(320, 0.14, 'triangle', 0.1, 260); break;
      case 'djump': this.tone(520, 0.16, 'triangle', 0.1, 380); this.noise(0.15, 0.04, 2500); break;
      case 'land': this.noise(0.08, 0.06, 400); break;
      case 'step': this.noise(0.045, 0.025, 500 + Math.random() * 200); break;
      case 'stepRun': this.noise(0.05, 0.04, 650 + Math.random() * 250); break;
      case 'fragment': [784, 988, 1318].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.1, 0, i * 0.07)); break;
      case 'checkpoint': [523, 784].forEach((f, i) => this.tone(f, 0.4, 'sine', 0.12, 0, i * 0.12)); break;
      case 'talk': this.tone(660 + Math.random() * 120, 0.04, 'square', 0.03); break;
      case 'open': this.tone(440, 0.08, 'sine', 0.08, 220); break;
      case 'swing': this.noise(0.12, 0.07, 2600); this.tone(260, 0.1, 'sine', 0.04, 300); break;
      case 'hit': this.tone(180, 0.12, 'square', 0.09, -90); this.noise(0.08, 0.1, 3000); break;
      case 'crystal': [1400, 1900, 2500].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.05, 0, i * 0.02)); break;
      case 'shatter': this.noise(0.35, 0.12, 5000); [1800, 1200, 2400, 900].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.05, -200, i * 0.04)); break;
      case 'hurt': this.tone(330, 0.18, 'sawtooth', 0.08, -160); this.noise(0.1, 0.06, 900); break;
      case 'dodge': this.noise(0.18, 0.06, 1500); break;
      case 'dash': this.noise(0.22, 0.08, 3500); this.tone(500, 0.2, 'sine', 0.06, 500); break;
      case 'bounce': this.tone(180, 0.25, 'sine', 0.12, 420); break;
      case 'windup': this.tone(240, 0.5, 'sawtooth', 0.035, 260); break;
      case 'shoot': this.tone(700, 0.18, 'triangle', 0.06, -300); break;
      case 'heal': [660, 880, 1100].forEach((f, i) => this.tone(f, 0.18, 'sine', 0.08, 0, i * 0.06)); break;
      case 'roar': this.noise(1.0, 0.16, 300); this.tone(70, 1.0, 'sawtooth', 0.12, -20); break;
      case 'slam': this.noise(0.45, 0.2, 260); this.tone(55, 0.4, 'sine', 0.18, -20); break;
      case 'rumble': this.noise(0.6, 0.08, 180); break;
      case 'glide': this.noise(0.4, 0.05, 900); this.tone(300, 0.25, 'sine', 0.04, 120); break;
      case 'grapple': this.tone(900, 0.12, 'square', 0.05, -500); this.noise(0.1, 0.05, 4000); break;
      case 'gear': this.tone(120, 0.08, 'square', 0.05, 0); this.noise(0.05, 0.05, 1500); break;
      case 'laser': this.tone(1200, 0.6, 'sawtooth', 0.04, -600); break;
      case 'stomp': this.noise(0.5, 0.22, 200); this.tone(45, 0.5, 'sine', 0.2, -10); break;
      case 'block': this.tone(1100, 0.15, 'triangle', 0.08, -300); this.noise(0.08, 0.06, 5000); break;
      case 'shieldUp': this.tone(600, 0.12, 'sine', 0.05, 400); break;
      case 'reflect': [1500, 2200].forEach((f, i) => this.tone(f, 0.15, 'triangle', 0.07, -400, i * 0.03)); break;
      case 'pulse': this.tone(320, 0.6, 'sine', 0.12, 900); [880, 1320, 1760].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.05, 0, i * 0.05)); break;
      case 'unlock': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.08, 0, i * 0.08)); break;
      case 'dark': this.tone(90, 0.8, 'sawtooth', 0.06, -30); this.noise(0.5, 0.05, 300); break;
      case 'ice': this.noise(0.3, 0.08, 6000); this.tone(2400, 0.2, 'triangle', 0.04, -1200); break;
      case 'crack': this.noise(0.12, 0.08, 2200); this.tone(140, 0.12, 'square', 0.04, -40); break;
      case 'crumble': this.noise(0.6, 0.16, 420); this.tone(70, 0.5, 'sine', 0.12, -30); break;
      case 'fire': this.noise(0.7, 0.12, 700); this.tone(110, 0.5, 'sawtooth', 0.04, 60); break;
      case 'splash': this.noise(0.5, 0.14, 1200); this.tone(200, 0.3, 'sine', 0.06, -120); break;
    }
  }
}
