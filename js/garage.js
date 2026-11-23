// Taller de karts: karts para comprar, mejoras (velocidad, aceleración, giro, turbo),
// pintura y estela del turbo. Todo se paga con Ecos y queda guardado en la partida.

// hue: rango de tonos de la carrocería que se repinta (en grados); stats: puntos base (-2 … +2)
export const KARTS = [
  { id: 'velero', name: 'Velero del Puerto', model: 'kart', img: 'assets/karts/velero.jpg', cost: 0, hue: [[195, 260]],
    desc: 'El kart del puerto: madera azul, timón y vela. Equilibrado en todo.', stats: { vel: 0, acc: 0, giro: 0, turbo: 0 } },
  { id: 'raiz', name: 'Raíz Veloz', model: 'kart_bosque', img: 'assets/karts/raiz.jpg', cost: 300, hue: [[60, 170]],
    desc: 'Tallado en madera viva del Bosque Colgante. Arranca rápido y gira muy cerrado.', stats: { vel: -1, acc: 2, giro: 2, turbo: 0 } },
  { id: 'engranaje', name: 'Engranaje Turbo', model: 'kart_engranaje', img: 'assets/karts/engranaje.jpg', cost: 450, hue: [[340, 360], [0, 12]],
    desc: 'Cobre y engranajes de la Ciudad. El más rápido en recta y con el mejor turbo, pero gira peor.', stats: { vel: 2, acc: -1, giro: -1, turbo: 2 } },
  { id: 'cristal', name: 'Cristal de las Ruinas', model: 'kart_ruinas', img: 'assets/karts/cristal.jpg', cost: 600, hue: [[160, 205]],
    desc: 'Paneles de cristal turquesa y arenisca de las Ruinas de Vidrio. Rápido y ágil.', stats: { vel: 1, acc: 1, giro: 1, turbo: -1 } },
  { id: 'trineo', name: 'Trineo del Glaciar', model: 'kart_glaciar', img: 'assets/karts/trineo.jpg', cost: 650, hue: [[185, 230]],
    desc: 'Un trineo con motor del Glaciar del Eco. Sus derrapes sobre hielo cargan el turbo volando.', stats: { vel: 0, acc: 1, giro: 0, turbo: 3 } },
  { id: 'concha', name: 'Concha de Mareth', model: 'kart_mareth', img: 'assets/karts/concha.jpg', cost: 700, hue: [[160, 200], [320, 355]],
    desc: 'Caparazón marino con hélice de la ciudad sumergida. El que mejor acelera.', stats: { vel: 0, acc: 3, giro: 1, turbo: -1 } },
  { id: 'obsidiana', name: 'Obsidiana de Ignis', model: 'kart_forja', img: 'assets/karts/obsidiana.jpg', cost: 900, hue: [[12, 42]],
    desc: 'Forjado en la lava de la Forja. Una bala en recta, pero pesado en las curvas.', stats: { vel: 3, acc: -1, giro: -2, turbo: 1 } },
  { id: 'sombra', name: 'Sombra de la Ciudadela', model: 'kart_ciudadela', img: 'assets/karts/sombra.jpg', cost: 1200, hue: [[255, 300]],
    desc: 'El kart de los villanos de la Ciudadela del Orden. Muy bueno en todo.', stats: { vel: 2, acc: 1, giro: 1, turbo: 1 } },
];
export const STATS = [
  { id: 'vel', icon: '💨', name: 'Velocidad', desc: 'Velocidad máxima' },
  { id: 'acc', icon: '⚡', name: 'Aceleración', desc: 'Qué tan rápido arranca' },
  { id: 'giro', icon: '↪', name: 'Giro', desc: 'Curvas más cerradas' },
  { id: 'turbo', icon: '🔥', name: 'Turbo', desc: 'El derrape carga antes y el turbo dura más' },
];
export const UP_COST = [40, 80, 140, 220, 320];
export const PAINTS = [
  { id: 'original', name: 'Original', color: null, cost: 0 },
  { id: 'rojo', name: 'Rojo', color: 0xe8483c, cost: 25 }, { id: 'verde', name: 'Verde', color: 0x4ac85a, cost: 25 },
  { id: 'dorado', name: 'Dorado', color: 0xffc83a, cost: 25 }, { id: 'violeta', name: 'Violeta', color: 0x9a5aff, cost: 25 },
  { id: 'rosa', name: 'Rosa', color: 0xff7ab8, cost: 25 }, { id: 'turquesa', name: 'Turquesa', color: 0x2ad0c0, cost: 25 },
  { id: 'azul', name: 'Azul', color: 0x3a7aff, cost: 25 }, { id: 'blanco', name: 'Blanco', color: 0xf4f2ee, cost: 40 }, { id: 'negro', name: 'Noche', color: 0x2a2a3a, cost: 40 },
];
export const TRAILS = [
  { id: 'fuego', name: 'Fuego', color: 0xffa040, cost: 0 },
  { id: 'hielo', name: 'Hielo', color: 0x6ad0ff, cost: 40 },
  { id: 'veneno', name: 'Veneno', color: 0x7aff6a, cost: 40 },
  { id: 'dorada', name: 'Dorada', color: 0xffe070, cost: 60 },
  { id: 'arcoiris', name: 'Arcoíris', color: 'rainbow', cost: 90 },
];

export function garageOf(sv) {
  const g = sv.garage = sv.garage || {};
  g.kart = g.kart || 'velero'; g.owned = g.owned || ['velero'];
  g.up = g.up || {}; for (const k of KARTS) g.up[k.id] = g.up[k.id] || { vel: 0, acc: 0, giro: 0, turbo: 0 };
  g.paint = g.paint || 'original'; g.paints = g.paints || ['original'];
  g.trail = g.trail || 'fuego'; g.trails = g.trails || ['fuego'];
  return g;
}
export const kartById = id => KARTS.find(k => k.id === id) || KARTS[0];
// puntos de cada estadística: base del kart + mejoras compradas
export function kartPoints(sv, id) {
  const g = garageOf(sv), K = kartById(id || g.kart), u = g.up[K.id], out = {};
  for (const S of STATS) out[S.id] = K.stats[S.id] + (u[S.id] || 0);
  return out;
}
// multiplicadores que usa la carrera
export function kartMods(p) {
  return {
    vel: 1 + 0.025 * p.vel, acc: 1 + 0.07 * p.acc, giro: 1 + 0.045 * p.giro,
    charge: 1 + 0.08 * p.turbo, boost: 1 + 0.06 * p.turbo,
  };
}
