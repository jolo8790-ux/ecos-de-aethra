// Vitrina del Taller: el kart flota y gira sobre un pedestal de luz para verlo en detalle.
// Se puede girar arrastrando con el dedo o el ratón. Al pintar o mejorar, cambia en vivo.
import * as THREE from 'three';
import { makeKart, seatDriver } from './race.js';
const DARK = new THREE.MeshStandardMaterial({ color: 0x0c0a18, roughness: 1, metalness: 0, emissive: 0x150a30, emissiveIntensity: 0.6 });

export class Showroom {
  constructor(canvas) {
    this.canvas = canvas; this.on = false; this.key = ''; this.t = 0; this.spin = 0; this.yaw = 0.6; this.drag = null; this.burst = 0;
    this.r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    this.r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); this.r.outputColorSpace = THREE.SRGBColorSpace;
    this.r.toneMapping = THREE.ACESFilmicToneMapping; this.r.toneMappingExposure = 1.15;
    const S = this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 50);
    S.add(new THREE.HemisphereLight(0xfff4ff, 0x4a3a6a, 1.6));
    const key = new THREE.DirectionalLight(0xfff0dd, 2.2); key.position.set(3, 5, 4); S.add(key);
    const rim = new THREE.DirectionalLight(0x9fd8ff, 1.4); rim.position.set(-4, 3, -4); S.add(rim);
    // pedestal de luz
    const ped = new THREE.Group(); S.add(ped);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.95, 0.18, 48), new THREE.MeshStandardMaterial({ color: 0x2a2450, roughness: 0.4, metalness: 0.4 }));
    disc.position.y = -0.09; ped.add(disc);
    const glow = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.86, 0.035, 8, 64), glow); ring.rotation.x = Math.PI / 2; ring.position.y = 0.01; ped.add(ring);
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 2.6, 40, 1, true), new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.beam.position.y = 1.3; // sin columna de luz: el kart flota libre
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(1.2, 32), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.35, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = 0.012; this.shadow.scale.set(0.8, 1.2, 1); ped.add(this.shadow);
    // destellos que suben
    this.sparks = [];
    const sg = new THREE.OctahedronGeometry(0.05, 0);
    for (let i = 0; i < 26; i++) { const m = new THREE.Mesh(sg, glow); m.userData = { a: Math.random() * 6.28, r: 1 + Math.random() * 0.8, y: Math.random() * 2.4, v: 0.3 + Math.random() * 0.5 }; S.add(m); this.sparks.push(m); }
    this.holder = new THREE.Group(); this.holder.scale.setScalar(1.3); S.add(this.holder);
    // fuego del turbo (muestra la estela)
    const fm = this.flameMat = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    this.flames = [-0.3, 0.3].map(x => { const f = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 10), fm); f.rotation.x = -Math.PI / 2; f.position.set(x, 0.45, -1.4); return f; });
    // girar arrastrando
    const down = e => { this.drag = { x: e.clientX, yaw: this.yaw }; canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); };
    const move = e => { if (this.drag) { this.yaw = this.drag.yaw + (e.clientX - this.drag.x) * 0.012; this.idleT = 2.5; } };
    const up = () => { this.drag = null; };
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    this._loop = this._loop.bind(this);
  }
  // muestra un kart (se rehace solo si cambió el kart o la pintura); trail: color de la estela o 'rainbow'
  // opts: { locked: silueta oscura, lib + look + lookKey: piloto sentado }
  show(kartId, paint, trail, opts = {}) {
    const key = kartId + ':' + paint + ':' + !!opts.locked + ':' + (opts.lookKey || '') + ':' + !!opts.lib;
    if (key !== this.key) {
      this.key = key;
      if (this.kart) this.holder.remove(this.kart);
      const made = makeKart(kartId, opts.locked ? null : paint); this.kart = made.kart; this.holder.add(this.kart);
      if (opts.lib && opts.look) { const ch = seatDriver(this.kart, opts.lib, opts.look, made.art); if (ch && opts.lockedDriver) ch.root.traverse(m => { if (m.isMesh) m.material = DARK; }); }
      if (opts.locked) this.kart.traverse(m => { if (m.isMesh) m.material = DARK; });
      for (const f of this.flames) this.kart.add(f);
      this.spin = 1; // pequeño giro de presentación
    }
    this.locked = !!opts.locked;
    this.trail = trail;
    if (trail !== 'rainbow') this.flameMat.color.setHex(trail);
  }
  celebrate() { this.burst = 1.2; this.spin = 1; }
  start() {
    if (this.on) return; this.on = true; this.last = performance.now(); this._resize(); requestAnimationFrame(this._loop);
  }
  stop() { this.on = false; }
  _resize() {
    const w = this.canvas.clientWidth || 480, h = this.canvas.clientHeight || 270;
    if (w !== this._w || h !== this._h) { this._w = w; this._h = h; this.r.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); }
    // que entren el kart a lo ancho y el piloto entero a lo alto (cabeza incluida, aunque flote)
    const t = Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2));
    const far = Math.max(5.4, 2.9 / (t * this.cam.aspect), 2.15 / t);
    this.cam.position.set(0, 1.9, far); this.cam.lookAt(0, 1.05, 0);
  }
  _loop(now) {
    if (!this.on) return; requestAnimationFrame(this._loop);
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.t += dt;
    this._resize();
    this.idleT = Math.max(0, (this.idleT || 0) - dt);
    if (!this.drag && this.idleT <= 0) this.yaw += dt * 0.55;
    this.spin = Math.max(0, this.spin - dt * 1.4);
    const y = 0.32 + Math.sin(this.t * 1.6) * 0.08 + this.spin * 0.25;
    this.holder.position.y = y; this.holder.rotation.set(Math.sin(this.t * 1.1) * 0.03, this.yaw + this.spin * this.spin * 6.28, Math.sin(this.t * 1.3) * 0.025);
    this.shadow.material.opacity = 0.35 - (y - 0.32) * 0.6;
    // turbo de muestra cada pocos segundos (y al comprar)
    this.burst = Math.max(0, this.burst - dt);
    const ph = this.t % 4, show = !this.locked && (this.burst > 0 || (ph > 2.6 && ph < 3.6));
    if (this.trail === 'rainbow') this.flameMat.color.setHSL((this.t * 1.5) % 1, 1, 0.6);
    this.flameMat.opacity += ((show ? 0.75 : 0) - this.flameMat.opacity) * Math.min(1, dt * 10);
    for (const f of this.flames) f.scale.set(1, 0.6 + Math.random() * 0.5 + (show ? 0.4 : 0), 1);
    for (const m of this.sparks) { const u = m.userData; u.y += u.v * dt * (this.burst > 0 ? 4 : 1); if (u.y > 2.6) u.y = 0; m.position.set(Math.cos(u.a + this.t * 0.4) * u.r, u.y, Math.sin(u.a + this.t * 0.4) * u.r); m.rotation.y += dt * 3; }
    this.beam.material.opacity = 0.07 + (this.burst > 0 ? 0.12 * this.burst : 0);
    this.r.render(this.scene, this.cam);
  }
}
