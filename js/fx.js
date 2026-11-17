import * as THREE from 'three';

// Partículas ligeras (polvo al correr, aterrizar y derrapar; destellos). Usa un grupo fijo de mallas reutilizadas.
export class FX {
  constructor(scene, max = 240) {
    this.items = [];
    const geo = new THREE.IcosahedronGeometry(1, 0);
    for (let i = 0; i < max; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false; scene.add(m);
      this.items.push({ m, vel: new THREE.Vector3(), life: 0, max: 1, size: 0.1, grow: 1, grav: 0 });
    }
    this.next = 0; this.density = 1; // calidad gráfica baja: menos partículas
  }
  _spawn(pos, vel, opts) { if (this.density < 1 && Math.random() > this.density) return; this._spawnNow(pos, vel, opts); }
  _spawnNow(pos, vel, { life = 0.6, size = 0.12, grow = 2, color = 0xe9e2d4, opacity = 0.55, grav = -1, glow = false } = {}) {
    const p = this.items[this.next]; this.next = (this.next + 1) % this.items.length;
    p.m.position.copy(pos); p.vel.copy(vel); p.life = p.max = life; p.size = size; p.grow = grow; p.grav = grav; p.opacity = opacity;
    if (typeof color === 'number') p.m.material.color.setHex(color); else p.m.material.color.copy(color);
    const bl = glow ? THREE.AdditiveBlending : THREE.NormalBlending;
    if (p.m.material.blending !== bl) { p.m.material.blending = bl; p.m.material.needsUpdate = true; }
    p.m.visible = true;
  }
  // estallido de colores del arco iris (fragmentos, logros, portales)
  rainbow(pos, n = 30, power = 1) {
    for (let i = 0; i < n; i++) {
      const c = new THREE.Color().setHSL(i / n, 1, 0.62);
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.1, Math.random() - 0.5).normalize().multiplyScalar((3 + Math.random() * 3) * power);
      this._spawn(pos, v, { life: 0.7 + Math.random() * 0.5, size: 0.07, grow: -0.5, color: c, opacity: 1, grav: -4, glow: true });
    }
  }
  // anillo de colores (doble salto)
  colorRing(pos, hue = 0.55) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, c = new THREE.Color().setHSL((hue + i / 32) % 1, 1, 0.65);
      this._spawn(pos, new THREE.Vector3(Math.cos(a) * 4, -0.3, Math.sin(a) * 4), { life: 0.35, size: 0.07, grow: 1, color: c, opacity: 0.9, grav: 0, glow: true });
    }
  }
  // estela del impulso aéreo
  trail(pos, hue) {
    const c = new THREE.Color().setHSL(hue % 1, 1, 0.65);
    this._spawn(new THREE.Vector3(pos.x + (Math.random() - 0.5) * 0.3, pos.y + 0.6 + Math.random() * 0.6, pos.z + (Math.random() - 0.5) * 0.3), new THREE.Vector3(0, 0.3, 0), { life: 0.45, size: 0.09, grow: -0.6, color: c, opacity: 0.9, grav: 0, glow: true });
  }
  // trozos de roca y brasas al desplomarse una plataforma
  debris(pos) {
    for (let i = 0; i < 18; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 2, (Math.random() - 0.5) * 5);
      const ember = i % 3 === 0;
      this._spawn(new THREE.Vector3(pos.x + (Math.random() - 0.5) * 2, pos.y - 0.3, pos.z + (Math.random() - 0.5) * 2), v,
        { life: 0.9 + Math.random() * 0.5, size: ember ? 0.06 : 0.14, grow: -0.3, color: ember ? 0xff8a2a : 0x7a4a30, opacity: ember ? 1 : 0.9, grav: -14, glow: ember });
    }
  }
  // llamarada (chorro de fuego, quemadura)
  flare(pos) {
    for (let i = 0; i < 16; i++) {
      const c = new THREE.Color().setHSL(0.02 + Math.random() * 0.1, 1, 0.55 + Math.random() * 0.2);
      this._spawn(new THREE.Vector3(pos.x, pos.y + 0.5, pos.z), new THREE.Vector3((Math.random() - 0.5) * 4, 3 + Math.random() * 5, (Math.random() - 0.5) * 4),
        { life: 0.6 + Math.random() * 0.4, size: 0.1, grow: -0.4, color: c, opacity: 1, grav: -2, glow: true });
    }
  }
  dust(pos, n = 6, power = 1, color = 0xe9e2d4) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (0.8 + Math.random() * 1.6) * power;
      this._spawn(new THREE.Vector3(pos.x + Math.cos(a) * 0.2, pos.y + 0.06, pos.z + Math.sin(a) * 0.2),
        new THREE.Vector3(Math.cos(a) * s, 0.4 + Math.random() * 0.8 * power, Math.sin(a) * s),
        { life: 0.4 + Math.random() * 0.3, size: 0.045 + Math.random() * 0.04, grow: 1.8, color, opacity: 0.45, grav: -0.8 });
    }
  }
  puff(pos, dirX, dirZ) { // nube detrás del pie al correr
    this._spawn(new THREE.Vector3(pos.x, pos.y + 0.05, pos.z), new THREE.Vector3(-dirX * 0.6 + (Math.random() - 0.5) * 0.4, 0.35, -dirZ * 0.6 + (Math.random() - 0.5) * 0.4),
      { life: 0.35, size: 0.045, grow: 2, opacity: 0.35, grav: 0 });
  }
  sparkle(pos, n = 14, color = 0x9ff0ff) {
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(2 + Math.random() * 2.5);
      this._spawn(pos, v, { life: 0.5 + Math.random() * 0.4, size: 0.05, grow: -0.6, color, opacity: 0.95, grav: -5 });
    }
  }
  ring(pos, color = 0xffffff) { // anillo de aire en el doble salto
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      this._spawn(pos, new THREE.Vector3(Math.cos(a) * 3, -0.4, Math.sin(a) * 3), { life: 0.3, size: 0.06, grow: 1.5, color, opacity: 0.6, grav: 0 });
    }
  }
  wind(pos, dx, dz) { // líneas de aire que anuncian una ráfaga
    for (let i = 0; i < 10; i++) {
      const o = new THREE.Vector3(pos.x - dx * 4 + (Math.random() - 0.5) * 3, pos.y + 0.4 + Math.random() * 1.6, pos.z - dz * 4 + (Math.random() - 0.5) * 3);
      this._spawn(o, new THREE.Vector3(dx * 9, 0, dz * 9), { life: 0.55, size: 0.05, grow: 0.5, color: 0xffffff, opacity: 0.8, grav: 0 });
    }
  }
  update(dt) {
    for (const p of this.items) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.m.visible = false; continue; }
      p.vel.y += p.grav * dt;
      p.vel.multiplyScalar(Math.pow(0.15, dt));
      p.m.position.addScaledVector(p.vel, dt);
      const k = 1 - p.life / p.max;
      p.m.scale.setScalar(Math.max(0.005, p.size * (1 + p.grow * k)));
      p.m.material.opacity = p.opacity * (1 - k) * (1 - k * 0.3);
    }
  }
}
