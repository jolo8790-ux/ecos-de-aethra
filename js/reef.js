import * as THREE from 'three';
import { prop, hasProp } from './props.js';
import { glowTex } from './vfx.js';

// Vida bajo el mar (versión HD, Profundidades de Mareth): arrecifes de coral, cardúmenes de peces que nadan juntos,
// tortugas y mantas que pasan, rayos de luz desde la superficie y columnas de burbujas.

const rnd = (a, b) => a + Math.random() * (b - a);

// ondulación del cuerpo de los peces (y aleteo de las mantas) en el sombreador, para que no se muevan rígidos
function wiggle(mat, axis = 'x', amp = 0.12, freq = 9, flap = false) {
  mat = mat.clone(); mat.userData.t = { value: 0 };
  mat.onBeforeCompile = sh => {
    sh.uniforms.uT = mat.userData.t;
    sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float ph = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.5;
      #else
        float ph = 0.0;
      #endif
      ${flap ? `float w = abs(transformed.x); transformed.y += sin(uT * ${freq.toFixed(1)} + ph) * ${amp.toFixed(3)} * w * w;`
             : `float bx = transformed.${axis}; transformed.z += sin(uT * ${freq.toFixed(1)} + bx * 6.0 + ph) * ${amp.toFixed(3)} * (0.4 - bx) ;`}`);
  };
  mat.customProgramCacheKey = () => 'wiggle' + axis + flap;
  return mat;
}
// toma la malla del modelo con su escala ya aplicada a la geometría
function bakedMesh(id, fit) {
  const g = prop(id, fit); if (!g) return null;
  g.updateMatrixWorld(true); let mesh = null;
  g.traverse(o => { if (!mesh && o.isMesh) mesh = o; });
  if (!mesh) return null;
  const geo = mesh.geometry.clone(); geo.applyMatrix4(mesh.matrixWorld);
  return { geo, mat: mesh.material };
}

export class Reef {
  constructor(root, scene, physics) {
    this.physics = physics;
    this.root = new THREE.Group(); root.add(this.root); this.scene = scene;
    this.t = 0; this.schools = []; this.swimmers = []; this.mats = [];
    this.build();
  }
  build() {
    // arrecifes: racimos de coral en los bordes de la llanura, alrededor de la ciudad hundida y por la Fosa
    if (hasProp('coral')) {
      const spots = [];
      for (let i = 0; i < 34; i++) { const side = Math.random() < 0.5 ? -1 : 1; spots.push([side * rnd(7, 33), -18, rnd(-66, -4)]); }
      for (let i = 0; i < 12; i++) { const side = Math.random() < 0.5 ? -1 : 1; spots.push([side * rnd(9, 33), -26, rnd(-95, -70)]); }
      for (let i = 0; i < 16; i++) { const side = Math.random() < 0.5 ? -1 : 1; spots.push([side * rnd(4.5, 9.5), -40, rnd(-222, -100)]); }
      for (let i = 0; i < 8; i++) { const side = Math.random() < 0.5 ? -1 : 1; spots.push([side * rnd(8, 19), -40, rnd(-252, -228)]); }
      for (const [x, y, z] of spots) {
        const c = prop('coral', { h: rnd(1.6, 4.6) }); if (!c) break;
        c.position.set(x, y - 0.15, z); c.rotation.y = rnd(0, 6.28); this.root.add(c);
        if (this.physics) { c.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(c), sz = b.getSize(new THREE.Vector3()), cc = b.getCenter(new THREE.Vector3()); this.physics.addBox(cc.x, b.min.y + sz.y * 0.42, cc.z, sz.x * 0.55, sz.y * 0.84, sz.z * 0.55); } // coral sólido
        c.traverse(o => { if (o.isMesh) { o.castShadow = false; } });
      }
    }
    // cardúmenes: decenas de peces que siguen a un guía por un recorrido suave
    const fish = hasProp('pez') && bakedMesh('pez', { w: 0.8 });
    if (fish) {
      const mat = wiggle(fish.mat, 'x', 0.16, 11); this.mats.push(mat);
      const paths = [
        { c: [0, -12, -30], r: [22, 3, 18], sp: 0.18, n: 36 },
        { c: [-14, -14, -45], r: [12, 2, 14], sp: -0.25, n: 24 },
        { c: [10, -20, -82], r: [18, 3, 9], sp: 0.2, n: 30 },
        { c: [0, -33, -150], r: [5, 3, 45], sp: 0.12, n: 28 },
        { c: [0, -35, -240], r: [14, 3, 10], sp: -0.22, n: 26 },
        { c: [6, -8, -15], r: [10, 2, 8], sp: 0.3, n: 18 },
      ];
      const tints = [0xffffff, 0xffd0a0, 0xa8e8ff, 0xffb0d8, 0xd0ffb0, 0xfff0a0];
      paths.forEach((P, k) => {
        const m = new THREE.InstancedMesh(fish.geo, mat, P.n); m.frustumCulled = false;
        const col = new THREE.Color();
        for (let i = 0; i < P.n; i++) m.setColorAt(i, col.set(tints[(k + (i % 3 === 0 ? 1 : 0)) % tints.length]));
        this.root.add(m);
        const off = []; for (let i = 0; i < P.n; i++) off.push(new THREE.Vector3(rnd(-1.6, 1.6), rnd(-0.9, 0.9), rnd(-1.6, 1.6)).multiplyScalar(1 + i / P.n));
        this.schools.push({ m, P, off, ph: rnd(0, 6.28), lag: off.map(() => rnd(0, 0.35)) });
      });
    }
    // tortugas y mantas que cruzan despacio
    for (const [id, n, h, fit] of [['tortuga', 3, 0, { w: 1.6 }], ['manta', 2, 0, { w: 3.4 }]]) {
      if (!hasProp(id)) continue;
      const B = bakedMesh(id, fit); if (!B) continue;
      const mat = id === 'manta' ? wiggle(B.mat, 'x', 0.11, 1.6, true) : B.mat; if (id === 'manta') this.mats.push(mat);
      for (let i = 0; i < n; i++) {
        const mesh = new THREE.Mesh(B.geo, mat); this.root.add(mesh);
        this.swimmers.push({ mesh, kind: id, c: new THREE.Vector3(rnd(-15, 15), rnd(-16, -8) - (i % 2) * 8, rnd(-90, -10)), r: rnd(9, 18), sp: rnd(0.05, 0.09) * (i % 2 ? -1 : 1), ph: rnd(0, 6.28) });
      }
    }
    // rayos de luz que bajan desde la superficie
    const rayMat = new THREE.MeshBasicMaterial({ map: rayTex(), color: 0xbff4ff, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
    this.rays = [];
    for (let i = 0; i < 14; i++) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(rnd(2, 5), 26), rayMat.clone());
      r.position.set(rnd(-30, 30), -6, rnd(-95, 0)); r.rotation.set(0, rnd(0, 3.14), rnd(-0.18, 0.18));
      this.root.add(r); this.rays.push({ r, ph: rnd(0, 6.28) });
    }
    // columnas de burbujas que salen del fondo
    this.vents = [];
    const bm = new THREE.SpriteMaterial({ map: glowTex(), color: 0xdff8ff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 9; i++) {
      const base = i < 5 ? new THREE.Vector3(rnd(-25, 25), -18, rnd(-65, -8)) : new THREE.Vector3(rnd(-8, 8), -40, rnd(-220, -110));
      const bubbles = [];
      for (let k = 0; k < 10; k++) { const s = new THREE.Sprite(bm); s.scale.setScalar(rnd(0.08, 0.22)); this.root.add(s); bubbles.push({ s, y: rnd(0, 12), sp: rnd(1.2, 2.4), wob: rnd(0, 6.28) }); }
      this.vents.push({ base, bubbles });
    }
  }
  update(dt) {
    this.t += dt; const t = this.t;
    for (const m of this.mats) m.userData.t.value = t;
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
    const lead = (P, a, out) => out.set(P.c[0] + Math.cos(a) * P.r[0], P.c[1] + Math.sin(a * 2) * P.r[1], P.c[2] + Math.sin(a) * P.r[2]);
    const p = new THREE.Vector3(), q = new THREE.Vector3(), dir = new THREE.Vector3(), mtx = new THREE.Matrix4();
    for (const Sc of this.schools) {
      const { P, m, off } = Sc;
      for (let i = 0; i < P.n; i++) {
        const a = Sc.ph + t * P.sp - Sc.lag[i] * Math.sign(P.sp);
        lead(P, a, p); lead(P, a + 0.02 * Math.sign(P.sp), q);
        const wob = Math.sin(t * 1.3 + i) * 0.25;
        p.add(off[i]).addScalar(wob * 0.3); q.add(off[i]).addScalar(wob * 0.3);
        dir.subVectors(q, p).normalize();
        mtx.lookAt(new THREE.Vector3(), dir, up); // -z mira hacia donde nada
        Q.setFromRotationMatrix(mtx).multiply(new THREE.Quaternion().setFromAxisAngle(up, Math.PI / 2)); // el pez tiene la cabeza hacia +x
        M.compose(p, Q, S); m.setMatrixAt(i, M);
      }
      m.instanceMatrix.needsUpdate = true;
    }
    for (const W of this.swimmers) {
      const a = W.ph + t * W.sp;
      const x = W.c.x + Math.cos(a) * W.r, z = W.c.z + Math.sin(a) * W.r, y = W.c.y + Math.sin(a * 3) * 0.8;
      const nx = W.c.x + Math.cos(a + 0.05 * Math.sign(W.sp)) * W.r, nz = W.c.z + Math.sin(a + 0.05 * Math.sign(W.sp)) * W.r;
      W.mesh.position.set(x, y, z);
      W.mesh.rotation.set(W.kind === 'tortuga' ? Math.sin(t * 1.2 + W.ph) * 0.08 : 0, Math.atan2(nx - x, nz - z), Math.sin(t * 0.8 + W.ph) * 0.12);
      if (W.kind === 'tortuga') W.mesh.position.y += Math.sin(t * 1.6 + W.ph) * 0.15;
    }
    for (const R of this.rays) R.r.material.opacity = 0.12 + Math.sin(t * 0.6 + R.ph) * 0.08;
    for (const V of this.vents) for (const B of V.bubbles) {
      B.y += B.sp * dt; if (B.y > 14) B.y = 0;
      B.s.position.set(V.base.x + Math.sin(t * 3 + B.wob) * 0.25, V.base.y + B.y, V.base.z + Math.cos(t * 2.5 + B.wob) * 0.25);
    }
  }
  dispose() { this.root.parent && this.root.parent.remove(this.root); }
}

function rayTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
  const v = g.createLinearGradient(0, 0, 0, 256); v.addColorStop(0, 'rgba(255,255,255,0.9)'); v.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = v; g.fillRect(0, 0, 64, 256);
  g.globalCompositeOperation = 'destination-in';
  const h = g.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, 'rgba(0,0,0,0)'); h.addColorStop(0.5, 'rgba(0,0,0,1)'); h.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = h; g.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c); return t;
}
