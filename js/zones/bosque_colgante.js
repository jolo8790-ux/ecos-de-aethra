// Capítulo 1 — El Bosque Colgante.
// Recorrido hacia -z: muelle → sendero de raíces → claro de las setas → plataforma alta → arena de la Raíz Madre → santuario.

const L = (who, text, extra = {}) => ({ who, text, ...extra });
const LIA = 'Lía', MARTA = 'Capitana Marta', KAEL = 'Kael', NARR = '';

export default {
  id: 'bosque_colgante',
  title: 'El Bosque Colgante',
  subtitle: 'Capítulo 1',
  seed: 11,
  sky: { top: 0x3f8a7a, bottom: 0xcfe8c8, fog: 0xa9d2b4, fogNear: 30, fogFar: 125 },
  light: { hemiSky: 0xd8f2d0, hemiGround: 0x4a5a3a, sun: 0xfff0c8 },
  water: { y: -14, color: 0xd8efe0 },
  start: { id: 'llegada', pos: [0, 0, 4], facing: 0 },

  // objetos que se rompen con el bastón (la geoda violeta guarda la Reliquia de Aethra de esta zona)
  breakables: [
    { id: 'reliquia_bosque_colgante', kind: 'cofre', x: 11.6, y: 1.2, z: -25.2, loot: 'reliquia' },
    { id: 'bosque_colgante_v1', kind: 'vasija', x: -5.5, y: 0, z: 6, loot: 'corazon' },
    { id: 'bosque_colgante_v2', kind: 'vasija', x: 5, y: 0, z: -30 },
    { id: 'bosque_colgante_v3', kind: 'vasija', x: -6, y: -2, z: -48, loot: 'corazon' },
  ],
  islands: [
    { x: 0, z: 2, w: 16, d: 16, top: 0, depth: 4 },                 // muelle del bosque
    { x: 0, z: -24, w: 14, d: 20, top: 0, depth: 4 },               // sendero de raíces
    { x: 0, z: -44, w: 17, d: 14, top: -2, depth: 4 },              // claro de las setas
    { x: 0, z: -57, w: 10, d: 8, top: 6, depth: 3 },                // plataforma alta
    { x: 0, z: -80, w: 24, d: 24, top: 6, depth: 5 },               // arena
    { x: 0, z: -105.5, w: 10, d: 10, top: 8, depth: 3 },            // santuario
    { x: 11, z: -24, w: 4, d: 4, top: 1.2, depth: 2 },              // islote escondido
  ],
  bridges: [
    { x1: 0, z1: -6, x2: 0, z2: -14.2, y: 0, w: 2.4 },
    { x1: 0, z1: -60.8, x2: 0, z2: -68.2, y: 6, w: 2.4 },
  ],
  ramps: [
    { x: 0, z: -36, w: 3.4, d: 4, y0: -2, y1: 0, axis: 'z', color: 0x7a5a3a },
  ],
  bigTrees: [
    { x: -12, z: -6 }, { x: 13, z: -18 }, { x: -13, z: -36, r: 2.8 }, { x: 14, z: -50 },
    { x: -15, z: -70, r: 3 }, { x: 16, z: -88, r: 2.6 }, { x: -14, z: -100 },
  ],
  mushrooms: [
    { x: 0, y: -2, z: -48.5, s: 1.3, bounce: 17.5 },                 // seta que rebota hacia la plataforma alta
    { x: 6, y: -2, z: -49, s: 1.6 },                                 // seta alta (fragmento encima)
    { x: -6.5, y: -2, z: -48, s: 0.8 }, { x: 5, y: 0, z: -18, s: 0.7 }, { x: -5, y: 0, z: -29, s: 0.9 },
    { x: 4, y: 6, z: -86, s: 0.8 }, { x: -9, y: 6, z: -76, s: 0.7 },
  ],
  rocks: [{ x: -4, z: -21 }, { x: 4.5, z: -27, s: 0.8 }, { x: 7, z: -73, y: 6, s: 1.2 }, { x: -7, z: -84, y: 6 }],
  trees: [{ x: 5, z: 6, s: 0.9 }, { x: -5.5, z: -2 }, { x: 5.5, z: -31, s: 0.8 }],
  airships: [{ id: 'dirigible', x: -1, y: 1.2, z: 13.5 }],

  signs: [
    {
      id: 'cartel_combate', x: 2.2, z: -15.5, rot: 0.4, title: 'Tablilla de explorador',
      lines: [
        'Criaturas de cristal más adelante. Brillan en rojo justo antes de atacar.',
        'Golpea con clic o J. Pulsa varias veces para encadenar tres golpes.',
        'Esquiva con clic derecho o K: durante la esquiva nada te hace daño.',
      ],
    },
    {
      id: 'cartel_setas', x: -3, y: -2, z: -40, rot: 0.2, title: 'Tablilla de explorador',
      lines: ['Las setas rosadas son elásticas. Cae sobre ellas desde arriba y salta en el aire para llegar más alto.'],
    },
  ],
  npcs: [
    { id: 'marta_b', name: MARTA, model: 'marta', x: -3.2, z: 6, rot: -0.6, lines: ['...'] },
    {
      id: 'kael_b', name: KAEL, model: 'kael', x: 2.5, y: 8, z: -103, rot: 0.4,
      when: S => S.has('raiz_vencida') && !S.has('kael_bosque'), lines: ['...'],
    },
  ],
  items: [
    { id: 'gran_fragmento', model: 'bigshard', x: 0, y: 8, z: -107, verb: 'Tomar el gran fragmento', when: S => !S.has('gran_fragmento_1') },
  ],
  lanterns: [
    { id: 'llegada', x: 3.2, z: 2.2, facing: 0 },
    { id: 'claro', x: -6, y: -2, z: -40, facing: 0 },
    { id: 'antesala', x: 3, y: 6, z: -55, facing: 0 },
    { id: 'santuario', x: -3, y: 8, z: -102, facing: 0 },
  ],
  fragments: [
    { id: 'bc_raices', x: -5.5, y: 0, z: -32 },
    { id: 'bc_seta', x: 6, y: 1.9, z: -49 },
    { id: 'bc_alto', x: -4, y: 6, z: -60 },
    { id: 'bc_islote', x: 11, y: 1.2, z: -24 },
    { id: 'bc_santuario', x: -3.5, y: 8, z: -108.5 },
  ],
  enemies: [
    { type: 'brote', x: -2.5, z: -21 }, { type: 'brote', x: 3, z: -26 }, { type: 'brote', x: -1, z: -31 },
    { type: 'espora', x: -5.5, y: -2, z: -45 }, { type: 'espora', x: 6, y: -2, z: -42 },
    { type: 'brote', x: 2, y: 6, z: -58 }, { type: 'brote', x: -2, y: 6, z: -56.5 },
  ],
  boss: { type: 'raiz', x: 0, y: 6, z: -88, flag: 'raiz_vencida', region: [-12, 4, -88, 12, 12, -70] },
  regions: [
    { id: 'claro', box: [-9, -3, -51, 9, 2, -37], flag: 'llego_claro' },
    { id: 'alto', box: [-5, 5.5, -61, 5, 9, -53], flag: 'llego_alto' },
  ],

  chapterEnd: {
    kicker: 'Fin del capítulo 1', title: 'El Gran Fragmento',
    next: { label: 'Continuar: Capítulo 2', zone: 'ruinas_vidrio', cp: 'llegada' },
  },

  story: {
    intro: [
      L(NARR, 'El dirigible desciende entre árboles tan altos que sus copas se pierden en las nubes.'),
      L(MARTA, 'El Bosque Colgante. Aquí las raíces crecen hacia el cielo y las islas cuelgan de ellas.'),
      L(LIA, 'La brújula apunta hacia lo profundo del bosque.'),
      L(MARTA, 'Entonces toma esto. Tu abuelo lo dejó en el dirigible antes de su último viaje.'),
      L(NARR, 'Obtuviste el Bastón de Ilan. Golpea con clic o J y esquiva con clic derecho o K.', { system: true }),
      L(MARTA, 'Las criaturas de cristal no son malas, chiquilla. Solo están asustadas. Pero muerden.'),
    ],
    onIntroEnd: S => { S.set('baston'); },

    goal(S) {
      if (!S.has('llego_claro')) return { text: 'Atraviesa el Sendero de raíces', at: [0, -2, -40] };
      if (!S.has('llego_alto')) return { text: 'Rebota en la seta rosada para subir a la plataforma alta', at: [0, -2, -48.5], auto: [0, 6, -57] };
      if (!S.has('raiz_vencida')) return S.bossActive ? { text: 'Golpea los nudos brillantes de las raíces de la Raíz Madre', at: null } : { text: 'Cruza el puente hacia el corazón del bosque', at: [0, 6, -72] };
      if (!S.has('gran_fragmento_1')) return { text: 'Usa el impulso aéreo para cruzar al santuario', at: [0, 8, -107] };
      return { text: 'Capítulo 1 completado. Busca los fragmentos que falten o vuelve con Marta.', at: null };
    },

    bossIntro: [
      L(NARR, 'El suelo tiembla. El tocón gigante del centro del claro abre los ojos.', { system: false }),
      L('Raíz Madre', '¿Quién... trae... la brújula... del guardián?'),
      L(LIA, '¡Espera! ¡No vengo a hacerte daño!'),
    ],
    bossDefeated: [
      L(NARR, 'La Raíz Madre se deshace en hojas de luz. Una chispa de cristal vuela hasta la brújula.'),
      L('Raíz Madre', 'El guardián... también vino... Ilan...', { memory: true }),
      L(NARR, 'Obtuviste el Impulso aéreo: en el aire, pulsa clic derecho o K para lanzarte hacia delante.', { system: true }),
    ],
    onBossDefeated: S => { S.set('raiz_vencida'); S.set('impulso'); },

    talk: {
      marta_b(S) {
        if (!S.has('raiz_vencida')) return { lines: [L(MARTA, 'Aquí te espero. Si las cosas se ponen feas, vuelve al farol y respira.')] };
        if (!S.has('gran_fragmento_1')) return { lines: [L(MARTA, '¿Sentiste ese temblor? Algo enorme se despertó... y se volvió a dormir.')] };
        return {
          lines: [L(MARTA, 'Ese fragmento brilla como un faro. ¿Lista para volver al dirigible?'), L(LIA, 'Lista.')],
          then: () => S.chapterEnd(),
        };
      },
      kael_b(S) {
        return {
          lines: [
            L(KAEL, 'Así que lo lograste. La Raíz Madre llevaba cien años dormida.'),
            L(KAEL, 'La Orden la dejó en paz a propósito. Tú la despertaste.'),
            L(LIA, '¡Ella me atacó primero!'),
            L(KAEL, 'Toma el fragmento. Pero pregúntate por qué tu abuelo rompió el Corazón en primer lugar.'),
          ],
          then: () => { S.set('kael_bosque'); S.effect('vanish', 'kael_b'); },
        };
      },
      gran_fragmento(S) {
        return {
          lines: [
            L(NARR, 'En el centro del santuario flota un cristal del tamaño de un puño. Late como un corazón.'),
            L(LIA, 'Es enorme... La aguja de la brújula ya no tiembla. Se quedó quieta, apuntando aquí.'),
            L(NARR, 'Obtuviste un Gran Fragmento del Corazón (1 de 5).', { system: true }),
          ],
          then: () => { S.set('gran_fragmento_1'); S.give('Gran Fragmento del Corazón'); S.chapterEnd(); },
        };
      },
    },
  },
};
