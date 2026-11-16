// Puerto Bruma — Prólogo.
// Alturas: "top" / "y" = altura de la superficie donde se pisa.
// La historia (objetivos y diálogos que dependen del progreso) está en `story`, al final.

const L = (who, text, extra = {}) => ({ who, text, ...extra });
const LIA = 'Lía', MARTA = 'Capitana Marta', TOMAS = 'Tomás', KAEL = 'Kael', ILAN = 'Abuelo Ilan', NARR = '';
const FRAGMENTOS_NECESARIOS = 3;

export default {
  id: 'puerto_bruma',
  title: 'Puerto Bruma',
  subtitle: 'Prólogo',
  seed: 3,
  sky: { top: 0x5da9e9, bottom: 0xcfe8ff, fog: 0xd6ebff, fogNear: 50, fogFar: 170 },
  water: { y: -3, color: 0xeaf2ff },   // mar de nubes
  start: { id: 'inicio', pos: [-12.5, 0, 9.6], facing: -Math.PI / 2 },

  islands: [
    { x: 0, z: 0, w: 44, d: 40, top: 0, depth: 4 },
    { x: -27.5, z: -4, w: 4, d: 4, top: 1, depth: 2 },
    { x: -33, z: -10.5, w: 3.5, d: 3.5, top: 2.2, depth: 2 },
    { x: -36.5, z: -18, w: 5, d: 5, top: 3.6, depth: 2.5 },
  ],
  boxes: [
    { x: 0, y: 0.8, z: 0, w: 3, h: 1, d: 3, color: 0xb8b2a6, cap: 0x7fc6ff },           // fuente
    { x: -4, y: 3, z: -14, w: 6, h: 3, d: 4, color: 0x9a6a45, cap: 0xa0703f },         // almacén de mapas (techo plano)
    { x: 15, y: 3, z: 10, w: 14, h: 3.4, d: 16, color: 0x9a6a45, cap: 0x7ccf5f },      // colina del faro
    { x: 0, y: 0, z: 27, w: 3, h: 0.5, d: 14, color: 0xa0703f },                        // muelle de dirigibles
    { x: 0, y: 0.6, z: 34.2, w: 4, h: 0.3, d: 0.6, color: 0x6e4a2a },                   // tope del muelle
  ],
  stairs: [
    { x: 4.4, z: -14, baseY: 0, steps: 9, stepH: 0.3333, stepD: 0.6, w: 2, dir: 'x-' },
  ],
  ramps: [
    { x: 5, z: 13.5, w: 6, d: 3, y0: 0, y1: 3, axis: 'x' },
  ],
  houses: [
    { x: -13, z: -8, w: 6, d: 5, h: 3.4, roof: 0xc9563c },
    { x: -13, z: 5, w: 5, d: 5, h: 3, roof: 0xc9563c },          // casa de Lía
    { x: 13, z: -11, w: 6, d: 5, h: 3.6, roof: 0x4f7fc0 },
  ],
  lighthouses: [{ x: 17, z: 12, y: 3 }],
  airships: [{ id: 'dirigible', x: 0, y: 1.2, z: 39.5 }],
  trees: [
    { x: -8, z: 9 }, { x: 8, z: -4, s: 1.2 }, { x: -18, z: -16 }, { x: 18, z: -2, s: 0.9 },
    { x: -18, z: 15, s: 1.1 }, { x: -6, z: 16, s: 0.8 }, { x: 11, z: 5, y: 3, s: 0.9 }, { x: 20, z: 4, y: 3 },
  ],
  rocks: [{ x: 10, z: -17 }, { x: -20, z: 1, s: 0.8 }, { x: 4, z: 18, s: 0.7 }],
  fences: [{ x1: -10, z1: -19.5, x2: 10, z2: -19.5 }],

  signs: [
    {
      id: 'cartel_bienvenida', x: 2.5, z: 11.5, rot: -0.3, title: 'Cartel del pueblo',
      lines: [
        'Bienvenida a Puerto Bruma, el último puerto antes del mar de nubes.',
        'Muévete con W A S D o el stick. Mantén Shift para caminar despacio.',
        'Espacio salta. Si lo sueltas antes, el salto es más corto. En el aire puedes saltar otra vez.',
      ],
    },
    {
      id: 'cartel_islotes', x: -19.5, z: -2.5, rot: 1.3, title: 'Cartel desgastado',
      lines: [
        'Islotes de la Bruma. Solo para saltadores con experiencia.',
        'Consejo: usa el doble salto en el punto más alto del primer salto.',
      ],
    },
    {
      id: 'cartel_casa', x: -10.6, z: 8.2, rot: -0.4, title: 'Buzón',
      lines: ['Familia de Ilan, cartógrafo. Se reciben mapas, cartas y noticias del otro lado de la bruma.'],
    },
  ],
  npcs: [
    {
      id: 'tomas', name: TOMAS, model: 'tomas', x: -3, z: 3.5, rot: 2.6, style: 'lively',
      look: { top: 0xe08a3c, pants: 0x4a5a7a, hair: 0x5a3a22, hairStyle: 'short', scale: 0.72 },
      lines: ['¡Lía!'],
    },
    {
      id: 'marta', name: MARTA, model: 'marta', x: 1.1, z: 30.5, rot: 0,
      look: { top: 0x2c4a7a, pants: 0x2a2a38, boots: 0x2a1c14, hair: 0xb8b8c0, hairStyle: 'bun', hat: 'captain', coat: true, girth: 1.12, scale: 1.02 },
      lines: ['...'],
    },
    {
      id: 'kael', name: KAEL, model: 'kael', x: -35.6, y: 3.6, z: -19.2, rot: -2.87,
      when: S => S.has('brujula') && !S.has('kael_visto'),
      look: { top: 0x3a2f4f, pants: 0x24202e, boots: 0x1c1822, hair: 0xe8e8f0, hairStyle: 'short', scarf: 0x7a3fd0, coat: true, scale: 1.0 },
      lines: ['...'],
    },
  ],
  items: [
    { id: 'llave', model: 'key', x: -2.2, y: 3, z: -13.4, verb: 'Recoger la llave', when: S => S.has('carta') && !S.has('llave') },
  ],
  triggers: [
    { id: 'puerta_faro', x: 17, y: 3, z: 14, radius: 1.9, verb: 'Abrir la puerta', name: 'Puerta del faro' },
  ],
  lanterns: [
    { id: 'plaza', x: 3.2, z: 3.2, facing: 0 },
    { id: 'colina', x: 11, y: 3, z: 8, facing: 0 },
    { id: 'islote', x: -36.5, y: 3.6, z: -16.5, facing: 0 },
  ],
  fragments: [
    { id: 'pb_almacen', x: -5.5, y: 3, z: -14.5 },
    { id: 'pb_faro', x: 20.5, y: 3, z: 16 },
    { id: 'pb_muelle', x: 0, y: 0, z: 33 },
    { id: 'pb_islote', x: -37.5, y: 3.6, z: -19.5 },
    { id: 'pb_casa_azul', x: 13, y: 0, z: -15.5 },
  ],

  // ------------------------------------------------------------------
  // Historia del prólogo. S = estado: has(flag), set(flag), frags(), give(nombre), ending(), effect(...)
  story: {
    intro: [
      L(NARR, 'Hace un año que el abuelo Ilan dejó de cruzar la bruma.'),
      L(NARR, 'Hoy Lía cumple diecisiete años. Y una tormenta se acerca a Puerto Bruma.'),
      L(LIA, 'La capitana Marta me pidió que pasara por el muelle. ¿Qué querrá?'),
    ],

    goal(S) {
      if (!S.has('carta')) return { text: 'Habla con la capitana Marta en el muelle', at: [1.1, 0, 30.5] };
      if (!S.has('llave')) return { text: 'Busca la llave del faro en el techo del almacén de mapas', at: [-2.2, 3, -13.4] };
      if (!S.has('brujula')) return { text: 'Abre el faro del abuelo, en la colina', at: [17, 3, 14] };
      if (S.frags() < FRAGMENTOS_NECESARIOS) return { text: `Sigue la brújula y reúne fragmentos del Corazón (${S.frags()}/${FRAGMENTOS_NECESARIOS})`, at: null };
      if (!S.has('prologo_fin')) return { text: 'Vuelve con la capitana Marta en el muelle', at: [1.1, 0, 30.5] };
      return { text: 'Prólogo completado. Busca los fragmentos que faltan o habla con Marta para zarpar.', at: null };
    },

    talk: {
      marta(S) {
        if (!S.has('carta')) return {
          lines: [
            L(MARTA, '¡Feliz cumpleaños, chiquilla! Tengo algo para ti.'),
            L(MARTA, 'Tu abuelo me dejó esta carta. Me hizo jurar que te la daría hoy, ni un día antes.'),
            L(LIA, '¿Una carta del abuelo...?'),
            L('Carta de Ilan', 'Lía: si lees esto, ya estás lista. La llave del faro está donde guardábamos los mapas.', { letter: true }),
            L('Carta de Ilan', 'No confíes en la Orden del Velo. Y no tengas miedo de la bruma. Te quiere, el abuelo.', { letter: true }),
            L(MARTA, 'El almacén de mapas es el de techo plano, al norte de la plaza. Se sube por la escalera de piedra.'),
          ],
          then: () => S.set('carta'),
        };
        if (!S.has('llave')) return { lines: [L(MARTA, 'La llave, chiquilla. El almacén de techo plano. Sube por la escalera de piedra.')] };
        if (!S.has('brujula')) return { lines: [L(MARTA, 'Ve al faro de la colina. Hace un año que nadie abre esa puerta.')] };
        if (S.frags() < FRAGMENTOS_NECESARIOS) return {
          lines: [
            L(MARTA, '¿Esa es la brújula de Ilan? Fíjate cómo tiembla la aguja.'),
            L(MARTA, `Síguela. Cuando tengas ${FRAGMENTOS_NECESARIOS} fragmentos, vuelve. El dirigible estará listo.`),
          ],
        };
        if (!S.has('prologo_fin')) return {
          lines: [
            L(MARTA, 'Esa aguja se mueve como loca. Ilan tenía razón.'),
            L(MARTA, 'La tormenta abre un paso hacia el Bosque Colgante. Si quieres ir, el dirigible sale ahora.'),
            L(LIA, 'Vamos. El abuelo habría querido que fuera.'),
          ],
          then: () => { S.set('prologo_fin'); S.ending(); },
        };
        return {
          lines: [L(MARTA, '¿Lista para zarpar otra vez?'), L(LIA, 'Lista.')],
          then: () => S.ending(),
        };
      },

      tomas(S) {
        if (!S.has('brujula')) return {
          lines: [
            L(TOMAS, '¡Lía! ¡Feliz cumpleaños! ¿Viste los cristales que brillan por el pueblo?'),
            L(TOMAS, 'Dicen que son astillas del Corazón. Mi abuela dice que no hay que tocarlas... pero yo ya conté cinco.'),
            L(TOMAS, 'Una está arriba del almacén de mapas. ¡Las otras, búscalas tú!'),
          ],
        };
        if (!S.has('kael_visto')) return {
          lines: [
            L(TOMAS, '¡Esa brújula brilla! ¿Era de tu abuelo?'),
            L(TOMAS, 'Hace un rato vi a un chico de capa morada saltando hacia los islotes del oeste. Daba miedo.'),
          ],
        };
        return { lines: [L(TOMAS, '¿Ese chico de la capa era de la Orden del Velo? ¡Ten cuidado, Lía!')] };
      },

      kael(S) {
        return {
          lines: [
            L(KAEL, 'Vaya. La nieta del cartógrafo.'),
            L(LIA, '¿Quién eres? ¿Cómo sabes quién soy?'),
            L(KAEL, 'Kael, de la Orden del Velo. Todo el mundo sabe quién era Ilan.'),
            L(KAEL, 'La Orden también busca los fragmentos. Y nosotros no necesitamos brújulas viejas.'),
            L(KAEL, 'Nos vemos en el Bosque Colgante. Si llegas.'),
          ],
          then: () => { S.set('kael_visto'); S.effect('vanish', 'kael'); },
        };
      },

      cartel_casa(S) {
        if (S.has('prologo_fin')) return { lines: [L('Buzón', 'Una nota de Tomás: "¡Tráeme un recuerdo del Bosque Colgante!"')] };
        return null;
      },

      llave(S) {
        return {
          lines: [
            L(NARR, 'Bajo una pila de mapas viejos hay una llave de bronce con forma de rosa de los vientos.'),
            L(LIA, 'La llave del faro. El abuelo la escondía siempre aquí.'),
          ],
          then: () => { S.set('llave'); S.give('Llave del faro'); },
        };
      },

      puerta_faro(S) {
        if (!S.has('llave')) return {
          lines: [L('Puerta del faro', 'Está cerrada con llave. La cerradura tiene forma de rosa de los vientos.')],
        };
        if (!S.has('brujula')) return {
          lines: [
            L(NARR, 'La llave gira con un chasquido. Dentro huele a tinta y a sal.'),
            L(NARR, 'Sobre la mesa del abuelo, entre mapas a medio dibujar, descansa su brújula.', { memory: true }),
            L(ILAN, 'Esta brújula no apunta al norte, Lía. Apunta a lo que falta.', { memory: true }),
            L(ILAN, 'El Corazón de Aethra se rompió hace cien años. Si alguna vez la aguja tiembla, síguela.', { memory: true }),
            L(LIA, 'Está temblando, abuelo...'),
            L(NARR, 'Obtuviste la Brújula de Ilan. Su aguja señala el fragmento más cercano.', { system: true }),
          ],
          then: () => { S.set('brujula'); S.give('Brújula de Ilan'); },
        };
        return { lines: [L(NARR, 'El faro está en silencio. La mesa del abuelo sigue llena de mapas sin terminar.')] };
      },
    },
  },
};
