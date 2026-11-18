import * as THREE from 'three';
import { createCharacter } from './characters.js';

// Créditos finales: los personajes bailan sobre una pista de baile de colores mientras sube el texto.
// Cada uno cambia de paso cada compás; los pasos mezclan las animaciones del juego con movimientos a mano
// (saltitos, giros, el «moonwalk», sentarse y saltar, contoneo de caderas) para que resulte gracioso.

const BPM = 124, BEAT = 60 / BPM, BAR = BEAT * 4;
const MOVES = ['cheer', 'spin', 'moonwalk', 'disco', 'sitpop', 'shuffle', 'guitar', 'hop'];

export function runCredits({ canvas, roll, lib, looks, duration = 62, onDone }) {
  const W = () => canvas.clientWidth || innerWidth, H = () => canvas.clientHeight || innerHeight;
  const r = new THREE.WebGLRenderer({ canvas, antialias: true });
  r.setPixelRatio(Math.min(devicePixelRatio, 1.5)); r.setSize(W(), H(), false); r.outputColorSpace = THREE.SRGBColorSpace;
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0x0a0618); sc.fog = new THREE.Fog(0x0a0618, 14, 34);
  sc.add(new THREE.HemisphereLight(0xb8a8ff, 0x201040, 1.1));
  const key = new THREE.DirectionalLight(0xfff0e0, 1.6); key.position.set(3, 6, 6); sc.add(key);
  const cam = new THREE.PerspectiveCamera(42, W() / H(), 0.1, 80);

  // pista de baile: baldosas que cambian de color con el ritmo
  const tiles = [], TS = 1.15;
  for (let i = -6; i <= 6; i++) for (let j = -3; j <= 2; j++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(TS * 0.94, 0.12, TS * 0.94), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x000000, roughness: 0.4 }));
    m.position.set(i * TS, -0.06, j * TS); sc.add(m); tiles.push({ m, i, j });
  }
  // focos de colores que barren la pista
  const beams = [];
  for (let k = 0; k < 5; k++) {
    const c = new THREE.Color().setHSL(k / 5, 1, 0.6);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.6, 9, 24, 1, true), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    cone.geometry.translate(0, -4.5, 0); cone.position.set(-6 + k * 3, 8, -4); sc.add(cone); beams.push(cone);
  }
  // bola de espejos
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 1), new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1, roughness: 0.15, flatShading: true, emissive: 0x332244 }));
  ball.position.set(0, 6.2, -1); sc.add(ball);
  // confeti
  const N = 420, cg = new THREE.BufferGeometry(), cp = new Float32Array(N * 3), cc = new Float32Array(N * 3), seeds = [];
  for (let i = 0; i < N; i++) { seeds.push([(Math.random() - 0.5) * 18, Math.random(), (Math.random() - 0.5) * 8 - 1, 0.5 + Math.random()]); const c = new THREE.Color().setHSL(Math.random(), 1, 0.6); cc.set([c.r, c.g, c.b], i * 3); }
  cg.setAttribute('position', new THREE.BufferAttribute(cp, 3)); cg.setAttribute('color', new THREE.BufferAttribute(cc, 3));
  sc.add(new THREE.Points(cg, new THREE.PointsMaterial({ size: 0.09, vertexColors: true })));

  // bailarines
  const n = looks.length, dancers = [];
  looks.forEach((look, k) => {
    let ch; try { ch = createCharacter(lib, look); } catch (e) { return; }
    const x = (k - (n - 1) / 2) * 1.9, z = -Math.abs(k - (n - 1) / 2) * 0.55 + 0.6;
    ch.root.position.set(x, 0, z); sc.add(ch.root);
    for (const a of Object.values(ch.actions)) { a.play(); a.timeScale = 0; a.setEffectiveWeight(0); }
    dancers.push({ ch, x, z, k, w: {}, move: MOVES[(k * 3) % MOVES.length] });
  });

  // texto que sube
  roll.style.transition = 'none'; roll.style.transform = 'translate(-50%, 0)'; roll.style.top = '100%';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const h = roll.scrollHeight + innerHeight;
    roll.style.transition = `transform ${duration}s linear`; roll.style.transform = `translate(-50%, ${-h}px)`;
  }));

  const clock = new THREE.Clock(); let t = 0, raf = 0, done = false;
  const setW = (D, name, w, time) => {
    const a = D.ch.actions[name]; if (!a) return;
    D.w[name] = w; a.setEffectiveWeight(w);
    if (time != null) a.time = ((time % a.getClip().duration) + a.getClip().duration) % a.getClip().duration;
  };
  function dance(D, dt) {
    const bar = Math.floor(t / BAR), lt = t - bar * BAR, beat = lt / BEAT, ph = (t / BEAT) * Math.PI;
    const move = MOVES[(bar + D.k * 3) % MOVES.length];
    for (const nm of Object.keys(D.w)) setW(D, nm, 0);
    const root = D.ch.root; let y = 0, rot = 0, dx = 0, dz = 0;
    const bounce = Math.abs(Math.sin(ph)) * 0.08;
    switch (move) {
      case 'cheer': setW(D, 'Cheer', 1, lt * 1.1); y = bounce; break;
      case 'spin': setW(D, 'Jump_Idle', 1, lt); y = Math.abs(Math.sin(ph)) * 0.35; rot = (lt / BAR) * Math.PI * 4; break;
      case 'moonwalk': { setW(D, 'Walking_A', 1, -lt * 1.3); const s = Math.sin(lt / BAR * Math.PI); dz = -s * 1.2; rot = 0; break; }
      case 'disco': setW(D, 'Spellcast_Raise', 1, 0.35 + Math.abs(Math.sin(ph * 0.5)) * 0.6); y = bounce; rot = Math.sin(ph * 0.5) * 0.6; break;
      case 'sitpop': if (beat < 2) { setW(D, 'Sit_Floor_Idle', 1, lt); } else { setW(D, 'Jump_Start', 1, (beat - 2) * 0.3); y = Math.sin((beat - 2) / 2 * Math.PI) * 0.9; } break;
      case 'shuffle': setW(D, 'Walking_B', 1, lt * 1.6); dx = Math.sin(ph * 0.5) * 0.7; rot = Math.sign(Math.cos(ph * 0.5)) * 1.2; break;
      case 'guitar': setW(D, '1H_Melee_Attack_Slice_Horizontal', 1, 0.2 + Math.abs(Math.sin(ph)) * 0.35); y = bounce; rot = 0.3; break;
      default: setW(D, 'Jump_Idle', 1, lt); y = Math.abs(Math.sin(ph)) * 0.55; dx = Math.sin(ph * 0.5) * 0.3;
    }
    root.position.set(D.x + dx, y, D.z + dz); root.rotation.y = Math.PI + rot + Math.sin(t * 0.7 + D.k) * 0.15; // de frente a la cámara
    D.ch.mixer.update(0);
    // contoneo de caderas y cabeceo, encima de la animación
    const b = D.ch.bones;
    if (b.hips) b.hips.rotateZ(Math.sin(ph) * 0.14);
    if (b.head) b.head.rotateX(Math.sin(ph * 2) * 0.12);
    if (b.chest) b.chest.rotateY(Math.sin(ph * 0.5) * 0.18);
  }
  function loop() {
    if (done) return; raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, clock.getDelta()); t += dt;
    if (canvas.width !== Math.floor(W() * r.getPixelRatio())) { r.setSize(W(), H(), false); cam.aspect = W() / H(); cam.updateProjectionMatrix(); }
    const beatN = Math.floor(t / BEAT), pulse = 1 - (t % BEAT) / BEAT;
    tiles.forEach(T => { const on = (T.i + T.j + beatN) % 3 === 0; T.m.material.emissive.setHSL(((T.i * 0.07 + T.j * 0.11 + beatN * 0.13) % 1 + 1) % 1, 1, on ? 0.35 + pulse * 0.2 : 0.06); });
    beams.forEach((B, k) => { B.rotation.z = Math.sin(t * 0.9 + k * 1.3) * 0.5; B.rotation.x = Math.cos(t * 0.7 + k) * 0.3; B.material.opacity = 0.1 + pulse * 0.1; });
    ball.rotation.y += dt * 0.8;
    for (let i = 0; i < N; i++) { const [x, o, z, s] = seeds[i]; const k = (o + t * 0.06 * s) % 1; cp[i * 3] = x + Math.sin(t * s + i) * 0.4; cp[i * 3 + 1] = 7 - k * 8; cp[i * 3 + 2] = z; }
    cg.attributes.position.needsUpdate = true;
    // cámara: se acerca y se mueve despacio de un lado a otro
    cam.position.set(Math.sin(t * 0.15) * 3, 2.1 + Math.sin(t * 0.2) * 0.3, 8.2 - Math.min(1.4, t * 0.05)); cam.lookAt(0, 1.0, 0);
    for (const D of dancers) dance(D, dt);
    r.render(sc, cam);
    if (t > duration + 1.5) stop();
  }
  function stop() {
    if (done) return; done = true; cancelAnimationFrame(raf);
    r.dispose(); sc.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    onDone && onDone();
  }
  loop();
  return { stop, get t() { return t; } };
}
