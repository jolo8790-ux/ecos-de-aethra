// Música y ambiente sintetizados en tiempo real (sin archivos de audio).
// Un pequeño "secuenciador": cada canción tiene acordes, bajo, arpegios, melodía y percusión,
// escritos como texto. Las canciones cambian con un fundido (zona → jefe → victoria…).
import { SONGS, STINGERS } from './songs.js';
const FILE_SONGS = { title: { url: 'assets/intro/tema.mp3', vol: 0.6 } };
// banda sonora orquestal grabada (generada con Artlist): sustituye a las canciones sintetizadas que tienen versión
{
  const M = n => ({ url: `assets/music/${n}.mp3`, vol: 0.55 });
  for (const n of ['puerto', 'bosque', 'ruinas', 'ciudad', 'glaciar', 'ciudadela', 'mareth', 'forja', 'eco', 'boss', 'vaelor', 'finale', 'arena', 'infinito', 'desafio', 'creditos']) FILE_SONGS[n] = M(n);
  for (const n of ['boss_raiz', 'boss_escorpion', 'boss_coloso', 'boss_sierpe', 'boss_eco']) FILE_SONGS[n] = M('boss');
  FILE_SONGS.desafio_noche = M('desafio');
}

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function midi(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) return null;
  return NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12 * (+m[3] + 1);
}
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
const QUAL = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], sus4: [0, 5, 7], sus2: [0, 2, 7], dim: [0, 3, 6], add9: [0, 4, 7, 14], 5: [0, 7] };
function chord(sym) {
  const m = /^([A-G])([#b]?)(.*)$/.exec(sym);
  const root = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return { root, iv: QUAL[m[3]] || QUAL[''] };
}
// lista de notas de un acorde para arpegios: 1-3-5-(7)-8-10-12…
function chordTones(c, oct) {
  const base = c.root + 12 * (oct + 1), out = [];
  for (let o = 0; o < 3; o++) for (const i of c.iv) if (i < 12) out.push(base + i + 12 * o);
  return [...new Set(out)].sort((a, b) => a - b);
}
const toks = s => s.trim().split(/\s+/);

export class Music {
  constructor(audio) {
    this.audio = audio; this.ctx = null;
    this.musicVol = 0.6; this.duckK = 1; this.song = null; this.amb = null; this.wanted = null; this.wantedAmb = null;
    this.intensity = 0; this.intensityTarget = 0; this.ksCache = new Map(); // capa de combate y cuerdas pulsadas
  }
  // Se llama tras el primer gesto del jugador (los navegadores no dejan sonar antes).
  init() {
    const c = this.audio.ctx; if (!c || this.ctx) return !!this.ctx;
    this.ctx = c;
    this.master = c.createDynamicsCompressor();
    this.master.threshold.value = -14; this.master.ratio.value = 3; this.master.connect(c.destination);
    this.rev = c.createConvolver(); this.rev.buffer = this._impulse(2.8);
    this.revOut = c.createGain(); this.revOut.gain.value = 0.9; this.rev.connect(this.revOut); this.revOut.connect(this.master);
    this.musicBus = c.createGain(); this.musicBus.connect(this.master);
    this.musicSend = c.createGain(); this.musicSend.gain.value = 0.32; this.musicBus.connect(this.musicSend); this.musicSend.connect(this.rev);
    this.sfxBus = c.createGain(); this.sfxBus.gain.value = 1; this.sfxBus.connect(this.master);
    const sfxSend = c.createGain(); sfxSend.gain.value = 0.12; this.sfxBus.connect(sfxSend); sfxSend.connect(this.rev);
    this.audio.dest = this.sfxBus;
    this.noiseBuf = this._noise(2);
    this._applyVol();
    this.timer = setInterval(() => this._tick(), 25);
    if (this.wanted) { const w = this.wanted; this.wanted = null; this.play(w); }
    if (this.wantedAmb) { const w = this.wantedAmb; this.wantedAmb = null; this.ambient(w); }
    return true;
  }
  setVolume(v) { this.musicVol = v; this._applyVol(); }
  duck(k) { this.duckK = k; this._applyVol(); }
  _applyVol() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, v = this.musicVol * this.duckK * Math.min(1, this.audio.volume * 1.4) * 0.9;
    this.musicBus.gain.cancelScheduledValues(t); this.musicBus.gain.setTargetAtTime(v, t, 0.25);
  }

  // ---------- canciones ----------
  // (FILE_SONGS: canciones que vienen de un archivo de audio en lugar de tocarse nota a nota)
  play(name, { fade = 1.6 } = {}) {
    if (!this.ctx) { this.wanted = name; return; }
    if (this.song && this.song.name === name && !this.song.stopping) return;
    const old = this.song;
    if (old) this._stopSong(old, fade);
    if (FILE_SONGS[name]) { // canción grabada (tema principal hecho con Artlist), pasa por el mismo bus de música
      const c = this.ctx, F = FILE_SONGS[name];
      this.files = this.files || {};
      let f = this.files[name];
      if (!f) { const el = new Audio(F.url); el.loop = true; el.preload = 'auto'; const src = c.createMediaElementSource(el); f = this.files[name] = { el, src }; }
      const out = c.createGain(); out.gain.value = 0.0001; f.src.disconnect(); f.src.connect(out); out.connect(this.musicBus);
      out.gain.setTargetAtTime(F.vol, c.currentTime + (old ? fade * 0.4 : 0), fade / 3);
      clearTimeout(f.pauseT); const p = f.el.play(); if (p && p.catch) p.catch(() => {});
      this.song = { name, S: { vol: F.vol }, out, file: f, stopping: false };
      return;
    }
    if (!name || !SONGS[name]) { this.song = null; return; }
    const S = SONGS[name], c = this.ctx;
    const out = c.createGain(); out.gain.value = 0.0001; out.connect(this.musicBus);
    out.gain.setTargetAtTime(S.vol || 1, c.currentTime + (old ? fade * 0.4 : 0), fade / 3);
    this.song = { name, S, out, step: 0, next: c.currentTime + 0.12, stopping: false, last: {} };
  }
  current() { return this.song && !this.song.stopping ? this.song.name : null; }
  _stopSong(s, fade) {
    s.stopping = true; const t = this.ctx.currentTime;
    s.out.gain.cancelScheduledValues(t); s.out.gain.setTargetAtTime(0.0001, t, fade / 4);
    if (s.file) { const f = s.file; f.pauseT = setTimeout(() => { if (!(this.song && this.song.file === f && !this.song.stopping)) f.el.pause(); s.out.disconnect(); }, fade * 1000 + 600); return; }
    setTimeout(() => s.out.disconnect(), fade * 1000 + 600);
  }
  // fanfarria corta; la canción de fondo baja mientras suena
  stinger(name) {
    if (!this.ctx || !STINGERS[name]) return;
    const st = STINGERS[name], c = this.ctx, t0 = c.currentTime + 0.05, beat = 60 / st.bpm;
    const out = c.createGain(); out.gain.value = st.vol || 1; out.connect(this.musicBus);
    for (const [inst, notes] of st.parts) {
      let t = t0;
      for (const tok of toks(notes)) {
        const [n, len = '1'] = tok.split(':'), d = +len * beat;
        if (n !== '.') for (const nn of n.split('+')) this._note(inst, out, t, hz(midi(nn)), d * 1.1, 0.9);
        t += d;
      }
    }
    if (this.song) { const g = this.song.out.gain, v = this.song.S.vol || 1; g.cancelScheduledValues(t0); g.setTargetAtTime(v * 0.15, t0, 0.08); g.setTargetAtTime(v, t0 + st.len * beat, 0.6); }
    setTimeout(() => out.disconnect(), (st.len * beat + 4) * 1000);
  }

  // 0 = calma, 1 = combate: añade tambores grandes, platillos y metales graves a cualquier canción
  setIntensity(v) { this.intensityTarget = Math.max(0, Math.min(1, v)); }
  _tick() {
    const c = this.ctx; if (!c) return;
    const it = this.intensityTarget; this.intensity += (it - this.intensity) * (it > this.intensity ? 0.08 : 0.012);
    const s = this.song;
    if (s && !s.stopping && !s.file) {
      const S = s.S, grid = 60 / S.bpm / 4; // semicorcheas
      while (s.next < c.currentTime + 0.15) {
        this._step(s, s.step, s.next, grid);
        s.step++; s.next += grid;
      }
    }
    if (this.amb) this._ambTick();
  }
  _step(s, step, t, grid) {
    const S = s.S, bar = Math.floor(step / 16), pos = step % 16;
    const nBars = S.chords.length, ci = bar % nBars;
    const ch = chord(S.chords[ci]), tr = S.transpose || 0;
    if (S.swing && pos % 4 === 2) t += S.swing * grid;
    // capa de combate (no en las canciones que ya son de batalla)
    const I = this.intensity;
    if (I > 0.08 && !S.battle) {
      if ('x.....x.x..x..x.'[pos] === 'x') this._drum('taiko', s.out, t, 0.55 * I * (pos === 0 ? 1.3 : 1));
      if (pos % 4 === 2) this._drum('ohat', s.out, t, 0.28 * I);
      if (pos === 0 && bar % 4 === 0 && I > 0.5) this._drum('crash', s.out, t, 0.3 * I);
      if (pos === 0 || pos === 10) { const r = ch.root + 12 * 3 + tr; for (const m of [r, r + 7]) this._note('brass', s.out, t, hz(m), grid * (pos === 0 ? 5 : 3), 0.32 * I); }
      if (pos % 2 === 0 && I > 0.4) this._note('bass', s.out, t, hz(ch.root + 12 * 2 + tr + (pos % 8 === 6 ? 7 : 0)), grid * 1.6, 0.22 * I);
    }
    for (let k = 0; k < S.tracks.length; k++) {
      const T = S.tracks[k];
      if (T.from && bar < T.from) continue;
      if (T.every && Math.floor(bar / nBars) % T.every !== (T.on || 0)) continue;
      const vol = T.vol ?? 0.5;
      if (T.type === 'pad') {
        if (pos !== 0) continue;
        const base = ch.root + 12 * ((T.oct ?? 3) + 1) + tr;
        const notes = ch.iv.filter(i => i < 12).map((i, j) => base + i + (j === 1 && T.open ? 12 : 0));
        for (const m of notes) this._note(T.inst, s.out, t, hz(m), grid * 16 * (T.len || 1), vol / notes.length * 1.6);
        continue;
      }
      if (T.type === 'mel' || T.type === 'bass' || T.type === 'arp' || T.type === 'drum' || T.type === 'stab') {
        const src = T.type === 'mel' ? T.notes[bar % T.notes.length] : Array.isArray(T.pattern) ? T.pattern[bar % T.pattern.length] : T.pattern;
        const tk = T.type === 'drum' || T.type === 'stab' ? src.replace(/\s+/g, '').split('') : toks(src);
        const per = 16 / tk.length;
        if (pos % per !== 0) continue;
        const i = pos / per, tok = tk[i];
        if (tok === '.' || tok === '-') continue;
        let len = 1; while (i + len < tk.length && tk[i + len] === '-') len++;
        const dur = len * per * grid;
        if (T.type === 'drum') { this._drum(T.inst, s.out, t, tok === 'X' ? vol * 1.4 : vol); continue; }
        if (T.type === 'stab') {
          const base = ch.root + 12 * ((T.oct ?? 4) + 1) + tr;
          for (const iv of ch.iv) if (iv < 12) this._note(T.inst, s.out, t, hz(base + iv), dur * 0.9, vol / 3 * (tok === 'X' ? 1.3 : 1));
          continue;
        }
        let m;
        if (T.type === 'mel') m = midi(tok) + tr;
        else if (T.type === 'bass') {
          const r = ch.root + 12 * ((T.oct ?? 2) + 1) + tr;
          m = { R: r, F: r + 7, O: r + 12, T: r + ch.iv[1], f: r - 5 }[tok]; if (m == null) continue;
        } else {
          const tones = chordTones(ch, T.oct ?? 4), d = parseInt(tok, 36);
          if (Number.isNaN(d)) continue; m = tones[Math.min(d, tones.length - 1)] + tr;
        }
        this._note(T.inst, s.out, t, hz(m), dur * (T.legato ?? 0.95), vol);
      }
    }
  }

  // ---------- instrumentos ----------
  _env(g, t, a, peak, dur, rel) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(peak * 0.7, t + a, dur * 0.4);
    g.gain.setTargetAtTime(0.0001, t + dur, rel / 3);
  }
  _osc(type, f, t, end, dest, det = 0) {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det;
    o.connect(dest); o.start(t); o.stop(end); return o;
  }
  _note(inst, out, t, f, dur, vel) {
    const c = this.ctx, g = c.createGain(); g.connect(out);
    const end = t + dur + 2.5;
    switch (inst) {
      case 'pad': case 'choir': case 'strings': {
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = inst === 'strings' ? 2200 : 1100; lp.Q.value = 0.5; lp.connect(g);
        const types = inst === 'choir' ? ['triangle', 'sawtooth'] : ['sawtooth', 'sawtooth'];
        this._osc(types[0], f, t, end, lp, -7); this._osc(types[1], f, t, end, lp, 7);
        if (inst === 'choir') { const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 800; bp.Q.value = 2; lp.disconnect(); lp.connect(bp); bp.connect(g); }
        const a = inst === 'strings' ? 0.12 : 0.6;
        this._env(g, t, a, vel * (inst === 'strings' ? 0.16 : 0.12), dur, inst === 'strings' ? 0.5 : 1.4);
        break;
      }
      case 'pluck': case 'harp': case 'oud': {
        const buf = this._ks(f, inst);
        if (buf) {
          const src = c.createBufferSource(); src.buffer = buf; src.playbackRate.value = f / buf._f;
          const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = inst === 'oud' ? 3200 : 6000; src.connect(lp); lp.connect(g);
          g.gain.value = vel * (inst === 'harp' ? 0.55 : 0.5); src.start(t); src.stop(t + buf.duration);
          if (inst === 'harp') { const g2 = c.createGain(); g2.connect(out); g2.gain.setValueAtTime(vel * 0.05, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 1.4); this._osc('sine', f * 2, t, t + 1.5, g2); }
          break;
        }
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.connect(g);
        lp.frequency.setValueAtTime(inst === 'oud' ? 2600 : 4200, t); lp.frequency.exponentialRampToValueAtTime(500, t + 0.6);
        this._osc(inst === 'oud' ? 'sawtooth' : 'triangle', f, t, t + 1.6, lp);
        if (inst === 'harp') this._osc('sine', f * 2, t, t + 1.6, lp);
        g.gain.setValueAtTime(vel * 0.32, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (inst === 'harp' ? 1.5 : 0.9));
        break;
      }
      case 'marimba': {
        this._osc('sine', f, t, t + 0.9, g); const g2 = c.createGain(); g2.connect(g); g2.gain.setValueAtTime(0.35, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        this._osc('sine', f * 4, t, t + 0.2, g2);
        g.gain.setValueAtTime(vel * 0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
        break;
      }
      case 'bell': case 'glass': {
        const mod = c.createOscillator(), mg = c.createGain();
        mod.frequency.value = f * (inst === 'glass' ? 7.1 : 3.5); mg.gain.setValueAtTime(f * (inst === 'glass' ? 1.2 : 2.2), t); mg.gain.exponentialRampToValueAtTime(1, t + 1.2);
        mod.connect(mg); const car = this._osc('sine', f, t, t + 3.2, g); mg.connect(car.frequency); mod.start(t); mod.stop(t + 3.2);
        g.gain.setValueAtTime(vel * 0.22, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (inst === 'glass' ? 2.4 : 3));
        break;
      }
      case 'epiano': { // piano eléctrico (FM)
        const mod = c.createOscillator(), mg = c.createGain(); mod.frequency.value = f * 1; mg.gain.setValueAtTime(f * 1.4, t); mg.gain.exponentialRampToValueAtTime(f * 0.1, t + 1);
        mod.connect(mg); const car = this._osc('sine', f, t, t + 2.2, g); mg.connect(car.frequency); mod.start(t); mod.stop(t + 2.2);
        this._osc('sine', f * 2, t, t + 0.4, g).detune.value = 4;
        g.gain.setValueAtTime(vel * 0.24, t); g.gain.setTargetAtTime(vel * 0.12, t + 0.05, 0.3); g.gain.setTargetAtTime(0.0001, t + dur, 0.2);
        break;
      }
      case 'flute': case 'lead': case 'brass': {
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = inst === 'brass' ? 1800 : 3000; lp.connect(g);
        const o = this._osc(inst === 'flute' ? 'sine' : inst === 'brass' ? 'sawtooth' : 'triangle', f, t, end, lp);
        if (inst !== 'brass') this._osc('triangle', f * 2, t, end, lp).detune.value = 3;
        const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.006, t + 0.4);
        lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(end);
        if (inst === 'brass') { lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(2200, t + 0.08); }
        this._env(g, t, inst === 'flute' ? 0.06 : 0.03, vel * (inst === 'brass' ? 0.13 : 0.17), dur, 0.25);
        break;
      }
      case 'bass': case 'subbass': {
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = inst === 'bass' ? 700 : 300; lp.connect(g);
        this._osc('triangle', f, t, end, lp); this._osc('sine', f / 2, t, end, lp);
        this._env(g, t, 0.01, vel * 0.42, dur, 0.12);
        break;
      }
      case 'accordion': {
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600; lp.connect(g);
        this._osc('square', f, t, end, lp, -6); this._osc('square', f, t, end, lp, 6);
        this._env(g, t, 0.05, vel * 0.07, dur, 0.15);
        break;
      }
      default: this._osc('sine', f, t, t + dur + 0.3, g); this._env(g, t, 0.02, vel * 0.2, dur, 0.2);
    }
  }
  _drum(kind, out, t, vel) {
    const c = this.ctx, g = c.createGain(); g.connect(out);
    const noise = (f1, type, len, q = 1) => {
      const s = c.createBufferSource(); s.buffer = this.noiseBuf; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = f1; f.Q.value = q;
      s.connect(f); f.connect(g); s.start(t, Math.random() * 1.5); s.stop(t + len);
    };
    switch (kind) {
      case 'kick': case 'tom': case 'toll': {
        if (kind === 'kick') { const cl = c.createGain(); cl.connect(out); cl.gain.setValueAtTime(vel * 0.25, t); cl.gain.exponentialRampToValueAtTime(0.0001, t + 0.02); this._osc('square', 1800, t, t + 0.03, cl); }
        const o = c.createOscillator(); o.connect(g);
        const f0 = kind === 'kick' ? 130 : kind === 'tom' ? 180 : 90, f1 = kind === 'kick' ? 42 : kind === 'tom' ? 90 : 55;
        o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + (kind === 'toll' ? 0.6 : 0.14));
        o.start(t); o.stop(t + (kind === 'toll' ? 1.6 : 0.5));
        g.gain.setValueAtTime(vel * (kind === 'toll' ? 0.5 : 0.7), t); g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'toll' ? 1.5 : 0.4));
        if (kind === 'toll') { const g2 = c.createGain(); g2.connect(out); g2.gain.setValueAtTime(vel * 0.08, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 3); this._osc('sine', 392, t, t + 3, g2); this._osc('sine', 587, t, t + 3, g2); }
        break;
      }
      case 'snare': { noise(1900, 'bandpass', 0.22, 0.8); noise(5000, 'highpass', 0.12); const o = this._osc('triangle', 220, t, t + 0.12, g); o.frequency.exponentialRampToValueAtTime(160, t + 0.08); g.gain.setValueAtTime(vel * 0.42, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); break; }
      case 'ohat': noise(7500, 'highpass', 0.3); g.gain.setValueAtTime(vel * 0.13, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28); break;
      case 'crash': { noise(5000, 'highpass', 1.8, 0.5); for (const f0 of [3150, 4440, 5830]) { const o = this._osc('square', f0, t, t + 1.5, g); o.detune.value = Math.random() * 30; } g.gain.setValueAtTime(vel * 0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6); break; }
      case 'taiko': { // tambor grande de batalla
        const o = c.createOscillator(); o.connect(g); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.25); o.start(t); o.stop(t + 0.7);
        noise(400, 'lowpass', 0.12, 0.7); g.gain.setValueAtTime(vel * 0.75, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6); break;
      }
      case 'hat': noise(8000, 'highpass', 0.06); g.gain.setValueAtTime(vel * 0.16, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); break;
      case 'shaker': noise(6000, 'bandpass', 0.09, 1.5); g.gain.setValueAtTime(vel * 0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08); break;
      case 'tick': noise(3200, 'bandpass', 0.03, 6); g.gain.setValueAtTime(vel * 0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03); break;
      case 'darbuka': { this._osc('sine', 260, t, t + 0.25, g).frequency.exponentialRampToValueAtTime(180, t + 0.15); noise(2500, 'bandpass', 0.05, 2); g.gain.setValueAtTime(vel * 0.4, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22); break; }
      case 'clap': noise(1400, 'bandpass', 0.15, 1.2); g.gain.setValueAtTime(vel * 0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14); break;
    }
  }

  // ---------- ambiente ----------
  ambient(kind) {
    if (!this.ctx) { this.wantedAmb = kind; return; }
    if (this.amb && this.amb.kind === kind) return;
    const c = this.ctx, t = c.currentTime;
    if (this.amb) { const a = this.amb; a.out.gain.setTargetAtTime(0.0001, t, 0.6); setTimeout(() => { a.nodes.forEach(n => { try { n.stop(); } catch (e) {} }); a.out.disconnect(); }, 3500); this.amb = null; }
    if (!kind) return;
    const out = c.createGain(); out.gain.value = 0.0001; out.connect(this.sfxBus); out.gain.setTargetAtTime(1, t, 1.2);
    const A = this.amb = { kind, out, nodes: [], nextEv: t + 2 };
    const bed = (type, f, q, vol, lfoHz = 0.07, lfoAmt = 0.5) => {
      const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = c.createGain(); g.gain.value = vol;
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = lfoHz; lg.gain.value = vol * lfoAmt; lfo.connect(lg); lg.connect(g.gain);
      s.connect(fl); fl.connect(g); g.connect(out); s.start(); lfo.start(); A.nodes.push(s, lfo);
    };
    switch (kind) {
      case 'sea': bed('lowpass', 500, 0.7, 0.05, 0.09, 0.8); bed('bandpass', 1400, 0.6, 0.012, 0.05); break;
      case 'forest': bed('bandpass', 900, 0.5, 0.012, 0.05); break;
      case 'desert': bed('bandpass', 700, 1.2, 0.03, 0.06, 0.9); break;
      case 'city': bed('lowpass', 180, 0.8, 0.03, 0.03); break;
      case 'ice': bed('bandpass', 1800, 4, 0.02, 0.08, 0.9); bed('lowpass', 300, 0.7, 0.025, 0.04); break;
      case 'underwater': bed('lowpass', 260, 0.9, 0.09, 0.12, 0.7); bed('bandpass', 700, 2, 0.012, 0.2, 0.9); A.nextEv = t + 0.3; break; // presión del agua y corrientes
      case 'dark': {
        bed('lowpass', 220, 0.7, 0.03, 0.04);
        const g = c.createGain(); g.gain.value = 0.02; g.connect(out);
        for (const [f, d] of [[55, -5], [55, 6], [82.4, 0]]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160; o.connect(lp); lp.connect(g); o.start(); A.nodes.push(o); }
        break;
      }
    }
  }
  _ambTick() {
    const A = this.amb, c = this.ctx; if (c.currentTime < A.nextEv) return;
    const t = c.currentTime + 0.05, r = Math.random;
    const chirp = (f0, f1, len, vol, n = 1, gap = 0.09) => {
      for (let i = 0; i < n; i++) {
        const o = c.createOscillator(), g = c.createGain(); o.type = 'sine';
        const tt = t + i * gap; o.frequency.setValueAtTime(f0, tt); o.frequency.exponentialRampToValueAtTime(f1, tt + len);
        g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(vol, tt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, tt + len);
        const p = c.createStereoPanner ? c.createStereoPanner() : null;
        if (p) { p.pan.value = r() * 1.6 - 0.8; o.connect(g); g.connect(p); p.connect(A.out); } else { o.connect(g); g.connect(A.out); }
        o.start(tt); o.stop(tt + len + 0.05);
      }
    };
    switch (A.kind) {
      case 'sea': chirp(1500 + r() * 400, 900, 0.35, 0.012, 2, 0.4); A.nextEv = t + 6 + r() * 8; break; // gaviotas
      case 'forest': chirp(2800 + r() * 1500, 4200 + r() * 800, 0.08, 0.02, 2 + Math.floor(r() * 4)); A.nextEv = t + 1.5 + r() * 4; break;
      case 'desert': A.nextEv = t + 10; break;
      case 'city': { const f = 900 + r() * 600; chirp(f, f * 0.98, 0.05, 0.02, 3, 0.18); A.nextEv = t + 3 + r() * 5; break; }
      case 'ice': chirp(3000 + r() * 2500, 2800 + r() * 2000, 0.6, 0.008, 1 + Math.floor(r() * 3), 0.15); A.nextEv = t + 2 + r() * 5; break;
      case 'dark': chirp(180, 120, 1.2, 0.015); A.nextEv = t + 7 + r() * 6; break;
      case 'underwater': { const f = 350 + r() * 900; chirp(f, f * (1.8 + r()), 0.06 + r() * 0.05, 0.03, 2 + Math.floor(r() * 5), 0.05 + r() * 0.08); A.nextEv = t + 0.3 + r() * 1.4; break; } // burbujas que suben
      default: A.nextEv = t + 10;
    }
  }

  // Karplus-Strong: una cuerda pulsada de verdad, calculada una vez por instrumento y altura
  _ks(f, inst) {
    const c = this.ctx; if (!c) return null;
    const m = Math.round(12 * Math.log2(f / 440)), key = inst + m;
    if (this.ksCache.has(key)) return this.ksCache.get(key);
    const F = 440 * Math.pow(2, m / 12), sr = c.sampleRate, N = Math.max(2, Math.round(sr / F)), len = Math.floor(sr * (inst === 'harp' ? 1.8 : 1.1));
    const b = c.createBuffer(1, len, sr), d = b.getChannelData(0), ring = new Float32Array(N);
    for (let i = 0; i < N; i++) ring[i] = (Math.random() * 2 - 1) * (inst === 'oud' ? 1 : 0.8);
    const damp = inst === 'harp' ? 0.998 : inst === 'oud' ? 0.994 : 0.996, mix = inst === 'oud' ? 0.35 : 0.5;
    let idx = 0;
    for (let i = 0; i < len; i++) { const a = ring[idx], nx = ring[(idx + 1) % N]; d[i] = a; ring[idx] = damp * (mix * a + (1 - mix) * nx); idx = (idx + 1) % N; }
    b._f = F; this.ksCache.set(key, b); return b;
  }
  _noise(sec) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  _impulse(sec) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
    return b;
  }
}
