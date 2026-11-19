// Poderes especiales: se lanzan con 1, 2 y 3 (o los botones ★ del móvil) y gastan energía.
// Funcionan en la historia contra los enemigos y en la Arena contra otros jugadores.
// Se desbloquean con «puntos de poder»: piezas especiales + victorias en la Arena.
import * as THREE from 'three';
import { storeOf } from './logros.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const POWERS = [
  { id: 'fuego', icon: '🔥', name: 'Ráfaga de fuego', desc: 'Un chorro de llamas en abanico que quema a todos los que tengas delante.', cost: 25, cd: 1.6, need: 0 },
  { id: 'furia', icon: '✊', name: 'Furia de golpes', desc: 'Seis golpes seguidos a toda velocidad mientras avanzas.', cost: 30, cd: 3, need: 0 },
  { id: 'hielo', icon: '❄', name: 'Ráfaga de hielo', desc: 'Un proyectil helado que congela a quien toca durante un rato.', cost: 30, cd: 3, need: 1 },
  { id: 'levitar', icon: '🪶', name: 'Levitación', desc: 'Flotas en el aire unos segundos: sube con salto y baja con esquivar.', cost: 30, cd: 7, need: 2 },
  { id: 'telequinesis', icon: '✋', name: 'Telequinesis', desc: 'Levantas al rival con la mente, lo dejas flotando indefenso y lo estrellas contra el suelo.', cost: 40, cd: 6, need: 4 },
  { id: 'rayo', icon: '👁', name: 'Rayo de los ojos', desc: 'Dos rayos de luz salen de tus ojos y queman lo que miras.', cost: 45, cd: 6, need: 6 },
  { id: 'flechas', icon: '🏹', name: 'Lluvia de flechas', desc: 'Miles de flechas caen del cielo sobre tus enemigos.', cost: 60, cd: 10, need: 8 },
];
export const powerById = id => POWERS.find(p => p.id === id);
export const ENERGY_MAX = 100;
// puntos de poder: piezas + duelos y carreras ganados + la mitad de las oleadas superadas + 1 cada 300 m en Aethra sin fin
export function powerPoints(sv) {
  if (!sv) return 0;
  const n = storeOf(sv).n;
  return (sv.piezas || []).length + (n.duelos || 0) + (n.carreras || 0) + Math.floor((n.oleadaMax || 0) / 2) + Math.floor((n.infinitoMax || 0) / 300);
}
export const powerUnlocked = (p, sv) => powerPoints(sv) >= p.need;
export function loadout(sv) {
  const got = POWERS.filter(p => powerUnlocked(p, sv)).map(p => p.id);
  const cur = ((sv && sv.poderes) || []).filter(id => got.includes(id));
  for (const id of got) { if (cur.length >= 3) break; if (!cur.includes(id)) cur.push(id); }
  return cur.slice(0, 3);
}

// textura redonda y suave para las chispas
let dotTex = null;
function softDot() {
  if (dotTex) return dotTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.7)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); dotTex = new THREE.CanvasTexture(c); return dotTex;
}
const add = THREE.AdditiveBlending;
let arrowGeo = null;
function arrowGeometry() {
  if (arrowGeo) return arrowGeo;
  const shaft = new THREE.CylinderGeometry(0.018, 0.018, 0.9, 4); shaft.translate(0, 0.45, 0);
  const tip = new THREE.ConeGeometry(0.05, 0.16, 4); tip.rotateX(Math.PI); tip.translate(0, -0.06, 0);
  const fl = new THREE.BoxGeometry(0.12, 0.16, 0.01); fl.translate(0, 0.84, 0);
  const fl2 = fl.clone(); fl2.rotateY(Math.PI / 2);
  arrowGeo = mergeGeometries([shaft.toNonIndexed(), tip.toNonIndexed(), fl.toNonIndexed(), fl2.toNonIndexed()]);
  return arrowGeo;
}
const fwd = f => new THREE.Vector3(-Math.sin(f), 0, -Math.cos(f));

export class Powers {
  // C: { scene, physics, fx, audio, combat }
  constructor(C) { this.C = C; this.fx = []; }

  // ¿puede lanzarlo ahora? (energía y espera)
  ready(pl, id) { const P = powerById(id); return P && (pl.energy ?? ENERGY_MAX) >= P.cost && !((pl.pcd || {})[id] > 0) && !(pl.iceT > 0) && !(pl.liftT > 0); }
  tick(pl, dt, regen = 9) { // energía y esperas de una jugadora
    pl.energy = Math.min(ENERGY_MAX, (pl.energy ?? ENERGY_MAX) + regen * dt);
    if (pl.pcd) for (const k in pl.pcd) pl.pcd[k] = Math.max(0, pl.pcd[k] - dt);
    if (pl.slowT > 0) pl.slowT -= dt;
  }
  // foes(): lista de objetivos { pos, radius, ally?, hit(dmg, kind, from, extra) }
  // visual = true: solo se ve (lanzado por un jugador de otro dispositivo; el daño lo calcula quien lo lanzó)
  cast(pl, id, foes, visual = false, aim = null) {
    const P = powerById(id); if (!P) return false;
    if (!visual) {
      if (!this.ready(pl, id)) return false;
      pl.energy -= P.cost; (pl.pcd || (pl.pcd = {}))[id] = P.cd;
    }
    const C = this.C, list = visual ? [] : foes();
    // apuntado: el objetivo más cercano dentro de un cono delante
    const pick = (range, cone) => {
      let best = null, bd = Infinity; const f = fwd(pl.facing);
      for (const t of list) {
        const dx = t.pos.x - pl.pos.x, dz = t.pos.z - pl.pos.z, d = Math.hypot(dx, dz);
        if (d > range || Math.abs(t.pos.y - pl.pos.y) > 6) continue;
        const ang = d < 0.5 ? 0 : Math.acos(Math.max(-1, Math.min(1, (dx * f.x + dz * f.z) / d)));
        const score = d + ang * 8;
        if (ang < cone && score < bd) { bd = score; best = t; }
      }
      return best;
    };
    const turnTo = t => { if (t) pl.facing = Math.atan2(-(t.pos.x - pl.pos.x), -(t.pos.z - pl.pos.z)); };
    const g = (n, o) => pl.gesture && pl.gesture(n, o);
    let target = null;
    if (id === 'fuego') { target = pick(8, 0.9); turnTo(target); g('Use_Item', { speed: 1.6, fadeIn: 0.05, fadeOut: 0.2 }); this._fire(pl, list); C.audio.play('fire', pl.pos); }
    if (id === 'hielo') { target = aim ? null : pick(20, 0.6); turnTo(target); g('Use_Item', { speed: 1.8, fadeIn: 0.05, fadeOut: 0.2 }); this._ice(pl, list, target); C.audio.play('ice', pl.pos); }
    if (id === 'furia') { target = pick(6, 1.2); turnTo(target); this._fury(pl, list); C.audio.play('fury', pl.pos); }
    if (id === 'levitar') { pl.levT = 5; pl.levY = pl.pos.y + 2.4; pl.vel.y = Math.max(pl.vel.y, 5); pl.grounded = false; g('Spellcast_Raise', { speed: 1.4 }); C.fx.ring(pl.pos.clone().setY(pl.pos.y + 0.2), pl.aura || 0xffd27a); C.audio.play('levitate', pl.pos); }
    if (id === 'telequinesis') {
      target = aim ? null : pick(14, 0.7);
      if (!visual && !target) { pl.energy += P.cost; pl.pcd[id] = 0; return 'none'; }
      turnTo(target); g('Spellcast_Raise', { speed: 1.2, fadeIn: 0.1, fadeOut: 0.3 }); this._tele(pl, target, aim); C.audio.play('tele', pl.pos);
    }
    if (id === 'rayo') { target = pick(16, 0.5); turnTo(target); pl.slowT = 1.7; g('Spellcast_Raise', { speed: 0.9 }); this._beam(pl, list); C.audio.play('beam', pl.pos); }
    if (id === 'flechas') {
      target = pick(18, 1.0);
      const at = aim ? new THREE.Vector3(aim.x, aim.y, aim.z) : target ? target.pos.clone() : pl.pos.clone().add(fwd(pl.facing).multiplyScalar(9));
      if (!aim) { const gr = C.physics.groundAt(at.x, at.z, 0.1, at.y + 3); if (gr.y > -Infinity) at.y = gr.y; }
      g('Cheer', { speed: 1.3, fadeIn: 0.05, fadeOut: 0.3 }); this._arrows(pl, list, at); this.lastAim = at;
    }
    if (target && !aim) this.lastAim = target.pos.clone();
    this.lastTarget = target;
    return true;
  }

  // ---------- fuego: abanico de llamas ----------
  _fire(pl, list) {
    const C = this.C, N = 140, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), parts = [];
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.75, map: softDot(), vertexColors: true, transparent: true, depthWrite: false, blending: add }));
    pts.frustumCulled = false; C.scene.add(pts);
    const light = new THREE.PointLight(0xff7a2a, 3, 9); C.scene.add(light);
    for (let i = 0; i < N; i++) parts.push({ t: -Math.random() * 0.4, life: 0.45 + Math.random() * 0.25, p: new THREE.Vector3(), v: new THREE.Vector3() });
    const hitDone = new Set();
    this.fx.push({ t: 0, update: (dt, e) => {
      e.t += dt;
      const f = fwd(pl.facing), o = pl.pos.clone().add(f.clone().multiplyScalar(0.6)); o.y += 1.05;
      light.position.copy(o).add(f.clone().multiplyScalar(2)); light.intensity = 3 * Math.max(0, 1 - e.t / 0.9);
      parts.forEach((q, i) => {
        q.t += dt;
        if (q.t > 0 && !q.on) { q.on = true; const a = pl.facing + (Math.random() - 0.5) * 0.9, s = 9 + Math.random() * 5; q.p.copy(o); q.v.set(-Math.sin(a) * s, (Math.random() - 0.3) * 2, -Math.cos(a) * s); }
        const k = q.on ? q.t / q.life : 2;
        if (q.on && k < 1) { q.p.addScaledVector(q.v, dt); q.v.y += 3 * dt; pos.set([q.p.x, q.p.y, q.p.z], i * 3); col.set([1, 0.9 - k * 0.7, 0.4 - k * 0.4].map(c => Math.max(0, c) * (1 - k * 0.6)), i * 3); }
        else pos.set([0, -999, 0], i * 3);
      });
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
      if (e.t > 0.1 && e.t < 0.55) for (const t of list) { // daño a los que estén en el abanico
        if (hitDone.has(t)) continue;
        const dx = t.pos.x - pl.pos.x, dz = t.pos.z - pl.pos.z, d = Math.hypot(dx, dz);
        if (d > 7.5 || Math.abs(t.pos.y - pl.pos.y) > 2.5) continue;
        if (d > 0.8 && Math.acos(Math.max(-1, Math.min(1, (dx * f.x + dz * f.z) / d))) > 0.55) continue;
        hitDone.add(t); t.hit(2, 'fire', pl.pos.clone(), { push: 6 }); C.fx.flare(t.pos.clone().setY(t.pos.y + 0.8));
      }
      if (e.t > 1.0) { C.scene.remove(pts); C.scene.remove(light); geo.dispose(); return true; }
    } });
  }

  // ---------- hielo: proyectil que congela ----------
  _ice(pl, list, target) {
    const C = this.C;
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), new THREE.MeshStandardMaterial({ color: 0xd8f6ff, emissive: 0x4ab8ff, emissiveIntensity: 1.6, flatShading: true, transparent: true, opacity: 0.9 }));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: 0x8ad8ff, transparent: true, depthWrite: false, blending: add })); glow.scale.setScalar(1.6); m.add(glow);
    const p = pl.pos.clone().add(fwd(pl.facing).multiplyScalar(0.8)); p.y += 1.1; m.position.copy(p); C.scene.add(m);
    const v = (target ? target.pos.clone().setY(target.pos.y + 0.8).sub(p) : fwd(pl.facing)).normalize().multiplyScalar(20);
    this.fx.push({ t: 0, update: (dt, e) => {
      e.t += dt; m.position.addScaledVector(v, dt); m.rotation.x += dt * 9; m.rotation.y += dt * 7;
      if (Math.random() < 0.6) C.fx.sparkle(m.position.clone(), 1, 0xbff4ff);
      let hit = null;
      for (const t of list) if (t.pos.clone().setY(t.pos.y + 0.8).distanceTo(m.position) < (t.radius || 0.5) + 0.5) { hit = t; break; }
      const wall = C.physics.groundAt(m.position.x, m.position.z, 0.1, m.position.y).y > m.position.y - 0.05 && e.t > 0.05;
      if (hit) hit.hit(1, 'ice', m.position.clone(), { t: 2.6 });
      if (hit || wall || e.t > 1.2) { C.fx.sparkle(m.position.clone(), 24, 0xd8f6ff); C.audio.play('thaw', m.position); C.scene.remove(m); return true; }
    } });
  }

  // ---------- furia: seis golpes seguidos ----------
  _fury(pl, list) {
    const C = this.C, anims = ['1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Chop'];
    pl.invuln = Math.max(pl.invuln || 0, 1.0);
    let n = 0;
    this.fx.push({ t: 0, next: 0, update: (dt, e) => {
      e.t += dt;
      if (e.t >= e.next && n < 6) {
        e.next += 0.15; const last = n === 5;
        pl.gesture && pl.gesture(anims[n], { speed: 2.6, fadeIn: 0.02, fadeOut: 0.08 });
        C.combat.slash(pl, { arc: [-0.6, 0.6, 0.3, -0.3, 0.6, 0][n] });
        const f = fwd(pl.facing); pl.vel.x = f.x * 7; pl.vel.z = f.z * 7;
        C.audio.play('swing', pl.pos);
        for (const t of list) {
          const dx = t.pos.x - pl.pos.x, dz = t.pos.z - pl.pos.z, d = Math.hypot(dx, dz);
          if (d > 2.5 + (t.radius || 0) || Math.abs(t.pos.y - pl.pos.y) > 2) continue;
          if (d > 0.7 && Math.acos(Math.max(-1, Math.min(1, (dx * f.x + dz * f.z) / d))) > 1.3) continue;
          t.hit(last ? 2 : 1, 'fury', pl.pos.clone(), { push: last ? 9 : 2 }); C.fx.sparkle(t.pos.clone().setY(t.pos.y + 0.9), 8, 0xffffff);
        }
        if (last) C.combat.shake(0.2, 0.2);
        n++;
      }
      if (n >= 6 && e.t > e.next) return true;
    } });
  }

  // ---------- telequinesis ----------
  _tele(pl, target, aim) {
    const C = this.C, col = pl.aura || 0xb07aff;
    const tp = () => aim && aim.getPos ? aim.getPos() : target ? target.pos : (aim ? new THREE.Vector3(aim.x, aim.y, aim.z) : pl.pos);
    const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, depthWrite: false, blending: add });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 6, 1, true), mat); C.scene.add(beam);
    const rings = [0, 1, 2].map(i => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.75 - i * 0.12, 0.04, 6, 32), mat); C.scene.add(r); return r; });
    if (target) target.hit(0, 'lift', pl.pos.clone(), { t: 2.3, slam: 2 });
    this.fx.push({ t: 0, update: (dt, e) => {
      e.t += dt;
      const a = pl.pos.clone().add(fwd(pl.facing).multiplyScalar(0.5)); a.y += 1.2;
      const b = tp().clone(); b.y += 1.0;
      const mid = a.clone().add(b).multiplyScalar(0.5), len = a.distanceTo(b);
      beam.position.copy(mid); beam.scale.set(1 + Math.sin(e.t * 30) * 0.3, len, 1 + Math.sin(e.t * 30) * 0.3);
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      rings.forEach((r, i) => { r.position.copy(b).setY(b.y - 0.6 + i * 0.6 + Math.sin(e.t * 4 + i) * 0.1); r.rotation.x = Math.PI / 2; r.rotation.z = e.t * (3 + i); });
      if (Math.random() < 0.5) C.fx.sparkle(b.clone(), 2, col);
      mat.opacity = 0.55 * Math.min(1, (2.4 - e.t) * 3);
      if (e.t > 2.4) { C.scene.remove(beam); rings.forEach(r => C.scene.remove(r)); C.combat.shake(0.25, 0.25); C.audio.play('slam', tp()); C.fx.dust(tp(), 12, 1.4); return true; }
    } });
  }

  // ---------- rayo de los ojos ----------
  _beam(pl, list) {
    const C = this.C;
    const mat = new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.9, depthWrite: false, blending: add });
    const core = new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.9, depthWrite: false, blending: add });
    const beams = [-1, 1].map(() => { const g = new THREE.Group(); const o = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 8, 1, true), mat); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 6, 1, true), core); g.add(o, c); C.scene.add(g); return g; });
    const spot = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: 0xff6a3a, transparent: true, depthWrite: false, blending: add })); spot.scale.setScalar(1.4); C.scene.add(spot);
    let tick = 0;
    this.fx.push({ t: 0, update: (dt, e) => {
      e.t += dt; tick -= dt;
      const f = fwd(pl.facing), side = new THREE.Vector3(-f.z, 0, f.x), h = 1.38 * ((pl.ch && pl.ch.scale) || 1);
      const eye = pl.pos.clone().add(f.clone().multiplyScalar(0.22)); eye.y += h;
      const dir = f.clone(); dir.y = -0.06; dir.normalize();
      // primer objetivo en la línea de los ojos, o la pared
      let dist = C.physics.raycast(eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, 16); dist = Math.min(16, dist);
      let hit = null;
      for (const t of list) {
        const c = t.pos.clone().setY(t.pos.y + 0.9), along = c.clone().sub(eye).dot(dir);
        if (along < 0 || along > dist) continue;
        if (c.distanceTo(eye.clone().addScaledVector(dir, along)) < (t.radius || 0.5) + 0.45) { dist = along; hit = t; }
      }
      const end = eye.clone().addScaledVector(dir, dist);
      beams.forEach((g, i) => {
        const a = eye.clone().addScaledVector(side, i ? 0.07 : -0.07), len = a.distanceTo(end);
        g.position.copy(a.clone().add(end).multiplyScalar(0.5)); g.scale.set(1 + Math.random() * 0.4, len, 1 + Math.random() * 0.4);
        g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(a).normalize());
      });
      spot.position.copy(end); spot.material.opacity = 0.7 + Math.random() * 0.3;
      if (Math.random() < 0.5) C.fx.sparkle(end.clone(), 2, 0xff8a4a);
      if (hit && tick <= 0) { tick = 0.25; hit.hit(1, 'beam', eye.clone(), { push: 2 }); }
      if (e.t > 1.6) { beams.forEach(g => C.scene.remove(g)); C.scene.remove(spot); return true; }
    } });
  }

  // ---------- lluvia de flechas ----------
  _arrows(pl, list, at) {
    const C = this.C, R = 5, N = 1200;
    const warn = new THREE.Mesh(new THREE.RingGeometry(R - 0.25, R, 64), new THREE.MeshBasicMaterial({ color: 0xff4a3a, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
    warn.rotation.x = -Math.PI / 2; warn.position.copy(at).setY(at.y + 0.05); C.scene.add(warn);
    const fill = new THREE.Mesh(new THREE.CircleGeometry(R, 48), new THREE.MeshBasicMaterial({ color: 0xff4a3a, transparent: true, opacity: 0.12, depthWrite: false })); fill.rotation.x = -Math.PI / 2; fill.position.copy(warn.position); C.scene.add(fill);
    const mesh = new THREE.InstancedMesh(arrowGeometry(), new THREE.MeshStandardMaterial({ color: 0x8a5a32, roughness: 0.7 }), N);
    mesh.frustumCulled = false; C.scene.add(mesh);
    const A = [], dummy = new THREE.Object3D();
    for (let i = 0; i < N; i++) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * R; A.push({ x: at.x + Math.cos(a) * r, z: at.z + Math.sin(a) * r, t0: 0.7 + Math.random() * 1.7, tilt: (Math.random() - 0.5) * 0.25, rot: Math.random() * 6.28, stuck: false }); }
    let tick = 0;
    C.audio.play('arrows', at);
    this.fx.push({ t: 0, update: (dt, e) => {
      e.t += dt; tick -= dt;
      warn.material.opacity = 0.35 + Math.sin(e.t * 14) * 0.25;
      A.forEach((q, i) => {
        const k = e.t - q.t0;
        let y = 24 - k * 32;
        if (k < 0) { dummy.position.set(0, -999, 0); }
        else {
          if (y <= at.y + 0.35) { y = at.y + 0.35; if (!q.stuck) { q.stuck = true; if (i % 40 === 0) C.fx.dust(new THREE.Vector3(q.x, at.y, q.z), 2, 0.5); } }
          dummy.position.set(q.x, y, q.z);
        }
        dummy.rotation.set(Math.PI + q.tilt, q.rot, q.tilt); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (e.t > 0.9 && e.t < 2.6 && tick <= 0) {
        tick = 0.35;
        for (const t of list) if (Math.hypot(t.pos.x - at.x, t.pos.z - at.z) < R + (t.radius || 0) && Math.abs(t.pos.y - at.y) < 3.5) t.hit(1, 'arrow', new THREE.Vector3(t.pos.x, t.pos.y + 3, t.pos.z), { push: 1 });
      }
      if (e.t > 3.6) { mesh.material.transparent = true; mesh.material.opacity = Math.max(0, 1 - (e.t - 3.6) * 2); }
      if (e.t > 4.1) { C.scene.remove(mesh); C.scene.remove(warn); C.scene.remove(fill); mesh.dispose(); return true; }
    } });
  }

  update(dt) { for (let i = this.fx.length - 1; i >= 0; i--) if (this.fx[i].update(dt, this.fx[i])) this.fx.splice(i, 1); }
  clear() { for (const e of this.fx) { try { e.t = 99; e.update(0, e); } catch (err) {} } this.fx = []; }

  // ---------- estados visibles: congelado, levantado, levitando ----------
  statusFx(pl, dt) {
    const host = pl.mesh; if (!host) return;
    const ice = pl.iceT > 0, lift = pl.liftT > 0, lev = pl.levT > 0;
    if (ice && !pl._iceBlock) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xcff4ff, emissive: 0x3a8ad0, emissiveIntensity: 0.5, transparent: true, opacity: 0.55, roughness: 0.1, flatShading: true, depthWrite: false }));
      m.scale.set(0.75, 1.15, 0.75); m.position.y = 0.95; host.add(m); pl._iceBlock = m; this.C.audio.play('freeze', pl.pos);
    }
    if (!ice && pl._iceBlock) { host.remove(pl._iceBlock); this.C.fx.sparkle(pl.pos.clone().setY(pl.pos.y + 1), 20, 0xd8f6ff); this.C.audio.play('thaw', pl.pos); pl._iceBlock = null; }
    if ((lift || lev) && !pl._aura) {
      const col = lift ? 0xb07aff : (pl.aura || 0xffd27a);
      const g = new THREE.Group(); const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, depthWrite: false, blending: add, side: THREE.DoubleSide });
      for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.55 + i * 0.18, 0.03, 6, 32), mat); r.rotation.x = Math.PI / 2; r.position.y = 0.1 + i * 0.12; g.add(r); }
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: col, transparent: true, opacity: 0.35, depthWrite: false, blending: add })); s.scale.set(2.2, 2.8, 1); s.position.y = 1; g.add(s);
      host.add(g); pl._aura = g; pl._auraKind = lift ? 'lift' : 'lev';
    }
    if (pl._aura && !(lift || lev)) { host.remove(pl._aura); pl._aura = null; }
    if (pl._aura) pl._aura.children.forEach((c, i) => { if (c.isMesh) { c.rotation.z += dt * (2 + i); c.position.y = 0.1 + i * 0.12 + Math.sin(performance.now() / 300 + i) * 0.08; } });
  }
}
