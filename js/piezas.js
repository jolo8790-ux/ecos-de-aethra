// Piezas especiales y misiones.
// Hay una pieza escondida en cada zona de la historia (dentro de una vasija o geoda que brilla un poco)
// y otra por cada misión cumplida. Las piezas dan beneficios: cada 4 piezas, un corazón más,
// y con 3, 6 y 10 piezas se desbloquean Nerea, Brasa e Ilan.
import { storeOf } from './logros.js';

export const ZONE_PIECES = {
  puerto_bruma: 'Pieza de la Bruma', bosque_colgante: 'Pieza de Raíz', ruinas_vidrio: 'Pieza de Vidrio',
  ciudad_engranajes: 'Pieza de Engranaje', glaciar_eco: 'Pieza de Escarcha', ciudadela_orden: 'Pieza del Orden',
  eco_olvidado: 'Pieza del Eco', forja_ignis: 'Pieza de Brasa', abismo_mareth: 'Pieza de Coral',
};

const n = (sv, k) => { const v = storeOf(sv).n[k]; return Array.isArray(v) ? v.length : (v || 0); };
export const MISIONES = [
  { id: 'm_cazador', icon: '⚔', title: 'Cazadora de sombras', desc: 'Derrota 25 enemigos.', goal: 25, prog: sv => n(sv, 'enemigos') },
  { id: 'm_rompe', icon: '⚱', title: 'Manos inquietas', desc: 'Rompe 15 vasijas o geodas.', goal: 15, prog: sv => n(sv, 'rotos') },
  { id: 'm_frag', icon: '◆', title: 'Buscadora de ecos', desc: 'Reúne 15 fragmentos.', goal: 15, prog: sv => (sv.fragments || []).length },
  { id: 'm_heroes', icon: '☺', title: 'Muchas caras', desc: 'Juega con 3 héroes distintos.', goal: 3, prog: sv => n(sv, 'heroes') },
  { id: 'm_duelo', icon: '⚡', title: 'Gladiadora', desc: 'Gana 3 duelos en la Arena.', goal: 3, prog: sv => n(sv, 'duelos') },
  { id: 'm_oleada', icon: '⛨', title: 'Muro de Aethra', desc: 'Supera 5 oleadas en el modo cooperativo.', goal: 5, prog: sv => n(sv, 'oleadaMax') },
  { id: 'm_infinito', icon: '∞', title: 'Sin fin', desc: 'Llega a 600 m en Aethra sin fin.', goal: 600, prog: sv => n(sv, 'infinitoMax') },
  { id: 'm_carrera', icon: '✦', title: 'Más rápida que el viento', desc: 'Gana 2 carreras de piezas.', goal: 2, prog: sv => n(sv, 'carreras') },
];
export const PIECE_TOTAL = Object.keys(ZONE_PIECES).length + MISIONES.length;
export const piecesOf = sv => (sv && sv.piezas) || [];
export const pieceCount = sv => piecesOf(sv).length;
export const pieceHearts = sv => Math.floor(pieceCount(sv) / 4); // beneficio: un corazón cada 4 piezas

// guarda el valor más alto (oleadas)
export function bumpMax(sv, key, v) { const d = storeOf(sv); d.n[key] = Math.max(d.n[key] || 0, v); return d.n[key]; }

// La vasija o geoda que esconde la pieza de la zona: la más alejada del inicio (la que más cuesta encontrar).
export function pieceBreakable(zone) {
  if (!ZONE_PIECES[zone.id]) return null;
  const s = zone.start && zone.start.pos ? zone.start.pos : [0, 0, 0];
  let best = null, bd = -1;
  for (const b of zone.breakables || []) {
    if (b.loot === 'reliquia' || b.loot === 'reloj') continue;
    const d = Math.hypot(b.x - s[0], b.z - s[2]);
    if (d > bd) { bd = d; best = b; }
  }
  return best ? best.id : null;
}

// Misiones cumplidas que aún no dieron su pieza.
export function newlyDone(sv) {
  const got = new Set(piecesOf(sv)), out = [];
  for (const M of MISIONES) if (!got.has('pz_' + M.id) && M.prog(sv) >= M.goal) out.push(M);
  return out;
}
export function givePiece(sv, id) {
  sv.piezas = sv.piezas || [];
  if (sv.piezas.includes(id)) return false;
  sv.piezas.push(id); return true;
}
