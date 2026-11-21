import * as THREE from 'three';

// Trampas nuevas de los Senderos (HD 14):
//  · spinners — barra giratoria sobre una isla: hay que saltarla al pasar
//  · blinkers — plataformas de cristal que se encienden y se apagan con ritmo (parpadean antes de irse)
//  · spikes   — baldosas con pinchos que suben y bajan (avisan con un brillo rojo)
//  · gusts    — ráfagas de viento que empujan de lado sobre un puente (se ven venir)
//  · orbs     — ecos flotantes que se recogen al tocarlos (+1 ✧); trazan el camino y premian el riesgo
// En modo Automático las trampas no empujan y las plataformas de cristal no se apagan.

const add = (color, opacity = 0.8) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
let glowTexC = null;
function glowTex() {
  if (glowTexC) return glowTexC;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); glowTexC = new THREE.CanvasTexture(c); return glowTexC;
}
const segDist = (px, pz, ax, az, bx, bz) => { const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1; let k = ((px - ax) * vx + (pz - az) * vz) / l2; k = Math.max(0, Math.min(1, k)); return [Math.hypot(px - ax - vx * k, pz - az - vz * k), k]; };

export class Traps {
  constructor(hz) {
    this.hz = hz; this.physics = hz.physics;
    this.spinners = []; this.blinkers = []; this.spikes = []; this.gusts = []; this.orbs = [];
  }
  get root() { return this.hz.root; } // Aethra sin fin cambia la raíz por sector
  build(z, save) {
    (z.spinners || []).forEach(s => this._spinner(s));
    (z.blinkers || []).forEach(b => this._blinker(b));
    (z.spikes || []).forEach(s => this._spikes(s));
    (z.gusts || []).forEach(g => this._gust(g));
    const got = new Set((save && save.orbs) || []);
    (z.orbs || []).forEach(o => { if (!got.has(o.id)) this._orb(o); });
  }

  // ---------- barra giratoria ----------
  _spinner({ x, y, z, len = 3.1, speed = 1.5, h = 0.5, arms = 1 }) {
    const g = new THREE.Group(); g.position.set(x, y, z); this.root.add(g);
    const metal = new THREE.MeshStandardMaterial({ color: 0x4a3a30, metalness: 0.7, roughness: 0.35 });
    const hot = new THREE.MeshStandardMaterial({ color: 0xffa040, emissive: 0xff6a10, emissiveIntensity: 1.1, roughness: 0.4 });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, h + 0.5, 12), metal); post.position.y = (h + 0.5) / 2; post.castShadow = true; g.add(post);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10), hot); cap.position.y = h + 0.5; g.add(cap);
    const rot = new THREE.Group(); rot.position.y = h; g.add(rot);
    for (let i = 0; i < arms * 2; i++) {
      const a = i * Math.PI / arms, arm = new THREE.Group(); arm.rotation.y = a; rot.add(arm);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(len - 0.3, 0.26, 0.26), metal); bar.position.x = len / 2 + 0.15; bar.castShadow = true; arm.add(bar);
      for (let k = 1; k <= 3; k++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 6, 14), hot); ring.rotation.y = Math.PI / 2; ring.position.x = k * len / 3.5; arm.add(ring); }
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), hot); tip.position.x = len; arm.add(tip);
      const trail = new THREE.Mesh(new THREE.RingGeometry(len * 0.3, len, 24, 1, 0, 0.9), add(0xffa050, 0.18)); trail.rotation.x = -Math.PI / 2; trail.position.y = -0.02; trail.rotation.z = -0.9; arm.add(trail);
    }
    this.physics.addBox(x, y + (h + 0.5) / 2, z, 0.6, h + 0.5, 0.6);
    this.spinners.push({ x, y, z, len, speed, h, arms, rot, a: Math.random() * 6, lastHalf: 0 });
  }

  // ---------- plataforma de cristal con ritmo ----------
  _blinker({ x, y, z, w = 2.6, d = 2.6, h = 0.4, period = 3.4, on = 2.1, phase = 0, color = 0x9fe3ff }) {
    const g = new THREE.Group(); g.position.set(x, y, z); this.root.add(g);
    const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, transparent: true, opacity: 0.82, roughness: 0.15, metalness: 0.1 });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); slab.position.y = -h / 2; slab.receiveShadow = true; g.add(slab);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(slab.geometry), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })); edge.position.copy(slab.position); g.add(edge);
    const rune = new THREE.Mesh(new THREE.RingGeometry(Math.min(w, d) * 0.2, Math.min(w, d) * 0.32, 6), add(0xffffff, 0.5)); rune.rotation.x = -Math.PI / 2; rune.position.y = 0.015; g.add(rune);
    const box = this.physics.addBox(x, y - h / 2, z, w, h, d, { blink: true });
    this.blinkers.push({ g, m, edge, rune, box, period, on, phase, vis: 1, state: 'on' });
  }
  blinkState(B, t) {
    const k = ((t + B.phase) % B.period + B.period) % B.period;
    return k < B.on - 0.7 ? 'on' : k < B.on ? 'warn' : 'off';
  }

  // ---------- baldosa de pinchos ----------
  _spikes({ x, y, z, w = 3, d = 3, period = 2.6, up = 1.1, phase = 0 }) {
    const g = new THREE.Group(); g.position.set(x, y, z); this.root.add(g);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), new THREE.MeshStandardMaterial({ color: 0x3a3438, metalness: 0.6, roughness: 0.5, emissive: 0xb01808, emissiveIntensity: 0 }));
    plate.position.y = 0.03; plate.receiveShadow = true; g.add(plate);
    const spk = new THREE.Group(); g.add(spk);
    const cm = new THREE.MeshStandardMaterial({ color: 0xd8d2c8, metalness: 0.85, roughness: 0.25 });
    const nx = Math.max(2, Math.round(w / 0.6)), nz = Math.max(2, Math.round(d / 0.6)), cg = new THREE.ConeGeometry(0.13, 0.7, 6);
    const inst = new THREE.InstancedMesh(cg, cm, nx * nz), M = new THREE.Matrix4(); let i = 0;
    for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) { M.makeTranslation(-w / 2 + (a + 0.5) * w / nx, 0.35, -d / 2 + (b + 0.5) * d / nz); inst.setMatrixAt(i++, M); }
    inst.castShadow = true; spk.add(inst); spk.position.y = -0.72;
    this.spikes.push({ x, y, z, w, d, period, up, phase, plate, spk, k: 0, was: 'down' });
  }
  spikeState(S, t) {
    const k = ((t + S.phase) % S.period + S.period) % S.period;
    return k < S.up ? 'up' : k > S.period - 0.55 ? 'warn' : 'down';
  }

  // ---------- ráfaga de viento sobre un puente ----------
  _gust({ x1, z1, x2, z2, y, w = 3, side = 1, period = 4.2, on = 1.6, phase = 0, power = 4.2 }) {
    const g = new THREE.Group(); this.root.add(g);
    const len = Math.hypot(x2 - x1, z2 - z1), ux = (x2 - x1) / len, uz = (z2 - z1) / len, nx = -uz * side, nz = ux * side;
    const n = 46, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 6), seeds = [];
    for (let i = 0; i < n; i++) seeds.push([Math.random(), Math.random() * 3.2, Math.random()]);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
    const lines = new THREE.LineSegments(geo, mat); lines.frustumCulled = false; g.add(lines);
    // banderines en los extremos: avisan hacia dónde sopla
    const flags = [];
    for (const [fx, fz] of [[x1, z1], [x2, z2]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), new THREE.MeshStandardMaterial({ color: 0x6a5040 }));
      pole.position.set(fx - nx * (w / 2 + 0.3), y + 1.1, fz - nz * (w / 2 + 0.3)); g.add(pole);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshStandardMaterial({ color: 0x8fd8ff, emissive: 0x2a7aa0, emissiveIntensity: 0.4, side: THREE.DoubleSide }));
      fl.position.set(pole.position.x + nx * 0.45, y + 1.95, pole.position.z + nz * 0.45); fl.rotation.y = Math.atan2(nx, nz) + Math.PI / 2; g.add(fl); flags.push(fl);
    }
    this.gusts.push({ x1, z1, y, w, len, ux, uz, nx, nz, period, on, phase, power, lines, pos, seeds, mat, flags, was: 'calm' });
  }
  gustState(G, t) {
    const k = ((t + G.phase) % G.period + G.period) % G.period;
    return k < G.on ? 'blow' : k > G.period - 0.9 ? 'warn' : 'calm';
  }

  // ---------- eco flotante ----------
  _orb({ id, x, y, z }) {
    const g = new THREE.Group(); g.position.set(x, y, z); this.root.add(g);
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), new THREE.MeshStandardMaterial({ color: 0xbff4ff, emissive: 0x7fdcff, emissiveIntensity: 1.4, roughness: 0.2 }));
    g.add(core);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0x9fe8ff, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending })); halo.scale.setScalar(1.1); g.add(halo);
    this.orbs.push({ id, g, core, halo, base: y, ph: x * 0.7 + z * 0.3 });
  }

  update(dt, t, player, hits, events) {
    const P = player.pos, auto = !!(player.diff && player.diff.auto);
    for (const S of this.spinners) {
      S.a += dt * S.speed; S.rot.rotation.y = S.a;
      const half = Math.floor(S.a / Math.PI);
      if (half !== S.lastHalf) { S.lastHalf = half; if (Math.hypot(P.x - S.x, P.z - S.z) < 9) events.push({ type: 'spin', pos: new THREE.Vector3(S.x, S.y + S.h, S.z) }); }
      if (auto) continue;
      const ry = S.y + S.h; if (P.y > ry + 0.15 || P.y + 1.5 < ry - 0.2) continue; // saltando por encima (o muy por debajo)
      for (let i = 0; i < S.arms * 2; i++) {
        const a = S.a + i * Math.PI / S.arms, ex = S.x + Math.cos(a) * S.len, ez = S.z - Math.sin(a) * S.len; // rotation.y gira x hacia -z
        const [dd, k] = segDist(P.x, P.z, S.x, S.z, ex, ez);
        if (dd < 0.5 && k > 0.12) {
          const tx = -Math.sin(a) * Math.sign(S.speed), tz = -Math.cos(a) * Math.sign(S.speed); // empuja en el sentido del giro
          hits.push({ kind: 'spinner', dmg: 1, from: new THREE.Vector3(S.x, P.y, S.z), push: new THREE.Vector3(tx * 8, 7, tz * 8) }); break;
        }
      }
    }
    for (const B of this.blinkers) {
      const st = auto ? 'on' : this.blinkState(B, t);
      if (st !== B.state) { if (st === 'off' || B.state === 'off') events.push({ type: st === 'off' ? 'blinkOff' : 'blinkOn', pos: B.g.position }); B.state = st; }
      const target = st === 'off' ? 0 : 1; B.vis += (target - B.vis) * Math.min(1, dt * 12);
      const fl = st === 'warn' ? (Math.sin(t * 34) > 0 ? 1 : 0.35) : 1;
      B.m.opacity = 0.82 * B.vis * fl; B.edge.material.opacity = 0.8 * B.vis * fl; B.rune.material.opacity = 0.5 * B.vis; B.rune.rotation.z += dt * 0.8;
      B.g.visible = B.vis > 0.03; B.g.scale.set(0.6 + 0.4 * B.vis, 1, 0.6 + 0.4 * B.vis);
      B.box.off = st === 'off';
    }
    for (const S of this.spikes) {
      const st = this.spikeState(S, t);
      if (st !== S.was) { if (st === 'up' && Math.hypot(P.x - S.x, P.z - S.z) < 14) events.push({ type: 'spikes', pos: new THREE.Vector3(S.x, S.y, S.z) }); S.was = st; }
      const target = st === 'up' ? 1 : st === 'warn' ? 0.18 : 0; S.k += (target - S.k) * Math.min(1, dt * (st === 'up' ? 22 : 6));
      S.spk.position.y = -0.72 + S.k * 0.72 + (st === 'warn' ? Math.sin(t * 60) * 0.02 : 0);
      S.plate.material.emissiveIntensity = st === 'warn' ? 0.3 + Math.sin(t * 28) * 0.22 : S.k * 0.12;
      if (auto || S.k < 0.6) continue;
      if (Math.abs(P.x - S.x) < S.w / 2 + 0.2 && Math.abs(P.z - S.z) < S.d / 2 + 0.2 && P.y < S.y + 0.6 && P.y > S.y - 0.4) {
        let ox = P.x - S.x, oz = P.z - S.z; const l = Math.hypot(ox, oz) || 1; ox /= l; oz /= l;
        hits.push({ kind: 'spikes', dmg: 1, from: new THREE.Vector3(S.x, S.y, S.z), push: new THREE.Vector3(ox * 5, 9, oz * 5) });
      }
    }
    for (const G of this.gusts) {
      const st = this.gustState(G, t);
      if (st !== G.was) { if (st === 'blow' && Math.hypot(P.x - G.x1 - G.ux * G.len / 2, P.z - G.z1 - G.uz * G.len / 2) < G.len) events.push({ type: 'gust', pos: new THREE.Vector3(G.x1 + G.ux * G.len / 2, G.y + 1, G.z1 + G.uz * G.len / 2), dir: new THREE.Vector3(G.nx, 0, G.nz) }); G.was = st; }
      const strength = st === 'blow' ? 1 : st === 'warn' ? 0.25 : 0;
      G.mat.opacity += (strength * 0.55 - G.mat.opacity) * Math.min(1, dt * 6);
      for (const f of G.flags) f.rotation.z = Math.sin(t * (st === 'blow' ? 18 : 4)) * (st === 'blow' ? 0.35 : 0.1);
      if (G.mat.opacity > 0.01) {
        for (let i = 0; i < G.seeds.length; i++) {
          const [u, hh, o] = G.seeds[i], k = (o + t * (0.7 + strength * 1.3)) % 1, along = u * G.len, across = (k - 0.5) * (G.w + 6);
          const bx = G.x1 + G.ux * along + G.nx * across, bz = G.z1 + G.uz * along + G.nz * across, by = G.y + 0.2 + hh;
          G.pos.set([bx, by, bz, bx + G.nx * 1.4, by, bz + G.nz * 1.4], i * 6);
        }
        G.lines.geometry.attributes.position.needsUpdate = true;
      }
      if (auto || st !== 'blow') continue;
      const rx = P.x - G.x1, rz = P.z - G.z1, along = rx * G.ux + rz * G.uz, across = rx * G.nx + rz * G.nz;
      if (along > -0.5 && along < G.len + 0.5 && Math.abs(across) < G.w / 2 + 3 && P.y > G.y - 1 && P.y < G.y + 4.5) {
        const f = G.power * (player.grounded ? 1 : 1.5) * dt; P.x += G.nx * f; P.z += G.nz * f; // empuja de lado: hay que corregir
      }
    }
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const O = this.orbs[i];
      O.g.position.y = O.base + Math.sin(t * 2.2 + O.ph) * 0.15; O.core.rotation.y += dt * 2.5; O.halo.material.opacity = 0.6 + Math.sin(t * 4 + O.ph) * 0.2;
      if (Math.hypot(P.x - O.g.position.x, P.y + 0.9 - O.g.position.y, P.z - O.g.position.z) < 1.05) {
        events.push({ type: 'orb', id: O.id, pos: O.g.position.clone() }); this.root.remove(O.g); this.orbs.splice(i, 1);
      }
    }
  }
}
