// Desafíos: Cristales del Cielo.
// El primer prototipo del proyecto ("Cristales del Cielo") convertido en un modo contrarreloj dentro de Ecos de Aethra:
// recoge todos los cristales, cruza el portal y bate tu mejor tiempo. Los tres primeros niveles son los del prototipo;
// los dos últimos usan el planeador y el garfio.

// Plataforma del prototipo: [x, alto, z, ancho, fondo, movimiento?]
function level({ id, name, sky, fog, plats, gems, enemies = [], air = [], portal, medals, abilities = {}, hidden, extra = {} }) {
  const islands = [...(extra.islands || [])], movers = [], fragments = [], foes = [], crumbles = [];
  plats.forEach(([x, top, z, w, d, mv]) => {
    if (mv && mv.c) crumbles.push({ x, y: top, z, w, d }); // roca que se desploma
    else if (mv) movers.push({ x, y: top, z, w, d, h: 0.8, axis: mv.ax, range: mv.r, speed: mv.s, color: 0x8a7ad8 });
    else islands.push({ x, z, w, d, top, depth: Math.min(w, d) > 5 ? 3 : 2 });
  });
  gems.forEach(([x, y, z], i) => fragments.push({ id: `${id}_g${i}`, x, y: y - 1, z }));
  enemies.forEach(([i, type = 'brote']) => { const [x, top, z, , , mv] = plats[i]; if (!mv) foes.push({ type, x, y: top, z }); });
  air.forEach(([x, y, z, r = 3, axis]) => foes.push({ type: 'avispa', x, y, z, r, axis })); // avispas de cristal
  return {
    id, title: name, subtitle: 'Desafío · Cristales del Cielo', challenge: true, seed: id.length * 7 + gems.length,
    sky: { top: sky, bottom: fog, fog, fogNear: 45, fogFar: 170 },
    light: extra.light || {},
    palette: extra.palette || { top: 0x7ccf6a, side: 0x8a6a4a },
    water: { y: -14, color: fog },
    start: { id: 'inicio', pos: [plats[0][0], plats[0][1], plats[0][2] + 2], facing: 0 },
    islands, movers, crumbles, fragments, enemies: foes,
    portal: { x: portal[0], y: portal[1], z: portal[2] },
    medals, abilities,
    breakables: hidden ? [{ id: `${id}_reloj`, kind: 'cofre', x: hidden[0], y: hidden[1], z: hidden[2], loot: 'reloj' }, ...(extra.pots || [])] : [],
    ...extra.more,
  };
}

export const DESAFIOS = [
  level({
    id: 'desafio_1', hidden: [2.2, 0, -14.2], name: 'Las Islas Tranquilas', sky: 0x87ceeb, fog: 0xbfe6ff,
    plats: [[0, 0, 0, 10, 10], [0, 0, -12, 6, 6], [0, 1.5, -20, 5, 5], [6, 3, -26, 5, 5], [14, 3, -26, 6, 4], [14, 4.5, -34, 7, 7], [14, 4.5, -45, 9, 9]],
    gems: [[0, 1, -12], [0, 2.5, -20], [6, 4, -26], [15, 4, -26], [12, 5.5, -34]],
    enemies: [[5]], portal: [14, 4.5, -48], medals: [25, 40, 70],
    extra: { more: { trees: [{ x: -3, z: 2 }, { x: 16, z: -46, s: 1.2 }], rocks: [{ x: 3, z: -3 }] } },
  }),
  level({
    id: 'desafio_2', hidden: [-8.2, 3, -35.2], name: 'Plataformas Errantes', sky: 0xf7b58a, fog: 0xffd9bf,
    plats: [[0, 0, 0, 8, 8], [0, 0, -10, 4, 4, { ax: 'x', r: 4, s: 1.1 }], [0, 1, -18, 4, 4], [-6, 2, -24, 4, 4, { ax: 'z', r: 2.5, s: 1.3 }], [-6, 3, -33, 6, 6], [2, 4, -38, 3, 3], [9, 5, -38, 4, 4, { ax: 'y', r: 1.5, s: 1.2 }], [18, 6, -38, 9, 9]],
    gems: [[0, 1, -10], [0, 2, -18], [-6, 3, -24], [-7, 4, -33], [2, 5, -38], [9, 6.5, -38]],
    enemies: [[4], [7]], portal: [21, 6, -38], medals: [30, 50, 85],
    extra: { light: { hemiSky: 0xffe2c0, sun: 0xffd09a }, palette: { top: 0xe8c890, side: 0xb8885a }, more: { crystals: [{ x: -8, z: -35, y: 3, s: 0.8, color: 0xffc86a }] } },
  }),
  level({
    id: 'desafio_3', hidden: [-6.6, 7, -50.6], name: 'La Cumbre de Cristal', sky: 0x2b2d5c, fog: 0x4a3f7a,
    plats: [[0, 0, 0, 8, 8], [0, 1, -8.5, 3, 3], [5, 2, -13, 3, 3], [10, 3, -19, 3, 3, { ax: 'x', r: 3, s: 1.4 }], [10, 4, -28, 6, 6], [3, 5, -33, 2.5, 2.5], [-4, 6, -38, 3, 3, { ax: 'z', r: 3, s: 1.2 }], [-4, 7, -48, 7, 7], [4, 8, -54, 3, 3, { ax: 'y', r: 2, s: 1.3 }], [13, 9.5, -58, 10, 10]],
    gems: [[0, 2, -8.5], [5, 3, -13], [10, 4.5, -19], [11, 5, -28], [3, 6, -33], [-4, 7.5, -38], [-5, 8, -48], [4, 9.5, -54]],
    enemies: [[4], [7], [9, 'espora']], portal: [15, 9.5, -61], medals: [40, 65, 110],
    extra: { light: { hemiSky: 0xb8b0ff, hemiGround: 0x3a2a5a, sun: 0xd8c8ff }, palette: { top: 0x8a7ac8, side: 0x4a3a6a }, more: { crystals: [{ x: 2, z: 2, s: 1.2, color: 0xc8a8ff }, { x: 16, z: -55, y: 9.5, s: 1.3, color: 0xc8a8ff }] } },
  }),
  level({
    id: 'desafio_4', hidden: [12.2, 7, -43.2], name: 'Corrientes del Desierto', sky: 0xd06a4a, fog: 0xffd8a0,
    abilities: { planeador: true },
    plats: [[0, 0, 0, 10, 10], [0, -1, -17, 6, 6], [8, -3, -29, 6, 6], [10, 7, -41, 6, 6], [0, 5, -54, 5, 5], [-3, 2, -68, 7, 7], [4, 12, -78, 8, 8]],
    gems: [[0, 3, -10], [0, 0, -17], [8, 3, -29], [8, 8, -29], [10, 8, -41], [0, 6, -54], [-3, 3, -68], [0, 17, -73]],
    enemies: [[2], [5]], air: [[8, 6, -29, 3.2], [5, 8, -48, 3, 'x'], [-3, 11, -68, 3.2]], portal: [4, 12, -81], medals: [45, 70, 120],
    extra: {
      light: { hemiSky: 0xffe2c0, hemiGround: 0x7a5a3a, sun: 0xffd09a }, palette: { top: 0xe8c890, side: 0xb8885a },
      more: {
        updrafts: [{ x: 8, z: -29, y0: -3, y1: 14, r: 2.2 }, { x: -3, z: -68, y0: 2, y1: 19, r: 2.4 }],
        columns: [{ x: -3, z: 3, h: 3 }, { x: 12, z: -39, y: 7, h: 2.5, broken: true }],
        signs: [{ id: 'nota_d4', x: 3, z: 3, rot: -0.4, title: 'Desafío', lines: ['Salta y mantén pulsado el salto para planear. Las corrientes de aire te suben.'] }],
      },
    },
  }),
  level({
    id: 'desafio_5', hidden: [15.8, 8, -47.8], name: 'Engranajes del Cielo', sky: 0x3a4a6a, fog: 0xa8b0c0,
    abilities: { planeador: true, garfio: true },
    plats: [[0, 0, 0, 10, 10], [0, 2, -24, 6, 6], [0, 2, -34, 4, 4, { ax: 'x', r: 5, s: 0.9 }], [0, 3, -46, 6, 6], [14, 8, -46, 5, 5], [14, 8, -60, 4, 4, { ax: 'y', r: 3, s: 0.8 }], [14, 10, -74, 7, 7], [0, 16, -86, 9, 9]],
    gems: [[0, 8, -13], [0, 3, -24], [0, 3, -34], [0, 4, -46], [14, 9, -46], [14, 12, -60], [14, 11, -74], [6, 19, -81]],
    enemies: [[3], [6, 'espora'], [7]], air: [[0, 6, -18, 3, 'x'], [7, 14, -82, 2.5, 'x']], portal: [0, 16, -89], medals: [50, 80, 130],
    extra: {
      light: { hemiSky: 0xd8e0f0, hemiGround: 0x4a4a5a, sun: 0xfff0d0 }, palette: { top: 0x9aa4b0, side: 0x5a5a6a },
      more: {
        grapples: [{ x: 0, y: 8, z: -12 }, { x: 7, y: 12, z: -46 }, { x: 7, y: 19, z: -80 }],
        signs: [{ id: 'nota_d5', x: 3, z: 3, rot: -0.4, title: 'Desafío', lines: ['Apunta a los anillos dorados y lanza el garfio (G o clic central).'] }],
      },
    },
  }),
  level({
    id: 'desafio_6', hidden: [5.2, 5, -43.2], name: 'El Puente que Cae', sky: 0x3a1a3a, fog: 0xff9a6a,
    plats: [[0, 0, 0, 10, 10], [0, 0, -6.4, 2.6, 2.6, { c: 1 }], [0, 0, -9.3, 2.6, 2.6, { c: 1 }], [2.9, 0, -9.3, 2.6, 2.6, { c: 1 }], [2.9, 0, -12.2, 2.6, 2.6, { c: 1 }], [2.9, 0, -15.1, 2.6, 2.6, { c: 1 }],
      [3, 1, -20, 4, 4], [0, 2, -24.5, 2.6, 2.6, { c: 1 }], [-3, 3, -28, 2.6, 2.6, { c: 1 }], [0, 4, -31.5, 2.6, 2.6, { c: 1 }], [3, 5, -35, 2.6, 2.6, { c: 1 }],
      [3, 5, -41, 6, 6], [3, 5, -50, 4, 4], [-4, 6, -55, 4, 4], [-4, 6, -59.4, 2.6, 2.6, { c: 1 }], [-4, 6, -62.3, 2.6, 2.6, { c: 1 }], [-1.1, 6, -62.3, 2.6, 2.6, { c: 1 }], [1.8, 6, -62.3, 2.6, 2.6, { c: 1 }], [7, 7, -62, 6, 6]],
    gems: [[2.9, 1, -9.3], [3, 2, -20], [0, 5, -31.5], [3, 7.5, -45.5], [-4, 7, -55], [-1.1, 7, -62.3]],
    enemies: [[11]], portal: [8.5, 7, -63.5], medals: [35, 55, 90],
    extra: {
      light: { hemiSky: 0xffb890, hemiGround: 0x4a1a2a, sun: 0xffa070 }, palette: { top: 0x6a4a50, side: 0x3a2228 },
      more: {
        lava: { y: -9 }, embers: { n: 140, area: 70, y0: -8, y1: 16, cx: 0, cz: -32 },
        fireJets: [{ pillar: 12, x: 3, y: 1, z: -45.5, h: 8, period: 2.8, on: 1, phase: 0 }, { pillar: 12, x: -0.5, y: 2, z: -52.5, h: 8, period: 2.8, on: 1, phase: 1.4 }],
        signs: [{ id: 'nota_d6', x: 3, z: 3, rot: -0.4, title: 'Desafío', lines: ['Las rocas rojas se desploman un momento después de pisarlas. ¡No te pares!'] }],
      },
    },
  }),
  level({
    id: 'desafio_7', hidden: [5, 3, -60], name: 'Fuego y Mazas', sky: 0x2a0a0a, fog: 0xc8502a,
    abilities: { planeador: true },
    plats: [[0, 0, 0, 10, 10], [0, 0, -29, 6, 6], [0, 1, -37.5, 3.4, 3.4], [3, 2, -44, 3.4, 3.4], [3, 2, -47.3, 2.6, 2.6, { c: 1 }], [3, 2, -50.2, 2.6, 2.6, { c: 1 }], [3, 2, -53.1, 2.6, 2.6, { c: 1 }], [3, 3, -58, 5, 5], [-6, 12, -66, 6, 6]],
    gems: [[0, 1, -12.5], [0, 1, -17.5], [0, 3.5, -34], [3, 3, -44], [3, 3, -50.2], [3, 10, -58], [-6, 13, -66]],
    enemies: [[1]], air: [[-1, 13, -62, 2.5]], portal: [-6, 12, -68], medals: [45, 70, 120],
    extra: {
      light: { hemiSky: 0xffa070, hemiGround: 0x3a0a08, sun: 0xff9050 }, palette: { top: 0x5a3a36, side: 0x2a1614 },
      more: {
        lava: { y: -8 }, embers: { n: 140, area: 70, y0: -7, y1: 18, cx: 0, cz: -34 },
        bridges: [{ x1: 0, z1: -5, x2: 0, z2: -26, y: 0, w: 2.4 }],
        pendulums: [{ x: 0, y: 6.2, z: -10, len: 5, axis: 'x', amp: 0.75, speed: 2, phase: 0, post: 14.2 }, { x: 0, y: 6.2, z: -15, len: 5, axis: 'x', amp: 0.75, speed: 2, phase: 1.7, post: 14.2 }, { x: 0, y: 6.2, z: -20, len: 5, axis: 'x', amp: 0.75, speed: 2.3, phase: 3.2, post: 14.2 },
          { x: 3, y: 8.2, z: -50.2, len: 5.4, axis: 'x', amp: 0.7, speed: 1.7, phase: 0, post: 16 }],
        fireJets: [{ pillar: 8, x: 0, y: -3, z: -34, h: 8, period: 2.6, on: 1, phase: 0 }, { pillar: 8, x: 1.5, y: -2, z: -40.75, h: 8, period: 2.6, on: 1, phase: 1.3 }, { x: -3, y: 0, z: -30, h: 4, period: 3, on: 1.1, phase: 0.5 }, { x: 3, y: 0, z: -28, h: 4, period: 3, on: 1.1, phase: 2 }],
        updrafts: [{ x: 3, z: -58, y0: 3, y1: 18, r: 2, color: 0xffa050 }],
        signs: [{ id: 'nota_d7', x: 3, z: 3, rot: -0.4, title: 'Desafío', lines: ['Mira el ritmo de las mazas y del fuego. Corre cuando te dejen pasar.'] }],
      },
    },
  }),
];

// Medallas: [oro, plata, bronce] en segundos
export function medalFor(L, t) {
  const [o, p, b] = L.medals;
  return t <= o ? 'oro' : t <= p ? 'plata' : t <= b ? 'bronce' : null;
}

// ---------- Desafíos que no se acaban ----------
// Después de los 7 hechos a mano, cada desafío nuevo se construye a partir de su número (siempre igual para el
// mismo número): más largo y más difícil cuanto más avanzas, con paisajes, nombres y trampas que van cambiando.
const TEMAS = [
  { sky: 0x87ceeb, fog: 0xbfe6ff, palette: { top: 0x7ccf6a, side: 0x8a6a4a }, light: {}, deco: 'trees' },
  { sky: 0xf7b58a, fog: 0xffd9bf, palette: { top: 0xe8c890, side: 0xb8885a }, light: { hemiSky: 0xffe2c0, sun: 0xffd09a }, deco: 'crystals', crystal: 0xffc86a },
  { sky: 0x2b2d5c, fog: 0x4a3f7a, palette: { top: 0x8a7ac8, side: 0x4a3a6a }, light: { hemiSky: 0xb8b0ff, hemiGround: 0x3a2a5a, sun: 0xd8c8ff }, deco: 'crystals', crystal: 0xc8a8ff },
  { sky: 0x7aa8d8, fog: 0xe8f4ff, palette: { top: 0xeef6ff, side: 0x8aa6c8 }, light: { hemiSky: 0xe8f4ff, sun: 0xffffff }, deco: 'pines' },
  { sky: 0x2a0a0a, fog: 0xc8502a, palette: { top: 0x5a3a36, side: 0x2a1614 }, light: { hemiSky: 0xffa070, hemiGround: 0x3a0a08, sun: 0xff9050 }, deco: 'rocks', lava: true },
  { sky: 0x3a4a6a, fog: 0xa8b0c0, palette: { top: 0x9aa4b0, side: 0x5a5a6a }, light: { hemiSky: 0xd8e0f0, hemiGround: 0x4a4a5a, sun: 0xfff0d0 }, deco: 'rocks' },
  { sky: 0x1a3a4a, fog: 0x6ad8c8, palette: { top: 0x6ac8a8, side: 0x2a5a6a }, light: { hemiSky: 0xb8fff0, hemiGround: 0x1a3a3a, sun: 0xd8fff0 }, deco: 'crystals', crystal: 0x6affd8 },
];
const NOMBRE_A = ['Islas', 'Puentes', 'Torres', 'Cumbres', 'Corrientes', 'Senda', 'Escalera', 'Jardines', 'Ruinas', 'Abismo', 'Vuelo', 'Laberinto'];
const NOMBRE_B = ['de Bruma', 'del Ocaso', 'de las Nubes', 'de Ámbar', 'de Escarcha', 'del Trueno', 'de Ceniza', 'de Coral', 'de la Aurora', 'del Alba', 'de Cristal', 'del Viento', 'del Eco', 'de Fuego'];
function seeded(seed) { let s = (seed * 9301 + 49297) % 233280 || 1; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }
function genDesafio(n) {
  const R = seeded(n * 7919 + 13), T = TEMAS[(n - 8) % TEMAS.length];
  const d = Math.min(1, (n - 8) / 40); // dificultad 0..1
  const garfio = n % 4 === 0, segs = Math.min(14, 6 + Math.floor((n - 8) / 3));
  const plats = [[0, 0, 0, 10, 10]], gems = [], enemies = [], air = [], more = { updrafts: [], grapples: [], pendulums: [], fireJets: [], bridges: [], trees: [], crystals: [], pines: [], rocks: [] };
  let x = 0, y = 0, z = -5, run = 0; // borde delantero de la última plataforma
  const add = (w, dd, gap, dy = 0, dx = 0, mv) => { z -= gap + dd / 2; x += dx; y += dy; plats.push([x, y, z, w, dd, mv]); run += gap + dd; const P = { x, y, z, w, d: dd, i: plats.length - 1 }; z -= dd / 2; return P; };
  const gem = (P, up = 1) => gems.push([P.x, P.y + up, P.z]);
  const gap = () => 2 + R() * (1.1 + d * 1.0);
  const kinds = ['stones', 'mover', 'crumble', 'updraft', 'stairs', 'pendulum', 'jets', 'lift', 'stones'];
  if (garfio) kinds.push('grapple', 'grapple');
  for (let s = 0; s < segs; s++) {
    const k = s === 0 ? 'stones' : kinds[Math.floor(R() * kinds.length)]; // se empieza siempre con islas firmes
    if (k === 'stones') { const m = 3 + Math.floor(R() * 2); for (let i = 0; i < m; i++) { const w = 3.2 + R() * 1.6 - d * 0.6; const P = add(w, w, gap(), Math.round((R() - 0.4) * 2) * 0.5, (R() - 0.5) * 1.6); if (i === m - 1) gem(P); } }
    if (k === 'stairs') { for (let i = 0; i < 3; i++) { const P = add(3, 3, 1.4 + R() * 0.6, 1.1); if (i === 2) gem(P); } add(5, 5, 2); }
    if (k === 'mover') { const sp = 0.9 + d * 0.6; const P = add(4, 4, 2.5, 0, 0, { ax: 'x', r: 2.5 + R() * 2, s: sp }); gem(P); add(5, 5, 2.6); }
    if (k === 'lift') { const P = add(4, 4, 2.4, 0, 0, { ax: 'y', r: 1.6, s: 1.1 }); gem(P, 2.6); add(5, 5, 2.4, 3); }
    if (k === 'crumble') { const m = 3 + Math.floor(R() * 2 + d * 2); for (let i = 0; i < m; i++) { const P = add(2.6, 2.6, 0.3 + R() * 0.4 + d * 0.5, 0, (i % 2 ? 1 : -1) * R() * 0.8, { c: 1 }); if (i === 1) gem(P); } add(5, 5, 2.2); }
    if (k === 'updraft') { // sube con la corriente y planea hasta una isla alta y lejana
      const B = add(6, 6, gap()); more.updrafts.push({ x: B.x, z: B.z, y0: B.y, y1: B.y + 12, r: 2.2 }); gem(B, 6);
      const P = add(6, 6, 9 + R() * 4 + d * 3, 4 + R() * 3); gem(P); if (R() < 0.5) air.push([P.x - 2, P.y + 3, P.z + 6, 2.5, 'x']);
    }
    if (k === 'grapple') { const B = add(5, 5, gap()); const g = 11 + R() * 2; more.grapples.push({ x: B.x, y: B.y + 6, z: B.z - 2.5 - g / 2 }); const P = add(5, 5, g, R() * 1.5); gem(P); }
    if (k === 'pendulum') { // puente estrecho con mazas
      const B = add(5, 5, gap()); const L = 12 + Math.floor(d * 6); const z1 = z, z2 = z - L; more.bridges.push({ x1: B.x, z1, x2: B.x, z2, y: B.y, w: 2.4 });
      const np = 2 + Math.floor(d * 2); for (let i = 0; i < np; i++) more.pendulums.push({ x: B.x, y: B.y + 6.2, z: z1 - (i + 1) * L / (np + 1), len: 5, axis: 'x', amp: 0.75, speed: 1.8 + d * 0.8 + R() * 0.3, phase: R() * 6, post: 14.2 });
      gems.push([B.x, B.y + 1, z1 - L / 2]); z = z2; run += L; const P = add(5, 5, 0.01); void P;
    }
    if (k === 'jets') { const P = add(6, 9, gap()); more.fireJets.push({ x: P.x - 1.2, y: P.y, z: P.z + 2, h: 4, period: 2.8 - d * 0.6, on: 1.1, phase: R() * 3 }, { x: P.x + 1.2, y: P.y, z: P.z - 2, h: 4, period: 2.8 - d * 0.6, on: 1.1, phase: R() * 3 }); gem(P); }
    // islas anchas con un enemigo de vez en cuando
    if (R() < 0.35 + d * 0.3) { const P = add(7, 7, gap()); enemies.push([P.i, R() < 0.3 ? 'espora' : 'brote']); if (R() < 0.5) gem(P); }
    // decoración en la isla actual
    const last = plats[plats.length - 1];
    if (!last[5] && R() < 0.6) { const dx = last[0] + (R() - 0.5) * (last[3] - 1.5), dz = last[2] + (R() - 0.5) * (last[4] - 1.5); if (T.deco === 'trees') more.trees.push({ x: dx, z: dz, y: last[1], s: 0.8 }); else if (T.deco === 'pines') more.pines.push({ x: dx, z: dz, y: last[1], s: 0.8 }); else if (T.deco === 'crystals') more.crystals.push({ x: dx, z: dz, y: last[1], s: 0.7, color: T.crystal }); else more.rocks.push({ x: dx, z: dz, y: last[1], s: 0.7 }); }
  }
  const end = add(9, 9, gap()); // meta
  while (gems.length < 5) { const p = plats[1 + Math.floor(R() * (plats.length - 2))]; if (!p[5] || !p[5].c) gems.push([p[0], p[1] + 1, p[2]]); }
  const gold = Math.round(run / 5.6 + segs * 1.6 + gems.length * 0.8);
  const ret = level({
    id: `desafio_${n}`, name: `${NOMBRE_A[Math.floor(R() * NOMBRE_A.length)]} ${NOMBRE_B[Math.floor(R() * NOMBRE_B.length)]}`, sky: T.sky, fog: T.fog,
    abilities: garfio ? { planeador: true, garfio: true } : { planeador: true },
    plats, gems: gems.slice(0, 10), enemies, air, portal: [end.x, end.y, end.z - 3], medals: [gold, Math.round(gold * 1.55), Math.round(gold * 2.6)],
    hidden: [plats[0][0] + 3.6, 0, plats[0][2] - 3.6],
    extra: { light: T.light, palette: T.palette, more: { ...more, ...(T.lava ? { lava: { y: Math.min(...plats.map(p => p[1])) - 8 }, embers: { n: 120, area: 80, y0: -7, y1: 18, cx: 0, cz: z / 2 } } : {}) } },
  });
  ret.generated = true; ret.water.y = Math.min(...plats.map(p => p[1])) - 14;
  return ret;
}
export const BASE_DESAFIOS = DESAFIOS.length;
for (let n = 8; n <= 100; n++) DESAFIOS.push(genDesafio(n));
