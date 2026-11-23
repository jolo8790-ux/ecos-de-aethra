// Carreras de Aethra — etapa 1: Gran Premio de Puerto Bruma.
// Una pista cerrada de tablones sobre el mar de nubes, karts contra la CPU, 3 o 5 vueltas,
// derrape con turbo, placas de impulso y podio con premio en Ecos.
import * as THREE from 'three';
import { createCharacter, recolor } from './characters.js';
import { HEROES, heroById, heroLook, heroUnlocked } from './heroes.js';
import { prop, hasProp } from './props.js';
import { RaceItems, ITEMS } from './raceitems.js';
import { KARTS, kartById, garageOf, kartPoints, kartMods, PAINTS, TRAILS, DRIVERS, partOf, retoOk } from './garage.js';

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angD = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const damp = (k, dt) => 1 - Math.exp(-k * dt);

// ---------- pistas ----------
// p: puntos de control [x, z, altura]; w: ancho; boosts: placas de impulso (fracción de la vuelta)
export const TRACKS = {
  puerto: {
    name: 'Gran Premio de Puerto Bruma', short: 'Puerto Bruma', icon: '⚓',
    desc: 'Muelles de tablones sobre el mar de nubes, con el faro y una subida al muelle alto.',
    w: 13,
    p: [[0, 0, 0], [45, 0, 0], [80, -8, 0.5], [100, -38, 2], [96, -72, 4.5], [70, -96, 6], [32, -98, 6], [10, -80, 4.5], [-6, -56, 3], [-30, -46, 2.5],
      [-58, -60, 3], [-86, -50, 2], [-96, -20, 1], [-80, 8, 0.4], [-48, 14, 0]],
    boosts: [0.06, 0.33, 0.58, 0.86], items: [0.17, 0.45, 0.72],
    sky: { top: 0x4f8fe0, bottom: 0xffd2b0, fog: 0xf2d8e8, fogNear: 90, fogFar: 300 },
    light: { hemiSky: 0xfff0ff, hemiGround: 0x6a4a8a, sun: 0xfff0d0 },
    water: { y: -6, color: 0xf6eaff },
    reward: [60, 35, 20, 10],
    theme: { road: 'planks', curb: ['#f4f2ee', '#e8483c'], side: 0x6e4428, rail: 0x8c5a32, post: 0x5a3820, pile: 0x5e3c24, banner: '⚓  GRAN PREMIO DE PUERTO BRUMA  ⚓', decor: 'puerto', palette: { top: 0x7ac85a, side: 0x8a6a54 } },
  },
  bosque: {
    name: 'Circuito del Bosque Colgante', short: 'Bosque Colgante', icon: '🌳',
    desc: 'Ramas gigantes entre árboles colosales, subidas, bajadas y curvas cerradas entre hongos.',
    w: 12,
    p: [[0, 0, 0], [40, 0, 2], [70, -15, 6], [78, -45, 9], [55, -70, 7], [25, -62, 4], [10, -85, 5], [-15, -110, 9], [-50, -100, 11], [-70, -70, 8], [-55, -40, 4], [-75, -15, 2], [-60, 12, 0.5], [-30, 18, 0]],
    boosts: [0.04, 0.3, 0.55, 0.8], items: [0.14, 0.42, 0.68, 0.9],
    sky: { top: 0x3a8a6a, bottom: 0xffe0a0, fog: 0xc8e0b0, fogNear: 70, fogFar: 240 },
    light: { hemiSky: 0xfff4d0, hemiGround: 0x3a5a2a, sun: 0xffe8b0 },
    water: { y: -14, color: 0xc8e8b8 },
    reward: [70, 40, 22, 12],
    theme: { road: 'forest', curb: ['#ffd24a', '#3a9a4a'], side: 0x5a3a22, rail: 0x4a8a3a, post: 0x4a3018, pile: 0x5a3a22, banner: '🌳  CIRCUITO DEL BOSQUE COLGANTE  🌳', decor: 'bosque', palette: { top: 0x5ab04a, side: 0x6a4a34 } },
  },
  glaciar: {
    name: 'Pista del Glaciar del Eco', short: 'Glaciar del Eco', icon: '❄', lock: 'bosque',
    desc: 'Hielo resbaloso entre pinos nevados: aquí se derrapa casi sin querer.',
    w: 14, grip: 0.86, slide: 1.5,
    p: [[0, 0, 0], [55, 0, 0], [95, -20, 1], [105, -60, 3], [80, -95, 4], [40, -90, 2], [20, -60, 1], [-10, -55, 2], [-30, -90, 5], [-70, -100, 6], [-100, -70, 4], [-95, -30, 2], [-60, -10, 1], [-30, 10, 0]],
    boosts: [0.08, 0.36, 0.62, 0.88], items: [0.2, 0.5, 0.78],
    sky: { top: 0x6a9ad8, bottom: 0xf0f6ff, fog: 0xe8f0fa, fogNear: 70, fogFar: 260 },
    light: { hemiSky: 0xf4f8ff, hemiGround: 0x8aa0c0, sun: 0xffffff },
    water: { y: -8, color: 0xeef6ff },
    reward: [80, 45, 25, 14],
    theme: { road: 'ice', curb: ['#ffffff', '#3a7aff'], side: 0x9ac0e0, rail: 0xd8ecff, post: 0x7aa0c8, pile: 0xb8d4ee, banner: '❄  PISTA DEL GLACIAR DEL ECO  ❄', decor: 'glaciar', palette: { top: 0xf4f8ff, side: 0x9ab4d0 } },
  },
};
export const RACE_LAPS = [3, 5];
const LEVEL = { facil: 0.83, normal: 0.92, dificil: 0.99, auto: 0.9 };
const COLORS = [0x3aa0ff, 0xff6a4a, 0x6ad04a, 0xffc83a, 0xb070ff, 0xff7ab8, 0x3ad6c6, 0xf0f0f0];
const INTRO = 4.2; // segundos de presentación de la parrilla
const BADW = /\b(put[ao]s?|mierda|pendej[oa]s?|idiota|est[uú]pid[oa]|imb[eé]cil|boludo|pelotudo|cabr[oó]n|co[nñ]o|joder|verga|culiao|maric[oó]n|forro|hdp|fuck|shit|bitch)\b/gi;
const MAXV = 27, ACC = 17, BRAKE = 34, TURN = 2.05;

// ---------- texturas hechas a mano (canvas) ----------
function tex(w, h, draw, rep = true) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
const planks = () => tex(256, 256, (c, w, h) => {
  const cols = ['#b77a48', '#a86c3e', '#c08654', '#9e6238', '#b47444'];
  for (let i = 0; i < 8; i++) {
    c.fillStyle = cols[(i * 3) % cols.length]; c.fillRect(0, i * 32, w, 32);
    for (let k = 0; k < 18; k++) { c.fillStyle = `rgba(80,40,20,${0.06 + Math.random() * 0.08})`; c.fillRect(Math.random() * w, i * 32 + 4 + Math.random() * 24, 30 + Math.random() * 80, 1.5); }
    c.fillStyle = 'rgba(50,25,10,.75)'; c.fillRect(0, i * 32, w, 3);
    c.fillStyle = 'rgba(255,230,190,.18)'; c.fillRect(0, i * 32 + 3, w, 2);
    for (const x of [18, w - 22]) { c.fillStyle = '#5a3a24'; c.beginPath(); c.arc(x, i * 32 + 16, 2.6, 0, 7); c.fill(); }
  }
});
const forestRoad = () => tex(256, 256, (c, w, h) => {
  c.fillStyle = '#8a6440'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(${60 + Math.random() * 60},${40 + Math.random() * 40},${20},${0.25})`; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 8, 0, 7); c.fill(); }
  for (let i = 0; i < 6; i++) { c.strokeStyle = 'rgba(70,45,25,.6)'; c.lineWidth = 6 + Math.random() * 5; c.beginPath(); const y = Math.random() * h; c.moveTo(0, y); c.bezierCurveTo(w * 0.3, y + 20, w * 0.7, y - 20, w, y + 5); c.stroke(); }
  for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(${80 + Math.random() * 60},${150 + Math.random() * 60},60,.55)`; c.beginPath(); c.ellipse(Math.random() * w, Math.random() * h, 6, 3, Math.random() * 3, 0, 7); c.fill(); }
  c.fillStyle = 'rgba(90,170,70,.35)'; c.fillRect(0, 0, 22, h); c.fillRect(w - 22, 0, 22, h);
});
const iceRoad = () => tex(256, 256, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#cfe8ff'); g.addColorStop(1, '#a8d0f4'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 18; i++) { c.strokeStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.4})`; c.lineWidth = 1 + Math.random() * 2; c.beginPath(); let x = Math.random() * w, y = Math.random() * h; c.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60; c.lineTo(x, y); } c.stroke(); }
  for (let i = 0; i < 30; i++) { c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.ellipse(Math.random() * w, Math.random() * h, 10 + Math.random() * 16, 4 + Math.random() * 6, Math.random() * 3, 0, 7); c.fill(); }
});
const gridTex = n => tex(128, 184, (c, w, h) => {
  c.clearRect(0, 0, w, h); c.strokeStyle = '#ffffff'; c.lineWidth = 9; c.lineCap = 'square';
  c.beginPath(); c.moveTo(8, 60); c.lineTo(8, 10); c.lineTo(w - 8, 10); c.lineTo(w - 8, 60); c.stroke(); // la «caja» abierta hacia atrás
  c.fillStyle = 'rgba(255,255,255,.9)'; c.font = 'bold 56px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(n), w / 2, 120);
}, false);
const curbTex = (a = '#f4f2ee', b = '#e8483c') => tex(32, 64, (c, w, h) => { c.fillStyle = a; c.fillRect(0, 0, w, h); c.fillStyle = b; c.fillRect(0, 0, w, h / 2); });
const checker = () => tex(128, 32, (c, w, h) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { c.fillStyle = (x + y) % 2 ? '#111' : '#fafafa'; c.fillRect(x * 8, y * 8, 8, 8); } });
const chevron = () => tex(128, 128, (c, w, h) => {
  c.clearRect(0, 0, w, h);
  for (let k = 0; k < 2; k++) { const y = k * 64; c.strokeStyle = '#fff6a0'; c.lineWidth = 16; c.lineCap = 'round'; c.beginPath(); c.moveTo(18, y + 52); c.lineTo(64, y + 14); c.lineTo(110, y + 52); c.stroke(); }
});
function banner(text) {
  return tex(1024, 128, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2a4fa8'); g.addColorStop(1, '#1a2f70'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffc83a'; c.fillRect(0, 0, w, 8); c.fillRect(0, h - 8, w, 8);
    c.font = 'bold 64px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText(text, w / 2, h / 2 + 4);
  }, false);
}

// textura del kart de Artlist recoloreada (una por color, se reutiliza)
const _kartTex = new Map();
function kartTex(map, color, hsl, ranges) {
  const key = map.uuid + color; if (_kartTex.has(key)) return _kartTex.get(key);
  let t = map;
  const grey = hsl.s < 0.15, light = hsl.l > 0.8 ? 1.9 : hsl.l < 0.25 ? 0.45 : hsl.l > 0.6 ? 1.35 : 1.1;
  try { t = recolor(map, ranges.map(r => ({ from: r, minSat: 0.2, to: hsl.h * 360, ...(grey ? { setSat: 0.08 } : { sat: 1.15 }), light }))); } catch (e) {}
  _kartTex.set(key, t); return t;
}
// piloto sentado en el kart (pose de sentado, mirando al frente)
export function seatDriver(parent, lib, look, art = true) {
  try {
    const ch = createCharacter(lib, look);
    for (const a of Object.values(ch.actions)) { a.play(); a.timeScale = 0; a.setEffectiveWeight(0); }
    const sit = ch.actions.Sit_Floor_Idle || ch.actions.Idle; sit.setEffectiveWeight(1); sit.time = ch.actions.Sit_Floor_Idle ? 0.35 : 0;
    ch.mixer.update(0);
    ch.root.position.set(0, art ? 0.2 : 0.36, art ? -0.32 : -0.42); ch.root.rotation.y = Math.PI; ch.root.scale.multiplyScalar(0.9); parent.add(ch.root);
    ch.root.traverse(m => { if (m.isMesh) m.castShadow = true; });
    return ch;
  } catch (e) { console.warn('piloto', e); return null; }
}
export const driverLook = (sv, id) => { const D = DRIVERS.find(d => d.id === id) || DRIVERS[0]; return D.look === 'mine' ? heroLook((sv && sv.hero) || 'lia', (sv && sv.custom) || {}) : heroLook(D.look, {}); };
// kart listo para mostrar: el modelo de Artlist (con la carrocería repintada si paint no es null) o el hecho con formas
export function makeKart(kartId, paint = null, fallback = 0x3aa0ff) {
  const K = kartById(kartId), id = hasProp(K.model) ? K.model : hasProp('kart') ? 'kart' : null;
  if (!id) return { kart: buildKart(paint ?? fallback), art: false };
  const kart = prop(id, { w: 2.25 }, { rotY: 0 });
  const hsl = {}; if (paint != null) new THREE.Color(paint).getHSL(hsl);
  kart.traverse(m => {
    if (!m.isMesh) return; m.castShadow = true;
    m.material = m.material.clone(); m.material.roughness = 0.55; m.material.metalness = 0.15;
    if (m.material.map && paint != null) m.material.map = kartTex(m.material.map, paint, hsl, id === K.model ? K.hue : KARTS[0].hue);
  });
  kart.userData.wheels = [];
  return { kart, art: true };
}
// ---------- kart hecho con formas (si no hay modelo de Artlist) ----------
function buildKart(color) {
  const g = new THREE.Group();
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.05, ...o });
  const body = M(color), trim = M(0xffc83a, { metalness: 0.5, roughness: 0.35 }), dark = M(0x2a2a34), wood = M(0x8a5a34);
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; g.add(m); return m; };
  // chasis redondeado
  const shape = new THREE.Shape(); const L = 1.35, W = 0.72;
  shape.moveTo(-W, -L); shape.lineTo(W, -L); shape.quadraticCurveTo(W + 0.12, 0, W * 0.78, L * 0.95); shape.quadraticCurveTo(0, L * 1.18, -W * 0.78, L * 0.95); shape.quadraticCurveTo(-W - 0.12, 0, -W, -L);
  const ch = add(new THREE.ExtrudeGeometry(shape, { depth: 0.32, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.1, bevelSegments: 3 }), body, 0, 0.42, 0, Math.PI / 2, 0, 0);
  ch.position.y = 0.6; // la forma se extruye hacia abajo
  add(new THREE.BoxGeometry(1.55, 0.08, 2.3), dark, 0, 0.26, -0.05); // piso
  add(new THREE.CylinderGeometry(0.62, 0.7, 0.42, 20, 1, false, Math.PI * 0.15, Math.PI * 1.7), body, 0, 0.62, 0.95, 0, Math.PI, 0); // morro
  add(new THREE.TorusGeometry(0.45, 0.05, 8, 20, Math.PI), trim, 0, 0.62, -0.25, 0, 0, 0); // arco del asiento
  add(new THREE.BoxGeometry(0.78, 0.5, 0.16), wood, 0, 0.66, -0.55, -0.25); // respaldo
  add(new THREE.BoxGeometry(0.78, 0.12, 0.6), wood, 0, 0.44, -0.3); // asiento
  // volante
  add(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 6), dark, 0, 0.7, 0.42, -0.9);
  g.userData.wheel = add(new THREE.TorusGeometry(0.17, 0.035, 8, 16), dark, 0, 0.86, 0.32, -0.6);
  // alerón con forma de vela
  const sail = new THREE.Shape(); sail.moveTo(-0.7, 0); sail.lineTo(0.7, 0); sail.quadraticCurveTo(0.2, 0.25, 0, 0.62); sail.quadraticCurveTo(-0.2, 0.25, -0.7, 0);
  add(new THREE.ShapeGeometry(sail), M(0xf4ecd8, { side: THREE.DoubleSide }), 0, 1.02, -1.28, 0.2);
  add(new THREE.BoxGeometry(1.5, 0.06, 0.32), trim, 0, 1.0, -1.28);
  for (const x of [-0.55, 0.55]) add(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), dark, x, 0.75, -1.25);
  // tubo de escape (de aquí sale el fuego del turbo)
  for (const x of [-0.3, 0.3]) add(new THREE.CylinderGeometry(0.08, 0.1, 0.4, 10), trim, x, 0.42, -1.42, Math.PI / 2);
  // farolillo delantero
  add(new THREE.SphereGeometry(0.12, 12, 8), M(0xfff2b0, { emissive: 0xffc860, emissiveIntensity: 1.3 }), 0, 0.72, 1.42);
  // ruedas
  const tire = new THREE.CylinderGeometry(0.34, 0.34, 0.3, 18), rim = new THREE.CylinderGeometry(0.2, 0.2, 0.32, 12);
  g.userData.wheels = [];
  for (const [x, z, s] of [[-0.82, 0.85, 1], [0.82, 0.85, 1], [-0.86, -0.85, 1.15], [0.86, -0.85, 1.15]]) {
    const w = new THREE.Group(); w.position.set(x, 0.34 * s, z); g.add(w);
    const t = new THREE.Mesh(tire, dark); t.rotation.z = Math.PI / 2; t.scale.setScalar(s); t.castShadow = true; w.add(t);
    const r = new THREE.Mesh(rim, trim); r.rotation.z = Math.PI / 2; r.scale.setScalar(s); w.add(r);
    w.userData.front = z > 0; g.userData.wheels.push(w);
  }
  return g;
}

// ---------- la pista ----------
class Track {
  constructor(def, root) {
    this.def = def; this.root = root;
    const pts = def.p.map(([x, z, y]) => new THREE.Vector3(x, y, z));
    const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    const N = this.N = 720;
    this.c = []; this.t = []; this.r = []; this.d = [0];
    for (let i = 0; i < N; i++) this.c.push(curve.getPointAt(i / N));
    for (let i = 0; i < N; i++) {
      const a = this.c[(i - 1 + N) % N], b = this.c[(i + 1) % N];
      const t = b.clone().sub(a).normalize(); this.t.push(t);
      this.r.push(new THREE.Vector3(-t.z, 0, t.x).normalize()); // derecha (en planta)
      if (i) this.d.push(this.d[i - 1] + this.c[i].distanceTo(this.c[i - 1]));
    }
    this.L = this.d[N - 1] + this.c[0].distanceTo(this.c[N - 1]);
    this.hw = def.w / 2;
    this._build();
  }
  // punto de la pista más cercano, buscando cerca del anterior
  near(p, hint = -1) {
    const N = this.N; let best = 0, bd = Infinity;
    const scan = (i) => { const c = this.c[i], d = (c.x - p.x) ** 2 + (c.z - p.z) ** 2 + ((c.y - p.y) * 0.3) ** 2; if (d < bd) { bd = d; best = i; } };
    if (hint < 0) for (let i = 0; i < N; i++) scan(i);
    else for (let k = -40; k <= 40; k++) scan((hint + k + N) % N);
    return best;
  }
  // altura y pendiente de la pista en p (interpola entre muestras)
  frame(p, i) {
    const N = this.N, c = this.c[i], t = this.t[i];
    const dx = p.x - c.x, dz = p.z - c.z;
    const along = dx * t.x + dz * t.z, lat = dx * this.r[i].x + dz * this.r[i].z;
    const j = along >= 0 ? (i + 1) % N : (i - 1 + N) % N, seg = this.c[i].distanceTo(this.c[j]) || 1;
    const k = clamp(Math.abs(along) / seg, 0, 1), y = c.y + (this.c[j].y - c.y) * k;
    return { y, lat, along, dist: (this.d[i] + along + this.L) % this.L };
  }
  _build() {
    const N = this.N, hw = this.hw, root = this.root;
    const ribbon = (offA, offB, yA, yB, vScale, mat, close = true) => {
      const pos = [], uv = [], idx = [];
      for (let i = 0; i <= N; i++) {
        const k = i % N, c = this.c[k], r = this.r[k], v = (i === N ? this.L : this.d[k]) / vScale;
        pos.push(c.x + r.x * offA, c.y + yA, c.z + r.z * offA, c.x + r.x * offB, c.y + yB, c.z + r.z * offB);
        uv.push(0, v, 1, v);
        if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat); m.receiveShadow = true; root.add(m); return m;
    };
    // calzada de tablones
    const TH = this.def.theme; const pl = TH.road === 'forest' ? forestRoad() : TH.road === 'ice' ? iceRoad() : planks(); ribbon(-hw, hw, 0, 0, TH.road === 'planks' ? 6 : 10, new THREE.MeshStandardMaterial({ map: pl, roughness: TH.road === 'ice' ? 0.25 : 0.8, metalness: TH.road === 'ice' ? 0.1 : 0, side: THREE.DoubleSide }));
    // bordillos rojos y blancos (un poco elevados)
    const cb = curbTex(TH.curb[0], TH.curb[1]); const cm = new THREE.MeshStandardMaterial({ map: cb, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2, side: THREE.DoubleSide });
    ribbon(-hw, -hw + 0.9, 0.03, 0.03, 2.4, cm); ribbon(hw - 0.9, hw, 0.03, 0.03, 2.4, cm);
    // canto y barandilla de madera
    const side = new THREE.MeshStandardMaterial({ color: TH.side, roughness: 0.85, side: THREE.DoubleSide });
    ribbon(-hw, -hw, 0, -0.9, 1, side); ribbon(hw, hw, -0.9, 0, 1, side);
    const rail = new THREE.MeshStandardMaterial({ color: TH.rail, roughness: 0.7, side: THREE.DoubleSide });
    ribbon(-hw - 0.15, -hw - 0.15, 0.55, 0.85, 1, rail).castShadow = true; ribbon(hw + 0.15, hw + 0.15, 0.85, 0.55, 1, rail).castShadow = true;
    ribbon(-hw - 0.15, -hw - 0.15, 0.2, 0.32, 1, rail); ribbon(hw + 0.15, hw + 0.15, 0.32, 0.2, 1, rail);
    // postes de la barandilla y pilotes hasta las nubes
    const step = 5, nPost = Math.floor(this.L / step);
    const post = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 1.05, 0.22), new THREE.MeshStandardMaterial({ color: TH.post, roughness: 0.8 }), nPost * 2);
    const pile = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.45, 0.55, 1, 10), new THREE.MeshStandardMaterial({ color: TH.pile, roughness: 0.9 }), Math.ceil(nPost / 3) * 2 + 2);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
    let pi = 0, pj = 0, si = 0;
    for (let k = 0; k < nPost; k++) {
      while (si < N - 1 && this.d[si] < k * step) si++;
      const c = this.c[si], r = this.r[si];
      q.setFromAxisAngle(up, Math.atan2(r.x, r.z));
      for (const sg of [-1, 1]) {
        m4.compose(new THREE.Vector3(c.x + r.x * (hw + 0.15) * sg, c.y + 0.42, c.z + r.z * (hw + 0.15) * sg), q, s); post.setMatrixAt(pi++, m4);
        if (k % 3 === 0) { const h = c.y + 0.9 - this.def.water.y + 1; m4.compose(new THREE.Vector3(c.x + r.x * (hw - 1.2) * sg, c.y - 0.9 - h / 2, c.z + r.z * (hw - 1.2) * sg), q, new THREE.Vector3(1, h, 1)); pile.setMatrixAt(pj++, m4); }
      }
    }
    post.count = pi; pile.count = pj; post.castShadow = true; root.add(post, pile);
    // línea de meta y arco
    const c0 = this.c[0], r0 = this.r[0], t0 = this.t[0], yaw = Math.atan2(t0.x, t0.z);
    const fin = new THREE.Mesh(new THREE.PlaneGeometry(this.def.w, 2.2), new THREE.MeshStandardMaterial({ map: checker(), roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    fin.rotation.set(-Math.PI / 2, 0, yaw); fin.position.set(c0.x, c0.y + 0.02, c0.z); root.add(fin);
    const arch = new THREE.Group(); arch.position.set(c0.x, c0.y, c0.z); arch.rotation.y = yaw; root.add(arch);
    const pm = new THREE.MeshStandardMaterial({ color: 0xf4ecd8, roughness: 0.6 });
    for (const sg of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 7, 12), pm); p.position.set(sg * (this.hw + 1), 3.5, 0); p.castShadow = true; arch.add(p); }
    const bn = new THREE.Mesh(new THREE.BoxGeometry(this.def.w + 2.6, 1.5, 0.3), [pm, pm, pm, pm, new THREE.MeshStandardMaterial({ map: banner(TH.banner) }), new THREE.MeshStandardMaterial({ map: banner('META') })]);
    bn.position.y = 6.6; bn.castShadow = true; arch.add(bn);
    // semáforo de salida (como en la Fórmula 1): cinco pares de luces rojas colgando del arco
    const panel = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.5, 0.35), new THREE.MeshStandardMaterial({ color: 0x15151c, roughness: 0.5, metalness: 0.4 }));
    panel.position.set(0, 5.05, -0.3); panel.castShadow = true; arch.add(panel);
    for (const x of [-1.6, 1.6]) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6), new THREE.MeshStandardMaterial({ color: 0x333340 })); rod.position.set(x, 6.0, -0.3); arch.add(rod); }
    this.lights = [];
    const lg = new THREE.SphereGeometry(0.22, 16, 12);
    for (let k = 0; k < 5; k++) {
      const pair = [];
      for (const y of [5.4, 4.75]) {
        const m = new THREE.MeshStandardMaterial({ color: 0x2a0606, emissive: 0xff1a10, emissiveIntensity: 0, roughness: 0.3 });
        for (const z of [-0.5, -0.1]) { const l = new THREE.Mesh(lg, m); l.position.set(-2.2 + k * 1.1, y, z); arch.add(l); }
        pair.push(m);
      }
      this.lights.push(pair);
    }
    this.setLights = n => this.lights.forEach((pair, k) => pair.forEach(m => { m.emissiveIntensity = k < n ? 3.2 : 0; m.color.setHex(k < n ? 0xff3020 : 0x2a0606); }));
    for (const sg of [-1, 1]) { const fl = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 4), new THREE.MeshStandardMaterial({ color: 0xffc83a })); fl.position.set(sg * (this.hw + 1), 7.6, 0); arch.add(fl); }
    // placas de impulso
    this.boosts = []; const cv = chevron();
    for (const f of this.def.boosts) {
      const i = Math.floor(f * N), c = this.c[i], t = this.t[i];
      const mat = new THREE.MeshBasicMaterial({ map: cv.clone(), color: 0xffb030, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
      mat.map.needsUpdate = true; mat.map.repeat.set(1, 2);
      const lat = ((i * 7) % 3 - 1) * this.hw * 0.4;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 6), mat);
      m.rotation.set(-Math.PI / 2, 0, Math.atan2(t.x, t.z) + Math.PI); m.position.set(c.x + this.r[i].x * lat, c.y + 0.04, c.z + this.r[i].z * lat); root.add(m);
      const base = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 6.2), new THREE.MeshBasicMaterial({ color: 0x5a2a8a, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -5 }));
      base.rotation.copy(m.rotation); base.position.copy(m.position).setY(c.y + 0.035); root.add(base);
      this.boosts.push({ i, lat, mat, d: this.d[i] });
    }
  }
  // decorado: islas, casas, faro y barriles lejos de la calzada (para el mundo)
  decor(seed = 7) {
    let s = seed; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    const isl = [], houses = [], trees = [], lights = [], props = [], pines = [], bigTrees = [], mushrooms = [];
    const theme = this.def.theme.decor;
    const clear = (x, z, R) => { for (let i = 0; i < this.N; i += 4) { const c = this.c[i]; if (Math.hypot(c.x - x, c.z - z) < this.hw + R + 3) return false; } return true; };
    for (let n = 0; n < 220 && isl.length < 14; n++) {
      const x = -130 + rnd() * 260, z = -140 + rnd() * 190, w = 10 + rnd() * 16, d = 10 + rnd() * 14;
      if (!clear(x, z, Math.hypot(w, d) / 2)) continue;
      if (isl.some(o => Math.hypot(o.x - x, o.z - z) < (o.w + w) / 2 + 4)) continue;
      const top = (theme === 'bosque' ? -6 : -2.6) + rnd() * 2;
      isl.push({ x, z, w, d, top, depth: 4 });
      const k = isl.length % 4;
      if (theme === 'bosque') { trees.push({ x: x - w * 0.2, z, y: top, s: 1.2 + rnd() * 0.6 }, { x: x + w * 0.2, z: z + d * 0.2, y: top, s: 1 + rnd() * 0.5 }); mushrooms.push({ x: x + w * 0.1, z: z - d * 0.25, y: top, s: 1 + rnd() * 0.8 }); continue; }
      if (theme === 'glaciar') { for (let q = 0; q < 3; q++) pines.push({ x: x + (rnd() - 0.5) * w * 0.7, z: z + (rnd() - 0.5) * d * 0.7, y: top, s: 0.9 + rnd() * 0.6 }); if (k === 0) houses.push({ x, z, w: 5, d: 4.5, h: 3, base: top, roof: 0xe8f0ff }); continue; }
      if (k === 0) houses.push({ x, z, w: 5, d: 4.5, h: 3.2, base: top, roof: rnd() < 0.5 ? 0xc9563c : 0x4f7fc0 });
      else if (k === 1) lights.push({ x, z, y: top });
      else { trees.push({ x: x - w * 0.2, z: z - d * 0.15, y: top, s: 0.9 + rnd() * 0.4 }); props.push({ kind: 'barril', x: x + w * 0.2, z: z + d * 0.1, y: top }, { kind: 'caja', x: x + w * 0.25, z: z - d * 0.2, y: top, rot: rnd() * 3 }); }
    }
    if (theme === 'bosque') { // árboles colosales que suben desde el fondo junto a la pista
      for (let n = 0; n < 160 && bigTrees.length < 9; n++) { const x = -120 + rnd() * 240, z = -150 + rnd() * 190; if (clear(x, z, 4) && !clear(x, z, 14)) bigTrees.push({ x, z, y: -30, r: 2.4 + rnd() * 1.4, h: 60 + rnd() * 20 }); }
    }
    return { islands: isl, houses, trees, lighthouses: lights, props, pines, bigTrees, mushrooms, snow: theme === 'glaciar' ? 500 : 0 };
  }
}

// ---------- un corredor ----------
class Racer {
  constructor(race, o) {
    Object.assign(this, { item: null, roll: 0, spin: 0, spinA: 0, uses: 0, shieldT: 0, inv: 0, lap: 0, best: 0, half: false, done: false, time: 0, v: 0, yaw: 0, slip: 0, drift: 0, charge: 0, boostT: 0, bump: 0, i: 0, place: 1, wob: 0, lane: 0 }, o);
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector2(); this.race = race;
    const C = race.ctx;
    this.root = new THREE.Group(); race.root.add(this.root);
    this.body = new THREE.Group(); this.root.add(this.body);
    const K = kartById(this.kartId); this.mods = this.mods || kartMods(K.stats);
    const made = makeKart(this.kartId, this.paint === undefined ? this.color : this.paint, this.color); let kart = made.kart; this.artKart = made.art;
    this.kart = kart; this.body.add(kart);
    // piloto: el héroe sentado en el kart
    const lib = C.charLib();
    if (lib) this.ch = seatDriver(this.body, lib, this.look, this.artKart);
    // sombra redonda bajo el kart
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(1.5, 20), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.28, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.scale.set(0.75, 1.15, 1); race.root.add(this.shadow);
    // fuego del turbo
    const fm = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    this.flames = [-0.3, 0.3].map(x => { const f = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.9, 10), fm); f.rotation.x = -Math.PI / 2; f.position.set(x, 0.42, -1.85); this.body.add(f); return f; });
    this.flameMat = fm; const T = TRAILS.find(t => t.id === this.trail) || TRAILS[0]; this.rainbow = T.color === 'rainbow'; if (!this.rainbow) fm.color.setHex(T.color);
    // chispas del derrape
    const sm = new THREE.MeshBasicMaterial({ color: 0x6ad0ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    this.sparks = [-0.85, 0.85].map(x => { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), sm); s.position.set(x, 0.2, -1.05); this.body.add(s); return s; });
    this.sparkMat = sm;
  }
  get progress() { return this.lap * this.race.track.L + this.dist; }
  remove() { this.race.root.remove(this.root); this.race.root.remove(this.shadow); }
}

export class Race {
  constructor(ctx) { this.ctx = ctx; this.active = false; this.racers = []; }

  start(opts) {
    const C = this.ctx, def = TRACKS[opts.track] || TRACKS.puerto;
    this.opts = opts; this.def = def; this.laps = opts.laps || 3; this.active = true; this.paused = false;
    this.root = new THREE.Group(); this.root.name = 'carrera';
    this.track = new Track(def, this.root);
    const dec = this.track.decor(13);
    C.loadRaceZone({
      id: 'carrera_' + opts.track, arena: true, race: true, title: def.name, subtitle: 'Carreras', seed: 5,
      sky: def.sky, light: def.light, palette: def.theme.palette, water: def.water,
      start: { id: 'salida', pos: [0, 0, 0], facing: 0 }, ...dec,
      airships: def.theme.decor === 'puerto' ? [{ id: 'dirigible', x: 20, y: 18, z: -150 }] : [],
    });
    C.scene.add(this.root);
    const sv = C.getSave() || {};
    const pieces = (sv.piezas || []).length;
    const mine = sv.hero || 'lia';
    // rivales: héroes y villanos (nunca el mismo piloto que llevas tú)
    const G0 = garageOf(sv), myDriver = G0.driver || 'hero';
    const pool = DRIVERS.filter(d => d.id !== 'hero' && d.id !== myDriver && !(myDriver === 'hero' && d.look === mine)).map(d => d.id).sort(() => Math.random() - 0.5);
    const level = LEVEL[sv.difficulty || 'normal'] || LEVEL.normal;
    const n = clamp(opts.rivals ?? 5, 1, 7);
    this.racers = [];
    this.net = opts.net || null; this.isHost = !!opts.isHost; this.ep = opts.ep || 0; this.netSeen = {};
    const G = garageOf(sv), P = PAINTS.find(p => p.id === G.paint) || PAINTS[0];
    const PT = { spark: partOf(sv, 'llantas').spark, sound: partOf(sv, 'motor').sound, flame: partOf(sv, 'turbo').flame };
    const me = new Racer(this, { id: 'me', name: sv.name || 'Tú', you: true, color: COLORS[0], paint: P.color, kartId: G.kart, trail: G.trail, mods: kartMods(kartPoints(sv)), look: driverLook(sv, myDriver), skill: 1, parts: PT });
    let grid = [];
    if (opts.online) { // carrera en línea: la parrilla la decide el anfitrión (jugadores por orden y luego la CPU)
      me.id = opts.myId;
      grid = opts.grid.map((g, k) => {
        if (g.id === opts.myId) return me;
        const R = new Racer(this, { id: g.id, name: String(g.n || 'Jugador').slice(0, 16), color: COLORS[(k + 1) % COLORS.length], kartId: g.k, paint: g.pa ?? null, trail: g.tr || 'fuego',
          look: driverLook({ hero: g.h || 'lia', custom: g.c || {} }, g.d || 'hero'), skill: level * (g.sk || 0.95), lane: g.ln || 0 });
        R.cpu = !!g.cpu; R.remote = !(R.cpu && this.isHost); R.human = !g.cpu;
        if (R.human) R.plate = this._plate(R);
        return R;
      });
    }
    const others = KARTS.filter(k => k.id !== G.kart && !k.secret); // cada rival en un kart distinto (y distinto del tuyo)
    if (!opts.online) for (let k = 0; k < n; k++) { const h = pool[k % pool.length], D = DRIVERS.find(d => d.id === h); grid.push(new Racer(this, { id: 'cpu' + k, name: D.name, color: COLORS[(k + 1) % COLORS.length], kartId: others[k % others.length].id, paint: null, trail: ['fuego', 'hielo', 'veneno', 'dorada'][k % 4], look: driverLook(sv, h), skill: level * (0.94 + 0.08 * (k / Math.max(1, n - 1))), lane: ((k % 3) - 1) * 0.45 })); }
    // la jugadora sale desde el medio de la parrilla
    if (!opts.online) grid.splice(Math.min(grid.length, Math.floor(n * 0.6)), 0, me);
    this.racers = grid; this.me = me;
    const T = this.track;
    grid.forEach((R, k) => {
      const row = Math.floor(k / 2), col = k % 2 ? 1 : -1;
      const i = (T.N - 6 - row * 13) % T.N, c = T.c[i], r = T.r[i], t = T.t[i];
      R.pos.set(c.x + r.x * col * 2.6, c.y, c.z + r.z * col * 2.6); R.yaw = Math.atan2(t.x, t.z); R.i = i; R.lap = -1; R.half = true; R.dist = T.d[i];
      // caja de salida pintada en la pista, con su número
      const box = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 3.6), new THREE.MeshBasicMaterial({ map: gridTex(k + 1), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }));
      box.rotation.set(-Math.PI / 2, 0, R.yaw + Math.PI); box.position.set(R.pos.x - Math.sin(R.yaw) * 0.2, c.y + 0.03, R.pos.z - Math.cos(R.yaw) * 0.2); this.root.add(box);
    });
    this.gridMid = T.c[(T.N - 6 - Math.floor((grid.length - 1) / 2) * 13) % T.N].clone();
    this.items = new RaceItems(this);
    // salida: presentación de la parrilla, semáforo de cinco luces y ¡fuera! (en línea, la misma espera para todos)
    this.phase = 'count'; this.st = 0; this.t = 1; this.track.setLights(0);
    this.hold = 0.5 + ((opts.ep || Math.floor(Math.random() * 1e6)) % 700) / 1000; this._pairT = {}; this.clock = 0; this.results = []; this._lastCount = null;
    this.camPos = null; this.lookBack = false;
    this._hud(true); this._engine(true);
    document.body.classList.toggle('netrace', !!this.net); this._chatClose();
    if (this.net) { $('chatLog').innerHTML = ''; $('chatBtn').classList.remove('hidden'); $('chatBtn').textContent = this.ctx.input.isTouch ? '💬' : '💬 Chat (T)'; }
    C.music.play('arena', { fade: 1.2 });
    this.place(); this._sync(0.016);
  }

  // ---------- un paso ----------
  update(dt) {
    if (!this.active || (this.paused && !this.net)) return; // en línea la carrera sigue aunque abras la pausa
    const C = this.ctx;
    if (this.phase === 'count') {
      this.st += dt;
      // fuera de línea, acelerar o pulsar salta la presentación
      if (!this.net && this.st < INTRO - 0.8 && this.st > 0.6 && (C.input.pressed('jump') || C.input.pressed('attack') || C.input.pressed('interact') || C.input.keys.KeyW || C.input.keys.ArrowUp)) this.st = INTRO - 0.8;
      const L = this.st < INTRO ? 0 : Math.min(5, Math.floor((this.st - INTRO) / 0.75) + 1);
      if (L !== this._lastCount) { this._lastCount = L; this.track.setLights(L); this._hudLights(L); if (L > 0) C.audio.play('beep'); }
      if (this.st >= INTRO + 5 * 0.75 + this.hold) { // ¡se apagan las luces!
        this.phase = 'race'; this.track.setLights(0); this._hudLights(-1); this._flash('¡FUERA!', '#7affa0'); C.audio.play('go'); C.input.rumble(160, 0.6);
      }
    } else this.clock += dt;
    const go = this.phase === 'race' || this.phase === 'end';
    if (this.net) this._netTick(dt);
    for (const R of this.racers) {
      if (R.remote) { this._remoteTick(R, dt); continue; }
      const ctl = R.you && !R.done ? this._myControls() : this._cpu(R, dt);
      if (!go) { if (R.you) this._revs = this._myControls().throttle; ctl.throttle = 0; ctl.brake = 0; ctl.drift = false; ctl.steer = 0; ctl.use = false; R.v = 0; } // quietos en su caja hasta que se apaguen las luces
      if (R.you && ctl.use && this.phase === 'race') this.items.use(R, ctl.back);
      this._drive(R, ctl, dt);
    }
    this.items.update(dt, this.clock + this.t);
    this._collide(dt);
    for (const R of this.racers) if (!R.remote) this._laps(R);
    this.place();
    this._sync(dt);
    this._camera(dt);
    this._hudTick(dt);
    this._engineTick(dt);
    if (this.phase === 'end' && (this.endT -= dt) <= 0 && !this.shown) { try { this._showEnd(); } catch (e) { console.warn('final', e); $('raceEnd').classList.remove('hidden'); } }
    if (this.me.done && this.phase !== 'end' && !this.shown) this._finish(); // terminó pero no se cambió de fase
    if (this.shown && this.net && (this._listT = (this._listT || 0) - dt) <= 0) { this._listT = 0.5; this._endList(); } // en línea: la tabla se completa a medida que llegan
  }

  _myControls() {
    const I = this.ctx.input, k = I.keys, touch = I.isTouch && !I.usingGamepad;
    const steer = -clamp(I.move.x, -1, 1); // el giro positivo del kart va hacia la izquierda de la cámara
    const throttle = touch ? (this.tBrake ? 0 : 1) : ((k.KeyW || k.ArrowUp || I._padJump || I.move.y > 0.35) ? 1 : 0);
    const brake = (k.KeyS || k.ArrowDown || I._padDodge || this.tBrake || (!touch && I.move.y < -0.5)) ? 1 : 0;
    const drift = !!(k.Space || k.ShiftLeft || k.ShiftRight || I._padShield || this.tDrift);
    this.lookBack = !!(k.KeyC || k.KeyQ);
    const use = I.pressed('attack') || I.pressed('interact') || I.pressed('grapple') || this.tUseP; this.tUseP = false;
    const back = !!(k.KeyS || k.ArrowDown || I._padDodge || this.tBrake || I.move.y < -0.5);
    return { steer, throttle, brake: use && back ? 0 : brake, drift, use, back };
  }
  // la CPU: mira un punto más adelante en su carril y gira hacia él
  _cpu(R, dt) {
    const T = this.track, N = T.N;
    if (R.done) { // ya terminó: vuelta de honor tranquila
      R.skillNow = 0.55;
    } else {
      // goma elástica suave: quien va muy atrás de la jugadora acelera un poco, quien va muy adelante afloja
      const gap = (this.me.progress - R.progress) / T.L;
      R.skillNow = R.skill * clamp(1 + gap * 0.22, 0.9, 1.1);
    }
    R.laneT = (R.laneT || 0) - dt;
    if (R.laneT <= 0) { R.laneT = 2 + Math.random() * 3; R.laneW = clamp((R.lane || 0) + (Math.random() - 0.5) * 0.5, -0.6, 0.6); }
    R.laneNow = (R.laneNow ?? R.lane) + ((R.laneW ?? R.lane) - (R.laneNow ?? R.lane)) * damp(0.8, dt);
    const ahead = Math.round(9 + R.v * 0.45);
    const j = (R.i + ahead) % N, c = T.c[j], r = T.r[j];
    // en las curvas cerradas, va por dentro
    const bend = angD(Math.atan2(T.t[(j + 20) % N].x, T.t[(j + 20) % N].z), Math.atan2(T.t[j].x, T.t[j].z));
    const lane = clamp(R.laneNow + bend * 0.9, -0.7, 0.7) * T.hw;
    const tx = c.x + r.x * lane, tz = c.z + r.z * lane;
    const want = Math.atan2(tx - R.pos.x, tz - R.pos.z), e = angD(want, R.yaw);
    const sharp = Math.abs(bend) > 0.55 && R.v > MAXV * 0.8;
    return { steer: clamp(e * 2.6, -1, 1), throttle: sharp ? 0.6 : 1, brake: 0, drift: Math.abs(bend) > 0.35 && R.v > 16 && !R.done };
  }
  _drive(R, ctl, dt) {
    const T = this.track;
    if (R.spin > 0) { // le dieron: da vueltas y casi se para
      R.spin -= dt; R.spinA += dt * 14 * clamp(R.spin, 0.2, 1); ctl = { steer: 0, throttle: 0, brake: 0, drift: false };
      R.v -= R.v * damp(3, dt); R.drift = 0;
    } else R.spinA = 0;
    const M = R.mods; const top = MAXV * M.vel * (R.you ? 1 : R.skillNow || R.skill) * (R.boostT > 0 ? 1.42 : 1) * (R.bump > 0 ? 0.7 : 1);
    if (ctl.brake && R.v > 0.5) R.v -= BRAKE * dt;
    else if (ctl.brake) R.v = Math.max(-8, R.v - ACC * 0.6 * dt); // marcha atrás
    else if (ctl.throttle) R.v += (R.v < top ? ACC * M.acc * (R.boostT > 0 ? 1.8 : 1) * (1 - R.v / (top * 1.15)) * 1.6 : -ACC * 0.8) * dt * ctl.throttle;
    else R.v -= Math.sign(R.v) * Math.min(Math.abs(R.v), 6 * dt);
    if (R.v > top + 0.1) R.v -= (R.v - top) * damp(2.5, dt);
    // derrape: gira más, carga el turbo; al soltar, sale disparado
    const canDrift = ctl.drift && R.v > 11 && Math.abs(ctl.steer) > 0.2;
    if (canDrift && !R.drift) { R.drift = Math.sign(ctl.steer); R.charge = 0; if (R.you) this.ctx.audio.play('dodge'); }
    if (R.drift && (!ctl.drift || R.v < 8)) {
      if (R.charge > 0.9) { R.boostT = Math.max(R.boostT, (R.charge > 1.8 ? 1.25 : 0.75) * M.boost); R.v = Math.max(R.v, MAXV * 1.05); if (R.you) { this.ctx.audio.play('dash'); this.ctx.input.rumble(140, 0.5); } }
      R.drift = 0; R.charge = 0;
    }
    const grip = this.def.grip || 1; let turn = ctl.steer * TURN * M.giro * grip * clamp(Math.abs(R.v) / 9, 0, 1) * (R.v < 0 ? -1 : 1) * (1 - clamp(R.v / 60, 0, 0.3));
    if (R.drift) { turn = (R.drift * 0.65 + ctl.steer * 0.55) * TURN * M.giro * 1.25; R.charge += dt * (0.8 + Math.abs(ctl.steer) * 0.6) * M.charge * (this.def.slide ? 1.2 : 1); }
    R.yaw += turn * dt;
    R.slip += ((R.drift ? R.drift * 0.38 : ctl.steer * 0.08 * (this.def.slide || 1) * clamp(R.v / MAXV, 0, 1)) - R.slip) * damp(6 / (this.def.slide || 1), dt);
    const dir = R.yaw - R.slip * 0.6;
    R.pos.x += Math.sin(dir) * R.v * dt; R.pos.z += Math.cos(dir) * R.v * dt;
    R.boostT -= dt; R.bump -= dt;
    // placas de impulso
    for (const B of T.boosts) {
      const dd = Math.abs(((T.d[R.i] - B.d + T.L * 1.5) % T.L) - T.L / 2);
      if (dd < 3.2 && Math.abs(R.lat - B.lat) < 2.1 && R.boostT < 0.9) { R.boostT = 1.1; R.v = Math.max(R.v, MAXV * 1.15); if (R.you) { this.ctx.audio.play('dash'); this.ctx.input.rumble(120, 0.4); } }
    }
    // pegado a la pista
    R.i = T.near(R.pos, R.i);
    const F = T.frame(R.pos, R.i); R.lat = F.lat; R.dist = F.dist;
    const lim = T.hw - 1.0;
    if (Math.abs(F.lat) > lim) { // choca con la barandilla: rebota hacia dentro
      const sg = Math.sign(F.lat), r = T.r[R.i], push = Math.abs(F.lat) - lim;
      R.pos.x -= r.x * sg * push; R.pos.z -= r.z * sg * push;
      const ty = Math.atan2(T.t[R.i].x, T.t[R.i].z), d = angD(R.yaw, ty);
      if (Math.abs(d) > 0.12 && Math.sign(d) === sg * -1 || Math.abs(d) > 0.12) R.yaw -= d * 0.35;
      if (R.v > 10 && (R.wallT || 0) <= 0) { R.v *= 0.72; R.wallT = 0.4; if (R.you) { this.ctx.audio.play('block'); this.ctx.input.rumble(90, 0.4); } }
      R.lat = sg * lim;
    }
    R.wallT = (R.wallT || 0) - dt;
    const gy = F.y; R.pitch = Math.atan2(T.t[R.i].y, Math.hypot(T.t[R.i].x, T.t[R.i].z));
    R.pos.y = gy;
  }
  _collide() {
    const L = this.racers;
    for (let a = 0; a < L.length; a++) for (let b = a + 1; b < L.length; b++) {
      const A = L[a], B = L[b], dx = B.pos.x - A.pos.x, dz = B.pos.z - A.pos.z, d = Math.hypot(dx, dz);
      if (d > 0 && d < 2.1 && Math.abs(A.pos.y - B.pos.y) < 1.5) {
        if (A.remote && B.remote) continue;
        const nx = dx / d, nz = dz / d, pa = A.remote ? 0 : B.remote ? (2.1 - d) : (2.1 - d) / 2, pb = B.remote ? 0 : A.remote ? (2.1 - d) : (2.1 - d) / 2;
        A.pos.x -= nx * pa; A.pos.z -= nz * pa; B.pos.x += nx * pb; B.pos.z += nz * pb;
        const key = A.id + B.id, now = this.clock;
        if (!this._pairT[key] || now - this._pairT[key] > 0.6) { // golpe: el de atrás pierde un poco, el de adelante recibe un empujón
          const back = (A.progress < B.progress) ? A : B, front = back === A ? B : A;
          back.v *= 0.9; front.v = Math.min(front.v + 1.5, MAXV * 1.1);
          if (A.you || B.you) { this.ctx.audio.play('land'); this.ctx.input.rumble(70, 0.3); }
        }
        this._pairT[key] = now;
      }
    }
  }
  _laps(R) {
    const T = this.track, f = R.dist / T.L;
    if (f > 0.4 && f < 0.6) R.half = true;
    if (R.prevF != null && R.prevF > 0.85 && f < 0.15 && R.half) { // cruzó la meta
      R.lap++; R.half = false;
      if (R.lap >= 1 && this.phase !== 'count') {
        const lt = this.clock - (R.lapStart || 0); R.lapStart = this.clock; if (!R.best || lt < R.best) R.best = lt;
      } else R.lapStart = this.clock;
      if (R.lap >= this.laps && !R.done) {
        R.done = true; R.time = this.clock; this.results.push(R);
        if (R.you) this._finish();
      } else if (R.you && R.lap >= 1) {
        this._flash(R.lap === this.laps - 1 ? '¡ÚLTIMA VUELTA!' : `Vuelta ${R.lap + 1} / ${this.laps}`, '#ffffff');
        this.ctx.audio.play('checkpoint');
      }
    }
    if (R.prevF != null && R.prevF < 0.15 && f > 0.85 && R.lap >= 0 && this.phase === 'race' && R.v < -0.5) { R.lap--; R.half = true; } // marcha atrás por la meta
    R.prevF = f;
  }
  place() {
    const order = [...this.racers].sort((a, b) => {
      if (a.done && b.done) return a.time - b.time; if (a.done) return -1; if (b.done) return 1;
      return b.progress - a.progress;
    });
    order.forEach((R, k) => { R.place = k + 1; });
    this.order = order;
  }
  _finish() {
    const C = this.ctx;
    this.phase = 'end'; this.endT = 3.2; this._hudLights(-1); this.track.setLights(0);
    const p = this.me.place;
    this._flash(p === 1 ? '¡GANASTE!' : `¡Meta! Llegaste ${p}.º`, p === 1 ? '#ffd27a' : '#ffffff');
    C.audio.play(p <= 3 ? 'unlock' : 'checkpoint');
  }
  _showEnd() {
    const C = this.ctx; this.shown = true;
    // los que faltan llegan con el tiempo estimado
    if (!this.net) for (const R of this.order) if (!R.done) { R.done = true; R.time = this.clock + (this.laps * this.track.L - R.progress) / Math.max(10, MAXV * (R.skill || 0.9)); this.results.push(R); }
    this.place();
    const p = this.me.place, rew = (this.def.reward[p - 1] || 5) * (this.laps === 5 ? 2 : 1);
    // primero la pantalla final (pase lo que pase con el guardado, siempre se puede salir)
    $('raceEndTitle').textContent = p === 1 ? '🏆 ¡Primer lugar!' : p <= 3 ? `🏅 ¡Podio! ${p}.º lugar` : `${p}.º lugar`;
    $('raceEndSub').textContent = `${this.def.name} · ${this.laps} vueltas · +${rew} Ecos`;
    try { this._endList(); } catch (e) { console.warn('tabla final', e); }
    $('bRaceAgain').textContent = this.net ? '🌐 Volver a la sala' : '🔁 Repetir carrera';
    $('raceEnd').classList.remove('hidden'); $('racePause').classList.add('hidden');
    try {
      C.addEcos(rew);
      const sv = C.getSave();
      if (sv) {
        sv.race = sv.race || {}; const key = this.opts.track + '_' + this.laps;
        const prev = sv.race[key];
        if (!prev || this.me.time < prev.time) sv.race[key] = { time: this.me.time, place: p };
        const r = sv.race, t = this.opts.track;
        r.races = (r.races || 0) + 1;
        if (p <= 3) { r.podiums = (r.podiums || 0) + 1; (r.podiumAt = r.podiumAt || {})[t] = true; }
        if (p === 1) { r.wins = (r.wins || 0) + 1; (r.wonAt = r.wonAt || {})[t] = true; if (this.laps === 5) r.won5 = (r.won5 || 0) + 1; }
        this.newUnlocks = this.ctx.unlocksAfter ? this.ctx.unlocksAfter() : [];
        if (this.newUnlocks.length) { $('raceEndSub').innerHTML += `<div class="raceUnl">🔓 ¡Desbloqueaste ${this.newUnlocks.map(u => u.name).join(', ')}!</div>`; C.audio.play('unlock'); }
        C.save && C.save();
      }
    } catch (e) { console.warn('No se pudo guardar el resultado de la carrera', e); }
  }
  _endList() {
    const fmt = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;
    this.place();
    $('raceEndList').innerHTML = this.order.map(R => `<li class="${R.you ? 'me' : ''}"><b>${R.place}.º</b> <span>${R.human ? '🌐 ' : ''}${R.name.replace(/[<>&]/g, '')}</span> <em>${R.done ? fmt(R.time) : R.gone ? 'se fue' : 'en carrera…'}</em></li>`).join('');
  }

  // ---------- en línea ----------
  // estado de un kart en una lista corta: posición, giro, velocidad, vuelta, distancia, banderas y tiempo
  _pack(R) {
    const f = (R.drift > 0 ? 1 : 0) | (R.drift < 0 ? 2 : 0) | (R.boostT > 0 ? 4 : 0) | (R.spin > 0 ? 8 : 0) | (R.shieldT > 0 ? 16 : 0) | (R.done ? 32 : 0);
    const r2 = v => Math.round(v * 100) / 100;
    return [r2(R.pos.x), r2(R.pos.y), r2(R.pos.z), r2(R.yaw), r2(R.v), R.lap, r2(R.dist), f, R.done ? r2(R.time) : 0];
  }
  _unpack(R, a) {
    if (!Array.isArray(a) || a.length < 9) return;
    R.net = { x: +a[0], y: +a[1], z: +a[2], yaw: +a[3] }; R.v = +a[4] || 0; R.lap = a[5] | 0; R.dist = +a[6] || 0;
    const f = a[7] | 0; R.drift = f & 1 ? 1 : f & 2 ? -1 : 0; R.boostT = f & 4 ? 0.3 : 0; R.spin = f & 8 ? 0.5 : 0; R.shieldT = f & 16 ? 1 : 0;
    if (f & 32 && !R.done) { R.done = true; R.time = +a[8] || this.clock; this.results.push(R); }
    R.seenT = this.clock;
  }
  _netTick(dt) {
    const N = this.net, sv = this.ctx.getSave() || {};
    const pres = { n: (sv.name || 'Jugador').slice(0, 16), s: 'race', ep: this.ep, r: this._pack(this.me) };
    if (this.isHost) pres.c = this.racers.filter(R => R.cpu).map(R => [R.id, ...this._pack(R)]);
    N.set(pres); N.tick(dt);
    const peers = N.others(), byId = new Map(peers.map(p => [p.id, p.pres || {}]));
    for (const R of this.racers) {
      if (!R.remote) continue;
      if (R.human) { const P = byId.get(R.id); if (P && P.s === 'race' && P.ep === this.ep) this._unpack(R, P.r); else if (!P && !R.gone && this.clock - (R.seenT || 0) > 4) this._gone(R); }
    }
    // la CPU la mueve el anfitrión
    const host = peers.find(p => p.pres && p.pres.ep === this.ep && Array.isArray(p.pres.c));
    if (host) for (const c of host.pres.c) { const R = this.racers.find(x => x.id === c[0] && x.cpu && x.remote); if (R) this._unpack(R, c.slice(1)); }
  }
  _gone(R) { R.gone = true; R.root.visible = false; R.shadow.visible = false; this._chatAdd('', '', `${R.name} se fue de la carrera`, true); }
  _remoteTick(R, dt) {
    if (R.gone) return;
    if (!R.net) return;
    const T = this.track, t = R.net, k = 1 - Math.exp(-12 * dt);
    if (Math.hypot(t.x - R.pos.x, t.z - R.pos.z) > 9) R.pos.set(t.x, t.y, t.z);
    else { R.pos.x += (t.x - R.pos.x) * k + Math.sin(R.yaw) * R.v * dt * 0.5; R.pos.z += (t.z - R.pos.z) * k + Math.cos(R.yaw) * R.v * dt * 0.5; R.pos.y += (t.y - R.pos.y) * k; }
    R.yaw += angD(t.yaw, R.yaw) * k;
    R.i = T.near(R.pos, R.i); R.pitch = Math.atan2(T.t[R.i].y, Math.hypot(T.t[R.i].x, T.t[R.i].z));
    R.slip += ((R.drift ? R.drift * 0.38 : 0) - R.slip) * damp(6, dt);
    R.charge = R.drift ? (R.charge || 0) + dt : 0;
    R.spinA = R.spin > 0 ? R.spinA + dt * 12 : 0;
  }
  // sucesos de la red: disparos, explosiones y golpes (quien dispara decide si acierta)
  onNet(from, ev) {
    if (!this.active || !ev || ev.ep !== this.ep) return;
    const owner = id => this.racers.find(R => R.id === id);
    if (ev.t === 'shot') this.items.remoteShot(ev, owner(ev.o));
    else if (ev.t === 'boom') this.items.remoteBoom(ev);
    else if (ev.t === 'hit') { const V = owner(ev.v); if (V && !V.remote) this.items.hit(V, owner(ev.o), true); }
  }
  _plate(R) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const c = cv.getContext('2d');
    c.font = 'bold 30px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const w = Math.min(250, c.measureText(R.name).width + 30); c.fillStyle = 'rgba(10,16,40,.65)'; c.beginPath(); c.roundRect((256 - w) / 2, 8, w, 46, 23); c.fill();
    c.fillStyle = '#9fe3ff'; c.fillText(R.name, 128, 32);
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, depthTest: false, transparent: true })); sp.scale.set(2.2, 0.55, 1); sp.position.y = 2.4; sp.renderOrder = 10;
    R.root.add(sp); return sp;
  }
  // ---------- chat (el mismo cuadro que la Arena y el mundo) ----------
  _chatAdd(name, color, text, sys = false) {
    const box = $('chatLog'); if (!box) return; const el = document.createElement('div');
    if (sys) { el.className = 'sys'; el.textContent = text; } else { const b = document.createElement('b'); b.textContent = name + ':'; b.style.color = color; el.append(b, document.createTextNode(String(text).replace(BADW, w => '*'.repeat(w.length)))); }
    box.appendChild(el); while (box.children.length > 30) box.firstChild.remove(); setTimeout(() => el.classList.add('old'), 9000);
  }
  sendChat(text) {
    if (!this.net) return; const now = performance.now(); if (now - (this._chatT || 0) < 900) return;
    const m = this.net.chat(String(text).replace(BADW, w => '*'.repeat(w.length))); if (m) { this._chatT = now; this._chatAdd(this.me.name, '#ffd27a', m); }
  }
  _chatOpen() {
    if (!this.net) return; $('chatBox').classList.add('open'); this.chatOpenNow = true; this.ctx.input.keys = {};
    const inp = $('chatInput'); inp.value = ''; setTimeout(() => inp.focus(), 10);
    const q = $('chatQuick'); q.innerHTML = ''; for (const t of ['¡Suerte! 🍀', '¡Allá voy! 🏎', '¡GG!', '¡Revancha!', '😂', '🔥']) { const b = document.createElement('button'); b.textContent = t; b.onclick = () => { this.sendChat(t); this._chatClose(); }; q.appendChild(b); }
  }
  _chatClose() { const box = $('chatBox'); if (box) box.classList.remove('open'); this.chatOpenNow = false; const inp = $('chatInput'); if (inp) inp.blur(); }

  // ---------- dibujo ----------
  _sync(dt) {
    const T = this.track;
    for (const R of this.racers) {
      R.root.position.copy(R.pos);
      R.root.rotation.set(0, R.yaw, 0);
      R.body.rotation.set(-R.pitch, 0, 0); R.body.position.y = R.spin > 0 ? Math.abs(Math.sin(R.spin * 5)) * 0.5 : 0;
      const cp = this.ctx.camera.position, near = !R.you && Math.hypot(cp.x - R.pos.x, cp.z - R.pos.z) < 4.2 && cp.y > R.pos.y; // no tapar la cámara con el kart que viene pegado detrás
      R.root.visible = !near && !(R.inv > 0 && R.spin <= 0 && Math.sin(this.clock * 30) > 0.3);
      R.wob += dt * (8 + R.v * 0.6);
      R.kart.rotation.set(Math.sin(R.wob) * 0.008 * clamp(R.v / 10, 0, 1), R.slip * 0.9 + R.spinA, -R.slip * 0.25 - (R.drift ? R.drift * 0.08 : 0));
      if (R.kart.userData.wheels) for (const w of R.kart.userData.wheels) { w.children[0].rotation.x += R.v * dt / 0.34; if (w.userData.front) w.rotation.y = (R.steerVis || 0) * 0.4; }
      R.steerVis = (R.steerVis || 0) + ((R.drift ? R.drift : clamp(R.yawRate || 0, -1, 1)) - (R.steerVis || 0)) * damp(10, dt);
      R.yawRate = angD(R.yaw, R.prevYaw ?? R.yaw) / Math.max(dt, 1e-3) / TURN; R.prevYaw = R.yaw;
      if (R.kart.userData.wheel) R.kart.userData.wheel.rotation.z = -(R.steerVis || 0) * 0.8;
      if (R.ch) { // el piloto se inclina en las curvas
        R.ch.root.rotation.set(0, Math.PI + R.slip * 0.4 + R.spinA, -(R.steerVis || 0) * 0.18);
        const b = R.ch.bones; if (b.head) b.head.rotation.y = -(R.steerVis || 0) * 0.25;
      }
      R.shadow.position.set(R.pos.x, R.pos.y + 0.05, R.pos.z); R.shadow.rotation.z = -R.yaw;
      if (R.rainbow) R.flameMat.color.setHSL((this.clock * 1.5) % 1, 1, 0.6);
      const fl = R.boostT > 0 ? 0.9 : 0; R.flameMat.opacity += (fl - R.flameMat.opacity) * damp(12, dt);
      const fs = (R.parts && R.parts.flame) || 1; for (const f of R.flames) f.scale.set(fs * 0.9 + 0.1, (0.7 + Math.random() * 0.6 + fl) * fs, fs * 0.9 + 0.1);
      const lv = R.charge > 1.8 ? 2 : R.charge > 0.9 ? 1 : 0;
      R.sparkMat.color.setHex(lv === 2 ? 0xff8a30 : lv === 1 ? ((R.parts && R.parts.spark) || 0x6ad0ff) : 0xffffff);
      R.sparkMat.opacity = R.drift ? (lv ? 0.95 : 0.45) * (0.6 + Math.random() * 0.4) : 0;
      for (const s of R.sparks) { s.scale.setScalar(0.6 + Math.random() * (lv + 0.5) * 0.6); s.rotation.set(Math.random() * 6, Math.random() * 6, 0); }
    }
    for (const B of T.boosts) B.mat.map.offset.y -= dt * 2.2;
    // la heroína (invisible) sigue al kart: así la sombra y el sonido van con la cámara
    const P = this.ctx.player; P.pos.copy(this.me.pos);
  }
  _camera(dt) {
    const C = this.ctx, cam = C.camera, R = this.me;
    const back = this.lookBack ? -1 : 1, dist = 7.2 + clamp(R.v / MAXV, 0, 1.4) * 1.6, h = 3.3;
    const yaw = R.yaw - R.slip * 0.5;
    const want = new THREE.Vector3(R.pos.x - Math.sin(yaw) * dist * back, R.pos.y + h, R.pos.z - Math.cos(yaw) * dist * back);
    const look = new THREE.Vector3(R.pos.x + Math.sin(yaw) * 4 * back, R.pos.y + 1.1, R.pos.z + Math.cos(yaw) * 4 * back);
    if (this.phase === 'count' && this.st < INTRO + 0.6) {
      // presentación: cámara de frente a la parrilla que barre de un lado a otro, y luego se pasa detrás de tu kart
      const T = this.track, N = T.N, rows = Math.ceil(this.racers.length / 2), u = clamp(this.st / (INTRO - 1), 0, 1), ue = u * u * (3 - 2 * u);
      // la cámara recorre la parrilla de adelante hacia atrás, mirando a los karts de frente
      const iA = N - 6 + 12, iB = N - 6 - (rows - 1) * 13 + 2, fi = iA + (iB - iA) * ue, ci = ((Math.round(fi) % N) + N) % N, li = ((Math.round(Math.max(fi - 11, N - 6 - (rows - 1) * 13 - 2)) % N) + N) % N;
      const c = T.c[ci], r = T.r[ci], sw = Math.sin(u * Math.PI * 1.5) * 0.55;
      const front = new THREE.Vector3(c.x + r.x * T.hw * sw, c.y + 2.0 + Math.sin(u * Math.PI) * 0.8, c.z + r.z * T.hw * sw);
      const mid = T.c[li].clone().setY(T.c[li].y + 0.7);
      const k = clamp((this.st - (INTRO - 1.2)) / 1.6, 0, 1), e = k * k * (3 - 2 * k);
      cam.position.copy(front.lerp(want, e)); cam.lookAt(mid.lerp(look, e));
      this.camPos = cam.position.clone();
    } else {
      if (!this.camPos) this.camPos = want.clone();
      this.camPos.lerp(want, damp(this.lookBack ? 30 : 7, dt));
      cam.position.copy(this.camPos);
      cam.lookAt(look);
    }
    const fov = 64 + clamp(R.v / MAXV, 0, 1.4) * 10 + (R.boostT > 0 ? 6 : 0);
    cam.fov += (fov - cam.fov) * damp(4, dt); cam.updateProjectionMatrix();
    this.fov = cam.fov;
  }

  // ---------- interfaz ----------
  _hud(on) {
    document.body.classList.toggle('racing', on);
    $('raceHud').classList.toggle('hidden', !on);
    $('raceEnd').classList.add('hidden'); $('racePause').classList.add('hidden');
    if (on && !this._wired) {
      this._wired = true;
      const hold = (id, key) => {
        const el = $(id);
        el.addEventListener('touchstart', e => { e.preventDefault(); this[key] = true; el.classList.add('on'); }, { passive: false });
        const up = e => { e.preventDefault(); this[key] = false; el.classList.remove('on'); };
        el.addEventListener('touchend', up, { passive: false }); el.addEventListener('touchcancel', up, { passive: false });
        el.addEventListener('mousedown', () => { this[key] = true; }); addEventListener('mouseup', () => { this[key] = false; });
      };
      hold('rtDrift', 'tDrift'); hold('rtBrake', 'tBrake');
      const u = $('rtUse'); const fire = e => { e.preventDefault(); this.tUseP = true; u.classList.add('on'); setTimeout(() => u.classList.remove('on'), 120); };
      u.addEventListener('touchstart', fire, { passive: false }); u.addEventListener('mousedown', fire);
    }
    this.tDrift = this.tBrake = false;
    const tip = this.ctx.input.isTouch ? 'Acelera solo · palanca: girar · DERRAPE en curvas · toca el objeto para usarlo (con FRENO, hacia atrás)' : 'W/↑ acelerar · S/↓ frenar · A/D girar · Espacio: derrape · E/J: usar objeto (con S, hacia atrás) · C: mirar atrás';
    $('raceTip').textContent = tip; $('raceTip').classList.remove('fade'); this._itemKey = null;
  }
  _hudTick() {
    const R = this.me, n = this.racers.length;
    const fmt = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
    $('racePlace').innerHTML = `${R.place}<small>.º/${n}</small>`;
    $('raceLap').textContent = `Vuelta ${clamp(R.lap + 1, 1, this.laps)}/${this.laps}`;
    $('raceTime').textContent = fmt(this.clock);
    const kmh = Math.round(Math.abs(R.v) * 4.2);
    $('raceSpeed').innerHTML = `${kmh}<small> km/h</small>`;
    const lv = R.drift ? (R.charge > 1.8 ? 2 : R.charge > 0.9 ? 1 : 0) : -1;
    $('raceTurbo').className = lv < 0 ? '' : 'lv' + lv;
    $('raceTurbo').textContent = lv === 2 ? '🔥 SUPER TURBO' : lv === 1 ? '⚡ TURBO' : lv === 0 ? 'derrapando…' : '';
    // mini clasificación
    $('raceBoard').innerHTML = this.order.slice(0, 8).map(o => `<div class="${o.you ? 'me' : ''}"><b>${o.place}</b> <i style="background:#${o.color.toString(16).padStart(6, '0')}"></i>${o.name.replace(/[<>&]/g, '').slice(0, 12)}</div>`).join('');
    if (this.phase === 'race' && this.clock > 7) $('raceTip').classList.add('fade');
    const el = $('raceItem'), id = R.roll > 0 ? Object.keys(ITEMS)[Math.floor(this.clock * 14) % 6] : R.item;
    const txt = id ? ITEMS[id].icon : '', key = (R.roll > 0 ? 'r' : '') + txt + (R.uses || 0);
    if (key !== this._itemKey) { this._itemKey = key; el.innerHTML = id ? `<span>${R.item === 'nitro3' && R.roll <= 0 ? '🔥'.repeat(R.uses) : txt}</span><small>${R.roll > 0 ? '…' : ITEMS[id].name}</small>` : '<small>Caja ?</small>'; el.classList.toggle('full', !!id && R.roll <= 0); }
  }
  _hudLights(n) {
    const el = $('raceLights'); if (!el) return;
    el.classList.toggle('hidden', n < 0 || (n === 0 && this.st < INTRO - 0.2));
    [...el.children].forEach((d, k) => d.classList.toggle('on', k < n));
  }
  _flash(text, color) { const el = $('raceMsg'); el.textContent = text; el.style.color = color; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }

  // ---------- motor (sonido continuo) ----------
  _engine(on) {
    const A = this.ctx.audio, c = A.ctx;
    if (this.eng) { try { this.eng.o1.stop(); this.eng.o2.stop(); this.eng.g.disconnect(); } catch (e) {} this.eng = null; }
    if (!on || !c) return;
    const o1 = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o1.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 700; g.gain.value = 0;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(c.destination); o1.start(); o2.start();
    this.eng = { o1, o2, f, g };
  }
  _engineTick() {
    if (!this.eng) return; const A = this.ctx.audio, c = A.ctx, R = this.me, k = clamp(Math.abs(R.v) / MAXV, 0, 1.5);
    const rev = this.phase === 'count' ? (this._revs ? 0.55 + Math.random() * 0.15 : 0.08) : k;
    const f = (48 + rev * 95 + (R.boostT > 0 ? 25 : 0)) * ((R.parts && R.parts.sound) || 1);
    this.eng.o1.frequency.setTargetAtTime(f, c.currentTime, 0.05); this.eng.o2.frequency.setTargetAtTime(f * 0.5, c.currentTime, 0.05);
    this.eng.f.frequency.setTargetAtTime(500 + rev * 1400, c.currentTime, 0.08);
    const vol = this.paused ? 0 : (0.022 + rev * 0.03) * (A.volume ?? 0.7);
    this.eng.g.gain.setTargetAtTime(vol, c.currentTime, 0.08);
  }

  togglePause() {
    if (!this.active || this.phase === 'end' && this.shown) return;
    this.paused = !this.paused; $('racePause').classList.toggle('hidden', !this.paused); $('bRaceRestart').classList.toggle('hidden', !!this.net); this._engineTick();
  }
  again() { const o = this.opts; this.exit(true); this.start(o); }
  exit(keep) {
    const C = this.ctx;
    this.active = false; this._engine(false);
    for (const R of this.racers) R.remove();
    this.racers = [];
    if (this.root) { C.scene.remove(this.root); this.root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); this.root = null; }
    if (!keep) this._hud(false); this._hudLights(-1);
    document.body.classList.remove('netrace'); this._chatClose();
    if (this.net) $('chatBtn').classList.add('hidden');
    this.net = null;
  }
}
