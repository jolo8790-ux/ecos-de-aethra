// Capítulo 2 — Las Ruinas de Vidrio.
// Recorrido hacia -z: muelle → campamento de Tomás (planeador) → abismo (planear) → patio hundido → corriente de aire → terraza → arena del Escorpión → santuario.

const L = (who, text, extra = {}) => ({ who, text, ...extra });
const LIA = 'Lía', MARTA = 'Capitana Marta', KAEL = 'Kael', TOMAS = 'Tomás', NARR = '';

export default {
  id: 'ruinas_vidrio',
  title: 'Las Ruinas de Vidrio',
  subtitle: 'Capítulo 2',
  seed: 23,
  sky: { top: 0xd06a4a, bottom: 0xffd8a0, fog: 0xf2c08a, fogNear: 35, fogFar: 150 },
  light: { hemiSky: 0xffe2c0, hemiGround: 0x7a5a3a, sun: 0xffd09a },
  palette: { top: 0xe8c890, side: 0xb8885a },
  water: { y: -16, color: 0xffe0b8 },
  start: { id: 'llegada', pos: [0, 0, 4], facing: 0 },

  // objetos que se rompen con el bastón (la geoda violeta guarda la Reliquia de Aethra de esta zona)
  breakables: [
    { id: 'reliquia_ruinas_vidrio', kind: 'cofre', x: -15.2, y: 1, z: -45.2, loot: 'reliquia' },
    { id: 'ruinas_vidrio_v1', kind: 'vasija', x: 6, y: 0, z: -17, loot: 'corazon' },
    { id: 'ruinas_vidrio_v2', kind: 'vasija', x: -6, y: -3, z: -52 },
    { id: 'ruinas_vidrio_v3', kind: 'vasija', x: 4.5, y: 8, z: -60, loot: 'corazon' },
  ],
  islands: [
    { x: 0, z: 2, w: 16, d: 16, top: 0, depth: 4 },          // muelle
    { x: 0, z: -20, w: 16, d: 14, top: 0, depth: 4 },        // campamento
    { x: 0, z: -48, w: 16, d: 14, top: -3, depth: 4 },       // patio hundido (tras el abismo)
    { x: 0, z: -62, w: 12, d: 10, top: 8, depth: 4 },        // terraza alta
    { x: 0, z: -87, w: 26, d: 26, top: 8, depth: 5 },        // arena
    { x: 0, z: -114, w: 10, d: 10, top: 16, depth: 3 },      // santuario
    { x: -14, z: -44, w: 5, d: 5, top: 1, depth: 2 },        // islote del oasis
  ],
  bridges: [
    { x1: 0, z1: -6, x2: 0, z2: -12.8, y: 0, w: 2.4 },
    { x1: 0, z1: -67.2, x2: 0, z2: -73.8, y: 8, w: 2.4 },
  ],
  updrafts: [
    { x: 4.5, z: -52.5, y0: -3, y1: 13, r: 2.2 },                                       // sube a la terraza
    { x: 0, z: -99.5, y0: 8, y1: 23, r: 2.4, when: S => S.has('escorpion_vencido') },  // sube al santuario
  ],
  pillars: [
    { x: -7, z: -80, y: 8 }, { x: 7, z: -80, y: 8 }, { x: -8, z: -93, y: 8 }, { x: 8, z: -93, y: 8 },
    { x: 0, z: -78, y: 8 }, { x: -3, z: -96, y: 8 },
  ],
  arches: [
    { x: 0, z: -13.5, y: 0, w: 4 }, { x: 0, z: -57.5, y: 8, w: 4 }, { x: 0, z: -110, y: 16, w: 4 },
  ],
  columns: [
    { x: -6, z: -2, h: 3.5 }, { x: 6, z: 7, h: 2, broken: true },
    { x: -6, z: -45, y: -3, h: 4 }, { x: 6.5, z: -43, y: -3, h: 2.5, broken: true }, { x: -5, z: -64, y: 8, h: 3 },
    { x: -11, z: -98, y: 8, h: 4 }, { x: 11, z: -76, y: 8, h: 3, broken: true },
  ],
  crystals: [
    { x: 5, z: -1, s: 0.9, color: 0xffc86a }, { x: -6, z: -26, s: 1.1 }, { x: -5, z: -53, y: -3, s: 1.3, color: 0xffc86a },
    { x: 10, z: -100, y: 8, s: 1.2 }, { x: -10, z: -76, y: 8, s: 1, color: 0xffc86a }, { x: -14, z: -44, y: 1, s: 0.7 },
  ],
  tents: [{ x: -4.5, z: -21, rot: 0.3 }],
  rocks: [{ x: 4, z: -24, s: 0.9 }, { x: 3, z: -45, y: -3 }],
  airships: [{ id: 'dirigible', x: -1, y: 1.2, z: 13.5 }],

  signs: [
    {
      id: 'cartel_abismo', x: 2.5, z: -26, rot: -0.3, title: 'Nota de Tomás',
      lines: ['El puente se cayó hace siglos. Salta y mantén pulsado el salto para planear hasta el patio.'],
    },
    {
      id: 'cartel_viento', x: 1.5, y: -3, z: -50, rot: 0.2, title: 'Nota de Tomás',
      lines: ['Las columnas de viento suben desde las grietas. Planea dentro de una y te llevará hacia arriba.'],
    },
    {
      id: 'cartel_arena', x: 3, y: 8, z: -64, rot: 0.3, title: 'Inscripción antigua',
      lines: ['"El guardián de las arenas embiste ciego. Que el vidrio lo detenga."'],
    },
  ],
  npcs: [
    { id: 'marta_r', name: MARTA, model: 'marta', x: -3.2, z: 6, rot: -0.6, lines: ['...'] },
    { id: 'tomas_r', name: TOMAS, model: 'tomas', x: -1.5, z: -17.5, rot: 0.6, lines: ['...'] },
    {
      id: 'kael_r', name: KAEL, model: 'kael', x: 2.5, y: 16, z: -112, rot: 0.4,
      when: S => S.has('escorpion_vencido') && !S.has('kael_ruinas'), lines: ['...'],
    },
  ],
  items: [
    { id: 'planeador', model: 'glider', x: -3, z: -24.2, verb: 'Tomar el planeador', when: S => S.has('tomas_hablo') && !S.has('planeador') },
    { id: 'gran_fragmento_r', model: 'bigshard', x: 0, y: 16, z: -116, verb: 'Tomar el gran fragmento', when: S => !S.has('gran_fragmento_2') },
  ],
  lanterns: [
    { id: 'llegada', x: 3.2, z: 2.2, facing: 0 },
    { id: 'campamento', x: 4, z: -16, facing: 0 },
    { id: 'patio', x: -5, y: -3, z: -50, facing: 0 },
    { id: 'terraza', x: 3.5, y: 8, z: -60, facing: 0 },
    { id: 'santuario', x: -3, y: 16, z: -111, facing: 0 },
  ],
  fragments: [
    { id: 'rv_tienda', x: -7, z: -15 },
    { id: 'rv_oasis', x: -14, y: 1, z: -44 },
    { id: 'rv_viento', x: 4.5, y: 11, z: -52.5 },
    { id: 'rv_terraza', x: -4.5, y: 8, z: -66 },
    { id: 'rv_santuario', x: 3.5, y: 16, z: -117 },
  ],
  enemies: [
    { type: 'brote_vidrio', x: 3, z: -22 }, { type: 'espora_vidrio', x: 5.5, z: -26 },
    { type: 'brote_vidrio', x: -3, y: -3, z: -46 }, { type: 'brote_vidrio', x: 3, y: -3, z: -44 }, { type: 'espora_vidrio', x: -6, y: -3, z: -53 },
    { type: 'brote_vidrio', x: -2, y: 8, z: -63 },
  ],
  boss: { type: 'escorpion', x: 0, y: 8, z: -92, flag: 'escorpion_vencido', region: [-13, 6, -99, 13, 14, -77], arena: [0, -87, 13] },
  regions: [
    { id: 'patio', box: [-8, -4, -55, 8, 0, -41], flag: 'llego_patio' },
    { id: 'terraza', box: [-6, 7.5, -67, 6, 11, -57], flag: 'llego_terraza' },
  ],

  chapterEnd: {
    kicker: 'Fin del capítulo 2', title: 'El viento de las ruinas',
    next: { label: 'Continuar: Capítulo 3', zone: 'ciudad_engranajes', cp: 'llegada' },
  },

  story: {
    intro: [
      L(NARR, 'El dirigible cruza un mar de arena dorada suspendido entre las nubes. Columnas de vidrio brillan al atardecer.'),
      L(MARTA, 'Las Ruinas de Vidrio. Aquí vivía la gente que fundió el Corazón de Aethra, hace mil años.'),
      L(LIA, 'Hay humo en el campamento de allí. ¿Alguien vive aquí?'),
      L(MARTA, 'Tomás. Un arqueólogo testarudo, viejo amigo de tu abuelo. Ve a saludarlo de mi parte.'),
    ],

    goal(S) {
      if (!S.has('tomas_hablo')) return { text: 'Habla con Tomás en el campamento', at: [-1.5, 0, -17.5] };
      if (!S.has('planeador')) return { text: 'Toma el planeador junto a la tienda', at: [-3, 0, -24.2] };
      if (!S.has('llego_patio')) return { text: 'Salta al abismo y mantén el salto para planear', at: [0, -3, -44] };
      if (!S.has('llego_terraza')) return { text: 'Planea dentro de la columna de viento para subir', at: [4.5, -3, -52.5], auto: [0, 8, -62] };
      if (!S.has('escorpion_vencido')) return S.bossActive ? { text: 'Haz que embista contra un pilar y golpea el cristal de su cola', at: null } : { text: 'Cruza el puente hacia la arena', at: [0, 8, -76] };
      if (!S.has('gran_fragmento_2')) return { text: 'Sube al santuario con la nueva columna de viento', at: [0, 8, -99.5], auto: [0, 16, -113] };
      return { text: 'Capítulo 2 completado. Vuelve con Marta cuando quieras zarpar.', at: [-3.2, 0, 6] };
    },

    bossIntro: [
      L(NARR, 'La arena se agita. Algo enorme y transparente se alza entre los pilares.'),
      L('Escorpión Prisma', 'Krrrr... la brújula... huele a Ilan...'),
      L(LIA, 'Es de vidrio... Si choca contra esos pilares tal vez se aturda.'),
    ],
    bossDefeated: [
      L(NARR, 'El Escorpión se queda quieto y su caparazón se apaga, como una lámpara. Una chispa vuela hasta la brújula.'),
      L(NARR, 'Por un instante ves a un hombre joven con el bastón, de pie en esta misma arena: tu abuelo.', { memory: true }),
      L('Ilan', 'Perdóname, viejo amigo. Tenía que esconderlo donde nadie lo buscara.', { memory: true }),
      L(NARR, 'Del suelo de la arena brota una nueva columna de viento.', { system: true }),
    ],
    onBossDefeated: S => { S.set('escorpion_vencido'); },

    talk: {
      marta_r(S) {
        if (!S.has('gran_fragmento_2')) return { lines: [L(MARTA, 'El calor aquí es peor que en la cocina del dirigible. Ten cuidado, chiquilla.')] };
        return {
          lines: [L(MARTA, 'Dos fragmentos. Ilan estaría orgulloso... y un poco preocupado.'), L(LIA, 'Vamos. La brújula apunta a la ciudad de las torres.')],
          then: () => S.chapterEnd(),
        };
      },
      tomas_r(S) {
        if (!S.has('tomas_hablo')) return {
          lines: [
            L(TOMAS, '¿Lía? ¡Por todos los vientos, eres igual a Ilan cuando tenía tu edad!'),
            L(TOMAS, 'Así que buscas los fragmentos del Corazón. Él también vino aquí, ¿sabes? Hace cuarenta años.'),
            L(TOMAS, 'El puente al patio se cayó. Pero tu abuelo dejó su planeador en mi tienda. Llévatelo.'),
          ],
          then: () => S.set('tomas_hablo'),
        };
        if (!S.has('escorpion_vencido')) return { lines: [L(TOMAS, 'Las criaturas de aquí están hechas del mismo vidrio que las ruinas. Golpéalas antes de que brillen.')] };
        return { lines: [L(TOMAS, '¿El Escorpión Prisma? ¿Despierto? Ilan lo durmió con una canción... Tú lo hiciste a bastonazos. También vale.')] };
      },
      planeador(S) {
        return {
          lines: [
            L(NARR, 'Un planeador de tela con armazón de madera. En el borde hay iniciales bordadas: "I. y M."'),
            L(NARR, 'Obtuviste el Planeador: en el aire, mantén pulsado el salto para planear.', { system: true }),
          ],
          then: () => { S.set('planeador'); S.give('Planeador de Ilan'); },
        };
      },
      kael_r(S) {
        return {
          lines: [
            L(KAEL, 'Viste el recuerdo, ¿verdad? Tu abuelo escondió los fragmentos a propósito.'),
            L(LIA, '¿Por qué lo haría? El Corazón sostiene las islas. Sin él se caen.'),
            L(KAEL, 'Eso dice la Orden. Pero las islas no se han caído en cuarenta años, ¿o sí?'),
            L(KAEL, 'En la Ciudad de Engranajes guardan los diarios de Ilan. Léelos antes de juntar el siguiente.'),
          ],
          then: () => { S.set('kael_ruinas'); S.effect('vanish', 'kael_r'); },
        };
      },
      gran_fragmento_r(S) {
        return {
          lines: [
            L(NARR, 'El segundo gran fragmento flota sobre un altar de vidrio fundido. Al tocarlo, la brújula zumba.'),
            L(LIA, 'Dos... Kael dice que el abuelo los escondió. Pero ¿de quién?'),
            L(NARR, 'Obtuviste un Gran Fragmento del Corazón (2 de 5).', { system: true }),
          ],
          then: () => { S.set('gran_fragmento_2'); S.give('Gran Fragmento del Corazón'); S.chapterEnd(); },
        };
      },
    },
  },
};
