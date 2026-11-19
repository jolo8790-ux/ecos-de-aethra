// Presentación antes del menú: una puerta «pulsa para comenzar» (enciende el sonido),
// luego el video de la intro (hecho con Artlist) con la historia narrada y el logo.
// tiempos medidos sobre la narración (voz generada con Artlist), que empieza en VOICE_AT
const VOICE_AT = 0.8;
const CAPS = [
  [0.8, 7.5, 'Hace mucho tiempo, Aethra era un solo cielo, unido por la luz del Eco.'],
  [7.9, 12.4, 'Cuando el Eco se rompió, sus islas quedaron a la deriva entre las nubes…'],
  [12.6, 15.7, '…y en el horizonte empezó a crecer una sombra.'],
  [16.2, 20.8, 'Solo alguien con el viejo bastón del abuelo puede reunir los fragmentos.'],
];
const LOGO_AT = 22.4, END_AT = 28.5;

export function runIntro({ onStart, onEnd, sfx, onLogo }) {
  const $ = id => document.getElementById(id);
  const root = $('intro'), vid = $('introVid'), cap = $('introCap'), logo = $('introLogo'), gate = $('introGate'), skipB = $('introSkip');
  let phase = 'gate', t0 = 0, raf = 0, capIdx = -1, done = false, voiceOn = false;
  const voice = new Audio('assets/intro/narracion.mp3'); voice.preload = 'auto'; voice.volume = 1;
  root.classList.remove('hidden');
  try { vid.load(); } catch (e) {}

  const finish = () => {
    if (done) return; done = true; cancelAnimationFrame(raf);
    root.classList.add('out'); sfx && sfx('open');
    if (!logo.classList.contains('show')) onLogo && onLogo();
    const v0 = voice.volume; let k = 0; const fadeV = setInterval(() => { k += 0.1; voice.volume = Math.max(0, v0 * (1 - k)); if (k >= 1) { clearInterval(fadeV); voice.pause(); } }, 60);
    setTimeout(() => { root.classList.add('hidden'); try { vid.pause(); } catch (e) {} onEnd && onEnd(); }, 900);
    cleanup();
  };
  const start = () => {
    if (phase !== 'gate') return;
    phase = 'play'; gate.classList.add('hidden'); skipB.classList.remove('hidden');
    root.classList.add('playing');
    onStart && onStart();
    t0 = performance.now();
    vid.currentTime = 0;
    const p = vid.play(); if (p && p.catch) p.catch(() => root.classList.add('novideo')); // sin video: queda la imagen con movimiento
    tick();
  };
  const tick = () => {
    const t = (performance.now() - t0) / 1000;
    let k = -1; for (let i = 0; i < CAPS.length; i++) if (t >= CAPS[i][0] && t < CAPS[i][1]) k = i;
    if (k !== capIdx) { capIdx = k; cap.classList.remove('show'); if (k >= 0) { void cap.offsetWidth; cap.textContent = CAPS[k][2]; cap.style.animationDuration = (CAPS[k][1] - CAPS[k][0]) + 's'; cap.classList.add('show'); } }
    if (!voiceOn && t >= VOICE_AT) { voiceOn = true; const p = voice.play(); if (p && p.catch) p.catch(() => {}); }
    if (t >= LOGO_AT && !logo.classList.contains('show')) { logo.classList.add('show'); sfx && sfx('unlock'); onLogo && onLogo(); }
    if (t >= END_AT) return finish();
    raf = requestAnimationFrame(tick);
  };
  // saltar: durante el video, el primer toque lleva al logo; el segundo entra al menú
  const skip = () => {
    if (phase === 'gate') return start();
    const t = (performance.now() - t0) / 1000;
    if (t < LOGO_AT - 0.2) { t0 = performance.now() - LOGO_AT * 1000; capIdx = -2; cap.classList.remove('show'); voiceOn = true; try { voice.pause(); } catch (e) {} try { vid.currentTime = Math.max(0, (vid.duration || 10) - 0.6); } catch (e) {} }
    else finish();
  };
  const onKey = e => { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) skip(); };
  const onPtr = e => { e.preventDefault(); skip(); };
  let padPrev = true, padRaf = 0;
  const pad = () => { // cualquier botón del mando
    const ps = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    const any = ps.some(p => p.buttons.some(b => b.pressed));
    if (any && !padPrev) skip();
    padPrev = any; if (!done) padRaf = requestAnimationFrame(pad);
  };
  addEventListener('keydown', onKey, true); root.addEventListener('pointerdown', onPtr);
  padRaf = requestAnimationFrame(pad);
  function cleanup() { removeEventListener('keydown', onKey, true); root.removeEventListener('pointerdown', onPtr); cancelAnimationFrame(padRaf); }
  return { skip, finish, get phase() { return phase; } };
}
