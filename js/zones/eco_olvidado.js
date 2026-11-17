// Capítulo extra — El Eco Olvidado (se abre al terminar la historia).
// Recorrido hacia -z: muelle → patio del eco (Ilan) → puentes de luz → jardín (barrera de sombra) → mirador de vientos
// → corriente de aire hasta la torre → garfio a la arena del Eco Sombrío → santuario.

const L = (who, text, extra = {}) => ({ who, text, ...extra });
const LIA = 'Lía', MARTA = 'Capitana Marta', ILAN = 'Eco de Ilan', ECO = 'Eco Sombrío', NARR = '';

export default {
  id: 'eco_olvidado',
  title: 'El Eco Olvidado',
  subtitle: 'Capítulo extra',
  seed: 67,
  sky: { top: 0x120a2e, bottom: 0x3a7aa0, fog: 0x2a3a5a, fogNear: 30, fogFar: 140 },
  light: { hemiSky: 0xb8d8ff, hemiGround: 0x2a2a4a, sun: 0xd8e8ff },
  palette: { top: 0x5a7a9a, side: 0x2a3450 },
  water: { y: -18, color: 0x3a5a8a },
  start: { id: 'llegada', pos: [0, 0, 4], facing: 0 },

  breakables: [
    { id: 'reliquia_eco_olvidado', kind: 'cofre', x: 14.6, y: 1, z: -45, loot: 'reliquia' },
    { id: 'eco_olvidado_v1', kind: 'vasija', x: 5.5, y: 0, z: -15, loot: 'corazon' },
    { id: 'eco_olvidado_v2', kind: 'vasija', x: -5.5, y: 3, z: -44 },
    { id: 'eco_olvidado_v3', kind: 'vasija', x: -4, y: 13, z: -73, loot: 'corazon' },
  ],
  islands: [
    { x: 0, z: 2, w: 16, d: 16, top: 0, depth: 4 },          // muelle
    { x: 0, z: -20, w: 14, d: 12, top: 0, depth: 4 },        // patio del eco
    { x: 0, z: -42, w: 14, d: 10, top: 3, depth: 4 },        // jardín de cristal
    { x: 0, z: -60, w: 12, d: 12, top: 3, depth: 4 },        // mirador de vientos
    { x: 2, z: -70, w: 8, d: 8, top: 13, depth: 3 },         // torre
    { x: 0, z: -100, w: 26, d: 26, top: 13, depth: 5 },      // arena del eco
    { x: 0, z: -124, w: 10, d: 10, top: 13, depth: 3 },      // santuario
    { x: 14, z: -44, w: 4, d: 4, top: 1, depth: 2 },         // islote escondido
  ],
  bridges: [
    { x1: 0, z1: -6, x2: 0, z2: -14, y: 0, w: 2.4 },
    { x1: 0, z1: -47, x2: 0, z2: -54, y: 3, w: 2.4 },
    { x1: 0, z1: -113, x2: 0, z2: -119, y: 13, w: 2.4 },
  ],
  darkBarriers: [{ id: 'jardin', x: 0, y: 3, z: -48.5, w: 4, h: 3.8, flag: 'sombra_jardin' }],
  lightCrystals: [{ id: 'eco1', x: 4, z: -24, flag: 'luz_eco1' }],
  lightPlatforms: [
    { crystal: 'eco1', x: 0, y: 0.7, z: -28.5, w: 3, d: 3 }, { crystal: 'eco1', x: 1, y: 1.5, z: -31.6, w: 3, d: 3 }, { crystal: 'eco1', x: -0.6, y: 2.3, z: -34.6, w: 3, d: 3 },
  ],
  updrafts: [{ x: 4, z: -62, y0: 3, y1: 18, r: 2.3 }],
  grapples: [{ x: 0, y: 18, z: -81 }],
  crystals: [
    { x: 5, z: -2, s: 0.9, color: 0x9ad8ff }, { x: -5.5, z: -23, s: 1.1, color: 0xc8a8ff }, { x: 5.5, y: 3, z: -38, s: 1.2, color: 0x9ad8ff },
    { x: -9, y: 13, z: -110, s: 1.3, color: 0xc8a8ff }, { x: 10, y: 13, z: -92, s: 1.1, color: 0x9ad8ff }, { x: 3.5, y: 13, z: -127, s: 1, color: 0xc8a8ff },
  ],
  obelisks: [{ x: -5.5, z: -14, h: 4 }, { x: 5.5, z: -14, h: 4 }, { x: -10.5, y: 13, z: -88, h: 7 }, { x: 10.5, y: 13, z: -112, h: 7 }],
  columns: [{ x: -5, y: 3, z: -58, h: 3 }, { x: 5, y: 3, z: -57, h: 2.2, broken: true }, { x: -4, y: 13, z: -121, h: 3 }],
  pines: [{ x: -6, z: -3 }, { x: 6.5, z: 6, s: 0.8 }],
  airships: [{ id: 'dirigible', x: -1, y: 1.2, z: 13.5 }],

  signs: [
    {
      id: 'cartel_eco', x: 2.5, z: -15, rot: -0.3, title: 'Inscripción',
      lines: ['"Lo que se calla vuelve como eco. Lo que se enfrenta, se apaga."'],
    },
  ],
  npcs: [
    { id: 'marta_e', name: MARTA, model: 'marta', x: -3.2, z: 6, rot: -0.6, lines: ['...'] },
    { id: 'ilan_e', name: ILAN, model: 'ilan', x: -2, z: -18, rot: 0.4, lines: ['...'] },
  ],
  items: [
    { id: 'fragmento_eco', model: 'bigshard', x: 0, y: 13, z: -126, verb: 'Tomar el Fragmento del Eco', when: S => S.has('eco_vencido') && !S.has('fragmento_eco') },
  ],
  lanterns: [
    { id: 'llegada', x: 3.2, z: 2.2, facing: 0 },
    { id: 'patio', x: -5, z: -16, facing: 0 },
    { id: 'jardin', x: 4.5, y: 3, z: -40, facing: 0 },
    { id: 'mirador', x: -4, y: 3, z: -56, facing: 0 },
    { id: 'torre', x: 4.5, y: 13, z: -67.5, facing: Math.PI },
  ],
  fragments: [
    { id: 'eo_patio', x: 6, z: -17 },
    { id: 'eo_luz', x: -0.6, y: 2.3, z: -34.6 },
    { id: 'eo_islote', x: 13.4, y: 1, z: -43 },
    { id: 'eo_torre', x: -0.5, y: 13, z: -72.5 },
    { id: 'eo_arena', x: -9, y: 13, z: -96 },
  ],
  enemies: [
    // avispas de cristal: vuelan junto a las corrientes de aire y los tramos de vuelo
    { type: 'avispa', x: 4, y: 10, z: -62, r: 3.2 }, { type: 'avispa', x: 0, y: 16, z: -85, r: 3, axis: 'x' },
    { type: 'sombra', x: -3, z: -23 }, { type: 'sombra', x: 3, z: -19 },
    { type: 'centinela', x: -4.5, y: 3, z: -40 },
    { type: 'sombra', x: -3, y: 3, z: -62 }, { type: 'sombra', x: 2, y: 3, z: -58 },
    { type: 'espora', x: 0, y: 13, z: -72 },
  ],
  boss: {
    type: 'eco', x: 0, y: 13, z: -101, arenaR: 10, facing: 0, flag: 'eco_vencido', region: [-13, 11, -113, 13, 22, -88],
    name: 'Eco Sombrío', hp: 8, phaseMsg: 'Eco Sombrío: «¡Ya no me tienes miedo!»',
  },
  regions: [
    { id: 'jardin', box: [-7, 2.5, -47, 7, 7, -37], flag: 'llego_jardin' },
    { id: 'torre', box: [-2, 12.5, -74, 6, 16, -66], flag: 'llego_torre' },
  ],

  chapterEnd: {
    kicker: 'Fin del capítulo extra', title: 'El eco que se queda',
    sub: 'Gracias por jugar Ecos de Aethra hasta el final.',
    next: { label: 'Capítulo extra 2: Las Forjas de Ignis', zone: 'forja_ignis', cp: 'llegada' },
  },

  story: {
    intro: [
      L(NARR, 'Desde que el Corazón volvió a latir, una isla nueva brilla al borde del mapa. Ningún cartógrafo la había dibujado.'),
      L(MARTA, 'Aquí estamos, chiquilla. La brújula no ha parado de zumbar en todo el viaje.'),
      L(LIA, 'Hay alguien en el patio. Una luz azul... parece una persona.'),
    ],

    goal(S) {
      if (!S.has('hablo_ilan')) return { text: 'Sigue la luz azul hasta el patio', at: [-2, 0, -18] };
      if (!S.has('luz_eco1')) return { text: 'Enciende el cristal del patio con un pulso (Z)', at: [4, 0, -24] };
      if (!S.has('llego_jardin')) return { text: 'Sube por los puentes de luz hasta el jardín', at: [0, 3, -40] };
      if (!S.has('sombra_jardin')) return { text: 'Disipa la barrera de sombra con el pulso', at: [0, 3, -48.5] };
      if (!S.has('llego_torre')) return { text: 'Planea en la corriente de aire hasta la torre', at: [4, 3, -62], auto: [2, 13, -70] };
      if (!S.has('eco_vencido')) return S.bossActive
        ? { text: 'Rompe su barrera con el pulso o devolviéndole un orbe, y golpéalo', at: null }
        : { text: 'Lanza el garfio hacia la arena', at: [0, 13, -90] };
      if (!S.has('fragmento_eco')) return { text: 'Toma el Fragmento del Eco en el santuario', at: [0, 13, -126] };
      return { text: 'Capítulo extra completado. ¡Gracias por jugar!', at: [-3.2, 0, 6] };
    },

    bossIntro: [
      L(NARR, 'En el centro de la arena, una figura sale de tu propia sombra. Tiene tu cara, tu ropa, tu bastón... pero sus ojos no brillan.'),
      L(ECO, 'Soy todo lo que dudaste en el camino. Cada vez que pensaste en volver a casa.'),
      L(LIA, 'Entonces te conozco bien. Y ya no te tengo miedo.'),
    ],
    bossDefeated: [
      L(NARR, 'El Eco Sombrío se deshace en mil chispas que suben al cielo como luciérnagas.'),
      L(ILAN, 'Lo hiciste, Lía. Ese eco te acompañó todo el viaje. Ahora es solo un recuerdo.', { who: ILAN }),
      L(NARR, 'En el santuario, algo pequeño y brillante empieza a latir.', { system: true }),
    ],
    onBossDefeated: S => { S.set('eco_vencido'); },

    talk: {
      marta_e(S) {
        if (!S.has('fragmento_eco')) return { lines: [L(MARTA, 'Ve tranquila. Si ese fantasma te da problemas, dile que la Capitana Marta lo está mirando.')] };
        return { lines: [L(MARTA, '¿Volvemos a casa? Te invito a la sopa de pescado más rica de Puerto Bruma.')], then: () => S.chapterEnd() };
      },
      ilan_e(S) {
        if (!S.has('hablo_ilan')) return {
          lines: [
            L(ILAN, 'Lía... cuánto has crecido. No, no estoy aquí del todo. Soy un eco: lo que quedó de mí cuando escondí el Corazón.'),
            L(LIA, '¿Abuelo...? ¿Eres tú de verdad?'),
            L(ILAN, 'Lo suficiente para decirte que estoy orgulloso. Pero en esta isla también vive otro eco. Uno que nació de tus miedos.'),
            L(ILAN, 'Enciende el cristal de luz con tu pulso. Los puentes te llevarán al jardín.'),
          ],
          then: () => S.set('hablo_ilan'),
        };
        if (!S.has('eco_vencido')) return { lines: [L(ILAN, 'Tu sombra copia lo que haces. Usa lo que aprendiste: el escudo, el pulso... y no dudes.')] };
        return { lines: [L(ILAN, 'Ya no necesitas mapas que yo haya dibujado. Ahora los dibujas tú.')] };
      },
      fragmento_eco(S) {
        return {
          lines: [
            L(NARR, 'Un fragmento pequeño, cálido, con forma de rosa de los vientos.'),
            L(ILAN, 'Guárdalo. Cuando lo mires, recuerda que los ecos que se enfrentan se vuelven canciones.', { who: ILAN }),
            L(NARR, 'Obtuviste el Fragmento del Eco.', { system: true }),
          ],
          then: () => { S.set('fragmento_eco'); S.give('Fragmento del Eco'); S.chapterEnd(); },
        };
      },
    },
  },
};
