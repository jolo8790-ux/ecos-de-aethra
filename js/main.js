import * as THREE from 'three';
import { Input } from './input.js';
import { Physics } from './physics.js';
import { Player } from './player.js';
import { FollowCamera } from './camera.js';
import { World } from './world.js';
import { Audio } from './audio.js';
import { newSave, loadSave, writeSave, loadSettings, writeSettings, exportCode, importCode } from './save.js';
import puertoBruma from './zones/puerto_bruma.js';

const ZONES = { puerto_bruma: puertoBruma };
const $ = id => document.getElementById(id);

// ---------- motor ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 600);
const hemi = new THREE.HemisphereLight(0xdff1ff, 0x5c6a50, 0.9); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 1.6);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
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
const world = new World(scene, physics);
const player = new Player(scene, physics, audio);
const cam = new FollowCamera(camera, physics);

let settings = loadSettings();
let save = null;
let state = 'title';
let zone = null;
let time = 0;
let dialog = null;
let focus = null;
let talkCooldown = 0;

applySettings();

// ---------- zonas ----------
function loadZone(id, checkpointId) {
  zone = ZONES[id];
  skyMat.uniforms.top.value.setHex(zone.sky.top);
  skyMat.uniforms.bottom.value.setHex(zone.sky.bottom);
  scene.fog = new THREE.Fog(zone.sky.fog, zone.sky.fogNear, zone.sky.fogFar);
  world.build(zone, save);
  respawn(checkpointId);
  updateHUD();
  banner(zone.subtitle, zone.title);
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
    const dx = player.pos.x - it.pos.x, dz = player.pos.z - it.pos.z, dy = player.pos.y - it.pos.y;
    const d = Math.hypot(dx, dz);
    if (d > it.radius || Math.abs(dy) > 2.2) continue;
    if (it.type === 'fragment') { collectFragment(it); continue; }
    if (it.type === 'lantern') {
      if (save.checkpoint !== it.id) lightLantern(it);
      continue;
    }
    if (d < best) { best = d; focus = it; }
  }
  if (focus) {
    $('prompt').innerHTML = `<b>${input.usingGamepad ? 'X' : input.isTouch ? 'USAR' : 'E'}</b>${focus.verb}`;
    $('prompt').classList.remove('hidden');
    if (input.pressed('interact') && talkCooldown <= 0) openDialog(focus);
  } else $('prompt').classList.add('hidden');
}

function collectFragment(it) {
  world.interactables.splice(world.interactables.indexOf(it), 1);
  world.root.remove(it.mesh);
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
  for (const o of world.interactables) if (o.type === 'lantern' && save.flags.lit.includes(o.id)) o.light(true);
  audio.play('checkpoint');
  persist();
}

// ---------- diálogos ----------
function openDialog(it) {
  dialog = { it, i: 0, shown: 0, full: it.lines[0] };
  state = 'dialog';
  player.frozen = true;
  if (it.type === 'npc') it.mesh.rotation.y = Math.atan2(-(player.pos.x - it.pos.x), -(player.pos.z - it.pos.z));
  $('dWho').textContent = it.who;
  $('dText').textContent = '';
  $('dialog').classList.remove('hidden');
  $('prompt').classList.add('hidden');
  audio.play('open');
}
function updateDialog(dt) {
  const d = dialog;
  if (d.shown < d.full.length) {
    const before = Math.floor(d.shown);
    d.shown = Math.min(d.full.length, d.shown + dt * 55);
    if (Math.floor(d.shown) !== before && before % 3 === 0) audio.play('talk');
    $('dText').textContent = d.full.slice(0, Math.floor(d.shown));
  }
  if (input.pressed('interact') || input.pressed('jump') || input.pressed('click')) {
    if (d.shown < d.full.length) { d.shown = d.full.length; $('dText').textContent = d.full; return; }
    d.i++;
    if (d.i >= d.it.lines.length) { closeDialog(); return; }
    d.full = d.it.lines[d.i]; d.shown = 0;
  }
  $('dNext').textContent = `${d.i + 1}/${d.it.lines.length} · ${input.isTouch ? 'toca' : input.usingGamepad ? 'A' : 'E / clic'} para continuar`;
}
function closeDialog() {
  $('dialog').classList.add('hidden');
  dialog = null; state = 'play'; talkCooldown = 0.35;
  setTimeout(() => { player.frozen = false; }, 120);
  player.buffer = 0;
}
$('dialog').addEventListener('touchstart', () => input._pressed.add('click'), { passive: true });
$('dialog').addEventListener('click', () => input._pressed.add('click'));

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
  $('bNew').textContent = 'Nueva partida';
  $('bNew').dataset.confirm = '';
}
refreshTitle();

function startGame(s) {
  audio.unlock();
  save = s;
  writeSave(save);
  loadZone(save.zone, save.checkpoint);
  state = 'play';
  showOverlay(null);
}
$('bContinue').onclick = () => startGame(loadSave() || newSave());
$('bNew').onclick = () => {
  if (loadSave() && !$('bNew').dataset.confirm) { $('bNew').dataset.confirm = '1'; $('bNew').textContent = '¿Borrar la partida actual? Pulsa otra vez'; return; }
  startGame(newSave());
};

function pause() {
  if (state === 'play' || state === 'dialog') {
    state = 'pause'; showOverlay('pause'); showPausePanel('main');
    writeSave(save);
  } else if (state === 'pause') resume();
}
function resume() { state = dialog ? 'dialog' : 'play'; showOverlay(null); }
$('bResume').onclick = resume;
$('bSettings').onclick = () => showPausePanel('settings');
$('bSettingsBack').onclick = () => showPausePanel('main');
$('bSaveMenu').onclick = () => { $('exportCode').value = exportCode(save); $('importCode').value = ''; $('saveMsg').textContent = ''; showPausePanel('save'); };
$('bSaveBack').onclick = () => showPausePanel('main');
$('bTitle').onclick = () => { writeSave(save); if (dialog) closeDialog(); state = 'title'; showOverlay('title'); refreshTitle(); };
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
  cam.settings.sens = settings.sens; cam.settings.invert = settings.invert; audio.volume = settings.volume;
  $('sSens').value = settings.sens; $('sInv').checked = settings.invert; $('sVol').value = settings.volume; $('sDbg').checked = settings.debug;
  $('debug').classList.toggle('hidden', !settings.debug);
}
$('sSens').oninput = e => { settings.sens = +e.target.value; writeSettings(settings); applySettings(); };
$('sInv').onchange = e => { settings.invert = e.target.checked; writeSettings(settings); applySettings(); };
$('sVol').oninput = e => { settings.volume = +e.target.value; writeSettings(settings); applySettings(); };
$('sDbg').onchange = e => { settings.debug = e.target.checked; writeSettings(settings); applySettings(); };

// ---------- bucle ----------
const clock = new THREE.Clock();
let fpsAcc = 0, fpsN = 0, fps = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 1 / 30);
  if (paused4test) { renderer.render(scene, camera); return; }
  simulate(dt);
  renderer.render(scene, camera);
  input.endFrame();
}
let paused4test = false;

function simulate(dt) {
  time += dt;
  input.poll();
  if (input.pressed('pause') && state !== 'title') pause();

  if (state === 'play' || state === 'dialog') {
    save.playTime += dt; talkCooldown -= dt;
    player.update(dt, input, cam.yaw);
    if (state === 'dialog') updateDialog(dt); else updateInteractions();
    cam.update(dt, state === 'dialog' ? { look: { x: 0, y: 0 }, zoom: 0, move: { x: 0, y: 0 } } : input, player);
    const floor = world.water ? world.water.y + 0.3 : -20;
    if (player.pos.y < floor) {
      audio.play('splash'); toast('Caíste al mar de nubes');
      respawn(save.checkpoint);
    }
  }
  if (state === 'title' && zone === null) titleScene();
  if (state === 'title' && zone) { // cámara giratoria detrás del menú
    camera.position.set(Math.sin(time * 0.08) * 34, 16, Math.cos(time * 0.08) * 34);
    camera.lookAt(0, 2, 0);
  }

  world.update(time, dt);
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
  world.build(zone, save);
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
  player, cam, world, input, get state() { return state; }, get save() { return save; }, startGame, newSave, loadZone,
  hold(on) { paused4test = on; },
  step(n, press) {
    for (let i = 0; i < n; i++) { if (press && i === 0) input._pressed.add(press); simulate(1 / 60); input.endFrame(); }
  },
};
