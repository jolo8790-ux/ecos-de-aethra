import * as THREE from 'three';
import { angleDiff } from './player.js';

// Cámara en tercera persona que sigue al jugador, gira con ratón/stick/táctil
// y se acerca sola cuando una pared se interpone.
export class FollowCamera {
  constructor(camera, physics) {
    this.camera = camera; this.physics = physics;
    this.yaw = 0; this.pitch = 0.32; this.dist = 7.5; this.curDist = 7.5;
    this.target = new THREE.Vector3();
    this.settings = { sens: 1, invert: false };
    this.idle = 0;
  }
  snap(player) {
    this.yaw = player.facing;
    this.target.copy(player.pos).add(new THREE.Vector3(0, 1.3, 0));
    this.curDist = this.dist;
    this._place(1);
  }
  update(dt, input, player) {
    const s = this.settings.sens;
    if (input.look.x || input.look.y) this.idle = 0; else this.idle += dt;
    this.yaw -= input.look.x * 0.0055 * s;
    this.pitch += input.look.y * 0.004 * s * (this.settings.invert ? -1 : 1);
    this.pitch = Math.max(-0.25, Math.min(1.15, this.pitch));
    this.dist = Math.max(3.5, Math.min(13, this.dist + input.zoom * 0.8));

    // tras un rato sin tocar la cámara, se coloca detrás de Lía mientras corre
    const sp = Math.hypot(player.vel.x, player.vel.z);
    if (this.idle > 1.5 && sp > 2 && input.move.y > -0.3) {
      this.yaw += angleDiff(player.facing, this.yaw) * Math.min(1, dt * 0.8);
    }

    const want = player.pos.clone(); want.y += 1.3;
    this.target.lerp(want, 1 - Math.pow(0.00002, dt));
    this._place(dt);
  }
  _place(dt) {
    const cp = Math.cos(this.pitch);
    const dx = Math.sin(this.yaw) * cp, dy = Math.sin(this.pitch), dz = Math.cos(this.yaw) * cp;
    const t = this.target;
    const hit = this.physics.raycast(t.x, t.y, t.z, dx, dy, dz, this.dist + 0.3);
    const wantDist = Math.max(1.2, Math.min(this.dist, hit - 0.35));
    // acercarse rápido, alejarse suave
    this.curDist += (wantDist - this.curDist) * (wantDist < this.curDist ? 1 : Math.min(1, dt * 3));
    this.camera.position.set(t.x + dx * this.curDist, t.y + dy * this.curDist, t.z + dz * this.curDist);
    this.camera.lookAt(t);
  }
}
