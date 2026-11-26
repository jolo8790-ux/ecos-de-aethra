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
  // secretos: se ven oscurecidos hasta cumplir su reto (luego se compran)
  { id: 'dragon', name: 'Dragón de Ascuas', model: 'kart_dragon', img: 'assets/karts/dragon.jpg', cost: 800, hue: [[345, 360], [0, 15]], secret: 'wins5',
    desc: 'Un pequeño dragón con ruedas. Escupe un turbo enorme.', stats: { vel: 2, acc: 1, giro: 0, turbo: 3 } },
  { id: 'espectro', name: 'Espectro del Faro', model: 'kart_espectro', img: 'assets/karts/espectro.jpg', cost: 800, hue: [[150, 200]], secret: 'five',
    desc: 'El fantasma del viejo farero. Atraviesa las curvas como si no existieran.', stats: { vel: 1, acc: 2, giro: 3, turbo: 0 } },
  { id: 'ecos', name: 'Carro de los Ecos', model: 'kart_ecos', img: 'assets/karts/ecos.jpg', cost: 1500, hue: [[175, 200]], secret: 'alltracks',
    desc: 'La leyenda de Aethra: mármol, oro y runas que brillan. El mejor kart que existe.', stats: { vel: 3, acc: 2, giro: 2, turbo: 2 } },
];
// retos para desbloquear (karts secretos, piezas y pilotos)
export const RETOS = {
  wins1: { text: 'Gana una carrera', ok: r => (r.wins || 0) >= 1 },
  wins3: { text: 'Gana 3 carreras', ok: r => (r.wins || 0) >= 3 },
  wins5: { text: 'Gana 5 carreras', ok: r => (r.wins || 0) >= 5 },
  podium3: { text: 'Sube 3 veces al podio', ok: r => (r.podiums || 0) >= 3 },
  podium8: { text: 'Sube 8 veces al podio', ok: r => (r.podiums || 0) >= 8 },
  races10: { text: 'Termina 10 carreras', ok: r => (r.races || 0) >= 10 },
  five: { text: 'Gana una carrera a 5 vueltas', ok: r => (r.won5 || 0) >= 1 },
  bosque: { text: 'Sube al podio en el Bosque Colgante', ok: r => !!(r.podiumAt || {}).bosque },
  glaciar: { text: 'Gana en el Glaciar del Eco', ok: r => !!(r.wonAt || {}).glaciar },
  canon: { text: 'Gana en el Cañón del Ocaso', ok: r => !!(r.wonAt || {}).canon },
  cloaca: { text: 'Gana en las Cloacas de Bruma', ok: r => !!(r.wonAt || {}).cloaca },
  forja: { text: 'Gana en el Volcán de las Forjas', ok: r => !!(r.wonAt || {}).forja },
  vidrio: { text: 'Gana en el Espejismo de Vidrio', ok: r => !!(r.wonAt || {}).vidrio },
  engranajes: { text: 'Gana en la Ciudad de los Engranajes', ok: r => !!(r.wonAt || {}).engranajes },
  faroles: { text: 'Gana en la Noche de los Faroles', ok: r => !!(r.wonAt || {}).faroles },
  cumbre: { text: 'Gana en la Cumbre de las Nubes', ok: r => !!(r.wonAt || {}).cumbre },
  circo: { text: 'Gana en el Gran Circo de Aethra', ok: r => !!(r.wonAt || {}).circo },
  sombras: { text: 'Gana en el Reino de las Sombras', ok: r => !!(r.wonAt || {}).sombras },
  alltracks: { text: 'Gana en las tres pistas', ok: r => ['puerto', 'bosque', 'glaciar'].every(t => (r.wonAt || {})[t]) },
  hits10: { text: 'Acierta 10 objetos a tus rivales', ok: r => (r.hits || 0) >= 10 },
};
export const retoOk = (sv, id) => !id || !!(RETOS[id] && RETOS[id].ok((sv && sv.race) || {}));
// piezas: cada una suma puntos a las estadísticas y cambia algo que se ve o se oye
export const PARTS = {
  llantas: { icon: '🛞', name: 'Llantas', list: [
    { id: 'std', name: 'Estándar', desc: 'Las de fábrica.', cost: 0, add: {}, spark: 0x6ad0ff },
    { id: 'agarre', name: 'Agarre', desc: '+1 giro. Chispas verdes al derrapar.', cost: 120, add: { giro: 1 }, spark: 0x7aff6a },
    { id: 'todoterreno', name: 'Todoterreno', desc: '+1 aceleración. Chispas doradas.', cost: 150, add: { acc: 1 }, spark: 0xffd24a },
    { id: 'hielo', name: 'Clavos de hielo', desc: '+2 giro. Chispas de escarcha.', cost: 300, add: { giro: 2 }, spark: 0xd8f4ff, lock: 'glaciar' },
    { id: 'garras', name: 'Garras de dragón', desc: '+2 giro y +1 turbo. Chispas de fuego.', cost: 450, add: { giro: 2, turbo: 1 }, spark: 0xff7030, lock: 'podium8' },
  ] },
  motor: { icon: '⚙', name: 'Motor', list: [
    { id: 'std', name: 'Estándar', desc: 'El de fábrica.', cost: 0, add: {}, sound: 1 },
    { id: 'vapor', name: 'Caldera de vapor', desc: '+1 velocidad. Suena grave.', cost: 150, add: { vel: 1 }, sound: 0.8 },
    { id: 'rayo', name: 'Motor de rayo', desc: '+1 velocidad y +1 aceleración. Zumba agudo.', cost: 380, add: { vel: 1, acc: 1 }, sound: 1.35 },
    { id: 'lava', name: 'Corazón de lava', desc: '+2 velocidad. Ruge.', cost: 500, add: { vel: 2 }, sound: 0.65, lock: 'wins3' },
    { id: 'eco', name: 'Motor de los Ecos', desc: '+2 velocidad y +2 aceleración. Canta.', cost: 900, add: { vel: 2, acc: 2 }, sound: 1.6, lock: 'alltracks' },
  ] },
  turbo: { icon: '🔥', name: 'Turbo', list: [
    { id: 'std', name: 'Estándar', desc: 'El de fábrica.', cost: 0, add: {}, flame: 1 },
    { id: 'doble', name: 'Doble escape', desc: '+1 turbo. Llamas más largas.', cost: 150, add: { turbo: 1 }, flame: 1.3 },
    { id: 'cristal', name: 'Turbo de cristal', desc: '+2 turbo. Llamas enormes.', cost: 380, add: { turbo: 2 }, flame: 1.6 },
    { id: 'nitro', name: 'Nitro infinito', desc: '+3 turbo. Un cohete.', cost: 700, add: { turbo: 3 }, flame: 2, lock: 'five' },
  ] },
};
export const partOf = (sv, cat) => { const g = garageOf(sv), L = PARTS[cat].list; return L.find(p => p.id === g.parts[cat]) || L[0]; };
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
  g.parts = g.parts || { llantas: 'std', motor: 'std', turbo: 'std' }; g.ownParts = g.ownParts || ['llantas:std', 'motor:std', 'turbo:std'];
  g.driver = g.driver || null; g.drivers = g.drivers || [];
  return g;
}
export const kartById = id => KARTS.find(k => k.id === id) || KARTS[0];
// puntos de cada estadística: base del kart + mejoras compradas
export function kartPoints(sv, id) {
  const g = garageOf(sv), K = kartById(id || g.kart), u = g.up[K.id], out = {};
  for (const S of STATS) out[S.id] = K.stats[S.id] + (u[S.id] || 0);
  for (const cat of Object.keys(PARTS)) { const P = partOf(sv, cat); for (const [k, v] of Object.entries(P.add)) out[k] += v; }
  return out;
}
// multiplicadores que usa la carrera
export function kartMods(p) {
  return {
    vel: 1 + 0.025 * p.vel, acc: 1 + 0.07 * p.acc, giro: 1 + 0.045 * p.giro,
    charge: 1 + 0.08 * p.turbo, boost: 1 + 0.06 * p.turbo,
  };
}

// pilotos: tus héroes y los villanos (los villanos y algunos héroes se ganan corriendo)
export const DRIVERS = [
  { id: 'hero', name: 'Tu héroe', look: 'mine', desc: 'Quien llevas en la aventura.' },
  { id: 'kael', name: 'Kael', look: 'kael', desc: 'El más rápido del puerto.', hero: true },
  { id: 'marta', name: 'Capitana Marta', look: 'marta', desc: 'Nadie conoce el viento como ella.', hero: true },
  { id: 'tomas', name: 'Tomás', look: 'tomas', desc: 'Fuerte como una roca.', hero: true },
  { id: 'nerea', name: 'Nerea', look: 'nerea', desc: 'Buzo de Mareth.', hero: true },
  { id: 'brasa', name: 'Brasa', look: 'brasa', desc: 'Herrera de Ignis.', hero: true },
  { id: 'ilan', name: 'Abuelo Ilan', look: 'ilan', desc: 'El eco del abuelo.', hero: true },
  { id: 'vaelor', name: 'Vaelor', look: 'vaelor_piloto', desc: 'El caballero oscuro de la Ciudadela.', villain: true, lock: 'wins3' },
  { id: 'brumanegra', name: 'Capitán Brumanegra', look: 'brumanegra', desc: 'Pirata del cielo que roba los vientos.', villain: true, lock: 'podium3' },
  { id: 'escarcha', name: 'Reina Escarcha', look: 'escarcha', desc: 'Gobierna el hielo del Glaciar.', villain: true, lock: 'glaciar' },
  { id: 'sombra', name: 'Eco Sombrío', look: 'sombra', desc: 'La sombra que imita a los héroes.', villain: true, lock: 'hits10' },
];

// todo lo que se desbloquea con retos (para avisar al terminar una carrera)
export function unlockables() {
  const out = [];
  for (const k of KARTS) if (k.secret) out.push({ key: 'k:' + k.id, name: `el kart secreto ${k.name}`, reto: k.secret });
  for (const [cat, C] of Object.entries(PARTS)) for (const p of C.list) if (p.lock) out.push({ key: 'p:' + cat + p.id, name: `${C.name.toLowerCase()} «${p.name}»`, reto: p.lock });
  for (const d of DRIVERS) if (d.lock) out.push({ key: 'd:' + d.id, name: `el piloto ${d.name}`, reto: d.lock });
  out.push({ key: 't:glaciar', name: 'la pista del Glaciar del Eco', reto: 'bosque' });
  out.push({ key: 't:canon', name: 'la pista del Cañón del Ocaso', reto: 'glaciar' });
  out.push({ key: 't:cloaca', name: 'las Cloacas de Bruma', reto: 'canon' });
  out.push({ key: 't:forja', name: 'el Volcán de las Forjas', reto: 'cloaca' });
  out.push({ key: 't:vidrio', name: 'el Espejismo de Vidrio', reto: 'forja' });
  out.push({ key: 't:engranajes', name: 'la Ciudad de los Engranajes', reto: 'vidrio' });
  out.push({ key: 't:faroles', name: 'la Noche de los Faroles', reto: 'engranajes' });
  out.push({ key: 't:cumbre', name: 'la Cumbre de las Nubes', reto: 'faroles' });
  out.push({ key: 't:circo', name: 'el Gran Circo de Aethra', reto: 'cumbre' });
  out.push({ key: 't:sombras', name: 'el Reino de las Sombras', reto: 'circo' });
  out.push({ key: 't:ovni', name: 'la Base de los Ovnis', reto: 'sombras' });
  return out;
}
export function newUnlocks(sv) {
  const r = sv.race = sv.race || {}; const seen = r.seen = r.seen || [];
  const fresh = unlockables().filter(u => !seen.includes(u.key) && retoOk(sv, u.reto));
  for (const u of fresh) seen.push(u.key);
  return fresh;
}
