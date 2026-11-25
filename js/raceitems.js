// Carreras · etapa 2: cajas de objetos en la pista.
// Nitro, triple nitro, bomba (se lanza adelante o se deja atrás), cohete directo «a pulso» (sale recto
// hacia donde apuntas), cohete teledirigido (persigue al que va delante) y burbuja escudo.
import * as THREE from 'three';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angD = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export const ITEMS = {
  nitro: { icon: '🔥', name: 'Nitro' },
  nitro3: { icon: '🔥🔥🔥', name: 'Triple nitro', uses: 3 },
  bomba: { icon: '💣', name: 'Bomba' },
  cohete: { icon: '🚀', name: 'Cohete' },
  guiado: { icon: '🎯', name: 'Cohete teledirigido' },
  escudo: { icon: '🫧', name: 'Burbuja escudo' },
};
// lo que toca según el puesto: adelante, cosas para defenderse; atrás, para remontar
function roll(place, n) {
  const k = n > 1 ? (place - 1) / (n - 1) : 0; // 0 = primero, 1 = último
  const w = {
    nitro: 3, escudo: 2.4 - k * 1.6, bomba: 3 - k * 1.4, cohete: 2.2,
    guiado: 0.2 + k * 3.2, nitro3: 0.1 + k * 3,
  };
  let s = 0; for (const v of Object.values(w)) s += Math.max(0, v);
  let r = Math.random() * s;
  for (const [id, v] of Object.entries(w)) { r -= Math.max(0, v); if (r <= 0) return id; }
  return 'nitro';
}

function rollGold() { // cajas doradas del carril colgante: solo objetos buenos
  const w = { nitro3: 3, guiado: 3, escudo: 2, cohete: 2 }; let r = Math.random() * 10;
  for (const [id, v] of Object.entries(w)) { r -= v; if (r <= 0) return id; } return 'nitro3';
}
function goldTex() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 128, 128); g.addColorStop(0, '#fff3a0'); g.addColorStop(0.5, '#ffb020'); g.addColorStop(1, '#c06a00');
  c.fillStyle = g; c.fillRect(0, 0, 128, 128); c.strokeStyle = '#fff8d0'; c.lineWidth = 10; c.strokeRect(5, 5, 118, 118);
  c.font = 'bold 80px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.strokeStyle = 'rgba(120,50,0,.8)'; c.lineWidth = 6;
  c.strokeText('★', 64, 68); c.fillText('★', 64, 68);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function qTex() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 128, 128); g.addColorStop(0, '#ff7ab8'); g.addColorStop(0.5, '#ffd24a'); g.addColorStop(1, '#4cbcff');
  c.fillStyle = g; c.fillRect(0, 0, 128, 128); c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 10; c.strokeRect(5, 5, 118, 118);
  c.font = 'bold 84px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.strokeStyle = 'rgba(60,20,90,.7)'; c.lineWidth = 6;
  c.strokeText('?', 64, 70); c.fillText('?', 64, 70);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class RaceItems {
  local(R) { return !R.remote; } // este equipo decide por R (yo, o la CPU si soy el anfitrión)
  constructor(race) {
    this.race = race; this.root = new THREE.Group(); race.root.add(this.root);
    this.boxes = []; this.shots = []; this.booms = []; this.bits = [];
    const T = race.track, mat = new THREE.MeshStandardMaterial({ map: qTex(), transparent: true, opacity: 0.92, roughness: 0.3, emissive: 0x331144, emissiveIntensity: 0.5 });
    const geo = new THREE.BoxGeometry(1.25, 1.25, 1.25);
    const glow = new THREE.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending });
    for (const f of race.def.items || [0.2, 0.47, 0.74]) {
      const i = Math.floor(f * T.N), c = T.c[i], r = T.r[i];
      for (let k = 0; k < 5; k++) {
        const lat = (k - 2) * T.hw * 0.36;
        const m = new THREE.Mesh(geo, mat); m.castShadow = true;
        const h = new THREE.Mesh(new THREE.SphereGeometry(1.05, 14, 10), glow); m.add(h);
        m.position.set(c.x + r.x * lat, c.y + 1.0, c.z + r.z * lat); this.root.add(m);
        this.boxes.push({ m, i, lat, t: 0, ph: k * 0.7 });
      }
    }
    if (T.sky) { // cajas doradas arriba, en el carril colgante
      const S = T.sky, gm = new THREE.MeshStandardMaterial({ map: goldTex(), roughness: 0.25, metalness: 0.5, emissive: 0x6a4000, emissiveIntensity: 0.7 });
      const gg = new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
      for (const f of [0.35, 0.75]) { const i = S.s0 + Math.floor((S.s1 - S.s0) * f), c = T.c[i], r = T.r[i];
        for (let k = 0; k < 3; k++) { const lat = (k - 1) * 2.6, m = new THREE.Mesh(geo, gm); m.add(new THREE.Mesh(new THREE.SphereGeometry(1.15, 14, 10), gg));
          m.position.set(c.x + r.x * lat, c.y + S.H + 1.0, c.z + r.z * lat); this.root.add(m); this.boxes.push({ m, i, lat, t: 0, ph: k * 0.9, yOff: S.H, gold: true }); } }
    }
    this.shield = new THREE.MeshBasicMaterial({ color: 0x9fe3ff, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending });
  }

  // ---------- recoger ----------
  update(dt, time) {
    const race = this.race, T = race.track;
    for (const B of this.boxes) {
      B.t -= dt;
      const on = B.t <= 0; B.m.visible = on;
      if (on) { B.m.rotation.set(time * 0.9 + B.ph, time * 1.3 + B.ph, 0); B.m.position.y = T.c[B.i].y + 1.0 + (B.yOff || 0) + Math.sin(time * 2.4 + B.ph) * 0.15; B.m.scale.setScalar(Math.min(1, B.m.scale.x + dt * 3)); }
      else B.m.scale.setScalar(0.01);
      if (!on) continue;
      for (const R of race.racers) {
        if (B.t > 0) break;
        if (Math.hypot(R.pos.x - B.m.position.x, R.pos.z - B.m.position.z) < 2.1 && Math.abs(R.pos.y - B.m.position.y) < 2.5) { // la caja se rompe siempre; da objeto si tienes la mano libre
          B.t = B.gold ? 6 : 3; this._pop(B.m.position, 0xffd24a, B.gold ? 2 : 1.2); this._shards(B.m.position);
          if (R.you) race.ctx.audio.play(R.item || R.roll > 0 ? 'crack' : 'crystal');
          if (!R.item && !(R.roll > 0) && !R.remote) { R.roll = R.you ? 1.0 : 0.4; R.rollFor = B.gold ? rollGold() : roll(R.place, race.racers.length); if (B.gold && R.you) race._flash('¡Caja dorada!', '#ffd24a'); }
        }
      }
    }
    for (const R of race.racers) {
      if (R.roll > 0 && (R.roll -= dt) <= 0) { R.item = R.rollFor; R.uses = ITEMS[R.item].uses || 1; if (R.you) race.ctx.audio.play('energy'); R.cpuWait = 0.6 + Math.random() * 1.6; }
      R.inv = Math.max(0, (R.inv || 0) - dt);
      if (R.shieldT > 0) { R.shieldT -= dt; if (!R.bubble) { R.bubble = new THREE.Mesh(new THREE.SphereGeometry(1.9, 20, 14), this.shield); R.bubble.position.y = 0.9; R.root.add(R.bubble); } R.bubble.scale.setScalar(1 + Math.sin(time * 6) * 0.04); }
      else if (R.bubble) { R.root.remove(R.bubble); R.bubble = null; }
      if (!R.you && !R.remote && R.item && race.phase === 'race') this._cpuThink(R, dt);
    }
    this._shots(dt, time);
    for (let k = this.bits.length - 1; k >= 0; k--) {
      const b = this.bits[k]; b.t += dt; b.vy -= 18 * dt;
      b.m.position.x += b.vx * dt; b.m.position.y += b.vy * dt; b.m.position.z += b.vz * dt; b.m.rotation.x += dt * 9; b.m.rotation.y += dt * 7;
      b.m.material.opacity = Math.max(0, 1 - b.t / 0.8);
      if (b.t > 0.8) { this.root.remove(b.m); b.m.material.dispose(); this.bits.splice(k, 1); }
    }
    for (let k = this.booms.length - 1; k >= 0; k--) {
      const b = this.booms[k]; b.t += dt; const q = b.t / b.dur;
      b.m.scale.setScalar(0.3 + q * b.r); b.m.material.opacity = (b.a || 0.85) * (1 - q);
      if (q >= 1) { this.root.remove(b.m); if (!b.keep) b.m.geometry.dispose(); b.m.material.dispose(); this.booms.splice(k, 1); }
    }
  }

  // ---------- usar ----------
  use(R, back = false) {
    const race = this.race, A = race.ctx.audio;
    if (!R.item || R.roll > 0) return;
    const id = R.item;
    if (id === 'nitro' || id === 'nitro3') {
      R.boostT = Math.max(R.boostT, 1.5); R.nitroT = 1.6; R.v = Math.max(R.v, 27 * 1.2);
      if (R.you) { A.play('dash'); race.ctx.input.rumble(140, 0.5); }
    } else if (id === 'escudo') { R.shieldT = 8; if (R.you) A.play('shieldUp'); }
    else if (id === 'bomba') this._fire(R, 'bomba', back);
    else if (id === 'cohete') this._fire(R, 'cohete', back);
    else if (id === 'guiado') this._fire(R, 'guiado', false);
    if (--R.uses <= 0) R.item = null;
  }
  _cpuThink(R, dt) {
    if ((R.cpuWait -= dt) > 0) return;
    const race = this.race, L = race.track.L;
    const ahead = race.racers.filter(o => o !== R && o.progress > R.progress && o.progress - R.progress < 45);
    const behind = race.racers.filter(o => o !== R && o.progress < R.progress && R.progress - o.progress < 14);
    const id = R.item;
    let go = false, back = false;
    if (id === 'nitro' || id === 'nitro3' || id === 'guiado') go = true;
    else if (id === 'escudo') go = behind.length > 0 || Math.random() < 0.15;
    else if (id === 'bomba') { if (behind.length) { go = true; back = true; } else if (ahead.some(o => o.progress - R.progress < 22)) go = true; }
    else if (id === 'cohete') { go = ahead.some(o => { const d = Math.atan2(o.pos.x - R.pos.x, o.pos.z - R.pos.z); return Math.abs(angD(d, R.yaw)) < 0.18; }) || (behind.length && Math.random() < 0.3 && (back = true)); }
    if (!go && Math.random() < 0.08) go = true; // tarde o temprano lo usa
    if (go) { this.use(R, back); R.cpuWait = 0.5 + Math.random(); } else R.cpuWait = 0.3;
    void L;
  }

  // ---------- proyectiles ----------
  _fire(R, kind, back, spec = null) {
    const race = this.race, A = race.ctx.audio, dir = R.yaw + (back ? Math.PI : 0);
    const g = new THREE.Group(); this.root.add(g);
    if (kind === 'bomba') {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), new THREE.MeshStandardMaterial({ color: 0x22222c, roughness: 0.4, metalness: 0.3 })); b.castShadow = true; g.add(b);
      const fuse = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffb040 })); fuse.position.y = 0.5; g.add(fuse);
      const sk = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 6, 12), new THREE.MeshStandardMaterial({ color: 0xffc83a })); sk.rotation.x = Math.PI / 2; sk.position.y = 0.42; g.add(sk);
    } else {
      const col = kind === 'guiado' ? 0xb070ff : 0xe8483c;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 1.2, 12), new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, emissive: col, emissiveIntensity: 0.25 }));
      body.rotation.x = Math.PI / 2; g.add(body);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.45, 12), new THREE.MeshStandardMaterial({ color: 0xf4f2ee })); nose.rotation.x = Math.PI / 2; nose.position.z = 0.82; g.add(nose);
      for (let k = 0; k < 4; k++) { const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.36), new THREE.MeshStandardMaterial({ color: 0xffc83a })); fin.rotation.z = k * Math.PI / 2; fin.position.set(Math.sin(k * Math.PI / 2) * 0.2, Math.cos(k * Math.PI / 2) * 0.2, -0.5); g.add(fin); }
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.9, 10), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
      fl.rotation.x = -Math.PI / 2; fl.position.z = -1.05; g.add(fl); g.userData.flame = fl;
    }
    const S = { kind, g, owner: R, yaw: dir, t: 0, i: R.i, pos: R.pos.clone(), vy: 0, y: 0.9, target: null };
    S.pos.x += Math.sin(dir) * 2.4; S.pos.z += Math.cos(dir) * 2.4;
    if (kind === 'bomba') { S.speed = back ? 0 : 24; S.vy = back ? 0 : 7; S.y = back ? 0.5 : 1.2; S.life = back ? 12 : 6; }
    else if (kind === 'cohete') { S.speed = 64; S.life = 2.6; }
    else { S.speed = 52; S.life = 6; const ahead = race.racers.filter(o => o !== R && o.progress > R.progress).sort((a, b) => a.progress - b.progress); S.target = ahead[0] || null; }
    if (R.you) A.play(kind === 'bomba' ? 'swing' : 'shoot');
    if (spec) { // copia de un disparo de otro jugador: solo se ve (quien disparó decide si acierta)
      S.remote = true; S.id = spec.id; S.pos.set(+spec.x, R.pos.y, +spec.z); S.yaw = +spec.yw; S.target = spec.tg ? race.racers.find(o => o.id === spec.tg) || null : S.target;
    } else if (race.net) {
      S.id = race.me.id + ':' + (this.sid = (this.sid || 0) + 1);
      race.net.event({ t: 'shot', ep: race.ep, id: S.id, k: kind, b: back ? 1 : 0, o: R.id, x: Math.round(S.pos.x * 100) / 100, z: Math.round(S.pos.z * 100) / 100, yw: Math.round(S.yaw * 1000) / 1000, tg: S.target ? S.target.id : null });
    }
    this.shots.push(S);
  }
  remoteShot(ev, R) { if (R && ITEMS[ev.k === 'guiado' ? 'guiado' : ev.k]) this._fire(R, ev.k, !!ev.b, ev); }
  remoteBoom(ev) {
    const k = this.shots.findIndex(S => S.id === ev.id);
    if (k >= 0) { const S = this.shots[k]; S.g.position.x = +ev.x; S.g.position.z = +ev.z; this._explode(S, null, true); this.root.remove(S.g); this.shots.splice(k, 1); }
  }
  _shots(dt, time) {
    const race = this.race, T = race.track;
    for (let k = this.shots.length - 1; k >= 0; k--) {
      const S = this.shots[k]; S.t += dt;
      if (S.kind === 'guiado' && S.target && !S.target.done) { // gira hacia su presa
        const want = Math.atan2(S.target.pos.x - S.pos.x, S.target.pos.z - S.pos.z);
        S.yaw += clamp(angD(want, S.yaw), -3.2 * dt, 3.2 * dt);
      } else if (S.kind === 'guiado') { const t = T.t[S.i]; S.yaw += clamp(angD(Math.atan2(t.x, t.z), S.yaw), -2 * dt, 2 * dt); }
      S.pos.x += Math.sin(S.yaw) * S.speed * dt; S.pos.z += Math.cos(S.yaw) * S.speed * dt;
      S.i = T.near(S.pos, S.i); const F = T.frame(S.pos, S.i);
      if (S.kind === 'bomba') {
        if (S.speed > 0) { S.vy -= 22 * dt; S.y += S.vy * dt; if (S.y <= 0.45) { S.y = 0.45; S.vy = Math.abs(S.vy) * 0.35; S.speed *= 0.55; if (S.speed < 2) S.speed = 0; } }
        S.g.children[1].material.color.setHex(Math.sin(time * 24) > 0 ? 0xffffff : 0xff6020);
      }
      S.g.position.set(S.pos.x, F.y + S.y, S.pos.z); S.g.rotation.y = S.yaw;
      if (S.g.userData.flame) {
        S.g.userData.flame.scale.set(1, 0.8 + Math.random() * 0.5, 1);
        if ((S.puff = (S.puff || 0) - dt) <= 0) { S.puff = 0.025; this._smoke(S.g.position.clone().addScaledVector(new THREE.Vector3(Math.sin(S.yaw), 0, Math.cos(S.yaw)), -1.2), S.kind === 'guiado' ? 0xd8c0ff : 0xf0e8e0); }
      }
      // un misil o una bomba que pasa por una caja también la rompe (sin dar objeto a nadie)
      for (const B of this.boxes) { if (B.t > 0) continue; const by = B.m.position.y, sy = S.g.position.y;
        if (Math.hypot(B.m.position.x - S.pos.x, B.m.position.z - S.pos.z) < 1.7 && Math.abs(by - sy) < 2.2) { B.t = B.gold ? 6 : 3; this._pop(B.m.position, 0xffd24a, 1.2); this._shards(B.m.position);
          const me = race.me; if (me && Math.hypot(me.pos.x - S.pos.x, me.pos.z - S.pos.z) < 40) race.ctx.audio.play('crack');
          const O = S.owner; if (!S.remote && O && !O.remote && !O.item && !(O.roll > 0)) { O.roll = O.you ? 1.0 : 0.4; O.rollFor = B.gold ? rollGold() : roll(O.place, race.racers.length); if (O.you) { race.ctx.audio.play('crystal'); race._flash(B.gold ? '¡Caja dorada!' : '¡Caja!', '#ffd24a'); } } } }
      let hit = null;
      if (T.tube) { if (Math.abs(F.lat) > T.hw) { const r = T.r[S.i], sh = -Math.sign(F.lat) * 2 * T.hw; S.pos.x += r.x * sh; S.pos.z += r.z * sh; } }
      else if (Math.abs(F.lat) > T.hw - 0.4) { if (S.kind === 'bomba') { const r = T.r[S.i], sg = Math.sign(F.lat); S.pos.x -= r.x * sg * 0.6; S.pos.z -= r.z * sg * 0.6; S.yaw = Math.atan2(T.t[S.i].x, T.t[S.i].z); } else hit = 'wall'; }
      if (!S.remote) for (const R of race.racers) {
        if (R === S.owner && S.t < 0.6) continue;
        if (Math.hypot(R.pos.x - S.pos.x, R.pos.z - S.pos.z) < (S.kind === 'bomba' ? 1.7 : 1.5)) { hit = R; break; }
      }
      if (S.remote && S.t > S.life + 1.5) { this.root.remove(S.g); this.shots.splice(k, 1); continue; } // el aviso de explosión no llegó
      if (S.remote) continue;
      if (hit || S.t > S.life) {
        this._explode(S, hit && hit !== 'wall' ? hit : null);
        if (race.net && S.id) race.net.event({ t: 'boom', ep: race.ep, id: S.id, x: Math.round(S.g.position.x * 100) / 100, z: Math.round(S.g.position.z * 100) / 100 });
        this.root.remove(S.g); this.shots.splice(k, 1);
      }
    }
  }
  _explode(S, direct, visual = false) {
    const race = this.race, A = race.ctx.audio, p = S.g.position.clone();
    const r = S.kind === 'bomba' ? 4 : 2.2;
    this._pop(p, S.kind === 'guiado' ? 0xc08aff : 0xffa040, r);
    const me = race.me, d = me.pos.distanceTo(p);
    if (d < 40) { A.play(S.kind === 'bomba' ? 'slam' : 'fire'); }
    if (visual) return;
    for (const R of race.racers) {
      const dd = Math.hypot(R.pos.x - p.x, R.pos.z - p.z);
      if (R === direct || dd < r) {
        if (R.remote) { if (race.net && !R.gone) race.net.event({ t: 'hit', ep: race.ep, v: R.id, o: S.owner.id, k: 'quema' }); if (S.owner.you) this._hitFx(R); }
        else this.hit(R, S.owner, false, 'quema');
      }
    }
  }
  _hitFx(R) { const race = this.race; race._flash(`¡Le diste a ${R.name}!`, '#7affa0'); const sv = race.ctx.getSave(); if (sv) { sv.race = sv.race || {}; sv.race.hits = (sv.race.hits || 0) + 1; } }
  // kind: 'quema' (queda negro), 'aplasta' (queda plano un momento) o 'congela' (queda dentro de un bloque de hielo)
  hit(R, by, fromNet = false, kind = null) {
    const race = this.race;
    if (R.inv > 0) return;
    if (R.shieldT > 0) { R.shieldT = 0; R.inv = 0.8; this._pop(R.pos.clone().setY(R.pos.y + 1), 0x9fe3ff, 2.4); if (R.you) race.ctx.audio.play('reflect'); return; }
    R.inv = 2.2; R.drift = 0; R.charge = 0; R.boostT = 0;
    if (kind === 'aplasta') { R.stunT = 0.9; R.v = 0; R.fx = kind; R.fxT = 1.0; }
    else if (kind === 'congela') { R.stunT = 1.5; R.v *= 0.2; R.fx = kind; R.fxT = 1.7; this._pop(R.pos.clone().setY(R.pos.y + 1), 0xbff0ff, 2.2); }
    else { R.spin = 1.1; R.v *= 0.25; if (kind === 'quema') { R.fx = kind; R.fxT = 2.4; } }
    if (R.you) { race.ctx.audio.play(kind === 'congela' ? 'crystal' : kind === 'aplasta' ? 'slam' : 'hurt'); race.ctx.input.rumble(260, 0.9); race._flash(kind === 'congela' ? '¡Congelado!' : kind === 'aplasta' ? '¡Aplastado!' : kind === 'quema' ? '¡Quemado!' : '¡Te dieron!', '#ff8a7a'); }
    else if (by && by.you) { race._flash(`¡Le diste a ${R.name}!`, '#7affa0'); const sv = race.ctx.getSave(); if (sv) { sv.race = sv.race || {}; sv.race.hits = (sv.race.hits || 0) + 1; } }
  }
  // pedacitos de colores al romper una caja
  _shards(pos) {
    const cols = [0xff7ab8, 0xffd24a, 0x4cbcff, 0x8be36a];
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(this._shGeo || (this._shGeo = new THREE.BoxGeometry(0.28, 0.28, 0.06)), new THREE.MeshBasicMaterial({ color: cols[i % 4], transparent: true }));
      m.position.copy(pos); this.root.add(m);
      const a = Math.random() * 6.28, v = 4 + Math.random() * 4;
      this.bits.push({ m, vx: Math.cos(a) * v, vz: Math.sin(a) * v, vy: 3 + Math.random() * 5, t: 0 });
    }
  }
  _smoke(pos, color) {
    const m = new THREE.Mesh(this._puffGeo || (this._puffGeo = new THREE.IcosahedronGeometry(0.22, 1)), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false }));
    m.position.copy(pos); this.root.add(m); this.booms.push({ m, t: 0, dur: 0.35, r: 1.1, keep: true, a: 0.5 });
  }
  _pop(pos, color, r) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.position.copy(pos); this.root.add(m); this.booms.push({ m, t: 0, dur: 0.45, r });
  }
}
