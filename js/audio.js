import { LOW_MEM } from './glbload.js';
// Efectos de sonido sintetizados en tiempo real (sin archivos).
// Cada efecto se arma con capas: un golpe inicial (transitorio), un cuerpo con tono y una cola de ruido filtrado,
// con pequeñas variaciones al azar para que no suene siempre igual. Si se pasa una posición, el sonido se
// coloca a la izquierda o a la derecha y baja con la distancia.
const MAX_VOICES = 72, MAX_LOW = 40;
// voces grabadas (generadas con Artlist): se suman al efecto sintetizado. p = probabilidad, para que no se repitan siempre
const HERO_V = new Set(['bien']); // la voz de cada personaje (sólo palabras: sin quejidos)
const VOICES = {
  // (sin quejidos ni jadeos al saltar, atacar o recibir golpes: sonaban raro; sólo la palabra «¡bien!»)
  fragment: { f: ['bien'], p: 0.6, vol: 0.7, gap: 2 },
  roar: { f: ['roar1', 'roar2'], p: 1, vol: 1.1 },
  windup: { f: ['growl'], p: 0.5, vol: 0.6, gap: 1, rate: 0.2 },
  stomp: { f: ['growl'], p: 0.25, vol: 0.5, gap: 2 },
};

export class Audio {
  constructor() { this.ctx = null; this.volume = 0.7; this.voices = 0; this.listener = null; this.surface = 'grass'; this._last = {}; this._streak = { t: 0, n: 0 }; this._burst = { t: 0, n: 0 }; }
  unlock() {
    try {
      if (!this.ctx) {
        // en el teléfono, un búfer de audio más grande: si el dibujo tarda un poco, el sonido no se corta
        const AC = window.AudioContext || window.webkitAudioContext;
        try { this.ctx = new AC({ latencyHint: LOW_MEM ? 'playback' : 'interactive' }); } catch (e) { this.ctx = new AC(); }
        this._buffers();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) { this.ctx = null; }
  }
  // muestras de voz: se cargan una vez (si fallan, solo queda el sonido sintetizado)
  _loadSamples() {
    const names = new Set(); this.smp = this.smp || {};
    for (const v of Object.values(VOICES)) v.f.forEach(n => { if (!HERO_V.has(n)) names.add(n); });
    for (const n of names) this._fetch(`assets/sfx/${n}.mp3`, n);
    this.setVoice(this.voiceSet || '', this.voiceRate || 1);
  }
  _fetch(url, key) {
    if (this.smp[key] !== undefined) return; this.smp[key] = null;
    fetch(url).then(r => r.ok ? r.arrayBuffer() : Promise.reject()).then(b => this.ctx.decodeAudioData(b)).then(buf => { this.smp[key] = buf; }).catch(() => {});
  }
  // voz del personaje con el que juegas ('' = la exploradora); rate < 1 la hace más grave
  setVoice(set = '', rate = 1) {
    this.voiceSet = set; this.voiceRate = rate;
    if (!this.ctx || !this.smp) return;
    for (const n of HERO_V) this._fetch(`assets/sfx/${set ? set + '/' : ''}${n}.mp3`, (set || '_') + '/' + n);
  }
  _voice(name) {
    const V = VOICES[name]; if (!V || !this.smp || Math.random() > V.p) return;
    if (V.gap && !this._throttle('v_' + name, V.gap)) return;
    const n = V.f[Math.floor(Math.random() * V.f.length)], hero = HERO_V.has(n), buf = this.smp[hero ? (this.voiceSet || '_') + '/' + n : n]; if (!buf || this.voices > (LOW_MEM ? MAX_LOW : MAX_VOICES)) return;
    const c = this.ctx, s = c.createBufferSource(); s.buffer = buf;
    s.playbackRate.value = (hero ? this.voiceRate || 1 : 1) * (1 + (Math.random() - 0.5) * (V.rate || 0.06));
    const g = this._out(0, 0); g.gain.value = V.vol * this._k * this._g; s.connect(g); s.start(); this.voices++; s.onended = () => { this.voices--; };
  }
  // ruidos blanco, rosa y marrón calculados una sola vez
  _buffers() {
    this._loadSamples();
    const c = this.ctx, n = Math.floor(c.sampleRate * 2);
    const mk = fill => { const b = c.createBuffer(1, n, c.sampleRate); fill(b.getChannelData(0)); return b; };
    this.nb = {
      white: mk(d => { for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; }),
      pink: mk(d => { let b0 = 0, b1 = 0, b2 = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; } }),
      brown: mk(d => { let l = 0; for (let i = 0; i < n; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; } }),
    };
  }
  // reproductor con posición para jugadores y enemigos que no son la cámara
  spatial(src = null) { const a = this; return { src, play(name) { a.play(name, this.src); }, unlock() {} }; }

  // ---------- piezas básicas ----------
  // efectos grabados de la arena de destrucción (assets/sfx/arena): se cargan al entrar
  loadArena() {
    if (!this.ctx) return; this.smp = this.smp || {};
    for (const n of ['mg1', 'mg2', 'mg3', 'canon', 'cohete', 'explosion', 'explosion2', 'ko', 'choque', 'choque2', 'golpe', 'fuego', 'onda', 'especial']) this._fetch(`assets/sfx/arena/${n}.mp3`, 'arena/' + n);
  }
  // pos: {x, z} para que suene desde ahí (más bajo lejos y del lado que corresponde)
  sample(key, { vol = 1, rate = 1, pos = null, vary = 0.06, gap = 0 } = {}) {
    if (!this.ctx || this.volume <= 0 || this.ctx.state !== 'running' || !this.smp) return false;
    const buf = this.smp['arena/' + key]; if (!buf) return false;
    if (gap && !this._throttle('s_' + key, gap)) return true;
    if (this.voices > (LOW_MEM ? MAX_LOW + 4 : MAX_VOICES + 8)) return true;
    if (!this._prep(pos)) return true;
    const c = this.ctx, s = c.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate * (1 + (Math.random() - 0.5) * vary);
    const g = this._out(0, 0); g.gain.value = vol * this._k * this._g; s.connect(g); s.start(); this.voices++; s.onended = () => { this.voices--; };
    return true;
  }
  _out(pan, delay) {
    const c = this.ctx, g = c.createGain();
    let node = g;
    const P = (this._pan || 0) + (pan || 0);
    if (P && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, P)); g.connect(p); p.connect(this.dest || c.destination); }
    else g.connect(this.dest || c.destination);
    void node; void delay;
    return g;
  }
  _track(src, end) { this.voices++; src.onended = () => { this.voices--; }; src.stop(end); }
  // oscilador: o(tipo, frecuencia, {to, dur, vol, att, delay, pan, lp, hp, bp, q, vib})
  o(type, f, { to = 0, dur = 0.2, vol = 0.1, att = 0.004, delay = 0, pan = 0, lp = 0, hp = 0, bp = 0, q = 1, vib = 0, det = 0 } = {}) {
    const c = this.ctx; if (!c || this.voices > (LOW_MEM ? MAX_LOW : MAX_VOICES)) return;
    const t0 = c.currentTime + delay, k = this._k * this._g;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f * this._p, t0); o.detune.value = det;
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to * this._p), t0 + dur);
    if (vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = vib; lg.gain.value = f * 0.03; l.connect(lg); lg.connect(o.frequency); l.start(t0); l.stop(t0 + dur + 0.05); }
    let node = o;
    for (const [kind, fr] of [['lowpass', lp], ['highpass', hp], ['bandpass', bp]]) if (fr) { const fl = c.createBiquadFilter(); fl.type = kind; fl.frequency.value = fr; fl.Q.value = q; node.connect(fl); node = fl; }
    const g = this._out(pan, delay);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol * k, t0 + att); g.gain.exponentialRampToValueAtTime(0.0001, t0 + att + dur);
    node.connect(g); o.start(t0); this._track(o, t0 + att + dur + 0.05);
  }
  // ruido: n(color, dur, {vol, f, to, type, q, att, delay, pan})
  n(color, dur, { vol = 0.1, f = 1000, to = 0, type = 'lowpass', q = 0.8, att = 0.003, delay = 0, pan = 0 } = {}) {
    const c = this.ctx; if (!c || !this.nb || this.voices > (LOW_MEM ? MAX_LOW : MAX_VOICES)) return;
    const t0 = c.currentTime + delay, k = this._k * this._g;
    const s = c.createBufferSource(); s.buffer = this.nb[color] || this.nb.white;
    const fl = c.createBiquadFilter(); fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f * this._p, t0);
    if (to) fl.frequency.exponentialRampToValueAtTime(Math.max(30, to * this._p), t0 + dur);
    const g = this._out(pan, delay);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol * k, t0 + att); g.gain.exponentialRampToValueAtTime(0.0001, t0 + att + dur);
    s.connect(fl); fl.connect(g); s.start(t0, Math.random() * 1.5); this._track(s, t0 + att + dur + 0.05);
  }
  // campana FM (cristales, recompensas)
  bell(f, { dur = 0.8, vol = 0.06, ratio = 3.5, index = 2, delay = 0, pan = 0 } = {}) {
    const c = this.ctx; if (!c || this.voices > (LOW_MEM ? MAX_LOW : MAX_VOICES)) return;
    const t0 = c.currentTime + delay, k = this._k * this._g, F = f * this._p;
    const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain();
    car.frequency.value = F; mod.frequency.value = F * ratio; mg.gain.setValueAtTime(F * index, t0); mg.gain.exponentialRampToValueAtTime(1, t0 + dur);
    mod.connect(mg); mg.connect(car.frequency);
    const g = this._out(pan, delay); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol * k, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    car.connect(g); car.start(t0); mod.start(t0); mod.stop(t0 + dur + 0.05); this._track(car, t0 + dur + 0.05);
  }
  // compatibilidad con el código anterior
  tone(freq, dur, type = 'sine', vol = 0.12, slide = 0, delay = 0) { this._prep(); this.o(type, freq, { to: slide ? Math.max(30, freq + slide) : 0, dur, vol, delay }); }
  noise(dur, vol = 0.08, freq = 800) { this._prep(); this.n('white', dur, { vol, f: freq }); }

  // posición: izquierda/derecha según la cámara y volumen según la distancia
  _prep(pos) {
    this._pan = 0; this._g = 1; this._p = 1 + (Math.random() - 0.5) * 0.08; this._k = this.volume;
    const L = this.listener;
    if (pos && L && pos.x !== undefined) {
      const dx = pos.x - L.x, dz = pos.z - L.z, d = Math.hypot(dx, dz);
      if (d > 0.5) { const rx = Math.cos(L.yaw), rz = -Math.sin(L.yaw); this._pan = Math.max(-0.85, Math.min(0.85, (dx * rx + dz * rz) / d * Math.min(1, d / 6))); }
      const ref = L.ref || 9; this._g = d < ref ? 1 : Math.pow(ref / d, 1.3);
      if (d > 70) return false;
    }
    return true;
  }
  // que un sonido muy repetido no se amontone
  _throttle(name, gap) { const c = this.ctx, t = c.currentTime; if (t - (this._last[name] || -9) < gap) return false; this._last[name] = t; return true; }

  play(name, pos) {
    if (!this.ctx || this.volume <= 0 || this.ctx.state !== 'running') return;
    // que muchos sonidos a la vez no saturen el audio (se notaba como cortes): como mucho unos pocos por instante
    { const t = this.ctx.currentTime; if (t - this._burst.t > 0.08) { this._burst.t = t; this._burst.n = 0; }
      const essential = name === 'hurt' || name === 'ko' || name === 'fragment' || name === 'unlock';
      if (++this._burst.n > (LOW_MEM ? 5 : 9) && !essential) return;
      if (!essential && !this._throttle('n_' + name, 0.035)) return; }
    if (!this._prep(pos && pos.pos ? pos.pos : pos)) return;
    if (VOICES[name]) this._voice(name);
    const o = (...a) => this.o(...a), n = (...a) => this.n(...a), bell = (...a) => this.bell(...a);
    const sparkle = (notes, gap = 0.05, vol = 0.04, base = 0) => notes.forEach((f, i) => bell(f, { dur: 0.5, vol, ratio: 2.01, index: 1.2, delay: base + i * gap, pan: (i % 2 ? 0.15 : -0.15) }));
    switch (name) {
      // ---------- movimiento ----------
      case 'step': case 'stepRun': {
        if (!this._throttle('step', 0.07)) return;
        const run = name === 'stepRun', v = run ? 1.25 : 1, s = this.surface;
        if (s === 'snow') n('pink', 0.09, { vol: 0.06 * v, f: 1700, to: 800, type: 'bandpass', q: 0.7, att: 0.01 });
        else if (s === 'stone' || s === 'metal') { n('white', 0.03, { vol: 0.035 * v, f: 3200, type: 'bandpass', q: 2.2 }); o('sine', s === 'metal' ? 520 : 170, { to: s === 'metal' ? 480 : 110, dur: 0.05, vol: 0.035 * v }); }
        else if (s === 'sand') n('white', 0.08, { vol: 0.045 * v, f: 1300, type: 'lowpass', att: 0.01 });
        else if (s === 'wood') { o('sine', 240, { to: 170, dur: 0.06, vol: 0.06 * v }); n('pink', 0.04, { vol: 0.03 * v, f: 1500, type: 'bandpass' }); }
        else { n('pink', 0.06, { vol: 0.045 * v, f: 2300, type: 'bandpass', q: 0.9 }); n('brown', 0.05, { vol: 0.05 * v, f: 300 }); }
        break;
      }
      case 'jump': n('pink', 0.13, { vol: 0.11, f: 700, to: 2200, type: 'bandpass', q: 0.8, att: 0.01 }); o('triangle', 260, { to: 520, dur: 0.11, vol: 0.05 }); break;
      case 'djump': n('pink', 0.18, { vol: 0.08, f: 900, to: 3000, type: 'bandpass', q: 0.8, att: 0.01 }); o('triangle', 420, { to: 880, dur: 0.14, vol: 0.05 }); sparkle([1568, 2093], 0.04, 0.025); break;
      case 'land': n('brown', 0.14, { vol: 0.2, f: 320 }); o('sine', 95, { to: 50, dur: 0.11, vol: 0.14 }); n('pink', 0.08, { vol: 0.05, f: 1600, type: 'bandpass' }); break;
      case 'dodge': n('pink', 0.24, { vol: 0.18, f: 500, to: 2600, type: 'bandpass', q: 0.7, att: 0.02 }); o('sine', 220, { to: 120, dur: 0.18, vol: 0.03 }); break;
      case 'dash': n('pink', 0.3, { vol: 0.14, f: 700, to: 4200, type: 'bandpass', q: 0.6, att: 0.015 }); o('sine', 260, { to: 1100, dur: 0.22, vol: 0.06 }); o('triangle', 1320, { to: 2640, dur: 0.18, vol: 0.02, delay: 0.04 }); break;
      case 'glide': n('pink', 0.7, { vol: 0.08, f: 400, to: 1300, type: 'bandpass', q: 0.5, att: 0.18 }); o('sine', 330, { to: 440, dur: 0.4, vol: 0.025, att: 0.1 }); break;
      case 'bounce': o('sine', 140, { to: 560, dur: 0.32, vol: 0.16, vib: 18 }); n('brown', 0.1, { vol: 0.12, f: 400 }); break;
      case 'grapple': o('square', 1500, { to: 320, dur: 0.14, vol: 0.035, lp: 3200 }); n('white', 0.12, { vol: 0.06, f: 4200, type: 'highpass' }); o('triangle', 2400, { dur: 0.05, vol: 0.03, delay: 0.12 }); break;
      case 'splash': n('white', 0.6, { vol: 0.16, f: 2400, to: 500, type: 'lowpass', att: 0.01 }); n('brown', 0.4, { vol: 0.14, f: 400 }); o('sine', 260, { to: 110, dur: 0.3, vol: 0.05 }); for (let i = 0; i < 4; i++) o('sine', 600 + Math.random() * 800, { to: 1400, dur: 0.06, vol: 0.02, delay: 0.15 + i * 0.07 }); break;
      case 'bubble': for (let i = 0; i < 3; i++) o('sine', 500 + i * 220, { to: 1100 + i * 300, dur: 0.07, vol: 0.05, delay: i * 0.06 }); break;
      case 'gulp': o('sine', 280, { to: 620, dur: 0.12, vol: 0.09 }); n('pink', 0.15, { vol: 0.05, f: 1800, type: 'bandpass' }); break;

      // ---------- combate de la heroína ----------
      case 'swing': {
        const v = Math.random();
        n('white', 0.15, { vol: 0.17, f: 900 + v * 500, to: 4200 + v * 1500, type: 'bandpass', q: 1.1, att: 0.035 });
        n('pink', 0.12, { vol: 0.09, f: 500, to: 1500, type: 'bandpass', q: 0.6, att: 0.03 });
        o('sine', 170 + v * 60, { to: 320, dur: 0.1, vol: 0.04, att: 0.02 });
        break;
      }
      case 'hit': // golpe que conecta: chasquido + cuerpo + crujido
        o('square', 1900, { to: 240, dur: 0.025, vol: 0.06 }); o('sine', 150, { to: 55, dur: 0.17, vol: 0.26 });
        n('white', 0.09, { vol: 0.13, f: 2800, type: 'bandpass', q: 0.8 }); n('brown', 0.22, { vol: 0.13, f: 450 });
        break;
      case 'hitHeavy':
        o('square', 1400, { to: 150, dur: 0.03, vol: 0.07 }); o('sine', 110, { to: 38, dur: 0.32, vol: 0.32 });
        n('white', 0.14, { vol: 0.16, f: 2200, type: 'bandpass', q: 0.7 }); n('brown', 0.42, { vol: 0.2, f: 350 }); n('pink', 0.3, { vol: 0.06, f: 5000, to: 1200, type: 'highpass', delay: 0.02 });
        break;
      case 'enemyHurt':
        o('square', 1800, { to: 260, dur: 0.025, vol: 0.05 }); o('sine', 160, { to: 60, dur: 0.15, vol: 0.2 }); n('white', 0.08, { vol: 0.1, f: 2600, type: 'bandpass' });
        o('triangle', 900, { to: 1500, dur: 0.07, vol: 0.04, delay: 0.03 }); // «pling» de dibujo animado
        break;
      case 'enemyDie':
        o('sine', 700, { to: 110, dur: 0.24, vol: 0.12 }); n('white', 0.45, { vol: 0.12, f: 6000, to: 900, type: 'lowpass' }); n('brown', 0.3, { vol: 0.12, f: 380 });
        sparkle([1318, 1760, 2349], 0.045, 0.03, 0.08);
        break;
      case 'hurt': // la heroína recibe un golpe: «¡bonk!» de dibujo animado, sin voz
        n('brown', 0.2, { vol: 0.22, f: 520 }); o('sine', 130, { to: 60, dur: 0.16, vol: 0.18 });
        o('square', 1200, { to: 300, dur: 0.05, vol: 0.05 }); o('triangle', 620, { to: 310, dur: 0.18, vol: 0.07, delay: 0.02 }); sparkle([1568, 1175], 0.05, 0.025, 0.06);
        break;
      case 'block': // escudo: metal que vibra
        for (const [f, v, d] of [[523, 0.07, 0.5], [1307, 0.05, 0.35], [2041, 0.035, 0.28], [3203, 0.025, 0.2]]) o('triangle', f, { dur: d, vol: v, to: f * 0.985 });
        n('white', 0.05, { vol: 0.1, f: 6500, type: 'highpass' }); o('sine', 160, { to: 80, dur: 0.1, vol: 0.1 });
        break;
      case 'shieldUp': o('sine', 220, { to: 760, dur: 0.24, vol: 0.06, att: 0.03 }); o('triangle', 440, { to: 1520, dur: 0.24, vol: 0.025, att: 0.03 }); n('white', 0.25, { vol: 0.03, f: 4000, to: 9000, type: 'highpass', att: 0.05 }); break;
      case 'reflect': bell(2093, { dur: 0.5, vol: 0.06, ratio: 1.5, index: 3 }); bell(3136, { dur: 0.4, vol: 0.04, ratio: 1.5, index: 3, delay: 0.03 }); n('pink', 0.15, { vol: 0.08, f: 2000, to: 6000, type: 'bandpass' }); break;
      case 'pulse': // onda de luz: golpe grave y destello
        o('sine', 95, { to: 38, dur: 0.6, vol: 0.28 }); n('brown', 0.5, { vol: 0.14, f: 260 });
        n('white', 0.6, { vol: 0.05, f: 2500, to: 9000, type: 'highpass', att: 0.04 });
        sparkle([880, 1320, 1760, 2640], 0.05, 0.035, 0.03);
        break;

      // ---------- poderes ----------
      case 'fire': // rugido de llamas con chasquidos
        n('pink', 0.75, { vol: 0.2, f: 350, to: 1900, type: 'bandpass', q: 0.5, att: 0.05 });
        n('brown', 0.9, { vol: 0.18, f: 260, att: 0.04 });
        o('sawtooth', 70, { to: 110, dur: 0.6, vol: 0.05, lp: 420, att: 0.05 });
        for (let i = 0; i < 12; i++) n('white', 0.015, { vol: 0.06, f: 3000 + Math.random() * 3000, type: 'bandpass', q: 3, delay: 0.05 + Math.random() * 0.7 });
        break;
      case 'ice': // proyectil helado
        n('white', 0.35, { vol: 0.08, f: 7000, to: 3000, type: 'highpass', att: 0.01 }); o('triangle', 2600, { to: 1200, dur: 0.22, vol: 0.04 });
        sparkle([2637, 3136, 3951], 0.03, 0.03);
        break;
      case 'freeze': // el hielo se cierra
        for (let i = 0; i < 9; i++) o('triangle', 1800 + Math.random() * 2600, { to: 900, dur: 0.12, vol: 0.03, delay: i * 0.035 });
        n('white', 0.4, { vol: 0.1, f: 5000, to: 1500, type: 'bandpass', q: 1.5 }); o('sine', 220, { to: 110, dur: 0.3, vol: 0.08 });
        break;
      case 'thaw': n('white', 0.35, { vol: 0.12, f: 6000, to: 2000, type: 'highpass' }); for (let i = 0; i < 6; i++) o('triangle', 1500 + Math.random() * 2500, { to: 700, dur: 0.15, vol: 0.03, delay: i * 0.03 }); break;
      case 'zap': // descarga eléctrica de medusa: chasquidos y zumbido
        o('sawtooth', 120, { to: 60, dur: 0.35, vol: 0.08, lp: 2400, vib: 40 });
        for (let i = 0; i < 10; i++) n('white', 0.02, { vol: 0.08, f: 2500 + Math.random() * 5000, type: 'bandpass', q: 4, delay: Math.random() * 0.3 });
        n('white', 0.3, { vol: 0.05, f: 5000, type: 'highpass' });
        break;
      case 'tele': // telequinesis: zumbido mental que sube
        o('sine', 196, { to: 392, dur: 2.2, vol: 0.07, att: 0.25, vib: 6 }); o('sine', 199, { to: 398, dur: 2.2, vol: 0.05, att: 0.25 });
        o('sawtooth', 98, { to: 196, dur: 2.2, vol: 0.03, lp: 500, att: 0.3 });
        n('pink', 2.2, { vol: 0.04, f: 600, to: 2400, type: 'bandpass', q: 3, att: 0.4 });
        break;
      case 'levitate': // acorde etéreo
        for (const [f, d] of [[523, 0], [659, 0.06], [784, 0.12], [1046, 0.18]]) o('sine', f, { dur: 1.4, vol: 0.035, att: 0.25, delay: d, vib: 5 });
        n('pink', 1.2, { vol: 0.05, f: 900, to: 2400, type: 'bandpass', q: 0.6, att: 0.3 });
        break;
      case 'fury': o('sawtooth', 200, { to: 150, dur: 0.25, vol: 0.12, bp: 900, q: 3 }); o('sawtooth', 300, { to: 220, dur: 0.22, vol: 0.06, bp: 1400, q: 4 }); n('pink', 0.3, { vol: 0.16, f: 800, to: 3500, type: 'bandpass' }); break; // ¡grito!
      case 'beam': // rayo de los ojos: zumbido eléctrico 1,6 s
        o('sawtooth', 180, { dur: 1.6, vol: 0.05, att: 0.05, lp: 1800, vib: 30 }); o('sawtooth', 183, { dur: 1.6, vol: 0.04, att: 0.05, lp: 1800 });
        o('square', 1440, { to: 1300, dur: 1.6, vol: 0.012, att: 0.05 }); n('white', 1.6, { vol: 0.035, f: 6000, type: 'highpass', att: 0.05 });
        break;
      case 'arrows': // la lluvia de flechas: silbido que baja y cientos de impactos
        n('pink', 0.9, { vol: 0.13, f: 5000, to: 900, type: 'bandpass', q: 0.8, att: 0.2 });
        for (let i = 0; i < 46; i++) { const d = 0.75 + Math.random() * 1.7; n('white', 0.02, { vol: 0.05, f: 1800 + Math.random() * 2500, type: 'bandpass', q: 2, delay: d, pan: Math.random() * 1.2 - 0.6 }); if (i % 6 === 0) o('sine', 260, { to: 140, dur: 0.05, vol: 0.05, delay: d }); }
        break;
      case 'pendulum': n('pink', 0.55, { vol: 0.22, f: 260, to: 900, type: 'bandpass', q: 1.2, att: 0.18 }); n('brown', 0.5, { vol: 0.12, f: 200, att: 0.15 }); o('triangle', 70, { to: 55, dur: 0.4, vol: 0.05, att: 0.15 }); if (Math.random() < 0.5) o('square', 900, { to: 700, dur: 0.06, vol: 0.012, lp: 1800, delay: 0.4 }); break; // maza que pasa: zumbido grave y cadena
      case 'slam': n('brown', 0.5, { vol: 0.28, f: 260 }); o('sine', 60, { to: 30, dur: 0.45, vol: 0.32 }); n('white', 0.2, { vol: 0.08, f: 1500, type: 'bandpass', delay: 0.02 }); break;
      case 'powerFail': o('sine', 220, { to: 140, dur: 0.15, vol: 0.06 }); o('square', 110, { dur: 0.08, vol: 0.02, lp: 600 }); break;
      case 'energy': sparkle([1046, 1318], 0.05, 0.03); break;

      // ---------- recompensas ----------
      case 'fragment': sparkle([784, 988, 1318, 1568], 0.065, 0.06); n('white', 0.5, { vol: 0.03, f: 7000, type: 'highpass', att: 0.05 }); break;
      case 'crystal': {
        const S = this._streak, t = this.ctx.currentTime; S.n = t - S.t < 1.4 ? Math.min(S.n + 1, 10) : 0; S.t = t;
        const up = Math.pow(2, S.n / 12); sparkle([1318 * up, 1976 * up], 0.035, 0.04);
        break;
      }
      case 'heal': for (const [f, d] of [[660, 0], [880, 0.07], [1320, 0.14]]) o('sine', f, { dur: 0.35, vol: 0.06, att: 0.02, delay: d }); n('pink', 0.4, { vol: 0.04, f: 1200, to: 4000, type: 'bandpass', att: 0.08 }); break;
      case 'checkpoint': for (const [f, d] of [[523, 0], [659, 0.1], [784, 0.2]]) bell(f, { dur: 1.2, vol: 0.06, ratio: 2, index: 1.5, delay: d }); break;
      case 'unlock': [523, 659, 784, 1046].forEach((f, i) => bell(f, { dur: 0.7, vol: 0.06, ratio: 2, index: 1.6, delay: i * 0.08 })); break;
      case 'shatter': n('white', 0.5, { vol: 0.14, f: 8000, to: 2000, type: 'highpass' }); n('brown', 0.25, { vol: 0.1, f: 500 }); for (let i = 0; i < 8; i++) o('triangle', 1500 + Math.random() * 3000, { to: 800, dur: 0.15, vol: 0.035, delay: i * 0.03 }); break;

      // ---------- enemigos, jefes y mundo ----------
      case 'notice': o('sine', 520, { to: 900, dur: 0.1, vol: 0.04 }); o('sine', 900, { to: 700, dur: 0.1, vol: 0.03, delay: 0.1 }); break;
      case 'windup': o('sawtooth', 160, { to: 420, dur: 0.55, vol: 0.04, lp: 900, att: 0.1 }); n('pink', 0.5, { vol: 0.04, f: 300, to: 1200, type: 'bandpass', att: 0.15 }); break;
      case 'shoot': o('triangle', 760, { to: 300, dur: 0.18, vol: 0.06 }); n('pink', 0.15, { vol: 0.05, f: 2500, to: 800, type: 'bandpass' }); break;
      case 'roar':
        n('brown', 1.2, { vol: 0.28, f: 700, to: 220, att: 0.08 }); o('sawtooth', 75, { to: 55, dur: 1.1, vol: 0.12, lp: 500, vib: 9, att: 0.06 });
        o('sawtooth', 150, { to: 100, dur: 1.0, vol: 0.05, bp: 600, q: 3, att: 0.06 });
        break;
      case 'stomp': n('brown', 0.6, { vol: 0.3, f: 220 }); o('sine', 48, { to: 28, dur: 0.6, vol: 0.32 }); n('white', 0.25, { vol: 0.06, f: 900, type: 'bandpass', delay: 0.02 }); break;
      case 'rumble': n('brown', 0.9, { vol: 0.16, f: 160, att: 0.1 }); o('sine', 40, { dur: 0.8, vol: 0.12, att: 0.1, vib: 4 }); break;
      case 'laser': o('sawtooth', 1300, { to: 500, dur: 0.7, vol: 0.04, lp: 3000, vib: 25 }); n('white', 0.7, { vol: 0.03, f: 5000, type: 'highpass' }); break;
      case 'gear': o('square', 130, { dur: 0.07, vol: 0.04, lp: 1200 }); n('white', 0.05, { vol: 0.05, f: 1800, type: 'bandpass', q: 3 }); o('triangle', 900, { dur: 0.04, vol: 0.02, delay: 0.03 }); break;
      case 'dark': o('sawtooth', 85, { to: 60, dur: 0.9, vol: 0.06, lp: 400, vib: 3, att: 0.08 }); n('brown', 0.7, { vol: 0.07, f: 300, att: 0.1 }); o('sine', 311, { to: 293, dur: 0.9, vol: 0.02, att: 0.2 }); break;
      case 'crack': n('white', 0.12, { vol: 0.1, f: 2400, type: 'bandpass', q: 1.5 }); o('square', 150, { to: 60, dur: 0.12, vol: 0.04, lp: 800 }); break;
      case 'crumble': n('brown', 0.8, { vol: 0.2, f: 420, att: 0.02 }); o('sine', 70, { to: 35, dur: 0.6, vol: 0.14 }); for (let i = 0; i < 6; i++) n('white', 0.04, { vol: 0.05, f: 1500, type: 'bandpass', delay: 0.1 + i * 0.08 }); break;
      case 'heart': o('sine', 58, { to: 46, dur: 0.15, vol: 0.4 }); o('sine', 52, { to: 42, dur: 0.17, vol: 0.32, delay: 0.2 }); break; // latido
      case 'talk': if (this._throttle('talk', 0.05)) o('square', 600 + Math.random() * 200, { dur: 0.035, vol: 0.022, lp: 2400 }); break;
      case 'open': o('sine', 520, { to: 780, dur: 0.07, vol: 0.06 }); o('triangle', 1040, { dur: 0.05, vol: 0.02, delay: 0.03 }); break;
      case 'uiMove': if (this._throttle('ui', 0.04)) o('sine', 880, { dur: 0.03, vol: 0.03 }); break;
      case 'back': o('sine', 520, { to: 330, dur: 0.08, vol: 0.05 }); break;
      case 'beep': o('square', 880, { dur: 0.12, vol: 0.04, lp: 3000 }); break;
      case 'go': o('square', 1320, { dur: 0.35, vol: 0.05, lp: 4000 }); o('square', 1980, { dur: 0.3, vol: 0.02, lp: 4000 }); break;
      case 'horn': o('sawtooth', 147, { dur: 0.9, vol: 0.06, lp: 900, att: 0.08 }); o('sawtooth', 220, { dur: 0.9, vol: 0.05, lp: 900, att: 0.08, delay: 0.02 }); n('brown', 0.6, { vol: 0.05, f: 300 }); break;
      case 'ko': o('sine', 90, { to: 35, dur: 0.6, vol: 0.3 }); n('brown', 0.5, { vol: 0.2, f: 300 }); bell(392, { dur: 1.2, vol: 0.05, ratio: 1.4, index: 2, delay: 0.1 }); break;
    }
  }
}
