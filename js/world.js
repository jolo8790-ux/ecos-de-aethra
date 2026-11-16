import * as THREE from 'three';

// Construye una zona a partir de sus datos (js/zones/*.js): mallas + colisiones + objetos interactivos.

const mats = {};
const mat = (c, o = {}) => {
  const k = c + JSON.stringify(o);
  return mats[k] || (mats[k] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o }));
};
const C = {
  grass: 0x7ccf5f, grassDark: 0x5fae4a, dirt: 0x9a6a45, rock: 0x8d8f99, wood: 0xa0703f, woodDark: 0x6e4a2a,
  plaster: 0xf1e3c8, roofRed: 0xc9563c, roofBlue: 0x4f7fc0, stone: 0xb8b2a6, water: 0x3d8fd6,
};

export class World {
  constructor(scene, physics) {
    this.scene = scene; this.physics = physics;
    this.root = new THREE.Group(); scene.add(this.root);
    this.animated = [];      // objetos con update(t, dt)
    this.interactables = []; // {id,type,pos,radius,mesh,data}
    this.checkpoints = {};   // id -> {pos, facing}
    this.water = null;
  }

  clear() {
    this.root.clear(); this.physics.clear();
    this.animated = []; this.interactables = []; this.checkpoints = {}; this.water = null;
  }

  build(zone, save) {
    this.clear();
    this.zone = zone;
    const z = zone;
    if (z.water) this._water(z.water);
    (z.islands || []).forEach(i => this._island(i));
    (z.boxes || []).forEach(b => this._box(b));
    (z.stairs || []).forEach(s => this._stairs(s));
    (z.ramps || []).forEach(r => this._ramp(r));
    (z.houses || []).forEach(h => this._house(h));
    (z.trees || []).forEach(t => this._tree(t));
    (z.rocks || []).forEach(r => this._rock(r));
    (z.fences || []).forEach(f => this._fence(f));
    (z.lighthouses || []).forEach(l => this._lighthouse(l));
    (z.signs || []).forEach(s => this._sign(s));
    (z.npcs || []).forEach(n => this._npc(n));
    (z.lanterns || []).forEach(l => this._lantern(l, save));
    (z.fragments || []).forEach(f => { if (!save.fragments.includes(f.id)) this._fragment(f); });
    this.checkpoints[z.start.id] = { pos: new THREE.Vector3(...z.start.pos), facing: z.start.facing || 0 };
    this._clouds(z.seed || 1);
  }

  update(t, dt) { for (const a of this.animated) a(t, dt); }

  // ---------- piezas ----------
  _mesh(geo, material, x, y, z, parent = this.root) {
    const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }

  _island({ x, z, w, d, top = 0, depth = 3, rock = true }) {
    this._mesh(new THREE.BoxGeometry(w, depth, d), mat(C.dirt), x, top - depth / 2 - 0.2, z);
    this._mesh(new THREE.BoxGeometry(w + 0.16, 0.4, d + 0.16), mat(C.grass), x, top - 0.2, z);
    if (rock) {
      const r = Math.min(w, d);
      const cone = this._mesh(new THREE.ConeGeometry(r * 0.48, r * 0.75, 7), mat(C.dirt), x, top - depth - r * 0.37, z);
      cone.rotation.x = Math.PI; cone.castShadow = false;
    }
    this.physics.addBox(x, top - depth / 2, z, w, depth, d);
  }

  _box({ x, y, z, w, h, d, color = C.stone, cap }) {
    // y = altura de la cara superior
    const capH = cap ? 0.2 : 0;
    this._mesh(new THREE.BoxGeometry(w, h - capH, d), mat(color), x, y - capH - (h - capH) / 2, z);
    if (cap) this._mesh(new THREE.BoxGeometry(w + 0.1, capH, d + 0.1), mat(cap), x, y - capH / 2, z);
    this.physics.addBox(x, y - h / 2, z, w, h, d);
  }

  _stairs({ x, z, baseY = 0, steps, stepH = 0.35, stepD = 0.6, w = 2, dir = 'z-', color = C.stone }) {
    const [ax, sgn] = [dir[0], dir[1] === '+' ? 1 : -1];
    for (let i = 0; i < steps; i++) {
      const top = baseY + stepH * (i + 1);
      const off = sgn * (i + 0.5) * stepD;
      const cx = ax === 'x' ? x + off : x, cz = ax === 'z' ? z + off : z;
      const h = top - baseY + 0.01;
      this._mesh(new THREE.BoxGeometry(ax === 'x' ? stepD : w, h, ax === 'z' ? stepD : w), mat(color), cx, baseY + h / 2, cz);
      this.physics.addBox(cx, baseY + h / 2, cz, ax === 'x' ? stepD : w, h, ax === 'z' ? stepD : w);
    }
  }

  _ramp({ x, z, w, d, y0, y1, axis = 'z', color = C.wood }) {
    // y0 en el lado mínimo del eje, y1 en el lado máximo
    const len = axis === 'z' ? d : w, rise = y1 - y0;
    const slopeLen = Math.hypot(len, rise), ang = Math.atan2(rise, len);
    const g = new THREE.BoxGeometry(axis === 'x' ? slopeLen : w, 0.25, axis === 'z' ? slopeLen : d);
    const m = this._mesh(g, mat(color), x, (y0 + y1) / 2 - 0.13, z);
    if (axis === 'z') m.rotation.x = -ang; else m.rotation.z = ang;
    // planchas
    const n = Math.floor(slopeLen / 0.5);
    for (let i = 1; i < n; i++) {
      const t = i / n - 0.5;
      const p = this._mesh(new THREE.BoxGeometry(axis === 'z' ? w + 0.05 : 0.06, 0.04, axis === 'z' ? 0.06 : d + 0.05), mat(C.woodDark), 0, 0, 0, m);
      if (axis === 'z') p.position.set(0, 0.13, t * slopeLen); else p.position.set(t * slopeLen, 0.13, 0);
      p.castShadow = false;
    }
    this.physics.addRamp({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, y0, y1, axis });
  }

  _house({ x, z, w, d, h = 3.2, base = 0, roof = C.roofRed, wall = C.plaster, door = 'z+' }) {
    const g = new THREE.Group(); g.position.set(x, base, z); this.root.add(g);
    this._mesh(new THREE.BoxGeometry(w, h, d), mat(wall), 0, h / 2, 0, g);
    // tejado a dos aguas
    const rh = Math.min(w, d) * 0.45;
    const shape = new THREE.Shape(); shape.moveTo(-w / 2 - 0.3, 0); shape.lineTo(0, rh); shape.lineTo(w / 2 + 0.3, 0); shape.lineTo(-w / 2 - 0.3, 0);
    const rg = new THREE.ExtrudeGeometry(shape, { depth: d + 0.6, bevelEnabled: false });
    rg.translate(0, 0, -(d + 0.6) / 2);
    this._mesh(rg, mat(roof), 0, h, 0, g);
    // puerta y ventanas
    const dz = door === 'z+' ? d / 2 + 0.02 : -d / 2 - 0.02;
    this._mesh(new THREE.BoxGeometry(0.9, 1.6, 0.06), mat(C.woodDark), 0, 0.8, dz, g);
    [-1, 1].forEach(s => this._mesh(new THREE.BoxGeometry(0.7, 0.6, 0.06), mat(0x9fd8ff, { emissive: 0x335577, emissiveIntensity: 0.3 }), s * w * 0.3, h * 0.6, dz, g));
    this.physics.addBox(x, base + h / 2, z, w, h, d);
    // el tejado es transitable como una plataforma plana a media altura del caballete
    this.physics.addBox(x, base + h + rh * 0.25, z, w * 0.5, rh * 0.5, d + 0.6);
  }

  _tree({ x, z, y = 0, s = 1 }) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); this.root.add(g);
    this._mesh(new THREE.CylinderGeometry(0.18, 0.26, 1.6, 7), mat(C.woodDark), 0, 0.8, 0, g);
    [[0, 2.1, 0, 1.1], [0.5, 1.7, 0.2, 0.75], [-0.45, 1.8, -0.2, 0.8], [0, 2.8, 0, 0.7]].forEach(([a, b, c, r]) =>
      this._mesh(new THREE.IcosahedronGeometry(r, 0), mat(C.grassDark, { flatShading: true }), a, b, c, g));
    this.physics.addBox(x, y + 0.8 * s, z, 0.5 * s, 1.6 * s, 0.5 * s, { noCamera: true });
    const ph = Math.random() * 6;
    this.animated.push(t => { g.rotation.z = Math.sin(t * 1.3 + ph) * 0.015; });
  }

  _rock({ x, z, y = 0, s = 1 }) {
    const r = this._mesh(new THREE.DodecahedronGeometry(0.7 * s, 0), mat(C.rock, { flatShading: true }), x, y + 0.35 * s, z);
    r.rotation.set(x, z, 0); r.scale.y = 0.75;
    this.physics.addBox(x, y + 0.45 * s, z, 1.1 * s, 0.9 * s, 1.1 * s);
  }

  _fence({ x1, z1, x2, z2, y = 0 }) {
    const len = Math.hypot(x2 - x1, z2 - z1), n = Math.max(2, Math.round(len / 1.2));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      this._mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), mat(C.wood), x1 + (x2 - x1) * t, y + 0.45, z1 + (z2 - z1) * t);
    }
    const rail = this._mesh(new THREE.BoxGeometry(len, 0.08, 0.06), mat(C.wood), (x1 + x2) / 2, y + 0.7, (z1 + z2) / 2);
    rail.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    const rail2 = rail.clone(); rail2.position.y = y + 0.4; this.root.add(rail2);
    // colisión: cajas finas a lo largo
    const steps = Math.ceil(len / 0.8);
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps;
      this.physics.addBox(x1 + (x2 - x1) * t, y + 0.6, z1 + (z2 - z1) * t, 0.3 + Math.abs(x2 - x1) / steps, 1.2, 0.3 + Math.abs(z2 - z1) / steps, { noCamera: true });
    }
  }

  _lighthouse({ x, z, y = 0 }) {
    const g = new THREE.Group(); g.position.set(x, y, z); this.root.add(g);
    for (let i = 0; i < 4; i++) this._mesh(new THREE.CylinderGeometry(1.5 - i * 0.15, 1.6 - i * 0.15, 2, 16), mat(i % 2 ? 0xd9473f : 0xf4f0e6), 0, 1 + i * 2, 0, g);
    this._mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.2, 16), mat(C.woodDark), 0, 8.1, 0, g);
    const lamp = this._mesh(new THREE.SphereGeometry(0.6, 16, 12), mat(0xfff2b0, { emissive: 0xffcc55, emissiveIntensity: 1.2 }), 0, 8.8, 0, g);
    this._mesh(new THREE.ConeGeometry(1.1, 1, 16), mat(0x2f4f6f), 0, 9.7, 0, g);
    this._mesh(new THREE.BoxGeometry(0.9, 1.6, 0.1), mat(C.woodDark), 0, 0.8, 1.52, g);
    const light = new THREE.PointLight(0xffd27a, 2.5, 18, 1.5); light.position.y = 8.8; g.add(light);
    this.animated.push(t => { lamp.material.emissiveIntensity = 1 + Math.sin(t * 2) * 0.3; });
    this.physics.addBox(x, y + 4, z, 2.8, 8, 2.8);
  }

  _water({ y = -2, size = 400, color = C.water }) {
    const geo = new THREE.PlaneGeometry(size, size, 60, 60);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.9, transparent: true, opacity: 0.92, flatShading: true }));
    m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; this.root.add(m);
    const pos = geo.attributes.position, base = pos.array.slice();
    this.water = { y, mesh: m };
    let acc = 0;
    this.animated.push((t, dt) => {
      acc += dt; if (acc < 1 / 30) return; acc = 0; // olas a 30 fps para ahorrar
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3], yy = base[i * 3 + 1];
        pos.array[i * 3 + 2] = Math.sin(x * 0.15 + t) * 0.18 + Math.cos(yy * 0.2 + t * 0.8) * 0.15;
      }
      pos.needsUpdate = true; geo.computeVertexNormals();
    });
  }

  _sign({ id, x, z, y = 0, rot = 0, title, lines }) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; this.root.add(g);
    this._mesh(new THREE.BoxGeometry(0.12, 1.2, 0.12), mat(C.woodDark), 0, 0.6, 0, g);
    this._mesh(new THREE.BoxGeometry(1.1, 0.6, 0.1), mat(C.wood), 0, 1.2, 0.02, g);
    this.physics.addBox(x, y + 0.6, z, 0.3, 1.2, 0.3, { noCamera: true });
    this.interactables.push({ id, type: 'sign', pos: new THREE.Vector3(x, y, z), radius: 1.8, verb: 'Leer', who: title || 'Cartel', lines, mesh: g });
  }

  _npc({ id, x, z, y = 0, rot = 0, name, color = 0x6a8fd8, hair = 0xdddddd, lines }) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; this.root.add(g);
    this._mesh(new THREE.CylinderGeometry(0.28, 0.36, 1.0, 12), mat(color), 0, 0.5, 0, g);
    const head = this._mesh(new THREE.SphereGeometry(0.26, 16, 12), mat(0xe8b48f), 0, 1.25, 0, g);
    this._mesh(new THREE.SphereGeometry(0.27, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(hair), 0, 1.3, 0.02, g);
    [-0.09, 0.09].forEach(ex => this._mesh(new THREE.SphereGeometry(0.035, 6, 5), mat(0x1c1c28), ex, 1.27, -0.24, g));
    // marcador flotante
    const mark = this._mesh(new THREE.OctahedronGeometry(0.12, 0), mat(0xffe27a, { emissive: 0xffb000, emissiveIntensity: 0.8 }), 0, 1.95, 0, g);
    mark.castShadow = false;
    this.physics.addBox(x, y + 0.75, z, 0.8, 1.5, 0.8, { noCamera: true });
    const ph = Math.random() * 6;
    this.animated.push(t => { head.position.y = 1.25 + Math.sin(t * 2 + ph) * 0.02; mark.position.y = 1.95 + Math.sin(t * 3) * 0.08; mark.rotation.y = t * 2; });
    this.interactables.push({ id, type: 'npc', pos: new THREE.Vector3(x, y, z), radius: 2.2, verb: 'Hablar', who: name, lines, mesh: g, mark });
  }

  _lantern({ id, x, z, y = 0, facing = 0 }, save) {
    const g = new THREE.Group(); g.position.set(x, y, z); this.root.add(g);
    this._mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.8, 8), mat(0x3a3a46), 0, 0.9, 0, g);
    const glass = this._mesh(new THREE.BoxGeometry(0.36, 0.45, 0.36), mat(0xfff6d8, { emissive: 0x000000, transparent: true, opacity: 0.9 }), 0, 2.0, 0, g);
    this._mesh(new THREE.ConeGeometry(0.3, 0.25, 4), mat(0x3a3a46), 0, 2.35, 0, g).rotation.y = Math.PI / 4;
    const light = new THREE.PointLight(0xffc870, 0, 8, 1.6); light.position.y = 2; g.add(light);
    this.physics.addBox(x, y + 0.9, z, 0.3, 1.8, 0.3, { noCamera: true });
    const it = { id, type: 'lantern', pos: new THREE.Vector3(x, y, z), radius: 1.6, verb: 'Encender farol', mesh: g, lit: false, auto: true };
    it.light = (on) => { it.lit = on; glass.material = on ? mat(0xfff2b0, { emissive: 0xffb84a, emissiveIntensity: 1.3 }) : mat(0x8a8a90, { transparent: true, opacity: 0.9 }); light.intensity = on ? 2 : 0; };
    it.light(save.checkpoint === id || (save.flags.lit || []).includes(id));
    this.interactables.push(it);
    this.checkpoints[id] = { pos: new THREE.Vector3(x + Math.sin(facing) * -1.2, y, z + Math.cos(facing) * -1.2), facing };
  }

  _fragment({ id, x, y, z }) {
    const g = new THREE.Group(); g.position.set(x, y, z); this.root.add(g);
    const gem = this._mesh(new THREE.OctahedronGeometry(0.3, 0), mat(0x9ff0ff, { emissive: 0x2a9fd0, emissiveIntensity: 0.9, roughness: 0.2, flatShading: true }), 0, 0.8, 0, g);
    gem.scale.y = 1.4;
    const ring = this._mesh(new THREE.TorusGeometry(0.45, 0.025, 6, 24), mat(0xbff6ff, { emissive: 0x66ccff, emissiveIntensity: 0.8 }), 0, 0.8, 0, g);
    ring.castShadow = false;
    const ph = Math.random() * 6;
    this.animated.push(t => { gem.rotation.y = t * 1.8; gem.position.y = 0.8 + Math.sin(t * 2.4 + ph) * 0.12; ring.rotation.x = t * 1.2; ring.rotation.y = t * 0.7; });
    this.interactables.push({ id, type: 'fragment', pos: new THREE.Vector3(x, y, z), radius: 1.1, mesh: g, auto: true });
  }

  _clouds(seed) {
    let s = seed * 9973;
    const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    const cm = mat(0xffffff, { roughness: 1, transparent: true, opacity: 0.9 });
    for (let i = 0; i < 26; i++) {
      const c = new THREE.Group();
      const n = 3 + Math.floor(rnd() * 4);
      for (let j = 0; j < n; j++) {
        const p = new THREE.Mesh(new THREE.SphereGeometry(2 + rnd() * 2.5, 10, 8), cm);
        p.position.set(j * 2.6 - n * 1.3, rnd() * 1.4, rnd() * 2.5); c.add(p);
      }
      const ang = rnd() * Math.PI * 2, r = 60 + rnd() * 70;
      c.position.set(Math.cos(ang) * r, 8 + rnd() * 26, Math.sin(ang) * r);
      this.root.add(c);
      const sp = 0.3 + rnd() * 0.5;
      this.animated.push((t, dt) => { c.position.x += sp * dt; if (c.position.x > 140) c.position.x = -140; });
    }
  }
}
