// Arena de Aethra: modo multijugador.
// Tres modos: Duelo (todos contra todos, gana quien logre 3 KO), Cooperativo (oleadas de enemigos y jefes,
// el equipo comparte 6 vidas) y Carrera de piezas (gana quien junte 8 piezas de luz).
// Se juega contra la CPU, con dos jugadores en la misma pantalla (teclado + teclado o mando)
// o online en tiempo real con quien abra la misma sala.
import * as THREE from 'three';
import { Player } from './player.js';
import { HEROES, heroById, heroLook, heroUnlocked } from './heroes.js';
import { POWERS, loadout, powerUnlocked } from './powers.js';
import { auraOf, titleOf } from './characters.js';

export const ARENA_MODES = {
  duelo: { name: 'Duelo', icon: '⚔', desc: 'Todos contra todos. Gana quien consiga 3 KO.', goal: 3 },
  coop: { name: 'Cooperativo', icon: '⛨', desc: 'Juntos contra oleadas de enemigos y jefes. El equipo tiene 6 vidas.', goal: 0 },
  carrera: { name: 'Carrera de piezas', icon: '✦', desc: 'Atrapa piezas de luz antes que nadie. Gana quien junte 8.', goal: 8 },
};

export const ARENA_ZONE = {
  id: 'arena', arena: true, title: 'Arena de Aethra', subtitle: 'Multijugador', seed: 41,
  sky: { top: 0x2e2660, bottom: 0xf3a77e, fog: 0xd59a9a, fogNear: 55, fogFar: 180 },
  light: { hemiSky: 0xf0e0ff, hemiGround: 0x4a3a5a, sun: 0xffe2c0 },
  palette: { top: 0xcdb592, side: 0x7d6a74 },
  water: { y: -16, color: 0xd59a9a },
  start: { id: 'centro', pos: [0, 0, 8], facing: 0 },
  islands: [
    { x: 0, z: 0, w: 26, d: 26, top: 0, depth: 5 },
    { x: -9, z: -9, w: 5, d: 5, top: 1.4, depth: 1.6 }, { x: 9, z: -9, w: 5, d: 5, top: 1.4, depth: 1.6 },
    { x: -9, z: 9, w: 5, d: 5, top: 1.4, depth: 1.6 }, { x: 9, z: 9, w: 5, d: 5, top: 1.4, depth: 1.6 },
    { x: 0, z: -19.5, w: 8, d: 7, top: 0.6, depth: 3 }, { x: 0, z: 19.5, w: 8, d: 7, top: 0.6, depth: 3 },
    { x: -19.5, z: 0, w: 7, d: 8, top: 0.6, depth: 3 }, { x: 19.5, z: 0, w: 7, d: 8, top: 0.6, depth: 3 },
    { x: 19.5, z: -9, w: 4, d: 4, top: 6.5, depth: 1.4 }, { x: -19.5, z: 9, w: 4, d: 4, top: 6.5, depth: 1.4 },
  ],
  updrafts: [{ x: 19.5, z: 1.5, y0: 0.6, y1: 10, color: 0xffd8a8 }, { x: -19.5, z: -1.5, y0: 0.6, y1: 10, color: 0xffd8a8 }],
  crystals: [{ x: -2.5, z: -20.5, y: 0.6, s: 0.8, color: 0xffb0d8 }, { x: 2.5, z: 20.5, y: 0.6, s: 0.8, color: 0x9fe3ff }, { x: 19.5, z: -9, y: 6.5, s: 0.7, color: 0xffd27a }, { x: -19.5, z: 9, y: 6.5, s: 0.7, color: 0xffd27a }],
  banners: [{ x: -12.3, z: -12.3, rot: Math.PI / 4 }, { x: 12.3, z: -12.3, rot: -Math.PI / 4 }, { x: -12.3, z: 12.3, rot: Math.PI * 0.75 }, { x: 12.3, z: 12.3, rot: -Math.PI * 0.75 }],
  obelisks: [{ x: 2.6, y: 0.6, z: -21.5, h: 5 }, { x: -2.6, y: 0.6, z: 21.5, h: 5 }],
};
const SPAWNS = [[0, 0, 8, 0], [0, 0, -8, Math.PI], [8, 0, 0, Math.PI / 2], [-8, 0, 0, -Math.PI / 2], [6, 0, 6, Math.PI / 4], [-6, 0, -6, -Math.PI * 0.75], [6, 0, -6, Math.PI * 0.75], [-6, 0, 6, -Math.PI / 4]];
// lugares donde aparecen las piezas de luz de la carrera (encima del suelo)
const ORB_SPOTS = [];
for (let x = -10; x <= 10; x += 5) for (let z = -10; z <= 10; z += 5) if (Math.abs(x) !== 10 || Math.abs(z) !== 10) ORB_SPOTS.push([x, 0, z]);
ORB_SPOTS.push([-9, 1.4, -9], [9, 1.4, -9], [-9, 1.4, 9], [9, 1.4, 9], [0, 0.6, -19.5], [0, 0.6, 19.5], [-19.5, 0.6, 0], [19.5, 0.6, 0], [19.5, 6.5, -9], [-19.5, 6.5, 9]);
const COLORS = ['#4cbcff', '#ff7a5a', '#8be36a', '#ffd24a', '#c98bff', '#ff8ad0', '#5ae0d0', '#f0f0f0'];
const ARENA_DIFF = { dmg: 1, invuln: 0.75, glide: 6, gust: 0.5, air: 22 };
const BOT_LEVEL = { facil: { think: 0.42, atk: 0.35, dodge: 0.1 }, normal: { think: 0.26, atk: 0.6, dodge: 0.25 }, dificil: { think: 0.15, atk: 0.85, dodge: 0.45 }, auto: { think: 0.26, atk: 0.6, dodge: 0.25 } };

function seeded(seed) { let s = (seed * 9301 + 49297) % 233280 || 1; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const r2 = v => Math.round(v * 100) / 100;
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- entradas del jugador 2 y de la CPU (misma forma que Input) ----------
const P2KEYS = { power1: ['KeyJ'], power2: ['KeyK'], power3: ['KeyL'], up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], jump: ['Slash', 'Numpad0', 'ControlRight', 'Minus'], attack: ['Period', 'Numpad1'], dodge: ['Comma', 'Numpad2'], pulse: ['KeyM', 'Numpad3'], shield: ['KeyN', 'Numpad5'] };
export class P2Input {
  constructor(main) { this.main = main; this.move = { x: 0, y: 0 }; this.look = { x: 0, y: 0 }; this.zoom = 0; this.walk = false; this.pad = null; this._p = new Set(); this._prev = {}; this._prevPad = {}; }
  poll() {
    const k = this.main.keys, any = list => list.some(c => k[c]);
    let mx = (any(P2KEYS.right) ? 1 : 0) - (any(P2KEYS.left) ? 1 : 0), my = (any(P2KEYS.up) ? 1 : 0) - (any(P2KEYS.down) ? 1 : 0);
    this._p.clear();
    for (const a of ['jump', 'attack', 'dodge', 'pulse', 'power1', 'power2', 'power3']) { const now = any(P2KEYS[a]); if (now && !this._prev[a]) this._p.add(a); this._prev[a] = now; }
    this._held = { jump: any(P2KEYS.jump), shield: any(P2KEYS.shield), dodge: any(P2KEYS.dodge) };
    this.look.x = this.look.y = 0;
    const k2 = this.main.keys; if (k2.Numpad4) this.look.x -= 6; if (k2.Numpad6) this.look.x += 6;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = this.pad != null ? pads[this.pad] : null;
    if (pad) {
      const dz = v => Math.abs(v) < 0.15 ? 0 : v;
      mx += dz(pad.axes[0] || 0); my -= dz(pad.axes[1] || 0);
      this.look.x = dz(pad.axes[2] || 0) * 14; this.look.y = dz(pad.axes[3] || 0) * 10;
      const b = i => pad.buttons[i] && pad.buttons[i].pressed;
      const edge = (i, a) => { const now = b(i); if (now && !this._prevPad[i]) this._p.add(a); this._prevPad[i] = now; };
      edge(0, 'jump'); edge(2, 'attack'); edge(1, 'dodge'); edge(6, 'pulse'); edge(7, 'pulse'); edge(10, 'power1'); edge(11, 'power2'); edge(13, 'power3');
      if (b(0)) this._held.jump = true; if (b(4)) this._held.shield = true; if (b(1)) this._held.dodge = true;
    }
    const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
    this.move.x = mx; this.move.y = my;
  }
  pressed(a) { return this._p.has(a); }
  held(a) { return !!(this._held && this._held[a]); }
}
class BotInput {
  constructor(level) { this.L = level; this.move = { x: 0, y: 0 }; this.walk = false; this._p = new Set(); this._h = {}; this.t = 0; this.want = { x: 0, z: 0 }; this.strafe = 1; this.stuck = 0; this.last = null; }
  pressed(a) { return this._p.has(a); }
  held(a) { return !!this._h[a]; }
  // decide hacia dónde ir y qué hacer, como si moviera un mando
  think(dt, me, game, camYaw) {
    this._p.clear(); this.t -= dt;
    const p = me.player.pos;
    if (this.t <= 0) {
      this.t = this.L.think * (0.7 + Math.random() * 0.6);
      let tgt = null, kind = '';
      if (game.mode === 'coop') { let bd = Infinity; for (const e of game.ctx.combat.enemies) { if (!e.alive) continue; const d = e.pos.distanceTo(p); if (d < bd) { bd = d; tgt = e.pos; } } kind = 'foe'; }
      else if (game.mode === 'carrera') { let bd = Infinity; for (const o of game.orbMeshes.values()) { const d = o.position.distanceTo(p) + Math.abs(o.position.y - p.y) * 3; if (d < bd) { bd = d; tgt = o.position; } } kind = 'orb'; }
      if (!tgt || (game.mode === 'carrera' && Math.random() < 0.15)) { // en duelo (o a veces en la carrera) va a por el rival más cercano
        let bd = Infinity; for (const f of game.fighters) { if (f === me || f.koT > 0) continue; const d = f.player.pos.distanceTo(p); if (d < bd) { bd = d; tgt = f.player.pos; } }
        kind = kind === 'orb' && tgt ? 'foe' : kind || 'foe';
      }
      this.tgt = tgt ? tgt.clone() : null; this.kind = kind;
      if (Math.random() < 0.25) this.strafe = -this.strafe;
      // atascado: salta
      if (this.last && this.last.distanceTo(p) < 0.15 && this.tgt && this.tgt.distanceTo(p) > 2.5) this.stuck += 1; else this.stuck = 0;
      this.last = p.clone();
    }
    let wx = 0, wz = 0;
    this._h.jump = false; this._h.shield = false;
    if (this.tgt) {
      const dx = this.tgt.x - p.x, dz = this.tgt.z - p.z, d = Math.hypot(dx, dz) || 1, dy = this.tgt.y - p.y;
      if (this.kind === 'foe' && d < 1.9) { // a distancia de golpe: rodea un poco y golpea
        wx = -dz / d * 0.35 * this.strafe; wz = dx / d * 0.35 * this.strafe;
        me.player.facing += angleDiff(Math.atan2(-dx, -dz), me.player.facing) * Math.min(1, dt * 8);
        if (Math.random() < this.L.atk * dt * 3.2) this._p.add('attack');
      } else { wx = dx / d; wz = dz / d; }
      if ((dy > 0.7 && d < 6) || this.stuck > 1) { if (me.player.grounded || (me.player.jumps === 1 && me.player.vel.y < 1)) this._p.add('jump'); this._h.jump = true; }
      if (this.kind === 'foe' && d < 4.5 && me.player.pulseCd <= 0 && Math.random() < this.L.atk * dt * 0.6) this._p.add('pulse');
      if (this.kind === 'foe' && d < 9 && (me.player.energy || 0) > 45 && Math.random() < this.L.atk * dt * 0.5) this._p.add('power' + (1 + Math.floor(Math.random() * 3)));
      // esquiva cuando un rival cercano golpea
      for (const f of game.fighters) {
        if (f === me || f.koT > 0 || !f.player.attack) continue;
        if (f.player.pos.distanceTo(p) < 2.6 && Math.random() < this.L.dodge * dt * 6) { if (Math.random() < 0.5) this._p.add('dodge'); else this._h.shield = true; }
      }
    }
    // no caerse: lejos del borde vuelve al centro
    const R = Math.max(Math.abs(p.x), Math.abs(p.z));
    if (R > 12 && !(Math.abs(p.x) > 15 || Math.abs(p.z) > 15)) { const l = Math.hypot(p.x, p.z) || 1; const k = (R - 12) * 1.2; wx -= p.x / l * k; wz -= p.z / l * k; }
    if (me.player.pos.y < -1 && !me.player.grounded) { this._h.jump = true; const l = Math.hypot(p.x, p.z) || 1; wx = -p.x / l; wz = -p.z / l; } // cayendo: planea hacia el centro
    const l = Math.hypot(wx, wz); if (l > 1) { wx /= l; wz /= l; }
    // dirección del mundo → ejes del mando según la cámara
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    this.move.y = wx * fx + wz * fz; this.move.x = wx * rx + wz * rz;
  }
}

// cartel con el nombre sobre la cabeza
function nameplate(text, color, title = '') {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const c = cv.getContext('2d');
  c.font = 'bold 30px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = Math.min(250, c.measureText(text).width + 30);
  c.fillStyle = 'rgba(10,16,30,.6)'; c.beginPath(); c.roundRect((256 - w) / 2, 10, w, 44, 22); c.fill();
  c.fillStyle = color; c.fillText(text, 128, 33);
  if (title) { c.font = 'italic 600 20px system-ui, sans-serif'; c.fillStyle = 'rgba(10,16,30,.55)'; const tw = Math.min(250, c.measureText(title).width + 20); c.beginPath(); c.roundRect((256 - tw) / 2, 60, tw, 28, 14); c.fill(); c.fillStyle = '#ffe9b0'; c.fillText(title, 128, 74); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(1.6, 0.6, 1); s.renderOrder = 10; s.center.set(0.5, 0.65); return s;
}
// puntos de aparición: los 8 fijos y, si hay más jugadores, en anillos alrededor del centro
function spawnAt(i) {
  if (i < SPAWNS.length) return SPAWNS[i];
  const a = i * 2.39996, r = 4 + (i % 3) * 2.8;
  return [Math.sin(a) * r, 0, Math.cos(a) * r, a];
}
const hex = n => '#' + n.toString(16).padStart(6, '0');
const BAD = /\b(put[ao]s?|mierda|pendej[oa]s?|idiota|est[uú]pid[oa]|imb[eé]cil|boludo|pelotudo|cabr[oó]n|co[nñ]o|joder|verga|culiao|maric[oó]n|forro|hdp|fuck|shit|bitch)\b/gi;
const QUICK = ['¡Hola! 👋', '¡Buena jugada!', '¡GG!', '¡Vamos equipo!', '¡Ayuda!', '¡Revancha!', '😂', '🔥'];
const MUTE = { play() {}, unlock() {} };

export class Arena {
  constructor(ctx) { this.ctx = ctx; this.active = false; this.fighters = []; this.orbMeshes = new Map(); this.decor = []; }

  // ---------- empezar / terminar ----------
  // opts: { mode, players: 'cpu' | 'local' | 'online', net, p2hero, from }
  start(opts) {
    const C = this.ctx;
    this.opts = opts; this.mode = opts.mode; this.net = opts.net || null; this.active = true;
    this.from = opts.from; this.ep = null; this.m = null; this.phase = 'wait'; this.wave = 0; this.waveT = 0; this.pending = new Set(); this.shownEnd = false; this.msgT = 0; this.paused = false;
    this.isHost = !this.net;
    C.loadArenaZone(ARENA_ZONE);
    this._decor();
    const sv = C.getSave();
    const level = BOT_LEVEL[(sv && sv.difficulty) || 'normal'] || BOT_LEVEL.normal;
    // jugadora 1: la de siempre
    const p1 = C.player, cu = (sv && sv.custom) || {};
    this.fighters = [this._fighter({ id: this.net ? 'me' : 'p1', kind: 'p1', name: (sv && sv.name) || 'Jugador 1', player: p1, color: this.net ? (cu.aura ? hex(auraOf(cu)) : COLORS[Math.floor(Math.random() * COLORS.length)]) : COLORS[0], title: titleOf(cu), hero: (sv && sv.hero) || 'lia' })];
    this._arm(p1, heroById((sv && sv.hero) || 'lia'), loadout(sv)); p1.aura = auraOf(cu);
    this.chatLog = []; $('chatLog').innerHTML = ''; $('chatBtn').classList.toggle('hidden', !this.net); this._chatClose();
    C.input.arenaKeys = opts.players === 'local';
    C.setSplit(opts.players === 'local'); C.cam.distOverride = 0;
    if (opts.players === 'local' || opts.players === 'cpu') {
      const unlocked = HEROES.filter(h => heroUnlocked(h, (sv && sv.piezas || []).length) && h.id !== ((sv && sv.hero) || 'lia'));
      const hero = opts.players === 'local' ? (opts.p2hero || 'kael') : unlocked[Math.floor(Math.random() * unlocked.length)].id;
      const pl = new Player(C.scene, C.physics, C.audio, C.fx);
      if (C.charLib()) pl.useModel(C.charLib(), heroLook(hero, {}));
      const got = POWERS.filter(P => powerUnlocked(P, sv)).map(P => P.id);
      const slots = opts.players === 'local' ? loadout(sv) : got.sort(() => Math.random() - 0.5).slice(0, 2);
      this._arm(pl, heroById(hero), slots);
      let input;
      if (opts.players === 'local') { input = new P2Input(C.input); const pads = [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(Boolean); if (pads.length) { input.pad = pads[pads.length - 1].index; C.input.excludePad = input.pad; } }
      else input = new BotInput(level);
      const name = opts.players === 'local' ? 'Jugador 2' : `CPU · ${heroById(hero).name}`;
      this.fighters.push(this._fighter({ id: opts.players === 'local' ? 'p2' : 'cpu', kind: opts.players === 'local' ? 'p2' : 'cpu', name, player: pl, input, color: COLORS[1], hero }));
    }
    for (const f of this.fighters) if (f.kind !== 'p1' || this.fighters.length > 1 || this.net) this._plate(f);
    if (this.net) {
      this.net.onEvent((from, ev) => this._remoteEvent(from, ev));
      this.net.onChat((from, text) => { const f = this.fighters.find(x => x.id === from); this._chatAdd(f ? f.name : 'Alguien', f ? f.color : '#ccc', text); });
      this.net.set({ n: this.fighters[0].name, h: this.fighters[0].hero, c: (sv && sv.custom) || {}, s: 'arena', mode: this.mode });
    } else this.newMatch();
    this._hud(true);
    C.music.play('desafio', { fade: 1.2 });
  }
  _fighter(o) { return { score: 0, koT: 0, lastBy: null, lastByT: 0, ...o }; }
  _arm(pl, hero, slots = []) { // todos llegan a la Arena con el equipo completo y sus poderes
    pl.mods = { ...hero.mods }; pl.diff = ARENA_DIFF; pl.powerSlots = slots; pl.energy = 100; pl.pcd = {};
    pl.setFight(true); pl.canAirDash = pl.canGlide = pl.canShield = pl.canPulse = true; pl.canGrapple = false;
    pl.maxHp = 5 + (hero.mods.hp || 0); pl.hp = pl.maxHp; pl.inSub = false; pl.swimming = false; pl.frozen = false;
  }
  _plate(f) { if (f.plate) f.player.mesh.remove(f.plate); f.plate = nameplate(f.name, f.color, f.title || ''); f.plate.position.y = 2.25; f.player.mesh.add(f.plate); }
  _decor() { // emblema en el suelo y aros de luz
    const C = this.ctx;
    for (const d of this.decor) C.scene.remove(d); this.decor = [];
    const g = new THREE.Group(); C.scene.add(g); this.decor.push(g);
    const glow = new THREE.MeshBasicMaterial({ color: 0xffd08a, transparent: true, opacity: 0.26, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    for (const [r, w] of [[10.5, 0.18], [6.2, 0.12], [2.2, 0.1]]) { const m = new THREE.Mesh(new THREE.RingGeometry(r - w, r + w, 72), glow); m.rotation.x = -Math.PI / 2; m.position.y = 0.03; g.add(m); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const m = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 4), glow); m.rotation.x = -Math.PI / 2; m.rotation.z = a; m.position.set(Math.sin(a) * 8.3, 0.031, Math.cos(a) * 8.3); g.add(m); }
    const star = new THREE.Mesh(new THREE.CircleGeometry(1.4, 8), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })); star.rotation.x = -Math.PI / 2; star.position.y = 0.032; g.add(star);
    this.decorRing = g;
  }
  exit() {
    const C = this.ctx;
    this.active = false; this._chatClose(); C.powers.clear();
    for (const f of this.fighters) { f.player.iceT = f.player.liftT = f.player.levT = 0; C.powers.statusFx(f.player, 0); }
    for (const f of this.fighters) { if (f.plate) f.player.mesh.remove(f.plate); if (f.kind !== 'p1') { C.scene.remove(f.player.mesh); C.scene.remove(f.player.shadow); } }
    for (const d of this.decor) C.scene.remove(d); this.decor = [];
    this._clearOrbs(); C.combat.clear();
    this.fighters = [];
    C.input.arenaKeys = false; C.input.excludePad = null; C.cam.distOverride = 0; C.setSplit(false);
    if (this.net) { this.net.close(); this.net = null; }
    this._hud(false);
  }

  // ---------- partida (la decide el anfitrión) ----------
  newMatch() {
    this.m = { mode: this.mode, ep: Math.floor(Math.random() * 1e9), s: 'count', t: 3.2, sc: {}, w: 0, lv: 6, orbs: [], oid: 0, win: null, wt: 0 };
    for (const f of this.fighters) this.m.sc[this._fid(f)] = 0;
  }
  _fid(f) { return f.kind === 'p1' && this.net ? this.net.me : f.id; }
  _hostEvent(from, ev) {
    const m = this.m; if (!m || m.s === 'end') return;
    if (ev.t === 'ko') {
      if (this.mode === 'duelo') {
        let by = ev.by && ev.by !== from ? ev.by : null;
        if (!by) { const ids = Object.keys(m.sc).filter(k => k !== from); if (ids.length === 1) by = ids[0]; }
        if (by) m.sc[by] = (m.sc[by] || 0) + 1;
      } else if (this.mode === 'coop') m.lv = Math.max(0, m.lv - 1);
      else if (this.mode === 'carrera') m.sc[from] = Math.max(0, (m.sc[from] || 0) - 1);
    }
    if (ev.t === 'take' && this.mode === 'carrera') {
      const i = m.orbs.findIndex(o => o[0] === ev.o);
      if (i >= 0) { m.orbs.splice(i, 1); m.sc[from] = (m.sc[from] || 0) + 1; m.wt = 1.2; }
    }
  }
  _hostTick(dt) {
    const m = this.m; if (!m) return;
    // jugadores que llegan o se van
    for (const f of this.fighters) { const id = this._fid(f); if (m.sc[id] === undefined) m.sc[id] = 0; }
    if (this.net) { const ids = new Set(this.net.peers().map(p => p.id)); for (const k of Object.keys(m.sc)) if (!ids.has(k)) delete m.sc[k]; }
    if (m.s === 'count') { m.t -= dt; if (m.t <= 0) m.s = 'play'; return; }
    if (m.s !== 'play') return;
    const np = Object.keys(m.sc).length;
    m.goal = Math.max(m.goal || 3, np <= 2 ? 3 : np <= 5 ? 5 : 7); // con más jugadores, más KO para ganar
    if (this.mode === 'duelo') { for (const [id, v] of Object.entries(m.sc)) if (v >= m.goal) { m.s = 'end'; m.win = id; } }
    if (this.mode === 'carrera') {
      m.wt -= dt;
      if (m.orbs.length < 3 && m.wt <= 0) {
        const R = Math.random, taken = new Set(m.orbs.map(o => o[1] + ',' + o[3]));
        const free = ORB_SPOTS.filter(s => !taken.has(s[0] + ',' + s[2]));
        const s = free[Math.floor(R() * free.length)];
        m.orbs.push([++m.oid, s[0], s[1], s[2]]); m.wt = 0.6;
      }
      for (const [id, v] of Object.entries(m.sc)) if (v >= ARENA_MODES.carrera.goal) { m.s = 'end'; m.win = id; }
    }
    if (this.mode === 'coop') {
      if (m.lv <= 0) { m.s = 'end'; m.win = null; return; }
      const alive = this.ctx.combat.enemies.filter(e => e.alive).length;
      if (m.w === 0) { m.wt -= dt; if (m.wt <= -1.5) { m.w = 1; m.wt = 0; m.np = np; } }
      else if (alive === 0 && this.waveAge > 1.5) { m.wt += dt; if (m.wt > 2.5) { m.w += 1; m.wt = 0; m.np = np; } }
    }
  }
  _applyMatch(m) {
    if (!m) return;
    const C = this.ctx;
    if (m.ep !== this.ep) { // ronda nueva
      this.ep = m.ep; this.shownEnd = false; this.wave = 0; this.pending.clear();
      C.combat.clear(); this._clearOrbs();
      this.fighters.filter(f => f.kind !== 'remote').forEach((f, i) => { f.koT = 0; this._respawn(f, this._spawnIndex(f, i)); });
      this.mode = m.mode;
      $('arenaEnd').classList.add('hidden');
    }
    this.phase = m.s;
    if (this.mode === 'coop' && m.w !== this.wave && m.w > 0) this._spawnWave(m.w, m.np || 1);
    if (this.mode === 'carrera') this._syncOrbs(m.orbs);
    if (m.s === 'end' && !this.shownEnd) { this.shownEnd = true; this._showEnd(m); }
  }
  _spawnIndex(f, i) {
    if (!this.net) return i;
    const ids = this.net.peers().map(p => p.id).sort();
    return Math.max(0, ids.indexOf(this.net.me));
  }

  // ---------- oleadas del cooperativo ----------
  _spawnWave(n, np = 1) {
    const C = this.ctx; this.wave = n; this.waveAge = 0;
    for (const e of C.combat.enemies) if (e.alive) { e.alive = false; C.combat.root.remove(e.group); }
    C.combat.enemies = [];
    const R = seeded(n * 131 + 7), boss = n % 5 === 0;
    const count = Math.round((boss ? 2 + Math.floor(n / 5) : 2 + n) * (1 + 0.35 * (Math.min(np, 12) - 1))); // más enemigos si sois más
    const types = n < 2 ? ['brote'] : n < 4 ? ['brote', 'brote', 'avispa', 'espora'] : ['brote', 'automata', 'avispa', 'espora', 'brote_hielo', 'sombra'];
    // todos aparecen en la isla central (los brotes no saltan huecos y las esporas no se mueven)
    const spots = [[0, -11], [0, 11], [-11, 0], [11, 0], [-5, -11], [5, 11], [-11, 5], [11, -5], [-5, 0], [5, 0], [0, -5]];
    let id = 0;
    const add = (type, x, y, z, extra = {}) => {
      const e = C.combat.addEnemy(type, x, y, z, extra); e.netId = `${n}_${id++}`;
      e.sight = 60; e.leash = 60; e.home.set(0, 0, 0);
      return e;
    };
    if (boss) { // jefe: un brote gigante; el de sombra lleva un aura que solo el pulso de luz deshace
      const e = add(n >= 10 ? 'automata' : 'sombra', 0, 0, -10);
      e.group.scale.setScalar(2); e.radius = 1.3; e.hp = e.maxHp = Math.round((10 + n * 2) * (1 + 0.5 * (Math.min(np, 12) - 1))); e.boss = true;
      C.toast(`¡Oleada ${n}: llega un jefe!`); C.audio.play('roar'); C.combat.shake(0.4, 1);
    } else C.toast(`Oleada ${n}`);
    for (let i = 0; i < count; i++) {
      const t = types[Math.floor(R() * types.length)], s = spots[Math.floor(R() * spots.length)];
      const x = s[0] + (R() - 0.5) * 2, z = s[1] + (R() - 0.5) * 2;
      if (t === 'avispa') add('avispa', x * 0.5, 1.7, z * 0.5, { r: 2 + R() * 1.5, speed: 0.8 });
      else add(t, x, 0, z);
    }
    for (const e of C.combat.enemies) C.fx.sparkle(e.pos.clone().setY(e.pos.y + 0.8), 14, 0xb07aff);
  }
  onKill(e) {
    const sv = this.ctx.getSave();
    if (sv && !e.netKilled) this.ctx.bump('enemigos');
    if (this.net && e.netId && !e.netKilled) this.net.event({ t: 'kill', e: e.netId });
  }

  // ---------- piezas de luz de la carrera ----------
  _orbMesh(id, x, y, z) {
    const g = new THREE.Group(); g.position.set(x, y + 1.0, z);
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), new THREE.MeshStandardMaterial({ color: 0xfff0a0, emissive: 0xffb020, emissiveIntensity: 1.6, flatShading: true }));
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending }));
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 14, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
    beam.position.y = 7; g.add(core, halo, beam); g.userData = { core, halo, id };
    this.ctx.scene.add(g); this.ctx.fx.sparkle(g.position, 12, 0xffe08a);
    return g;
  }
  _syncOrbs(list) {
    const want = new Set(list.map(o => o[0]));
    for (const [id, m] of this.orbMeshes) if (!want.has(id) || this.pending.has(id)) { this.ctx.scene.remove(m); this.orbMeshes.delete(id); }
    for (const o of list) if (!this.orbMeshes.has(o[0]) && !this.pending.has(o[0])) this.orbMeshes.set(o[0], this._orbMesh(...o));
    for (const id of [...this.pending]) if (!want.has(id)) this.pending.delete(id);
  }
  _clearOrbs() { for (const m of this.orbMeshes.values()) this.ctx.scene.remove(m); this.orbMeshes.clear(); }

  // ---------- golpes entre jugadores ----------
  _pvp(f) {
    const pl = f.player, C = this.ctx;
    if (this.mode === 'coop') return; // en cooperativo no hay fuego amigo
    for (const ev of pl.events) {
      if (ev.type === 'hitcheck') {
        const fx = -Math.sin(pl.facing), fz = -Math.cos(pl.facing);
        for (const o of this.fighters) {
          if (o === f || o.koT > 0 || ev.hitList.has(o)) continue;
          const q = o.player.pos, dx = q.x - pl.pos.x, dz = q.z - pl.pos.z, d = Math.hypot(dx, dz);
          if (d > ev.range + 0.4 || Math.abs(q.y - pl.pos.y) > 1.9) continue;
          if (d > 0.7 && Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / d))) > ev.angle) continue;
          ev.hitList.add(o);
          this._hit(f, o, ev.dmg || ev.def.dmg, pl.pos, ev.def.push);
        }
      }
      if (ev.type === 'pulse') {
        for (const o of this.fighters) if (o !== f && o.koT <= 0 && o.player.pos.distanceTo(ev.pos) < ev.radius * 0.6) this._hit(f, o, 1, ev.pos, 6);
      }
    }
  }
  _hit(f, o, dmg, from, push) {
    const C = this.ctx;
    C.fx.sparkle(o.player.pos.clone().setY(o.player.pos.y + 1), 10, 0xffffff);
    if (o.kind === 'remote') { this.net.event({ t: 'hit', to: o.id, d: dmg, x: r2(from.x), z: r2(from.z), p: push }); C.audio.play('hit'); return; }
    if (o.player.damage(dmg, from)) { o.lastBy = this._fid(f); o.lastByT = 6; C.combat.shake(0.12, 0.15); if (o.kind === 'p1') C.input.rumble(160, 0.6); }
  }
  _remoteEvent(from, ev) {
    const C = this.ctx;
    if (ev.t === 'hit' && ev.to === this.net.me) {
      const me = this.fighters[0]; if (me.koT > 0) return;
      const fromV = new THREE.Vector3(ev.x, me.player.pos.y, ev.z);
      if (ev.fx) this._applyPower(me, from, ev.d || 0, ev.fx, fromV, { t: ev.ft, slam: ev.sl });
      else if (me.player.damage(ev.d || 1, fromV)) { me.lastBy = from; me.lastByT = 6; C.combat.shake(0.12, 0.15); C.input.rumble(160, 0.6); }
    }
    if (ev.t === 'cast') { // otro jugador lanzó un poder: solo se ve
      const f = this.fighters.find(x => x.id === from); if (!f) return;
      let aim = null;
      if (ev.to) { const v = this.fighters.find(x => this._fid(x) === ev.to); if (v) aim = { getPos: () => v.player.pos }; }
      else if (ev.ax !== undefined) aim = { x: ev.ax, y: ev.ay, z: ev.az };
      if (ev.f !== undefined) f.player.facing = ev.f;
      C.powers.cast(f.player, ev.p, () => [], true, aim);
    }
    if (ev.t === 'kill') { const e = C.combat.enemies.find(x => x.netId === ev.e && x.alive); if (e) { e.netKilled = true; e.die(); } }
    if (this.isHost) this._hostEvent(from, ev);
  }
  // objetivos de los poderes de un jugador local
  _powerFoes(f) {
    const C = this.ctx, out = [];
    if (this.mode !== 'coop') for (const o of this.fighters) {
      if (o === f || o.koT > 0) continue;
      out.push({ pos: o.player.pos, radius: 0.5, fighter: o, hit: (dmg, kind, from, x = {}) => this._powerHit(f, o, dmg, kind, from, x) });
    }
    for (const e of C.combat.enemies) if (e.alive) out.push(C.enemyTarget(e));
    return out;
  }
  _powerHit(f, o, dmg, kind, from, x) {
    const C = this.ctx;
    if (o.kind === 'remote') { this.net.event({ t: 'hit', to: o.id, d: dmg, x: r2(from.x), z: r2(from.z), fx: kind, ft: x.t, sl: x.slam }); return; }
    this._applyPower(o, this._fid(f), dmg, kind, from, x);
  }
  _applyPower(o, byId, dmg, kind, from, x = {}) { // un poder alcanza a un jugador de este dispositivo
    const C = this.ctx, pl = o.player;
    if (pl.dodges(from)) { pl.shieldFlash = 1; C.audio.play('block'); return; }
    if (kind === 'ice') pl.applyStatus('ice', x.t || 2.5);
    if (kind === 'lift') pl.applyStatus('lift', x.t || 2.3, { slam: x.slam || 2, from });
    o.lastBy = byId; o.lastByT = 8;
    if (dmg > 0 && pl.damage(dmg, from)) { C.combat.shake(0.14, 0.18); if (o.kind === 'p1') C.input.rumble(180, 0.7); }
    if (x.push && pl.hp > 0) { const dx = pl.pos.x - from.x, dz = pl.pos.z - from.z, l = Math.hypot(dx, dz) || 1; pl.vel.x += dx / l * x.push; pl.vel.z += dz / l * x.push; }
  }
  _report(f, ev) { // suceso de un jugador local para el anfitrión
    if (this.isHost) this._hostEvent(this._fid(f), ev);
    else this.net.event(ev);
  }

  // ---------- KO y reaparición ----------
  _ko(f, why) {
    if (f.koT > 0 || !this.m || this.phase !== 'play') return;
    const C = this.ctx;
    f.koT = this.mode === 'coop' ? 3.5 : 2.2;
    C.fx.sparkle(f.player.pos.clone().setY(f.player.pos.y + 1), 30, 0xff8a6a); C.audio.play(why === 'fall' ? 'splash' : 'shatter');
    f.player.mesh.visible = false; f.player.shadow.visible = false; f.player.koed = true;
    this._report(f, { t: 'ko', by: f.lastByT > 0 ? f.lastBy : null });
    this.flash(`${f.name}: ¡KO!`, f.color);
  }
  _respawn(f, i) {
    const s = spawnAt(i ?? this.fighters.indexOf(f));
    f.player.teleport(s[0], s[1] + 0.05, s[2], s[3]);
    f.player.hp = f.player.maxHp; f.player.invuln = 1.5; f.player.koed = false; f.player.mesh.visible = true; f.player.events = [];
    f.lastBy = null; f.lastByT = 0;
    if (f.kind === 'p1') this.ctx.cam.snap(f.player);
    if (f.kind === 'p2') this.ctx.cam2.snap(f.player);
  }

  // ---------- jugadores online ----------
  _syncRemotes(dt) {
    const C = this.ctx, peers = this.net.others().filter(p => p.pres && p.pres.s === 'arena');
    const ids = new Set(peers.map(p => p.id));
    for (const f of [...this.fighters]) if (f.kind === 'remote' && !ids.has(f.id)) { if (f.plate) f.player.mesh.remove(f.plate); C.scene.remove(f.player.mesh); C.scene.remove(f.player.shadow); this.fighters.splice(this.fighters.indexOf(f), 1); C.toast(`${f.name} salió de la Arena`); this._chatAdd('', '', `${f.name} salió de la Arena`, true); }
    for (const p of peers) {
      let f = this.fighters.find(x => x.id === p.id);
      const P = p.pres;
      if (!f) {
        const pl = new Player(C.scene, C.physics, MUTE, C.fx); pl.remote = true; pl.damage = () => false; pl.blocks = () => false;
        f = this._fighter({ id: p.id, kind: 'remote', name: String(P.n || 'Jugador').slice(0, 16), player: pl, color: COLORS[(this.fighters.length) % COLORS.length], hero: null });
        this.fighters.push(f); C.toast(`${f.name} entró en la Arena`); this._chatAdd('', '', `${f.name} entró en la Arena`, true);
      }
      const pl = f.player;
      if (P.h !== f.hero && C.charLib()) { f.hero = P.h; pl.useModel(C.charLib(), heroLook(P.h, P.c || {})); pl.setFight(true); this._plate(f); }
      if (Array.isArray(P.p)) {
        const tx = P.p[0], ty = P.p[1], tz = P.p[2];
        if (!f.net) { f.net = { x: tx, y: ty, z: tz }; pl.teleport(tx, ty, tz, P.f || 0); }
        if (f.net.x !== tx || f.net.y !== ty || f.net.z !== tz) { // velocidad estimada para animar
          const now = performance.now(), gap = Math.max(0.03, (now - (f.net.t || now - 66)) / 1000);
          pl.vel.set((tx - f.net.x) / gap, (ty - f.net.y) / gap, (tz - f.net.z) / gap);
          f.net = { x: tx, y: ty, z: tz, t: now };
        }
        const k = Math.min(1, dt * 14), far = Math.hypot(tx - pl.pos.x, tz - pl.pos.z) > 6;
        if (far) pl.pos.set(tx, ty, tz); else { pl.pos.x += (tx - pl.pos.x) * k; pl.pos.y += (ty - pl.pos.y) * k; pl.pos.z += (tz - pl.pos.z) * k; }
        pl.facing += angleDiff(P.f || 0, pl.facing) * k;
      }
      const g = P.g || 0;
      pl.grounded = !!(g & 1); pl.gliding = !!(g & 2); pl.shielding = !!(g & 4); pl.hp = P.hp ?? pl.hp; pl.maxHp = P.mh ?? pl.maxHp;
      pl.iceT = g & 8 ? 1 : 0; pl.liftT = g & 16 ? 1 : 0; pl.levT = g & 32 ? 1 : 0;
      if (typeof P.col === 'string' && /^#[0-9a-f]{6}$/i.test(P.col) && P.col !== f.color) { f.color = P.col; pl.aura = parseInt(P.col.slice(1), 16); this._plate(f); }
      if (typeof P.ti === 'string' && P.ti.slice(0, 30) !== (f.title || '')) { f.title = P.ti.slice(0, 30); this._plate(f); }
      if (pl.grounded) pl.vel.y = 0;
      if (P.a !== undefined && P.a !== f.atk) { if (f.atk !== undefined && P.a % 10 < 3) { const anims = ['1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Chop']; pl.gesture(anims[P.a % 10], { speed: 1.7, fadeIn: 0.04, fadeOut: 0.14 }); C.combat.slash(pl, { arc: [-0.6, 0.6, 0][P.a % 10] }); } f.atk = P.a; }
      if (P.dg !== undefined && P.dg !== f.dg) { if (f.dg !== undefined) pl.gesture('Dodge_Forward', { speed: 1.3, fadeIn: 0.04, fadeOut: 0.15 }); f.dg = P.dg; }
      if (P.pu !== undefined && P.pu !== f.pu) { if (f.pu !== undefined) { pl.gesture('Spellcast_Raise', { speed: 1.8 }); C.pulseFx(pl.pos.clone(), 5); } f.pu = P.pu; }
      f.koT = P.ko ? 1 : 0; pl.koed = !!P.ko;
      pl._wx = pl.vel.x; pl._wz = pl.vel.z;
      pl._animate(dt);
      pl.mesh.visible = !P.ko;
      if (P.ko) pl.shadow.visible = false;
    }
  }
  _sendMe() {
    const f = this.fighters[0], pl = f.player;
    f.atkSeq = f.atkSeq || 0;
    if (pl.attack && pl.attack !== f._lastAtk) { f._lastAtk = pl.attack; f.atkSeq++; }
    if (pl.dodge && pl.dodge !== f._lastDodge) { f._lastDodge = pl.dodge; f.dgSeq = (f.dgSeq || 0) + 1; }
    const sv = this.ctx.getSave();
    this.net.set({
      n: f.name, h: (sv && sv.hero) || 'lia', c: (sv && sv.custom) || {}, s: 'arena', mode: this.mode,
      col: f.color, ti: f.title || '',
      p: [r2(pl.pos.x), r2(pl.pos.y), r2(pl.pos.z)], f: r2(pl.facing), g: (pl.grounded ? 1 : 0) | (pl.gliding ? 2 : 0) | (pl.shielding ? 4 : 0) | (pl.iceT > 0 ? 8 : 0) | (pl.liftT > 0 ? 16 : 0) | (pl.levT > 0 ? 32 : 0),
      a: f.atkSeq * 10 + (pl.attack ? pl.attack.idx : 9), dg: f.dgSeq || 0, pu: f.puSeq || 0, hp: pl.hp, mh: pl.maxHp, ko: f.koT > 0 ? 1 : 0,
      m: this.isHost ? this.m : null,
    });
  }
  _electHost() {
    const ids = this.net.peers().filter(p => p.me || (p.pres && p.pres.s === 'arena')).map(p => p.id).sort();
    const host = ids[0];
    const wasHost = this.isHost;
    this.isHost = !!this.net.me && host === this.net.me;
    if (this.isHost && !wasHost && !this.m) this.newMatch();
    if (!this.isHost) { const H = this.net.peers().find(p => p.id === host); if (H && H.pres && H.pres.m) this.m = H.pres.m; }
    this.hostId = host;
  }

  // ---------- cada fotograma ----------
  update(dt) {
    const C = this.ctx, I = C.input;
    if (!this.active) return;
    C.combat.hitstop = 0;
    if (this.net) { this.net.tick(dt); this._electHost(); this._syncRemotes(dt); }
    if (this.paused && !this.net) { this._hudTick(); return; }
    if (this.isHost) this._hostTick(dt);
    this._applyMatch(this.m);
    const playing = this.phase === 'play';
    const camYaw = C.cam.yaw;
    for (const f of this.fighters) {
      if (f.kind === 'remote') continue;
      const pl = f.player;
      f.lastByT -= dt;
      if (f.koT > 0) { f.koT -= dt; pl.mesh.visible = false; pl.shadow.visible = false; if (f.koT <= 0) this._respawn(f); continue; }
      let inp = I;
      if (f.kind === 'p2') { f.input.poll(); inp = f.input; }
      if (f.kind === 'cpu') { if (playing) f.input.think(dt, f, this, camYaw); else { f.input.move.x = f.input.move.y = 0; f.input._p.clear(); } inp = f.input; }
      pl.frozen = !playing;
      C.powers.tick(pl, dt, 10);
      const targets = this.mode === 'coop' ? C.combat.targets : this.fighters.filter(o => o !== f && o.koT <= 0).map(o => o.player);
      pl.update(dt, inp, f.kind === 'p2' ? C.cam2.yaw : camYaw, targets);
      if (pl.dodge && pl.dodge.air) C.fx.trail(pl.pos, 0.5 + pl.dodge.t * 2);
      this._pvp(f);
      C.combat.handlePlayer(pl);
      for (const ev of pl.events) {
        if (ev.type === 'pulse') { C.pulseFx(ev.pos, ev.radius); C.combat.pulse(ev.pos, ev.radius); f.puSeq = (f.puSeq || 0) + 1; }
        if (ev.type === 'power' && playing) {
          const ok = C.powers.cast(pl, ev.id, () => this._powerFoes(f));
          if (ok === 'none' && f.kind === 'p1') C.toast('Nadie al alcance de la telequinesis');
          if (ok === true && this.net && f.kind === 'p1') {
            const tgt = ev.id === 'telequinesis' ? C.powers.lastTarget : null;
            const a = C.powers.lastAim;
            this.net.event({ t: 'cast', p: ev.id, f: r2(pl.facing), to: tgt && tgt.fighter ? this._fid(tgt.fighter) : undefined, ax: ev.id === 'flechas' && a ? r2(a.x) : undefined, ay: ev.id === 'flechas' && a ? r2(a.y) : undefined, az: ev.id === 'flechas' && a ? r2(a.z) : undefined });
          }
        }
        if (ev.type === 'dead') this._ko(f, 'dead');
        if (ev.type === 'hurt' && f.kind === 'p1') { C.combat.shake(0.2, 0.2); }
      }
      pl.events = [];
      if (pl.pos.y < -9) { if (playing) this._ko(f, 'fall'); else this._respawn(f); }
      // piezas de luz
      if (this.mode === 'carrera' && playing) for (const [id, m] of this.orbMeshes) {
        if (Math.hypot(m.position.x - pl.pos.x, m.position.z - pl.pos.z) < 1.1 && Math.abs(m.position.y - 1 - pl.pos.y) < 1.8) {
          this.pending.add(id); C.scene.remove(m); this.orbMeshes.delete(id);
          C.audio.play('fragment'); C.fx.sparkle(m.position, 22, 0xffe08a);
          this._report(f, { t: 'take', o: id });
        }
      }
    }
    for (const f of this.fighters) C.powers.statusFx(f.player, dt);
    for (const m of this.orbMeshes.values()) { m.userData.core.rotation.y += dt * 2.5; m.userData.core.position.y = Math.sin(performance.now() / 300 + m.userData.id) * 0.15; m.userData.halo.scale.setScalar(1 + Math.sin(performance.now() / 200) * 0.1); }
    // enemigos del cooperativo
    if (this.mode === 'coop') {
      this.waveAge = (this.waveAge || 0) + dt;
      const others = this.fighters.slice(1).map(f => f.player);
      C.combat.update(playing ? dt : 0, this.fighters[0].player, others.length ? others : [this.fighters[0].player]);
    } else C.combat.update(dt, this.fighters[0].player);
    if (this.net) this._sendMe();
    // cámara: cada dispositivo sigue a su personaje; con dos jugadores en un mismo dispositivo, pantalla dividida
    const p1 = this.fighters[0].player;
    C.cam.distOverride = 0; C.cam.update(dt, I, p1);
    const f2 = this.fighters.find(f => f.kind === 'p2');
    if (f2) C.cam2.update(dt, f2.input, f2.player);
    C.world.playerPos.copy(p1.pos);
    this._hudTick(dt);
  }

  // ---------- pantalla ----------
  flash(text, color = '#fff') { const el = $('arenaMsg'); el.textContent = text; el.style.color = color; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  _hud(on) { $('arenaHud').classList.toggle('hidden', !on); document.body.classList.toggle('inArena', on); if (!on) { $('arenaEnd').classList.add('hidden'); $('arenaPauseBox').classList.add('hidden'); } }
  _hudTick() {
    const m = this.m, M = ARENA_MODES[this.mode];
    $('arenaMode').textContent = `${M.icon} ${M.name}${this.net ? ` · Sala ${this.opts.code || ''}` : ''}`;
    let info = '';
    if (!m) info = this.net ? 'Conectando con la sala…' : '';
    else if (m.s === 'count') info = `${Math.ceil(m.t)}`;
    else if (this.mode === 'coop') info = m.w ? `Oleada ${m.w} · Vidas del equipo ${'♥'.repeat(m.lv)}` : '¡Preparaos!';
    else if (this.mode === 'duelo') info = `Primero en lograr ${(m && m.goal) || M.goal} KO · ${this.fighters.length} jugador${this.fighters.length === 1 ? '' : 'es'}`;
    else info = `Primero en juntar ${M.goal} piezas`;
    $('arenaInfo').textContent = info;
    if (m && m.s === 'count') { const n = Math.ceil(m.t); if (n !== this._lastCount) { this._lastCount = n; this.flash(n > 0 ? String(n) : '¡Ya!', '#ffd27a'); this.ctx.audio.play(n > 0 ? 'crystal' : 'unlock'); } }
    if (m && m.s === 'play' && this._lastCount !== 0) { this._lastCount = 0; this.flash('¡Ya!', '#ffd27a'); }
    const scoreOf = f => (m && m.sc ? (m.sc[this._fid(f)] || 0) : 0);
    let shown = this.fighters;
    if (shown.length > 8) { const top = [...shown].sort((a, b) => scoreOf(b) - scoreOf(a)).slice(0, 7); if (!top.includes(shown[0])) top.push(shown[0]); shown = top; }
    const rows = shown.map(f => {
      const id = this._fid(f), sc = m && m.sc ? (m.sc[id] || 0) : 0, pl = f.player;
      const hp = f.koT > 0 ? 'KO' : '♥'.repeat(Math.max(0, pl.hp)) + '<i>' + '♥'.repeat(Math.max(0, pl.maxHp - Math.max(0, pl.hp))) + '</i>';
      const host = this.net && id === this.hostId ? ' ♛' : '';
      return `<div class="ar"><span class="dot" style="background:${f.color}"></span><b>${esc(f.name)}${host}</b><span class="hp">${hp}</span>${this.mode !== 'coop' ? `<span class="sc">${sc}</span>` : ''}</div>`;
    }).join('');
    if (rows !== this._rows) { this._rows = rows; $('arenaBoard').innerHTML = rows; }
    const boss = this.ctx.combat.enemies.find(e => e.boss && e.alive);
    $('arenaBoss').classList.toggle('hidden', !boss);
    if (boss) $('arenaBossFill').style.width = `${Math.max(0, boss.hp / boss.maxHp * 100)}%`;
  }
  _showEnd(m) {
    const C = this.ctx, myId = this._fid(this.fighters[0]), sv = C.getSave();
    let title, sub = '';
    const nameOf = id => { const f = this.fighters.find(x => this._fid(x) === id); return f ? f.name : 'Alguien'; };
    let rewards = [];
    if (this.mode === 'coop') {
      const cleared = Math.max(0, (m.w || 1) - 1);
      title = cleared >= 5 ? '¡Gran defensa!' : 'Fin de la defensa';
      sub = `Superasteis ${cleared} oleada${cleared === 1 ? '' : 's'}.`;
      if (sv) { const best = C.bumpMax('oleadaMax', cleared); rewards.push(`Mejor marca: ${best} oleadas (misión «Muro de Aethra»: ${Math.min(best, 5)}/5)`); }
    } else {
      const won = m.win === myId;
      title = won ? '¡Victoria!' : `Gana ${esc(nameOf(m.win))}`;
      sub = this.mode === 'duelo' ? 'Duelo terminado.' : 'Carrera terminada.';
      if (won && sv) {
        const k = this.mode === 'duelo' ? 'duelos' : 'carreras', goal = this.mode === 'duelo' ? 3 : 2, v = C.bump(k);
        rewards.push(this.mode === 'duelo' ? `Duelos ganados: ${v} (misión «Gladiadora»: ${Math.min(v, goal)}/${goal})` : `Carreras ganadas: ${v} (misión «Más rápida que el viento»: ${Math.min(v, goal)}/${goal})`);
      }
      C.audio.play(won ? 'unlock' : 'hurt');
      if (won) C.music.stinger('victoria');
      const winner = this.fighters.find(x => this._fid(x) === m.win);
      if (winner && winner.koT <= 0) winner.player.gesture('Cheer', { speed: 1.2 });
    }
    C.checkMissions();
    $('arenaEndTitle').textContent = title; $('arenaEndSub').textContent = sub;
    const sc = Object.entries(m.sc || {}).sort((a, b) => b[1] - a[1]).map(([id, v]) => `<li><b>${esc(nameOf(id))}</b> <span>${v}</span></li>`).join('');
    $('arenaEndList').innerHTML = this.mode === 'coop' ? '' : sc;
    $('arenaEndRewards').innerHTML = rewards.map(r => `<div>★ ${esc(r)}</div>`).join('');
    $('bArenaAgain').classList.toggle('hidden', !!this.net && !this.isHost);
    $('arenaEndWait').classList.toggle('hidden', !this.net || this.isHost);
    $('arenaEnd').classList.remove('hidden');
  }
  again() { if (this.isHost) { this.newMatch(); this._applyMatch(this.m); } }
  togglePause() {
    const box = $('arenaPauseBox'); const open = box.classList.contains('hidden');
    box.classList.toggle('hidden', !open); this.paused = open && !this.net;
    $('arenaPauseNote').textContent = this.net ? 'La partida online sigue mientras tanto.' : '';
  }
}
const $ = id => document.getElementById(id);

// ---------- chat ----------
Object.assign(Arena.prototype, {
  _chatAdd(name, color, text, sys = false) {
    const box = $('chatLog'), el = document.createElement('div');
    if (sys) { el.className = 'sys'; el.textContent = text; }
    else { const b = document.createElement('b'); b.textContent = name + ':'; b.style.color = color; el.append(b, document.createTextNode(text.replace(BAD, w => '*'.repeat(w.length)))); }
    box.appendChild(el); while (box.children.length > 30) box.firstChild.remove();
    setTimeout(() => el.classList.add('old'), 9000);
    if (!sys) this.ctx.audio.play('step');
  },
  sendChat(text) {
    if (!this.net) return;
    const now = performance.now(); if (now - (this._chatT || 0) < 900) return; // como mucho un mensaje por segundo
    const m = this.net.chat(String(text).replace(BAD, w => '*'.repeat(w.length)));
    if (m) { this._chatT = now; this._chatAdd(this.fighters[0].name, this.fighters[0].color, m); }
  },
  _chatOpen() {
    if (!this.net || !this.active) return;
    const box = $('chatBox'); box.classList.add('open'); this.chatOpenNow = true;
    this.ctx.input.keys = {}; const inp = $('chatInput'); inp.value = ''; setTimeout(() => inp.focus(), 10);
    const q = $('chatQuick'); if (!q.children.length) for (const t of QUICK) { const b = document.createElement('button'); b.textContent = t; b.onclick = () => { this.sendChat(t); this._chatClose(); }; q.appendChild(b); }
  },
  _chatClose() { const box = $('chatBox'); if (box) box.classList.remove('open'); this.chatOpenNow = false; const inp = $('chatInput'); if (inp) inp.blur(); },
});
export function wireChat(arena) {
  $('chatInput').addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') { arena.sendChat($('chatInput').value); arena._chatClose(); e.preventDefault(); }
    if (e.key === 'Escape') { arena._chatClose(); e.preventDefault(); }
  });
  $('chatInput').addEventListener('keyup', e => e.stopPropagation());
  $('bChatSend').onclick = () => { arena.sendChat($('chatInput').value); arena._chatClose(); };
  $('chatBtn').onclick = () => arena._chatOpen();
  addEventListener('keydown', e => { if (arena.active && arena.net && !arena.chatOpenNow && (e.key === 'Enter' || e.code === 'KeyT')) { e.preventDefault(); arena._chatOpen(); } }, true);
}
