import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HD, rigGenerated, setSkeletonClone, genClips, HD_CHARS } from './hd.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// Personajes con malla y esqueleto reales (KayKit Adventurers, CC0, de Kay Lousberg)
// y animaciones compartidas en un solo archivo (assets/characters/anims.glb).

const BASE = 'assets/characters/';
const MODELS = ['lia', 'kael', 'marta', 'tomas'];

export async function loadCharacterLibrary(onProgress) {
  const loader = new GLTFLoader();
  let done = 0;
  const total = MODELS.length + 1;
  // Los modelos van dentro de módulos .js (base64) para poder publicarse como página; se decodifican aquí.
  const load = async f => {
    const mod = await import(`../${BASE}${f}.glb.js`);
    const bin = Uint8Array.from(atob(mod.default), ch => ch.charCodeAt(0));
    const g = await loader.parseAsync(bin.buffer, '');
    done++; onProgress && onProgress(done / total);
    return g;
  };
  const [anims, ...models] = await Promise.all([load('anims'), ...MODELS.map(load)]);
  const lib = { clips: {}, models: {} };
  for (const c of anims.animations) lib.clips[c.name] = c;
  MODELS.forEach((m, i) => { lib.models[m] = models[i].scene; });
  if (HD.on) { // protagonista HD generada con Artlist, con el esqueleto del juego
    setSkeletonClone(SkeletonUtils.clone);
    lib.genClips = {}; lib.swap = {};
    for (const C of HD_CHARS) {
      try {
        const mod = await import(`../assets/props/${C.id}.glb.js`);
        const bin = Uint8Array.from(atob(mod.default), ch => ch.charCodeAt(0));
        const g = await loader.parseAsync(bin.buffer, '');
        const m = rigGenerated(g.scene, lib.models[C.replaces] || lib.models.lia, C.id === 'heroina' ? 'Heroina' : C.id);
        lib.models[C.id] = m; lib.genClips[C.id] = genClips(lib.clips, m.userData.hipsY); lib.swap[C.replaces] = C.id;
        if (C.id === 'tomas_hd') LOOKS.tomas.scale = 0.96; // el caballero HD a la altura de los demás
      } catch (e) { console.warn('personaje HD', C.id, e); }
    }
  }
  return lib;
}

// Recolorea la textura de paleta: cambia los tonos dentro de un rango a otro tono.
function recolor(texture, rules) {
  const img = texture.image;
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, cv.width, cv.height), px = d.data;
  const c = new THREE.Color(), hsl = {};
  for (let i = 0; i < px.length; i += 4) {
    c.setRGB(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255);
    c.getHSL(hsl);
    const deg = hsl.h * 360;
    for (const r of rules) {
      if (hsl.s >= (r.minSat ?? 0.15) && hsl.s <= (r.maxSat ?? 1) && deg >= r.from[0] && deg <= r.from[1] && hsl.l >= (r.minLight ?? 0) && hsl.l <= (r.maxLight ?? 1)) {
        const h = r.shift != null ? ((deg + r.shift) % 360 + 360) % 360 : (r.to ?? deg); // shift: gira el tono conservando las variaciones
        c.setHSL(h / 360, Math.min(1, r.setSat ?? hsl.s * (r.sat ?? 1)), Math.min(0.95, r.lightTo != null ? r.lightTo * hsl.l / r.lightRef : hsl.l * (r.light ?? 1)));
        px[i] = c.r * 255; px[i + 1] = c.g * 255; px[i + 2] = c.b * 255;
        break;
      }
    }
  }
  ctx.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.flipY = texture.flipY; t.colorSpace = texture.colorSpace; t.wrapS = texture.wrapS; t.wrapT = texture.wrapT;
  t.magFilter = texture.magFilter; t.minFilter = texture.minFilter;
  return t;
}

// Apariencia de cada personaje del juego.
export const LOOKS = {
  lia: { model: 'lia', scale: 1.0 },
  kael: { model: 'kael', scale: 1.04, recolor: [{ from: [70, 185], to: 275, sat: 0.9, light: 0.85 }],
    recolorHD: [{ from: [120, 205], minSat: 0.08, to: 275, sat: 0.9, light: 0.9 }] }, // el modelo HD viste turquesa
  marta: { model: 'marta', scale: 1.06, recolor: [{ from: [230, 320], to: 215, sat: 0.9, light: 0.9 }], hat: 'captain', recolorHD: [] }, // el modelo HD ya viste de azul
  tomas: { model: 'tomas', scale: 0.78 },
  // Brasa, la herrera de Ignis: la túnica de Marta en rojo fuego, sin sombrero
  // Nerea, la buzo de Mareth: túnica turquesa
  nerea: { model: 'marta', scale: 1.0, recolor: [{ from: [230, 320], to: 178, sat: 0.95, light: 1.05 }], recolorHD: [{ from: [195, 240], minSat: 0.35, to: 178, sat: 0.95, light: 1.1 }] },
  brasa: { model: 'marta', scale: 1.02, recolor: [{ from: [230, 320], to: 14, sat: 1, light: 0.95 }], recolorHD: [{ from: [195, 240], minSat: 0.35, to: 8, sat: 1, light: 1.0 }] },
  // el eco del abuelo Ilan: figura azul pálida
  ilan: { model: 'tomas', scale: 0.98, recolor: [{ from: [0, 360], minSat: 0, to: 200, setSat: 0.35, light: 1.25 }] },
  // Vaelor: armadura gris oscura con reflejos morados, capa granate y pelo oscuro; la piel no se toca
  vaelor: { model: 'tomas', scale: 1.3, recolor: [
    { from: [0, 360], minSat: 0, maxSat: 0.12, to: 265, setSat: 0.16, light: 0.62 },   // metal gris
    { from: [340, 360], minSat: 0.35, to: 330, sat: 0.9, light: 0.55 },                 // capa roja
    { from: [0, 12], minSat: 0.45, to: 330, sat: 0.9, light: 0.55 },
    { from: [36, 60], minSat: 0.3, to: 25, sat: 0.5, light: 0.45 },                      // pelo rubio
    { from: [180, 260], minSat: 0.15, to: 270, sat: 0.9, light: 0.7 },                   // detalles azules
  ], recolorHD: [ // el caballero HD: acero azulado, detalles azules, capa roja y pelo rubio
    { from: [170, 260], minSat: 0, maxSat: 0.45, to: 265, setSat: 0.14, light: 0.62 },
    { from: [170, 260], minSat: 0.45, to: 275, sat: 0.9, light: 0.7 },
    { from: [330, 360], minSat: 0.35, maxLight: 0.46, to: 330, sat: 0.9, light: 0.55 }, // capa (la piel sonrojada es más clara)
    { from: [0, 12], minSat: 0.45, maxLight: 0.46, to: 330, sat: 0.9, light: 0.55 },
    { from: [28, 44], minSat: 0.4, minLight: 0.45, to: 22, sat: 0.4, light: 0.38 },
  ] },
};

const findBone = (root, name) => { let b = null; root.traverse(o => { if (!b && o.isBone && o.name === name) b = o; }); return b; };

// ---------- personalización de la protagonista ----------
export const CUSTOM = {
  estilos: [['lia', 'Exploradora'], ['kael', 'Encapuchada'], ['marta', 'Maga'], ['tomas', 'Caballera']],
  ropa: [['verde', 'Verde', null, 0x0f8345], ['azul', 'Azul', 70, 0x1f5fb3], ['morado', 'Morado', 120, 0x6a2fb3], ['rojo', 'Rojo', 210, 0xb32f3a], ['naranja', 'Naranja', 245, 0xc8641e], ['turquesa', 'Turquesa', 30, 0x16a39a], ['negro', 'Negro', 'negro', 0x2a2a30]],
  // pelo: [id, nombre, [tono, saturación, luz] destino o null = el del estilo, muestra]
  pelo: [['natural', 'Natural', null, 0x9b5a45], ['castano', 'Castaño', [16, 0.42, 0.4], 0x8a4f38], ['negro', 'Negro', [20, 0.12, 0.15], 0x2a2420], ['rubio', 'Rubio', [42, 0.62, 0.64], 0xd8b25a], ['pelirrojo', 'Pelirrojo', [14, 0.78, 0.45], 0xc0451e], ['blanco', 'Blanco', [30, 0.06, 0.84], 0xe6e2dc], ['rosa', 'Rosa', [330, 0.62, 0.66], 0xe07ab0], ['azul', 'Azul', [215, 0.6, 0.55], 0x4a7ad8]],
  piel: [['clara', 'Clara', 1, 0xf6c09c], ['media', 'Media', 0.86, 0xd8a07a], ['morena', 'Morena', 0.7, 0xb0784e], ['oscura', 'Oscura', 0.52, 0x7a4a2c]],
  // aura: color del nombre en la Arena y del brillo de los poderes; título: se ve bajo el nombre
  aura: [['dorado', 'Dorada', 0xffd27a], ['azul', 'Azul', 0x6ac8ff], ['violeta', 'Violeta', 0xb07aff], ['rojo', 'Roja', 0xff5a5a], ['verde', 'Verde', 0x6aff9a], ['rosa', 'Rosa', 0xff8ad0], ['blanco', 'Blanca', 0xf0f4ff]],
  titulo: [['ninguno', 'Sin título'], ['aventurera', 'Aventurera'], ['eco', 'Maestra del Eco'], ['viento', 'Domadora del Viento'], ['sombras', 'Cazadora de Sombras'], ['guardiana', 'Guardiana de Aethra'], ['fuego', 'Señora del Fuego'], ['hielo', 'Reina del Hielo'], ['arena', 'Leyenda de la Arena']],
  planeador: [['teal', 'Turquesa', 0x2f9fae], ['dorado', 'Dorado', 0xd8a83a], ['rojo', 'Rojo', 0xc8404a], ['violeta', 'Violeta', 0x8a5ad8], ['blanco', 'Blanco', 0xe8eef2]],
};
export const DEFAULT_CUSTOM = { estilo: 'lia', ropa: 'verde', pelo: 'natural', piel: 'clara', planeador: 'teal', aura: 'dorado', titulo: 'ninguno' };
export const auraOf = c => (CUSTOM.aura.find(o => o[0] === (c && c.aura)) || CUSTOM.aura[0])[2];
export const titleOf = c => { const t = CUSTOM.titulo.find(o => o[0] === (c && c.titulo)); return t && t[0] !== 'ninguno' ? t[1] : ''; };
const pick = (list, id) => list.find(o => o[0] === id) || list[0];
export function customLook(cfg = {}) {
  const c = { ...DEFAULT_CUSTOM, ...cfg }, rules = [];
  const base = LOOKS[pick(CUSTOM.estilos, c.estilo)[0]] || LOOKS.lia;
  // piel: tonos anaranjados muy saturados y claros
  const pk = pick(CUSTOM.piel, c.piel)[2];
  if (pk !== 1) rules.push({ parts: ['Head', 'Arm', 'Body'], from: [14, 32], minSat: 0.7, minLight: 0.62, light: pk, sat: pk < 0.8 ? 0.85 : 1 });
  // pelo: marrones de saturación media y oscuros
  const hp = pick(CUSTOM.pelo, c.pelo)[2];
  if (hp) { // el pelo de cada estilo es de otro color: castaño (exploradora), casi negro (maga) o rubio (caballera)
    const [h, sat, l] = hp, t = { parts: ['Head'], to: h, setSat: sat, lightTo: l };
    rules.push({ ...t, from: [8, 22], minSat: 0.3, maxSat: 0.6, maxLight: 0.56, lightRef: 0.44 });
    rules.push({ ...t, from: [280, 340], minSat: 0.02, maxSat: 0.12, minLight: 0.06, maxLight: 0.3, lightRef: 0.21 });
    rules.push({ ...t, from: [28, 36], minSat: 0.45, maxSat: 0.62, minLight: 0.6, maxLight: 0.72, lightRef: 0.67 });
  }
  // ropa: verdes, turquesas y amarillos de la paleta
  const rp = pick(CUSTOM.ropa, c.ropa)[2];
  if (rp === 'negro') rules.push({ from: [40, 300], minSat: 0.2, setSat: 0.12, light: 0.55 });
  else if (rp != null) rules.push({ from: [40, 300], minSat: 0.2, shift: rp });
  const out = { model: base.model, scale: 1.0, recolor: rules.length ? [...rules, ...(base.recolor || [])] : base.recolor, glider: pick(CUSTOM.planeador, c.planeador)[2] };
  if (base.recolorHD !== undefined) out.recolorHD = [...rules, ...base.recolorHD]; // en HD, la paleta propia del modelo generado
  return out;
}

// luz de contorno: un brillo cálido en los bordes de los personajes para que destaquen del fondo
const rimKey = () => 'rim1';
function rimLight(sh) {
  sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  { float rimF = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
    totalEmissiveRadiance += vec3(1.0, 0.93, 0.82) * pow(rimF, 2.6) * 0.55 * diffuseColor.rgb; }`);
}
let texCache = new WeakMap();
export function createCharacter(lib, lookName) {
  texCache = new WeakMap(); // texturas teñidas compartidas entre las partes de este personaje
  const look = typeof lookName === 'object' ? lookName : (LOOKS[lookName] || LOOKS.lia);
  // en la versión HD, los modelos que ya tienen versión generada con Artlist se reemplazan (con todas sus variantes de color)
  const modelId = (lib.swap && lib.swap[look.model] && !look.noSwap) ? lib.swap[look.model] : look.model;
  const model = SkeletonUtils.clone(lib.models[modelId]);
  const recol = (modelId !== look.model && look.recolorHD !== undefined) ? look.recolorHD : look.recolor; // la textura HD tiene otra paleta
  model.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = false;
      o.frustumCulled = false; // los huesos mueven la malla fuera de su caja original
      if (recol && recol.length) {
        // reglas por parte: el pelo solo en la cabeza, la piel en cabeza y brazos (evita teñir el cuero del mismo tono)
        const rules = recol.filter(r => !r.parts || r.parts.some(p => (o.name || '').includes(p)));
        if (rules.length && o.material.map) {
          const key = JSON.stringify(rules);
          texCache.set(o.material.map, texCache.get(o.material.map) || new Map());
          const m = texCache.get(o.material.map);
          if (!m.has(key)) m.set(key, recolor(o.material.map, rules));
          o.material = o.material.clone(); o.material.map = m.get(key);
        }
      }
      if (!o.material.userData.rim) { if (!(recol && recol.length)) o.material = o.material.clone(); o.material.userData.rim = true; o.material.onBeforeCompile = rimLight; o.material.customProgramCacheKey = rimKey; }
    }
  });
  const root = new THREE.Group();          // posición y orientación en el mundo
  root.userData.charRoot = true;
  const pivot = new THREE.Group();         // inclinaciones y voltereta, pivote en la cadera
  const HIP = (lib.models[modelId].userData.hipsY ? lib.models[modelId].userData.hipsY * 1.1 : 0.42) * look.scale; // pivote a la altura de la cadera de cada modelo (la voltereta gira sobre el centro del cuerpo)
  pivot.position.y = HIP; root.add(pivot);
  model.position.y = -HIP; model.scale.setScalar(look.scale); model.rotation.y = Math.PI; pivot.add(model); // los modelos miran a +z; el juego usa -z

  const bones = { hips: findBone(model, 'hips'), spine: findBone(model, 'spine'), chest: findBone(model, 'chest'), head: findBone(model, 'head') };
  if (look.hat === 'captain' && bones.head) {
    // se coloca en el espacio del modelo y luego se cuelga del hueso conservando la posición (el hueso tiene otra escala)
    const hat = captainHat();
    model.add(hat); hat.position.set(0, 1.64, -0.02); hat.rotation.x = -0.08; hat.scale.setScalar(1.3);
    model.updateMatrixWorld(true);
    bones.head.attach(hat);
    hat.position.set(0, 0.78, -0.02); hat.rotation.set(-0.12, 0, 0); hat.scale.setScalar(1.75); // ajustado mirándolo en una GPU real: encima del pelo, sin tapar los ojos
    if (lib.genClips && lib.genClips[modelId]) { hat.position.set(0, 0.46, -0.02); hat.scale.setScalar(1.1); } // cabeza del modelo HD (más chica)
  }

  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const [name, clip] of Object.entries(lib.genClips && lib.genClips[modelId] ? lib.genClips[modelId] : lib.clips)) {
    const a = mixer.clipAction(clip);
    a.enabled = true; a.setEffectiveWeight(0);
    actions[name] = a;
  }
  return { root, pivot, model, mixer, actions, bones, scale: look.scale, HIP };
}

function captainHat() {
  const g = new THREE.Group();
  const navy = new THREE.MeshStandardMaterial({ color: 0x1f2f4f, roughness: 0.7 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.8 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xf2c94c, metalness: 0.5, roughness: 0.4 });
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  add(new THREE.CylinderGeometry(0.36, 0.34, 0.2, 20), white, 0, 0.1, 0);
  add(new THREE.CylinderGeometry(0.4, 0.4, 0.05, 20), navy, 0, 0.21, 0);
  add(new THREE.CylinderGeometry(0.35, 0.35, 0.06, 20), navy, 0, 0.0, 0);
  const visor = add(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 20, 1, false, -Math.PI / 2, Math.PI), navy, 0, -0.03, 0.12); // visera hacia +z (el frente del modelo)
  visor.rotation.x = 0.25;
  add(new THREE.BoxGeometry(0.14, 0.08, 0.02), gold, 0, 0.1, 0.355);
  return g;
}

// ---------------------------------------------------------------------------------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (k, dt) => 1 - Math.exp(-k * dt);
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const smooth01 = t => t * t * (3 - 2 * t);
const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);

// Mezclador: pesos suaves por acción + acciones de una sola vez (recoger, celebrar, aterrizar...).
class Blender {
  constructor(ch) {
    this.ch = ch; this.w = {}; this.oneShot = null;
    for (const a of Object.values(ch.actions)) a.play();
  }
  // targets: { nombreAcción: peso }
  apply(dt, targets, k = 12) {
    const os = this.oneShot;
    let osW = 0;
    if (os) {
      os.t += dt * os.speed;
      const a = this.ch.actions[os.name];
      const end = os.dur;
      const fadeIn = clamp(os.t / os.fadeIn, 0, 1), fadeOut = clamp((end - os.t) / os.fadeOut, 0, 1);
      osW = Math.min(fadeIn, fadeOut) * os.strength;
      a.time = Math.min(os.start + os.t, a.getClip().duration - 1e-3);
      a.setEffectiveWeight(osW);
      if (os.t >= end) { a.setEffectiveWeight(0); this.oneShot = null; osW = 0; }
    }
    for (const [name, a] of Object.entries(this.ch.actions)) {
      if (os && name === os.name) continue;
      const t = (targets[name] || 0) * (1 - osW);
      const cur = this.w[name] || 0;
      const nw = cur + (t - cur) * damp(k, dt);
      this.w[name] = nw < 1e-3 && t === 0 ? 0 : nw;
      a.setEffectiveWeight(this.w[name]);
    }
  }
  play(name, { speed = 1, start = 0, end = null, fadeIn = 0.12, fadeOut = 0.2, strength = 1 } = {}) {
    const a = this.ch.actions[name]; if (!a) return;
    if (this.oneShot && this.oneShot.name !== name) this.ch.actions[this.oneShot.name].setEffectiveWeight(0);
    a.timeScale = 0; // la controlamos a mano
    const dur = (end ?? a.getClip().duration) - start;
    this.oneShot = { name, t: 0, start, dur, speed, fadeIn, fadeOut, strength };
  }
  get busy() { return !!this.oneShot; }
}

// ---------------------------------------------------------------------------------
// Lía: caminar/correr sincronizados, salto, caída, aterrizaje, voltereta, mirada e inclinaciones.
export class HeroModelAnimator {
  constructor(ch) {
    this.ch = ch; this.b = new Blender(ch);
    this.phase = 0; this.t = 0; this.prevSin = 0;
    this.runW = 0; this.moveW = 0; this.air = 0; this.airTime = 0;
    this.flip = -1; this.lean = 0; this.turnLean = 0; this.prevFacing = 0;
    this.prevVel = new THREE.Vector3(); this._v = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._q2 = new THREE.Quaternion();
    this.look = { yaw: 0, pitch: 0, tyaw: 0, tpitch: 0, t: 2 };
    this.lockedT = 0;
    for (const n of ['Walking_A', 'Running_B', 'Running_A', 'Idle', 'Jump_Idle']) if (ch.actions[n]) ch.actions[n].timeScale = 0;
  }
  // gesto puntual: 'PickUp', 'Interact', 'Cheer', 'Use_Item'
  gesture(name, opts) { this.b.play(name, opts); }

  update(dt, c) {
    const A = this.ch.actions, ev = { footstep: false, run: false, skid: false };
    this.t += dt;
    const sp = Math.hypot(c.vel.x, c.vel.z);
    this.airTime = c.grounded ? 0 : this.airTime + dt;
    const inAir = this.airTime > 0.06;

    this.moveW += (clamp(sp / 1.2, 0, 1) - this.moveW) * damp(10, dt);
    this.runW += (clamp((sp - 3.0) / 2.4, 0, 1) - this.runW) * damp(7, dt);
    this.air += ((inAir ? 1 : 0) - this.air) * damp(inAir ? 18 : 25, dt);

    // fase común de caminar y correr (misma duración de ciclo): avanza con la velocidad
    const cadence = sp < 0.05 ? 0 : 0.85 + sp * 0.22;
    if (c.grounded) this.phase = (this.phase + dt * cadence) % 1;
    const walk = A.Walking_A, run = A.Running_B, idle = A.Idle, jumpIdle = A.Jump_Idle;
    walk.time = this.phase * walk.getClip().duration;
    run.time = this.phase * run.getClip().duration;
    idle.time = (this.t * 0.9) % idle.getClip().duration;
    jumpIdle.time = (this.t) % jumpIdle.getClip().duration;
    const s = Math.sin(this.phase * TAU * 2);
    if (c.grounded && this.moveW > 0.4 && Math.sign(s) !== Math.sign(this.prevSin) && this.prevSin !== 0) { ev.footstep = true; ev.run = this.runW > 0.5; }
    this.prevSin = s;

    const g = 1 - this.air;
    // encogerse durante la voltereta del doble salto (y estirarse al final)
    const tk = this.flip >= 0 ? Math.pow(Math.sin(Math.PI * Math.min(1, this.flip * 1.15)), 0.6) * 0.9 : 0;
    this.tuck = (this.tuck || 0) + (tk - (this.tuck || 0)) * damp(20, dt);
    if (A.Sit_Floor_Idle) A.Sit_Floor_Idle.time = 0.2;
    if (this.tuck > 0.01 && A.Jump_Land && !(this.b.oneShot && this.b.oneShot.name === 'Jump_Land')) A.Jump_Land.time = 0.12;
    // escudo: mantiene la pose de bloqueo mientras se protege
    this.shieldW = (this.shieldW || 0) + ((c.shielding ? 1 : 0) - (this.shieldW || 0)) * damp(14, dt);
    const sw = this.shieldW, block = A.Block;
    if (block) block.time = block.getClip().duration * 0.42;
    // planeador y garfio: brazos en alto sujetando el armazón o la cuerda
    this.armsUp = (this.armsUp || 0) + (((c.gliding || c.grappling) ? 1 : 0) - (this.armsUp || 0)) * damp(10, dt);
    const raise = A.Spellcast_Raise, au = this.armsUp;
    if (raise && au > 0.01) raise.time = raise.getClip().duration * 0.55 + Math.sin(this.t * 3) * 0.04;
    // antes de tener el bastón, Lía usa el reposo sin arma
    const unarmed = c.canFight === false && A.Unarmed_Idle ? 1 : 0;
    if (A.Unarmed_Idle) A.Unarmed_Idle.time = (this.t * 0.9) % A.Unarmed_Idle.getClip().duration;
    const idleW = g * (1 - this.moveW) * (1 - sw);
    this.b.apply(dt, {
      Idle: idleW * (1 - unarmed),
      Unarmed_Idle: idleW * unarmed,
      Walking_A: g * this.moveW * (1 - this.runW) * (1 - sw * 0.6),
      Running_B: g * this.moveW * this.runW * (1 - sw),
      Jump_Idle: this.air * (1 - au * 0.7) * (1 - this.tuck),
      Sit_Floor_Idle: this.tuck * 0.55, // voltereta: rodillas al pecho (piernas al frente + agachada)
      ...(this.tuck > 0.01 && !(this.b.oneShot && this.b.oneShot.name === 'Jump_Land') ? { Jump_Land: this.tuck * 0.6 } : {}),
      Spellcast_Raise: au * Math.max(this.air, 0.3) * 0.85,
      Block: g * sw,
    }, 14);

    // gestos de espera: si Lía se queda quieta un rato, mira algo o se acomoda
    if (c.grounded && sp < 0.1 && !c.busy && !c.shielding && !c.lookAt) this.idleT = (this.idleT || 0) + dt; else this.idleT = 0;
    if (this.idleT > 7 && !this.b.busy) {
      this.idleT = -Math.random() * 4;
      this.b.play(Math.random() < 0.5 ? 'Use_Item' : 'Interact', { speed: 0.9, fadeIn: 0.35, fadeOut: 0.45, strength: 0.65 });
    }

    // eventos de salto / aterrizaje
    if (c.landed) {
      const hard = clamp(c.landSpeed / 20, 0.3, 1);
      this.b.play('Jump_Land', { speed: lerp(1.9, 1.3, hard), start: 0.05, fadeIn: 0.03, fadeOut: 0.22, strength: lerp(0.9, 0.35, this.moveW) * (0.6 + hard * 0.4) });
    }
    if (c.jumped && !this.b.busy) this.b.play('Jump_Start', { speed: 2.4, start: 0.3, fadeIn: 0.02, fadeOut: 0.1, strength: 0.8 });

    restorePose(this.ch);
    this.ch.mixer.update(0.0001); // aplica los pesos y tiempos fijados a mano
    savePose(this.ch);

    // derrape
    const inLen = Math.hypot(c.input.x, c.input.z);
    const skid = c.grounded && sp > 4 && inLen > 0.5 && (c.input.x * c.vel.x + c.input.z * c.vel.z) / (sp * inLen) < -0.35;
    if (skid) ev.skid = true;

    // inclinaciones (pivote en la cadera)
    const acc = this._v.copy(c.vel).sub(this.prevVel).divideScalar(Math.max(dt, 1e-4));
    this.prevVel.copy(c.vel);
    const fwdAcc = -(acc.x * Math.sin(c.facing) + acc.z * Math.cos(c.facing));
    const turnRate = angDiff(c.facing, this.prevFacing) / Math.max(dt, 1e-4); this.prevFacing = c.facing;
    this.lean += ((skid ? -0.35 : clamp(fwdAcc * 0.01, -0.15, 0.18)) * (c.grounded ? 1 : 0.3) + (c.grounded ? this.runW * 0.08 : 0) - this.lean) * damp(7, dt);
    this.turnLean += (clamp(-turnRate * 0.05 * clamp(sp / 6, 0, 1), -0.35, 0.35) - this.turnLean) * damp(8, dt);

    // voltereta del doble salto
    if (c.doubleJumped) this.flip = 0;
    let flipA = 0;
    if (this.flip >= 0) {
      this.flip += dt / 0.52;
      if (this.flip >= 1 || c.grounded) this.flip = -1; else flipA = -TAU * smooth01(this.flip);
    }
    const P = this.ch.pivot;
    P.rotation.x = flipA + this.lean;
    P.rotation.z = this.turnLean * (c.grounded ? 1 : 0.4);

    // mirada: gira la cabeza (y un poco el pecho) hacia el objetivo
    const L = this.look;
    if (c.lookAt && this.ch.bones.head) {
      const hp = this.ch.bones.head.getWorldPosition(this._v);
      const dx = c.lookAt.x - hp.x, dy = c.lookAt.y - hp.y, dz = c.lookAt.z - hp.z;
      const rel = angDiff(Math.atan2(-dx, -dz), c.facing);
      L.tyaw = Math.abs(rel) < 2.1 ? clamp(rel, -1.0, 1.0) : 0;
      L.tpitch = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -0.45, 0.35);
      L.t = 2;
    } else {
      L.t -= dt;
      if (L.t <= 0) {
        const idle = this.moveW < 0.3;
        L.tyaw = idle && Math.random() < 0.65 ? (Math.random() * 2 - 1) * 0.7 : 0;
        L.tpitch = idle ? Math.random() * 0.2 - 0.05 : 0;
        L.t = 2 + Math.random() * 3.5;
      }
      if (this.moveW > 0.5) { L.tyaw *= 0.9; L.tpitch *= 0.9; }
    }
    if (this.flip >= 0) { L.tyaw = 0; L.tpitch = 0; }
    L.yaw += (L.tyaw - L.yaw) * damp(5, dt);
    L.pitch += (L.tpitch - L.pitch) * damp(5, dt);
    turnBone(this.ch.bones.head, L.yaw * 0.75, L.pitch * 0.7, this._q, this._q2);
    turnBone(this.ch.bones.chest, L.yaw * 0.25, 0, this._q, this._q2);
    return ev;
  }
}

// La mezcladora de Three.js solo escribe un hueso cuando su valor animado cambia. Como la cabeza
// y el pecho se giran a mano después, hay que devolverlos a la pose animada antes de cada mezcla:
// si no, el giro se acumula fotograma a fotograma y la cabeza da vueltas o se cae.
export function restorePose(ch) { for (const b of [ch.bones.head, ch.bones.chest]) if (b && b.userData.baseQ) b.quaternion.copy(b.userData.baseQ); }
export function savePose(ch) { for (const b of [ch.bones.head, ch.bones.chest]) if (b) (b.userData.baseQ || (b.userData.baseQ = new THREE.Quaternion())).copy(b.quaternion); }

// Gira un hueso en el espacio del mundo (yaw sobre el eje vertical, pitch sobre el eje lateral del personaje)
function turnBone(bone, yaw, pitch, q, q2) {
  if (!bone || (Math.abs(yaw) < 1e-4 && Math.abs(pitch) < 1e-4)) return;
  const parent = bone.parent;
  parent.updateWorldMatrix(true, false);
  const pq = parent.getWorldQuaternion(q2);
  const bw = q.copy(pq).multiply(bone.quaternion);          // rotación del hueso en el mundo
  const charQ = bone.parent.parent ? getRootQuat(bone) : new THREE.Quaternion();
  const side = new THREE.Vector3(1, 0, 0).applyQuaternion(charQ);
  const rot = new THREE.Quaternion().setFromAxisAngle(UP, yaw).multiply(new THREE.Quaternion().setFromAxisAngle(side, pitch));
  bw.premultiply(rot);
  bone.quaternion.copy(pq.invert().multiply(bw));
}
const _rq = new THREE.Quaternion();
function getRootQuat(bone) {
  let o = bone; while (o.parent && !o.userData.charRoot) o = o.parent;
  return o.getWorldQuaternion(_rq);
}

// ---------------------------------------------------------------------------------
// Personajes del pueblo: reposo, miran a Lía, se giran al hablar y gesticulan.
export class NpcModelAnimator {
  constructor(ch, baseYaw, opts = {}) {
    this.ch = ch; this.b = new Blender(ch); this.t = Math.random() * 5;
    this.yaw = baseYaw; this.baseYaw = baseYaw; this.talking = false; this.wasTalking = false;
    this.lively = opts.style === 'lively';
    this.look = { yaw: 0, pitch: 0 };
    this._q = new THREE.Quaternion(); this._q2 = new THREE.Quaternion(); this.gestT = 0;
    ch.actions.Idle.timeScale = 0;
    ch.root.userData.charRoot = true;
  }
  update(dt, playerPos) {
    const ch = this.ch; this.t += dt;
    const wp = ch.root.position;
    const dx = playerPos.x - wp.x, dz = playerPos.z - wp.z, dist = Math.hypot(dx, dz);
    const toPlayer = Math.atan2(-dx, -dz);
    this.yaw += angDiff(this.talking ? toPlayer : this.baseYaw, this.yaw) * damp(this.talking ? 6 : 1.5, dt);
    ch.root.rotation.y = this.yaw;

    // saludo cuando Lía se acerca por primera vez en un rato
    this.greetCd = Math.max(0, (this.greetCd || 0) - dt);
    if (!this.talking && dist < 4.5 && !this.near && this.greetCd <= 0 && !this.b.busy) { this.b.play(this.lively ? 'Cheer' : 'Interact', { speed: 1.15, fadeIn: 0.2, fadeOut: 0.35, strength: 0.75 }); this.greetCd = 20; }
    this.near = dist < 6;
    if (this.talking && !this.wasTalking) { this.b.play(this.lively ? 'Cheer' : 'Interact', { speed: 1.1, fadeIn: 0.2, fadeOut: 0.35, strength: 0.9 }); this.gestT = 3 + Math.random() * 2; }
    if (this.talking) {
      this.gestT -= dt;
      if (this.gestT <= 0 && !this.b.busy) { this.b.play('Interact', { speed: 1, start: 0.1, fadeIn: 0.25, fadeOut: 0.4, strength: 0.6 }); this.gestT = 3.5 + Math.random() * 3; }
    }
    this.wasTalking = this.talking;

    ch.actions.Idle.time = (this.t * (this.lively ? 1.25 : 0.85)) % ch.actions.Idle.getClip().duration;
    this.b.apply(dt, { Idle: 1 }, 8);
    restorePose(ch);
    ch.mixer.update(0.0001);
    savePose(ch);

    let tyaw = 0, tpitch = 0;
    if (dist < 7) {
      const rel = angDiff(toPlayer, this.yaw);
      if (Math.abs(rel) < 2) { tyaw = clamp(rel, -1, 1); tpitch = ch.scale < 0.9 ? 0.25 : -0.06; } // los niños miran hacia arriba
    }
    this.look.yaw += (tyaw - this.look.yaw) * damp(4, dt);
    this.look.pitch += (tpitch - this.look.pitch) * damp(4, dt);
    const nod = this.talking ? Math.sin(this.t * 5) * 0.05 : 0;
    turnBone(ch.bones.head, this.look.yaw * 0.75, this.look.pitch + nod, this._q, this._q2);
    turnBone(ch.bones.chest, this.look.yaw * 0.25, 0, this._q, this._q2);
  }
}
