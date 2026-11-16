import * as THREE from 'three';
import { Input } from './input.js';
import { Physics } from './physics.js';
import { Player } from './player.js';
import { FollowCamera } from './camera.js';
import { World } from './world.js';
import { Audio } from './audio.js';
import { FX } from './fx.js';
import { loadCharacterLibrary } from './characters.js';
import { newSave, loadSave, writeSave, loadSettings, writeSettings, exportCode, importCode } from './save.js';
import puertoBruma from './zones/puerto_bruma.js';
import bosqueColgante from './zones/bosque_colgante.js';
import ruinasVidrio from './zones/ruinas_vidrio.js';
import ciudadEngranajes from './zones/ciudad_engranajes.js';
import { Combat } from './combat.js';

const ZONES = { puerto_bruma: puertoBruma, bosque_colgante: bosqueColgante, ruinas_vidrio: ruinasVidrio, ciudad_engranajes: ciudadEngranajes };
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
const fx = new FX(scene);
const player = new Player(scene, physics, audio, fx);
const cam = new FollowCamera(camera, physics);
const combat = new Combat(scene, physics, fx, audio);
combat.world = world;
let hookTarget = null;
let bossActive = false, deadT = 0, hintClang = false, hintStun = false, lastHp = -1, endNext = null;

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
loadCharacterLibrary(p => { $('loading').textContent = `Cargando personajes… ${Math.round(p * 100)}%`; })
  .then(lib => { player.useModel(lib); world.chars = lib; })
  .catch(e => { console.warn('No se pudieron cargar los personajes animados; se usan los de formas simples.', e); })
  .finally(() => { charsReady = true; $('loading').classList.add('hidden'); $('bContinue').disabled = $('bNew').disabled = false; });

// ---------- zonas ----------
function loadZone(id, checkpointId) {
  zone = ZONES[id];
  skyMat.uniforms.top.value.setHex(zone.sky.top);
  skyMat.uniforms.bottom.value.setHex(zone.sky.bottom);
  scene.fog = new THREE.Fog(zone.sky.fog, zone.sky.fogNear, zone.sky.fogFar);
  const li = zone.light || {};
  hemi.color.setHex(li.hemiSky || 0xdff1ff); hemi.groundColor.setHex(li.hemiGround || 0x5c6a50); sun.color.setHex(li.sun || 0xfff1d6);
  world.build(zone, save);
  player.updrafts = world.updrafts;
  combat.spawnZone(zone, save);
  bossActive = false; hintClang = false; hintStun = false; $('bossbar').classList.add('hidden');
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
  $('tHook').classList.toggle('hidden', !(player.canGrapple && input.isTouch));
  player.maxHp = 4 + Math.floor(save.fragments.length / 5);
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
  if (input.pressed('interact') || input.pressed('jump') || input.pressed('click')) {
    if (d.shown < d.full.length) { d.shown = d.full.length; $('dText').textContent = d.full; return; }
    d.i++;
    if (d.i >= d.lines.length) { closeDialog(true); return; }
    showLine();
  }
  if (dialog) $('dNext').textContent = `${d.i + 1}/${d.lines.length} · ${input.isTouch ? 'toca' : input.usingGamepad ? 'A' : 'E / clic'} para continuar`;
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
function updateCutscene(dt) {
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
  endNext = next || null;
  $('bNextChapter').classList.toggle('hidden', !next);
  if (next) $('bNextChapter').textContent = next.label;
  $('endcard').classList.remove('hidden');
}
function showChapterEnd() {
  state = 'end'; document.body.classList.add('cine');
  const total = zone.fragments.length, ce = zone.chapterEnd || {};
  const big = ['gran_fragmento_1', 'gran_fragmento_2', 'gran_fragmento_3', 'gran_fragmento_4', 'gran_fragmento_5'].filter(f => save.flags[f]).length;
  showEndCard({
    kicker: ce.kicker || 'Fin del capítulo', title: ce.title || zone.title,
    stats: `Tiempo de juego: ${fmtTime(save.playTime)}<br>Fragmentos de ${zone.title.replace(/^(El|La|Las|Los) /, '')}: ${S.frags()}/${total}<br>Grandes fragmentos: ${big}/5 · Corazones: ${player.maxHp}`,
    sub: ce.sub || '', next: ce.next,
  });
}
function leaveEnding(toTitle) {
  const ship = world.airships.dirigible;
  if (ship && player.mesh.parent === ship.group) { scene.add(player.mesh); ship.offset.set(0, 0, 0); ship.spin = 3; }
  document.body.classList.remove('cine');
  $('endcard').classList.add('hidden');
  if (toTitle) { writeSave(save); state = 'title'; showOverlay('title'); refreshTitle(); return; }
  if (zone.id === 'puerto_bruma') { player.teleport(0, 0.05, 31.5, 0); cam.snap(player); }
  state = 'play';
}
$('bNextChapter').onclick = () => { const n = endNext; leaveEnding(false); if (n) enterZone(n.zone, n.cp); };
const fmtTime = t => `${Math.floor(t / 60)} min ${String(Math.floor(t % 60)).padStart(2, '0')} s`;
$('bKeepExploring').onclick = () => leaveEnding(false);
$('bEndTitle').onclick = () => leaveEnding(true);

// ---------- combate: vida, muerte, jefe ----------
function handlePlayerEvents() {
  for (const ev of player.events) {
    if (ev.type === 'hurt') { combat.shake(0.25, 0.25); $('hudHearts').classList.remove('hit'); void $('hudHearts').offsetWidth; $('hudHearts').classList.add('hit'); }
    if (ev.type === 'dead') startDeath();
  }
  player.events = player.events.filter(e => e.type === 'hitcheck' || e.type === 'swing');
}
function startDeath() {
  if (state === 'dead') return;
  state = 'dead'; deadT = 0;
  player.gesture('Death_A', { speed: 1.2, fadeIn: 0.05, fadeOut: 0.01 });
  audio.play('hurt');
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
  bossActive = false;
  setTimeout(() => { startDialog(zone.story.bossDefeated, '', null, () => { zone.story.onBossDefeated && zone.story.onBossDefeated(S); player.gesture('Cheer', { speed: 1.2 }); }); }, 300);
};
combat.onBossClang = () => { if (!hintClang) { hintClang = true; toast({ bosque_colgante: 'El tronco es demasiado duro. ¡Golpea los nudos brillantes de las raíces!', ruinas_vidrio: 'Su caparazón es irrompible. Haz que choque contra un pilar.', ciudad_engranajes: 'El latón es demasiado duro. Espera a que se atasque tras el puñetazo.' }[zone.id] || 'Demasiado duro'); } };
combat.onBossPhase = b => toast(`¡${(b && b.name) || 'El guardián'} está furioso!`);
combat.onBossStun = () => { if (!hintStun) { hintStun = true; toast(zone.id === 'ruinas_vidrio' ? '¡Está aturdido! Golpea el cristal de su cola' : '¡Se quedó atascado! Lanza el garfio al anillo de su pecho'); } };
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
  $('bNew').textContent = 'Nueva partida';
  $('bNew').dataset.confirm = '';
}
refreshTitle();

function startGame(s) {
  audio.unlock();
  save = s;
  writeSave(save);
  showOverlay(null);
  enterZone(save.zone, save.checkpoint);
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
$('bTitle').onclick = () => { writeSave(save); if (dialog) closeDialog(false); state = 'title'; $('objective').classList.add('hidden'); $('compass').classList.add('hidden'); marker.visible = false; showOverlay('title'); refreshTitle(); };
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
    player.update(dt, input, cam.yaw, state === 'play' ? combat.targets : []);
    combat.handlePlayer(player);
    if (state === 'play') combat.update(dt, player);
    handlePlayerEvents();
    checkRegions();
    updateGrapple();
    if (state === 'dialog') updateDialog(dt); else updateInteractions();
    cam.update(dt, state === 'dialog' ? { look: { x: 0, y: 0 }, zoom: 0, move: { x: 0, y: 0 } } : input, player);
    const floor = world.water ? world.water.y + 0.3 : -20;
    if (player.pos.y < floor && player.hp > 0) {
      audio.play('splash');
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
  hold(on) { paused4test = on; }, S, combat, enterZone, get zone() { return zone; }, get dialog() { return dialog; },
  step(n, press) {
    for (let i = 0; i < n; i++) { if (press && i === 0) input._pressed.add(press); simulate(1 / 60); input.endFrame(); }
  },
};
