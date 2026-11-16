import * as THREE from 'three';
import { STEP_HEIGHT } from './physics.js';
import { buildHumanoid, HeroAnimator } from './rig.js';
import { createCharacter, HeroModelAnimator } from './characters.js';

export const RADIUS = 0.35, HEIGHT = 1.55;
const RUN = 6.6, WALK = 2.6, ACCEL = 40, AIR_ACCEL = 16, GRAVITY = 28, JUMP_V = 10, DOUBLE_JUMP_V = 9;
const COYOTE = 0.12, BUFFER = 0.14, SNAP_DOWN = 0.45;

// Combo del bastón: animación, duración relativa de la ventana de golpe y daño.
const COMBO = [
  { anim: '1H_Melee_Attack_Slice_Diagonal', speed: 1.7, hit: [0.22, 0.5], dmg: 1, push: 4, lunge: 3.5, arc: -0.6 },
  { anim: '1H_Melee_Attack_Slice_Horizontal', speed: 1.7, hit: [0.22, 0.5], dmg: 1, push: 4, lunge: 3.5, arc: 0.6 },
  { anim: '1H_Melee_Attack_Chop', speed: 1.5, hit: [0.3, 0.55], dmg: 2, push: 9, lunge: 4.5, arc: 0 },
];
const ATTACK_RANGE = 1.9, ATTACK_ANGLE = 1.25;

export class Player {
  constructor(scene, physics, audio, fx) {
    this.physics = physics; this.audio = audio; this.fx = fx;
    this.rig = buildHumanoid({ scarf: 0xf2b134, bag: 0x9c6b3e, hairStyle: 'ponytail', scale: 0.93 });
    this.mesh = this.rig.root; scene.add(this.mesh);
    this.anim = new HeroAnimator(this.rig);
    this.lookAt = null;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.facing = Math.PI; this.grounded = false; this.ground = null;
    this.coyote = 0; this.buffer = 0; this.jumps = 0; this.airTime = 0;
    this.frozen = false; this.visY = 0;

    // combate
    this.maxHp = 4; this.hp = 4; this.invuln = 0; this.hurtT = 0;
    this.canFight = false; this.canAirDash = false;
    this.attack = null; this.attackQueued = false; this.attackCd = 0;
    this.dodge = null; this.dodgeCd = 0; this.airDashUsed = false;
    this.events = [];            // eventos para main (golpes, daño, muerte)

    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.25, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; scene.add(this.shadow);
    this.staff = null;
  }

  // Cambia el personaje hecho con formas por el modelo animado (cuando termina de cargar).
  useModel(lib) {
    const scene = this.mesh.parent;
    const ch = createCharacter(lib, 'lia');
    scene.remove(this.mesh); scene.add(ch.root);
    this.ch = ch; this.mesh = ch.root; this.anim = new HeroModelAnimator(ch);
    this.staff = buildStaff();
    const hand = findBone(ch.model, 'handslotr') || findBone(ch.model, 'handr');
    if (hand) { hand.add(this.staff); this.staff.rotation.y = Math.PI; } // igual que las armas originales del paquete
    this.staff.visible = this.canFight;
  }
  gesture(name, opts) { if (this.anim.gesture) this.anim.gesture(name, opts); }
  setFight(on) { this.canFight = on; if (this.staff) this.staff.visible = on; }

  teleport(x, y, z, facing = this.facing) {
    this.pos.set(x, y, z); this.vel.set(0, 0, 0); this.facing = facing; this.visY = y;
    this.grounded = false; this.jumps = 0; this.attack = null; this.dodge = null;
  }

  heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }

  // Recibir daño: devuelve true si hizo efecto.
  damage(amount, from) {
    if (this.invuln > 0 || (this.dodge && this.dodge.t < this.dodge.iframes) || this.hp <= 0) return false;
    this.hp -= amount; this.invuln = 1.1; this.hurtT = 0.35;
    const dx = this.pos.x - from.x, dz = this.pos.z - from.z, l = Math.hypot(dx, dz) || 1;
    this.vel.x = dx / l * 7; this.vel.z = dz / l * 7; this.vel.y = 5; this.grounded = false;
    this.attack = null;
    this.audio.play('hurt');
    if (this.anim.gesture) this.anim.gesture('Hit_A', { speed: 1.6, fadeIn: 0.03, fadeOut: 0.2 });
    this.events.push({ type: 'hurt', amount });
    if (this.hp <= 0) this.events.push({ type: 'dead' });
    return true;
  }

  update(dt, input, camYaw, targets = []) {
    const P = this.physics;
    this._landed = false; this._landSpeed = 0; this._dj = false; this._jumped = false;
    this.invuln = Math.max(0, this.invuln - dt); this.hurtT = Math.max(0, this.hurtT - dt);
    this.attackCd -= dt; this.dodgeCd -= dt;
    let mx = 0, my = 0;
    const locked = this.frozen || this.hurtT > 0;
    if (!locked) { mx = input.move.x; my = input.move.y; }
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    let dirX = fx * my + rx * mx, dirZ = fz * my + rz * mx;

    // ---- ataques ----
    if (!locked && this.canFight && input.pressed('attack')) {
      if (this.attack && this.attack.t > this.attack.dur * 0.35) this.attackQueued = true;
      else if (!this.attack && !this.dodge && this.attackCd <= 0) this._startAttack(0, targets, dirX, dirZ);
    }
    if (this.attack) {
      const A = this.attack;
      A.t += dt;
      const k = A.t / A.dur;
      if (k >= A.def.hit[0] && k <= A.def.hit[1] && !A.swung) { A.swung = true; this.events.push({ type: 'swing', def: A.def, idx: A.idx, hitList: A.hits }); this.audio.play('swing'); }
      if (A.swung && k <= A.def.hit[1]) this.events.push({ type: 'hitcheck', def: A.def, hitList: A.hits, range: ATTACK_RANGE, angle: ATTACK_ANGLE });
      if (k > 0.62 && this.attackQueued && A.idx < COMBO.length - 1) { this.attackQueued = false; this._startAttack(A.idx + 1, targets, dirX, dirZ); }
      else if (k >= 1) { this.attack = null; this.attackQueued = false; this.attackCd = A.idx === COMBO.length - 1 ? 0.35 : 0.1; }
    }

    // ---- esquiva / impulso aéreo ----
    if (!locked && input.pressed('dodge') && !this.dodge && this.dodgeCd <= 0) {
      let dx = dirX, dz = dirZ;
      if (Math.hypot(dx, dz) < 0.2) { dx = -Math.sin(this.facing); dz = -Math.cos(this.facing); }
      const l = Math.hypot(dx, dz); dx /= l; dz /= l;
      if (this.grounded) {
        this.dodge = { t: 0, dur: 0.38, iframes: 0.32, dx, dz, speed: 11, air: false };
        this.attack = null; this.facing = Math.atan2(-dx, -dz);
        this.anim.gesture && this.anim.gesture('Dodge_Forward', { speed: 1.25, fadeIn: 0.04, fadeOut: 0.15 });
        this.audio.play('dodge'); this.fx && this.fx.dust(this.pos, 6, 0.8);
      } else if (this.canAirDash && !this.airDashUsed) {
        this.airDashUsed = true;
        this.dodge = { t: 0, dur: 0.26, iframes: 0.2, dx, dz, speed: 14, air: true };
        this.facing = Math.atan2(-dx, -dz); this.vel.y = Math.max(this.vel.y, 1.5);
        this.anim.gesture && this.anim.gesture('Dodge_Forward', { speed: 1.6, fadeIn: 0.03, fadeOut: 0.12 });
        this.audio.play('dash'); this.fx && this.fx.ring(this.pos.clone().setY(this.pos.y + 0.8), 0xbff6ff);
        this.events.push({ type: 'airdash' });
      }
    }
    if (this.dodge) {
      const D = this.dodge; D.t += dt;
      const s = D.speed * (1 - Math.pow(D.t / D.dur, 2) * 0.6);
      this.vel.x = D.dx * s; this.vel.z = D.dz * s;
      if (D.air) this.vel.y = Math.max(this.vel.y - GRAVITY * 0.15 * dt, 0.5);
      if (D.t >= D.dur) { this.dodge = null; this.dodgeCd = D.air ? 0.2 : 0.25; }
    }

    // ---- movimiento normal ----
    if (!this.dodge) {
      const atk = this.attack;
      const speed = (input.walk ? WALK : RUN) * (atk ? 0.15 : 1);
      const wx = dirX * speed, wz = dirZ * speed;
      const a = (this.grounded ? ACCEL : AIR_ACCEL) * dt;
      if (this.hurtT <= 0) {
        this.vel.x += clamp(wx - this.vel.x, -a, a);
        this.vel.z += clamp(wz - this.vel.z, -a, a);
      } else { this.vel.x *= Math.pow(0.05, dt); this.vel.z *= Math.pow(0.05, dt); }
      if (atk && atk.t < atk.dur * 0.35) { // pequeño avance al golpear
        this.vel.x = -Math.sin(this.facing) * atk.def.lunge; this.vel.z = -Math.cos(this.facing) * atk.def.lunge;
      }
      if (!atk && Math.hypot(wx, wz) > 0.3) {
        const target = Math.atan2(-wx, -wz);
        const turn = Math.hypot(this.vel.x, this.vel.z) < 1.5 ? 16 : 10;
        this.facing += angleDiff(target, this.facing) * Math.min(1, dt * turn);
      }
      this._wx = wx; this._wz = wz;
    }

    // ---- saltos con tiempo de gracia y salto variable ----
    this.coyote = this.grounded ? COYOTE : this.coyote - dt;
    if (!locked && !this.attack && input.pressed('jump')) this.buffer = BUFFER; else this.buffer -= dt;
    if (this.buffer > 0 && !this.dodge) {
      if (this.coyote > 0) {
        this.vel.y = JUMP_V; this.grounded = false; this.coyote = 0; this.buffer = 0; this.jumps = 1;
        this.audio.play('jump'); this._jumped = true;
        if (this.fx) this.fx.dust(this.pos, 5, 0.6);
      } else if (this.jumps < 2) {
        this.vel.y = DOUBLE_JUMP_V; this.buffer = 0; this.jumps = 2;
        this.audio.play('djump'); this._dj = true;
        if (this.fx) this.fx.ring(this.pos.clone().setY(this.pos.y + 0.2));
      }
    }
    if (this.vel.y > 0 && !input.held('jump') && this.jumps === 1 && !this.bounced) this.vel.y -= GRAVITY * 1.4 * dt; // soltar = salto más bajo
    if (!(this.dodge && this.dodge.air)) this.vel.y = Math.max(-32, this.vel.y - GRAVITY * dt);

    // ---- colisiones ----
    const wasGrounded = this.grounded;
    if (P.moveHorizontal(this.pos, 'x', this.vel.x * dt, RADIUS, HEIGHT, wasGrounded)) this.vel.x = 0;
    if (P.moveHorizontal(this.pos, 'z', this.vel.z * dt, RADIUS, HEIGHT, wasGrounded)) this.vel.z = 0;

    const prevY = this.pos.y;
    const newY = prevY + this.vel.y * dt;
    if (this.vel.y > 0) {
      const ceil = P.ceilingAt(this.pos, RADIUS * 0.8, prevY + HEIGHT);
      if (newY + HEIGHT > ceil) { this.pos.y = ceil - HEIGHT; this.vel.y = 0; }
      else this.pos.y = newY;
      this.grounded = false;
    } else {
      this.bounced = false;
      const g = P.groundAt(this.pos.x, this.pos.z, RADIUS, prevY + 0.05 + (wasGrounded ? STEP_HEIGHT * 0.5 : 0));
      const snap = wasGrounded ? SNAP_DOWN : 0;
      if (newY <= g.y + 0.001 || (wasGrounded && prevY - g.y <= snap && g.y > -Infinity)) {
        if (g.obj && g.obj.bounce && this.vel.y < -1) { // seta que rebota
          this.pos.y = g.y; this.vel.y = g.obj.bounce; this.grounded = false; this.jumps = 1; this.bounced = true; this.airDashUsed = false;
          this.audio.play('bounce'); g.obj.onBounce && g.obj.onBounce();
          this.fx && this.fx.dust(this.pos, 8, 1, 0xf7c6ff);
          this._jumped = true;
        } else {
          if (!wasGrounded && this.airTime > 0.12) {
            this._landed = true; this._landSpeed = -this.vel.y;
            if (this.airTime > 0.25) { this.audio.play('land'); if (this.fx) this.fx.dust(this.pos, Math.round(4 + Math.min(10, -this.vel.y * 0.5)), Math.min(1.6, -this.vel.y / 12)); }
          }
          this.pos.y = g.y; this.vel.y = 0; this.grounded = true; this.ground = g.obj; this.jumps = 0; this.airDashUsed = false;
        }
      } else {
        this.pos.y = newY; this.grounded = false; this.ground = null;
      }
    }
    this.airTime = this.grounded ? 0 : this.airTime + dt;
    this._animate(dt);
  }

  _startAttack(idx, targets, dirX, dirZ) {
    const def = COMBO[idx];
    // apuntado suave: se gira hacia el enemigo más cercano que esté delante
    let best = null, bd = 4.5;
    for (const t of targets) {
      const dx = t.pos.x - this.pos.x, dz = t.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < bd && Math.abs(t.pos.y - this.pos.y) < 2) { bd = d; best = t; }
    }
    if (best) this.facing = Math.atan2(-(best.pos.x - this.pos.x), -(best.pos.z - this.pos.z));
    else if (Math.hypot(dirX, dirZ) > 0.2) this.facing = Math.atan2(-dirX, -dirZ);
    const clip = this.ch && this.ch.actions[def.anim] ? this.ch.actions[def.anim].getClip().duration : 0.9;
    this.attack = { idx, def, t: 0, dur: clip / def.speed * 0.82, hits: new Set(), swung: false };
    if (this.anim.gesture) this.anim.gesture(def.anim, { speed: def.speed, fadeIn: 0.04, fadeOut: 0.14, end: clip * 0.82 });
  }

  _animate(dt) {
    // altura visual suavizada: los escalones y bordes pequeños no dan saltos bruscos
    const dy = this.pos.y - this.visY;
    if (this.grounded && Math.abs(dy) < 0.7) this.visY += dy * Math.min(1, dt * 16);
    else this.visY = this.pos.y;
    this.mesh.position.set(this.pos.x, this.visY, this.pos.z);
    this.mesh.rotation.y = this.facing;
    this.mesh.visible = this.invuln > 0 && this.hurtT <= 0 ? Math.floor(this.invuln * 14) % 2 === 0 : true;
    const ev = this.anim.update(dt, {
      vel: this.vel, grounded: this.grounded, facing: this.facing, jumps: this.jumps,
      input: { x: this._wx || 0, z: this._wz || 0 }, lookAt: this.attack ? null : this.lookAt,
      landed: this._landed, landSpeed: this._landSpeed, doubleJumped: this._dj, jumped: this._jumped,
      busy: !!(this.attack || this.dodge),
    });
    if (ev.footstep && !this.attack) {
      this.audio.play(ev.run ? 'stepRun' : 'step');
      if (ev.run && this.fx) this.fx.puff(this.pos, -Math.sin(this.facing), -Math.cos(this.facing));
    }
    if (ev.skid && this.fx && Math.random() < 0.5) this.fx.dust(this.pos, 1, 0.8);

    // sombra de contacto
    const g = this.physics.groundAt(this.pos.x, this.pos.z, 0.01, this.pos.y + 0.05);
    this.shadow.visible = g.y > -Infinity;
    if (this.shadow.visible) {
      const h = this.pos.y - g.y;
      this.shadow.position.set(this.pos.x, g.y + 0.02, this.pos.z);
      this.shadow.scale.setScalar(Math.max(0.35, 1 - h * 0.08));
      this.shadow.material.opacity = Math.max(0.06, 0.28 - h * 0.025);
    }
  }
}

// Bastón del abuelo: madera con un cristal en la punta.
function buildStaff() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a4a26, roughness: 0.8 });
  const crystal = new THREE.MeshStandardMaterial({ color: 0x9ff0ff, emissive: 0x2a9fd0, emissiveIntensity: 0.9, roughness: 0.2, flatShading: true });
  const brass = new THREE.MeshStandardMaterial({ color: 0xd4a24c, metalness: 0.6, roughness: 0.35 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.25, 8), wood); shaft.position.y = 0.32; g.add(shaft);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 12), brass); ring.position.y = 0.9; ring.rotation.x = Math.PI / 2; g.add(ring);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), crystal); gem.position.y = 1.02; gem.scale.y = 1.5; g.add(gem);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.userData.gem = gem;
  return g;
}

const findBone = (root, name) => { let b = null; root.traverse(o => { if (!b && o.isBone && o.name === name) b = o; }); return b; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
