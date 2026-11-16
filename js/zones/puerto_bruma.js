// Puerto Bruma — zona de prueba de la etapa 1 (en la etapa 2 se convierte en el prólogo completo).
// Alturas: "top" / "y" = altura de la superficie donde se pisa.

export default {
  id: 'puerto_bruma',
  title: 'Puerto Bruma',
  subtitle: 'Prólogo',
  seed: 3,
  sky: { top: 0x5da9e9, bottom: 0xcfe8ff, fog: 0xd6ebff, fogNear: 50, fogFar: 170 },
  water: { y: -3, color: 0xeaf2ff },   // mar de nubes
  start: { id: 'inicio', pos: [0, 0, 14], facing: 0 },

  islands: [
    { x: 0, z: 0, w: 44, d: 40, top: 0, depth: 4 },
    { x: -27.5, z: -4, w: 4, d: 4, top: 1, depth: 2 },
    { x: -33, z: -10.5, w: 3.5, d: 3.5, top: 2.2, depth: 2 },
    { x: -36.5, z: -18, w: 5, d: 5, top: 3.6, depth: 2.5 },
  ],
  boxes: [
    { x: 0, y: 0.8, z: 0, w: 3, h: 1, d: 3, color: 0xb8b2a6, cap: 0x7fc6ff },           // fuente
    { x: -4, y: 3, z: -14, w: 6, h: 3, d: 4, color: 0x9a6a45, cap: 0xa0703f },         // almacén de techo plano
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
    { x: -13, z: 5, w: 5, d: 5, h: 3, roof: 0xc9563c },
    { x: 13, z: -11, w: 6, d: 5, h: 3.6, roof: 0x4f7fc0 },
  ],
  lighthouses: [{ x: 17, z: 12, y: 3 }],
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
      id: 'cartel_faro', x: 14.5, y: 3, z: 14.8, rot: 0.6, title: 'Puerta del faro',
      lines: [
        'Faro del cartógrafo Ilan. Cerrado.',
        'La cerradura tiene forma de brújula.',
      ],
    },
  ],
  npcs: [
    {
      id: 'tomas', name: 'Tomás', x: -3, z: 3.5, rot: 2.6, color: 0xe08a3c, hair: 0x5a3a22,
      lines: [
        '¡Lía! ¿Viste los cristales que brillan por el pueblo?',
        'Dicen que son astillas del Corazón. Mi abuela dice que no hay que tocarlas... pero yo ya conté cinco.',
        'Una está arriba del almacén. Las otras, búscalas tú.',
      ],
    },
    {
      id: 'marta', name: 'Capitana Marta', x: 1.1, z: 30.5, rot: 0, color: 0x3c5a8a, hair: 0xb8b8c0,
      lines: [
        'El dirigible no sale hasta que pase la tormenta, chiquilla.',
        'Tu abuelo Ilan cruzaba la bruma con mapas que nadie más sabía leer.',
        'Si encuentras su brújula, ven a verme. Esa cosa no apunta al norte.',
      ],
    },
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
};
