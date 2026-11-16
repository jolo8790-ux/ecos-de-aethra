import * as THREE from 'three';

// Combate: criaturas de cristal, proyectiles, curaciones y el jefe Raíz Madre.
// Todas las criaturas avisan antes de atacar (brillo rojo y temblor) para que el jugador pueda esquivar.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (k, dt) => 1 - Math.exp(-k * dt);
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const mats = {};
const mat = (c, o = {}) => { const k = c + JSON.stringify(o); return mats[k] || (mats[k] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o })); };
const WHITE = new THREE.MeshBasicMaterial({ color: 0xffffff });

function mesh(geo, m, parent, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; }

// Destello blanco al recibir un golpe: cambia temporalmente los materiales.
function setFlash(group, on) {
  group.traverse(o => {
    if (!o.isMesh || o.userData.noFlash) return;
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
class Brote extends Enemy {
  constructor(c, x, y, z) {
    super(c, x, y, z);
    this.hp = 3; this.color = 0x7ff0d8; this.cd = 1;
    const g = this.body = new THREE.Group(); this.group.add(g);
    mesh(new THREE.DodecahedronGeometry(0.48, 0), mat(0x6b5a4a, { flatShading: true }), g, 0, 0.42, 0).scale.set(1, 0.8, 1);
    this.crystalMat = new THREE.MeshStandardMaterial({ color: 0x7ff0d8, emissive: 0x1a8f7a, emissiveIntensity: 0.6, roughness: 0.25, flatShading: true });
    [[0, 0.95, 0, 0.18, 0.7, 0], [0.22, 0.82, 0.1, 0.12, 0.45, -0.5], [-0.22, 0.8, 0.05, 0.12, 0.5, 0.5], [0.05, 0.78, 0.25, 0.1, 0.35, 0.3]].forEach(([x1, y1, z1, r, h, rz]) => {
      const s = mesh(new THREE.ConeGeometry(r, h, 5), this.crystalMat, g, x1, y1, z1); s.rotation.z = rz;
    });
    const eye = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
    this.eyes = [-0.15, 0.15].map(ex => { const e = mesh(new THREE.SphereGeometry(0.07, 8, 6), eye, g, ex, 0.5, -0.4); e.userData.noFlash = true; return e; });
    [-0.22, 0.22].forEach(lx => mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.22, 6), mat(0x4a3a2e), g, lx, 0.1, 0));
    this.mark = mesh(new THREE.ConeGeometry(0.12, 0.35, 4), new THREE.MeshBasicMaterial({ color: 0xff5a4a }), this.group, 0, 1.7, 0);
    this.mark.rotation.x = Math.PI; this.mark.visible = false; this.mark.userData.noFlash = true;
  }
  update(dt, pl) {
    if (!this.alive) return;
    this.t += dt; this.cd -= dt; this.updateFlash(dt);
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
    this.crystalMat.emissiveIntensity += (glow - this.crystalMat.emissiveIntensity) * damp(10, dt);
    this.crystalMat.emissive.setHex(this.state === 'windup' || this.state === 'lunge' ? 0xff3a2a : 0x1a8f7a);
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
  constructor(c, x, y, z) {
    super(c, x, y, z);
    this.hp = 2; this.color = 0xf29bff; this.cd = 1.5 + Math.random();
    mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.9, 7), mat(0x4f7a3a), this.group, 0, 0.45, 0);
    this.head = new THREE.Group(); this.head.position.y = 1.0; this.group.add(this.head);
    this.coreMat = new THREE.MeshStandardMaterial({ color: 0xf29bff, emissive: 0x9a2aa8, emissiveIntensity: 0.8, roughness: 0.3 });
    this.core = mesh(new THREE.SphereGeometry(0.22, 12, 10), this.coreMat, this.head);
    this.petals = [];
    for (let i = 0; i < 5; i++) {
      const pv = new THREE.Group(); pv.rotation.y = (i / 5) * Math.PI * 2; this.head.add(pv);
      const p = mesh(new THREE.ConeGeometry(0.16, 0.6, 4), mat(0xc79bff, { flatShading: true, emissive: 0x3a1a5a, emissiveIntensity: 0.4 }), pv, 0, 0.2, 0.12);
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
    if (dist < 13 && Math.abs(pl.pos.y - this.pos.y) < 6 && pl.hp > 0) {
      this.cd -= dt;
      this.head.rotation.y += angDiff(Math.atan2(-(pl.pos.x - this.pos.x), -(pl.pos.z - this.pos.z)), this.head.rotation.y) * damp(4, dt);
      if (this.cd < 0.6) { open = 1 - this.cd / 0.6; if (!this.warned) { this.warned = true; this.c.audio.play('windup'); } }
      if (this.cd <= 0) {
        const from = this.pos.clone().setY(this.pos.y + 1.05);
        this.c.shoot(from, head, 7.5);
        this.cd = 2.6; this.warned = false;
      }
    }
    this.petals.forEach(p => { p.rotation.x = -0.4 - open * 0.9; });
    this.coreMat.emissiveIntensity = 0.8 + open * 2.5;
    this.coreMat.emissive.setHex(open > 0 ? 0xff3aa8 : 0x9a2aa8);
    this.group.position.copy(this.pos);
    this.head.position.y = 1.0 + Math.sin(this.t * 2) * 0.04;
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
    this.roots = []; this.flash = 0; this.summonCd = 8; this.name = 'Raíz Madre';
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
  }
  get alive() { return this.state !== 'dead'; }
  wake() { if (this.state === 'sleep') { this.state = 'intro'; this.st = 2.2; this.c.audio.play('roar'); this.c.shake(0.6, 2); } }

  update(dt, pl) {
    this.t += dt;
    if (this.flash > 0 && (this.flash -= dt) <= 0) setFlash(this.group, false);
    const breathe = Math.sin(this.t * 1.5) * 0.04;
    this.trunk.scale.set(1 + breathe, 1 - breathe * 0.5, 1 + breathe);
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
    if (zone.boss && !save.flags[zone.boss.flag]) this.boss = new RaizMadre(this, zone.boss.x, zone.boss.y, zone.boss.z);
  }
  addEnemy(type, x, y, z) {
    const e = type === 'espora' ? new Espora(this, x, y, z) : new Brote(this, x, y, z);
    this.enemies.push(e); return e;
  }
  shake(amount, time) { this.shakeAmt = Math.max(this.shakeAmt, amount); this.shakeT = Math.max(this.shakeT, time); }

  shoot(from, to, speed) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), new THREE.MeshStandardMaterial({ color: 0xf29bff, emissive: 0xff3aa8, emissiveIntensity: 1.5 }));
    m.position.copy(from); this.root.add(m);
    const v = to.clone().sub(from).normalize().multiplyScalar(speed);
    this.projectiles.push({ m, v, life: 4, pos: m.position, radius: 0.3 });
    this.audio.play('shoot');
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
    if (this.boss && this.boss.state === 'fight') for (const r of this.boss.roots) if (r.hittable) t.push(r);
    return t;
  }

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
      if (this.boss && this.boss.state === 'fight') {
        for (const r of this.boss.roots) {
          if (ev.hitList.has(r) || !r.hittable || !inArc(r.pos, r.radius)) continue;
          ev.hitList.add(r); if (r.hitKnot(pl.pos)) hit = true;
        }
        if (!ev.hitList.has(this.boss) && inArc(this.boss.pos, this.boss.radius)) { ev.hitList.add(this.boss); this.boss.clang(); this.hitstop = 0.04; }
      }
      if (hit) { this.hitstop = Math.max(this.hitstop, ev.def.dmg > 1 ? 0.09 : 0.06); this.shake(ev.def.dmg > 1 ? 0.18 : 0.1, 0.12); }
    }
    pl.events = pl.events.filter(e => e.type === 'hurt' || e.type === 'dead' || e.type === 'airdash');
  }

  update(dt, pl) {
    for (const e of this.enemies) e.update(dt, pl);
    this.enemies = this.enemies.filter(e => e.alive);
    if (this.boss) this.boss.update(dt, pl);
    // proyectiles
    for (const p of this.projectiles) {
      if (p.life <= 0) continue;
      p.life -= dt; p.pos.addScaledVector(p.v, dt); p.m.rotation.x += dt * 5;
      const d = p.pos.distanceTo(new THREE.Vector3(pl.pos.x, pl.pos.y + 0.9, pl.pos.z));
      if (d < 0.65 && pl.damage(1, p.pos)) p.life = 0;
      if (this.physics.groundAt(p.pos.x, p.pos.z, 0.1, p.pos.y).y > p.pos.y - 0.05) p.life = 0;
      if (p.life <= 0) { this.root.remove(p.m); this.fx.sparkle(p.pos, 6, 0xf29bff); }
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
