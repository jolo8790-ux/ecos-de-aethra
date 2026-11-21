import * as THREE from 'three';
import { buildHumanoid, NpcAnimator } from './rig.js';
import { createCharacter, NpcModelAnimator, LOOKS } from './characters.js';
import { prop, freeGPU } from './props.js';
import { Hazards } from './hazards.js';
import { HD, makeCloudSea, makeCumulus, waterfall, fluffyTree, patchGround, organicIsland, canopyBlob, waterMaterial } from './hd.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Sea } from './sea.js';

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


// ---------- texturas del terreno (hechas a mano en un canvas, una sola vez) ----------
function seeded(seed) { let a = (Math.abs(seed * 1e4) | 0) + 1; return () => { a = (a * 16807) % 2147483647; return (a - 1) / 2147483646; }; }
const terrTex = {};
function terrainTexture(kind) {
  if (terrTex[kind]) return terrTex[kind];
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d'), R = seeded(kind === 'grain' ? 3 : 9);
  c.fillStyle = '#f2f2f2'; c.fillRect(0, 0, 128, 128);
  if (kind === 'grain') { // manchas suaves y motas: hierba, arena o nieve con textura
    for (let i = 0; i < 26; i++) { const g = c.createRadialGradient(R() * 128, R() * 128, 0, R() * 128, R() * 128, 10 + R() * 26); const v = 200 + R() * 55; g.addColorStop(0, `rgba(${v},${v},${v},.55)`); g.addColorStop(1, 'rgba(242,242,242,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); }
    for (let i = 0; i < 900; i++) { const v = 185 + R() * 70; c.fillStyle = `rgb(${v},${v},${v})`; c.fillRect(R() * 128, R() * 128, 1 + R() * 1.5, 1 + R() * 1.5); }
  } else { // vetas horizontales de roca con grietas
    let y = 0; while (y < 128) { const hh = 4 + R() * 12, v = 175 + R() * 70; c.fillStyle = `rgb(${v},${v},${v})`; c.fillRect(0, y, 128, hh); y += hh; }
    for (let i = 0; i < 600; i++) { const v = 150 + R() * 100; c.fillStyle = `rgba(${v},${v},${v},.6)`; c.fillRect(R() * 128, R() * 128, 1 + R() * 3, 1); }
    c.strokeStyle = 'rgba(90,90,90,.35)'; c.lineWidth = 1;
    for (let i = 0; i < 10; i++) { c.beginPath(); let px = R() * 128, py = R() * 128; c.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (R() - 0.5) * 16; py += R() * 14; c.lineTo(px, py); } c.stroke(); }
  }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return terrTex[kind] = t;
}
const terrMats = {};
function terrainMat(color, kind, flat = false) {
  const k = color + kind + flat;
  return terrMats[k] || (terrMats[k] = new THREE.MeshStandardMaterial({ color, map: terrainTexture(kind), roughness: 0.92, flatShading: flat }));
}
// coordenadas de textura en metros para cada cara de una caja (para que la textura no se estire)
function worldUV(geo, w, h, d, tile) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const f = Math.floor(i / 4), su = f < 2 ? d : w, sv = f < 2 ? h : f < 4 ? d : h;
    uv.setXY(i, uv.getX(i) * su / tile, uv.getY(i) * sv / tile);
  }
}
const _v1 = new THREE.Vector3();
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
    freeGPU(this.root); this.root.clear(); this.physics.clear();
    this.animated = []; this.interactables = []; this.checkpoints = {}; this.water = null; this.airships = {};
    this.updrafts = []; this.grapplePoints = []; this.pillars = []; this.movers = [];
    this.locks = []; this.lightCrystals = []; this.lightPlatforms = []; this.darkBarriers = [];
    this.fadeables = []; this.portal = null; this.breakables = [];
  }

  build(zone, save) {
    this.clear(); this.save = save;
    this.zone = zone;
    const z = zone;
    this.pal = { top: C.grass, side: C.dirt, ...(z.palette || {}) };
    if (z.water && !z.lava) this._water(z.water);
    this.hz = new Hazards(this); this.hz.build(z);
    if (!z.sea) this._scatter(z); // hierba, flores, guijarros o escarcha sobre las islas
    this.sea = z.sea ? new Sea(this, z) : null; // nivel submarino
    (z.islands || []).forEach(i => this._island(i));
    (z.boxes || []).forEach(b => this._box(b));
    (z.stairs || []).forEach(s => this._stairs(s));
    (z.ramps || []).forEach(r => this._ramp(r));
    (z.houses || []).forEach(h => this._house(h));
    (z.trees || []).forEach(t => this._fw(() => this._tree(t)));
    (z.bigTrees || []).forEach(t => this._bigTree(t));
    (z.mushrooms || []).forEach(m => this._mushroom(m));
    (z.bridges || []).forEach(b => this._bridge(b));
    (z.movers || []).forEach(m => this._mover(m));
    (z.updrafts || []).forEach(u => this._updraft(u));
    (z.grapples || []).forEach(g => this._grapplePoint(g));
    (z.pillars || []).forEach(p => this._pillar(p));
    (z.arches || []).forEach(a => this._arch(a));
    (z.columns || []).forEach(c => this._fw(() => this._column(c)));
    (z.crystals || []).forEach(c => this._fw(() => this._crystalCluster(c)));
    (z.tents || []).forEach(t => this._tent(t));
    (z.gears || []).forEach(g => this._gear(g));
    (z.towers || []).forEach(t => this._tower(t));
    (z.pines || []).forEach(p => this._fw(() => this._pine(p)));
    (z.icicleWalls || []).forEach(p => this._icicleWall(p));
    (z.obelisks || []).forEach(p => this._obelisk(p));
    (z.banners || []).forEach(p => this._fw(() => this._banner(p)));
    (z.locks || []).forEach(l => this._lock(l, save));
    (z.lightPlatforms || []).forEach(p => this._lightPlatform(p));
    (z.lightCrystals || []).forEach(c => this._lightCrystal(c, save));
    for (const c of this.lightCrystals) if (c._initial) c.set(true);
    (z.darkBarriers || []).forEach(b => this._darkBarrier(b, save));
    if (z.snow) this._snow(z.snow);
    if (z.id === 'bosque_colgante') this._fireflies(60);
    (z.rocks || []).forEach(r => this._rock(r));
    (z.props || []).forEach(p => this._prop(p));
    (z.breakables || []).forEach(b => this._breakable(b, save));
    (z.fences || []).forEach(f => this._fence(f));
    (z.lighthouses || []).forEach(l => this._lighthouse(l));
    (z.signs || []).forEach(s => this._fw(() => this._sign(s)));
    (z.npcs || []).forEach(n => this._fw(() => this._npc(n)));
    (z.items || []).forEach(i => this._item(i));
    (z.triggers || []).forEach(t => this._trigger(t));
    (z.airships || []).forEach(a => this._airship(a));
    (z.lanterns || []).forEach(l => this._fw(() => this._lantern(l, save)));
    (z.fragments || []).forEach(f => { if (!save.fragments.includes(f.id)) this._fragment(f); });
    this.checkpoints[z.start.id] = { pos: new THREE.Vector3(...z.start.pos), facing: z.start.facing || 0 };
    if (z.portal) this._portal(z.portal);
    this._clouds(z.seed || 1);
  }

  update(t, dt) { for (const a of this.animated) a(t, dt); }

  // ---------- piezas ----------
  _mesh(geo, material, x, y, z, parent = this.root) {
    const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }

  // Decorado fino que la cámara puede atravesar: se vuelve translúcido cuando tapa a Lía o la cámara entra en él.
  _fw(build) {
    const n0 = this.root.children.length; build();
    const objs = this.root.children.slice(n0); if (!objs.length) return;
    const box = new THREE.Box3(); objs.forEach(o => box.expandByObject(o));
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    this.fadeables.push({ objs, c, r: Math.max(0.6, Math.max(sz.x, sz.z) * 0.5), h: sz.y * 0.5, k: 1, mats: null });
  }
  // cam: posición de la cámara; tgt: punto que mira (Lía)
  updateFade(cam, tgt, dt) {
    const ab = _v1.subVectors(cam, tgt), len2 = ab.lengthSq();
    for (const f of this.fadeables) {
      // distancia del eje vertical del objeto al segmento cámara-Lía (en planta) y altura compatible
      const t = len2 > 0 ? Math.max(0, Math.min(1, ((f.c.x - tgt.x) * ab.x + (f.c.z - tgt.z) * ab.z) / (ab.x * ab.x + ab.z * ab.z || 1))) : 0;
      const px = tgt.x + ab.x * t, py = tgt.y + ab.y * t, pz = tgt.z + ab.z * t;
      const dxz = Math.hypot(px - f.c.x, pz - f.c.z), dy = Math.abs(py - f.c.y);
      const block = t > 0.08 && dxz < f.r + 0.25 && dy < f.h + 0.3;
      const want = block ? 0.22 : 1;
      if (f.k === want && !f.mats) continue;
      f.k += (want - f.k) * Math.min(1, dt * 10); if (Math.abs(f.k - want) < 0.02) f.k = want;
      if (!f.mats) { // clona los materiales una sola vez, la primera vez que hace falta
        if (want === 1) continue;
        f.mats = [];
        for (const o of f.objs) o.traverse(m => {
          if (!m.isMesh || !m.material || m.userData.noFade) return;
          m.material = m.material.clone(); f.mats.push([m.material, m.material.opacity, m.material.depthWrite]);
          m.material.transparent = true; m.material.needsUpdate = true;
        });
      }
      const fading = f.k < 0.999;
      for (const [m, op, dw] of f.mats) { m.opacity = op * f.k; m.depthWrite = fading ? false : dw; }
    }
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
    if (HD.on) {
      const og = organicIsland({ w, d, top: 0, depth, rock, seed: x * 0.37 + z * 0.71, sideMat: terrainMat(pal.side, 'strata'), topMat: patchGround(terrainMat(pal.top, 'grain')) });
      og.position.set(x, top, z); this.root.add(og);
      // la física se agranda lo mismo que el contorno redondeado, para no caerse por el borde de pasto
      const rr = og.userData.r;
      this.physics.addBox(x, top - depth / 2, z + d / 2 + rr / 2, w, depth, rr); this.physics.addBox(x, top - depth / 2, z - d / 2 - rr / 2, w, depth, rr);
      this.physics.addBox(x + w / 2 + rr / 2, top - depth / 2, z, rr, depth, d); this.physics.addBox(x - w / 2 - rr / 2, top - depth / 2, z, rr, depth, d);
      this.physics.addBox(x, top - depth / 2, z, w, depth, d);
      // cascada en las islas grandes, hacia el mar de nubes
      const zn = this.zone, seaY = zn && zn.water && !zn.lava ? zn.water.y : null;
      if (seaY != null && w * d > 140 && top - seaY > 1.5) {
        const rnd2 = seeded(x * 3.3 + z * 5.1), sideK = Math.floor(rnd2() * 4), off = (rnd2() - 0.5) * 0.5;
        // punto del contorno en el lado elegido (sin esquinas), pegado a la pared de roca
        const ol = og.userData.outline, want = [[0, 1], [1, 0], [0, -1], [-1, 0]][sideK];
        const cands = ol.filter(p => p.nx === want[0] && p.nz === want[1]);
        const P = cands[Math.floor((0.5 + off * 0.6) * cands.length)] || ol[0];
        waterfall(this.root, this.animated, { x: x + P.x * 0.97, z: z + P.z * 0.97, top: top - 0.35, seaY, dir: Math.atan2(P.nx, P.nz), outlet: terrainMat(pal.side, 'strata') });
      }
    } else {
    const side = new THREE.BoxGeometry(w, depth, d); worldUV(side, w, depth, d, 3.5);
    this._mesh(side, terrainMat(pal.side, 'strata'), x, top - depth / 2 - 0.2, z);
    const cap = new THREE.BoxGeometry(w + 0.16, 0.4, d + 0.16); worldUV(cap, w, 0.4, d, 3);
    this._mesh(cap, terrainMat(pal.top, 'grain'), x, top - 0.2, z);
    }
    if (rock && !HD.on) { // roca colgante irregular (y alguna más pequeña al lado)
      const r = Math.min(w, d), rnd = seeded(x * 13.1 + z * 7.7);
      const hang = (rr, hh, ox, oz) => {
        const geo = new THREE.ConeGeometry(rr, hh, 9, 4); const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) { const yy = pos.getY(i); if (yy > hh / 2 - 0.01) continue; const k = 1 + (rnd() - 0.5) * 0.35; pos.setX(i, pos.getX(i) * k); pos.setZ(i, pos.getZ(i) * k); pos.setY(i, yy + (rnd() - 0.5) * hh * 0.08); }
        geo.computeVertexNormals();
        const cone = this._mesh(geo, terrainMat(pal.side, 'strata', true), x + ox, top - depth - hh * 0.49, z + oz);
        cone.rotation.x = Math.PI; cone.rotation.y = rnd() * 6; cone.castShadow = false;
      };
      hang(r * 0.48, r * 0.75, 0, 0);
      if (r > 3.5 && r < 30) { hang(r * 0.18, r * 0.42, (rnd() - 0.5) * w * 0.5, (rnd() - 0.5) * d * 0.5); hang(r * 0.14, r * 0.3, (rnd() - 0.5) * w * 0.5, (rnd() - 0.5) * d * 0.5); }
    }
    if (!HD.on) this.physics.addBox(x, top - depth / 2, z, w, depth, d);
  }

  // ---------- vegetación y detalles sobre las islas (instanciados: muy baratos) ----------
  _scatter(z) {
    const pal = this.pal || { top: C.grass, side: C.dirt };
    const hsl = {}; new THREE.Color(pal.top).getHSL(hsl);
    const kind = hsl.l > 0.78 && hsl.s < 0.45 ? 'snow' : hsl.l < 0.36 ? 'ash' : hsl.h > 0.17 && hsl.h < 0.47 && hsl.s > 0.22 ? 'grass' : 'sand';
    const R = seeded((z.seed || 7) * 1.37), spots = [];
    for (const I of z.islands || []) {
      if (I.w < 3 || I.d < 3) continue;
      const n = Math.min(HD.on ? 320 : 160, Math.floor(I.w * I.d * (kind === 'grass' ? (HD.on ? 0.55 : 0.32) : 0.1) * (this.detail ?? 1)));
      for (let i = 0; i < n; i++) spots.push([I.x + (R() - 0.5) * (I.w - 0.6), I.top, I.z + (R() - 0.5) * (I.d - 0.6)]);
    }
    if (!spots.length) return;
    const shuffle = spots.sort(() => R() - 0.5).slice(0, 5000);
    const dummy = new THREE.Object3D(), col = new THREE.Color(), base = new THREE.Color(pal.top);
    const time = { value: 0 }; this.animated.push(t => { time.value = t; });
    const sway = m => { m.onBeforeCompile = sh => { sh.uniforms.uTime = time; sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  { vec4 wp = instanceMatrix * vec4(0.,0.,0.,1.); float hh = max(position.y, 0.0); transformed.x += sin(uTime * 2.1 + wp.x * 0.7 + wp.z * 0.45) * 0.16 * hh; transformed.z += cos(uTime * 1.7 + wp.x * 0.35) * 0.1 * hh; }'); }; return m; };
    if (kind === 'grass') {
      const blade = new THREE.PlaneGeometry(0.09, 0.5, 1, 2); blade.translate(0, 0.25, 0);
      const pos = blade.attributes.position; for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0.49) pos.setX(i, 0); // punta afilada
      const N = shuffle.length * 3, im = new THREE.InstancedMesh(blade, sway(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.9 })), N);
      let k = 0;
      for (const [x, y, zz] of shuffle) for (let b = 0; b < 3; b++) {
        dummy.position.set(x + (R() - 0.5) * 0.25, y, zz + (R() - 0.5) * 0.25); dummy.rotation.set((R() - 0.5) * 0.4, R() * Math.PI, (R() - 0.5) * 0.4); dummy.scale.setScalar(0.7 + R() * 0.8); dummy.updateMatrix();
        im.setMatrixAt(k, dummy.matrix); col.copy(base).offsetHSL((R() - 0.5) * 0.04, 0.05, (R() - 0.3) * 0.16); im.setColorAt(k, col); k++;
      }
      im.receiveShadow = true; this.root.add(im);
      // flores de colores
      const fl = shuffle.filter(() => R() < 0.12), petals = new THREE.IcosahedronGeometry(0.08, 0);
      const fm = new THREE.InstancedMesh(petals, sway(new THREE.MeshStandardMaterial({ roughness: 0.6, emissive: 0x222222 })), fl.length);
      const fcols = [0xff6b8a, 0xffd23a, 0xffffff, 0xb08aff, 0xff9a3a, 0x7ad7ff];
      fl.forEach(([x, y, zz], i) => { dummy.position.set(x, y + 0.42, zz); dummy.rotation.set(0, R() * 6, 0); dummy.scale.set(1, 0.6, 1); dummy.updateMatrix(); fm.setMatrixAt(i, dummy.matrix); fm.setColorAt(i, col.setHex(fcols[Math.floor(R() * fcols.length)])); });
      this.root.add(fm);
    } else {
      // guijarros (arena), cristales de escarcha (nieve) o piedras con brasas (ceniza)
      const geo = kind === 'snow' ? new THREE.ConeGeometry(0.07, 0.35, 5) : new THREE.IcosahedronGeometry(0.13, 0);
      if (kind === 'snow') geo.translate(0, 0.17, 0);
      const m = new THREE.MeshStandardMaterial({ roughness: kind === 'snow' ? 0.15 : 0.85, flatShading: true, metalness: kind === 'snow' ? 0.2 : 0 });
      const im = new THREE.InstancedMesh(geo, m, shuffle.length);
      shuffle.forEach(([x, y, zz], i) => {
        dummy.position.set(x, y + (kind === 'snow' ? 0 : 0.03), zz); dummy.rotation.set((R() - 0.5) * (kind === 'snow' ? 0.6 : 3), R() * 6, (R() - 0.5) * (kind === 'snow' ? 0.6 : 3));
        const sc = 0.6 + R() * 1.1; dummy.scale.set(sc, kind === 'snow' ? sc : sc * 0.55, sc); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
        if (kind === 'snow') col.setHSL(0.55 + R() * 0.05, 0.6, 0.82 + R() * 0.1);
        else if (kind === 'ash') col.setHex(R() < 0.18 ? 0xff7a2a : 0x3a2c2a);
        else col.copy(new THREE.Color(pal.side)).offsetHSL(0, -0.05, (R() - 0.2) * 0.25);
        im.setColorAt(i, col);
      });
      if (kind === 'ash') m.emissive = new THREE.Color(0x000000);
      im.receiveShadow = true; this.root.add(im);
    }
  }

  _box({ x, y, z, w, h, d, color = C.stone, cap }) {
    // y = altura de la cara superior
    const capH = cap ? 0.2 : 0;
    if (HD.on && cap && Math.min(w, d) >= 5 && h >= 1.5) { // colinas y mesetas: misma forma orgánica que las islas
      const og = organicIsland({ w, d, top: 0, depth: h, rock: false, seed: x * 0.53 + z * 0.29, sideMat: terrainMat(color, 'strata'), topMat: patchGround(terrainMat(cap, 'grain')) });
      og.position.set(x, y, z); this.root.add(og);
      const rr = og.userData.r;
      this.physics.addBox(x, y - h / 2, z + d / 2 + rr / 2, w, h, rr); this.physics.addBox(x, y - h / 2, z - d / 2 - rr / 2, w, h, rr);
      this.physics.addBox(x + w / 2 + rr / 2, y - h / 2, z, rr, h, d); this.physics.addBox(x - w / 2 - rr / 2, y - h / 2, z, rr, h, d);
      this.physics.addBox(x, y - h / 2, z, w, h, d);
      return;
    }
    if (HD.on && Math.min(w, d, h) > 0.35) { // bordes redondeados
      const rb = Math.min(0.28, Math.min(w, d, h - capH) * 0.18);
      this._mesh(new RoundedBoxGeometry(w, h - capH, d, 3, rb), mat(color), x, y - capH - (h - capH) / 2 + 0.03, z); // +3 cm: no se funde con el suelo
      const hsl = {}; new THREE.Color(cap || 0).getHSL(hsl);
      if (cap && hsl.h > 0.5 && hsl.h < 0.62 && hsl.s > 0.5) { // agua (fuentes, estanques)
        const wm = waterMaterial({ shallow: 0x5fd0e8, deep: 0x1a6f9a, sky: 0xe6f6ff, opacity: 0.9, scale: 3 });
        const wmesh = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.2, d - 0.2), wm); wmesh.rotation.x = -Math.PI / 2; wmesh.position.set(x, y - 0.06, z); this.root.add(wmesh);
        this.animated.push(t => { wm.uniforms.uTime.value = t; });
        // borde de piedra alrededor del agua
        for (const [bx, bz, bw, bd] of [[0, d / 2, w + 0.2, 0.25], [0, -d / 2, w + 0.2, 0.25], [w / 2, 0, 0.25, d], [-w / 2, 0, 0.25, d]]) this._mesh(new RoundedBoxGeometry(bw, 0.3, bd, 2, 0.08), mat(color), x + bx, y - 0.02, z + bz);
      } else if (cap) this._mesh(new RoundedBoxGeometry(w + 0.14, Math.max(capH, 0.24), d + 0.14, 3, Math.min(0.11, rb)), mat(cap), x, y - capH / 2, z);
    } else {
    this._mesh(new THREE.BoxGeometry(w, h - capH, d), mat(color), x, y - capH - (h - capH) / 2, z);
    if (cap) this._mesh(new THREE.BoxGeometry(w + 0.1, capH, d + 0.1), mat(cap), x, y - capH / 2, z);
    }
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
    const rh0 = Math.min(w, d) * 0.45;
    if (this._model('casa', { x: w + 0.7, y: h + rh0 + 0.2, z: d + 0.7 }, 0, 0, 0, { parent: g, rotY: door === 'z+' ? 0 : Math.PI })) {
      this.physics.addBox(x, base + h / 2, z, w, h, d);
      this.physics.addBox(x, base + h + rh0 * 0.25, z, w * 0.5, rh0 * 0.5, d + 0.6);
      return;
    }
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
    this.animated.push(t => { k.rotation.y = t * 1.6 + (k.userData.spin || 0); k.position.y = baseY + Math.sin(t * 2.2) * 0.08 + (k.userData.lift || 0); });
    this.interactables.push({ id, type: 'item', model, crystal: k, pos: new THREE.Vector3(x, y, z), radius, verb, who: '', lines: [], mesh: g, when, headY: 0.8 });
  }

  _trigger({ id, x, y = 0, z, radius = 1.8, verb = 'Usar', name = '', lines = [], when }) {
    this.interactables.push({ id, type: 'trigger', pos: new THREE.Vector3(x, y, z), radius, verb, who: name, lines, when, headY: 1.2 });
  }

  _airship({ id, x, y, z }) {
    // Dirigible de Marta: globo de gajos crema y rojos, góndola con barandilla, cabina con ventanas encendidas,
    // dos motores laterales y uno de popa, banderines y faroles. La proa mira a -z.
    const g = new THREE.Group(); g.position.set(x, y, z); this.root.add(g);
    const wood = mat(C.wood), dark = mat(C.woodDark), red = mat(0xc9563c), brass = mat(0xd4a24c, { metalness: 0.6, roughness: 0.35 });
    const glow = new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffc860, emissiveIntensity: 1.2 });
    // globo: perfil de lágrima girado sobre el eje z, con textura de gajos
    const prof = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24, zz = -4.6 + t * 9.2, r = 2.45 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.85)), 0.8); prof.push(new THREE.Vector2(Math.max(0.02, r), zz)); }
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const cx = cv.getContext('2d');
    for (let i = 0; i < 12; i++) { cx.fillStyle = i % 2 ? '#c9563c' : '#f4e6cc'; cx.fillRect(i * 256 / 12, 0, 256 / 12 + 1, 64); }
    cx.fillStyle = 'rgba(0,0,0,.12)'; for (let i = 0; i < 12; i++) cx.fillRect(i * 256 / 12, 0, 1.5, 64);
    const gtex = new THREE.CanvasTexture(cv); gtex.colorSpace = THREE.SRGBColorSpace;
    const env = this._mesh(new THREE.LatheGeometry(prof, 36), new THREE.MeshStandardMaterial({ map: gtex, roughness: 0.75 }), 0, 4.5, 0, g);
    env.rotation.x = Math.PI / 2; env.scale.set(1, 1, 0.84); // morro romo hacia la proa (-z)
    for (const zz of [-2.9, 0, 2.9]) { const rr = 2.45 * Math.pow(Math.sin(Math.PI * Math.pow((zz + 4.6) / 9.2, 0.85)), 0.8) + 0.05; const r = this._mesh(new THREE.TorusGeometry(rr, 0.07, 6, 40), brass, 0, 4.5, zz, g); r.scale.y = 0.84; }
    this._mesh(new THREE.SphereGeometry(0.28, 12, 10), brass, 0, 4.5, -4.62, g); // punta de proa
    // timón de cola en cruz
    for (const [rz, sx, sy] of [[0, 0, 1], [0, 0, -1], [Math.PI / 2, 1, 0], [Math.PI / 2, -1, 0]]) {
      const f = this._mesh(new THREE.BoxGeometry(0.08, 1.5, 1.6), red, sx * 1.2, 4.5 + sy * 1.1, 3.7, g); f.rotation.z = rz;
      const trim = this._mesh(new THREE.BoxGeometry(0.1, 0.12, 1.62), brass, sx * 1.95, 4.5 + sy * 1.85, 3.7, g); trim.rotation.z = rz;
    }
    // góndola: casco de barco con proa afilada, cubierta, barandilla
    const hull = new THREE.Shape(); hull.moveTo(-1.1, 2); hull.lineTo(1.1, 2); hull.lineTo(1.1, -1.4); hull.quadraticCurveTo(0, -2.6, -1.1, -1.4); hull.lineTo(-1.1, 2);
    const hg = new THREE.ExtrudeGeometry(hull, { depth: 0.75, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2 }); hg.rotateX(Math.PI / 2); hg.translate(0, 0.75, 0);
    this._mesh(hg, wood, 0, 0, 0, g);
    this._mesh(new THREE.BoxGeometry(2.3, 0.1, 3.9), dark, 0, 0.78, 0.15, g);
    for (let i = 0; i < 7; i++) { const t = i / 6, zz = 1.9 - t * 3.6; for (const s of [-1, 1]) this._mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 5), brass, s * 1.08, 1.05, zz, g); }
    for (const s of [-1, 1]) this._mesh(new THREE.BoxGeometry(0.06, 0.06, 3.7), brass, s * 1.08, 1.3, 0.1, g);
    // cabina con ventanas encendidas y chimenea
    this._mesh(new THREE.BoxGeometry(1.3, 0.75, 1.0), mat(0xf1e3c8), 0, 1.2, -1.0, g);
    this._mesh(new THREE.BoxGeometry(1.45, 0.12, 1.15), red, 0, 1.62, -1.0, g);
    for (const s of [-1, 1]) this._mesh(new THREE.BoxGeometry(0.02, 0.28, 0.5), glow, s * 0.66, 1.25, -1.0, g);
    this._mesh(new THREE.BoxGeometry(0.6, 0.28, 0.02), glow, 0, 1.25, -1.51, g);
    this._mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.6, 8), dark, 0.4, 1.95, -0.8, g);
    // faroles en las esquinas
    for (const [lx, lz] of [[-1.08, 1.95], [1.08, 1.95], [-1.08, -1.6], [1.08, -1.6]]) this._mesh(new THREE.SphereGeometry(0.1, 8, 6), glow, lx, 1.42, lz, g);
    // cuerdas al globo
    [[-1, -1.5], [1, -1.5], [-1, 1.7], [1, 1.7]].forEach(([rx, rz]) => {
      const rope = this._mesh(new THREE.CylinderGeometry(0.025, 0.025, 3.3, 4), dark, rx * 1.15, 2.6, rz * 1.05, g);
      rope.rotation.z = -rx * 0.12; rope.castShadow = false;
    });
    // banderines de colores entre las cuerdas
    const flagCols = [0xe74c3c, 0xf1c40f, 0x3fb7e8, 0x7bd35a, 0xb06ce0];
    for (const s of [-1, 1]) for (let i = 0; i < 7; i++) { const t = i / 6, zz = -1.4 + t * 3, yy = 2.6 - Math.sin(t * Math.PI) * 0.45; const fl = this._mesh(new THREE.ConeGeometry(0.12, 0.28, 3), mat(flagCols[i % 5]), s * 1.2, yy, zz, g); fl.rotation.x = Math.PI; fl.castShadow = false; }
    // motores: dos laterales y uno de popa (las hélices miran atrás)
    const props = [];
    const engine = (ex, ey, ez, sc = 1) => {
      const e = new THREE.Group(); e.position.set(ex, ey, ez); e.scale.setScalar(sc); g.add(e);
      this._mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.9, 12), brass, 0, 0, 0, e).rotation.x = Math.PI / 2;
      this._mesh(new THREE.SphereGeometry(0.22, 10, 8), brass, 0, 0, -0.45, e);
      const pr = new THREE.Group(); pr.position.z = 0.55; e.add(pr);
      for (let i = 0; i < 3; i++) { const b = this._mesh(new THREE.BoxGeometry(0.12, 0.85, 0.04), dark, 0, 0, 0, pr); b.rotation.z = i * Math.PI * 2 / 3; b.geometry.translate(0, 0.42, 0); }
      props.push(pr); return e;
    };
    engine(0, 0.5, 2.25);
    for (const s of [-1, 1]) { engine(s * 1.75, 1.0, 0.7, 0.8); this._mesh(new THREE.BoxGeometry(0.7, 0.07, 0.15), dark, s * 1.35, 1.0, 0.7, g); }
    const prop = props[0];
    // pasarela desde el muelle
    const plank = this._mesh(new THREE.BoxGeometry(1.0, 0.08, 3.4), wood, 0, -0.62, -3.3, g); plank.rotation.x = -0.36;
    let hdShip = false;
    if (HD.on) { // barco volador generado con Artlist (misma cubierta y física que el de siempre)
      const bm = this._model('barco', { z: 6.1 }, 0, -0.85, 0.15, { parent: g, rotY: Math.PI });
      if (bm) { hdShip = true; for (const ch of [...g.children]) if (ch !== plank && ch !== bm) ch.visible = false; }
    }
    const a = { group: g, plank, base: new THREE.Vector3(x, y, z), prop, spin: 3, seat: new THREE.Vector3(0.3, 0.84, 0.6), offset: new THREE.Vector3(), yaw: 0 };
    if (hdShip) a.seat.set(0.35, 0.56, -0.9); // cubierta del barco HD: más baja y libre delante de la cabina
    this.airships[id] = a;
    this.physics.addBox(x, y + 0.42, z, 2.2, 0.84, 4.2, { noCamera: true });
    this.animated.push((t, dt) => {
      g.position.set(a.base.x + a.offset.x, a.base.y + a.offset.y + Math.sin(t * 0.9) * 0.12, a.base.z + a.offset.z);
      g.rotation.y = a.yaw; g.rotation.z = Math.sin(t * 0.7) * 0.02;
      for (const pr of props) pr.rotation.z += dt * a.spin;
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

  _updraft({ x, z, y0, y1, r = 2.4, when, color = 0xffffff }) {
    const g = new THREE.Group(); g.position.set(x, y0, z); this.root.add(g);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.8, y1 - y0, 20, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: color === 0xffffff ? 0.08 : 0.14, side: THREE.DoubleSide, depthWrite: false }));
    col.position.y = (y1 - y0) / 2; g.add(col);
    const n = 40, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), seeds = [];
    for (let i = 0; i < n; i++) seeds.push([Math.random() * Math.PI * 2, Math.random() * r * 0.9, Math.random()]);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.15, transparent: true, opacity: 0.8, depthWrite: false, blending: color === 0xffffff ? THREE.NormalBlending : THREE.AdditiveBlending }));
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
    // vuelve a crecer (el escorpión lo pide cuando quedan pocos pilares: así el combate nunca queda sin salida)
    p.restore = () => { if (p.alive) return; p.alive = true; box.off = false; g.scale.set(1, 0.01, 1); this.root.add(g);
      const grow = t => { g.scale.y = Math.min(1, g.scale.y + 0.03); return g.scale.y >= 1; }; p.growing = grow; };
    this.animated.push(() => { if (p.growing && p.growing()) p.growing = null; });
    this.pillars.push(p);
  }

  _arch({ x, z, y = 0, rot = 0, w = 5, h = 5 }) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; this.root.add(g);
    const stone = mat(0xd8b88a, { flatShading: true });
    const am = prop('arco_ancho', { x: w + 1.6, y: h + 1.0, z: 1.4 });
    if (am) g.add(am);
    else {
      [-1, 1].forEach(s => this._mesh(new THREE.BoxGeometry(0.9, h, 0.9), stone, s * w / 2, h / 2, 0, g));
      this._mesh(new THREE.BoxGeometry(w + 1.2, 0.8, 1.0), stone, 0, h + 0.4, 0, g);
    }
    // con modelo, los pilares van del borde del paso (≈42 % del ancho) hasta el borde exterior
    const W = w + 1.6, open = W * 0.42, pw = am ? (W - open) / 2 : 0.9, off = am ? (open + pw) / 2 : w / 2;
    [-1, 1].forEach(s => {
      const c = Math.cos(rot), sn = Math.sin(rot);
      this.physics.addBox(x + c * s * off, y + h / 2, z - sn * s * off, Math.abs(c) * pw + Math.abs(sn) * 1.2 || 0.9, h, Math.abs(sn) * pw + Math.abs(c) * 1.2 || 0.9);
    });
  }

  _column({ x, z, y = 0, h = 3, broken = false }) {
    const cm = prop('columna_alta', { h: h + 0.3 }, { rotY: (x * 3 + z) % 6.28 });
    if (cm) { cm.position.set(x, y, z); if (broken) cm.rotation.z = 0.06; this.root.add(cm); this.physics.addBox(x, y + h / 2, z, 0.9, h, 0.9, { noCamera: true }); return; }
    const stone = mat(0xd8b88a, { flatShading: true });
    const c = this._mesh(new THREE.CylinderGeometry(0.45, 0.5, h, 8), stone, x, y + h / 2, z);
    if (broken) c.rotation.z = 0.08;
    this._mesh(new THREE.BoxGeometry(1.2, 0.3, 1.2), stone, x, y + 0.15, z);
    this.physics.addBox(x, y + h / 2, z, 0.9, h, 0.9, { noCamera: true });
  }

  // Objetos que se rompen con el bastón. loot: 'reliquia' (oculta, una por zona), 'corazon', 'reloj' (desafíos: -3 s) o nada.
  _breakable({ id, x, y = 0, z, kind = 'vasija', loot }, save) {
    if (loot === 'reliquia' && save && (save.relics || []).includes(id)) return; // ya encontrada
    const g = new THREE.Group(); g.position.set(x, y, z); this.root.add(g);
    if (kind === 'cofre') { // geoda de cristal violeta: guarda algo valioso
      const rock = mat(0x5a4a6a, { flatShading: true }), cr = mat(0xc8a8ff, { emissive: 0x7a4ad0, emissiveIntensity: 0.8, flatShading: true, roughness: 0.2 });
      this._mesh(new THREE.DodecahedronGeometry(0.55, 0), rock, 0, 0.45, 0, g).scale.set(1.1, 0.85, 1);
      [[0, 0.95, 0, 0.16, 0.6, 0], [0.25, 0.85, 0.1, 0.12, 0.45, -0.5], [-0.22, 0.82, -0.1, 0.11, 0.4, 0.5]].forEach(([a, b, c, r, h, rz]) => { this._mesh(new THREE.ConeGeometry(r, h, 5), cr, a, b, c, g).rotation.z = rz; });
    } else { // vasija de barro con franja azul
      const clay = mat(0xc07a4a, { flatShading: true }), band = mat(0x4a8acf, { flatShading: true });
      const pts = [[0, 0], [0.32, 0.05], [0.42, 0.35], [0.36, 0.7], [0.2, 0.85], [0.24, 0.98], [0, 0.98]].map(([r, h]) => new THREE.Vector2(r, h));
      this._mesh(new THREE.LatheGeometry(pts, 9), clay, 0, 0, 0, g);
      this._mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.08, 9), band, 0, 0.42, 0, g);
    }
    const box = this.physics.addBox(x, y + 0.45, z, 0.8, 0.9, 0.8);
    const ph = Math.random() * 6; if (kind === 'cofre') this.animated.push(t => { g.children.slice(1).forEach((c, i) => { c.material.emissiveIntensity = 0.6 + Math.sin(t * 2 + ph + i) * 0.3; }); });
    this.breakables.push({ id, kind, loot, pos: new THREE.Vector3(x, y + 0.45, z), r: 0.55, g, box, broken: false });
  }
  breakObject(B) { if (B.broken) return; B.broken = true; B.box.off = true; this.root.remove(B.g); }
  // Reliquia: pieza dorada que flota hasta que Lía la toca
  spawnRelic(id, pos) {
    const g = new THREE.Group(); g.position.copy(pos); this.root.add(g);
    const gold = mat(0xffd27a, { emissive: 0xffa020, emissiveIntensity: 0.9, metalness: 0.6, roughness: 0.25, flatShading: true });
    const core = this._mesh(new THREE.TorusKnotGeometry(0.2, 0.06, 40, 6), gold, 0, 0.9, 0, g);
    this.animated.push(t => { core.rotation.y = t * 2; core.position.y = 0.9 + Math.sin(t * 3) * 0.1; });
    this.interactables.push({ id, type: 'relic', pos: pos.clone(), radius: 1.2, mesh: g, auto: true });
  }

  // Pieza especial: engranaje dorado con una gema, gira y brilla hasta que se recoge
  spawnPieza(id, pos) {
    const g = new THREE.Group(); g.position.copy(pos); this.root.add(g);
    const gold = mat(0xffd84a, { emissive: 0xff9a10, emissiveIntensity: 1.1, metalness: 0.7, roughness: 0.2, flatShading: true });
    const gem = new THREE.MeshStandardMaterial({ color: 0x9ff0ff, emissive: 0x3ad8ff, emissiveIntensity: 1.6, flatShading: true });
    const spin = new THREE.Group(); spin.position.y = 1.0; g.add(spin);
    const ring = this._mesh(new THREE.TorusGeometry(0.32, 0.09, 6, 8), gold, 0, 0, 0, spin);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; this._mesh(new THREE.BoxGeometry(0.14, 0.14, 0.12), gold, Math.cos(a) * 0.44, Math.sin(a) * 0.44, 0, spin).rotation.z = a; }
    this._mesh(new THREE.OctahedronGeometry(0.17, 0), gem, 0, 0, 0, spin);
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 32), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.position.y = 1.0; g.add(halo);
    void ring;
    this.animated.push(t => { spin.rotation.y = t * 2.2; spin.position.y = 1.0 + Math.sin(t * 3) * 0.12; halo.position.y = spin.position.y; halo.lookAt(this.playerPos.x, halo.getWorldPosition(new THREE.Vector3()).y, this.playerPos.z); halo.material.opacity = 0.25 + Math.sin(t * 4) * 0.12; });
    this.interactables.push({ id, type: 'pieza', pos: pos.clone(), radius: 1.3, mesh: g, auto: true });
  }

  // Barriles, cajas y puestos de mercado (solo con modelo; si no hay modelo, piezas sencillas)
  _prop({ kind, x, z, y = 0, rot = 0, s = 1 }) {
    const K = { barril: { h: 1.0, box: [0.8, 1.0, 0.8], col: 0x8a5a32 }, caja: { h: 0.9, box: [0.9, 0.9, 0.9], col: 0xa07040 }, puesto: { h: 2.6, box: [2.6, 1.1, 1.4], col: 0xc8563c } }[kind];
    if (!K) return;
    const m = prop(kind, { h: K.h * s }, { rotY: rot });
    if (m) { m.position.set(x, y, z); this.root.add(m); }
    else this._mesh(new THREE.BoxGeometry(K.box[0] * s, K.box[1] * s, K.box[2] * s), mat(K.col, { flatShading: true }), x, y + K.box[1] * s / 2, z).rotation.y = rot;
    const c = Math.abs(Math.cos(rot)), sn = Math.abs(Math.sin(rot));
    this.physics.addBox(x, y + K.box[1] * s / 2, z, (K.box[0] * c + K.box[2] * sn) * s, K.box[1] * s, (K.box[0] * sn + K.box[2] * c) * s);
  }

  _crystalCluster({ x, z, y = 0, s = 1, color = 0x9ff0ff }) {
    const cm = this._model('cristales', { w: 2.4 * s }, x, y, z, { rotY: (x * 2 + z) % 6.28 });
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
    if (this._model('carpa', { x: 2.8, y: 2.1, z: 3.8 }, 0, 0, 0, { parent: g })) { this.physics.addBox(x, y + 1, z, 2.4, 2, 2.4); return; }
    const tent = this._mesh(new THREE.ConeGeometry(1.8, 2.2, 4), cloth, 0, 1.1, 0, g); tent.rotation.y = Math.PI / 4;
    this._mesh(new THREE.BoxGeometry(0.7, 1.2, 0.05), mat(0x3a2a1a), 0, 0.6, 1.25, g);
    this._mesh(new THREE.BoxGeometry(0.8, 0.5, 0.6), mat(C.wood), 2.2, 0.25, 0.5, g); // caja de mapas
    this.physics.addBox(x, y + 1, z, 2.4, 2, 2.4);
  }

  _gear({ x, y, z, r = 2, axis = 'z', speed = 0.5, color = 0xb08a4a }) {
    const g = new THREE.Group(); g.position.set(x, y, z); this.root.add(g);
    const brass = mat(color, { metalness: 0.6, roughness: 0.35, flatShading: true });
    const spinM = new THREE.Group(); g.add(spinM);
    const gm = prop('engranaje_plano', { w: r * 2.25 });
    if (gm) { // modelo de cara a +z: se gira para el eje pedido y se centra en su eje
      const c = new THREE.Group(); c.add(gm);
      const box = new THREE.Box3().setFromObject(gm); const ctr = box.getCenter(new THREE.Vector3()); gm.position.sub(ctr);
      if (axis === 'y') c.rotation.x = -Math.PI / 2; else if (axis === 'x') c.rotation.y = Math.PI / 2;
      spinM.add(c);
      this.animated.push((t, dt) => { if (axis === 'z') spinM.rotation.z += speed * dt; else if (axis === 'x') spinM.rotation.x += speed * dt; else spinM.rotation.y += speed * dt; });
      return;
    }
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
    const top = prop('torre_alta', { w: w * 1.35 }, { rotY: (x + z) % 6.28 });
    if (top) { // la torre generada corona un fuste sencillo que baja hasta las nubes
      const th = new THREE.Box3().setFromObject(top).getSize(new THREE.Vector3()).y;
      const shaftH = Math.max(2, h + w * 1.1 - th * 0.9);
      this._mesh(new THREE.BoxGeometry(w * 0.92, shaftH, w * 0.92), stone, 0, shaftH / 2, 0, g);
      top.position.y = shaftH - th * 0.1; g.add(top);
      this.physics.addBox(x, y + h / 2, z, w, h, w);
      return;
    }
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
      if (HD.on) { const m = canopyBlob(rr, i % 2 ? 0x5aa85a : 0x3f8a4a, x + i * 2.3, 4); m.position.set(a, b, c); m.castShadow = false; g.add(m); return; }
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
    if (HD.on) {
      fluffyTree(g, null, { leaf: this.zone && this.zone.hdLeaf || 0x5fa83e, seed: x * 0.7 + z }); g.rotation.y = (x * 7 + z * 3) % 6.28;
      this.physics.addBox(x, y + 0.8 * s, z, 0.5 * s, 1.6 * s, 0.5 * s, { noCamera: true });
      const ph = Math.random() * 6; this.animated.push(t => { g.rotation.z = Math.sin(t * 1.3 + ph) * 0.015; });
      return;
    }
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
    if (HD.on && !(this.zone && this.zone.lava)) { // mar de nubes HD
      const m = makeCloudSea({ y, color, sunDir: HD.sunDir, sunCol: HD.sunCol });
      this.root.add(m); this.water = { y, mesh: m };
      this.animated.push(t => { m.material.uniforms.uTime.value = t; });
      return;
    }
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
      // si juegas con este personaje, en su lugar aparece Lía (con el aspecto que elegiste)
      const swapped = this.heroId && this.heroId !== 'lia' && model === this.heroId;
      rig = createCharacter(this.chars, swapped ? (this.heroLook || 'lia') : model);
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

  // Portal de salida de los desafíos: se enciende al recoger todos los cristales
  _portal({ x, y, z }) {
    const g = new THREE.Group(); g.position.set(x, y, z); this.root.add(g);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x9b8cff, emissive: 0x4433aa, emissiveIntensity: 0.3, metalness: 0.3, roughness: 0.4 });
    const ring = this._mesh(new THREE.TorusGeometry(1.25, 0.18, 12, 40), ringMat, 0, 1.6, 0, g);
    const innerMat = new THREE.MeshBasicMaterial({ color: 0xd8ccff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    const inner = this._mesh(new THREE.CircleGeometry(1.12, 40), innerMat, 0, 1.6, 0, g); inner.castShadow = false;
    this._mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.3, 24), mat(0x6a6080), 0, 0.15, 0, g);
    this.physics.addBox(x, y + 0.15, z, 2.2, 0.3, 2.2);
    const P = this.portal = { pos: new THREE.Vector3(x, y, z), open: false, k: 0 };
    P.setOpen = v => { P.open = v; };
    this.animated.push((t, dt = 0.016) => {
      P.k += ((P.open ? 1 : 0) - P.k) * Math.min(1, dt * 3);
      ring.rotation.z = t * (0.3 + P.k * 1.5);
      ringMat.emissiveIntensity = 0.3 + P.k * 1.6 + (P.open ? Math.sin(t * 4) * 0.25 : 0);
      innerMat.opacity = P.k * (0.55 + Math.sin(t * 3) * 0.1);
      inner.rotation.z = -t;
    });
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
    if (HD.on) {
      const tint = new THREE.Color(0xffffff).lerp(new THREE.Color((this.zone && this.zone.sky.bottom) || 0xffffff), 0.35);
      for (let i = 0; i < 22; i++) {
        const c = makeCumulus(rnd, { tint, sunCol: HD.sunCol });
        const ang = rnd() * Math.PI * 2, r = 70 + rnd() * 90;
        c.position.set(Math.cos(ang) * r, 4 + rnd() * 30, Math.sin(ang) * r);
        this.root.add(c);
        const sp = 0.3 + rnd() * 0.5;
        this.animated.push((t, dt) => { c.position.x += sp * dt; if (c.position.x > 170) c.position.x = -170; });
      }
      return;
    }
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
