import * as THREE from 'three';
import { STEP_HEIGHT } from './physics.js';

export const RADIUS = 0.35, HEIGHT = 1.55;
const RUN = 6.8, WALK = 2.6, ACCEL = 38, AIR_ACCEL = 16, GRAVITY = 28, JUMP_V = 10, DOUBLE_JUMP_V = 9;
const COYOTE = 0.12, BUFFER = 0.14, SNAP_DOWN = 0.45;

const m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, ...o });

// Modelo de Lía hecho con formas simples; las articulaciones son grupos para animarlas.
function buildLia() {
  const root = new THREE.Group();
  const skin = m(0xf2c29b), hair = m(0x4a2c1d), jacket = m(0x2f8f9d), pants = m(0x3b3554), boots = m(0x5a3a22), scarf = m(0xf2b134), bag = m(0x9c6b3e), white = m(0xffffff), dark = m(0x1c1c28);
  const add = (parent, geo, mat, x, y, z) => { const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh; };

  const hips = new THREE.Group(); hips.position.y = 0.72; root.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  add(torso, new THREE.CylinderGeometry(0.22, 0.25, 0.5, 12), jacket, 0, 0.27, 0);
  add(torso, new THREE.CylinderGeometry(0.255, 0.2, 0.14, 12), jacket, 0, 0.0, 0);
  add(torso, new THREE.TorusGeometry(0.17, 0.06, 8, 16), scarf, 0, 0.53, 0).rotation.x = Math.PI / 2;
  const tail = add(torso, new THREE.BoxGeometry(0.1, 0.32, 0.04), scarf, 0.1, 0.38, 0.2); tail.rotation.z = 0.2;
  const strap = add(torso, new THREE.BoxGeometry(0.05, 0.62, 0.05), bag, 0, 0.27, 0); strap.rotation.z = 0.75;
  add(torso, new THREE.BoxGeometry(0.22, 0.18, 0.1), bag, -0.24, 0.02, 0.05);

  const head = new THREE.Group(); head.position.y = 0.78; torso.add(head);
  add(head, new THREE.SphereGeometry(0.23, 18, 14), skin, 0, 0, 0);
  const hairCap = add(head, new THREE.SphereGeometry(0.245, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 0.02, 0.02);
  hairCap.rotation.x = -0.25;
  const pony = add(head, new THREE.ConeGeometry(0.09, 0.38, 8), hair, 0, -0.06, 0.27); pony.rotation.x = -2.5;
  add(head, new THREE.SphereGeometry(0.05, 8, 6), white, -0.085, 0.0, -0.2);
  add(head, new THREE.SphereGeometry(0.05, 8, 6), white, 0.085, 0.0, -0.2);
  add(head, new THREE.SphereGeometry(0.028, 6, 5), dark, -0.085, 0.0, -0.245);
  add(head, new THREE.SphereGeometry(0.028, 6, 5), dark, 0.085, 0.0, -0.245);

  const limb = (parent, x, y, len, r, mat, endMat) => {
    const j = new THREE.Group(); j.position.set(x, y, 0); parent.add(j);
    add(j, new THREE.CylinderGeometry(r, r * 0.9, len, 8), mat, 0, -len / 2, 0);
    if (endMat) add(j, new THREE.BoxGeometry(r * 2.2, 0.12, r * 3.2), endMat, 0, -len + 0.02, -0.05);
    else add(j, new THREE.SphereGeometry(r * 1.05, 8, 6), skin, 0, -len, 0);
    return j;
  };
  const armL = limb(torso, -0.29, 0.48, 0.48, 0.07, jacket);
  const armR = limb(torso, 0.29, 0.48, 0.48, 0.07, jacket);
  const legL = limb(hips, -0.12, 0, 0.66, 0.09, pants, boots);
  const legR = limb(hips, 0.12, 0, 0.66, 0.09, pants, boots);
  root.userData = { hips, torso, head, armL, armR, legL, legR };
  return root;
}

export class Player {
  constructor(scene, physics, audio) {
    this.physics = physics; this.audio = audio;
    this.mesh = buildLia(); scene.add(this.mesh);
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.facing = Math.PI; this.grounded = false; this.ground = null;
    this.coyote = 0; this.buffer = 0; this.jumps = 0; this.airTime = 0;
    this.phase = 0; this.landSquash = 0; this.frozen = false;

    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.25, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; scene.add(this.shadow);
  }

  teleport(x, y, z, facing = this.facing) {
    this.pos.set(x, y, z); this.vel.set(0, 0, 0); this.facing = facing;
    this.grounded = false; this.jumps = 0;
  }

  update(dt, input, camYaw) {
    const P = this.physics;
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
        this.audio.play('jump');
      } else if (this.jumps < 2) {
        this.vel.y = DOUBLE_JUMP_V; this.buffer = 0; this.jumps = 2;
        this.audio.play('djump');
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
        if (!wasGrounded && this.vel.y < -14) this.landSquash = 0.28;
        if (!wasGrounded && this.airTime > 0.25) this.audio.play('land');
        this.pos.y = g.y; this.vel.y = 0; this.grounded = true; this.ground = g.obj; this.jumps = 0;
      } else {
        this.pos.y = newY; this.grounded = false; this.ground = null;
      }
    }
    this.airTime = this.grounded ? 0 : this.airTime + dt;
    this._animate(dt);
  }

  _animate(dt) {
    const u = this.mesh.userData;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.facing;
    if (this.grounded) {
      this.phase += dt * (3 + sp * 1.55);
      const amp = Math.min(1, sp / RUN) * 0.75;
      const s = Math.sin(this.phase);
      u.legL.rotation.x = s * amp; u.legR.rotation.x = -s * amp;
      u.armL.rotation.x = -s * amp * 0.9; u.armR.rotation.x = s * amp * 0.9;
      u.armL.rotation.z = -0.08; u.armR.rotation.z = 0.08;
      u.hips.position.y = 0.72 + Math.abs(Math.cos(this.phase)) * amp * 0.07;
      u.torso.rotation.x = -amp * 0.12;
      if (sp < 0.3) { // respiración en reposo
        const t = performance.now() / 1000;
        u.torso.rotation.x = Math.sin(t * 2) * 0.02; u.legL.rotation.x *= 0.8; u.legR.rotation.x *= 0.8;
      }
    } else {
      const up = this.vel.y > 0;
      u.legL.rotation.x = up ? -0.6 : -0.25; u.legR.rotation.x = up ? 0.2 : 0.35;
      u.armL.rotation.x = -0.4; u.armR.rotation.x = -0.4;
      u.armL.rotation.z = -0.7; u.armR.rotation.z = 0.7;
      if (this.jumps === 2) u.torso.rotation.x = Math.min(0, u.torso.rotation.x - dt * 8); else u.torso.rotation.x = 0;
    }
    this.landSquash *= Math.pow(0.0005, dt);
    this.mesh.scale.set(1 + this.landSquash * 0.5, 1 - this.landSquash, 1 + this.landSquash * 0.5);

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
