// Peligros de las pistas: cada isla tiene los suyos, con su forma de moverse, y aparecen en tramos distintos
// de la vuelta (no siempre bajo el carril colgante). Todo se calcula en el plano de la pista (en el tubo
// de las cloacas se dobla después, como el resto de objetos).
import * as THREE from 'three';

const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o });
const B = (c, o = {}) => new THREE.MeshBasicMaterial({ color: c, ...o });
const rngOf = seed => { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
const hash = str => { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

// ---------- modelos ----------
export const MODEL = {
  barril() { const g = new THREE.Group(), b = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.7, 14), M(0x8a5a2a, { roughness: 0.8 })); b.rotation.x = Math.PI / 2; g.add(b);
    for (const z of [-0.55, 0.55]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.87, 0.07, 6, 18), M(0x3a3a40, { metalness: 0.6 })); h.position.z = z; g.add(h); } return [g, 0.9]; },
  bola() { return [new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 2), M(0xf4faff, { flatShading: true })), 1.15]; },
  roca() { return [new THREE.Mesh(new THREE.DodecahedronGeometry(1.15, 0), M(0xa0583a, { roughness: 1, flatShading: true })), 1.15]; },
  rodador() { const g = new THREE.Group(); for (let k = 0; k < 3; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.08, 4, 14), M(0xb08a4a, { roughness: 1 })); t.rotation.set(k, k * 1.3, k * 0.7); g.add(t); } return [g, 0.95]; },
  engrane() { const g = new THREE.Group(), sh = new THREE.Shape(); const T = 10, R = 1.1;
    for (let k = 0; k <= T * 2; k++) { const a = k / (T * 2) * Math.PI * 2, r = k % 2 ? R : R * 0.8; k ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: false }), M(0xc8a050, { metalness: 0.7, roughness: 0.3 })); m.geometry.translate(0, 0, -0.25); m.rotation.y = Math.PI / 2; g.add(m); return [g, 1.1]; },
  orbe() { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 1), M(0xd8a8ff, { roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.75, emissive: 0x6a2aaa, emissiveIntensity: 0.6, flatShading: true }))); return [g, 1.05]; },
  seta() { const g = new THREE.Group(), st = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.2, 10), M(0xf4ecd8)); st.position.y = -0.3; g.add(st);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 10, 0, 6.3, 0, 1.7), M(0xe0303a, { roughness: 0.5 })); cap.position.y = 0.2; g.add(cap);
    for (let k = 0; k < 5; k++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), M(0xffffff)); const a = k * 1.25; d.position.set(Math.cos(a) * 0.7, 0.75, Math.sin(a) * 0.7); g.add(d); } return [g, 1.0]; },
  pelota() { const g = new THREE.Group(), cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const c = cv.getContext('2d');
    ['#ff4a4a', '#ffd24a', '#4ab0ff', '#ffffff', '#5ad05a', '#ff8ad0'].forEach((col, k) => { c.fillStyle = col; c.fillRect(k * 256 / 6, 0, 256 / 6 + 1, 128); });
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; g.add(new THREE.Mesh(new THREE.SphereGeometry(1.25, 24, 16), new THREE.MeshStandardMaterial({ map: t, roughness: 0.35 }))); return [g, 1.25]; },
  nube() { const g = new THREE.Group(), m = M(0xffffff, { roughness: 1, emissive: 0xdde8ff, emissiveIntensity: 0.3 });
    for (const [x, y, z, r] of [[0, 0, 0, 1], [0.8, -0.1, 0.2, 0.75], [-0.8, -0.1, -0.1, 0.8], [0.2, 0.45, -0.2, 0.7]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), m); b.position.set(x, y, z); g.add(b); }
    const eyes = [-0.3, 0.3].map(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), B(0x2a3a5a)); e.position.set(x, 0.1, 0.95); g.add(e); return e; }); return [g, 1.2]; },
  espectro() { const g = new THREE.Group(), mat = M(0x1a1024, { transparent: true, opacity: 0.85, roughness: 0.9, emissive: 0x2a0a4a, emissiveIntensity: 0.6 });
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.4, 12, 1, true), mat); body.position.y = 0.2; body.rotation.x = Math.PI; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 10), mat); head.position.y = 1.4; g.add(head);
    for (const x of [-0.26, 0.26]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), B(0xd06aff)); e.position.set(x, 1.5, 0.62); g.add(e); }
    for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.3, 6), mat); arm.position.set(s * 0.85, 0.7, 0.2); arm.rotation.z = s * 1.1; g.add(arm); } return [g, 1.0]; },
  // babosa de verdad: cuerpo blando en segmentos, cuernos con ojos y rastro de baba
  babosa() {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body); body.scale.setScalar(1.45);
    const skin = M(0x7ad04a, { roughness: 0.18, metalness: 0.05, emissive: 0x2a6a1a, emissiveIntensity: 0.3 }), belly = M(0xd8f8a0, { roughness: 0.3 }), spot = M(0x3a7a2a, { roughness: 0.3 });
    // cuerpo: segmentos que se afinan hacia la cola
    const segs = [], base = [];
    for (let k = 0; k < 8; k++) { const r = k === 0 ? 0.5 : 0.56 - k * 0.055, s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), skin); s.scale.set(1, 0.85, 1.3); s.position.set(0, r * 0.82, -k * 0.42); body.add(s); segs.push(s); base.push(s.position.y); }
    // manto (la «joroba» de las babosas) con manchas
    const mantle = new THREE.Mesh(new THREE.SphereGeometry(0.6, 18, 12), M(0x62b83e, { roughness: 0.22 })); mantle.position.set(0, 0.78, -0.62); mantle.scale.set(1.05, 0.7, 1.45); body.add(mantle);
    for (let k = 0; k < 7; k++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.07 + (k % 3) * 0.025, 8, 6), spot); const a = -1.2 + k * 0.4; d.position.set(Math.sin(a) * 0.5, 0.98 + Math.cos(a * 1.3) * 0.05, -0.4 - (k % 4) * 0.3); body.add(d); }
    const pneu = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.035, 6, 12), spot); pneu.position.set(0.5, 0.78, -0.55); pneu.rotation.y = Math.PI / 2; body.add(pneu); // orificio de respirar
    // pie (planta ancha y clara)
    const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 2.9, 4, 12), belly); foot.rotation.x = Math.PI / 2; foot.position.set(0, 0.09, -1.45); foot.scale.set(1.35, 1, 0.3); body.add(foot);
    // cuernos con ojos y tentáculos pequeños
    const stalks = [];
    for (const x of [-0.2, 0.2]) { const st = new THREE.Group(); st.position.set(x, 0.7, 0.18);
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.8, 8), skin); c.position.y = 0.4; st.add(c);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), M(0xffffff, { roughness: 0.15 })); eye.position.y = 0.84; st.add(eye);
      const pup = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), B(0x111111)); pup.position.set(0, 0.86, 0.09); st.add(pup);
      st.rotation.x = 0.35; st.rotation.z = -x * 1.3; body.add(st); stalks.push(st); }
    for (const x of [-0.13, 0.13]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 0.3, 6), skin); t.position.set(x, 0.32, 0.55); t.rotation.set(1.25, 0, -x * 2); body.add(t); }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 6, 12, Math.PI), spot); mouth.position.set(0, 0.28, 0.56); mouth.rotation.z = Math.PI; body.add(mouth);
    // rastro de baba brillante
    const trail = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 6), B(0xc8ff9a, { transparent: true, opacity: 0.3, depthWrite: false })); trail.rotation.x = -Math.PI / 2; trail.position.set(0, 0.03, -4.4); g.add(trail);
    g.userData.anim = t => { segs.forEach((s, k) => { const w = Math.sin(t * 5 - k * 0.8); s.position.y = base[k] + Math.max(0, w) * 0.07; s.scale.z = 1.3 + w * 0.12; });
      mantle.position.y = 0.78 + Math.max(0, Math.sin(t * 5 - 1.2)) * 0.05; stalks.forEach((st, k) => { st.rotation.x = 0.35 + Math.sin(t * 2.6 + k * 1.7) * 0.25; st.rotation.z = (k ? -1 : 1) * 0.26 + Math.sin(t * 1.9 + k) * 0.12; }); };
    return [g, 1.35];
  },
};

// ---------- tipos de movimiento ----------
// cada tipo prepara el objeto (make) y lo mueve (tick) dejando en O.hit = {lat, along, y, r} la zona que golpea
const KIND = {
  // rueda de lado a lado
  rueda: { make(O, T) { const [m, r] = MODEL[O.model](); O.m = m; O.r = r; }, tick(O, t, T) { O.lat = O.amp * Math.sin(O.sp * t + O.ph); const yaw = Math.atan2(T.t[O.i].x, T.t[O.i].z);
    O.m.position.copy(O.base(O.lat, O.r * 0.9)); O.m.rotation.set(0, yaw, 0); O.m.rotateZ(-O.lat / O.r); O.hit = { lat: O.lat, y: O.r, r: O.r }; } },
  // rebota mientras cruza (sólo golpea cuando está abajo)
  rebote: { make(O) { const [m, r] = MODEL[O.model](); O.m = m; O.r = r; }, tick(O, t, T) { O.lat = O.amp * Math.sin(O.sp * t + O.ph); const h = Math.abs(Math.sin(t * O.bsp + O.ph)) * O.bh;
    O.m.position.copy(O.base(O.lat, O.r + h)); O.m.rotation.set(0, Math.atan2(T.t[O.i].x, T.t[O.i].z), 0); O.m.scale.set(1 + (h < 0.3 ? 0.15 : 0), h < 0.3 ? 0.82 : 1, 1); O.hit = h < 1.3 ? { lat: O.lat, y: O.r, r: O.r } : null; O.m.userData.anim && O.m.userData.anim(t); } },
  // flota y se desliza (espectros)
  flota: { make(O) { const [m, r] = MODEL[O.model](); O.m = m; O.r = r; }, tick(O, t, T) { O.lat = O.amp * Math.sin(O.sp * t + O.ph); O.m.position.copy(O.base(O.lat, 0.6 + Math.sin(t * 2.2 + O.ph) * 0.35));
    O.m.rotation.set(0, Math.atan2(T.t[O.i].x, T.t[O.i].z) + Math.PI + Math.sin(t * 1.3) * 0.4, 0); O.hit = { lat: O.lat, y: 1, r: O.r }; } },
  // da vueltas al tubo (babosas)
  vuelta: { make(O) { const [m, r] = MODEL[O.model](); O.m = m; O.r = r; }, tick(O, t, T) { let l = O.lat0 + O.sp * t; l = ((l + T.hw) % (2 * T.hw) + 2 * T.hw) % (2 * T.hw) - T.hw; O.lat = l;
    O.m.position.copy(O.base(l, 0)); const tt = T.t[O.i]; O.m.rotation.set(0, Math.atan2(tt.x, tt.z) + (O.sp > 0 ? Math.PI / 2 : -Math.PI / 2), 0); O.m.userData.anim && O.m.userData.anim(t); O.hit = { lat: l, y: 0.6, r: O.r }; } },
  // babosa que cruza despacio la pista (fuera del tubo)
  repta: { make(O) { const [m, r] = MODEL[O.model](); O.m = m; O.r = r; }, tick(O, t, T) { const s = Math.sin(O.sp * t + O.ph); O.lat = O.amp * s; const dir = Math.cos(O.sp * t + O.ph) > 0 ? 1 : -1;
    O.m.position.copy(O.base(O.lat, 0)); const tt = T.t[O.i]; O.m.rotation.set(0, Math.atan2(tt.x, tt.z) + dir * Math.PI / 2, 0); O.m.userData.anim && O.m.userData.anim(t); O.hit = { lat: O.lat, y: 0.6, r: O.r }; } },
  // péndulo colgado de un pórtico sobre la pista (troncos, anclas, faroles)
  pendulo: { make(O, T) { const g = new THREE.Group(), L = O.len, top = L + 1.3, hw = T.hw, post = M(O.postCol || 0x4a3018);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, hw * 2 + 1.6), post); beam.position.y = top; beam.rotation.y = Math.PI / 2; g.add(beam);
      for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.35, top, 0.35), post); p.position.set(s * (hw + 0.8), top / 2, 0); g.add(p); }
      const arm = new THREE.Group(); arm.position.y = top; g.add(arm);
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, L, 5), M(0x3a2a1a)); rope.position.y = -L / 2; arm.add(rope);
      let obj;
      if (O.model === 'tronco') { obj = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 3.2, 10), M(0x7a4a22, { roughness: 0.95 })); obj.rotation.x = Math.PI / 2; O.r = 1.0; }
      else if (O.model === 'ancla') { obj = new THREE.Group(); const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.8, 8), M(0x3a3a44, { metalness: 0.7 })); obj.add(sh);
        const arc = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.13, 6, 16, Math.PI), M(0x3a3a44, { metalness: 0.7 })); arc.rotation.z = Math.PI; arc.position.y = -0.6; obj.add(arc); O.r = 1.0; }
      else { obj = new THREE.Group(); const body = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.5, 1.2, 10), B(0xff7a3a)); obj.add(body);
        obj.add(new THREE.Mesh(new THREE.SphereGeometry(1.3, 10, 8), B(0xffa04a, { transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }))); O.r = 0.9; }
      obj.position.y = -L; arm.add(obj); O.arm = arm; O.m = g; },
    tick(O, t, T) { const a = O.amp * Math.sin(O.sp * t + O.ph); O.arm.rotation.z = a; const c = T.c[O.i];
      O.m.position.set(c.x, c.y, c.z); O.m.rotation.set(0, Math.atan2(T.t[O.i].x, T.t[O.i].z), 0);
      const lat = -Math.sin(a) * O.len, y = O.len + 1.3 - Math.cos(a) * O.len; O.lat = lat; O.hit = y < 1.8 ? { lat, y, r: O.r } : null; } },
  // sale del suelo cada cierto tiempo (géiser de lava, pinchos de cristal, manos de sombra) con aviso antes
  brota: { make(O, T) { const g = new THREE.Group();
      const warn = new THREE.Mesh(new THREE.CircleGeometry(1.4, 24), B(O.warnCol || 0xff5a2a, { transparent: true, opacity: 0, depthWrite: false })); warn.rotation.x = -Math.PI / 2; warn.position.y = 0.04; g.add(warn); O.warn = warn;
      const up = new THREE.Group(); g.add(up); O.up = up;
      if (O.model === 'geiser') { up.add(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.1, 1, 12, 1, true), B(0xff7a2a, { transparent: true, opacity: 0.9 }))); up.add(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.7, 1, 10), B(0xffe08a))); up.children.forEach(c => c.position.y = 0.5); }
      else if (O.model === 'pincho') { for (let k = 0; k < 5; k++) { const p = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.2, 5), M([0xc08aff, 0xff8ad0, 0x8ad0ff][k % 3], { roughness: 0.1, emissive: 0x4a1a6a, emissiveIntensity: 0.6, flatShading: true })); const a = k * 1.25; p.position.set(Math.cos(a) * 0.6, 1.1, Math.sin(a) * 0.6); p.rotation.set(Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3); up.add(p); } }
      else if (O.model === 'mano') { const mat = M(0x140a1e, { emissive: 0x3a0a5a, emissiveIntensity: 0.5, roughness: 0.9 }); const palm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.35), mat); palm.position.y = 1.6; up.add(palm);
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 1.4, 8), mat); arm.position.y = 0.7; up.add(arm);
        for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.8, 5), mat); f.position.set(-0.33 + k * 0.22, 2.5, 0); f.rotation.z = (k - 1.5) * 0.15; up.add(f); }
        const th = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.6, 5), mat); th.position.set(0.55, 1.8, 0); th.rotation.z = -0.9; up.add(th); }
      else if (O.model === 'pison') { const col = M(0x6a6a72, { metalness: 0.6, roughness: 0.4 }); const head = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1, 2.2), M(0xc8a050, { metalness: 0.7, roughness: 0.3 })); head.position.y = 0.5; up.add(head);
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 8, 10), col); rod.position.y = 5; up.add(rod);
        const frame = new THREE.Mesh(new THREE.BoxGeometry(3, 0.6, 3), col); frame.position.y = 7.6; g.add(frame); }
      O.m = g; O.r = O.model === 'pison' ? 1.3 : 1.0; },
    tick(O, t, T) { const P = O.per, u = (((t + O.ph) % P) + P) % P / P; const warnAt = 0.55, onAt = 0.75;
      O.m.position.copy(O.base(O.lat, 0)); O.m.rotation.set(0, Math.atan2(T.t[O.i].x, T.t[O.i].z), 0);
      O.warn.material.opacity = u > warnAt && u < onAt ? 0.25 + 0.35 * Math.abs(Math.sin(t * 14)) : u >= onAt ? 0.15 : 0;
      let k; if (O.model === 'pison') { k = u < onAt ? Math.max(0, 1 - (u - 0) * 0) : 0; const drop = u >= onAt ? Math.min(1, (u - onAt) * 30) : u > 0.9 ? 0 : 0; O.up.position.y = u >= onAt && u < 0.92 ? 6 * (1 - drop) : 6; O.hit = u >= onAt + 0.01 && u < 0.92 ? { lat: O.lat, y: 0.6, r: O.r } : null; return; }
      k = u >= onAt ? Math.min(1, (u - onAt) * 14) * (u > 0.95 ? (1 - u) * 20 : 1) : 0;
      O.up.scale.set(1, Math.max(0.01, O.model === 'geiser' ? k * 6 : k), 1); O.up.visible = k > 0.02; O.hit = k > 0.5 ? { lat: O.lat, y: 0.6, r: O.r } : null; } },
  // cae del cielo: primero una sombra que crece en el suelo
  cae: { make(O) { const g = new THREE.Group(); const sh = new THREE.Mesh(new THREE.CircleGeometry(1.4, 20), B(0x000000, { transparent: true, opacity: 0, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.05; g.add(sh); O.sh = sh;
      const [rock, r] = MODEL[O.model === 'meteoro' ? 'roca' : O.model](); if (O.model === 'meteoro') { rock.material = M(0x5a3a5a, { emissive: 0xff5a2a, emissiveIntensity: 0.8, flatShading: true }); }
      g.add(rock); O.rock = rock; O.r = r; O.m = g; O.cyc = -1; },
    tick(O, t, T) { const P = O.per, n = Math.floor((t + O.ph) / P), u = ((t + O.ph) / P) - n;
      if (n !== O.cyc) { O.cyc = n; const rr = rngOf(O.seed + n * 7919)(); O.lat = (rr * 2 - 1) * (T.hw - 1.8); }
      O.m.position.copy(O.base(O.lat, 0)); const land = 0.7;
      O.sh.material.opacity = u < land ? u / land * 0.5 : Math.max(0, 0.5 - (u - land) * 3); O.sh.scale.setScalar(0.4 + Math.min(1, u / land) * 0.8);
      const y = u < land ? 26 * (1 - (u / land) ** 2) + O.r : O.r - Math.max(0, u - 0.85) * 8; O.rock.position.y = y; O.rock.rotation.x = t * 3; O.rock.visible = y > -O.r;
      O.hit = u > land - 0.05 && u < 0.85 ? { lat: O.lat, y: O.r, r: O.r } : null; } },
  // barra que gira alrededor de un poste en medio de la pista (circo)
  giro: { make(O, T) { const g = new THREE.Group(), L = T.hw - 0.6; const post = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.6, 12), M(0xffd24a, { metalness: 0.4 })); post.position.y = 0.8; g.add(post);
      const bar = new THREE.Group(); bar.position.y = 1.1; g.add(bar); const cv = document.createElement('canvas'); cv.width = 128; cv.height = 16; const c = cv.getContext('2d'); for (let k = 0; k < 8; k++) { c.fillStyle = k % 2 ? '#ffffff' : '#e8303a'; c.fillRect(k * 16, 0, 16, 16); }
      const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; const b = new THREE.Mesh(new THREE.BoxGeometry(L * 2, 0.35, 0.35), new THREE.MeshStandardMaterial({ map: tx })); bar.add(b);
      for (const s of [-1, 1]) { const ball = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), M(0xffd24a)); ball.position.x = s * L; bar.add(ball); }
      O.bar = bar; O.m = g; O.L = L; O.r = 0.75; },
    tick(O, t, T) { const a = O.sp * t + O.ph; O.bar.rotation.y = a; O.m.position.copy(O.base(0, 0)); O.m.rotation.set(0, Math.atan2(T.t[O.i].x, T.t[O.i].z), 0); O.lat = 0; O.ang = a + Math.atan2(T.t[O.i].x, T.t[O.i].z); O.hit = { bar: true }; } },
  // platillo volante con rayo tractor
  ovni: { make(O) { const g = new THREE.Group(); const disc = new THREE.Mesh(new THREE.SphereGeometry(2, 24, 10), M(0xb8c0c8, { metalness: 0.8, roughness: 0.25 })); disc.scale.y = 0.28; g.add(disc);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 10, 0, 6.3, 0, Math.PI / 2), M(0x6affc8, { transparent: true, opacity: 0.7, emissive: 0x2aaa7a, emissiveIntensity: 0.6, roughness: 0.1 })); dome.position.y = 0.35; g.add(dome);
      O.lights = []; for (let k = 0; k < 8; k++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), B(0xffd24a)); const a = k / 8 * Math.PI * 2; l.position.set(Math.cos(a) * 1.8, -0.1, Math.sin(a) * 1.8); g.add(l); O.lights.push(l); }
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 2.2, 8, 20, 1, true), B(0x8affc8, { transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); beam.position.y = -4.2; g.add(beam); O.beam = beam;
      O.m = g; O.r = 2.0; },
    tick(O, t, T) { O.lat = O.amp * Math.sin(O.sp * t + O.ph); O.m.position.copy(O.base(O.lat, 8.4 + Math.sin(t * 1.7 + O.ph) * 0.4)); O.m.rotation.y = t * 1.5;
      O.lights.forEach((l, k) => l.material.color.setHex((Math.floor(t * 6) + k) % 2 ? 0xffd24a : 0x6affc8)); const on = Math.sin(t * 0.9 + O.ph) > -0.3;
      O.beam.visible = on; O.hit = on ? { lat: O.lat, y: 0.6, r: O.r } : null; } },
  // ráfaga de viento que empuja hacia un lado (no te hace girar)
  viento: { make(O, T) { const g = new THREE.Group(); O.streaks = []; for (let k = 0; k < 10; k++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.12), B(0xffffff, { transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); s.position.set(0, 0.6 + (k % 4) * 0.7, (k - 5) * 2.4); g.add(s); O.streaks.push(s); }
      O.m = g; O.r = 0; O.push = 0; },
    tick(O, t, T) { const P = O.per, u = (((t + O.ph) % P) + P) % P / P, on = u > 0.6; const dir = Math.floor((t + O.ph) / P) % 2 ? 1 : -1; O.dir = dir;
      O.m.position.copy(O.base(0, 0)); O.m.rotation.set(0, Math.atan2(T.t[O.i].x, T.t[O.i].z), 0);
      O.streaks.forEach((s, k) => { s.material.opacity = on ? 0.55 : u > 0.45 ? 0.15 : 0; s.position.x = ((((t * 18 + k * 3) % (T.hw * 2)) - T.hw) * dir); });
      O.hit = null; O.push = on ? dir : 0; } },
};

// qué peligros tiene cada isla (tipo de movimiento + modelo)
const SETS = {
  puerto: [{ k: 'rueda', model: 'barril' }, { k: 'pendulo', model: 'ancla', postCol: 0x5a3820 }],
  bosque: [{ k: 'pendulo', model: 'tronco', postCol: 0x4a3018 }, { k: 'rebote', model: 'seta', bh: 2.2, bsp: 3 }],
  glaciar: [{ k: 'rueda', model: 'bola' }, { k: 'cae', model: 'bola', per: 3.4 }],
  ruinas: [{ k: 'cae', model: 'roca', per: 3 }, { k: 'rebote', model: 'rodador', bh: 1.8, bsp: 4 }],
  cloaca: [{ k: 'vuelta', model: 'babosa' }],
  volcan: [{ k: 'brota', model: 'geiser', per: 3.6, warnCol: 0xff5a1a }, { k: 'rueda', model: 'roca' }],
  cristales: [{ k: 'brota', model: 'pincho', per: 3, warnCol: 0xc08aff }, { k: 'rueda', model: 'orbe' }],
  engranajes: [{ k: 'brota', model: 'pison', per: 2.8, warnCol: 0xffd24a }, { k: 'rueda', model: 'engrane' }],
  faroles: [{ k: 'pendulo', model: 'farol', postCol: 0x2a1a10 }, { k: 'flota', model: 'espectro' }],
  nubes: [{ k: 'viento', per: 4 }, { k: 'rebote', model: 'nube', bh: 2.6, bsp: 2 }],
  circo: [{ k: 'giro' }, { k: 'rebote', model: 'pelota', bh: 3.2, bsp: 2.6 }],
  sombras: [{ k: 'flota', model: 'espectro' }, { k: 'brota', model: 'mano', per: 2.6, warnCol: 0x9a2aff }],
  ovni: [{ k: 'ovni' }, { k: 'cae', model: 'meteoro', per: 3.2 }],
};

// elige tramos libres repartidos por la vuelta (distintos en cada pista)
function sectors(T, n, rnd) {
  const N = T.N, R = T.sky, A = T.alt;
  const free = i => i > 70 && i < N - 50 && !T.tunnels.some(([a, b]) => i > a - 18 && i < b + 18) && !T.ramps.some(r => Math.abs(r - i) < 30)
    && !(A && i > A.a - 20 && i < A.b + 20) && !(R && i > R.r - 40 && i < R.r + 12) && !T.def.boosts.some(f => Math.abs(f * N - i) < 14);
  const out = [];
  for (let k = 0; k < n; k++) {
    const target = Math.floor(N * (0.1 + (k + 0.15 + rnd() * 0.7) / n * 0.82));
    for (let d = 0; d < N / 2; d += 3) { const c = [target + d, target - d].find(i => i > 0 && i < N && free(i) && free(i + 30) && out.every(o => Math.abs(o - i) > 60)); if (c != null) { out.push(c); break; } }
  }
  return out.sort((a, b) => a - b);
}

export function buildHazards(race, level = 0.92) {
  const T = race.track, N = T.N, theme = T.tube ? 'cloaca' : race.def.theme.decor, set = SETS[theme] || SETS.puerto;
  const rnd = rngOf(hash(race.def.name)), list = [];
  if (T.tube) for (let k = 0; k < 7; k++) list.push({ ...set[0], i: Math.floor(N * (0.08 + k * 0.13)) % N, lat0: k * 9, sp: (k % 2 ? 1 : -1) * (5 + k * 0.8) * level });
  else {
    const secs = sectors(T, 3, rnd);
    secs.forEach((i0, s) => { const S = set[s % set.length], cnt = S.k === 'giro' || S.k === 'viento' || S.k === 'ovni' ? 1 + (s % 2) : S.k === 'pendulo' ? 2 : 3;
      for (let j = 0; j < cnt; j++) { const lane = cnt === 1 ? 0 : (j - (cnt - 1) / 2) / ((cnt - 1) / 2 || 1);
        list.push({ ...S, i: (i0 + j * (S.k === 'pendulo' ? 22 : 16)) % N, amp: S.k === 'ovni' ? T.hw - 3 : S.k === 'pendulo' ? 0.95 : T.hw - 2.2, sp: (S.k === 'giro' ? 1.4 : S.k === 'pendulo' ? 1.5 : 1.2 + rnd() * 0.6) * level * (rnd() < 0.5 ? -1 : 1),
          ph: rnd() * 6.28, lat: lane * (T.hw - 2.8), seed: hash(race.def.name) + s * 131 + j, len: 6 }); } });
  }
  const hz = [];
  for (const o of list) {
    const O = { ...o }, K = KIND[O.k]; if (!K) continue;
    O.base = (lat, y) => { const c = T.c[O.i], r = T.r[O.i]; return new THREE.Vector3(c.x + r.x * lat, c.y + y, c.z + r.z * lat); };
    K.make(O, T); O.m.traverse(m => { if (m.isMesh) m.castShadow = true; }); race.items.root.add(O.m); hz.push(O);
  }
  race.hz = hz;
}

export function tickHazards(race, dt) {
  const hz = race.hz; if (!hz || !hz.length) return;
  const T = race.track, t = race.clock + race.t;
  for (const O of hz) {
    KIND[O.k].tick(O, t, T);
    const c = T.c[O.i], r = T.r[O.i], tt = T.t[O.i];
    for (const R of race.racers) {
      if (R.remote || R.onSky || R.done) continue;
      const dx = R.pos.x - c.x, dz = R.pos.z - c.z, lat = dx * r.x + dz * r.z, along = dx * tt.x + dz * tt.z, hy = R.pos.y - c.y;
      if (O.k === 'viento') { if (O.push && Math.abs(along) < 18 && hy < 3) { const p = O.push * 7 * dt; R.pos.x += r.x * p; R.pos.z += r.z * p; } continue; }
      const H = O.hit; if (!H || R.inv > 0 || hy > 3.2) continue;
      let hit;
      if (H.bar) { // distancia al segmento de la barra que gira
        const a = O.ang, bx = Math.sin(a + Math.PI / 2), bz = Math.cos(a + Math.PI / 2), proj = dx * bx + dz * bz; hit = Math.abs(proj) < O.L && Math.abs(dx * bz - dz * bx) < O.r + 0.6;
      } else hit = Math.hypot(lat - H.lat, along) < H.r + 0.85 && Math.abs(hy - H.y) < H.r + 1.3;
      if (hit) { const kind = O.model === 'geiser' || O.model === 'meteoro' ? 'quema' : O.model === 'pison' || (O.k === 'cae' && O.model === 'roca') ? 'aplasta' : O.model === 'bola' ? 'congela' : null;
        const was = R.inv; race.items.hit(R, null, false, kind); if (R.you && was <= 0 && !kind) race._flash({ babosa: '¡Babosa!', ovni: '¡Te abdujeron!', mano: '¡Una sombra!' }[O.model || O.k] || '¡Cuidado!', '#ff8a7a'); }
    }
  }
}
