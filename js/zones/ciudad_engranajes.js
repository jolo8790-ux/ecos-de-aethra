// Capítulo 3 — La Ciudad de Engranajes.
// Recorrido hacia -z: muelle → taller de Ilan (garfio) → anillos sobre el abismo → plaza alta → plataformas móviles → antesala → arena del Coloso → torre del santuario.

const L = (who, text, extra = {}) => ({ who, text, ...extra });
const LIA = 'Lía', MARTA = 'Capitana Marta', KAEL = 'Kael', NARR = '';

export default {
  id: 'ciudad_engranajes',
  title: 'La Ciudad de Engranajes',
  subtitle: 'Capítulo 3',
  seed: 37,
  sky: { top: 0x2a2a5a, bottom: 0xd88a6a, fog: 0x8a6a7a, fogNear: 30, fogFar: 140 },
  light: { hemiSky: 0xd8c8f0, hemiGround: 0x4a3a3a, sun: 0xffc890 },
  palette: { top: 0x8a7a6a, side: 0x5a4a44 },
  water: { y: -18, color: 0xb89aa8 },
  start: { id: 'llegada', pos: [0, 0, 4], facing: 0 },

  islands: [
    { x: 0, z: 2, w: 16, d: 16, top: 0, depth: 4 },          // muelle
    { x: 0, z: -20, w: 16, d: 14, top: 0, depth: 4 },        // taller
    { x: 0, z: -48, w: 16, d: 16, top: 6, depth: 4 },        // plaza alta
    { x: 0, z: -77, w: 10, d: 8, top: 6, depth: 3 },         // antesala
    { x: 0, z: -101, w: 26, d: 26, top: 6, depth: 5 },       // arena
    { x: 0, z: -126, w: 10, d: 10, top: 20, depth: 3 },      // santuario en lo alto
    { x: 15, z: -48, w: 5, d: 5, top: 12, depth: 2 },        // repisa del reloj
  ],
  props: [
    { kind: 'barril', x: 5.5, z: 6.5 }, { kind: 'barril', x: 6.4, z: 5.7, s: 0.9 }, { kind: 'caja', x: -6, z: 7, rot: 0.3 },
    { kind: 'caja', x: 6, z: -24.5, rot: -0.3 }, { kind: 'caja', x: 6.2, z: -24.5, y: 0.9, rot: 0.2, s: 0.8 }, { kind: 'barril', x: -6, z: -15.5 },
  ],
  bridges: [
    { x1: 0, z1: -6, x2: 0, z2: -12.8, y: 0, w: 2.4 },
    { x1: 0, z1: -81.2, x2: 0, z2: -87.8, y: 6, w: 2.4 },
  ],
  grapples: [
    { x: 0, y: 9, z: -36.5 },                                          // sobre el abismo, hacia la plaza
    { x: 11, y: 15, z: -48 },                                          // hacia la repisa del reloj
    { x: 0, y: 23, z: -118, when: S => S.has('coloso_vencido') },      // hacia el santuario
  ],
  movers: [
    { x: 0, y: 6, z: -59.5, w: 3, d: 3, axis: 'x', range: 3, speed: 0.6 },
    { x: 0, y: 6, z: -64.5, w: 3, d: 3, axis: 'x', range: 3, speed: 0.6, phase: Math.PI },
    { x: 0, y: 6, z: -69.5, w: 3, d: 3, axis: 'x', range: 3, speed: 0.75, phase: 1.2 },
  ],
  gears: [
    { x: -10, y: 4, z: -18, r: 2.5, axis: 'x', speed: 0.4 }, { x: 10, y: -2, z: -34, r: 3.2, axis: 'x', speed: -0.3 },
    { x: -12, y: 10, z: -60, r: 4, axis: 'x', speed: 0.25 }, { x: 14, y: 2, z: -66, r: 3, axis: 'x', speed: -0.35, color: 0x8a6a3a },
    { x: -15, y: 12, z: -104, r: 4.5, axis: 'x', speed: 0.2 }, { x: 15, y: 10, z: -96, r: 3.5, axis: 'x', speed: -0.3 },
  ],
  towers: [
    { x: -14, z: -8 }, { x: 14, z: -24, h: 36 }, { x: -16, z: -44, h: 40 }, { x: 18, z: -80, h: 34, color: 0x6a5a6a },
    { x: -18, z: -118, h: 44 }, { x: 16, z: -126, h: 38 },
  ],
  houses: [{ x: -4.5, z: -23, w: 5, d: 4, wall: 0x9a8a7a, roof: 0x4a3a6a, door: 'z+' }],
  airships: [{ id: 'dirigible', x: -1, y: 1.2, z: 13.5 }],

  signs: [
    {
      id: 'cartel_garfio', x: 2.5, z: -26, rot: -0.3, title: 'Placa de latón',
      lines: ['Anillos de amarre: apunta con la cámara a un anillo brillante y pulsa G o el clic central para lanzar el garfio.'],
    },
    {
      id: 'cartel_plataformas', x: 3, y: 6, z: -55, rot: 0.2, title: 'Placa de latón',
      lines: ['Las plataformas de carga se mueven solas. Espera a que se acerquen y salta.'],
    },
  ],
  npcs: [
    { id: 'marta_c', name: MARTA, model: 'marta', x: -3.2, z: 6, rot: -0.6, lines: ['...'] },
    {
      id: 'kael_c', name: KAEL, model: 'kael', x: 2.5, y: 20, z: -124, rot: 0.4,
      when: S => S.has('coloso_vencido') && !S.has('kael_ciudad'), lines: ['...'],
    },
  ],
  items: [
    { id: 'garfio', model: 'hook', x: 1.5, z: -22.5, verb: 'Tomar el garfio', when: S => !S.has('garfio') },
    { id: 'diario', model: 'key', x: 15, y: 12, z: -49, verb: 'Leer el diario', when: S => !S.has('diario_ilan') },
    { id: 'gran_fragmento_c', model: 'bigshard', x: 0, y: 20, z: -128, verb: 'Tomar el gran fragmento', when: S => !S.has('gran_fragmento_3') },
  ],
  lanterns: [
    { id: 'llegada', x: 3.2, z: 2.2, facing: 0 },
    { id: 'taller', x: 5, z: -16, facing: 0 },
    { id: 'plaza', x: -5, y: 6, z: -45, facing: 0 },
    { id: 'antesala', x: 3, y: 6, z: -76, facing: 0 },
    { id: 'santuario', x: -3, y: 20, z: -123, facing: 0 },
  ],
  fragments: [
    { id: 'ce_taller', x: -6.5, z: -26 },
    { id: 'ce_plaza', x: 6, y: 6, z: -54 },
    { id: 'ce_reloj', x: 16, y: 12, z: -46.5 },
    { id: 'ce_plataforma', x: 0, y: 6.6, z: -64.5 },
    { id: 'ce_santuario', x: 3.5, y: 20, z: -129 },
  ],
  enemies: [
    { type: 'automata', x: 3, z: -19 },
    { type: 'automata', x: -3, y: 6, z: -46 }, { type: 'automata', x: 3, y: 6, z: -50 }, { type: 'torreta', x: -6, y: 6, z: -53 },
    { type: 'torreta', x: 3.5, y: 6, z: -78.5 },
  ],
  boss: { type: 'coloso', x: 0, y: 6, z: -106, facing: Math.PI, flag: 'coloso_vencido', region: [-13, 4, -112, 13, 14, -91] },
  regions: [
    { id: 'plaza', box: [-8, 5.5, -56, 8, 9, -40], flag: 'llego_plaza' },
    { id: 'antesala', box: [-5, 5.5, -81, 5, 9, -73], flag: 'llego_antesala' },
  ],

  chapterEnd: {
    kicker: 'Fin del capítulo 3', title: 'Los diarios de Ilan',
    next: { label: 'Continuar: Capítulo 4', zone: 'glaciar_eco', cp: 'llegada' },
  },

  story: {
    intro: [
      L(NARR, 'Al anochecer, el dirigible amarra entre torres de piedra y latón. Engranajes gigantes giran en el aire.'),
      L(MARTA, 'La Ciudad de Engranajes. Tu abuelo tenía un taller aquí, junto al muelle.'),
      L(MARTA, 'Si queda algo suyo, estará allí. Yo vigilo el dirigible: aquí los autómatas no distinguen amigos.'),
    ],

    goal(S) {
      if (!S.has('garfio')) return { text: 'Busca el taller de Ilan junto al muelle', at: [1.5, 0, -22.5] };
      if (!S.has('llego_plaza')) return { text: 'Lanza el garfio al anillo sobre el abismo', at: [0, 6, -40] };
      if (!S.has('llego_antesala')) return { text: 'Cruza saltando por las plataformas móviles', at: [0, 6, -75] };
      if (!S.has('coloso_vencido')) return S.bossActive ? { text: 'Cuando el puño quede atascado, sube con el garfio y golpea el núcleo', at: null } : { text: 'Cruza el puente hacia la gran plaza', at: [0, 6, -90] };
      if (!S.has('gran_fragmento_3')) return { text: 'Usa el garfio para subir al santuario', at: [0, 20, -126] };
      return { text: 'Capítulo 3 completado. Vuelve con Marta cuando quieras.', at: [-3.2, 0, 6] };
    },

    bossIntro: [
      L(NARR, 'Los engranajes de la plaza se detienen. Una estatua de latón de diez metros gira la cabeza.'),
      L('Coloso de Engranajes', 'PROTOCOLO... DEL GUARDIÁN... INTRUSO DETECTADO.'),
      L(LIA, 'Su pecho brilla igual que los fragmentos... Tengo que llegar ahí arriba.'),
    ],
    bossDefeated: [
      L(NARR, 'El Coloso se arrodilla. Su núcleo se apaga y una chispa vuela hasta la brújula.'),
      L('Coloso de Engranajes', 'Guardián Ilan... orden final... cumplida...'),
      L(NARR, 'Un anillo de amarre se enciende en lo alto de la torre.', { system: true }),
    ],
    onBossDefeated: S => { S.set('coloso_vencido'); },

    talk: {
      marta_c(S) {
        if (!S.has('gran_fragmento_3')) return { lines: [L(MARTA, 'Estas torres me dan escalofríos. Tu abuelo decía que la ciudad entera era una máquina.')] };
        return {
          lines: [
            L(MARTA, 'Tres fragmentos... y esa cara. ¿Qué encontraste allí arriba?'),
            L(LIA, 'Los diarios del abuelo. Te los leo en el viaje.'),
          ],
          then: () => S.chapterEnd(),
        };
      },
      garfio(S) {
        return {
          lines: [
            L(NARR, 'El taller está lleno de polvo y planos. Sobre la mesa hay un garfio de latón y una carta.'),
            L('Ilan', 'Para quien venga con mi brújula: si llegaste hasta aquí, ya sabes volar. Ahora aprende a agarrarte.', { letter: true }),
            L(NARR, 'Obtuviste el Garfio: apunta a un anillo brillante y pulsa G o el clic central.', { system: true }),
          ],
          then: () => { S.set('garfio'); S.give('Garfio de Ilan'); },
        };
      },
      diario(S) {
        return {
          lines: [
            L(NARR, 'Junto al gran reloj hay un cuaderno de tapas de cuero, atado con una cinta azul.'),
            L('Ilan', 'Día 112. El Corazón lleva cien años agrietado. La Orden quiere repararlo para gobernar los vientos. No puedo permitirlo.', { letter: true }),
            L('Ilan', 'Terminé de partirlo en cinco. Cada guardián cuidará uno. Si alguna vez se juntan, que sea por una buena razón.', { letter: true }),
          ],
          then: () => S.set('diario_ilan'),
        };
      },
      kael_c(S) {
        return {
          lines: [
            L(KAEL, 'Ya lo sabes, ¿verdad? Tu abuelo no rompió el Corazón por accidente.'),
            L(LIA, 'Lo rompió para que la Orden no lo usara. ¿Y tú? ¿Para quién trabajas?'),
            L(KAEL, 'Para la Orden. Hasta hoy.'),
            L(KAEL, 'Me ordenaron seguirte y quitarte los fragmentos cuando tuvieras tres. No voy a hacerlo.'),
            L(KAEL, 'Pero ellos vendrán igual. Junta los cinco antes que ellos, Lía.'),
          ],
          then: () => { S.set('kael_ciudad'); S.effect('vanish', 'kael_c'); },
        };
      },
      gran_fragmento_c(S) {
        return {
          lines: [
            L(NARR, 'En lo alto de la torre, el tercer fragmento gira dentro de una jaula de engranajes que se abre sola.'),
            L(NARR, 'Obtuviste un Gran Fragmento del Corazón (3 de 5).', { system: true }),
          ],
          then: () => { S.set('gran_fragmento_3'); S.give('Gran Fragmento del Corazón'); S.chapterEnd(); },
        };
      },
    },
  },
};
