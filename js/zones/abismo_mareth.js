// Capítulo extra 3 — Las Profundidades de Mareth (se abre al terminar la historia).
// Un muelle flotante en mitad del mar. Bajo el agua: llanura de arena con una cúpula de aire, bosque de algas
// con medusas, la ciudad hundida (cúpula, Nerea y el submarino), el Cañón de los Tiburones con la guarida del Pulpo Rey, la Fosa Abisal (corrientes y muros de coral:
// solo el submarino pasa) y el templo con la Perla de Mareth.
// Se nada con el movimiento; Espacio / ✕ sube y K / ○ baja. Bajo el agua el aire se acaba: burbujas, cúpulas y superficie lo devuelven.

const L = (who, text, extra = {}) => ({ who, text, ...extra });
const LIA = 'Lía', MARTA = 'Capitana Marta', NEREA = 'Nerea, la buzo', NARR = '';

export default {
  id: 'abismo_mareth',
  title: 'Las Profundidades de Mareth',
  subtitle: 'Capítulo extra 3',
  seed: 131,
  sky: { top: 0x3aa8ff, bottom: 0xd8f6ff, fog: 0xbfe8ff, fogNear: 60, fogFar: 260 },
  light: { hemiSky: 0xe0f6ff, hemiGround: 0x2a6a80, sun: 0xfff2d8 },
  palette: { top: 0xe8d6a0, side: 0xb89a62 },
  flagPrefix: 'mr_',
  start: { id: 'muelle', pos: [0, 1, 6], facing: 0 },

  islands: [
    { x: 0, z: 4, w: 12, d: 10, top: 1, depth: 2.5 },                 // muelle flotante
    { x: 0, z: -30, w: 70, d: 80, top: -18, depth: 4 },               // llanura de arena
    { x: 0, z: -82, w: 70, d: 28, top: -26, depth: 4 },               // ciudad hundida
    { x: 0, z: -160, w: 20, d: 130, top: -40, depth: 4 },             // suelo de la Fosa
    { x: -35, z: -160, w: 50, d: 130, top: -14, depth: 30 },          // paredes de roca de la Fosa
    { x: 35, z: -160, w: 50, d: 130, top: -14, depth: 30 },
    { x: 0, z: -162, w: 20.5, d: 126, top: -14, depth: 6 },           // techo de la Fosa
    { x: 0, z: -240, w: 40, d: 30, top: -40, depth: 4 },              // explanada del templo
    { x: 62, z: -82, w: 56, d: 22, top: -30, depth: 4 },              // Cañón de los Tiburones (al este de la ciudad)
    { x: 62, z: -97, w: 58, d: 8, top: -17, depth: 17 },             // paredes del cañón
    { x: 62, z: -67, w: 58, d: 8, top: -17, depth: 17 },
    { x: 93, z: -82, w: 6, d: 38, top: -14, depth: 20 },              // fondo de la guarida del Pulpo Rey
  ],
  columns: [{ x: -14, y: -26, z: -76, h: 7 }, { x: -18, y: -26, z: -84, h: 5 }, { x: 15, y: -26, z: -74, h: 6 }, { x: 20, y: -26, z: -88, h: 4 }, { x: -6, y: -40, z: -248, h: 9 }, { x: 6, y: -40, z: -248, h: 9 }],
  arches: [{ x: 0, y: -26, z: -70, rot: 0 }, { x: 0, y: -40, z: -229, rot: 0 }, { x: 36, y: -30, z: -82, rot: Math.PI / 2 }, { x: 80, y: -30, z: -82, rot: Math.PI / 2 }],
  houses: [{ x: -20, base: -26, z: -76, w: 5, d: 5, h: 3 }, { x: 22, base: -26, z: -82, w: 4, d: 6, h: 3.5 }],
  airships: [{ id: 'dirigible', x: -1, y: 2.2, z: 11.5 }],
  npcs: [
    { id: 'marta_m', name: MARTA, model: 'marta', x: -3.2, y: 1, z: 5, rot: -0.6, lines: ['...'] },
    { id: 'nerea', name: NEREA, model: 'nerea', x: -2.5, y: -26, z: -83, rot: 0.6, lines: ['...'] },
  ],
  items: [
    { id: 'helice', model: 'helice', x: 87, y: -30, z: -82, verb: 'Tomar la hélice', when: S => S.has('mr_pulpo') && !S.has('mr_helice') },
    { id: 'submarino', model: 'none', x: 9, y: -26, z: -91, verb: 'Subir al submarino', when: S => S.has('mr_helice') && !S.has('mr_sub') },
    { id: 'amarre', model: 'none', x: 0, y: -37, z: -227, verb: 'Salir del submarino', when: S => S.has('mr_sub') && !S.has('mr_fosa') },
    { id: 'perla_mareth', model: 'bigshard', x: 0, y: -40, z: -242.6, verb: 'Tomar la Perla de Mareth', when: S => !S.has('perla_mareth') },
  ],
  lanterns: [
    { id: 'muelle', x: 3.4, y: 1, z: 2.5, facing: 0 },
    { id: 'cupula1', x: 2.5, y: -18, z: -28, facing: 0 },
    { id: 'cupula2', x: 3, y: -26, z: -80, facing: 0 },
    { id: 'canon', x: 38, y: -30, z: -76, facing: -Math.PI / 2 },
    { id: 'templo', x: 4, y: -40, z: -238, facing: 0 },
  ],
  fragments: [
    { id: 'ab_algas', x: -6, y: -17, z: -50 },
    { id: 'ab_arena', x: 9, y: -14, z: -36 },
    { id: 'ab_ciudad', x: -15, y: -25, z: -87 },
    { id: 'ab_fosa', x: -5, y: -32, z: -150 },
    { id: 'ab_templo', x: 5, y: -40, z: -244 },
  ],
  breakables: [
    { id: 'reliquia_abismo_mareth', kind: 'cofre', x: -21, y: -26, z: -90, loot: 'reliquia' },
    { id: 'mr_v1', kind: 'vasija', x: 4, y: -18, z: -33, loot: 'corazon' },
    { id: 'mr_v2', kind: 'vasija', x: -4, y: -40, z: -237, loot: 'corazon' },
    { id: 'mr_v3', kind: 'vasija', x: 40, y: -30, z: -88, loot: 'corazon' },
    { id: 'mr_v4', kind: 'vasija', x: 84, y: -30, z: -90, loot: 'corazon' },
  ],
  signs: [{ id: 'cartel_mareth', x: 2.6, y: 1, z: 7, rot: -0.3, title: 'Muelle de Mareth', lines: ['"Bajo el agua el aire se acaba: busca burbujas, cúpulas o sube a la superficie."', 'Espacio / ✕: subir · K / ○: bajar'] }],
  regions: [
    { id: 'cupula1', box: [-6, -18.5, -36, 6, -12, -24], flag: 'mr_cupula1' },
    { id: 'cupula2', box: [-7, -26.5, -89, 7, -19, -75], flag: 'mr_cupula2' },
  ],

  sea: {
    surface: 0,
    subAt: [9, -26, -91, Math.PI],
    domes: [{ x: 0, y: -18, z: -30, r: 7 }, { x: 0, y: -26, z: -82, r: 8 }, { x: 0, y: -40, z: -240, r: 9 }],
    bubbles: [
      { x: 0, y: -4, z: -5 }, { x: 1.5, y: -9, z: -13 }, { x: -1, y: -14, z: -20 },
      { x: 3, y: -14, z: -44 }, { x: -3, y: -12, z: -53 }, { x: 2, y: -16, z: -62, big: true },
      { x: -8, y: -22, z: -71 }, { x: 8, y: -21, z: -74 }, { x: -12, y: -22, z: -88 },
      { x: 0, y: -35, z: -230, big: true }, { x: 12, y: -10, z: -40 }, { x: -12, y: -12, z: -30 },
      { x: 44, y: -27, z: -76 }, { x: 57, y: -23, z: -86 }, { x: 69, y: -28, z: -77 }, { x: 82, y: -24, z: -88, big: true },
    ],
    kelp: [
      { x: -8, y: -18, z: -40, h: 9 }, { x: 8, y: -18, z: -42, h: 10 }, { x: -4, y: -18, z: -48, h: 11 }, { x: 6, y: -18, z: -52, h: 9 },
      { x: -9, y: -18, z: -56, h: 12 }, { x: 3, y: -18, z: -60, h: 10 }, { x: -2, y: -18, z: -64, h: 8 }, { x: 12, y: -18, z: -58, h: 11 },
      { x: -16, y: -26, z: -94, h: 7 }, { x: 16, y: -26, z: -70, h: 8 },
      { x: 40, y: -30, z: -74, h: 8 }, { x: 48, y: -30, z: -90, h: 10 }, { x: 58, y: -30, z: -73, h: 9 }, { x: 66, y: -30, z: -91, h: 11 }, { x: 76, y: -30, z: -73, h: 8 },
    ],
    fish: [
      { x: 6, y: -8, z: -15, n: 16, r: 4 }, { x: -10, y: -14, z: -45, n: 18, r: 5 }, { x: 14, y: -20, z: -80, n: 14, r: 4, color: 0xffd23a },
      { x: -10, y: -20, z: -78, n: 12, r: 3 }, { x: 0, y: -30, z: -160, n: 20, r: 5, color: 0x7af0ff }, { x: 6, y: -34, z: -236, n: 16, r: 6 }, { x: 60, y: -22, z: -82, n: 18, r: 5, color: 0xff9a5a },
    ],
    rays: [{ x: 0, z: -12, top: 0, len: 22 }, { x: 8, z: -32, top: 0, len: 22 }, { x: -6, z: -50, top: 0, len: 24 }, { x: 4, z: -76, top: 0, len: 30 }],
    coralDecor: [
      { x: -10, y: -18, z: -24, n: 8 }, { x: 10, y: -18, z: -20, n: 7 }, { x: -14, y: -18, z: -36, n: 9 }, { x: 14, y: -18, z: -48, n: 8 },
      { x: -6, y: -26, z: -94, n: 9 }, { x: 12, y: -26, z: -94, n: 7 }, { x: 18, y: -26, z: -76, n: 6 }, { x: -24, y: -26, z: -80, n: 8 },
      { x: -6, y: -40, z: -120, n: 7 }, { x: 6, y: -40, z: -145, n: 7 }, { x: -5, y: -40, z: -185, n: 8 }, { x: 6, y: -40, z: -215, n: 7 },
      { x: -12, y: -40, z: -238, n: 9, s: 1.3 }, { x: 12, y: -40, z: -244, n: 9, s: 1.3 },
      { x: 44, y: -30, z: -90, n: 8 }, { x: 54, y: -30, z: -73, n: 7 }, { x: 70, y: -30, z: -90, n: 9 }, { x: 88, y: -30, z: -74, n: 8, s: 1.2 }, { x: 88, y: -30, z: -90, n: 8, s: 1.2 },
    ],
    jellies: [
      { x: -2, y: -11, z: -45 }, { x: 5, y: -13, z: -50, amp: 2 }, { x: -6, y: -9, z: -57 }, { x: 1, y: -14, z: -62, amp: 2.2 },
      { x: -4, y: -20, z: -72 }, { x: 6, y: -19, z: -96 },
      { x: 3, y: -30, z: -118 }, { x: -4, y: -34, z: -140 }, { x: 4, y: -27, z: -158 }, { x: -3, y: -31, z: -182 }, { x: 4, y: -33, z: -212 },
    ],
    currents: [
      { x: 0, y: -30, z: -160, w: 20, h: 20, d: 128, fz: 5 },        // la Fosa empuja hacia atrás: solo el submarino avanza
      { x: 0, y: -7, z: -162, w: 140, h: 14, d: 130, fz: 6 },        // y por encima de la Fosa, aún más fuerte
      { x: 0, y: -30, z: -145, w: 20, h: 20, d: 14, fx: 3 },
      { x: 0, y: -30, z: -185, w: 20, h: 20, d: 14, fx: -3 },
      { x: 62, y: -25, z: -82, w: 12, h: 12, d: 22, fx: -2.2 },      // en mitad del cañón la corriente empuja hacia atrás
    ],
    coralWalls: [{ x: 0, y: -40, z: -130, w: 20, h: 20 }, { x: 0, y: -40, z: -168, w: 20, h: 20 }, { x: 0, y: -40, z: -205, w: 20, h: 20 }],
    caustics: { y: -17.9, size: 240, cx: 0, cz: -50 },
    // ---- criaturas y trampas ----
    sharks: [
      { x: 6, y: -9, z: -38, r: 9, speed: 3 },                     // ronda la llanura
      { x: -6, y: -13, z: -62, r: 7, speed: 3.4 },                 // al acecho entre las algas
      { x: 52, y: -24, z: -82, r: 6, speed: 3.6 },                  // Cañón de los Tiburones
      { x: 70, y: -22, z: -82, r: 6, speed: 4, s: 1.2, hp: 4 },
      { x: 0, y: -33, z: -236, r: 10, speed: 2.6, s: 1.3, hp: 4 }, // guardián del templo
    ],
    octopus: [
      { x: 11, y: -18, z: -56 },
      { x: 64, y: -30, z: -74, hp: 3 },
      { x: 86, y: -30, z: -82, s: 1.8, hp: 6, king: true, flag: 'mr_pulpo' },
    ],
    urchins: [
      { x: 1.5, y: -6, z: -9 }, { x: -1.5, y: -11, z: -18, ax: 'x', amp: 2.5 }, { x: 3, y: -14, z: -25, amp: 1.2 },
      { x: -5, y: -15, z: -46, ax: 'x', amp: 3 }, { x: 4, y: -10, z: -52 }, { x: -2, y: -16, z: -66, ax: 'z', amp: 2 },
      { x: 42, y: -26, z: -80, ax: 'z', amp: 6, speed: 0.9 }, { x: 46, y: -23, z: -85, ax: 'z', amp: 5, speed: 1.2 },
      { x: 55, y: -27, z: -79, ax: 'y', amp: 2.5 }, { x: 59, y: -24, z: -84, ax: 'z', amp: 6, speed: 0.8 },
      { x: 68, y: -27, z: -86, ax: 'y', amp: 2 }, { x: 73, y: -25, z: -78, ax: 'z', amp: 5, speed: 1.1 }, { x: 77, y: -28, z: -84, r: 0.7 },
      { x: -5, y: -36, z: -232, ax: 'x', amp: 4 }, { x: 6, y: -37, z: -236, ax: 'x', amp: 4, speed: 1.3 },
    ],
    zapJellies: [
      { x: 0, y: -12, z: -57, r: 0.9 },
      { x: 50, y: -24, z: -78 }, { x: 62, y: -26, z: -88, period: 3.8 }, { x: 75, y: -23, z: -80, period: 5 },
    ],
  },

  chapterEnd: {
    kicker: 'Fin del capítulo extra 3', title: 'El corazón del mar',
    sub: 'Bajo la superficie también hay caminos. Solo hay que guardar el aliento para recorrerlos.',
  },

  story: {
    intro: [
      L(NARR, 'Marta posa el dirigible sobre un muelle de madera que flota en mitad del mar.'),
      L(MARTA, 'La brújula señala hacia abajo. Muy abajo. Ahí dormía Mareth, la ciudad que se tragó el mar.'),
      L(LIA, 'Tendré que guardar el aliento. Si veo burbujas, las cojo; y si me falta el aire, subo.'),
    ],
    goal(S) {
      if (!S.has('mr_cupula1')) return { text: 'Sumérgete y sigue las burbujas hasta la cúpula de aire del fondo', at: [0, -18, -30] };
      if (!S.has('mr_cupula2')) return { text: 'Cruza el bosque de algas sin tocar las medusas hasta la cúpula de la ciudad hundida', at: [0, -26, -82] };
      if (!S.has('mr_nerea')) return { text: 'Habla con Nerea, la buzo, dentro de la cúpula', at: [-2.5, -26, -83] };
      if (!S.has('mr_sub') && !S.has('mr_pulpo')) return { text: 'Nada por el Cañón de los Tiburones (al este) y vence al Pulpo Rey', at: [86, -29, -82] };
      if (!S.has('mr_sub') && !S.has('mr_helice')) return { text: 'Toma la hélice del submarino en la guarida del Pulpo Rey', at: [87, -30, -82] };
      if (!S.has('mr_sub')) return { text: 'Vuelve y sube al submarino amarillo, junto a la cúpula', at: [9, -26, -91] };
      if (!S.has('mr_fosa')) return { text: 'Pilota el submarino por la Fosa Abisal: embiste los corales que cierran el paso', at: [0, -37, -227] };
      if (!S.has('perla_mareth')) return { text: 'Entra en el templo y toma la Perla de Mareth', at: [0, -40, -242.6] };
      return { text: 'Capítulo extra 3 completado', at: null };
    },
    talk: {
      marta_m(S) { return { lines: [L(MARTA, S.has('perla_mareth') ? '¡Volviste con la Perla! Y empapada hasta las orejas.' : 'Yo vigilo desde aquí. Si te falta el aire, sube: la superficie no se va a ningún sitio.')] }; },
      nerea(S) {
        if (!S.has('mr_nerea')) return {
          lines: [
            L(NEREA, '¡Una visitante que respira bajo el agua! Bueno, casi: ya veo que vienes boqueando.'),
            L(NEREA, 'Soy Nerea. Cuido de lo que queda de Mareth. La Perla está en el templo, al otro lado de la Fosa Abisal.'),
            L(LIA, '¿Y no se puede ir nadando?'),
            L(NEREA, 'La corriente de la Fosa arrastra a cualquiera, y el camino está cerrado por muros de coral. Te prestaría mi submarino...'),
            L(NEREA, '...pero el Pulpo Rey me robó la hélice. Se la llevó a su guarida, al final del Cañón de los Tiburones, al este de la ciudad.'),
            L(LIA, '¿Tiburones? ¿Y un pulpo rey? Genial...'),
            L(NEREA, 'Bajo el agua no puedes saltar ni usar el bastón como arriba, pero sí dar una estocada: un impulso rápido que golpea lo que toque.'),
            L(NEREA, 'Los tiburones te avisan antes de embestir: se quedan quietos y agitan la cola. Apártate, y cuando queden cansados, ¡estocada!'),
            L(NEREA, 'Y vigila el aire: el cañón es largo. Coge todas las burbujas que veas.'),
          ],
          then: () => S.set('mr_nerea'),
        };
        if (!S.has('mr_sub') && !S.has('mr_helice')) return { lines: [L(NEREA, 'La guarida del Pulpo Rey está al final del Cañón de los Tiburones, al este. ¡Ánimo y guarda el aliento!')] };
        return { lines: [L(NEREA, S.has('mr_sub') ? 'Cuida mi submarino, ¿eh?' : '¡Mi hélice! Ya está puesta. El submarino amarillo está junto a la cúpula. Embiste los corales sin miedo y, en el templo, sal por el amarre.')] };
      },
      helice(S) {
        return { lines: [L(NARR, 'Entre conchas y tesoros robados brilla la hélice dorada del submarino de Nerea.'), L(LIA, '¡La tengo! Ahora, de vuelta a la ciudad... sin que me coma un tiburón.'), L(NARR, 'Obtuviste la hélice del submarino.', { system: true })], then: () => { S.set('mr_helice'); S.give && S.give('Hélice del submarino'); } };
      },
      submarino(S) { return { lines: [L(LIA, '¡Allá vamos! Arriba con Espacio, abajo con K. ¡Y a toda máquina!')], then: () => { S.set('mr_sub'); S.enterSub(); } }; },
      amarre(S) { return { lines: [L(LIA, 'Dejo el submarino aquí amarrado. El templo está a unas brazadas.')], then: () => { S.set('mr_fosa'); S.exitSub(); } }; },
      perla_mareth(S) {
        return {
          lines: [
            L(NARR, 'Una perla enorme, azul como el fondo del mar, que late despacio como un corazón dormido.'),
            L(LIA, 'La Perla de Mareth... Suena como las olas.'),
            L(NARR, 'Obtuviste la Perla de Mareth.', { system: true }),
          ],
          then: () => { S.set('perla_mareth'); S.give('Perla de Mareth'); S.logro && S.logro('mareth'); S.chapterEnd(); },
        };
      },
    },
  },
};
