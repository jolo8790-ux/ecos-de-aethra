import * as THREE from 'three';
import { createCharacter, restorePose, savePose } from './characters.js';
import { prop, clipModel } from './props.js';

// Combate: criaturas de cristal, proyectiles, curaciones y el jefe Raíz Madre.
// Todas las criaturas avisan antes de atacar (brillo rojo y temblor) para que el jugador pueda esquivar.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (k, dt) => 1 - Math.exp(-k * dt);
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const mats = {};
const mat = (c, o = {}) => { const k = c + JSON.stringify(o); return mats[k] || (mats[k] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o })); };
const WHITE = new THREE.MeshBasicMaterial({ color: 0xffffff });

function mesh(geo, m, parent, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; }

// Niveles de dificultad
export const DIFF = {
  facil: { name: 'Cuento', dmg: 0.5, invuln: 1.8, bossHp: 0.7, fallHurts: false },
  normal: { name: 'Aventura', dmg: 1, invuln: 1.1, bossHp: 1, fallHurts: true },
  dificil: { name: 'Leyenda', dmg: 2, invuln: 0.8, bossHp: 1.35, fallHurts: true },
};

// Modelo generado con un material propio que puede brillar (el brillo usa la propia textura).
function glowModel(id, fit, tint, emissive, rotY = Math.PI) {
  const m = prop(id, fit, { rotY });
  if (!m) return null;
  let gm = null;
  m.traverse(o => {
    if (!o.isMesh) return;
    if (!gm) {
      gm = o.material.clone();
      if (tint) gm.color.multiply(new THREE.Color(tint));
      gm.emissive = new THREE.Color(emissive); gm.emissiveMap = gm.map; gm.emissiveIntensity = 0.15;
    }
    o.material = gm; o.userData.glowFlash = true;
  });
  m.userData.mat = gm;
  return m;
}
// Piel de jefe: modelo generado que sustituye a las piezas sencillas; brilla con el color de los ojos del jefe.
function bossSkin(id, fit, rotY, clip) {
  const m = prop(id, fit, { rotY });
  if (!m) return null;
  if (clip) clipModel(m, clip);
  const mats = [];
  m.traverse(o => {
    if (!o.isMesh) return;
    if (!clip) o.material = o.material.clone();
    o.material.emissive = new THREE.Color(0); o.material.emissiveMap = o.material.map; o.material.emissiveIntensity = 0;
    o.userData.glowFlash = true; mats.push(o.material);
  });
  m.userData.mats = mats;
  m.userData.glow = (color, k) => { for (const mt of mats) { if (o_flashing(mt)) continue; mt.emissive.copy(color); mt.emissiveIntensity = k; } };
  return m;
}
const o_flashing = mt => mt.emissive.getHex() === 0xffffff && mt.emissiveMap === null;
const hideMeshes = (group, keep = []) => group.children.forEach(o => { if (o.isMesh && !keep.includes(o)) o.visible = false; });
const BROTE_MODELS = { brote: ['brote', 1.15], brote_vidrio: ['brote', 1.15, 0xffd9a0], brote_hielo: ['brote', 1.15, 0xd8f0ff], automata: ['automata', 1.35], sombra: ['sombra', 1.5] };
const ESPORA_MODELS = { espora: ['espora', null], espora_vidrio: ['espora', 0xffd9a0], espora_hielo: ['espora', 0xd8f0ff], centinela: ['espora', 0x8a70b0] };

// Destello blanco al recibir un golpe: cambia temporalmente los materiales.
function setFlash(group, on) {
  group.traverse(o => {
    if (!o.isMesh || o.userData.noFlash) return;
    if (o.userData.glowFlash) { // modelos generados: destello con el brillo propio (no cambia el material ni su recorte)
      const m = o.material;
      if (on) { if (!o.userData.flashSave) o.userData.flashSave = [m.emissive.getHex(), m.emissiveIntensity, m.emissiveMap]; m.emissive.setHex(0xffffff); m.emissiveIntensity = 0.9; m.emissiveMap = null; m.needsUpdate = true; }
      else if (o.userData.flashSave) { const [c, i, map] = o.userData.flashSave; m.emissive.setHex(c); m.emissiveIntensity = i; m.emissiveMap = map; m.needsUpdate = true; o.userData.flashSave = null; }
      return;
    }
    if (on) { if (!o.userData.mat) o.userData.mat = o.material; o.material = WHITE; }
    else if (o.userData.mat) { o.material = o.userData.mat; }
  });
}

// ---------------------------------------------------------------------------------
class Enemy {
  constructor(c, x, y, z) {
    this.c = c; this.pos = new THREE.Vector3(x, y, z); this.home = this.pos.clone();
    this.vel = new THREE.Vector3(); this.facing = Math.random() * Math.PI * 2;
    this.group = new THREE.Group(); c.root.add(this.group);
    this.alive = true; this.state = 'idle'; this.t = Math.random() * 2; this.flash = 0; this.radius = 0.6; this.stagger = 0;
  }
  hurt(dmg, from, push) {
    if (!this.alive) return false;
    this.hp -= dmg; this.flash = 0.12; setFlash(this.group, true);
    const dx = this.pos.x - from.x, dz = this.pos.z - from.z, l = Math.hypot(dx, dz) || 1;
    this.vel.x = dx / l * push; this.vel.z = dz / l * push; this.vel.y = push > 6 ? 4 : 2.5;
    this.stagger = 0.4; this.state = 'stagger';
    this.c.audio.play(this.hp <= 0 ? 'shatter' : 'hit');
    if (this.hp <= 0) this.die();
    return true;
  }
  die() {
    this.alive = false;
    const p = this.pos.clone().setY(this.pos.y + 0.6);
    this.c.fx.sparkle(p, 22, this.color || 0x9ff0ff);
    this.c.fx.dust(this.pos, 8, 1.2, 0xd8f6ff);
    this.c.root.remove(this.group);
    if (Math.random() < 0.4) this.c.spawnHeal(this.pos.x, this.pos.y, this.pos.z);
    this.c.onKill && this.c.onKill(this);
  }
  // física sencilla: sigue el suelo, cae si no hay
  stepPhysics(dt, avoidEdges) {
    const P = this.c.physics;
    const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
    if (avoidEdges && this.onGround) {
      const g = P.groundAt(nx + Math.sign(this.vel.x) * 0.4, nz + Math.sign(this.vel.z) * 0.4, 0.2, this.pos.y + 0.4);
      if (g.y < this.pos.y - 1.0) { this.vel.x = 0; this.vel.z = 0; }
    }
    const tryX = this.pos.clone(); tryX.x += this.vel.x * dt;
    if (!this._blocked(tryX)) this.pos.x = tryX.x; else this.vel.x = 0;
    const tryZ = this.pos.clone(); tryZ.z += this.vel.z * dt;
    if (!this._blocked(tryZ)) this.pos.z = tryZ.z; else this.vel.z = 0;
    this.vel.y -= 26 * dt;
    const g = P.groundAt(this.pos.x, this.pos.z, 0.25, this.pos.y + 0.45);
    const ny = this.pos.y + this.vel.y * dt;
    if (ny <= g.y) { this.pos.y = g.y; this.vel.y = 0; this.onGround = true; }
    else { this.pos.y = ny; this.onGround = false; }
    if (this.pos.y < this.c.voidY) { this.alive = false; this.c.root.remove(this.group); }
  }
  _blocked(p) {
    for (const b of this.c.physics.boxes) {
      if (b.off || b.enemyPass) continue;
      if (p.x + 0.35 <= b.minX || p.x - 0.35 >= b.maxX || p.z + 0.35 <= b.minZ || p.z - 0.35 >= b.maxZ) continue;
      if (p.y + 0.9 <= b.minY || p.y + 0.42 >= b.maxY) continue;
      return true;
    }
    return false;
  }
  updateFlash(dt) { if (this.flash > 0 && (this.flash -= dt) <= 0) setFlash(this.group, false); }
}

// Brote de cristal: se acerca saltando, avisa (brilla y tiembla) y embiste.
const BROTE_LOOKS = {
  brote: { rock: 0x6b5a4a, crystal: 0x7ff0d8, emissive: 0x1a8f7a, hp: 3 },
  brote_vidrio: { rock: 0xc8a06a, crystal: 0xffc86a, emissive: 0xa0601a, hp: 3 },
  automata: { rock: 0x8a7a6a, crystal: 0xd4a24c, emissive: 0x8a4a1a, hp: 4, metal: true },
  brote_hielo: { rock: 0x8aa0b8, crystal: 0xd8f6ff, emissive: 0x3a8ad0, hp: 3 },
  sombra: { rock: 0x3a2a4a, crystal: 0xb07aff, emissive: 0x5a2aa8, hp: 3, aura: true },
};
const ESPORA_LOOKS = {
  espora: { stem: 0x4f7a3a, core: 0xf29bff, coreE: 0x9a2aa8, petal: 0xc79bff },
  espora_vidrio: { stem: 0xb08a5a, core: 0xffb86a, coreE: 0xa8501a, petal: 0xffe0a8 },
  torreta: { stem: 0x5a4a3a, core: 0xff7a3a, coreE: 0xa8301a, petal: 0xb08a4a },
  espora_hielo: { stem: 0x6a8aa0, core: 0xbff4ff, coreE: 0x3a8ad0, petal: 0xe8fbff, range: 18 },
  centinela: { stem: 0x3a2a4a, core: 0xc07aff, coreE: 0x6a2aa8, petal: 0x7a5aa8 },
};
class Brote extends Enemy {
  constructor(c, x, y, z, type = 'brote') {
    super(c, x, y, z);
    const L = BROTE_LOOKS[type] || BROTE_LOOKS.brote;
    this.hp = L.hp; this.color = L.crystal; this.cd = 1; this.baseEmissive = L.emissive;
    const g = this.body = new THREE.Group(); this.group.add(g);
    const BM = BROTE_MODELS[type], model = BM && glowModel(BM[0], { h: BM[1] }, BM[2], L.emissive);
    if (model) {
      g.add(model); this.crystalMat = model.userData.mat; this.glowK = 0.12;
      this.mark = mesh(new THREE.ConeGeometry(0.12, 0.35, 4), new THREE.MeshBasicMaterial({ color: 0xff5a4a }), this.group, 0, 1.7, 0);
      this.mark.rotation.x = Math.PI; this.mark.visible = false; this.mark.userData.noFlash = true;
      if (L.aura) {
        this.aura = mesh(new THREE.SphereGeometry(1.0, 16, 12), new THREE.MeshStandardMaterial({ color: 0x5a2aa8, emissive: 0x3a0a6a, emissiveIntensity: 0.8, transparent: true, opacity: 0.35, depthWrite: false }), this.group, 0, 0.6, 0);
        this.aura.userData.noFlash = true; this.aura.castShadow = false;
      }
      return;
    }
    if (L.metal) {
      mesh(new THREE.BoxGeometry(0.8, 0.6, 0.7), mat(L.rock, { metalness: 0.6, roughness: 0.4 }), g, 0, 0.45, 0);
      const gear = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 10), mat(0xd4a24c, { metalness: 0.7 }), g, 0, 0.5, 0.36); gear.rotation.x = Math.PI / 2; this.gear = gear;
    } else mesh(new THREE.DodecahedronGeometry(0.48, 0), mat(L.rock, { flatShading: true }), g, 0, 0.42, 0).scale.set(1, 0.8, 1);
    this.crystalMat = new THREE.MeshStandardMaterial({ color: L.crystal, emissive: L.emissive, emissiveIntensity: 0.6, roughness: 0.25, flatShading: true, metalness: L.metal ? 0.5 : 0 });
    [[0, 0.95, 0, 0.18, 0.7, 0], [0.22, 0.82, 0.1, 0.12, 0.45, -0.5], [-0.22, 0.8, 0.05, 0.12, 0.5, 0.5], [0.05, 0.78, 0.25, 0.1, 0.35, 0.3]].forEach(([x1, y1, z1, r, h, rz]) => {
      const s = mesh(new THREE.ConeGeometry(r, h, 5), this.crystalMat, g, x1, y1, z1); s.rotation.z = rz;
    });
    const eye = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
    this.eyes = [-0.15, 0.15].map(ex => { const e = mesh(new THREE.SphereGeometry(0.07, 8, 6), eye, g, ex, 0.5, -0.4); e.userData.noFlash = true; return e; });
    [-0.22, 0.22].forEach(lx => mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.22, 6), mat(0x4a3a2e), g, lx, 0.1, 0));
    this.mark = mesh(new THREE.ConeGeometry(0.12, 0.35, 4), new THREE.MeshBasicMaterial({ color: 0xff5a4a }), this.group, 0, 1.7, 0);
    this.mark.rotation.x = Math.PI; this.mark.visible = false; this.mark.userData.noFlash = true;
    if (L.aura) { // aura de sombra: solo el pulso de luz la deshace
      this.aura = mesh(new THREE.SphereGeometry(0.95, 16, 12), new THREE.MeshStandardMaterial({ color: 0x5a2aa8, emissive: 0x3a0a6a, emissiveIntensity: 0.8, transparent: true, opacity: 0.4, depthWrite: false }), this.group, 0, 0.55, 0);
      this.aura.userData.noFlash = true; this.aura.castShadow = false;
    }
  }
  hurt(dmg, from, push) {
    if (this.aura) { // el bastón rebota en el aura
      this.c.audio.play('dark'); this.c.fx.sparkle(this.pos.clone().setY(this.pos.y + 0.6), 6, 0xb07aff);
      this.c.onAuraClang && this.c.onAuraClang();
      return true;
    }
    return super.hurt(dmg, from, push);
  }
  dispel() { if (!this.aura) return; this.group.remove(this.aura); this.aura = null; this.c.fx.sparkle(this.pos.clone().setY(this.pos.y + 0.6), 20, 0xfff2a8); }
  update(dt, pl) {
    if (!this.alive) return;
    this.t += dt; this.cd -= dt; this.updateFlash(dt);
    if (this.aura) { this.aura.scale.setScalar(1 + Math.sin(this.t * 4) * 0.05); this.aura.rotation.y += dt; }
    const dx = pl.pos.x - this.pos.x, dz = pl.pos.z - this.pos.z, dist = Math.hypot(dx, dz), dy = Math.abs(pl.pos.y - this.pos.y);
    const toP = Math.atan2(-dx, -dz);
    const sees = dist < 10 && dy < 2.5 && pl.hp > 0;
    let hop = 0, shake = 0, glow = 0.6;
    switch (this.state) {
      case 'idle':
        this.vel.x *= 0.8; this.vel.z *= 0.8;
        hop = Math.abs(Math.sin(this.t * 2)) * 0.05;
        if (sees) { this.state = 'notice'; this.st = 0.5; this.c.audio.play('crystal'); }
        if (this.pos.distanceTo(this.home) > 1.5) { const hx = this.home.x - this.pos.x, hz = this.home.z - this.pos.z, l = Math.hypot(hx, hz); this.vel.x = hx / l * 1.5; this.vel.z = hz / l * 1.5; this.facing += angDiff(Math.atan2(-hx, -hz), this.facing) * damp(5, dt); }
        break;
      case 'notice':
        this.st -= dt; this.mark.visible = true; hop = Math.sin((0.5 - this.st) / 0.5 * Math.PI) * 0.4;
        this.facing += angDiff(toP, this.facing) * damp(10, dt);
        if (this.st <= 0) { this.state = 'chase'; this.mark.visible = false; }
        break;
      case 'chase': {
        if (!sees || this.pos.distanceTo(this.home) > 15) { this.state = 'idle'; break; }
        this.facing += angDiff(toP, this.facing) * damp(6, dt);
        const sp = dist > 2.3 ? 2.8 : 0;
        this.vel.x = -Math.sin(this.facing) * sp; this.vel.z = -Math.cos(this.facing) * sp;
        hop = Math.abs(Math.sin(this.t * 7)) * 0.18 * (sp > 0 ? 1 : 0.3);
        if (dist < 3.2 && this.cd <= 0) { this.state = 'windup'; this.st = 0.7; this.c.audio.play('windup'); this.vel.set(0, this.vel.y, 0); }
        break;
      }
      case 'windup':
        this.st -= dt; shake = 0.06; glow = 2.5;
        this.facing += angDiff(toP, this.facing) * damp(8, dt);
        this.vel.x *= 0.7; this.vel.z *= 0.7;
        if (this.st <= 0) { this.state = 'lunge'; this.st = 0.32; this.hitDone = false; }
        break;
      case 'lunge':
        this.st -= dt; glow = 2;
        this.vel.x = -Math.sin(this.facing) * 10; this.vel.z = -Math.cos(this.facing) * 10;
        if (!this.hitDone && dist < 1.0 && dy < 1.4) { this.hitDone = true; pl.damage(1, this.pos); }
        if (this.st <= 0) { this.state = 'recover'; this.st = 0.85; this.cd = 1.4; }
        break;
      case 'recover':
        this.st -= dt; this.vel.x *= 0.85; this.vel.z *= 0.85; glow = 0.2;
        hop = 0; this.body.rotation.z = Math.sin(this.t * 20) * 0.05;
        if (this.st <= 0) { this.state = 'chase'; this.body.rotation.z = 0; }
        break;
      case 'stagger':
        this.stagger -= dt; this.vel.x *= 0.9; this.vel.z *= 0.9;
        if (this.stagger <= 0) { this.state = 'chase'; this.cd = Math.max(this.cd, 0.6); }
        break;
    }
    this.stepPhysics(dt, this.state !== 'stagger');
    if (!this.alive) return;
    this.crystalMat.emissiveIntensity += (glow * (this.glowK || 1) - this.crystalMat.emissiveIntensity) * damp(10, dt);
    this.crystalMat.emissive.setHex(this.state === 'windup' || this.state === 'lunge' ? 0xff3a2a : this.baseEmissive);
    if (this.gear) this.gear.rotation.y += dt * (this.state === 'chase' ? 8 : 2);
    this.group.position.set(this.pos.x + (Math.random() - 0.5) * shake, this.pos.y, this.pos.z + (Math.random() - 0.5) * shake);
    this.group.rotation.y = this.facing;
    this.body.position.y = hop;
    const sq = this.state === 'windup' ? 0.85 : 1;
    this.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    this.mark.position.y = 1.7 + Math.sin(this.t * 10) * 0.05;
  }
}

// Espora: flor de cristal fija que se abre y dispara semillas brillantes.
class Espora extends Enemy {
  constructor(c, x, y, z, type = 'espora') {
    super(c, x, y, z);
    const L = this.look = ESPORA_LOOKS[type] || ESPORA_LOOKS.espora;
    this.hp = type === 'torreta' ? 3 : 2; this.color = L.core; this.cd = 1.5 + Math.random();
    const EM = ESPORA_MODELS[type], model = EM && glowModel('espora', { h: 1.7 }, EM[1], L.coreE);
    if (model) {
      this.head = new THREE.Group(); this.group.add(this.head); this.model = model; this.head.add(model);
      this.coreMat = model.userData.mat; this.glowK = 0.12; this.petals = [];
      this.radius = 0.7;
      this.box = c.physics.addBox(x, y + 0.5, z, 0.6, 1.0, 0.6, { noCamera: true });
      return;
    }
    mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.9, 7), mat(L.stem), this.group, 0, 0.45, 0);
    this.head = new THREE.Group(); this.head.position.y = 1.0; this.group.add(this.head);
    this.coreMat = new THREE.MeshStandardMaterial({ color: L.core, emissive: L.coreE, emissiveIntensity: 0.8, roughness: 0.3 });
    this.core = mesh(new THREE.SphereGeometry(0.22, 12, 10), this.coreMat, this.head);
    this.petals = [];
    for (let i = 0; i < 5; i++) {
      const pv = new THREE.Group(); pv.rotation.y = (i / 5) * Math.PI * 2; this.head.add(pv);
      const p = mesh(new THREE.ConeGeometry(0.16, 0.6, 4), mat(L.petal, { flatShading: true, emissive: 0x3a1a5a, emissiveIntensity: 0.4 }), pv, 0, 0.2, 0.12);
      p.rotation.x = -0.4; this.petals.push(p);
    }
    this.radius = 0.7;
    this.box = c.physics.addBox(x, y + 0.5, z, 0.6, 1.0, 0.6, { noCamera: true });
  }
  die() { super.die(); this.box.off = true; }
  update(dt, pl) {
    if (!this.alive) return;
    this.t += dt; this.updateFlash(dt);
    const head = pl.pos.clone().setY(pl.pos.y + 0.9);
    const dist = Math.hypot(pl.pos.x - this.pos.x, pl.pos.z - this.pos.z);
    let open = 0;
    if (dist < (this.look.range || 13) && Math.abs(pl.pos.y - this.pos.y) < 7 && pl.hp > 0) {
      this.cd -= dt;
      this.head.rotation.y += angDiff(Math.atan2(-(pl.pos.x - this.pos.x), -(pl.pos.z - this.pos.z)), this.head.rotation.y) * damp(4, dt);
      if (this.cd < 0.6) { open = 1 - this.cd / 0.6; if (!this.warned) { this.warned = true; this.c.audio.play('windup'); } }
      if (this.cd <= 0) {
        const from = this.pos.clone().setY(this.pos.y + 1.05);
        this.c.shoot(from, head, 7.5, this.look.core, this);
        this.cd = 2.6; this.warned = false;
      }
    }
    this.petals.forEach(p => { p.rotation.x = -0.4 - open * 0.9; });
    this.coreMat.emissiveIntensity = (0.8 + open * 2.5) * (this.glowK || 1);
    this.coreMat.emissive.setHex(open > 0 ? 0xff3aa8 : this.look.coreE);
    this.group.position.copy(this.pos);
    if (this.model) { const k = 1 + open * 0.12 + Math.sin(this.t * 2) * 0.02; this.model.scale.set(1 / Math.sqrt(k), k, 1 / Math.sqrt(k)); }
    else this.head.position.y = 1.0 + Math.sin(this.t * 2) * 0.04;
    if (this.state === 'stagger') { this.stagger -= dt; if (this.stagger <= 0) this.state = 'idle'; }
  }
  hurt(dmg, from) { return super.hurt(dmg, from, 0); }
}

// ---------------------------------------------------------------------------------
// Raíz Madre: un tocón gigante que hace brotar raíces bajo los pies de Lía.
// Solo se le hace daño golpeando el nudo de cristal de cada raíz mientras está fuera.
class RaizMadre {
  constructor(c, x, y, z) {
    this.c = c; this.pos = new THREE.Vector3(x, y, z);
    this.maxHp = 8; this.hp = 8; this.state = 'sleep'; this.t = 0; this.cd = 2.5; this.phase = 1;
    this.roots = []; this.flash = 0; this.summonCd = 8; this.name = 'Raíz Madre'; this.phaseMsg = '¡La Raíz Madre está furiosa!';
    const g = this.group = new THREE.Group(); g.position.copy(this.pos); c.root.add(g);
    const bark = mat(0x5a3f2b, { flatShading: true }), barkDark = mat(0x3f2b1d, { flatShading: true });
    this.trunk = mesh(new THREE.CylinderGeometry(2.2, 3.2, 5.5, 9, 3), bark, g, 0, 2.75, 0);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3;
      const r = mesh(new THREE.ConeGeometry(0.7, 3.2, 6), barkDark, g, Math.cos(a) * 3.2, 0.5, Math.sin(a) * 3.2);
      r.rotation.z = Math.cos(a) * 1.25; r.rotation.x = -Math.sin(a) * 1.25;
    }
    // cara
    this.eyeMat = new THREE.MeshStandardMaterial({ color: 0xfff1a8, emissive: 0xffb02a, emissiveIntensity: 0.15 });
    this.eyes = [-0.8, 0.8].map(ex => { const e = mesh(new THREE.SphereGeometry(0.38, 12, 10), this.eyeMat, g, ex, 3.4, 2.45); e.scale.z = 0.5; e.userData.noFlash = true; return e; });
    [-0.8, 0.8].forEach(ex => { const b = mesh(new THREE.BoxGeometry(0.9, 0.25, 0.4), barkDark, g, ex, 3.95, 2.45); b.rotation.z = ex > 0 ? 0.25 : -0.25; });
    this.mouth = mesh(new THREE.BoxGeometry(1.6, 0.35, 0.3), mat(0x1a0f08), g, 0, 2.3, 2.55);
    // corona de hojas y cristales
    const leaf = mat(0x4f9a4a, { flatShading: true });
    [[0, 6.4, 0, 2.6], [1.8, 5.8, 0.6, 1.6], [-1.8, 5.9, -0.4, 1.7], [0.4, 6.0, -1.8, 1.5]].forEach(([a, b, cc, r]) => mesh(new THREE.IcosahedronGeometry(r, 0), leaf, g, a, b, cc));
    this.crownMat = new THREE.MeshStandardMaterial({ color: 0x7ff0d8, emissive: 0x1a8f7a, emissiveIntensity: 0.8, flatShading: true });
    [[0.6, 5.6, 1.6], [-1.2, 5.4, 1.2], [1.6, 5.2, -0.2]].forEach(([a, b, cc]) => mesh(new THREE.ConeGeometry(0.35, 1.6, 5), this.crownMat, g, a, b, cc));
    this.box = c.physics.addBox(x, y + 2.75, z, 4.6, 5.5, 4.6);
    this.radius = 2.8;
    g.scale.setScalar(1);
    const skin = bossSkin('raiz_madre', { x: 7.2, y: 6.8, z: 7.2 }, 0);
    if (skin) { hideMeshes(g); this.skinG = new THREE.Group(); this.skinG.add(skin); g.add(this.skinG); this.skin = skin; }
  }
  get alive() { return this.state !== 'dead'; }
  get fighting() { return !['sleep', 'intro', 'dying', 'dead'].includes(this.state); }
  wake() { if (this.state === 'sleep') { this.state = 'intro'; this.st = 2.2; this.c.audio.play('roar'); this.c.shake(0.6, 2); } }

  update(dt, pl) {
    this.t += dt;
    if (this.flash > 0 && (this.flash -= dt) <= 0) setFlash(this.group, false);
    const breathe = Math.sin(this.t * 1.5) * 0.04;
    this.trunk.scale.set(1 + breathe, 1 - breathe * 0.5, 1 + breathe);
    if (this.skin) { this.skinG.scale.copy(this.trunk.scale); this.skin.userData.glow(this.eyeMat.emissive, Math.max(0, this.eyeMat.emissiveIntensity - 0.15) * 0.09 + (this.phase === 2 ? 0.04 : 0)); }
    if (this.state === 'sleep') { this.eyeMat.emissiveIntensity = 0.15; return; }
    if (this.state === 'intro') {
      this.st -= dt; this.eyeMat.emissiveIntensity = 3 * (1 - this.st / 2.2) + 0.15;
      this.group.position.x = this.pos.x + Math.sin(this.t * 40) * 0.05;
      if (this.st <= 0) { this.state = 'fight'; this.group.position.copy(this.pos); }
      return;
    }
    if (this.state === 'dying') {
      this.st -= dt;
      this.group.position.set(this.pos.x + Math.sin(this.t * 50) * 0.08, this.pos.y - (2.6 - this.st) * 0.7, this.pos.z);
      if (Math.random() < 0.4) this.c.fx.sparkle(this.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 2 + Math.random() * 4, (Math.random() - 0.5) * 4)), 4, 0x7ff0d8);
      if (this.st <= 0) { this.state = 'dead'; this.c.root.remove(this.group); this.box.off = true; this.c.onBossDefeated && this.c.onBossDefeated(this); }
      return;
    }
    if (this.state !== 'fight') return;
    this.eyeMat.emissiveIntensity = 2.2 + Math.sin(this.t * 6) * 0.4;
    // mirar a Lía
    const want = Math.atan2(pl.pos.x - this.pos.x, pl.pos.z - this.pos.z);
    this.group.rotation.y += angDiff(want, this.group.rotation.y) * damp(1.2, dt);

    this.cd -= dt;
    if (this.cd <= 0 && pl.hp > 0) {
      const n = this.phase === 1 ? 2 : 3;
      for (let i = 0; i < n; i++) {
        const off = i === 0 ? new THREE.Vector3() : new THREE.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6);
        const p = pl.pos.clone().add(off);
        const g = this.c.physics.groundAt(p.x, p.z, 0.2, this.pos.y + 1);
        if (g.y > -Infinity && Math.abs(g.y - this.pos.y) < 0.5) this.roots.push(new Root(this.c, this, p.x, g.y, p.z, this.phase === 1 ? 1.0 : 0.8));
      }
      this.cd = this.phase === 1 ? 3.4 : 2.4;
      this.c.audio.play('rumble');
    }
    if (this.phase === 2) {
      this.summonCd -= dt;
      if (this.summonCd <= 0 && this.c.enemies.filter(e => e.alive && e.summoned).length < 3) {
        for (let i = 0; i < 2; i++) {
          const a = Math.random() * Math.PI * 2;
          const e = this.c.addEnemy('brote', this.pos.x + Math.sin(a) * 6, this.pos.y + 0.5, this.pos.z + 5 + Math.cos(a) * 2);
          e.summoned = true; e.home.copy(pl.pos); this.c.fx.dust(e.pos, 10, 1.2, 0x7ff0d8);
        }
        this.summonCd = 11; this.c.audio.play('roar');
      }
    }
    for (const r of this.roots) r.update(dt, pl);
    this.roots = this.roots.filter(r => !r.gone);
  }

  // daño desde el nudo de una raíz
  wound(from) {
    if (this.state !== 'fight') return;
    this.hp -= 1; this.flash = 0.15; setFlash(this.group, true);
    this.c.audio.play('roar'); this.c.shake(0.35, 0.5);
    if (this.hp <= this.maxHp / 2 && this.phase === 1) { this.phase = 2; this.summonCd = 2; this.crownMat.emissive.setHex(0xff3a2a); this.c.onBossPhase && this.c.onBossPhase(this); }
    if (this.hp <= 0) {
      this.state = 'dying'; this.st = 2.6; this.c.shake(0.8, 2.6);
      for (const r of this.roots) r.retract();
      for (const e of this.c.enemies) if (e.summoned && e.alive) e.die();
    }
  }
  // golpe al tronco: no hace daño, pero da una pista
  clang() { this.c.audio.play('crystal'); this.c.onBossClang && this.c.onBossClang(); }
  dispose() { for (const r of this.roots) r.remove(); }
}

class Root {
  constructor(c, boss, x, y, z, warn) {
    this.c = c; this.boss = boss; this.pos = new THREE.Vector3(x, y, z);
    this.t = 0; this.warn = warn; this.state = 'warn'; this.gone = false; this.radius = 0.7;
    this.group = new THREE.Group(); this.group.position.copy(this.pos); c.root.add(this.group);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.3, 32), new THREE.MeshBasicMaterial({ color: 0xff4a2a, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.05; this.group.add(this.ring);
    this.fill = new THREE.Mesh(new THREE.CircleGeometry(1.0, 32), new THREE.MeshBasicMaterial({ color: 0xff4a2a, transparent: true, opacity: 0.0, depthWrite: false }));
    this.fill.rotation.x = -Math.PI / 2; this.fill.position.y = 0.04; this.group.add(this.fill);
    this.spike = new THREE.Group(); this.group.add(this.spike); this.spike.scale.set(1, 0.01, 1);
    const m = mesh(new THREE.ConeGeometry(0.55, 2.6, 7), mat(0x5a3f2b, { flatShading: true }), this.spike, 0, 1.3, 0);
    m.rotation.z = (Math.random() - 0.5) * 0.3;
    this.knotMat = new THREE.MeshStandardMaterial({ color: 0xffc06a, emissive: 0xff8a1a, emissiveIntensity: 1.6, flatShading: true });
    this.knot = mesh(new THREE.OctahedronGeometry(0.3, 0), this.knotMat, this.spike, 0, 0.6, 0.35);
  }
  update(dt, pl) {
    this.t += dt;
    if (this.state === 'warn') {
      const k = this.t / this.warn;
      this.ring.material.opacity = 0.4 + Math.sin(this.t * 25) * 0.3;
      this.fill.material.opacity = k * 0.35; this.fill.scale.setScalar(Math.max(0.01, k));
      if (k >= 1) {
        this.state = 'up'; this.t = 0; this.c.audio.play('slam'); this.c.shake(0.25, 0.3);
        this.c.fx.dust(this.pos, 12, 1.5, 0x8a6a4a);
        const d = Math.hypot(pl.pos.x - this.pos.x, pl.pos.z - this.pos.z);
        if (d < 1.4 && Math.abs(pl.pos.y - this.pos.y) < 1.5) pl.damage(1, this.pos);
        this.ring.visible = this.fill.visible = false;
        this.box = this.c.physics.addBox(this.pos.x, this.pos.y + 1, this.pos.z, 0.7, 2, 0.7, { noCamera: true });
      }
    } else if (this.state === 'up') {
      this.spike.scale.y = Math.min(1, this.spike.scale.y + dt * 9);
      this.knotMat.emissiveIntensity = 1.4 + Math.sin(this.t * 10) * 0.6;
      if (this.t > 2.4) this.retract();
    } else if (this.state === 'down') {
      this.spike.scale.y = Math.max(0.01, this.spike.scale.y - dt * 4);
      if (this.spike.scale.y <= 0.01) this.remove();
    }
  }
  get hittable() { return this.state === 'up' && this.spike.scale.y > 0.6; }
  hitKnot(from) {
    if (!this.hittable) return false;
    this.c.fx.sparkle(this.pos.clone().setY(this.pos.y + 0.7), 18, 0xffc06a);
    this.c.audio.play('shatter');
    this.boss.wound(from); this.retract();
    return true;
  }
  retract() { if (this.state === 'down' || this.gone) return; this.state = 'down'; if (this.box) this.box.off = true; this.ring.visible = this.fill.visible = false; }
  remove() { this.gone = true; this.c.root.remove(this.group); if (this.box) this.box.off = true; }
}


// ---------------------------------------------------------------------------------
// Escorpión Prisma: embiste en línea recta. Si choca contra un pilar de vidrio queda aturdido
// y el cristal de su cola (punto débil) queda al alcance. También barre la arena con un láser bajo: hay que saltarlo.
class Escorpion {
  constructor(c, x, y, z, B) {
    this.c = c; this.pos = new THREE.Vector3(x, y, z); this.name = 'Escorpión Prisma'; this.phaseMsg = '¡El Escorpión Prisma está furioso!';
    this.maxHp = 6; this.hp = 6; this.state = 'sleep'; this.t = 0; this.st = 0; this.cycle = 0; this.phase = 1;
    this.facing = 0; this.arena = B.arena || [x, z + 8, 12]; this.radius = 2.2; this.curl = 0; this.flash = 0; this.stunHits = 0;
    const g = this.group = new THREE.Group(); c.root.add(g);
    const shell = new THREE.MeshStandardMaterial({ color: 0xffc86a, emissive: 0x8a4a10, emissiveIntensity: 0.35, roughness: 0.15, metalness: 0.2, flatShading: true, transparent: true, opacity: 0.92 });
    const dark = mat(0x7a4a1a, { flatShading: true });
    this.body = new THREE.Group(); g.add(this.body);
    mesh(new THREE.SphereGeometry(1, 14, 10), shell, this.body, 0, 0.95, 0).scale.set(1.5, 0.75, 2.0);
    mesh(new THREE.SphereGeometry(0.75, 12, 8), shell, this.body, 0, 1.0, -1.9).scale.set(1.1, 0.7, 0.9);
    this.eyeMat = new THREE.MeshStandardMaterial({ color: 0x4af0ff, emissive: 0x2ac8ff, emissiveIntensity: 1.2 });
    [-0.35, 0.35].forEach(ex => { const e = mesh(new THREE.SphereGeometry(0.13, 8, 6), this.eyeMat, this.body, ex, 1.3, -2.45); e.userData.noFlash = true; });
    this.legs = [];
    for (let i = 0; i < 6; i++) {
      const side = i < 3 ? -1 : 1, k = i % 3;
      const leg = new THREE.Group(); leg.position.set(side * 1.2, 0.9, -0.8 + k * 0.9); this.body.add(leg);
      const up = mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.3, 6), dark, leg, side * 0.55, 0.15, 0); up.rotation.z = side * -1.1;
      const lo = mesh(new THREE.CylinderGeometry(0.08, 0.05, 1.3, 6), dark, leg, side * 1.2, -0.45, 0); lo.rotation.z = side * 0.35;
      this.legs.push({ leg, side, k });
    }
    this.claws = [-1, 1].map(side => {
      const cg = new THREE.Group(); cg.position.set(side * 1.0, 1.0, -2.3); this.body.add(cg);
      mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.4, 6), shell, cg, 0, 0, -0.6).rotation.x = Math.PI / 2;
      const p1 = mesh(new THREE.ConeGeometry(0.28, 1.0, 5), shell, cg, side * 0.18, 0, -1.6); p1.rotation.x = -Math.PI / 2; p1.rotation.z = side * 0.25;
      const p2 = mesh(new THREE.ConeGeometry(0.2, 0.8, 5), shell, cg, -side * 0.15, 0, -1.5); p2.rotation.x = -Math.PI / 2; p2.rotation.z = -side * 0.35;
      return cg;
    });
    this.tail = [];
    for (let i = 0; i < 6; i++) { const seg = mesh(new THREE.SphereGeometry(0.42 - i * 0.04, 10, 8), shell, this.body, 0, 0, 0); this.tail.push(seg); }
    this.stingMat = new THREE.MeshStandardMaterial({ color: 0xbff8ff, emissive: 0x3ac8ff, emissiveIntensity: 0.8, flatShading: true });
    this.sting = mesh(new THREE.OctahedronGeometry(0.5, 0), this.stingMat, this.body, 0, 0, 0); this.sting.scale.y = 1.4; this.sting.userData.noFlash = true;
    this.beam = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 16), new THREE.MeshBasicMaterial({ color: 0xff6a3a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.beam.geometry.translate(0, 0, -8); this.beam.visible = false; c.root.add(this.beam);
    const self = this;
    this.weak = { radius: 0.9, pos: new THREE.Vector3(), get hittable() { return self.state === 'stunned' && self.stunHits < 2; }, hit: () => self.wound() };
    this.weakPoints = [this.weak];
    // modelo generado sin su cola (la cola y el aguijón se animan aparte: son el punto débil)
    const skin = bossSkin('escorpion_cuerpo', { x: 3.6, y: 1.9, z: 5.0 }, Math.PI, [{ or: [{ axis: 'z', keep: [0.42, 1] }, { axis: 'y', keep: [0, 0.45] }] }]);
    if (skin) {
      hideMeshes(this.body, [...this.tail, this.sting]);
      this.legs.forEach(L => L.leg.visible = false); this.claws.forEach(cg => cg.visible = false);
      skin.position.set(0, 0, -0.6); this.body.add(skin); this.skin = skin;
      this.tail.forEach(t => t.material = mat(0x7a5a3a, { flatShading: true, roughness: 0.6 }));
    }
    this._place();
  }
  get alive() { return this.state !== 'dead'; }
  get fighting() { return !['sleep', 'intro', 'dying', 'dead'].includes(this.state); }
  wake() { if (this.state === 'sleep') { this.state = 'intro'; this.st = 2; this.c.audio.play('roar'); this.c.shake(0.5, 1.5); } }
  _place() {
    this.group.position.copy(this.pos); this.group.rotation.y = this.facing;
    if (this.skin) { this.skin.userData.glow(this.eyeMat.emissive, this.eyeMat.emissive.getHex() === 0xff3a2a ? 0.35 : 0.04); this.skin.position.y = Math.abs(Math.sin(this.t * 8)) * 0.04; }
    // cola: de levantada (curl 0) a apoyada en el suelo (curl 1)
    const raised = i => { const a = -1.2 + i * 0.55; return new THREE.Vector3(0, 2.0 + Math.sin(a) * 1.3, 1.9 - Math.cos(a) * 1.3 + 1.3); };
    const lowered = i => new THREE.Vector3(0, 0.55, 2.0 + i * 0.62);
    for (let i = 0; i < this.tail.length; i++) this.tail[i].position.copy(raised(i).lerp(lowered(i), this.curl));
    this.sting.position.copy(raised(6.3).lerp(new THREE.Vector3(0, 0.6, 5.8), this.curl));
    this.sting.rotation.x = -0.6 + this.curl * 2.2;
    this.group.updateMatrixWorld(true);
    this.sting.getWorldPosition(this.weak.pos);
  }
  update(dt, pl) {
    this.t += dt;
    if (this.flash > 0 && (this.flash -= dt) <= 0) setFlash(this.group, false);
    const walk = (sp) => { for (const L of this.legs) L.leg.rotation.x = Math.sin(this.t * sp * 3 + L.k * 2 + (L.side > 0 ? Math.PI : 0)) * 0.35; };
    const dx = pl.pos.x - this.pos.x, dz = pl.pos.z - this.pos.z, dist = Math.hypot(dx, dz);
    const toP = Math.atan2(-dx, -dz);
    let want = 0; // curl objetivo
    switch (this.state) {
      case 'sleep': walk(0); break;
      case 'intro': this.st -= dt; this.claws.forEach((c, i) => c.rotation.x = Math.sin(this.t * 10 + i) * 0.3); if (this.st <= 0) { this.state = 'stalk'; this.st = 1.4; } break;
      case 'stalk': {
        this.facing += angDiff(toP, this.facing) * damp(3, dt);
        const sp = dist > 7 ? 2.6 : 0; this.pos.x -= Math.sin(this.facing) * sp * dt; this.pos.z -= Math.cos(this.facing) * sp * dt;
        walk(sp > 0 ? 2.5 : 0.6); this.st -= dt;
        if (this.st <= 0) { this.cycle++; if (this.cycle % 3 === 0) { this.state = 'sweep'; this.st = 2.8; this.sweepA = this.facing; this.c.audio.play('laser'); } else { this.state = 'windup'; this.st = 0.85; this.c.audio.play('windup'); } }
        break;
      }
      case 'windup':
        this.st -= dt; if (this.st > 0.2) this.facing += angDiff(toP, this.facing) * damp(6, dt);
        this.claws.forEach(c => c.rotation.x = -0.7); this.eyeMat.emissive.setHex(0xff3a2a);
        this.group.position.x += (Math.random() - 0.5) * 0.08; walk(4);
        if (this.st <= 0) { this.state = 'charge'; this.st = 2.2; this.hitDone = false; this.c.audio.play('rumble'); }
        break;
      case 'charge': {
        const sp = this.phase === 1 ? 15 : 19;
        this.pos.x -= Math.sin(this.facing) * sp * dt; this.pos.z -= Math.cos(this.facing) * sp * dt; walk(6); this.st -= dt;
        if (Math.random() < 0.5) this.c.fx.dust(this.pos, 2, 1, 0xe8c890);
        if (!this.hitDone && dist < 2.1 && Math.abs(pl.pos.y - this.pos.y) < 1.8) { this.hitDone = true; pl.damage(1, this.pos); }
        const front = this.pos.clone().add(new THREE.Vector3(-Math.sin(this.facing) * 2.2, 0, -Math.cos(this.facing) * 2.2));
        for (const p of this.c.world.pillars) if (p.alive && Math.hypot(front.x - p.pos.x, front.z - p.pos.z) < p.r + 0.6) {
          p.break(); this.c.fx.sparkle(p.pos.clone().setY(p.pos.y + 2), 30, 0xbff0ff); this.c.audio.play('shatter'); this.c.shake(0.6, 0.5);
          this.state = 'stunned'; this.st = 3.4; this.stunHits = 0; this.c.onBossStun && this.c.onBossStun();
          break;
        }
        const [ax, az, ar] = this.arena;
        if (this.state === 'charge' && (Math.hypot(this.pos.x - ax, this.pos.z - az) > ar - 2 || this.st <= 0)) { this.state = 'recover'; this.st = 0.9; }
        break;
      }
      case 'stunned':
        this.st -= dt; want = 1; walk(0); this.claws.forEach(c => c.rotation.x = 0.4);
        this.stingMat.emissiveIntensity = 2 + Math.sin(this.t * 12) * 1; this.eyeMat.emissive.setHex(0x3a5a6a);
        this.body.rotation.z = Math.sin(this.t * 25) * 0.03;
        if (this.st <= 0 || this.stunHits >= 2) { this.state = 'recover'; this.st = 0.8; this.body.rotation.z = 0; }
        break;
      case 'recover':
        this.st -= dt; walk(1); this.eyeMat.emissive.setHex(0x2ac8ff); this.stingMat.emissiveIntensity = 0.8;
        // volver hacia el centro de la arena
        { const [ax, az] = this.arena; const hx = ax - this.pos.x, hz = az - this.pos.z, l = Math.hypot(hx, hz); if (l > 3) { this.pos.x += hx / l * 3 * dt; this.pos.z += hz / l * 3 * dt; } }
        if (this.st <= 0) { this.state = 'stalk'; this.st = this.phase === 1 ? 1.5 : 0.9; }
        break;
      case 'sweep': {
        this.st -= dt; walk(0.4);
        const k = 1 - this.st / 2.8;
        this.beam.visible = k > 0.12;
        this.sweepA += dt * (Math.PI * 2 / 2.4) * (k > 0.12 ? 1 : 0);
        this.beam.position.set(this.pos.x, this.pos.y + 0.75, this.pos.z); this.beam.rotation.y = this.sweepA;
        this.beam.scale.set(1 + Math.sin(this.t * 40) * 0.3, 1 + Math.sin(this.t * 40) * 0.3, 1);
        if (this.beam.visible) {
          const pa = Math.atan2(-dx, -dz);
          if (Math.abs(angDiff(pa, this.sweepA)) < 0.09 && dist < 16 && pl.pos.y - this.pos.y < 0.9) pl.damage(1, this.pos);
        }
        if (this.st <= 0) { this.beam.visible = false; this.state = 'stalk'; this.st = 1.2; }
        break;
      }
      case 'dying':
        this.st -= dt; this.body.rotation.z = Math.sin(this.t * 40) * 0.05; this.body.position.y = -(2.6 - this.st) * 0.4;
        if (Math.random() < 0.5) this.c.fx.sparkle(this.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3)), 4, 0xffc86a);
        if (this.st <= 0) { this.state = 'dead'; this.c.root.remove(this.group); this.c.onBossDefeated && this.c.onBossDefeated(this); }
        break;
    }
    if (this.state !== 'dead') {
      this.curl += (want - this.curl) * damp(6, dt);
      if (this.state !== 'windup') this.group.position.copy(this.pos);
      this._place();
    }
  }
  wound() {
    if (this.state !== 'stunned') return false;
    this.hp -= 1; this.stunHits++; this.flash = 0.15; setFlash(this.group, true);
    this.c.audio.play('shatter'); this.c.shake(0.3, 0.3);
    this.c.fx.sparkle(this.weak.pos, 18, 0xbff8ff);
    if (this.hp <= this.maxHp / 2 && this.phase === 1) { this.phase = 2; this.c.onBossPhase && this.c.onBossPhase(this); }
    if (this.hp <= 0) { this.state = 'dying'; this.st = 2.6; this.c.shake(0.7, 2.2); this.beam.visible = false; }
    return true;
  }
  clang() { this.c.audio.play('crystal'); this.c.onBossClang && this.c.onBossClang(); }
  dispose() { this.c.root.remove(this.beam); }
}

// ---------------------------------------------------------------------------------
// Coloso de Engranajes: golpea el suelo con el puño y lanza ondas expansivas (hay que saltarlas).
// Tras el puñetazo queda atascado: aparece un anillo para el garfio que sube a su pecho, donde se golpea el núcleo.
class Coloso {
  constructor(c, x, y, z, B) {
    this.c = c; this.pos = new THREE.Vector3(x, y, z); this.name = 'Coloso de Engranajes'; this.phaseMsg = '¡El Coloso se sobrecalienta!';
    this.maxHp = 6; this.hp = 6; this.state = 'sleep'; this.t = 0; this.st = 0; this.cycle = 0; this.phase = 1;
    this.facing = B.facing ?? Math.PI; this.radius = 2.4; this.flash = 0; this.waves = []; this.stuckHits = 0;
    const g = this.group = new THREE.Group(); c.root.add(g);
    const brass = mat(0xb08a4a, { metalness: 0.6, roughness: 0.35, flatShading: true }), iron = mat(0x5a5048, { metalness: 0.6, roughness: 0.5, flatShading: true });
    // piernas y cuerpo (mira hacia -z local)
    [-1.1, 1.1].forEach(lx => { mesh(new THREE.BoxGeometry(1.1, 3.2, 1.2), iron, g, lx, 1.6, 0); mesh(new THREE.BoxGeometry(1.5, 0.5, 1.9), brass, g, lx, 0.25, -0.3); });
    mesh(new THREE.BoxGeometry(2.8, 1.0, 1.6), brass, g, 0, 3.6, 0);
    this.torso = new THREE.Group(); this.torso.position.y = 4.1; g.add(this.torso);
    mesh(new THREE.BoxGeometry(3.6, 2.8, 2.2), brass, this.torso, 0, 1.4, 0);
    mesh(new THREE.BoxGeometry(1.6, 1.2, 1.4), iron, this.torso, 0, 3.3, 0);
    this.eyeMat = new THREE.MeshStandardMaterial({ color: 0xffe27a, emissive: 0xffa02a, emissiveIntensity: 0.2 });
    const visor = mesh(new THREE.BoxGeometry(1.3, 0.25, 0.1), this.eyeMat, this.torso, 0, 3.35, -0.72); visor.userData.noFlash = true;
    this.coreMat = new THREE.MeshStandardMaterial({ color: 0xbff8ff, emissive: 0x3ac8ff, emissiveIntensity: 0.6, flatShading: true });
    this.core = mesh(new THREE.OctahedronGeometry(0.45, 0), this.coreMat, this.torso, 0, 1.0, -1.15); this.core.userData.noFlash = true;
    this.chestGears = [-1, 1].map(sx => { const gr = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.15, 12), iron, this.torso, sx * 1.1, 1.9, -1.12); gr.rotation.x = Math.PI / 2; return gr; });
    // brazos: el derecho golpea
    this.arms = [-1, 1].map(sx => {
      const sh = new THREE.Group(); sh.position.set(sx * 2.25, 2.4, 0); this.torso.add(sh);
      mesh(new THREE.SphereGeometry(0.75, 10, 8), brass, sh);
      mesh(new THREE.BoxGeometry(0.8, 3.6, 0.8), iron, sh, 0, -1.9, 0);
      mesh(new THREE.BoxGeometry(0.9, 3.4, 0.9), brass, sh, 0, -5.3, 0);
      const fist = mesh(new THREE.BoxGeometry(1.5, 1.4, 1.5), iron, sh, 0, -7.4, 0);
      return { sh, fist, sx };
    });
    this.arms[1].sh.rotation.x = 0.15; this.arms[0].sh.rotation.x = 0.15;
    this.box = c.physics.addBox(x, y + 4, z, 3.0, 8, 3.0);
    // anillo del garfio y repisa del pecho (solo mientras está atascado)
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xffe27a, emissive: 0xffb02a, emissiveIntensity: 1.5, metalness: 0.5 });
    this.ring = mesh(new THREE.TorusGeometry(0.45, 0.09, 10, 24), ringMat, c.root); this.ring.visible = false; this.ringMat = ringMat;
    this.ledgeMesh = mesh(new THREE.BoxGeometry(1.8, 0.3, 1.8), brass, c.root); this.ledgeMesh.visible = false;
    this.ledge = null;
    const self = this;
    this.gp = { pos: new THREE.Vector3(), landAt: new THREE.Vector3(), land: true, get active() { return self.state === 'stuck'; }, onArrive: () => {} };
    this.weak = { radius: 0.8, pos: new THREE.Vector3(), get hittable() { return (self.state === 'stuck') && self.stuckHits < 2; }, hit: () => self.wound() };
    this.weakPoints = [this.weak];
    this.tele = new THREE.Mesh(new THREE.CircleGeometry(2.4, 32), new THREE.MeshBasicMaterial({ color: 0xff4a2a, transparent: true, opacity: 0, depthWrite: false }));
    this.tele.rotation.x = -Math.PI / 2; c.root.add(this.tele);
    // modelo generado (sin sus brazos: los brazos que golpean siguen siendo piezas animadas)
    const skin = bossSkin('coloso_cuerpo', { h: 8.6 }, Math.PI, [{ axis: 'x', keep: [0.25, 0.75] }]);
    if (skin) {
      hideMeshes(g); hideMeshes(this.torso, [this.core]);
      skin.position.y = -4.1; this.torso.add(skin); this.skin = skin; this.core.position.z = -2.0;
      const bronze = mat(0x8a6a3a, { metalness: 0.3, roughness: 0.6, flatShading: true }), dark = mat(0x3a332c, { roughness: 0.7, flatShading: true });
      this.arms.forEach(A => A.sh.children.forEach((o, i) => { if (o.isMesh) o.material = i % 2 ? dark : bronze; }));
    }
    this._place();
  }
  get grapplePoints() { return this.state === 'stuck' ? [this.gp] : []; }
  get alive() { return this.state !== 'dead'; }
  get fighting() { return !['sleep', 'intro', 'dying', 'dead'].includes(this.state); }
  wake() { if (this.state === 'sleep') { this.state = 'intro'; this.st = 2.4; this.c.audio.play('roar'); this.c.shake(0.5, 2); } }
  local(x, y, z) { return new THREE.Vector3(x, y, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.facing).add(this.pos); }
  _place() {
    this.group.position.copy(this.pos); this.group.rotation.y = this.facing;
    this.group.updateMatrixWorld(true);
    this.core.getWorldPosition(this.weak.pos);
    this.gp.pos.copy(this.local(0, 7.6, -3.8)); this.gp.landAt.copy(this.local(0, 5.62, -2.45));
    if (this.skin) this.skin.userData.glow(this.eyeMat.emissive, this.eyeMat.emissiveIntensity * 0.12);
    this.ring.position.copy(this.gp.pos); this.ring.rotation.y = this.facing;
  }
  update(dt, pl) {
    this.t += dt;
    if (this.flash > 0 && (this.flash -= dt) <= 0) setFlash(this.group, false);
    this.chestGears.forEach((gr, i) => gr.rotation.y += dt * (i ? 1 : -1) * (this.state === 'stuck' ? 0.5 : 2));
    const R = this.arms[1];
    const dx = pl.pos.x - this.pos.x, dz = pl.pos.z - this.pos.z;
    const toP = Math.atan2(-dx, -dz);
    this.ringMat.emissiveIntensity = 1.5 + Math.sin(this.t * 10) * 0.6;
    switch (this.state) {
      case 'sleep': this.eyeMat.emissiveIntensity = 0.2; break;
      case 'intro': this.st -= dt; this.eyeMat.emissiveIntensity = 2.5 * (1 - this.st / 2.4); this.torso.rotation.x = Math.sin(this.t * 3) * 0.05; if (this.st <= 0) { this.state = 'idle'; this.st = 1.2; } break;
      case 'idle':
        this.st -= dt; this.facing += angDiff(toP, this.facing) * damp(1.5, dt);
        R.sh.rotation.x += (0.15 - R.sh.rotation.x) * damp(4, dt);
        if (this.st <= 0) {
          this.cycle++;
          if (this.cycle % 2 === 0) { this.state = 'stomp'; this.st = 0.8; this.waveCount = this.phase === 1 ? 1 : 2; this.c.audio.play('windup'); }
          else { this.state = 'raise'; this.st = this.phase === 1 ? 1.2 : 0.9; this.c.audio.play('windup'); }
        }
        break;
      case 'raise': {
        this.st -= dt; this.facing += angDiff(toP, this.facing) * damp(2.5, dt);
        R.sh.rotation.x += (2.9 - R.sh.rotation.x) * damp(5, dt);
        const tgt = this.local(R.sx * 2.25 * 0.6, 0, -5.6); this.tele.position.set(tgt.x, this.pos.y + 0.05, tgt.z);
        this.tele.material.opacity = 0.25 + Math.sin(this.t * 20) * 0.15;
        this.eyeMat.emissive.setHex(0xff3a2a);
        if (this.st <= 0) { this.state = 'slam'; this.st = 0.16; }
        break;
      }
      case 'slam':
        this.st -= dt; R.sh.rotation.x += (0.72 - R.sh.rotation.x) * damp(30, dt);
        if (this.st <= 0) {
          R.sh.rotation.x = 0.72; this.tele.material.opacity = 0;
          const p = this.tele.position; this.c.audio.play('stomp'); this.c.shake(0.7, 0.5); this.c.fx.dust(p, 20, 2, 0xb8a080);
          if (Math.hypot(pl.pos.x - p.x, pl.pos.z - p.z) < 2.5 && Math.abs(pl.pos.y - this.pos.y) < 1.5) pl.damage(1, p);
          this.state = 'stuck'; this.st = 4.2; this.stuckHits = 0; this.eyeMat.emissive.setHex(0x3a5a6a);
          const lp = this.local(0, 5.6, -2.45);
          this.ledge = this.c.physics.addBox(lp.x, lp.y - 0.15, lp.z, 1.8, 0.3, 1.8, { noCamera: true });
          this.ledgeMesh.position.set(lp.x, lp.y - 0.15, lp.z); this.ledgeMesh.rotation.y = this.facing; this.ledgeMesh.visible = true;
          this.ring.visible = true; this.coreMat.emissiveIntensity = 2.2;
          this.c.onBossStun && this.c.onBossStun();
        }
        break;
      case 'stuck':
        this.st -= dt; this.torso.rotation.z = Math.sin(this.t * 18) * 0.015;
        this.coreMat.emissiveIntensity = 2 + Math.sin(this.t * 10) * 0.8;
        if (this.st <= 0 || this.stuckHits >= 2) this._unstick(pl);
        break;
      case 'shake':
        this.st -= dt; this.torso.rotation.z = Math.sin(this.t * 40) * 0.05;
        if (this.st <= 0) { this.torso.rotation.z = 0; this.state = 'idle'; this.st = this.phase === 1 ? 1.4 : 0.8; }
        break;
      case 'stomp':
        this.st -= dt; this.group.position.y = this.pos.y + Math.max(0, Math.sin((0.8 - this.st) / 0.8 * Math.PI)) * 0.6;
        if (this.st <= 0) {
          this.group.position.y = this.pos.y; this.c.audio.play('stomp'); this.c.shake(0.5, 0.4);
          this.spawnWave(); this.waveCount--;
          if (this.waveCount > 0) { this.st = 0.7; } else { this.state = 'idle'; this.st = 1.6; }
        }
        break;
      case 'dying':
        this.st -= dt; this.torso.rotation.x = (2.8 - this.st) * 0.15; this.group.position.y = this.pos.y - (2.8 - this.st) * 0.6;
        if (Math.random() < 0.5) this.c.fx.sparkle(this.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 3 + Math.random() * 4, (Math.random() - 0.5) * 3)), 5, 0xffd27a);
        if (this.st <= 0) { this.state = 'dead'; this.c.root.remove(this.group); this.box.off = true; this.c.onBossDefeated && this.c.onBossDefeated(this); }
        break;
    }
    // ondas expansivas
    for (const w of this.waves) {
      w.r += dt * 9; w.m.scale.setScalar(w.r); w.m.material.opacity = Math.max(0, 0.7 * (1 - w.r / 18));
      const d = Math.hypot(pl.pos.x - w.x, pl.pos.z - w.z);
      if (!w.hit && Math.abs(d - w.r) < 0.6 && pl.pos.y - this.pos.y < 0.7) { w.hit = true; pl.damage(1, new THREE.Vector3(w.x, pl.pos.y, w.z)); }
      if (w.r > 18) { this.c.root.remove(w.m); w.done = true; }
    }
    this.waves = this.waves.filter(w => !w.done);
    if (this.state !== 'dead' && this.state !== 'stomp' && this.state !== 'dying') this.group.position.copy(this.pos);
    if (this.state !== 'dead') { this.group.rotation.y = this.facing; this._place(); }
  }
  spawnWave() {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffb02a, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(this.pos.x, this.pos.y + 0.08, this.pos.z); this.c.root.add(m);
    this.waves.push({ m, r: 2.5, x: this.pos.x, z: this.pos.z });
  }
  _unstick(pl) {
    this.state = 'shake'; this.st = 0.7; this.ring.visible = false; this.ledgeMesh.visible = false; this.coreMat.emissiveIntensity = 0.6;
    if (this.ledge) { this.ledge.off = true; this.ledge = null; }
    this.eyeMat.emissive.setHex(0xffa02a);
    // sacude a Lía si estaba encima
    if (pl.pos.distanceTo(this.local(0, 5.6, -2.45)) < 2.5) { pl.vel.set(-Math.sin(this.facing) * 7, 5, -Math.cos(this.facing) * 7); pl.grounded = false; }
  }
  wound() {
    if (this.state !== 'stuck') return false;
    this.hp -= 1; this.stuckHits++; this.flash = 0.15; setFlash(this.group, true);
    this.c.audio.play('shatter'); this.c.shake(0.35, 0.3); this.c.fx.sparkle(this.weak.pos, 18, 0xbff8ff);
    if (this.hp <= this.maxHp / 2 && this.phase === 1) { this.phase = 2; this.c.onBossPhase && this.c.onBossPhase(this); }
    if (this.hp <= 0) {
      this.state = 'dying'; this.st = 2.8; this.c.shake(0.8, 2.6);
      this.ring.visible = false; this.ledgeMesh.visible = false; if (this.ledge) { this.ledge.off = true; this.ledge = null; }
    }
    return true;
  }
  clang() { this.c.audio.play('gear'); this.c.onBossClang && this.c.onBossClang(); }
  dispose() { for (const w of this.waves) this.c.root.remove(w.m); if (this.ledge) this.ledge.off = true; }
}

// ---------------------------------------------------------------------------------
// Sierpe de Escarcha: vuela en círculos sobre la arena y lanza orbes de hielo.
// Un orbe devuelto con el escudo la derriba: la cabeza queda en el suelo y el cuerno de cristal se puede golpear.
class Sierpe {
  constructor(c, x, y, z, B) {
    this.c = c; this.pos = new THREE.Vector3(x, y, z); this.center = new THREE.Vector3(x, y, z);
    this.name = 'Sierpe de Escarcha'; this.phaseMsg = '¡La Sierpe de Escarcha está furiosa!';
    this.maxHp = 6; this.hp = 6; this.state = 'sleep'; this.t = 0; this.st = 0; this.phase = 1; this.flash = 0;
    this.R = B.orbit || 8.5; this.H = B.height || 6; this.ang = 0; this.radius = 1.6; this.downHits = 0; this.cycle = 0; this.icicles = [];
    this.head = new THREE.Vector3(x, y + 1.5, z); this.trail = [];
    const g = this.group = new THREE.Group(); c.root.add(g);
    const scale = mat(0x9ad8f0, { flatShading: true, roughness: 0.3, metalness: 0.2 }), belly = mat(0xe8fbff, { flatShading: true });
    this.headG = new THREE.Group(); g.add(this.headG);
    mesh(new THREE.BoxGeometry(1.2, 0.8, 1.8), scale, this.headG, 0, 0, -0.2);
    mesh(new THREE.BoxGeometry(1.0, 0.35, 1.3), belly, this.headG, 0, -0.45, -0.6); // mandíbula
    this.eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x7ae8ff, emissiveIntensity: 1.5 });
    [-0.45, 0.45].forEach(ex => { const e = mesh(new THREE.SphereGeometry(0.14, 8, 6), this.eyeMat, this.headG, ex, 0.2, -0.9); e.userData.noFlash = true; });
    this.hornMat = new THREE.MeshStandardMaterial({ color: 0xe8fbff, emissive: 0x4ad8ff, emissiveIntensity: 0.8, flatShading: true });
    this.horn = mesh(new THREE.ConeGeometry(0.3, 1.2, 5), this.hornMat, this.headG, 0, 0.9, 0.1); this.horn.rotation.x = 0.4; this.horn.userData.noFlash = true;
    [-1, 1].forEach(s => { const sp = mesh(new THREE.ConeGeometry(0.12, 0.7, 4), belly, this.headG, s * 0.55, 0.55, 0.4); sp.rotation.z = -s * 0.6; sp.rotation.x = 0.6; });
    this.segs = [];
    for (let i = 0; i < 12; i++) {
      const r = 0.62 - i * 0.035;
      const sg = new THREE.Group(); g.add(sg);
      mesh(new THREE.SphereGeometry(r, 10, 8), scale, sg).scale.set(1, 0.85, 1.2);
      if (i % 2 === 0) mesh(new THREE.ConeGeometry(0.12, 0.5, 4), belly, sg, 0, r * 0.9, 0);
      if (i === 3 || i === 5) [-1, 1].forEach(s => { const w = mesh(new THREE.ConeGeometry(0.5, 1.8, 3), mat(0xc8f0ff, { flatShading: true, transparent: true, opacity: 0.8, side: THREE.DoubleSide }), sg, s * 1.1, 0.2, 0); w.rotation.z = -s * 1.3; w.userData.wing = s; });
      this.segs.push(sg);
    }
    this.reflectPos = new THREE.Vector3(); this.reflectRadius = 1.5;
    const self = this;
    this.weak = { radius: 0.9, pos: new THREE.Vector3(), get hittable() { return self.state === 'downed' && self.downHits < 2; }, hit: () => self.wound() };
    this.weakPoints = [this.weak];
    for (let i = 0; i < 60; i++) this.trail.push(this.head.clone().add(new THREE.Vector3(0, 0, i * 0.25)));
    // cabeza con modelo generado; el cuerno (punto débil) y el cuerpo siguen siendo piezas animadas
    const skin = bossSkin('sierpe_cabeza', { h: 1.9 }, -Math.PI / 2);
    if (skin) {
      hideMeshes(this.headG, [this.horn]);
      skin.position.set(0, -0.75, -0.1); this.headG.add(skin); this.skin = skin;
      this.horn.position.set(0, 1.05, 0.25);
      scale.color.setHex(0x6f97b8); belly.color.setHex(0xcfe8f5);
    }
    this._place(0);
  }
  get alive() { return this.state !== 'dead'; }
  get fighting() { return !['sleep', 'intro', 'dying', 'dead'].includes(this.state); }
  wake() { if (this.state === 'sleep') { this.state = 'intro'; this.st = 2.4; this.c.audio.play('roar'); this.c.shake(0.5, 2); } }
  _orbitPoint(a, h = this.H) { return new THREE.Vector3(this.center.x + Math.cos(a) * this.R, this.center.y + h + Math.sin(a * 3) * 0.6, this.center.z + Math.sin(a) * this.R); }
  _place(dt) {
    if (this.skin) this.skin.userData.glow(this.eyeMat.emissive, Math.max(0, this.eyeMat.emissiveIntensity - 1.5) * 0.08);
    // la cola sigue el rastro de la cabeza
    const last = this.trail[0];
    if (last.distanceTo(this.head) > 0.12) { this.trail.unshift(this.head.clone()); if (this.trail.length > 80) this.trail.pop(); }
    this.headG.position.copy(this.head);
    const grounded = this.state === 'fall' || this.state === 'downed';
    this.layK = (this.layK || 0) + ((grounded ? 1 : 0) - (this.layK || 0)) * Math.min(1, dt * 5);
    const out = this.head.clone().sub(this.center); out.y = 0; if (out.lengthSq() < 0.01) out.set(0, 0, 1); out.normalize();
    const side = new THREE.Vector3(-out.z, 0, out.x);
    for (let i = 0; i < this.segs.length; i++) {
      const p = this.trail[Math.min(this.trail.length - 1, (i + 1) * 4)].clone();
      if (this.layK > 0.01) { // tendida en el suelo, ondulando hacia fuera de la arena
        const g = new THREE.Vector3(this.head.x, this.center.y + 0.5, this.head.z).addScaledVector(out, (i + 1) * 1.05).addScaledVector(side, Math.sin(i * 0.9) * 0.8);
        p.lerp(g, this.layK);
      }
      this.segs[i].position.copy(p);
      const q = i === 0 ? this.head : this.segs[i - 1].position;
      this.segs[i].lookAt(q); this.segs[i].rotateY(Math.PI);
      this.segs[i].children.forEach(o => { if (o.userData.wing) o.rotation.y = Math.sin(this.t * 6 + i) * 0.4 * o.userData.wing; });
    }
    this.headG.updateMatrixWorld(true);
    this.horn.getWorldPosition(this.weak.pos);
    this.reflectPos.copy(this.head);
    this.pos.set(this.head.x, this.center.y, this.head.z);
  }
  _face(target, dt, k = 6) {
    const d = target.clone().sub(this.head); const want = Math.atan2(-d.x, -d.z);
    this.headG.rotation.y += angDiff(want, this.headG.rotation.y) * damp(k, dt);
  }
  update(dt, pl) {
    this.t += dt;
    if (this.flash > 0 && (this.flash -= dt) <= 0) setFlash(this.group, false);
    const plHead = pl.pos.clone().setY(pl.pos.y + 0.9);
    switch (this.state) {
      case 'sleep': this.head.set(this.center.x, this.center.y + 1.2 + Math.sin(this.t) * 0.1, this.center.z - 3); this.headG.rotation.y = 0; break;
      case 'intro': {
        this.st -= dt; const k = 1 - this.st / 2.4;
        this.head.lerp(this._orbitPoint(this.ang), damp(2, dt)); this.ang += dt * 0.6 * k;
        this.eyeMat.emissiveIntensity = 1.5 + k * 2;
        if (this.st <= 0) { this.state = 'orbit'; this.st = 3; }
        break;
      }
      case 'orbit': {
        const sp = this.phase === 1 ? 0.55 : 0.75;
        this.ang += dt * sp;
        this.head.lerp(this._orbitPoint(this.ang), damp(4, dt));
        const nxt = this._orbitPoint(this.ang + 0.3); this._face(nxt, dt, 5);
        this.st -= dt;
        if (this.st <= 0) {
          this.cycle++;
          if (this.phase === 2 && this.cycle % 3 === 0) { this.state = 'rain'; this.st = 2.2; this._rain(pl); }
          else { this.state = 'hover'; this.st = 1.0; this.shots = this.phase === 1 ? 1 : 3; this.c.audio.play('windup'); }
        }
        break;
      }
      case 'hover':
        this._face(plHead, dt, 8); this.hornMat.emissiveIntensity = 2 + Math.sin(this.t * 20);
        this.head.y += Math.sin(this.t * 3) * 0.01;
        this.st -= dt;
        if (this.st <= 0 && this.shots > 0) {
          this.shots--; this.st = 0.45;
          const from = this.head.clone().add(new THREE.Vector3(-Math.sin(this.headG.rotation.y) * 1.2, -0.3, -Math.cos(this.headG.rotation.y) * 1.2));
          const total = this.phase === 1 ? 1 : 3, idx = total - 1 - this.shots, spread = [0, -1.8, 1.8][idx] || 0; // el primero siempre va directo
          const tgt = plHead.clone().add(new THREE.Vector3(spread * Math.cos(this.headG.rotation.y), 0, -spread * Math.sin(this.headG.rotation.y)));
          this.c.shoot(from, tgt, this.phase === 1 ? 8 : 9.5, 0xbff4ff, this, 0.32);
          this.c.audio.play('ice');
        } else if (this.st <= 0) { this.state = 'orbit'; this.st = this.phase === 1 ? 2.6 : 1.8; this.hornMat.emissiveIntensity = 0.8; }
        break;
      case 'rain':
        this.ang += dt * 0.4; this.head.lerp(this._orbitPoint(this.ang, this.H + 2), damp(3, dt)); this._face(plHead, dt, 3);
        this.st -= dt; if (this.st <= 0) { this.state = 'orbit'; this.st = 1.6; }
        break;
      case 'fall': { // derribada por su propio orbe
        this.st -= dt;
        const tgt = this.downAt; this.head.lerp(tgt, damp(5, dt));
        this.headG.rotation.z = Math.sin(this.t * 30) * 0.2;
        if (this.st <= 0) { this.state = 'downed'; this.st = 4; this.downHits = 0; this.headG.rotation.z = 0.25; this.c.shake(0.6, 0.5); this.c.audio.play('stomp'); this.c.fx.dust(this.head, 20, 2, 0xe8fbff); this.c.onBossStun && this.c.onBossStun(); }
        break;
      }
      case 'downed':
        this.st -= dt; this.hornMat.emissiveIntensity = 2.2 + Math.sin(this.t * 10); this.eyeMat.emissiveIntensity = 0.3;
        this.head.y = this.downAt.y + Math.sin(this.t * 2) * 0.05;
        if (this.st <= 0 || this.downHits >= 2) { this.state = 'rise'; this.st = 1.2; this.trail = this.segs.flatMap(sg => [sg.position.clone(), sg.position.clone(), sg.position.clone(), sg.position.clone()]); this.trail.unshift(this.head.clone()); this.layK = 0; this.headG.rotation.z = 0; this.eyeMat.emissiveIntensity = 1.5; this.hornMat.emissiveIntensity = 0.8; this.c.audio.play('roar'); }
        break;
      case 'rise':
        this.st -= dt; this.head.lerp(this._orbitPoint(this.ang), damp(3, dt));
        if (this.st <= 0) { this.state = 'orbit'; this.st = 2; }
        break;
      case 'dying':
        this.st -= dt; this.head.y -= dt * 2; this.headG.rotation.z += dt * 2;
        if (Math.random() < 0.6) this.c.fx.sparkle(this.trail[Math.floor(Math.random() * 40)].clone(), 4, 0xe8fbff);
        if (this.st <= 0) { this.state = 'dead'; this.c.root.remove(this.group); this.c.onBossDefeated && this.c.onBossDefeated(this); }
        break;
    }
    // carámbanos que caen
    for (const ic of this.icicles) {
      ic.t += dt;
      if (ic.t < 1.0) { ic.ring.material.opacity = 0.3 + Math.sin(ic.t * 25) * 0.2; ic.m.position.y = ic.y + 8 - 0; }
      else if (!ic.hit) { ic.m.position.y = Math.max(ic.y + 0.6, ic.m.position.y - dt * 30); if (ic.m.position.y <= ic.y + 0.61) { ic.hit = true; this.c.audio.play('ice'); this.c.fx.sparkle(ic.m.position, 10, 0xe8fbff); if (Math.hypot(pl.pos.x - ic.x, pl.pos.z - ic.z) < 1.3 && Math.abs(pl.pos.y - ic.y) < 1.5) pl.damage(1, new THREE.Vector3(ic.x, ic.y, ic.z)); } }
      if (ic.t > 1.6) { ic.done = true; this.c.root.remove(ic.m); this.c.root.remove(ic.ring); }
    }
    this.icicles = this.icicles.filter(i => !i.done);
    if (this.state !== 'dead') this._place(dt);
  }
  _rain(pl) {
    for (let i = 0; i < 4; i++) {
      const x = pl.pos.x + (i ? (Math.random() - 0.5) * 6 : 0), z = pl.pos.z + (i ? (Math.random() - 0.5) * 6 : 0), y = this.center.y;
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.2, 24), new THREE.MeshBasicMaterial({ color: 0x7ae8ff, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(x, y + 0.05, z); this.c.root.add(ring);
      const m = mesh(new THREE.ConeGeometry(0.35, 1.4, 6), mat(0xe8fbff, { emissive: 0x4ad8ff, emissiveIntensity: 0.6, flatShading: true }), this.c.root, x, y + 9, z); m.rotation.x = Math.PI;
      this.icicles.push({ ring, m, x, y, z, t: -i * 0.15 });
    }
  }
  reflectHit() {
    if (!['orbit', 'hover', 'rain'].includes(this.state)) return;
    const c = this.center, d = this.head.clone().sub(c); d.y = 0; d.setLength(Math.min(this.R - 2, 5));
    this.downAt = new THREE.Vector3(c.x + d.x, c.y + 0.9, c.z + d.z);
    this.state = 'fall'; this.st = 0.8; this.c.audio.play('shatter'); this.c.shake(0.4, 0.4);
  }
  wound() {
    if (this.state !== 'downed') return false;
    this.hp -= 1; this.downHits++; this.flash = 0.15; setFlash(this.group, true);
    this.c.audio.play('shatter'); this.c.shake(0.3, 0.3); this.c.fx.sparkle(this.weak.pos, 18, 0xe8fbff);
    if (this.hp <= this.maxHp / 2 && this.phase === 1) { this.phase = 2; this.c.onBossPhase && this.c.onBossPhase(this); }
    if (this.hp <= 0) { this.state = 'dying'; this.st = 2.6; this.c.shake(0.7, 2.4); }
    return true;
  }
  clang() { this.c.audio.play('ice'); this.c.onBossClang && this.c.onBossClang(); }
  dispose() { for (const ic of this.icicles) { this.c.root.remove(ic.m); this.c.root.remove(ic.ring); } }
}

// ---------------------------------------------------------------------------------
// Vaelor, Gran Maestre de la Orden: lo protege una barrera de sombra.
// El pulso de luz (o uno de sus orbes devuelto con el escudo) la rompe y deja a Vaelor expuesto al bastón.
class Vaelor {
  constructor(c, x, y, z, B) {
    this.c = c; this.pos = new THREE.Vector3(x, y, z); this.home = this.pos.clone(); this.arenaR = B.arenaR || 9;
    this.name = 'Vaelor, Gran Maestre'; this.phaseMsg = 'Vaelor: «¡Basta de juegos, niña!»';
    this.maxHp = 6; this.hp = 6; this.state = 'sleep'; this.t = 0; this.st = 0; this.phase = 1; this.flash = 0;
    this.facing = B.facing ?? 0; this.radius = 1.2; this.cycle = 0; this.barrier = true; this.exposedHits = 0; this.summoned = false;
    const g = this.group = new THREE.Group(); c.root.add(g);
    this.body = new THREE.Group(); g.add(this.body);
    this.ch = c.chars ? createCharacter(c.chars, 'vaelor') : null;
    if (this.ch) {
      this.body.add(this.ch.root);
      for (const a of Object.values(this.ch.actions)) { a.play(); a.timeScale = 0; a.setEffectiveWeight(0); }
      this.w = {}; this.cur = 'Idle'; this.oneShot = null;
      const hand = findBone(this.ch.model, 'handslotr');
      this.sword = buildDarkSword(); if (hand) { hand.add(this.sword); this.sword.rotation.y = Math.PI; }
      const head = this.ch.bones.head;
      if (head) { const helm = buildHelm(); head.add(helm); helm.position.set(0, 0.56, 0.02); helm.scale.setScalar(1.65); } // medido en el espacio del hueso de la cabeza
      // el modelo del caballero ya trae capa (recoloreada en LOOKS.vaelor)
    } else { // respaldo sin modelos
      mesh(new THREE.CylinderGeometry(0.5, 0.6, 2.2, 8), mat(0x3a2a4a), this.body, 0, 1.1, 0);
      mesh(new THREE.SphereGeometry(0.35, 10, 8), mat(0x5a4a6a), this.body, 0, 2.4, 0);
    }
    this.barrierMat = new THREE.MeshStandardMaterial({ color: 0x5a2aa8, emissive: 0x3a0a8a, emissiveIntensity: 0.9, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide });
    this.barrierMesh = mesh(new THREE.IcosahedronGeometry(1.9, 1), this.barrierMat, g, 0, 1.4, 0); this.barrierMesh.userData.noFlash = true; this.barrierMesh.castShadow = false;
    this.tele = new THREE.Mesh(new THREE.RingGeometry(0.4, 3.2, 32, 1, -Math.PI * 0.35, Math.PI * 0.7), new THREE.MeshBasicMaterial({ color: 0xff3a5a, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    this.tele.rotation.x = -Math.PI / 2; c.root.add(this.tele);
    this.reflectPos = new THREE.Vector3(); this.reflectRadius = 1.9;
    const self = this;
    this.weak = { radius: 1.0, pos: new THREE.Vector3(), get hittable() { return self.state === 'exposed' && self.exposedHits < 2; }, hit: () => self.wound() };
    this.weakPoints = [this.weak];
    this._place();
  }
  get alive() { return this.state !== 'dead'; }
  get fighting() { return !['sleep', 'intro', 'dying', 'dead'].includes(this.state); }
  wake() { if (this.state === 'sleep') { this.state = 'intro'; this.st = 1.6; this.c.audio.play('dark'); this.c.shake(0.4, 1.2); this._anim('Spellcast_Raise', { speed: 0.8 }); } }
  _anim(name, { speed = 1, hold = false } = {}) { if (!this.ch || !this.ch.actions[name]) return; this.oneShot = { name, t: 0, speed, hold, dur: this.ch.actions[name].getClip().duration }; }
  _animate(dt, moving) {
    if (!this.ch) return;
    const A = this.ch.actions, os = this.oneShot;
    let osW = 0;
    if (os) {
      os.t += dt * os.speed;
      const a = A[os.name]; a.time = Math.min(os.t, os.dur - 1e-3);
      osW = Math.min(1, os.t / 0.12, os.hold ? 1 : (os.dur - os.t) / 0.2);
      if (!os.hold && os.t >= os.dur) { a.setEffectiveWeight(0); this.oneShot = null; osW = 0; }
      else a.setEffectiveWeight(Math.max(0, osW));
    }
    const base = moving ? 'Walking_A' : 'Idle';
    A.Idle.time = (this.t * 0.8) % A.Idle.getClip().duration;
    A.Walking_A.time = (this.t * 0.9) % A.Walking_A.getClip().duration;
    for (const n of ['Idle', 'Walking_A']) {
      const want = (n === base ? 1 : 0) * (1 - osW);
      this.w[n] = (this.w[n] || 0) + (want - (this.w[n] || 0)) * damp(10, dt);
      A[n].setEffectiveWeight(this.w[n]);
    }
    restorePose(this.ch); this.ch.mixer.update(0.0001); savePose(this.ch);
    if (this.cape) this.cape.rotation.x = 0.12 + Math.sin(this.t * 2.3) * 0.06 + (moving ? 0.2 : 0);
  }
  _place() {
    this.group.position.copy(this.pos); this.body.rotation.y = this.facing;
    this.reflectPos.set(this.pos.x, this.pos.y + 1.4, this.pos.z);
    this.weak.pos.set(this.pos.x, this.pos.y + 1.2, this.pos.z);
    this.barrierMesh.visible = this.barrier && this.state !== 'dead';
  }
  update(dt, pl) {
    this.t += dt;
    if (this.flash > 0 && (this.flash -= dt) <= 0) setFlash(this.body, false);
    const dx = pl.pos.x - this.pos.x, dz = pl.pos.z - this.pos.z, dist = Math.hypot(dx, dz);
    const toP = Math.atan2(-dx, -dz);
    let moving = false;
    this.barrierMat.emissiveIntensity = 0.9 + Math.sin(this.t * 4) * 0.3; this.barrierMesh.rotation.y += dt * 0.5;
    switch (this.state) {
      case 'sleep': this.facing = toP; break;
      case 'intro': this.st -= dt; this.facing += angDiff(toP, this.facing) * damp(4, dt); if (this.st <= 0) { this.state = 'idle'; this.st = 1.2; } break;
      case 'idle': {
        this.facing += angDiff(toP, this.facing) * damp(5, dt);
        if (dist > 5.5) { const sp = 2.2; this.pos.x -= Math.sin(this.facing) * sp * dt; this.pos.z -= Math.cos(this.facing) * sp * dt; moving = true; }
        this.st -= dt;
        if (this.st <= 0) {
          this.cycle++;
          if (dist < 3.6) { this.state = 'windup'; this.st = 0.8; this._anim('1H_Melee_Attack_Chop', { speed: 0.45, hold: true }); this.c.audio.play('windup'); }
          else if (this.cycle % 4 === 0) { this.state = 'vanish'; this.st = 0.5; this.c.audio.play('dark'); }
          else { this.state = 'cast'; this.st = 0.9; this.shots = this.shotsTotal = this.phase === 1 ? 1 : 3; this._anim('Spellcast_Raise', { speed: 1.2 }); this.c.audio.play('windup'); }
          if (this.phase === 2 && !this.summoned) { this.summoned = true; for (let i = 0; i < 2; i++) { const a = i * Math.PI + 0.7; const e = this.c.addEnemy('sombra', this.home.x + Math.cos(a) * 5, this.pos.y + 0.3, this.home.z + Math.sin(a) * 5); e.summoned = true; this.c.fx.dust(e.pos, 10, 1.2, 0xb07aff); } }
        }
        break;
      }
      case 'cast':
        this.facing += angDiff(toP, this.facing) * damp(6, dt);
        this.st -= dt;
        if (this.st <= 0 && this.shots > 0) {
          this.shots--; this.st = 0.4;
          const from = this.pos.clone().add(new THREE.Vector3(-Math.sin(this.facing) * 1.0, 1.9, -Math.cos(this.facing) * 1.0));
          const idx = (this.shotsTotal || 1) - 1 - this.shots, off = [0, -1.6, 1.6][idx] || 0;
          const tgt = pl.pos.clone().setY(pl.pos.y + 0.9).add(new THREE.Vector3(off * Math.cos(this.facing), 0, -off * Math.sin(this.facing)));
          this.c.shoot(from, tgt, this.phase === 1 ? 8.5 : 10, 0xb07aff, this, 0.3);
          this.c.audio.play('dark');
        } else if (this.st <= 0) { this.state = 'idle'; this.st = this.phase === 1 ? 1.8 : 1.2; }
        break;
      case 'windup': {
        this.st -= dt;
        const fx = -Math.sin(this.facing), fz = -Math.cos(this.facing);
        this.tele.position.set(this.pos.x, this.pos.y + 0.06, this.pos.z); this.tele.rotation.z = this.facing + Math.PI / 2;
        this.tele.material.opacity = 0.25 + Math.sin(this.t * 20) * 0.15;
        if (this.sword) this.sword.userData.blade.emissiveIntensity = 2.5;
        if (this.st <= 0) {
          this.tele.material.opacity = 0; this.state = 'swing'; this.st = 0.5;
          if (this.oneShot) { this.oneShot.speed = 2.2; this.oneShot.hold = false; }
          this.c.audio.play('swing'); this.c.shake(0.3, 0.2);
          const rel = (dx * fx + dz * fz) / Math.max(dist, 0.01);
          if (dist < 3.4 && rel > 0.2 && Math.abs(pl.pos.y - this.pos.y) < 1.6) pl.damage(1, this.pos);
        }
        break;
      }
      case 'swing': this.st -= dt; if (this.sword) this.sword.userData.blade.emissiveIntensity = 0.8; if (this.st <= 0) { this.state = 'idle'; this.st = 1.0; } break;
      case 'vanish':
        this.st -= dt; this.body.scale.setScalar(Math.max(0.05, this.st / 0.5)); this.barrierMesh.scale.setScalar(Math.max(0.05, this.st / 0.5));
        if (this.st <= 0) {
          const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * (this.arenaR - 4);
          this.pos.set(this.home.x + Math.cos(a) * r, this.pos.y, this.home.z + Math.sin(a) * r);
          this.state = 'appear'; this.st = 0.5; this.c.fx.sparkle(this.pos.clone().setY(this.pos.y + 1.2), 20, 0xb07aff);
        }
        break;
      case 'appear':
        this.st -= dt; const k = 1 - Math.max(0, this.st / 0.5); this.body.scale.setScalar(Math.max(0.05, k)); this.barrierMesh.scale.setScalar(Math.max(0.05, k));
        if (this.st <= 0) { this.body.scale.setScalar(1); this.barrierMesh.scale.setScalar(1); this.state = 'cast'; this.st = 0.5; this.shots = this.shotsTotal = this.phase === 1 ? 2 : 3; this._anim('Spellcast_Raise', { speed: 1.4 }); }
        break;
      case 'exposed':
        this.st -= dt;
        if (this.st <= 0 || this.exposedHits >= 2) { this.barrier = true; this.state = 'idle'; this.st = 0.8; this.c.audio.play('dark'); this.oneShot = null; }
        break;
      case 'dying':
        this.st -= dt; this.body.position.y = -(2.6 - this.st) * 0.15;
        if (Math.random() < 0.5) this.c.fx.sparkle(this.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 2.5, (Math.random() - 0.5) * 2)), 4, 0xb07aff);
        if (this.st <= 0) { this.state = 'dead'; this.c.root.remove(this.group); this.c.root.remove(this.tele); this.c.onBossDefeated && this.c.onBossDefeated(this); }
        break;
    }
    // mantenerse dentro de la arena
    const hx = this.pos.x - this.home.x, hz = this.pos.z - this.home.z, hl = Math.hypot(hx, hz);
    if (hl > this.arenaR - 1.5) { this.pos.x = this.home.x + hx / hl * (this.arenaR - 1.5); this.pos.z = this.home.z + hz / hl * (this.arenaR - 1.5); }
    this._animate(dt, moving);
    if (this.state !== 'dead') this._place();
  }
  _breakBarrier() {
    if (!this.barrier || !this.fighting || this.state === 'exposed') return false;
    this.barrier = false; this.state = 'exposed'; this.st = 3.6; this.exposedHits = 0;
    this.tele.material.opacity = 0; if (this.sword) this.sword.userData.blade.emissiveIntensity = 0.8;
    this.c.audio.play('shatter'); this.c.shake(0.4, 0.4); this.c.fx.sparkle(this.reflectPos, 30, 0xfff2a8);
    this._anim('Hit_A', { speed: 0.6, hold: true });
    this.c.onBossStun && this.c.onBossStun();
    return true;
  }
  pulseHit() { this._breakBarrier(); }
  reflectHit() { if (!this._breakBarrier() && this.state === 'exposed') this.wound(); }
  wound() {
    if (this.state !== 'exposed') return false;
    this.hp -= 1; this.exposedHits++; this.flash = 0.15; setFlash(this.body, true);
    this.c.audio.play('hit'); this.c.shake(0.3, 0.3); this.c.fx.sparkle(this.weak.pos, 14, 0xb07aff);
    if (this.hp <= this.maxHp / 2 && this.phase === 1) { this.phase = 2; this.c.onBossPhase && this.c.onBossPhase(this); }
    if (this.hp <= 0) {
      this.state = 'dying'; this.st = 2.6; this.barrier = false; this.c.shake(0.6, 2);
      this._anim('Death_A', { speed: 0.7, hold: true });
      for (const e of this.c.enemies) if (e.summoned && e.alive) e.die();
    }
    return true;
  }
  clang() { this.c.audio.play('dark'); this.c.onBossClang && this.c.onBossClang(); }
  dispose() { this.c.root.remove(this.tele); }
}

const findBone = (root, name) => { let b = null; root.traverse(o => { if (!b && o.isBone && o.name === name) b = o; }); return b; };
function buildDarkSword() {
  const g = new THREE.Group();
  const blade = new THREE.MeshStandardMaterial({ color: 0x2a1a3a, emissive: 0x8a3aff, emissiveIntensity: 0.8, metalness: 0.7, roughness: 0.25, flatShading: true });
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.03), blade); b.position.y = 0.95; g.add(b);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.25, 4), blade); tip.position.y = 1.82; g.add(tip);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.08), mat(0xd4a24c, { metalness: 0.7 })); guard.position.y = 0.2; g.add(guard);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6), mat(0x2a1a1a)); grip.position.y = 0.03; g.add(grip);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.userData.blade = blade;
  return g;
}
function buildHelm() {
  const g = new THREE.Group(), dark = mat(0x2a2235, { metalness: 0.6, roughness: 0.4, flatShading: true }), gold = mat(0xd4a24c, { metalness: 0.7, roughness: 0.3 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.8), dark); g.add(dome);
  for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 4), gold); s.position.set((i - 2) * 0.12, 0.42 - Math.abs(i - 2) * 0.05, 0.1); g.add(s); }
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.05), new THREE.MeshStandardMaterial({ color: 0xff3a5a, emissive: 0xff2a4a, emissiveIntensity: 1.5 })); visor.position.set(0, 0.05, 0.38); g.add(visor);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
function buildCape() {
  const g = new THREE.Group();
  const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.3, 1, 4), new THREE.MeshStandardMaterial({ color: 0x4a1a3a, roughness: 0.8, side: THREE.DoubleSide }));
  cape.position.y = -0.65; g.add(cape); cape.castShadow = true;
  return g;
}

// ---------------------------------------------------------------------------------
export class Combat {
  constructor(scene, physics, fx, audio) {
    this.scene = scene; this.physics = physics; this.fx = fx; this.audio = audio;
    this.root = new THREE.Group(); scene.add(this.root);
    this.enemies = []; this.projectiles = []; this.heals = []; this.slashes = [];
    this.boss = null; this.voidY = -30;
    this.shakeAmt = 0; this.shakeT = 0; this.hitstop = 0;
  }
  clear() {
    if (this.boss) this.boss.dispose();
    this.root.clear(); this.enemies = []; this.projectiles = []; this.heals = []; this.slashes = []; this.boss = null;
  }
  spawnZone(zone, save) {
    this.clear();
    this.voidY = zone.water ? zone.water.y : -30;
    for (const e of zone.enemies || []) this.addEnemy(e.type, e.x, e.y || 0, e.z);
    if (zone.boss && !save.flags[zone.boss.flag]) {
      const B = zone.boss, K = { raiz: RaizMadre, escorpion: Escorpion, coloso: Coloso, sierpe: Sierpe, vaelor: Vaelor }[B.type] || RaizMadre;
      this.boss = new K(this, B.x, B.y, B.z, B);
      const k = DIFF[this.difficulty || 'normal'].bossHp; // vida del jefe según la dificultad
      if (k !== 1) this.boss.maxHp = this.boss.hp = Math.max(3, Math.round(this.boss.maxHp * k));
    }
  }
  addEnemy(type, x, y, z) {
    const e = ESPORA_LOOKS[type] ? new Espora(this, x, y, z, type) : new Brote(this, x, y, z, type);
    this.enemies.push(e); return e;
  }
  shake(amount, time) { this.shakeAmt = Math.max(this.shakeAmt, amount); this.shakeT = Math.max(this.shakeT, time); }

  shoot(from, to, speed, color = 0xf29bff, owner = null, size = 0.2) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 1), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.5 }));
    m.position.copy(from); this.root.add(m);
    const v = to.clone().sub(from).normalize().multiplyScalar(speed);
    const p = { m, v, life: 4.5, pos: m.position, radius: 0.3 + (size - 0.2), owner, color };
    this.projectiles.push(p);
    this.audio.play('shoot');
    return p;
  }
  // El escudo devuelve el proyectil hacia donde apunta Lía: su lanzador o una cerradura de hielo que esté delante.
  reflect(p, pl) {
    p.reflected = true; p.life = 3;
    const fx = -Math.sin(pl.facing), fz = -Math.cos(pl.facing);
    const cands = [];
    if (p.owner && p.owner.alive !== false) cands.push({ get: () => this._targetPos(p.owner) });
    if (this.world) for (const L of this.world.locks) if (!L.open) cands.push({ get: () => L.pos });
    let best = null, bd = 0.72;
    for (const c of cands) {
      const t = c.get(); if (!t) continue;
      const dx = t.x - pl.pos.x, dz = t.z - pl.pos.z, l = Math.hypot(dx, dz);
      if (l > 26) continue;
      const dot = l < 1 ? 1 : (dx * fx + dz * fz) / l;
      if (dot > bd) { bd = dot; best = c; }
    }
    p.homing = best ? best.get : null;
    const dir = best ? best.get().clone().sub(p.pos).normalize() : new THREE.Vector3(fx, 0.05, fz).normalize();
    p.v.copy(dir).multiplyScalar(Math.max(13, p.v.length() * 1.6));
    p.m.material = new THREE.MeshStandardMaterial({ color: 0xe8fbff, emissive: 0x7ae8ff, emissiveIntensity: 2.2 });
    this.audio.play('reflect'); this.fx.ring(p.pos.clone(), 0xbff4ff);
    pl.shieldFlash = 1;
  }
  _targetPos(o) {
    if (!o || o.alive === false) return null;
    if (o.reflectPos) return o.reflectPos;
    return o.pos.clone().setY(o.pos.y + 1.0);
  }
  // Pulso de luz: aturde y deshace auras, destruye proyectiles y afecta al jefe.
  pulse(pos, r) {
    let n = 0;
    for (const e of this.enemies) {
      if (!e.alive || e.pos.distanceTo(pos) > r) continue;
      n++;
      if (e.dispel) e.dispel();
      e.state = 'stagger'; e.stagger = 1.4; e.hp -= 1; e.flash = 0.12; setFlash(e.group, true);
      if (e.hp <= 0) e.die();
    }
    for (const p of this.projectiles) if (!p.reflected && p.pos.distanceTo(pos) < r) { p.life = 0; this.fx.sparkle(p.pos, 6, 0xfff2a8); }
    if (this.boss && this.boss.pulseHit && this.boss.fighting && this.boss.pos.distanceTo(pos) < r + (this.boss.radius || 1)) this.boss.pulseHit();
    return n;
  }
  spawnHeal(x, y, z) {
    const g = new THREE.Group(); g.position.set(x, y + 0.6, z); this.root.add(g);
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), new THREE.MeshStandardMaterial({ color: 0x9cff8a, emissive: 0x3acf3a, emissiveIntensity: 1.2, flatShading: true }));
    g.add(m);
    this.heals.push({ g, m, t: 0, pos: g.position });
  }
  slash(pl, def) {
    const geo = new THREE.RingGeometry(0.9, 1.75, 20, 1, Math.PI * 0.15, Math.PI * 0.7);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xcff8ff, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.position.set(pl.pos.x, pl.pos.y + 0.85, pl.pos.z);
    m.rotation.order = 'YXZ'; m.rotation.y = pl.facing; m.rotation.x = -Math.PI / 2; m.rotation.z = def.arc + Math.PI;
    if (def.arc === 0) { m.rotation.x = 0; m.rotation.z = Math.PI / 2; } // golpe vertical
    this.root.add(m);
    this.slashes.push({ m, t: 0 });
  }

  // lista de objetivos para el apuntado automático
  get targets() {
    const t = this.enemies.filter(e => e.alive);
    if (this.boss && this.boss.fighting) {
      if (this.boss.roots) for (const r of this.boss.roots) if (r.hittable) t.push(r);
      if (this.boss.weakPoints) for (const w of this.boss.weakPoints) if (w.hittable) t.push(w);
    }
    return t;
  }
  get grapplePoints() { return (this.boss && this.boss.grapplePoints) || []; }

  // procesa los eventos de ataque de Lía
  handlePlayer(pl) {
    for (const ev of pl.events) {
      if (ev.type === 'swing') this.slash(pl, ev.def);
      if (ev.type !== 'hitcheck') continue;
      const fx = -Math.sin(pl.facing), fz = -Math.cos(pl.facing);
      const inArc = (p, r) => {
        const dx = p.x - pl.pos.x, dz = p.z - pl.pos.z, d = Math.hypot(dx, dz);
        if (d > ev.range + r || Math.abs(p.y - pl.pos.y) > 1.9) return false;
        if (d < r + 0.3) return true;
        return Math.acos(clamp((dx * fx + dz * fz) / d, -1, 1)) < ev.angle;
      };
      let hit = false;
      for (const e of this.enemies) {
        if (!e.alive || ev.hitList.has(e) || !inArc(e.pos, e.radius)) continue;
        ev.hitList.add(e); e.hurt(ev.def.dmg, pl.pos, ev.def.push); hit = true;
        this.fx.sparkle(e.pos.clone().setY(e.pos.y + 0.6), 8, 0xffffff);
      }
      for (const p of this.projectiles) {
        if (p.life <= 0 || ev.hitList.has(p) || !inArc(p.pos, 0.5)) continue;
        ev.hitList.add(p); p.life = 0; this.fx.sparkle(p.pos, 8, 0xf29bff); this.audio.play('crystal'); hit = true;
      }
      if (this.boss && this.boss.fighting) {
        let weakHit = false;
        for (const r of this.boss.roots || []) {
          if (ev.hitList.has(r) || !r.hittable || !inArc(r.pos, r.radius)) continue;
          ev.hitList.add(r); if (r.hitKnot(pl.pos)) { hit = true; weakHit = true; }
        }
        for (const w of this.boss.weakPoints || []) {
          if (ev.hitList.has(w) || !w.hittable || !inArc(w.pos, w.radius)) continue;
          ev.hitList.add(w); if (w.hit(pl.pos)) { hit = true; weakHit = true; }
        }
        if (!weakHit && !ev.hitList.has(this.boss) && inArc(this.boss.pos, this.boss.radius)) { ev.hitList.add(this.boss); this.boss.clang(); this.hitstop = 0.04; }
      }
      if (hit) { this.hitstop = Math.max(this.hitstop, ev.def.dmg > 1 ? 0.09 : 0.06); this.shake(ev.def.dmg > 1 ? 0.18 : 0.1, 0.12); }
    }
    pl.events = pl.events.filter(e => e.type === 'hurt' || e.type === 'dead' || e.type === 'airdash' || e.type === 'pulse' || e.type === 'block');
  }

  update(dt, pl) {
    for (const e of this.enemies) e.update(dt, pl);
    this.enemies = this.enemies.filter(e => e.alive);
    if (this.boss) this.boss.update(dt, pl);
    // proyectiles
    for (const p of this.projectiles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.reflected) { // se guía hacia su objetivo
        const tgt = p.homing && p.homing();
        if (tgt) { const want = tgt.clone().sub(p.pos).normalize().multiplyScalar(p.v.length()); p.v.lerp(want, damp(7, dt)); }
      }
      p.pos.addScaledVector(p.v, dt); p.m.rotation.x += dt * 5;
      if (!p.reflected) {
        const d = p.pos.distanceTo(new THREE.Vector3(pl.pos.x, pl.pos.y + 0.9, pl.pos.z));
        if (pl.shielding && d < 1.35 + p.radius && pl.blocks(p.pos)) this.reflect(p, pl);
        else if (d < 0.55 + p.radius && pl.damage(1, p.pos)) p.life = 0;
      } else {
        for (const e of this.enemies) if (e.alive && p.pos.distanceTo(e.pos.clone().setY(e.pos.y + 0.7)) < e.radius + p.radius + 0.2) { if (e.dispel) e.dispel(); e.hurt(2, p.pos, 5); p.life = 0; break; }
        const b = this.boss;
        if (p.life > 0 && b && b.reflectHit && b.fighting && b.reflectPos && p.pos.distanceTo(b.reflectPos) < (b.reflectRadius || 1.4)) { b.reflectHit(); p.life = 0; this.fx.sparkle(p.pos, 20, 0xbff4ff); }
        if (p.life > 0 && this.world) for (const L of this.world.locks) if (!L.open && p.pos.distanceTo(L.pos) < 1.1) { p.life = 0; this.onLockHit && this.onLockHit(L); break; }
      }
      p.age = (p.age || 0) + dt;
      if (p.life > 0 && p.age > 0.2 && this.physics.groundAt(p.pos.x, p.pos.z, 0.1, p.pos.y).y > p.pos.y - 0.05) p.life = 0;
      if (p.life <= 0) { this.root.remove(p.m); this.fx.sparkle(p.pos, 6, p.reflected ? 0xbff4ff : (p.color || 0xf29bff)); }
    }
    this.projectiles = this.projectiles.filter(p => p.life > 0);
    // curaciones
    for (const h of this.heals) {
      h.t += dt; h.m.rotation.y += dt * 3; h.m.position.y = Math.sin(h.t * 3) * 0.1;
      const d = Math.hypot(pl.pos.x - h.pos.x, pl.pos.z - h.pos.z);
      if (d < 3 && pl.hp < pl.maxHp) h.pos.lerp(new THREE.Vector3(pl.pos.x, pl.pos.y + 0.7, pl.pos.z), damp(4, dt)); // se acercan solas
      if (d < 0.8 && Math.abs(pl.pos.y + 0.6 - h.pos.y) < 1.2 && pl.hp < pl.maxHp) { pl.heal(1); h.done = true; this.root.remove(h.g); this.audio.play('heal'); this.fx.sparkle(h.pos, 10, 0x9cff8a); this.onHeal && this.onHeal(); }
      if (h.t > 20) { h.done = true; this.root.remove(h.g); }
    }
    this.heals = this.heals.filter(h => !h.done);
    // arcos de golpe
    for (const s of this.slashes) { s.t += dt; s.m.material.opacity = 0.75 * (1 - s.t / 0.16); s.m.scale.setScalar(1 + s.t * 1.5); if (s.t > 0.16) { this.root.remove(s.m); s.done = true; } }
    this.slashes = this.slashes.filter(s => !s.done);
    if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) this.shakeAmt = 0; }
  }
}
