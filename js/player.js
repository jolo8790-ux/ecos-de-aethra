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
    this.dodge = null; this.dodgeCd = 0; this.airDashUsed = false; this.launchT = 0;
    this.canGlide = false; this.gliding = false; this.glideT = 0; this.updrafts = [];
    this.glideMax = 5; this.stamina = 5; this.tired = false; this.gust = null; this.gustCd = 2; // planeador: aguante y ráfagas de viento
    this.canGrapple = false; this.grapple = null;
    this.canShield = false; this.shielding = false; this.canPulse = false; this.pulseCd = 0;
    this.events = [];            // eventos para main (golpes, daño, muerte)
    this.mods = {};              // ventajas del héroe elegido (velocidad, daño, planeo...)

    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.25, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; scene.add(this.shadow);
    this.staff = null;
  }

  // Cambia el personaje hecho con formas por el modelo animado (cuando termina de cargar).
  useModel(lib, look = 'lia') {
    const scene = this.mesh.parent;
    if (this.ch) this.ch.root.traverse(o => { if (o.isMesh && o.material && o.material.map && o.material.map.isCanvasTexture) o.material.map.dispose(); });
    const ch = createCharacter(lib, look);
    scene.remove(this.mesh); scene.add(ch.root);
    this.ch = ch; this.mesh = ch.root; this.anim = new HeroModelAnimator(ch);
    this.staff = buildStaff();
    const hand = findBone(ch.model, 'handslotr') || findBone(ch.model, 'handr');
    if (hand) { hand.add(this.staff); this.staff.rotation.y = Math.PI; } // igual que las armas originales del paquete
    this.staff.visible = this.canFight;
    this.glider = buildGlider(); ch.root.add(this.glider);
    if (look && look.glider) this.glider.traverse(o => { if (o.isMesh && o.material && o.material.color && o.material.color.getHex() === 0x2f9fae) { o.material = o.material.clone(); o.material.color.setHex(look.glider); } });
    this.shieldMesh = buildShield(); ch.root.add(this.shieldMesh);
  }
  gesture(name, opts) { if (this.anim.gesture) this.anim.gesture(name, opts); }
  setFight(on) { this.canFight = on; if (this.staff) this.staff.visible = on; }

  teleport(x, y, z, facing = this.facing) {
    this.pos.set(x, y, z); this.vel.set(0, 0, 0); this.facing = facing; this.visY = y;
    this.grounded = false; this.jumps = 0; this.attack = null; this.dodge = null; this.grapple = null; this.gliding = false;
  }

  // Garfio: lanza la cuerda hacia un anillo y tira de Lía hasta él.
  startGrapple(point) {
    if (!this.canGrapple || this.grapple || this.hurtT > 0) return false;
    const hx = point.pos.x - this.pos.x, hz = point.pos.z - this.pos.z, hl = Math.hypot(hx, hz) || 1;
    this.grapple = { point, t: 0, phase: 'shoot', hx: hx / hl, hz: hz / hl };
    this.attack = null; this.dodge = null; this.gliding = false;
    this.facing = Math.atan2(-(point.pos.x - this.pos.x), -(point.pos.z - this.pos.z));
    this.audio.play('grapple');
    this.anim.gesture && this.anim.gesture('Spellcast_Raise', { speed: 2, fadeIn: 0.04, fadeOut: 0.15 });
    return true;
  }

  heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }

  // ¿El escudo cubre un ataque que viene desde ese punto? (frente de Lía, unos 140°)
  blocks(from) {
    if (!this.shielding) return false;
    const dx = from.x - this.pos.x, dz = from.z - this.pos.z, l = Math.hypot(dx, dz);
    if (l < 0.05) return true;
    return (dx * -Math.sin(this.facing) + dz * -Math.cos(this.facing)) / l > 0.3;
  }

  // Recibir daño: devuelve true si hizo efecto.
  damage(amount, from) {
    if (this.invuln > 0 || (this.dodge && this.dodge.t < this.dodge.iframes) || this.hp <= 0) return false;
    if (this.blocks(from)) { // el escudo detiene el golpe
      const dx = this.pos.x - from.x, dz = this.pos.z - from.z, l = Math.hypot(dx, dz) || 1;
      this.vel.x = dx / l * 4; this.vel.z = dz / l * 4;
      this.shieldFlash = 1; this.audio.play('block'); this.events.push({ type: 'block' });
      return false;
    }
    // dificultad: en Cuento solo un golpe de cada dos quita corazón; en Leyenda los golpes quitan el doble
    const D = this.diff || { dmg: 1, invuln: 1.1 };
    if (D.dmg === 0) return false; // modo automático: Lía no recibe daño
    if (D.dmg < 1) { this._half = !this._half; amount = this._half ? 0 : Math.max(1, Math.round(amount)); }
    else amount = Math.max(1, Math.round(amount * D.dmg));
    this.hp -= amount; this.invuln = D.invuln; this.hurtT = 0.35;
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
    if (this.grounded && this.ground && this.ground.delta) { this.pos.add(this.ground.delta); } // plataformas móviles
    if (this.grapple) { this._updateGrapple(dt); this._animate(dt); return; }
    this.invuln = Math.max(0, this.invuln - dt); this.hurtT = Math.max(0, this.hurtT - dt);
    this.attackCd -= dt; this.dodgeCd -= dt;
    if (this.swimming) { this._updateSwim(dt, input, camYaw); return; } // bajo el agua
    let mx = 0, my = 0;
    const locked = this.frozen || this.hurtT > 0;
    if (!locked) { mx = input.move.x; my = input.move.y; }
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    let dirX = fx * my + rx * mx, dirZ = fz * my + rz * mx;

    // ---- escudo (mantener V / LB) ----
    this.shielding = this.canShield && !this.frozen && this.hurtT <= 0 && input.held('shield') && this.grounded && !this.attack && !this.dodge;
    if (this.shielding && !this._wasShielding) this.audio.play('shieldUp');
    this._wasShielding = this.shielding;
    if (this.shielding) { // apunta hacia donde mira la cámara
      this.facing += angleDiff(camYaw, this.facing) * Math.min(1, dt * 14);
    }

    // ---- pulso de luz (Z / LT) ----
    this.pulseCd -= dt;
    if (!locked && this.canPulse && input.pressed('pulse') && this.pulseCd <= 0 && !this.dodge) {
      this.pulseCd = 1.1; this.attack = null;
      this.events.push({ type: 'pulse', pos: this.pos.clone(), radius: 6.5 * (this.mods.pulseR || 1), by: this });
      this.audio.play('pulse');
      this.anim.gesture && this.anim.gesture('Spellcast_Raise', { speed: 1.8, fadeIn: 0.05, fadeOut: 0.2 });
      this.fx && this.fx.ring(this.pos.clone().setY(this.pos.y + 0.8), 0xfff2a8);
    }

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
      if (A.swung && k <= A.def.hit[1]) this.events.push({ type: 'hitcheck', def: A.def, dmg: A.def.dmg + (this.mods.dmg || 0), hitList: A.hits, range: ATTACK_RANGE, angle: ATTACK_ANGLE });
      if (k > 0.62 && this.attackQueued && A.idx < COMBO.length - 1) { this.attackQueued = false; this._startAttack(A.idx + 1, targets, dirX, dirZ); }
      else if (k >= 1) { this.attack = null; this.attackQueued = false; this.attackCd = A.idx === COMBO.length - 1 ? 0.35 : 0.1; }
    }

    // ---- esquiva / impulso aéreo ----
    if (!locked && input.pressed('dodge') && !this.dodge && this.dodgeCd <= 0) {
      let dx = dirX, dz = dirZ;
      if (Math.hypot(dx, dz) < 0.2) { dx = -Math.sin(this.facing); dz = -Math.cos(this.facing); }
      const l = Math.hypot(dx, dz); dx /= l; dz /= l;
      if (this.grounded) {
        this.dodge = { t: 0, dur: 0.38, iframes: 0.32, dx, dz, speed: 11 * (this.mods.dodge || 1), air: false };
        this.attack = null; this.facing = Math.atan2(-dx, -dz);
        this.anim.gesture && this.anim.gesture('Dodge_Forward', { speed: 1.25, fadeIn: 0.04, fadeOut: 0.15 });
        this.audio.play('dodge'); this.fx && this.fx.dust(this.pos, 6, 0.8);
      } else if (this.canAirDash && !this.airDashUsed) {
        this.airDashUsed = true;
        this.dodge = { t: 0, dur: 0.26, iframes: 0.2, dx, dz, speed: 14, air: true };
        this.facing = Math.atan2(-dx, -dz); this.vel.y = Math.max(this.vel.y, 1.5);
        this.anim.gesture && this.anim.gesture('Dodge_Forward', { speed: 1.6, fadeIn: 0.03, fadeOut: 0.12 });
        this.audio.play('dash'); this.fx && this.fx.colorRing(this.pos.clone().setY(this.pos.y + 0.8), 0.75);
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
      if (this.launchT > 0) this.launchT -= dt;
      const launching = this.launchT > 0 && !this.grounded; // tras el garfio se conserva el impulso
      const speed = Math.max((input.walk ? WALK : RUN) * (this.mods.speed || 1) * (atk ? 0.15 : 1) * (this.shielding ? 0.35 : 1), launching ? Math.hypot(this.vel.x, this.vel.z) : 0);
      const wx = dirX * speed, wz = dirZ * speed;
      const a = (this.grounded ? ACCEL : this.gliding ? AIR_ACCEL * 1.6 : AIR_ACCEL) * dt;
      if (this.hurtT <= 0) {
        this.vel.x += clamp(wx - this.vel.x, -a, a);
        this.vel.z += clamp(wz - this.vel.z, -a, a);
      } else { this.vel.x *= Math.pow(0.05, dt); this.vel.z *= Math.pow(0.05, dt); }
      if (atk && atk.t < atk.dur * 0.35) { // pequeño avance al golpear
        this.vel.x = -Math.sin(this.facing) * atk.def.lunge; this.vel.z = -Math.cos(this.facing) * atk.def.lunge;
      }
      if (!atk && !this.shielding && Math.hypot(wx, wz) > 0.3) {
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
        this.vel.y = JUMP_V * (this.mods.jump || 1); this.grounded = false; this.coyote = 0; this.buffer = 0; this.jumps = 1;
        this.audio.play('jump'); this._jumped = true;
        if (this.fx) this.fx.dust(this.pos, 5, 0.6);
      } else if (this.jumps < 2) {
        this.vel.y = DOUBLE_JUMP_V * (this.mods.jump || 1); this.buffer = 0; this.jumps = 2;
        this.audio.play('djump'); this._dj = true;
        if (this.fx) this.fx.colorRing(this.pos.clone().setY(this.pos.y + 0.2), 0.5 + Math.random() * 0.1);
      }
    }
    if (this.vel.y > 0 && !input.held('jump') && this.jumps === 1 && !this.bounced) this.vel.y -= GRAVITY * 1.4 * dt; // soltar = salto más bajo
    if (!(this.dodge && this.dodge.air)) this.vel.y = Math.max(-32, this.vel.y - GRAVITY * dt);

    // ---- planeador: mantener salto mientras se cae ----
    // aguante: se recupera en el suelo y dentro de las corrientes; al agotarse, el planeador se pliega
    if (this.diff && this.diff.glide) this.glideMax = this.diff.glide * (this.mods.glide || 1);
    if (this.grounded) { this.stamina = Math.min(this.glideMax, this.stamina + dt * 4); this.tired = false; this.gust = null; this.gustCd = Math.max(this.gustCd, 1.6); }
    const wantGlide = this.canGlide && !this.grounded && !this.dodge && !locked && !this.tired && input.held('jump') && (this.gliding || this.vel.y < 0) && this.airTime > 0.15;
    if (wantGlide && !this.gliding) { this.gliding = true; this.audio.play('glide'); }
    if (!wantGlide) { this.gliding = false; this.gust = null; }
    if (this.gliding) {
      this.glideT += dt;
      if (this.vel.y < -1.8) this.vel.y += (-1.8 - this.vel.y) * Math.min(1, dt * 9);
      let lifted = false;
      for (const u of this.updrafts) { // corrientes de aire
        if (u.active === false) continue;
        if (Math.hypot(this.pos.x - u.x, this.pos.z - u.z) < u.r && this.pos.y > u.y0 - 1 && this.pos.y < u.y1) { this.vel.y = Math.min(this.vel.y + 46 * dt, 9); lifted = true; }
      }
      if (lifted) { this.stamina = Math.min(this.glideMax, this.stamina + dt * 2); this.gust = null; }
      else if (!this.noStamina) {
        this.stamina -= dt;
        if (this.stamina <= 0) { this.stamina = 0; this.tired = true; this.gliding = false; this.audio.play('hurt'); this.events.push({ type: 'tired' }); }
        // ráfagas de viento: se avisan con líneas de aire y empujan de lado
        this.gustCd -= dt;
        if (!this.gust && this.gustCd <= 0 && this.glideT > 0.6) { this.gustCd = 2.2 + Math.random() * 2.5; const a = Math.atan2(this.vel.x, this.vel.z) + (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2; this.gust = { t: -0.7, x: Math.sin(a), z: Math.cos(a) }; this.events.push({ type: 'gustWarn', dir: this.gust }); }
        if (this.gust) {
          this.gust.t += dt;
          if (this.gust.t > 0 && this.gust.t < 1.1) { const k = (this.diff && this.diff.gust) || 1; this.vel.x += this.gust.x * 9 * k * dt; this.vel.z += this.gust.z * 9 * k * dt; this.vel.y -= 2.5 * k * dt; }
          if (this.gust.t >= 1.1) this.gust = null;
        }
      }
    }

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

  // ---- nadar (y pilotar el submarino) ----
  _updateSwim(dt, input, camYaw) {
    const P = this.physics, locked = this.frozen || this.hurtT > 0 || this.drowning;
    let mx = 0, my = 0, up = 0;
    if (!locked) { mx = input.move.x; my = input.move.y; up = (input.held('jump') ? 1 : 0) - (input.held('dodge') ? 1 : 0); }
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    const dirX = fx * my + rx * mx, dirZ = fz * my + rz * mx;
    const sp = this.inSub ? 8.5 : (input.walk ? 2.4 : 4.4) * (this.mods.swim || 1);
    const tx = dirX * sp, tz = dirZ * sp;
    let ty = up * sp * 0.8 + (this.inSub ? 0 : -0.35); // sin nadar, se hunde despacio
    if (this.drowning) ty = -1.4;
    const k = Math.min(1, dt * (this.inSub ? 2.2 : 3.2));
    if (this.hurtT > 0) { this.vel.multiplyScalar(Math.pow(0.2, dt)); }
    else { this.vel.x += (tx - this.vel.x) * k; this.vel.z += (tz - this.vel.z) * k; this.vel.y += (ty - this.vel.y) * k; }
    if (Math.hypot(tx, tz) > 0.3) this.facing += angleDiff(Math.atan2(-tx, -tz), this.facing) * Math.min(1, dt * (this.inSub ? 3 : 7));
    this._wx = tx; this._wz = tz;
    this.attack = null; this.dodge = null; this.gliding = false; this.jumps = 0; this.airDashUsed = false; this.shielding = false;
    const f = this.flow || { x: 0, y: 0, z: 0 };
    const wasGrounded = this.grounded;
    if (P.moveHorizontal(this.pos, 'x', (this.vel.x + f.x) * dt, RADIUS, HEIGHT, wasGrounded)) this.vel.x = 0;
    if (P.moveHorizontal(this.pos, 'z', (this.vel.z + f.z) * dt, RADIUS, HEIGHT, wasGrounded)) this.vel.z = 0;
    const prevY = this.pos.y, vy = this.vel.y + (f.y || 0), newY = prevY + vy * dt;
    if (vy > 0) {
      const ceil = P.ceilingAt(this.pos, RADIUS * 0.8, prevY + HEIGHT);
      this.pos.y = newY + HEIGHT > ceil ? ceil - HEIGHT : newY; this.grounded = false;
    } else {
      const g = P.groundAt(this.pos.x, this.pos.z, RADIUS, prevY + 0.05);
      if (newY <= g.y) { this.pos.y = g.y; this.vel.y = Math.max(0, this.vel.y); this.grounded = true; this.ground = g.obj; }
      else { this.pos.y = newY; this.grounded = false; this.ground = null; }
    }
    // superficie: la cabeza asoma; con salto se sale del agua (el submarino no sale)
    const top = this.seaY - (this.inSub ? 2.6 : 1.15);
    this.atSurface = false;
    if (this.pos.y > top) {
      this.pos.y = top; if (this.vel.y > 0) this.vel.y = 0; this.atSurface = !this.inSub;
      if (this.atSurface && !locked && input.pressed('jump')) { this.vel.y = 8.5; this.pos.y = this.seaY - 1.05; this.swimming = false; this.audio.play('splash'); this.fx && this.fx.dust(this.pos, 8, 1, 0xdff6ff); }
    }
    this.airTime = 0;
    this._animate(dt);
  }

  // Cuerda del garfio: un cilindro fino entre la mano de Lía y el anillo, que se estira al lanzarlo.
  _updateRope() {
    if (!this.rope) {
      this.rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 6, 1, true), new THREE.MeshStandardMaterial({ color: 0xd8c08a, roughness: 0.7 }));
      this.rope.geometry.translate(0, 0.5, 0); this.rope.geometry.rotateX(Math.PI / 2);
      this.hookTip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.25, 6), new THREE.MeshStandardMaterial({ color: 0xc8c8d0, metalness: 0.7, roughness: 0.3 }));
      this.hookTip.geometry.rotateX(Math.PI / 2);
    }
    const G = this.grapple, scene = this.mesh.parent;
    if (!G || !scene) { if (this.rope.parent) { this.rope.parent.remove(this.rope); this.hookTip.parent.remove(this.hookTip); } return; }
    if (!this.rope.parent) scene.add(this.rope, this.hookTip);
    const from = this.pos.clone(); from.y += 1.1;
    if (this.staff && this.staff.parent) this.staff.getWorldPosition(from);
    const to = G.point.pos;
    const k = G.phase === 'shoot' ? Math.min(1, G.t / 0.14) : 1;
    const end = from.clone().lerp(to, k);
    const len = Math.max(0.01, from.distanceTo(end));
    this.rope.position.copy(from); this.rope.lookAt(end); this.rope.scale.set(1, 1, len);
    this.hookTip.position.copy(end); this.hookTip.lookAt(to.clone().add(to.clone().sub(from)));
  }

  _updateGrapple(dt) {
    const G = this.grapple, P = this.physics;
    G.t += dt;
    const target = G.point.pos.clone(); target.y -= 1.3;
    const dir = target.clone().sub(this.pos); const dist = dir.length(); dir.normalize();
    if (G.phase === 'shoot') { this.vel.set(0, 0, 0); if (G.t > 0.14) { G.phase = 'pull'; this.audio.play('dash'); } return; }
    const sp = 21;
    this.vel.copy(dir).multiplyScalar(sp);
    const before = this.pos.clone();
    P.moveHorizontal(this.pos, 'x', this.vel.x * dt, RADIUS, HEIGHT, false);
    P.moveHorizontal(this.pos, 'z', this.vel.z * dt, RADIUS, HEIGHT, false);
    this.pos.y += this.vel.y * dt;
    const g = P.groundAt(this.pos.x, this.pos.z, RADIUS, this.pos.y + 0.3);
    if (this.pos.y < g.y) this.pos.y = g.y;
    const stuck = before.distanceTo(this.pos) < sp * dt * 0.3;
    if (dist < 1.0 || G.t > 2.2 || stuck) {
      this.grapple = null;
      this.vel.set(G.hx * 8.5, 9, G.hz * 8.5); // sale disparada hacia delante y arriba
      this.launchT = 0.9; this.bounced = true;
      if (G.point.land) this.vel.set(0, 4, 0);
      if (G.point.landAt) { this.pos.copy(G.point.landAt); this.vel.set(0, 0, 0); this.launchT = 0; }
      this.jumps = 1; this.airDashUsed = false; this.grounded = false; this.airTime = 0.2;
      this.fx && this.fx.ring(this.pos.clone().setY(this.pos.y + 0.6), 0xffe27a);
      G.point.onArrive && G.point.onArrive();
    }
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
    this.mesh.rotation.order = 'YXZ'; this.mesh.rotation.y = this.facing;
    const sw = this.swimming && !this.inSub, hs = Math.hypot(this.vel.x, this.vel.z);
    this.tilt = (this.tilt || 0) + ((sw ? -Math.min(1.25, hs / 4.4 * 1.25) : 0) - (this.tilt || 0)) * Math.min(1, dt * 6); // al nadar, el cuerpo se tumba hacia delante
    this.mesh.rotation.x = this.tilt;
    if (sw) this.mesh.position.y += Math.sin(performance.now() / 300) * 0.06;
    this.mesh.visible = this.inSub ? false : this.invuln > 0 && this.hurtT <= 0 ? Math.floor(this.invuln * 14) % 2 === 0 : true;
    const ev = this.anim.update(dt, {
      vel: this.vel, grounded: this.grounded, facing: this.facing, jumps: this.jumps,
      input: { x: this._wx || 0, z: this._wz || 0 }, lookAt: this.attack ? null : this.lookAt,
      landed: this._landed, landSpeed: this._landSpeed, doubleJumped: this._dj, jumped: this._jumped,
      busy: !!(this.attack || this.dodge || this.grapple), gliding: this.gliding, shielding: this.shielding, grappling: !!this.grapple, canFight: this.canFight,
    });
    if (ev.footstep && !this.attack) {
      this.audio.play(ev.run ? 'stepRun' : 'step');
      if (ev.run && this.fx) this.fx.puff(this.pos, -Math.sin(this.facing), -Math.cos(this.facing));
    }
    if (ev.skid && this.fx && Math.random() < 0.5) this.fx.dust(this.pos, 1, 0.8);
    this._updateRope();
    if (this.shieldMesh) { // el escudo de prisma aparece delante de Lía
      const S = this.shieldMesh.userData;
      S.k = (S.k || 0) + ((this.shielding ? 1 : 0) - (S.k || 0)) * Math.min(1, dt * 16);
      this.shieldFlash = Math.max(0, (this.shieldFlash || 0) - dt * 4);
      this.shieldMesh.visible = S.k > 0.03;
      this.shieldMesh.scale.setScalar(Math.max(0.01, S.k) * (1 + this.shieldFlash * 0.25));
      S.mat.opacity = 0.35 + this.shieldFlash * 0.5; S.mat.emissiveIntensity = 0.8 + this.shieldFlash * 2.5;
      S.rim.rotation.z += dt * 1.5;
    }
    if (this.glider) { // el planeador se despliega con un pequeño rebote
      const want = this.gliding ? 1 : 0;
      this.glider.userData.k = (this.glider.userData.k || 0) + (want - (this.glider.userData.k || 0)) * Math.min(1, dt * 12);
      const k = this.glider.userData.k;
      this.glider.visible = k > 0.03; this.glider.scale.setScalar(Math.max(0.01, k) * 1.2);
      this.glider.rotation.z = this.anim.turnLean ? -this.anim.turnLean * 1.5 : 0;
      this.glider.rotation.x = Math.sin(performance.now() / 300) * 0.04;
    }

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

// Planeador de tela con armazón de madera, sobre la cabeza: dos alas en V con franjas.
function buildGlider() {
  const g = new THREE.Group(); g.position.y = 2.05; g.userData.s = 1.2;
  const cloth = new THREE.MeshStandardMaterial({ color: 0x2f9fae, roughness: 0.8, side: THREE.DoubleSide });
  const stripe = new THREE.MeshStandardMaterial({ color: 0xf6ead0, roughness: 0.8, side: THREE.DoubleSide });
  const wood = new THREE.MeshStandardMaterial({ color: 0x6e4a2a });
  const tilt = new THREE.Group(); tilt.rotation.x = -0.22; g.add(tilt); // morro algo levantado
  [-1, 1].forEach(side => {
    const wing = new THREE.Group(); wing.rotation.z = side * 0.2; tilt.add(wing);
    const sh = new THREE.Shape();
    sh.moveTo(0, 0.55); sh.lineTo(side * 1.7, -0.1); sh.lineTo(side * 1.5, -0.55); sh.lineTo(0, -0.75); sh.lineTo(0, 0.55);
    const sail = new THREE.Mesh(new THREE.ShapeGeometry(sh), cloth); sail.rotation.x = -Math.PI / 2; wing.add(sail);
    const sb = new THREE.Shape();
    sb.moveTo(side * 0.9, 0.22); sb.lineTo(side * 1.25, 0.05); sb.lineTo(side * 1.15, -0.62); sb.lineTo(side * 0.8, -0.66);
    const band = new THREE.Mesh(new THREE.ShapeGeometry(sb), stripe); band.rotation.x = -Math.PI / 2; band.position.y = 0.01; wing.add(band);
    const spar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.8, 6), wood);
    spar.position.set(side * 0.85, 0.02, -0.22); spar.rotation.z = Math.PI / 2; spar.rotation.y = side * 0.38; wing.add(spar);
  });
  const keel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6), wood); keel.rotation.x = Math.PI / 2; keel.position.y = 0.02; tilt.add(keel);
  [-0.22, 0.22].forEach(x => { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.85, 4), wood); r.position.set(x, -0.42, 0); r.rotation.z = x * 0.7; g.add(r); });
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.visible = false;
  return g;
}

// Escudo de prisma: hexágono de luz translúcida delante de Lía.
function buildShield() {
  const g = new THREE.Group(); g.position.set(0, 1.0, -0.75);
  const mat = new THREE.MeshStandardMaterial({ color: 0xbff4ff, emissive: 0x4ad8ff, emissiveIntensity: 0.8, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.8, 6), mat); g.add(face);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.04, 6, 6), new THREE.MeshStandardMaterial({ color: 0xe8fbff, emissive: 0x7ae8ff, emissiveIntensity: 1.5 }));
  g.add(rim);
  g.userData = { mat, rim, k: 0 };
  g.visible = false;
  return g;
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
