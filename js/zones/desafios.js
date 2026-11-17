// Desafíos: Cristales del Cielo.
// El primer prototipo del proyecto ("Cristales del Cielo") convertido en un modo contrarreloj dentro de Ecos de Aethra:
// recoge todos los cristales, cruza el portal y bate tu mejor tiempo. Los tres primeros niveles son los del prototipo;
// los dos últimos usan el planeador y el garfio.

// Plataforma del prototipo: [x, alto, z, ancho, fondo, movimiento?]
function level({ id, name, sky, fog, plats, gems, enemies = [], portal, medals, abilities = {}, extra = {} }) {
  const islands = [], movers = [], fragments = [], foes = [];
  plats.forEach(([x, top, z, w, d, mv]) => {
    if (mv) movers.push({ x, y: top, z, w, d, h: 0.8, axis: mv.ax, range: mv.r, speed: mv.s, color: 0x8a7ad8 });
    else islands.push({ x, z, w, d, top, depth: Math.min(w, d) > 5 ? 3 : 2 });
  });
  gems.forEach(([x, y, z], i) => fragments.push({ id: `${id}_g${i}`, x, y: y - 1, z }));
  enemies.forEach(([i, type = 'brote']) => { const [x, top, z, , , mv] = plats[i]; if (!mv) foes.push({ type, x, y: top, z }); });
  return {
    id, title: name, subtitle: 'Desafío · Cristales del Cielo', challenge: true, seed: id.length * 7 + gems.length,
    sky: { top: sky, bottom: fog, fog, fogNear: 45, fogFar: 170 },
    light: extra.light || {},
    palette: extra.palette || { top: 0x7ccf6a, side: 0x8a6a4a },
    water: { y: -14, color: fog },
    start: { id: 'inicio', pos: [plats[0][0], plats[0][1], plats[0][2] + 2], facing: 0 },
    islands, movers, fragments, enemies: foes,
    portal: { x: portal[0], y: portal[1], z: portal[2] },
    medals, abilities,
    ...extra.more,
  };
}

export const DESAFIOS = [
  level({
    id: 'desafio_1', name: 'Las Islas Tranquilas', sky: 0x87ceeb, fog: 0xbfe6ff,
    plats: [[0, 0, 0, 10, 10], [0, 0, -12, 6, 6], [0, 1.5, -20, 5, 5], [6, 3, -26, 5, 5], [14, 3, -26, 6, 4], [14, 4.5, -34, 7, 7], [14, 4.5, -45, 9, 9]],
    gems: [[0, 1, -12], [0, 2.5, -20], [6, 4, -26], [15, 4, -26], [12, 5.5, -34]],
    enemies: [[5]], portal: [14, 4.5, -48], medals: [25, 40, 70],
    extra: { more: { trees: [{ x: -3, z: 2 }, { x: 16, z: -46, s: 1.2 }], rocks: [{ x: 3, z: -3 }] } },
  }),
  level({
    id: 'desafio_2', name: 'Plataformas Errantes', sky: 0xf7b58a, fog: 0xffd9bf,
    plats: [[0, 0, 0, 8, 8], [0, 0, -10, 4, 4, { ax: 'x', r: 4, s: 1.1 }], [0, 1, -18, 4, 4], [-6, 2, -24, 4, 4, { ax: 'z', r: 2.5, s: 1.3 }], [-6, 3, -33, 6, 6], [2, 4, -38, 3, 3], [9, 5, -38, 4, 4, { ax: 'y', r: 1.5, s: 1.2 }], [18, 6, -38, 9, 9]],
    gems: [[0, 1, -10], [0, 2, -18], [-6, 3, -24], [-7, 4, -33], [2, 5, -38], [9, 6.5, -38]],
    enemies: [[4], [7]], portal: [21, 6, -38], medals: [30, 50, 85],
    extra: { light: { hemiSky: 0xffe2c0, sun: 0xffd09a }, palette: { top: 0xe8c890, side: 0xb8885a }, more: { crystals: [{ x: -8, z: -35, y: 3, s: 0.8, color: 0xffc86a }] } },
  }),
  level({
    id: 'desafio_3', name: 'La Cumbre de Cristal', sky: 0x2b2d5c, fog: 0x4a3f7a,
    plats: [[0, 0, 0, 8, 8], [0, 1, -8.5, 3, 3], [5, 2, -13, 3, 3], [10, 3, -19, 3, 3, { ax: 'x', r: 3, s: 1.4 }], [10, 4, -28, 6, 6], [3, 5, -33, 2.5, 2.5], [-4, 6, -38, 3, 3, { ax: 'z', r: 3, s: 1.2 }], [-4, 7, -48, 7, 7], [4, 8, -54, 3, 3, { ax: 'y', r: 2, s: 1.3 }], [13, 9.5, -58, 10, 10]],
    gems: [[0, 2, -8.5], [5, 3, -13], [10, 4.5, -19], [11, 5, -28], [3, 6, -33], [-4, 7.5, -38], [-5, 8, -48], [4, 9.5, -54]],
    enemies: [[4], [7], [9, 'espora']], portal: [15, 9.5, -61], medals: [40, 65, 110],
    extra: { light: { hemiSky: 0xb8b0ff, hemiGround: 0x3a2a5a, sun: 0xd8c8ff }, palette: { top: 0x8a7ac8, side: 0x4a3a6a }, more: { crystals: [{ x: 2, z: 2, s: 1.2, color: 0xc8a8ff }, { x: 16, z: -55, y: 9.5, s: 1.3, color: 0xc8a8ff }] } },
  }),
  level({
    id: 'desafio_4', name: 'Corrientes del Desierto', sky: 0xd06a4a, fog: 0xffd8a0,
    abilities: { planeador: true },
    plats: [[0, 0, 0, 10, 10], [0, -1, -17, 6, 6], [8, -3, -29, 6, 6], [10, 7, -41, 6, 6], [0, 5, -54, 5, 5], [-3, 2, -68, 7, 7], [4, 12, -78, 8, 8]],
    gems: [[0, 3, -10], [0, 0, -17], [8, 3, -29], [8, 8, -29], [10, 8, -41], [0, 6, -54], [-3, 3, -68], [0, 17, -73]],
    enemies: [[2], [5]], portal: [4, 12, -81], medals: [45, 70, 120],
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
    id: 'desafio_5', name: 'Engranajes del Cielo', sky: 0x3a4a6a, fog: 0xa8b0c0,
    abilities: { planeador: true, garfio: true },
    plats: [[0, 0, 0, 10, 10], [0, 2, -24, 6, 6], [0, 2, -34, 4, 4, { ax: 'x', r: 5, s: 0.9 }], [0, 3, -46, 6, 6], [14, 8, -46, 5, 5], [14, 8, -60, 4, 4, { ax: 'y', r: 3, s: 0.8 }], [14, 10, -74, 7, 7], [0, 16, -86, 9, 9]],
    gems: [[0, 8, -13], [0, 3, -24], [0, 3, -34], [0, 4, -46], [14, 9, -46], [14, 12, -60], [14, 11, -74], [6, 19, -81]],
    enemies: [[3], [6, 'espora'], [7]], portal: [0, 16, -89], medals: [50, 80, 130],
    extra: {
      light: { hemiSky: 0xd8e0f0, hemiGround: 0x4a4a5a, sun: 0xfff0d0 }, palette: { top: 0x9aa4b0, side: 0x5a5a6a },
      more: {
        grapples: [{ x: 0, y: 8, z: -12 }, { x: 7, y: 12, z: -46 }, { x: 7, y: 19, z: -80 }],
        signs: [{ id: 'nota_d5', x: 3, z: 3, rot: -0.4, title: 'Desafío', lines: ['Apunta a los anillos dorados y lanza el garfio (G o clic central).'] }],
      },
    },
  }),
];

// Medallas: [oro, plata, bronce] en segundos
export function medalFor(L, t) {
  const [o, p, b] = L.medals;
  return t <= o ? 'oro' : t <= p ? 'plata' : t <= b ? 'bronce' : null;
}
