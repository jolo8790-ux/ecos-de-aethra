// Carga de modelos .glb.js sin retener el texto en memoria (un import() deja el módulo, y su texto
// base64 de varios MB, vivo para siempre). Con fetch el texto se libera al terminar de decodificar.
// En teléfonos y equipos con poca memoria, además, las texturas de los modelos se reducen.
export const LOW_MEM = (() => {
  try { return matchMedia('(pointer: coarse)').matches || (navigator.deviceMemory && navigator.deviceMemory <= 4) || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent); } catch (e) { return false; }
})();

export async function glbBuffer(url) {
  const txt = await (await fetch(url)).text();
  const bin = atob(txt.slice(txt.indexOf('"') + 1, txt.lastIndexOf('"')));
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u.buffer;
}

const SLOTS = ['map', 'normalMap', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'aoMap'];
export function shrinkTextures(root, max) {
  const done = new Set();
  root.traverse(o => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) for (const k of SLOTS) {
      const t = m && m[k], img = t && t.image; if (!img || done.has(t)) continue; done.add(t);
      const w = img.width, h = img.height; if (!w || Math.max(w, h) <= max) continue;
      const s = max / Math.max(w, h), c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      if (img.close) img.close();
      t.image = c; t.needsUpdate = true;
    }
  });
}
