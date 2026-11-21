// Senderos: cada zona de la historia gana un recorrido largo de plataformas (más o menos el doble de juego).
// Una barrera de luz cierra el camino principal; al final del Sendero hay un Sello que la disuelve
// y un viento que devuelve a la protagonista junto a la barrera.
import { buildRoute } from './routegen.js';

const ALL = ['hop', 'crumbles', 'mover', 'pend', 'wasp', 'glide', 'updraft', 'dash', 'grapple', 'fire', 'spin', 'blink', 'spikes', 'gust', 'lift', 'swing'];
export const SENDEROS = {
  puerto_bruma: { name: 'Sendero de la Bruma', seed: 11, start: [22, 0, -10], dir: 1, caps: {}, segs: ['hop', 'crumbles', 'mover', 'spin', 'pend', 'blink', 'wasp', 'lift'], length: 175, crystal: 0x9fe3ff,
    gated: g => /^Vuelve con la capitana Marta/.test(g.text), why: 'Antes de zarpar, Marta quiere el Sello de la Bruma: está al final del Sendero, al este del faro.' },
  bosque_colgante: { name: 'Sendero de las Lianas', seed: 23, start: [-7, 0, -24], dir: -1, gateZ: -33.6, gateW: 22, caps: {}, segs: ['hop', 'crumbles', 'mover', 'pend', 'wasp', 'swing', 'spin', 'blink', 'gust', 'lift'], length: 200, crystal: 0xb6ff9a },
  ruinas_vidrio: { name: 'Sendero de Arena', seed: 37, start: [-8, 0, -20], dir: -1, gateZ: -26.6, gateW: 24, caps: { glide: true, dash: true }, segs: ['hop', 'crumbles', 'glide', 'updraft', 'dash', 'wasp', 'pend', 'fire', 'spikes', 'spin', 'gust', 'blink'], length: 210, crystal: 0xffd27a, fire: true },
  ciudad_engranajes: { name: 'Sendero de Engranajes', seed: 41, start: [-8, 0, -20], dir: -1, gateZ: -26.6, gateW: 24, caps: { glide: true, dash: true }, segs: ['hop', 'mover', 'lift', 'pend', 'glide', 'updraft', 'crumbles', 'fire', 'spin', 'spikes', 'swing', 'lift'], length: 215, crystal: 0xffb46a, fire: true },
  glaciar_eco: { name: 'Sendero de Escarcha', seed: 53, start: [-8, 0, -20], dir: -1, gateZ: -26.6, gateW: 24, caps: { glide: true, dash: true, grapple: true }, segs: ['hop', 'crumbles', 'glide', 'grapple', 'pend', 'updraft', 'wasp', 'blink', 'gust', 'spin', 'blink'], length: 215, crystal: 0xbfefff },
  ciudadela_orden: { name: 'Sendero del Orden', seed: 67, start: [-8, 0, -20], dir: -1, gateZ: -26.6, gateW: 24, caps: { glide: true, dash: true, grapple: true }, segs: ALL, length: 225, crystal: 0xd8b8ff, fire: true },
  eco_olvidado: { name: 'Sendero del Eco', seed: 79, start: [-7, 0, -20], dir: -1, gateZ: -25.6, gateW: 22, caps: { glide: true, dash: true, grapple: true }, segs: ALL, length: 230, crystal: 0x9fb8ff, fire: true },
  forja_ignis: { name: 'Sendero de Brasas', seed: 97, start: [-7, 0, -27.8], dir: -1, gateZ: -33.4, gateW: 22, caps: { glide: true, dash: true, grapple: true }, segs: ['fire', 'crumbles', 'pend', 'fire', 'glide', 'updraft', 'crumbles', 'hop', 'spikes', 'spin', 'swing', 'lift'], length: 175, crystal: 0xffa040, fire: true },
};

const NARR = '', LIA = 'Lía';
export function applySenderos(ZONES) {
  for (const [id, C] of Object.entries(SENDEROS)) {
    const Z = ZONES[id]; if (!Z || Z._sendero) continue;
    Z._baseIslands = (Z.islands || []).length; // las islas propias de la zona (sin el Sendero)
    const r = buildRoute({ ...C, idp: 'sd_' + id });
    const flag = 'sello_' + id, back = 'sendero_vuelta';
    for (const k of ['islands', 'crumbles', 'movers', 'bridges', 'updrafts', 'grapples', 'fireJets', 'pendulums', 'spinners', 'blinkers', 'spikes', 'gusts', 'orbs', 'enemies', 'lanterns', 'fragments', 'breakables', 'crystals']) {
      if (r[k] && r[k].length) Z[k] = [...(Z[k] || []), ...r[k]];
    }
    const [sx, sy, sz] = C.start, inward = -C.dir;
    Z.lanterns.push({ id: back, x: sx + inward * 2, y: sy, z: sz + 4, facing: 0 }); // a un lado, sin estorbar la salida
    Z.signs = [...(Z.signs || []), { id: 'cartel_' + flag, x: sx + inward * 1.2, y: sy, z: sz - 4, rot: C.dir > 0 ? -Math.PI / 2 : Math.PI / 2, title: C.name, lines: [`"Al final del ${C.name} brilla un Sello. Quien lo toque abrirá los caminos cerrados de esta isla."`] }];
    if (C.gateZ != null) Z.sealGates = [...(Z.sealGates || []), { x: 0, y: sy - 1, z: C.gateZ, w: C.gateW, h: 16, d: 0.6, flag }];
    Z.items = [...(Z.items || []), { id: flag, model: 'bigshard', x: r.altar.x, y: r.altar.y, z: r.altar.z, verb: 'Tocar el Sello', when: S => !S.has(flag) }];
    const story = Z.story, goal0 = story.goal.bind(story), at = [r.altar.x, r.altar.y, r.altar.z];
    const gated = C.gated || (g => g && g.at && g.at[2] < C.gateZ - 0.5);
    story.goal = S => {
      const g = goal0(S);
      if (!S.has(flag) && g && gated(g, S)) return { text: C.gateZ != null ? `Una barrera de luz cierra el paso: recorre el ${C.name} y toca el Sello` : `Recorre el ${C.name} y toca el Sello`, at };
      return g;
    };
    story.talk = story.talk || {};
    story.talk[flag] = S => ({
      lines: [
        { who: NARR, text: 'El Sello se enciende al tocarlo. A lo lejos, se oye cómo algo se disuelve en el aire.' },
        { who: LIA, text: C.gateZ != null ? '¡La barrera se ha abierto! Y este viento... me lleva de vuelta.' : '¡Lo tengo! Y este viento me lleva de vuelta con Marta.' },
      ],
      then: () => { S.set(flag); S.warp(back); },
    });
    // en el prólogo no hay barrera: Marta no zarpa sin el sello
    if (C.why && story.talk.marta) {
      const m0 = story.talk.marta;
      story.talk.marta = S => { const g = goal0(S); if (!S.has(flag) && C.gated(g, S)) return { lines: [{ who: 'Capitana Marta', text: C.why }] }; return m0(S); };
    }
    Z._sendero = { name: C.name, length: r.length, flag, altar: at, first: r.first };
  }
}
