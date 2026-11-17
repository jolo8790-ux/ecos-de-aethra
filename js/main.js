import * as THREE from 'three';
import { Input } from './input.js';
import { Physics } from './physics.js';
import { Player, angleDiff } from './player.js';
import { FollowCamera } from './camera.js';
import { World } from './world.js';
import { Audio } from './audio.js';
import { Music } from './music.js';
import { DESAFIOS, medalFor } from './zones/desafios.js';
// Modo desafío: mientras está activo, nada se guarda en la partida de la historia.
let challenge = null;
const writeSave = s => challenge ? true : writeSaveRaw(s);
import { FX } from './fx.js';
import { loadCharacterLibrary } from './characters.js';
import { loadProps } from './props.js';
import { newSave, loadSave, writeSave as writeSaveRaw, loadSettings, writeSettings, exportCode, importCode } from './save.js';
import puertoBruma from './zones/puerto_bruma.js';
import bosqueColgante from './zones/bosque_colgante.js';
import ruinasVidrio from './zones/ruinas_vidrio.js';
import ciudadEngranajes from './zones/ciudad_engranajes.js';
import glaciarEco from './zones/glaciar_eco.js';
import ciudadelaOrden from './zones/ciudadela_orden.js';
import { Combat, DIFF } from './combat.js';

const ZONES_BASE = { puerto_bruma: puertoBruma, bosque_colgante: bosqueColgante, ruinas_vidrio: ruinasVidrio, ciudad_engranajes: ciudadEngranajes, glaciar_eco: glaciarEco, ciudadela_orden: ciudadelaOrden };
const ZONES = { ...ZONES_BASE }; for (const L of DESAFIOS) ZONES[L.id] = L;
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
const ZONE_MUSIC = { puerto_bruma: 'puerto', bosque_colgante: 'bosque', ruinas_vidrio: 'ruinas', ciudad_engranajes: 'ciudad', glaciar_eco: 'glaciar', ciudadela_orden: 'ciudadela' };
const BOSS_MUSIC = { bosque_colgante: 'boss_raiz', ruinas_vidrio: 'boss_escorpion', ciudad_engranajes: 'boss_coloso', glaciar_eco: 'boss_sierpe', ciudadela_orden: 'vaelor' };
const CH_MUSIC = { desafio_1: 'desafio', desafio_2: 'desafio', desafio_3: 'desafio_noche', desafio_4: 'ruinas', desafio_5: 'desafio_noche' };
const ZONE_AMB = { desafio_1: 'sea', desafio_2: 'desert', desafio_3: 'ice', desafio_4: 'desert', desafio_5: 'city',  puerto_bruma: 'sea', bosque_colgante: 'forest', ruinas_vidrio: 'desert', ciudad_engranajes: 'city', glaciar_eco: 'ice', ciudadela_orden: 'dark' };
// los navegadores solo dejan sonar audio después de un gesto: el primero enciende todo
const wakeAudio = () => { audio.unlock(); if (music.init() && state === 'title') music.play('title'); };
addEventListener('pointerdown', wakeAudio); addEventListener('keydown', wakeAudio); addEventListener('touchstart', wakeAudio);
let duckNow = 1;
function updateMusic() {
  const d = state === 'pause' ? 0.35 : state === 'dialog' ? 0.6 : 1;
  if (d !== duckNow) { duckNow = d; music.duck(d); }
  if (state !== 'play' && state !== 'dialog' || !zone) return;
  const b = combat.boss, fighting = b && (b.state === 'intro' || b.fighting);
  music.play(fighting ? (BOSS_MUSIC[zone.id] || 'boss') : (ZONE_MUSIC[zone.id] || CH_MUSIC[zone.id]), { fade: fighting ? 0.8 : 2.5 });
}
const world = new World(scene, physics);
const fx = new FX(scene);
const player = new Player(scene, physics, audio, fx);
const cam = new FollowCamera(camera, physics);
const combat = new Combat(scene, physics, fx, audio);
combat.world = world;
let hookTarget = null;
let bossActive = false, deadT = 0, hintClang = false, hintStun = false, hintAura = false, lastHp = -1, endNext = null, pendingFinale = null;
const pulseFx = [];

let settings = loadSettings();
let save = null;
let state = 'title';
let zone = null;
let time = 0;
let dialog = null;
let focus = null;
let talkCooldown = 0;
const lookTarget = new THREE.Vector3();
let pendingChapterEnd = false, pendingEnding = false, cutscene = null, lastGoal = '';

// Estado de la historia que ven los datos de la zona (objetivos y diálogos).
const S = {
  has: f => !!(save && save.flags[f]),
  set: f => { save.flags[f] = true; writeSave(save); applyAbilities(); },
  frags: () => zone.fragments.filter(f => save.fragments.includes(f.id)).length,
  give: name => { toast(`Obtuviste: ${name}`); audio.play('fragment'); player.gesture('Cheer', { speed: 1.2, fadeOut: 0.3 }); },
  ending: () => { pendingEnding = true; },
  chapterEnd: () => { pendingChapterEnd = true; },
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
marker.visible = false;

applySettings();

// ---------- carga de personajes animados ----------
let charsReady = false;
$('bContinue').disabled = $('bNew').disabled = true;
let pChars = 0, pProps = 0;
const showLoad = () => { $('loading').textContent = `Cargando personajes y escenarios… ${Math.round((pChars * 0.4 + pProps * 0.6) * 100)}%`; };
Promise.all([
  loadCharacterLibrary(p => { pChars = p; showLoad(); })
    .then(lib => { player.useModel(lib); world.chars = lib; combat.chars = lib; })
    .catch(e => { console.warn('No se pudieron cargar los personajes animados; se usan los de formas simples.', e); }),
  loadProps(p => { pProps = p; showLoad(); }).catch(e => console.warn('Sin modelos de escenario', e)),
]).finally(() => { charsReady = true; $('loading').classList.add('hidden'); $('bContinue').disabled = $('bNew').disabled = false; });

// ---------- zonas ----------
function loadZone(id, checkpointId) {
  zone = ZONES[id];
  skyMat.uniforms.top.value.setHex(zone.sky.top);
  skyMat.uniforms.bottom.value.setHex(zone.sky.bottom);
  scene.fog = new THREE.Fog(zone.sky.fog, zone.sky.fogNear, zone.sky.fogFar);
  const li = zone.light || {};
  hemi.color.setHex(li.hemiSky || 0xdff1ff); hemi.groundColor.setHex(li.hemiGround || 0x5c6a50); sun.color.setHex(li.sun || 0xfff1d6);
  world.build(zone, save); music.ambient(ZONE_AMB[zone.id]);
  player.updrafts = world.updrafts;
  combat.spawnZone(zone, save); combat.breakables = world.breakables;
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
  player.maxHp = 4 + Math.floor(save.fragments.length / 5) + Math.floor((save.relics || []).length / 2);
}

// Entrar en una zona (al empezar, al continuar o al cambiar de capítulo), con su introducción la primera vez.
function enterZone(id, checkpointId) {
  save.zone = id; save.checkpoint = checkpointId; writeSave(save);
  loadZone(id, checkpointId);
  state = 'play'; lastGoal = '';
  const flag = id === 'puerto_bruma' ? 'intro' : 'intro_' + id;
  if (zone.story && zone.story.intro && !save.flags[flag]) {
    save.flags[flag] = true; writeSave(save);
    setTimeout(() => { if (state === 'play') startDialog(zone.story.intro, '', null, () => zone.story.onIntroEnd && zone.story.onIntroEnd(S)); }, 900);
  }
}

function respawn(checkpointId) {
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
const RELIC_TOTAL = 6;
combat.onBreak = B => {
  world.breakObject(B);
  audio.play('shatter'); fx.sparkle(B.pos, 18, B.kind === 'cofre' ? 0xc8a8ff : 0xffc890); combat.shake(0.08, 0.15); input.rumble(90, 0.4);
  if (B.loot === 'reliquia') world.spawnRelic(B.id, B.pos.clone().setY(B.pos.y - 0.45));
  else if (B.loot === 'corazon') combat.spawnHeal(B.pos.x, B.pos.y - 0.45, B.pos.z);
  else if (B.loot === 'reloj' && challenge) { challenge.t = Math.max(0, challenge.t - 3); audio.play('unlock'); toast('⏳ ¡Reloj de arena! −3 segundos'); }
};
function collectRelic(it) {
  world.interactables.splice(world.interactables.indexOf(it), 1);
  world.root.remove(it.mesh);
  save.relics = save.relics || [];
  if (!save.relics.includes(it.id)) save.relics.push(it.id);
  music.stinger('hallazgo'); fx.sparkle(it.pos.clone().setY(it.pos.y + 1), 26, 0xffd27a);
  player.gesture('Cheer', { speed: 1.2, fadeOut: 0.3 });
  const n = save.relics.length, before = player.maxHp;
  applyAbilities(); if (player.maxHp > before) player.hp = player.maxHp;
  toast(n === RELIC_TOTAL ? '¡Encontraste todas las Reliquias de Aethra!' : `Reliquia de Aethra (${n}/${RELIC_TOTAL})${player.maxHp > before ? ' · ¡un corazón más!' : ''}`);
  writeSave(save);
}

function collectFragment(it) {
  world.interactables.splice(world.interactables.indexOf(it), 1);
  world.root.remove(it.mesh);
  fx.sparkle(it.pos.clone().setY(it.pos.y + 0.8));
  save.fragments.push(it.id);
  audio.play('fragment');
  updateHUD();
  const total = zone.fragments.length, got = zone.fragments.filter(f => save.fragments.includes(f.id)).length;
  toast(got === total ? '¡Encontraste todos los fragmentos de esta zona!' : `Fragmento encontrado (${got}/${total})`);
  writeSave(save);
}

function lightLantern(it) {
  for (const o of world.interactables) if (o.type === 'lantern' && o !== it && !(save.flags.lit || []).includes(o.id)) o.light(false);
  save.flags.lit = [...new Set([...(save.flags.lit || []), it.id])];
  save.checkpoint = it.id;
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
  if (pendingFinale) { const k = pendingFinale; pendingFinale = null; startFinale(k); }
}
$('dialog').addEventListener('touchstart', () => input._pressed.add('click'), { passive: true });
$('dialog').addEventListener('click', () => input._pressed.add('click'));

// ---------- objetivo y brújula ----------
function updateGoal(dt) {
  if (!zone.story) { $('objective').classList.add('hidden'); marker.visible = false; return; }
  const g = zone.story.goal(S);
  $('objective').classList.toggle('hidden', state === 'title');
  if (g.text !== lastGoal) {
    if (lastGoal) { const o = $('objective'); o.classList.remove('flash'); void o.offsetWidth; o.classList.add('flash'); audio.play('open'); }
    lastGoal = g.text; $('objText').textContent = g.text;
  }
  if (g.at) {
    const d = Math.hypot(player.pos.x - g.at[0], player.pos.z - g.at[2]);
    $('objDist').textContent = d > 3 ? `${Math.round(d)} m` : '';
    marker.visible = d > 3 && state === 'play';
    marker.position.set(g.at[0], g.at[1], g.at[2]);
    arrow.position.y = 2.7 + Math.sin(time * 3) * 0.18; arrow.rotation.y = time * 2;
  } else { $('objDist').textContent = ''; marker.visible = false; }

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
    let all = 0; for (const z of Object.values(ZONES)) all += z.fragments.length;
    const other = c.kind === 'a' ? 'b' : 'a';
    showEndCard({
      kicker: 'Final', title: F.title,
      stats: `Tiempo de juego: ${fmtTime(save.playTime)}<br>Fragmentos encontrados: ${save.fragments.length}/${all}<br>Finales vistos: ${['a', 'b'].filter(x => save.flags['final_' + x]).length}/2`,
      sub: (save.flags['final_' + other] ? 'Viste los dos finales. ' : 'Hay otro final: vuelve al altar y elige el otro camino. ') + 'Gracias por jugar Ecos de Aethra.',
    });
    $('fade').style.opacity = 0;
  }
}
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
    const k = Math.max(0, c.t - 1.6);
    ship.offset.set(Math.sin(k * 0.4) * 1.5, Math.min(9, k * k * 0.45), k * k * 0.55);
    ship.spin = 3 + Math.min(25, k * 8);
    player.anim.update(dt, { vel: new THREE.Vector3(), grounded: true, facing: Math.PI, input: { x: 0, z: 0 }, lookAt: null });
    const sp = ship.group.position;
    camera.position.set(7 - k * 0.3, 3.2 + k * 0.25, 26 + k * 0.4);
    camera.lookAt(sp.x, sp.y + 2.5, sp.z);
  }
  if (c.t > 7.6 && !c.faded) { c.faded = true; $('fade').style.opacity = 1; }
  if (c.t > 8.4) {
    cutscene = null; state = 'end';
    const total = zone.fragments.length;
    showEndCard({
      kicker: 'Fin del prólogo', title: 'Rumbo al Bosque Colgante', sub: '',
      stats: `Tiempo de juego: ${fmtTime(save.playTime)}<br>Fragmentos de Puerto Bruma: ${S.frags()}/${total}<br>Kael: ${S.has('kael_visto') ? 'lo conociste en los islotes' : 'no lo encontraste'}`,
      next: { label: 'Continuar: Capítulo 1', zone: 'bosque_colgante', cp: 'llegada' },
    });
    $('fade').style.opacity = 0;
  }
}
function showEndCard({ kicker, title, stats, sub, next }) {
  $('endKicker').textContent = kicker; $('endTitle').textContent = title; $('endStats').innerHTML = stats; $('endSub').textContent = sub || '';
  endNext = next || null; $('bKeepExploring').classList.remove('hidden');
  $('bNextChapter').classList.toggle('hidden', !next);
  if (next) $('bNextChapter').textContent = next.label;
  $('endcard').classList.remove('hidden');
}
function showChapterEnd() {
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
  if (ship && player.mesh.parent === ship.group) { scene.add(player.mesh); ship.offset.set(0, 0, 0); ship.spin = 3; }
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
function handlePlayerEvents() {
  for (const ev of player.events) {
    if (ev.type === 'hurt') { combat.shake(0.25, 0.25); input.rumble(220, 0.7); $('hudHearts').classList.remove('hit'); void $('hudHearts').offsetWidth; $('hudHearts').classList.add('hit'); }
    if (ev.type === 'dead') startDeath();
    if (ev.type === 'pulse') doPulse(ev.pos, ev.radius);
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
  if (deadT > 1.7) {
    combat.spawnZone(zone, save); bossActive = false; $('bossbar').classList.add('hidden');
    player.hp = player.maxHp; player.invuln = 1.5;
    respawn(save.checkpoint);
    $('fade').style.opacity = 0; state = 'play';
    toast('Lía se levanta junto al farol');
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
    startDialog(zone.story.bossIntro, '', null, () => { combat.boss.wake(); });
  }
}
combat.onBossDefeated = () => {
  music.stinger('victoria');
  bossActive = false;
  setTimeout(() => { startDialog(zone.story.bossDefeated, '', null, () => { zone.story.onBossDefeated && zone.story.onBossDefeated(S); player.gesture('Cheer', { speed: 1.2 }); }); }, 300);
};
combat.onBossClang = () => { if (!hintClang) { hintClang = true; toast({ bosque_colgante: 'El tronco es demasiado duro. ¡Golpea los nudos brillantes de las raíces!', ruinas_vidrio: 'Su caparazón es irrompible. Haz que choque contra un pilar.', ciudad_engranajes: 'El latón es demasiado duro. Espera a que se atasque tras el puñetazo.', glaciar_eco: 'Está demasiado alto. Devuélvele un orbe de hielo con el escudo (mantén V).', ciudadela_orden: 'La barrera de sombra lo protege. Rómpela con el pulso de luz (Z) o devolviéndole un orbe con el escudo.' }[zone.id] || 'Demasiado duro'); } };
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
function updateHUD() {
  const total = zone.fragments.length, got = zone.fragments.filter(f => save.fragments.includes(f.id)).length;
  $('hudFrag').textContent = `◆ ${got}/${total}`;
}
let toastT = 0;
function toast(msg) { $('toast').textContent = msg; $('toast').style.opacity = 1; toastT = 2.4; }
let bannerT = 0;
function banner(a, b) { $('zbT1').textContent = a; $('zbT2').textContent = b; $('zoneBanner').style.opacity = 1; bannerT = 2.8; }

function showOverlay(id) {
  for (const o of ['title', 'pause']) $(o).classList.toggle('hidden', o !== id);
  $('hud').classList.toggle('hidden', id === 'title');
}
function showPausePanel(p) {
  $('pauseMain').classList.toggle('hidden', p !== 'main');
  $('settingsPanel').classList.toggle('hidden', p !== 'settings');
  $('savePanel').classList.toggle('hidden', p !== 'save');
}

function refreshTitle() {
  const existing = loadSave();
  $('bContinue').classList.toggle('hidden', !existing);
  $('bChapters').classList.toggle('hidden', !existing);
  $('bNew').textContent = 'Nueva partida';
  $('bNew').dataset.confirm = '';
}
refreshTitle();

// En el teléfono: pantalla completa y horizontal al empezar a jugar
function goFull() {
  if (!input.isTouch) return;
  try { const r = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); if (r && r.then) r.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {}); } catch (e) {}
}
function startGame(s) {
  audio.unlock(); music.init(); goFull();
  save = s;
  writeSave(save);
  showOverlay(null);
  enterZone(save.zone, save.checkpoint);
}
$('bContinue').onclick = () => startGame(loadSave() || newSave());
// ---------- modo automático: Lía supera los retos sola ----------
// Camina hacia el objetivo; si hay un hueco, una subida o se atasca, vuela con el planeador hasta él.
// Al llegar habla, recoge, enciende cristales, rompe cerraduras o barreras, y en los jefes los derrota poco a poco.
const auto = { fly: null, stuckT: 0, last: new THREE.Vector3(), nearT: 0, goalKey: '', bossT: 0, atkT: 0, readT: 0, endT: 0 };
function nearestFragment() {
  let best = null, bd = Infinity;
  for (const it of world.interactables) if (it.type === 'fragment') { const d = it.pos.distanceTo(player.pos); if (d < bd) { bd = d; best = it; } }
  if (!best) return null; const v = best.pos.clone(); v.precise = true; return v;
}
function autoTarget() {
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
  // caminar hacia el objetivo con la cámara detrás
  const want = Math.atan2(-dx, -dz);
  cam.yaw += angleDiff(want, cam.yaw) * Math.min(1, dt * 4);
  const rel = angleDiff(want, cam.yaw);
  input.move.x = -Math.sin(rel); input.move.y = Math.cos(rel);
  // ¿atascada, subida alta o suelo que se acaba delante?
  auto.stuckT = player.pos.distanceTo(auto.last) < dt * 1.2 ? auto.stuckT + dt : Math.max(0, auto.stuckT - dt);
  auto.last.copy(player.pos);
  const ax = player.pos.x - Math.sin(want) * 1.2, az = player.pos.z - Math.cos(want) * 1.2;
  const ground = physics.raycast(ax, player.pos.y + 0.5, az, 0, -1, 0, 3);
  const noGround = player.grounded && ground > 2.5 && dh > 2;
  if (player.grounded && (auto.stuckT > 0.7 || up > 1.3 || noGround)) startAutoFly(T, want);
}
function startAutoFly(T, want) {
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
  auto.fly = { from, to, apex, t: 0, dur: Math.max(0.9, d / 9) };
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
let navI = 0, navSig = '';
function menuNav() {
  if (!input.usingGamepad) { document.querySelectorAll('.padFocus').forEach(e => e.classList.remove('padFocus')); return; }
  if (state === 'play' || state === 'dialog' || state === 'dead' || state === 'cutscene') return;
  const ov = [...document.querySelectorAll('.overlay:not(.hidden)')].pop(); if (!ov) return;
  const items = [...ov.querySelectorAll('button, select')].filter(el => !el.disabled && el.offsetParent !== null);
  if (!items.length) return;
  const sig = items.map(e => e.id || e.textContent).join('|');
  if (sig !== navSig) { navSig = sig; navI = 0; }
  if (input.pressed('choiceUp')) navI = (navI + items.length - 1) % items.length;
  if (input.pressed('choiceDown')) navI = (navI + 1) % items.length;
  navI = Math.min(navI, items.length - 1);
  const el = items[navI];
  document.querySelectorAll('.padFocus').forEach(e => e !== el && e.classList.remove('padFocus'));
  el.classList.add('padFocus'); el.scrollIntoView && el.scrollIntoView({ block: 'nearest' });
  if (el.tagName === 'SELECT' && (input.pressed('navLeft') || input.pressed('navRight'))) {
    el.selectedIndex = Math.max(0, Math.min(el.options.length - 1, el.selectedIndex + (input.pressed('navRight') ? 1 : -1)));
    el.dispatchEvent(new Event('change'));
  }
  if (input.pressed('jump') && el.tagName === 'BUTTON') { audio.play('open'); el.click(); navSig = ''; }
  if (input.pressed('dodge')) { const back = items.find(b => /Volver|Listo|Continuar/.test(b.textContent) && b.tagName === 'BUTTON'); if (back && state !== 'title') back.click(); else if (back && /Volver/.test(back.textContent)) back.click(); navSig = ''; }
}

// ---------- desafíos: Cristales del Cielo ----------
const CH_KEY = 'aethra_desafios_v1';
const loadCh = () => { try { return JSON.parse(localStorage.getItem(CH_KEY)) || {}; } catch (e) { return {}; } };
const fmtT = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
const MEDAL = { oro: '🥇 Oro', plata: '🥈 Plata', bronce: '🥉 Bronce' };
function startChallenge(i) {
  const L = DESAFIOS[i];
  challenge = { i, L, t: 0, done: false };
  save = newSave(); save.zone = L.id;
  Object.assign(save.flags, { baston: true, impulso: true, brujula: true }, L.abilities);
  audio.unlock(); music.init(); goFull();
  showOverlay(null); titlePanel(null);
  loadZone(L.id);
  state = 'play'; lastGoal = '';
  $('chTimer').classList.remove('hidden');
}
function endChallenge() { if (!challenge) return; challenge = null; $('chTimer').classList.add('hidden'); save = loadSave() || newSave(); }
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
  if (best) { rec[C.L.id] = { t: C.t }; try { localStorage.setItem(CH_KEY, JSON.stringify(rec)); } catch (e) {} }
  else if (isAuto && !prev) { rec[C.L.id] = { t: null }; try { localStorage.setItem(CH_KEY, JSON.stringify(rec)); } catch (e) {} } // desbloquea el siguiente, sin tiempo
  const m = isAuto ? null : medalFor(C.L, C.t), next = DESAFIOS[C.i + 1];
  state = 'end'; document.body.classList.add('cine'); player.frozen = true;
  music.stinger('victoria'); fx.sparkle(player.pos.clone().setY(player.pos.y + 1.2), 30, 0xc8b8ff);
  const [o, p, b] = C.L.medals;
  showEndCard({
    kicker: `Desafío ${C.i + 1} superado`, title: C.L.title,
    stats: `Tiempo: <b>${fmtT(C.t)}</b>${isAuto ? ' · modo automático (no cuenta como récord)' : best ? ' · ¡nuevo récord!' : prev && prev.t != null ? ` · récord: ${fmtT(prev.t)}` : ''}<br>${m ? MEDAL[m] : 'Sin medalla'} · oro ${o} s · plata ${p} s · bronce ${b} s`,
    sub: next ? '' : 'Superaste todos los desafíos. ¿Puedes conseguir el oro en todos?',
    next: { label: next ? `Siguiente: ${next.title}` : 'Repetir este desafío', fn: () => startChallenge(next ? C.i + 1 : C.i) },
  });
  $('bKeepExploring').classList.add('hidden');
}
$('bChallenges').onclick = () => {
  const rec = loadCh(), list = $('challengeList'); list.innerHTML = '';
  DESAFIOS.forEach((L, i) => {
    const r = rec[L.id], open = i === 0 || rec[DESAFIOS[i - 1].id], m = r && r.t != null && medalFor(L, r.t);
    const b = document.createElement('button');
    b.innerHTML = `<span>${i + 1}. ${L.title}${L.abilities.garfio ? ' · garfio' : L.abilities.planeador ? ' · planeador' : ''}</span><span>${!open ? '🔒' : r && r.t != null ? `${m ? MEDAL[m].split(' ')[0] + ' ' : ''}${fmtT(r.t)}` : r ? '✓' : '—'}</span>`;
    b.disabled = !open; b.onclick = () => startChallenge(i);
    list.appendChild(b);
  });
  titlePanel('challengesPanel');
};
$('bChallengesBack').onclick = () => titlePanel(null);
$('bRestartCh').onclick = () => { if (challenge) { const i = challenge.i; resume(); startChallenge(i); } };

// ---------- capítulos y créditos ----------
const CHAPTERS = [['puerto_bruma', 'Prólogo'], ['bosque_colgante', 'Capítulo 1'], ['ruinas_vidrio', 'Capítulo 2'], ['ciudad_engranajes', 'Capítulo 3'], ['glaciar_eco', 'Capítulo 4'], ['ciudadela_orden', 'Capítulo 5']];
function titlePanel(id) {
  for (const p of ['chaptersPanel', 'creditsPanel', 'challengesPanel']) $(p).classList.toggle('hidden', p !== id);
  document.querySelector('#title .menu').classList.toggle('hidden', !!id);
  document.querySelector('#title .keys').classList.toggle('hidden', !!id);
}
$('bChapters').onclick = () => {
  const sv = loadSave(), list = $('chapterList'); list.innerHTML = '';
  for (const [id, label] of CHAPTERS) {
    const Z = ZONES[id], reached = sv && (sv.zone === id || sv.flags[id === 'puerto_bruma' ? 'intro' : 'intro_' + id]);
    const got = sv ? Z.fragments.filter(f => sv.fragments.includes(f.id)).length : 0;
    const b = document.createElement('button');
    b.innerHTML = `<span>${label} · ${Z.title}</span><span>${reached ? `◆ ${got}/${Z.fragments.length} · ${(sv.relics || []).includes('reliquia_' + id) ? '✦ reliquia' : '✧ reliquia'}` : '🔒'}</span>`;
    b.disabled = !reached;
    b.onclick = () => { titlePanel(null); audio.unlock(); music.init(); save = sv; showOverlay(null); enterZone(id); };
    list.appendChild(b);
  }
  titlePanel('chaptersPanel');
};
$('bChaptersBack').onclick = () => titlePanel(null);
$('bCredits').onclick = () => titlePanel('creditsPanel');
$('bCreditsBack').onclick = () => titlePanel(null);
$('bNew').onclick = () => {
  if (loadSave() && !$('bNew').dataset.confirm) { $('bNew').dataset.confirm = '1'; $('bNew').textContent = '¿Borrar la partida actual? Pulsa otra vez'; return; }
  startGame(newSave());
};

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
$('bSettingsBack').onclick = () => showPausePanel('main');
$('bSaveMenu').onclick = () => { $('exportCode').value = exportCode(save); $('importCode').value = ''; $('saveMsg').textContent = ''; showPausePanel('save'); };
$('bSaveBack').onclick = () => showPausePanel('main');
$('bTitle').onclick = () => { writeSave(save); if (dialog) closeDialog(false); endChallenge(); state = 'title'; music.play('title'); music.ambient(null); $('objective').classList.add('hidden'); $('compass').classList.add('hidden'); marker.visible = false; showOverlay('title'); refreshTitle(); };
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
  const dk = DIFF[settings.difficulty] ? settings.difficulty : 'normal'; player.diff = DIFF[dk]; combat.difficulty = dk; $('sDiff').value = dk; $('tDiff').value = dk;
  $('sSens').value = settings.sens; $('sInv').checked = settings.invert; $('sVol').value = settings.volume; $('sMus').value = settings.music ?? 0.6; $('sDbg').checked = settings.debug;
  $('debug').classList.toggle('hidden', !settings.debug);
}
$('sSens').oninput = e => { settings.sens = +e.target.value; writeSettings(settings); applySettings(); };
$('sInv').onchange = e => { settings.invert = e.target.checked; writeSettings(settings); applySettings(); };
$('sVol').oninput = e => { settings.volume = +e.target.value; writeSettings(settings); applySettings(); };
const setDiff = e => { settings.difficulty = e.target.value; writeSettings(settings); applySettings(); };
$('sDiff').onchange = setDiff; $('tDiff').onchange = setDiff;
$('sMus').oninput = e => { settings.music = +e.target.value; writeSettings(settings); applySettings(); };
$('sDbg').onchange = e => { settings.debug = e.target.checked; writeSettings(settings); applySettings(); };

// ---------- bucle ----------
const clock = new THREE.Clock();
let fpsAcc = 0, fpsN = 0, fps = 0;

let frameErrors = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 1 / 30);
  if (glLost) return;
  if (paused4test) { renderer.render(scene, camera); return; }
  try {
    simulate(dt);
    renderer.render(scene, camera);
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
  if (player.diff && player.diff.auto) autoPilot(dt);
  updateMusic();
  if (challenge && state === 'play') updateChallenge(dt);
  if (input.pressed('pause') && (state === 'play' || state === 'dialog' || state === 'pause')) pause();

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
    if (auto.fly) autoFly(dt); else player.update(dt, input, cam.yaw, state === 'play' ? combat.targets : []);
    combat.handlePlayer(player);
    if (state === 'play') combat.update(dt, player);
    handlePlayerEvents();
    checkRegions();
    updateGrapple();
    if (state === 'dialog') updateDialog(dt); else updateInteractions();
    cam.update(dt, state === 'dialog' ? { look: { x: 0, y: 0 }, zoom: 0, move: { x: 0, y: 0 } } : input, player);
    world.updateFade(camera.position, cam.target, dt);
    const floor = world.water ? world.water.y + 0.3 : -20;
    if (player.pos.y < floor && player.hp > 0) {
      audio.play('splash');
      if (player.diff && !player.diff.fallHurts) { toast(zone.id === 'puerto_bruma' ? 'Caíste al mar de nubes' : 'Caíste al vacío'); respawn(save.checkpoint); return; }
      player.hp -= 1; $('hudHearts').classList.remove('hit'); void $('hudHearts').offsetWidth; $('hudHearts').classList.add('hit');
      if (player.hp <= 0) startDeath();
      else { toast(zone.id === 'puerto_bruma' ? 'Caíste al mar de nubes' : 'Caíste al vacío'); respawn(save.checkpoint); }
    }
    if (combat.shakeAmt > 0) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * combat.shakeAmt, (Math.random() - 0.5) * combat.shakeAmt, (Math.random() - 0.5) * combat.shakeAmt));
  }
  if (state === 'play' || state === 'dialog') updateGoal(dt);
  if (state === 'cutscene') updateCutscene(dt);
  if (state === 'dead') updateDeath(dt);
  if (state !== 'title') updateCombatHUD();
  if (state === 'title' && zone === null && charsReady) titleScene();
  if (state === 'title' && zone) { // cámara giratoria detrás del menú
    camera.position.set(Math.sin(time * 0.08) * 34, 16, Math.cos(time * 0.08) * 34);
    camera.lookAt(0, 2, 0);
  }

  world.update(time, dt);
  fx.update(dt);
  for (const p of pulseFx) { p.t += dt; const k = p.t / 0.45; p.m.scale.setScalar(0.5 + k * p.r); p.m.material.opacity = 0.5 * (1 - k); if (k >= 1) { scene.remove(p.m); p.done = true; } }
  for (let i = pulseFx.length - 1; i >= 0; i--) if (pulseFx[i].done) pulseFx.splice(i, 1);
  const wantFov = 60 + player.anim.runW * 5 * (state === 'play' ? 1 : 0);
  if (Math.abs(camera.fov - wantFov) > 0.01) { camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix(); }
  sun.position.set(player.pos.x + 18, player.pos.y + 30, player.pos.z + 10);
  sun.target.position.copy(player.pos);
  sky.position.copy(camera.position);

  if (toastT > 0 && (toastT -= dt) <= 0) $('toast').style.opacity = 0;
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

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

frame();

// gancho para pruebas automáticas
// step(n): avanza n pasos de 1/60 s sin depender de la velocidad de dibujo (para pruebas en máquinas lentas)
window.__aethra = {
  music, renderer, auto, autoTarget: () => autoTarget(), get focus() { return focus; },
  player, cam, world, input, get state() { return state; }, get save() { return save; }, startGame, newSave, loadZone,
  hold(on) { paused4test = on; }, S, combat, enterZone, choose, get zone() { return zone; }, get dialog() { return dialog; },
  step(n, press) {
    for (let i = 0; i < n; i++) { if (press && i === 0) input._pressed.add(press); simulate(1 / 60); input.endFrame(); }
  },
};
