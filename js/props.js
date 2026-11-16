import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Modelos 3D generados (Hunyuan3D 2.1, ver tools/gen3d). Cada uno vive en assets/props/<id>.glb.js.
// Si un modelo falta o no carga, el juego usa la pieza hecha con primitivas de siempre.

const BASE = '../assets/props/';
const cache = {};
let list = [];

export async function loadProps(onProgress) {
  try { list = (await import(BASE + 'index.js')).default; } catch (e) { list = []; return; }
  const loader = new GLTFLoader();
  let done = 0;
  await Promise.all(list.map(async id => {
    try {
      const mod = await import(`${BASE}${id}.glb.js`);
      const bin = Uint8Array.from(atob(mod.default), ch => ch.charCodeAt(0));
      const g = await loader.parseAsync(bin.buffer, '');
      prepare(g.scene);
      cache[id] = g.scene;
    } catch (e) { console.warn('prop', id, e); }
    done++; onProgress && onProgress(done / list.length);
  }));
}

function prepare(root) {
  root.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    const m = o.material;
    if (m) { m.metalness = 0; m.roughness = Math.max(0.75, m.roughness ?? 0.85); if (m.map) m.map.anisotropy = 4; }
  });
  // base en y=0 y centrado en x/z
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const c = box.getCenter(new THREE.Vector3());
  const inner = new THREE.Group();
  while (root.children.length) inner.add(root.children[0]);
  inner.position.set(-c.x, -box.min.y, -c.z);
  root.add(inner);
  root.userData.size = box.getSize(new THREE.Vector3());
}

export const hasProp = id => !!cache[id];

// Devuelve una copia del modelo encajada en el tamaño pedido.
//  fit: { h } altura · { w } ancho máximo en x/z · { x, y, z } caja (escala no uniforme)
//  rotY: giro para que el frente del modelo mire a +z
export function prop(id, fit = {}, { rotY = 0, tint } = {}) {
  const src = cache[id];
  if (!src) return null;
  const o = src.clone(true);
  const s = src.userData.size;
  const g = new THREE.Group();
  const holder = new THREE.Group(); holder.rotation.y = rotY; holder.add(o); g.add(holder);
  if (fit.x || fit.z) {
    const sx = fit.x ? fit.x / s.x : null, sz = fit.z ? fit.z / s.z : null, sy = fit.y ? fit.y / s.y : null;
    const u = sx || sz || sy;
    o.scale.set(sx || u, sy || u, sz || u);
  } else if (fit.h) o.scale.setScalar(fit.h / s.y);
  else if (fit.w) o.scale.setScalar(fit.w / Math.max(s.x, s.z));
  if (tint) o.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.color.multiply(new THREE.Color(tint)); } });
  return g;
}

// Recorta partes del modelo (p. ej. los brazos del Coloso o la cola del escorpión, que el juego anima aparte).
// rules: [{ axis: 'x'|'y'|'z', keep: [desde, hasta] }] en fracciones de la caja del modelo (0 = mínimo, 1 = máximo).
// Se descarta un píxel si queda fuera de alguna regla; con 'or', se conserva si cumple cualquiera de las alternativas.
export function clipModel(root, rules) {
  root.traverse(o => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox;
    const conds = rules.map(r => {
      const alts = r.or || [r];
      return '(' + alts.map(a => {
        const lo = b.min[a.axis] + (b.max[a.axis] - b.min[a.axis]) * a.keep[0];
        const hi = b.min[a.axis] + (b.max[a.axis] - b.min[a.axis]) * a.keep[1];
        return `(vObjPos.${a.axis} >= ${lo.toFixed(4)} && vObjPos.${a.axis} <= ${hi.toFixed(4)})`;
      }).join(' || ') + ')';
    });
    const key = 'clip' + conds.join('&');
    const m = o.material = o.material.clone();
    m.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;')
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\nif (!(${conds.join(' && ')})) discard;`);
    };
    m.customProgramCacheKey = () => key;
    m.side = THREE.DoubleSide; // el interior se ve por el corte
    o.castShadow = false; // la sombra no respeta el corte
  });
  return root;
}
