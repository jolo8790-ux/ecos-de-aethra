// Entrada unificada: teclado, ratón, táctil y mando.
// El resto del juego solo lee input.move, input.look y las acciones "pressed".

export class Input {
  constructor(canvas) {
    this.keys = {};
    this.move = { x: 0, y: 0 };      // x: derecha, y: adelante (-1..1)
    this.look = { x: 0, y: 0 };      // delta de cámara acumulado en este frame
    this.zoom = 0;
    this.walk = false;
    this._pressed = new Set();       // acciones pulsadas en este frame
    this._held = new Set();
    this.gamepadIndex = null;
    this.usingGamepad = false;
    this._prevPad = {};
    this.arenaKeys = false; this.excludePad = null;

    addEventListener('keydown', e => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys[e.code] = true;
      this.usingGamepad = false;
      // Arena con dos jugadores en un teclado: el jugador 1 golpea con F y esquiva con G (las flechas son del jugador 2)
      const a = this.arenaKeys ? (ARENA_P1[e.code] || (P2_CODES.has(e.code) ? null : KEYMAP[e.code])) : KEYMAP[e.code];
      if (a) this._pressed.add(a);
      if (POWER_KEYS[e.code] && !(this.arenaKeys && P2_CODES.has(e.code))) this._pressed.add(POWER_KEYS[e.code]);
    });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = {}; });

    // ratón: arrastrar para girar
    // un clic sin arrastrar = atacar; arrastrar = girar la cámara; clic derecho = esquivar
    let drag = false, lx = 0, ly = 0, moved = 0;
    // los móviles «imitan» un clic de ratón después de cada toque: se ignoran para que un toque no cuente como atacar
    let lastTouch = -1e9; addEventListener('touchstart', () => { lastTouch = performance.now(); }, { capture: true, passive: true }); addEventListener('touchend', () => { lastTouch = performance.now(); }, { capture: true, passive: true });
    const fakeMouse = () => performance.now() - lastTouch < 900;
    canvas.addEventListener('mousedown', e => {
      if (fakeMouse()) return;
      if (e.button === 1) { e.preventDefault(); this._pressed.add('grapple'); return; }
      if (e.button === 2) { this._pressed.add('dodge'); this.usingGamepad = false; return; }
      drag = true; moved = 0; lx = e.clientX; ly = e.clientY;
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('mouseup', e => {
      if (drag && e.button === 0 && moved < 6 && !fakeMouse()) { this._pressed.add('attack'); }
      drag = false;
    });
    addEventListener('mousemove', e => {
      if (!drag) return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      moved += Math.abs(dx) + Math.abs(dy);
      this.look.x += dx; this.look.y += dy;
      lx = e.clientX; ly = e.clientY;
    });
    canvas.addEventListener('wheel', e => { this.zoom += Math.sign(e.deltaY); }, { passive: true });
    canvas.addEventListener('click', () => this._pressed.add('click'));

    // táctil
    this.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (this.isTouch) document.body.classList.add('touch');
    this._setupTouch();

    addEventListener('gamepadconnected', e => { this.gamepadIndex = e.gamepad.index; });
    addEventListener('gamepaddisconnected', () => { this.gamepadIndex = null; });
  }

  _setupTouch() {
    const joy = document.getElementById('joy'), knob = document.getElementById('joyKnob');
    let joyId = null, camId = null, tx = 0, ty = 0;
    this._joy = { x: 0, y: 0 };
    // A saltar · B golpear · C esquivar · X usar/hablar · Y escudo (mantener) · Z garfio o pulso de luz
    const MAP = { tA: 'jump', tB: 'attack', tC: 'dodge', tX: 'interact', tY: 'shield', tZ: 'special', tPause: 'pause', tP1: 'power1', tP2: 'power2', tP3: 'power3', tPortal: 'portal' };
    // Botones: responden al primer contacto (pointerdown llega antes que touchstart en muchos teléfonos), tienen un área
    // de toque más grande que el dibujo, y se puede deslizar el dedo de un botón a otro sin levantarlo (p. ej. golpe → salto).
    const BTN = new Map(), owner = new Map(); // id de dedo → botón
    const down = (el, action, fid) => { if (owner.get(fid) === el) return; const prev = owner.get(fid); if (prev) release(prev, fid); owner.set(fid, el); this._pressed.add(action); this._held.add(action); el.classList.add('on'); if (navigator.vibrate) try { navigator.vibrate(6); } catch (e) {} };
    const release = (el, fid) => { owner.delete(fid); const a = BTN.get(el); if (![...owner.values()].includes(el)) { this._held.delete(a); el.classList.remove('on'); } };
    for (const [id, action] of Object.entries(MAP)) {
      const el = document.getElementById(id); if (!el) continue; BTN.set(el, action);
      el.addEventListener('touchstart', e => { e.stopPropagation(); e.preventDefault(); for (const t of e.changedTouches) down(el, action, t.identifier); }, { passive: false });
    }
    const btnAt = (x, y) => { const h = document.elementFromPoint(x, y); const b = h && h.closest && h.closest('.tbtn'); return b && BTN.has(b) ? b : null; };
    addEventListener('touchmove', e => {
      for (const t of e.changedTouches) { if (!owner.has(t.identifier)) continue; const b = btnAt(t.clientX, t.clientY); if (b && b !== owner.get(t.identifier) && BTN.get(b) !== 'pause') down(b, BTN.get(b), t.identifier); }
    }, { passive: true });
    const lift = e => { for (const t of e.changedTouches) { const el = owner.get(t.identifier); if (el) release(el, t.identifier); } };
    addEventListener('touchend', lift, { passive: true }); addEventListener('touchcancel', lift, { passive: true });
    // la palanca está fija abajo a la izquierda; cualquier toque en la mitad izquierda la mueve
    const center = () => { const r = joy.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
    const setKnob = (x, y) => {
      const [cx, cy] = center(); let dx = x - cx, dy = y - cy;
      const l = Math.hypot(dx, dy), m = 44; // recorrido corto: velocidad máxima antes
      if (l > m) { dx *= m / l; dy *= m / l; }
      this._joy.x = dx / m; this._joy.y = -dy / m;
      knob.style.left = (39 + dx) + 'px'; knob.style.top = (39 + dy) + 'px';
    };
    // si un dedo «se perdió» (su touchend no llegó: el elemento desapareció, salió un menú encima…), se suelta
    const alive = (e, id) => [...e.touches].some(t => t.identifier === id);
    this.resetTouch = () => { joyId = null; camId = null; this._joy.x = this._joy.y = 0; knob.style.left = knob.style.top = '39px'; };
    addEventListener('touchstart', e => {
      if (joyId !== null && !alive(e, joyId)) { joyId = null; this._joy.x = this._joy.y = 0; knob.style.left = knob.style.top = '39px'; }
      if (camId !== null && !alive(e, camId)) camId = null;
      for (const t of e.changedTouches) {
        if (t.target.closest('.tbtn') || t.target.closest('.overlay') || t.target.closest('#dialog')) continue;
        if (t.clientX < innerWidth * 0.45 && joyId === null) { joyId = t.identifier; setKnob(t.clientX, t.clientY); }
        else if (camId === null) { camId = t.identifier; tx = t.clientX; ty = t.clientY; }
      }
    }, { passive: true });
    addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) setKnob(t.clientX, t.clientY);
        else if (t.identifier === camId) {
          this.look.x += (t.clientX - tx) * 1.3; this.look.y += (t.clientY - ty) * 1.3;
          tx = t.clientX; ty = t.clientY;
        }
      }
    }, { passive: true });
    const end = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) { joyId = null; this._joy.x = this._joy.y = 0; knob.style.left = knob.style.top = '39px'; }
        if (t.identifier === camId) camId = null;
      }
    };
    addEventListener('touchend', end); addEventListener('touchcancel', end);
    addEventListener('visibilitychange', () => { if (document.hidden) this.resetTouch(); }); addEventListener('blur', () => this.resetTouch());
  }

  // Llamar una vez por frame, antes de leer el estado.
  poll() {
    let mx = 0, my = 0;
    const k = this.keys;
    const ar = !this.arenaKeys;
    if (k.KeyW || (ar && k.ArrowUp)) my += 1;
    if (k.KeyS || (ar && k.ArrowDown)) my -= 1;
    if (k.KeyA || (ar && k.ArrowLeft)) mx -= 1;
    if (k.KeyD || (ar && k.ArrowRight)) mx += 1;
    if (k.KeyQ) this.look.x -= 6;
    if (k.KeyR) this.look.x += 6;
    this.walk = !this.arenaKeys && !!(k.ShiftLeft || k.ShiftRight);
    mx += this._joy.x; my += this._joy.y;

    // mando
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = this.gamepadIndex !== null ? pads[this.gamepadIndex] : [...pads].find(p => p);
    if (pad && this.excludePad != null && pad.index === this.excludePad) pad = [...pads].find(p => p && p.index !== this.excludePad); // ese mando es del jugador 2
    if (pad) {
      const dz = v => Math.abs(v) < 0.15 ? 0 : v;
      const lx = dz(pad.axes[0] || 0), ly = dz(pad.axes[1] || 0), rx = dz(pad.axes[2] || 0), ry = dz(pad.axes[3] || 0);
      if (lx || ly || rx || ry) this.usingGamepad = true;
      mx += lx; my -= ly;
      this.look.x += rx * 14; this.look.y += ry * 10;
      const b = i => pad.buttons[i] && pad.buttons[i].pressed;
      const edge = (i, action) => { const now = b(i), hit = now && !this._prevPad[i]; if (hit) { this._pressed.add(action); this.usingGamepad = true; if (this.onPad) this.onPad(); } this._prevPad[i] = now; return hit; };
      edge(0, 'jump'); edge(2, 'attack'); edge(1, 'dodge'); edge(3, 'interact'); edge(9, 'pause'); edge(8, 'pause'); edge(5, 'grapple'); edge(7, 'grapple'); edge(6, 'pulse'); edge(12, 'choiceUp'); if (edge(13, 'choiceDown')) this._pressed.add('power3'); edge(14, 'navLeft'); edge(15, 'navRight'); edge(10, 'power1'); edge(11, 'power2');
      // la palanca izquierda también elige en los menús (con repetición si se mantiene)
      const sdir = ly < -0.55 ? 'choiceUp' : ly > 0.55 ? 'choiceDown' : lx < -0.55 ? 'navLeft' : lx > 0.55 ? 'navRight' : null;
      const nowT = performance.now();
      if (sdir && sdir !== this._stickDir) { this._pressed.add(sdir); this._stickT = nowT + 380; if (this.onPad) this.onPad(); }
      else if (sdir && nowT > (this._stickT || 0)) { this._pressed.add(sdir); this._stickT = nowT + 140; }
      this._stickDir = sdir;
      // la cruceta también mueve a Lía
      if (b(12)) my += 1; if (b(13)) my -= 1; if (b(14)) mx -= 1; if (b(15)) mx += 1;
      this.padName = pad.id || '';
      this._padShield = b(4);
      this._padJump = b(0); this._padDodge = b(1);
    }

    const l = Math.hypot(mx, my);
    if (l > 1) { mx /= l; my /= l; }
    this.move.x = mx; this.move.y = my;
  }

  pressed(action) { return this._pressed.has(action); }
  // Símbolo del botón según el mando: PlayStation (✕ ○ □ △) o Xbox/genérico (A B X Y)
  get isPlayStation() { return /054c|playstation|dualshock|dualsense|wireless controller|ps4|ps5/i.test(this.padName || ''); }
  padIcon(action) {
    const ps = { jump: '✕', dodge: '○', attack: '□', interact: '△', shield: 'L1', grapple: 'R1', pulse: 'L2', pause: 'OPTIONS' };
    const xb = { jump: 'A', dodge: 'B', attack: 'X', interact: 'Y', shield: 'LB', grapple: 'RB', pulse: 'LT', pause: 'START' };
    return (this.isPlayStation ? ps : xb)[action] || '';
  }
  // Vibración del mando (si lo admite) o del teléfono
  rumble(ms = 180, strong = 0.6) {
    try {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const pad = this.gamepadIndex !== null ? pads[this.gamepadIndex] : [...pads].find(p => p);
      if (pad && pad.vibrationActuator && this.usingGamepad) pad.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: strong * 0.6 });
      else if (this.isTouch && navigator.vibrate) navigator.vibrate(Math.min(ms, 120));
    } catch (e) {}
  }
  held(action) {
    if (action === 'jump') return !!(this.keys.Space || this._padJump || this._held.has('jump') || this.autoJump);
    if (action === 'shield') return !!(this.keys.KeyV || this._padShield || this._held.has('shield'));
    if (this.arenaKeys && action === 'dodge') return !!(this.keys.KeyG || this._padDodge);
    if (action === 'dodge') return !!(this.keys.KeyK || this.keys.KeyL || this.keys.ShiftRight || this._padDodge || this._held.has('dodge') || this.autoDown); // bajar nadando (también modo Automático)
    return this._held.has(action);
  }

  // Llamar al final del frame.
  endFrame() { this._pressed.clear(); this.look.x = this.look.y = 0; this.zoom = 0; }
}

const KEYMAP = {
  Space: 'jump', KeyE: 'interact', Enter: 'interact', KeyF: 'interact', KeyJ: 'attack', KeyK: 'dodge', KeyL: 'dodge', KeyG: 'grapple', KeyC: 'grapple', KeyZ: 'pulse', KeyX: 'pulse', Digit1: 'choice1', Digit2: 'choice2', Numpad1: 'choice1', Numpad2: 'choice2',
  Escape: 'pause', KeyP: 'pause', ArrowUp: 'choiceUp', ArrowDown: 'choiceDown', KeyH: 'heroes', KeyB: 'portal',
};
const POWER_KEYS = { Digit1: 'power1', Digit2: 'power2', Digit3: 'power3' };
const ARENA_P1 = { KeyF: 'attack', KeyG: 'dodge' };
const P2_CODES = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Slash', 'Minus', 'Period', 'Comma', 'KeyM', 'KeyN', 'ControlRight', 'Numpad0', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad5', 'Enter', 'KeyJ', 'KeyK', 'KeyL']);
