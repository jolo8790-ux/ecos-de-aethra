// Capítulo 5 — La Ciudadela de la Orden.
// Recorrido hacia -z: muelle → barrera de sombra → patio → puentes de luz → bastión → escalera de luz → terraza → sala del trono (Vaelor) → altar del Corazón.

const L = (who, text, extra = {}) => ({ who, text, ...extra });
const LIA = 'Lía', MARTA = 'Capitana Marta', KAEL = 'Kael', VAELOR = 'Vaelor', NARR = '';

export default {
  id: 'ciudadela_orden',
  title: 'La Ciudadela de la Orden',
  subtitle: 'Capítulo 5',
  seed: 53,
  sky: { top: 0x1a1236, bottom: 0x8a4a6a, fog: 0x4a3a5a, fogNear: 28, fogFar: 130 },
  light: { hemiSky: 0xc8b8f0, hemiGround: 0x3a2a3a, sun: 0xffd8a8 },
  palette: { top: 0x6a6070, side: 0x3a3242 },
  water: { y: -18, color: 0x7a5a8a },
  start: { id: 'llegada', pos: [0, 0, 4], facing: 0 },

  // objetos que se rompen con el bastón (la geoda violeta guarda la Reliquia de Aethra de esta zona)
  breakables: [
    { id: 'reliquia_ciudadela_orden', kind: 'cofre', x: -7, y: 2, z: -52.5, loot: 'reliquia' },
    { id: 'ciudadela_orden_v1', kind: 'vasija', x: 6, y: 0, z: -24, loot: 'corazon' },
    { id: 'ciudadela_orden_v2', kind: 'vasija', x: -6, y: 0, z: -15 },
    { id: 'ciudadela_orden_v3', kind: 'vasija', x: 3.5, y: 7, z: -69, loot: 'corazon' },
  ],
  islands: [
    { x: 0, z: 2, w: 16, d: 16, top: 0, depth: 4 },          // muelle
    { x: 0, z: -20, w: 16, d: 14, top: 0, depth: 4 },        // patio
    { x: 0, z: -48, w: 16, d: 12, top: 2, depth: 4 },        // bastión
    { x: 0, z: -66, w: 10, d: 10, top: 7, depth: 3 },        // terraza
    { x: 0, z: -90, w: 24, d: 24, top: 7, depth: 5 },        // sala del trono
    { x: 0, z: -114, w: 12, d: 12, top: 7, depth: 4 },       // altar del Corazón
  ],
  bridges: [
    { x1: 0, z1: -6, x2: 0, z2: -12.8, y: 0, w: 2.4 },
    { x1: 0, z1: -71.2, x2: 0, z2: -77.8, y: 7, w: 2.4 },
    { x1: 0, z1: -102.2, x2: 0, z2: -107.8, y: 7, w: 2.4 },
  ],
  darkBarriers: [
    { id: 'entrada', x: 0, z: -12.6, w: 4, h: 3.8, flag: 'sombra_entrada' },
    { id: 'altar', x: 0, y: 7, z: -105, w: 4, h: 4, flag: 'sombra_altar' },
  ],
  lightCrystals: [
    { id: 'patio', x: 4, z: -24.5, flag: 'luz_patio' },
    { id: 'bastion', x: -5, y: 2, z: -51.5, flag: 'luz_bastion' },
  ],
  lightPlatforms: [
    { crystal: 'patio', x: 0, y: 0.5, z: -30, w: 3, d: 3 }, { crystal: 'patio', x: 1.2, y: 0.9, z: -33.4, w: 3, d: 3 }, { crystal: 'patio', x: -0.6, y: 1.3, z: -36.8, w: 3, d: 3 }, { crystal: 'patio', x: 0.4, y: 1.7, z: -40.2, w: 3, d: 3 },
    { crystal: 'bastion', x: 0, y: 3.4, z: -56.2 }, { crystal: 'bastion', x: 1.8, y: 4.8, z: -58.6 }, { crystal: 'bastion', x: 0, y: 6.2, z: -61 },
  ],
  obelisks: [
    { x: -6.5, z: -15 }, { x: 6.5, z: -15 }, { x: -6, y: 2, z: -44, h: 6 }, { x: 6, y: 2, z: -44, h: 6 },
    { x: -10.5, y: 7, z: -80, h: 9 }, { x: 10.5, y: 7, z: -80, h: 9 }, { x: -10.5, y: 7, z: -100, h: 9 }, { x: 10.5, y: 7, z: -100, h: 9 },
  ],
  banners: [
    { x: -3, z: -14 }, { x: 3, z: -14, rot: Math.PI }, { x: -4, y: 7, z: -62 }, { x: 4, y: 7, z: -62, rot: Math.PI },
    { x: -5, y: 7, z: -109 }, { x: 5, y: 7, z: -109, rot: Math.PI },
  ],
  towers: [
    { x: -15, z: -30, h: 40, color: 0x3a3242 }, { x: 16, z: -50, h: 46, color: 0x3a3242 }, { x: -17, z: -88, h: 50, color: 0x3a3242 },
    { x: 17, z: -100, h: 44, color: 0x3a3242 }, { x: 0, z: -132, h: 56, w: 6, color: 0x2a2235 },
  ],
  airships: [{ id: 'dirigible', x: -1, y: 1.2, z: 13.5 }],

  signs: [
    {
      id: 'cartel_luz', x: -2.5, z: -24, rot: 0.3, title: 'Placa de la Orden',
      lines: ['"Solo la luz del Corazón abre el camino al trono." Alguien rayó debajo: los cristales apagados despiertan con un pulso (Z).'],
    },
  ],
  npcs: [
    { id: 'marta_c5', name: MARTA, model: 'marta', x: -3.2, z: 6, rot: -0.6, lines: ['...'] },
    { id: 'kael_c5', name: KAEL, model: 'kael', x: 3, z: 5, rot: 0.6, lines: ['...'], when: S => !S.has('vaelor_vencido') },
    { id: 'kael_altar', name: KAEL, model: 'kael', x: 3.5, y: 7, z: -111, rot: 0.6, lines: ['...'], when: S => S.has('vaelor_vencido') },
    { id: 'marta_altar', name: MARTA, model: 'marta', x: -3.5, y: 7, z: -111, rot: -0.6, lines: ['...'], when: S => S.has('vaelor_vencido') },
  ],
  items: [
    { id: 'corazon', model: 'heart', x: 0, y: 7, z: -115.5, radius: 2.8, verb: 'Acercarse al Corazón', when: S => S.has('vaelor_vencido') },
  ],
  lanterns: [
    { id: 'llegada', x: 3.2, z: 2.2, facing: 0 },
    { id: 'patio', x: -5, z: -18, facing: 0 },
    { id: 'bastion', x: 4.5, y: 2, z: -45, facing: 0 },
    { id: 'terraza', x: 3.5, y: 7, z: -64, facing: 0 },
    { id: 'altar', x: -2, y: 7, z: -109.5, facing: 0 },
  ],
  fragments: [
    { id: 'co_patio', x: 6.5, z: -26 },
    { id: 'co_luz', x: -0.6, y: 1.3, z: -36.8 },
    { id: 'co_bastion', x: 6.5, y: 2, z: -52.5 },
    { id: 'co_escalera', x: 1.8, y: 4.8, z: -58.6 },
    { id: 'co_trono', x: -9, y: 7, z: -97 },
  ],
  enemies: [
    { type: 'sombra', x: -3, z: -22 }, { type: 'sombra', x: 3, z: -19 },
    { type: 'centinela', x: -5.5, y: 2, z: -46 }, { type: 'centinela', x: 5.5, y: 2, z: -50 }, { type: 'sombra', x: 0, y: 2, z: -47 },
    { type: 'sombra', x: -2, y: 7, z: -67 },
  ],
  boss: { type: 'vaelor', x: 0, y: 7, z: -92, arenaR: 10, facing: 0, flag: 'vaelor_vencido', region: [-12, 5, -100, 12, 14, -80] },
  regions: [
    { id: 'patio', box: [-8, -1, -27, 8, 3, -13], flag: 'llego_patio' },
    { id: 'bastion', box: [-8, 1.5, -54, 8, 5, -42], flag: 'llego_bastion' },
    { id: 'terraza', box: [-5, 6.5, -71, 5, 10, -61], flag: 'llego_terraza' },
  ],

  finaleAt: [0, 7, -115.5],
  finale: {
    a: { title: 'El Corazón restaurado', sky: { top: 0xffb86a, bottom: 0xfff2d0, fog: 0xffe0b0 }, mote: 0xffd27a },
    b: { title: 'El viento libre', sky: { top: 0x4a8ad8, bottom: 0xd8f0ff, fog: 0xbfe0f8 }, mote: 0xbff4ff },
  },

  story: {
    intro: [
      L(NARR, 'El dirigible amarra bajo las murallas de la Ciudadela. Todo está en silencio.'),
      L(KAEL, 'Conozco estos muros. Las barreras de sombra de Vaelor cierran cada paso.'),
      L(NARR, 'De pronto, los cuatro fragmentos de tu bolsa se iluminan a la vez y laten al mismo ritmo.'),
      L(LIA, 'Están... cantando. Siento su luz en las manos.'),
      L(NARR, 'Obtuviste el Pulso de Luz: pulsa Z para liberar la luz de los fragmentos. Deshace la sombra y enciende los cristales apagados.', { system: true }),
      L(MARTA, 'Ve, chiquilla. Kael y yo vigilamos el dirigible. Termina lo que empezó tu abuelo.'),
    ],
    onIntroEnd: S => { S.set('pulso'); },

    goal(S) {
      if (!S.has('sombra_entrada')) return { text: 'Usa el pulso de luz (Z) junto a la barrera de sombra', at: [0, 0, -12.6] };
      if (!S.has('luz_patio')) return { text: 'Enciende el cristal de luz del patio con un pulso', at: [4, 0, -24.5] };
      if (!S.has('llego_bastion')) return { text: 'Cruza saltando por los puentes de luz', at: [0, 2, -44] };
      if (!S.has('luz_bastion')) return { text: 'Enciende el cristal del bastión para subir a la terraza', at: [-5, 2, -51.5] };
      if (!S.has('llego_terraza')) return { text: 'Sube por la escalera de luz', at: [0, 7, -63] };
      if (!S.has('vaelor_vencido')) return S.bossActive ? { text: 'Rompe su barrera con el pulso o devolviéndole un orbe, y golpéalo', at: null } : { text: 'Entra en la sala del trono', at: [0, 7, -80] };
      if (!S.has('juego_completado')) return { text: 'Lleva los cinco fragmentos al altar del Corazón', at: [0, 7, -115.5] };
      return { text: 'Aethra está a salvo. Puedes volver al altar y elegir otro camino.', at: [0, 7, -115.5] };
    },

    bossIntro: [
      L(NARR, 'Un hombre alto con armadura negra se levanta del trono. En su pecho brilla el quinto fragmento.'),
      L(VAELOR, 'La nieta de Ilan. Tienes sus ojos... y su terquedad.'),
      L(VAELOR, 'Dame los fragmentos. Con el Corazón entero, ninguna isla volverá a hundirse.'),
      L(LIA, 'Y la Orden decidiría a dónde sopla cada viento. No.'),
      L(VAELOR, 'Entonces te los quitaré yo mismo.'),
    ],
    bossDefeated: [
      L(NARR, 'Vaelor cae de rodillas. Su barrera se apaga y el quinto fragmento rueda hasta tus pies.'),
      L(VAELOR, 'Yo... solo quería salvarlas. Ilan prefirió esconderlo todo antes que confiar en mí.'),
      L(LIA, 'Confió en que alguien elegiría bien. Esa soy yo ahora.'),
      L(NARR, 'Obtuviste el último Gran Fragmento del Corazón (5 de 5). La sombra que cerraba el altar se deshace.', { system: true }),
    ],
    onBossDefeated: S => { S.set('vaelor_vencido'); S.set('gran_fragmento_5'); S.give('Gran Fragmento del Corazón'); S.dispel('altar'); },

    talk: {
      marta_c5() { return { lines: [L(MARTA, 'Aquí estaremos. Si las cosas se ponen feas, vuelve al farol y respira.')] }; },
      kael_c5() { return { lines: [L(KAEL, 'Las criaturas con aura de sombra no sienten el bastón. Primero la luz, después el golpe.')] }; },
      kael_altar() { return { lines: [L(KAEL, 'Sea lo que sea que elijas... me alegra haber estado de tu lado al final.')] }; },
      marta_altar() { return { lines: [L(MARTA, 'Tu abuelo estaría orgulloso, Lía. Elijas lo que elijas.')] }; },
      corazon(S) {
        const again = S.has('juego_completado');
        return {
          lines: [
            L(NARR, again ? 'Los cinco fragmentos vuelven a brillar sobre el altar, esperando.' : 'Colocas los cinco fragmentos sobre el altar. Giran despacio alrededor de un núcleo de luz.'),
            L(LIA, 'El abuelo lo partió para que nadie pudiera gobernar los vientos. Vaelor quería unirlo para salvar las islas.'),
            L(LIA, 'Los dos tenían algo de razón. Ahora me toca a mí.'),
            {
              who: '', text: '¿Qué harás con el Corazón de Aethra?', system: true,
              choices: [
                { label: 'Restaurar el Corazón y protegerlo', then: () => S.endingDialog('a') },
                { label: 'Liberar su luz en el viento', then: () => S.endingDialog('b') },
              ],
            },
          ],
        };
      },
    },

    endings: {
      a: [
        L(NARR, 'Los cinco fragmentos se funden en uno. El Corazón de Aethra late entero por primera vez en cien años.'),
        L(NARR, 'Una ola de luz dorada recorre el cielo. Las islas que se hundían se elevan despacio sobre el mar de nubes.'),
        L(KAEL, 'Sin la Orden, alguien tendrá que cuidarlo.'),
        L(LIA, 'Lo cuidaremos todos. Lo pondremos donde cualquiera pueda verlo, y nadie pueda esconderlo.'),
        L(MARTA, 'La primera guardiana del Corazón que no lo guarda en secreto. Me gusta.'),
      ],
      b: [
        L(NARR, 'Alzas el bastón. Los cinco fragmentos se deshacen en cinco luces que salen volando, cada una hacia una isla.'),
        L(NARR, 'Las islas tiemblan... y después se quedan quietas, flotando por sí mismas, con un brillo nuevo bajo la tierra.'),
        L(KAEL, 'Ya no hay Corazón que robar. Nadie podrá gobernar los vientos.'),
        L(LIA, 'Cada isla cuida ahora su propia luz. Como quería el abuelo.'),
        L(MARTA, 'Entonces habrá que visitarlas todas para comprobarlo. ¿Subes, capitana Lía?'),
      ],
    },
  },
};
