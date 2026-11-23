import * as THREE from 'three';
import { prop, hasProp } from './props.js';

// Criaturas y trampas de las Profundidades de Mareth:
//  · tiburones  — patrullan; si te ven, se detienen, agitan la cola (aviso) y embisten en línea recta.
//                 Tras la embestida quedan cansados: es el momento de golpearlos con la estocada.
//  · pulpos     — anclados a una roca; levantan un tentáculo (brilla) y lo descargan, y escupen nubes de tinta.
//                 El Pulpo Rey guarda la hélice del submarino.
//  · erizos     — minas de púas que flotan: no se tocan.
//  · medusas eléctricas — cada pocos segundos se cargan (brillo) y sueltan una descarga en anillo.
// La protagonista ataca bajo el agua con una estocada (botón de golpe): un impulso corto que daña lo que toca.

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...o });
const add = (color, opacity = 0.6) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const ang = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
let inkTexC = null;
function inkTex() {
  if (inkTexC) return inkTexC;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, 'rgba(20,10,30,0.95)'); g.addColorStop(0.6, 'rgba(25,12,40,0.6)'); g.addColorStop(1, 'rgba(25,12,40,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); inkTexC = new THREE.CanvasTexture(c); return inkTexC;
}

// ---------------- modelos ----------------
function sharkModel(s = 1) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  // cuerpo con lomo gris azulado y vientre claro (color por vértice)
  const geo = new THREE.SphereGeometry(1, 28, 18); geo.scale(0.55, 0.5, 1.9);
  const col = [], c1 = new THREE.Color(0x4f6f86), c2 = new THREE.Color(0xeef3f5), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), z = p.getZ(i); if (z > 1.2) p.setY(i, y * 0.85 - (z - 1.2) * 0.05); const k = THREE.MathUtils.smoothstep(y, -0.18, 0.06); const c = c2.clone().lerp(c1, k); col.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
  const skin = std(0xffffff, { vertexColors: true, roughness: 0.4 });
  const trunk = new THREE.Mesh(geo, skin); trunk.castShadow = true; body.add(trunk);
  const finM = std(0x46647a, { roughness: 0.5, side: THREE.DoubleSide });
  const fin = (pts, th = 0.06) => { const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); for (const q of pts.slice(1)) sh.lineTo(q[0], q[1]); return new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 }); };
  const dorsal = new THREE.Mesh(fin([[0, 0], [0.75, 0], [-0.15, 0.85]]), finM); dorsal.rotation.y = -Math.PI / 2; dorsal.position.set(0.03, 0.4, 0.05); body.add(dorsal);
  for (const sx of [-1, 1]) { const pf = new THREE.Mesh(fin([[0, 0], [0.55, 0], [-0.35, 0.6]], 0.04), finM); pf.rotation.set(Math.PI / 2, 0, sx * (Math.PI / 2 + 0.5)); pf.position.set(sx * 0.42, -0.22, 0.55); body.add(pf); }
  const tail = new THREE.Group(); tail.position.z = -1.75; body.add(tail);
  const tailStem = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 10), std(0x55758c, { roughness: 0.4 })); tailStem.rotation.x = -Math.PI / 2; tailStem.position.z = -0.2; tail.add(tailStem);
  const tf = new THREE.Mesh(fin([[0, 0], [-0.25, 0.95], [-0.45, 0.85], [-0.15, 0.05], [-0.4, -0.55], [-0.2, -0.55]]), finM); tf.rotation.y = Math.PI / 2; tf.position.set(-0.03, 0, -0.45); tail.add(tf);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), std(0x0b0b10, { roughness: 0.1 })); eye.position.set(sx * 0.3, 0.1, 1.35); body.add(eye);
    for (let i = 0; i < 3; i++) { const gl = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.22, 0.03), std(0x34485a)); gl.position.set(sx * 0.5, 0.0, 0.85 - i * 0.12); gl.rotation.z = sx * 0.2; body.add(gl); }
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 16, Math.PI), std(0x5a1a22)); mouth.rotation.x = Math.PI / 2 + 0.4; mouth.position.set(0, -0.2, 1.5); body.add(mouth);
  const warn = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1), add(0xff4a3a, 0)); warn.rotation.x = -Math.PI / 2; warn.position.set(0, 0, 0); g.add(warn); // línea de embestida
  g.scale.setScalar(s);
  return { g, body, tail, warn, skin };
}
function octoModel(s = 1, color = 0xb83d5c) {
  const g = new THREE.Group(); const skin = std(color, { roughness: 0.45, emissive: 0x000000 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.75, 26, 18), skin); head.scale.set(1, 1.25, 1); head.position.y = 1.15; head.castShadow = true; g.add(head);
  const spotM = std(new THREE.Color(color).multiplyScalar(0.6).getHex());
  for (let i = 0; i < 9; i++) { const a = Math.random() * 6.28, b = 0.2 + Math.random() * 1.0; const sp = new THREE.Mesh(new THREE.SphereGeometry(0.08 + Math.random() * 0.06, 8, 6), spotM); sp.position.set(Math.cos(a) * Math.sin(b) * 0.74, 1.15 + Math.cos(b) * 0.92, Math.sin(a) * Math.sin(b) * 0.74); sp.scale.set(1, 0.4, 1); sp.lookAt(0, 1.15, 0); g.add(sp); }
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), std(0xfff6e0, { roughness: 0.2 })); e.position.set(sx * 0.32, 0.85, 0.6); g.add(e);
    const pu = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.05), std(0x101018, { roughness: 0.1 })); pu.position.set(sx * 0.33, 0.85, 0.79); g.add(pu);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 8, 0, Math.PI * 2, 0, 1.0), skin); lid.position.copy(e.position); lid.rotation.x = -0.5; g.add(lid);
  }
  const tents = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2, root = new THREE.Group(); root.position.set(Math.sin(a) * 0.5, 0.55, Math.cos(a) * 0.5); root.rotation.y = a; g.add(root);
    let parent = root; const segs = [];
    for (let k = 0; k < 7; k++) {
      const r0 = 0.2 * (1 - k / 8), len = 0.42;
      const seg = new THREE.Group(); seg.position.z = k ? len : 0; parent.add(seg);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r0 * 0.82, r0, len + 0.04, 9), skin); m.rotation.x = Math.PI / 2; m.position.z = len / 2; seg.add(m);
      if (k % 2 === 0) { const suc = new THREE.Mesh(new THREE.SphereGeometry(r0 * 0.4, 6, 4), std(0xf3c6c8)); suc.position.set(0, -r0 * 0.8, len / 2); suc.scale.y = 0.4; seg.add(suc); }
      segs.push(seg); parent = seg;
    }
    tents.push({ root, segs, a, ph: Math.random() * 6 });
  }
  g.scale.setScalar(s);
  return { g, head, tents, skin };
}
function urchinModel(r = 0.5) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), std(0x2a1838, { roughness: 0.6 })); g.add(core);
  const sp = new THREE.ConeGeometry(0.05, r * 1.4, 5); sp.translate(0, r * 0.7 + r * 0.6, 0);
  const spikes = new THREE.InstancedMesh(sp, std(0x6a3c8a, { emissive: 0x2a0a40, roughness: 0.4 }), 42), M = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 42; i++) { const y = 1 - (i / 41) * 2, rr = Math.sqrt(1 - y * y), th = i * 2.39996; const d = new THREE.Vector3(Math.cos(th) * rr, y, Math.sin(th) * rr); q.setFromUnitVectors(up, d); M.compose(new THREE.Vector3(), q, new THREE.Vector3(1, 0.8 + Math.random() * 0.5, 1)); spikes.setMatrixAt(i, M); }
  g.add(spikes);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(r * 2.3, 16, 10), add(0xb050ff, 0.08)); g.add(halo);
  return { g, halo };
}
function zapJellyModel(r = 1) {
  const g = new THREE.Group();
  const bellM = new THREE.MeshStandardMaterial({ color: 0xffe36a, emissive: 0xffc21a, emissiveIntensity: 0.5, transparent: true, opacity: 0.7, roughness: 0.1 });
  const bell = new THREE.Mesh(new THREE.SphereGeometry(r, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), bellM); g.add(bell);
  const tents = [];
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; const t = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.01, r * 2.6, 4), add(0xfff2a0, 0.7)); t.geometry.translate(0, -r * 1.3, 0); t.position.set(Math.cos(a) * r * 0.6, 0, Math.sin(a) * r * 0.6); g.add(t); tents.push(t); }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 40), add(0xfff6a0, 0)); ring.rotation.x = Math.PI / 2; g.add(ring);
  const light = new THREE.PointLight(0xffd84a, 0, 7); g.add(light);
  return { g, bell, bellM, tents, ring, light };
}

// ---------- modelos de Artlist animados con el vértice (cola del tiburón, tentáculos, campana de la medusa) ----------
const WIG = {
  // la cola (z < 0) se mueve de lado; la ola recorre el cuerpo hacia atrás
  tiburon: `float tl = smoothstep(0.25, -0.95, position.z); transformed.x += sin(uTime * uFreq - position.z * 3.2) * uAmp * pow(tl, 1.4) + sin(uTime * uFreq) * uAmp * 0.12;`,
  // los tentáculos (abajo y hacia fuera) ondulan; uno se levanta (uLift) en la dirección uDir antes de golpear
  pulpo: `float r = length(position.xz), an = atan(position.x, position.z), k = smoothstep(0.0, -0.5, position.y) * smoothstep(0.25, 0.9, r);
    float w = sin(uTime * 1.8 + an * 3.0 + r * 5.0); transformed.y += w * 0.07 * k; transformed.xz += normalize(position.xz + 1e-4) * sin(uTime * 1.3 + an * 2.0) * 0.05 * k;
    float sel = pow(max(0.0, cos(an - uDir)), 6.0) * smoothstep(0.35, 0.95, r); transformed.y += uLift * sel * 0.9; transformed.xz += normalize(position.xz + 1e-4) * max(0.0, -uLift) * sel * 0.6;`,
  // la campana late y los tentáculos se mecen
  medusa: `float b = smoothstep(-0.1, 0.4, position.y), tt = smoothstep(0.0, -0.9, position.y); float pu = sin(uTime * 3.0) * 0.07;
    transformed.xz *= 1.0 + pu * b; transformed.y -= pu * 0.5 * b; transformed.x += sin(uTime * 2.2 + position.y * 4.0) * 0.08 * tt; transformed.z += cos(uTime * 1.9 + position.y * 3.5) * 0.06 * tt;`,
  erizo: `transformed *= 1.0 + sin(uTime * 2.0 + position.y * 3.0) * 0.015;`,
};
function artlist(id, fit, opts = {}) {
  if (!hasProp(id)) return null;
  const g = prop(id, fit); if (!g) return null;
  const U = { uTime: { value: 0 }, uAmp: { value: opts.amp || 0.16 }, uFreq: { value: 6 }, uLift: { value: 0 }, uDir: { value: 0 } }, mats = [];
  g.traverse(o => {
    if (!o.isMesh) return; o.castShadow = true;
    const m = o.material.clone(); mats.push(m);
    if (m.emissive === undefined) return;
    m.onBeforeCompile = sh => { Object.assign(sh.uniforms, U); sh.vertexShader = 'uniform float uTime; uniform float uAmp; uniform float uFreq; uniform float uLift; uniform float uDir;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + WIG[id]); };
    m.customProgramCacheKey = () => 'sf_' + id; o.material = m;
  });
  const box = new THREE.Box3().setFromObject(g), size = box.getSize(new THREE.Vector3());
  return { g, U, mats, size };
}
const flashMats = (mats, r, gg = r * 0.9, b = r * 0.9) => { for (const m of mats) if (m.emissive) m.emissive.setRGB(r, gg, b); };

export class SeaFoes {
  constructor(world, cfg, save) {
    this.root = world.root; this.t = 0; this.events = [];
    const flags = (save && save.flags) || {};
    this.sharks = (cfg.sharks || []).map(s => this._shark(s));
    this.octos = (cfg.octopus || []).filter(o => !(o.king && flags[o.flag])).map(o => this._octo(o));
    this.urchins = (cfg.urchins || []).map(u => this._urchin(u));
    this.zaps = (cfg.zapJellies || []).map(z => this._zap(z));
    this.inks = [];
  }
  _shark({ x, y, z, r = 8, speed = 3, s = 1, hp = 3 }) {
    const M = sharkModel(s); this.root.add(M.g);
    const A = artlist('tiburon', { z: 3.9 * s }, { amp: 0.17 });
    if (A) { // modelo de Artlist en lugar del de piezas
      M.body.visible = false; A.g.position.y = -A.size.y / 2; const wrap = new THREE.Group(); wrap.add(A.g); M.g.add(wrap); M.g.scale.setScalar(1); M.warn.scale.setScalar(1);
      M.art = A; M.body = wrap; M.tail = new THREE.Group(); M.skin = { emissive: { setRGB: (r, g, b) => flashMats(A.mats, r, g, b) } };
    }
    return { ...M, c: new THREE.Vector3(x, y, z), r, speed, s, hp, maxHp: hp, a: Math.random() * 6.28, pos: new THREE.Vector3(x + r, y, z), yaw: 0, state: 'patrol', st: 0, dir: new THREE.Vector3(), flash: 0, alive: true, hitDash: -1 };
  }
  _octo({ x, y, z, s = 1, hp = 3, king = false, flag, color }) {
    const M = octoModel(s, color || (king ? 0x9b2f6e : 0xc4485e)); M.g.position.set(x, y, z); this.root.add(M.g);
    const A = artlist('pulpo', { w: 4.6 * s });
    if (A) {
      M.g.children.slice().forEach(c => M.g.remove(c)); M.g.scale.setScalar(1); M.g.add(A.g); M.art = A;
      if (king) A.mats.forEach(m => m.color && m.color.multiply(new THREE.Color(0xd8a0ff)));
      M.head = new THREE.Object3D(); M.headY = A.size.y * 0.62; M.tents = []; M.skin = { emissive: { setRGB: (r, g, b) => flashMats(A.mats, r, g, b) } };
    }
    if (king) { const cs = M.art ? M.art.size.y / 2.4 : 1, cy = M.art ? M.art.size.y * 0.97 : 2.15; const cr = new THREE.Group(); cr.position.y = cy; cr.scale.setScalar(cs); M.g.add(cr); const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.35, 7, 1, true), std(0xffcf4a, { metalness: 0.8, roughness: 0.25, side: THREE.DoubleSide, emissive: 0x5a3a00 })); cr.add(crown); for (let i = 0; i < 7; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 5), crown.material); const a = i / 7 * 6.28; sp.position.set(Math.cos(a) * 0.46, 0.27, Math.sin(a) * 0.46); cr.add(sp); const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), std(0x6ae8ff, { emissive: 0x2aa8d0, emissiveIntensity: 1 })); gem.position.set(Math.cos(a) * 0.47, 0.0, Math.sin(a) * 0.47); cr.add(gem); } }
    return { ...M, pos: new THREE.Vector3(x, y, z), s, hp, maxHp: hp, king, flag, state: 'idle', st: 1 + Math.random(), inkT: 3 + Math.random() * 3, target: 0, flash: 0, alive: true, yaw: 0, hitDash: -1, name: king ? 'Pulpo Rey' : 'Pulpo' };
  }
  _urchin({ x, y, z, r = 0.5, amp = 0.6, ax = 'y', speed = 1 }) {
    const M = urchinModel(r); M.g.position.set(x, y, z); this.root.add(M.g);
    const A = artlist('erizo', { w: r * 3.6 });
    if (A) { M.g.children.slice().forEach(c => { if (c !== M.halo) M.g.remove(c); }); A.g.position.y = -A.size.y / 2; M.g.add(A.g); M.art = A; }
    return { ...M, base: new THREE.Vector3(x, y, z), r, amp, ax, speed, ph: Math.random() * 6, pos: new THREE.Vector3(x, y, z) };
  }
  _zap({ x, y, z, r = 1, period = 4.5, range = 3.6, amp = 1.2 }) {
    const M = zapJellyModel(r); M.g.position.set(x, y, z); this.root.add(M.g);
    const A = artlist('medusa', { h: r * 3 });
    if (A) {
      M.bell.visible = false; M.tents.forEach(t => t.visible = false); A.g.position.y = -A.size.y * 0.62; M.g.add(A.g); M.art = A;
      A.mats.forEach(m => { m.transparent = true; m.opacity = 0.85; if (m.emissive) { m.emissive.setHex(0xffb81a); m.emissiveIntensity = 0.35; } });
      M.bellM = { set emissiveIntensity(v) { A.mats.forEach(m => m.emissiveIntensity = v * 0.6); } };
    }
    return { ...M, base: new THREE.Vector3(x, y, z), r, period, range, amp, ph: Math.random() * period, pos: new THREE.Vector3(x, y, z), was: 'calm' };
  }

  update(dt, player, ctx) {
    if (this.hold) return []; // pausa mientras se lee la tarjeta del Pulpo Rey
    this.t += dt; const t = this.t, P = player.pos, hits = [], ev = this.events;
    const safe = ctx.inDome || player.inSub, auto = ctx.auto;
    const chest = new THREE.Vector3(P.x, P.y + 0.9, P.z);
    const dashing = player.swimDash > 0 ? player.swimDashId : -1;
    // ---- tiburones ----
    for (const S of this.sharks) {
      if (!S.alive) { S.st += dt; S.g.position.y += dt * 1.6; S.body.rotation.z = Math.min(Math.PI, S.body.rotation.z + dt * 3); S.g.traverse(o => { if (o.material && o.material.opacity !== undefined && o !== S.warn) { o.material.transparent = true; o.material.opacity = Math.max(0, 1 - S.st / 3); } }); if (S.st > 3) S.g.visible = false; continue; }
      const d = S.pos.distanceTo(chest);
      S.st -= dt; S.flash = Math.max(0, S.flash - dt * 3);
      let sp = S.speed, wig = 6;
      if (S.state === 'patrol') {
        S.a += dt * S.speed / S.r; const tx = S.c.x + Math.cos(S.a) * S.r, tz = S.c.z + Math.sin(S.a) * S.r, ty = S.c.y + Math.sin(S.a * 2) * 1.2;
        const v = new THREE.Vector3(tx, ty, tz).sub(S.pos); S.pos.addScaledVector(v, Math.min(1, dt * 2));
        S.yaw += ang(S.yaw, Math.atan2(v.x, v.z)) * Math.min(1, dt * 4);
        if (!safe && !auto && d < 13 && S.st <= 0 && P.y + 1.5 < ctx.surface) { S.state = 'aim'; S.st = 1.0; ev.push({ type: 'sharkAim', pos: S.pos.clone() }); }
      } else if (S.state === 'aim') {
        S.dir.copy(chest).sub(S.pos).normalize(); S.yaw += ang(S.yaw, Math.atan2(S.dir.x, S.dir.z)) * Math.min(1, dt * 8); wig = 22;
        S.warn.material.opacity = 0.25 + Math.sin(t * 30) * 0.15; S.warn.scale.set(1, Math.min(16, d + 3), 1); S.warn.position.set(0, -0.55, 0);
        if (S.st <= 0) { S.state = 'charge'; S.st = 1.15; ev.push({ type: 'sharkCharge', pos: S.pos.clone() }); }
      } else if (S.state === 'charge') {
        S.warn.material.opacity *= 0.9; sp = 13; S.pos.addScaledVector(S.dir, sp * dt); wig = 26;
        if (d < 1.5 * S.s && !safe) { hits.push({ from: S.pos.clone(), push: S.dir.clone().multiplyScalar(9).setY(3), kind: 'shark' }); S.state = 'tired'; S.st = 2.2; }
        if (S.st <= 0) { S.state = 'tired'; S.st = 2.2; }
      } else if (S.state === 'tired') { // cansado: lento, panza a la vista
        S.warn.material.opacity = 0; wig = 3; S.pos.y += Math.sin(t * 2) * dt * 0.3; S.body.rotation.z = Math.sin(t * 3) * 0.25;
        if (S.st <= 0) { S.state = 'return'; S.body.rotation.z = 0; }
      } else if (S.state === 'return') {
        const home = new THREE.Vector3(S.c.x + Math.cos(S.a) * S.r, S.c.y, S.c.z + Math.sin(S.a) * S.r), v = home.sub(S.pos), l = v.length();
        S.yaw += ang(S.yaw, Math.atan2(v.x, v.z)) * Math.min(1, dt * 4); S.pos.addScaledVector(v.normalize(), Math.min(l, 5 * dt));
        if (l < 1) { S.state = 'patrol'; S.st = 2.5; }
      } else if (S.state === 'stun') { wig = 2; S.body.rotation.z = Math.sin(t * 9) * 0.4; if (S.st <= 0) { S.state = 'return'; S.body.rotation.z = 0; } }
      // estocada de la protagonista
      if (dashing >= 0 && S.hitDash !== dashing && d < 1.7 * S.s && S.state !== 'charge') {
        S.hitDash = dashing; S.hp--; S.flash = 1; ev.push({ type: 'foeHurt', pos: S.pos.clone(), kind: 'shark' });
        S.pos.addScaledVector(new THREE.Vector3(S.pos.x - P.x, 0, S.pos.z - P.z).normalize(), 1.5);
        if (S.hp <= 0) { S.alive = false; S.st = 0; S.warn.visible = false; ev.push({ type: 'foeDie', pos: S.pos.clone(), kind: 'shark' }); }
        else { S.state = 'stun'; S.st = 1.4; }
      }
      S.g.position.copy(S.pos); S.g.rotation.y = S.yaw;
      if (S.art) { S.art.U.uTime.value = t; S.art.U.uFreq.value = wig * 0.9; S.art.U.uAmp.value = wig > 10 ? 0.26 : 0.16; } else { S.tail.rotation.y = Math.sin(t * wig) * (wig > 10 ? 0.5 : 0.3); S.body.rotation.y = -Math.sin(t * wig) * 0.06; }
      S.skin.emissive.setRGB(S.flash, S.flash * 0.9, S.flash * 0.9);
    }
    // ---- pulpos ----
    for (const O of this.octos) {
      if (!O.alive) { O.st += dt; O.g.position.y -= dt * 0.8; O.g.scale.multiplyScalar(1 - dt * 0.7); if (O.st > 2.5) O.g.visible = false; continue; }
      const hy = O.headY || 1.2 * O.s, d = Math.hypot(P.x - O.pos.x, P.z - O.pos.z), dy = P.y + 0.9 - (O.pos.y + hy), reach = 3.6 * O.s;
      O.st -= dt; O.flash = Math.max(0, O.flash - dt * 3);
      O.yaw += ang(O.yaw, Math.atan2(P.x - O.pos.x, P.z - O.pos.z)) * Math.min(1, dt * 2); O.g.rotation.y = O.yaw;
      const bre = 1 + Math.sin(t * 2.2) * 0.05; O.head.scale.set(bre, 1.25 / bre, bre);
      if (O.art) { O.art.U.uTime.value = t; const sel = O.state === 'windup' || O.state === 'slam'; const tgt = O.state === 'windup' ? 0.9 : O.state === 'slam' ? -0.6 : 0; O.art.U.uLift.value += (tgt - O.art.U.uLift.value) * Math.min(1, dt * (O.state === 'slam' ? 18 : 6)); if (sel) O.art.U.uDir.value = O.liftDir || 0; O.g.scale.y = bre; }
      const near = !safe && d < reach + 1 && Math.abs(dy) < 3 * O.s;
      if (O.state === 'idle' && near && O.st <= 0 && !auto) {
        // elige el tentáculo más cercano a la protagonista
        const la = ang(O.yaw, Math.atan2(P.x - O.pos.x, P.z - O.pos.z)); let best = 0, bd = 9;
        O.tents.forEach((T, i) => { const q = Math.abs(ang(T.a, la)); if (q < bd) { bd = q; best = i; } });
        O.liftDir = la; O.target = best; O.state = 'windup'; O.st = O.king ? 0.75 : 0.9; ev.push({ type: 'octoWind', pos: O.pos.clone() });
      } else if (O.state === 'windup' && O.st <= 0) {
        O.state = 'slam'; O.st = 0.35; ev.push({ type: 'octoSlam', pos: O.pos.clone() });
        const T = O.tents[O.target], wa = O.yaw + (T ? T.a : (O.liftDir || 0)); const tx = O.pos.x + Math.sin(wa) * reach * 0.7, tz = O.pos.z + Math.cos(wa) * reach * 0.7;
        if (!safe && Math.hypot(P.x - tx, P.z - tz) < 2.2 * O.s && Math.abs(dy) < 2.5 * O.s) hits.push({ from: O.pos.clone(), push: new THREE.Vector3(P.x - O.pos.x, 0.4, P.z - O.pos.z).normalize().multiplyScalar(8), kind: 'octo' });
      } else if (O.state === 'slam' && O.st <= 0) { O.state = 'idle'; O.st = O.king ? 1.1 : 1.6; }
      else if (O.state === 'hurt' && O.st <= 0) { O.state = 'idle'; O.st = 0.6; }
      // tinta
      O.inkT -= dt;
      if (O.inkT <= 0 && !safe && !auto && d < 10 * O.s && d > 2) { O.inkT = O.king ? 4.5 : 7; this._ink(O, chest); ev.push({ type: 'inkShot', pos: O.pos.clone() }); }
      // tentáculos: ondulan, y el elegido se levanta (brilla) y golpea
      O.tents.forEach((T, i) => {
        const sel = i === O.target && (O.state === 'windup' || O.state === 'slam');
        T.segs.forEach((sg, k) => {
          let rx = 0.18 + Math.sin(t * 1.6 + T.ph + k * 0.7) * 0.18, ry = Math.sin(t * 1.1 + T.ph + k * 0.5) * 0.12;
          if (sel && O.state === 'windup') rx = -0.32 - k * 0.02 + Math.sin(t * 20) * 0.03;
          if (sel && O.state === 'slam') rx = 0.45;
          sg.rotation.x += (rx - sg.rotation.x) * Math.min(1, dt * (sel ? 14 : 4)); sg.rotation.y = ry;
        });
      });
      const glow = O.state === 'windup' ? 0.35 + Math.sin(t * 25) * 0.25 : 0;
      O.skin.emissive.setRGB(Math.max(O.flash, glow), Math.max(O.flash * 0.9, glow * 0.15), O.flash * 0.9);
      // estocada
      const dh = Math.hypot(P.x - O.pos.x, P.y + 0.9 - (O.pos.y + hy), P.z - O.pos.z);
      const autoHit = auto && dh < 5 * O.s && (O.autoT = (O.autoT || 0) + dt) > 1.3;
      if ((dashing >= 0 && O.hitDash !== dashing && dh < 1.5 * O.s + 0.6) || autoHit) {
        O.autoT = 0; O.hitDash = dashing; O.hp--; O.flash = 1; O.state = 'hurt'; O.st = 0.5; ev.push({ type: 'foeHurt', pos: O.pos.clone().setY(O.pos.y + hy), kind: O.king ? 'king' : 'octo', hp: O.hp, maxHp: O.maxHp });
        if (O.hp <= 0) { O.alive = false; O.st = 0; ev.push({ type: 'foeDie', pos: O.pos.clone().setY(O.pos.y + 1), kind: O.king ? 'king' : 'octo', flag: O.flag }); }
      }
    }
    // nubes de tinta
    for (let i = this.inks.length - 1; i >= 0; i--) {
      const K = this.inks[i]; K.life -= dt; K.g.position.addScaledVector(K.v, dt); K.v.multiplyScalar(Math.pow(0.6, dt));
      K.g.children.forEach((s, j) => { s.material.opacity = Math.max(0, Math.min(1, K.life / 1.5)) * 0.85; s.scale.setScalar(K.size * (1 + (3 - K.life) * 0.25) * (0.8 + j * 0.1)); s.material.rotation += dt * (j % 2 ? 0.4 : -0.3); });
      if (!K.hit && K.g.position.distanceTo(chest) < 1.6 * K.size) { K.hit = true; ev.push({ type: 'ink' }); }
      if (K.life <= 0) { this.root.remove(K.g); this.inks.splice(i, 1); }
    }
    // ---- erizos ----
    for (const U of this.urchins) {
      const k = Math.sin(t * U.speed + U.ph) * U.amp; U.pos.copy(U.base); if (U.ax === 'y') U.pos.y += k; else U.pos[U.ax] += k;
      if (U.art) U.art.U.uTime.value = t; U.g.position.copy(U.pos); U.g.rotation.y += dt * 0.4; U.g.rotation.x += dt * 0.25; U.halo.material.opacity = 0.06 + Math.sin(t * 3 + U.ph) * 0.03;
      if (!player.inSub && U.pos.distanceTo(chest) < U.r * 1.9 + 0.5) hits.push({ from: U.pos.clone(), push: chest.clone().sub(U.pos).normalize().multiplyScalar(7), kind: 'urchin' });
    }
    // ---- medusas eléctricas ----
    for (const Z of this.zaps) {
      const k = ((t + Z.ph) % Z.period), st = k > Z.period - 1.0 ? (k > Z.period - 0.25 ? 'zap' : 'charge') : 'calm';
      Z.pos.copy(Z.base); Z.pos.y += Math.sin(t * 0.7 + Z.ph) * Z.amp; Z.g.position.copy(Z.pos);
      if (Z.art) Z.art.U.uTime.value = t + Z.ph; const pulse = 1 + Math.sin(t * 3 + Z.ph) * 0.1; Z.bell.scale.set(pulse, 1 / pulse, pulse);
      Z.tents.forEach((tt, i) => { tt.rotation.x = Math.sin(t * 2 + i) * 0.2; tt.rotation.z = Math.cos(t * 1.6 + i) * 0.2; });
      Z.bellM.emissiveIntensity = st === 'charge' ? 0.8 + Math.sin(t * 40) * 0.6 : st === 'zap' ? 2.2 : 0.5;
      Z.light.intensity = st === 'zap' ? 6 : st === 'charge' ? 1.5 + Math.sin(t * 40) : 0.4;
      if (st === 'zap') { const q = 1 - (k - (Z.period - 0.25)) / 0.25; Z.ring.scale.setScalar(Z.range * (1 - q * 0.6)); Z.ring.material.opacity = 0.9 * q + 0.2; }
      else Z.ring.material.opacity *= 0.85;
      if (st !== Z.was) { if (st === 'zap' && Z.pos.distanceTo(chest) < 16) ev.push({ type: 'zap', pos: Z.pos.clone() }); Z.was = st; }
      if (st === 'zap' && !player.inSub && Z.pos.distanceTo(chest) < Z.range) hits.push({ from: Z.pos.clone(), push: chest.clone().sub(Z.pos).normalize().multiplyScalar(6), kind: 'zap' });
      else if (!player.inSub && Z.pos.distanceTo(chest) < Z.r + 0.6) hits.push({ from: Z.pos.clone(), push: chest.clone().sub(Z.pos).normalize().multiplyScalar(5), kind: 'zap' });
    }
    return hits;
  }
  _ink(O, target) {
    const g = new THREE.Group(), from = O.pos.clone().setY(O.pos.y + 1.1 * O.s); g.position.copy(from); this.root.add(g);
    for (let i = 0; i < 4; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: inkTex(), transparent: true, opacity: 0.85, depthWrite: false, rotation: Math.random() * 6 })); s.position.set((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6); g.add(s); }
    const v = target.clone().sub(from); const l = v.length(); v.normalize().multiplyScalar(Math.min(9, l * 1.6));
    this.inks.push({ g, v, life: 3, size: O.king ? 1.6 : 1.1, hit: false });
  }
  // para la guía/flecha: el enemigo vivo más cercano
  king() { return this.octos.find(o => o.king && o.alive); }
}
