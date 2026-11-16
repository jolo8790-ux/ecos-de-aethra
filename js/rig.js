import * as THREE from 'three';

// Esqueleto humanoide hecho con formas simples. Cada articulación es un Group que se puede rotar.
// Lo usan Lía y los personajes del pueblo (con otras proporciones, colores y peinados).
//
//  root (posición y orientación en el mundo)
//   └ body (pivote en la cadera: inclinaciones y voltereta)
//      └ hips ── legL/legR: hip → knee → ankle
//         └ torso ── neck → head (ojos, pelo, coleta)
//                 ├─ armL/armR: shoulder → elbow
//                 └─ scarf (cola con resorte)

const matCache = {};
const mat = (c, o = {}) => {
  const k = c + JSON.stringify(o);
  return matCache[k] || (matCache[k] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.78, ...o }));
};

export function buildHumanoid(opt = {}) {
  const o = {
    skin: 0xf2c29b, hair: 0x4a2c1d, top: 0x2f8f9d, pants: 0x3b3554, boots: 0x5a3a22,
    scarf: null, bag: null, hairStyle: 'ponytail', hat: null, scale: 1, girth: 1, coat: false,
    ...opt,
  };
  const root = new THREE.Group();
  const add = (parent, geo, material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
  };
  const joint = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const G = o.girth;
  const HIP_H = 0.75;

  const body = joint(root, 0, HIP_H, 0);
  const hips = joint(body);
  add(hips, new THREE.CylinderGeometry(0.2 * G, 0.22 * G, 0.18, 14), mat(o.pants), 0, 0, 0);

  // piernas
  const leg = side => {
    const hip = joint(hips, side * 0.11 * G, -0.04, 0);
    add(hip, new THREE.CylinderGeometry(0.095 * G, 0.08 * G, 0.32, 10), mat(o.pants), 0, -0.16, 0);
    const knee = joint(hip, 0, -0.32, 0);
    add(knee, new THREE.SphereGeometry(0.08 * G, 8, 6), mat(o.pants));
    add(knee, new THREE.CylinderGeometry(0.078 * G, 0.065, 0.32, 10), mat(o.pants), 0, -0.16, 0);
    const ankle = joint(knee, 0, -0.32, 0);
    add(ankle, new THREE.BoxGeometry(0.15, 0.1, 0.26), mat(o.boots), 0, -0.035, -0.045);
    add(ankle, new THREE.CylinderGeometry(0.075, 0.08, 0.12, 10), mat(o.boots), 0, 0.02, 0);
    return { hip, knee, ankle };
  };
  const legL = leg(-1), legR = leg(1);

  // torso
  const torso = joint(hips, 0, 0.06, 0);
  add(torso, new THREE.CylinderGeometry(0.2 * G, 0.235 * G, 0.44, 14), mat(o.top), 0, 0.22, 0);
  add(torso, new THREE.SphereGeometry(0.2 * G, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(o.top), 0, 0.43, 0).scale.y = 0.45;
  if (o.coat) { // faldón de abrigo
    add(torso, new THREE.CylinderGeometry(0.24 * G, 0.3 * G, 0.36, 14, 1, true), mat(o.top, { side: THREE.DoubleSide }), 0, -0.1, 0);
  }

  // cabeza
  const neck = joint(torso, 0, 0.5, 0);
  add(neck, new THREE.CylinderGeometry(0.07, 0.08, 0.1, 8), mat(o.skin), 0, 0.0, 0);
  const head = joint(neck, 0, 0.05, 0);
  add(head, new THREE.SphereGeometry(0.23, 20, 16), mat(o.skin), 0, 0.2, 0);
  add(head, new THREE.SphereGeometry(0.04, 8, 6), mat(o.skin), 0, 0.17, -0.225); // nariz
  const eye = x => {
    const g = joint(head, x, 0.21, -0.195);
    add(g, new THREE.SphereGeometry(0.048, 10, 8), mat(0xffffff));
    add(g, new THREE.SphereGeometry(0.027, 8, 6), mat(0x1c1c28), 0, 0, -0.03);
    return g;
  };
  const eyeL = eye(-0.085), eyeR = eye(0.085);
  [-1, 1].forEach(s => add(head, new THREE.SphereGeometry(0.04, 8, 6), mat(0xf29b9b, { transparent: true, opacity: 0.55 }), s * 0.14, 0.13, -0.17).scale.set(1, 0.6, 0.4)); // mejillas
  const hairCap = add(head, new THREE.SphereGeometry(0.245, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.56), mat(o.hair), 0, 0.22, 0.02);
  hairCap.rotation.x = -0.28;
  add(head, new THREE.BoxGeometry(0.36, 0.08, 0.1), mat(o.hair), 0, 0.37, -0.15).rotation.x = 0.5; // flequillo

  let pony = null;
  if (o.hairStyle === 'ponytail') {
    const base = joint(head, 0, 0.34, 0.2);
    add(base, new THREE.SphereGeometry(0.06, 8, 6), mat(o.scarf || 0xf2b134));
    const s1 = joint(base, 0, 0, 0.02);
    add(s1, new THREE.CylinderGeometry(0.075, 0.06, 0.2, 8), mat(o.hair), 0, -0.1, 0);
    const s2 = joint(s1, 0, -0.2, 0);
    add(s2, new THREE.ConeGeometry(0.06, 0.24, 8), mat(o.hair), 0, -0.12, 0).rotation.x = Math.PI;
    pony = [s1, s2];
  } else if (o.hairStyle === 'bun') {
    add(head, new THREE.SphereGeometry(0.11, 10, 8), mat(o.hair), 0, 0.42, 0.12);
  }

  if (o.hat === 'captain') {
    add(head, new THREE.CylinderGeometry(0.21, 0.24, 0.14, 16), mat(0x1f2f4f), 0, 0.42, 0.02);
    add(head, new THREE.CylinderGeometry(0.3, 0.3, 0.025, 16), mat(0x1f2f4f), 0, 0.36, -0.02);
    add(head, new THREE.BoxGeometry(0.1, 0.06, 0.02), mat(0xf2c94c, { metalness: 0.5 }), 0, 0.43, -0.22);
  }

  // brazos
  const arm = side => {
    const shoulder = joint(torso, side * 0.27 * G, 0.4, 0);
    add(shoulder, new THREE.SphereGeometry(0.075, 8, 6), mat(o.top));
    add(shoulder, new THREE.CylinderGeometry(0.07, 0.062, 0.26, 8), mat(o.top), 0, -0.13, 0);
    const elbow = joint(shoulder, 0, -0.26, 0);
    add(elbow, new THREE.CylinderGeometry(0.06, 0.05, 0.22, 8), mat(o.top), 0, -0.11, 0);
    add(elbow, new THREE.SphereGeometry(0.058, 8, 6), mat(o.skin), 0, -0.25, 0);
    return { shoulder, elbow };
  };
  const armL = arm(-1), armR = arm(1);

  let scarfTail = null;
  if (o.scarf) {
    add(torso, new THREE.TorusGeometry(0.165, 0.06, 8, 18), mat(o.scarf), 0, 0.46, 0).rotation.x = Math.PI / 2;
    const t1 = joint(torso, 0.08, 0.44, 0.17);
    add(t1, new THREE.BoxGeometry(0.11, 0.2, 0.035), mat(o.scarf), 0, -0.1, 0);
    const t2 = joint(t1, 0, -0.2, 0);
    add(t2, new THREE.BoxGeometry(0.1, 0.18, 0.03), mat(o.scarf), 0, -0.09, 0);
    scarfTail = [t1, t2];
  }
  if (o.bag) {
    const strap = add(torso, new THREE.BoxGeometry(0.045, 0.62, 0.05), mat(o.bag), 0, 0.24, 0);
    strap.rotation.z = 0.78; strap.position.z = -0.005;
    add(hips, new THREE.BoxGeometry(0.2, 0.17, 0.09), mat(o.bag), -0.25 * G, 0.04, 0.03);
  }

  root.scale.setScalar(o.scale);
  const rig = { root, body, hips, torso, neck, head, eyeL, eyeR, armL, armR, legL, legR, pony, scarfTail, HIP_H };
  root.userData.rig = rig;
  return rig;
}

// ---------------------------------------------------------------------------------
// Utilidades de animación

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (k, dt) => 1 - Math.exp(-k * dt);
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const smooth01 = t => t * t * (3 - 2 * t);

// Pose objetivo: rotaciones por articulación. Se mezcla y luego se suaviza hacia el esqueleto.
const JOINTS = ['body', 'hips', 'torso', 'neck', 'head',
  'armL.shoulder', 'armL.elbow', 'armR.shoulder', 'armR.elbow',
  'legL.hip', 'legL.knee', 'legL.ankle', 'legR.hip', 'legR.knee', 'legR.ankle'];
const getJoint = (rig, path) => path.split('.').reduce((o, k) => o[k], rig);

function emptyPose() {
  const p = { hipsY: 0 };
  for (const j of JOINTS) p[j] = [0, 0, 0];
  return p;
}
function addPose(dst, src, w) {
  if (w <= 0) return;
  dst.hipsY += src.hipsY * w;
  for (const j of JOINTS) { const a = dst[j], b = src[j]; a[0] += b[0] * w; a[1] += b[1] * w; a[2] += b[2] * w; }
}
function resetPose(p) { p.hipsY = 0; for (const j of JOINTS) { const a = p[j]; a[0] = a[1] = a[2] = 0; } }

// Resorte angular simple para pelo y bufanda.
class Spring {
  constructor(k = 120, d = 11) { this.a = 0; this.v = 0; this.k = k; this.d = d; }
  step(target, dt) { this.v += ((target - this.a) * this.k - this.v * this.d) * dt; this.a += this.v * dt; return this.a; }
}

// ---------------------------------------------------------------------------------
// Animador de Lía: locomoción sincronizada con la distancia, saltos, voltereta,
// aterrizaje, derrape, mirada, parpadeo y movimiento secundario.

export class HeroAnimator {
  constructor(rig) {
    this.rig = rig;
    this.t = 0; this.phase = 0; this.prevSin = 0;
    this.runW = 0; this.moveW = 0;
    this.land = 1; this.landAmt = 0;
    this.flip = -1;
    this.skid = 0;
    this.lean = 0; this.turnLean = 0;
    this.prevFacing = 0;
    this.blinkT = 2.5; this.blink = 0;
    this.look = { yaw: 0, pitch: 0, t: 3, tyaw: 0, tpitch: 0 };
    this.prevVel = new THREE.Vector3();
    this.target = emptyPose(); this.tmp = emptyPose();
    this.ponyX = new Spring(140, 9); this.ponyZ = new Spring(140, 9); this.pony2 = new Spring(160, 10);
    this.scarfX = new Spring(110, 8); this.scarfZ = new Spring(110, 8); this.scarf2 = new Spring(130, 9);
    this.airBlend = 0;
    this._v = new THREE.Vector3(); this._q = new THREE.Quaternion();
  }

  // c: { vel, grounded, facing, jumps, input:{x,y} (mundo), lookAt: Vector3|null, talking }
  // devuelve eventos: { footstep, run }
  update(dt, c) {
    const r = this.rig, P = this.target;
    this.t += dt;
    const ev = { footstep: false, run: false, skid: false };
    const sp = Math.hypot(c.vel.x, c.vel.z);

    // pesos de estado (suaves)
    const wantRun = clamp((sp - 2.6) / 3.6, 0, 1), wantMove = clamp(sp / 1.4, 0, 1);
    this.runW += (wantRun - this.runW) * damp(8, dt);
    this.moveW += (wantMove - this.moveW) * damp(10, dt);
    this.airBlend += ((c.grounded ? 0 : 1) - this.airBlend) * damp(c.grounded ? 22 : 12, dt);
    const runW = this.runW, moveW = this.moveW;

    // aceleración en espacio local (para inclinarse y para el pelo)
    const acc = this._v.copy(c.vel).sub(this.prevVel).divideScalar(Math.max(dt, 1e-4));
    this.prevVel.copy(c.vel);
    const sinF = Math.sin(c.facing), cosF = Math.cos(c.facing);
    const fwdAcc = -(acc.x * sinF + acc.z * cosF);          // + = acelerando hacia delante
    const fwdVel = -(c.vel.x * sinF + c.vel.z * cosF);
    const sideVel = c.vel.x * cosF - c.vel.z * sinF;
    const turnRate = angDiff(c.facing, this.prevFacing) / Math.max(dt, 1e-4);
    this.prevFacing = c.facing;

    // derrape: la entrada apunta contra la velocidad
    const inLen = Math.hypot(c.input.x, c.input.z);
    const skidNow = c.grounded && sp > 4 && inLen > 0.5 && (c.input.x * c.vel.x + c.input.z * c.vel.z) / (sp * inLen) < -0.35;
    this.skid += ((skidNow ? 1 : 0) - this.skid) * damp(skidNow ? 20 : 8, dt);
    if (skidNow) ev.skid = true;

    // fase de pasos: avanza con la distancia recorrida, así los pies no patinan
    const stride = lerp(0.62, 1.12, runW);
    if (c.grounded) this.phase += (sp * dt / stride) * Math.PI;
    const s = Math.sin(this.phase);
    if (c.grounded && moveW > 0.4 && Math.sign(s) !== Math.sign(this.prevSin) && this.prevSin !== 0) { ev.footstep = true; ev.run = runW > 0.5; }
    this.prevSin = s;

    resetPose(P);

    // ---------- suelo: reposo + caminar + correr ----------
    const ground = this.tmp; resetPose(ground);
    {
      const pL = this.phase, pR = this.phase + Math.PI;
      const A = lerp(0.42, 0.88, runW) * moveW;
      const B = lerp(0.6, 1.45, runW) * moveW;
      const legPose = (p, L) => {
        const hip = Math.sin(p) * A + runW * 0.12 * moveW;
        const swing = Math.max(0, Math.cos(p));
        const knee = -(0.06 + B * Math.pow(swing, 1.3) + runW * 0.18 * moveW);
        L[0] = hip;
        return knee;
      };
      ground['legL.knee'][0] = legPose(pL, ground['legL.hip']);
      ground['legR.knee'][0] = legPose(pR, ground['legR.hip']);
      ground['legL.ankle'][0] = -(ground['legL.hip'][0] + ground['legL.knee'][0]) * 0.65;
      ground['legR.ankle'][0] = -(ground['legR.hip'][0] + ground['legR.knee'][0]) * 0.65;

      const armA = lerp(0.38, 1.0, runW) * moveW;
      ground['armL.shoulder'][0] = -Math.sin(pL) * armA;
      ground['armR.shoulder'][0] = -Math.sin(pR) * armA;
      ground['armL.shoulder'][2] = -(0.09 + runW * 0.08);
      ground['armR.shoulder'][2] = 0.09 + runW * 0.08;
      ground['armL.elbow'][0] = 0.14 + lerp(0.2, 1.45, runW) * moveW + Math.max(0, -Math.sin(pL)) * 0.25 * moveW;
      ground['armR.elbow'][0] = 0.14 + lerp(0.2, 1.45, runW) * moveW + Math.max(0, -Math.sin(pR)) * 0.25 * moveW;

      ground.hipsY = -Math.abs(s) * lerp(0.03, 0.07, runW) * moveW + Math.abs(Math.cos(this.phase)) * 0.025 * runW * moveW;
      ground.hips[1] = s * lerp(0.1, 0.2, runW) * moveW;
      ground.hips[2] = s * 0.05 * moveW;
      ground.torso[1] = -ground.hips[1] * 1.35;
      ground.torso[0] = lerp(0.04, 0.24, runW) * moveW;
      ground.torso[2] = -ground.hips[2] * 0.6;
      ground.head[0] = -ground.torso[0] * 0.6;
      ground.head[1] = -ground.torso[1] * 0.5;

      // reposo: respiración, cambio de peso, rodilla relajada
      const idle = 1 - moveW;
      if (idle > 0.01) {
        const br = Math.sin(this.t * 2.1);
        const shift = Math.sin(this.t * 0.55);
        ground.torso[0] += br * 0.025 * idle;
        ground.neck[0] += -br * 0.02 * idle;
        ground.hips[2] += shift * 0.04 * idle;
        ground.torso[2] += -shift * 0.03 * idle;
        ground.hipsY += (-0.012 - Math.abs(shift) * 0.012) * idle;
        ground['legL.knee'][0] += -(0.08 + Math.max(0, shift) * 0.16) * idle;
        ground['legR.knee'][0] += -(0.08 + Math.max(0, -shift) * 0.16) * idle;
        ground['legL.hip'][0] += (0.04 + Math.max(0, shift) * 0.08) * idle;
        ground['legR.hip'][0] += (0.04 + Math.max(0, -shift) * 0.08) * idle;
        ground['legL.ankle'][0] += (0.04 + Math.max(0, shift) * 0.08) * idle;
        ground['legR.ankle'][0] += (0.04 + Math.max(0, -shift) * 0.08) * idle;
        ground['armL.shoulder'][2] += -0.03 * idle - br * 0.02 * idle;
        ground['armR.shoulder'][2] += 0.03 * idle + br * 0.02 * idle;
        ground['armL.elbow'][0] += 0.1 * idle; ground['armR.elbow'][0] += 0.1 * idle;
      }

      // derrape: frena echándose atrás
      const k = this.skid;
      if (k > 0.01) {
        ground.torso[0] += -0.45 * k; ground.hipsY += -0.1 * k;
        ground['legL.hip'][0] = lerp(ground['legL.hip'][0], 0.75, k); ground['legL.knee'][0] = lerp(ground['legL.knee'][0], -0.2, k);
        ground['legR.hip'][0] = lerp(ground['legR.hip'][0], -0.2, k); ground['legR.knee'][0] = lerp(ground['legR.knee'][0], -0.9, k);
        ground['armL.shoulder'][0] = lerp(ground['armL.shoulder'][0], 1.0, k); ground['armR.shoulder'][0] = lerp(ground['armR.shoulder'][0], 0.8, k);
        ground['armL.shoulder'][2] -= 0.4 * k; ground['armR.shoulder'][2] += 0.4 * k;
      }
    }
    addPose(P, ground, 1 - this.airBlend);

    // ---------- aire: subir / caer ----------
    if (this.airBlend > 0.01) {
      const air = this.tmp; resetPose(air);
      const up = smooth01(clamp((c.vel.y + 4) / 12, 0, 1)); // 1 subiendo, 0 cayendo
      // subiendo: una rodilla arriba, brazos hacia arriba
      air['legL.hip'][0] = lerp(0.25, 1.05, up); air['legL.knee'][0] = lerp(-0.45, -1.5, up); air['legL.ankle'][0] = lerp(0.2, 0.5, up);
      air['legR.hip'][0] = lerp(-0.12, -0.3, up); air['legR.knee'][0] = lerp(-0.25, -0.75, up); air['legR.ankle'][0] = 0.3;
      air['armL.shoulder'][0] = lerp(0.5, 2.3, up); air['armR.shoulder'][0] = lerp(0.35, 1.6, up);
      air['armL.shoulder'][2] = lerp(-1.15, -0.35, up); air['armR.shoulder'][2] = lerp(1.15, 0.45, up);
      air['armL.elbow'][0] = lerp(0.35, 0.5, up); air['armR.elbow'][0] = lerp(0.35, 0.7, up);
      air.torso[0] = lerp(0.12, -0.05, up);
      air.head[0] = lerp(-0.1, 0.05, up);
      // aleteo leve al caer
      const fl = (1 - up) * Math.sin(this.t * 14) * 0.12;
      air['armL.shoulder'][2] += fl; air['armR.shoulder'][2] -= fl;
      addPose(P, air, this.airBlend);
    }

    // ---------- voltereta del doble salto ----------
    if (c.doubleJumped) this.flip = 0;
    let flipAngle = 0;
    if (this.flip >= 0) {
      this.flip += dt / 0.46;
      if (this.flip >= 1 || c.grounded) this.flip = -1;
      else {
        const f = this.flip;
        flipAngle = -TAU * smooth01(f);
        const tuck = Math.sin(Math.PI * f);
        P['legL.hip'][0] = lerp(P['legL.hip'][0], 1.7, tuck); P['legR.hip'][0] = lerp(P['legR.hip'][0], 1.6, tuck);
        P['legL.knee'][0] = lerp(P['legL.knee'][0], -2.3, tuck); P['legR.knee'][0] = lerp(P['legR.knee'][0], -2.2, tuck);
        P['armL.shoulder'][0] = lerp(P['armL.shoulder'][0], 1.1, tuck); P['armR.shoulder'][0] = lerp(P['armR.shoulder'][0], 1.1, tuck);
        P['armL.shoulder'][2] = lerp(P['armL.shoulder'][2], -0.2, tuck); P['armR.shoulder'][2] = lerp(P['armR.shoulder'][2], 0.2, tuck);
        P['armL.elbow'][0] = lerp(P['armL.elbow'][0], 1.9, tuck); P['armR.elbow'][0] = lerp(P['armR.elbow'][0], 1.9, tuck);
        P.torso[0] = lerp(P.torso[0], 0.5, tuck); P.head[0] = lerp(P.head[0], 0.3, tuck);
      }
    }

    // ---------- aterrizaje con peso ----------
    if (c.landed) { this.land = 0; this.landAmt = clamp(c.landSpeed / 22, 0.22, 1); }
    if (this.land < 1) {
      this.land = Math.min(1, this.land + dt / 0.38);
      const t = this.land;
      const curve = t < 0.15 ? t / 0.15 : Math.pow(1 - (t - 0.15) / 0.85, 2);
      const a = this.landAmt * curve;
      P.hipsY -= 0.27 * a;
      P['legL.hip'][0] += 0.75 * a; P['legR.hip'][0] += 0.6 * a;
      P['legL.knee'][0] -= 1.35 * a; P['legR.knee'][0] -= 1.2 * a;
      P['legL.ankle'][0] += 0.6 * a; P['legR.ankle'][0] += 0.55 * a;
      P.torso[0] += 0.45 * a; P.head[0] -= 0.25 * a;
      P['armL.shoulder'][2] -= 0.5 * a; P['armR.shoulder'][2] += 0.5 * a;
      P['armL.shoulder'][0] += 0.3 * a; P['armR.shoulder'][0] += 0.3 * a;
    }

    // ---------- inclinación por aceleración y giro ----------
    this.lean += (clamp(fwdAcc * 0.012, -0.18, 0.22) * (c.grounded ? 1 : 0.3) - this.lean) * damp(6, dt);
    this.turnLean += (clamp(-turnRate * 0.045 * clamp(sp / 6.8, 0, 1), -0.32, 0.32) - this.turnLean) * damp(8, dt);
    P.body[0] += this.lean; P.body[2] += this.turnLean * (c.grounded ? 1 : 0.4);
    P.head[2] -= this.turnLean * 0.5;

    // ---------- mirada ----------
    const L = this.look;
    if (c.lookAt) {
      const hp = r.head.getWorldPosition(this._v);
      const dx = c.lookAt.x - hp.x, dy = c.lookAt.y - hp.y, dz = c.lookAt.z - hp.z;
      const lx = dx * Math.cos(c.facing) - dz * Math.sin(c.facing), lz = dx * Math.sin(c.facing) + dz * Math.cos(c.facing);
      L.tyaw = clamp(Math.atan2(-lx, -lz), -1.1, 1.1);
      L.tpitch = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -0.5, 0.4);
      if (Math.abs(Math.atan2(-lx, -lz)) > 2.2) { L.tyaw = 0; L.tpitch = 0; }
      L.t = 2;
    } else {
      L.t -= dt;
      if (L.t <= 0) {
        const idle = 1 - moveW > 0.6;
        L.tyaw = idle && Math.random() < 0.7 ? (Math.random() * 2 - 1) * 0.75 : 0;
        L.tpitch = idle ? (Math.random() * 0.3 - 0.08) : 0;
        L.t = 2 + Math.random() * 3.5;
      }
      if (moveW > 0.5) { L.tyaw *= 0.9; L.tpitch *= 0.9; }
    }
    L.yaw += (L.tyaw - L.yaw) * damp(5, dt);
    L.pitch += (L.tpitch - L.pitch) * damp(5, dt);
    P.head[1] += L.yaw * 0.7; P.neck[1] += L.yaw * 0.3; P.torso[1] += L.yaw * 0.15;
    P.head[0] -= L.pitch * 0.8;

    // ---------- aplicar con suavizado ----------
    const kJ = c.grounded ? 22 : 14;
    if (this.flip < 0) r.body.rotation.x = ((r.body.rotation.x % TAU) + TAU + Math.PI) % TAU - Math.PI; // tras la voltereta, sin desenrollar
    for (const j of JOINTS) {
      const node = getJoint(r, j), t = P[j];
      const k = j === 'head' || j === 'neck' ? 12 : j === 'body' ? 10 : kJ;
      const a = damp(k, dt);
      node.rotation.x += (t[0] - node.rotation.x) * a;
      node.rotation.y += (t[1] - node.rotation.y) * a;
      node.rotation.z += (t[2] - node.rotation.z) * a;
    }
    if (this.flip >= 0) r.body.rotation.x = flipAngle + this.lean;
    r.body.position.y += (r.HIP_H + P.hipsY - r.body.position.y) * damp(24, dt);

    // ---------- parpadeo ----------
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 0.13; this.blinkT = 2 + Math.random() * 3.5; if (Math.random() < 0.2) this.blinkT = 0.25; }
    const eyeS = this.blink > 0 ? 0.1 : 1;
    if (this.blink > 0) this.blink -= dt;
    r.eyeL.scale.y = r.eyeR.scale.y = eyeS;

    // ---------- pelo y bufanda (resortes) ----------
    const vyN = clamp(c.vel.y, -12, 12);
    if (r.pony) {
      const tx = -0.35 - clamp(fwdVel * 0.06, -0.3, 0.55) - clamp(fwdAcc * 0.004, -0.25, 0.25) + vyN * 0.025 - (this.flip >= 0 ? 0.8 : 0);
      const tz = clamp(sideVel * 0.06, -0.5, 0.5) - this.turnLean * 0.8 - L.yaw * 0.3;
      r.pony[0].rotation.x = this.ponyX.step(tx, dt);
      r.pony[0].rotation.z = this.ponyZ.step(tz, dt);
      r.pony[1].rotation.x = this.pony2.step((r.pony[0].rotation.x + 0.35) * 0.5, dt);
    }
    if (r.scarfTail) {
      const tx = -0.15 - clamp(fwdVel * 0.09, -0.3, 0.9) + vyN * 0.035;
      const tz = clamp(sideVel * 0.07, -0.6, 0.6) - this.turnLean;
      r.scarfTail[0].rotation.x = this.scarfX.step(tx, dt);
      r.scarfTail[0].rotation.z = this.scarfZ.step(tz, dt);
      r.scarfTail[1].rotation.x = this.scarf2.step((r.scarfTail[0].rotation.x + 0.15) * 0.6 + Math.sin(this.t * 9) * 0.05 * clamp(sp / 6, 0, 1), dt);
    }
    return ev;
  }
}

// ---------------------------------------------------------------------------------
// Animador de personajes del pueblo: respiran, cambian el peso, miran a Lía cuando está cerca,
// se giran hacia ella al hablar y gesticulan mientras hablan.

export class NpcAnimator {
  constructor(rig, baseYaw, opts = {}) {
    this.rig = rig; this.t = Math.random() * 10; this.yaw = baseYaw; this.baseYaw = baseYaw;
    this.talking = false; this.talkT = 0;
    this.look = { yaw: 0, pitch: 0 };
    this.blinkT = Math.random() * 3; this.blink = 0;
    this.style = opts.style || 'calm';     // 'calm' | 'lively'
    this._v = new THREE.Vector3();
  }
  update(dt, playerPos) {
    const r = this.rig;
    this.t += dt;
    const lively = this.style === 'lively' ? 1 : 0;
    const wp = r.root.position;
    const dx = playerPos.x - wp.x, dz = playerPos.z - wp.z, dist = Math.hypot(dx, dz);
    const toPlayer = Math.atan2(-dx, -dz);

    // girar el cuerpo hacia Lía al hablar; volver a su orientación después
    const wantYaw = this.talking ? toPlayer : this.baseYaw;
    this.yaw += angDiff(wantYaw, this.yaw) * damp(this.talking ? 6 : 1.5, dt);
    r.root.rotation.y = this.yaw;

    // mirar a Lía si está cerca
    let tyaw = 0, tpitch = 0;
    if (dist < 7) {
      tyaw = clamp(angDiff(toPlayer, this.yaw), -1.1, 1.1);
      if (Math.abs(angDiff(toPlayer, this.yaw)) > 2) tyaw = 0;
      tpitch = -0.08;
    }
    this.look.yaw += (tyaw - this.look.yaw) * damp(4, dt);
    this.look.pitch += (tpitch - this.look.pitch) * damp(4, dt);

    const br = Math.sin(this.t * 2), shift = Math.sin(this.t * 0.5);
    const set = (n, x, y, z) => { n.rotation.x += (x - n.rotation.x) * damp(10, dt); n.rotation.y += (y - n.rotation.y) * damp(10, dt); n.rotation.z += (z - n.rotation.z) * damp(10, dt); };

    let armLx = 0.05, armRx = 0.05, armLz = -0.08, armRz = 0.08, elbL = 0.15, elbR = 0.15, nod = 0, hop = 0;
    if (this.talking) {
      this.talkT += dt;
      const g = this.talkT;
      armRx = 0.5 + Math.sin(g * 3.1) * 0.35 + lively * 0.3; elbR = 1.0 + Math.sin(g * 4.3) * 0.4;
      armRz = 0.25 + Math.sin(g * 2.3) * 0.15;
      armLx = 0.15 + Math.max(0, Math.sin(g * 1.7 + 1)) * 0.5 * lively; elbL = 0.3 + lively * 0.6;
      nod = Math.sin(g * 5.5) * 0.06;
      hop = lively * Math.max(0, Math.sin(g * 6)) * 0.03;
    } else {
      this.talkT = 0;
      if (lively) { // inquieto: balancea los brazos
        armLx = Math.sin(this.t * 1.6) * 0.25; armRx = -Math.sin(this.t * 1.6) * 0.25;
      }
    }
    set(r.hips, 0, 0, shift * 0.04);
    set(r.torso, br * 0.025, 0, -shift * 0.03);
    set(r.neck, -br * 0.02, this.look.yaw * 0.3, 0);
    set(r.head, -this.look.pitch + nod, this.look.yaw * 0.7, Math.sin(this.t * 0.8) * 0.04);
    set(r.armL.shoulder, armLx, 0, armLz - br * 0.02);
    set(r.armR.shoulder, armRx, 0, armRz + br * 0.02);
    set(r.armL.elbow, elbL, 0, 0); set(r.armR.elbow, elbR, 0, 0);
    set(r.legL.knee, -(0.06 + Math.max(0, shift) * 0.14), 0, 0); set(r.legR.knee, -(0.06 + Math.max(0, -shift) * 0.14), 0, 0);
    set(r.legL.hip, 0.03 + Math.max(0, shift) * 0.07, 0, 0); set(r.legR.hip, 0.03 + Math.max(0, -shift) * 0.07, 0, 0);
    set(r.legL.ankle, 0.03 + Math.max(0, shift) * 0.07, 0, 0); set(r.legR.ankle, 0.03 + Math.max(0, -shift) * 0.07, 0, 0);
    r.body.position.y = r.HIP_H - 0.012 - Math.abs(shift) * 0.012 + hop;

    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 0.12; this.blinkT = 2.5 + Math.random() * 3; }
    r.eyeL.scale.y = r.eyeR.scale.y = this.blink > 0 ? 0.1 : 1;
    if (this.blink > 0) this.blink -= dt;
  }
}
