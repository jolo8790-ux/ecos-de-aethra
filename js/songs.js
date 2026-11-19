// Partituras de Ecos de Aethra (las toca js/music.js).
// chords: un acorde por compás (4 tiempos). Cada pista:
//  pad   — acorde sostenido            bass — R raíz, F quinta, O octava, T tercera
//  arp   — índices de notas del acorde  mel  — notas por compás ('-' alarga, '.' silencio)
//  drum  — x golpe, X fuerte, . nada    stab — acorde rítmico
//  from: compás en que entra la pista la primera vez (para que las canciones arranquen suaves)

// Tema de Aethra (el "eco" del abuelo): La-Re-Mi-Fa#… aparece en el título, el final y, torcido, con Vaelor.
const TEMA = [
  'A4 - D5 - E5 - F#5 -', 'F#5 - - - E5 - D5 -', 'B4 - - - D5 - G5 -', 'F#5 - E5 - - - . .',
  'A4 - D5 - E5 - F#5 -', 'A5 - - - G5 - F#5 -', 'E5 - D5 - B4 - D5 -', 'E5 - - - - - . .',
];

export const SONGS = {
  title: {
    bpm: 74, vol: 0.9, chords: ['D', 'Bm', 'G', 'A', 'D', 'F#m', 'G', 'Asus4'],
    tracks: [
      { type: 'pad', inst: 'pad', oct: 3, vol: 0.5, open: true },
      { type: 'arp', inst: 'harp', oct: 3, pattern: '0 1 2 3 4 3 2 1', vol: 0.35 },
      { type: 'bass', inst: 'bass', oct: 2, pattern: 'R - - - F - - -', vol: 0.4 },
      { type: 'mel', inst: 'flute', notes: TEMA, vol: 0.45, from: 4 },
    ],
  },

  // Puerto Bruma: alegre, de puerto, con acordeón y flauta
  puerto: {
    bpm: 100, swing: 0.18, vol: 0.85, chords: ['G', 'C', 'G', 'D', 'Em', 'C', 'D', 'G'],
    tracks: [
      { type: 'stab', inst: 'accordion', oct: 4, pattern: '..x...x...x...x.', vol: 0.5 },
      { type: 'bass', inst: 'bass', oct: 2, pattern: 'R . F . R . F .', vol: 0.45 },
      { type: 'arp', inst: 'pluck', oct: 4, pattern: '0 . 1 2 . 1 2 .', vol: 0.3 },
      { type: 'drum', inst: 'kick', pattern: 'x.......x.......', vol: 0.5 },
      { type: 'drum', inst: 'shaker', pattern: '..x...x...x...x.', vol: 0.6 },
      { type: 'mel', inst: 'flute', from: 8, vol: 0.45, notes: [
        'D5 . B4 D5 G5 - F#5 E5', 'E5 - C5 . E5 G5 - .', 'D5 - B4 G4 B4 D5 - .', 'A4 B4 C5 D5 E5 - D5 .',
        'B4 - E5 - G5 - F#5 E5', 'E5 - C5 - G4 - A4 B4', 'C5 - A4 - F#4 - A4 C5', 'B4 - G4 - - - . .'] },
    ],
  },

  // Bosque Colgante: misterioso, marimba y flauta (mi dórico)
  bosque: {
    bpm: 84, vol: 0.85, chords: ['Em', 'A', 'Em', 'D', 'Em', 'A', 'C', 'D'],
    tracks: [
      { type: 'pad', inst: 'pad', oct: 3, vol: 0.4 },
      { type: 'arp', inst: 'marimba', oct: 4, pattern: '0 2 1 3 0 2 1 3', vol: 0.4 },
      { type: 'bass', inst: 'bass', oct: 2, pattern: 'R - - - - - F -', vol: 0.4 },
      { type: 'drum', inst: 'tick', pattern: '....x.......x..x', vol: 0.35 },
      { type: 'mel', inst: 'flute', from: 8, vol: 0.4, notes: [
        'B4 - - - E5 - D5 -', 'C#5 - - - - - A4 -', 'B4 - G4 - B4 - E5 -', 'F#5 - - - D5 - - -',
        'G5 - F#5 - E5 - B4 -', 'C#5 - E5 - A5 - - -', 'G5 - E5 - C5 - E5 -', 'D5 - - - - - . .'] },
    ],
  },

  // Ruinas de Vidrio: desierto, laúd y darbuka (re frigio dominante)
  ruinas: {
    bpm: 92, vol: 0.85, chords: ['D', 'Eb', 'D', 'Cm', 'D', 'Eb', 'Gm', 'D'],
    tracks: [
      { type: 'pad', inst: 'pad', oct: 2, vol: 0.35 },
      { type: 'bass', inst: 'bass', oct: 2, pattern: 'R - . R R - . .', vol: 0.45 },
      { type: 'drum', inst: 'darbuka', pattern: 'X..x..x.x...x...', vol: 0.5 },
      { type: 'drum', inst: 'tick', pattern: '....x..x....x.x.', vol: 0.3 },
      { type: 'mel', inst: 'oud', from: 4, vol: 0.5, notes: [
        'D5 Eb5 F#5 - G5 - F#5 Eb5', 'D5 - - - Eb5 - D5 C5', 'D5 - A4 - Bb4 - A4 -', 'G4 - Bb4 C5 Bb4 - A4 G4',
        'A4 - D5 - F#5 - A5 -', 'G5 F#5 Eb5 - D5 - Eb5 -', 'D5 - Bb4 - G4 - Bb4 A4', 'D5 - - - - - . .'] },
    ],
  },

  // Ciudad de Engranajes: mecánica, campanas y tic-tac (la menor)
  ciudad: {
    bpm: 108, vol: 0.8, chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E'],
    tracks: [
      { type: 'bass', inst: 'bass', oct: 2, pattern: 'R . R . O . R . F . R . O . R .', vol: 0.4 },
      { type: 'arp', inst: 'pluck', oct: 4, pattern: '0 2 1 2 0 2 1 2', vol: 0.25 },
      { type: 'drum', inst: 'tick', pattern: 'x.x.x.x.x.x.x.x.', vol: 0.35 },
      { type: 'drum', inst: 'kick', pattern: 'x.......x.......', vol: 0.45 },
      { type: 'drum', inst: 'clap', pattern: '....x.......x...', vol: 0.3, from: 4 },
      { type: 'pad', inst: 'strings', oct: 3, vol: 0.25, from: 8 },
      { type: 'mel', inst: 'bell', from: 8, vol: 0.45, notes: [
        'E5 - A5 - G5 - E5 -', 'F5 - - - E5 - C5 -', 'G5 - - - E5 - G5 -', 'D5 - - - B4 - - -',
        'C5 - E5 - A5 - B5 -', 'C6 - - - A5 - F5 -', 'F5 - E5 - D5 - F5 -', 'E5 - - - G#5 - B5 -'] },
    ],
  },

  // Glaciar del Eco: lento, frío, campanas de cristal con mucho eco (si menor)
  glaciar: {
    bpm: 66, vol: 0.9, chords: ['Bm', 'G', 'D', 'A', 'Bm', 'Em', 'G', 'F#'],
    tracks: [
      { type: 'pad', inst: 'pad', oct: 3, vol: 0.45, open: true },
      { type: 'arp', inst: 'glass', oct: 5, pattern: '0 . 2 . 4 . 2 .', vol: 0.25 },
      { type: 'bass', inst: 'subbass', oct: 2, pattern: 'R - - - - - - -', vol: 0.4 },
      { type: 'mel', inst: 'bell', from: 4, vol: 0.35, notes: [
        'F#5 - - - - - B5 -', 'A5 - - - G5 - - -', 'F#5 - - - D5 - - -', 'E5 - - - - - - -',
        'D5 - - - F#5 - - -', 'G5 - - - B5 - - -', 'A5 - - - G5 - D5 -', 'C#5 - - - - - - -'] },
    ],
  },

  // Ciudadela de la Orden: oscura y solemne, coro y campana (do menor)
  ciudadela: {
    bpm: 72, vol: 0.9, chords: ['Cm', 'Ab', 'Fm', 'G', 'Cm', 'Bb', 'Ab', 'G'],
    tracks: [
      { type: 'pad', inst: 'choir', oct: 3, vol: 0.55 },
      { type: 'bass', inst: 'subbass', oct: 1, pattern: 'R - - - R - - -', vol: 0.5 },
      { type: 'drum', inst: 'toll', pattern: 'x...............', vol: 0.45 },
      { type: 'mel', inst: 'strings', from: 4, vol: 0.5, notes: [
        'G4 - - - C5 - Eb5 -', 'D5 - - - C5 - - -', 'Ab4 - - - C5 - F5 -', 'Eb5 - D5 - - - B4 -',
        'C5 - Eb5 - G5 - - -', 'F5 - - - D5 - Bb4 -', 'C5 - - - Eb5 - D5 C5', 'B4 - - - - - - -'] },
    ],
  },

  // Jefes: tema rápido con tambores, bajo galopante y metales (re menor; cada jefe lo transpone)
  boss: {
    bpm: 138, vol: 0.8, chords: ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Bb', 'A'],
    tracks: [
      { type: 'bass', inst: 'bass', oct: 2, pattern: 'R R O R R R O R R R O R F F O F', vol: 0.45 },
      { type: 'stab', inst: 'strings', oct: 4, pattern: 'X..x..x.x..x..x.', vol: 0.5 },
      { type: 'drum', inst: 'kick', pattern: 'x...x...x...x...', vol: 0.6 },
      { type: 'drum', inst: 'snare', pattern: '....x.......x..x', vol: 0.5 },
      { type: 'drum', inst: 'hat', pattern: 'x.x.x.x.x.x.x.x.', vol: 0.5 },
      { type: 'mel', inst: 'brass', from: 4, vol: 0.5, notes: [
        'D5 - - - A4 - D5 E5', 'F5 - E5 - D5 - C5 -', 'D5 - - - F5 - - -', 'E5 - G5 - E5 - C5 -',
        'D5 - - - A5 - - -', 'G5 - F5 - E5 - D5 -', 'F5 - - - D5 - Bb4 -', 'C#5 - - - E5 - - -'] },
    ],
  },

  // Vaelor: el tema de Aethra, en menor y con coro
  vaelor: {
    bpm: 124, vol: 0.85, chords: ['Cm', 'Ab', 'Bb', 'G', 'Cm', 'Ab', 'Fm', 'G'],
    tracks: [
      { type: 'pad', inst: 'choir', oct: 3, vol: 0.5 },
      { type: 'bass', inst: 'bass', oct: 2, pattern: 'R . R O R . R O R . R O F . F O', vol: 0.45 },
      { type: 'stab', inst: 'strings', oct: 4, pattern: 'x..x..x...x..x..', vol: 0.4 },
      { type: 'drum', inst: 'kick', pattern: 'x..x..x...x..x..', vol: 0.6 },
      { type: 'drum', inst: 'snare', pattern: '....X.......X...', vol: 0.5 },
      { type: 'drum', inst: 'toll', pattern: 'x...............', vol: 0.3 },
      { type: 'mel', inst: 'brass', from: 4, vol: 0.5, notes: [
        'G4 - C5 - D5 - Eb5 -', 'Eb5 - D5 - C5 - Bb4 -', 'Bb4 - D5 - F5 - - -', 'D5 - - - B4 - - -',
        'G4 - C5 - D5 - Eb5 -', 'G5 - F5 - Eb5 - C5 -', 'Ab5 - G5 - F5 - Eb5 -', 'D5 - - - - - - -'] },
    ],
  },

  // Final: el tema de Aethra, lento y con cuerdas
  finale: {
    bpm: 66, vol: 0.95, chords: ['D', 'Bm', 'G', 'A', 'D', 'F#m', 'G', 'D'],
    tracks: [
      { type: 'pad', inst: 'strings', oct: 3, vol: 0.4 },
      { type: 'arp', inst: 'harp', oct: 4, pattern: '0 1 2 3 4 3 2 1', vol: 0.3 },
      { type: 'bass', inst: 'bass', oct: 2, pattern: 'R - - - - - - -', vol: 0.4 },
      { type: 'mel', inst: 'flute', vol: 0.5, notes: TEMA },
    ],
  },
};

// Variantes de jefe: misma partitura, otro tono y otro tempo
SONGS.boss_raiz = { ...SONGS.boss, bpm: 128 };
SONGS.boss_escorpion = { ...SONGS.boss, transpose: 2, bpm: 136 };
SONGS.boss_coloso = { ...SONGS.boss, transpose: -2, bpm: 120 };
SONGS.boss_sierpe = { ...SONGS.boss, transpose: -3, bpm: 140 };


// Desafíos: animado y rápido (do mayor) y su versión nocturna (la menor)
SONGS.desafio = {
  bpm: 124, vol: 0.8, chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G'],
  tracks: [
    { type: 'bass', inst: 'bass', oct: 2, pattern: 'R . O . R . O . R . O . F . O .', vol: 0.4 },
    { type: 'arp', inst: 'pluck', oct: 4, pattern: '0 1 2 3 2 1 0 1', vol: 0.3 },
    { type: 'drum', inst: 'kick', pattern: 'x...x...x...x...', vol: 0.5 },
    { type: 'drum', inst: 'clap', pattern: '....x.......x...', vol: 0.35 },
    { type: 'drum', inst: 'hat', pattern: '..x...x...x...x.', vol: 0.5 },
    { type: 'mel', inst: 'lead', from: 4, vol: 0.4, notes: [
      'E5 - G5 - C6 - B5 G5', 'D5 - - - G5 - - -', 'C5 - E5 - A5 - G5 E5', 'F5 - - - A5 - - -',
      'G5 - E5 - C5 - E5 G5', 'B5 - - - D6 - B5 -', 'A5 - G5 - F5 - A5 -', 'G5 - - - - - . .'] },
  ],
};
SONGS.desafio_noche = { ...SONGS.desafio, bpm: 116, chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E'],
  tracks: [...SONGS.desafio.tracks.slice(0, 4), { type: 'pad', inst: 'pad', oct: 3, vol: 0.3 },
    { type: 'mel', inst: 'bell', from: 4, vol: 0.4, notes: ['A5 - E5 - C6 - B5 -', 'A5 - - - F5 - - -', 'G5 - E5 - C5 - E5 -', 'D5 - - - G5 - - -', 'A5 - C6 - E6 - D6 -', 'C6 - - - A5 - - -', 'F5 - A5 - D6 - C6 -', 'B5 - - - G#5 - - -'] }] };

// Arena: batalla épica con tambores taiko, cuerdas que galopan y metales (re menor)
SONGS.arena = {
  bpm: 146, vol: 0.85, battle: true, chords: ['Dm', 'Bb', 'C', 'Am', 'Dm', 'Bb', 'Gm', 'A'],
  tracks: [
    { type: 'pad', inst: 'strings', oct: 3, vol: 0.3 },
    { type: 'bass', inst: 'bass', oct: 2, pattern: 'R R O R R R O R R R O R F F O F', vol: 0.45 },
    { type: 'stab', inst: 'strings', oct: 4, pattern: 'x.xx.xx.x.xx.xx.', vol: 0.35 },
    { type: 'drum', inst: 'taiko', pattern: 'X..x..x.X..x.x..', vol: 0.6 },
    { type: 'drum', inst: 'snare', from: 2, pattern: '....x.......x..x', vol: 0.45 },
    { type: 'drum', inst: 'ohat', from: 2, pattern: '..x...x...x...x.', vol: 0.4 },
    { type: 'drum', inst: 'crash', pattern: 'x...............', vol: 0.25, every: 2 },
    { type: 'arp', inst: 'pluck', oct: 4, from: 4, pattern: '0 2 4 2 5 4 2 1', vol: 0.25 },
    { type: 'mel', inst: 'brass', from: 4, vol: 0.5, notes: [
      'D5 - - A4 D5 - F5 -', 'F5 - E5 - D5 - C5 -', 'E5 - - C5 E5 - G5 -', 'A5 - - - E5 - - -',
      'D5 - - A4 D5 - F5 -', 'Bb5 - A5 - G5 - F5 -', 'G5 - F5 - E5 - D5 -', 'C#5 - - - E5 - A5 -'] },
  ],
};
// Aethra sin fin: viaje alegre con piano eléctrico y cuerdas pulsadas
SONGS.infinito = {
  bpm: 112, vol: 0.85, chords: ['Fmaj7', 'G', 'Em', 'Am', 'Fmaj7', 'G', 'C', 'C'],
  tracks: [
    { type: 'pad', inst: 'pad', oct: 3, vol: 0.35, open: true },
    { type: 'arp', inst: 'harp', oct: 4, pattern: '0 2 4 2 1 3 4 3', vol: 0.3 },
    { type: 'bass', inst: 'bass', oct: 2, pattern: 'R . . R . . F . R . . R . . O .', vol: 0.42 },
    { type: 'drum', inst: 'kick', pattern: 'x.....x...x.....', vol: 0.5 },
    { type: 'drum', inst: 'snare', from: 2, pattern: '....x.......x...', vol: 0.35 },
    { type: 'drum', inst: 'shaker', from: 2, pattern: 'x.x.x.x.x.x.x.x.', vol: 0.3 },
    { type: 'mel', inst: 'epiano', from: 4, vol: 0.5, notes: [
      'E5 - G5 - A5 - C6 -', 'B5 - - - G5 - - -', 'G5 - E5 - B4 - E5 -', 'A5 - - - C6 - B5 A5',
      'A5 - C6 - E6 - D6 C6', 'B5 - G5 - D5 - G5 -', 'E5 - G5 - C6 - - -', 'C6 - - - - - . .'] },
  ],
};
SONGS.boss.battle = true; SONGS.boss_escorpion.battle = true; SONGS.boss_coloso.battle = true; SONGS.boss_sierpe.battle = true; SONGS.vaelor.battle = true;

// Capítulo extra: el tema de Aethra, nocturno y con campanas; su jefe usa el tema de Vaelor en otro tono
SONGS.eco = { ...SONGS.title, bpm: 68, transpose: -3, vol: 0.9, tracks: [
  { type: 'pad', inst: 'choir', oct: 3, vol: 0.4, open: true },
  { type: 'arp', inst: 'glass', oct: 4, pattern: '0 2 4 2 1 3 4 3', vol: 0.25 },
  { type: 'bass', inst: 'subbass', oct: 2, pattern: 'R - - - F - - -', vol: 0.35 },
  { type: 'mel', inst: 'bell', notes: TEMA, vol: 0.38, from: 4 },
] };
// Forjas de Ignis: tambores de forja, cuerdas que empujan y un metal que brilla (mi frigio)
SONGS.forja = {
  bpm: 118, vol: 0.85, chords: ['Em', 'F', 'Em', 'Dm', 'Em', 'F', 'G', 'F'],
  tracks: [
    { type: 'pad', inst: 'pad', oct: 2, vol: 0.3 },
    { type: 'bass', inst: 'bass', oct: 2, pattern: 'R . R R . R O . R . R R . F O .', vol: 0.45 },
    { type: 'drum', inst: 'kick', pattern: 'X..x..x.X..x....', vol: 0.55 },
    { type: 'drum', inst: 'toll', pattern: 'x...............', vol: 0.25 },
    { type: 'drum', inst: 'clap', from: 2, pattern: '....x.......x...', vol: 0.35 },
    { type: 'drum', inst: 'shaker', from: 2, pattern: '.x.x.x.x.x.x.x.x', vol: 0.25 },
    { type: 'stab', inst: 'strings', oct: 4, from: 2, pattern: 'x..x..x.....x.x.', vol: 0.35 },
    { type: 'mel', inst: 'brass', from: 4, vol: 0.45, notes: [
      'E5 - F5 - G5 - - -', 'A5 - G5 - F5 - E5 -', 'E5 - - - B4 - E5 -', 'F5 - - - D5 - - -',
      'E5 - F5 - G5 - B5 -', 'A5 - - - G5 - F5 -', 'G5 - F5 - E5 - D5 -', 'E5 - - - - - . .'] },
  ],
};
// Créditos: fiesta bailable (fa mayor, con palmas y bajo saltarín)
// Mareth: el fondo del mar (re dórico, lento, con arpegios que suben como burbujas)
SONGS.mareth = {
  bpm: 84, vol: 0.8, chords: ['Dm', 'Em', 'F', 'Em', 'Dm', 'C', 'Bb', 'C'],
  tracks: [
    { type: 'pad', inst: 'pad', oct: 3, vol: 0.4 },
    { type: 'bass', inst: 'bass', oct: 2, pattern: 'R . . . . . O . R . . . . . . .', vol: 0.35 },
    { type: 'arp', inst: 'harp', oct: 4, pattern: '0 1 2 3 2 1 0 .', vol: 0.3 },
    { type: 'drum', inst: 'shaker', from: 2, pattern: '....x.......x...', vol: 0.15 },
    { type: 'mel', inst: 'flute', from: 2, vol: 0.4, notes: [
      'A5 - - - D6 - - -', 'B5 - - - G5 - - -', 'A5 - C6 - F5 - - -', 'E5 - - - - - . .',
      'F5 - - - A5 - - -', 'G5 - - - E5 - C5 -', 'D5 - F5 - Bb5 - - -', 'A5 - - - - - . .'] },
  ],
};
SONGS.creditos = {
  bpm: 124, vol: 0.9, chords: ['F', 'Dm', 'Bb', 'C', 'F', 'Dm', 'Gm', 'C'],
  tracks: [
    { type: 'pad', inst: 'pad', oct: 3, vol: 0.25 },
    { type: 'bass', inst: 'bass', oct: 2, pattern: 'R . O . R R O . R . O . R R O R', vol: 0.5 },
    { type: 'drum', inst: 'kick', pattern: 'X...X...X...X...', vol: 0.6 },
    { type: 'drum', inst: 'clap', pattern: '....x.......x...', vol: 0.45 },
    { type: 'drum', inst: 'shaker', pattern: 'x.x.x.x.x.x.x.x.', vol: 0.3 },
    { type: 'stab', inst: 'strings', oct: 4, pattern: '..x...x...x...x.', vol: 0.3 },
    { type: 'mel', inst: 'brass', from: 2, vol: 0.45, notes: [
      'F5 - A5 - C6 - A5 -', 'D6 - C6 - A5 - F5 -', 'D5 - F5 - Bb5 - D6 -', 'C6 - - - G5 - - -',
      'A5 - C6 - F6 - C6 -', 'D6 - F6 - D6 - A5 -', 'G5 - Bb5 - D6 - Bb5 -', 'C6 - E6 - G6 - - -'] },
  ],
};
SONGS.boss_eco = { ...SONGS.vaelor, transpose: 2, bpm: 132 };

// Fanfarrias cortas. 'nota:duración en tiempos', '+' para acordes.
export const STINGERS = {
  victoria: { bpm: 120, len: 6, vol: 1, parts: [
    ['brass', 'D5:0.5 F#5:0.5 A5:0.5 D6:2.5'],
    ['strings', '.:1.5 D4+F#4+A4:3'],
    ['bell', '.:1.5 D6:3'],
  ] },
  derrota: { bpm: 80, len: 4, vol: 0.9, parts: [
    ['strings', 'A4:1 F4:1 D4:2'],
    ['bass', 'D3:4'],
  ] },
  capitulo: { bpm: 90, len: 6, vol: 1, parts: [
    ['harp', 'A4:0.5 D5:0.5 E5:0.5 F#5:0.5 A5:2'],
    ['strings', '.:2 D4+A4+F#5:4'],
  ] },
  hallazgo: { bpm: 110, len: 3, vol: 0.8, parts: [
    ['bell', 'A5:0.5 D6:0.5 F#6:2'],
  ] },
};
