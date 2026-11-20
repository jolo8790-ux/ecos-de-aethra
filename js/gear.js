import * as THREE from 'three';

// Armería: armas y armaduras que se compran con Ecos (✧) y se ven sobre el personaje.
export const WEAPONS = [
  { id: 'baston', name: 'Bastón del abuelo', icon: '🪄', cost: 0, desc: 'El bastón de siempre, con un cristal en la punta.', mods: {} },
  { id: 'cristal', name: 'Espada de cristal', icon: '🗡', cost: 60, desc: '+1 de daño en cada golpe.', mods: { dmg: 1 } },
  { id: 'brasa', name: 'Espada de brasa', icon: '🔥', cost: 120, desc: '+1 de daño y los golpes queman al enemigo.', mods: { dmg: 1 }, fx: 'burn' },
  { id: 'escarcha', name: 'Espada de escarcha', icon: '❄', cost: 160, desc: '+1 de daño y a veces congela al enemigo.', mods: { dmg: 1 }, fx: 'freeze' },
  { id: 'eco', name: 'Hoja del Eco', icon: '✦', cost: 300, desc: '+2 de daño; el tercer golpe del combo suelta una onda de luz.', mods: { dmg: 2 }, fx: 'wave' },
];
export const ARMORS = [
  { id: 'tunica', name: 'Túnica de viaje', icon: '👕', cost: 0, desc: 'Ligera y cómoda. Sin protección extra.', mods: {} },
  { id: 'cuero', name: 'Peto de cuero', icon: '🛡', cost: 50, desc: '+1 corazón.', mods: { hp: 1 } },
  { id: 'coral', name: 'Armadura de coral', icon: '🐚', cost: 110, desc: '+1 corazón y aguantas más bajo el agua.', mods: { hp: 1, air: 1.3 } },
  { id: 'viento', name: 'Capa del viento', icon: '🪶', cost: 160, desc: '+1 corazón, planeas un 30 % más y corres un poco más rápido.', mods: { hp: 1, glide: 1.3, speed: 1.05 } },
  { id: 'obsidiana', name: 'Coraza de obsidiana', icon: '🌋', cost: 180, desc: '+2 corazones.', mods: { hp: 2 } },
  { id: 'aethra', name: 'Armadura de Aethra', icon: '👑', cost: 350, desc: '+3 corazones y un brillo dorado.', mods: { hp: 3 } },
];
export const weaponById = id => WEAPONS.find(w => w.id === id) || WEAPONS[0];
export const armorById = id => ARMORS.find(a => a.id === id) || ARMORS[0];

// cuánto da cada cosa
export const ECO_REWARD = { enemigo: 3, roto: 1, fragmento: 5, reliquia: 15, pieza: 25, chispa: 1, arena: 20, desafio: 10, jefe: 40 };

export function gearOf(sv) {
  sv.armeria = sv.armeria || { owned: ['baston', 'tunica'], arma: 'baston', armadura: 'tunica' };
  return sv.armeria;
}
// suma las ventajas del equipo a las del héroe (los multiplicadores se multiplican, el resto se suma)
export function mergeMods(base, sv) {
  const g = gearOf(sv), out = { ...base };
  for (const m of [weaponById(g.arma).mods, armorById(g.armadura).mods])
    for (const [k, v] of Object.entries(m)) {
      if (k === 'dmg' || k === 'hp') out[k] = (out[k] || 0) + v;
      else out[k] = (out[k] || 1) * v;
    }
  return out;
}

// ---------- modelos ----------
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...o });
export function buildWeapon(id) {
  if (id === 'baston' || !WEAPONS.some(w => w.id === id)) return null; // el bastón lo dibuja player.js
  const P = {
    cristal: { blade: std(0xbff4ff, { emissive: 0x3ab8e8, emissiveIntensity: 0.6, roughness: 0.15, flatShading: true, transparent: true, opacity: 0.92 }), guard: std(0xd4a24c, { metalness: 0.7, roughness: 0.3 }), gem: 0x7ae8ff, len: 0.78 },
    brasa: { blade: std(0x3a2a24, { emissive: 0xff5a1a, emissiveIntensity: 0.9, flatShading: true }), guard: std(0x2a2020, { metalness: 0.6 }), gem: 0xffa040, len: 0.82 },
    escarcha: { blade: std(0xe8fbff, { emissive: 0x9fdcff, emissiveIntensity: 0.5, roughness: 0.1, flatShading: true }), guard: std(0x8fb8d8, { metalness: 0.8, roughness: 0.25 }), gem: 0xcff6ff, len: 0.84 },
    eco: { blade: std(0xfff6d8, { emissive: 0xffd27a, emissiveIntensity: 1.1, roughness: 0.2, flatShading: true }), guard: std(0xf2c94c, { metalness: 0.8, roughness: 0.25 }), gem: 0xffffff, len: 0.95 },
  }[id];
  const g = new THREE.Group();
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 8), std(0x4a2c1a, { roughness: 0.9 })); grip.position.y = 0.02; g.add(grip);
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), P.guard); pommel.position.y = -0.11; g.add(pommel);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.07), P.guard); guard.position.y = 0.15; g.add(guard);
  for (const s of [-1, 1]) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.08, 6), P.guard); t.position.set(s * 0.17, 0.16, 0); t.rotation.z = -s * Math.PI / 2; g.add(t); }
  // hoja: un rombo alargado
  const shape = new THREE.Shape(); const w = 0.065, L = P.len;
  shape.moveTo(-w, 0); shape.lineTo(w, 0); shape.lineTo(w * 0.9, L * 0.8); shape.lineTo(0, L); shape.lineTo(-w * 0.9, L * 0.8); shape.closePath();
  const bg = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1 }); bg.translate(0, 0, -0.01);
  const blade = new THREE.Mesh(bg, P.blade); blade.position.y = 0.17; g.add(blade);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), new THREE.MeshBasicMaterial({ color: P.gem })); gem.position.set(0, 0.15, 0.045); g.add(gem);
  if (id === 'eco' || id === 'brasa') { // halo suave sobre la hoja
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.3, L + 0.15), new THREE.MeshBasicMaterial({ color: id === 'eco' ? 0xffe08a : 0xff7a2a, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    halo.position.y = 0.17 + L / 2; g.add(halo); const h2 = halo.clone(); h2.rotation.y = Math.PI / 2; g.add(h2);
    g.userData.halo = [halo, h2];
  }
  g.traverse(o => { if (o.isMesh && !o.material.blending) o.castShadow = true; });
  g.userData.gem = gem;
  return g;
}

// piezas de armadura: se colocan en el espacio del modelo (en reposo) y se cuelgan de sus huesos
export function buildArmor(id, model) {
  if (id === 'tunica' || !ARMORS.some(a => a.id === id)) return [];
  const C = {
    cuero: { main: std(0x8a5a32, { roughness: 0.85 }), trim: std(0x5a3a20, { roughness: 0.9 }), stud: std(0xc8a050, { metalness: 0.6, roughness: 0.4 }) },
    coral: { main: std(0xff8a7a, { roughness: 0.4 }), trim: std(0x3fb8c8, { roughness: 0.4 }), stud: std(0xfff0e0, { roughness: 0.3 }) },
    viento: { main: std(0xdff4f0, { roughness: 0.6 }), trim: std(0x4ab0a0, { roughness: 0.5 }), stud: std(0xffffff, { emissive: 0x9ff0e0, emissiveIntensity: 0.6 }) },
    obsidiana: { main: std(0x2a2430, { roughness: 0.25, metalness: 0.3, flatShading: true }), trim: std(0x5a2a2a, { roughness: 0.4 }), stud: std(0xff6a2a, { emissive: 0xff4a1a, emissiveIntensity: 1 }) },
    aethra: { main: std(0xf2f0e8, { metalness: 0.5, roughness: 0.25 }), trim: std(0xf2c94c, { metalness: 0.8, roughness: 0.25 }), stud: std(0x9ff0ff, { emissive: 0x4ad0ff, emissiveIntensity: 1.2 }) },
  }[id];
  const bone = n => { let b = null; model.traverse(o => { if (!b && o.isBone && o.name === n) b = o; }); return b; };
  // pose de reposo para medir
  const skinned = []; model.traverse(o => { if (o.isSkinnedMesh) skinned.push(o); });
  if (skinned[0]) skinned[0].skeleton.pose();
  model.updateMatrixWorld(true);
  const inv = model.matrixWorld.clone().invert();
  const at = b => b.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
  const parts = [];
  const K = model.userData.armorScale || 1; // cuerpos más finos (protagonista HD) llevan la armadura a su medida
  const put = (obj, b, p) => { if (!b) return; obj.scale.multiplyScalar(K); obj.position.copy(p); model.add(obj); model.updateMatrixWorld(true); b.attach(obj); parts.push(obj); obj.traverse(o => { if (o.isMesh) o.castShadow = true; }); };
  const chest = bone('chest'), hips = bone('hips'), la = bone('upperarml'), ra = bone('upperarmr');
  if (chest) {
    const c = at(chest), g = new THREE.Group();
    // peto: medio cilindro achatado delante del pecho y una placa en la espalda
    const front = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.33, 0.34, 20, 1, true, -Math.PI / 2, Math.PI), C.main);
    front.material = front.material.clone(); front.material.side = THREE.DoubleSide; front.scale.z = 0.9; g.add(front);
    const back = front.clone(); back.rotation.y = Math.PI; g.add(back);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.028, 6, 24), C.trim); rim.rotation.x = Math.PI / 2; rim.scale.y = 0.9; rim.position.y = 0.17; g.add(rim);
    const rim2 = rim.clone(); rim2.position.y = -0.17; rim2.scale.set(0.9, 0.81, 1); g.add(rim2);
    const emb = new THREE.Mesh(id === 'aethra' ? new THREE.OctahedronGeometry(0.06, 0) : new THREE.SphereGeometry(0.045, 10, 8), C.stud); emb.position.set(0, 0.03, 0.34); g.add(emb);
    if (id === 'obsidiana' || id === 'aethra') for (const s of [-1, 1]) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 5), C.stud); sp.position.set(s * 0.16, -0.06, 0.31); sp.rotation.x = Math.PI / 2; g.add(sp); }
    if (K !== 1) g.scale.set(1.3, 1.15, 1.45); // el pecho de la protagonista es más profundo que ancho
    put(g, chest, new THREE.Vector3(c.x, c.y + 0.02 * K, c.z + (K === 1 ? 0.01 : 0.02)));
    if ((id === 'viento' || id === 'aethra') && K === 1) { // capa (la protagonista HD ya lleva mochila en la espalda)
      const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62, 1, 4), new THREE.MeshStandardMaterial({ color: id === 'aethra' ? 0x2a5aa8 : 0x3fa898, side: THREE.DoubleSide, roughness: 0.8 }));
      const pa = cape.geometry.attributes.position; for (let i = 0; i < pa.count; i++) { const y = pa.getY(i); pa.setZ(i, -(0.3 - y) * (0.3 - y) * 0.5); pa.setX(i, pa.getX(i) * (1 + (0.3 - y) * 0.6)); }
      cape.geometry.computeVertexNormals();
      put(cape, chest, new THREE.Vector3(c.x, c.y - 0.14, c.z - 0.36));
    }
  }
  for (const [b, s] of [[la, 1], [ra, -1]]) {
    if (!b) continue;
    const p = at(b), sh = new THREE.Group();
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), C.main); cap.scale.set(1, 0.75, 1.1); sh.add(cap);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.022, 6, 18), C.trim); band.rotation.x = Math.PI / 2; sh.add(band);
    if (id === 'obsidiana' || id === 'aethra') { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 6), C.stud); sp.position.y = 0.12; sh.add(sp); }
    sh.rotation.z = -s * 0.35;
    if (K !== 1) sh.scale.setScalar(1.3);
    put(sh, b, new THREE.Vector3(p.x + s * 0.07 * K, p.y + 0.06 * K, p.z));
  }
  if (hips) {
    const h = at(hips), belt = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.04, 6, 24), C.trim); belt.rotation.x = Math.PI / 2; belt.scale.y = 0.85;
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.03), C.stud); buckle.position.set(0, 0.31, 0); buckle.rotation.x = -Math.PI / 2; belt.add(buckle);
    put(belt, hips, new THREE.Vector3(h.x, h.y + (K === 1 ? 0.14 : 0.03), h.z + 0.01 * K));
  }
  return parts;
}
