// Capítulo 4 — El Glaciar del Eco.
// Recorrido hacia -z: muelle → campamento de Kael (escudo) → puerta de hielo → lago helado → rampa con cerradura → mirador → arena de la Sierpe → santuario.

const L = (who, text, extra = {}) => ({ who, text, ...extra });
const LIA = 'Lía', MARTA = 'Capitana Marta', KAEL = 'Kael', NARR = '';

export default {
  id: 'glaciar_eco',
  title: 'El Glaciar del Eco',
  subtitle: 'Capítulo 4',
  seed: 41,
  sky: { top: 0x6a9ad8, bottom: 0xe8f4ff, fog: 0xd8ecfa, fogNear: 30, fogFar: 130 },
  light: { hemiSky: 0xe8f4ff, hemiGround: 0x6a7a90, sun: 0xfff8f0 },
  palette: { top: 0xf4fbff, side: 0x8aa0b8 },
  water: { y: -16, color: 0xe8f4ff },
  snow: 260,
  start: { id: 'llegada', pos: [0, 0, 4], facing: 0 },

  // objetos que se rompen con el bastón (la geoda violeta guarda la Reliquia de Aethra de esta zona)
  breakables: [
    { id: 'reliquia_glaciar_eco', kind: 'cofre', x: 15.2, y: 2, z: -41.2, loot: 'reliquia' },
    { id: 'glaciar_eco_v1', kind: 'vasija', x: -6, y: 0, z: -17, loot: 'corazon' },
    { id: 'glaciar_eco_v2', kind: 'vasija', x: 6, y: 0, z: -50 },
    { id: 'glaciar_eco_v3', kind: 'vasija', x: 3, y: 5, z: -68.5, loot: 'corazon' },
  ],
  islands: [
    { x: 0, z: 2, w: 16, d: 16, top: 0, depth: 4 },          // muelle
    { x: 0, z: -20, w: 16, d: 14, top: 0, depth: 4 },        // campamento
    { x: 0, z: -44, w: 18, d: 18, top: 0, depth: 4 },        // lago helado
    { x: 0, z: -66, w: 10, d: 10, top: 5, depth: 3 },        // mirador
    { x: 0, z: -90, w: 26, d: 26, top: 5, depth: 5 },        // arena
    { x: 0, z: -115, w: 10, d: 10, top: 7, depth: 3 },       // santuario
    { x: 14, z: -40, w: 5, d: 5, top: 2, depth: 2 },         // témpano escondido
  ],
  bridges: [
    { x1: 0, z1: -6, x2: 0, z2: -12.8, y: 0, w: 2.4 },
    { x1: 0, z1: -27.2, x2: 0, z2: -34.8, y: 0, w: 2.4 },
    { x1: 0, z1: -71.2, x2: 0, z2: -76.8, y: 5, w: 2.4 },
  ],
  ramps: [{ x: 0, z: -57, w: 3.4, d: 8, y0: 5, y1: 0, axis: 'z', color: 0x9ab0c8 }],
  locks: [
    { id: 'puerta1', x: -2.6, y: 2.4, z: -27, base: 0, flag: 'hielo_puerta1', gate: { x: 0, y: 3.6, z: -27.8, w: 3.4, h: 3.6, d: 0.6 } },
    { id: 'puerta2', x: 3.2, y: 2.6, z: -52.6, base: 0, flag: 'hielo_puerta2', gate: { x: 0, y: 3.8, z: -53.4, w: 4.2, h: 3.8, d: 0.6 } },
  ],
  grapples: [{ x: 0, y: 10.5, z: -108.3, when: S => S.has('sierpe_vencida') }],
  pines: [
    { x: -6, z: -3 }, { x: 6, z: 7, s: 0.8 }, { x: -6.5, z: -16 }, { x: 6.5, z: -24, s: 1.1 },
    { x: -7.5, z: -38 }, { x: 7.5, z: -50, s: 0.9 }, { x: -7, z: -51, s: 1.2 }, { x: 4, y: 5, z: -68, s: 0.7 },
    { x: -11, y: 5, z: -100, s: 1.2 }, { x: 11, y: 5, z: -79, s: 1 },
  ],
  icicleWalls: [{ x: -5, z: -12.5, w: 4, h: 2.5 }, { x: 6, z: -36, w: 3, h: 2 }, { x: -3, y: 7, z: -110.5, w: 3, h: 2 }],
  crystals: [
    { x: 5, z: -1, s: 0.8, color: 0xd8f6ff }, { x: -6, z: -45, s: 1.2, color: 0xbff4ff }, { x: 10, y: 5, z: -97, s: 1.1, color: 0xd8f6ff },
    { x: -10, y: 5, z: -82, s: 1, color: 0xbff4ff },
  ],
  rocks: [{ x: 3, z: -46, s: 1.1 }, { x: -3, z: -40, s: 0.8 }],
  tents: [{ x: -4.5, z: -21, rot: -0.3 }],
  airships: [{ id: 'dirigible', x: -1, y: 1.2, z: 13.5 }],

  signs: [
    {
      id: 'cartel_ojos', x: 3, z: -17, rot: -0.2, title: 'Nota de Kael',
      lines: [
        'Los ojos de hielo solo se rompen con su propia magia.',
        'Mantén V para alzar el escudo. Cuando la flor de hielo te dispare, mira hacia el ojo: el orbe rebotará hacia allí.',
      ],
    },
    {
      id: 'cartel_sierpe', x: 3, y: 5, z: -63, rot: 0.3, title: 'Inscripción antigua',
      lines: ['"La Sierpe duerme en el viento. Solo cae cuando su propio aliento la alcanza."'],
    },
  ],
  npcs: [
    { id: 'marta_g', name: MARTA, model: 'marta', x: -3.2, z: 6, rot: -0.6, lines: ['...'] },
    { id: 'kael_g', name: KAEL, model: 'kael', x: -1.5, z: -17, rot: 0.5, lines: ['...'] },
  ],
  items: [
    { id: 'gran_fragmento_g', model: 'bigshard', x: 0, y: 7, z: -117, verb: 'Tomar el gran fragmento', when: S => !S.has('gran_fragmento_4') },
  ],
  lanterns: [
    { id: 'llegada', x: 3.2, z: 2.2, facing: 0 },
    { id: 'campamento', x: 4.5, z: -15, facing: 0 },
    { id: 'lago', x: -5, z: -38, facing: 0 },
    { id: 'mirador', x: 3.5, y: 5, z: -64, facing: 0 },
    { id: 'santuario', x: -3, y: 7, z: -112, facing: 0 },
  ],
  fragments: [
    { id: 'ge_tienda', x: -7, z: -26 },
    { id: 'ge_tempano', x: 14, y: 2, z: -40 },
    { id: 'ge_lago', x: 6.5, z: -44 },
    { id: 'ge_mirador', x: -3.5, y: 5, z: -69 },
    { id: 'ge_santuario', x: 3.5, y: 7, z: -118 },
  ],
  enemies: [
    // avispas de cristal: vuelan junto a las corrientes de aire y los tramos de vuelo
    { type: 'avispa', x: 0, y: 9, z: -104, r: 2.5, axis: 'x' },
    { type: 'espora_hielo', x: -5.5, z: -26 },
    { type: 'brote_hielo', x: -3, z: -40 }, { type: 'brote_hielo', x: 4, z: -40 }, { type: 'espora_hielo', x: 6.5, z: -50 },
    { type: 'espora_hielo', x: -2, y: 5, z: -64 },
  ],
  boss: { type: 'sierpe', x: 0, y: 5, z: -90, orbit: 8.5, height: 6, flag: 'sierpe_vencida', region: [-13, 3, -100, 13, 14, -79] },
  regions: [
    { id: 'lago', box: [-9, -1, -53, 9, 3, -35], flag: 'llego_lago' },
    { id: 'mirador', box: [-5, 4.5, -71, 5, 8, -61], flag: 'llego_mirador' },
  ],

  chapterEnd: {
    kicker: 'Fin del capítulo 4', title: 'El aprendiz de Ilan',
    next: { label: 'Continuar: Capítulo 5', zone: 'ciudadela_orden', cp: 'llegada' },
  },

  story: {
    intro: [
      L(NARR, 'El dirigible desciende entre picos de hielo. Cada sonido vuelve tres veces, como si el glaciar respondiera.'),
      L(MARTA, 'El Glaciar del Eco. Brr. Tu abuelo decía que aquí se oyen las voces del pasado.'),
      L(MARTA, 'Y mira quién nos espera en el campamento... tu amigo el de la capucha.'),
    ],

    goal(S) {
      if (!S.has('escudo')) return { text: 'Habla con Kael en el campamento', at: [-1.5, 0, -17] };
      if (!S.has('hielo_puerta1')) return { text: 'Alza el escudo (V) y devuelve un orbe al ojo de hielo', at: [-2.6, 0, -27] };
      if (!S.has('llego_lago')) return { text: 'Cruza el puente hacia el lago helado', at: [0, 0, -38] };
      if (!S.has('hielo_puerta2')) return { text: 'Rompe el ojo de hielo junto a la rampa', at: [3.2, 0, -52.6] };
      if (!S.has('sierpe_vencida')) return S.bossActive ? { text: 'Devuelve sus orbes con el escudo y golpea su cuerno cuando caiga', at: null } : { text: 'Sube al mirador y cruza a la arena', at: [0, 5, -78] };
      if (!S.has('gran_fragmento_4')) return { text: 'Lanza el garfio al anillo para subir al santuario', at: [0, 7, -115] };
      return { text: 'Capítulo 4 completado. Vuelve con Marta cuando quieras.', at: [-3.2, 0, 6] };
    },

    bossIntro: [
      L(NARR, 'Un viento helado barre la arena. Algo largo y brillante se desenrosca en el cielo.'),
      L('Sierpe de Escarcha', 'Sssss... la nieta del guardián... trae lo que él escondió...'),
      L(KAEL, '¡Lía! ¡Sus orbes! ¡Devuélveselos con el escudo!', { who: KAEL }),
    ],
    bossDefeated: [
      L(NARR, 'La Sierpe se posa sobre el hielo y cierra los ojos. Una chispa vuela hasta la brújula.'),
      L(NARR, 'El eco del glaciar trae una voz: Ilan, joven, discutiendo con alguien.', { memory: true }),
      L('Ilan', 'Vaelor, escúchame. Si unimos el Corazón, la Orden lo usará para gobernar los vientos.', { memory: true }),
      L('Vaelor', 'Las islas se hunden, maestro. Sin el Corazón entero, un día caerán todas.', { memory: true }),
      L(NARR, 'Un anillo de amarre brilla sobre el borde de la arena.', { system: true }),
    ],
    onBossDefeated: S => { S.set('sierpe_vencida'); },

    talk: {
      marta_g(S) {
        if (!S.has('gran_fragmento_4')) return { lines: [L(MARTA, 'Abrígate, chiquilla. Y no te fíes del todo de ese muchacho... aunque parece sincero.')] };
        return {
          lines: [L(MARTA, 'Cuatro fragmentos. Siento cómo zumban desde aquí.'), L(LIA, 'Falta uno. Y ya sé quién lo tiene.')],
          then: () => S.chapterEnd(),
        };
      },
      kael_g(S) {
        if (!S.has('escudo')) return {
          lines: [
            L(KAEL, 'Te dije que la Orden vendría. Sus naves rondan el glaciar desde ayer.'),
            L(KAEL, 'Me fui con esto. Es el Escudo de Prisma: devuelve cualquier magia que te lancen.'),
            L(KAEL, 'Los ojos de hielo de este glaciar solo se rompen con su propia magia. El escudo es la única llave.'),
            L(NARR, 'Obtuviste el Escudo de Prisma: mantén V para bloquear. Los orbes rebotan hacia donde miras.', { system: true }),
          ],
          then: () => { S.set('escudo'); S.give('Escudo de Prisma'); },
        };
        if (!S.has('sierpe_vencida')) return { lines: [L(KAEL, 'La Sierpe vuela muy alto para tu bastón. Usa su propio aliento contra ella.')] };
        return { lines: [L(KAEL, 'Vaelor... era el aprendiz de tu abuelo. Por eso conoce cada escondite.')] };
      },
      gran_fragmento_g(S) {
        return {
          lines: [
            L(NARR, 'El cuarto fragmento descansa dentro de un bloque de hielo que se derrite al acercarte.'),
            L(KAEL, 'Lía... mira el horizonte.'),
            L(NARR, 'Entre las nubes asoma una fortaleza negra y dorada: la Ciudadela de la Orden.'),
            L(KAEL, 'Vaelor tiene el quinto fragmento. Y ahora viene por los tuyos.'),
            L(NARR, 'Obtuviste un Gran Fragmento del Corazón (4 de 5).', { system: true }),
          ],
          then: () => { S.set('gran_fragmento_4'); S.give('Gran Fragmento del Corazón'); S.chapterEnd(); },
        };
      },
    },
  },
};
