import * as THREE from 'three';
import { Input } from './input.js';
import { Physics } from './physics.js';
import { Player, angleDiff } from './player.js';
import { FollowCamera } from './camera.js';
import { World } from './world.js';
import { Audio } from './audio.js';
import { Music } from './music.js';
import { AutoNav } from './autonav.js';
import { DESAFIOS, medalFor, BASE_DESAFIOS } from './zones/desafios.js';
// Modo desafío: mientras está activo, nada se guarda en la partida de la historia.
let challenge = null;
const writeSave = s => challenge ? true : writeSaveRaw(s);
import { FX } from './fx.js';
import { loadCharacterLibrary, createCharacter, customLook, CUSTOM, DEFAULT_CUSTOM, auraOf } from './characters.js';
import { loadProps } from './props.js';
import { newSave, loadSave, peekSave, getSlot, setSlot, SLOTS, freeSlot, listSaves, writeSlot, deleteSave, writeSave as writeSaveRaw, loadSettings, writeSettings, exportCode, importCode } from './save.js';
import puertoBruma from './zones/puerto_bruma.js';
import bosqueColgante from './zones/bosque_colgante.js';
import ruinasVidrio from './zones/ruinas_vidrio.js';
import ciudadEngranajes from './zones/ciudad_engranajes.js';
import glaciarEco from './zones/glaciar_eco.js';
import ciudadelaOrden from './zones/ciudadela_orden.js';
import ecoOlvidado from './zones/eco_olvidado.js';
import forjaIgnis from './zones/forja_ignis.js';
import abismoMareth from './zones/abismo_mareth.js';
import { Combat, DIFF } from './combat.js';
import { LOGROS, storeOf, unlock, bump as bumpL, addTo as addToL } from './logros.js';
import { runCredits } from './credits.js';
import { applySenderos, SENDEROS } from './zones/senderos.js';
import { HEROES, heroById, heroLook, heroUnlocked } from './heroes.js';
import { ZONE_PIECES, MISIONES, PIECE_TOTAL, piecesOf, pieceCount, pieceHearts, pieceBreakable, newlyDone, givePiece, bumpMax as bumpMaxL } from './piezas.js';
import { Arena, ARENA_MODES, wireChat } from './arena.js';
import { Powers, POWERS, loadout, powerUnlocked, powerPoints, powerById, ENERGY_MAX } from './powers.js';
import { Net } from './net.js';
import { Endless, ENDLESS_ZONE } from './endless.js';
import { runIntro } from './intro.js';
import { WEAPONS, ARMORS, weaponById, armorById, gearOf, mergeMods, ECO_REWARD, buildWeapon, buildArmor } from './gear.js';

const ZONES_BASE = { puerto_bruma: puertoBruma, bosque_colgante: bosqueColgante, ruinas_vidrio: ruinasVidrio, ciudad_engranajes: ciudadEngranajes, glaciar_eco: glaciarEco, ciudadela_orden: ciudadelaOrden, eco_olvidado: ecoOlvidado, forja_ignis: forjaIgnis, abismo_mareth: abismoMareth };
applySenderos(ZONES_BASE); // cada zona de la historia gana su Sendero
const ZONES = { ...ZONES_BASE }; for (const L of DESAFIOS) ZONES[L.id] = L;
ZONES.infinito = ENDLESS_ZONE;
const $ = id => document.getElementById(id);

// ---------- motor ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
// Gráficas integradas (Intel/UHD, móviles): menos píxeles y sombras más pequeñas para no saturar la GPU.
const LOW_GPU = (() => {
  try {
    const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    return /intel|uhd|hd graphics|iris|mali|adreno|powervr|swiftshader|llvmpipe/i.test(name) || /Android|iPhone|iPad/i.test(navigator.userAgent);
  } catch (e) { return false; }
})();
renderer.setPixelRatio(Math.min(devicePixelRatio, LOW_GPU ? 1 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 600);
const hemi = new THREE.HemisphereLight(0xdff1ff, 0x5c6a50, 0.9); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 1.6);
sun.castShadow = true; sun.shadow.mapSize.set(LOW_GPU ? 1024 : 2048, LOW_GPU ? 1024 : 2048);
if (LOW_GPU) renderer.shadowMap.type = THREE.PCFShadowMap;
const QUALITY = {
  alta: { ratio: 2, shadows: true, soft: true, map: 2048, fx: 1, bloom: true },
  media: { ratio: 1, shadows: true, soft: false, map: 1024, fx: 1 },
  baja: { ratio: 0.75, shadows: false, soft: false, map: 512, fx: 0.5 },
};
let qualityNow = '';
let composer = null, bloomLoading = false; // resplandor (bloom) en calidad Alta
const aq = { t: 0, n: 0, slow: 0 };

// Si la tarjeta gráfica se reinicia (pasa en algunas integradas), el juego no se queda en blanco:
// avisa, espera a que vuelva y, si no vuelve, ofrece recargar desde el último punto guardado.
let glLost = false;
renderer.domElement.addEventListener('webglcontextlost', e => {
  e.preventDefault(); glLost = true;
  const m = document.getElementById('glLost'); if (m) m.classList.remove('hidden');
  try { persist(); } catch (err) {}
  setTimeout(() => { if (glLost) { const b = document.getElementById('glReload'); if (b) b.classList.remove('hidden'); } }, 4000);
}, false);
renderer.domElement.addEventListener('webglcontextrestored', () => {
  glLost = false; const m = document.getElementById('glLost'); if (m) m.classList.add('hidden');
}, false);
Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 140 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

// cielo con degradado
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y*1.4+0.25,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, h),1.0); }',
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 24, 12), skyMat); scene.add(sky);

const physics = new Physics();
const input = new Input(renderer.domElement);
const audio = new Audio();
const music = new Music(audio);
// Música de cada zona y de cada jefe; ambiente de fondo
const ZONE_MUSIC = { abismo_mareth: 'mareth', forja_ignis: 'forja', eco_olvidado: 'eco', puerto_bruma: 'puerto', bosque_colgante: 'bosque', ruinas_vidrio: 'ruinas', ciudad_engranajes: 'ciudad', glaciar_eco: 'glaciar', ciudadela_orden: 'ciudadela' };
const BOSS_MUSIC = { eco_olvidado: 'boss_eco', bosque_colgante: 'boss_raiz', ruinas_vidrio: 'boss_escorpion', ciudad_engranajes: 'boss_coloso', glaciar_eco: 'boss_sierpe', ciudadela_orden: 'vaelor' };
const CH_MUSIC = { desafio_1: 'desafio', desafio_2: 'desafio', desafio_3: 'desafio_noche', desafio_4: 'ruinas', desafio_5: 'desafio_noche', desafio_6: 'forja', desafio_7: 'forja' };
for (let n = 8; n <= DESAFIOS.length; n++) CH_MUSIC['desafio_' + n] = ['desafio', 'desafio', 'desafio_noche', 'glaciar', 'forja', 'ruinas', 'desafio_noche'][(n - 8) % 7];
const ZONE_AMB = { abismo_mareth: 'sea', forja_ignis: 'desert', eco_olvidado: 'ice', desafio_1: 'sea', desafio_2: 'desert', desafio_3: 'ice', desafio_4: 'desert', desafio_5: 'city', desafio_6: 'desert', desafio_7: 'desert',  puerto_bruma: 'sea', bosque_colgante: 'forest', ruinas_vidrio: 'desert', ciudad_engranajes: 'city', glaciar_eco: 'ice', ciudadela_orden: 'dark' };
// los navegadores solo dejan sonar audio después de un gesto: el primero enciende todo
for (let n = 8; n <= DESAFIOS.length; n++) ZONE_AMB['desafio_' + n] = ['sea', 'desert', 'ice', 'ice', 'desert', 'city', 'sea'][(n - 8) % 7];
const wakeAudio = () => { audio.unlock(); if (music.init() && state === 'title') music.play('title'); };
addEventListener('pointerdown', wakeAudio); addEventListener('keydown', wakeAudio); addEventListener('touchstart', wakeAudio);
let padWoke = false;
let duckNow = 1;
function updateMusic() {
  const d = state === 'pause' ? 0.35 : state === 'dialog' ? 0.6 : 1;
  if (d !== duckNow) { duckNow = d; music.duck(d); }
  if (state !== 'play' && state !== 'dialog' || !zone) return;
  const b = combat.boss, fighting = b && (b.state === 'intro' || b.fighting);
  music.play(fighting ? (BOSS_MUSIC[zone.id] || 'boss') : endless.active && endless.inZone ? ZONE_MUSIC.infinito : (ZONE_MUSIC[zone.id] || CH_MUSIC[zone.id]), { fade: fighting ? 0.8 : 2.5 });
}
const world = new World(scene, physics);
const fx = new FX(scene);
const player = new Player(scene, physics, audio, fx);
const cam = new FollowCamera(camera, physics);
// pantalla dividida (dos jugadores en un mismo dispositivo): segunda cámara para el Jugador 2
const camera2 = new THREE.PerspectiveCamera(60, 1, 0.1, 600);
const cam2 = new FollowCamera(camera2, physics);
let splitView = false;
function setSplit(on) {
  splitView = !!on; document.body.classList.toggle('split', splitView);
  if (!splitView) { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setViewport(0, 0, innerWidth, innerHeight); }
}
const combat = new Combat(scene, physics, fx, audio);
combat.world = world;
const powers = new Powers({ scene, physics, fx, audio, combat });
// un enemigo como objetivo de los poderes: fuego y golpes lo dañan, el hielo lo congela y la telequinesis lo levanta
function enemyTarget(e) {
  return { pos: e.pos, radius: e.radius || 0.6, enemy: e, hit(dmg, kind, from, x = {}) {
    if (!e.alive) return;
    const canStun = e.state !== undefined && !e.flying;
    if (kind === 'ice' && canStun) {
      e.state = 'stagger'; e.stagger = x.t || 2.5;
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 1), new THREE.MeshStandardMaterial({ color: 0xcff4ff, emissive: 0x3a8ad0, emissiveIntensity: 0.5, transparent: true, opacity: 0.55, flatShading: true, depthWrite: false }));
      m.position.y = 0.6; m.userData.noFlash = true; e.group.add(m); audio.play('freeze', e.pos);
      powers.fx.push({ t: 0, update: (dt, f) => { f.t += dt; if (e.alive && e.state === 'stagger') e.stagger = Math.max(e.stagger, 0.1); if (f.t > (x.t || 2.5) || !e.alive) { e.group.remove(m); if (e.alive) { e.stagger = 0.05; fx.sparkle(e.pos.clone().setY(e.pos.y + 0.6), 14, 0xd8f6ff); } return true; } } });
    }
    if (kind === 'lift') {
      if (!canStun) { e.hurt(x.slam || 2, from, 4); return; }
      const y0 = e.pos.y + 3;
      powers.fx.push({ t: 0, update: (dt, f) => { f.t += dt; if (!e.alive) return true; e.state = 'stagger'; e.stagger = 0.3; e.vel.x *= 0.9; e.vel.z *= 0.9; e.vel.y = (y0 - e.pos.y) * 4 + 26 * dt; if (f.t > (x.t || 2.3)) { e.vel.y = -16; e.hurt(x.slam || 2, from, 2); combat.shake(0.2, 0.2); return true; } } });
      return;
    }
    if (dmg > 0) e.hurt(dmg, from, x.push || 3);
  } };
}
const storyFoes = () => combat.enemies.filter(e => e.alive).map(enemyTarget);
let hookTarget = null;
let bossActive = false, deadT = 0, hintClang = false, hintStun = false, hintAura = false, lastHp = -1, endNext = null, pendingFinale = null;
const pulseFx = [];

let settings = loadSettings();
let save = null;
let navI = 0, navSig = ''; // navegación de menús con mando
let lossStreak = 0; // rondas de vidas perdidas sin avanzar (para ofrecer bajar la dificultad)
let state = 'title';
let zone = null;
let time = 0;
let dialog = null;
let focus = null;
let talkCooldown = 0;
const lookTarget = new THREE.Vector3();
let lastGoalZone = null;
let pendingWarp = null, pendingChapterEnd = false, pendingEnding = false, cutscene = null, lastGoal = '';

// Estado de la historia que ven los datos de la zona (objetivos y diálogos).
const S = {
  has: f => !!(save && save.flags[f]),
  set: f => { save.flags[f] = true; writeSave(save); applyAbilities(); },
  frags: () => zone.fragments.filter(f => save.fragments.includes(f.id)).length,
  give: name => { toast(`Obtuviste: ${name}`); audio.play('fragment'); player.gesture('Cheer', { speed: 1.2, fadeOut: 0.3 }); },
  ending: () => { pendingEnding = true; },
  chapterEnd: () => { pendingChapterEnd = true; },
  warp: cp => { pendingWarp = cp; },
  enterSub: () => setSub(true), exitSub: () => setSub(false), inSub: () => !!player.inSub,
  logro: id => logro(id),
  finale: kind => { pendingFinale = kind; },
  endingDialog: kind => startDialog(zone.story.endings[kind], '', null, () => S.finale(kind)),
  dispel: id => { const B = world.darkBarriers.find(b => b.id === id); if (B) { world.dispelBarrier(B); fx.sparkle(B.pos, 30, 0xfff2a8); if (B.flag) save.flags[B.flag] = true; } },
  get bossActive() { return bossActive; },
  effect: (kind, id) => {
    const it = world.interactables.find(o => o.id === id);
    if (kind === 'vanish' && it) { fx.sparkle(it.pos.clone().setY(it.pos.y + 1), 24, 0xb98cff); audio.play('djump'); }
  },
};

// Marcador del objetivo: un haz de luz y una flecha sobre el destino.
const marker = new THREE.Group(); scene.add(marker);
const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 40, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
beam.position.y = 20; marker.add(beam);
const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 4), new THREE.MeshBasicMaterial({ color: 0xffd27a })); arrow.rotation.x = Math.PI; marker.add(arrow);
// faro: una columna de luz suave sobre el objetivo que se ve desde lejos
const beacon = new THREE.Group(); scene.add(beacon);
const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
const beaconCol = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.1, 60, 20, 1, true), beaconMat); beaconCol.position.y = 30; beacon.add(beaconCol);
const beaconCore = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.3, 60, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending })); beaconCore.position.y = 30; beacon.add(beaconCore);
beacon.visible = false;
// meta cumplida: columna de luz que sube, anillo en el suelo, destellos y un rótulo
const goalFx = [];
function celebrateGoal(pos, big = false) {
  const g = new THREE.Group(); g.position.copy(pos); scene.add(g);
  const colM = new THREE.MeshBasicMaterial({ color: big ? 0xffe08a : 0xbff4ff, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const col = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.6, 40, 24, 1, true), colM); col.position.y = 20; col.scale.y = 0.01; g.add(col);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.1, 48), colM.clone()); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; g.add(ring);
  goalFx.push({ g, col, ring, t: 0, big });
  fx.rainbow(pos.clone().setY(pos.y + 1), big ? 60 : 30); fx.sparkle(pos.clone().setY(pos.y + 1.5), big ? 50 : 25, big ? 0xffe08a : 0xbff4ff);
  audio.play('unlock'); if (big) { music.stinger('hallazgo'); combat.shake(0.25, 0.4); }
  const el = $('goalDone'); el.textContent = big ? '✦ ¡Gran meta alcanzada! ✦' : '✦ ¡Meta alcanzada!'; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
}
function goalFxTick(dt) {
  for (let i = goalFx.length - 1; i >= 0; i--) {
    const e = goalFx[i]; e.t += dt;
    e.col.scale.y = Math.min(1, e.t * 2.5); e.col.material.opacity = 0.6 * Math.max(0, 1 - Math.max(0, e.t - 0.8) / 1.6);
    const r = 1 + e.t * (e.big ? 9 : 6); e.ring.scale.setScalar(r); e.ring.material.opacity = 0.7 * Math.max(0, 1 - e.t / 1.4);
    e.g.rotation.y += dt;
    if (e.t > 0.3 && e.t < 1.6 && Math.random() < 0.5) fx.sparkle(e.g.position.clone().setY(e.g.position.y + Math.random() * 10), 1, e.big ? 0xffe08a : 0xffffff);
    if (e.t > 2.6) { scene.remove(e.g); goalFx.splice(i, 1); }
  }
}
marker.visible = false;

applySettings();

// ---------- vuelo de cámara sobre la isla al llegar (mientras se narra la introducción) ----------
let flyover = null;
function startFlyover() {
  const isl = (zone.islands || []).slice(0, zone._baseIslands || (zone.islands || []).length);
  if (!isl.length || splitView) return;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, top = 0;
  for (const I of isl) { x0 = Math.min(x0, I.x - I.w / 2); x1 = Math.max(x1, I.x + I.w / 2); z0 = Math.min(z0, I.z - I.d / 2); z1 = Math.max(z1, I.z + I.d / 2); top = Math.max(top, I.top || 0); }
  const R = Math.min(90, Math.max(18, Math.hypot(x1 - x0, z1 - z0) / 2));
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const a0 = Math.atan2(player.pos.x - cx, player.pos.z - cz) + Math.PI * 0.85; // empieza al otro lado y gira hacia la heroína
  flyover = { t: 0, e: 0, ending: false, cx, cz, top, R, a0, pos: new THREE.Vector3(), look: new THREE.Vector3() };
  document.body.classList.add('cine');
}
function flyoverTick(dt) {
  const f = flyover; f.t += dt;
  if (state !== 'dialog' && !f.ending) f.ending = true;
  if (f.t > 14 && !f.ending) f.ending = true; // si se queda leyendo mucho, vuelve igual
  const k = Math.min(1, f.t / 12), ease = k * k * (3 - 2 * k);
  const ang = f.a0 - ease * Math.PI * 0.85;
  const r = f.R * (1.25 - 0.55 * ease) + 6, h = f.top + f.R * (0.55 - 0.35 * ease) + 6;
  f.pos.set(f.cx + Math.sin(ang) * r, h, f.cz + Math.cos(ang) * r);
  f.look.set(f.cx, f.top + 2, f.cz).lerp(player.pos.clone().setY(player.pos.y + 1.2), ease * 0.8);
  if (f.ending) f.e = Math.min(1, f.e + dt / 1.3);
  const b = f.e * f.e * (3 - 2 * f.e);
  const normPos = camera.position.clone(), normLook = player.pos.clone().setY(player.pos.y + 1.2);
  camera.position.copy(f.pos).lerp(normPos, b);
  camera.lookAt(f.look.clone().lerp(normLook, b));
  if (f.e >= 1) { flyover = null; document.body.classList.remove('cine'); cam.snap && cam.snap(player); }
}

// ---------- presentación ----------
let introRun = null;
function showIntro() {
  introRun = { done: false };
  const r = runIntro({
    sfx: n => audio.play(n),
    onStart: () => { audio.unlock(); if (music.init()) music.play('title'); },
    onEnd: () => { introRun.done = true; },
  });
  Object.assign(introRun, { skip: r.skip, finish: r.finish });
}
if (!navigator.webdriver && !/[?&]nointro/.test(location.search)) showIntro();

// ---------- carga de personajes animados ----------
let charsReady = false;
$('bContinue').disabled = $('bNew').disabled = true;
let pChars = 0, pProps = 0, charLib = null;
const showLoad = () => { $('loading').textContent = `Cargando personajes y escenarios… ${Math.round((pChars * 0.4 + pProps * 0.6) * 100)}%`; };
Promise.all([
  loadCharacterLibrary(p => { pChars = p; showLoad(); })
    .then(lib => { charLib = lib; player.useModel(lib, customLook(((loadSave() || {}).custom) || settings.custom || {})); world.chars = lib; combat.chars = lib; })
    .catch(e => { console.warn('No se pudieron cargar los personajes animados; se usan los de formas simples.', e); }),
  loadProps(p => { pProps = p; showLoad(); }).catch(e => console.warn('Sin modelos de escenario', e)),
]).finally(() => { charsReady = true; $('loading').classList.add('hidden'); $('bContinue').disabled = $('bNew').disabled = false; });

// ---------- zonas ----------
function loadZone(id, checkpointId) {
  if (flyover) { flyover = null; document.body.classList.remove('cine'); }
  zone = ZONES[id];
  audio.surface = surfaceOf(zone);
  removeReturnWind();
  player.inSub = false; player.swimming = false; clearSeaFx(); powers.clear(); player.iceT = player.liftT = player.levT = 0; player.frozen = false;
  if (zone.sea && save && save.flags.mr_sub && !save.flags.mr_fosa) delete save.flags.mr_sub; // el submarino vuelve a su amarre
  if (zone.boss && zone.boss.type === 'eco') { // el Eco Sombrío es una copia oscura de la protagonista tal como la vistió el jugador
    const base = customLook((save && save.custom) || settings.custom || {});
    zone.boss.look = { model: base.model, scale: 1.05, recolor: [{ from: [0, 360], minSat: 0, to: 268, setSat: 0.4, light: 0.55 }] };
  }
  skyMat.uniforms.top.value.setHex(zone.sky.top);
  skyMat.uniforms.bottom.value.setHex(zone.sky.bottom);
  scene.fog = new THREE.Fog(zone.sky.fog, zone.sky.fogNear, zone.sky.fogFar);
  const li = zone.light || {};
  hemi.color.setHex(li.hemiSky || 0xdff1ff); hemi.groundColor.setHex(li.hemiGround || 0x5c6a50); sun.color.setHex(li.sun || 0xfff1d6);
  world.build(zone, save); music.ambient(ZONE_AMB[zone.id]);
  player.updrafts = world.updrafts;
  combat.spawnZone(zone, save); combat.breakables = world.breakables;
  pieceBk = save && !zone.challenge ? pieceBreakable(zone) : null;
  bossActive = false; hintClang = false; hintStun = false; hintAura = false; $('bossbar').classList.add('hidden');
  applyAbilities(); player.hp = player.maxHp;
  respawn(checkpointId);
  updateHUD();
  banner(zone.subtitle, zone.title);
}

// Habilidades y vida según el progreso guardado.
function applyAbilities() {
  if (!save) return;
  player.setFight(!!save.flags.baston);
  player.canAirDash = !!save.flags.impulso;
  player.canGlide = !!save.flags.planeador;
  player.canGrapple = !!save.flags.garfio;
  player.canShield = !!save.flags.escudo;
  player.canPulse = !!save.flags.pulso;
  $('tY').classList.toggle('off', !player.canShield);
  $('tZ').classList.toggle('off', !(player.canGrapple || player.canPulse));
  player.maxHp = 4 + Math.floor(save.fragments.length / 5) + Math.floor((save.relics || []).length / 2) + pieceHearts(save) + (player.mods.hp || 0);
  $('hudPieza').textContent = `⚙ ${pieceCount(save)}`;
  applyPowers();
}
// poderes especiales de la partida (después de conseguir el bastón)
function applyPowers() {
  if (!save) return;
  player.powerSlots = save.flags.baston && !challenge ? loadout(save) : null;
  player.aura = auraOf(save.custom);
  if (player.energy === undefined) player.energy = ENERGY_MAX;
  player.pcd = player.pcd || {};
  ['tP1', 'tP2', 'tP3'].forEach((id, i) => { const P = player.powerSlots && powerById(player.powerSlots[i]); $(id).textContent = P ? P.icon : ''; $(id).classList.toggle('hidden', !P); });
  powerHudSig = '';
}
let powerHudSig = '';
function updatePowerHUD() {
  const show = (state === 'play' || state === 'dialog' || state === 'arena') && player.powerSlots && player.powerSlots.length;
  $('powerBar').classList.toggle('hidden', !show);
  if (!show) return;
  $('energyFill').style.width = `${Math.round((player.energy ?? ENERGY_MAX) / ENERGY_MAX * 100)}%`;
  const sig = player.powerSlots.join(',');
  if (sig !== powerHudSig) {
    powerHudSig = sig;
    $('pSlots').innerHTML = player.powerSlots.map((id, i) => { const P = powerById(id); return `<div class="pslot" id="ps${i}" title="${P.name}"><span class="k">${i + 1}</span>${P.icon}<span class="cd"></span></div>`; }).join('');
  }
  player.powerSlots.forEach((id, i) => {
    const P = powerById(id), el = $('ps' + i); if (!el) return;
    const cd = (player.pcd && player.pcd[id]) || 0, low = (player.energy ?? 0) < P.cost;
    el.classList.toggle('ok', !cd && !low); el.classList.toggle('low', low);
    el.lastChild.style.height = `${Math.min(100, cd / P.cd * 100)}%`;
  });
}

// Entrar en una zona (al empezar, al continuar o al cambiar de capítulo), con su introducción la primera vez.
function enterZone(id, checkpointId) {
  save.zone = id; save.checkpoint = checkpointId; writeSave(save);
  loadZone(id, checkpointId);
  state = 'play'; lastGoal = '';
  const flag = id === 'puerto_bruma' ? 'intro' : 'intro_' + id;
  if (zone.story && zone.story.intro && !save.flags[flag]) {
    save.flags[flag] = true; writeSave(save);
    setTimeout(() => { if (state === 'play') { startDialog(zone.story.intro, '', null, () => zone.story.onIntroEnd && zone.story.onIntroEnd(S)); startFlyover(); } }, 900);
  }
}

function respawn(checkpointId) {
  if (endless.active) { const s = endless.respawnPoint(); player.teleport(s.x, s.y, s.z, s.f); cam.snap(player); return; }
  const cp = world.checkpoints[checkpointId] || world.checkpoints[zone.start.id];
  player.teleport(cp.pos.x, cp.pos.y + 0.05, cp.pos.z, cp.facing);
  cam.snap(player);
}

function persist() {
  const ok = writeSave(save);
  toast(ok ? 'Partida guardada' : 'No se pudo guardar en este navegador: usa el código de exportación');
}

// ---------- interacción ----------
function updateInteractions() {
  focus = null;
  let best = Infinity;
  for (const it of world.interactables) {
    if (it.active === false) continue;
    const dx = player.pos.x - it.pos.x, dz = player.pos.z - it.pos.z, dy = player.pos.y - it.pos.y;
    const d = Math.hypot(dx, dz);
    if (d > it.radius || Math.abs(dy) > 2.2) continue;
    if (it.type === 'fragment') { collectFragment(it); continue; }
    if (it.type === 'relic') { collectRelic(it); continue; }
    if (it.type === 'pieza') { collectPieza(it); continue; }
    if (it.type === 'lantern') {
      if (save.checkpoint !== it.id) lightLantern(it);
      continue;
    }
    if (d < best) { best = d; focus = it; }
  }
  if (focus) {
    $('prompt').innerHTML = `<b>${input.usingGamepad ? input.padIcon('interact') : input.isTouch ? 'X' : 'E'}</b>${focus.verb}`;
    $('prompt').classList.remove('hidden');
    if (input.pressed('interact') && talkCooldown <= 0) openDialog(focus);
  } else $('prompt').classList.add('hidden');
}

// ---------- objetos rompibles y reliquias ----------
const RELIC_TOTAL = 8;
let pieceBk = null, pieceHintT = 0; // vasija o geoda que guarda la Pieza especial de la zona
combat.onBreak = B => {
  world.breakObject(B);
  audio.play('shatter'); fx.sparkle(B.pos, 18, B.kind === 'cofre' ? 0xc8a8ff : 0xffc890); combat.shake(0.08, 0.15); input.rumble(90, 0.4);
  if (B.loot === 'reliquia') world.spawnRelic(B.id, B.pos.clone().setY(B.pos.y - 0.45));
  else if (B.loot === 'corazon') combat.spawnHeal(B.pos.x, B.pos.y - 0.45, B.pos.z);
  else if (B.loot === 'reloj' && challenge) { challenge.t = Math.max(0, challenge.t - 3); audio.play('unlock'); toast('⏳ ¡Reloj de arena! −3 segundos'); }
  if (!challenge && save && !isAutoMode()) { bump('rotos'); addEcos(ECO_REWARD.roto); }
  const pid = zone && 'pz_' + zone.id;
  if (B.id === pieceBk && save && !piecesOf(save).includes(pid)) { world.spawnPieza(pid, B.pos.clone().setY(B.pos.y - 0.45)); fx.sparkle(B.pos, 30, 0xffe08a); toast('¡Algo dorado brilla entre los pedazos!'); }
};
// Pieza especial: beneficios para toda la partida
function collectPieza(it) {
  world.interactables.splice(world.interactables.indexOf(it), 1);
  world.root.remove(it.mesh);
  if (!givePiece(save, it.id)) return;
  addEcos(ECO_REWARD.pieza);
  music.stinger('hallazgo'); fx.sparkle(it.pos.clone().setY(it.pos.y + 1), 34, 0xffe08a); audio.play('fragment');
  player.gesture('Cheer', { speed: 1.2, fadeOut: 0.3 });
  announcePiece(`${ZONE_PIECES[zone.id] || 'Pieza especial'}`);
  writeSave(save);
}
// avisa de la pieza y de lo que desbloquea
function announcePiece(name) {
  const n = pieceCount(save), before = player.maxHp;
  applyAbilities(); if (player.maxHp > before) player.hp = player.maxHp;
  const extra = [];
  if (n % 4 === 0) extra.push('¡un corazón más!');
  const h = HEROES.find(x => x.need === n); if (h) extra.push(`¡${h.name} se une a tu equipo!`);
  toast(`⚙ ${name} (${n}/${PIECE_TOTAL})${extra.length ? ' · ' + extra.join(' ') : ''}`);
  if (h) achvQ.push({ icon: '☺', title: `Nuevo héroe: ${h.name}`, desc: `${h.perk}. Cámbialo con H o desde la pausa.`, kicker: 'Héroe desbloqueado' });
}
// misiones cumplidas: cada una da una pieza
function checkMissions() {
  if (!save || challenge || isAutoMode()) return;
  for (const M of newlyDone(save)) {
    givePiece(save, 'pz_' + M.id);
    achvQ.push({ icon: M.icon, title: M.title, desc: '+1 Pieza especial', kicker: 'Misión cumplida' });
    announcePiece(`Misión «${M.title}»`);
    writeSave(save);
  }
}
function collectRelic(it) {
  world.interactables.splice(world.interactables.indexOf(it), 1);
  world.root.remove(it.mesh);
  save.relics = save.relics || [];
  if (!save.relics.includes(it.id)) { save.relics.push(it.id); addEcos(ECO_REWARD.reliquia); }
  music.stinger('hallazgo'); fx.sparkle(it.pos.clone().setY(it.pos.y + 1), 26, 0xffd27a);
  player.gesture('Cheer', { speed: 1.2, fadeOut: 0.3 });
  const n = save.relics.length, before = player.maxHp;
  applyAbilities(); if (player.maxHp > before) player.hp = player.maxHp;
  logro('primera_reliquia'); if (n >= RELIC_TOTAL) logro('todas_reliquias');
  toast(n === RELIC_TOTAL ? '¡Encontraste todas las Reliquias de Aethra!' : `Reliquia de Aethra (${n}/${RELIC_TOTAL})${player.maxHp > before ? ' · ¡un corazón más!' : ''}`);
  writeSave(save);
}

function collectFragment(it) {
  world.interactables.splice(world.interactables.indexOf(it), 1);
  world.root.remove(it.mesh);
  fx.sparkle(it.pos.clone().setY(it.pos.y + 0.8)); fx.rainbow(it.pos.clone().setY(it.pos.y + 0.8), 26);
  save.fragments.push(it.id); addEcos(ECO_REWARD.fragmento);
  audio.play('fragment');
  updateHUD();
  const total = zone.fragments.length, got = zone.fragments.filter(f => save.fragments.includes(f.id)).length;
  toast(got === total ? '¡Encontraste todos los fragmentos de esta zona!' : `Fragmento encontrado (${got}/${total})`);
  logro('primer_fragmento'); if (got === total) logro('zona_completa');
  if (STORY_FRAGS.every(f => save.fragments.includes(f))) logro('todos_fragmentos');
  writeSave(save);
}

function lightLantern(it) {
  for (const o of world.interactables) if (o.type === 'lantern' && o !== it && !(save.flags.lit || []).includes(o.id)) o.light(false);
  save.flags.lit = [...new Set([...(save.flags.lit || []), it.id])];
  save.checkpoint = it.id; lossStreak = 0;
  it.light(true);
  fx.sparkle(it.pos.clone().setY(it.pos.y + 2), 10, 0xffd27a);
  for (const o of world.interactables) if (o.type === 'lantern' && save.flags.lit.includes(o.id)) o.light(true);
  audio.play('checkpoint');
  persist();
}

// ---------- diálogos ----------
function openDialog(it) {
  const t = zone.story && zone.story.talk && zone.story.talk[it.id];
  const res = (t && t(S)) || { lines: it.lines };
  if (it.type === 'item') player.gesture('PickUp', { speed: 1.3 });
  else if (it.type === 'trigger') player.gesture('Interact', { speed: 1.2 });
  startDialog(res.lines, it.who, it, res.then);
}
function startDialog(lines, defaultWho, it, then) {
  const norm = lines.map(l => typeof l === 'string' ? { who: defaultWho, text: l } : l);
  dialog = { lines: norm, i: 0, shown: 0, full: '', it, then };
  state = 'dialog';
  player.frozen = true;
  if (it) it.talking = true;
  $('dialog').classList.remove('hidden');
  $('prompt').classList.add('hidden');
  audio.play('open');
  showLine();
}
function showLine() {
  const d = dialog, l = d.lines[d.i];
  d.full = l.text; d.shown = 0;
  const box = $('dialog');
  box.classList.toggle('narr', l.who === '' && !l.system);
  box.classList.toggle('letter', !!l.letter);
  box.classList.toggle('system', !!l.system);
  box.classList.toggle('memory', !!l.memory);
  document.body.classList.toggle('memory', !!l.memory);
  $('dWho').textContent = l.who || '';
  $('dText').textContent = '';
  $('dChoices').innerHTML = ''; $('dChoices').classList.add('hidden');
  d.sel = 0;
  if (l.system) audio.play('checkpoint');
}
function updateDialog(dt) {
  const d = dialog;
  if (d.shown < d.full.length) {
    const before = Math.floor(d.shown);
    d.shown = Math.min(d.full.length, d.shown + dt * 55);
    if (Math.floor(d.shown) !== before && before % 3 === 0) audio.play('talk');
    $('dText').textContent = d.full.slice(0, Math.floor(d.shown));
  }
  const line = d.lines[d.i];
  if (line.choices && d.shown >= d.full.length) { // elección: botones, 1/2, flechas + E
    const box = $('dChoices');
    if (box.classList.contains('hidden')) {
      box.classList.remove('hidden');
      box.innerHTML = line.choices.map((c, i) => `<button class="choice" data-i="${i}"><b>${i + 1}</b>${c.label}</button>`).join('');
      box.querySelectorAll('.choice').forEach(b => b.onclick = e => { e.stopPropagation(); choose(+b.dataset.i); });
      $('dNext').textContent = input.isTouch ? 'toca una opción' : 'elige con 1 / 2, o con las flechas y E';
    }
    if (input.pressed('choiceUp')) d.sel = (d.sel + line.choices.length - 1) % line.choices.length;
    if (input.pressed('choiceDown')) d.sel = (d.sel + 1) % line.choices.length;
    box.querySelectorAll('.choice').forEach((b, i) => b.classList.toggle('sel', i === d.sel));
    if (input.pressed('choice1')) return choose(0);
    if (input.pressed('choice2') && line.choices.length > 1) return choose(1);
    if (input.pressed('interact')) return choose(d.sel);
    return;
  }
  if (input.pressed('interact') || input.pressed('jump') || input.pressed('click')) {
    if (d.shown < d.full.length) { d.shown = d.full.length; $('dText').textContent = d.full; return; }
    d.i++;
    if (d.i >= d.lines.length) { closeDialog(true); return; }
    showLine();
  }
  if (dialog) $('dNext').textContent = `${d.i + 1}/${d.lines.length} · ${input.usingGamepad ? input.padIcon('jump') + ' / ' + input.padIcon('interact') : input.isTouch ? 'toca' : 'E / clic'} para continuar`;
}
function choose(i) {
  const d = dialog; if (!d) return;
  const c = d.lines[d.i].choices[i]; if (!c) return;
  audio.play('checkpoint');
  closeDialog(false);
  if (c.then) c.then();
}
function closeDialog(finished) {
  $('dialog').classList.add('hidden');
  document.body.classList.remove('memory');
  const d = dialog;
  if (d && d.it) d.it.talking = false;
  dialog = null; state = 'play'; talkCooldown = 0.35;
  setTimeout(() => { player.frozen = false; }, 120);
  player.buffer = 0;
  if (finished && d && d.then) d.then();
  if (pendingEnding) { pendingEnding = false; startEnding(); }
  if (pendingChapterEnd) { pendingChapterEnd = false; showChapterEnd(); }
  if (pendingWarp) { const cp = pendingWarp; pendingWarp = null; warpTo(cp); }
  if (pendingFinale) { const k = pendingFinale; pendingFinale = null; startFinale(k); }
}
$('dialog').addEventListener('touchstart', () => input._pressed.add('click'), { passive: true });
$('dialog').addEventListener('click', () => input._pressed.add('click'));

// ---------- objetivo y brújula ----------
function updateGoal(dt) {
  if (endless.active && endless.inZone) { $('objective').classList.add('hidden'); marker.visible = false; beacon.visible = false; returnWindTick(dt, zone.story && zone.story.goal(S)); return; }
  if (!zone.story) { $('objective').classList.add('hidden'); marker.visible = false; beacon.visible = false; return; }
  const g0 = zone.story.goal(S);
  let g = g0;
  if (g0 && /^(Prólogo|Capítulo)[^.]*completado\.\s*/i.test(g0.text)) {
    const nx = zone.chapterEnd && zone.chapterEnd.next && ZONES[zone.chapterEnd.next.zone];
    const rest = g0.text.replace(/^(Prólogo|Capítulo)[^.]*completado\.\s*/i, '');
    const t = zone.id === 'puerto_bruma' ? 'Habla con Marta para zarpar hacia el Bosque Colgante' : nx ? `Vuelve con Marta: ${nx.title} os espera` : (rest.charAt(0).toUpperCase() + rest.slice(1));
    g = { ...g0, text: t };
  }
  $('objective').classList.toggle('hidden', state === 'title');
  if (g.text !== lastGoal) {
    if (lastGoal && lastGoalZone === zone.id && state === 'play' || lastGoal && state === 'dialog') {
      const o = $('objective'); o.classList.remove('flash'); void o.offsetWidth; o.classList.add('flash');
      const big = /vuelve con marta|zarpar|os espera/i.test(g.text); // se cerró la historia de la isla
      celebrateGoal(player.pos.clone(), big);
    }
    lastGoalZone = zone.id;
    lastGoal = g.text; $('objText').textContent = g.text; lossStreak = 0;
  }
  returnWindTick(dt, g);
  if (g.at) {
    const d = Math.hypot(player.pos.x - g.at[0], player.pos.z - g.at[2]);
    $('objDist').textContent = d > 3 ? `${Math.round(d)} m` : '';
    marker.visible = d > 3 && state === 'play';
    marker.position.set(g.at[0], g.at[1], g.at[2]);
    beacon.visible = d > 12 && state === 'play'; beacon.position.set(g.at[0], g.at[1], g.at[2]);
    beaconMat.opacity = 0.1 + Math.min(0.14, d / 600) + Math.sin(time * 2) * 0.03;
    arrow.position.y = 2.7 + Math.sin(time * 3) * 0.18; arrow.rotation.y = time * 2;
  } else { $('objDist').textContent = ''; marker.visible = false; beacon.visible = false; }

  // brújula: apunta al fragmento más cercano, relativo a la cámara
  const hasCompass = S.has('brujula');
  $('compass').classList.toggle('hidden', !hasCompass || state === 'title');
  if (hasCompass) {
    let best = null, bd = Infinity;
    for (const it of world.interactables) if (it.type === 'fragment') {
      const d = Math.hypot(it.pos.x - player.pos.x, it.pos.z - player.pos.z);
      if (d < bd) { bd = d; best = it; }
    }
    let ang;
    if (best) {
      const dx = best.pos.x - player.pos.x, dz = best.pos.z - player.pos.z;
      const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
      ang = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz) + Math.sin(time * 23) * Math.min(0.12, 1.5 / Math.max(bd, 1));
      $('compassDist').textContent = `${Math.round(bd)} m`;
    } else { ang = time * 1.5; $('compassDist').textContent = 'completo'; }
    $('needle').style.transform = `rotate(${ang}rad)`;
  }
}

// ---------- escena final: el dirigible zarpa ----------
function startEnding() {
  const ship = world.airships.dirigible;
  if (!ship) return;
  state = 'cutscene';
  document.body.classList.add('cine');
  $('fade').style.opacity = 1;
  cutscene = { t: 0, ship, placed: false };
}
// ---------- finales del juego ----------
function startFinale(kind) {
  state = 'cutscene'; document.body.classList.add('cine');
  save.flags['final_' + kind] = true; save.flags.juego_completado = true; writeSave(save);
  logro('un_final'); if (Object.keys(save.flags).filter(k => k.startsWith('final_')).length >= 2) logro('dos_finales');
  if (save.difficulty === 'dificil') logro('leyenda');
  const F = zone.finale[kind];
  cutscene = { t: 0, finale: true, kind, F, top0: skyMat.uniforms.top.value.clone(), bot0: skyMat.uniforms.bottom.value.clone(), fog0: scene.fog.color.clone() };
  player.frozen = true;
  audio.play('unlock'); music.play('finale', { fade: 3 });
}
function updateFinale(dt) {
  const c = cutscene, F = c.F; c.t += dt;
  const k = Math.min(1, c.t / 4);
  skyMat.uniforms.top.value.copy(c.top0).lerp(new THREE.Color(F.sky.top), k);
  skyMat.uniforms.bottom.value.copy(c.bot0).lerp(new THREE.Color(F.sky.bottom), k);
  scene.fog.color.copy(c.fog0).lerp(new THREE.Color(F.sky.fog), k);
  const at = zone.finaleAt, a = c.t * 0.18 + 0.4, r = 9 + c.t * 0.6;
  camera.position.set(at[0] + Math.sin(a) * r, at[1] + 3 + c.t * 0.5, at[2] + Math.cos(a) * r);
  camera.lookAt(at[0], at[1] + 1.5, at[2]);
  if (Math.random() < dt * 30) fx.sparkle(new THREE.Vector3(at[0] + (Math.random() - 0.5) * 16, at[1] + Math.random() * 8, at[2] + (Math.random() - 0.5) * 16), 2, F.mote);
  player.anim.update(dt, { vel: new THREE.Vector3(), grounded: true, facing: player.facing, input: { x: 0, z: 0 }, lookAt: null });
  if (c.t > 8 && !c.faded) { c.faded = true; $('fade').style.opacity = 1; }
  if (c.t > 9) {
    cutscene = null; state = 'end';
    let all = 0; for (const z of Object.values(ZONES_BASE)) all += z.fragments.length;
    const other = c.kind === 'a' ? 'b' : 'a';
    $('fade').style.opacity = 0;
    if (maybeCredits(() => showFinaleCard(c, F, all, other))) return;
    showFinaleCard(c, F, all, other);
  }
}
function showFinaleCard(c, F, all, other) {
  {
    showEndCard({
      kicker: 'Final', title: F.title,
      stats: `Tiempo de juego: ${fmtTime(save.playTime)}<br>Fragmentos encontrados: ${save.fragments.length}/${all}<br>Finales vistos: ${['a', 'b'].filter(x => save.flags['final_' + x]).length}/2`,
      sub: (save.flags['final_' + other] ? 'Viste los dos finales. ' : 'Hay otro final: vuelve al altar y elige el otro camino. ') + 'Gracias por jugar Ecos de Aethra.',
      next: { label: 'Capítulo extra: El Eco Olvidado', zone: 'eco_olvidado', cp: 'llegada' },
    });
    $('fade').style.opacity = 0;
  }
}
// ---------- si se pierden dos rondas de vidas sin avanzar, ofrecer una dificultad más baja ----------
const LOWER = { dificil: 'normal', normal: 'facil' };
function offerLowerDifficulty() {
  lossStreak = 0;
  const cur = save.difficulty || 'normal', low = LOWER[cur]; if (!low) return;
  state = 'offer'; player.frozen = true;
  $('diffOfferText').textContent = `Este tramo se está resistiendo: ya perdiste todas tus vidas dos veces. ¿Quieres seguir en ${diffName(low)} en vez de ${diffName(cur)}? Podrás seguir igual que ahora, solo será un poco más fácil.`;
  $('bDiffLower').textContent = `Bajar a ${diffName(low)}`; $('bDiffKeep').textContent = `Seguir en ${diffName(cur)}`;
  $('diffOffer').classList.remove('hidden'); navSig = '';
  const close = lower => {
    $('diffOffer').classList.add('hidden'); player.frozen = false; state = 'play';
    if (lower) { save.difficulty = low; applyPartida(); writeSave(save); toast(`Dificultad: ${diffName(low)}`); }
  };
  $('bDiffLower').onclick = () => close(true); $('bDiffKeep').onclick = () => close(false);
  $('bDiffMenu').onclick = () => { close(false); $('bTitle').onclick(); }; // volver al menú de inicio (la partida queda guardada)
}
// ---------- créditos finales: al terminar la historia y los dos capítulos extra ----------
function maybeCredits(then) {
  if (!save || challenge || save.flags.creditos) return false;
  if (!(save.flags.juego_completado && save.flags.fragmento_eco && save.flags.corazon_forja && save.flags.perla_mareth)) return false;
  playCredits(save, then); return true;
}
let creditsRun = null;
function playCredits(sv, then) {
  const nick = escapeHtml(slotName(sv, getSlot()));
  const got = Object.keys(storeOf(sv).got).length;
  let all = 0; for (const z of Object.values(ZONES_BASE)) all += z.fragments.length;
  $('creditsRoll').innerHTML = `
    <h3>Think Animation Studio presenta</h3>
    <p class="big">Ecos de Aethra</p>
    <h3>Producción ejecutiva</h3><p>Jorge Chaparro</p><p class="small">CEO de Think Animation Studio</p>
    <h3>Una producción de</h3><p>Think Animation Studio</p>
    <h3>Protagonista</h3><p>${nick} como Lía</p>
    <h3>Reparto</h3><p>Lía</p><p>Capitana Marta</p><p>Kael</p><p>Tomás</p><p>Ilan, el eco del abuelo</p><p>Brasa, la herrera de Ignis</p><p>Nerea, la buzo de Mareth</p><p>Vaelor y el Eco Sombrío</p>
    <h3>Historia, diseño, programación y música</h3><p>Creados con Claude (Anthropic)</p>
    <h3>Personajes y animaciones</h3><p>KayKit Adventurers</p><p class="small">Kay Lousberg (CC0)</p>
    <h3>Jefes, enemigos y decorados</h3><p>Hunyuan3D 2.1 (Tencent)</p><p class="small">a partir de imágenes de SDXL</p>
    <h3>Motor 3D</h3><p>three.js</p>
    <h3>Tipografía</h3><p>Fredoka</p>
    <h3>Tu aventura</h3><p class="small">Tiempo de juego: ${fmtTime(sv.playTime || 0)} · Fragmentos: ${sv.fragments.length}/${all} · Logros: ${got}/${LOGROS.length}</p>
    <h3>&nbsp;</h3><p class="big" style="font-size:clamp(26px,4vw,40px)">¡Gracias por jugar, ${nick}!</p>
    <p class="small">© Think Animation Studio</p>`;
  const prev = state; state = 'credits';
  $('credits').classList.remove('hidden'); $('bCreditsSkip').classList.add('hidden');
  setTimeout(() => $('bCreditsSkip').classList.remove('hidden'), 2500);
  music.play('creditos', { fade: 1 });
  const looks = [customLook(sv.custom || {}), 'marta', 'kael', 'tomas', 'ilan', 'brasa', 'nerea'];
  const finish = () => {
    if (!creditsRun) return; creditsRun = null;
    $('credits').classList.add('hidden'); sv.flags.creditos = true;
    if (sv === save) writeSave(save); else writeSlot(getSlot(), sv);
    state = prev === 'credits' ? 'end' : prev; music.play('finale', { fade: 2 });
    then && then();
  };
  if (!charLib) { creditsRun = { stop() {} }; setTimeout(finish, 20000); return; }
  creditsRun = runCredits({ canvas: $('creditsCanvas'), roll: $('creditsRoll'), lib: charLib, looks, duration: 60, onDone: finish });
}
$('bCreditsSkip').onclick = () => { if (creditsRun) creditsRun.stop(); };
addEventListener('keydown', e => { if (e.key === 'Escape' && creditsRun && !$('bCreditsSkip').classList.contains('hidden')) creditsRun.stop(); });
function updateCutscene(dt) {
  if (cutscene.finale) return updateFinale(dt);
  const c = cutscene; c.t += dt;
  const ship = c.ship;
  if (!c.placed && c.t > 0.7) {
    c.placed = true;
    ship.group.add(player.mesh);
    player.mesh.position.copy(ship.seat); player.mesh.rotation.set(0, Math.PI, 0);
    player.shadow.visible = false;
    $('fade').style.opacity = 0;
  }
  if (c.placed) {
    // primero sube y gira para poner la proa hacia donde va; luego avanza con el morro por delante
    const k = Math.max(0, c.t - 1.6), turn = Math.min(1, k / 2.2), e = turn * turn * (3 - 2 * turn);
    ship.yaw = Math.PI * e;
    const go = Math.max(0, k - 1.6);
    ship.offset.set(Math.sin(k * 0.4) * 1.5, Math.min(9, k * k * 0.45), go * go * 0.9);
    ship.spin = 3 + Math.min(25, k * 8);
    player.anim.update(dt, { vel: new THREE.Vector3(), grounded: true, facing: Math.PI, input: { x: 0, z: 0 }, lookAt: null });
    const sp = ship.group.position;
    camera.position.set(7 - k * 0.3, 3.2 + k * 0.25, 26 + k * 0.4);
    camera.lookAt(sp.x, sp.y + 2.5, sp.z);
  }
  if (c.t > 7.6 && !c.faded) { c.faded = true; $('fade').style.opacity = 1; }
  if (c.t > 8.4 && !c.voy) {
    c.voy = true; cutscene = null;
    voyage({ zone: 'bosque_colgante', cp: 'llegada' });
    return;
  }
  if (false) {
    const total = zone.fragments.length;
    showEndCard({
      kicker: 'Fin del prólogo', title: 'Rumbo al Bosque Colgante', sub: '',
      stats: `Tiempo de juego: ${fmtTime(save.playTime)}<br>Fragmentos de Puerto Bruma: ${S.frags()}/${total}<br>Kael: ${S.has('kael_visto') ? 'lo conociste en los islotes' : 'no lo encontraste'}`,
      next: { label: 'Continuar: Capítulo 1', zone: 'bosque_colgante', cp: 'llegada' },
    });
    $('fade').style.opacity = 0;
  }
}
// viaje al siguiente destino: un fundido con el nombre de la isla y la historia continúa allí
function voyage(next) {
  const Z = ZONES[next.zone]; if (!Z) return;
  const done = zone && zone.fragments ? `Fragmentos de ${zone.title.replace(/^(El|La|Las|Los) /, '')}: ${S.frags()}/${zone.fragments.length}` : '';
  state = 'voyage'; player.frozen = true; document.body.classList.add('cine');
  music.stinger('capitulo'); audio.play('glide');
  $('fade').style.opacity = 1;
  setTimeout(() => {
    $('voyageKicker').textContent = next.zone === 'abismo_mareth' ? 'El submarino de Marta se sumerge' : 'El dirigible de Marta zarpa rumbo a';
    $('voyageTitle').textContent = Z.title; $('voyageSub').textContent = done;
    const v = $('voyage'); v.classList.add('hidden'); void v.offsetWidth; v.classList.remove('hidden');
  }, 500);
  setTimeout(() => {
    $('voyage').classList.add('hidden');
    const ship = world.airships && world.airships.dirigible;
    if (ship && player.mesh.parent === ship.group) { scene.add(player.mesh); ship.offset.set(0, 0, 0); ship.yaw = 0; }
    document.body.classList.remove('cine'); player.frozen = false; player.shadow.visible = true;
    enterZone(next.zone, next.cp);
    $('fade').style.opacity = 0;
  }, 3200);
}
function showEndCard({ kicker, title, stats, sub, next }) {
  $('endKicker').textContent = kicker; $('endTitle').textContent = title; $('endStats').innerHTML = stats; $('endSub').textContent = sub || '';
  endNext = next || null; $('bKeepExploring').classList.remove('hidden');
  $('bNextChapter').classList.toggle('hidden', !next);
  if (next) $('bNextChapter').textContent = next.label;
  $('endcard').classList.remove('hidden');
}
function showChapterEnd() {
  if (maybeCredits(showChapterEnd)) return;
  const ce0 = zone.chapterEnd || {};
  if (ce0.next && !challenge) { voyage(ce0.next); return; }
  state = 'end'; document.body.classList.add('cine');
  music.stinger('capitulo'); music.play('finale', { fade: 2.5 });
  const total = zone.fragments.length, ce = zone.chapterEnd || {};
  const big = ['gran_fragmento_1', 'gran_fragmento_2', 'gran_fragmento_3', 'gran_fragmento_4', 'gran_fragmento_5'].filter(f => save.flags[f]).length;
  showEndCard({
    kicker: ce.kicker || 'Fin del capítulo', title: ce.title || zone.title,
    stats: `Tiempo de juego: ${fmtTime(save.playTime)}<br>Fragmentos de ${zone.title.replace(/^(El|La|Las|Los) /, '')}: ${S.frags()}/${total}<br>Grandes fragmentos: ${big}/5 · Corazones: ${player.maxHp}`,
    sub: ce.sub || '', next: ce.next,
  });
}
function leaveEnding(toTitle, quiet = false) {
  const ship = world.airships.dirigible;
  if (ship && player.mesh.parent === ship.group) { scene.add(player.mesh); ship.offset.set(0, 0, 0); ship.yaw = 0; ship.spin = 3; }
  document.body.classList.remove('cine');
  $('endcard').classList.add('hidden');
  player.frozen = false;
  if (toTitle) { if (quiet) return; endChallenge(); writeSave(save); state = 'title'; showOverlay('title'); refreshTitle(); music.play('title'); music.ambient(null); return; }
  if (zone.id === 'puerto_bruma') { player.teleport(0, 0.05, 31.5, 0); cam.snap(player); }
  state = 'play';
}
$('bNextChapter').onclick = () => { const n = endNext; leaveEnding(n && n.fn ? true : false, !!(n && n.fn)); if (n && n.fn) n.fn(); else if (n) enterZone(n.zone, n.cp); };
const fmtTime = t => `${Math.floor(t / 60)} min ${String(Math.floor(t % 60)).padStart(2, '0')} s`;
$('bKeepExploring').onclick = () => leaveEnding(false);
$('bEndTitle').onclick = () => leaveEnding(true);

// ---------- combate: vida, muerte, jefe ----------
// rocas que se desploman, chorros de fuego, péndulos
function handleHazards(dt) {
  if (!world.hz) return;
  const hits = world.hz.update(dt, player);
  for (const ev of world.hz.events.splice(0)) {
    const near = ev.pos.distanceTo(player.pos) < 28;
    if (ev.type === 'crack') { if (near) audio.play('crack'); if (!isAutoMode() && bump('rocas') >= 25) logro('pies_ligeros'); fx.dust(new THREE.Vector3(ev.pos.x, ev.pos.y, ev.pos.z), 10, 1.2, 0xd08a5a); input.rumble(60, 0.2); }
    else if (ev.type === 'crumble') { if (near) audio.play('crumble'); fx.debris(ev.pos); }
    else if (ev.type === 'crumbleBack') fx.sparkle(new THREE.Vector3(ev.pos.x, ev.pos.y + 0.3, ev.pos.z), 8, 0xffb070);
    else if (ev.type === 'fire' && near) { audio.play('fire'); fx.flare(ev.pos); }
  }
  if (state !== 'play') return;
  for (const h of hits) {
    if (h.kind === 'fire' && player.mods.fire && Math.random() > player.mods.fire) { player.vel.copy(h.push); player.invuln = 0.6; continue; } // Brasa: el fuego a veces no le quema
    if (player.damage(h.dmg, h.from)) {
      player.vel.copy(h.push); player.grounded = false; player.gliding = false;
      if (h.kind === 'fire') { fx.flare(player.pos); toast('¡Fuego! Espera a que se apague el chorro'); } else combat.shake(0.12, 0.2);
    }
  }
}
function handlePlayerEvents() {
  for (const ev of player.events) {
    if (ev.type === 'gustWarn') { fx.wind(player.pos, ev.dir.x, ev.dir.z); audio.play('glide'); input.rumble(120, 0.25); }
    if (ev.type === 'tired') toast('¡El planeador se cansó! Aterriza o busca una corriente de aire');
    if (ev.type === 'hurt') { if (bossActive) bossHurt = true; combat.shake(0.25, 0.25); input.rumble(220, 0.7); $('hudHearts').classList.remove('hit'); void $('hudHearts').offsetWidth; $('hudHearts').classList.add('hit'); }
    if (ev.type === 'dead') startDeath();
    if (ev.type === 'pulse') doPulse(ev.pos, ev.radius);
    if (ev.type === 'swing' && ev.idx === 2 && player.gear && player.gear.w === 'eco' && state === 'play') { doPulse(player.pos.clone(), 4.5); audio.play('beam'); }
    if (ev.type === 'power' && state === 'play') { const r = powers.cast(player, ev.id, storyFoes); if (r === 'none') { toast('No hay nadie al alcance'); audio.play('powerFail'); } else if (r === false) audio.play('powerFail'); }
  }
  player.events = player.events.filter(e => e.type === 'hitcheck' || e.type === 'swing');
}
// Pulso de luz: enciende cristales, deshace barreras de sombra y afecta a enemigos y al jefe.
function doPulse(pos, r) {
  const sph = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff2a8, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  sph.position.copy(pos).setY(pos.y + 0.9); scene.add(sph); pulseFx.push({ m: sph, t: 0, r });
  combat.pulse(pos, r);
  for (const C of world.lightCrystals) if (!C.on && C.pos.distanceTo(pos) < r + 0.5) { C.set(true); if (C.flag) S.set(C.flag); audio.play('unlock'); toast('¡El cristal de luz se enciende!'); }
  for (const B of world.darkBarriers) if (!B.gone && B.pos.distanceTo(pos) < r + B.half) { world.dispelBarrier(B); fx.sparkle(B.pos, 30, 0xfff2a8); if (B.flag) S.set(B.flag); audio.play('unlock'); }
}
// ---------- nivel submarino: nadar, aire, ahogo y submarino ----------
const drown = { t: 0, on: false, beatT: 0 }; let underFog = null, aboveFog = null;
function seaBefore(dt) {
  const sea = world.sea, p = player.pos;
  player.seaY = sea.surface;
  const dome = sea.inDome(p), was = player.swimming;
  player.swimming = player.inSub || (!dome && p.y + 1.1 < sea.surface);
  if (player.swimming && !was && !player.inSub) { audio.play('splash'); fx.dust(p.clone().setY(sea.surface), 10, 1.2, 0xdff6ff); player.vel.multiplyScalar(0.35); }
  player.flow = sea.currentAt(p);
  if (player.air == null) player.air = 1;
}
function seaAfter(dt) {
  const sea = world.sea, p = player.pos, cap = ((player.diff && player.diff.air) || 22) * (player.mods.air || 1);
  const head = p.y + 1.55 < sea.surface && !sea.inDome(p);
  if (player.inSub) player.air = Math.min(1, player.air + dt);
  else if (head && player.swimming) player.air = Math.max(0, player.air - dt / cap);
  else player.air = Math.min(1, player.air + dt * 0.7);
  if (state === 'play') {
    const got = player.inSub ? 0 : sea.takeBubble(p);
    if (got) { player.air = Math.min(1, player.air + got); audio.play('bubble'); if (!isAutoMode() && bump('burbujas') >= 15) logro('pulmones'); fx.sparkle(p.clone().setY(p.y + 1), 10, 0xcff6ff); }
    for (const h of sea.update(dt, player, camera, !!player.inSub)) if (player.damage(1, h.from)) { player.vel.copy(h.push); audio.play('fire'); toast('¡Una medusa! Su picadura quema'); }
    for (const ev of sea.events.splice(0)) if (ev.type === 'coral') { audio.play('crumble'); combat.shake(0.25, 0.3); fx.debris(ev.pos); input.rumble(200, 0.6); toast('¡Coral roto!'); }
    if (player.inSub) {
      sea.ram(p, player.vel);
      sea.sub.position.set(p.x, p.y - 0.4, p.z);
      sea.sub.rotation.y += Math.atan2(Math.sin(player.facing - sea.sub.rotation.y), Math.cos(player.facing - sea.sub.rotation.y)) * Math.min(1, dt * 5);
      sea.sub.rotation.z = Math.max(-0.2, Math.min(0.2, -player.vel.x * 0.01));
      // Lía a los mandos, dentro de la cabina de cristal
      sea.sub.updateMatrixWorld(); const seat = sea.sub.localToWorld(sea.sub.userData.seat.clone());
      player.mesh.visible = true; player.mesh.position.copy(seat); player.mesh.rotation.set(0, sea.sub.rotation.y, 0); player.mesh.scale.setScalar(0.55);
      // estela de burbujas de la hélice
      const sp = Math.hypot(player.vel.x, player.vel.y, player.vel.z);
      if (sp > 1 && Math.random() < dt * 30) { const pp = sea.sub.localToWorld(new THREE.Vector3((Math.random() - 0.5) * 0.6, 1.0 + (Math.random() - 0.5) * 0.6, 2.9)); fx._spawn(pp, new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.8 + Math.random(), (Math.random() - 0.5) * 0.6), { life: 1.4, size: 0.05 + Math.random() * 0.05, grow: 0.6, color: 0xe8fbff, opacity: 0.8, grav: 2.5 }); }
    } else if (player.mesh.scale.x !== 1) player.mesh.scale.setScalar(1);
    // burbujas que suelta Lía al nadar
    if (player.swimming && !player.inSub && Math.random() < dt * 1.6) fx._spawn(new THREE.Vector3(player.pos.x, player.pos.y + 1.5, player.pos.z), new THREE.Vector3((Math.random() - 0.5) * 0.3, 1.2, (Math.random() - 0.5) * 0.3), { life: 1.6, size: 0.05, grow: 0.5, color: 0xe8fbff, opacity: 0.75, grav: 2 });
    // ahogo: sin aire, Lía deja de nadar y se hunde; al final pierde un corazón
    if (player.air <= 0 && !drown.on) { drown.on = true; drown.t = 0; player.drowning = true; audio.play('gulp'); }
    if (drown.on && player.air > 0.15) { drown.on = false; player.drowning = false; }
    if (drown.on) { drown.t += dt; if (drown.t > 3.4) drownDeath(); }
  }
  seaFx(dt);
}
function seaFx(dt) {
  const sea = world.sea; if (!sea) return;
  const a = player.air ?? 1, danger = Math.max(0, Math.min(1, (0.35 - a) / 0.35)), d = drown.on ? Math.min(1, drown.t / 3.4) : 0;
  const showAir = (player.swimming && !player.inSub) || a < 0.999;
  $('airBar').classList.toggle('hidden', !showAir || state === 'title');
  $('airFill').style.width = (a * 100).toFixed(1) + '%'; $('airBar').classList.toggle('low', a < 0.3);
  $('drownFx').style.opacity = Math.min(1, danger * 0.85 + d * 0.4).toFixed(3);
  const blur = (danger > 0.5 ? (danger - 0.5) * 8 : 0) + d * 9, bright = 1 - danger * 0.3 - d * 0.7;
  renderer.domElement.style.filter = blur > 0.05 || bright < 0.99 ? `blur(${blur.toFixed(1)}px) brightness(${bright.toFixed(2)})` : '';
  $('blackout').style.opacity = d > 0.6 ? ((d - 0.6) / 0.4).toFixed(2) : 0;
  if (danger > 0 || d > 0) { // latidos cada vez más lentos
    drown.beatT -= dt;
    if (drown.beatT <= 0) { drown.beatT = 0.42 + danger * 0.7 + d * 1.6; audio.play('heart'); input.rumble(90, 0.35 + danger * 0.4); const v = $('drownFx'); v.classList.remove('beat'); void v.offsetWidth; v.classList.add('beat'); }
  } else drown.beatT = 0;
  // bajo el agua: niebla azul y tinte
  const under = camera.position.y < sea.surface - 0.05;
  if (!aboveFog) aboveFog = scene.fog;
  if (under) { if (!underFog) underFog = new THREE.Fog(0x0e5a7a, 3, 48); scene.fog = underFog; } else scene.fog = aboveFog;
  $('underTint').classList.toggle('hidden', !under);
}
function clearSeaFx() {
  renderer.domElement.style.filter = ''; for (const id of ['drownFx', 'blackout']) $(id).style.opacity = 0;
  $('airBar').classList.add('hidden'); $('underTint').classList.add('hidden');
  drown.on = false; player.drowning = false; player.air = 1; underFog = null; aboveFog = null;
}
function drownDeath() {
  drown.on = false; player.drowning = false;
  player.hp -= 1; $('hudHearts').classList.remove('hit'); void $('hudHearts').offsetWidth; $('hudHearts').classList.add('hit');
  if (player.hp <= 0) { player.hp = 0; startDeath(); return; }
  setSub(false, true); respawn(save.checkpoint); player.air = 1; player.vel.set(0, 0, 0);
  toast('Te quedaste sin aire: vuelves al último farol con un corazón menos');
}
function restartSeaLevel() {
  const pre = zone.flagPrefix || 'mr_';
  for (const k of Object.keys(save.flags)) if (k.startsWith(pre)) delete save.flags[k];
  save.checkpoint = zone.start.id; player.hp = player.maxHp; player.invuln = 1.5;
  setSub(false, true); clearSeaFx(); writeSave(save);
  $('fade').style.opacity = 0; state = 'play';
  enterZone(zone.id, zone.start.id);
  toast('Sin corazones: el nivel empieza de nuevo');
}
function setSub(on, silent) {
  const sea = world.sea; if (!sea) { player.inSub = false; return; }
  if (on) {
    player.inSub = true; sea.parked = null; sea.sub.visible = true; player.swimming = true; player.air = 1;
    if (!silent) { audio.play('dash'); toast('A bordo: muévete, Espacio para subir y K para bajar. ¡Embiste los corales!'); }
  } else if (player.inSub) {
    player.inSub = false; sea.parked = sea.sub.position.clone(); player.mesh.visible = true;
    if (!silent) audio.play('splash');
  }
}
// el viento del Sello: fundido, aparecer junto al farol de vuelta y guardar allí
function warpTo(cp) {
  $('fade').style.opacity = 1; player.frozen = true; fx.rainbow(player.pos.clone().setY(player.pos.y + 1), 30);
  setTimeout(() => { save.checkpoint = cp; respawn(cp); writeSave(save); player.frozen = false; $('fade').style.opacity = 0; toast('El viento del Sello te devolvió al camino'); }, 700);
}
function startDeath() {
  if (state === 'dead') return;
  state = 'dead'; deadT = 0;
  player.gesture('Death_A', { speed: 1.2, fadeIn: 0.05, fadeOut: 0.01 });
  audio.play('hurt'); music.stinger('derrota');
}
function updateDeath(dt) {
  deadT += dt;
  player.update(dt, { move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, pressed: () => false, held: () => false, walk: false }, cam.yaw);
  if (deadT > 1.0) $('fade').style.opacity = 1;
  if (deadT > 1.7 && endless.active) { endlessOver(); return; } // sin corazones en Aethra sin fin: fin de la carrera
  if (deadT > 1.7 && world.sea) { restartSeaLevel(); return; } // sin corazones bajo el mar: el nivel empieza de nuevo
  if (deadT > 1.7) {
    combat.spawnZone(zone, save); bossActive = false; $('bossbar').classList.add('hidden');
    player.hp = player.maxHp; player.invuln = 1.5;
    respawn(save.checkpoint);
    $('fade').style.opacity = 0; state = 'play';
    toast('Lía se levanta junto al farol');
    if (!challenge && !isAutoMode() && ++lossStreak >= 2) offerLowerDifficulty();
  }
}
// Garfio: elige el anillo más cercano delante de la cámara y lo marca en pantalla.
const _v = new THREE.Vector3();
function updateGrapple() {
  hookTarget = null;
  const hint = $('hookHint');
  if (!player.canGrapple || state !== 'play' || player.grapple) { hint.style.display = 'none'; return; }
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
  let best = Infinity;
  for (const g of [...world.grapplePoints, ...combat.grapplePoints]) {
    if (g.active === false) continue;
    const dx = g.pos.x - player.pos.x, dy = g.pos.y - player.pos.y, dz = g.pos.z - player.pos.z;
    const d = Math.hypot(dx, dy, dz), dh = Math.hypot(dx, dz);
    if (d > 20 || d < 1.8) continue;
    const facing = dh < 2 ? 1 : (dx * fx + dz * fz) / dh;
    if (facing < 0.35) continue;
    const score = d * (1.6 - facing);
    if (score < best) { best = score; hookTarget = g; }
  }
  for (const g of world.grapplePoints) g.highlight = g === hookTarget;
  if (hookTarget) {
    _v.copy(hookTarget.pos).project(camera);
    if (_v.z < 1) {
      hint.style.display = 'block';
      hint.style.left = `${(_v.x * 0.5 + 0.5) * innerWidth}px`; hint.style.top = `${(-_v.y * 0.5 + 0.5) * innerHeight}px`;
      $('hookKey').textContent = input.usingGamepad ? 'RB' : input.isTouch ? 'GARFIO' : 'G';
    } else hint.style.display = 'none';
    if (input.pressed('grapple')) player.startGrapple(hookTarget);
  } else hint.style.display = 'none';
}
function inBox(p, b) { return p.x >= b[0] && p.y >= b[1] && p.z >= b[2] && p.x <= b[3] && p.y <= b[4] && p.z <= b[5]; }
function checkRegions() {
  if (state !== 'play') return;
  for (const r of zone.regions || []) if (!save.flags[r.flag] && inBox(player.pos, r.box)) S.set(r.flag);
  const B = zone.boss;
  if (B && combat.boss && combat.boss.state === 'sleep' && inBox(player.pos, B.region)) {
    bossActive = true;
    startDialog(zone.story.bossIntro, '', null, () => { combat.boss.wake(); bossHurt = false; });
  }
}
combat.onBossDefeated = () => {
  if (!bossHurt) logro('jefe_intacto');
  if (zone.id === 'eco_olvidado') logro('eco_secreto');
  else if (!isAutoMode() && addTo('guardianes', zone.id) >= 5) logro('cinco_guardianes');
  music.stinger('victoria'); addEcos(ECO_REWARD.jefe);
  bossActive = false;
  setTimeout(() => { startDialog(zone.story.bossDefeated, '', null, () => { zone.story.onBossDefeated && zone.story.onBossDefeated(S); player.gesture('Cheer', { speed: 1.2 }); }); }, 300);
};
combat.onBossClang = () => { if (!hintClang) { hintClang = true; toast({ bosque_colgante: 'El tronco es demasiado duro. ¡Golpea los nudos brillantes de las raíces!', ruinas_vidrio: 'Su caparazón es irrompible. Haz que choque contra un pilar.', ciudad_engranajes: 'El latón es demasiado duro. Espera a que se atasque tras el puñetazo.', glaciar_eco: 'Está demasiado alto. Devuélvele un orbe de hielo con el escudo (mantén V).', ciudadela_orden: 'La barrera de sombra lo protege. Rómpela con el pulso de luz (Z) o devolviéndole un orbe con el escudo.' }[zone.id] || 'Demasiado duro'); } };
combat.onKill = e => {
  if (arena.active) { arena.onKill(e); return; }
  if (!isAutoMode() && !challenge) { bump('enemigos'); addEcos(ECO_REWARD.enemigo, e.pos); }
  if (e.constructor.name === 'Avispa' && !isAutoMode() && bump('avispas') >= 10) logro('cazavispas');
};
// efectos especiales de las espadas de la Armería
combat.onWeaponHit = (e, pl) => {
  if (pl !== player || !player.gear) return;
  const W = weaponById(player.gear.w);
  if (W.fx === 'burn' && e.alive) {
    let n = 0; powers.fx.push({ t: 0, update: (dt, f) => { f.t += dt; if (!e.alive) return true; if (Math.random() < 0.4) fx.sparkle(e.pos.clone().setY(e.pos.y + 0.5 + Math.random() * 0.6), 1, 0xff8a3a); if (f.t > 0.9 * (n + 1)) { n++; e.hurt(1, e.pos.clone().add(new THREE.Vector3(0, 0, 0.01)), 0); audio.play('fire', e.pos); } return n >= 2; } });
  }
  if (W.fx === 'freeze' && e.alive && Math.random() < 0.25) enemyTarget(e).hit(0, 'ice', player.pos, { t: 1.5 });
};
combat.onBossPhase = b => toast((b && b.phaseMsg) || '¡El guardián está furioso!');
combat.onLockHit = L => { world.openLock(L); if (L.flag) S.set(L.flag); audio.play('unlock'); fx.sparkle(L.pos, 30, 0xbff4ff); toast('¡La cerradura de hielo se rompe!'); };
combat.onAuraClang = () => { if (!hintAura) { hintAura = true; toast(player.canPulse ? 'Un aura de sombra lo protege. ¡Usa el pulso de luz (Z)!' : 'Un aura de sombra lo protege.'); } };
combat.onBossStun = () => { if (!hintStun) { hintStun = true; toast({ ruinas_vidrio: '¡Está aturdido! Golpea el cristal de su cola', ciudad_engranajes: '¡Se quedó atascado! Lanza el garfio al anillo de su pecho', glaciar_eco: '¡Cayó al suelo! Golpea el cuerno de cristal', ciudadela_orden: '¡Su barrera se rompió! Golpéalo ahora' }[zone.id] || '¡Ahora!'); } };
function updateCombatHUD() {
  if (player.hp !== lastHp || player._lastMax !== player.maxHp) {
    lastHp = player.hp; player._lastMax = player.maxHp;
    $('hudHearts').innerHTML = '♥'.repeat(Math.max(0, player.hp)) + `<span class="e">${'♥'.repeat(Math.max(0, player.maxHp - player.hp))}</span>`;
  }
  const b = combat.boss;
  const show = b && (b.state === 'intro' || b.fighting || b.state === 'dying');
  $('bossbar').classList.toggle('hidden', !show);
  if (show) { $('bossName').textContent = b.name; $('bossFill').style.width = `${Math.max(0, b.hp / b.maxHp) * 100}%`; }
}

// ---------- UI ----------
function updateGlideBar() { // aguante del planeador
  const show = state === 'play' && player.canGlide && !player.grounded && (player.gliding || player.stamina < player.glideMax - 0.05);
  $('glideBar').classList.toggle('hidden', !show);
  if (!show) return;
  const k = player.stamina / player.glideMax;
  $('glideFill').style.width = (k * 100).toFixed(1) + '%';
  $('glideBar').classList.toggle('low', k < 0.28);
}
function updateHUD() {
  updateGlideBar();
  const total = zone.fragments.length, got = zone.fragments.filter(f => save.fragments.includes(f.id)).length;
  $('hudFrag').textContent = `◆ ${got}/${total}`;
  $('hudEcos').textContent = `✧ ${save.ecos || 0}`;
}
// Ecos (✧): la moneda de la Armería
let ecoPopT = 0;
function addEcos(n, pos) {
  if (!save || isAutoMode() || !n) return;
  save.ecos = (save.ecos || 0) + n;
  const el = $('hudEcos'); el.textContent = `✧ ${save.ecos}`; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  if (pos && n >= 3) fx.sparkle(pos.clone().setY(pos.y + 1), Math.min(16, 4 + n), 0xffe9a8);
  if (n >= 10) toast(`✧ +${n} Ecos`);
}
let toastT = 0;
function toast(msg) { $('toast').textContent = msg; $('toast').style.opacity = 1; toastT = 2.4; }
// ---------- logros ----------
const isAutoMode = () => !!(player.diff && player.diff.auto);
const achvQ = []; let achvT = 0, glideRun = 0, bossHurt = false;
// los logros son de la partida en juego (durante un desafío, de la partida desde la que se abrió)
const partida = () => (challenge ? challenge.owner : save);
function persistPartida() { const sv = partida(); if (!sv) return; if (challenge) writeSlot(getSlot(), sv); else writeSave(save); }
function logro(id) { const L = unlock(partida(), id, isAutoMode()); if (L) { achvQ.push(L); persistPartida(); } }
const bump = (k, by) => bumpL(partida(), k, by), addTo = (k, v) => addToL(partida(), k, v);
let misT = 0;
function logrosTick(dt) {
  if ((misT -= dt) <= 0) { misT = 1; if (state === 'play' || state === 'arena') checkMissions(); }
  glideRun = player.gliding && !player.grounded ? glideRun + dt : 0;
  if (glideRun >= 12) logro('ave');
  if (achvT > 0 && (achvT -= dt) <= 0) $('achv').classList.remove('show');
  if (achvT <= -0.5 && achvQ.length) {
    const L = achvQ.shift(); achvT = 3.4;
    $('achvIcon').textContent = L.icon; $('achvTitle').textContent = L.title; $('achvDesc').textContent = L.desc; $('achv').querySelector('small').textContent = L.kicker || 'Logro conseguido';
    $('achv').classList.add('show'); audio.play('unlock');
  }
  if (achvT <= 0) achvT = Math.max(-1, achvT - dt);
}
const STORY_FRAGS = Object.entries(ZONES_BASE).flatMap(([, Z]) => (Z.fragments || []).map(f => f.id));

let bannerT = 0;
function banner(a, b) { $('zbT1').textContent = a; $('zbT2').textContent = b; $('zoneBanner').style.opacity = 1; bannerT = 2.8; }

function showOverlay(id) {
  for (const o of ['title', 'pause']) $(o).classList.toggle('hidden', o !== id);
  $('hud').classList.toggle('hidden', id === 'title');
  document.body.classList.toggle('atTitle', id === 'title'); // en el título no se ve el HUD del juego
  if (id === 'title') clearSeaFx();
}
function showPausePanel(p) {
  $('pauseMain').classList.toggle('hidden', p !== 'main');
  $('controlsPanel').classList.toggle('hidden', p !== 'controls');
  $('settingsPanel').classList.toggle('hidden', p !== 'settings');
  $('savePanel').classList.toggle('hidden', p !== 'save');
}

// ---------- pantalla de título: Continuar / Nueva partida ----------
const DIFF_INFO = [
  ['facil', 'Cuento', 'Más corazones de ventaja, los golpes duelen la mitad y caer no hace daño.', '☁'],
  ['normal', 'Aventura', 'La experiencia pensada para el juego.', '⚔'],
  ['dificil', 'Leyenda', 'Los enemigos pegan el doble y los jefes aguantan más.', '♜'],
  ['auto', 'Automático', 'Lía juega sola y tú miras. No cuenta para logros ni récords.', '★'],
];
const diffName = k => (DIFF_INFO.find(d => d[0] === k) || DIFF_INFO[1])[1];
const lookColor = sv => { const look = { ...DEFAULT_CUSTOM, ...((sv && sv.custom) || {}) }; return '#' + ((CUSTOM.ropa.find(o => o[0] === look.ropa) || CUSTOM.ropa[0])[3]).toString(16).padStart(6, '0'); };
const slotName = (sv, n) => (sv && sv.name) || `Partida ${n}`;
function slotCard(n, sv, onclick) {
  const b = document.createElement('button'); b.className = 'slot';
  const Z = ZONES_BASE[sv.zone] || ZONES[sv.zone], got = Object.keys(storeOf(sv).got).length;
  b.innerHTML = `<span class="dot" style="background:${lookColor(sv)}"></span><span style="flex:1"><b>${escapeHtml(slotName(sv, n))}</b><small>${Z ? Z.subtitle + ' · ' + Z.title : ''}</small>`
    + `<span class="meta"><span>⏱ ${fmtTime(sv.playTime || 0)}</span><span>◆ ${sv.fragments.length}</span><span>✦ ${(sv.relics || []).length}</span><span>🏆 ${got}/${LOGROS.length}</span></span></span><span class="dd">${diffName(sv.difficulty || settings.difficulty)}</span>`;
  b.onclick = onclick; return b;
}
function escapeHtml(t) { return String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const TITLE_PANELS = ['namePanel', 'replacePanel', 'diffPanel', 'slotsPanel', 'hubPanel', 'challengesPanel'];
function titlePanel(id) {
  for (const p of TITLE_PANELS) $(p).classList.toggle('hidden', p !== id);
  $('titleMain').classList.toggle('hidden', !!id);
  navSig = '';
  const f = id && $(id).querySelector('input, button:not(:disabled)'); if (f && !input.isTouch) setTimeout(() => f.focus(), 30);
}
// cada partida guarda su propio aspecto de personaje
function applySlotLook() {
  if (!charLib) return;
  const sv = loadSave(); const cfg = (sv && sv.custom) || {};
  player.useModel(charLib, heroLook(sv && sv.hero, cfg)); player.setFight(player.canFight);
}
// héroe elegido: aspecto y ventajas
function applyHero() {
  if (!save) return;
  const h = heroUnlocked(heroById(save.hero), pieceCount(save)) ? heroById(save.hero) : HEROES[0];
  save.hero = h.id; const gg = gearOf(save); player.gear = { w: gg.arma, a: gg.armadura }; player.mods = mergeMods(h.mods, save);
  if (!charLib) player.equip(gg.arma, gg.armadura);
  if (charLib) { player.useModel(charLib, heroLook(h.id, save.custom)); player.setFight(player.canFight); }
  if (!isAutoMode() && !challenge) addTo('heroes', h.id);
}
function refreshTitle() {
  $('bContinue').classList.toggle('hidden', listSaves().length === 0);
  titlePanel(null);
}
refreshTitle();

// --- Nueva partida: nombre → dificultad → personaje ---
const nueva = { name: '', slot: 0, diff: 'normal' };
$('bNew').onclick = () => { audio.unlock(); $('nickInput').value = ''; $('nameMsg').textContent = ''; titlePanel('namePanel'); };
$('bNameBack').onclick = () => titlePanel(null);
$('nickInput').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') $('bNameOk').click(); };
$('bNameOk').onclick = () => {
  const name = $('nickInput').value.trim().replace(/\s+/g, ' ');
  if (!name && !input.usingGamepad) { $('nameMsg').textContent = 'Escribe un nombre para tu partida.'; return; }
  nueva.name = (name || `Jugador ${freeSlot() || 1}`).slice(0, 16); // con mando no se puede escribir: nombre por defecto
  nueva.slot = freeSlot();
  if (!nueva.slot) { // no queda sitio: elegir una para reemplazar
    const list = $('replaceList'); list.innerHTML = '';
    for (const { n, s: sv } of listSaves()) {
      const b = slotCard(n, sv, () => {
        if (!b.dataset.ok) { b.dataset.ok = '1'; b.querySelector('b').textContent = `¿Reemplazar «${slotName(sv, n)}»? Pulsa otra vez`; return; }
        nueva.slot = n; showDiffPanel();
      });
      list.appendChild(b);
    }
    titlePanel('replacePanel'); return;
  }
  showDiffPanel();
};
$('bReplaceBack').onclick = () => titlePanel('namePanel');
function showDiffPanel() {
  const box = $('diffCards'); box.innerHTML = '';
  for (const [k, name, desc, ic] of DIFF_INFO) {
    const b = document.createElement('button');
    b.innerHTML = `<span class="ic">${ic}</span><b>${name}</b><small>${desc}</small>`;
    b.onclick = () => { nueva.diff = k; audio.play('open'); openCustom('new'); };
    box.appendChild(b);
  }
  titlePanel('diffPanel');
}
$('bDiffBack').onclick = () => titlePanel('namePanel');
function createPartida(custom) {
  const sv = newSave({ name: nueva.name, difficulty: nueva.diff, custom });
  storeOf(sv); // logros vacíos de la partida (hereda los antiguos solo si los había)
  sv.logros = { got: {}, n: {} };
  setSlot(nueva.slot); writeSlot(nueva.slot, sv);
  startGame(sv);
}

// --- Continuar: lista de partidas y menú de cada una ---
$('bContinue').onclick = () => {
  audio.unlock();
  const list = $('slotList'); list.innerHTML = '';
  for (const { n, s: sv } of listSaves()) list.appendChild(slotCard(n, sv, () => { setSlot(n); applySlotLook(); audio.play('open'); openHub(); }));
  titlePanel('slotsPanel');
};
$('bSlotsBack').onclick = () => titlePanel(null);
function openHub() {
  const sv = loadSave(); if (!sv) { refreshTitle(); return; }
  const Z = ZONES_BASE[sv.zone] || ZONES[sv.zone];
  $('hubHead').innerHTML = `<span class="dot" style="background:${lookColor(sv)}"></span><span><b>${escapeHtml(slotName(sv, getSlot()))}</b><small>${Z ? Z.subtitle + ' · ' + Z.title : ''} · ${diffName(sv.difficulty || settings.difficulty)} · ⏱ ${fmtTime(sv.playTime || 0)}</small></span>`;
  $('bHubDelete').textContent = 'Borrar partida'; delete $('bHubDelete').dataset.ok;
  const ex = $('hubExtras'); ex.innerHTML = '';
  if (sv.flags.juego_completado) {
    for (const [id, label] of [['eco_olvidado', 'Extra: El Eco Olvidado'], ['forja_ignis', 'Extra: Las Forjas de Ignis'], ['abismo_mareth', 'Extra: Las Profundidades de Mareth']]) {
      const b = document.createElement('button'); b.className = 'btn alt small'; b.textContent = label;
      b.onclick = () => { audio.unlock(); music.init(); goFull(); save = sv; applyPartida(); showOverlay(null); enterZone(id); };
      ex.appendChild(b);
    }
  }
  if (sv.flags.creditos) { const b = document.createElement('button'); b.className = 'btn alt small'; b.textContent = 'Ver créditos'; b.onclick = () => playCredits(sv, () => { showOverlay('title'); openHub(); }); ex.appendChild(b); }
  ex.classList.toggle('hidden', !ex.children.length);
  titlePanel('hubPanel');
}
$('bHubPlay').onclick = () => startGame(loadSave() || newSave());
$('bHubBack').onclick = () => $('bContinue').click();
$('bHubLogros').onclick = () => openTrophies('title');
$('bHubCustom').onclick = () => openCustom('title');
$('bHubDelete').onclick = () => {
  const b = $('bHubDelete');
  if (!b.dataset.ok) { b.dataset.ok = '1'; b.textContent = '¿Seguro? Pulsa otra vez para borrarla'; return; }
  deleteSave(getSlot()); audio.play('open'); toast('Partida borrada');
  if (listSaves().length) $('bContinue').click(); else refreshTitle();
};

// En el teléfono: pantalla completa y horizontal al empezar a jugar
function goFull() {
  if (!input.isTouch) return;
  try { const r = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); if (r && r.then) r.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {}); } catch (e) {}
}
// dificultad y aspecto de la partida en juego
function applyPartida() {
  const dk = DIFF[save && save.difficulty] ? save.difficulty : (DIFF[settings.difficulty] ? settings.difficulty : 'normal');
  if (save && !save.difficulty) save.difficulty = dk;
  player.diff = DIFF[dk]; combat.difficulty = dk; lossStreak = 0;
}
function startGame(s) {
  audio.unlock(); music.init(); goFull();
  if (!s.custom && settings.custom) s.custom = settings.custom; // partidas antiguas: el aspecto que había elegido
  save = s; storeOf(save); applyPartida();
  applyHero();
  writeSave(save);
  showOverlay(null);
  enterZone(save.zone, save.checkpoint);
}
// ---------- modo automático: Lía supera los retos sola ----------
// Camina hacia el objetivo; si hay un hueco, una subida o se atasca, vuela con el planeador hasta él.
// Al llegar habla, recoge, enciende cristales, rompe cerraduras o barreras, y en los jefes los derrota poco a poco.
const auto = { stats: { flights: 0, edges: 0, fails: 0, kinds: {} }, fly: null, stuckT: 0, last: new THREE.Vector3(), nearT: 0, goalKey: '', bossT: 0, atkT: 0, readT: 0, endT: 0 };
function nearestFragment() {
  let best = null, bd = Infinity;
  for (const it of world.interactables) if (it.type === 'fragment') { const d = it.pos.distanceTo(player.pos); if (d < bd) { bd = d; best = it; } }
  if (!best) return null; const v = best.pos.clone(); v.precise = true; return v;
}
function autoTarget() {
  if (window.__forceT) { const v = new THREE.Vector3(...window.__forceT); v.precise = false; return v; } // pruebas: objetivo forzado
  if (challenge) { const f = nearestFragment(); if (f) return f; if (world.portal && world.portal.open) { const v = world.portal.pos.clone(); v.precise = true; return v; } return null; } // cristales y luego el portal
  if (!zone.story) return null;
  const b = combat.boss;
  if (b && b.fighting) return null; // en la pelea se queda en su sitio
  const g = zone.story.goal(S); if (!g) return null;
  if (g.auto) return new THREE.Vector3(...g.auto); // pista para el modo automático (p. ej. adónde lleva una seta)
  return g.at ? new THREE.Vector3(...g.at) : nearestFragment(); // sin lugar marcado: busca fragmentos
}
function autoSolveNear(p, r) { // mecanismos cerca del objetivo
  for (const L of world.locks) if (!L.open && L.pos && L.pos.distanceTo(p) < r) combat.onLockHit(L);
  for (const C of world.lightCrystals) if (!C.on && C.pos.distanceTo(p) < r) { C.set(true); if (C.flag) S.set(C.flag); audio.play('unlock'); }
  for (const B of world.darkBarriers) if (!B.gone && B.pos.distanceTo(p) < r + (B.half || 0)) { world.dispelBarrier(B); if (B.flag) S.set(B.flag); audio.play('unlock'); }
}
function autoPilot(dt) {
  input.autoJump = false; input.autoDown = false;
  // diálogos: deja leer y avanza solo; en las elecciones toma la primera opción
  if (state === 'dialog' && dialog) {
    auto.readT += dt;
    const line = dialog.lines[dialog.i];
    if (dialog.shown >= dialog.full.length && auto.readT > 1.2 + dialog.full.length * 0.03) { auto.readT = 0; if (line && line.choices) choose(0); else input._pressed.add('interact'); }
    return;
  }
  auto.readT = 0;
  if (state === 'end') { auto.endT += dt; if (auto.endT > 6) { auto.endT = 0; const b = $('bNextChapter'); if (b && !b.classList.contains('hidden')) b.click(); } return; }
  auto.endT = 0;
  if (state !== 'play' || auto.fly) return;
  // enemigos cercanos: los golpea
  auto.atkT -= dt;
  for (const e of combat.enemies) if (e.alive && e.pos.distanceTo(player.pos) < 2.4 && auto.atkT <= 0) {
    player.facing = Math.atan2(-(e.pos.x - player.pos.x), -(e.pos.z - player.pos.z)); input._pressed.add('attack'); auto.atkT = 0.45;
    if (e.dispel) e.dispel();
  }
  // jefe: cada pocos segundos le acierta en su punto débil
  const b = combat.boss;
  if (b && b.fighting) {
    auto.bossT += dt; input.move.x = input.move.y = 0;
    const want = Math.atan2(-(b.pos.x - player.pos.x), -(b.pos.z - player.pos.z)); cam.yaw += angleDiff(want, cam.yaw) * Math.min(1, dt * 2);
    if (auto.bossT > 2.6) { auto.bossT = 0; input._pressed.add('attack'); combat.autoWound(); }
    return;
  }
  const T = autoTarget(); if (!T) { input.move.x = input.move.y = 0; return; }
  const dx = T.x - player.pos.x, dz = T.z - player.pos.z, dh = Math.hypot(dx, dz), up = T.y - player.pos.y;
  const key = `${zone.id}|${lastGoal}|${T.x.toFixed(1)},${T.z.toFixed(1)}`;
  if (key !== auto.goalKey) { auto.goalKey = key; auto.nearT = 0; auto.stuckT = 0; }
  if (dh < (T.precise ? 0.45 : 1.6) && Math.abs(up) < 2.2) { // llegó
    input.move.x = 0; input.move.y = auto.nearT > 1.5 && auto.nearT < 3.5 && !focus ? 1 : 0; auto.nearT += dt; // si no pasa nada, sigue un poco hacia delante
    if (focus && auto.nearT > 0.4 && talkCooldown <= 0) input._pressed.add('interact');
    autoSolveNear(T, 6);
    if (auto.nearT > 5) { // si nada cambia, prueba con todo lo que hay alrededor
      for (const it of world.interactables) if (it.pos.distanceTo(player.pos) < 6 && it.type !== 'fragment' && it.type !== 'relic' && it.active !== false) { openDialog(it); break; }
      autoSolveNear(player.pos, 12); auto.nearT = 0;
    }
    return;
  }
  // bajo el mar: nadar en línea recta (subiendo o bajando), buscando aire cuando falta
  if (world.sea) {
    const sea = world.sea, inD = sea.inDome(player.pos), tD = sea.inDome(T);
    if (player.swimming) { seaSwimPilot(T, dt); return; }
    if (inD ? tD !== inD : T.y < sea.surface - 0.5) { walkTo(T.x, T.z, dt, 1, true); return; } // salir de la cúpula o tirarse al agua
  }
  // recorrido de verdad: camino por las superficies (andar, saltar, planear, corrientes, setas, garfio)
  if (navLog.length > 300) navLog.splice(0, 150);
  if (autoNavStep(dt, T, key)) { auto.noPathT = 0; return; }
  auto.noPathT = (auto.noPathT || 0) + dt; // puede que el camino aparezca enseguida (una corriente que se activa)
  // sin camino posible: camina hacia el objetivo y, si se atasca, vuela (último recurso)
  const want = Math.atan2(-dx, -dz);
  steerTo(want, dt);
  auto.stuckT = player.pos.distanceTo(auto.last) < dt * 1.2 ? auto.stuckT + dt : Math.max(0, auto.stuckT - dt);
  auto.last.copy(player.pos);
  const ax = player.pos.x - Math.sin(want) * 1.2, az = player.pos.z - Math.cos(want) * 1.2;
  const ground = physics.raycast(ax, player.pos.y + 0.5, az, 0, -1, 0, 3);
  const noGround = player.grounded && ground > 2.5 && dh > 2;
  if (player.grounded && auto.noPathT > 2.5 && (auto.stuckT > 1.2 || up > 1.3 || noGround)) startAutoFly(T, want, 'sin camino');
  if (noGround) input.move.x = input.move.y = 0;
}
function seaSwimPilot(T, dt) {
  const sea = world.sea, p = player.pos;
  auto.airSeek = !player.inSub && (player.air < 0.38 || (auto.airSeek && player.air < 0.95));
  const tgt = auto.airSeek ? sea.nearestAir(p) : T;
  const dx = tgt.x - p.x, dy = tgt.y - (p.y + 0.4), dz = tgt.z - p.z, dh = Math.hypot(dx, dz);
  const moved = p.distanceTo(auto.last); auto.last.copy(p);
  auto.swimStuck = moved < dt * 0.6 && dh > 1.5 ? (auto.swimStuck || 0) + dt : Math.max(0, (auto.swimStuck || 0) - dt);
  if (auto.swimStuck > 1.4) { auto.swimStuck = 0; auto.unstickT = 1.1; auto.unstickA = (auto.unstickA || 0) + 1; }
  const want = Math.atan2(-dx, -dz);
  if (auto.unstickT > 0) { auto.unstickT -= dt; input.autoJump = true; steerTo(want + (auto.unstickA % 2 ? 1.2 : -1.2), dt, 0.7); return; }
  steerTo(want, dt, dh > 1 ? 1 : Math.max(0.2, dh));
  input.autoJump = dy > 0.5; input.autoDown = dy < -0.5;
}
function steerTo(want, dt, speed = 1) {
  cam.yaw += angleDiff(want, cam.yaw) * Math.min(1, dt * 4);
  const rel = angleDiff(want, cam.yaw);
  input.move.x = -Math.sin(rel) * speed; input.move.y = Math.cos(rel) * speed;
}
const navAI = new AutoNav();
const navLog = []; const nd = n => `${n.ramp ? 'R' : ''}[${((n.minX + n.maxX) / 2).toFixed(1)},${n.top.toFixed(1)},${((n.minZ + n.maxZ) / 2).toFixed(1)} ${(n.maxX - n.minX).toFixed(1)}x${(n.maxZ - n.minZ).toFixed(1)}]`;
const nav = { path: null, i: 0, phase: 'go', t: 0, key: '', L: null, wasHooked: false, dj: false, failsHere: 0 };
function onNode(n) { // ¿Lía está de pie sobre esta superficie?
  if (!player.grounded) return false;
  const p = player.pos;
  if (p.x < n.minX - 0.3 || p.x > n.maxX + 0.3 || p.z < n.minZ - 0.3 || p.z > n.maxZ + 0.3) return false;
  if (n.ramp) return Math.abs(p.y - physics.rampHeight(n.ramp, Math.max(n.minX, Math.min(n.maxX, p.x)), Math.max(n.minZ, Math.min(n.maxZ, p.z)))) < 0.5;
  return Math.abs(p.y - n.top) < 0.6;
}
// andar esquivando: tantea direcciones libres alrededor (muros, cajas, casas) y elige la más cercana al destino
const walkAv = { best: Infinity, prog: 0, detour: 0, dAng: 0, jumpCd: 0 };
function wallAt(x, z, y) {
  for (const b of physics.boxes) {
    if (b.off) continue;
    if (x + 0.42 <= b.minX || x - 0.42 >= b.maxX || z + 0.42 <= b.minZ || z - 0.42 >= b.maxZ) continue;
    if (b.maxY > y + 0.45 && b.minY < y + 1.6) return true;
  }
  return false;
}
function groundAhead(x, z, y) { const g = physics.groundAt(x, z, 0.3, y + 1.6); return g.y > y - 1.2; } // alto de sondeo 1.6: las rampas suben
function freeDir(a, y) {
  const here = player.pos;
  for (const r of [0.7, 1.4, 2.1]) { const x = here.x - Math.sin(a) * r, z = here.z - Math.cos(a) * r; if (wallAt(x, z, y) || !groundAhead(x, z, y)) return false; }
  return true;
}
// ¿una maza de péndulo está a punto de cruzar el camino hacia W?
function pendulumAhead(here, W) {
  if (!world.hz || !world.hz.pends.length) return false;
  let dx = W.x - here.x, dz = W.z - here.z; const l = Math.hypot(dx, dz); if (l < 0.01) return false; dx /= l; dz /= l;
  for (const Pd of world.hz.pends) {
    const ahead = (Pd.x - here.x) * dx + (Pd.z - here.z) * dz;
    if (ahead < 0.9 || ahead > 2.8) continue;
    const px = here.x + dx * ahead, pz = here.z + dz * ahead;
    if (Math.abs(Pd.ball.y - (here.y + 0.9)) < 2.2 && Math.hypot(Pd.ball.x - px, Pd.ball.z - pz) < 2.1) return true;
  }
  return false;
}
function walkTo(x, z, dt, speed = 1, noAvoid = false) {
  const here = player.pos, d = Math.hypot(x - here.x, z - here.z);
  if (Math.hypot(x - (walkAv.tx ?? 1e9), z - (walkAv.tz ?? 1e9)) > 0.3) { walkAv.tx = x; walkAv.tz = z; walkAv.best = Infinity; walkAv.prog = 0; walkAv.detour = 0; } // destino nuevo
  let want = Math.atan2(-(x - here.x), -(z - here.z));
  // progreso: si en 0.8 s no se acerca, rodea
  walkAv.jumpCd -= dt;
  if (d < walkAv.best - 0.3) { walkAv.best = d; walkAv.prog = 0; } else walkAv.prog += dt;
  if (walkAv.detour > 0) { walkAv.detour -= dt; want = walkAv.dAng; if (walkAv.detour <= 0) walkAv.best = Infinity; }
  else if (player.grounded && !noAvoid && d > 1.5 && (walkAv.prog > 0.8 || !freeDir(want, here.y))) {
    let pick = null;
    for (const off of [0.5, -0.5, 1.0, -1.0, 1.5, -1.5, 2.1, -2.1, 2.7, -2.7]) if (freeDir(want + off, here.y)) { pick = want + off; break; }
    if (pick != null) { walkAv.dAng = pick; walkAv.detour = 0.7; want = pick; }
    else if (walkAv.jumpCd <= 0) { input._pressed.add('jump'); walkAv.jumpCd = 1; }
    walkAv.prog = 0;
  }
  if (d < 0.6) walkAv.best = Infinity;
  steerTo(want, dt, speed);
}
function autoNavStep(dt, T, key) {
  const caps = { glide: player.canGlide, grapple: player.canGrapple, dash: player.canAirDash };
  const extras = { updrafts: world.updrafts, grapples: [...world.grapplePoints, ...combat.grapplePoints] };
  if (nav.key !== key || !nav.path) {
    if (!player.grounded) return nav.path != null; // planifica con los pies en el suelo
    nav.key = key; nav.path = navAI.plan(physics, player.pos, T, caps, extras); nav.i = 0; nav.phase = 'go'; nav.t = 0; nav.run = false;
    navLog.push(`PLAN a ${T.x.toFixed(0)},${T.y.toFixed(0)},${T.z.toFixed(0)}: ${nav.path ? nav.path.map(e => e.kind + nd(e.to)).join(' ') : 'SIN CAMINO'}`);
    if (!nav.path) { nav.path = null; return false; }
  }
  const P = nav.path;
  if (nav.i >= P.length) { // ya en el suelo del objetivo: andar hasta él
    const lastN = P.length ? P[P.length - 1].to : null;
    if (lastN && player.grounded && !onNode(lastN)) { nav.path = null; nav.key = ''; return true; } // no está donde creía: replanificar
    if (lastN && player.grounded && !lastN.ramp) { // el objetivo flota fuera de esta isla (un cristal sobre el vacío): replanificar hacia otra isla y cogerlo al saltar
      const out = Math.hypot(Math.max(0, lastN.minX - T.x, T.x - lastN.maxX), Math.max(0, lastN.minZ - T.z, T.z - lastN.maxZ));
      if (out > 1 && (nav.floatT = (nav.floatT || 0) + dt) > 0.3) { nav.floatT = 0; nav.path = null; nav.key = ''; return true; }
    }
    const upT = T.y - player.pos.y, dT = Math.hypot(T.x - player.pos.x, T.z - player.pos.z);
    if (upT > 1.2 && dT < 1.6 && (nav.hopT = (nav.hopT || 0) + dt) < 12) { // objetivo en lo alto: salto doble y, si hay corriente, planear dentro
      if (player.grounded || (player.vel.y < 0.5 && player.jumps < 2)) input._pressed.add('jump');
      input.autoJump = true;
      if (dT > 0.3) steerTo(Math.atan2(-(T.x - player.pos.x), -(T.z - player.pos.z)), dt, 0.4); else input.move.x = input.move.y = 0;
      return true;
    }
    if (player.grounded && upT < 1.2) nav.hopT = 0;
    const want = Math.atan2(-(T.x - player.pos.x), -(T.z - player.pos.z)); walkTo(T.x, T.z, dt);
    auto.stuckT = player.pos.distanceTo(auto.last) < dt * 1.2 ? auto.stuckT + dt : Math.max(0, auto.stuckT - dt); auto.last.copy(player.pos);
    if (auto.stuckT > 6) { auto.stuckT = 0; nav.path = null; startAutoFly(T, want, 'atasco final'); }
    return true;
  }
  const e = P[nav.i]; nav.t += dt; input.autoJump = false;
  const B = e.to, here = player.pos;
  const fail = () => {
    input.autoJump = false;
    const n = navAI.fail(e); nav.path = null; nav.key = ''; auto.stats.fails++; navLog.push(`FALLA ${e.kind} ${nd(e.from)}->${nd(e.to)} fase ${nav.phase} pos ${here.x.toFixed(1)},${here.y.toFixed(1)},${here.z.toFixed(1)} t${nav.t.toFixed(1)}`);
    if (n >= 2 && player.grounded) { const L = navAI.landing(e, player.pos); startAutoFly(new THREE.Vector3(L.x, B.top, L.z), Math.atan2(-(L.x - here.x), -(L.z - here.z)), '2 fallas'); }
    return true;
  };
  if (nav.t > 12) return fail();
  if (nav.phase === 'go') {
    if (!player.grounded) { if (here.y < Math.min(e.from.low ?? e.from.top, B.low ?? B.top) - 5) return fail(); return true; }
    if (e.kind === 'walk') { // andar hasta la otra superficie, por sus puntos de paso
      if (!nav.wp || nav.wpE !== e) { nav.wp = navAI.walkPoints(e, T); nav.wpE = e; nav.wpI = 0; }
      while (nav.wpI < nav.wp.length - 1 && Math.hypot(nav.wp[nav.wpI].x - here.x, nav.wp[nav.wpI].z - here.z) < 0.6) nav.wpI++;
      const W = nav.wp[nav.wpI];
      if (!e.from.crumble && !(player.ground && player.ground.crumble) && pendulumAhead(here, W)) { input.move.x = input.move.y = 0; nav.t -= dt * 0.7; return true; } // deja pasar la maza
      const nar = e.from.narrow || (B.narrow && Math.hypot(W.x - here.x, W.z - here.z) < 2.2); walkTo(W.x, W.z, dt, nar ? 0.6 : 1, nar); // en la escalera, sin rodeos
      if (onNode(B) && (!B.ramp || nav.wpI >= 1) && (!e.from.ramp || nav.wpI >= 1)) { nav.i++; nav.t = 0; auto.stats.edges++; auto.stats.kinds.walk = (auto.stats.kinds.walk || 0) + 1; }
      return true;
    }
    const Pt = navAI.takeoff(e, here), dx = Pt.x - here.x, dz = Pt.z - here.z, d = Math.hypot(dx, dz);
    // plataforma móvil: espera a que se acerque
    const moverFar = () => { if (!B.moving) return false; const gap = Math.hypot(Math.max(0, e.from.minX - B.maxX, B.minX - e.from.maxX), Math.max(0, e.from.minZ - B.maxZ, B.minZ - e.from.maxZ)); if (gap > (player.canGlide ? 6 : 5)) { input.move.x = input.move.y = 0; nav.t -= dt * 0.6; nav.waitT = (nav.waitT || 0) + dt; if (nav.waitT > 6) { nav.waitT = 0; fail(); } return true; } nav.waitT = 0; return false; }; // si nunca se acerca, otro camino
    // fuego en el salto o roca de destino caída: esperar (pero nunca encima de una roca que se desploma)
    const hazardWait = () => {
      if (e.from.crumble || !world.hz) return false;
      const L1 = navAI.landing(e, Pt, T), mx = (Pt.x + L1.x) / 2, mz = (Pt.z + L1.z) / 2;
      const busy = (B.crumble && B.b.off) || world.hz.fireNear(mx, mz, 1.3) || world.hz.fireNear(L1.x, L1.z, 1.3, 0.6);
      if (!busy) { nav.hazT = 0; return false; }
      nav.hazT = (nav.hazT || 0) + dt; if (nav.hazT > 7) { nav.hazT = 0; return false; }
      input.move.x = input.move.y = 0; nav.t -= dt * 0.8; return true;
    };
    if (e.kind === 'jump' && !e.climb && !e.from.crumble) { // salto con carrerilla: se coge impulso y se salta en el borde
      const L0 = navAI.landing(e, Pt, T); let ux = L0.x - Pt.x, uz = L0.z - Pt.z; const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
      const A = e.from, cl = (v, lo, hi) => Math.max(lo + 0.3, Math.min(hi - 0.3, v));
      if (!nav.run) {
        const R = { x: cl(Pt.x - ux * 2.6, A.minX, A.maxX), z: cl(Pt.z - uz * 2.6, A.minZ, A.maxZ) }, dr = Math.hypot(R.x - here.x, R.z - here.z);
        if (dr > 0.5) { walkTo(R.x, R.z, dt, dr < 1.5 ? 0.6 : 1); return true; }
        if (moverFar() || hazardWait()) return true;
        nav.run = true;
      }
      const along = (here.x - Pt.x) * ux + (here.z - Pt.z) * uz;
      if (along < -0.3) { steerTo(Math.atan2(-(Pt.x + ux * 2 - here.x), -(Pt.z + uz * 2 - here.z)), dt, 1); return true; }
    } else {
      const quick = e.from.crumble; // sobre una roca que se desploma: sin frenar
      if (d > (quick ? 0.6 : 0.45)) { walkTo(Pt.x, Pt.z, dt, quick || d >= 1.5 ? 1 : 0.6, quick); return true; }
      if (moverFar() || hazardWait()) return true;
    }
    nav.run = false;
    nav.L = navAI.landing(e, here, T); nav.dj = false; nav.wasHooked = false; nav.phase = 'air'; nav.airT = 0;
    if (e.kind !== 'grapple') { input._pressed.add('jump'); input.autoJump = true; }
    return true;
  }
  // en el aire
  nav.airT += dt;
  if (B.moving) nav.L = navAI.landing(e, here, T); // la plataforma se mueve: seguirla
  const L = nav.L, lx = L.x - here.x, lz = L.z - here.z, ld = Math.hypot(lx, lz);
  if (e.kind === 'grapple') {
    const g = e.g; cam.yaw += angleDiff(Math.atan2(-(g.pos.x - here.x), -(g.pos.z - here.z)), cam.yaw) * Math.min(1, dt * 8);
    if (!player.grapple && !nav.wasHooked) { input.move.x = input.move.y = 0; if (hookTarget === g || hookTarget) input._pressed.add('grapple'); if (nav.airT > 3) return fail(); return true; }
    if (player.grapple) { nav.wasHooked = true; input.move.x = 0; input.move.y = 1; return true; }
  }
  if (e.kind === 'updraft' && here.y < e.u.y1 - 1.5 && nav.airT < 6) { // subir en la corriente, quieta en el centro
    const ux = e.u.x - here.x, uz = e.u.z - here.z; const ud = Math.hypot(ux, uz);
    if (ud > 0.5) steerTo(Math.atan2(-ux, -uz), dt, 0.5); else input.move.x = input.move.y = 0;
    if (!nav.dj && player.vel.y < 1 && player.jumps < 2) { input._pressed.add('jump'); nav.dj = true; }
    input.autoJump = true; return true;
  }
  if (e.kind === 'bounce' && nav.airT < 0.5 && player.vel.y < 6) { input.move.x = input.move.y = 0; input.autoJump = true; return true; } // espera el rebote
  if (e.kind === 'bounce' && !nav.dj) { // sube avanzando; en la cima, salto doble
    steerTo(Math.atan2(-lx, -lz), dt, 1); input.autoJump = true;
    if (player.vel.y < 1.2) { input._pressed.add('jump'); nav.dj = true; }
    return true;
  }
  // aterrizar en una seta elástica la hace rebotar: cuenta como llegada y encadena el siguiente tramo en el aire
  if (B.bounce && player.bounced && player.vel.y > B.bounce * 0.7 && here.x > B.minX - 0.5 && here.x < B.maxX + 0.5 && here.z > B.minZ - 0.5 && here.z < B.maxZ + 0.5 && here.y < B.top + 2.5) {
    nav.i++; auto.stats.edges++; auto.stats.kinds[e.kind] = (auto.stats.kinds[e.kind] || 0) + 1;
    const N = P[nav.i];
    if (N && N.kind === 'bounce' && N.from === B) { nav.L = navAI.landing(N, here, T); nav.dj = false; nav.airT = 0.5; nav.t = 0; }
    else { nav.phase = 'go'; nav.t = 0; }
    return true;
  }
  // si el objetivo es un cristal que flota en medio del salto, pasar por él
  let ax = lx, az = lz;
  if (ld > 1) { const tx = T.x - here.x, tz = T.z - here.z, along = (tx * lx + tz * lz) / ld, side = Math.abs(tx * lz - tz * lx) / ld;
    if (along > 0.3 && along < ld - 0.5 && side < 2.2 && T.y > here.y - 1.5 && T.y < here.y + 3.5) { ax = tx; az = tz; } }
  steerTo(Math.atan2(-ax, -az), dt, ld < 0.8 ? 0.2 : 1);
  if (!nav.dj && player.vel.y < 0.5 && e.kind !== 'walk') { input._pressed.add('jump'); nav.dj = true; }
  // impulso aéreo cuando el planeo no alcanza el borde
  if (player.canAirDash && !player.airDashUsed && player.jumps >= 2 && player.vel.y < -0.5 && e.kind !== 'walk') {
    const gx = Math.max(0, B.minX - here.x, here.x - B.maxX), gz = Math.max(0, B.minZ - here.z, here.z - B.maxZ), gd = Math.hypot(gx, gz);
    if (gd > 0.8 && (here.y - B.top) < gd / 1.4 + 0.3) {
      const a = Math.atan2(-lx, -lz); cam.yaw = a; input.move.x = 0; input.move.y = 1; input._pressed.add('dodge');
    }
  }
  // planear mientras falte distancia; soltar encima del sitio de aterrizaje
  input.autoJump = player.vel.y > 0 || (player.canGlide && ld > 1.0); // mantener el salto: más altura y planeo
  if (player.grounded && nav.airT > 0.15) {
    input.autoJump = false;
    if (onNode(B)) { nav.i++; nav.phase = 'go'; nav.t = 0; auto.stats.edges++; auto.stats.kinds[e.kind] = (auto.stats.kinds[e.kind] || 0) + 1; return true; }
    return fail();
  }
  if (here.y < Math.min(e.from.low ?? e.from.top, B.low ?? B.top) - 5) return fail();
  return true;
}
function startAutoFly(T, want, why = '') {
  const from = player.pos.clone(), d = Math.hypot(T.x - from.x, T.z - from.z);
  // aterriza en el objetivo (o un poco más allá si justo ahí no hay suelo), sobre lo que haya
  let to = null;
  for (const k of [0, 1.2, 2.4, -1.2]) {
    const x = T.x - Math.sin(want) * k, z = T.z - Math.cos(want) * k;
    const hit = physics.raycast(x, T.y + 3, z, 0, -1, 0, 8);
    if (hit < 8) { to = new THREE.Vector3(x, T.y + 3 - hit + 0.05, z); break; }
  }
  if (!to) to = new THREE.Vector3(T.x, T.y + 0.05, T.z);
  const apex = Math.max(from.y, to.y) + 2.5 + d * 0.08;
  auto.fly = { from, to, apex, t: 0, dur: Math.max(0.9, d / 9) }; auto.stats.flights++; navLog.push(`VUELO (${why}) desde ${from.x.toFixed(1)},${from.y.toFixed(1)},${from.z.toFixed(1)} a ${to.x.toFixed(1)},${to.y.toFixed(1)},${to.z.toFixed(1)}`);
  player.facing = want; audio.play('glide'); auto.stuckT = 0;
}
function autoFly(dt) {
  const F = auto.fly; F.t += dt; const k = Math.min(1, F.t / F.dur);
  const x = F.from.x + (F.to.x - F.from.x) * k, z = F.from.z + (F.to.z - F.from.z) * k;
  const y = (1 - k) * (1 - k) * F.from.y + 2 * (1 - k) * k * (F.apex * 2 - (F.from.y + F.to.y) / 2) + k * k * F.to.y;
  player.vel.set(0, 0, 0); player.pos.set(x, y, z); player.grounded = false;
  const was = player.canGlide; player.canGlide = true; player.gliding = k > 0.15 && k < 0.95;
  player.update(dt, { move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, pressed: () => false, held: () => false, walk: false }, cam.yaw, []);
  player.pos.set(x, y, z); player.vel.set(0, 0, 0); player.canGlide = was;
  if (k >= 1) { auto.fly = null; player.gliding = false; player.teleport(F.to.x, F.to.y, F.to.z, player.facing); }
}

// ---------- menús con el mando: cruceta para elegir, ✕/A para aceptar, ○/B para volver ----------
let navOv = null, navKey = '';
function menuNav() {
  if (introRun && !introRun.done) return;
  if (!input.usingGamepad) { document.querySelectorAll('.padFocus').forEach(e => e.classList.remove('padFocus')); return; }
  if (state === 'play' || state === 'dialog' || state === 'dead' || state === 'cutscene') return;
  // en la Arena solo cuentan sus cuadros de pausa y de final de ronda
  const ov = state === 'arena' ? [...document.querySelectorAll('#arenaEnd:not(.hidden), #arenaPauseBox:not(.hidden)')].pop() : [...document.querySelectorAll('.overlay:not(.hidden)')].pop();
  if (!ov) return;
  const items = [...ov.querySelectorAll('button, select')].filter(el => !el.disabled && el.offsetParent !== null);
  if (!items.length) return;
  const keyOf = e => e.id || e.textContent.trim().slice(0, 40);
  const sig = items.map(keyOf).join('|');
  if (sig !== navSig) { // el menú cambió: se mantiene el cursor en la misma opción si sigue ahí
    const same = navKey ? items.findIndex(e => keyOf(e) === navKey) : -1;
    navI = ov !== navOv ? 0 : same >= 0 ? same : Math.min(navI, items.length - 1);
    navSig = sig; navOv = ov;
  }
  let cur = items[Math.min(navI, items.length - 1)];
  const isSel = cur && cur.tagName === 'SELECT';
  if (input.pressed('choiceUp')) navI = (navI + items.length - 1) % items.length;
  if (input.pressed('choiceDown')) navI = (navI + 1) % items.length;
  // izquierda / derecha: en una lista cambia el valor; en tarjetas y botones en fila pasa a la de al lado
  if (!isSel && input.pressed('navLeft')) navI = (navI + items.length - 1) % items.length;
  if (!isSel && input.pressed('navRight')) navI = (navI + 1) % items.length;
  navI = Math.min(navI, items.length - 1);
  const el = items[navI]; if (keyOf(el) !== navKey && navKey) audio.play('uiMove'); navKey = keyOf(el);
  document.querySelectorAll('.padFocus').forEach(e => e !== el && e.classList.remove('padFocus'));
  if (!el.classList.contains('padFocus')) { el.classList.add('padFocus'); el.scrollIntoView && el.scrollIntoView({ block: 'nearest' }); if (el.onmouseenter) el.onmouseenter(); }
  if (el.tagName === 'SELECT' && (input.pressed('navLeft') || input.pressed('navRight'))) {
    el.selectedIndex = Math.max(0, Math.min(el.options.length - 1, el.selectedIndex + (input.pressed('navRight') ? 1 : -1)));
    el.dispatchEvent(new Event('change'));
  }
  // ✕ (PlayStation) o A (Xbox) acepta
  if (input.pressed('jump') && el.tagName === 'BUTTON') { audio.play('open'); el.click(); }
  if (input.pressed('dodge')) { audio.play('back'); const back = items.find(b => /Volver|Listo|Continuar|Seguir/.test(b.textContent) && b.tagName === 'BUTTON'); if (back && state !== 'title') back.click(); else if (back && /Volver/.test(back.textContent)) back.click(); }
}

// ---------- desafíos: Cristales del Cielo ----------
const CH_KEY = 'aethra_desafios_v1'; // récords antiguos (comunes); ahora cada partida guarda los suyos
const loadChOld = () => { try { return JSON.parse(localStorage.getItem(CH_KEY)) || {}; } catch (e) { return {}; } };
function chOwner() { return challenge ? challenge.owner : loadSave(); }
function loadCh() { const sv = chOwner(); if (!sv) return {}; if (!sv.desafios) sv.desafios = { ...loadChOld() }; return sv.desafios; }
function saveCh(rec) { const sv = chOwner(); if (!sv) return; sv.desafios = rec; writeSlot(getSlot(), sv); }
const fmtT = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
const MEDAL = { oro: '🥇 Oro', plata: '🥈 Plata', bronce: '🥉 Bronce' };
function startChallenge(i) {
  const L = DESAFIOS[i];
  const owner = (challenge && challenge.owner) || loadSave();
  challenge = { i, L, t: 0, done: false, owner };
  save = newSave(); save.zone = L.id;
  player.diff = DIFF[owner && owner.difficulty === 'auto' ? 'auto' : 'normal']; combat.difficulty = owner && owner.difficulty === 'auto' ? 'auto' : 'normal'; // los desafíos se juegan en Aventura (o solos en Automático)
  Object.assign(save.flags, { baston: true, impulso: true, brujula: true }, L.abilities);
  audio.unlock(); music.init(); goFull();
  showOverlay(null); titlePanel(null);
  loadZone(L.id);
  state = 'play'; lastGoal = '';
  $('chTimer').classList.remove('hidden');
}
function endChallenge() { if (!challenge) return; writeSlot(getSlot(), challenge.owner); challenge = null; $('chTimer').classList.add('hidden'); save = loadSave() || newSave(); applyPartida(); }
function updateChallenge(dt) {
  const C = challenge; if (C.done) return;
  C.t += dt;
  const got = zone.fragments.filter(f => save.fragments.includes(f.id)).length, all = got === zone.fragments.length;
  $('chTimer').textContent = `⏱ ${fmtT(C.t)}`;
  const P = world.portal; if (!P) return;
  if (all && !P.open) { P.setOpen(true); audio.play('unlock'); toast('¡El portal se abrió! Crúzalo'); }
  if (P.open && Math.hypot(player.pos.x - P.pos.x, player.pos.z - P.pos.z) < 1.3 && Math.abs(player.pos.y - P.pos.y) < 2) finishChallenge();
}
function finishChallenge() {
  const C = challenge; C.done = true;
  const rec = loadCh(), prev = rec[C.L.id], isAuto = !!(player.diff && player.diff.auto), best = !isAuto && (!prev || prev.t == null || C.t < prev.t);
  if (best) { rec[C.L.id] = { t: C.t }; saveCh(rec); }
  else if (isAuto && !prev) { rec[C.L.id] = { t: null }; saveCh(rec); } // desbloquea el siguiente, sin tiempo
  const m = isAuto ? null : medalFor(C.L, C.t), next = DESAFIOS[C.i + 1];
  if (m === 'oro') logro('oro');
  if (save && !isAuto) { save.ecos = (save.ecos || 0) + ECO_REWARD.desafio + (m === 'oro' ? 10 : 0); writeSave(save); }
  if (DESAFIOS.slice(0, BASE_DESAFIOS).every(L => rec[L.id] && rec[L.id].t != null && medalFor(L, rec[L.id].t) === 'oro')) logro('todo_oro');
  state = 'end'; document.body.classList.add('cine'); player.frozen = true;
  music.stinger('victoria'); fx.sparkle(player.pos.clone().setY(player.pos.y + 1.2), 30, 0xc8b8ff);
  const [o, p, b] = C.L.medals;
  showEndCard({
    kicker: `Desafío ${C.i + 1} superado`, title: C.L.title,
    stats: `Tiempo: <b>${fmtT(C.t)}</b>${isAuto ? ' · modo automático (no cuenta como récord)' : best ? ' · ¡nuevo récord!' : prev && prev.t != null ? ` · récord: ${fmtT(prev.t)}` : ''}<br>${m ? MEDAL[m] : 'Sin medalla'} · oro ${o} s · plata ${p} s · bronce ${b} s`,
    sub: next ? (C.i + 1 === BASE_DESAFIOS ? '¡Y esto no termina! Desde aquí cada desafío es nuevo, más largo y más difícil.' : '') : 'Superaste los 100 desafíos. ¡Leyenda! Prueba Aethra sin fin.',
    next: { label: next ? `Siguiente: ${next.title}` : 'Repetir este desafío', fn: () => startChallenge(next ? C.i + 1 : C.i) },
  });
  $('bKeepExploring').classList.add('hidden');
}
$('bHubCh').onclick = () => {
  const rec = loadCh(), list = $('challengeList'); list.innerHTML = '';
  let shownLocked = 0;
  DESAFIOS.forEach((L, i) => {
    const r = rec[L.id], open = i === 0 || rec[DESAFIOS[i - 1].id], m = r && r.t != null && medalFor(L, r.t);
    if (!open && i >= BASE_DESAFIOS && shownLocked++ >= 1) return; // de los desafíos nuevos solo se ve el siguiente bloqueado
    const b = document.createElement('button');
    b.innerHTML = `<span>${i + 1}. ${L.title}${i >= BASE_DESAFIOS ? ' ✦' : ''}${L.abilities.garfio ? ' · garfio' : L.abilities.planeador ? ' · planeador' : ''}</span><span>${!open ? '🔒' : r && r.t != null ? `${m ? MEDAL[m].split(' ')[0] + ' ' : ''}${fmtT(r.t)}` : r ? '✓' : '—'}</span>`;
    b.disabled = !open; b.onclick = () => startChallenge(i);
    list.appendChild(b);
  });
  const done = DESAFIOS.filter(L => rec[L.id]).length;
  const more = document.createElement('div'); more.className = 'sub'; more.style.cssText = 'margin:8px 0 0;font-size:14px;text-align:center';
  more.textContent = `${done} de ${DESAFIOS.length} desafíos superados · cada uno que superas abre uno nuevo`;
  list.appendChild(more);
  setTimeout(() => { const firstOpen = [...list.querySelectorAll('button')].filter(x => !x.disabled).pop(); if (firstOpen) firstOpen.scrollIntoView({ block: 'center' }); }, 30);
  titlePanel('challengesPanel');
};
$('bChallengesBack').onclick = () => openHub();
$('bRestartCh').onclick = () => { if (challenge) { const i = challenge.i; resume(); startChallenge(i); } };

// ---------- personalizar a la protagonista ----------
const cust = { cfg: null, from: null, prev: null };
function openCustom(from) {
  if (!charLib) return;
  const sv = from === 'title' ? loadSave() : from === 'new' ? null : save;
  cust.from = from; cust.cfg = { ...DEFAULT_CUSTOM, ...((sv && sv.custom) || (from === 'new' ? {} : settings.custom) || {}) };
  const host = from === 'new' ? 'title' : from;
  $(host).classList.add('hidden'); $('customize').classList.remove('hidden');
  $('bCustomOk').textContent = from === 'new' ? '¡A jugar!' : 'Listo'; $('bCustomBack').classList.toggle('hidden', from !== 'new');
  buildCustomOpts(); startPreview();
}
function closeCustom(ok = true) {
  if (cust.from === 'new') { // último paso de la partida nueva
    stopPreview(); $('customize').classList.add('hidden');
    if (ok) { player.useModel(charLib, customLook(cust.cfg)); createPartida({ ...cust.cfg }); }
    else { $('title').classList.remove('hidden'); showDiffPanel(); }
    return;
  }
  if (ok) {
    settings.custom = cust.cfg; writeSettings(settings);
    const sv = cust.from === 'title' ? loadSave() : (challenge ? null : save);
    if (sv) {
      const old = { ...DEFAULT_CUSTOM, ...(sv.custom || {}) };
      const looks = ['estilo', 'ropa', 'pelo', 'piel', 'planeador'].some(k => old[k] !== cust.cfg[k]);
      sv.custom = cust.cfg; if (looks) sv.hero = 'lia'; // cambiar el aspecto es para tu heroína; el aura y el título valen para todos
      if (cust.from === 'title') { unlock(sv, 'estilo', sv.difficulty === 'auto'); writeSaveRaw(sv); } else { logro('estilo'); writeSave(sv); }
      if (sv === save) { applyHero(); applyAbilities(); } else applySlotLook();
    } else { player.useModel(charLib, customLook(cust.cfg)); player.setFight(player.canFight); }
    if (cust.from === 'title') openHub();
  }
  stopPreview(); $('customize').classList.add('hidden'); $(cust.from).classList.remove('hidden');
  if (cust.from === 'arenaMenu') refreshArenaMenu();
}
function buildCustomOpts() {
  const box = $('cOpts'); box.innerHTML = '';
  const group = (key, label, list, swatchIdx) => {
    const g = document.createElement('div'); g.innerHTML = `<div class="lbl">${label}</div>`;
    const row = document.createElement('div'); row.className = 'row';
    for (const o of list) {
      const b = document.createElement('button');
      if (swatchIdx != null) { b.className = 'sw'; b.style.background = '#' + o[swatchIdx].toString(16).padStart(6, '0'); b.title = o[1]; b.setAttribute('aria-label', o[1]); }
      else b.textContent = o[1];
      if (cust.cfg[key] === o[0]) b.classList.add('sel');
      b.onclick = () => { cust.cfg[key] = o[0]; buildCustomOpts(); refreshPreview(); audio.play('open'); };
      row.appendChild(b);
    }
    g.appendChild(row); box.appendChild(g);
  };
  group('estilo', 'Estilo', CUSTOM.estilos);
  group('ropa', 'Ropa', CUSTOM.ropa, 3);
  group('pelo', 'Pelo', CUSTOM.pelo, 3);
  group('piel', 'Piel', CUSTOM.piel, 3);
  group('planeador', 'Planeador', CUSTOM.planeador, 2);
  group('aura', 'Aura de poder', CUSTOM.aura, 2);
  group('titulo', 'Título en la Arena', CUSTOM.titulo);
}
// vista previa: un renderizador pequeño solo mientras el panel está abierto
let pv = null;
function startPreview() {
  // lienzo nuevo cada vez: el anterior quedó con su contexto WebGL liberado y ya no dibuja (se veía en blanco)
  const old = $('cPreview'), cv = old.cloneNode(false); old.replaceWith(cv);
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.setSize(cv.clientWidth || 240, cv.clientHeight || 304, false);
  r.outputColorSpace = THREE.SRGBColorSpace;
  const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x556070, 1.6)); const d = new THREE.DirectionalLight(0xfff1d6, 1.8); d.position.set(2, 4, 3); sc.add(d);
  const cam = new THREE.PerspectiveCamera(30, (cv.clientWidth || 240) / (cv.clientHeight || 304), 0.1, 50); cam.position.set(0, 1.0, 6.2); cam.lookAt(0, 0.82, 0);
  pv = { r, sc, cam, ch: null, rot: 0.4, drag: null, clock: new THREE.Clock(), raf: 0 };
  cv.onpointerdown = e => { pv.drag = e.clientX; cv.setPointerCapture(e.pointerId); };
  cv.onpointermove = e => { if (pv && pv.drag != null) { pv.rot += (e.clientX - pv.drag) * 0.012; pv.drag = e.clientX; } };
  cv.onpointerup = () => { if (pv) pv.drag = null; };
  refreshPreview();
  const loop = () => { if (!pv) return; pv.raf = requestAnimationFrame(loop); const dt = pv.clock.getDelta(); if (pv.drag == null) pv.rot += dt * 0.5; if (pv.ch) { pv.ch.root.rotation.y = pv.rot; pv.ch.mixer.update(dt); } pv.r.render(pv.sc, pv.cam); };
  loop();
}
function refreshPreview() {
  if (!pv) return;
  if (pv.ch) { pv.sc.remove(pv.ch.root); pv.ch.root.traverse(o => { if (o.isMesh && o.material.map && o.material.map.isCanvasTexture) o.material.map.dispose(); }); }
  const look = customLook(cust.cfg); pv.ch = createCharacter(charLib, look); pv.sc.add(pv.ch.root);
  // también con el arma y la armadura de la Armería
  const gsv = cust.from === 'title' ? loadSave() : cust.from === 'new' ? null : save;
  const gg = gsv && gearOf(gsv), hand = pv.ch.model.getObjectByName('handslotr');
  const w = gg && buildWeapon(gg.arma); if (w && hand) { hand.add(w); w.rotation.y = Math.PI; }
  if (gg) buildArmor(gg.armadura, pv.ch.model);
  const a = pv.ch.actions.Idle || Object.values(pv.ch.actions)[0]; if (a) { a.setEffectiveWeight(1); a.play(); }
}
function stopPreview() { if (!pv) return; cancelAnimationFrame(pv.raf); pv.r.dispose(); pv.r.forceContextLoss(); pv = null; }
$('bCustomPause').onclick = () => openCustom('pause');
$('bCustomOk').onclick = () => closeCustom(true);
$('bCustomReset').onclick = () => { cust.cfg = { ...DEFAULT_CUSTOM }; buildCustomOpts(); refreshPreview(); };
$('bCustomBack').onclick = () => closeCustom(false);
$('customize').addEventListener('keydown', e => { if (e.key === 'Escape') closeCustom(false); });

function pause() {
  if (state === 'play' || state === 'dialog') {
    state = 'pause'; showOverlay('pause'); showPausePanel('main');
    $('bRestartCh').classList.toggle('hidden', !challenge); $('bSaveMenu').classList.toggle('hidden', !!challenge);
    writeSave(save);
  } else if (state === 'pause') resume();
}
function resume() { state = dialog ? 'dialog' : 'play'; showOverlay(null); }
$('bResume').onclick = resume;
$('bSettings').onclick = () => showPausePanel('settings');
$('bControls').onclick = () => showPausePanel('controls');
$('bControlsBack').onclick = () => showPausePanel('main');
$('bLogrosPause').onclick = () => openTrophies('pause');

// ---------- vitrina de logros de la partida ----------
const TIER = { trofeo: 'Trofeo', medalla: 'Medalla', insignia: 'Insignia' };
function prizeSVG(tier, got) {
  const g1 = got ? '#fff3b0' : '#ddd', g2 = got ? '#f0b400' : '#999', g3 = got ? '#a86f00' : '#555';
  const id = `g_${tier}_${got ? 1 : 0}`;
  const grad = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${g1}"/><stop offset=".55" stop-color="${g2}"/><stop offset="1" stop-color="${g3}"/></linearGradient></defs>`;
  if (tier === 'trofeo') return `<svg class="cup" viewBox="0 0 70 78">${grad}<path d="M18 8h34v14c0 13-7 22-17 22S18 35 18 22z" fill="url(#${id})"/><path d="M18 12H8c0 12 5 17 12 18M52 12h10c0 12-5 17-12 18" stroke="url(#${id})" stroke-width="5" fill="none"/><rect x="31" y="44" width="8" height="12" fill="url(#${id})"/><rect x="20" y="56" width="30" height="8" rx="2" fill="url(#${id})"/><rect x="16" y="64" width="38" height="8" rx="3" fill="${got ? '#7a3d1a' : '#444'}"/></svg>`;
  if (tier === 'medalla') return `<svg class="cup" viewBox="0 0 70 78">${grad}<path d="M20 2h12l6 22H26zM50 2H38l-6 22h12z" fill="${got ? '#e0475e' : '#666'}"/><circle cx="35" cy="48" r="22" fill="url(#${id})"/><circle cx="35" cy="48" r="16" fill="none" stroke="${got ? '#fff6' : '#fff2'}" stroke-width="2"/></svg>`;
  return `<svg class="cup" viewBox="0 0 70 78">${grad}<path d="M35 6l24 10v20c0 18-12 30-24 36C23 66 11 54 11 36V16z" fill="url(#${id})"/></svg>`;
}
const trophyFrom = { from: null };
function openTrophies(from) {
  const sv = from === 'title' ? loadSave() : partida(); if (!sv) return;
  const d = storeOf(sv), shelf = $('trophyShelf'); shelf.innerHTML = '';
  let n = 0;
  const order = { trofeo: 0, medalla: 1, insignia: 2 };
  for (const L of [...LOGROS].sort((a, b) => order[a.tier] - order[b.tier])) {
    const got = !!d.got[L.id]; if (got) n++;
    const el = document.createElement('div'); el.className = 'tro' + (got ? ' got' : '');
    let prog = '';
    if (!got && L.goal) { const v = Array.isArray(d.n[L.key]) ? d.n[L.key].length : (d.n[L.key] || 0); prog = `<span class="bar"><i style="width:${Math.min(100, v / L.goal * 100)}%"></i></span><small>${Math.min(v, L.goal)} / ${L.goal}</small>`; }
    const sparks = got ? [0, 1, 2].map(i => `<span class="spark" style="left:${18 + i * 26}%;top:${10 + (i % 2) * 30}%;animation-delay:${i * 0.6}s"></span>`).join('') : '';
    el.innerHTML = `<span class="kind">${TIER[L.tier]}</span><span class="prize">${prizeSVG(L.tier, got)}<span class="gl">${L.icon}</span></span><b>${L.title}</b><small>${L.desc}</small>${prog}${got ? '<span class="shine"></span>' + sparks : '<span class="lock">🔒</span>'}`;
    shelf.appendChild(el);
  }
  $('trophyTitle').textContent = `Logros de ${slotName(sv, getSlot())}`;
  $('trophyCount').textContent = `${n} de ${LOGROS.length} conseguidos`;
  // medallas de los desafíos de esta partida
  const rec = sv.desafios || {}, row = $('medalRow'); row.innerHTML = '';
  DESAFIOS.forEach((L, i) => {
    const r = rec[L.id], m = r && r.t != null ? medalFor(L, r.t) : null;
    if (i >= BASE_DESAFIOS && !m) return; // de los nuevos, solo los que tienen medalla
    const el = document.createElement('div'); el.className = 'md ' + (m || 'none');
    el.innerHTML = `<div class="disc">${i + 1}</div>${m ? m[0].toUpperCase() + m.slice(1) : 'Desafío ' + (i + 1)}`;
    row.appendChild(el);
  });
  trophyFrom.from = from;
  $(from).classList.add('hidden'); $('trophies').classList.remove('hidden');
}
$('bTrophyBack').onclick = () => { $('trophies').classList.add('hidden'); $(trophyFrom.from).classList.remove('hidden'); };
$('bSettingsBack').onclick = () => showPausePanel('main');
$('bSaveMenu').onclick = () => { $('exportCode').value = exportCode(save); $('importCode').value = ''; $('saveMsg').textContent = ''; showPausePanel('save'); };
$('bSaveBack').onclick = () => showPausePanel('main');
$('bTitle').onclick = () => { if (endless.active) { if (endless.inZone) stopEndlessInZone(true); else stopEndless(); } writeSave(save); if (dialog) closeDialog(false); endChallenge(); state = 'title'; music.play('title'); music.ambient(null); $('objective').classList.add('hidden'); $('compass').classList.add('hidden'); marker.visible = false; showOverlay('title'); refreshTitle(); if (loadSave()) openHub(); };
$('bCopy').onclick = async () => {
  try { await navigator.clipboard.writeText($('exportCode').value); $('saveMsg').textContent = 'Código copiado.'; }
  catch (e) { $('exportCode').select(); $('saveMsg').textContent = 'No se pudo copiar solo: selecciona el texto y cópialo a mano.'; }
};
$('bImport').onclick = () => {
  try {
    const s = importCode($('importCode').value);
    if (!ZONES[s.zone]) throw new Error('Esa partida es de una zona que esta versión aún no tiene.');
    save = s; writeSave(save); loadZone(save.zone, save.checkpoint); resume(); toast('Partida cargada');
  } catch (e) { $('saveMsg').textContent = e.message; }
};

function applySettings() {
  cam.settings.sens = settings.sens; cam.settings.invert = settings.invert; audio.volume = settings.volume; music.setVolume(settings.music ?? 0.6);
  if (!challenge) applyPartida();
  $('sSens').value = settings.sens; $('sInv').checked = settings.invert; $('sVol').value = settings.volume; $('sMus').value = settings.music ?? 0.6; $('sDbg').checked = settings.debug;
  $('debug').classList.toggle('hidden', !settings.debug);
  $('sQual').value = settings.quality || 'auto'; applyQuality();
}
$('sSens').oninput = e => { settings.sens = +e.target.value; writeSettings(settings); applySettings(); };
$('sInv').onchange = e => { settings.invert = e.target.checked; writeSettings(settings); applySettings(); };
$('sVol').oninput = e => { settings.volume = +e.target.value; writeSettings(settings); applySettings(); };
// ---------- calidad gráfica ----------
// alta: resolución nítida y sombras suaves · media: resolución normal y sombras simples · baja: sin sombras, menos resolución y partículas

function qualityLevel() { const q = settings.quality || 'auto'; return q === 'auto' ? (settings.autoQ || (LOW_GPU ? 'media' : 'alta')) : q; }
function applyQuality() {
  const k = qualityLevel(); if (k === qualityNow) return; qualityNow = k;
  const Q = QUALITY[k];
  renderer.setPixelRatio(Math.min(devicePixelRatio, Q.ratio)); renderer.setSize(innerWidth, innerHeight);
  const typ = Q.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  if (renderer.shadowMap.enabled !== Q.shadows || renderer.shadowMap.type !== typ) {
    renderer.shadowMap.enabled = Q.shadows; renderer.shadowMap.type = typ;
    scene.traverse(o => { const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => x.needsUpdate = true); });
  }
  if (sun.shadow.mapSize.x !== Q.map) { sun.shadow.mapSize.set(Q.map, Q.map); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  fx.density = Q.fx; world.detail = k === 'alta' ? 1 : k === 'media' ? 0.55 : 0.25;
  if (Q.bloom) ensureBloom(); else if (composer) composer.setPixelRatio(renderer.getPixelRatio());
}
// Resplandor (bloom) en calidad Alta: el fuego, los cristales y los fragmentos brillan de verdad.
async function ensureBloom() {
  if (composer || bloomLoading) return; bloomLoading = true;
  try {
    const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
      import('three/addons/postprocessing/EffectComposer.js'), import('three/addons/postprocessing/RenderPass.js'),
      import('three/addons/postprocessing/UnrealBloomPass.js'), import('three/addons/postprocessing/OutputPass.js')]);
    const c = new EffectComposer(renderer);
    c.addPass(new RenderPass(scene, camera));
    c.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.45, 0.45, 0.88));
    c.addPass(new OutputPass());
    c.setPixelRatio(renderer.getPixelRatio()); c.setSize(innerWidth, innerHeight);
    composer = c;
  } catch (e) { console.warn('Sin resplandor', e); }
  bloomLoading = false;
}
function renderScene() {
  if (splitView) { // cada jugador ve su mitad: lado a lado en horizontal, arriba y abajo en vertical
    const w = innerWidth, h = innerHeight, tall = h > w;
    const views = tall ? [[0, h / 2, w, h / 2, camera], [0, 0, w, h / 2, camera2]] : [[0, 0, w / 2, h, camera], [w / 2, 0, w / 2, h, camera2]];
    renderer.setScissorTest(true);
    for (const [x, y, vw, vh, c] of views) {
      c.fov = camera.fov; c.aspect = vw / vh; c.updateProjectionMatrix();
      renderer.setViewport(x, y, vw, vh); renderer.setScissor(x, y, vw, vh); renderer.render(scene, c);
    }
    renderer.setScissorTest(false); renderer.setViewport(0, 0, w, h);
    return;
  }
  if (composer && QUALITY[qualityNow] && QUALITY[qualityNow].bloom) composer.render(); else renderer.render(scene, camera);
}
// En «Automática», si el juego va lento un buen rato, baja un nivel (y lo recuerda para la próxima vez).

function autoQualityTick(realDt) {
  if ((settings.quality || 'auto') !== 'auto' || !(state === 'play' || state === 'arena') || document.hidden) { aq.t = aq.n = 0; return; }
  aq.t += Math.min(realDt, 0.5); aq.n++;
  if (aq.t < 3) return;
  const f = aq.n / aq.t; aq.t = aq.n = 0;
  aq.slow = f < 40 ? aq.slow + 1 : 0;
  if (aq.slow >= 2) {
    const cur = qualityLevel(), down = cur === 'alta' ? 'media' : cur === 'media' ? 'baja' : null;
    aq.slow = 0;
    if (down) { settings.autoQ = down; writeSettings(settings); applyQuality(); toast(`Calidad gráfica ajustada a ${down} para que el juego vaya más fluido`); }
  }
}
$('sQual').onchange = e => { settings.quality = e.target.value; if (e.target.value === 'auto') delete settings.autoQ; writeSettings(settings); applyQuality(); };
$('sMus').oninput = e => { settings.music = +e.target.value; writeSettings(settings); applySettings(); };
$('sDbg').onchange = e => { settings.debug = e.target.checked; writeSettings(settings); applySettings(); };

// ---------- bucle ----------
const clock = new THREE.Clock();
let fpsAcc = 0, fpsN = 0, fps = 0;

let frameErrors = 0;
function frame() {
  requestAnimationFrame(frame);
  const realDt = Math.min(clock.getDelta(), 0.25);
  if (glLost) return;
  if (paused4test) { renderScene(); return; }
  autoQualityTick(realDt);
  const steps = Math.min(3, Math.max(1, Math.ceil(realDt / (1 / 30) - 0.05))), dt = Math.min(realDt / steps, 1 / 30);
  try {
    for (let i = 0; i < steps; i++) { simulate(dt); if (i < steps - 1) input.endFrame(); } // las pulsaciones cuentan una sola vez
    if (state !== 'credits') renderScene();
  } catch (e) { // un error en un fotograma no debe congelar el juego
    if (frameErrors++ < 5) console.error('Error en el fotograma', e);
    if (frameErrors === 3) toast('Algo falló; si se queda quieto, pulsa Esc y carga la partida');
  }
  input.endFrame();
}
let paused4test = false;

function simulate(dt) {
  time += dt;
  input.poll();
  // botón Z (táctil) / acción especial: garfio si hay un anillo a la vista, si no, pulso de luz
  if (input.pressed('special')) input._pressed.add(hookTarget && player.canGrapple ? 'grapple' : 'pulse');
  menuNav();
  if (player.diff && player.diff.auto) autoPilot(dt); else input.autoJump = false;
  updateMusic();
  if (challenge && state === 'play') updateChallenge(dt);
  if (input.pressed('pause') && (state === 'play' || state === 'dialog' || state === 'pause')) pause();
  else if (input.pressed('pause') && state === 'arena') arena.togglePause();
  if (input.pressed('heroes') && state === 'play' && !challenge) openHeroes('play');
  if (state === 'arena') arena.update(dt);

  if (state === 'play' || state === 'dialog') {
    save.playTime += dt; talkCooldown -= dt;
    if (combat.hitstop > 0) { combat.hitstop -= dt; return; } // pausa de impacto
    world.applyConditions(S);
    world.playerPos.copy(player.pos);
    const lookIt = dialog ? dialog.it : focus;
    player.lookAt = lookIt ? lookTarget.copy(lookIt.pos).setY(lookIt.pos.y + (lookIt.headY || 1.1)) : null;
    if (state === 'dialog' && dialog && dialog.it && dialog.it.type === 'npc') { // Lía se gira hacia quien le habla
      const want = Math.atan2(-(dialog.it.pos.x - player.pos.x), -(dialog.it.pos.z - player.pos.z));
      player.facing += Math.atan2(Math.sin(want - player.facing), Math.cos(want - player.facing)) * Math.min(1, dt * 6);
    }
    if (world.sea) seaBefore(dt);
    if (auto.fly) autoFly(dt); else player.update(dt, input, cam.yaw, state === 'play' ? combat.targets : []);
    powers.tick(player, dt, 8);
    if (world.sea) seaAfter(dt);
    if (player.dodge && player.dodge.air) fx.trail(player.pos, 0.5 + player.dodge.t * 2); // estela de colores del impulso
    combat.handlePlayer(player);
    if (state === 'play') combat.update(dt, player);
    handleHazards(dt);
    handlePlayerEvents();
    checkRegions();
    updateGrapple();
    if (state === 'dialog') updateDialog(dt); else updateInteractions();
    cam.update(dt, state === 'dialog' ? { look: { x: 0, y: 0 }, zoom: 0, move: { x: 0, y: 0 } } : input, player);
    if (flyover) flyoverTick(dt);
    world.updateFade(camera.position, cam.target, dt);
    const floor = world.sea ? -75 : world.water ? world.water.y + 0.3 : -20;
    const fallMsg = () => world.water && world.water.lava ? '¡Caíste a la lava!' : zone.id === 'puerto_bruma' ? 'Caíste al mar de nubes' : 'Caíste al vacío';
    if (player.pos.y < floor && player.hp > 0) {
      audio.play(world.water && world.water.lava ? 'fire' : 'splash');
      if (player.diff && !player.diff.fallHurts) { toast(fallMsg()); respawn(save.checkpoint); return; }
      player.hp -= 1; $('hudHearts').classList.remove('hit'); void $('hudHearts').offsetWidth; $('hudHearts').classList.add('hit');
      if (player.hp <= 0) startDeath();
      else { toast(fallMsg()); respawn(save.checkpoint); }
    }
    if (combat.shakeAmt > 0) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * combat.shakeAmt, (Math.random() - 0.5) * combat.shakeAmt, (Math.random() - 0.5) * combat.shakeAmt));
  }
  if (state === 'play' || state === 'dialog') updateGoal(dt);
  if (state === 'play' && pieceBk && (pieceHintT -= dt) <= 0) { // destellos dorados alrededor de la vasija con la pieza
    pieceHintT = 0.9;
    const B = world.breakables.find(b => b.id === pieceBk);
    if (B && !B.broken && !piecesOf(save).includes('pz_' + zone.id) && B.pos.distanceTo(player.pos) < 32) fx.sparkle(B.pos.clone().setY(B.pos.y + 0.5 + Math.random() * 0.4), 3, 0xffe08a);
  }
  if (state === 'cutscene') updateCutscene(dt);
  if (state === 'dead') updateDeath(dt);
  if (state !== 'title') updateCombatHUD();
  if (state === 'title' && zone === null && charsReady) titleScene();
  if (state === 'title' && zone) { // cámara giratoria detrás del menú
    camera.position.set(Math.sin(time * 0.08) * 34, 16, Math.cos(time * 0.08) * 34);
    camera.lookAt(0, 2, 0);
  }

  world.update(time, dt);
  if (endless.active && state === 'play') { endless.update(dt, time); updateEndlessHud(); }
  skyTick(dt);
  powers.update(dt); powers.statusFx(player, dt); goalFxTick(dt);
  if (state !== 'title') updatePowerHUD();
  audio.listener = { x: camera.position.x, z: camera.position.z, yaw: cam.yaw, ref: 10 };
  musicMood(dt);
  soundHintTick(dt);
  fx.update(dt);
  for (const p of pulseFx) { p.t += dt; const k = p.t / 0.45; p.m.scale.setScalar(0.5 + k * p.r); p.m.material.opacity = 0.5 * (1 - k); if (k >= 1) { scene.remove(p.m); p.done = true; } }
  for (let i = pulseFx.length - 1; i >= 0; i--) if (pulseFx[i].done) pulseFx.splice(i, 1);
  const wantFov = 60 + player.anim.runW * 5 * (state === 'play' ? 1 : 0);
  if (Math.abs(camera.fov - wantFov) > 0.01) { camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix(); }
  sun.position.set(player.pos.x + 18, player.pos.y + 30, player.pos.z + 10);
  sun.target.position.copy(player.pos);
  sky.position.copy(camera.position);

  if (toastT > 0 && (toastT -= dt) <= 0) $('toast').style.opacity = 0;
  logrosTick(dt);
  updateGlideBar();
  if (bannerT > 0 && (bannerT -= dt) <= 0) $('zoneBanner').style.opacity = 0;

  if (settings.debug) {
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 0.5) { fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
    const p = player.pos;
    $('debug').textContent = `${fps} fps · x ${p.x.toFixed(1)} y ${p.y.toFixed(1)} z ${p.z.toFixed(1)} · ${player.grounded ? 'suelo' : 'aire'} · ${renderer.info.render.calls} draw calls`;
  }
}

// escena de fondo del título: la zona sin jugador activo
function titleScene() {
  save = loadSave() || newSave();
  zone = ZONES[save.zone];
  skyMat.uniforms.top.value.setHex(zone.sky.top);
  skyMat.uniforms.bottom.value.setHex(zone.sky.bottom);
  scene.fog = new THREE.Fog(zone.sky.fog, zone.sky.fogNear, zone.sky.fogFar);
  world.build(zone, save); music.ambient(ZONE_AMB[zone.id]);
  respawn(save.checkpoint);
}


// ---------- héroes ----------
const heroUI = { from: null, pv: null };
function heroPreview(cv) { // vista previa 3D pequeña del héroe
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.setSize(cv.clientWidth || 220, cv.clientHeight || 280, false); r.outputColorSpace = THREE.SRGBColorSpace;
  const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x556070, 1.6)); const d = new THREE.DirectionalLight(0xfff1d6, 1.8); d.position.set(2, 4, 3); sc.add(d);
  const cam = new THREE.PerspectiveCamera(30, (cv.clientWidth || 220) / (cv.clientHeight || 280), 0.1, 50); cam.position.set(0, 1.0, 6.4); cam.lookAt(0, 0.82, 0);
  const P = { r, sc, cam, ch: null, rot: 0.4, clock: new THREE.Clock(), raf: 0 };
  P.set = look => {
    if (P.ch) sc.remove(P.ch.root);
    P.ch = createCharacter(charLib, look); sc.add(P.ch.root);
    const a = P.ch.actions.Cheer || P.ch.actions.Idle || Object.values(P.ch.actions)[0]; if (a) { a.setEffectiveWeight(1); a.play(); }
  };
  P.stop = () => { cancelAnimationFrame(P.raf); r.dispose(); r.forceContextLoss(); };
  const loop = () => { P.raf = requestAnimationFrame(loop); const dt = P.clock.getDelta(); P.rot += dt * 0.6; if (P.ch) { P.ch.root.rotation.y = P.rot; P.ch.mixer.update(dt); } r.render(sc, cam); };
  loop(); return P;
}
function openHeroes(from) {
  const sv = from === 'title' ? loadSave() : save; if (!sv || !charLib) return;
  heroUI.from = from; heroUI.sv = sv;
  if (from === 'play') state = 'pause';
  if (from !== 'play') $(from).classList.add('hidden');
  $('heroes').classList.remove('hidden');
  heroUI.pv = heroPreview($('heroPreview'));
  buildHeroGrid();
}
function buildHeroGrid() {
  const sv = heroUI.sv, n = pieceCount(sv), grid = $('heroGrid'); grid.innerHTML = '';
  const cur = heroById(sv.hero);
  heroUI.pv.set(heroLook(cur.id, sv.custom));
  $('heroSub').textContent = `Cada héroe tiene su propia ventaja. Tienes ${n} de ${PIECE_TOTAL} Piezas especiales.`;
  for (const h of HEROES) {
    const ok = heroUnlocked(h, n), b = document.createElement('button');
    b.className = 'heroCard' + (h.id === cur.id ? ' sel' : '') + (ok ? '' : ' locked');
    const col = '#' + h.color.toString(16).padStart(6, '0');
    b.innerHTML = `<span class="em" style="background:${col}">${h.id === 'lia' ? '★' : h.name[0]}</span><span><b>${h.id === 'lia' ? escapeHtml(sv.name || h.name) : h.name}</b><span class="perk">${h.perk}</span><small>${ok ? h.desc : `🔒 Reúne ${h.need} Piezas especiales (${n}/${h.need})`}</small></span>${h.id === cur.id ? '<span class="tag">En juego</span>' : ''}`;
    b.onmouseenter = b.onfocus = () => heroUI.pv.set(heroLook(h.id, sv.custom));
    b.onmouseleave = () => heroUI.pv.set(heroLook(heroById(sv.hero).id, sv.custom));
    b.onclick = () => {
      if (!ok) { audio.play('hurt'); return; }
      sv.hero = h.id; audio.play('open');
      if (sv === save) { applyHero(); applyAbilities(); if (player.hp > player.maxHp) player.hp = player.maxHp; fx.sparkle(player.pos.clone().setY(player.pos.y + 1), 24, h.color); writeSave(save); toast(`Ahora juegas con ${h.id === 'lia' ? (sv.name || 'tu heroína') : h.name}: ${h.perk}`); }
      else { writeSaveRaw(sv); applySlotLook(); }
      buildHeroGrid();
      if (heroUI.from === 'play' || heroUI.from === 'arenaMenu') closeHeroes();
    };
    grid.appendChild(b);
  }
}
function closeHeroes() {
  if (heroUI.pv) { heroUI.pv.stop(); heroUI.pv = null; }
  $('heroes').classList.add('hidden');
  if (heroUI.from === 'play') { state = 'play'; return; }
  $(heroUI.from).classList.remove('hidden');
  if (heroUI.from === 'arenaMenu') refreshArenaMenu();
}
$('bHeroesBack').onclick = closeHeroes;
$('bHeroesPause').onclick = () => { if (challenge) { toast('En los desafíos no se cambia de héroe'); return; } openHeroes('pause'); };
$('bHubHeroes').onclick = () => openHeroes('title');

// ---------- misiones y piezas ----------
const misUI = { from: null };
function openMisiones(from) {
  const sv = from === 'title' ? loadSave() : save; if (!sv) return;
  misUI.from = from;
  const got = new Set(piecesOf(sv)), n = got.size;
  $('misCount').textContent = `${n} de ${PIECE_TOTAL} Piezas especiales`;
  const perks = [`♥ +${pieceHearts(sv)} corazones (uno cada 4 piezas)`, ...HEROES.filter(h => h.need).map(h => `${n >= h.need ? '✓' : '🔒'} ${h.name} con ${h.need} piezas`)];
  $('misPerks').innerHTML = perks.map((t, i) => `<span class="${i === 0 ? (pieceHearts(sv) ? 'on' : '') : (t.startsWith('✓') ? 'on' : '')}">${t}</span>`).join('');
  $('misList').innerHTML = MISIONES.map(M => {
    const v = Math.min(M.goal, M.prog(sv)), done = got.has('pz_' + M.id);
    return `<div class="mis${done ? ' done' : ''}"><span class="ic">${done ? '✓' : M.icon}</span><b>${M.title}</b><small>${M.desc} · Premio: 1 pieza</small><span class="bar"><i style="width:${v / M.goal * 100}%"></i></span></div>`;
  }).join('');
  $('misZones').innerHTML = Object.entries(ZONE_PIECES).map(([zid, name]) => { const Z = ZONES_BASE[zid]; const ok = got.has('pz_' + zid); return `<span class="${ok ? 'got' : ''}">${ok ? '⚙ ' + name : '? ' + (Z ? Z.title : zid)}</span>`; }).join('');
  $(from).classList.add('hidden'); $('misiones').classList.remove('hidden');
}
$('bMisBack').onclick = () => { $('misiones').classList.add('hidden'); $(misUI.from).classList.remove('hidden'); };
$('bMisPause').onclick = () => openMisiones('pause');
$('bHubMis').onclick = () => openMisiones('title');

// ---------- Armería ----------
const armUI = { from: null, tab: 'arma' };
function openArmeria(from) {
  const sv = from === 'title' ? loadSave() : save; if (!sv) return;
  armUI.from = from; armUI.sv = sv;
  $(from).classList.add('hidden'); $('armeria').classList.remove('hidden');
  buildArmeria();
}
function buildArmeria() {
  const sv = armUI.sv, g = gearOf(sv), ecos = sv.ecos || 0;
  $('armSub').innerHTML = `Tienes <b class="ecoTag">✧ ${ecos} Ecos</b>. Los ganas venciendo enemigos, rompiendo vasijas, encontrando fragmentos, reliquias y piezas, en la Arena, en los desafíos y en Aethra sin fin.`;
  $('armTabs').innerHTML = `<button class="${armUI.tab === 'arma' ? 'sel' : ''}" data-t="arma"><b>🗡</b><small>Armas</small></button><button class="${armUI.tab === 'armadura' ? 'sel' : ''}" data-t="armadura"><b>🛡</b><small>Armaduras</small></button>`;
  $('armTabs').querySelectorAll('button').forEach(b => b.onclick = () => { armUI.tab = b.dataset.t; audio.play('uiMove'); buildArmeria(); });
  const grid = $('armGrid'); grid.innerHTML = '';
  for (const it of armUI.tab === 'arma' ? WEAPONS : ARMORS) {
    const own = g.owned.includes(it.id), on = g[armUI.tab] === it.id, can = ecos >= it.cost, b = document.createElement('button');
    b.className = 'powCard' + (own || can ? '' : ' locked') + (on ? ' on' : '');
    b.innerHTML = `<span class="ic">${it.icon}</span><b>${it.name}</b><small>${it.desc}</small><em>${on ? 'Equipado' : own ? 'Tuyo · pulsa para equipar' : `✧ ${it.cost} Ecos${can ? ' · pulsa para comprar' : ` (te faltan ${it.cost - ecos})`}`}</em>${on ? '<span class="slotTag">Puesto</span>' : ''}`;
    b.onclick = () => {
      if (!own) {
        if (!can) { audio.play('powerFail'); return; }
        sv.ecos = ecos - it.cost; g.owned.push(it.id); audio.play('unlock'); music.stinger('hallazgo');
      } else audio.play('open');
      g[armUI.tab] = it.id;
      if (sv === save) { writeSave(save); applyHero(); applyAbilities(); player.hp = Math.min(player.hp, player.maxHp); updateHUD(); }
      else writeSaveRaw(sv);
      buildArmeria();
    };
    grid.appendChild(b);
  }
}
$('bArmBack').onclick = () => { $('armeria').classList.add('hidden'); $(armUI.from).classList.remove('hidden'); if (armUI.from === 'arenaMenu') refreshArenaMenu(); };
$('bArmPause').onclick = () => openArmeria('pause');
$('bHubArm').onclick = () => openArmeria('title');

// ---------- poderes especiales ----------
const powUI = { from: null, slot: 0 };
function openPoderes(from) {
  const sv = from === 'title' ? loadSave() : save; if (!sv) return;
  powUI.from = from; powUI.sv = sv; powUI.slot = 0;
  $(from).classList.add('hidden'); $('poderes').classList.remove('hidden');
  buildPoderes();
}
function buildPoderes() {
  const sv = powUI.sv, pts = powerPoints(sv), slots = loadout(sv);
  sv.poderes = slots;
  $('powSub').textContent = `Tienes ${pts} punto${pts === 1 ? '' : 's'} de poder (piezas especiales + victorias en la Arena). Elige un hueco y luego el poder que quieres en él. Se lanzan con 1, 2 y 3${sv.flags && sv.flags.baston ? '' : ' (en la historia, desde que consigues el bastón; en la Arena, siempre)'}.`;
  $('powSlots').innerHTML = [0, 1, 2].map(i => { const P = powerById(slots[i]); return `<button class="${powUI.slot === i ? 'sel' : ''}" data-i="${i}"><b>${P ? P.icon : '·'}</b><small>Tecla ${i + 1}: ${P ? P.name : 'vacío'}</small></button>`; }).join('');
  $('powSlots').querySelectorAll('button').forEach(b => b.onclick = () => { powUI.slot = +b.dataset.i; buildPoderes(); });
  const grid = $('powGrid'); grid.innerHTML = '';
  for (const P of POWERS) {
    const ok = powerUnlocked(P, sv), at = slots.indexOf(P.id), b = document.createElement('button');
    b.className = 'powCard' + (ok ? '' : ' locked') + (at >= 0 ? ' on' : '');
    b.innerHTML = `<span class="ic">${P.icon}</span><b>${P.name}</b><small>${P.desc}</small><em>${ok ? `Energía ${P.cost} · espera ${P.cd} s` : `🔒 Necesitas ${P.need} puntos de poder (${pts}/${P.need})`}</em>${at >= 0 ? `<span class="slotTag">Tecla ${at + 1}</span>` : ''}`;
    b.onclick = () => {
      if (!ok) { audio.play('hurt'); return; }
      const cur = loadout(sv); const j = cur.indexOf(P.id);
      if (j >= 0) cur[j] = cur[powUI.slot];
      cur[powUI.slot] = P.id; sv.poderes = cur.filter(Boolean);
      audio.play('open'); if (sv === save) { writeSave(save); applyPowers(); } else writeSaveRaw(sv);
      powUI.slot = (powUI.slot + 1) % 3; buildPoderes();
    };
    grid.appendChild(b);
  }
}
$('bPowBack').onclick = () => { $('poderes').classList.add('hidden'); $(powUI.from).classList.remove('hidden'); if (powUI.from === 'arenaMenu') refreshArenaMenu(); };
$('bPowPause').onclick = () => openPoderes('pause');
$('bHubPow').onclick = () => openPoderes('title');

// ---------- Arena multijugador ----------
const arena = new Arena({
  scene, physics, world, combat, fx, audio, music, input, cam, cam2, setSplit, player,
  charLib: () => charLib, getSave: () => save, toast, powers, enemyTarget,
  loadArenaZone(Z) {
    zone = Z; player.inSub = false; player.swimming = false; clearSeaFx(); audio.surface = 'stone';
    skyMat.uniforms.top.value.setHex(Z.sky.top); skyMat.uniforms.bottom.value.setHex(Z.sky.bottom);
    scene.fog = new THREE.Fog(Z.sky.fog, Z.sky.fogNear, Z.sky.fogFar);
    hemi.color.setHex(Z.light.hemiSky); hemi.groundColor.setHex(Z.light.hemiGround); sun.color.setHex(Z.light.sun);
    world.build(Z, save || newSave()); music.ambient('desert');
    player.updrafts = world.updrafts; combat.spawnZone(Z, save || newSave()); combat.breakables = world.breakables;
    pieceBk = null; bossActive = false; $('bossbar').classList.add('hidden');
    marker.visible = false; $('objective').classList.add('hidden'); $('compass').classList.add('hidden'); $('prompt').classList.add('hidden');
    banner(Z.subtitle, Z.title);
  },
  addEcos: n => { addEcos(n); if (save) writeSave(save); },
  bump: k => (isAutoMode() ? 0 : bump(k)), bumpMax: (k, v) => (save && !isAutoMode() ? bumpMaxL(save, k, v) : v),
  checkMissions: () => { checkMissions(); if (save) writeSave(save); },
  pulseFx: (pos, r) => { const sph = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff2a8, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })); sph.position.copy(pos).setY(pos.y + 0.9); scene.add(sph); pulseFx.push({ m: sph, t: 0, r }); },
});
wireChat(arena);
input.onPad = () => { if (!padWoke) { padWoke = true; wakeAudio(); } };
// los navegadores no dejan encender el sonido con el mando: si sigue apagado, se avisa para tocar una vez
let soundHintT = 0;
function soundHintTick(dt) {
  const on = audio.ctx && audio.ctx.state === 'running';
  soundHintT = on ? 0 : soundHintT + dt;
  $('soundHint').classList.toggle('hidden', on || soundHintT < 2.5 || (settings.volume ?? 0.7) <= 0);
}
$('soundHint').onclick = () => { wakeAudio(); $('soundHint').classList.add('hidden'); };

// ---------- corriente de regreso ----------
// Al terminar un capítulo hay que volver con Marta, a veces a más de 100 m. Aparece un remolino de viento
// junto a la protagonista que la lleva de vuelta en un momento (también se puede volver andando).
let rWind = null;
function removeReturnWind() { if (rWind) { scene.remove(rWind.g); rWind = null; } if (cArch) { scene.remove(cArch.g); cArch = null; } }
// Arco «El camino sigue»: en la isla más lejana de una zona ya terminada, el camino continúa sin fin
let cArch = null;
function zoneEnd(g) {
  let best = null, bd = -1;
  for (const I of (zone.islands || []).slice(0, zone._baseIslands ?? Infinity)) { const d = Math.hypot(I.x - g.at[0], I.z - g.at[2]); if (d > bd) { bd = d; best = I; } }
  return best && bd > 45 ? { I: best, d: bd } : null;
}
function continueArchTick(dt, g) {
  if (endless.active) { if (cArch) { scene.remove(cArch.g); cArch = null; } return; }
  const E = zoneEnd(g); if (!E) return;
  const I = E.I, dx = I.x - g.at[0], dz = I.z - g.at[2], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
  const half = Math.min(I.w, I.d) / 2, ex = I.x + ux * (half - 0.8), ez = I.z + uz * (half - 0.8), ey = I.top ?? 0;
  if (Math.hypot(player.pos.x - I.x, player.pos.z - I.z) > 40) { if (cArch) { scene.remove(cArch.g); cArch = null; } return; }
  if (!cArch) {
    const G = new THREE.Group(); G.position.set(ex, ey, ez); G.rotation.y = Math.atan2(ux, uz); scene.add(G);
    const gold = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xff9a20, emissiveIntensity: 1.2, metalness: 0.5, roughness: 0.3 });
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.16, 8, 40, Math.PI), gold); arch.position.y = 0.1; arch.rotation.z = 0; G.add(arch);
    for (const sx of [-1.7, 1.7]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.3, 8), gold); p.position.set(sx, 0.15, 0); G.add(p); }
    const veil = new THREE.Mesh(new THREE.CircleGeometry(1.55, 32, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    veil.position.y = 0.1; G.add(veil);
    cArch = { g: G, veil, t: 0, ex, ey, ez, h: Math.atan2(-ux, -uz) };
    toast('Al borde de la isla brilla un arco dorado: ¡el camino sigue más allá!');
  }
  cArch.t += dt; cArch.veil.material.opacity = 0.2 + Math.sin(cArch.t * 3) * 0.1;
  if (Math.random() < 0.25) fx.sparkle(cArch.g.position.clone().setY(cArch.ey + 0.5 + Math.random() * 1.5), 1, 0xffd27a);
  if (Math.hypot(player.pos.x - cArch.ex, player.pos.z - cArch.ez) < 2.6 && Math.abs(player.pos.y - cArch.ey) < 2.5) startEndlessInZone(cArch);
}
let inZoneOpts = null;
function startEndlessInZone(A) {
  const B = { name: `Más allá de ${zone.title}`, music: ZONE_MUSIC[zone.id] || CH_MUSIC[zone.id] || 'infinito', surface: audio.surface,
    top: (zone.palette && zone.palette.top) || 0x7ccf6a, side: (zone.palette && zone.palette.side) || 0x7a5a3c, deco: zone.lava ? 'rock' : 'tree', crystal: 0xffd27a,
    foes: [...new Set((zone.enemies || []).map(e => e.type).filter(t => ['brote', 'espora', 'avispa', 'automata', 'brote_hielo', 'sombra'].includes(t)))].concat(['brote']).slice(0, 3), jets: !!zone.lava };
  inZoneOpts = { origin: { x: A.ex, y: A.ey, z: A.ez, h: A.h }, first: B };
  scene.remove(A.g); cArch = null;
  if (rWind) { scene.remove(rWind.g); rWind = null; }
  endUI.from = 'zone';
  player.setFight(true); player.canAirDash = player.canGlide = player.canShield = player.canPulse = true;
  player.powerSlots = loadout(save); powerHudSig = '';
  endless.start(inZoneOpts);
  $('endlessHud').classList.remove('hidden');
  banner('El camino continúa', B.name); audio.play('unlock'); music.stinger && music.stinger('hallazgo');
}
function restoreZoneSky() {
  skyT.on = false;
  skyMat.uniforms.top.value.setHex(zone.sky.top); skyMat.uniforms.bottom.value.setHex(zone.sky.bottom);
  if (scene.fog) scene.fog.color.setHex(zone.sky.fog);
}
function stopEndlessInZone(quiet = false) {
  endless.stop(); $('endlessHud').classList.add('hidden'); $('endlessEnd').classList.add('hidden');
  restoreZoneSky(); applyAbilities();
  if (!quiet) toast('Volviste a la isla');
}
function placeReturnWind(g) {
  const f = new THREE.Vector3(-Math.sin(player.facing), 0, -Math.cos(player.facing));
  let x = player.pos.x + f.x * 2.6, z = player.pos.z + f.z * 2.6;
  let gr = physics.groundAt(x, z, 0.1, player.pos.y + 2);
  if (!(gr.y > player.pos.y - 1.5)) { x = player.pos.x + f.z * 2; z = player.pos.z - f.x * 2; gr = physics.groundAt(x, z, 0.1, player.pos.y + 2); }
  if (!(gr.y > player.pos.y - 1.5)) { x = player.pos.x; z = player.pos.z; gr = { y: player.pos.y }; }
  if (!rWind) {
    const G = new THREE.Group(); scene.add(G);
    const mat = new THREE.MeshBasicMaterial({ color: 0xbff4ff, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const rings = [0, 1, 2, 3, 4].map(i => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.9 - i * 0.08, 0.05, 6, 36), mat); r.rotation.x = Math.PI / 2; r.position.y = 0.2 + i * 0.6; G.add(r); return r; });
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.5, 3.2, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x9fe3ff, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    col.position.y = 1.6; G.add(col);
    rWind = { g: G, rings, text: g.text, t: 0 };
    toast('Una corriente de viento puede llevarte de vuelta con Marta: entra en ella');
    audio.play('glide', G.position);
  }
  rWind.g.position.set(x, gr.y, z);
}
function returnWindTick(dt, g) {
  const wants = state === 'play' && g && g.at && !challenge && !(endless.active && !endless.inZone) && /vuelve con|vuelve al barco|regresa/i.test(g.text) && !player.inSub && !player.swimming;
  const far = wants && Math.hypot(player.pos.x - g.at[0], player.pos.z - g.at[2]) > 45;
  if (!far) { if (rWind && (!wants || Math.hypot(player.pos.x - g.at[0], player.pos.z - g.at[2]) < 30)) removeReturnWind(); return; }
  if (!rWind || rWind.g.position.distanceTo(player.pos) > 28) placeReturnWind(g);
  continueArchTick(dt, g);
  if (!rWind) return;
  const W = rWind; W.t += dt;
  W.rings.forEach((r, i) => { r.rotation.z += dt * (2 + i); r.position.y = 0.2 + ((i * 0.6 + W.t * 1.2) % 3); r.scale.setScalar(1 + Math.sin(W.t * 3 + i) * 0.08); });
  if (Math.random() < 0.3) fx.sparkle(W.g.position.clone().setY(W.g.position.y + Math.random() * 3), 1, 0xbff4ff);
  const p = W.g.position;
  if (Math.hypot(player.pos.x - p.x, player.pos.z - p.z) < 1.1 && player.pos.y - p.y > -0.5 && player.pos.y - p.y < 3) {
    // ¡adentro! viaje de vuelta
    removeReturnWind(); if (endless.active && endless.inZone) stopEndlessInZone(true); player.frozen = true; $('fade').style.opacity = 1; audio.play('dash'); fx.rainbow(player.pos.clone().setY(player.pos.y + 1), 24);
    const to = g.at;
    setTimeout(() => {
      let best = null;
      for (const [dx, dz] of [[2.4, 1.5], [-2.4, 1.5], [0, 2.6], [2.6, -1], [-2.6, -1]]) { const gr = physics.groundAt(to[0] + dx, to[2] + dz, 0.1, to[1] + 3); if (gr.y > to[1] - 1.2) { best = [to[0] + dx, gr.y, to[2] + dz]; break; } }
      if (!best) best = [to[0], to[1] + 0.05, to[2] + 1.5];
      player.teleport(best[0], best[1] + 0.05, best[2], Math.atan2(best[0] - to[0], best[2] - to[2]));
      cam.snap(player); player.frozen = false; $('fade').style.opacity = 0;
      toast('El viento te dejó de vuelta'); audio.play('checkpoint');
    }, 650);
  }
}

// ---------- sonido: suelo bajo los pies y música de combate ----------
function surfaceOf(Z) {
  if (!Z) return 'grass';
  if (Z.id === 'ciudad_engranajes' || Z.id === 'ciudadela_orden') return 'stone';
  const c = new THREE.Color((Z.palette && Z.palette.top) || 0x7ccf6a), h = {}; c.getHSL(h);
  if (h.l > 0.78 && h.s < 0.45) return 'snow';
  if (h.h > 0.07 && h.h < 0.16 && h.s > 0.3) return 'sand';
  if (h.s < 0.22 || h.l < 0.3) return 'stone';
  return 'grass';
}
let moodT = 0;
function musicMood(dt) {
  if ((moodT -= dt) > 0) return; moodT = 0.25;
  let I = 0;
  if (state === 'play' || state === 'arena') {
    for (const e of combat.enemies) {
      if (!e.alive) continue;
      const d = e.pos.distanceTo(player.pos);
      if (d < 16 && (e.state === 'chase' || e.state === 'windup' || e.state === 'attack' || e.state === 'notice' || d < 7)) { I = 1; break; }
      if (d < 22) I = Math.max(I, 0.4);
    }
  }
  music.setIntensity(I);
}

// ---------- Aethra sin fin ----------
const skyT = { top: new THREE.Color(), bottom: new THREE.Color(), fog: new THREE.Color(), on: false };
function skyTick(dt) {
  if (!skyT.on) return;
  const k = Math.min(1, dt * 0.5);
  skyMat.uniforms.top.value.lerp(skyT.top, k); skyMat.uniforms.bottom.value.lerp(skyT.bottom, k);
  if (scene.fog) scene.fog.color.lerp(skyT.fog, k);
  if (world.water && world.water.mesh) world.water.mesh.material.color.lerp(skyT.fog, k);
}
const endless = new Endless({
  scene, world, physics, combat, fx, audio, player, toast, banner: (a, b) => banner(a, b),
  setSky(top, bottom, fog, instant) {
    skyT.top.setHex(top); skyT.bottom.setHex(bottom); skyT.fog.setHex(fog); skyT.on = true;
    if (instant) { skyMat.uniforms.top.value.setHex(top); skyMat.uniforms.bottom.value.setHex(bottom); scene.fog.color.setHex(fog); }
  },
  setMusic(key) { ZONE_MUSIC.infinito = key; },
});
const endUI = { from: null };
function startEndless(from) {
  const sv = from === 'title' ? loadSave() : save; if (!sv) return;
  if (from === 'title') { save = sv; storeOf(save); applyPartida(); applyHero(); }
  endUI.from = from;
  audio.unlock(); music.init(); goFull();
  if (dialog) closeDialog(false);
  showOverlay(null); $('endlessEnd').classList.add('hidden');
  if (endless.active) endless.stop();
  loadZone('infinito');
  // en el mapa sin fin se juega con todo el equipo
  player.setFight(true); player.canAirDash = player.canGlide = player.canShield = player.canPulse = true; player.canGrapple = false;
  player.powerSlots = loadout(save); powerHudSig = '';
  endless.start();
  respawn(); player.hp = player.maxHp;
  state = 'play'; lastGoal = '';
  $('endlessHud').classList.remove('hidden');
}
function stopEndless() {
  endless.stop(); skyT.on = false;
  $('endlessHud').classList.add('hidden'); $('endlessEnd').classList.add('hidden');
}
function updateEndlessHud() {
  const best = (save && storeOf(save).n.infinitoMax) || 0;
  const txt = `📏 ${Math.round(endless.dist)} m · ✦ ${endless.chispas} · Récord ${Math.max(best, Math.round(endless.dist))} m · ${endless.biomeOf(endless.sectorNow).name}`;
  if ($('endlessHud').textContent !== txt) $('endlessHud').textContent = txt;
  // el mar de nubes acompaña siempre por debajo
  const sec = endless.sectors.find(s => s.id === endless.sectorNow) || endless.sectors[0];
  if (world.water && sec && !endless.inZone) { world.water.y = sec.minY - 14; world.water.mesh.position.set(player.pos.x, world.water.y, player.pos.z); }
}
function endlessOver() {
  state = 'endlessEnd'; endless.over = true;
  $('fade').style.opacity = 0;
  const m = Math.round(endless.dist), prev = (storeOf(save).n.infinitoMax) || 0;
  const best = isAutoMode() ? prev : bumpMaxL(save, 'infinitoMax', m);
  if (!isAutoMode()) { addEcos(endless.chispas * ECO_REWARD.chispa); storeOf(save).n.chispas = (storeOf(save).n.chispas || 0) + endless.chispas; checkMissions(); writeSave(save); }
  $('endlessEndTitle').textContent = m > prev && !isAutoMode() ? '¡Nuevo récord!' : 'Fin del viaje';
  $('endlessEndSub').textContent = `Llegaste a ${m} m (sector ${endless.sectorNow + 1}, ${endless.biomeOf(endless.sectorNow).name}) y juntaste ${endless.chispas} chispas. Tu récord: ${best} m.`;
  music.stinger(m > prev ? 'victoria' : 'derrota');
  $('endlessEnd').classList.remove('hidden');
}
$('bEndlessAgain').onclick = () => {
  $('endlessEnd').classList.add('hidden');
  if (endUI.from === 'zone') { endless.stop(); restoreZoneSky(); endless.start(inZoneOpts); respawn(); player.hp = player.maxHp; player.dead = false; state = 'play'; $('fade').style.opacity = 0; return; }
  startEndless(endUI.from);
};
$('bEndlessLeave').onclick = () => {
  if (endUI.from === 'zone') { stopEndlessInZone(true); player.hp = player.maxHp; state = 'play'; respawn(save.checkpoint); $('fade').style.opacity = 0; return; }
  stopEndless();
  if (endUI.from === 'title') { state = 'title'; zone = null; music.play('title'); showOverlay('title'); openHub(); }
  else { applyAbilities(); enterZone(save.zone, save.checkpoint); }
};
$('bEndlessPause').onclick = () => { if (challenge) { toast('Termina o sal del desafío primero'); return; } startEndless('pause'); };
$('bHubEndless').onclick = () => { audio.unlock(); startEndless('title'); };

const arenaUI = { from: null, mode: 'duelo', who: 'cpu', p2hero: 'kael', code: '' };
const WHO = [['cpu', 'Contra la CPU', 'Tú contra un héroe controlado por el juego.'], ['local', '2 jugadores aquí', 'Pantalla dividida en este dispositivo: teclado compartido o mandos.'], ['online', 'Online', 'Cada uno desde su dispositivo, en tiempo real, viendo a los demás moverse.']];
function openArena(from) {
  if (endless.active && from === 'pause') stopEndless();
  const sv = from === 'title' ? loadSave() : save; if (!sv) return;
  if (from === 'title') { save = sv; storeOf(save); applyPartida(); applyHero(); }
  arenaUI.from = from;
  $(from).classList.add('hidden'); $('arenaMenu').classList.remove('hidden');
  if (!arenaUI.code) arenaUI.code = randomCode();
  $('arenaCode').value = arenaUI.code; $('arenaNetMsg').textContent = '';
  refreshArenaMenu();
}
const randomCode = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
function refreshArenaMenu() {
  const mk = (box, list, key) => {
    box.innerHTML = '';
    for (const [id, name, desc, ic] of list) {
      const b = document.createElement('button'); if (arenaUI[key] === id) b.classList.add('sel');
      b.innerHTML = `${ic ? `<span class="ic">${ic}</span>` : ''}<b>${name}</b><small>${desc}</small>`;
      b.onclick = () => { arenaUI[key] = id; audio.play('open'); refreshArenaMenu(); };
      box.appendChild(b);
    }
  };
  mk($('arenaModes'), Object.entries(ARENA_MODES).map(([id, M]) => [id, M.name, M.desc, M.icon]), 'mode');
  mk($('arenaWho'), WHO, 'who');
  $('arenaLocalOpts').classList.toggle('hidden', arenaUI.who !== 'local');
  $('arenaOnlineOpts').classList.toggle('hidden', arenaUI.who !== 'online');
  const n = pieceCount(save), row = $('p2Heroes'); row.innerHTML = '';
  for (const h of HEROES) {
    const b = document.createElement('button'); b.textContent = h.id === 'lia' ? 'Exploradora' : h.name; b.disabled = !heroUnlocked(h, n);
    if (arenaUI.p2hero === h.id) b.classList.add('sel');
    b.onclick = () => { arenaUI.p2hero = h.id; refreshArenaMenu(); };
    row.appendChild(b);
  }
  const me = heroById(save.hero);
  $('bArenaHero').textContent = `Mi héroe: ${me.id === 'lia' ? (save.name || 'tu heroína') : me.name} · cambiar`;
}
$('bArenaHero').onclick = () => openHeroes('arenaMenu');
$('bArenaPow').onclick = () => openPoderes('arenaMenu');
$('bArenaLook').onclick = () => openCustom('arenaMenu');
$('bArenaNewCode').onclick = () => { arenaUI.code = randomCode(); $('arenaCode').value = arenaUI.code; };
$('arenaCode').onkeydown = e => e.stopPropagation();
$('bArenaBack').onclick = () => { $('arenaMenu').classList.add('hidden'); $(arenaUI.from).classList.remove('hidden'); };
$('bArenaGo').onclick = async () => {
  audio.unlock(); music.init(); goFull();
  let net = null;
  if (arenaUI.who === 'online') {
    const code = ($('arenaCode').value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    if (code.length < 3) { $('arenaNetMsg').textContent = 'Escribe un código de al menos 3 letras o números.'; return; }
    arenaUI.code = code; $('arenaNetMsg').textContent = 'Conectando…'; $('bArenaGo').disabled = true;
    try { net = await Net.open(code); } catch (e) { net = null; }
    $('bArenaGo').disabled = false;
    if (!net) { $('arenaNetMsg').textContent = 'No se pudo abrir la sala. Prueba otra vez.'; return; }
    if (net.kind === 'local') toast('Sala local: funciona entre pestañas de este navegador. En claude.ai se conecta con otras personas.');
  }
  if (state === 'pause') writeSave(save);
  $('arenaMenu').classList.add('hidden'); showOverlay(null);
  if (dialog) closeDialog(false);
  state = 'arena';
  arena.start({ mode: arenaUI.mode, players: arenaUI.who, net, p2hero: arenaUI.p2hero, from: arenaUI.from, code: arenaUI.code });
};
function leaveArena() {
  if (!arena.active) return;
  const from = arena.from;
  arena.exit();
  applyPartida(); applyHero();
  if (from === 'title') { state = 'title'; zone = null; music.play('title'); showOverlay('title'); openHub(); }
  else { state = 'play'; enterZone(save.zone, save.checkpoint); }
}
$('arenaExit').onclick = () => arena.togglePause();
$('bArenaResume').onclick = () => arena.togglePause();
$('bArenaLeave').onclick = leaveArena;
$('bArenaEndLeave').onclick = leaveArena;
$('bArenaAgain').onclick = () => arena.again();
$('bArenaPause').onclick = () => { if (challenge) { toast('Termina o sal del desafío antes de ir a la Arena'); return; } openArena('pause'); };
$('bHubArena').onclick = () => { audio.unlock(); openArena('title'); };

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (composer) composer.setSize(innerWidth, innerHeight);
});

frame();

// gancho para pruebas automáticas
// step(n): avanza n pasos de 1/60 s sin depender de la velocidad de dibujo (para pruebas en máquinas lentas)
window.__aethra = {
  music, renderer, auto, navLog, nav, autoTarget: () => autoTarget(), get focus() { return focus; },
  player, cam, world, input, get state() { return state; }, get save() { return save; }, startGame, newSave, loadZone,
  // atajos para las pruebas: partida nueva sin pasar por los menús, y abrir los desafíos de la partida
  testNewGame(name = 'Prueba', difficulty = settings.difficulty, opts = {}) { nueva.name = name; nueva.diff = DIFF[difficulty] ? difficulty : 'normal'; nueva.slot = freeSlot() || getSlot() || 1; createPartida(settings.custom || {}); if (opts.sellos !== false) for (const id of Object.keys(SENDEROS)) save.flags['sello_' + id] = true; }, // las pruebas de capítulos saltan los Senderos
  openChallenges() { if (!loadSave()) { nueva.name = 'Prueba'; nueva.diff = DIFF[settings.difficulty] ? settings.difficulty : 'normal'; nueva.slot = freeSlot() || 1; const sv = newSave({ name: 'Prueba', difficulty: nueva.diff, custom: settings.custom || {} }); setSlot(nueva.slot); writeSlot(nueva.slot, sv); } $('bHubCh').click(); },
  playCredits: (then) => playCredits(save, then || (() => {})), showChapterEnd, startEnding, openTrophies, offerLowerDifficulty, get lossStreak() { return lossStreak; },
  showIntro, get introRun() { return introRun; }, arena, openArena, openArmeria, openHeroes, openMisiones, openPoderes, powers, audio, leaveArena, checkMissions, get arenaUI() { return arenaUI; }, Net,
  endless, startEndless, stopEndless, startChallenge,
  hold(on) { paused4test = on; }, S, combat, enterZone, choose, get zone() { return zone; }, get dialog() { return dialog; },
  step(n, press) {
    for (let i = 0; i < n; i++) { if (press && i === 0) input._pressed.add(press); simulate(1 / 60); input.endFrame(); }
  },
};
