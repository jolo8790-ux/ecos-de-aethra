import * as THREE from 'three';
import { HD, waterMaterial } from './hd.js';
import { prop, hasProp } from './props.js';
import { SeaFoes } from './seafoes.js';

// Mundo submarino: cúpulas de aire, burbujas de oxígeno, algas, peces, rayos de luz, cáusticas,
// medusas que pican, corrientes que empujan, muros de coral que solo rompe el submarino, y el submarino.
const additive = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

export class Sea {
  constructor(world, z) {
    this.w = world; this.root = world.root; this.physics = world.physics; this.cfg = z.sea; this.t = 0;
    this.surface = z.sea.surface; this.domes = []; this.bubbles = []; this.jellies = []; this.currents = []; this.corals = []; this.events = [];
    this._surface(z.sea);
    (z.sea.domes || []).forEach(d => this._dome(d));
    (z.sea.bubbles || []).forEach(b => this._bubble(b));
    (z.sea.kelp || []).forEach(k => this._kelp(k));
    (z.sea.fish || []).forEach(f => this._school(f));
    (z.sea.rays || []).forEach(r => this._ray(r));
    (z.sea.coralDecor || []).forEach(c => this._coralDecor(c));
    (z.sea.jellies || []).forEach(j => this._jelly(j));
    (z.sea.currents || []).forEach(c => this._current(c));
    (z.sea.coralWalls || []).forEach(c => this._coralWall(c));
    if (z.sea.caustics) this._caustics(z.sea.caustics);
    this.foes = new SeaFoes(world, z.sea, world.save); // tiburones, pulpos, erizos y medusas eléctricas
    this._motes();
    this.sub = this._buildSub(); this.sub.visible = false; this.root.add(this.sub);
    if (z.sea.subAt) { const [x, y, zz, rot] = z.sea.subAt; this.parked = new THREE.Vector3(x, y, zz); this.sub.position.copy(this.parked); this.sub.rotation.y = rot || 0; this.sub.visible = true; }
  }

  // superficie vista desde arriba y desde abajo
  _surface({ surface, size = 500 }) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
    c.fillStyle = '#2a8fb8'; c.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 70; i++) { c.strokeStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.3})`; c.lineWidth = 1 + Math.random() * 2; c.beginPath(); const x = Math.random() * 128, y = Math.random() * 128; c.arc(x, y, 4 + Math.random() * 10, 0, Math.PI * (0.3 + Math.random())); c.stroke(); }
    const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(size / 12, size / 12); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), HD.on ? waterMaterial({ shallow: 0x46c8e0, deep: 0x0b5a86, sky: 0xd8f0ff, opacity: 0.84 }) : new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.82, side: THREE.DoubleSide, depthWrite: false }));
    if (HD.on) this.w.animated.push(t => { m.material.uniforms.uTime.value = t; });
    m.rotation.x = -Math.PI / 2; m.position.y = surface; m.renderOrder = 2; this.root.add(m);
    this.surf = m; this.surfTex = tex;
  }
  // cúpula de cristal con aire dentro (se puede respirar y caminar)
  _dome({ x, y, z, r }) {
    const glass = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xbff4ff, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false }));
    glass.position.set(x, y, z); this.root.add(glass);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.18, 8, 48), new THREE.MeshStandardMaterial({ color: 0xd8b25a, metalness: 0.7, roughness: 0.35 }));
    rim.rotation.x = Math.PI / 2; rim.position.set(x, y + 0.05, z); this.root.add(rim);
    const glow = new THREE.PointLight(0x9fe8ff, 1.6, r * 2.5); glow.position.set(x, y + r * 0.7, z); this.root.add(glow);
    this.domes.push({ x, y, z, r });
  }
  inDome(p) { for (const d of this.domes) if (p.y > d.y - 0.6 && Math.hypot(p.x - d.x, p.y + 1 - d.y, p.z - d.z) < d.r - 0.25) return d; return null; }

  // burbuja de aire: se recoge al tocarla y vuelve a salir al rato
  _bubble({ x, y, z, big = false }) {
    const g = new THREE.Group(); g.position.set(x, y, z); this.root.add(g);
    const s = big ? 0.7 : 0.45;
    const m = new THREE.Mesh(new THREE.SphereGeometry(s, 20, 14), new THREE.MeshStandardMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.45, roughness: 0, metalness: 0.3, emissive: 0x66ccff, emissiveIntensity: 0.6 }));
    g.add(m);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(s * 0.25, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })); hl.position.set(-s * 0.35, s * 0.4, s * 0.55); g.add(hl);
    for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.08 + Math.random() * 0.06, 8, 6), m.material); b.userData.o = Math.random(); g.add(b); }
    this.bubbles.push({ g, pos: new THREE.Vector3(x, y, z), amount: big ? 0.75 : 0.45, cd: 0, base: y });
  }
  takeBubble(p, r = 1.3) {
    for (const B of this.bubbles) if (B.cd <= 0 && B.pos.distanceTo(new THREE.Vector3(p.x, p.y + 0.9, p.z)) < r) { B.cd = 8; B.g.visible = false; this.events.push({ type: 'bubble', pos: B.pos.clone() }); return B.amount; }
    return 0;
  }
  nearestAir(p) { // para el modo Automático: la burbuja, cúpula o superficie más cercana
    let best = new THREE.Vector3(p.x, this.surface - 0.6, p.z), bd = this.surface - p.y;
    for (const B of this.bubbles) if (B.cd <= 0) { const d = B.pos.distanceTo(p); if (d < bd) { bd = d; best = B.pos.clone(); } }
    for (const D of this.domes) { const v = new THREE.Vector3(D.x, D.y + 0.2, D.z), d = v.distanceTo(p) - D.r * 0.5; if (d < bd) { bd = d; best = v; } }
    return best;
  }

  _kelp({ x, y, z, h = 8, n = 5 }) {
    for (let i = 0; i < n; i++) {
      const hh = h * (0.6 + Math.random() * 0.6), px = x + (Math.random() - 0.5) * 3, pz = z + (Math.random() - 0.5) * 3;
      const geo = new THREE.PlaneGeometry(0.5, hh, 1, 8); geo.translate(0, hh / 2, 0);
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.27 + Math.random() * 0.08, 0.7, 0.28 + Math.random() * 0.12), side: THREE.DoubleSide, roughness: 0.8 }));
      m.position.set(px, y, pz); m.rotation.y = Math.random() * Math.PI; this.root.add(m);
      const pos = geo.attributes.position, base = pos.array.slice(), ph = Math.random() * 6;
      this.w.animated.push(t => { for (let v = 0; v < pos.count; v++) { const yy = base[v * 3 + 1], k = yy / hh; pos.array[v * 3] = base[v * 3] + Math.sin(t * 1.3 + ph + yy * 0.5) * 0.5 * k * k; } pos.needsUpdate = true; });
    }
  }
  _school({ x, y, z, n = 14, r = 4, color }) {
    const g = new THREE.Group(); g.position.set(x, y, z); this.root.add(g);
    const hue = color != null ? null : Math.random();
    const geo = new THREE.ConeGeometry(0.12, 0.45, 5); geo.rotateZ(-Math.PI / 2);
    const fish = [];
    for (let i = 0; i < n; i++) {
      const c = color != null ? new THREE.Color(color) : new THREE.Color().setHSL((hue + i * 0.03) % 1, 0.9, 0.6);
      const f = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.25, roughness: 0.4 }));
      g.add(f); fish.push({ f, a: Math.random() * 6, rr: r * (0.6 + Math.random() * 0.5), h: (Math.random() - 0.5) * 2, s: 0.5 + Math.random() * 0.3 });
    }
    this.w.animated.push(t => { for (const F of fish) { const a = F.a + t * F.s; F.f.position.set(Math.cos(a) * F.rr, F.h + Math.sin(a * 2) * 0.3, Math.sin(a) * F.rr); F.f.rotation.y = -a; } });
  }
  _ray({ x, z, top, len = 30, r = 3 }) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.5, r * 1.4, len, 16, 1, true), additive(0xbff6ff, 0.07)); m.position.set(x, top - len / 2, z); m.rotation.z = 0.15; this.root.add(m);
    const ph = Math.random() * 6; this.w.animated.push(t => { m.material.opacity = 0.05 + Math.sin(t * 0.7 + ph) * 0.03; });
  }
  // un coral (o roca) del fondo es sólido: caja en el núcleo del modelo (las puntas finas se pueden rozar)
  _solid(o, k = 0.55) {
    o.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o), sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    if (sz.y < 0.5) return; this.physics.addBox(c.x, b.min.y + sz.y * 0.42, c.z, sz.x * k, sz.y * 0.84, sz.z * k);
  }
  _coralDecor({ x, y, z, n = 6, s = 1 }) {
    if (HD.on && hasProp('coral')) { // HD: racimos de coral modelados en vez de conos y bolas
      for (let i = 0; i < Math.max(2, Math.round(n / 2)); i++) { const c = prop('coral', { h: (1 + Math.random() * 1.6) * s }); if (!c) break; c.position.set(x + (Math.random() - 0.5) * 3 * s, y - 0.1, z + (Math.random() - 0.5) * 3 * s); c.rotation.y = Math.random() * 6.28; this.root.add(c);  this._solid(c); }
      return;
    }
    for (let i = 0; i < n; i++) {
      const c = new THREE.Color().setHSL([0.95, 0.05, 0.12, 0.55, 0.8, 0.88][Math.floor(Math.random() * 6)], 0.85, 0.55);
      const mat = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.35, roughness: 0.6, flatShading: true });
      const kind = Math.floor(Math.random() * 3), px = x + (Math.random() - 0.5) * 3 * s, pz = z + (Math.random() - 0.5) * 3 * s;
      let m;
      if (kind === 0) { m = new THREE.Mesh(new THREE.ConeGeometry(0.25 * s, 1.6 * s, 6), mat); m.position.set(px, y + 0.8 * s, pz); }
      else if (kind === 1) { m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 * s, 1), mat); m.position.set(px, y + 0.4 * s, pz); m.scale.y = 0.7; }
      else { m = new THREE.Group(); for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.1 * s, 1.2 * s, 5), mat); b.position.set((Math.random() - 0.5) * 0.4, 0.6 * s, (Math.random() - 0.5) * 0.4); b.rotation.set((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.8); m.add(b); } m.position.set(px, y, pz); }
      this.root.add(m);
    }
  }
  _caustics({ y, size = 300, cx = 0, cz = -100 }) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c = cv.getContext('2d');
    c.strokeStyle = 'rgba(200,250,255,0.55)'; c.lineWidth = 2;
    for (let i = 0; i < 90; i++) { c.beginPath(); let px = Math.random() * 256, py = Math.random() * 256; c.moveTo(px, py); for (let k = 0; k < 3; k++) { px += (Math.random() - 0.5) * 50; py += (Math.random() - 0.5) * 50; c.quadraticCurveTo(px + 10, py - 10, px, py); } c.stroke(); }
    const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(size / 14, size / 14);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(cx, y, cz); this.root.add(m);
    this.w.animated.push(t => { tex.offset.set(Math.sin(t * 0.2) * 0.3, t * 0.02); m.material.opacity = 0.28 + Math.sin(t * 1.7) * 0.08; });
  }
  _motes() { // partículas en suspensión alrededor de la cámara
    const n = 260, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) pos[i] = (Math.random() - 0.5) * 40;
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.motes = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xcff6ff, size: 0.07, transparent: true, opacity: 0.6, depthWrite: false }));
    this.motes.frustumCulled = false; this.root.add(this.motes);
  }

  // medusa: sube y baja; pica al tocarla
  _jelly({ x, y, z, amp = 1.5, speed = 0.8, r = 0.8, hue }) {
    const g = new THREE.Group(); g.position.set(x, y, z); this.root.add(g);
    const c = new THREE.Color().setHSL(hue ?? (0.78 + Math.random() * 0.2) % 1, 0.9, 0.65);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.9, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    g.add(bell);
    const tents = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2, geo = new THREE.CylinderGeometry(0.03, 0.01, r * 2.4, 4); geo.translate(0, -r * 1.2, 0);
      const t = new THREE.Mesh(geo, additive(c, 0.7)); t.position.set(Math.cos(a) * r * 0.6, 0, Math.sin(a) * r * 0.6); g.add(t); tents.push(t);
    }
    this.jellies.push({ g, bell, tents, x, y, z, amp, speed, r, ph: Math.random() * 6, pos: new THREE.Vector3(x, y, z) });
  }
  _current({ x, y, z, w, h, d, fx = 0, fy = 0, fz = 0 }) {
    const n = 40, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), sd = [];
    for (let i = 0; i < n; i++) sd.push([Math.random(), Math.random(), Math.random()]);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xe0fbff, size: 0.18, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
    pts.frustumCulled = false; this.root.add(pts);
    const C = { x, y, z, w, h, d, f: new THREE.Vector3(fx, fy, fz), geo, pos, sd };
    const fl = C.f.length() || 1;
    this.w.animated.push(t => {
      for (let i = 0; i < n; i++) {
        const [a, b, c] = sd[i], k = (c + t * 0.25 * fl / 4) % 1;
        pos[i * 3] = x + (fx ? (k - 0.5) * w * Math.sign(fx) : (a - 0.5) * w);
        pos[i * 3 + 1] = y + (fy ? (k - 0.5) * h * Math.sign(fy) : (b - 0.5) * h);
        pos[i * 3 + 2] = z + (fz ? (k - 0.5) * d * Math.sign(fz) : (a * 0.7 + b * 0.3 - 0.5) * d);
      }
      geo.attributes.position.needsUpdate = true;
    });
    this.currents.push(C);
  }
  currentAt(p) {
    const v = new THREE.Vector3();
    for (const C of this.currents) if (Math.abs(p.x - C.x) < C.w / 2 && Math.abs(p.y + 0.9 - C.y) < C.h / 2 && Math.abs(p.z - C.z) < C.d / 2) v.add(C.f);
    return v;
  }
  // muro de coral: bloquea el paso; el submarino lo rompe al embestirlo
  _coralWall({ x, y, z, w, h, d = 1.6 }) {
    const box = this.physics.addBox(x, y + h / 2, z, w, h, d, { coral: true });
    const g = new THREE.Group(); this.root.add(g);
    if (HD.on && hasProp('coral')) { // HD: muro de arrecife hecho de racimos de coral
      const n = Math.max(4, Math.round(w * h / 14));
      for (let i = 0; i < n; i++) { const c = prop('coral', { h: 2.6 + Math.random() * 2.4 }); if (!c) break; const k = i / n; c.position.set(x + (k - 0.5) * w + (Math.random() - 0.5) * 1.5, y + (i % 2) * h * 0.45 * Math.random(), z + (Math.random() - 0.5) * d); c.rotation.set((Math.random() - 0.5) * 0.6, Math.random() * 6.28, (Math.random() - 0.5) * 0.6); g.add(c); }
      this.corals.push({ box, g, broken: false, x, y: y + h / 2, z, w, h, d });
      return;
    }
    for (let i = 0; i < 26; i++) {
      const c = new THREE.Color().setHSL([0.95, 0.03, 0.85, 0.1][i % 4], 0.8, 0.55);
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8 + Math.random() * 1.2, 0), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.3, flatShading: true, roughness: 0.7 }));
      m.position.set(x + (Math.random() - 0.5) * w, y + Math.random() * h, z + (Math.random() - 0.5) * d); g.add(m);
    }
    this.corals.push({ box, g, broken: false, x, y: y + h / 2, z, w, h, d });
  }
  ram(p, vel) { // el submarino embiste: rompe el muro si va rápido y está pegado a él
    const sp = Math.hypot(vel.x, vel.z);
    for (const C of this.corals) {
      if (C.broken) continue;
      const gx = Math.max(0, Math.abs(p.x - C.x) - C.w / 2), gz = Math.max(0, Math.abs(p.z - C.z) - C.d / 2), gy = Math.max(0, Math.abs(p.y + 0.9 - C.y) - C.h / 2);
      if (Math.hypot(gx, gy, gz) < 1.4 && sp > 3.5) { C.broken = true; C.box.off = true; C.vel = C.g.children.map(() => new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6)); this.events.push({ type: 'coral', pos: new THREE.Vector3(C.x, C.y, C.z) }); return true; }
    }
    return false;
  }

  _buildSub() {
    // Submarino de Nerea: casco de gota amarillo con franjas azules y remaches, cabina de cristal en la proa
    // (Lía va dentro), ojos de buey de latón, torreta con periscopio, timones en cruz, hélice con protector,
    // focos y una luz que barre el fondo. La proa mira a -z.
    const g = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color: 0xffc72e, roughness: 0.32, metalness: 0.25 });
    const stripe = new THREE.MeshStandardMaterial({ color: 0x1f5fa8, roughness: 0.4, metalness: 0.3 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.3, metalness: 0.85 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a3440, roughness: 0.45, metalness: 0.6 });
    const glass = new THREE.MeshStandardMaterial({ color: 0xbff4ff, transparent: true, opacity: 0.28, roughness: 0.02, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide });
    const porthole = new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x3ab8e8, emissiveIntensity: 1.1, roughness: 0.1 });
    const lampM = new THREE.MeshStandardMaterial({ color: 0xfff6d0, emissive: 0xfff0b0, emissiveIntensity: 2 });
    const add = (geo, m, x, y, z, parent = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
    // casco: perfil de gota girado sobre el eje z (proa redonda, popa afilada)
    const pts = [];
    for (let i = 0; i <= 28; i++) { const t = i / 28, zz = -2.3 + t * 4.9, r = 1.12 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.7)), 0.75); pts.push(new THREE.Vector2(Math.max(0.04, r), zz)); }
    const hullR = zz => { const t = (zz + 2.3) / 4.9; return 1.12 * Math.pow(Math.sin(Math.PI * Math.pow(Math.max(0, Math.min(1, t)), 0.7)), 0.75); };
    const hull = add(new THREE.LatheGeometry(pts, 40), paint, 0, 1.0, 0); hull.rotation.x = -Math.PI / 2;
    // franjas y remaches
    for (const zz of [-0.6, 0.6, 1.5]) {
      const r = hullR(zz) + 0.015, ring = add(new THREE.TorusGeometry(r, 0.07, 8, 48), stripe, 0, 1.0, zz); ring.rotation.set(0, 0, 0);
      for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; add(new THREE.SphereGeometry(0.035, 6, 4), brass, Math.cos(a) * (r + 0.03), 1.0 + Math.sin(a) * (r + 0.03), zz + 0.1); }
    }
    // cabina de cristal en la proa, con aro de latón
    const dome = add(new THREE.SphereGeometry(0.88, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.62), glass, 0, 1.5, -0.95); dome.renderOrder = 3;
    const rim = add(new THREE.TorusGeometry(0.8, 0.06, 8, 40), brass, 0, 1.56, -0.95); rim.rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.62, 0.66, 0.12, 20), dark, 0, 1.42, -0.95); // asiento / suelo de la cabina
    // ojo de buey grande en la proa y tres a cada lado
    const bow = add(new THREE.CircleGeometry(0.34, 24), porthole, 0, 0.95, -2.29); bow.rotation.y = Math.PI;
    const bowRim = add(new THREE.TorusGeometry(0.36, 0.06, 8, 30), brass, 0, 0.95, -2.27);
    for (const s of [-1, 1]) for (const zz of [-0.15, 0.55, 1.2]) {
      const r = hullR(zz), px = s * (r - 0.02);
      const win = add(new THREE.CircleGeometry(0.15, 18), porthole, px, 1.12, zz); win.rotation.y = s * Math.PI / 2;
      const wr = add(new THREE.TorusGeometry(0.17, 0.035, 6, 20), brass, px + s * 0.01, 1.12, zz); wr.rotation.y = s * Math.PI / 2;
    }
    // torreta con periscopio y barandilla
    const tower = add(new THREE.CylinderGeometry(0.34, 0.45, 0.55, 18), paint, 0, 2.15, 0.45); tower.scale.z = 1.6;
    add(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 18), stripe, 0, 2.43, 0.45).scale.z = 1.6;
    const peri = add(new THREE.CylinderGeometry(0.05, 0.05, 0.75, 8), dark, 0.12, 2.75, 0.6);
    add(new THREE.BoxGeometry(0.12, 0.12, 0.26), dark, 0.12, 3.1, 0.52);
    // timones de popa en cruz y planos de proa
    for (const [rz, sx, sy] of [[0, 0, 1], [0, 0, -1], [Math.PI / 2, 1, 0], [Math.PI / 2, -1, 0]]) {
      const f = add(new THREE.BoxGeometry(0.07, 0.75, 0.75), stripe, sx * 0.55, 1.0 + sy * 0.55, 2.15); f.rotation.z = rz;
    }
    for (const s of [-1, 1]) { const p = add(new THREE.BoxGeometry(0.75, 0.06, 0.4), stripe, s * 1.25, 0.9, -1.2); p.rotation.z = s * 0.1; }
    // depósitos de lastre bajo los costados
    for (const s of [-1, 1]) { const tk = add(new THREE.CapsuleGeometry(0.2, 1.8, 6, 12), dark, s * 0.85, 0.32, 0.3); tk.rotation.x = Math.PI / 2; }
    // hélice dentro de un protector
    const shroud = add(new THREE.TorusGeometry(0.62, 0.07, 10, 36), brass, 0, 1.0, 2.62);
    const prop = new THREE.Group(); prop.position.set(0, 1.0, 2.6); g.add(prop);
    add(new THREE.SphereGeometry(0.12, 10, 8), brass, 0, 0, 0, prop);
    for (let i = 0; i < 4; i++) { const bl = add(new THREE.BoxGeometry(0.14, 0.5, 0.04), brass, 0, 0, 0, prop); bl.geometry.translate(0, 0.27, 0); bl.rotation.set(0.35, 0, (i / 4) * Math.PI * 2); }
    // focos y luz que barre el fondo
    for (const s of [-1, 1]) { add(new THREE.CylinderGeometry(0.15, 0.12, 0.2, 12), dark, s * 0.55, 0.62, -1.95).rotation.x = Math.PI / 2; add(new THREE.CircleGeometry(0.12, 14), lampM, s * 0.55, 0.62, -2.06).rotation.y = Math.PI; }
    const beam = new THREE.Mesh(new THREE.ConeGeometry(2.4, 10, 24, 1, true), additive(0xfff2c8, 0.05)); beam.geometry.translate(0, -5, 0); beam.rotation.x = -Math.PI / 2; beam.position.set(0, 0.62, -2.1); g.add(beam);
    const light = new THREE.SpotLight(0xfff4d0, 40, 30, 0.55, 0.5, 1.2); light.position.set(0, 0.7, -2); const tgt = new THREE.Object3D(); tgt.position.set(0, 0, -9); g.add(tgt); light.target = tgt; g.add(light);
    const inner = new THREE.PointLight(0x9fe8ff, 1.2, 3); inner.position.set(0, 1.7, -0.95); g.add(inner); // luz de la cabina
    g.userData.prop = prop; g.userData.seat = new THREE.Vector3(0, 1.47, -0.85);
    return g;
  }

  // cada paso: animaciones y peligros. Devuelve picaduras [{from, push}]
  update(dt, player, camera, inSub) {
    this.t += dt; const t = this.t, hits = [];
    this.surfTex.offset.set(t * 0.01, t * 0.006);
    for (const B of this.bubbles) {
      if (B.cd > 0) { B.cd -= dt; if (B.cd <= 0) { B.g.visible = true; B.g.scale.setScalar(0.2); } continue; }
      B.g.scale.multiplyScalar(1 + (1 - B.g.scale.x) * Math.min(1, dt * 4));
      B.g.position.y = B.base + Math.sin(t * 1.6 + B.base) * 0.25; B.pos.y = B.g.position.y;
      B.g.children.forEach((c, i) => { if (i > 1) { const k = (c.userData.o + t * 0.5) % 1; c.position.set(Math.sin(i * 2 + t) * 0.5, k * 1.6, Math.cos(i * 3 + t) * 0.5); } });
    }
    for (const J of this.jellies) {
      const yy = J.y + Math.sin(t * J.speed + J.ph) * J.amp, pulse = 1 + Math.sin(t * 3 + J.ph) * 0.12;
      J.g.position.set(J.x + Math.sin(t * 0.3 + J.ph) * 0.8, yy, J.z); J.bell.scale.set(pulse, 1 / pulse, pulse); J.pos.copy(J.g.position);
      J.tents.forEach((tt, i) => { tt.rotation.x = Math.sin(t * 2 + i) * 0.25; tt.rotation.z = Math.cos(t * 1.7 + i) * 0.25; });
      const d = Math.hypot(player.pos.x - J.pos.x, player.pos.y + 0.9 - (J.pos.y - J.r * 0.5), player.pos.z - J.pos.z);
      if (d < J.r + (inSub ? 1.4 : 0.6)) {
        const away = new THREE.Vector3(player.pos.x - J.pos.x, 0.5, player.pos.z - J.pos.z).normalize();
        if (inSub) { J.x -= away.x * dt * 6; J.z -= away.z * dt * 6; } // el submarino las aparta
        else hits.push({ from: J.pos.clone(), push: away.multiplyScalar(6) });
      }
    }
    for (const C of this.corals) if (C.broken && C.vel) { C.g.children.forEach((m, i) => { const v = C.vel[i]; v.y -= 4 * dt; m.position.addScaledVector(v, dt); m.scale.multiplyScalar(1 - dt * 0.6); }); if (C.g.children[0].scale.x < 0.05) { C.g.visible = false; C.vel = null; } }
    if (this.motes) { this.motes.position.copy(camera.position); this.motes.rotation.y = t * 0.02; }
    if (this.parked && !inSub) this.sub.position.y = this.parked.y + Math.sin(t * 1.2) * 0.12;
    if (inSub) this.sub.userData.prop.rotation.z += dt * 18;
    return hits;
  }
}
