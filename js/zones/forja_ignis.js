// Capítulo extra 2 — Las Forjas de Ignis (se abre al terminar la historia).
// Isla volcánica sobre un mar de lava. Recorrido hacia -z:
// llegada → puente de rocas que se desploman → taller de Brasa → saltos entre bocas de fuego → fragua
// → puente de las mazas (péndulos) → ascenso por rocas que caen → cráter → último puente → altar del Corazón de la Forja.

const L = (who, text, extra = {}) => ({ who, text, ...extra });
const LIA = 'Lía', MARTA = 'Capitana Marta', BRASA = 'Brasa, la herrera', NARR = '';

export default {
  id: 'forja_ignis',
  title: 'Las Forjas de Ignis',
  subtitle: 'Capítulo extra 2',
  seed: 91,
  sky: { top: 0x1a0606, bottom: 0xff6a2a, fog: 0x4a1c10, fogNear: 30, fogFar: 150 },
  light: { hemiSky: 0xffb48a, hemiGround: 0x3a1208, sun: 0xffb070 },
  palette: { top: 0x5a4440, side: 0x2a1a18 },
  lava: { y: -7 },
  water: { y: -7 },
  embers: { n: 220, area: 90, y0: -6, y1: 24, cx: 0, cz: -70 },
  start: { id: 'llegada', pos: [0, 0, 3], facing: 0 },

  islands: [
    { x: 0, z: 0, w: 16, d: 14, top: 0, depth: 4 },            // llegada
    { x: 0, z: -27.8, w: 14, d: 12, top: 0, depth: 4 },        // taller de Brasa
    { x: 0, z: -38.5, w: 3.4, d: 3.4, top: 1, depth: 6 },      // bocas de fuego: tres rocas
    { x: 2.5, z: -45, w: 3.4, d: 3.4, top: 2, depth: 7 },
    { x: 0, z: -51.5, w: 3.4, d: 3.4, top: 3, depth: 8 },
    { x: 0, z: -58, w: 10, d: 6, top: 3, depth: 5 },           // fragua
    { x: 0, z: -84, w: 8, d: 8, top: 3, depth: 5 },            // plataforma de ceniza
    { x: -8.5, z: -86, w: 3, d: 3, top: 12, depth: 3 },        // cornisa alta (corriente de aire)
    { x: 0, z: -116, w: 22, d: 18, top: 10.2, depth: 6 },      // cráter
    { x: 0, z: -142, w: 8, d: 8, top: 10.2, depth: 5 },        // altar
    { x: 9, z: -46, w: 3, d: 3, top: 1, depth: 3 },            // islote escondido (reliquia)
  ],
  crumbles: [
    // puente de rocas rojas: se desploman un momento después de pisarlas
    { x: 0, y: 0, z: -8.6 }, { x: 0.6, y: 0, z: -11.5 }, { x: -0.4, y: 0, z: -14.4 }, { x: 0.4, y: 0, z: -17.3 }, { x: 0, y: 0, z: -20.2 },
    // ascenso al cráter
    { x: 3, y: 4.2, z: -91 }, { x: 0, y: 5.4, z: -94.4 }, { x: -3, y: 6.6, z: -97.8 }, { x: 0, y: 7.8, z: -101.2 }, { x: 3, y: 9, z: -104.6 },
    // último puente, con fuego entre roca y roca
    { x: 0, y: 10.2, z: -126.7 }, { x: 1.5, y: 10.2, z: -131.4 }, { x: 0, y: 10.2, z: -136.1 },
  ],
  fireJets: [
    { x: 4.5, y: 0, z: -30.5, h: 5, period: 3, on: 1.1, phase: 0 },              // demostración en el taller
    { pillar: 16, x: 0, y: -3, z: -35.3, h: 8, period: 3, on: 1.1, phase: 0 },               // bajo los saltos
    { pillar: 16, x: 1.25, y: -2.5, z: -41.75, h: 8, period: 3, on: 1.1, phase: 1 },
    { pillar: 16, x: 1.25, y: -2, z: -48.25, h: 8, period: 3, on: 1.1, phase: 2 },
    { x: -6, y: 10.2, z: -111, h: 5, period: 3.4, on: 1.2, phase: 0 },           // cráter
    { x: 6, y: 10.2, z: -113, h: 5, period: 3.4, on: 1.2, phase: 1.1 },
    { x: -5, y: 10.2, z: -120, h: 5, period: 3.4, on: 1.2, phase: 2.2 },
    { x: 5.5, y: 10.2, z: -121, h: 5, period: 3.4, on: 1.2, phase: 0.6 },
    { pillar: 16, x: 0, y: 6.2, z: -129.1, h: 7, period: 2.8, on: 1, phase: 0 },             // último puente
    { pillar: 16, x: 0.75, y: 6.2, z: -133.75, h: 7, period: 2.8, on: 1, phase: 1.4 },
  ],
  pendulums: [
    { x: 0, y: 9.2, z: -65, len: 5, axis: 'x', amp: 0.75, post: 16.2, speed: 1.9, phase: 0 },
    { x: 0, y: 9.2, z: -70, len: 5, axis: 'x', amp: 0.75, post: 16.2, speed: 1.9, phase: 1.6 },
    { x: 0, y: 9.2, z: -75, len: 5, axis: 'x', amp: 0.75, post: 16.2, speed: 2.2, phase: 3.1 },
  ],
  bridges: [{ x1: 0, z1: -61, x2: 0, z2: -80, y: 3, w: 2.4 }],
  updrafts: [{ x: -2.6, z: -86, y0: 3, y1: 16, r: 1.5, color: 0xffa050 }],
  crystals: [
    { x: -5.5, z: -3, s: 1, color: 0xff7a3a }, { x: 6, z: -24, s: 1.1, color: 0xffa040 }, { x: -4, y: 3, z: -60, s: 0.9, color: 0xff5a2a },
    { x: 9, y: 10.2, z: -108, s: 1.3, color: 0xffb040 }, { x: -9.5, y: 10.2, z: -124, s: 1.2, color: 0xff6a2a }, { x: 3, y: 10.2, z: -145, s: 1, color: 0xffd070 },
  ],
  obelisks: [{ x: -5.5, z: -22.8, h: 3.5 }, { x: 5.5, z: -22.8, h: 3.5 }, { x: -3.5, y: 10.2, z: -138.6, h: 5 }, { x: 3.5, y: 10.2, z: -138.6, h: 5 }],
  rocks: [{ x: 6, z: 4 }, { x: -6, z: -32 }, { x: 8, y: 10.2, z: -118 }],
  airships: [{ id: 'dirigible', x: -1, y: 1.2, z: 9.5 }],
  breakables: [
    { id: 'reliquia_forja_ignis', kind: 'cofre', x: 9, y: 1, z: -46.3, loot: 'reliquia' },
    { id: 'forja_v1', kind: 'vasija', x: 5, y: 0, z: -24.5, loot: 'corazon' },
    { id: 'forja_v2', kind: 'vasija', x: 3, y: 3, z: -86.5 },
    { id: 'forja_v3', kind: 'vasija', x: 8.5, y: 10.2, z: -123, loot: 'corazon' },
  ],
  signs: [
    { id: 'cartel_forja', x: 2.8, z: -6, rot: -0.2, title: 'Aviso de la herrera', lines: ['"¡Las rocas rojas no aguantan! Písalas y sigue corriendo."'] },
    { id: 'cartel_fuego', x: -3, z: -33, rot: 0.3, title: 'Aviso de la herrera', lines: ['"Las bocas de lava brillan antes de escupir fuego. Cuenta: brillo, llamarada, calma… ¡ahora salta!"'] },
  ],
  npcs: [
    { id: 'marta_f', name: MARTA, model: 'marta', x: -3.2, z: 4, rot: -0.6, lines: ['...'] },
    { id: 'brasa', name: BRASA, model: 'brasa', x: -3, z: -26, rot: 0.5, lines: ['...'] },
  ],
  items: [
    { id: 'corazon_forja', model: 'bigshard', x: 0, y: 10.2, z: -143, verb: 'Tomar el Corazón de la Forja', when: S => !S.has('corazon_forja') },
  ],
  lanterns: [
    { id: 'llegada', x: 3.2, z: 1.5, facing: 0 },
    { id: 'taller', x: -4.5, z: -31, facing: 0 },
    { id: 'fragua', x: 4, y: 3, z: -57, facing: 0 },
    { id: 'ceniza', x: 3, y: 3, z: -81.5, facing: 0 },
    { id: 'crater', x: -6.5, y: 10.2, z: -109, facing: 0 },
  ],
  fragments: [
    { id: 'fi_puente', x: -0.4, z: -14.4 },
    { id: 'fi_fuego', x: 1.25, y: 2.6, z: -41.75 },
    { id: 'fi_mazas', x: 0, y: 3, z: -72.5 },
    { id: 'fi_cornisa', x: -8.5, y: 12, z: -86 },
    { id: 'fi_crater', x: -9, y: 10.2, z: -119 },
  ],
  enemies: [
    { type: 'brote', x: 3, z: -29 },
    { type: 'sombra', x: -3, y: 10.2, z: -114 }, { type: 'sombra', x: 3, y: 10.2, z: -117 },
    { type: 'centinela', x: 0, y: 10.2, z: -121 },
    { type: 'avispa', x: 0, y: 8, z: -94, r: 3.2 },
  ],
  regions: [
    { id: 'fragua', box: [-5, 2.5, -61, 5, 7, -55], flag: 'llego_fragua' },
    { id: 'ceniza', box: [-4, 2.5, -88, 4, 7, -80], flag: 'llego_ceniza' },
    { id: 'crater', box: [-11, 9.7, -125, 11, 15, -107], flag: 'llego_crater' },
  ],

  chapterEnd: {
    kicker: 'Fin del capítulo extra 2', title: 'El fuego que enseña',
    sub: 'Las rocas caen, el fuego se apaga y vuelve. Lo que queda es lo que aprendiste a cruzar.',
    next: { label: 'Capítulo extra 3: Las Profundidades de Mareth', zone: 'abismo_mareth', cp: 'muelle' },
  },

  story: {
    intro: [
      L(NARR, 'Tras el Eco, la brújula se vuelve loca y señala una isla roja que humea en el horizonte.'),
      L(MARTA, 'Ignis, la isla de las forjas. Dicen que allí se fundió el primer cristal del Corazón. Agárrate, que hace calor.'),
      L(LIA, 'El suelo cruje... y debajo solo hay lava. Habrá que ir rápido.'),
    ],

    goal(S) {
      if (!S.has('hablo_brasa')) return { text: 'Cruza las rocas que se desmoronan hasta el taller. ¡No te detengas!', at: [-3, 0, -26] };
      if (!S.has('llego_fragua')) return { text: 'Salta entre las bocas de fuego hasta la fragua: espera a que se apaguen', at: [0, 3, -57] };
      if (!S.has('llego_ceniza')) return { text: 'Cruza el puente de las mazas sin que te golpeen', at: [0, 3, -83] };
      if (!S.has('llego_crater')) return { text: 'Sube por las rocas flotantes hasta el cráter', at: [0, 10.2, -110] };
      if (!S.has('corazon_forja')) return { text: 'Corre por el último puente hasta el altar y toma el Corazón de la Forja', at: [0, 10.2, -142] };
      return { text: 'Capítulo extra 2 completado. Vuelve con Marta', at: [-3.2, 0, 4] };
    },

    talk: {
      marta_f(S) {
        if (!S.has('corazon_forja')) return { lines: [L(MARTA, 'Yo me quedo con el dirigible. Si te quemas las botas, te compro unas nuevas.')] };
        return { lines: [L(MARTA, '¡Ese brillo se ve desde aquí! Sube, que el casco se está derritiendo.')], then: () => S.chapterEnd() };
      },
      brasa(S) {
        if (!S.has('hablo_brasa')) return {
          lines: [
            L(BRASA, '¡Una visitante! Y cruzaste mi puente de rocas sin caerte a la lava. Me caes bien.'),
            L(LIA, '¿Siempre se desmoronan así?'),
            L(BRASA, 'Siempre. Y vuelven a salir al rato. Por eso aquí nadie camina despacio.'),
            L(BRASA, 'Más allá, las bocas de lava escupen fuego. Primero brillan, luego rugen, luego descansan. Salta cuando descansen.'),
            L(BRASA, 'Y en el puente de la fragua cuelgan mis mazas viejas. No te pares debajo. En el altar del cráter late el Corazón de la Forja: tráelo si te atreves.'),
          ],
          then: () => S.set('hablo_brasa'),
        };
        if (!S.has('corazon_forja')) return { lines: [L(BRASA, 'Brillo, rugido, calma. Brillo, rugido, calma. ¡Y corre!')] };
        return { lines: [L(BRASA, 'Pocas manos han sostenido ese corazón. Las tuyas no tiemblan.')] };
      },
      corazon_forja(S) {
        return {
          lines: [
            L(NARR, 'Un cristal rojo y dorado, tibio como una brasa que no quema. Late al mismo ritmo que el fuego del cráter.'),
            L(LIA, 'Es como el Corazón de Aethra... pero con fuego dentro.'),
            L(NARR, 'Obtuviste el Corazón de la Forja.', { system: true }),
          ],
          then: () => { S.set('corazon_forja'); S.give('Corazón de la Forja'); S.logro && S.logro('forja'); S.chapterEnd(); },
        };
      },
    },
  },
};
