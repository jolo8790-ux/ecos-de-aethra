// Arena de destrucción «Chatarrería»: campo abierto con obstáculos, vehículos apocalípticos (ruedas de monstruo,
// blindaje, púas) y armas de cajas que aparecen al azar. Los vehículos se van destrozando: pierden piezas,
// echan humo y fuego, y al quedarse sin vida estallan en pedazos y vuelven a salir.
// Contra la CPU o en línea (sala pública o con código): cada uno decide sobre su vehículo; quien dispara avisa
// del golpe y el dueño del vehículo golpeado se resta la vida.
import * as THREE from 'three';
import { seatDriver, driverLook } from './race.js';
import { garageOf, DRIVERS } from './garage.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { glbBuffer, LOW_MEM, shrinkTextures } from './glbload.js';
import { SERVER } from './net.js';
export const ROUND_ON = 300; // en la arena pública: rondas de 5 minutos, iguales para todos (por la hora)
const httpURL = p => SERVER.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:') + p;

// carrocerías 3D (generadas con Artlist): se cargan al entrar a la arena; si no llegan, se usan las de piezas
const GLB = {}; let glbLoading = null;
let glbDone = false;
export const loadVehicleModelsDone = () => glbDone;
export function loadVehicleModels() {
  return glbLoading || (glbLoading = Promise.all(VEHICLES.map(v => v.id).map(async id => {
    try { const g = await new GLTFLoader().parseAsync(await glbBuffer(new URL(`../assets/vehicles/${id}.glb.js`, import.meta.url)), '');
      if (LOW_MEM) shrinkTextures(g.scene, 512);
      g.scene.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = false; if (m.material) { m.material.metalness = 0.15; m.material.roughness = 0.75; } } });
      GLB[id] = g.scene; } catch (e) { console.warn('vehículo 3D', id, e); }
  })).then(() => { glbDone = true; }));
}
// dónde van las ruedas, el asiento y el arma en cada carrocería (medido sobre los modelos; el frente es +z)
const FIT = {
  chatarra: { L: 4.4, zf: 1.02, zr: -1.35, wr: 0.6, wy: 0.16, seat: [0.42, -0.55], gun: [1.3, -0.4], out: 0.02 },
  monstruo: { L: 5.0, zf: 1.5, zr: -1.27, wr: 1.02, wy: 0.0, seat: [0.66, 0.35], gun: [1.45, -0.85], out: 0.3 },
  ariete: { L: 4.6, zf: 0.82, zr: -1.5, wr: 0.66, wy: 0.14, seat: [0.95, -0.05], gun: [1.6, -0.95], out: 0.02 },
  pincho: { L: 4.4, zf: 1.24, zr: -1.1, wr: 0.58, wy: 0.14, seat: [0.32, 0.12], gun: [0.95, -0.15], out: 0.05 },
  excavadora: { L: 5.0, tracks: true, seat: [1.6, -0.6], gun: [2.8, -0.9] },
  cisterna: { L: 5.2, zf: 1.51, zr: -1.47, wr: 0.66, wy: 0.15, seat: [1.0, 1.2], gun: [2.15, 1.1], out: 0.04 },
  tanque: { L: 4.6, tracks: true, seat: [2.0, -0.6], gun: [2.4, 2.0], noGun: true },
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angD = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const damp = (k, dt) => 1 - Math.exp(-k * dt);
const rnd = (a, b) => a + Math.random() * (b - a);
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[<>&]/g, '');

const RA = 118; // radio del campo de juego (grande: para que las batallas no se amontonen)
export const ROUND = 180; // segundos por ronda

// ---------- vehículos ----------
export const VEHICLES = [
  { id: 'chatarra', name: 'Rata de Chatarra', icon: '🛞', desc: 'Buggy de chatarra liviano y ágil. Poca armadura.', hp: 95, spd: 30, acc: 21, turn: 2.3, mass: 1, ram: 1, wr: 0.78, color: 0xc8632a },
  { id: 'monstruo', name: 'Monstruo del Desierto', icon: '🚚', desc: 'Ruedas gigantes que aplastan y saltan más alto.', hp: 130, spd: 27, acc: 17, turn: 1.95, mass: 1.5, ram: 1.35, wr: 1.2, color: 0x4a8a3a },
  { id: 'ariete', name: 'Ariete Blindado', icon: '⛨', desc: 'Pala de acero al frente: sus embestidas destrozan.', hp: 165, spd: 24.5, acc: 15, turn: 1.75, mass: 1.9, ram: 1.9, wr: 0.88, color: 0x6a7684 },
  { id: 'pincho', name: 'Escorpión de Púas', icon: '⚡', desc: 'Bólido con púas en las ruedas. El más rápido y el más frágil.', hp: 80, spd: 33, acc: 24, turn: 2.5, mass: 0.9, ram: 1.25, wr: 0.74, color: 0xd8a820 },
  // se ganan jugando: cada uno con una habilidad propia
  { id: 'excavadora', name: 'Excavadora Demoledora', icon: '⚒', desc: 'Orugas y pala de púas: arrasa con todo y ni los choques ni las explosiones la mueven.', hp: 195, spd: 21.5, acc: 13, turn: 1.6, mass: 2.6, ram: 2.3, wr: 0.6, color: 0xd8a020, tracks: true,
    perk: 'Inamovible', lock: { text: 'Destroza 15 vehículos en la arena', ok: d => (d.kills || 0) >= 15 } },
  { id: 'cisterna', name: 'Cisterna de Fuego', icon: '🔥', desc: 'Lanzallamas más largos y, al estallar, su tanque explota y quema a todos alrededor.', hp: 150, spd: 26, acc: 16, turn: 1.85, mass: 2.0, ram: 1.5, wr: 0.66, color: 0xc03020, boom: true,
    perk: 'Tanque explosivo', lock: { text: 'Gana 3 partidas en la arena', ok: d => (d.wins || 0) >= 3 } },
  { id: 'tanque', name: 'Tanque de Chatarra', icon: '🎯', desc: 'Cañón propio: sin arma de caja, USAR dispara un cañonazo cada 3 segundos.', hp: 180, spd: 22, acc: 14, turn: 1.75, mass: 2.2, ram: 1.6, wr: 0.6, color: 0x6a6a3a, tracks: true, cannon: true,
    perk: 'Cañón', lock: { text: 'Destroza 40 vehículos en la arena', ok: d => (d.kills || 0) >= 40 } },
];
export const vehicleById = id => VEHICLES.find(v => v.id === id) || VEHICLES[0];
export const vehicleOk = (sv, V) => !V.lock || V.lock.ok((sv && sv.derby) || {});
// taller: mejoras por vehículo (tres niveles cada una) y pintura
export const UPGRADES = [
  { id: 'blindaje', icon: '⛨', name: 'Blindaje', desc: '+12 % de vida por nivel', cost: [150, 300, 500] },
  { id: 'motor', icon: '⚙', name: 'Motor', desc: '+5 % de velocidad y aceleración por nivel', cost: [150, 300, 500] },
  { id: 'embestida', icon: '💥', name: 'Embestida', desc: '+15 % de daño al chocar por nivel', cost: [120, 250, 420] },
];
export const DPAINTS = [{ id: 'orig', name: 'Original', c: null }, { id: 'oxido', name: 'Óxido', c: 0xb04a2a }, { id: 'militar', name: 'Militar', c: 0x5a7a3a }, { id: 'arena', name: 'Arena', c: 0xd8b070 },
  { id: 'noche', name: 'Noche', c: 0x3a3a48 }, { id: 'cobalto', name: 'Cobalto', c: 0x4a6ab0 }, { id: 'veneno', name: 'Veneno', c: 0x8ac030 }, { id: 'sangre', name: 'Rubí', c: 0xb02a4a }];
export const derbyGarage = sv => { const d = (sv.derby = sv.derby || {}); d.up = d.up || {}; d.paint = d.paint || {}; return d; };
export const upOf = (sv, vid) => { const u = derbyGarage(sv).up[vid] || {}; return [u.blindaje | 0, u.motor | 0, u.embestida | 0]; };
function withUp(V, up = [0, 0, 0]) { const [b, m, e] = up.map(x => clamp(x | 0, 0, 3)); return { ...V, hp: Math.round(V.hp * (1 + 0.12 * b)), spd: V.spd * (1 + 0.05 * m), acc: V.acc * (1 + 0.05 * m), ram: V.ram * (1 + 0.15 * e), up: [b, m, e] }; }

// ---------- armas (de las cajas) ----------
export const WEAPONS = {
  metralla: { icon: '🔫', name: 'Metralleta', n: 6, w: 3 },
  cohete: { icon: '🚀', name: 'Cohetes', n: 3, w: 3 },
  misil: { icon: '🎯', name: 'Misil teledirigido', n: 1, w: 1.6 },
  minas: { icon: '🧨', name: 'Minas', n: 3, w: 2 },
  bomba: { icon: '💣', name: 'Bombas', n: 2, w: 2.2 },
  fuego: { icon: '🔥', name: 'Lanzallamas', n: 2, w: 2 },
  reparar: { icon: '🔧', name: 'Reparación', n: 1, w: 1.4 },
  escudo: { icon: '🫧', name: 'Escudo', n: 1, w: 1 },
  nitro: { icon: '💨', name: 'Nitro', n: 2, w: 1.5 },
};
WEAPONS.especial = { icon: '★', name: 'Poder especial', n: 1, w: 0 };
// el poder especial de cada vehículo (sale de las cajas doradas)
export const SPECIALS = {
  chatarra: { icon: '🔫', name: 'Ametralladora doble', desc: '4 s de ráfaga continua con dos cañones' },
  monstruo: { icon: '🚚', name: 'Aplastamonstruo', desc: 'Salta muy alto y aplasta todo al caer' },
  ariete: { icon: '⛨', name: 'Embestida imparable', desc: '5 s sin recibir daño y con embestidas brutales' },
  pincho: { icon: '🎯', name: 'Enjambre de aguijones', desc: '4 misiles teledirigidos' },
  excavadora: { icon: '⚒', name: 'Terremoto', desc: 'Una onda que sacude y daña todo alrededor' },
  cisterna: { icon: '🔥', name: 'Mar de fuego', desc: '4 s rodeada de llamas que queman a todos cerca' },
  tanque: { icon: '💣', name: 'Bombardeo', desc: '5 cañonazos en abanico' },
};
function rollWeapon(hpFrac) {
  let s = 0; const w = {}; for (const [k, W] of Object.entries(WEAPONS)) { w[k] = W.w * (k === 'reparar' ? (hpFrac < 0.5 ? 3 : 0.4) : 1); s += w[k]; }
  let r = Math.random() * s; for (const k in w) { r -= w[k]; if (r <= 0) return k; } return 'cohete';
}

// ---------- texturas ----------
function canvasTex(w, h, draw, rep = 1) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 4; return t;
}
let _rust = null, _ground = null, _crate = null;
const rustTex = () => _rust || (_rust = canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#d8d0c4'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) { const r = Math.random(); c.fillStyle = r < 0.4 ? `rgba(150,70,30,${rnd(0.15, 0.5)})` : r < 0.7 ? `rgba(90,60,40,${rnd(0.1, 0.35)})` : `rgba(255,255,255,${rnd(0.05, 0.2)})`; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, rnd(1, 9), 0, 7); c.fill(); }
  c.strokeStyle = 'rgba(40,30,25,.35)'; c.lineWidth = 2; for (let k = 0; k < 6; k++) { c.beginPath(); const y = Math.random() * h; c.moveTo(0, y); c.lineTo(w, y + rnd(-6, 6)); c.stroke(); }
  c.fillStyle = 'rgba(30,25,20,.55)'; for (let k = 0; k < 40; k++) { c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 2.2, 0, 7); c.fill(); } // remaches
}));
const groundTex = () => _ground || (_ground = canvasTex(512, 512, (c, w, h) => {
  const g = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.7); g.addColorStop(0, '#c9945e'); g.addColorStop(1, '#a8703f'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) { c.fillStyle = Math.random() < 0.5 ? `rgba(90,55,30,${rnd(0.05, 0.2)})` : `rgba(240,200,150,${rnd(0.05, 0.18)})`; c.fillRect(Math.random() * w, Math.random() * h, rnd(1, 5), rnd(1, 5)); }
  c.strokeStyle = 'rgba(70,40,20,.25)'; c.lineWidth = 1.5; // grietas
  for (let k = 0; k < 30; k++) { let x = Math.random() * w, y = Math.random() * h; c.beginPath(); c.moveTo(x, y); for (let s = 0; s < 6; s++) { x += rnd(-22, 22); y += rnd(-22, 22); c.lineTo(x, y); } c.stroke(); }
  c.strokeStyle = 'rgba(60,35,20,.22)'; c.lineWidth = 7; // huellas de neumáticos
  for (let k = 0; k < 8; k++) { c.beginPath(); const x0 = Math.random() * w, y0 = Math.random() * h; c.moveTo(x0, y0); c.bezierCurveTo(x0 + rnd(-200, 200), y0 + rnd(-200, 200), x0 + rnd(-200, 200), y0 + rnd(-200, 200), x0 + rnd(-260, 260), y0 + rnd(-260, 260)); c.stroke(); }
}, 10));
const crateTex = () => _crate || (_crate = canvasTex(128, 128, (c, w, h) => {
  c.fillStyle = '#8a5a2a'; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < h; y += 16) c.fillRect(0, y, w, 2);
  c.save(); c.beginPath(); c.rect(0, 0, w, 22); c.rect(0, h - 22, w, 22); c.clip(); for (let x = -30; x < w + 30; x += 22) { c.fillStyle = '#ffc81a'; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 11, 0); c.lineTo(x - 11, h); c.lineTo(x - 22, h); c.fill(); c.fillStyle = '#1a1a1a'; c.beginPath(); c.moveTo(x + 11, 0); c.lineTo(x + 22, 0); c.lineTo(x, h); c.lineTo(x - 11, h); c.fill(); } c.restore();
  c.strokeStyle = '#3a2410'; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6);
  c.font = 'bold 60px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 5; c.strokeText('?', w / 2, h / 2 + 3); c.fillText('?', w / 2, h / 2 + 3);
}));

// ---------- modelo de un vehículo ----------
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: o.r ?? 0.75, metalness: o.m ?? 0.25, map: o.map || null, emissive: o.e || 0, emissiveIntensity: o.ei ?? 1 });
function box(w, h, l, mat, x = 0, y = 0, z = 0, part = false) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat); m.position.set(x, y, z); m.castShadow = true; m.userData.part = part; return m; }
function cyl(r1, r2, h, mat, seg = 12) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat); m.castShadow = true; return m; }
function tube(a, b, r, mat) { const d = new THREE.Vector3().subVectors(b, a), m = cyl(r, r, d.length(), mat, 8); m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m; }
function wheel(V, spikes) {
  const g = new THREE.Group(), r = V.wr, w = V.id === 'monstruo' ? 0.95 : 0.6;
  const tire = cyl(r, r, w, M(0x1c1a18, { r: 0.95, m: 0 }), 22); tire.rotation.z = Math.PI / 2; g.add(tire);
  const tread = M(0x2a2724, { r: 1, m: 0 });
  for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2, b = box(w * 1.04, 0.14, r * 0.32, tread); b.position.set(0, Math.cos(a) * r, Math.sin(a) * r); b.rotation.x = -a; g.add(b); }
  const rim = cyl(r * 0.55, r * 0.55, w + 0.04, M(0x9aa0a6, { r: 0.35, m: 0.8 }), 10); rim.rotation.z = Math.PI / 2; g.add(rim);
  const hub = cyl(r * 0.18, r * 0.18, w + 0.12, M(0x3a3a3a, { m: 0.6 }), 8); hub.rotation.z = Math.PI / 2; g.add(hub);
  if (spikes) for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.7, 8), M(0xd8dde2, { r: 0.3, m: 0.9 })); c.rotation.z = -s * Math.PI / 2; c.position.x = s * (w / 2 + 0.3); g.add(c); }
  return g;
}
export function buildVehicle(V, paint = null) {
  if (GLB[V.id]) return buildVehicle3D(V, paint);
  return buildVehicleParts(V, paint);
}
function buildVehicle3D(V, paint) {
  const F = FIT[V.id], root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const shell = GLB[V.id].clone(true); shell.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); if (paint != null) m.material.color.setHex(paint).lerp(new THREE.Color(0xffffff), 0.45); } });
  const bb = new THREE.Box3().setFromObject(shell), size = bb.getSize(new THREE.Vector3()), sc = F.L / size.z;
  shell.scale.setScalar(sc); const bottom = F.tracks ? 0 : F.wr - F.wy;
  shell.position.set(-(bb.min.x + bb.max.x) / 2 * sc, bottom - bb.min.y * sc, -(bb.min.z + bb.max.z) / 2 * sc); body.add(shell);
  const W = size.x * sc, H = size.y * sc, top = bottom + H;
  const wheels = [], wx = W / 2 - 0.12 + F.out;
  if (!F.tracks) for (const [x, z] of [[-wx, F.zf], [wx, F.zf], [-wx, F.zr], [wx, F.zr]]) {
    const piv = new THREE.Group(); piv.position.set(x, F.wr, z); root.add(piv);
    const wh = wheel({ ...V, wr: F.wr }, V.id === 'pincho'); piv.add(wh); wheels.push({ piv, wh, front: z > 0 });
  }
  // piezas que se sueltan con los golpes: blindaje lateral, faros, púas, rueda de auxilio y caños
  const steel = M(0x8c949c, { map: rustTex(), r: 0.45, m: 0.75 }), dark = M(0x2a2826, { r: 0.7, m: 0.5 }), light = M(0xfff0b0, { e: 0xffd070, ei: 1.2 }), tint = M(paint ?? V.color, { map: rustTex(), r: 0.8, m: 0.35 });
  const heavy = !!(F.tracks || V.boom); // los nuevos ya vienen blindados: solo tornillos y rueda de auxilio
  for (const sd of [-1, 1]) { const pl = heavy ? new THREE.Group() : box(0.12, H * 0.32, F.L * 0.32, tint, sd * (W / 2 + 0.04), bottom + H * 0.32, -0.2, true); body.add(pl);
    for (const z of [-0.6, 0.2]) { const r = cyl(0.07, 0.07, 0.06, steel, 6); r.rotation.z = Math.PI / 2; r.position.set(sd * (W / 2 + 0.12), bottom + H * 0.36, z); body.add(r); r.userData.part = true; } }
  if (!heavy) for (const x of [-0.6, 0, 0.6]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.55, 8), steel); c.rotation.x = Math.PI / 2; c.position.set(x * W * 0.4, bottom + 0.3, F.L / 2 + 0.1); body.add(c); c.userData.part = true; }
  const spare = new THREE.Group(); spare.position.set(0, bottom + H * 0.45, -F.L / 2 - 0.05); spare.rotation.y = Math.PI / 2;
  const sw = wheel({ ...V, wr: 0.42 }, false); sw.scale.set(0.6, 1, 1); spare.add(sw); body.add(spare);
  spare.traverse(m => { if (m.isMesh) m.userData.part = false; }); const sp = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.14, 6, 14), dark); sp.position.copy(spare.position); body.add(sp); sp.userData.part = true; body.remove(spare);
  const gun = new THREE.Group(); gun.position.set(0, bottom + F.gun[0], F.gun[1]);
  if (!F.noGun) { gun.add(box(0.5, 0.3, 0.6, dark)); for (const x of [-0.12, 0.12]) { const b = cyl(0.06, 0.06, 0.9, dark, 8); b.rotation.x = Math.PI / 2; b.position.set(x, 0.02, 0.6); gun.add(b); } } // el tanque dispara por su cañón
  body.add(gun);
  root.traverse(m => { if (m.isMesh) m.castShadow = true; });
  return { root, body, wheels, gun, seat: [bottom + F.seat[0], F.seat[1]], top, shell, wr: F.wr || 0.6 };
}
function buildVehicleParts(V, paint = null) {
  if (!FIT[V.id] || ['excavadora', 'cisterna', 'tanque'].includes(V.id)) V = { ...V, id: V.tracks ? 'ariete' : 'monstruo' }; // sin modelo 3D: se arma con piezas parecidas
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const col = paint ?? V.color, rust = M(col, { map: rustTex(), r: 0.8, m: 0.35 }), dark = M(0x2a2826, { r: 0.7, m: 0.5 }), steel = M(0x8c949c, { map: rustTex(), r: 0.45, m: 0.75 });
  const cage = M(0x222222, { r: 0.5, m: 0.7 }), light = M(0xfff0b0, { e: 0xffd070, ei: 1.2 });
  const r = V.wr, L = 4.2, W = 2.3, y0 = r * 0.85 + (V.id === 'monstruo' ? 0.55 : 0.1); // altura del chasis
  const wheels = [];
  const wz = V.id === 'monstruo' ? 1.75 : 1.55, wx = V.id === 'monstruo' ? 1.45 : 1.25;
  for (const [x, z] of [[-wx, wz], [wx, wz], [-wx, -wz], [wx, -wz]]) {
    const piv = new THREE.Group(); piv.position.set(x, r, z); root.add(piv);
    const wh = wheel(V, V.id === 'pincho'); piv.add(wh); wheels.push({ piv, wh, front: z > 0 });
  }
  body.add(box(W - 0.3, 0.32, L, dark, 0, y0, 0)); // chasis
  if (V.id === 'monstruo') { // suspensión alta a la vista
    for (const w of wheels) body.add(tube(new THREE.Vector3(w.piv.position.x * 0.55, y0, w.piv.position.z), new THREE.Vector3(w.piv.position.x * 0.9, r, w.piv.position.z), 0.1, steel));
  }
  const top = y0 + 0.16;
  if (V.id === 'chatarra') {
    body.add(box(1.9, 0.55, 2.6, rust, 0, top + 0.27, -0.4, true));
    body.add(box(1.2, 0.5, 1.0, steel, 0, top + 0.25, 1.4, true)); // motor
    for (const x of [-0.35, 0.35]) { const p = cyl(0.09, 0.09, 1.1, steel); p.position.set(x, top + 0.95, 1.5); body.add(p); p.userData.part = true; }
    const A = (x, y, z) => new THREE.Vector3(x, y, z); // jaula antivuelco
    for (const x of [-0.85, 0.85]) { body.add(tube(A(x, top + 0.5, -1.5), A(x * 0.9, top + 1.55, -0.9), 0.06, cage)); body.add(tube(A(x, top + 0.5, 0.5), A(x * 0.9, top + 1.55, -0.2), 0.06, cage)); body.add(tube(A(x * 0.9, top + 1.55, -0.9), A(x * 0.9, top + 1.55, -0.2), 0.06, cage)); }
    body.add(tube(A(-0.77, top + 1.55, -0.55), A(0.77, top + 1.55, -0.55), 0.06, cage));
    for (const x of [-0.7, 0, 0.7]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.6, 8), steel); c.rotation.x = Math.PI / 2; c.position.set(x, top + 0.15, 2.25); body.add(c); c.userData.part = true; }
  } else if (V.id === 'monstruo') {
    body.add(box(2.0, 0.7, 1.7, rust, 0, top + 0.35, 1.1, true)); // capó
    body.add(box(2.0, 0.55, 1.4, rust, 0, top + 0.28, -1.35, true)); // caja
    const A = (x, y, z) => new THREE.Vector3(x, y, z);
    for (const x of [-0.95, 0.95]) for (const z of [0.2, -0.6]) body.add(tube(A(x, top + 0.3, z), A(x * 0.92, top + 1.45, z), 0.07, cage)); // cabina abierta
    body.add(box(1.85, 0.08, 0.95, cage, 0, top + 1.48, -0.2, true));
    body.add(box(2.1, 0.18, 0.35, steel, 0, top + 0.2, 2.1, true)); // paragolpes
    for (const x of [-0.6, -0.2, 0.2, 0.6]) { const l = box(0.28, 0.22, 0.12, light, x, top + 1.62, 0.25); body.add(l); }
    for (const x of [-0.75, 0.75]) { const p = cyl(0.11, 0.11, 1.3, steel); p.position.set(x, top + 1.0, -0.75); body.add(p); p.userData.part = true; }
  } else if (V.id === 'ariete') {
    body.add(box(2.1, 0.9, 3.0, rust, 0, top + 0.45, -0.4, true));
    const plow = box(2.6, 1.0, 0.25, steel, 0, top + 0.25, 2.05, true); plow.rotation.x = -0.45; body.add(plow);
    for (const x of [-1.1, 1.1]) { const s = box(0.15, 0.7, 2.6, steel, x, top + 0.5, -0.4, true); body.add(s); }
    for (const x of [-0.9, -0.3, 0.3, 0.9]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.55, 8), steel); c.rotation.x = Math.PI / 2; c.position.set(x, top + 0.35, 2.35); body.add(c); c.userData.part = true; }
    body.add(box(1.0, 0.25, 0.9, dark, 0, top + 1.0, -0.2)); // escotilla
    for (const z of [-1.5, -0.9]) body.add(box(1.8, 0.12, 0.2, steel, 0, top + 0.95, z, true));
  } else { // pincho
    const nose = box(1.6, 0.4, 2.0, rust, 0, top + 0.2, 0.9, true); nose.rotation.x = 0.12; body.add(nose);
    body.add(box(1.8, 0.55, 1.6, rust, 0, top + 0.3, -0.9, true));
    const eng = box(1.1, 0.7, 0.9, steel, 0, top + 0.75, -1.5, true); body.add(eng);
    for (const x of [-0.4, 0, 0.4]) { const p = cyl(0.08, 0.1, 0.9, steel); p.position.set(x, top + 1.3, -1.7); p.rotation.x = -0.4; body.add(p); p.userData.part = true; }
    const A = (x, y, z) => new THREE.Vector3(x, y, z); // aguijón
    const st = tube(A(0, top + 0.6, -2.0), A(0, top + 1.8, -1.7), 0.09, steel); body.add(st); st.userData.part = true;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, 8), M(0xd03020, { m: 0.5 })); tip.position.set(0, top + 1.95, -1.55); tip.rotation.x = 0.9; body.add(tip); tip.userData.part = true;
  }
  // arma en el techo (siempre a la vista: aquí sale lo que dispares)
  const gun = new THREE.Group(); gun.position.set(0, top + (V.id === 'monstruo' ? 1.6 : V.id === 'ariete' ? 1.15 : V.id === 'pincho' ? 0.65 : 1.62), V.id === 'pincho' ? 0.6 : -0.4);
  gun.add(box(0.5, 0.3, 0.6, dark)); for (const x of [-0.12, 0.12]) { const b = cyl(0.06, 0.06, 0.9, cage, 8); b.rotation.x = Math.PI / 2; b.position.set(x, 0.02, 0.6); gun.add(b); }
  body.add(gun);
  const seat = { chatarra: [top + 0.15, -0.55], monstruo: [top + 0.25, -0.2], ariete: [top + 0.55, -0.15], pincho: [top + 0.1, 0.0] }[V.id];
  root.traverse(m => { if (m.isMesh) m.castShadow = true; });
  return { root, body, wheels, gun, seat, top };
}

// ---------- el campo ----------
function buildField(D) {
  const g = new THREE.Group(); const obs = []; const ramps = []; const barrels = [];
  const ground = new THREE.Mesh(new THREE.CircleGeometry(260, 72), new THREE.MeshStandardMaterial({ map: groundTex(), roughness: 0.95, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; g.add(ground);
  const rockM = new THREE.MeshStandardMaterial({ color: 0x9a6a44, roughness: 0.95, flatShading: true });
  const rock = (x, z, s, h = 1) => { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockM); m.position.set(x, s * 0.45 * h, z); m.scale.y = h; m.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  // muralla de rocas y chatarra alrededor
  for (let k = 0; k < 96; k++) { const a = k / 96 * Math.PI * 2, rr = RA + 4 + rnd(0, 7); rock(Math.sin(a) * rr, Math.cos(a) * rr, rnd(4, 7.5), rnd(1, 1.9)); }
  for (let k = 0; k < 34; k++) { const a = rnd(0, 6.28), rr = rnd(150, 230); rock(Math.sin(a) * rr, Math.cos(a) * rr, rnd(12, 26), rnd(1.2, 2.6)); } // mesetas lejanas
  const fence = new THREE.MeshStandardMaterial({ color: 0x6a5040, map: rustTex(), roughness: 0.8, metalness: 0.4 });
  for (let k = 0; k < 62; k++) { const a = (k + 0.5) / 62 * Math.PI * 2, m = new THREE.Mesh(new THREE.BoxGeometry(12.4, rnd(2.2, 3.4), 0.25), fence); m.position.set(Math.sin(a) * (RA + 1.5), 1.2, Math.cos(a) * (RA + 1.5)); m.rotation.y = a + Math.PI / 2; m.rotation.z = rnd(-0.06, 0.06); m.castShadow = true; g.add(m); }
  // obstáculos: rocas, chatarra, contenedores, pilas de neumáticos
  const rnd2 = (() => { let s = 1234567; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const free = (x, z, r) => Math.hypot(x, z) < RA - r - 6 && obs.every(o => Math.hypot(o.x - x, o.z - z) > o.r + r + 5) && ramps.every(R => Math.hypot(R.x - x, R.z - z) > 12);
  const place = (r, tries = 40) => { for (let t = 0; t < tries; t++) { const a = rnd2() * 6.28, d = 10 + rnd2() * (RA - 20); const x = Math.sin(a) * d, z = Math.cos(a) * d; if (free(x, z, r)) return [x, z]; } return null; };
  // rampas
  const rampM = new THREE.MeshStandardMaterial({ color: 0x7a6a5a, map: rustTex(), roughness: 0.7, metalness: 0.5 });
  for (const [x, z, yaw] of [[0, 26, 0], [-30, -18, 2.1], [32, -14, -2.0], [0, -44, Math.PI], [70, 40, -0.8], [-72, 38, 0.9], [62, -70, 2.6], [-66, -66, -2.4], [0, 88, Math.PI], [96, -10, -1.6], [-98, -4, 1.6]]) {
    const L = 8, W = 5, H = 2.2, geo = new THREE.BufferGeometry(); // cuña
    const v = [-W / 2, 0, -L / 2, W / 2, 0, -L / 2, W / 2, H, L / 2, -W / 2, H, L / 2, -W / 2, 0, L / 2, W / 2, 0, L / 2];
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.setIndex([0, 3, 2, 0, 2, 1, 4, 3, 0, 1, 2, 5, 4, 5, 2, 4, 2, 3]); geo.computeVertexNormals();
    const uv = [0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0]; geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const m = new THREE.Mesh(geo, rampM); m.position.set(x, 0, z); m.rotation.y = yaw; m.castShadow = m.receiveShadow = true; g.add(m);
    for (let k = 0; k < 4; k++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.9), new THREE.MeshBasicMaterial({ color: k % 2 ? 0x1a1a1a : 0xffc81a })); s.position.set((k - 1.5) * 1.1, H + 0.04, L / 2 - 0.5); s.rotation.x = 0; m.add(s); }
    ramps.push({ x, z, yaw, L, W, H });
  }
  const scrap = new THREE.MeshStandardMaterial({ color: 0x5a4a40, map: rustTex(), roughness: 0.85, metalness: 0.5 });
  const cont = [0xb04a30, 0x3a6a9a, 0x5a8a4a, 0xc8a040].map(c => new THREE.MeshStandardMaterial({ color: c, map: rustTex(), roughness: 0.7, metalness: 0.45 }));
  for (let k = 0; k < 16; k++) { const p = place(3.2); if (!p) continue; const s = rnd(2.4, 3.4); rock(p[0], p[1], s, rnd(0.9, 1.6)); obs.push({ x: p[0], z: p[1], r: s * 0.95 }); }
  for (let k = 0; k < 9; k++) { const p = place(4.5); if (!p) continue; // contenedores (dos círculos)
    const yaw = rnd2() * 3.14, m = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 7.5), cont[k % 4]); m.position.set(p[0], 1.5, p[1]); m.rotation.y = yaw; m.castShadow = m.receiveShadow = true; g.add(m);
    for (const d of [-2.3, 0, 2.3]) obs.push({ x: p[0] + Math.sin(yaw) * d, z: p[1] + Math.cos(yaw) * d, r: 1.9 }); }
  for (let k = 0; k < 12; k++) { const p = place(2.6); if (!p) continue; // autos chatarra aplastados
    const yaw = rnd2() * 6.28, c = new THREE.Group(); c.position.set(p[0], 0, p[1]); c.rotation.set(rnd(-0.1, 0.1), yaw, rnd(-0.2, 0.2)); g.add(c);
    c.add(box(2.1, 0.8, 4.0, scrap, 0, 0.45, 0)); c.add(box(1.8, 0.5, 1.8, scrap, 0, 1.0, -0.3)); obs.push({ x: p[0], z: p[1], r: 2.1 }); }
  const tireM = M(0x1c1a18, { r: 0.95, m: 0 });
  for (let k = 0; k < 14; k++) { const p = place(1.4); if (!p) continue; const n = 2 + Math.floor(rnd2() * 3);
    for (let j = 0; j < n; j++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.32, 8, 16), tireM); t.rotation.x = Math.PI / 2; t.position.set(p[0], 0.32 + j * 0.6, p[1]); t.castShadow = true; g.add(t); } obs.push({ x: p[0], z: p[1], r: 1.15, soft: true }); }
  // lugares de las cajas (fijos)
  const spots = []; for (let k = 0; k < 120 && spots.length < 24; k++) { const p = place(1.2); if (p && spots.every(q => Math.hypot(q[0] - p[0], q[1] - p[1]) > 16)) spots.push(p); }
  // cajas doradas: el poder especial de cada vehículo (pocas y repartidas)
  const gold = []; for (const [a, d] of [[0.5, 52], [2.1, 60], [3.7, 55], [5.3, 62], [1.3, 95], [4.4, 92]]) { const x = Math.sin(a) * d, z = Math.cos(a) * d; if (obs.every(o => Math.hypot(o.x - x, o.z - z) > o.r + 4)) gold.push([x, z]); }
  // barriles explosivos
  const bm = M(0xc8301a, { r: 0.5, m: 0.5 }), bs = M(0xffc81a, { r: 0.6 });
  for (let k = 0; k < 20; k++) { const p = place(0.9); if (!p) continue; const b = new THREE.Group(); b.position.set(p[0], 0, p[1]); g.add(b);
    const c = cyl(0.55, 0.55, 1.3, bm, 14); c.position.y = 0.65; b.add(c); const s = cyl(0.57, 0.57, 0.18, bs, 14); s.position.y = 0.9; b.add(s);
    const o = { x: p[0], z: p[1], r: 0.7, barrel: b, t: 0 }; obs.push(o); barrels.push(o); }
  // luces de obra con humo y polvo al viento (ambiente)
  const dust = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: 1500 }, (_, i) => i % 3 === 1 ? rnd(0.3, 9) : rnd(-140, 140)), 3)), new THREE.PointsMaterial({ color: 0xe8c090, size: 0.25, transparent: true, opacity: 0.5, depthWrite: false }));
  g.add(dust);
  return { g, obs, ramps, barrels, dust, spots, gold };
}
function rampH(R, x, z) { // altura de la rampa en (x, z) y si estás encima
  const dx = x - R.x, dz = z - R.z, c = Math.cos(R.yaw), s = Math.sin(R.yaw);
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  if (Math.abs(lx) > R.W / 2 || Math.abs(lz) > R.L / 2) return -1;
  return R.H * (lz + R.L / 2) / R.L;
}

// ---------- un vehículo en juego ----------
class Car {
  constructor(D, o) {
    Object.assign(this, { x: 0, z: 0, y: 0, vy: 0, yaw: 0, vx: 0, vz: 0, steerA: 0, item: null, n: 0, inv: 0, shieldT: 0, boostT: 0, fireT: 0, burst: 0, burstT: 0, dead: 0, kills: 0, deaths: 0, smokeT: 0, lost: 0, air: false, bump: 0, roll: 0, pitch: 0 }, o);
    this.D = D; this.V = withUp(vehicleById(this.vid), this.up); this.hp = this.V.hp;
    const B = buildVehicle(this.V, this.paint); this.B = B; this.root = B.root; D.root.add(this.root);
    this.parts = []; B.body.traverse(m => { if (m.isMesh && m.userData.part) this.parts.push(m); });
    this.parts.sort(() => Math.random() - 0.5);
    this.mats = []; this.root.traverse(m => { if (m.isMesh && m.material && !m.material.transparent) { m.material = m.material.clone(); this.mats.push({ mt: m.material, c: m.material.color.clone() }); } });
    const lib = D.ctx.charLib();
    if (lib) { this.ch = seatDriver(B.body, lib, this.look, true); if (this.ch) { this.ch.root.position.set(0, B.seat[0], B.seat[1]); this.ch.root.scale.setScalar(this.ch.root.scale.x * 1.05); } }
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(2.2, 20), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.3, depthWrite: false })); this.shadow.rotation.x = -Math.PI / 2; this.shadow.scale.set(0.8, 1.2, 1); D.root.add(this.shadow);
    this.tag = null;
  }
  get speed() { return Math.hypot(this.vx, this.vz); }
  get fwd() { return this.vx * Math.sin(this.yaw) + this.vz * Math.cos(this.yaw); }
  remove() { this.D.root.remove(this.root); this.D.root.remove(this.shadow); if (this.tag) this.tag.remove(); }
}

// ---------- la partida ----------
export class Derby {
  constructor(ctx) { this.ctx = ctx; this.active = false; this.cars = []; }

  start(opts) {
    const C = this.ctx; this.opts = opts; this.active = true; this.paused = false; this.over = false; this.gen = (this.gen || 0) + 1;
    this.root = new THREE.Group(); this.root.name = 'chatarreria';
    C.loadRaceZone({ id: 'derby', arena: true, race: true, title: 'La Chatarrería', subtitle: 'Arena de destrucción', seed: 9,
      sky: { top: 0x3a3a6a, bottom: 0xf0a060, fog: 0xd89a68, fogNear: 90, fogFar: 330 }, light: { hemiSky: 0xffe0c0, hemiGround: 0x8a5a3a, sun: 0xffd0a0 },
      palette: {}, start: { id: 'salida', pos: [0, 0, 0], facing: 0 }, islands: [], houses: [], trees: [], lighthouses: [], props: [], pines: [], bigTrees: [], mushrooms: [], snow: 0, airships: [] });
    C.scene.add(this.root);
    const F = this.F = buildField(this); this.root.add(F.g);
    this.fx = new THREE.Group(); this.root.add(this.fx); this.parts = []; this.poolA = []; this.poolN = []; this.shots = []; this.debris = []; this.crates = [];
    const sv = C.getSave() || {}, G = garageOf(sv);
    this.net = opts.net || null; this.ep = opts.ep || 0;
    const DG = derbyGarage(sv), pt = DPAINTS.find(p => p.id === DG.paint[opts.vehicle]);
    this.me = new Car(this, { id: this.net ? this.net.me : 'me', name: (sv.name || 'Tú').slice(0, 16), you: true, vid: opts.vehicle, up: upOf(sv, opts.vehicle), paint: pt ? pt.c : null, look: driverLook(sv, G.driver || 'hero') });
    this.cars = [this.me];
    const pool = DRIVERS.filter(d => d.id !== 'hero').sort(() => Math.random() - 0.5);
    this.bots = opts.bots ?? 5;
    if (!this.net) for (let k = 0; k < this.bots; k++) { const d = pool[k % pool.length]; this._addBot('cpu' + k, d, k); }
    for (const c of this.cars) this._spawn(c, true);
    this.crateMat = new THREE.MeshStandardMaterial({ map: crateTex(), roughness: 0.7, emissive: 0x332200, emissiveIntensity: 0.3 });
    for (let k = 0; k < this.F.spots.length; k++) this._crate(k);
    this.golds = []; this.goldMat = new THREE.MeshStandardMaterial({ map: crateTex(), color: 0xffd860, roughness: 0.35, metalness: 0.7, emissive: 0xc08000, emissiveIntensity: 0.55 });
    for (let k = 0; k < this.F.gold.length; k++) this._goldCrate(k);
    this._pairT = {}; this.clock = 0; this.left = opts.endless ? 1e9 : opts.time || ROUND; this.camPos = null; this.phase = 'count'; this.st = 0;
    this.remotes = new Map();
    if (this.net) { this.net.onEvent((from, ev) => { try { this._onNet(from, ev); } catch (e) { console.warn('red', e); } }); }
    this._hud(true); C.music.play('chatarra', { fade: 1.2 }); C.audio.loadArena && C.audio.loadArena();
    try { if (C.renderer) C.renderer.compile(C.scene, C.camera); } catch (e) {}
  }
  _addBot(id, d, k) {
    const sv = this.ctx.getSave() || {};
    const b = new Car(this, { id, name: d.name, cpu: true, drv: d.id, vid: VEHICLES[(k * 3 + Math.floor(Math.random() * VEHICLES.length)) % VEHICLES.length].id, up: [0, 1, 2].map(() => Math.floor(Math.random() * 2.2)), paint: Math.random() < 0.5 ? DPAINTS[1 + Math.floor(Math.random() * (DPAINTS.length - 1))].c : null, look: driverLook(sv, d.id), skill: 0.82 + Math.random() * 0.15 });
    this.cars.push(b); return b;
  }
  _spawn(c, first = false) {
    let best = null, bd = -1;
    for (let t = 0; t < 24; t++) { const a = rnd(0, 6.28), d = rnd(18, RA - 10), x = Math.sin(a) * d, z = Math.cos(a) * d;
      if (this.F.obs.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 4)) continue;
      const near = Math.min(99, ...this.cars.filter(o => o !== c && !o.dead).map(o => Math.hypot(o.x - x, o.z - z)));
      if (near > bd) { bd = near; best = [x, z]; } }
    if (!best) best = [0, 0];
    c.x = best[0]; c.z = best[1]; c.y = 0; c.vy = 0; c.yaw = Math.atan2(-c.x, -c.z) + rnd(-0.6, 0.6); c.vx = c.vz = 0;
    c.hp = c.V.hp; c.dead = 0; c.inv = first ? 0 : 2.5; c.lost = 0; c.item = null; c.n = 0; c.fireT = 0; c.burst = 0; c.shieldT = 0; c.boostT = 0; c.lastBy = null; c.mgT = 0; c.rageT = 0; c.ringT = 0; c.slam = false;
    c.root.visible = true; c.shadow.visible = true; this._restore(c);
  }
  _restore(c) { // vuelve a ponerle todas sus piezas
    this.debris = this.debris.filter(d => d.c !== c);
    for (const p of c.parts) { if (p.userData.home) { p.userData.home.parent.add(p); p.position.copy(p.userData.home.pos); p.quaternion.copy(p.userData.home.q); p.scale.setScalar(1); } p.visible = true; }
    for (const w of c.B.wheels) { w.piv.add(w.wh); w.wh.position.set(0, 0, 0); w.wh.rotation.set(0, 0, 0); w.wh.scale.setScalar(1); w.wh.visible = true; }
    for (const { mt, c: col } of c.mats) mt.color.copy(col);
  }
  _crate(i) { // las cajas salen siempre en los mismos lugares (así todos los jugadores ven las mismas)
    if (this.crates.some(c => c.i === i)) return;
    const p = this.F.spots[i]; if (!p) return;
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), this.crateMat); m.castShadow = true; this.root.add(m);
    const halo = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.7, 24), new THREE.MeshBasicMaterial({ color: 0xffc81a, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide })); halo.rotation.x = -Math.PI / 2; halo.position.y = -0.95; m.add(halo);
    this.crates.push({ m, i, x: p[0], z: p[1], t: 0, ph: i * 1.7 });
  }

  _goldCrate(i) { // caja dorada: el poder especial del vehículo que la toque
    if (this.golds.some(c => c.i === i)) return; const p = this.F.gold[i]; if (!p) return;
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), this.goldMat); m.castShadow = true; this.root.add(m);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 30, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd040, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); beam.position.y = 14; m.add(beam);
    const halo = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.2, 28), new THREE.MeshBasicMaterial({ color: 0xffe070, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide })); halo.rotation.x = -Math.PI / 2; halo.position.y = -1.15; m.add(halo);
    this.golds.push({ m, i, x: p[0], z: p[1], ph: i * 2.3, beam });
  }
  // ---------- poderes especiales ----------
  _special(c) {
    const id = c.V.id, A = this.ctx.audio, SP = SPECIALS[id];
    if (c.you) { this._flash(`★ ${SP.name}`, '#ffd27a'); this.ctx.input.rumble(260, 0.8); } this._sfx('especial', c.x, c.z, c.you ? 0.9 : 0.6, 'unlock');
    if (this.net && !c.remote) this.net.event({ t: 'sp', ep: this.ep, o: c.id });
    this._specialFx(c, false);
  }
  _specialFx(c, remote) { // remote: solo se ve (el daño lo cuenta el dueño)
    const id = c.V.id;
    if (id === 'chatarra') { c.mgT = 4; c.mgFire = 0; }
    else if (id === 'monstruo') { if (!remote) { c.vy = 17; c.air = true; c.slam = true; } else this._shock(c, 9, 0); }
    else if (id === 'ariete') { c.rageT = 5; if (!remote) c.boostT = 5; this._sfx('nitro', c.x, c.z, 0.9, null, { rate: 0.85 }); }
    else if (id === 'pincho') { if (!remote) for (let k = 0; k < 4; k++) setTimeout(() => { if (this.active && !c.dead) this._fire(c, 'misil'); }, k * 160); }
    else if (id === 'excavadora') this._shock(c, 13, remote ? 0 : 38);
    else if (id === 'cisterna') { c.ringT = 4; this._sfx('fuego', c.x, c.z, 1, null); setTimeout(() => { if (this.active && c.ringT > 0) this._sfx('fuego', c.x, c.z, 1, null); }, 2200); }
    else if (id === 'tanque') { if (!remote) for (let k = 0; k < 5; k++) setTimeout(() => { if (!this.active || c.dead) return; const y0 = c.yaw; c.yaw += (k - 2) * 0.17; this._fire(c, 'cohete'); c.yaw = y0; const S = this.shots[this.shots.length - 1]; if (S) { S.dmg = 22; S.speed = 85; } }, k * 120); }
  }
  _shock(c, r, dmg) { // onda expansiva: anillo de polvo que crece y empuja
    const ring = this._ringG || (this._ringG = new THREE.TorusGeometry(1, 0.18, 6, 40).rotateX(Math.PI / 2));
    this._p(ring, 0xffd8a0, { x: c.x, y: c.y + 0.4, z: c.z, life: 0.6, s0: 1, s1: r, a: 0.9, add: true });
    this._p(ring, 0xc89060, { x: c.x, y: c.y + 0.2, z: c.z, life: 0.9, s0: 1, s1: r * 1.1, a: 0.6 });
    this._dust(c.x, c.z, 24); this.shake = Math.max(this.shake || 0, this._near(c) ? 0.8 : 0); this._sfx('onda', c.x, c.z, 1, 'slam');
    if (!dmg) return;
    for (const o of this.cars) { if (o === c || o.dead) continue; const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz); if (d > r) continue;
      const f = 1 - d / r * 0.5; this._damage(o, dmg * f, c, 'especial'); if (!o.remote && !o.V.tracks) { o.vy = 9 * f; o.air = true; o.vx += dx / (d || 1) * 14 * f; o.vz += dz / (d || 1) * 14 * f; } }
    for (const o of this.F.barrels) if (!(o.t > 0) && Math.hypot(o.x - c.x, o.z - c.z) < r) this._barrelBoom(o, c);
  }
  // ---------- un paso ----------
  update(dt) {
    if (!this.active) return;
    if (this.paused && !this.net) return;
    const C = this.ctx, safe = (n, f) => { try { f(); } catch (e) { console.warn('derby:' + n, e); if (C.onError) C.onError('derby:' + n, e); } };
    this.clock += dt;
    if (this.phase === 'count') { this.st += dt; const n = 3 - Math.floor(this.st); if (n !== this._cnt) { this._cnt = n; if (n > 0) { this._flash(String(n), '#ffd27a'); C.audio.play('beep'); } } if (this.st >= 3) { this.phase = 'fight'; this._flash('¡A DESTROZAR!', '#ff8a4a'); C.audio.play('go'); } }
    else if (this.opts.endless) this._roundTick(dt);
    else if (!this.over) { this.left -= dt; if (this.left <= 0) { this.left = 0; this._end(); } }
    const go = this.phase === 'fight' && !this.over;
    if (this.net) safe('red', () => this._netTick(dt));
    safe('autos', () => {
      for (const c of this.cars) {
        if (c.remote) { this._remoteTick(c, dt); continue; }
        if (c.dead > 0) { if ((c.dead -= dt) <= 0) { this._spawn(c); if (c.you) this._flash('¡De vuelta!', '#7affa0'); } continue; }
        const ctl = !go ? { steer: 0, throttle: 0, brake: 0, drift: false, use: false } : c.you ? this._myControls() : this._bot(c, dt);
        if (ctl.use) this._use(c);
        this._drive(c, ctl, dt);
      }
    });
    safe('choques', () => this._collide(dt));
    safe('armas', () => { this._weapons(dt); this._shotsTick(dt); this._crates(dt); this._barrels(dt); });
    safe('dibujo', () => { for (const c of this.cars) this._sync(c, dt); this._fxTick(dt); });
    safe('cámara', () => this._camera(dt));
    safe('pantalla', () => this._hudTick());
  }
  _myControls() {
    const I = this.ctx.input, k = I.keys, touch = I.isTouch && !I.usingGamepad;
    const steer = -clamp(I.move.x, -1, 1);
    const back = !!(k.KeyS || k.ArrowDown || I._padDodge || this.tBrake || (!touch && I.move.y < -0.5));
    const throttle = touch ? (this.tBrake ? 0 : 1) : ((k.KeyW || k.ArrowUp || I._padJump || I.move.y > 0.35) ? 1 : 0);
    const drift = !!(k.Space || k.ShiftLeft || k.ShiftRight || I._padShield || this.tDrift);
    const use = !!(this.tUseP || ((!touch || I.usingGamepad) && (I.pressed('interact') || I.pressed('grapple') || (I.pressed('attack') && (I.usingGamepad || k.KeyJ))))); this.tUseP = false;
    const hold = !!(this.tUseH || k.KeyE || k.KeyJ);
    return { steer, throttle, brake: back ? 1 : 0, drift, use, hold };
  }
  // ---------- conducción: sobre el suelo o en el aire, derrape y rampas ----------
  _drive(c, ctl, dt) {
    const V = c.V, sf = Math.sin(c.yaw), cf = Math.cos(c.yaw);
    let fwd = c.vx * sf + c.vz * cf, lat = c.vx * cf - c.vz * sf;
    const top = V.spd * (c.boostT > 0 ? 1.45 : 1) * (c.cpu ? c.skill || 0.9 : 1) * (c.hp < V.hp * 0.25 ? 0.9 : 1);
    if (c.boostT > 0) c.boostT -= dt;
    if (!c.air) {
      if (ctl.throttle > 0) fwd += V.acc * ctl.throttle * dt * (fwd < 0 ? 2 : 1);
      if (ctl.brake > 0) fwd -= (fwd > 1 ? 34 : V.acc * 0.8) * dt;
      if (!ctl.throttle && !ctl.brake) fwd -= fwd * damp(0.9, dt);
      fwd = clamp(fwd, -V.spd * 0.45, top);
      if (c.boostT > 0) fwd = Math.max(fwd, top * 0.95);
      const grip = ctl.drift ? 2.2 : 9; lat -= lat * damp(grip, dt);
      c.steerA += (ctl.steer - c.steerA) * damp(10, dt);
      const turn = V.turn * (ctl.drift ? 1.35 : 1) * clamp(Math.abs(fwd) / 7, 0, 1) * Math.sign(fwd || 1) * (1 - clamp(Math.abs(fwd) / (V.spd * 3), 0, 0.25));
      c.yaw += c.steerA * turn * dt;
    } else { c.steerA *= 0.98; c.yaw += c.steerA * 0.4 * dt; }
    const s2 = Math.sin(c.yaw), c2 = Math.cos(c.yaw);
    c.vx = s2 * fwd + c2 * lat; c.vz = c2 * fwd - s2 * lat;
    c.x += c.vx * dt; c.z += c.vz * dt;
    // altura: rampas y saltos
    let gh = 0; for (const R of this.F.ramps) { const h = rampH(R, c.x, c.z); if (h > gh) gh = h; }
    if (c.air) { c.vy -= 30 * dt; c.y += c.vy * dt; if (c.y <= gh) { const hard = -c.vy; c.y = gh; c.air = false; c.vy = 0; c.bump = clamp(hard / 14, 0, 1); if (c.slam) { c.slam = false; this._shock(c, 10, 42); } if (hard > 6) { this._dust(c.x, c.z, 10); if (this._near(c)) this.ctx.audio.play('land'); } } }
    else { const climb = (gh - c.y) / Math.max(dt, 1e-3); if (gh < c.y - 0.05) { c.air = true; c.vy = Math.max(0, c.lastClimb || 0) * (V.id === 'monstruo' ? 1.25 : 1); } else c.y = gh; c.lastClimb = climb; }
    c.fwdV = fwd; c.ctl = ctl;
  }
  _collide(dt) {
    const F = this.F;
    for (const c of this.cars) {
      if (c.dead || c.remote) continue;
      // borde del campo
      const d = Math.hypot(c.x, c.z);
      if (d > RA - 1.6) { const nx = c.x / d, nz = c.z / d, vn = c.vx * nx + c.vz * nz; c.x = nx * (RA - 1.6); c.z = nz * (RA - 1.6); if (vn > 0) { c.vx -= nx * vn * 1.5; c.vz -= nz * vn * 1.5; this._wallHit(c, vn); } }
      for (const o of F.obs) {
        if (o.t > 0 || c.y > 2.6) continue;
        const dx = c.x - o.x, dz = c.z - o.z, dd = Math.hypot(dx, dz), R = o.r + 1.5;
        if (dd >= R || dd < 1e-4) continue;
        const nx = dx / dd, nz = dz / dd, vn = c.vx * nx + c.vz * nz; c.x = o.x + nx * R; c.z = o.z + nz * R;
        if (o.barrel) { this._barrelBoom(o, c); continue; }
        if (vn < 0) { c.vx -= nx * vn * (o.soft ? 1.4 : 1.6); c.vz -= nz * vn * (o.soft ? 1.4 : 1.6); if (!o.soft) this._wallHit(c, -vn); }
      }
    }
    // entre vehículos: empujones y embestidas
    for (let i = 0; i < this.cars.length; i++) for (let j = i + 1; j < this.cars.length; j++) {
      const a = this.cars[i], b = this.cars[j]; if (a.dead || b.dead || (a.remote && b.remote) || Math.abs(a.y - b.y) > 2) continue;
      const dx = b.x - a.x, dz = b.z - a.z, dd = Math.hypot(dx, dz), R = 3.3;
      if (dd >= R || dd < 1e-4) continue;
      const nx = dx / dd, nz = dz / dd, ov = R - dd, ma = a.V.mass, mb = b.V.mass, ta = mb / (ma + mb), tb = ma / (ma + mb);
      if (!a.remote) { a.x -= nx * ov * (b.remote ? 1 : ta); a.z -= nz * ov * (b.remote ? 1 : ta); }
      if (!b.remote) { b.x += nx * ov * (a.remote ? 1 : tb); b.z += nz * ov * (a.remote ? 1 : tb); }
      const avn = a.vx * nx + a.vz * nz, bvn = b.vx * nx + b.vz * nz, rel = avn - bvn; // cuánto se acercan
      if (rel <= 0) continue;
      const imp = rel * 1.3;
      if (!a.remote) { a.vx -= nx * imp * ta; a.vz -= nz * imp * ta; }
      if (!b.remote) { b.vx += nx * imp * tb; b.vz += nz * imp * tb; }
      if (rel > 7 && (this._pairT[a.id + b.id] || 0) < this.clock) { // embestida: daña más al que recibe (quien va más rápido hacia el otro es el que embiste)
        this._pairT[a.id + b.id] = this.clock + 0.5;
        const pa = Math.max(0, avn), pb = Math.max(0, -bvn), tot = pa + pb || 1;
        const dmgB = (rel - 5) * 2.1 * a.V.ram * (a.rageT > 0 ? 2.5 : 1) * (pa / tot) / Math.sqrt(mb), dmgA = (rel - 5) * 2.1 * b.V.ram * (b.rageT > 0 ? 2.5 : 1) * (pb / tot) / Math.sqrt(ma);
        if (dmgB > 2 && !b.remote) this._damage(b, dmgB, a, 'embestida'); if (dmgA > 2 && !a.remote) this._damage(a, dmgA, b, 'embestida'); // cada uno se cuenta sus propios golpes
        this._sparks((a.x + b.x) / 2, (a.y + b.y) / 2 + 1, (a.z + b.z) / 2, 14);
        this._sfx(Math.random() < 0.5 ? 'choque' : 'choque2', (a.x + b.x) / 2, (a.z + b.z) / 2, clamp(0.5 + (rel - 7) / 20, 0.5, 1), 'hitHeavy', { gap: 0.08 }); if (a.you || b.you) this.ctx.input.rumble(220, 0.8);
      }
    }
  }
  _wallHit(c, vn) {
    if (vn > 11) { this._damage(c, (vn - 11) * 0.9, null, 'choque'); this._sparks(c.x, c.y + 0.8, c.z, 8); this._sfx('golpe', c.x, c.z, clamp(0.4 + (vn - 11) / 20, 0.4, 0.9), 'slam', { gap: 0.1 }); if (c.you) this.ctx.input.rumble(160, 0.6); }
  }
  _near(c) { const m = this.me; return c.you || Math.hypot(c.x - m.x, c.z - m.z) < 45; }
  // sonido grabado desde un lugar de la arena (si aún no cargó, usa el sintetizado)
  // cada vehículo dispara con su calibre: [sonido, variantes, volumen, tono, separación mínima]
  static GUNS = { chatarra: ['ligero', 3, 0.5, 1, 0.03], cisterna: ['ligero', 3, 0.5, 0.9, 0.03], monstruo: ['pesado', 3, 0.6, 1, 0.04], ariete: ['pesado', 3, 0.58, 1.06, 0.04], pincho: ['plasma', 2, 0.5, 1, 0.05], excavadora: ['autocanon', 2, 0.62, 1.05, 0.06], tanque: ['autocanon', 2, 0.65, 0.95, 0.06] };
  _gunSfx(c, x, z) { const G = Derby.GUNS[c.V.id] || ['mg', 3, 0.5, 1, 0.03]; const k = G[0] + (1 + Math.floor(Math.random() * G[1])); this._sfx(k, x, z, G[2] * (c.you ? 1.1 : 0.9), 'shoot', { gap: G[4], vary: 0.08, rate: G[3] }); }
  _sfx(key, x, z, vol = 1, alt = null, o = {}) { const A = this.ctx.audio; if (A.sample && A.sample(key, { vol, pos: { x, z }, ...o })) return; if (alt) A.play(alt, { x, z }); }

  // ---------- daño y destrucción ----------
  _damage(c, dmg, by, kind) {
    if (c.dead || dmg <= 0) return;
    if (c.remote) { // lo decide su dueño: le aviso
      if (this.net && by && !by.remote) this.net.event({ t: 'dhit', ep: this.ep, v: c.id, d: Math.round(dmg * 10) / 10, o: by.id, k: kind });
      if (by && by.you) this._flash(`-${Math.round(dmg)} a ${c.name}`, '#7affa0');
      return;
    }
    if (c.inv > 0) return;
    if (c.rageT > 0 && kind !== 'choque') { this._sparks(c.x, c.y + 1, c.z, 4); return; }
    if (c.shieldT > 0) { this._pop(c.x, c.y + 1.2, c.z, 0x9fe3ff, 3); if (c.you) this.ctx.audio.play('reflect'); return; }
    c.hp -= dmg; if (by && by !== c) { c.lastBy = by.id; c.lastByT = this.clock; }
    c.flashT = 0.12;
    if (c.you) { this.ctx.input.rumble(140, Math.min(1, dmg / 30)); this._hurtFx(dmg); }
    else if (by && by.you) this._flash(`-${Math.round(dmg)}`, '#ffd27a');
    // pierde piezas a medida que se rompe
    const lose = Math.floor((1 - Math.max(0, c.hp) / c.V.hp) * c.parts.length * 0.85);
    while (c.lost < lose) this._detach(c, c.parts[c.lost++], 1);
    if (c.hp <= 0) this._ko(c, kind);
  }
  _ko(c, kind) {
    c.hp = 0; c.dead = 3.2; c.deaths++; c.vx = c.vz = 0; c.fwdV = 0; c.boostT = 0;
    const by = c.lastBy && this.clock - (c.lastByT || 0) < 8 ? this.cars.find(o => o.id === c.lastBy) : null;
    this._explode(c.x, c.y + 1, c.z, 1.6);
    if (c.V.boom && !c.remote) { this._explode(c.x, c.y + 1, c.z, 2.4); this._blast({ x: c.x, y: c.y + 1, z: c.z, r: 8, dmg: 40, owner: c, kind: 'cisterna', remote: false }, null); }
    for (const p of c.parts.slice(c.lost)) this._detach(c, p, 1.6); c.lost = c.parts.length;
    for (const w of c.B.wheels) this._detach(c, w.wh, 1.3, true);
    for (const { mt } of c.mats) mt.color.setHex(0x1a1614);
    const chunkM = this._chunkM || (this._chunkM = M(0x3a3430, { map: rustTex(), r: 0.9, m: 0.4 })); // trozos de chapa
    for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(this._chunkG || (this._chunkG = new THREE.BoxGeometry(0.7, 0.12, 0.5)), chunkM); m.position.set(c.x + rnd(-1, 1), c.y + 1.2, c.z + rnd(-1.5, 1.5)); m.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)); this.fx.add(m);
      const a = rnd(0, 6.28), sp = rnd(5, 12); this.debris.push({ m, vx: Math.sin(a) * sp, vz: Math.cos(a) * sp, vy: rnd(7, 14), rx: rnd(-9, 9), rz: rnd(-9, 9), t: 0, life: 3.5, r: 0.06, c: null, chunk: true }); }
    this._wreck(c);
    if (by && by !== c) { if (!by.remote) by.kills++; if (by.you) { this._flash(`¡Destrozaste a ${c.name}!`, '#7affa0'); this.ctx.audio.play('unlock'); } }
    if (c.you) { this._flash(by ? `¡${by.name} te destrozó!` : '¡Quedaste hecho chatarra!', '#ff8a7a'); this.ctx.input.rumble(500, 1); }
    this._feed(by, c);
    if (this.net && !c.remote) this.net.event({ t: 'ko', ep: this.ep, v: c.id, by: by ? by.id : null });
  }
  _feed(by, c) {
    const el = $('derbyFeed'); if (!el) return;
    const row = document.createElement('div'); row.innerHTML = by ? `<b>${esc(by.name)}</b> 💥 ${esc(c.name)}` : `💥 ${esc(c.name)}`;
    el.prepend(row); while (el.children.length > 4) el.lastChild.remove(); setTimeout(() => row.remove(), 5000);
  }
  _wreck(c) { // el casco quemado queda humeando mientras vuelve a salir
    c.root.visible = true; c.wreckT = 3.2;
  }
  _detach(c, obj, power = 1, wheel = false) {
    if (!obj || !obj.parent) return;
    if (!obj.userData.home) obj.userData.home = { parent: obj.parent, pos: obj.position.clone(), q: obj.quaternion.clone() };
    const wp = obj.getWorldPosition(new THREE.Vector3()), wq = obj.getWorldQuaternion(new THREE.Quaternion());
    const piece = obj; obj.parent.remove(obj);
    this.fx.add(piece); piece.position.copy(wp); piece.quaternion.copy(wq);
    const a = rnd(0, 6.28), sp = rnd(4, 10) * power;
    this.debris.push({ m: piece, vx: Math.sin(a) * sp + c.vx * 0.5, vz: Math.cos(a) * sp + c.vz * 0.5, vy: rnd(6, 12) * power, rx: rnd(-8, 8), rz: rnd(-8, 8), t: 0, life: wheel ? 4 : 3, r: wheel ? (c.B.wr || c.V.wr) : 0.3, c });
  }

  // ---------- armas ----------
  _use(c) {
    if ((!c.item || c.n <= 0) && c.V.cannon) { // el tanque: cañonazo propio cada 3 s
      if ((c.canT || 0) > 0) { if (c.you) this.ctx.audio.play('powerFail'); return; }
      c.canT = 3; this._fire(c, 'cohete'); const S = this.shots[this.shots.length - 1]; if (S) { S.dmg = 20; S.speed = 85; S.r = 3; } this.shake = Math.max(this.shake || 0, c.you ? 0.25 : 0); return;
    }
    if (!c.item || c.n <= 0) return;
    const id = c.item, A = this.ctx.audio;
    if (id === 'especial') this._special(c);
    else if (id === 'metralla') { c.burst = 7; c.burstT = 0; }
    else if (id === 'cohete') this._fire(c, 'cohete');
    else if (id === 'misil') this._fire(c, 'misil');
    else if (id === 'minas') this._fire(c, 'mina');
    else if (id === 'bomba') this._fire(c, 'bomba');
    else if (id === 'fuego') { c.fireT = c.V.boom ? 3.6 : 2.4; this._sfx('fuego', c.x, c.z, 0.8, 'fire'); }
    else if (id === 'reparar') { c.hp = Math.min(c.V.hp, c.hp + c.V.hp * 0.5); this._restoreSome(c); this._pop(c.x, c.y + 1, c.z, 0x7affa0, 3); if (c.you) A.play('heal'); }
    else if (id === 'escudo') { c.shieldT = 7; if (c.you) A.play('shieldUp'); }
    else if (id === 'nitro') { c.boostT = 2.2; this._sfx('nitro', c.x, c.z, c.you ? 0.8 : 0.55, c.you ? 'dash' : null); if (c.you) this.ctx.input.rumble(140, 0.5); }
    if (--c.n <= 0) { c.item = null; c.n = 0; }
    if (this.net && !c.remote && /metralla|fuego|escudo|nitro|reparar/.test(id)) this.net.event({ t: 'act', ep: this.ep, o: c.id, k: id });
  }
  _restoreSome(c) { // la reparación devuelve las piezas que correspondan a la vida que tiene
    const keep = Math.floor((1 - c.hp / c.V.hp) * c.parts.length * 0.85);
    while (c.lost > keep) { const p = c.parts[--c.lost]; const h = p.userData.home; if (h) { const k = this.debris.findIndex(d => d.m === p); if (k >= 0) this.debris.splice(k, 1); this.fx.remove(p); h.parent.add(p); p.position.copy(h.pos); p.quaternion.copy(h.q); p.scale.setScalar(1); } }
  }
  _weapons(dt) {
    for (const c of this.cars) {
      if (c.dead) { c.burst = 0; c.fireT = 0; continue; }
      c.inv = Math.max(0, c.inv - dt); if (c.shieldT > 0) c.shieldT -= dt; if (c.canT > 0) c.canT -= dt;
      if (c.burst > 0 && (c.burstT -= dt) <= 0) { c.burstT = 0.07; c.burst--; this._fire(c, 'bala'); }
      if (c.fireT > 0) { // lanzallamas: cono de fuego hacia adelante
        c.fireT -= dt;
        const gp = c.B.gun.getWorldPosition(new THREE.Vector3());
        for (let k = 0; k < 2; k++) { const a = c.yaw + rnd(-0.25, 0.25), sp = rnd(16, 24); this._flame(gp.x + Math.sin(c.yaw) * 1.2, gp.y, gp.z + Math.cos(c.yaw) * 1.2, Math.sin(a) * sp + c.vx, rnd(-1, 2), Math.cos(a) * sp + c.vz); }
        if (!c.remote) for (const o of this.cars) { if (o === c || o.dead) continue; const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz); if (d < 8.5 && Math.abs(angD(Math.atan2(dx, dz), c.yaw)) < 0.45) { o.burnT = 0.6; this._damage(o, 26 * dt, c, 'fuego'); } }
        if (!c.remote) for (const o of this.F.barrels) if (!(o.t > 0) && Math.hypot(o.x - c.x, o.z - c.z) < 8 && Math.abs(angD(Math.atan2(o.x - c.x, o.z - c.z), c.yaw)) < 0.45) this._barrelBoom(o, c);
      }
      if (c.burnT > 0) c.burnT -= dt;
      if (c.mgT > 0) { c.mgT -= dt; if ((c.mgFire -= dt) <= 0) { c.mgFire = 0.06; const y0 = c.yaw; c.yaw += (c.mgSide = -(c.mgSide || 0.05)); this._fire(c, 'bala'); c.yaw = y0; const S = this.shots[this.shots.length - 1]; if (S) S.dmg = 7; } }
      if (c.rageT > 0) { c.rageT -= dt; if (Math.random() < 0.6) this._flame(c.x + rnd(-1.2, 1.2), c.y + 1, c.z + rnd(-1.2, 1.2), 0, 2, 0); }
      if (c.ringT > 0) { c.ringT -= dt; // mar de fuego alrededor
        for (let k = 0; k < 4; k++) { const a = rnd(0, 6.28), r = rnd(3, 7); this._flame(c.x + Math.sin(a) * r, 0.5, c.z + Math.cos(a) * r, 0, rnd(2, 5), 0); }
        if (!c.remote) for (const o of this.cars) { if (o === c || o.dead) continue; if (Math.hypot(o.x - c.x, o.z - c.z) < 7.5) { o.burnT = 0.6; this._damage(o, 30 * dt, c, 'fuego'); } } }
    }
  }
  _fire(c, kind, spec = null) {
    const A = this.ctx.audio, gp = c.B.gun.getWorldPosition(new THREE.Vector3());
    const back = kind === 'mina', dir = c.yaw + (back ? Math.PI : 0) + (kind === 'bala' ? rnd(-0.04, 0.04) : 0);
    const g = this._shotModel(kind); this.fx.add(g);
    const S = { kind, g, owner: c, yaw: dir, t: 0, x: gp.x + Math.sin(dir) * (back ? 2.6 : 1.4), z: gp.z + Math.cos(dir) * (back ? 2.6 : 1.4), y: back ? 0.3 : gp.y, vy: 0, target: null };
    if (kind === 'bala') { S.speed = 130; S.life = 0.55; S.dmg = 6; }
    else if (kind === 'cohete' || kind === 'misil') {
      S.speed = kind === 'misil' ? 52 : 72; S.life = kind === 'misil' ? 5 : 2.4; S.dmg = kind === 'misil' ? 34 : 24; S.r = kind === 'misil' ? 4 : 3.5;
      if (kind === 'misil') { let best = null, bd = 1e9; for (const o of this.cars) { if (o === c || o.dead) continue; const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz), a = Math.abs(angD(Math.atan2(dx, dz), c.yaw)); const sc = d * (1 + a * 1.5); if (a < 1.4 && sc < bd) { bd = sc; best = o; } } S.target = best; }
    } else if (kind === 'mina') {
      S.speed = 0; S.life = 30; S.dmg = 32; S.r = 4.5; S.y = 0;
    } else if (kind === 'bomba') {
      S.speed = Math.max(0, c.fwdV || 0) + 18; S.vy = 9; S.life = 4; S.dmg = 34; S.r = 5.5; S.bounces = 0;
    }
    S.id = c.id + ':' + (this.sid = (this.sid || 0) + 1); S.remote = !!c.remote; // lo que dispara otro jugador solo se ve: el daño lo cuenta quien disparó
    if (spec) { S.remote = true; S.id = spec.id; S.x = +spec.x; S.z = +spec.z; S.yaw = +spec.yw; if (spec.tg) S.target = this.cars.find(o => o.id === spec.tg) || null; }
    else if (this.net && kind !== 'bala' && !c.remote) this.net.event({ t: 'dshot', ep: this.ep, id: S.id, k: kind, o: c.id, x: Math.round(S.x * 100) / 100, z: Math.round(S.z * 100) / 100, yw: Math.round(S.yaw * 1000) / 1000, tg: S.target ? S.target.id : null });
    if (kind === 'bala') this._gunSfx(c, S.x, S.z);
    else if (kind === 'bomba') this._sfx('lanzar', S.x, S.z, 0.7, 'fire', { vary: 0.08 });
    else if (kind === 'cohete' && c.V.cannon && !c.item) this._sfx('canon', S.x, S.z, 0.9, 'fire');
    else if (kind === 'cohete' || kind === 'misil') this._sfx('cohete', S.x, S.z, 0.75, 'fire', { rate: kind === 'misil' ? 0.85 : 1 });
    else if (this._near(c)) A.play('swing');
    this.shots.push(S);
  }
  // modelos de proyectiles: se arman una vez y cada disparo es una copia (comparte geometría; la luz de cada mina/bomba es suya)
  _shotModel(kind) {
    const T = this._tpl || (this._tpl = {});
    if (!T[kind]) { const g = new THREE.Group();
      if (kind === 'bala') g.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.4), new THREE.MeshBasicMaterial({ color: 0xffe080 })));
      else if (kind === 'cohete' || kind === 'misil') { const col = kind === 'misil' ? 0xb070ff : 0xe8483c; const b = cyl(0.2, 0.22, 1.3, M(col, { e: col, ei: 0.3 }), 10); b.rotation.x = Math.PI / 2; g.add(b);
        const fl = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1, 8), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending })); fl.rotation.x = -Math.PI / 2; fl.position.z = -1.1; fl.name = 'flame'; g.add(fl); }
      else if (kind === 'mina') { const m = cyl(0.55, 0.65, 0.25, M(0x2a2a2a, { m: 0.6 }), 14); m.position.y = 0.12; g.add(m); const l = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3020 })); l.position.y = 0.3; l.name = 'led'; g.add(l); }
      else { const b = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), M(0x22222c, { r: 0.4, m: 0.3 })); g.add(b); const f = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffb040 })); f.position.y = 0.55; f.name = 'led'; g.add(f); }
      T[kind] = g; }
    const g = T[kind].clone(), led = g.getObjectByName('led'), fl = g.getObjectByName('flame');
    if (led) { led.material = led.material.clone(); g.userData.led = led; } if (fl) g.userData.flame = fl;
    return g;
  }
  _shotsTick(dt) {
    for (let k = this.shots.length - 1; k >= 0; k--) {
      const S = this.shots[k]; S.t += dt;
      if (S.kind === 'misil' && S.target && !S.target.dead) { const want = Math.atan2(S.target.x - S.x, S.target.z - S.z); S.yaw += clamp(angD(want, S.yaw), -3 * dt, 3 * dt); }
      S.x += Math.sin(S.yaw) * S.speed * dt; S.z += Math.cos(S.yaw) * S.speed * dt;
      if (S.kind === 'bomba') { S.vy -= 24 * dt; S.y += S.vy * dt; if (S.y <= 0.5) { S.y = 0.5; S.vy = Math.abs(S.vy) * 0.4; S.speed *= 0.6; S.bounces++; } S.g.userData.led.material.color.setHex(Math.sin(S.t * 30) > 0 ? 0xffffff : 0xff6020); }
      if (S.kind === 'mina') S.g.userData.led.material.color.setHex(S.t > 0.7 && Math.sin(S.t * 8) > 0 ? 0xff2010 : 0x401010);
      S.g.position.set(S.x, S.y, S.z); S.g.rotation.y = S.yaw;
      if (S.g.userData.flame) { S.g.userData.flame.scale.set(1, 0.8 + Math.random() * 0.5, 1); if ((S.puff = (S.puff || 0) - dt) <= 0) { S.puff = 0.03; this._smoke(S.x - Math.sin(S.yaw) * 1.3, S.y, S.z - Math.cos(S.yaw) * 1.3, 0xe8e0d8, 0.5); } }
      let hit = null, boom = false;
      if (Math.hypot(S.x, S.z) > RA + 1) boom = true;
      if (S.kind !== 'mina' && S.y < 3) for (const o of this.F.obs) { if (o.t > 0) continue; if (Math.hypot(o.x - S.x, o.z - S.z) < o.r + 0.3) { if (o.barrel) this._barrelBoom(o, S.owner); boom = true; break; } }
      if (S.kind === 'mina' && S.t < 0.7) { /* se arma */ }
      else for (const o of this.cars) {
        if (o.dead || (o === S.owner && S.t < (S.kind === 'mina' ? 1.5 : 0.4))) continue;
        if (Math.hypot(o.x - S.x, o.z - S.z) < (S.kind === 'mina' ? 2.4 : S.kind === 'bala' ? 1.8 : 2.0) && Math.abs(o.y + 1 - S.y) < 2.6) { hit = o; break; }
      }
      if (hit || boom || S.t > S.life || (S.kind === 'bomba' && S.bounces >= 2)) {
        if (S.kind === 'bala') { if (hit && !S.remote) this._damage(hit, S.dmg, S.owner, 'bala'); this._sparks(S.x, S.y, S.z, 4); }
        else this._blast(S, hit);
        if (S.g.userData.led) S.g.userData.led.material.dispose(); this.fx.remove(S.g); this.shots.splice(k, 1);
      }
    }
  }
  _blast(S, direct) {
    this._explode(S.x, S.y, S.z, S.r / 3.5);
    if (S.remote) return;
    for (const o of this.cars) { if (o.dead) continue; const d = Math.hypot(o.x - S.x, o.z - S.z); if (o === direct || d < S.r) { const f = o === direct ? 1 : 1 - d / S.r * 0.6; this._damage(o, S.dmg * f, S.owner, S.kind); if (!o.remote && !o.V.tracks) { o.vy = Math.max(o.vy, 7 * f); o.air = true; const a = Math.atan2(o.x - S.x, o.z - S.z); o.vx += Math.sin(a) * 8 * f; o.vz += Math.cos(a) * 8 * f; } } }
    for (const o of this.F.barrels) if (!(o.t > 0) && Math.hypot(o.x - S.x, o.z - S.z) < S.r) this._barrelBoom(o, S.owner);
  }
  _barrelBoom(o, by) {
    if (o.t > 0) return; o.t = 20; o.barrel.visible = false;
    const S = { x: o.x, y: 0.8, z: o.z, r: 6, dmg: 30, owner: by, kind: 'barril', remote: by && by.remote };
    this._blast(S, null);
    if (this.net && by && !by.remote) this.net.event({ t: 'barril', ep: this.ep, i: this.F.barrels.indexOf(o) });
  }
  _barrels(dt) { for (const o of this.F.barrels) if (o.t > 0 && (o.t -= dt) <= 0) { o.t = 0; o.barrel.visible = true; o.barrel.scale.setScalar(0.01); } else if (o.barrel.scale.x < 1) o.barrel.scale.setScalar(Math.min(1, o.barrel.scale.x + dt * 2)); }
  _crates(dt) {
    const t = this.clock;
    for (let k = this.golds.length - 1; k >= 0; k--) {
      const B = this.golds[k]; B.m.position.set(B.x, 1.4 + Math.sin(t * 2 + B.ph) * 0.3, B.z); B.m.rotation.y = t * 1.6 + B.ph; B.beam.material.opacity = 0.12 + Math.sin(t * 3 + B.ph) * 0.05;
      for (const c of this.cars) {
        if (c.dead || c.remote || c.y > 3) continue;
        if (Math.hypot(c.x - B.x, c.z - B.z) < 2.8) {
          this.root.remove(B.m); this.golds.splice(k, 1); this._pop(B.x, 1.4, B.z, 0xffe070, 3);
          c.item = 'especial'; c.n = 1; c.botWait = rnd(0.2, 0.8);
          this._sfx('dorada', B.x, B.z, c.you ? 0.85 : 0.5, 'energy'); if (c.you) { setTimeout(() => this._sfx('especial', c.x, c.z, 0.6, null), 450); this._flash(`★ ${SPECIALS[c.V.id].name}`, '#ffd27a'); }
          const gen = this.gen; setTimeout(() => { if (this.active && this.gen === gen) this._goldCrate(B.i); }, 25000);
          if (this.net) this.net.event({ t: 'oro', ep: this.ep, i: B.i });
          break;
        }
      }
    }
    for (let k = this.crates.length - 1; k >= 0; k--) {
      const B = this.crates[k]; B.m.position.set(B.x, 1.1 + Math.sin(t * 2.2 + B.ph) * 0.2, B.z); B.m.rotation.y = t * 1.1 + B.ph;
      for (const c of this.cars) {
        if (c.dead || c.remote || c.y > 2.5) continue;
        if (Math.hypot(c.x - B.x, c.z - B.z) < 2.4) {
          this.root.remove(B.m); this.crates.splice(k, 1); this._pop(B.x, 1.1, B.z, 0xffc81a, 1.8); this._sfx(Math.random() < 0.5 ? 'caja1' : 'caja2', B.x, B.z, c.you ? 0.8 : 0.5, 'crack', { vary: 0.08 });
          if (!c.item) { const id = rollWeapon(c.hp / c.V.hp); c.item = id; c.n = WEAPONS[id].n; if (c.you) { this._flash(WEAPONS[id].name, '#ffd27a'); } c.botWait = rnd(0.3, 1.2); }
                    const gen = this.gen; setTimeout(() => { if (this.active && this.gen === gen) this._crate(B.i); }, 6000);
          if (this.net) this.net.event({ t: 'caja', ep: this.ep, i: B.i });
          break;
        }
      }
    }
  }

  // ---------- la CPU ----------
  _bot(c, dt) {
    const tgtCar = () => { let best = null, bs = 1e9; for (const o of this.cars) { if (o === c || o.dead) continue; const d = Math.hypot(o.x - c.x, o.z - c.z) * (o.you ? 0.8 : 1) * (0.6 + o.hp / o.V.hp * 0.6); if (d < bs) { bs = d; best = o; } } return best; };
    if ((c.thinkT = (c.thinkT || 0) - dt) <= 0) { c.thinkT = 0.5 + Math.random() * 0.4; c.foe = tgtCar();
      if (!c.item || c.item !== 'especial' && Math.random() < 0.3) { let bc = null, bd = 1e9; for (const B of this.crates) { const d = Math.hypot(B.x - c.x, B.z - c.z); if (!c.item && d < bd) { bd = d; bc = B; } } for (const B of this.golds) { const d = Math.hypot(B.x - c.x, B.z - c.z) * 0.6; if (d < bd) { bd = d; bc = B; } } c.goal = bc && (!c.foe || bd < Math.hypot(c.foe.x - c.x, c.foe.z - c.z) * 1.4 || bd < 25) ? { x: bc.x, z: bc.z } : null; }
      else if (c.item) c.goal = null; }
    const F = c.foe, ctl = { steer: 0, throttle: 1, brake: 0, drift: false, use: false };
    let tx, tz;
    if (c.goal) { tx = c.goal.x; tz = c.goal.z; } else if (F) { const lead = Math.hypot(F.x - c.x, F.z - c.z) / 60; tx = F.x + F.vx * lead; tz = F.z + F.vz * lead; } else { tx = 0; tz = 0; }
    // si lleva minas, se adelanta y las deja delante del rival
    let want = Math.atan2(tx - c.x, tz - c.z);
    // esquiva obstáculos que tiene delante
    for (const o of this.F.obs) { if (o.t > 0) continue; const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz); if (d > 12 || d < 0.1) continue; const a = angD(Math.atan2(dx, dz), c.yaw); if (Math.abs(a) < 0.6) want += (a > 0 ? -1 : 1) * (1 - d / 12) * 1.1; }
    const dist = Math.hypot(c.x, c.z); if (dist > RA - 12) want = angD(want, 0) * 0 + Math.atan2(-c.x, -c.z) * 0.5 + want * 0.5;
    const e = angD(want, c.yaw); ctl.steer = clamp(e * 2.2, -1, 1); ctl.drift = Math.abs(e) > 1.2 && c.speed > 12;
    if (Math.abs(e) > 2.2 && c.speed < 6) { ctl.throttle = 0; ctl.brake = 1; ctl.steer = -ctl.steer; } // da marcha atrás para girar
    // atascado contra algo: retrocede un momento
    if (c.speed < 2 && !c.air) c.stuck = (c.stuck || 0) + dt; else c.stuck = 0;
    if (c.stuck > 1.2) c.rev = 1.0;
    if (c.rev > 0) { c.rev -= dt; ctl.throttle = 0; ctl.brake = 1; ctl.steer = 1; }
    // usar el arma
    if (!c.item && c.V.cannon && !(c.canT > 0) && F) { const dx = F.x - c.x, dz = F.z - c.z; if (Math.hypot(dx, dz) < 50 && Math.abs(angD(Math.atan2(dx, dz), c.yaw)) < 0.12) ctl.use = true; }
    if (c.item && (c.botWait = (c.botWait || 0) - dt) <= 0 && F) {
      const dx = F.x - c.x, dz = F.z - c.z, d = Math.hypot(dx, dz), a = Math.abs(angD(Math.atan2(dx, dz), c.yaw)), behind = Math.abs(angD(Math.atan2(dx, dz), c.yaw + Math.PI)) < 0.6;
      const id = c.item; let go = false;
      if (id === 'metralla') go = d < 40 && a < 0.12; else if (id === 'cohete') go = d < 50 && a < 0.1; else if (id === 'misil') go = d < 60 && a < 0.9;
      else if (id === 'bomba') go = d > 8 && d < 26 && a < 0.2; else if (id === 'fuego') go = d < 8 && a < 0.4; else if (id === 'minas') go = behind && d < 18;
      else if (id === 'especial') go = ['pincho', 'tanque', 'chatarra'].includes(c.V.id) ? d < 45 && a < 0.25 : d < 12;
      else if (id === 'reparar') go = c.hp < c.V.hp * 0.45; else if (id === 'escudo') go = c.hp < c.V.hp * 0.6 && d < 20; else if (id === 'nitro') go = d > 25 || (a < 0.2 && d < 18);
      if (!go && Math.random() < 0.004) go = true;
      if (go) { ctl.use = true; c.botWait = rnd(0.25, 0.8); }
    }
    return ctl;
  }

  // ---------- dibujo ----------
  _sync(c, dt) {
    if (c.dead > 0) {
      c.wreckT -= dt; c.root.visible = c.wreckT > 0.6; c.shadow.visible = false;
      if (c.root.visible && (c.smokeT -= dt) <= 0) { c.smokeT = 0.05; this._smoke(c.x + rnd(-1, 1), c.y + 1.4, c.z + rnd(-1, 1), 0x2a2622, 1.1); if (Math.random() < 0.4) this._flame(c.x + rnd(-1, 1), c.y + 1, c.z + rnd(-1, 1), rnd(-1, 1), rnd(3, 6), rnd(-1, 1)); }
      return;
    }
    const R = c.root; R.visible = !(c.inv > 0 && Math.floor(this.clock * 12) % 2 === 0);
    R.position.set(c.x, c.y, c.z); R.rotation.y = c.yaw;
    const fwd = c.fwdV ?? c.fwd, lat = c.vx * Math.cos(c.yaw) - c.vz * Math.sin(c.yaw);
    c.roll += (clamp(-lat * 0.025 - c.steerA * fwd * 0.004, -0.25, 0.25) - c.roll) * damp(6, dt);
    let pitch = c.air ? clamp(-c.vy * 0.03, -0.4, 0.4) : 0; for (const Rm of this.F.ramps) if (rampH(Rm, c.x, c.z) >= 0) pitch = -Math.atan2(Rm.H, Rm.L) * Math.cos(angD(c.yaw, Rm.yaw));
    c.pitch += (pitch - c.pitch) * damp(8, dt); R.rotation.x = c.pitch; R.rotation.z = c.roll;
    c.bump = Math.max(0, c.bump - dt * 3); c.B.body.position.y = -c.bump * 0.35 + Math.sin(this.clock * 30) * 0.015 * clamp(c.speed / 20, 0, 1);
    for (const w of c.B.wheels) { w.wh.rotation.x += fwd * dt / (c.B.wr || c.V.wr); if (w.front) w.piv.rotation.y = c.steerA * 0.45; }
    c.shadow.position.set(c.x, 0.04 + (c.y > 0.1 ? c.y * 0 : 0), c.z); c.shadow.rotation.z = -c.yaw; c.shadow.material.opacity = 0.3 * clamp(1 - c.y / 8, 0.2, 1);
    { let gh = 0; for (const Rm of this.F.ramps) { const h = rampH(Rm, c.x, c.z); if (h > gh) gh = h; } c.shadow.position.y = gh + 0.04; }
    // daños: humo cuando está mal y fuego cuando está muy mal
    const f = c.hp / c.V.hp;
    if (f < 0.5 && (c.smokeT -= dt) <= 0) { c.smokeT = f < 0.25 ? 0.05 : 0.11; const gp = c.B.gun.getWorldPosition(new THREE.Vector3()); this._smoke(gp.x + rnd(-0.5, 0.5), gp.y - 0.3, gp.z, f < 0.25 ? 0x262220 : 0x6a6460, 0.7); if (f < 0.25 && Math.random() < 0.5) this._flame(gp.x + rnd(-0.5, 0.5), gp.y - 0.4, gp.z, rnd(-1, 1) - c.vx * 0.3, rnd(2, 4), rnd(-1, 1) - c.vz * 0.3); }
    // destello rojo al recibir un golpe y escudo
    if (c.flashT > 0 || c._fl) { c.flashT -= dt; const on = c.flashT > 0; for (const { mt, c: col } of c.mats) on ? mt.color.setHex(0xff5040) : mt.color.copy(col); c._fl = on; }
    if (c.shieldT > 0) { if (!c.bubble) { c.bubble = new THREE.Mesh(new THREE.SphereGeometry(2.8, 20, 14), new THREE.MeshBasicMaterial({ color: 0x9fe3ff, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending })); c.bubble.position.y = 1.2; R.add(c.bubble); } c.bubble.scale.setScalar(1 + Math.sin(this.clock * 6) * 0.04); }
    else if (c.bubble) { R.remove(c.bubble); c.bubble = null; }
    if (c.boostT > 0 && (c.puffT = (c.puffT || 0) - dt) <= 0) { c.puffT = 0.03; this._flame(c.x - Math.sin(c.yaw) * 2.4, c.y + 0.9, c.z - Math.cos(c.yaw) * 2.4, -Math.sin(c.yaw) * 6, 1, -Math.cos(c.yaw) * 6); }
    if (!c.air && c.speed > 10 && (c.dustT = (c.dustT || 0) - dt) <= 0) { c.dustT = c.ctl && c.ctl.drift ? 0.03 : 0.12; this._smoke(c.x - Math.sin(c.yaw) * 2, 0.4, c.z - Math.cos(c.yaw) * 2, 0xd8b088, 0.9); }
    if (c.burnT > 0 && Math.random() < 0.5) this._flame(c.x + rnd(-1, 1), c.y + 1.2, c.z + rnd(-1, 1), 0, 3, 0);
    if (c.ch && c.ch.mixer) c.ch.mixer.update(0);
    if (c.tag) { const p = new THREE.Vector3(c.x, c.y + 4, c.z).project(this.ctx.camera); const vis = p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1; c.tag.style.display = vis ? '' : 'none'; if (vis) { c.tag.style.transform = `translate(-50%,-100%) translate(${(p.x + 1) / 2 * innerWidth}px,${(1 - p.y) / 2 * innerHeight}px)`; c.tagHp.style.width = Math.max(0, f * 100) + '%'; } }
  }
  // partículas: humo, llamas, chispas, polvo y explosiones (todas en una lista)
  // las partículas se reciclan (dos reservas: normales y luminosas) para no crear ni tirar objetos en cada explosión
  _p(geo, col, o) {
    const P = o.add ? (this.poolA || (this.poolA = [])) : (this.poolN || (this.poolN = [])), cap = o.add ? 200 : 220;
    let m = P.pop();
    if (!m) { if (this.parts.filter(q => q.add === !!o.add).length >= cap) { const k = this.parts.findIndex(q => q.add === !!o.add); const q = this.parts.splice(k, 1)[0]; m = q.m; }
      else { m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending })); m.frustumCulled = false; this.fx.add(m); } }
    m.geometry = geo; m.material.color.setHex(col); m.material.opacity = o.a ?? 0.8; m.visible = true; m.position.set(o.x, o.y, o.z); m.scale.setScalar(o.s0 ?? 1);
    this.parts.push({ m, add: !!o.add, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, t: 0, life: o.life, s0: o.s0 ?? 1, s1: o.s1 ?? 2, g: o.g ?? 0, a: o.a ?? 0.8 });
  }
  _smoke(x, y, z, col, s = 1) { this._p(this._sg || (this._sg = new THREE.IcosahedronGeometry(0.5, 1)), col, { x, y, z, vy: rnd(1, 2.5), vx: rnd(-0.5, 0.5), vz: rnd(-0.5, 0.5), life: rnd(0.8, 1.4), s0: 0.6 * s, s1: 2.4 * s, a: 0.5 }); }
  _flame(x, y, z, vx, vy, vz) { this._p(this._fg || (this._fg = new THREE.IcosahedronGeometry(0.4, 0)), Math.random() < 0.5 ? 0xffa030 : 0xff5a20, { x, y, z, vx, vy, vz, life: rnd(0.25, 0.45), s0: 0.8, s1: 2.2, a: 0.9, add: true }); }
  _sparks(x, y, z, n) { for (let i = 0; i < n; i++) this._p(this._kg || (this._kg = new THREE.BoxGeometry(0.12, 0.12, 0.12)), 0xffd060, { x, y, z, vx: rnd(-9, 9), vy: rnd(2, 9), vz: rnd(-9, 9), life: rnd(0.3, 0.6), s0: 1, s1: 0.4, g: 22, a: 1, add: true }); }
  _dust(x, z, n) { for (let i = 0; i < n; i++) this._p(this._sg || (this._sg = new THREE.IcosahedronGeometry(0.5, 1)), 0xd8b088, { x: x + rnd(-1.5, 1.5), y: 0.3, z: z + rnd(-1.5, 1.5), vx: rnd(-4, 4), vy: rnd(0.5, 2), vz: rnd(-4, 4), life: rnd(0.6, 1), s0: 0.8, s1: 2.6, a: 0.55 }); }
  _pop(x, y, z, col, r) { this._p(this._bg || (this._bg = new THREE.SphereGeometry(1, 16, 12)), col, { x, y, z, life: 0.45, s0: 0.3, s1: r, a: 0.85, add: true }); }
  _explode(x, y, z, s = 1) {
    this._pop(x, y, z, 0xffd080, 4.5 * s); this._pop(x, y, z, 0xff6020, 3.2 * s);
    for (let i = 0; i < 16 * s; i++) { const a = rnd(0, 6.28), sp = rnd(4, 12) * s; this._flame(x, y, z, Math.sin(a) * sp, rnd(2, 9), Math.cos(a) * sp); }
    for (let i = 0; i < 10 * s; i++) this._smoke(x + rnd(-1.5, 1.5) * s, y + rnd(0, 1.5), z + rnd(-1.5, 1.5) * s, 0x3a3430, 1.3 * s);
    this._sparks(x, y, z, Math.round(12 * s));
    const m = this.me, d = Math.hypot(m.x - x, m.z - z);
    this._sfx(s >= 1.5 ? 'ko' : Math.random() < 0.5 ? 'explosion' : 'explosion2', x, z, Math.min(1, 0.6 + s * 0.3), 'slam', { gap: 0.05 });
    if (d < 60) this.shake = Math.max(this.shake || 0, clamp(1 - d / 30, 0, 1) * 0.6 * s);
  }
  _fxTick(dt) {
    for (let k = this.parts.length - 1; k >= 0; k--) {
      const p = this.parts[k]; p.t += dt; const q = p.t / p.life;
      if (q >= 1) { p.m.visible = false; (p.add ? this.poolA : this.poolN).push(p.m); this.parts.splice(k, 1); continue; }
      p.vy -= p.g * dt; p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
      p.m.scale.setScalar(p.s0 + (p.s1 - p.s0) * q); p.m.material.opacity = p.a * (1 - q);
    }
    for (let k = this.debris.length - 1; k >= 0; k--) { // piezas sueltas que rebotan por el suelo
      const d = this.debris[k]; d.t += dt; d.vy -= 26 * dt;
      d.m.position.x += d.vx * dt; d.m.position.y += d.vy * dt; d.m.position.z += d.vz * dt; d.m.rotation.x += d.rx * dt; d.m.rotation.z += d.rz * dt;
      if (d.m.position.y < d.r) { d.m.position.y = d.r; d.vy = Math.abs(d.vy) * 0.35; d.vx *= 0.7; d.vz *= 0.7; d.rx *= 0.7; d.rz *= 0.7; }
      if (d.t > d.life) { d.m.scale.multiplyScalar(0.9); if (d.t > d.life + 0.6) { this.fx.remove(d.m); this.debris.splice(k, 1); } }
    }
    // polvo en el aire, a la deriva
    const P = this.F.dust.geometry.attributes.position; for (let i = 0; i < P.count; i++) { let x = P.getX(i) + dt * 3, z = P.getZ(i) + dt * 1.2; if (x > 140) x -= 280; if (z > 140) z -= 280; P.setX(i, x); P.setZ(i, z); } P.needsUpdate = true;
  }
  _camera(dt) {
    const cam = this.ctx.camera, c = this.me;
    const follow = c.dead > 0 && c.lastBy ? this.cars.find(o => o.id === c.lastBy && !o.dead) : null; // al quedar destrozado, mira a quien te destrozó
    const T = follow || c, back = this.lookBack ? -1 : 1, dist = (innerWidth < innerHeight * 2.4 && this.ctx.input.isTouch ? 12 : 10) + clamp(T.speed / 30, 0, 1) * 2.5;
    const want = new THREE.Vector3(T.x - Math.sin(T.yaw) * dist * back, T.y + 5, T.z - Math.cos(T.yaw) * dist * back);
    if (c.dead > 0 && !follow) want.set(c.x + Math.sin(this.clock * 0.6) * 12, 9, c.z + Math.cos(this.clock * 0.6) * 12);
    if (this.phase === 'count') { const a = this.st * 0.9; want.set(c.x + Math.sin(c.yaw + Math.PI + 2.4 - a) * 14, 6 + (3 - this.st) * 3, c.z + Math.cos(c.yaw + Math.PI + 2.4 - a) * 14); }
    const d = Math.hypot(want.x, want.z); if (d > RA - 3) { want.x *= (RA - 3) / d; want.z *= (RA - 3) / d; want.y += Math.min(6, (d - RA + 3) * 0.6); } // sin meterse en las rocas del borde
    if (!this.camPos) this.camPos = want.clone();
    this.camPos.lerp(want, damp(this.phase === 'count' ? 3 : 6, dt));
    cam.position.copy(this.camPos);
    if (this.shake > 0) { this.shake -= dt * 1.5; cam.position.x += rnd(-1, 1) * this.shake; cam.position.y += rnd(-1, 1) * this.shake; }
    cam.lookAt(T.x + Math.sin(T.yaw) * 4 * back, T.y + 1.5, T.z + Math.cos(T.yaw) * 4 * back);
    const fov = 66 + clamp(T.speed / 30, 0, 1.3) * 8 + (T.boostT > 0 ? 6 : 0); cam.fov += (fov - cam.fov) * damp(4, dt); cam.updateProjectionMatrix();
  }

  // ---------- en línea ----------
  _pack(c) { const r = v => Math.round(v * 100) / 100; return [r(c.x), r(c.y), r(c.z), r(c.yaw), r(c.fwdV || 0), Math.round(c.hp), c.dead > 0 ? 1 : 0, (c.shieldT > 0 ? 1 : 0) | (c.boostT > 0 ? 2 : 0) | (c.fireT > 0 ? 4 : 0) | (c.air ? 8 : 0), c.kills, c.deaths, r(c.steerA)]; }
  _netTick(dt) {
    const N = this.net, sv = this.ctx.getSave() || {}, me = this.me, G = garageOf(sv);
    // con pocos jugadores, el anfitrión (el de identificador menor) llena la arena con vehículos de la CPU
    const humans = N.others().filter(p => p.pres && p.pres.s === 'derby' && p.pres.ep === this.ep), ids = [me.id, ...humans.map(p => p.id)].sort();
    const host = ids[0] === me.id, want = host ? Math.max(0, 4 - ids.length) : 0, mine = this.cars.filter(c => c.cpu && !c.remote);
    if (host && (this._botT = (this._botT || 0) - dt) <= 0) { this._botT = 2;
      if (mine.length < want) { const used = new Set(this.cars.map(c => c.name)), d = DRIVERS.filter(x => x.id !== 'hero' && !used.has(x.name))[0] || DRIVERS[1], b = this._addBot(me.id + '-b' + (this.bid = (this.bid || 0) + 1), d, this.bid); this._spawn(b, true); this._tagFor(b); }
      else if (mine.length > want) { const b = mine[mine.length - 1]; b.remove(); this.cars.splice(this.cars.indexOf(b), 1); } }
    N.set({ n: me.name, s: 'derby', ep: this.ep, v: me.V.id, u: me.V.up, pa: me.paint ?? null, d: G.driver || 'hero', h: sv.hero || 'lia', c: sv.custom || {}, st: this._pack(me),
      b: host ? this.cars.filter(c => c.cpu && !c.remote).map(c => [c.id, c.name, c.V.id, c.drv || '', ...this._pack(c)]) : [] });
    N.tick(dt);
    const seen = new Set(), list = [];
    for (const p of N.others()) {
      const P = p.pres || {}; if (P.s !== 'derby' || P.ep !== this.ep || !Array.isArray(P.st)) continue;
      list.push({ id: p.id, P, st: P.st });
      if (Array.isArray(P.b)) for (const b of P.b) if (Array.isArray(b) && b.length > 8) list.push({ id: String(b[0]), P: { n: b[1], v: b[2], d: b[3] || 'kael', h: 'lia', c: {} }, st: b.slice(4), bot: true });
    }
    for (const it of list) {
      const p = { id: it.id }, P = it.P; seen.add(p.id);
      let c = this.cars.find(o => o.id === p.id);
      if (!c) { c = new Car(this, { id: p.id, name: String(P.n || 'Jugador').slice(0, 16), remote: true, human: !it.bot, vid: vehicleById(P.v).id, up: Array.isArray(P.u) ? P.u : [0, 0, 0], paint: typeof P.pa === 'number' ? P.pa : null, look: driverLook({ hero: P.h || 'lia', custom: P.c || {} }, P.d || 'hero') }); this.cars.push(c); this._tagFor(c); if (!it.bot) this._chat(`${c.name} entró a la arena`); }
      const a = it.st; c.net = { x: +a[0], y: +a[1], z: +a[2], yaw: +a[3] }; c.fwdV = +a[4] || 0; c.hp = +a[5] || 0;
      const dead = !!a[6]; if (dead && !c.dead) { c.dead = 99; this._explode(c.x, c.y + 1, c.z, 1.6); for (const pp of c.parts.slice(c.lost)) this._detach(c, pp, 1.6); c.lost = c.parts.length; for (const w of c.B.wheels) this._detach(c, w.wh, 1.3, true); for (const { mt } of c.mats) mt.color.setHex(0x1a1614); c.wreckT = 3.2; }
      if (!dead && c.dead) { c.dead = 0; this._restore(c); c.lost = 0; c.x = c.net.x; c.z = c.net.z; }
      if (!dead) { const lose = Math.floor((1 - Math.max(0, c.hp) / c.V.hp) * c.parts.length * 0.85); while (c.lost < lose) this._detach(c, c.parts[c.lost++], 1); }
      const f = a[7] | 0; c.shieldT = f & 1 ? 0.5 : 0; c.boostT = f & 2 ? 0.3 : 0; c.fireT = f & 4 ? 0.2 : 0; c.air = !!(f & 8); c.kills = a[8] | 0; c.deaths = a[9] | 0; c.steerA = +a[10] || 0; c.seenT = this.clock;
    }
    for (const c of [...this.cars]) if (c.remote && !seen.has(c.id) && this.clock - (c.seenT || 0) > (c.human ? 4 : 1.5)) { if (c.human) this._chat(`${c.name} se fue`); c.remove(); this.cars.splice(this.cars.indexOf(c), 1); }
  }
  _remoteTick(c, dt) {
    if (!c.net) return; if (c.dead > 0) return;
    const t = c.net, k = 1 - Math.exp(-12 * dt);
    if (Math.hypot(t.x - c.x, t.z - c.z) > 10) { c.x = t.x; c.z = t.z; c.y = t.y; }
    else { c.x += (t.x - c.x) * k + Math.sin(c.yaw) * c.fwdV * dt * 0.5; c.z += (t.z - c.z) * k + Math.cos(c.yaw) * c.fwdV * dt * 0.5; c.y += (t.y - c.y) * k; }
    c.yaw += angD(t.yaw, c.yaw) * k; c.vx = Math.sin(c.yaw) * c.fwdV; c.vz = Math.cos(c.yaw) * c.fwdV;
  }
  _onNet(from, ev) {
    if (ev.ep !== this.ep) return;
    const o = this.cars.find(c => c.id === (ev.o || from));
    if (ev.t === 'dshot' && o) this._fire(o, ev.k, ev);
    else if (ev.t === 'sp' && o) this._specialFx(o, true);
    else if (ev.t === 'oro') { const k = this.golds.findIndex(B => B.i === ev.i); if (k >= 0) { const B = this.golds[k], gen = this.gen; this.root.remove(B.m); this.golds.splice(k, 1); this._pop(B.x, 1.4, B.z, 0xffe070, 3); this._sfx('dorada', B.x, B.z, 0.5, null); setTimeout(() => { if (this.active && this.gen === gen) this._goldCrate(B.i); }, 25000); } }
    else if (ev.t === 'act' && o) { if (ev.k === 'metralla') { o.burst = 7; o.burstT = 0; } else if (ev.k === 'fuego') { o.fireT = o.V.boom ? 3.6 : 2.4; this._sfx('fuego', o.x, o.z, 0.8, null); } else if (ev.k === 'nitro') this._sfx('nitro', o.x, o.z, 0.55, null); }
    else if (ev.t === 'dhit') { const v = this.cars.find(c => c.id === ev.v && !c.remote), by = this.cars.find(c => c.id === ev.o); if (v) this._damage(v, Math.min(80, +ev.d || 0), by, ev.k); } // a mí o a uno de mis vehículos de la CPU
    else if (ev.t === 'ko') { const v = this.cars.find(c => c.id === ev.v), by = ev.by && this.cars.find(c => c.id === ev.by); if (by && by.you) { by.kills++; this._flash(`¡Destrozaste a ${v ? v.name : 'un rival'}!`, '#7affa0'); this.ctx.audio.play('unlock'); } if (v) this._feed(by || null, v); }
    else if (ev.t === 'barril') { const b = this.F.barrels[ev.i]; if (b && !(b.t > 0)) { b.t = 20; b.barrel.visible = false; this._explode(b.x, 0.8, b.z, 1.2); } }
    else if (ev.t === 'caja') { const k = this.crates.findIndex(B => B.i === ev.i); if (k >= 0) { const B = this.crates[k], gen = this.gen; this.root.remove(B.m); this.crates.splice(k, 1); this._pop(B.x, 1.1, B.z, 0xffc81a, 1.8); this._sfx('caja' + (1 + (ev.i & 1)), B.x, B.z, 0.5, null); setTimeout(() => { if (this.active && this.gen === gen) this._crate(B.i); }, 6000); } }
  }
  _tagFor(c) {
    const el = document.createElement('div'); el.className = 'derbyTag'; el.innerHTML = `<span>${esc(c.name)}</span><i><b></b></i>`; $('raceHud').appendChild(el); c.tag = el; c.tagHp = el.querySelector('b');
  }
  _chat(t) { const el = $('derbyFeed'); if (!el) return; const row = document.createElement('div'); row.className = 'sys'; row.textContent = t; el.prepend(row); setTimeout(() => row.remove(), 5000); }

  // ---------- interfaz (usa la de las carreras) ----------
  _hud(on) {
    document.body.classList.toggle('racing', on); document.body.classList.toggle('derby', on);
    $('raceHud').classList.toggle('hidden', !on); $('raceEnd').classList.add('hidden'); $('racePause').classList.add('hidden');
    if (on) {
      if (!$('derbyHp')) $('raceHud').insertAdjacentHTML('beforeend', '<div id="derbyHp"><i><b></b></i><span></span></div><div id="derbyFeed"></div><div id="derbyHurt"></div>');
      $('derbyFeed').innerHTML = '';
      if (!this._wired) {
        this._wired = true;
        const hold = (id, key) => { const el = $(id);
          el.addEventListener('touchstart', e => { if (!this.active) return; e.preventDefault(); this[key] = true; el.classList.add('on'); }, { passive: false });
          const up = e => { if (!this.active) return; e.preventDefault(); this[key] = false; el.classList.remove('on'); };
          el.addEventListener('touchend', up, { passive: false }); el.addEventListener('touchcancel', up, { passive: false }); };
        hold('rtDrift', 'tDrift'); hold('rtBrake', 'tBrake');
        const u = $('rtUse'); u.addEventListener('touchstart', e => { if (!this.active) return; e.preventDefault(); this.tUseP = true; }, { passive: false }); u.addEventListener('mousedown', () => { if (this.active) this.tUseP = true; });
      }
      for (const c of this.cars) if (!c.you && !c.tag) this._tagFor(c);
      $('racePause').querySelector('h2').textContent = 'Arena en pausa'; this._labels(true);
    } else { for (const c of this.cars) if (c.tag) { c.tag.remove(); c.tag = null; } $('racePause').querySelector('h2').textContent = 'Carrera en pausa'; this._labels(false); }
    this.tDrift = this.tBrake = false; if (this.ctx.input.resetTouch) this.ctx.input.resetTouch();
  }
  _labels(on) { // los botones de la pantalla de carreras, con sus nombres para la arena
    const L = { bRaceTrack: ['Cambiar pista', 'Cambiar vehículo'], bRaceTrack2: ['Cambiar pista', 'Cambiar vehículo'], bRaceEndLeave: ['Salir de la carrera', 'Salir de la arena'], bRaceLeave: ['Salir de la carrera', 'Salir de la arena'], bRaceRestart: ['Repetir carrera', 'Otra ronda'] };
    for (const [id, t] of Object.entries(L)) { const el = $(id); if (!el) continue; const n = [...el.childNodes].reverse().find(x => x.nodeType === 3); if (n) n.nodeValue = ' ' + t[on ? 1 : 0]; }
    if (this.net) { const r = $('bRaceRestart'); if (r) r.classList.toggle('hidden', on); } else { const r = $('bRaceRestart'); if (r) r.classList.remove('hidden'); }
  }
  _hurtFx(dmg) { const el = $('derbyHurt'); if (!el) return; el.style.opacity = Math.min(0.7, 0.2 + dmg / 40); clearTimeout(this._hurtT); this._hurtT = setTimeout(() => { el.style.opacity = 0; }, 160); }
  _hudTick() {
    const me = this.me, f = clamp(me.hp / me.V.hp, 0, 1);
    const hb = $('derbyHp'); hb.querySelector('b').style.width = (f * 100) + '%'; hb.querySelector('b').style.background = f > 0.5 ? '#6ad04a' : f > 0.25 ? '#ffc83a' : '#ff4a3a';
    hb.querySelector('span').textContent = me.dead > 0 ? `Vuelves en ${Math.ceil(me.dead)}…` : `${Math.ceil(me.hp)} / ${me.V.hp}`;
    const sorted = [...this.cars].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths), place = sorted.indexOf(me) + 1;
    $('racePlace').innerHTML = `${place}<small>.º/${this.cars.length}</small>`;
    $('raceLap').innerHTML = `💥 ${me.kills}`;
    const t = Math.ceil(this.left); $('raceTime').textContent = `${Math.floor(Math.max(0, t) / 60)}:${String(Math.max(0, t) % 60).padStart(2, '0')}`;
    $('raceSpeed').innerHTML = `${Math.round(me.speed * 4)}<small> km/h</small>`;
    const key = (me.item || '') + me.n + (me.V.cannon && !me.item ? (me.canT > 0 ? 'c' + Math.ceil(me.canT) : 'cok') : '');
    if (key !== this._itemKey) { this._itemKey = key; const W = me.item && (me.item === 'especial' ? { ...SPECIALS[me.V.id], icon: '★' } : WEAPONS[me.item]); $('raceItem').innerHTML = W ? `<span class="ic">${W.icon}</span><small>${W.name}${me.n > 1 ? ' ×' + me.n : ''}</small>` : me.V.cannon ? `<span class="ic">🎯</span><small>${me.canT > 0 ? Math.ceil(me.canT) + ' s' : 'Cañón'}</small>` : '<span class="q">?</span>'; $('raceItem').classList.toggle('has', !!W || (me.V.cannon && !(me.canT > 0))); }
    if ((this._boardT = (this._boardT || 0) - 1) <= 0) { this._boardT = 15;
      $('raceBoard').innerHTML = sorted.slice(0, 8).map((c, k) => `<div class="${c.you ? 'me' : ''}"><b>${k + 1}</b> ${esc(c.name).slice(0, 14)} <em>💥${c.kills}</em></div>`).join(''); }
  }
  _flash(text, color) { const el = $('raceMsg'); el.textContent = text; el.style.color = color; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }
  _end() {
    this.over = true; const C = this.ctx;
    const sorted = [...this.cars].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths), place = sorted.indexOf(this.me) + 1;
    const rew = [180, 120, 80][place - 1] || 40 + this.me.kills * 10;
    $('raceEndTitle').innerHTML = place === 1 ? '🏆 ¡Rey de la Chatarrería!' : `${place}.º lugar`;
    const k = this.me.kills, dd = this.me.deaths; $('raceEndSub').textContent = `${k} ${k === 1 ? 'destrozado' : 'destrozados'} · ${dd === 0 ? 'nunca te hicieron chatarra' : dd === 1 ? 'te hicieron chatarra 1 vez' : `te hicieron chatarra ${dd} veces`} · +${rew} Ecos`;
    $('raceEndList').innerHTML = sorted.map((c, k) => `<li class="${c.you ? 'me' : ''}"><b>${k < 3 ? ['🥇', '🥈', '🥉'][k] : (k + 1) + '.º'}</b> <span>${esc(c.name)}</span> <em>💥 ${c.kills} · ✖ ${c.deaths}</em></li>`).join('');
    $('bRaceAgain').innerHTML = this.net ? '↻ Otra ronda' : '↻ Otra ronda';
    $('raceEnd').classList.remove('hidden'); document.body.classList.add('raceover'); C.audio.play(place <= 3 ? 'unlock' : 'checkpoint');
    try { C.addEcos(rew); const sv = C.getSave(); if (sv) { const d = sv.derby = sv.derby || {}; d.games = (d.games || 0) + 1; d.kills = (d.kills || 0) + this.me.kills; if (place === 1) d.wins = (d.wins || 0) + 1; C.save && C.save(); } } catch (e) {}
    if (C.onFinish) setTimeout(() => { try { C.onFinish(); } catch (e) {} }, 5000);
  }
  // ---------- arena pública: rondas por la hora, resultados y ranking semanal ----------
  _roundTick(dt) {
    const now = Date.now(), rid = Math.floor(now / (ROUND_ON * 1000));
    if (this.rid === undefined) { this.rid = rid; this.played = 0; }
    this.left = (rid + 1) * ROUND_ON - now / 1000;
    if (!this.over) this.played += dt;
    if (rid !== this.rid && !this.over) { this.rid = rid; this._roundEnd(); }
    if (this.over && now >= this.restAt) { // ronda nueva: todos empiezan de cero
      this.over = false; this.me.kills = 0; this.me.deaths = 0; for (const c of this.cars) if (!c.remote) { c.kills = 0; c.deaths = 0; }
      $('raceEnd').classList.add('hidden'); document.body.classList.remove('raceover'); this.played = 0; this._flash('¡Ronda nueva!', '#ff8a4a'); this.ctx.audio.play('go');
      this._spawn(this.me);
    }
  }
  _roundEnd() {
    this.over = true; this.restAt = Date.now() + 10000; const C = this.ctx, me = this.me;
    const sorted = [...this.cars].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths), place = sorted.indexOf(me) + 1;
    const rew = me.kills > 0 ? ([150, 100, 70][place - 1] || 30) + me.kills * 8 : 10;
    $('raceEndTitle').innerHTML = place === 1 && me.kills > 0 ? '🏆 ¡Ganaste la ronda!' : `${place}.º en la ronda`;
    $('raceEndSub').innerHTML = `${me.kills} ${me.kills === 1 ? 'destrozado' : 'destrozados'} · +${rew} Ecos<br><span id="derbyRank">${this.played > 45 ? 'Sumando al ranking semanal…' : 'Juega una ronda más larga para sumar al ranking'}</span><br>Ronda nueva en unos segundos`;
    $('raceEndList').innerHTML = sorted.slice(0, 10).map((c, k) => `<li class="${c.you ? 'me' : ''}"><b>${k < 3 ? ['🥇', '🥈', '🥉'][k] : (k + 1) + '.º'}</b> <span>${esc(c.name)}</span> <em>💥 ${c.kills} · ✖ ${c.deaths}</em></li>`).join('');
    $('bRaceAgain').classList.add('hidden');
    $('raceEnd').classList.remove('hidden'); document.body.classList.add('raceover'); C.audio.play(place <= 3 ? 'unlock' : 'checkpoint');
    try { C.addEcos(rew); const sv = C.getSave(); if (sv) { const d = sv.derby = sv.derby || {}; d.games = (d.games || 0) + 1; d.kills = (d.kills || 0) + me.kills; if (place === 1 && me.kills > 0) d.wins = (d.wins || 0) + 1; C.save && C.save(); } } catch (e) {}
    if (this.played > 45) this.submit(me.kills, me.deaths).then(r => { const el = $('derbyRank'); if (el) el.innerHTML = r && r.ok ? `Ranking de la semana: <b>${r.rank}.º general</b> · ${r.rankZona}.º en ${esc(r.zonaNombre || '')} · llevas 💥 ${r.kills} en ${r.rondas} ${r.rondas === 1 ? 'ronda' : 'rondas'}` : 'No se pudo enviar al ranking'; });
  }
  async submit(kills, deaths) {
    try { const sv = this.ctx.getSave() || {}; const r = await fetch(httpURL('/arena/resultado'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ disp: localStorage.getItem('aethra_disp') || '', nombre: (sv.name || 'Jugador').slice(0, 16), kills: Math.min(40, kills | 0), deaths: Math.min(60, deaths | 0) }) }); return await r.json(); } catch (e) { return null; }
  }
  togglePause() { if (this.over) return; this.paused = !this.paused; $('racePause').classList.toggle('hidden', !this.paused); }
  again() { const o = this.opts; this.exit(true); this.start(o); }
  exit(keep) {
    const C = this.ctx; this.active = false;
    for (const c of this.cars) c.remove(); this.cars = [];
    C.scene.remove(this.root); this.root = null;
    this._hud(false); document.body.classList.remove('raceover'); $('bRaceAgain').classList.remove('hidden');
    if (!keep && this.net) { try { this.net.close(); } catch (e) {} this.net = null; }
  }
}
