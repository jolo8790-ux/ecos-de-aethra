// Mundo compartido: en cada isla se ve a los demás jugadores que estén en esa misma isla (con su héroe,
// su nombre y sus animaciones) y se puede chatear con ellos en vivo. Cada isla es una sala.
// En claude.ai usa la sala en tiempo real de la página; en la página propia, el servidor de salas.
import * as THREE from 'three';
import { Player } from './player.js';
import { heroLook } from './heroes.js';
import { Net } from './net.js';
import { nameplate } from './arena.js';

const COLORS = ['#4cbcff', '#ff7a5a', '#8be36a', '#ffd24a', '#c98bff', '#ff8ad0', '#5ae0d0', '#f0f0f0'];
const BAD = /\b(put[ao]s?|mierda|pendej[oa]s?|idiota|est[uú]pid[oa]|imb[eé]cil|boludo|pelotudo|cabr[oó]n|co[nñ]o|joder|verga|culiao|maric[oó]n|forro|hdp|fuck|shit|bitch)\b/gi;
const QUICK = ['¡Hola! 👋', '¿Me ayudas?', '¡Sígueme!', '¡Lo logré!', '¡Gracias!', '¡Nos vemos!', '😂', '🔥'];
const r2 = v => Math.round(v * 100) / 100;
const ang = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const $ = id => document.getElementById(id);

export class WorldNet {
  constructor(ctx) {
    this.ctx = ctx; this.net = null; this.zone = null; this.remotes = new Map(); this.active = false; this.chatOpenNow = false;
    this.opening = null; this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
  }
  get enabled() { return this.ctx.settings().online !== false; }
  // la isla cambió (o se apagó/encendió el modo en línea)
  setZone(zoneId) {
    const want = zoneId && this.enabled ? zoneId : null;
    if (want === this.zone) return;
    this._close(); this.zone = want; if (!want) return;
    const token = this.opening = Symbol();
    Net.open(want, 'mundo-').then(n => {
      if (window.__wnDbg) console.log('wn abierto', n.kind, this.opening === token, this.zone, want);
      if (this.opening !== token || this.zone !== want) { n.close(); return; }
      if (n.kind === 'local') { n.close(); return; } // sin servidor: no tiene sentido «compartir» con uno mismo
      this.net = n; this.active = true;
      n.onChat((from, text) => { const R = this.remotes.get(from); this._chatAdd(R ? R.name : 'Alguien', R ? R.color : '#ccc', text); });
      $('chatBtn').classList.remove('hidden'); $('chatBtn').textContent = this.ctx.input.isTouch ? '💬 Chat' : '💬 Chat (T)'; this._badge();
    }).catch(e => console.warn('Mundo compartido sin conexión', e));
  }
  _close() {
    this.opening = null;
    if (this.net) { try { this.net.close(); } catch (e) {} }
    this.net = null; this.active = false; this._chatClose();
    for (const R of this.remotes.values()) this._drop(R);
    this.remotes.clear(); this._badge();
    if (!this.ctx.arenaActive()) $('chatBtn').classList.add('hidden');
  }
  _drop(R) { const C = this.ctx; C.scene.remove(R.pl.mesh); C.scene.remove(R.pl.shadow); }
  _badge() {
    let b = $('onlineBadge');
    if (!b) { b = document.createElement('div'); b.id = 'onlineBadge'; document.body.appendChild(b); }
    const n = this.remotes.size;
    b.style.display = this.active ? '' : 'none';
    b.textContent = n ? `🌐 ${n} ${n === 1 ? 'jugador' : 'jugadores'} más en esta isla` : '🌐 En línea · nadie más en esta isla';
  }
  update(dt, show) {
    const C = this.ctx;
    if (!this.net) return;
    const pl = C.player(), sv = C.getSave();
    // lo mío: posición, héroe y estado (unas 15 veces por segundo)
    this.net.set({
      n: (sv && sv.name || 'Jugador').slice(0, 16), h: (sv && sv.hero) || 'lia', c: (sv && sv.custom) || {}, s: 'mundo', col: this.color,
      p: [r2(pl.pos.x), r2(pl.pos.y), r2(pl.pos.z)], f: r2(pl.facing),
      g: (pl.grounded ? 1 : 0) | (pl.gliding ? 2 : 0) | (pl.shielding ? 4 : 0) | (pl.swimming ? 8 : 0) | (show ? 0 : 64),
      a: (this._atk = (pl.attack && pl.attack !== this._lastAtk) ? ((this._lastAtk = pl.attack), (this._atk || 0) + 1) : (this._atk || 0)),
    });
    this.net.tick(dt);
    const peers = this.net.others().filter(p => p.pres && p.pres.s === 'mundo' && Array.isArray(p.pres.p));
    const ids = new Set(peers.map(p => p.id));
    for (const [id, R] of [...this.remotes]) if (!ids.has(id)) { this._drop(R); this.remotes.delete(id); this._chatAdd('', '', `${R.name} se fue de la isla`, true); this._badge(); }
    for (const p of peers) {
      const P = p.pres; let R = this.remotes.get(p.id);
      if (!R) {
        const sp = C.audio.spatial(null), np = new Player(C.scene, C.physics, sp, C.fx); sp.src = np.pos; np.remote = true; np.damage = () => false; np.blocks = () => false;
        R = { pl: np, name: String(P.n || 'Jugador').slice(0, 16).replace(BAD, w => '*'.repeat(w.length)), color: '#ccc', hero: null, net: null };
        this.remotes.set(p.id, R); this._chatAdd('', '', `${R.name} llegó a la isla`, true); C.toast(`🌐 ${R.name} llegó a la isla`); this._badge();
      }
      const np = R.pl;
      if (typeof P.col === 'string' && /^#[0-9a-f]{6}$/i.test(P.col)) R.color = P.col;
      if ((P.h !== R.hero || !R.plate) && C.charLib()) {
        R.hero = P.h; try { np.useModel(C.charLib(), heroLook(P.h, P.c || {})); } catch (e) {}
        if (R.plate) np.mesh.remove(R.plate); R.plate = nameplate(R.name, R.color); R.plate.position.y = 2.25; np.mesh.add(R.plate);
      }
      const tx = P.p[0], ty = P.p[1], tz = P.p[2];
      if (!R.net) { R.net = { x: tx, y: ty, z: tz, t: performance.now() }; np.teleport(tx, ty, tz, P.f || 0); }
      if (R.net.x !== tx || R.net.y !== ty || R.net.z !== tz) { // velocidad estimada, para que corra o salte con la animación correcta
        const now = performance.now(), gap = Math.max(0.03, (now - R.net.t) / 1000);
        np.vel.set((tx - R.net.x) / gap, (ty - R.net.y) / gap, (tz - R.net.z) / gap); R.net = { x: tx, y: ty, z: tz, t: now };
      } else if (performance.now() - R.net.t > 200) np.vel.multiplyScalar(0.5);
      const k = Math.min(1, dt * 12), far = Math.hypot(tx - np.pos.x, tz - np.pos.z) > 8;
      if (far) np.pos.set(tx, ty, tz); else { np.pos.x += (tx - np.pos.x) * k; np.pos.y += (ty - np.pos.y) * k; np.pos.z += (tz - np.pos.z) * k; }
      np.facing += ang(P.f || 0, np.facing) * k;
      const g = P.g || 0; np.grounded = !!(g & 1); np.gliding = !!(g & 2); np.shielding = !!(g & 4); np.swimming = !!(g & 8);
      if (np.grounded) np.vel.y = 0;
      if (P.a !== undefined && P.a !== R.atk) { if (R.atk !== undefined) np.gesture('1H_Melee_Attack_Slice_Diagonal', { speed: 1.7, fadeIn: 0.04, fadeOut: 0.14 }); R.atk = P.a; }
      np._wx = np.vel.x; np._wz = np.vel.z;
      try { np._animate(dt); } catch (e) {}
      np.mesh.visible = !(g & 64); np.shadow.visible = np.mesh.visible;
    }
  }
  // ---------- chat (mismo cuadro que la Arena) ----------
  _chatAdd(name, color, text, sys = false) {
    const box = $('chatLog'); if (!box) return; const el = document.createElement('div');
    if (sys) { el.className = 'sys'; el.textContent = text; }
    else { const b = document.createElement('b'); b.textContent = name + ':'; b.style.color = color; el.append(b, document.createTextNode(String(text).replace(BAD, w => '*'.repeat(w.length)))); }
    box.appendChild(el); while (box.children.length > 30) box.firstChild.remove();
    setTimeout(() => el.classList.add('old'), 9000);
    if (!sys) this.ctx.audio.play('step');
  }
  sendChat(text) {
    if (!this.net) return;
    const now = performance.now(); if (now - (this._chatT || 0) < 900) return; // como mucho un mensaje por segundo
    const m = this.net.chat(String(text).replace(BAD, w => '*'.repeat(w.length)));
    if (m) { this._chatT = now; const sv = this.ctx.getSave(); this._chatAdd((sv && sv.name) || 'Yo', this.color, m); }
  }
  _chatOpen() {
    if (!this.net) return;
    const box = $('chatBox'); box.classList.add('open'); this.chatOpenNow = true;
    this.ctx.input.keys = {}; const inp = $('chatInput'); inp.value = ''; setTimeout(() => inp.focus(), 10);
    const q = $('chatQuick'); q.innerHTML = ''; for (const t of QUICK) { const b = document.createElement('button'); b.textContent = t; b.onclick = () => { this.sendChat(t); this._chatClose(); }; q.appendChild(b); }
  }
  _chatClose() { const box = $('chatBox'); if (box) box.classList.remove('open'); this.chatOpenNow = false; const inp = $('chatInput'); if (inp) inp.blur(); }
}
