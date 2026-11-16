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
      o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) {}
  }
  noise(dur, vol = 0.08, freq = 800) {
    const c = this.ctx; if (!c || this.volume <= 0) return;
    try {
      const n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol * this.volume;
      s.buffer = buf; s.connect(f); f.connect(g); g.connect(c.destination); s.start();
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
      case 'splash': this.noise(0.5, 0.14, 1200); this.tone(200, 0.3, 'sine', 0.06, -120); break;
    }
  }
}
