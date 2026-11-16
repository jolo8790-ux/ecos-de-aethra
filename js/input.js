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

    addEventListener('keydown', e => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys[e.code] = true;
      this.usingGamepad = false;
      const a = KEYMAP[e.code];
      if (a) this._pressed.add(a);
    });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = {}; });

    // ratón: arrastrar para girar
    // un clic sin arrastrar = atacar; arrastrar = girar la cámara; clic derecho = esquivar
    let drag = false, lx = 0, ly = 0, moved = 0;
    canvas.addEventListener('mousedown', e => {
      if (e.button === 1) { e.preventDefault(); this._pressed.add('grapple'); return; }
      if (e.button === 2) { this._pressed.add('dodge'); this.usingGamepad = false; return; }
      drag = true; moved = 0; lx = e.clientX; ly = e.clientY;
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('mouseup', e => {
      if (drag && e.button === 0 && moved < 6) { this._pressed.add('attack'); }
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
    let joyId = null, cx = 0, cy = 0, camId = null, tx = 0, ty = 0;
    this._joy = { x: 0, y: 0 };
    const btn = (id, action) => document.getElementById(id).addEventListener('touchstart', e => { e.stopPropagation(); this._pressed.add(action); this._held.add(action); }, { passive: true });
    btn('tJump', 'jump'); btn('tAct', 'interact'); btn('tPause', 'pause'); btn('tAtk', 'attack'); btn('tDodge', 'dodge'); btn('tHook', 'grapple'); btn('tShield', 'shield'); btn('tPulse', 'pulse');
    document.getElementById('tShield').addEventListener('touchend', () => this._held.delete('shield'));
    document.getElementById('tJump').addEventListener('touchend', () => this._held.delete('jump'));
    addEventListener('touchstart', e => {
      for (const t of e.changedTouches) {
        if (t.target.closest('.tbtn') || t.target.closest('.overlay') || t.target.closest('#dialog')) continue;
        if (t.clientX < innerWidth * 0.45 && joyId === null) {
          joyId = t.identifier; cx = t.clientX; cy = t.clientY;
          joy.style.display = 'block'; joy.style.left = (cx - 60) + 'px'; joy.style.top = (cy - 60) + 'px';
        } else if (camId === null) { camId = t.identifier; tx = t.clientX; ty = t.clientY; }
      }
    }, { passive: true });
    addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) {
          let dx = t.clientX - cx, dy = t.clientY - cy;
          const l = Math.hypot(dx, dy), m = 50;
          if (l > m) { dx *= m / l; dy *= m / l; }
          this._joy.x = dx / m; this._joy.y = -dy / m;
          knob.style.left = (35 + dx) + 'px'; knob.style.top = (35 + dy) + 'px';
        } else if (t.identifier === camId) {
          this.look.x += (t.clientX - tx) * 1.3; this.look.y += (t.clientY - ty) * 1.3;
          tx = t.clientX; ty = t.clientY;
        }
      }
    }, { passive: true });
    const end = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) { joyId = null; this._joy.x = this._joy.y = 0; joy.style.display = 'none'; knob.style.left = knob.style.top = '35px'; }
        if (t.identifier === camId) camId = null;
      }
    };
    addEventListener('touchend', end); addEventListener('touchcancel', end);
  }

  // Llamar una vez por frame, antes de leer el estado.
  poll() {
    let mx = 0, my = 0;
    const k = this.keys;
    if (k.KeyW || k.ArrowUp) my += 1;
    if (k.KeyS || k.ArrowDown) my -= 1;
    if (k.KeyA || k.ArrowLeft) mx -= 1;
    if (k.KeyD || k.ArrowRight) mx += 1;
    if (k.KeyQ) this.look.x -= 6;
    if (k.KeyR) this.look.x += 6;
    this.walk = !!(k.ShiftLeft || k.ShiftRight);
    mx += this._joy.x; my += this._joy.y;

    // mando
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = this.gamepadIndex !== null ? pads[this.gamepadIndex] : [...pads].find(p => p);
    if (pad) {
      const dz = v => Math.abs(v) < 0.15 ? 0 : v;
      const lx = dz(pad.axes[0] || 0), ly = dz(pad.axes[1] || 0), rx = dz(pad.axes[2] || 0), ry = dz(pad.axes[3] || 0);
      if (lx || ly || rx || ry) this.usingGamepad = true;
      mx += lx; my -= ly;
      this.look.x += rx * 14; this.look.y += ry * 10;
      const b = i => pad.buttons[i] && pad.buttons[i].pressed;
      const edge = (i, action) => { const now = b(i); if (now && !this._prevPad[i]) { this._pressed.add(action); this.usingGamepad = true; } this._prevPad[i] = now; };
      edge(0, 'jump'); edge(2, 'attack'); edge(1, 'dodge'); edge(3, 'interact'); edge(9, 'pause'); edge(5, 'grapple'); edge(7, 'grapple'); edge(6, 'pulse'); edge(12, 'choiceUp'); edge(13, 'choiceDown');
      this._padShield = b(4);
      this._padJump = b(0);
    }

    const l = Math.hypot(mx, my);
    if (l > 1) { mx /= l; my /= l; }
    this.move.x = mx; this.move.y = my;
  }

  pressed(action) { return this._pressed.has(action); }
  held(action) {
    if (action === 'jump') return !!(this.keys.Space || this._padJump || this._held.has('jump'));
    if (action === 'shield') return !!(this.keys.KeyV || this._padShield || this._held.has('shield'));
    return this._held.has(action);
  }

  // Llamar al final del frame.
  endFrame() { this._pressed.clear(); this.look.x = this.look.y = 0; this.zoom = 0; }
}

const KEYMAP = {
  Space: 'jump', KeyE: 'interact', Enter: 'interact', KeyF: 'interact', KeyJ: 'attack', KeyK: 'dodge', KeyL: 'dodge', KeyG: 'grapple', KeyC: 'grapple', KeyZ: 'pulse', KeyX: 'pulse', Digit1: 'choice1', Digit2: 'choice2', Numpad1: 'choice1', Numpad2: 'choice2',
  Escape: 'pause', KeyP: 'pause', ArrowUp: 'choiceUp', ArrowDown: 'choiceDown',
};
