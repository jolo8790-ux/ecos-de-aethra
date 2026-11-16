import * as THREE from 'three';
import { buildHumanoid, NpcAnimator } from './rig.js';
import { createCharacter, NpcModelAnimator, LOOKS } from './characters.js';
import { prop } from './props.js';

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
    this.water = null; this.airships = {};
    this.updrafts = []; this.grapplePoints = []; this.pillars = []; this.movers = [];
    this.locks = []; this.lightCrystals = []; this.lightPlatforms = []; this.darkBarriers = [];
    this.playerPos = new THREE.Vector3();
  }

  clear() {
    this.root.clear(); this.physics.clear();
    this.animated = []; this.interactables = []; this.checkpoints = {}; this.water = null; this.airships = {};
    this.updrafts = []; this.grapplePoints = []; this.pillars = []; this.movers = [];
    this.locks = []; this.lightCrystals = []; this.lightPlatforms = []; this.darkBarriers = [];
  }

  build(zone, save) {
    this.clear();
    this.zone = zone;
    const z = zone;
    this.pal = { top: C.grass, side: C.dirt, ...(z.palette || {}) };
    if (z.water) this._water(z.water);
    (z.islands || []).forEach(i => this._island(i));
    (z.boxes || []).forEach(b => this._box(b));
    (z.stairs || []).forEach(s => this._stairs(s));
    (z.ramps || []).forEach(r => this._ramp(r));
    (z.houses || []).forEach(h => this._house(h));
    (z.trees || []).forEach(t => this._tree(t));
    (z.bigTrees || []).forEach(t => this._bigTree(t));
    (z.mushrooms || []).forEach(m => this._mushroom(m));
    (z.bridges || []).forEach(b => this._bridge(b));
    (z.movers || []).forEach(m => this._mover(m));
    (z.updrafts || []).forEach(u => this._updraft(u));
    (z.grapples || []).forEach(g => this._grapplePoint(g));
    (z.pillars || []).forEach(p => this._pillar(p));
    (z.arches || []).forEach(a => this._arch(a));
    (z.columns || []).forEach(c => this._column(c));
    (z.crystals || []).forEach(c => this._crystalCluster(c));
    (z.tents || []).forEach(t => this._tent(t));
    (z.gears || []).forEach(g => this._gear(g));
    (z.towers || []).forEach(t => this._tower(t));
    (z.pines || []).forEach(p => this._pine(p));
    (z.icicleWalls || []).forEach(p => this._icicleWall(p));
    (z.obelisks || []).forEach(p => this._obelisk(p));
    (z.banners || []).forEach(p => this._banner(p));
    (z.locks || []).forEach(l => this._lock(l, save));
    (z.lightPlatforms || []).forEach(p => this._lightPlatform(p));
    (z.lightCrystals || []).forEach(c => this._lightCrystal(c, save));
    for (const c of this.lightCrystals) if (c._initial) c.set(true);
    (z.darkBarriers || []).forEach(b => this._darkBarrier(b, save));
    if (z.snow) this._snow(z.snow);
    if (z.id === 'bosque_colgante') this._fireflies(60);
    (z.rocks || []).forEach(r => this._rock(r));
    (z.fences || []).forEach(f => this._fence(f));
    (z.lighthouses || []).forEach(l => this._lighthouse(l));
    (z.signs || []).forEach(s => this._sign(s));
    (z.npcs || []).forEach(n => this._npc(n));
    (z.items || []).forEach(i => this._item(i));
    (z.triggers || []).forEach(t => this._trigger(t));
    (z.airships || []).forEach(a => this._airship(a));
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

  // Modelo 3D generado (assets/props); devuelve null si no está y el builder usa sus primitivas.
  _model(id, fit, x, y, z, { rotY = 0, parent = this.root, tint } = {}) {
    const m = prop(id, fit, { tint });
    if (!m) return null;
    m.position.set(x, y, z); m.rotation.y = rotY; parent.add(m);
    return m;
  }

  _island({ x, z, w, d, top = 0, depth = 3, rock = true }) {
    const pal = this.pal || { top: C.grass, side: C.dirt };
    this._mesh(new THREE.BoxGeometry(w, depth, d), mat(pal.side), x, top - depth / 2 - 0.2, z);
    this._mesh(new THREE.BoxGeometry(w + 0.16, 0.4, d + 0.16), mat(pal.top), x, top - 0.2, z);
    if (rock) {
      const r = Math.min(w, d);
      const cone = this._mesh(new THREE.ConeGeometry(r * 0.48, r * 0.75, 7), mat(pal.side), x, top - depth - r * 0.37, z);
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

  // Aplica las condiciones de la historia: muestra u oculta lo que depende del progreso.
  applyConditions(S) {
    for (const u of [...this.updrafts, ...this.grapplePoints]) {
      if (!u.when) continue;
      const on = !!u.when(S);
      if (on === u.active) continue;
      u.active = on; if (u.mesh) u.mesh.visible = on;
    }
    for (const it of this.interactables) {
      if (!it.when) continue;
      const on = !!it.when(S);
      if (on === it.active) continue;
      it.active = on;
      if (it.mesh) it.mesh.visible = on;
      if (it.mark) it.mark.visible = on;
      if (it.box) it.box.off = !on;
    }
  }

  _item({ id, x, y = 0, z, verb = 'Recoger', model = 'key', when, radius = 1.5 }) {
    const g = new THREE.Group(); g.position.set(x, y, z); this.root.add(g);
    const gold = mat(0xe8b94a, { metalness: 0.6, roughness: 0.3, emissive: 0x6a4a00, emissiveIntensity: 0.4 });
    const k = new THREE.Group(); k.position.y = 0.75; g.add(k);
    if (model === 'bigshard') {
      const gem = this._mesh(new THREE.OctahedronGeometry(0.5, 0), mat(0xbff8ff, { emissive: 0x3ac8ff, emissiveIntensity: 1.6, roughness: 0.1, flatShading: true }), 0, 0.6, 0, k);
      gem.scale.y = 1.5;
      for (let i = 0; i < 3; i++) { const r = this._mesh(new THREE.TorusGeometry(0.9 + i * 0.25, 0.03, 6, 32), mat(0xdffcff, { emissive: 0x6ad8ff, emissiveIntensity: 1 }), 0, 0.6, 0, k); r.rotation.x = 1 + i; r.castShadow = false; }
      const pedestal = this._mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.5, 10), mat(0x9a9a8a, { flatShading: true }), 0, 0.25, 0, g);
      pedestal.castShadow = false;
      this.physics.addBox(x, y + 0.25, z, 1.8, 0.5, 1.8);
      k.position.y = 1.2;
    }
    if (model === 'glider') {
      const cloth = mat(0xf2e6c8, { side: THREE.DoubleSide });
      const sh = new THREE.Shape(); sh.moveTo(-0.7, 0); sh.lineTo(0.7, 0); sh.lineTo(0, -0.5); sh.lineTo(-0.7, 0);
      const sail = this._mesh(new THREE.ShapeGeometry(sh), cloth, 0, 0, 0, k); sail.rotation.x = 0.4;
      this._mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.5, 6), mat(C.woodDark), 0, 0.02, 0, k).rotation.z = Math.PI / 2;
    }
    if (model === 'hook') {
      const metal = mat(0xb8b8c8, { metalness: 0.7, roughness: 0.3 });
      this._mesh(new THREE.TorusGeometry(0.18, 0.04, 8, 16, Math.PI * 1.3), metal, 0, -0.1, 0, k);
      this._mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.45, 8), metal, 0, 0.2, 0, k);
      this._mesh(new THREE.TorusGeometry(0.12, 0.03, 6, 12), gold, 0, 0.5, 0, k);
    }
    if (model === 'heart') { // el Corazón de Aethra, con sus cinco fragmentos alrededor
      const core = this._mesh(new THREE.IcosahedronGeometry(0.55, 0), mat(0xfff2d8, { emissive: 0xffb84a, emissiveIntensity: 1.4, flatShading: true }), 0, 0.9, 0, k);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const s = this._mesh(new THREE.OctahedronGeometry(0.22, 0), mat(0xbff8ff, { emissive: 0x3ac8ff, emissiveIntensity: 1.4, flatShading: true }), Math.cos(a) * 1.1, 0.9, Math.sin(a) * 1.1, k); s.scale.y = 1.5; }
      const pedestal = this._mesh(new THREE.CylinderGeometry(1.4, 1.7, 0.7, 10), mat(0x2a2235, { flatShading: true }), 0, 0.35, 0, g);
      this.physics.addBox(x, y + 0.35, z, 2.8, 0.7, 2.8);
      k.position.y = 1.4; core.userData.core = true;
    }
    if (model === 'shield') {
      this._mesh(new THREE.CircleGeometry(0.4, 6), mat(0xbff4ff, { emissive: 0x4ad8ff, emissiveIntensity: 0.9, transparent: true, opacity: 0.6, side: THREE.DoubleSide }), 0, 0.2, 0, k);
      this._mesh(new THREE.TorusGeometry(0.4, 0.04, 6, 6), mat(0xe8fbff, { emissive: 0x7ae8ff, emissiveIntensity: 1.2 }), 0, 0.2, 0, k);
    }
    if (model === 'key') {
      this._mesh(new THREE.TorusGeometry(0.13, 0.035, 8, 16), gold, 0, 0.14, 0, k);
      this._mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.36, 8), gold, 0, -0.14, 0, k);
      this._mesh(new THREE.BoxGeometry(0.1, 0.05, 0.03), gold, 0.05, -0.26, 0, k);
      this._mesh(new THREE.BoxGeometry(0.07, 0.05, 0.03), gold, 0.04, -0.17, 0, k);
    }
    const glow = new THREE.PointLight(0xffd27a, 1.2, 4, 2); glow.position.y = 0.8; g.add(glow);
    const baseY = k.position.y;
    this.animated.push(t => { k.rotation.y = t * 1.6; k.position.y = baseY + Math.sin(t * 2.2) * 0.08; });
    this.interactables.push({ id, type: 'item', pos: new THREE.Vector3(x, y, z), radius, verb, who: '', lines: [], mesh: g, when, headY: 0.8 });
  }

  _trigger({ id, x, y = 0, z, radius = 1.8, verb = 'Usar', name = '', lines = [], when }) {
    this.interactables.push({ id, type: 'trigger', pos: new THREE.Vector3(x, y, z), radius, verb, who: name, lines, when, headY: 1.2 });
  }

  _airship({ id, x, y, z }) {
    const g = new THREE.Group(); g.position.set(x, y, z); this.root.add(g);
    const cream = mat(0xf1e3c8), red = mat(0xc9563c), wood = mat(C.wood), dark = mat(C.woodDark), brass = mat(0xd4a24c, { metalness: 0.5, roughness: 0.4 });
    const balloon = this._mesh(new THREE.SphereGeometry(2.4, 28, 18), cream, 0, 4.4, 0, g);
    balloon.scale.set(1, 0.82, 1.9);
    [-2.6, 0, 2.6].forEach(zz => { const rr = 2.4 * Math.sqrt(1 - (zz / 4.56) ** 2) + 0.04; const r = this._mesh(new THREE.TorusGeometry(rr, 0.09, 8, 36), red, 0, 4.4, zz, g); r.scale.y = 0.82; });
    this._mesh(new THREE.SphereGeometry(2.42, 28, 18, 0, Math.PI * 2, 0, 0.5), red, 0, 4.4, 0, g).scale.set(1, 0.82, 1.9); // casquete
    [[0, 6.1, 3.6, 0], [1.5, 4.4, 3.6, Math.PI / 2], [-1.5, 4.4, 3.6, Math.PI / 2]].forEach(([fx, fy, fz, rz]) => {
      const f = this._mesh(new THREE.BoxGeometry(0.08, 1.3, 1.4), red, fx, fy, fz, g); f.rotation.z = rz;
    });
    this._mesh(new THREE.BoxGeometry(2.2, 0.7, 3.8), wood, 0, 0.35, 0, g);
    this._mesh(new THREE.BoxGeometry(2.3, 0.12, 3.9), dark, 0, 0.72, 0, g);
    this._mesh(new THREE.BoxGeometry(1.2, 0.5, 0.9), dark, 0, 0.98, -1.2, g); // cabina
    [[-1, -1.7], [1, -1.7], [-1, 1.7], [1, 1.7]].forEach(([rx, rz]) => {
      const rope = this._mesh(new THREE.CylinderGeometry(0.025, 0.025, 3.4, 4), dark, rx * 1.15, 2.4, rz * 1.1, g);
      rope.rotation.z = -rx * 0.12; rope.castShadow = false;
    });
    const prop = new THREE.Group(); prop.position.set(0, 0.5, 2.15); g.add(prop);
    this._mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8), brass, 0, 0, 0, prop).rotation.x = Math.PI / 2;
    [0, 1, 2].forEach(i => { const b = this._mesh(new THREE.BoxGeometry(0.12, 0.9, 0.04), brass, 0, 0, 0.12, prop); b.rotation.z = i * Math.PI * 2 / 3; b.geometry.translate(0, 0.45, 0); });
    // pasarela desde el muelle
    const plank = this._mesh(new THREE.BoxGeometry(1.0, 0.08, 3.4), wood, 0, -0.62, -3.3, g); plank.rotation.x = -0.36;
    const a = { group: g, plank, base: new THREE.Vector3(x, y, z), prop, spin: 3, seat: new THREE.Vector3(0.3, 0.72, 0.4), offset: new THREE.Vector3() };
    this.airships[id] = a;
    this.physics.addBox(x, y + 0.36, z, 2.2, 0.72, 3.8, { noCamera: true });
    this.animated.push((t, dt) => {
      g.position.set(a.base.x + a.offset.x, a.base.y + a.offset.y + Math.sin(t * 0.9) * 0.12, a.base.z + a.offset.z);
      g.rotation.z = Math.sin(t * 0.7) * 0.02;
      prop.rotation.z += dt * a.spin;
      plank.visible = a.offset.lengthSq() < 0.01;
    });
  }

  // ---------- piezas de los capítulos 2 y 3 ----------
  _mover({ x, y, z, w = 3, d = 3, h = 0.6, axis = 'z', range = 5, speed = 0.6, phase = 0, color = 0xb08a4a }) {
    const g = new THREE.Group(); this.root.add(g);
    this._mesh(new THREE.BoxGeometry(w, h, d), mat(color, { metalness: 0.4, roughness: 0.5 }), 0, -h / 2, 0, g);
    [-1, 1].forEach(sx => [-1, 1].forEach(sz => this._mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 10), mat(0x6a4a2a, { metalness: 0.6 }), sx * (w / 2 - 0.3), 0.03, sz * (d / 2 - 0.3), g)));
    const box = this.physics.addBox(x, y - h / 2, z, w, h, d);
    box.delta = new THREE.Vector3();
    const base = new THREE.Vector3(x, y, z), prev = base.clone();
    const m = { box, g, base };
    this.movers.push(m);
    this.animated.push((t) => {
      const off = Math.sin(t * speed + phase) * range;
      const p = base.clone(); p[axis] += off;
      box.delta.copy(p).sub(prev); prev.copy(p);
      box.minX = p.x - w / 2; box.maxX = p.x + w / 2; box.minZ = p.z - d / 2; box.maxZ = p.z + d / 2; box.minY = p.y - h; box.maxY = p.y;
      g.position.copy(p);
    });
  }

  _updraft({ x, z, y0, y1, r = 2.4, when }) {
    const g = new THREE.Group(); g.position.set(x, y0, z); this.root.add(g);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.8, y1 - y0, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }));
    col.position.y = (y1 - y0) / 2; g.add(col);
    const n = 40, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), seeds = [];
    for (let i = 0; i < n; i++) seeds.push([Math.random() * Math.PI * 2, Math.random() * r * 0.9, Math.random()]);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.15, transparent: true, opacity: 0.8, depthWrite: false }));
    g.add(pts);
    const H = y1 - y0;
    this.animated.push(t => {
      for (let i = 0; i < n; i++) { const [a, rr, o] = seeds[i]; const k = (o + t * 0.35) % 1; pos[i * 3] = Math.cos(a + t) * rr; pos[i * 3 + 1] = k * H; pos[i * 3 + 2] = Math.sin(a + t) * rr; }
      geo.attributes.position.needsUpdate = true;
    });
    this.updrafts.push({ x, z, y0, y1, r, when, mesh: g });
  }

  _grapplePoint({ x, y, z, when, land = false }) {
    const g = new THREE.Group(); g.position.set(x, y, z); this.root.add(g);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xffe27a, emissive: 0xffb02a, emissiveIntensity: 0.9, metalness: 0.5, roughness: 0.3 });
    const ring = this._mesh(new THREE.TorusGeometry(0.42, 0.08, 10, 24), ringMat, 0, 0, 0, g);
    this._mesh(new THREE.SphereGeometry(0.14, 10, 8), mat(0x6a4a2a, { metalness: 0.6 }), 0, 0.5, 0, g);
    const glow = new THREE.PointLight(0xffd27a, 1, 5, 2); g.add(glow);
    const gp = { pos: new THREE.Vector3(x, y, z), mesh: g, when, land, ringMat };
    this.animated.push(t => { ring.rotation.y = t * 1.2; ringMat.emissiveIntensity = gp.highlight ? 2.2 + Math.sin(t * 12) * 0.5 : 0.9; });
    this.grapplePoints.push(gp);
  }

  _pillar({ x, z, y = 0, h = 4.5, r = 0.75 }) {
    const g = new THREE.Group(); g.position.set(x, y, z); this.root.add(g);
    const glass = new THREE.MeshStandardMaterial({ color: 0xbff0ff, emissive: 0x2a8ab0, emissiveIntensity: 0.35, transparent: true, opacity: 0.8, roughness: 0.05, flatShading: true });
    this._mesh(new THREE.CylinderGeometry(r * 0.8, r, h, 6), glass, 0, h / 2, 0, g);
    this._mesh(new THREE.ConeGeometry(r * 0.8, 1, 6), glass, 0, h + 0.5, 0, g);
    this._mesh(new THREE.CylinderGeometry(r * 1.3, r * 1.4, 0.4, 8), mat(0xc8a878, { flatShading: true }), 0, 0.2, 0, g);
    const box = this.physics.addBox(x, y + h / 2, z, r * 1.6, h, r * 1.6);
    const p = { pos: new THREE.Vector3(x, y, z), r: r * 0.9 + 0.2, box, mesh: g, alive: true };
    p.break = () => { if (!p.alive) return; p.alive = false; box.off = true; this.root.remove(g); };
    this.pillars.push(p);
  }

  _arch({ x, z, y = 0, rot = 0, w = 5, h = 5 }) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; this.root.add(g);
    const stone = mat(0xd8b88a, { flatShading: true });
    if (!this._model('arco_ruina', { x: w + 1.4, y: h + 0.9, z: 1.4 }, 0, 0, 0, { parent: g })) {
      [-1, 1].forEach(s => this._mesh(new THREE.BoxGeometry(0.9, h, 0.9), stone, s * w / 2, h / 2, 0, g));
      this._mesh(new THREE.BoxGeometry(w + 1.2, 0.8, 1.0), stone, 0, h + 0.4, 0, g);
    }
    [-1, 1].forEach(s => {
      const c = Math.cos(rot), sn = Math.sin(rot);
      this.physics.addBox(x + c * s * w / 2, y + h / 2, z - sn * s * w / 2, 0.9, h, 0.9);
    });
  }

  _column({ x, z, y = 0, h = 3, broken = false }) {
    if (this._model('columna_ruina', { x: 1.3, y: h + 0.2, z: 1.3 }, x, y, z, { rotY: (x * 3 + z) % 6.28 })) { this.physics.addBox(x, y + h / 2, z, 0.9, h, 0.9, { noCamera: true }); return; }
    const stone = mat(0xd8b88a, { flatShading: true });
    const c = this._mesh(new THREE.CylinderGeometry(0.45, 0.5, h, 8), stone, x, y + h / 2, z);
    if (broken) c.rotation.z = 0.08;
    this._mesh(new THREE.BoxGeometry(1.2, 0.3, 1.2), stone, x, y + 0.15, z);
    this.physics.addBox(x, y + h / 2, z, 0.9, h, 0.9, { noCamera: true });
  }

  _crystalCluster({ x, z, y = 0, s = 1, color = 0x9ff0ff }) {
    const cm = this._model('cristales', { h: 2.5 * s }, x, y, z, { rotY: (x * 2 + z) % 6.28 });
    if (cm) {
      cm.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.emissive = new THREE.Color(color); o.material.emissiveIntensity = 0.18; o.material.emissiveMap = o.material.map; } });
      this.physics.addBox(x, y + 0.6 * s, z, 0.9 * s, 1.2 * s, 0.9 * s, { noCamera: true }); return;
    }
    const m = mat(color, { emissive: color, emissiveIntensity: 0.25, transparent: true, opacity: 0.85, flatShading: true, roughness: 0.1 });
    [[0, 1.2, 0, 0.35, 2.4, 0], [0.4, 0.7, 0.1, 0.22, 1.4, -0.4], [-0.35, 0.6, 0.2, 0.2, 1.2, 0.5], [0.1, 0.5, -0.35, 0.18, 1.0, 0.3]].forEach(([a, b, c, r, h, rz]) => {
      const o = this._mesh(new THREE.ConeGeometry(r * s, h * s, 6), m, x + a * s, y + b * s, z + c * s); o.rotation.z = rz;
    });
    this.physics.addBox(x, y + 0.6 * s, z, 0.9 * s, 1.2 * s, 0.9 * s, { noCamera: true });
  }

  _tent({ x, z, y = 0, rot = 0 }) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; this.root.add(g);
    const cloth = mat(0xc87a4a, { flatShading: true });
    if (this._model('carpa', { w: 3.4 }, 0, 0, 0, { parent: g })) { this.physics.addBox(x, y + 1, z, 2.4, 2, 2.4); return; }
    const tent = this._mesh(new THREE.ConeGeometry(1.8, 2.2, 4), cloth, 0, 1.1, 0, g); tent.rotation.y = Math.PI / 4;
    this._mesh(new THREE.BoxGeometry(0.7, 1.2, 0.05), mat(0x3a2a1a), 0, 0.6, 1.25, g);
    this._mesh(new THREE.BoxGeometry(0.8, 0.5, 0.6), mat(C.wood), 2.2, 0.25, 0.5, g); // caja de mapas
    this.physics.addBox(x, y + 1, z, 2.4, 2, 2.4);
  }

  _gear({ x, y, z, r = 2, axis = 'z', speed = 0.5, color = 0xb08a4a }) {
    const g = new THREE.Group(); g.position.set(x, y, z); this.root.add(g);
    const brass = mat(color, { metalness: 0.6, roughness: 0.35, flatShading: true });
    const wheel = new THREE.Group(); g.add(wheel);
    this._mesh(new THREE.CylinderGeometry(r, r, 0.4, 24), brass, 0, 0, 0, wheel);
    this._mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.3, 0.6, 12), mat(0x5a4a3a, { metalness: 0.6 }), 0, 0, 0, wheel);
    const teeth = Math.round(r * 7);
    for (let i = 0; i < teeth; i++) { const a = (i / teeth) * Math.PI * 2; const t = this._mesh(new THREE.BoxGeometry(0.35, 0.4, 0.35), brass, Math.cos(a) * (r + 0.12), 0, Math.sin(a) * (r + 0.12), wheel); t.rotation.y = -a; }
    if (axis === 'z') wheel.rotation.x = Math.PI / 2; else if (axis === 'x') wheel.rotation.z = Math.PI / 2;
    const spin = new THREE.Group(); g.add(spin); spin.add(wheel);
    this.animated.push((t, dt) => { if (axis === 'z') spin.rotation.z += speed * dt; else if (axis === 'x') spin.rotation.x += speed * dt; else spin.rotation.y += speed * dt; });
  }

  _tower({ x, z, y = -14, h = 30, w = 4, color = 0x7a6a5a }) {
    const g = new THREE.Group(); g.position.set(x, y, z); this.root.add(g);
    const stone = mat(color, { flatShading: true }), brass = mat(0xb08a4a, { metalness: 0.5, roughness: 0.4 });
    if (this._model('torre', { x: w * 1.25, y: h + w * 1.1, z: w * 1.25 }, 0, 0, 0, { parent: g, rotY: (x + z) % 6.28 })) { this.physics.addBox(x, y + h / 2, z, w, h, w); return; }
    this._mesh(new THREE.BoxGeometry(w, h, w), stone, 0, h / 2, 0, g);
    for (let i = 1; i < 5; i++) this._mesh(new THREE.BoxGeometry(w + 0.3, 0.4, w + 0.3), brass, 0, (h / 5) * i, 0, g);
    this._mesh(new THREE.ConeGeometry(w * 0.85, w * 1.1, 4), mat(0x4a3a6a, { flatShading: true }), 0, h + w * 0.55, 0, g).rotation.y = Math.PI / 4;
    const win = mat(0xffd27a, { emissive: 0xffa040, emissiveIntensity: 1.2 });
    for (let i = 0; i < 6; i++) this._mesh(new THREE.BoxGeometry(0.5, 0.8, 0.1), win, (i % 2 ? 1 : -1) * w * 0.25, h * 0.4 + i * 2.5, w / 2 + 0.05, g).castShadow = false;
    this.physics.addBox(x, y + h / 2, z, w, h, w);
  }

  // ---------- piezas de los capítulos 4 y 5 ----------
  // Cerradura de hielo: un ojo de cristal en la pared; un orbe devuelto con el escudo la rompe y abre su puerta.
  _lock({ id, x, y, z, rot = 0, gate, flag, base }, save) {
    const open = !!save.flags[flag];
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; this.root.add(g);
    const frame = this._mesh(new THREE.TorusGeometry(0.75, 0.15, 8, 6), mat(0x8aa0b8, { flatShading: true }), 0, 0, 0, g);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xbff4ff, emissive: 0x4ad8ff, emissiveIntensity: open ? 0.1 : 1.4, flatShading: true });
    const eye = this._mesh(new THREE.OctahedronGeometry(0.45, 0), eyeMat, 0, 0, 0, g);
    if (base !== undefined && y - base > 0.3) { this._mesh(new THREE.BoxGeometry(0.35, y - base, 0.35), mat(0x6a7a8a, { flatShading: true }), 0, -(y - base) / 2 - 0.4, 0, g); this.physics.addBox(x, (y + base) / 2 - 0.4, z, 0.4, y - base, 0.4, { noCamera: true }); }
    let gateMesh = null, gateBox = null;
    if (gate) {
      gateMesh = this._mesh(new THREE.BoxGeometry(gate.w, gate.h, gate.d), new THREE.MeshStandardMaterial({ color: 0xc8f0ff, emissive: 0x2a7ab0, emissiveIntensity: 0.4, transparent: true, opacity: 0.75, roughness: 0.05, flatShading: true }), gate.x, gate.y - gate.h / 2, gate.z);
      gateBox = this.physics.addBox(gate.x, gate.y - gate.h / 2, gate.z, gate.w, gate.h, gate.d);
      if (open) { gateMesh.visible = false; gateBox.off = true; }
    }
    const L = { id, flag, pos: new THREE.Vector3(x, y, z), open, eyeMat, gateMesh, gateBox, gate };
    this.animated.push(t => { if (!L.open) { eye.rotation.y = t; eyeMat.emissiveIntensity = 1.2 + Math.sin(t * 4) * 0.4; } });
    this.locks.push(L);
  }
  openLock(L) {
    if (L.open) return;
    L.open = true; L.eyeMat.emissiveIntensity = 0.1;
    if (L.gateMesh) { L.gateMesh.visible = false; L.gateBox.off = true; }
  }

  // Cristal de luz: el pulso lo enciende y hace aparecer los puentes de luz que tiene enlazados.
  _lightCrystal({ id, x, y = 0, z, flag }, save) {
    const g = new THREE.Group(); g.position.set(x, y, z); this.root.add(g);
    this._mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.6, 8), mat(0x6a5a7a, { flatShading: true }), 0, 0.3, 0, g);
    const cm = new THREE.MeshStandardMaterial({ color: 0x8a7a9a, emissive: 0xfff2a8, emissiveIntensity: 0, flatShading: true, roughness: 0.2 });
    const gem = this._mesh(new THREE.OctahedronGeometry(0.45, 0), cm, 0, 1.3, 0, g); gem.scale.y = 1.6;
    const light = new THREE.PointLight(0xfff2a8, 0, 8, 1.6); light.position.y = 1.3; g.add(light);
    this.physics.addBox(x, y + 0.3, z, 1.2, 0.6, 1.2, { noCamera: true });
    const C = { id, flag, pos: new THREE.Vector3(x, y + 1.2, z), on: false, cm, light };
    C.set = on => { C.on = on; cm.emissiveIntensity = on ? 1.6 : 0; cm.color.setHex(on ? 0xfff6d0 : 0x8a7a9a); light.intensity = on ? 2.2 : 0; for (const p of this.lightPlatforms) if (p.crystal === id) p.set(on); };
    this.animated.push(t => { gem.rotation.y = t * (C.on ? 1.5 : 0.3); });
    this.lightCrystals.push(C);
    C._initial = !!save.flags[flag];
  }
  _lightPlatform({ crystal, x, y, z, w = 2.5, d = 2.5 }) {
    const m = this._mesh(new THREE.BoxGeometry(w, 0.3, d), new THREE.MeshStandardMaterial({ color: 0xfff6d0, emissive: 0xffd27a, emissiveIntensity: 0.9, transparent: true, opacity: 0.85 }), x, y - 0.15, z);
    m.castShadow = false;
    const ghost = this._mesh(new THREE.BoxGeometry(w, 0.3, d), new THREE.MeshBasicMaterial({ color: 0xfff2a8, wireframe: true, transparent: true, opacity: 0.25 }), x, y - 0.15, z);
    ghost.castShadow = false;
    const box = this.physics.addBox(x, y - 0.15, z, w, 0.3, d, { noCamera: true });
    const P = { crystal, mesh: m, ghost, box };
    P.set = on => { m.visible = on; ghost.visible = !on; box.off = !on; };
    P.set(false);
    this.lightPlatforms.push(P);
  }
  // Barrera de sombra: bloquea el paso hasta que el pulso de luz la deshace.
  _darkBarrier({ id, x, y = 0, z, w = 4, h = 3.5, d = 0.6, flag }, save) {
    if (save.flags[flag]) return;
    const matB = new THREE.MeshStandardMaterial({ color: 0x3a1a5a, emissive: 0x5a2aa8, emissiveIntensity: 0.8, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false });
    const m = this._mesh(new THREE.BoxGeometry(w, h, d), matB, x, y + h / 2, z); m.castShadow = false;
    const box = this.physics.addBox(x, y + h / 2, z, w, h, d);
    const B = { id, flag, pos: new THREE.Vector3(x, y + h / 2, z), half: Math.max(w, d) / 2, mesh: m, box, gone: false };
    this.animated.push(t => { if (!B.gone) { matB.emissiveIntensity = 0.7 + Math.sin(t * 3 + x) * 0.3; m.scale.x = 1 + Math.sin(t * 5) * 0.01; } });
    this.darkBarriers.push(B);
  }
  dispelBarrier(B) { if (B.gone) return; B.gone = true; B.box.off = true; this.root.remove(B.mesh); }

  _pine({ x, z, y = 0, s = 1 }) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); this.root.add(g);
    if (this._model('pino_nevado', { h: 4.2 }, 0, 0, 0, { parent: g, rotY: (x * 5 + z) % 6.28 })) { this.physics.addBox(x, y + 1 * s, z, 0.5 * s, 2 * s, 0.5 * s, { noCamera: true }); return; }
    this._mesh(new THREE.CylinderGeometry(0.15, 0.22, 1.2, 6), mat(0x5a4030), 0, 0.6, 0, g);
    [[1.3, 1.6, 1.6], [1.0, 1.4, 2.5], [0.7, 1.2, 3.3]].forEach(([r, h, yy]) => {
      this._mesh(new THREE.ConeGeometry(r, h, 7), mat(0x3a6a5a, { flatShading: true }), 0, yy, 0, g);
      this._mesh(new THREE.ConeGeometry(r * 0.85, h * 0.45, 7), mat(0xf4fbff, { flatShading: true }), 0, yy + h * 0.3, 0, g);
    });
    this.physics.addBox(x, y + 1 * s, z, 0.5 * s, 2 * s, 0.5 * s, { noCamera: true });
  }
  _snow(n) {
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), seeds = [];
    for (let i = 0; i < n; i++) seeds.push([(Math.random() - 0.5) * 40, Math.random() * 20, (Math.random() - 0.5) * 40, Math.random() * 6]);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.85, depthWrite: false }));
    pts.frustumCulled = false; this.root.add(pts);
    this.animated.push(t => {
      const c = this.playerPos;
      for (let i = 0; i < n; i++) { const [x, y, z, ph] = seeds[i]; pos[i * 3] = c.x + x + Math.sin(t * 0.7 + ph) * 0.8; pos[i * 3 + 1] = c.y - 4 + ((y - t * 1.4) % 20 + 20) % 20; pos[i * 3 + 2] = c.z + z + Math.cos(t * 0.5 + ph) * 0.8; }
      geo.attributes.position.needsUpdate = true;
    });
  }
  _icicleWall({ x, y = 0, z, w = 3, h = 3 }) { // decoración: cascada helada
    const m = mat(0xc8f0ff, { emissive: 0x2a7ab0, emissiveIntensity: 0.3, transparent: true, opacity: 0.85, flatShading: true, roughness: 0.05 });
    for (let i = 0; i < 6; i++) { const c = this._mesh(new THREE.ConeGeometry(0.35 + (i % 3) * 0.1, h * (0.6 + (i % 2) * 0.4), 6), m, x - w / 2 + (i + 0.5) * w / 6, y + h / 2, z); c.rotation.x = Math.PI; }
  }
  _obelisk({ x, y = 0, z, h = 7 }) {
    const g = new THREE.Group(); g.position.set(x, y, z); this.root.add(g);
    if (this._model('obelisco', { x: 1.6, y: h + 1.2, z: 1.6 }, 0, 0, 0, { parent: g })) { this.physics.addBox(x, y + h / 2, z, 1.2, h, 1.2); return; }
    this._mesh(new THREE.BoxGeometry(1.2, h, 1.2), mat(0x2a2235, { flatShading: true }), 0, h / 2, 0, g);
    this._mesh(new THREE.ConeGeometry(0.85, 1.2, 4), mat(0xd4a24c, { metalness: 0.6 }), 0, h + 0.6, 0, g).rotation.y = Math.PI / 4;
    const rune = mat(0xb07aff, { emissive: 0x8a3aff, emissiveIntensity: 1.2 });
    for (let i = 0; i < 3; i++) this._mesh(new THREE.BoxGeometry(0.3, 0.6, 0.05), rune, 0, h * 0.35 + i * 1.3, 0.62, g).castShadow = false;
    this.physics.addBox(x, y + h / 2, z, 1.2, h, 1.2);
  }
  _banner({ x, y = 0, z, rot = 0 }) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; this.root.add(g);
    this._mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.5, 6), mat(0x3a3a46), 0, 2.25, 0, g);
    const cloth = this._mesh(new THREE.PlaneGeometry(1.1, 2.2, 1, 6), mat(0x5a1a4a, { side: THREE.DoubleSide }), 0.6, 3.2, 0, g);
    const sym = this._mesh(new THREE.CircleGeometry(0.28, 6), mat(0xd4a24c, { side: THREE.DoubleSide, emissive: 0x6a4a10, emissiveIntensity: 0.5 }), 0.6, 3.4, 0.01, g);
    this.animated.push(t => { cloth.rotation.y = Math.sin(t * 1.5 + x) * 0.15; sym.rotation.y = cloth.rotation.y; });
    this.physics.addBox(x, y + 2.25, z, 0.3, 4.5, 0.3, { noCamera: true });
  }

  _bigTree({ x, z, y = -14, r = 2.4, h = 48 }) {
    const g = new THREE.Group(); g.position.set(x, y, z); this.root.add(g);
    const bark = mat(0x6a4a32, { flatShading: true });
    const trunk = this._mesh(new THREE.CylinderGeometry(r * 0.8, r * 1.15, h, 10, 4), bark, 0, h / 2, 0, g);
    trunk.receiveShadow = true;
    for (let i = 0; i < 4; i++) { // raíces aéreas
      const a = i * 1.57 + x;
      const rt = this._mesh(new THREE.CylinderGeometry(0.25, 0.5, 6, 6), bark, Math.cos(a) * r * 1.2, 4, Math.sin(a) * r * 1.2, g);
      rt.rotation.z = Math.cos(a) * 0.5; rt.rotation.x = -Math.sin(a) * 0.5;
    }
    const leaf = mat(0x3f8a4a, { flatShading: true }), leaf2 = mat(0x5aa85a, { flatShading: true });
    [[0, h + 2, 0, 7], [5, h - 1, 2, 5], [-5, h, -2, 5.5], [1, h - 2, -5, 4.5], [-2, h - 3, 5, 4.5]].forEach(([a, b, c, rr], i) => {
      const m = this._mesh(new THREE.IcosahedronGeometry(rr, 0), i % 2 ? leaf2 : leaf, a, b, c, g); m.castShadow = false;
    });
    const vine = mat(0x4f8a3a);
    for (let i = 0; i < 6; i++) { // lianas colgando
      const a = (i / 6) * Math.PI * 2 + z, len = 8 + (i % 3) * 5;
      const v = this._mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 4), vine, Math.cos(a) * 4.5, h - 3 - len / 2, Math.sin(a) * 4.5, g);
      v.castShadow = false;
      const ph = i + x;
      this.animated.push(t => { v.rotation.z = Math.sin(t * 0.7 + ph) * 0.04; });
    }
    this.physics.addBox(x, y + h / 2, z, r * 1.7, h, r * 1.7);
  }

  _mushroom({ x, y = 0, z, s = 1, bounce = 0 }) {
    const g = new THREE.Group(); g.position.set(x, y, z); this.root.add(g);
    const capCol = bounce ? 0xf27ac8 : 0xc8643a;
    if (!bounce && this._model('seta', { h: 1.7 * s }, 0, 0, 0, { parent: g, rotY: (x + z) % 6.28 })) {
      this.physics.addBox(x, y + 1.25 * s, z, 1.5 * s, 0.5 * s, 1.5 * s);
      this.physics.addBox(x, y + 0.5 * s, z, 0.5 * s, 1.0 * s, 0.5 * s, { noCamera: true });
      return;
    }
    this._mesh(new THREE.CylinderGeometry(0.25 * s, 0.35 * s, 1.1 * s, 10), mat(0xf2e6cf), 0, 0.55 * s, 0, g);
    const cap = new THREE.Group(); cap.position.y = 1.0 * s; g.add(cap);
    const c = this._mesh(new THREE.SphereGeometry(0.95 * s, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(capCol, { emissive: bounce ? 0x6a1a5a : 0x000000, emissiveIntensity: 0.4 }), 0, 0, 0, cap);
    c.scale.y = 0.55;
    for (let i = 0; i < 6; i++) {
      const a = i * 1.1, rr = 0.55 * s;
      this._mesh(new THREE.SphereGeometry(0.11 * s, 6, 4), mat(0xfff4e6), Math.cos(a) * rr, 0.38 * s, Math.sin(a) * rr, cap).scale.y = 0.4;
    }
    const top = y + 1.0 * s + 0.5 * s;
    const box = this.physics.addBox(x, top - 0.25 * s, z, 1.5 * s, 0.5 * s, 1.5 * s);
    this.physics.addBox(x, y + 0.5 * s, z, 0.5 * s, 1.0 * s, 0.5 * s, { noCamera: true });
    if (bounce) {
      box.bounce = bounce;
      let sq = 0;
      box.onBounce = () => { sq = 1; };
      this.animated.push((t, dt) => { sq = Math.max(0, sq - dt * 3); const k = Math.sin(sq * Math.PI * 3) * sq * 0.35; cap.scale.set(1 + k, 1 - k, 1 + k); });
      const glow = new THREE.PointLight(0xff8ae0, 1.2, 6, 2); glow.position.y = 1.4 * s; g.add(glow);
    }
  }

  _bridge({ x1, z1, x2, z2, y = 0, w = 2.2 }) {
    const len = Math.hypot(x2 - x1, z2 - z1), ang = Math.atan2(x2 - x1, z2 - z1);
    const g = new THREE.Group(); g.position.set((x1 + x2) / 2, y, (z1 + z2) / 2); g.rotation.y = ang; this.root.add(g);
    const n = Math.floor(len / 0.5);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n - 0.5;
      const p = this._mesh(new THREE.BoxGeometry(w, 0.12, 0.42), mat(i % 2 ? C.wood : 0x8a5f36), 0, -0.06 - Math.sin((i / n) * Math.PI) * 0.12, t * len, g);
      p.rotation.y = (Math.random() - 0.5) * 0.04;
    }
    [-1, 1].forEach(sd => {
      for (let i = 0; i <= 4; i++) this._mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 5), mat(C.woodDark), sd * (w / 2), 0.4, (i / 4 - 0.5) * len, g);
      const rope = this._mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 4), mat(0xc8b48a), sd * (w / 2), 0.85, 0, g);
      rope.rotation.x = Math.PI / 2; rope.castShadow = false;
    });
    // colisión: tablero continuo (ligeramente más ancho) y barandas bajas
    const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    const alongX = Math.abs(x2 - x1) > Math.abs(z2 - z1);
    this.physics.addBox(cx, y - 0.25, cz, alongX ? len : w, 0.5, alongX ? w : len);
  }

  _fireflies(n) {
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), base = [];
    for (let i = 0; i < n; i++) { const p = [(Math.random() - 0.5) * 30, Math.random() * 8 - 1, -Math.random() * 110 + 8]; base.push(p); pos.set(p, i * 3); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xfff6a0, size: 0.18, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.root.add(pts);
    this.animated.push(t => {
      for (let i = 0; i < n; i++) { const b = base[i]; pos[i * 3] = b[0] + Math.sin(t * 0.5 + i) * 1.2; pos[i * 3 + 1] = b[1] + Math.sin(t * 0.8 + i * 2) * 0.6; pos[i * 3 + 2] = b[2] + Math.cos(t * 0.4 + i) * 1.2; }
      geo.attributes.position.needsUpdate = true;
      pts.material.opacity = 0.6 + Math.sin(t * 3) * 0.3;
    });
  }

  _tree({ x, z, y = 0, s = 1 }) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); this.root.add(g);
    if (this._model('arbol', { h: 3.6 }, 0, 0, 0, { parent: g, rotY: (x * 7 + z * 3) % 6.28 })) {
      this.physics.addBox(x, y + 0.8 * s, z, 0.5 * s, 1.6 * s, 0.5 * s, { noCamera: true });
      const ph = Math.random() * 6; this.animated.push(t => { g.rotation.z = Math.sin(t * 1.3 + ph) * 0.015; });
      return;
    }
    this._mesh(new THREE.CylinderGeometry(0.18, 0.26, 1.6, 7), mat(C.woodDark), 0, 0.8, 0, g);
    [[0, 2.1, 0, 1.1], [0.5, 1.7, 0.2, 0.75], [-0.45, 1.8, -0.2, 0.8], [0, 2.8, 0, 0.7]].forEach(([a, b, c, r]) =>
      this._mesh(new THREE.IcosahedronGeometry(r, 0), mat(C.grassDark, { flatShading: true }), a, b, c, g));
    this.physics.addBox(x, y + 0.8 * s, z, 0.5 * s, 1.6 * s, 0.5 * s, { noCamera: true });
    const ph = Math.random() * 6;
    this.animated.push(t => { g.rotation.z = Math.sin(t * 1.3 + ph) * 0.015; });
  }

  _rock({ x, z, y = 0, s = 1 }) {
    if (this._model('roca', { w: 1.5 * s }, x, y - 0.05 * s, z, { rotY: (x + z) % 6.28 })) { this.physics.addBox(x, y + 0.45 * s, z, 1.1 * s, 0.9 * s, 1.1 * s); return; }
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

  _npc({ id, x, z, y = 0, rot = 0, name, lines, look = {}, style = 'calm', when, model }) {
    let rig, anim, s;
    if (model && this.chars) { // personaje animado con malla y esqueleto
      rig = createCharacter(this.chars, model);
      anim = new NpcModelAnimator(rig, rot, { style });
      s = (LOOKS[model] && LOOKS[model].scale) || 1;
    } else {                   // respaldo hecho con formas
      rig = buildHumanoid({ top: 0x6a8fd8, hair: 0xdddddd, hairStyle: 'short', ...look });
      anim = new NpcAnimator(rig, rot, { style });
      s = look.scale || 1;
    }
    rig.root.position.set(x, y, z); rig.root.rotation.y = rot; this.root.add(rig.root);
    const mark = this._mesh(new THREE.OctahedronGeometry(0.12, 0), mat(0xffe27a, { emissive: 0xffb000, emissiveIntensity: 0.8 }), x, y + 2.0 * s, z);
    mark.castShadow = false;
    const box = this.physics.addBox(x, y + 0.8 * s, z, 0.8 * s, 1.6 * s, 0.8 * s, { noCamera: true });
    const it = { id, type: 'npc', pos: new THREE.Vector3(x, y, z), radius: 2.2, verb: 'Hablar', who: name, lines, mesh: rig.root, mark, anim, headY: 1.6 * s, when, box };
    this.animated.push((t, dt) => {
      anim.talking = !!it.talking;
      anim.update(dt, this.playerPos);
      mark.position.y = y + 2.0 * s + Math.sin(t * 3) * 0.08; mark.rotation.y = t * 2;
      mark.visible = !it.talking && it.active !== false;
    });
    this.interactables.push(it);
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
    const cm = mat(0xffffff, { roughness: 1, transparent: true, opacity: 0.9, emissive: (this.zone && this.zone.sky.bottom) || 0xffffff, emissiveIntensity: 0.45 });
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
