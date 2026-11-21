import * as THREE from 'three';
import { HD, lavaMaterial, flameMaterial, flameSheetMaterial } from './hd.js';
import { glowTex, smokeTex } from './vfx.js';
import { Traps } from './traps.js';

// Peligros y plataformas especiales:
//  · crumbles  — rocas flotantes que tiemblan al pisarlas y se desploman un momento después (vuelven a aparecer)
//  · fireJets  — bocas de lava que avisan con un brillo y lanzan una columna de fuego hacia arriba
//  · pendulums — mazas con pinchos que se balancean sobre el camino
//  · lava      — mar de lava animado (sustituye al agua) y brasas que flotan en el aire

const additive = (color, opacity = 0.8) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

export class Hazards {
  constructor(world) {
    this.w = world; this.root = world.root; this.physics = world.physics;
    this.crumbles = []; this.jets = []; this.pends = []; this.gates = []; this.t = 0; this.events = [];
    this.traps = new Traps(this);
  }

  build(z) {
    (z.crumbles || []).forEach(c => this._crumble(c));
    (z.fireJets || []).forEach(j => this._jet(j));
    (z.pendulums || []).forEach(p => this._pendulum(p));
    (z.sealGates || []).forEach(g => this._sealGate(g));
    if (z.lava) this._lava(z.lava);
    if (z.embers) this._embers(z.embers);
    this.traps.build(z, this.w.save);
  }

  // ---------- plataformas que se desploman ----------
  _crumble({ x, y, z, w = 2.6, d = 2.6, h = 0.7, delay = 0.85, back = 3.5, color = 0xc4553a }) {
    const g = new THREE.Group(); g.position.set(x, y, z); this.root.add(g);
    const top = new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true, emissive: 0xff5a1a, emissiveIntensity: 0.15 });
    const under = new THREE.MeshStandardMaterial({ color: 0x4a2a22, roughness: 1, flatShading: true });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), top); slab.position.y = -h / 2; slab.castShadow = slab.receiveShadow = true; g.add(slab);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(Math.min(w, d) * 0.55, h * 2.6, 6), under); cone.rotation.x = Math.PI; cone.position.y = -h - h * 1.3; g.add(cone);
    // grietas brillantes en la cara superior
    const crack = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.85, d * 0.85), additive(0xff8a2a, 0.3)); crack.rotation.x = -Math.PI / 2; crack.position.y = 0.012; g.add(crack);
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const cx = cv.getContext('2d');
    cx.strokeStyle = '#fff'; cx.lineWidth = 2.2;
    for (let i = 0; i < 5; i++) { cx.beginPath(); let px = 32, py = 32; cx.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (Math.random() - 0.5) * 26; py += (Math.random() - 0.5) * 26; cx.lineTo(px, py); } cx.stroke(); }
    crack.material.map = new THREE.CanvasTexture(cv);
    const box = this.physics.addBox(x, y - h / 2, z, w, h, d, { crumble: true });
    this.crumbles.push({ g, box, top, crack, base: new THREE.Vector3(x, y, z), state: 'idle', t: 0, vy: 0, delay, back, w, d });
  }

  // ---------- chorros de fuego ----------
  _jet({ x, y, z, h = 6, r = 0.85, period = 3.2, on = 1.1, phase = 0, pillar = 0 }) {
    const g = new THREE.Group(); g.position.set(x, y, z); this.root.add(g);
    const rock = new THREE.MeshStandardMaterial({ color: 0x3a2a2a, roughness: 1, flatShading: true });
    const vent = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.35, r + 0.6, 0.35, 9), rock); vent.position.y = 0.17; vent.receiveShadow = true; g.add(vent);
    if (pillar) { // columna de roca (solo decorado: no se puede pisar)
      const pm = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.3, r + 0.9, pillar, 8), rock); pm.position.y = -pillar / 2; g.add(pm);
    }
    const glowMat = new THREE.MeshStandardMaterial({ color: 0x501000, emissive: 0xff5a10, emissiveIntensity: 0.4 });
    const core = new THREE.Mesh(new THREE.CircleGeometry(r, 16), glowMat); core.rotation.x = -Math.PI / 2; core.position.y = 0.36; g.add(core);
    // tres capas de llama (blanca-amarilla dentro, naranja, roja fuera)
    const flames = [[0xfff2a0, 0.45, 0.9], [0xffa020, 0.8, 0.75], [0xff3a10, 1.05, 0.55]].map(([c, s, o]) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r * s * 0.35, r * s, 1, 14, 1, true), HD.on ? flameMaterial(o * 1.2) : additive(c, o));
      m.position.y = 0.5; m.visible = false; g.add(m); return m;
    });
    // chispas
    const n = 36, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), col = new Float32Array(n * 3), seeds = [];
    for (let i = 0; i < n; i++) { seeds.push([Math.random() * Math.PI * 2, Math.random() * r, Math.random(), 0.7 + Math.random() * 0.6]); const c = new THREE.Color().setHSL(0.02 + Math.random() * 0.1, 1, 0.6); col.set([c.r, c.g, c.b], i * 3); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const sparks = new THREE.Points(geo, new THREE.PointsMaterial({ size: HD.on ? 0.32 : 0.22, map: HD.on ? glowTex() : null, vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    sparks.visible = false; g.add(sparks);
    const J = { g, x, y, z, h, r, period, on, phase, flames, core, glowMat, sparks, geo, pos, seeds, hot: 0, was: 'off' };
    if (HD.on) this._jetHD(J);
    this.jets.push(J);
  }
  // fuego HD: láminas de llama de cara a la cámara, lenguas de fuego que suben, humo y un resplandor en el suelo
  _jetHD(J) {
    const { g, r } = J;
    J.flames.forEach(f => { f.visible = false; f.userData.off = true; });
    J.sheets = [0, 1, 2].map(i => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), flameSheetMaterial(i === 0 ? 1.15 : 0.8, i * 3.7 + J.x));
      m.renderOrder = 3; m.visible = false; m.userData.i = i; g.add(m);
      m.onBeforeRender = (rd, sc, cam) => { const wp = J._wp || (J._wp = new THREE.Vector3()); g.getWorldPosition(wp); m.rotation.y = Math.atan2(cam.position.x - wp.x, cam.position.z - wp.z) + (m.userData.i - 1) * 0.5; m.updateMatrixWorld(); m.modelViewMatrix.multiplyMatrices(cam.matrixWorldInverse, m.matrixWorld); };
      return m;
    });
    const ftex = glowTex(), stex = smokeTex();
    J.puffs = []; J.smoke = [];
    for (let i = 0; i < 16; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ftex, color: 0xffa040, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); s.visible = false; g.add(s); J.puffs.push({ s, o: i / 16, a: Math.random() * 6.28, sp: 0.8 + Math.random() * 0.5 }); }
    for (let i = 0; i < 8; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: stex, color: 0x2a2220, transparent: true, opacity: 0, depthWrite: false })); s.visible = false; g.add(s); J.smoke.push({ s, o: i / 8, a: Math.random() * 6.28 }); }
    // resplandor en el suelo y en la boca
    J.pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ftex, color: 0xff6a1a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    J.pool.rotation.x = -Math.PI / 2; J.pool.position.y = 0.4; J.pool.scale.setScalar(r * 7); g.add(J.pool);
    J.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: ftex, color: 0xff7a2a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); g.add(J.halo);
  }
  _jetHDUpdate(J, t, st) {
    const hot = J.hot, h = J.h * hot, vis = hot > 0.03;
    J.sheets.forEach((m, i) => {
      m.visible = vis; if (!vis) return; m.material.uniforms.uTime.value = t;
      const hh = Math.max(0.2, h * (1.08 - i * 0.12) * (0.94 + Math.sin(t * 13 + i * 2) * 0.06)), ww = J.r * (4.6 - i * 0.9) * (0.85 + hot * 0.15);
      m.scale.set(ww, hh, 1); m.position.y = 0.3 + hh / 2;
    });
    for (const P of J.puffs) {
      P.s.visible = vis; if (!vis) continue;
      const k = (P.o + t * 1.15 * P.sp) % 1, rise = 0.4 + k * h * 1.05, sw = Math.sin(t * 5 + P.a) * J.r * 0.35 * k;
      P.s.position.set(Math.cos(P.a + t) * J.r * 0.6 * (1 - k) + sw, rise, Math.sin(P.a + t) * J.r * 0.3 * (1 - k));
      const sc = J.r * (2.6 - k * 1.2) * (0.7 + hot * 0.3); P.s.scale.setScalar(sc);
      P.s.material.color.setHSL(0.09 - k * 0.08, 1, 0.5 - k * 0.25); P.s.material.opacity = (k < 0.1 ? k * 10 : 1 - k) * 0.6 * hot;
    }
    const smokeOn = hot > 0.2 || st === 'warn';
    for (const S of J.smoke) {
      S.s.visible = smokeOn || S.s.material.opacity > 0.01;
      const k = (S.o + t * 0.35) % 1, top = Math.max(1.5, J.h * Math.max(hot, 0.25));
      S.s.position.set(Math.sin(S.a + t * 0.6) * (0.3 + k * 1.2), top + k * 3.5, Math.cos(S.a + t * 0.5) * (0.3 + k * 1.2));
      S.s.scale.setScalar(J.r * (1.4 + k * 3)); S.s.material.rotation = S.a + t * 0.3;
      const target = (smokeOn ? (st === 'warn' ? 0.12 : 0.32) : 0) * Math.sin(k * Math.PI);
      S.s.material.opacity += (target - S.s.material.opacity) * 0.15;
    }
    const warnGlow = st === 'warn' ? 0.35 + Math.sin(t * 30) * 0.25 : 0;
    J.pool.material.opacity = Math.max(warnGlow, hot * (0.45 + Math.sin(t * 17) * 0.1));
    J.halo.position.y = 0.6 + h * 0.3; J.halo.scale.setScalar(J.r * (3 + hot * 4)); J.halo.material.opacity = Math.max(warnGlow * 0.5, hot * 0.22 * (0.9 + Math.sin(t * 23) * 0.1));
  }
  // fase del chorro: 'off' | 'warn' (0.8 s antes) | 'burst'
  jetState(J, t = this.t) {
    const s = ((t + J.phase) % J.period + J.period) % J.period, b = J.period - J.on;
    return s >= b ? 'burst' : s >= b - 0.8 ? 'warn' : 'off';
  }
  // ¿habrá fuego cerca de (x,z) en los próximos `ahead` segundos? (para el modo Automático)
  fireNear(x, z, ahead = 1.2, margin = 1.6) {
    for (const J of this.jets) {
      if (Math.hypot(J.x - x, J.z - z) > J.r + margin) continue;
      for (let k = 0; k <= 6; k++) if (this.jetState(J, this.t + ahead * k / 6) !== 'off') return J;
    }
    return null;
  }

  // ---------- péndulos ----------
  _pendulum({ x, y, z, len = 4.5, axis = 'x', amp = 1.05, speed = 1.8, phase = 0, r = 0.75, post = 0 }) {
    const g = new THREE.Group(); g.position.set(x, y, z); this.root.add(g);
    const metal = new THREE.MeshStandardMaterial({ color: 0x5a5560, metalness: 0.7, roughness: 0.35 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2228, metalness: 0.5, roughness: 0.5 });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? 9.2 : 0.4, 0.4, axis === 'x' ? 0.4 : 9.2), dark); g.add(beam); // travesaño entre dos columnas
    if (post) for (const sgn of [-1, 1]) { // postes que sostienen el travesaño (salen de la lava)
      const pm = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, post, 8), dark);
      pm.position.set(axis === 'x' ? sgn * 4.5 : 0, -post / 2, axis === 'x' ? 0 : sgn * 4.5); pm.castShadow = true; g.add(pm);
      this.physics.addBox(x + pm.position.x, y - post / 2, z + pm.position.z, 0.55, post, 0.55); // el poste es sólido
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.6, 12), metal); hub.rotation[axis === 'x' ? 'x' : 'z'] = Math.PI / 2; g.add(hub);
    const arm = new THREE.Group(); g.add(arm);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, len, 8), metal); rod.position.y = -len / 2; arm.add(rod);
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), new THREE.MeshStandardMaterial({ color: 0x6a3a2a, metalness: 0.6, roughness: 0.4, flatShading: true, emissive: 0x7a1a00, emissiveIntensity: 0.25 }));
    ball.position.y = -len; ball.castShadow = true; arm.add(ball);
    const spikeGeo = new THREE.ConeGeometry(0.16, 0.55, 6);
    for (const v of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const sp = new THREE.Mesh(spikeGeo, metal), d = new THREE.Vector3(...v);
      sp.position.copy(d).multiplyScalar(r + 0.2); sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); ball.add(sp);
    }
    // estela brillante de la maza
    const trail = new THREE.Mesh(new THREE.RingGeometry(len - r * 0.5, len + r * 0.5, 28, 1, -Math.PI / 2 - amp, amp * 2), additive(0xff6a2a, 0)); if (axis === 'z') trail.rotation.y = Math.PI / 2; g.add(trail);
    this.pends.push({ g, arm, x, y, z, len, axis, amp, speed, phase, r, trail, ball: new THREE.Vector3(), vel: 0 });
  }

  // ---------- barrera de luz (se abre con un Sello) ----------
  _sealGate({ x, y, z, w, h = 16, d = 0.6, flag }) {
    const box = this.physics.addBox(x, y + h / 2, z, w, h, d, { gate: true });
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 256; const cx = cv.getContext('2d');
    const gr = cx.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(120,80,255,0)'); gr.addColorStop(0.45, 'rgba(110,90,255,.75)'); gr.addColorStop(1, 'rgba(60,150,255,.85)');
    cx.fillStyle = gr; cx.fillRect(0, 0, 128, 256);
    cx.strokeStyle = 'rgba(255,255,255,.9)'; cx.lineWidth = 3;
    for (let i = 0; i < 6; i++) { cx.beginPath(); const px = 20 + i * 18, py = 60 + (i % 3) * 50; cx.arc(px, py, 7, 0, 7); cx.moveTo(px, py + 12); cx.lineTo(px, py + 30); cx.stroke(); }
    const tex = new THREE.CanvasTexture(cv); tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(w / 4, 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(x, y + h / 2, z); this.root.add(m);
    const G = { box, m, tex, flag, open: false };
    if (this.w.save && this.w.save.flags[flag]) { box.off = true; m.visible = false; G.open = true; }
    this.gates.push(G);
  }

  // ---------- lava ----------
  _lava({ y = -6, size = 420, color = 0xff4a10 }) {
    if (HD.on) {
      const lm = lavaMaterial(), m = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 120, 120), lm);
      m.rotation.x = -Math.PI / 2; m.position.y = y; this.root.add(m);
      this.w.water = { y, mesh: m, lava: true };
      this.w.animated.push(t => { lm.uniforms.uTime.value = t; });
      return;
    }
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const cx = cv.getContext('2d');
    cx.fillStyle = '#7a1200'; cx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 140; i++) { const gx = Math.random() * 256, gy = Math.random() * 256, rr = 8 + Math.random() * 34; const gr = cx.createRadialGradient(gx, gy, 0, gx, gy, rr); gr.addColorStop(0, `hsla(${30 + Math.random() * 25},100%,${55 + Math.random() * 20}%,0.9)`); gr.addColorStop(1, 'hsla(10,100%,30%,0)'); cx.fillStyle = gr; cx.beginPath(); cx.arc(gx, gy, rr, 0, 7); cx.fill(); }
    cx.strokeStyle = 'rgba(40,8,0,0.55)'; cx.lineWidth = 3;
    for (let i = 0; i < 26; i++) { cx.beginPath(); let px = Math.random() * 256, py = Math.random() * 256; cx.moveTo(px, py); for (let k = 0; k < 5; k++) { px += (Math.random() - 0.5) * 60; py += (Math.random() - 0.5) * 60; cx.lineTo(px, py); } cx.stroke(); }
    const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(size / 30, size / 30); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex, color: 0xffffff }));
    m.rotation.x = -Math.PI / 2; m.position.y = y; this.root.add(m);
    const tex2 = tex.clone(); tex2.needsUpdate = true; tex2.repeat.set(size / 47, size / 47);
    const m2 = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex2, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
    m2.rotation.x = -Math.PI / 2; m2.position.y = y + 0.05; this.root.add(m2);
    this.w.water = { y, mesh: m, lava: true };
    this.w.animated.push((t) => { tex.offset.set(t * 0.012, t * 0.007); tex2.offset.set(-t * 0.018, t * 0.01); m2.material.opacity = 0.35 + Math.sin(t * 1.3) * 0.12; });
  }
  _embers({ n = 160, area = 70, y0 = -4, y1 = 26, cx = 0, cz = -40 }) {
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), col = new Float32Array(n * 3), sd = [];
    for (let i = 0; i < n; i++) { sd.push([cx + (Math.random() - 0.5) * area, cz + (Math.random() - 0.5) * area, Math.random(), 0.3 + Math.random() * 0.7]); const c = new THREE.Color().setHSL(0.03 + Math.random() * 0.09, 1, 0.55 + Math.random() * 0.2); col.set([c.r, c.g, c.b], i * 3); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: HD.on ? 0.3 : 0.18, map: HD.on ? glowTex() : null, vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    pts.frustumCulled = false; this.root.add(pts);
    const H = y1 - y0;
    this.w.animated.push(t => {
      for (let i = 0; i < n; i++) { const [x, z, o, s] = sd[i]; const k = (o + t * 0.04 * s) % 1; pos[i * 3] = x + Math.sin(t * s + i) * 1.4; pos[i * 3 + 1] = y0 + k * H; pos[i * 3 + 2] = z + Math.cos(t * s * 0.8 + i) * 1.4; }
      geo.attributes.position.needsUpdate = true;
    });
  }

  // ---------- cada paso de simulación ----------
  // Devuelve los golpes de este paso: [{ dmg, from: Vector3, push: Vector3, kind }]
  update(dt, player) {
    this.t += dt; const t = this.t, hits = [];
    if (HD.on) for (const J of this.jets) for (const f of J.flames) if (f.material.uniforms) f.material.uniforms.uTime.value = t + J.x;
    const P = player.pos;
    for (const C of this.crumbles) {
      if (C.state === 'idle') {
        if (player.grounded && player.ground === C.box) { C.state = 'shake'; C.t = C.delay * ((player.diff && player.diff.crumble) || 1); C.d0 = C.t; this.events.push({ type: 'crack', pos: C.base }); }
      } else if (C.state === 'shake') {
        C.t -= dt; const k = 1 - C.t / C.d0;
        C.g.position.set(C.base.x + Math.sin(t * 70) * 0.06 * k, C.base.y - k * 0.06, C.base.z + Math.cos(t * 83) * 0.06 * k);
        C.top.emissiveIntensity = 0.15 + k * 0.9; C.crack.material.opacity = 0.3 + k * 0.7;
        if (C.t <= 0) { C.state = 'fall'; C.box.off = true; C.vy = 0; C.t = C.back; this.events.push({ type: 'crumble', pos: C.base }); }
      } else if (C.state === 'fall') {
        C.vy -= 22 * dt; C.g.position.y += C.vy * dt; C.g.rotation.x += dt * 0.8; C.g.rotation.z += dt * 0.5;
        C.t -= dt; if (C.t <= 0) { C.state = 'rise'; C.t = 0; C.g.rotation.set(0, 0, 0); C.top.emissiveIntensity = 0.15; C.crack.material.opacity = 0.3; }
      } else if (C.state === 'rise') {
        C.t += dt / 0.5; const k = Math.min(1, C.t), e = 1 - Math.pow(1 - k, 3);
        C.g.position.set(C.base.x, C.base.y - 3 * (1 - e), C.base.z); C.g.scale.setScalar(0.3 + 0.7 * e);
        const inside = P.x > C.box.minX - 0.4 && P.x < C.box.maxX + 0.4 && P.z > C.box.minZ - 0.4 && P.z < C.box.maxZ + 0.4 && P.y < C.box.maxY && P.y + 1.6 > C.box.minY;
        if (k >= 1 && !inside) { C.state = 'idle'; C.box.off = false; C.g.scale.setScalar(1); this.events.push({ type: 'crumbleBack', pos: C.base }); }
      }
    }
    for (const J of this.jets) {
      const st = this.jetState(J);
      if (st !== J.was) { if (st === 'burst') this.events.push({ type: 'fire', pos: new THREE.Vector3(J.x, J.y, J.z) }); J.was = st; }
      const target = st === 'burst' ? 1 : 0; J.hot += (target - J.hot) * Math.min(1, dt * (target ? 14 : 6));
      J.glowMat.emissiveIntensity = st === 'warn' ? 1.2 + Math.sin(t * 30) * 0.8 : 0.4 + J.hot * 2;
      const vis = J.hot > 0.03; J.sparks.visible = vis || st === 'warn';
      if (J.sheets) this._jetHDUpdate(J, t, st);
      J.flames.forEach((f, i) => { f.visible = vis && !f.userData.off; const hh = J.h * J.hot * (1 - i * 0.08) * (0.92 + Math.sin(t * 23 + i * 2) * 0.08); f.scale.set(1 + Math.sin(t * 17 + i) * 0.06, Math.max(0.01, hh), 1 + Math.cos(t * 19 + i) * 0.06); f.position.y = 0.4 + hh / 2; });
      if (J.sparks.visible) {
        const hh = Math.max(1.2, J.h * J.hot);
        for (let i = 0; i < J.seeds.length; i++) { const [a, rr, o, s] = J.seeds[i]; const k = (o + t * 1.6 * s) % 1; const spread = 0.3 + k * 0.7; J.pos[i * 3] = Math.cos(a + t * 2) * rr * spread; J.pos[i * 3 + 1] = 0.4 + k * hh; J.pos[i * 3 + 2] = Math.sin(a + t * 2) * rr * spread; }
        J.geo.attributes.position.needsUpdate = true;
      }
      if (J.hot > 0.5) {
        const dx = P.x - J.x, dz = P.z - J.z, dh = Math.hypot(dx, dz);
        if (dh < J.r + 0.35 && P.y > J.y - 0.3 && P.y < J.y + J.h * J.hot) {
          // empujón hacia fuera del chorro (si está justo en el centro, hacia donde mira)
          let ox = dx, oz = dz; if (dh < 0.15) { ox = -Math.sin(player.facing); oz = -Math.cos(player.facing); }
          const l = Math.hypot(ox, oz) || 1; hits.push({ kind: 'fire', dmg: 1, from: new THREE.Vector3(J.x, P.y, J.z), push: new THREE.Vector3(ox / l * 7, 10, oz / l * 7) });
        }
      }
    }
    for (const G of this.gates) {
      if (G.open) continue;
      G.tex.offset.x = t * 0.05; G.m.material.opacity = 0.5 + Math.sin(t * 2.2) * 0.12;
      if (this.w.save && this.w.save.flags[G.flag]) { G.open = true; G.box.off = true; G.m.visible = false; this.events.push({ type: 'gateOpen', pos: G.m.position.clone() }); }
    }
    for (const Pd of this.pends) {
      const a = Pd.amp * Math.sin(t * Pd.speed + Pd.phase), av = Pd.amp * Pd.speed * Math.cos(t * Pd.speed + Pd.phase);
      if (Pd.axis === 'x') Pd.arm.rotation.z = a; else Pd.arm.rotation.x = -a;
      if (Pd.lastA != null && Math.sign(a) !== Math.sign(Pd.lastA)) this.events.push({ type: 'pendulum', pos: new THREE.Vector3(Pd.x, Pd.y - Pd.len, Pd.z) }); // pasa por abajo: zumbido
      Pd.lastA = a;
      const off = Math.sin(a) * Pd.len, down = -Math.cos(a) * Pd.len;
      Pd.ball.set(Pd.x + (Pd.axis === 'x' ? off : 0), Pd.y + down, Pd.z + (Pd.axis === 'z' ? off : 0));
      Pd.trail.material.opacity = Math.min(0.22, Math.abs(av) * 0.08);
      const cy = P.y + 0.9, d = Math.hypot(P.x - Pd.ball.x, cy - Pd.ball.y, P.z - Pd.ball.z);
      if (d < Pd.r + 0.55) {
        const sx = Pd.axis === 'x' ? Math.sign(av) : 0, sz = Pd.axis === 'z' ? Math.sign(av) : 0;
        hits.push({ kind: 'pendulum', dmg: 1, from: Pd.ball.clone(), push: new THREE.Vector3(sx * 9, 6, sz * 9) });
      }
    }
    this.traps.update(dt, t, player, hits, this.events);
    return hits;
  }
  // ¿pasa la maza de un péndulo por (x,z) pronto? (para el modo Automático)
  pendulumNear(x, z, margin = 1.4) {
    for (const Pd of this.pends) if (Math.hypot(Pd.x - x, Pd.z - z) < Pd.len * Math.sin(Pd.amp) + margin) return Pd;
    return null;
  }
}
