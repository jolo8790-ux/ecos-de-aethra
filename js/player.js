import * as THREE from 'three';
import { STEP_HEIGHT } from './physics.js';
import { buildHumanoid, HeroAnimator } from './rig.js';
import { createCharacter, HeroModelAnimator } from './characters.js';

export const RADIUS = 0.35, HEIGHT = 1.55;
const RUN = 6.8, WALK = 2.6, ACCEL = 38, AIR_ACCEL = 16, GRAVITY = 28, JUMP_V = 10, DOUBLE_JUMP_V = 9;
const COYOTE = 0.12, BUFFER = 0.14, SNAP_DOWN = 0.45;

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
    this.phase = 0; this.landSquash = 0; this.frozen = false;

    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.25, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; scene.add(this.shadow);
  }

  // Cambia el personaje hecho con formas por el modelo animado (cuando termina de cargar).
  useModel(lib) {
    const scene = this.mesh.parent;
    const ch = createCharacter(lib, 'lia');
    scene.remove(this.mesh); scene.add(ch.root);
    this.ch = ch; this.mesh = ch.root; this.anim = new HeroModelAnimator(ch);
  }
  gesture(name, opts) { if (this.anim.gesture) this.anim.gesture(name, opts); }

  teleport(x, y, z, facing = this.facing) {
    this.pos.set(x, y, z); this.vel.set(0, 0, 0); this.facing = facing;
    this.grounded = false; this.jumps = 0;
  }

  update(dt, input, camYaw) {
    const P = this.physics;
    this._landed = false; this._landSpeed = 0; this._dj = false; this._jumped = false;
    let mx = 0, my = 0;
    if (!this.frozen) { mx = input.move.x; my = input.move.y; }
    const speed = input.walk ? WALK : RUN;
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    const wx = (fx * my + rx * mx) * speed, wz = (fz * my + rz * mx) * speed;
    const a = (this.grounded ? ACCEL : AIR_ACCEL) * dt;
    this.vel.x += clamp(wx - this.vel.x, -a, a);
    this.vel.z += clamp(wz - this.vel.z, -a, a);
    if (Math.hypot(wx, wz) > 0.3) {
      const target = Math.atan2(-wx, -wz);
      this.facing += angleDiff(target, this.facing) * Math.min(1, dt * 14);
    }

    // saltos con tiempo de gracia y salto variable
    this.coyote = this.grounded ? COYOTE : this.coyote - dt;
    if (!this.frozen && input.pressed('jump')) this.buffer = BUFFER; else this.buffer -= dt;
    if (this.buffer > 0) {
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
    if (this.vel.y > 0 && !input.held('jump') && this.jumps === 1) this.vel.y -= GRAVITY * 1.4 * dt; // soltar = salto más bajo

    this.vel.y = Math.max(-32, this.vel.y - GRAVITY * dt);

    // horizontal
    const wasGrounded = this.grounded;
    if (P.moveHorizontal(this.pos, 'x', this.vel.x * dt, RADIUS, HEIGHT, wasGrounded)) this.vel.x = 0;
    if (P.moveHorizontal(this.pos, 'z', this.vel.z * dt, RADIUS, HEIGHT, wasGrounded)) this.vel.z = 0;

    // vertical
    const prevY = this.pos.y;
    const newY = prevY + this.vel.y * dt;
    if (this.vel.y > 0) {
      const ceil = P.ceilingAt(this.pos, RADIUS * 0.8, prevY + HEIGHT);
      if (newY + HEIGHT > ceil) { this.pos.y = ceil - HEIGHT; this.vel.y = 0; }
      else this.pos.y = newY;
      this.grounded = false;
    } else {
      const g = P.groundAt(this.pos.x, this.pos.z, RADIUS, prevY + 0.05 + (wasGrounded ? STEP_HEIGHT * 0.5 : 0));
      const snap = wasGrounded ? SNAP_DOWN : 0;
      if (newY <= g.y + 0.001 || (wasGrounded && prevY - g.y <= snap && g.y > -Infinity)) {
        if (!wasGrounded && this.airTime > 0.12) {
          this._landed = true; this._landSpeed = -this.vel.y;
          if (this.airTime > 0.25) { this.audio.play('land'); if (this.fx) this.fx.dust(this.pos, Math.round(4 + Math.min(10, -this.vel.y * 0.5)), Math.min(1.6, -this.vel.y / 12)); }
        }
        this.pos.y = g.y; this.vel.y = 0; this.grounded = true; this.ground = g.obj; this.jumps = 0;
      } else {
        this.pos.y = newY; this.grounded = false; this.ground = null;
      }
    }
    this.airTime = this.grounded ? 0 : this.airTime + dt;
    this._wx = wx; this._wz = wz;
    this._animate(dt);
  }

  _animate(dt) {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.facing;
    const ev = this.anim.update(dt, {
      vel: this.vel, grounded: this.grounded, facing: this.facing, jumps: this.jumps,
      input: { x: this._wx || 0, z: this._wz || 0 }, lookAt: this.lookAt,
      landed: this._landed, landSpeed: this._landSpeed, doubleJumped: this._dj, jumped: this._jumped,
    });
    if (ev.footstep) {
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

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
