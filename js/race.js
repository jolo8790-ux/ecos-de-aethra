// Carreras de Aethra — etapa 1: Gran Premio de Puerto Bruma.
// Una pista cerrada de tablones sobre el mar de nubes, karts contra la CPU, 3 o 5 vueltas,
// derrape con turbo, placas de impulso y podio con premio en Ecos.
import * as THREE from 'three';
import { createCharacter, recolor } from './characters.js';
import { HEROES, heroById, heroLook, heroUnlocked } from './heroes.js';
import { prop, hasProp } from './props.js';
import { RaceItems, ITEMS } from './raceitems.js';
import { buildHazards, tickHazards } from './racehaz.js';
import { KARTS, kartById, garageOf, kartPoints, kartMods, PAINTS, TRAILS, DRIVERS, partOf, retoOk } from './garage.js';

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angD = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const damp = (k, dt) => 1 - Math.exp(-k * dt);

// ---------- pistas ----------
// p: puntos de control [x, z, altura]; w: ancho; boosts: placas de impulso (fracción de la vuelta)
export const TRACKS = {
  puerto: {
    name: 'Gran Premio de Puerto Bruma', short: 'Puerto Bruma', icon: '⚓',
    desc: 'Muelles de tablones sobre el mar de nubes, con el faro y una subida al muelle alto.',
    w: 13,
    p: [[0, 0, 0], [45, 0, 0], [80, -8, 0.5], [100, -38, 2], [96, -72, 4.5], [70, -96, 6], [32, -98, 6], [10, -80, 4.5], [-6, -56, 3], [-30, -46, 2.5],
      [-58, -60, 3], [-86, -50, 2], [-96, -20, 1], [-80, 8, 0.4], [-48, 14, 0]],
    boosts: [0.06, 0.33, 0.58, 0.86], items: [0.17, 0.45, 0.72],
    sky: { top: 0x4f8fe0, bottom: 0xffd2b0, fog: 0xf2d8e8, fogNear: 90, fogFar: 300 },
    light: { hemiSky: 0xfff0ff, hemiGround: 0x6a4a8a, sun: 0xfff0d0 },
    water: { y: -6, color: 0xf6eaff },
    reward: [60, 35, 20, 10],
    feat: { ramps: [0.24], tunnels: [[0.08, 0.17]], bridges: [[0.4, 0.5]] },
    theme: { tunnel: 0x6a5a4a, cable: 0x3a2a1a, road: 'planks', curb: ['#f4f2ee', '#e8483c'], side: 0x6e4428, rail: 0x8c5a32, post: 0x5a3820, pile: 0x5e3c24, banner: '◆  GRAN PREMIO DE PUERTO BRUMA  ◆', decor: 'puerto', palette: { top: 0x7ac85a, side: 0x8a6a54 } },
  },
  bosque: {
    name: 'Circuito del Bosque Colgante', short: 'Bosque Colgante', icon: '🌳',
    desc: 'Ramas gigantes entre árboles colosales, subidas, bajadas y curvas cerradas entre hongos.',
    w: 12,
    p: [[0, 0, 0], [40, 0, 2], [70, -15, 6], [78, -45, 9], [55, -70, 7], [25, -62, 4], [10, -85, 5], [-15, -110, 9], [-50, -100, 11], [-70, -70, 8], [-55, -40, 4], [-75, -15, 2], [-60, 12, 0.5], [-30, 18, 0]],
    boosts: [0.04, 0.3, 0.55, 0.8], items: [0.14, 0.42, 0.68, 0.9],
    sky: { top: 0x3a8a6a, bottom: 0xffe0a0, fog: 0xc8e0b0, fogNear: 70, fogFar: 240 },
    light: { hemiSky: 0xfff4d0, hemiGround: 0x3a5a2a, sun: 0xffe8b0 },
    water: { y: -14, color: 0xc8e8b8 },
    reward: [70, 40, 22, 12],
    feat: { ramps: [0.78], tunnels: [[0.18, 0.27]], bridges: [[0.48, 0.58]] },
    theme: { tunnel: 0x5a3a22, cable: 0x3a6a2a, road: 'forest', curb: ['#ffd24a', '#3a9a4a'], side: 0x5a3a22, rail: 0x4a8a3a, post: 0x4a3018, pile: 0x5a3a22, banner: '◆  CIRCUITO DEL BOSQUE COLGANTE  ◆', decor: 'bosque', palette: { top: 0x5ab04a, side: 0x6a4a34 } },
  },
  glaciar: {
    name: 'Pista del Glaciar del Eco', short: 'Glaciar del Eco', icon: '❄', lock: 'bosque',
    desc: 'Hielo resbaloso entre pinos nevados: aquí se derrapa casi sin querer.',
    w: 14, grip: 0.86, slide: 1.5,
    p: [[0, 0, 0], [55, 0, 0], [95, -20, 1], [105, -60, 3], [80, -95, 4], [40, -90, 2], [20, -60, 1], [-10, -55, 2], [-30, -90, 5], [-70, -100, 6], [-100, -70, 4], [-95, -30, 2], [-60, -10, 1], [-30, 10, 0]],
    boosts: [0.08, 0.36, 0.62, 0.88], items: [0.2, 0.5, 0.78],
    sky: { top: 0x6a9ad8, bottom: 0xf0f6ff, fog: 0xe8f0fa, fogNear: 70, fogFar: 260 },
    light: { hemiSky: 0xf4f8ff, hemiGround: 0x8aa0c0, sun: 0xffffff },
    water: { y: -8, color: 0xeef6ff },
    reward: [80, 45, 25, 14],
    feat: { ramps: [0.6], tunnels: [[0.28, 0.4]], bridges: [[0.7, 0.82]] },
    theme: { tunnel: 0x9ad0ff, tunnelGlass: true, cable: 0x7aa0c8, road: 'ice', curb: ['#ffffff', '#3a7aff'], side: 0x9ac0e0, rail: 0xd8ecff, post: 0x7aa0c8, pile: 0xb8d4ee, banner: '◆  PISTA DEL GLACIAR DEL ECO  ◆', decor: 'glaciar', palette: { top: 0xf4f8ff, side: 0x9ab4d0 } },
  },
  canon: {
    name: 'Cañón del Ocaso', short: 'Cañón del Ocaso', icon: '🌄', lock: 'glaciar',
    desc: 'Al atardecer entre mesetas rojas: puente colgante sobre el abismo, túnel en la roca y dos rampas.',
    w: 13,
    p: [[0, 0, 0], [50, 0, 2], [90, -15, 6], [110, -50, 10], [95, -90, 12], [55, -110, 9], [15, -100, 6], [-10, -75, 8], [-40, -60, 12], [-80, -75, 10], [-110, -50, 6], [-105, -10, 3], [-70, 15, 1], [-35, 15, 0]],
    boosts: [0.07, 0.34, 0.6, 0.9], items: [0.16, 0.44, 0.74],
    sky: { top: 0x4a2a7a, bottom: 0xffa060, fog: 0xf0a878, fogNear: 80, fogFar: 290 },
    light: { hemiSky: 0xffe0c0, hemiGround: 0x7a3a3a, sun: 0xffc080 },
    water: { y: -26, color: 0xc0704a },
    reward: [90, 50, 28, 15],
    feat: { ramps: [0.27, 0.83], tunnels: [[0.5, 0.58]], bridges: [[0.62, 0.72]] },
    theme: { tunnel: 0x9a4a32, cable: 0x5a3020, road: 'sand', curb: ['#ffe2a8', '#d0603a'], side: 0x9a5a3a, rail: 0xc08a5a, post: 0x7a4a2a, pile: 0xa06a4a, banner: '◆  CAÑÓN DEL OCASO  ◆', decor: 'ruinas', palette: { top: 0xe0a060, side: 0xb0603a } },
  },
  cloaca: {
    name: 'Cloacas de Bruma', short: 'Cloacas de Bruma', icon: '🌀', lock: 'canon', tube: 6,
    desc: 'Dentro de un tubo cerrado: corre por el suelo, las paredes o el techo. Rampas, tubo de cristal bajo el mar y babosas que giran.',
    w: 2 * Math.PI * 6,
    p: [[0, 0, 0], [70, 0, 2], [130, -15, 6], [165, -65, 8], [150, -125, 4], [95, -150, 0], [35, -135, -4], [-10, -100, -2], [-60, -115, 2], [-120, -95, 6], [-140, -40, 4], [-100, 5, 1], [-50, 8, 0]],
    boosts: [0.06, 0.3, 0.52, 0.78, 0.92], items: [0.16, 0.42, 0.66, 0.86],
    sky: { top: 0x0a2a3a, bottom: 0x2a6a7a, fog: 0x1a3a3a, fogNear: 30, fogFar: 160 },
    light: { hemiSky: 0xd0fff0, hemiGround: 0x8ab0a0, sun: 0xc0ffe0 },
    water: { y: -22, color: 0x2a7a8a },
    reward: [110, 60, 34, 18],
    feat: { ramps: [0.22, 0.47, 0.71] },
    theme: { tube: true, sections: [[0, 'concreto'], [0.28, 'ladrillo'], [0.5, 'cristal'], [0.62, 'oxido'], [0.84, 'concreto']], road: 'planks', curb: ['#ffd24a', '#2a2a2a'], side: 0x5a6a60, rail: 0x7a8a80, post: 0x4a5a50, pile: 0x4a5a50, banner: '◎  CLOACAS DE BRUMA  ◎', decor: 'cloaca', palette: { top: 0x4a6a5a, side: 0x3a4a40 } },
  },
  forja: {
    name: 'Volcán de las Forjas', short: 'Volcán de Ignis', icon: '🌋', lock: 'cloaca',
    desc: 'Sobre un mar de lava entre volcanes humeantes: roca negra con grietas que brillan y chispas en el aire.',
    w: 13,
    p: [[0, 0, 0], [60, 0, 3], [110, -20, 8], [125, -70, 12], [95, -110, 10], [45, -100, 6], [20, -130, 4], [-30, -150, 2], [-80, -125, 5], [-95, -75, 9], [-92, -40, 6], [-78, -8, 3], [-45, 8, 0]],
    boosts: [0.08, 0.36, 0.62, 0.88], items: [0.17, 0.46, 0.74],
    sky: { top: 0x1a0606, bottom: 0xff6a2a, fog: 0x4a1c10, fogNear: 70, fogFar: 260 },
    light: { hemiSky: 0xffb48a, hemiGround: 0x3a1208, sun: 0xffb070 },
    water: { y: -14 }, lava: { y: -14 }, embers: { n: 260, area: 160, y0: -10, y1: 30, cx: 0, cz: -70 },
    reward: [120, 66, 36, 20],
    feat: { ramps: [0.3, 0.8], tunnels: [[0.52, 0.6]], bridges: [[0.68, 0.76]] },
    theme: { tunnel: 0x3a2a26, cable: 0x2a1a14, road: 'basalt', curb: ['#ffb030', '#2a1a14'], side: 0x3a2a26, rail: 0x5a4440, post: 0x2a1a18, pile: 0x3a2a26, banner: '◆  VOLCÁN DE LAS FORJAS  ◆', decor: 'volcan', palette: { top: 0x5a4440, side: 0x2a1a18 } },
  },
  vidrio: {
    name: 'Espejismo de Vidrio', short: 'Espejismo de Vidrio', icon: '💎', lock: 'forja',
    desc: 'Entre ruinas de cristal que reflejan el atardecer: agujas de colores, arcos rotos y suelo que brilla.',
    w: 13,
    p: [[0, 0, 0], [55, 5, 2], [100, -10, 0], [120, -55, -3], [100, -95, 0], [65, -108, 4], [30, -118, 8], [-15, -128, 6], [-60, -110, 3], [-100, -80, 0], [-110, -35, 2], [-75, -5, 1], [-35, 5, 0]],
    boosts: [0.07, 0.33, 0.58, 0.86], items: [0.15, 0.44, 0.72],
    sky: { top: 0x6a4aa8, bottom: 0xffc8a0, fog: 0xf0c8d8, fogNear: 90, fogFar: 300 },
    light: { hemiSky: 0xfff0ff, hemiGround: 0x8a6aa0, sun: 0xffe0c8 },
    water: { y: -18, color: 0xffe0f0 },
    reward: [130, 72, 40, 22],
    feat: { ramps: [0.24, 0.7], tunnels: [[0.4, 0.48]], bridges: [[0.8, 0.9]] },
    theme: { tunnel: 0xb08aff, tunnelGlass: true, cable: 0x8a6ac8, road: 'glass', curb: ['#ffffff', '#c06aff'], side: 0x8a7ab0, rail: 0xe0d0ff, post: 0x9a8ac8, pile: 0xc0b0e8, banner: '◆  ESPEJISMO DE VIDRIO  ◆', decor: 'cristales', palette: { top: 0xd8c8f0, side: 0x9a8ac8 } },
  },
  engranajes: {
    name: 'Ciudad de los Engranajes', short: 'Ciudad Engranajes', icon: '⚙', lock: 'vidrio',
    desc: 'Entre torres de latón y engranajes gigantes que giran sin parar, con vapor saliendo de las chimeneas.',
    w: 13,
    p: [[0, 0, 0], [70, 0, 0], [105, -15, 3], [112, -60, 6], [97, -90, 6], [88, -124, 3], [45, -145, 0], [-15, -140, 0], [-60, -118, 4], [-72, -82, 8], [-100, -55, 6], [-105, -15, 2], [-60, 5, 0]],
    boosts: [0.09, 0.35, 0.6, 0.87], items: [0.16, 0.45, 0.73],
    sky: { top: 0x3a4a5a, bottom: 0xd8b888, fog: 0xb8a888, fogNear: 80, fogFar: 280 },
    light: { hemiSky: 0xfff0d8, hemiGround: 0x5a4a3a, sun: 0xffe0b0 },
    water: { y: -20, color: 0x8a9aa0 },
    reward: [140, 78, 44, 24],
    feat: { ramps: [0.28, 0.76], tunnels: [[0.5, 0.57]], bridges: [[0.64, 0.72]] },
    theme: { tunnel: 0x6a5a4a, cable: 0x3a3a40, road: 'metal', curb: ['#ffd24a', '#3a3a40'], side: 0x6a5a4a, rail: 0xc8a050, post: 0x5a4a3a, pile: 0x6a6a70, banner: '◆  CIUDAD DE LOS ENGRANAJES  ◆', decor: 'engranajes', palette: { top: 0x8a7a60, side: 0x5a4a3a } },
  },
  faroles: {
    name: 'Noche de los Faroles', short: 'Noche de Faroles', icon: '🏮', lock: 'engranajes',
    desc: 'De noche, bajo las estrellas, entre cientos de faroles que flotan y se mecen sobre el mar oscuro.',
    w: 13,
    p: [[0, 0, 0], [50, -5, 2], [85, -35, 5], [95, -75, 7], [100, -112, 4], [68, -140, 1], [20, -125, -2], [-25, -140, 0], [-70, -120, 4], [-80, -80, 8], [-115, -50, 5], [-100, -10, 2], [-50, 5, 0]],
    boosts: [0.08, 0.34, 0.6, 0.86], items: [0.16, 0.45, 0.72],
    sky: { top: 0x05051a, bottom: 0x2a1a4a, fog: 0x1a1430, fogNear: 60, fogFar: 240 },
    light: { hemiSky: 0x8a8aff, hemiGround: 0x2a1a3a, sun: 0xffc88a },
    water: { y: -16, color: 0x1a2a5a },
    reward: [150, 84, 48, 26],
    feat: { ramps: [0.26, 0.78], tunnels: [[0.44, 0.52]], bridges: [[0.62, 0.7]] },
    theme: { tunnel: 0x3a2a4a, cable: 0x2a1a3a, road: 'planks', curb: ['#ffd27a', '#c0303a'], side: 0x4a3020, rail: 0x8a5a32, post: 0x4a3020, pile: 0x3a2418, banner: '◆  NOCHE DE LOS FAROLES  ◆', decor: 'faroles', palette: { top: 0x3a4a3a, side: 0x2a2018 } },
  },
  cumbre: {
    name: 'Cumbre de las Nubes', short: 'Cumbre de Nubes', icon: '☁', lock: 'faroles',
    desc: 'La pista más alta de Aethra: mármol blanco entre nubes gigantes, un arcoíris y subidas que tocan el cielo.',
    w: 13,
    p: [[0, 0, 0], [60, 0, 4], [115, -25, 10], [130, -80, 16], [90, -120, 20], [30, -105, 14], [0, -140, 10], [-50, -150, 6], [-100, -120, 3], [-120, -70, 6], [-108, -35, 10], [-90, -3, 6], [-45, 10, 2]],
    boosts: [0.07, 0.32, 0.57, 0.84], items: [0.15, 0.43, 0.7],
    sky: { top: 0x3a8aff, bottom: 0xe8f4ff, fog: 0xf0f6ff, fogNear: 100, fogFar: 340 },
    light: { hemiSky: 0xffffff, hemiGround: 0xa0b8d8, sun: 0xfff4e0 },
    water: { y: -30, color: 0xf8fbff },
    reward: [170, 96, 54, 30],
    feat: { ramps: [0.22, 0.6, 0.9], tunnels: [[0.4, 0.47]], bridges: [[0.7, 0.8]] },
    theme: { tunnel: 0xf0f4ff, tunnelGlass: true, cable: 0xc8a050, road: 'marble', curb: ['#ffffff', '#ffc83a'], side: 0xe8eef8, rail: 0xffffff, post: 0xd8e0f0, pile: 0xe8eef8, banner: '◆  CUMBRE DE LAS NUBES  ◆', decor: 'nubes', palette: { top: 0xffffff, side: 0xd8e0f0 } },
  },
  circo: {
    name: 'Gran Circo de Aethra', short: 'Gran Circo', icon: '🎪', lock: 'cumbre',
    desc: 'Entre carpas a rayas, una noria que gira y globos de colores: cuidado con las barras giratorias y las pelotas gigantes.',
    w: 13,
    p: [[0, 0, 0], [55, 0, 1], [100, -12, 3], [118, -55, 4], [95, -95, 2], [55, -110, 0], [20, -95, 2], [-15, -120, 4], [-60, -130, 2], [-100, -105, 0], [-112, -60, 2], [-90, -20, 1], [-45, 5, 0]],
    boosts: [0.08, 0.33, 0.58, 0.85], items: [0.16, 0.44, 0.72],
    sky: { top: 0x3a2a7a, bottom: 0xffa8c8, fog: 0xe8b0d0, fogNear: 90, fogFar: 300 },
    light: { hemiSky: 0xfff0f8, hemiGround: 0x8a5a7a, sun: 0xffe0d0 },
    water: { y: -18, color: 0xf0c8e8 },
    reward: [180, 100, 58, 32],
    feat: { ramps: [0.27, 0.74], tunnels: [[0.45, 0.52]], bridges: [[0.62, 0.7]] },
    theme: { tunnel: 0xe8303a, cable: 0xffd24a, road: 'circo', curb: ['#ffffff', '#e8303a'], side: 0x8a3a4a, rail: 0xffd24a, post: 0xe8303a, pile: 0x6a3a4a, banner: '★  GRAN CIRCO DE AETHRA  ★', decor: 'circo', palette: { top: 0xe8a0c0, side: 0x8a3a4a } },
  },
  sombras: {
    name: 'Reino de las Sombras', short: 'Reino de Sombras', icon: '👻', lock: 'circo',
    desc: 'Un mundo oscuro de agujas negras y cristales violetas, con ojos gigantes en el cielo, espectros y manos que salen del suelo.',
    w: 13,
    p: [[0, 0, 0], [50, -4, 3], [92, -25, 7], [110, -68, 9], [82, -105, 5], [40, -95, 2], [5, -125, 0], [-40, -140, 3], [-85, -120, 7], [-108, -78, 4], [-112, -38, 1], [-95, 2, 3], [-50, 8, 0]],
    boosts: [0.07, 0.32, 0.58, 0.84], items: [0.15, 0.43, 0.71],
    sky: { top: 0x05000c, bottom: 0x3a1a5a, fog: 0x1a0a2a, fogNear: 50, fogFar: 220 },
    light: { hemiSky: 0xb08aff, hemiGround: 0x1a0a24, sun: 0xd0a0ff },
    water: { y: -20, color: 0x1a0a2a },
    reward: [190, 106, 62, 34],
    feat: { ramps: [0.25, 0.79], tunnels: [[0.4, 0.48]], bridges: [[0.6, 0.68]] },
    theme: { tunnel: 0x2a1a3a, cable: 0x5a2a8a, road: 'sombra', curb: ['#b06aff', '#140a1e'], side: 0x1a1024, rail: 0x5a3a7a, post: 0x140a1e, pile: 0x1a1024, banner: '◆  REINO DE LAS SOMBRAS  ◆', decor: 'sombras', palette: { top: 0x2a1a3a, side: 0x140a1e } },
  },
  ovni: {
    name: 'Base de los Ovnis', short: 'Base Ovni', icon: '🛸', lock: 'sombras',
    desc: 'De noche, bajo un planeta con anillos: platillos volantes con rayos tractores que te abducen y meteoritos que caen.',
    w: 13,
    p: [[0, 0, 0], [60, 0, 2], [112, -18, 6], [128, -65, 8], [100, -102, 5], [60, -92, 9], [30, -125, 6], [-20, -142, 2], [-70, -128, 0], [-108, -95, 3], [-118, -50, 6], [-90, -12, 3], [-45, 6, 0]],
    boosts: [0.08, 0.34, 0.6, 0.86], items: [0.16, 0.45, 0.73],
    sky: { top: 0x020a14, bottom: 0x0a3a3a, fog: 0x0a2a2a, fogNear: 70, fogFar: 260 },
    light: { hemiSky: 0x8affd8, hemiGround: 0x0a2a2a, sun: 0xc8fff0 },
    water: { y: -18, color: 0x0a3a3a },
    reward: [200, 112, 66, 36],
    feat: { ramps: [0.22, 0.56, 0.88], tunnels: [[0.42, 0.49]], bridges: [[0.66, 0.74]] },
    theme: { tunnel: 0x3a4a5a, tunnelGlass: true, cable: 0x6affc8, road: 'neon', curb: ['#6affc8', '#0a1a24'], side: 0x1a2a34, rail: 0x6affc8, post: 0x2a3a44, pile: 0x1a2a34, banner: '◆  BASE DE LOS OVNIS  ◆', decor: 'ovni', palette: { top: 0x2a4a4a, side: 0x1a2a34 } },
  },
};
export const RACE_LAPS = [3, 5];
const LEVEL = { facil: 0.83, normal: 0.92, dificil: 0.99, auto: 0.9 };
const COLORS = [0x3aa0ff, 0xff6a4a, 0x6ad04a, 0xffc83a, 0xb070ff, 0xff7ab8, 0x3ad6c6, 0xf0f0f0];
const ICO = {
  rep: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/></svg>',
  map: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V4"/><path d="M4 4h13l-2 4 2 4H4"/></svg>',
  home: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>',
  exit: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4h4v16h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></svg>',
  play: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v16l13-8z" fill="currentColor"/></svg>',
  globe: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18"/></svg>',
  cup: '<svg class="rankIco" viewBox="0 0 24 24" fill="#ffd27a" stroke="#c8862a" stroke-width="1.4" stroke-linejoin="round"><path d="M7 3h10v5a5 5 0 0 1-10 0z"/><path d="M7 5H4a3 3 0 0 0 3 4M17 5h3a3 3 0 0 1-3 4" fill="none"/><path d="M12 13v4M8 21h8l-1-4H9z"/></svg>',
  medal: '<svg class="rankIco" viewBox="0 0 24 24" stroke-width="1.4" stroke-linejoin="round"><path d="M8 2h3l2 6H10zM16 2h-3l-2 6h3z" fill="#7ad7ff" stroke="#3a8ac0"/><circle cx="12" cy="15" r="6" fill="#ffd27a" stroke="#c8862a"/></svg>',
  unlock: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/></svg>',
};
const INTRO = 4.2; // segundos de presentación de la parrilla
const BADW = /\b(put[ao]s?|mierda|pendej[oa]s?|idiota|est[uú]pid[oa]|imb[eé]cil|boludo|pelotudo|cabr[oó]n|co[nñ]o|joder|verga|culiao|maric[oó]n|forro|hdp|fuck|shit|bitch)\b/gi;
const MAXV = 27, ACC = 17, BRAKE = 34, TURN = 2.05;

// ---------- texturas hechas a mano (canvas) ----------
function tex(w, h, draw, rep = true) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
const planks = () => tex(256, 256, (c, w, h) => {
  const cols = ['#b77a48', '#a86c3e', '#c08654', '#9e6238', '#b47444'];
  for (let i = 0; i < 8; i++) {
    c.fillStyle = cols[(i * 3) % cols.length]; c.fillRect(0, i * 32, w, 32);
    for (let k = 0; k < 18; k++) { c.fillStyle = `rgba(80,40,20,${0.06 + Math.random() * 0.08})`; c.fillRect(Math.random() * w, i * 32 + 4 + Math.random() * 24, 30 + Math.random() * 80, 1.5); }
    c.fillStyle = 'rgba(50,25,10,.75)'; c.fillRect(0, i * 32, w, 3);
    c.fillStyle = 'rgba(255,230,190,.18)'; c.fillRect(0, i * 32 + 3, w, 2);
    for (const x of [18, w - 22]) { c.fillStyle = '#5a3a24'; c.beginPath(); c.arc(x, i * 32 + 16, 2.6, 0, 7); c.fill(); }
  }
});
const forestRoad = () => tex(256, 256, (c, w, h) => {
  c.fillStyle = '#8a6440'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(${60 + Math.random() * 60},${40 + Math.random() * 40},${20},${0.25})`; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 8, 0, 7); c.fill(); }
  for (let i = 0; i < 6; i++) { c.strokeStyle = 'rgba(70,45,25,.6)'; c.lineWidth = 6 + Math.random() * 5; c.beginPath(); const y = Math.random() * h; c.moveTo(0, y); c.bezierCurveTo(w * 0.3, y + 20, w * 0.7, y - 20, w, y + 5); c.stroke(); }
  for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(${80 + Math.random() * 60},${150 + Math.random() * 60},60,.55)`; c.beginPath(); c.ellipse(Math.random() * w, Math.random() * h, 6, 3, Math.random() * 3, 0, 7); c.fill(); }
  c.fillStyle = 'rgba(90,170,70,.35)'; c.fillRect(0, 0, 22, h); c.fillRect(w - 22, 0, 22, h);
});
const iceRoad = () => tex(256, 256, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#cfe8ff'); g.addColorStop(1, '#a8d0f4'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 18; i++) { c.strokeStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.4})`; c.lineWidth = 1 + Math.random() * 2; c.beginPath(); let x = Math.random() * w, y = Math.random() * h; c.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60; c.lineTo(x, y); } c.stroke(); }
  for (let i = 0; i < 30; i++) { c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.ellipse(Math.random() * w, Math.random() * h, 10 + Math.random() * 16, 4 + Math.random() * 6, Math.random() * 3, 0, 7); c.fill(); }
});
const gridTex = n => tex(128, 184, (c, w, h) => {
  c.clearRect(0, 0, w, h); c.strokeStyle = '#ffffff'; c.lineWidth = 9; c.lineCap = 'square';
  c.beginPath(); c.moveTo(8, 60); c.lineTo(8, 10); c.lineTo(w - 8, 10); c.lineTo(w - 8, 60); c.stroke(); // la «caja» abierta hacia atrás
  c.fillStyle = 'rgba(255,255,255,.9)'; c.font = 'bold 56px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(n), w / 2, 120);
}, false);
const sandRoad = () => tex(256, 256, (c, w, h) => {
  c.fillStyle = '#d9a46a'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 300; i++) { c.fillStyle = `rgba(${150 + Math.random() * 80},${90 + Math.random() * 50},${50},.25)`; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 5, 0, 7); c.fill(); }
  for (let i = 0; i < 8; i++) { c.strokeStyle = 'rgba(140,80,40,.35)'; c.lineWidth = 2; c.beginPath(); const y = Math.random() * h; c.moveTo(0, y); c.bezierCurveTo(w * 0.3, y + 12, w * 0.7, y - 12, w, y); c.stroke(); }
});
// interior del tubo: u da la vuelta al tubo (0 = suelo), v avanza por la pista
const TUBE_LOOK = {
  concreto: { base: '#7a8078', joint: 'rgba(40,50,45,.6)', lamp: '#bff8ff', tint: 0xffffff },
  ladrillo: { base: '#8a4a32', joint: 'rgba(230,200,170,.45)', lamp: '#ffd27a', tint: 0xffffff, bricks: true },
  cristal: { base: '#6ad0e0', joint: 'rgba(255,255,255,.5)', lamp: '#bff8ff', tint: 0xffffff },
  oxido: { base: '#5a6a3a', joint: 'rgba(30,20,10,.6)', lamp: '#9aff6a', tint: 0xffffff, rust: true },
};
const tubeTex = (kind) => { const L = TUBE_LOOK[kind]; return [tex(256, 256, (c, w, h) => {
  c.fillStyle = L.base; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.07})`; c.fillRect(Math.random() * w, Math.random() * h, 3 + Math.random() * 10, 3 + Math.random() * 10); }
  c.strokeStyle = L.joint; c.lineWidth = 2;
  if (L.bricks) for (let y = 0; y < h; y += 16) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); for (let x = (y / 16) % 2 ? 0 : 16; x < w; x += 32) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 16); c.stroke(); } }
  else for (let y = 0; y < h; y += 64) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  if (L.rust) for (let i = 0; i < 30; i++) { c.fillStyle = 'rgba(160,80,30,.35)'; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 4 + Math.random() * 14, 0, 7); c.fill(); }
  // línea central del suelo (u = 0) y franjas de luz en paredes y techo
  c.fillStyle = '#ffd24a'; for (let y = 0; y < h; y += 64) { c.fillRect(0, y, 3, 36); c.fillRect(w - 3, y, 3, 36); }
  c.fillStyle = 'rgba(80,255,150,.25)'; c.fillRect(0, 0, 14, h); c.fillRect(w - 14, 0, 14, h);
  c.fillStyle = L.lamp; for (const u of [0.25, 0.5, 0.75]) c.fillRect(u * w - 3, 0, 6, h);
}), tex(256, 256, (c, w, h) => { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); c.fillStyle = L.lamp; for (const u of [0.25, 0.5, 0.75]) c.fillRect(u * w - 3, 0, 6, h); c.fillStyle = 'rgba(255,210,74,.6)'; for (let y = 0; y < h; y += 64) { c.fillRect(0, y, 3, 36); c.fillRect(w - 3, y, 3, 36); } })]; };
const basaltRoad = () => tex(256, 256, (c, w, h) => {
  c.fillStyle = '#2a2224'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 200; i++) { c.fillStyle = `rgba(${60 + Math.random() * 40},${50 + Math.random() * 30},${50},.4)`; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 8, 0, 7); c.fill(); }
  c.lineCap = 'round'; for (let i = 0; i < 10; i++) { c.strokeStyle = 'rgba(255,120,30,.85)'; c.lineWidth = 1.5 + Math.random() * 2; c.beginPath(); let x = Math.random() * w, y = Math.random() * h; c.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60; c.lineTo(x, y); } c.stroke(); }
});
const glassRoad = () => tex(256, 256, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#e8d8ff'); g.addColorStop(0.5, '#ffd8ec'); g.addColorStop(1, '#d0e8ff'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 2; for (let i = 0; i < 14; i++) { c.beginPath(); const x = Math.random() * w, y = Math.random() * h; c.moveTo(x, y); c.lineTo(x + (Math.random() - 0.5) * 120, y + (Math.random() - 0.5) * 120); c.stroke(); }
  for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
});
const metalRoad = () => tex(256, 256, (c, w, h) => {
  c.fillStyle = '#6a6a70'; c.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 64) { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, y, w, 3); for (let x = 12; x < w; x += 40) { c.fillStyle = '#9a9aa0'; c.beginPath(); c.arc(x, y + 10, 3, 0, 7); c.fill(); c.beginPath(); c.arc(x, y + 54, 3, 0, 7); c.fill(); } }
  for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},.06)`; c.fillRect(Math.random() * w, Math.random() * h, 10, 2); }
  c.strokeStyle = 'rgba(200,160,80,.5)'; c.lineWidth = 3; c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.stroke();
});
const marbleRoad = () => tex(256, 256, (c, w, h) => {
  c.fillStyle = '#f4f6fa'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 12; i++) { c.strokeStyle = `rgba(150,160,190,${0.2 + Math.random() * 0.3})`; c.lineWidth = 1 + Math.random() * 2; c.beginPath(); let x = Math.random() * w, y = 0; c.moveTo(x, y); while (y < h) { x += (Math.random() - 0.5) * 30; y += 20; c.lineTo(x, y); } c.stroke(); }
  c.strokeStyle = 'rgba(200,170,90,.5)'; c.lineWidth = 2; for (let y = 0; y < h; y += 128) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
});
const circoRoad = () => tex(256, 256, (c, w, h) => {
  for (let y = 0; y < h; y += 32) { c.fillStyle = (y / 32) % 2 ? '#c8803a' : '#b8702e'; c.fillRect(0, y, w, 32); c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(0, y, w, 2); }
  c.fillStyle = 'rgba(255,210,74,.85)'; const star = (x, y, r) => { c.beginPath(); for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5 - Math.PI / 2, rr = k % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.fill(); };
  star(w * 0.5, h * 0.25, 18); star(w * 0.5, h * 0.75, 18); c.fillStyle = 'rgba(232,48,58,.7)'; star(w * 0.2, h * 0.5, 10); star(w * 0.8, h * 0.5, 10);
});
const sombraRoad = () => tex(256, 256, (c, w, h) => {
  c.fillStyle = '#1a1420'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(${40 + Math.random() * 30},${30},${50 + Math.random() * 30},.5)`; c.fillRect(Math.random() * w, Math.random() * h, 6 + Math.random() * 20, 4 + Math.random() * 10); }
  c.strokeStyle = 'rgba(176,106,255,.85)'; c.lineWidth = 2.5; c.lineCap = 'round';
  for (let k = 0; k < 6; k++) { const x = 30 + Math.random() * (w - 60), y = 30 + Math.random() * (h - 60), r = 10 + Math.random() * 8; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 1.6); c.moveTo(x - r, y); c.lineTo(x + r, y); c.moveTo(x, y - r); c.lineTo(x, y + r * 0.5); c.stroke(); }
});
const neonRoad = () => tex(256, 256, (c, w, h) => {
  c.fillStyle = '#0c1a22'; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(106,255,200,.55)'; c.lineWidth = 2; for (let k = 0; k <= 4; k++) { c.beginPath(); c.moveTo(k * w / 4, 0); c.lineTo(k * w / 4, h); c.stroke(); c.beginPath(); c.moveTo(0, k * h / 4); c.lineTo(w, k * h / 4); c.stroke(); }
  c.fillStyle = 'rgba(106,255,200,.9)'; for (let k = 0; k < 4; k++) c.fillRect(w / 2 - 3, k * h / 4 + 14, 6, 34);
});
const ROADS = { circo: circoRoad, sombra: sombraRoad, neon: neonRoad, forest: () => forestRoad(), ice: () => iceRoad(), sand: () => sandRoad(), basalt: basaltRoad, glass: glassRoad, metal: metalRoad, marble: marbleRoad };
const roadOf = k => (ROADS[k] || planks)();
const curbTex = (a = '#f4f2ee', b = '#e8483c') => tex(32, 64, (c, w, h) => { c.fillStyle = a; c.fillRect(0, 0, w, h); c.fillStyle = b; c.fillRect(0, 0, w, h / 2); });
const checker = () => tex(128, 32, (c, w, h) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { c.fillStyle = (x + y) % 2 ? '#111' : '#fafafa'; c.fillRect(x * 8, y * 8, 8, 8); } });
const chevron = () => tex(128, 128, (c, w, h) => {
  c.clearRect(0, 0, w, h);
  for (let k = 0; k < 2; k++) { const y = k * 64; c.strokeStyle = '#fff6a0'; c.lineWidth = 16; c.lineCap = 'round'; c.beginPath(); c.moveTo(18, y + 52); c.lineTo(64, y + 14); c.lineTo(110, y + 52); c.stroke(); }
});
function banner(text) {
  return tex(1024, 128, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2a4fa8'); g.addColorStop(1, '#1a2f70'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffc83a'; c.fillRect(0, 0, w, 8); c.fillRect(0, h - 8, w, 8);
    c.font = 'bold 64px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText(text, w / 2, h / 2 + 4);
  }, false);
}

// textura del kart de Artlist recoloreada (una por color, se reutiliza)
const _kartTex = new Map();
function kartTex(map, color, hsl, ranges) {
  const key = map.uuid + color; if (_kartTex.has(key)) return _kartTex.get(key);
  let t = map;
  const grey = hsl.s < 0.15, light = hsl.l > 0.8 ? 1.9 : hsl.l < 0.25 ? 0.45 : hsl.l > 0.6 ? 1.35 : 1.1;
  try { t = recolor(map, ranges.map(r => ({ from: r, minSat: 0.2, to: hsl.h * 360, ...(grey ? { setSat: 0.08 } : { sat: 1.15 }), light }))); } catch (e) {}
  _kartTex.set(key, t); return t;
}
// piloto sentado en el kart (pose de sentado, mirando al frente)
export function seatDriver(parent, lib, look, art = true) {
  try {
    const ch = createCharacter(lib, look);
    for (const a of Object.values(ch.actions)) { a.play(); a.timeScale = 0; a.setEffectiveWeight(0); }
    const sit = ch.actions.Sit_Floor_Idle || ch.actions.Idle; sit.setEffectiveWeight(1); sit.time = ch.actions.Sit_Floor_Idle ? 0.35 : 0;
    ch.mixer.update(0);
    ch.root.position.set(0, art ? 0.2 : 0.36, art ? -0.32 : -0.42); ch.root.rotation.y = Math.PI; ch.root.scale.multiplyScalar(0.9); parent.add(ch.root);
    ch.root.traverse(m => { if (m.isMesh) m.castShadow = true; });
    return ch;
  } catch (e) { console.warn('piloto', e); return null; }
}
// ---------- manos al volante ----------
// pone un volante delante del piloto y lleva sus brazos hasta él (cinemática inversa de dos huesos); al girar,
// el volante rota y las manos lo siguen
const _v = [0, 1, 2, 3, 4, 5, 6, 7].map(() => new THREE.Vector3()), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const fb = (m, n) => { let b = null; m.traverse(o => { if (!b && o.isBone && o.name === n) b = o; }); return b; };
function aimBone(bone, childPos, want) {
  const p = bone.getWorldPosition(_v[6]), cur = _v[7].copy(childPos).sub(p).normalize(), dir = want.clone().sub(p).normalize();
  _q1.setFromUnitVectors(cur, dir); bone.getWorldQuaternion(_q2); _q2.premultiply(_q1);
  bone.parent.getWorldQuaternion(_q3).invert(); bone.quaternion.copy(_q3.multiply(_q2)); bone.updateMatrixWorld(true);
}
export function rigWheel(ch, parent, oldWheel) {
  if (!ch) return null;
  const m = ch.model, arms = ['l', 'r'].map(s => ({ up: fb(m, 'upperarm' + s), lo: fb(m, 'lowerarm' + s), ha: fb(m, 'hand' + s) || fb(m, 'wrist' + s) }));
  const hips = fb(m, 'hips'), foot = fb(m, 'footl') || fb(m, 'lowerlegl');
  if (arms.some(a => !a.up || !a.lo || !a.ha) || !hips || !foot) return null;
  parent.updateMatrixWorld(true);
  for (const a of arms) { a.q0 = a.up.quaternion.clone(); a.q1 = a.lo.quaternion.clone(); const S = a.up.getWorldPosition(new THREE.Vector3()), E = a.lo.getWorldPosition(new THREE.Vector3()), H = a.ha.getWorldPosition(new THREE.Vector3()); a.L1 = S.distanceTo(E); a.L2 = E.distanceTo(H); }
  const toL = w => parent.worldToLocal(w.clone());
  const sL = toL(arms[0].up.getWorldPosition(new THREE.Vector3())), sR = toL(arms[1].up.getWorldPosition(new THREE.Vector3()));
  const hp = toL(hips.getWorldPosition(new THREE.Vector3())), fp = toL(foot.getWorldPosition(new THREE.Vector3()));
  // hacia delante: perpendicular a la línea de los hombros, del lado de los pies
  const fwd = new THREE.Vector3(sR.z - sL.z, 0, sL.x - sR.x).normalize(), up = new THREE.Vector3(0, 1, 0);
  if (fwd.x * (fp.x - hp.x) + fwd.z * (fp.z - hp.z) < 0) fwd.negate();
  const mid = sL.clone().add(sR).multiplyScalar(0.5), reach = (arms[0].L1 + arms[0].L2), span = sL.distanceTo(sR);
  const center = mid.clone().addScaledVector(fwd, reach * 0.66).addScaledVector(up, -reach * 0.42);
  const rad = Math.max(Math.min(span * 0.5, reach * 0.42), 0.1), normal = fwd.clone().multiplyScalar(-1).addScaledVector(up, 0.5).normalize();
  const lr = sR.clone().sub(sL), right = lr.sub(normal.clone().multiplyScalar(normal.dot(lr))).normalize(); // hacia el hombro derecho
  let vUp = new THREE.Vector3().crossVectors(normal, right).normalize(); const flip = vUp.y < 0; if (flip) vUp.negate();
  // el volante
  const g = new THREE.Group(), dark = new THREE.MeshStandardMaterial({ color: 0x24242c, roughness: 0.5 }), gold = new THREE.MeshStandardMaterial({ color: 0xffc83a, metalness: 0.6, roughness: 0.3 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(rad, rad * 0.13, 8, 26), dark); g.add(rim);
  for (const a of [0, 2.09, 4.19]) { const sp = new THREE.Mesh(new THREE.BoxGeometry(rad * 0.95, rad * 0.12, rad * 0.08), dark); sp.position.set(Math.cos(a) * rad * 0.47, Math.sin(a) * rad * 0.47, 0); sp.rotation.z = a; g.add(sp); }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.24, rad * 0.24, rad * 0.16, 14), gold); hub.rotation.x = Math.PI / 2; g.add(hub);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.09, rad * 0.11, reach * 0.55, 8), dark); col.position.z = -reach * 0.28; col.rotation.x = Math.PI / 2; g.add(col);
  const holder = new THREE.Group(); holder.position.copy(center); holder.quaternion.setFromRotationMatrix(flip ? new THREE.Matrix4().makeBasis(right.clone().negate(), vUp, normal) : new THREE.Matrix4().makeBasis(right, vUp, normal)); holder.add(g); parent.add(holder);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  if (oldWheel) oldWheel.visible = false;
  const W = { arms, holder, wheel: g, rad, right, vUp, normal, center, parent, fwd, up, steer: 0 };
  W.update = (steer) => {
    const ang = -steer * 1.25; g.rotation.z = ang;
    for (let k = 0; k < 2; k++) {
      const a = arms[k], sg = k ? 1 : -1, ca = Math.cos(ang), sa = Math.sin(ang);
      // la mano a las «9 y cuarto»: a los lados del aro, un poco arriba, girando con el volante
      const lx = sg * rad * 0.94, ly = rad * 0.28, rx = lx * ca - ly * sa, ry = lx * sa + ly * ca;
      const tgtL = center.clone().addScaledVector(right, rx).addScaledVector(vUp, ry).addScaledVector(normal, rad * 0.1);
      a.up.quaternion.copy(a.q0); a.lo.quaternion.copy(a.q1); a.up.updateMatrixWorld(true);
      const T = parent.localToWorld(tgtL), S = a.up.getWorldPosition(_v[0]).clone();
      const d = T.clone().sub(S), dist = clamp(d.length(), 0.01, (a.L1 + a.L2) * 0.999); d.normalize();
      const cosA = clamp((a.L1 * a.L1 + dist * dist - a.L2 * a.L2) / (2 * a.L1 * dist), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
      // los codos hacia fuera y hacia abajo
      const pole = parent.localToWorld(center.clone().addScaledVector(right, sg * rad * 3).addScaledVector(up, -reach * 0.6).addScaledVector(fwd, -reach * 0.3)).sub(S);
      const perp = pole.sub(d.clone().multiplyScalar(pole.dot(d))).normalize();
      const elbow = S.clone().addScaledVector(d, a.L1 * cosA).addScaledVector(perp, a.L1 * sinA);
      aimBone(a.up, a.lo.getWorldPosition(_v[1]), elbow);
      aimBone(a.lo, a.ha.getWorldPosition(_v[2]), S.clone().addScaledVector(d, dist));
    }
  };
  W.update(0);
  return W;
}
export const driverLook = (sv, id) => { const D = DRIVERS.find(d => d.id === id) || DRIVERS[0]; return D.look === 'mine' ? heroLook((sv && sv.hero) || 'lia', (sv && sv.custom) || {}) : heroLook(D.look, {}); };
// kart listo para mostrar: el modelo de Artlist (con la carrocería repintada si paint no es null) o el hecho con formas
export function makeKart(kartId, paint = null, fallback = 0x3aa0ff) {
  const K = kartById(kartId), id = hasProp(K.model) ? K.model : hasProp('kart') ? 'kart' : null;
  if (!id) return { kart: buildKart(paint ?? fallback), art: false };
  const kart = prop(id, { w: 2.25 }, { rotY: 0 });
  const hsl = {}; if (paint != null) new THREE.Color(paint).getHSL(hsl);
  kart.traverse(m => {
    if (!m.isMesh) return; m.castShadow = true;
    m.material = m.material.clone(); m.material.roughness = 0.55; m.material.metalness = 0.15;
    if (m.material.map && paint != null) m.material.map = kartTex(m.material.map, paint, hsl, id === K.model ? K.hue : KARTS[0].hue);
  });
  kart.userData.wheels = [];
  return { kart, art: true };
}
// ---------- kart hecho con formas (si no hay modelo de Artlist) ----------
function buildKart(color) {
  const g = new THREE.Group();
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.05, ...o });
  const body = M(color), trim = M(0xffc83a, { metalness: 0.5, roughness: 0.35 }), dark = M(0x2a2a34), wood = M(0x8a5a34);
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; g.add(m); return m; };
  // chasis redondeado
  const shape = new THREE.Shape(); const L = 1.35, W = 0.72;
  shape.moveTo(-W, -L); shape.lineTo(W, -L); shape.quadraticCurveTo(W + 0.12, 0, W * 0.78, L * 0.95); shape.quadraticCurveTo(0, L * 1.18, -W * 0.78, L * 0.95); shape.quadraticCurveTo(-W - 0.12, 0, -W, -L);
  const ch = add(new THREE.ExtrudeGeometry(shape, { depth: 0.32, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.1, bevelSegments: 3 }), body, 0, 0.42, 0, Math.PI / 2, 0, 0);
  ch.position.y = 0.6; // la forma se extruye hacia abajo
  add(new THREE.BoxGeometry(1.55, 0.08, 2.3), dark, 0, 0.26, -0.05); // piso
  add(new THREE.CylinderGeometry(0.62, 0.7, 0.42, 20, 1, false, Math.PI * 0.15, Math.PI * 1.7), body, 0, 0.62, 0.95, 0, Math.PI, 0); // morro
  add(new THREE.TorusGeometry(0.45, 0.05, 8, 20, Math.PI), trim, 0, 0.62, -0.25, 0, 0, 0); // arco del asiento
  add(new THREE.BoxGeometry(0.78, 0.5, 0.16), wood, 0, 0.66, -0.55, -0.25); // respaldo
  add(new THREE.BoxGeometry(0.78, 0.12, 0.6), wood, 0, 0.44, -0.3); // asiento
  // volante
  add(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 6), dark, 0, 0.7, 0.42, -0.9);
  g.userData.wheel = add(new THREE.TorusGeometry(0.17, 0.035, 8, 16), dark, 0, 0.86, 0.32, -0.6);
  // alerón con forma de vela
  const sail = new THREE.Shape(); sail.moveTo(-0.7, 0); sail.lineTo(0.7, 0); sail.quadraticCurveTo(0.2, 0.25, 0, 0.62); sail.quadraticCurveTo(-0.2, 0.25, -0.7, 0);
  add(new THREE.ShapeGeometry(sail), M(0xf4ecd8, { side: THREE.DoubleSide }), 0, 1.02, -1.28, 0.2);
  add(new THREE.BoxGeometry(1.5, 0.06, 0.32), trim, 0, 1.0, -1.28);
  for (const x of [-0.55, 0.55]) add(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), dark, x, 0.75, -1.25);
  // tubo de escape (de aquí sale el fuego del turbo)
  for (const x of [-0.3, 0.3]) add(new THREE.CylinderGeometry(0.08, 0.1, 0.4, 10), trim, x, 0.42, -1.42, Math.PI / 2);
  // farolillo delantero
  add(new THREE.SphereGeometry(0.12, 12, 8), M(0xfff2b0, { emissive: 0xffc860, emissiveIntensity: 1.3 }), 0, 0.72, 1.42);
  // ruedas
  const tire = new THREE.CylinderGeometry(0.34, 0.34, 0.3, 18), rim = new THREE.CylinderGeometry(0.2, 0.2, 0.32, 12);
  g.userData.wheels = [];
  for (const [x, z, s] of [[-0.82, 0.85, 1], [0.82, 0.85, 1], [-0.86, -0.85, 1.15], [0.86, -0.85, 1.15]]) {
    const w = new THREE.Group(); w.position.set(x, 0.34 * s, z); g.add(w);
    const t = new THREE.Mesh(tire, dark); t.rotation.z = Math.PI / 2; t.scale.setScalar(s); t.castShadow = true; w.add(t);
    const r = new THREE.Mesh(rim, trim); r.rotation.z = Math.PI / 2; r.scale.setScalar(s); w.add(r);
    w.userData.front = z > 0; g.userData.wheels.push(w);
  }
  return g;
}

// ---------- la pista ----------
class Track {
  constructor(def, root) {
    this.def = def; this.root = root;
    const pts = def.p.map(([x, z, y]) => new THREE.Vector3(x, y, z));
    const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    const N = this.N = 720;
    this.c = []; this.t = []; this.r = []; this.d = [0];
    for (let i = 0; i < N; i++) this.c.push(curve.getPointAt(i / N));
    for (let i = 0; i < N; i++) {
      const a = this.c[(i - 1 + N) % N], b = this.c[(i + 1) % N];
      const t = b.clone().sub(a).normalize(); this.t.push(t);
      this.r.push(new THREE.Vector3(-t.z, 0, t.x).normalize()); // derecha (en planta)
      if (i) this.d.push(this.d[i - 1] + this.c[i].distanceTo(this.c[i - 1]));
    }
    this.L = this.d[N - 1] + this.c[0].distanceTo(this.c[N - 1]);
    this.hw = def.w / 2;
    const F = def.feat || {}, idx = f => Math.floor(f * N) % N;
    this.ramps = (F.ramps || []).map(idx);
    this.tunnels = (F.tunnels || []).map(([a, b]) => [idx(a), idx(b)]);
    this.bridges = (F.bridges || []).map(([a, b]) => [idx(a), idx(b)]);
    this.inRange = (i, list) => list.some(([a, b]) => i >= a && i <= b);
    this.sky = null; this.alt = null; this.tube = def.tube || 0;
    if (this.tube) { // marco del tubo: «arriba» perpendicular a la pista en cada muestra
      this.U = this.t.map((t, i) => new THREE.Vector3().crossVectors(this.r[i], t).normalize());
      this._q = new THREE.Quaternion(); this._v = new THREE.Vector3();
    } else { this._findShortcut(); this._findSky(); }
    this._build();
  }
  // ---- tubo: la carrera se calcula en una pista plana «desenrollada» y se dibuja enrollada en el cilindro
  // p plano → posición en el tubo (out); devuelve la muestra y el ángulo alrededor del tubo
  tmap(p, hint, out) {
    const i = this.near(p, hint), F = this.frame(p, i), R = this.tube, th = F.lat / R, h = p.y - F.y;
    const c = this.c[i], t = this.t[i], r = this.r[i], U = this.U[i], sn = Math.sin(th), co = Math.cos(th), rad = R - h;
    out.set(c.x + t.x * F.along + U.x * R + (r.x * sn - U.x * co) * rad, c.y + t.y * F.along + U.y * R + (r.y * sn - U.y * co) * rad, c.z + t.z * F.along + U.z * R + (r.z * sn - U.z * co) * rad);
    return { i, th };
  }
  tquat(i, th, q) { return q.setFromAxisAngle(this.t[i], -th); }
  // normal del suelo del tubo (hacia el centro)
  tnorm(i, th, out) { const r = this.r[i], U = this.U[i], sn = Math.sin(th), co = Math.cos(th); return out.set(U.x * co - r.x * sn, U.y * co - r.y * sn, U.z * co - r.z * sn); }
  // dobla una malla construida en plano para que se pegue a la pared del tubo
  bend(mesh) {
    mesh.updateMatrixWorld(true); const g = mesh.geometry.clone(), P = g.attributes.position, v = new THREE.Vector3(), o = new THREE.Vector3();
    let hint = this.near(new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld));
    for (let k = 0; k < P.count; k++) { v.fromBufferAttribute(P, k).applyMatrix4(mesh.matrixWorld); hint = this.tmap(v, hint, o).i; P.setXYZ(k, o.x, o.y, o.z); }
    g.computeVertexNormals(); mesh.geometry = g; mesh.position.set(0, 0, 0); mesh.rotation.set(0, 0, 0); mesh.scale.set(1, 1, 1); mesh.updateMatrix();
    return mesh;
  }
  // objeto rígido: se coloca en su sitio del tubo y se gira con la pared
  place(obj, hint = -1) {
    const lp = obj.position.clone(), { i, th } = this.tmap(lp, hint, obj.position);
    obj.quaternion.premultiply(this.tquat(i, th, this._q)); return i;
  }
  _buildTube() {
    const N = this.N, R = this.tube, root = this.root, TH = this.def.theme, S = 40;
    const secs = TH.sections.map(([f, k]) => [Math.floor(f * N), k]);
    const kindAt = i => { let k = secs[0][1]; for (const [a, kk] of secs) if (i >= a) k = kk; return k; };
    // un tramo de tubo por sección (cada una con su material)
    for (let si = 0; si < secs.length; si++) {
      const a = secs[si][0], b = si + 1 < secs.length ? secs[si + 1][0] : N, kind = secs[si][1];
      const pos = [], uv = [], idx = [];
      for (let i = a; i <= b; i++) { const k = i % N, c = this.c[k], r = this.r[k], U = this.U[k], v = (i === N ? this.L : this.d[k]) / 8;
        for (let j = 0; j <= S; j++) { const th = (j / S) * Math.PI * 2, sn = Math.sin(th), co = Math.cos(th), rr = R + 0.02;
          pos.push(c.x + U.x * R + (r.x * sn - U.x * co) * rr, c.y + U.y * R + (r.y * sn - U.y * co) * rr, c.z + U.z * R + (r.z * sn - U.z * co) * rr); uv.push(j / S, v); }
        if (i < b) { const q = (i - a) * (S + 1); for (let j = 0; j < S; j++) idx.push(q + j, q + j + S + 1, q + j + 1, q + j + 1, q + j + S + 1, q + j + S + 2); } }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      const [map, em] = tubeTex(kind), glass = kind === 'cristal';
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map, emissiveMap: em, emissive: 0xffffff, emissiveIntensity: glass ? 0.5 : 0.65, roughness: glass ? 0.1 : 0.85, metalness: kind === 'oxido' ? 0.3 : 0, side: THREE.DoubleSide, transparent: glass, opacity: glass ? 0.6 : 1, depthWrite: !glass, color: glass ? 0x9adfff : 0xffffff }));
      m.renderOrder = glass ? 2 : 0; root.add(m);
      if (glass) { // tubo de cristal bajo el agua: peces y burbujas por fuera
        for (let n = 0; n < 40; n++) { const i = a + Math.floor(Math.random() * (b - a)), c = this.c[i], th = Math.random() * 6.28, rr = R + 2 + Math.random() * 6;
          const f = new THREE.Mesh(new THREE.ConeGeometry(0.25 + Math.random() * 0.3, 0.9, 5), new THREE.MeshStandardMaterial({ color: [0xff8a3a, 0xffd24a, 0x4af0ff, 0xff5aa0][n % 4], emissive: 0x332200, roughness: 0.5 }));
          f.position.set(c.x + this.U[i].x * R + (this.r[i].x * Math.sin(th) - this.U[i].x * Math.cos(th)) * rr, c.y + R - Math.cos(th) * rr, c.z + this.U[i].z * R + (this.r[i].z * Math.sin(th) - this.U[i].z * Math.cos(th)) * rr);
          f.rotation.set(Math.PI / 2, 0, Math.random() * 6); root.add(f); }
      }
      // compuerta de cambio de tubo, con cartel
      const c = this.c[a % N], t = this.t[a % N], ctr = c.clone().addScaledVector(this.U[a % N], R);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 0.1, 0.55, 8, 40), new THREE.MeshStandardMaterial({ color: 0xffc83a, emissive: 0x6a4a00, emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.4 }));
      ring.position.copy(ctr); ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), t); root.add(ring);
      if (si > 0) { const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshBasicMaterial({ map: banner({ concreto: 'TUBO PRINCIPAL', ladrillo: 'TUBO VIEJO', cristal: 'TUBO DE CRISTAL', oxido: 'TUBO OXIDADO' }[kind]), side: THREE.DoubleSide }));
        sign.position.copy(ctr).addScaledVector(this.U[a % N], R - 1.2); sign.lookAt(sign.position.clone().sub(t)); root.add(sign); }
    }
    // costillas cada pocos metros
    const ribM = new THREE.MeshStandardMaterial({ color: 0x3a4a44, roughness: 0.6, metalness: 0.5 }), ribG = new THREE.TorusGeometry(R + 0.05, 0.16, 5, 36);
    for (let i = 4; i < N; i += 14) { if (kindAt(i) === 'cristal' && i % 28) continue; const m = new THREE.Mesh(ribG, ribM); m.position.copy(this.c[i]).addScaledVector(this.U[i], R); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.t[i]); root.add(m); }
    // rampas pegadas al suelo del tubo
    const rampM = new THREE.MeshStandardMaterial({ color: 0xffb030, roughness: 0.5, emissive: 0x6a3a00, emissiveIntensity: 0.5 });
    for (const i of this.ramps) { const c = this.c[i], t = this.t[i], shape = new THREE.Shape(); shape.moveTo(-3, 0); shape.lineTo(1.2, 0); shape.lineTo(1.2, 0.9); shape.lineTo(-3, 0);
      const g = new THREE.ExtrudeGeometry(shape, { depth: 9, bevelEnabled: false, steps: 12 }); g.translate(0, 0, -4.5);
      const m = new THREE.Mesh(g, rampM); m.position.set(c.x, c.y, c.z); m.rotation.y = Math.atan2(t.x, t.z) - Math.PI / 2; root.add(m); this.bend(m); }
    // meta: anillo a cuadros que da toda la vuelta
    const fin = new THREE.Mesh(new THREE.PlaneGeometry(this.def.w, 2.2, 48, 1), new THREE.MeshStandardMaterial({ map: checker(), roughness: 0.6, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    const yaw = Math.atan2(this.t[0].x, this.t[0].z); fin.rotation.set(-Math.PI / 2, 0, yaw); fin.position.set(this.c[0].x, this.c[0].y + 0.04, this.c[0].z); root.add(fin); this.bend(fin);
    // semáforo colgado del techo
    const box = new THREE.Group(), panel = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.5, 0.35), new THREE.MeshStandardMaterial({ color: 0x15151c, roughness: 0.5, metalness: 0.4 })); box.add(panel);
    this.lights = []; const lg = new THREE.SphereGeometry(0.22, 16, 12);
    for (let k = 0; k < 5; k++) { const pair = []; for (const y of [0.35, -0.3]) { const m = new THREE.MeshStandardMaterial({ color: 0x2a0606, emissive: 0xff1a10, emissiveIntensity: 0, roughness: 0.3 }); for (const z of [-0.25, 0.25]) { const l = new THREE.Mesh(lg, m); l.position.set(-2.2 + k * 1.1, y, z); box.add(l); } pair.push(m); } this.lights.push(pair); }
    box.position.set(this.c[2].x, this.c[2].y + 4.1, this.c[2].z); box.rotation.y = yaw; root.add(box); this.place(box, 2);
    this.setLights = n => this.lights.forEach((pair, k) => pair.forEach(m => { m.emissiveIntensity = k < n ? 3.2 : 0; m.color.setHex(k < n ? 0xff3020 : 0x2a0606); }));
    // placas de impulso (en suelo y paredes)
    this.boosts = []; const cv = chevron();
    for (const f of this.def.boosts) { const i = Math.floor(f * N), c = this.c[i], t = this.t[i];
      const mat = new THREE.MeshBasicMaterial({ map: cv.clone(), color: 0xffb030, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
      mat.map.needsUpdate = true; mat.map.repeat.set(1, 2);
      const lat = ((i * 7) % 3 - 1) * this.hw * 0.4, m = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 6, 4, 4), mat);
      m.rotation.set(-Math.PI / 2, 0, Math.atan2(t.x, t.z) + Math.PI); m.position.set(c.x + this.r[i].x * lat, c.y + 0.05, c.z + this.r[i].z * lat); root.add(m); this.bend(m);
      this.boosts.push({ i, lat, mat, d: this.d[i] }); }
  }
  // carril colgante: tramo casi recto sin otros elementos; se llega con la rampa de nitro que hay antes
  _findSky() {
    const N = this.N, step = this.L / N, Kr = Math.round(26 / step), Ks = Math.round(62 / step), AL = this.alt;
    const clash = (a, b) => this.tunnels.some(([t0, t1]) => t1 > a && t0 < b) || this.bridges.some(([t0, t1]) => t1 > a && t0 < b)
      || (AL && AL.b + 20 > a && AL.a - 20 < b);
    let best = null;
    for (let s0 = 60 + Kr; s0 + Ks < N - 40; s0 += 4) {
      const r = s0 - Kr, s1 = s0 + Ks; if (clash(r - 10, s1 + 25)) continue;
      let bend = 0; for (let k = r; k < s1; k += 4) { const a = this.t[k], b = this.t[k + 4]; bend += Math.abs(Math.atan2(a.x * b.z - a.z * b.x, a.x * b.x + a.z * b.z)); }
      const climb = Math.abs(this.c[s1].y - this.c[r].y);
      const score = bend + climb * 0.05; if (!best || score < best.score) best = { r, s0, s1, score };
    }
    this.sky = best ? { r: best.r, s0: best.s0, s1: best.s1, H: 5.6, hw: this.hw - 1.2 } : null;
    if (this.sky) this.ramps = this.ramps.filter(r => r < best.r - 45 || r > best.s1 + 10); // la rampa de nitro sustituye a una normal cercana
  }
  // busca solo el mejor atajo: un tramo recto por dentro de una curva grande que no choque con la pista
  _findShortcut() {
    const N = this.N, hw = this.hw; let best = null;
    const busy = i => this.inRange(i, this.tunnels) || this.inRange(i, this.bridges) || this.ramps.some(r => Math.abs(r - i) < 12);
    for (let a = 40; a < N - 100; a += 4) for (let len = 50; len <= 220; len += 6) {
      const b = a + len; if (b > N - 40) continue;
      if (busy(a) || busy(b) || this.tunnels.some(([t0, t1]) => t1 > a - 10 && t0 < b + 10) || (this.sky && this.sky.s1 + 25 > a - 10 && this.sky.r - 10 < b + 10)) continue;
      const A = this.c[a], B = this.c[b], cx = B.x - A.x, cz = B.z - A.z, chord = Math.hypot(cx, cz), along = this.d[b] - this.d[a];
      if (along > this.L * 0.24 || chord < 18 || chord > along * 0.75 || Math.abs(B.y - A.y) > 5) continue;
      const side = Math.sign(cx * this.r[a].x + cz * this.r[a].z) || 1;
      let ok = true;
      for (let u = 0.1; u <= 0.9 && ok; u += 0.04) {
        const x = A.x + cx * u, z = A.z + cz * u;
        for (let k = 0; k < N; k += 2) { if (Math.abs(k - a) < 12 || Math.abs(k - b) < 12) continue; const c = this.c[k]; if (Math.hypot(c.x - x, c.z - z) < hw + 4) { ok = false; break; } }
      }
      if (!ok) continue;
      const gain = along - chord; if (gain < 12) continue;
      if (!best || gain > best.gain) best = { a, b, side, gain };
    }
    this.alt = null; if (!best) return;
    const { a, b, side } = best, A = this.c[a], B = this.c[b];
    const P0 = A.clone().addScaledVector(this.r[a], side * (hw - 1.5)), P3 = B.clone().addScaledVector(this.r[b], side * (hw - 1.5));
    const P1 = P0.clone().addScaledVector(this.r[a], side * 4.5).addScaledVector(this.t[a], 9), P2 = P3.clone().addScaledVector(this.r[b], side * 4.5).addScaledVector(this.t[b], -9);
    const cur = new THREE.CatmullRomCurve3([P0, P1, P2, P3], false, 'centripetal');
    const M = Math.max(40, Math.round(cur.getLength() / 1.2)), alt = { a, b, side, M, hw: 3.4, c: [], t: [], r: [], u: [] };
    for (let k = 0; k <= M; k++) { const p = cur.getPointAt(k / M); p.y = A.y + (B.y - A.y) * (k / M) + Math.sin(Math.PI * k / M) * 0.6; alt.c.push(p); }
    for (let k = 0; k <= M; k++) { const p0 = alt.c[Math.max(0, k - 1)], p1 = alt.c[Math.min(M, k + 1)], t = p1.clone().sub(p0).setY(0).normalize(); alt.t.push(t); alt.r.push(new THREE.Vector3(-t.z, 0, t.x)); alt.u.push(k / M); }
    alt.near = (p, hint = -1) => { let bi = 0, bd = Infinity; const lo = hint < 0 ? 0 : Math.max(0, hint - 20), hi = hint < 0 ? M : Math.min(M, hint + 20); for (let k = lo; k <= hi; k++) { const c = alt.c[k], d = (c.x - p.x) ** 2 + (c.z - p.z) ** 2; if (d < bd) { bd = d; bi = k; } } return bi; };
    alt.frame = (p, k) => { const c = alt.c[k], dx = p.x - c.x, dz = p.z - c.z; return { y: c.y, lat: dx * alt.r[k].x + dz * alt.r[k].z, along: dx * alt.t[k].x + dz * alt.t[k].z }; };
    this.alt = alt;
  }
  // punto de la pista más cercano, buscando cerca del anterior
  near(p, hint = -1) {
    const N = this.N; let best = 0, bd = Infinity;
    const scan = (i) => { const c = this.c[i], d = (c.x - p.x) ** 2 + (c.z - p.z) ** 2 + ((c.y - p.y) * 0.3) ** 2; if (d < bd) { bd = d; best = i; } };
    if (hint < 0) for (let i = 0; i < N; i++) scan(i);
    else for (let k = -40; k <= 40; k++) scan((hint + k + N) % N);
    return best;
  }
  // altura y pendiente de la pista en p (interpola entre muestras)
  frame(p, i) {
    const N = this.N, c = this.c[i], t = this.t[i];
    const dx = p.x - c.x, dz = p.z - c.z;
    const along = dx * t.x + dz * t.z, lat = dx * this.r[i].x + dz * this.r[i].z;
    const j = along >= 0 ? (i + 1) % N : (i - 1 + N) % N, seg = this.c[i].distanceTo(this.c[j]) || 1;
    const k = clamp(Math.abs(along) / seg, 0, 1), y = c.y + (this.c[j].y - c.y) * k;
    return { y, lat, along, dist: (this.d[i] + along + this.L) % this.L };
  }
  _build() {
    if (this.tube) return this._buildTube();
    const N = this.N, hw = this.hw, root = this.root;
    const AL = this.alt, gap = (k, sg) => AL && sg === AL.side && ((k >= AL.a - 4 && k <= AL.a + 12) || (k >= AL.b - 12 && k <= AL.b + 4)); // entradas del atajo
    this.gap = gap;
    const ribbon = (offA, offB, yA, yB, vScale, mat, close = true, skip = null) => {
      const pos = [], uv = [], idx = [];
      for (let i = 0; i <= N; i++) {
        const k = i % N, c = this.c[k], r = this.r[k], v = (i === N ? this.L : this.d[k]) / vScale;
        pos.push(c.x + r.x * offA, c.y + yA, c.z + r.z * offA, c.x + r.x * offB, c.y + yB, c.z + r.z * offB);
        uv.push(0, v, 1, v);
        if (i < N && !(skip && skip(k))) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat); m.receiveShadow = true; root.add(m); return m;
    };
    // calzada de tablones
    const TH = this.def.theme; const pl = roadOf(TH.road); const glowRoad = TH.road === 'neon' || TH.road === 'sombra'; ribbon(-hw, hw, 0, 0, TH.road === 'planks' ? 6 : 10, new THREE.MeshStandardMaterial({ map: pl, roughness: TH.road === 'ice' || TH.road === 'glass' || TH.road === 'marble' ? 0.25 : TH.road === 'metal' ? 0.45 : TH.road === 'neon' ? 0.4 : 0.8, metalness: TH.road === 'ice' ? 0.1 : TH.road === 'metal' ? 0.2 : 0, side: THREE.DoubleSide, ...(glowRoad ? { emissive: 0xffffff, emissiveMap: pl, emissiveIntensity: 0.35 } : {}) }));
    // bordillos rojos y blancos (un poco elevados)
    const cb = curbTex(TH.curb[0], TH.curb[1]); const cm = new THREE.MeshStandardMaterial({ map: cb, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2, side: THREE.DoubleSide });
    ribbon(-hw, -hw + 0.9, 0.03, 0.03, 2.4, cm); ribbon(hw - 0.9, hw, 0.03, 0.03, 2.4, cm);
    // canto y barandilla de madera
    const side = new THREE.MeshStandardMaterial({ color: TH.side, roughness: 0.85, side: THREE.DoubleSide });
    ribbon(-hw, -hw, 0, -0.9, 1, side); ribbon(hw, hw, -0.9, 0, 1, side);
    const rail = new THREE.MeshStandardMaterial({ color: TH.rail, roughness: 0.7, side: THREE.DoubleSide });
    ribbon(-hw - 0.15, -hw - 0.15, 0.55, 0.85, 1, rail, true, k => gap(k, -1)).castShadow = true; ribbon(hw + 0.15, hw + 0.15, 0.85, 0.55, 1, rail, true, k => gap(k, 1)).castShadow = true;
    ribbon(-hw - 0.15, -hw - 0.15, 0.2, 0.32, 1, rail, true, k => gap(k, -1)); ribbon(hw + 0.15, hw + 0.15, 0.32, 0.2, 1, rail, true, k => gap(k, 1));
    // postes de la barandilla y pilotes hasta las nubes
    const step = 5, nPost = Math.floor(this.L / step);
    const post = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 1.05, 0.22), new THREE.MeshStandardMaterial({ color: TH.post, roughness: 0.8 }), nPost * 2);
    const pile = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.45, 0.55, 1, 10), new THREE.MeshStandardMaterial({ color: TH.pile, roughness: 0.9 }), Math.ceil(nPost / 3) * 2 + 2);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
    let pi = 0, pj = 0, si = 0;
    for (let k = 0; k < nPost; k++) {
      while (si < N - 1 && this.d[si] < k * step) si++;
      const c = this.c[si], r = this.r[si];
      q.setFromAxisAngle(up, Math.atan2(r.x, r.z));
      for (const sg of [-1, 1]) {
        if (!gap(si, sg)) { m4.compose(new THREE.Vector3(c.x + r.x * (hw + 0.15) * sg, c.y + 0.42, c.z + r.z * (hw + 0.15) * sg), q, s); post.setMatrixAt(pi++, m4); }
        if (k % 3 === 0 && !this.inRange(si, this.bridges)) { const h = c.y + 0.9 - this.def.water.y + 1; m4.compose(new THREE.Vector3(c.x + r.x * (hw - 1.2) * sg, c.y - 0.9 - h / 2, c.z + r.z * (hw - 1.2) * sg), q, new THREE.Vector3(1, h, 1)); pile.setMatrixAt(pj++, m4); }
      }
    }
    post.count = pi; pile.count = pj; post.castShadow = true; root.add(post, pile);
    this._buildFeatures();
    // línea de meta y arco
    const c0 = this.c[0], r0 = this.r[0], t0 = this.t[0], yaw = Math.atan2(t0.x, t0.z);
    const fin = new THREE.Mesh(new THREE.PlaneGeometry(this.def.w, 2.2), new THREE.MeshStandardMaterial({ map: checker(), roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    fin.rotation.set(-Math.PI / 2, 0, yaw); fin.position.set(c0.x, c0.y + 0.02, c0.z); root.add(fin);
    const arch = new THREE.Group(); arch.position.set(c0.x, c0.y, c0.z); arch.rotation.y = yaw; root.add(arch);
    const pm = new THREE.MeshStandardMaterial({ color: 0xf4ecd8, roughness: 0.6 });
    for (const sg of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 7, 12), pm); p.position.set(sg * (this.hw + 1), 3.5, 0); p.castShadow = true; arch.add(p); }
    const bn = new THREE.Mesh(new THREE.BoxGeometry(this.def.w + 2.6, 1.5, 0.3), [pm, pm, pm, pm, new THREE.MeshStandardMaterial({ map: banner(TH.banner) }), new THREE.MeshStandardMaterial({ map: banner('META') })]);
    bn.position.y = 6.6; bn.castShadow = true; arch.add(bn);
    // semáforo de salida (como en la Fórmula 1): cinco pares de luces rojas colgando del arco
    const panel = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.5, 0.35), new THREE.MeshStandardMaterial({ color: 0x15151c, roughness: 0.5, metalness: 0.4 }));
    panel.position.set(0, 5.05, -0.3); panel.castShadow = true; arch.add(panel);
    for (const x of [-1.6, 1.6]) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6), new THREE.MeshStandardMaterial({ color: 0x333340 })); rod.position.set(x, 6.0, -0.3); arch.add(rod); }
    this.lights = [];
    const lg = new THREE.SphereGeometry(0.22, 16, 12);
    for (let k = 0; k < 5; k++) {
      const pair = [];
      for (const y of [5.4, 4.75]) {
        const m = new THREE.MeshStandardMaterial({ color: 0x2a0606, emissive: 0xff1a10, emissiveIntensity: 0, roughness: 0.3 });
        for (const z of [-0.5, -0.1]) { const l = new THREE.Mesh(lg, m); l.position.set(-2.2 + k * 1.1, y, z); arch.add(l); }
        pair.push(m);
      }
      this.lights.push(pair);
    }
    this.setLights = n => this.lights.forEach((pair, k) => pair.forEach(m => { m.emissiveIntensity = k < n ? 3.2 : 0; m.color.setHex(k < n ? 0xff3020 : 0x2a0606); }));
    for (const sg of [-1, 1]) { const fl = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 4), new THREE.MeshStandardMaterial({ color: 0xffc83a })); fl.position.set(sg * (this.hw + 1), 7.6, 0); arch.add(fl); }
    // placas de impulso
    this.boosts = []; const cv = chevron();
    for (const f of this.def.boosts) {
      const i = Math.floor(f * N), c = this.c[i], t = this.t[i];
      const mat = new THREE.MeshBasicMaterial({ map: cv.clone(), color: 0xffb030, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
      mat.map.needsUpdate = true; mat.map.repeat.set(1, 2);
      const lat = ((i * 7) % 3 - 1) * this.hw * 0.4;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 6), mat);
      m.rotation.set(-Math.PI / 2, 0, Math.atan2(t.x, t.z) + Math.PI); m.position.set(c.x + this.r[i].x * lat, c.y + 0.04, c.z + this.r[i].z * lat); root.add(m);
      const base = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 6.2), new THREE.MeshBasicMaterial({ color: 0x5a2a8a, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -5 }));
      base.rotation.copy(m.rotation); base.position.copy(m.position).setY(c.y + 0.035); root.add(base);
      this.boosts.push({ i, lat, mat, d: this.d[i] });
    }
  }
  _buildFeatures() {
    const N = this.N, hw = this.hw, root = this.root, TH = this.def.theme, up = new THREE.Vector3(0, 1, 0);
    // túneles: bóveda, montaña encima y farolillos
    for (const [a, b] of this.tunnels) {
      const R = hw + 1.4, seg = 10, pos = [], idx = [];
      for (let i = a; i <= b; i++) { const c = this.c[i], r = this.r[i]; for (let k = 0; k <= seg; k++) { const ang = Math.PI * k / seg; pos.push(c.x + r.x * Math.cos(ang) * R, c.y - 0.6 + Math.sin(ang) * R * 0.72, c.z + r.z * Math.cos(ang) * R); } }
      const rows = b - a + 1; for (let i = 0; i < rows - 1; i++) for (let k = 0; k < seg; k++) { const p0 = i * (seg + 1) + k, p1 = p0 + seg + 1; idx.push(p0, p1, p0 + 1, p0 + 1, p1, p1 + 1); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      const mat = TH.tunnelGlass ? new THREE.MeshStandardMaterial({ color: TH.tunnel, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.55, side: THREE.DoubleSide, emissive: 0x2a5a8a, emissiveIntensity: 0.25 })
        : new THREE.MeshStandardMaterial({ color: TH.tunnel, roughness: 0.95, side: THREE.DoubleSide, flatShading: true });
      const arch = new THREE.Mesh(g, mat); arch.receiveShadow = true; root.add(arch);
      const rockM = new THREE.MeshStandardMaterial({ color: TH.tunnel, roughness: 1, flatShading: true, transparent: !!TH.tunnelGlass, opacity: TH.tunnelGlass ? 0.85 : 1 });
      for (let i = a + 4; i < b - 2; i += 9) { const c = this.c[i]; const rr = hw + 4 + Math.random() * 3, m = new THREE.Mesh(new THREE.IcosahedronGeometry(rr, 0), rockM); m.position.set(c.x, c.y + R * 0.72 + rr * 0.45 * 0.55, c.z); m.scale.set(1, 0.45, 1); m.rotation.y = Math.random() * 3; root.add(m); }
      const lamp = new THREE.MeshBasicMaterial({ color: 0xffd27a });
      for (let i = a + 3; i < b; i += 8) for (const sg of [-1, 1]) { const c = this.c[i], r = this.r[i], l = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), lamp); l.position.set(c.x + r.x * (hw + 0.9) * sg, c.y + 2.4, c.z + r.z * (hw + 0.9) * sg); root.add(l); }
      for (const i of [a, b]) { const c = this.c[i], fr = new THREE.Mesh(new THREE.TorusGeometry(R, 0.7, 6, 18, Math.PI), rockM); fr.position.set(c.x, c.y - 0.6, c.z); fr.scale.set(1, 0.72, 1); fr.rotation.y = Math.atan2(this.t[i].x, this.t[i].z); root.add(fr); }
    }
    // puentes colgantes: torres, cables y tirantes
    for (const [a, b] of this.bridges) {
      const towerM = new THREE.MeshStandardMaterial({ color: TH.post, roughness: 0.8 }), cableM = new THREE.MeshStandardMaterial({ color: TH.cable, roughness: 0.6 });
      const H = 9;
      for (const i of [a, b]) for (const sg of [-1, 1]) { const c = this.c[i], r = this.r[i], tw = new THREE.Mesh(new THREE.BoxGeometry(0.9, H + 4, 0.9), towerM); tw.position.set(c.x + r.x * (hw + 0.8) * sg, c.y + (H + 4) / 2 - 3, c.z + r.z * (hw + 0.8) * sg); tw.castShadow = true; root.add(tw);
        const fl = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 4), new THREE.MeshStandardMaterial({ color: 0xffc83a })); fl.position.copy(tw.position).setY(c.y + H + 1.6); root.add(fl); }
      for (const sg of [-1, 1]) {
        const pts = []; for (let i = a; i <= b; i += 3) { const u = (i - a) / (b - a), c = this.c[i], r = this.r[i]; pts.push(new THREE.Vector3(c.x + r.x * (hw + 0.8) * sg, c.y + 1.4 + (H - 1.4) * (4 * (u - 0.5) ** 2), c.z + r.z * (hw + 0.8) * sg)); }
        const cur = new THREE.CatmullRomCurve3(pts); root.add(new THREE.Mesh(new THREE.TubeGeometry(cur, pts.length * 3, 0.12, 6, false), cableM));
        for (let i = a + 3; i < b - 2; i += 4) { const u = (i - a) / (b - a), c = this.c[i], r = this.r[i], h = (H - 1.4) * (4 * (u - 0.5) ** 2) + 0.6; if (h < 0.7) continue; const hg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, h, 4), cableM); hg.position.set(c.x + r.x * (hw + 0.8) * sg, c.y + 0.85 + h / 2, c.z + r.z * (hw + 0.8) * sg); root.add(hg); }
      }
    }
    // rampas: cuña con flechas; al pasar, el kart salta
    const rampM = new THREE.MeshStandardMaterial({ color: 0xffb030, roughness: 0.5, emissive: 0x6a3a00, emissiveIntensity: 0.4 });
    for (const i of this.ramps) {
      const c = this.c[i], t = this.t[i], shape = new THREE.Shape(); shape.moveTo(-3, 0); shape.lineTo(1.2, 0); shape.lineTo(1.2, 0.9); shape.lineTo(-3, 0);
      const g = new THREE.ExtrudeGeometry(shape, { depth: this.def.w * 0.9, bevelEnabled: false }); g.translate(0, 0, -this.def.w * 0.45);
      const m = new THREE.Mesh(g, rampM); m.position.set(c.x, c.y, c.z); m.rotation.y = Math.atan2(t.x, t.z) - Math.PI / 2; m.castShadow = true; m.receiveShadow = true; root.add(m);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1), new THREE.MeshBasicMaterial({ map: banner('▲ SALTO ▲'), side: THREE.DoubleSide })); sign.position.set(c.x - t.x * 10 + this.r[i].x * (hw + 1.2), c.y + 1.8, c.z - t.z * 10 + this.r[i].z * (hw + 1.2)); sign.rotation.y = Math.atan2(t.x, t.z) + Math.PI; root.add(sign);
    }
    // atajo oculto: camino estrecho con bordes bajos y matorrales que tapan la entrada
    const A = this.alt; if (!A) return;
    const M = A.M, pos = [], uv = [], idx = [], wpos = [], widx = [];
    for (let k = 0; k <= M; k++) { const c = A.c[k], r = A.r[k]; pos.push(c.x - r.x * A.hw, c.y + 0.02, c.z - r.z * A.hw, c.x + r.x * A.hw, c.y + 0.02, c.z + r.z * A.hw); uv.push(0, k / 3, 1, k / 3); if (k < M) { const q = k * 2; idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const roadTex = TH.road === 'planks' ? forestRoad() : roadOf(TH.road);
    const road = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: roadTex, color: 0xd8c8b0, roughness: 0.9, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 })); road.receiveShadow = true; root.add(road);
    // debajo, un soporte para que no flote
    const under = new THREE.Mesh(g.clone(), new THREE.MeshStandardMaterial({ color: TH.side, side: THREE.DoubleSide })); under.position.y = -0.6; root.add(under);
    const bush = new THREE.MeshStandardMaterial({ color: TH.road === 'ice' ? 0xe8f4ff : TH.road === 'sand' ? 0x9a7a4a : 0x3a8a3a, roughness: 1, flatShading: true });
    for (let k = 6; k < M - 6; k += 5) for (const sg of [-1, 1]) { const c = A.c[k], r = A.r[k], b2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7 + Math.random() * 0.5, 0), bush); b2.position.set(c.x + r.x * (A.hw + 0.4) * sg, c.y + 0.35, c.z + r.z * (A.hw + 0.4) * sg); b2.castShadow = true; root.add(b2); }
    // la entrada queda tapada por un seto continuo que se puede atravesar: desde la pista parece un borde más
    const hedge = new THREE.MeshStandardMaterial({ color: TH.road === 'ice' ? 0xdff0ff : TH.road === 'sand' ? 0xb08050 : 0x2f7a34, roughness: 1, flatShading: true });
    this.hedges = [];
    for (const [k0, k1] of [[A.a - 4, A.a + 12], [A.b - 12, A.b + 4]]) for (let k = k0; k <= k1; k += 1) {
      const c = this.c[k], r = this.r[k], h = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75 + Math.random() * 0.25, 0), hedge);
      h.position.set(c.x + r.x * (hw + 0.2) * A.side, c.y + 0.55 + Math.random() * 0.2, c.z + r.z * (hw + 0.2) * A.side); h.scale.set(1, 0.9, 1); h.rotation.y = Math.random() * 3; root.add(h); this.hedges.push(h);
    }
    this._buildSky();
  }
  _buildSky() {
    const S = this.sky; if (!S) return;
    const root = this.root, hw = this.hw, TH = this.def.theme, { r: ri, s0, s1, H } = S;
    // rampa grande de nitro
    const c = this.c[ri], t = this.t[ri], shape = new THREE.Shape(); shape.moveTo(-5, 0); shape.lineTo(1.4, 0); shape.lineTo(1.4, 1.5); shape.lineTo(-5, 0);
    const g = new THREE.ExtrudeGeometry(shape, { depth: this.def.w * 0.9, bevelEnabled: false }); g.translate(0, 0, -this.def.w * 0.45);
    const rm = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xff5a2a, roughness: 0.4, emissive: 0xaa2200, emissiveIntensity: 0.5 }));
    rm.position.set(c.x, c.y, c.z); rm.rotation.y = Math.atan2(t.x, t.z) - Math.PI / 2; rm.castShadow = true; root.add(rm);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), new THREE.MeshBasicMaterial({ map: banner('NITRO ▲ SALTO'), side: THREE.DoubleSide }));
    const k0 = Math.max(0, ri - 16); sign.position.set(this.c[k0].x + this.r[k0].x * (hw + 1.3), this.c[k0].y + 2, this.c[k0].z + this.r[k0].z * (hw + 1.3)); sign.rotation.y = Math.atan2(t.x, t.z) + Math.PI; root.add(sign);
    // el carril: tablero con flechas brillantes, colgado de cables
    const arrows = tex(128, 256, (cx, w, h) => { cx.fillStyle = '#1a2a4a'; cx.fillRect(0, 0, w, h); cx.strokeStyle = '#4af0ff'; cx.lineWidth = 14; cx.lineCap = 'round';
      for (const y of [70, 190]) { cx.beginPath(); cx.moveTo(24, y + 30); cx.lineTo(64, y - 20); cx.lineTo(104, y + 30); cx.stroke(); } cx.fillStyle = '#ffd24a'; cx.fillRect(0, 0, 8, h); cx.fillRect(w - 8, 0, 8, h); });
    const pos = [], uv = [], idx = [], pos2 = [];
    for (let k = s0; k <= s1; k++) { const p = this.c[k], r = this.r[k], v = (this.d[k] - this.d[s0]) / 6;
      pos.push(p.x - r.x * S.hw, p.y + H, p.z - r.z * S.hw, p.x + r.x * S.hw, p.y + H, p.z + r.z * S.hw); uv.push(0, v, 1, v);
      if (k < s1) { const q = (k - s0) * 2; idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); } }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); lg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); lg.setIndex(idx); lg.computeVertexNormals();
    const lane = new THREE.Mesh(lg, new THREE.MeshStandardMaterial({ map: arrows, emissive: 0x2a8aff, emissiveMap: arrows, emissiveIntensity: 0.7, roughness: 0.5, side: THREE.DoubleSide })); lane.receiveShadow = true; root.add(lane);
    const bottom = new THREE.Mesh(lg.clone(), new THREE.MeshStandardMaterial({ color: 0x2a3550, side: THREE.DoubleSide })); bottom.position.y = -0.35; root.add(bottom);
    const railM = new THREE.MeshStandardMaterial({ color: 0x4af0ff, emissive: 0x2ab0ff, emissiveIntensity: 0.8 }), poleM = new THREE.MeshStandardMaterial({ color: TH.post, roughness: 0.8 }), cab = new THREE.MeshStandardMaterial({ color: 0x2a2a2a });
    for (const sg of [-1, 1]) {
      const pts = []; for (let k = s0; k <= s1; k += 2) { const p = this.c[k], r = this.r[k]; pts.push(new THREE.Vector3(p.x + r.x * S.hw * sg, p.y + H + 0.45, p.z + r.z * S.hw * sg)); }
      root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, 0.09, 6, false), railM));
      for (let k = s0 + 3; k < s1; k += 12) { const p = this.c[k], r = this.r[k];
        const top = new THREE.Vector3(p.x + r.x * (hw + 0.9) * sg, p.y + H + 4.5, p.z + r.z * (hw + 0.9) * sg);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, H + 5.5, 6), poleM); pole.position.set(top.x, p.y + (H + 5.5) / 2 - 1, top.z); pole.castShadow = true; root.add(pole);
        const low = new THREE.Vector3(p.x + r.x * S.hw * sg, p.y + H, p.z + r.z * S.hw * sg), mid = top.clone().add(low).multiplyScalar(0.5), len = top.distanceTo(low);
        const cb = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, len, 4), cab); cb.position.copy(mid); cb.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(low).normalize()); root.add(cb); }
    }
  }
  // decorado: islas, casas, faro y barriles lejos de la calzada (para el mundo)
  decor(seed = 7) {
    let s = seed; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    const isl = [], houses = [], trees = [], lights = [], props = [], pines = [], bigTrees = [], mushrooms = [];
    const theme = this.def.theme.decor;
    const clear = (x, z, R) => { for (let i = 0; i < this.N; i += 4) { const c = this.c[i]; if (Math.hypot(c.x - x, c.z - z) < this.hw + R + 3) return false; } return true; };
    for (let n = 0; n < 220 && isl.length < 14; n++) {
      const x = -130 + rnd() * 260, z = -140 + rnd() * 190, w = 10 + rnd() * 16, d = 10 + rnd() * 14;
      if (!clear(x, z, Math.hypot(w, d) / 2)) continue;
      if (isl.some(o => Math.hypot(o.x - x, o.z - z) < (o.w + w) / 2 + 4)) continue;
      const top = (theme === 'bosque' ? -6 : -2.6) + rnd() * 2;
      isl.push({ x, z, w, d, top, depth: 4 });
      const k = isl.length % 4;
      if (theme === 'bosque') { trees.push({ x: x - w * 0.2, z, y: top, s: 1.2 + rnd() * 0.6 }, { x: x + w * 0.2, z: z + d * 0.2, y: top, s: 1 + rnd() * 0.5 }); mushrooms.push({ x: x + w * 0.1, z: z - d * 0.25, y: top, s: 1 + rnd() * 0.8 }); continue; }
      if (theme === 'glaciar') { for (let q = 0; q < 3; q++) pines.push({ x: x + (rnd() - 0.5) * w * 0.7, z: z + (rnd() - 0.5) * d * 0.7, y: top, s: 0.9 + rnd() * 0.6 }); if (k === 0) houses.push({ x, z, w: 5, d: 4.5, h: 3, base: top, roof: 0xe8f0ff }); continue; }
      if (k === 0) houses.push({ x, z, w: 5, d: 4.5, h: 3.2, base: top, roof: rnd() < 0.5 ? 0xc9563c : 0x4f7fc0 });
      else if (k === 1) lights.push({ x, z, y: top });
      else { trees.push({ x: x - w * 0.2, z: z - d * 0.15, y: top, s: 0.9 + rnd() * 0.4 }); props.push({ kind: 'barril', x: x + w * 0.2, z: z + d * 0.1, y: top }, { kind: 'caja', x: x + w * 0.25, z: z - d * 0.2, y: top, rot: rnd() * 3 }); }
    }
    const EMPTY = { islands: [], houses: [], trees: [], lighthouses: [], props: [], pines: [], bigTrees: [], mushrooms: [], snow: 0 };
    const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o }), add = m => { this.root.add(m); return m; };
    const B = (c, o = {}) => new THREE.MeshBasicMaterial({ color: c, ...o });
    const spots = (n, R, near = false, tries = 500) => { const out = []; for (let k = 0; k < tries && out.length < n; k++) { const x = -170 + rnd() * 340, z = -200 + rnd() * 260; if (!clear(x, z, R)) continue; if (near && clear(x, z, R + 18)) continue; if (out.some(o => Math.hypot(o.x - x, o.z - z) < R * 2)) continue; out.push({ x, z }); } return out; };
    const wy = this.def.water.y;
    this.spinners = []; this.bobs = [];
    if (theme === 'volcan') { // volcanes humeantes y pilares de basalto saliendo de la lava
      for (const { x, z } of spots(7, 16)) { const H = 30 + rnd() * 30, R = 14 + rnd() * 10;
        add(new THREE.Mesh(new THREE.ConeGeometry(R, H, 9, 1, true), M(0x3a2a26, { flatShading: true }))).position.set(x, wy + H / 2, z);
        const crater = add(new THREE.Mesh(new THREE.CylinderGeometry(R * 0.22, R * 0.22, 0.6, 9), new THREE.MeshBasicMaterial({ color: 0xff7a2a }))); crater.position.set(x, wy + H * 0.78, z);
        for (let k = 0; k < 3; k++) { const sm = add(new THREE.Mesh(new THREE.SphereGeometry(3 + k * 1.5, 8, 6), new THREE.MeshStandardMaterial({ color: 0x5a4a4a, transparent: true, opacity: 0.45 - k * 0.1, roughness: 1 }))); sm.position.set(x + k * 1.5, wy + H * 0.8 + 4 + k * 5, z); this.bobs.push({ m: sm, y0: sm.position.y, a: 1.2, sp: 0.6 + k * 0.2 }); } }
      for (const { x, z } of spots(18, 3, true)) { const h = 8 + rnd() * 14; const m = add(new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, h + (0 - wy), 6), M(0x2a2224, { flatShading: true }))); m.position.set(x, wy + (h + (0 - wy)) / 2 - 6, z); m.castShadow = true;
        const glow = add(new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.12, 4, 12), new THREE.MeshBasicMaterial({ color: 0xff8a2a }))); glow.rotation.x = Math.PI / 2; glow.position.set(x, wy + 1, z); }
      return EMPTY;
    }
    if (theme === 'cristales') { // agujas de cristal de colores y arcos rotos
      const cols = [0xc08aff, 0xff8ad0, 0x8ad0ff, 0xffe08a];
      for (const { x, z } of spots(26, 4)) { const h = 10 + rnd() * 30, m = add(new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: cols[Math.floor(rnd() * 4)], roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.8, emissive: 0x3a1a5a, emissiveIntensity: 0.4 })));
        m.scale.set(2 + rnd() * 3, h, 2 + rnd() * 3); m.position.set(x, wy + h * 0.6, z); m.rotation.set((rnd() - 0.5) * 0.4, rnd() * 3, (rnd() - 0.5) * 0.4); }
      for (const { x, z } of spots(5, 10)) { const a = add(new THREE.Mesh(new THREE.TorusGeometry(9, 1.2, 8, 24, Math.PI * (0.7 + rnd() * 0.3)), new THREE.MeshStandardMaterial({ color: 0xf0e8ff, roughness: 0.3, transparent: true, opacity: 0.85 }))); a.position.set(x, wy + 14, z); a.rotation.y = rnd() * 3; }
      return EMPTY;
    }
    if (theme === 'engranajes') { // engranajes gigantes que giran, torres de latón y chimeneas con vapor
      const brass = M(0xc8a050, { metalness: 0.7, roughness: 0.35 }), iron = M(0x5a5a62, { metalness: 0.6, roughness: 0.5 });
      const gear = (R, teeth, mat) => { const sh = new THREE.Shape(); for (let k = 0; k <= teeth * 2; k++) { const a = (k / (teeth * 2)) * Math.PI * 2, r = k % 2 ? R : R * 0.84; const a2 = a + Math.PI / teeth; k ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); sh.lineTo(Math.cos(a2 - 0.001) * r, Math.sin(a2 - 0.001) * r); }
        const hole = new THREE.Path(); hole.absarc(0, 0, R * 0.3, 0, Math.PI * 2, true); sh.holes.push(hole); return new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 1.2, bevelEnabled: false }), mat); };
      for (const { x, z } of spots(9, 9, true)) { const R = 6 + rnd() * 8, g = add(gear(R, 10 + Math.floor(rnd() * 6), rnd() < 0.5 ? brass : iron)); g.position.set(x, R + 2 + rnd() * 6, z); g.rotation.y = rnd() * 3; g.rotation.order = 'YXZ';
        g.userData.sp = (rnd() < 0.5 ? -1 : 1) * (0.3 + rnd() * 0.5); this.spinners.push(g);
        const post = add(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, g.position.y - wy, 8), iron)); post.position.set(x, (g.position.y + wy) / 2, z); }
      for (const { x, z } of spots(10, 6)) { const H = 20 + rnd() * 25, t = add(new THREE.Mesh(new THREE.CylinderGeometry(4, 5, H, 8), M(0x8a6a40, { metalness: 0.4 }))); t.position.set(x, wy + H / 2, z);
        const roof = add(new THREE.Mesh(new THREE.ConeGeometry(5.5, 6, 8), brass)); roof.position.set(x, wy + H + 3, z);
        const ch = add(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 6, 8), iron)); ch.position.set(x + 2, wy + H + 4, z);
        for (let k = 0; k < 2; k++) { const st = add(new THREE.Mesh(new THREE.SphereGeometry(1.6 + k, 8, 6), new THREE.MeshStandardMaterial({ color: 0xf0f0f0, transparent: true, opacity: 0.5 - k * 0.15 }))); st.position.set(x + 2, wy + H + 8 + k * 3, z); this.bobs.push({ m: st, y0: st.position.y, a: 1, sp: 0.8 + k * 0.3 }); } }
      return EMPTY;
    }
    if (theme === 'faroles') { // cielo de estrellas y faroles flotando que se mecen
      const sg = new THREE.BufferGeometry(), sp = []; for (let k = 0; k < 900; k++) { const a = rnd() * 6.28, b = rnd() * 1.2, r = 380; sp.push(Math.cos(a) * Math.cos(b) * r, Math.sin(b) * r + 10, Math.sin(a) * Math.cos(b) * r); }
      sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false })));
      const moon = add(new THREE.Mesh(new THREE.SphereGeometry(14, 20, 14), new THREE.MeshBasicMaterial({ color: 0xfff4d0, fog: false }))); moon.position.set(-120, 120, -280);
      const lampCols = [0xff8a3a, 0xffc04a, 0xff5a5a];
      for (let k = 0; k < 70; k++) { const x = -160 + rnd() * 320, z = -200 + rnd() * 260; if (!clear(x, z, 1)) continue;
        const g = new THREE.Group(), col = lampCols[k % 3]; const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 1.1, 10), new THREE.MeshBasicMaterial({ color: col }));
        const glow = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending })); g.add(body, glow);
        g.position.set(x, 3 + rnd() * 25, z); add(g); this.bobs.push({ m: g, y0: g.position.y, a: 0.8 + rnd(), sp: 0.4 + rnd() * 0.5 }); }
      // faroles en postes junto a la pista
      for (let i = 10; i < this.N; i += 36) for (const sgn of [-1, 1]) { const c = this.c[i], r = this.r[i], x = c.x + r.x * (this.hw + 1.3) * sgn, z = c.z + r.z * (this.hw + 1.3) * sgn;
        const pole = add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.4, 6), M(0x2a1a10))); pole.position.set(x, c.y + 1.7, z);
        const l = add(new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffb04a }))); l.position.set(x, c.y + 3.5, z); }
      return EMPTY;
    }
    if (theme === 'nubes') { // nubes enormes, templos flotantes y un arcoíris
      const cm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xdde8ff, emissiveIntensity: 0.25 });
      for (const { x, z } of spots(22, 8)) { const g = new THREE.Group(); for (let k = 0; k < 5; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(4 + rnd() * 5, 12, 8), cm); b.position.set((rnd() - 0.5) * 14, (rnd() - 0.3) * 4, (rnd() - 0.5) * 8); b.scale.y = 0.6; g.add(b); }
        g.position.set(x, -8 + rnd() * 30, z); add(g); this.bobs.push({ m: g, y0: g.position.y, a: 1.5, sp: 0.15 + rnd() * 0.2 }); }
      for (const { x, z } of spots(4, 10)) { const g = new THREE.Group(), base = new THREE.Mesh(new THREE.CylinderGeometry(8, 3, 6, 10), M(0xe8eef8)); g.add(base);
        for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28, c = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 6, 8), M(0xffffff)); c.position.set(Math.cos(a) * 5.5, 6, Math.sin(a) * 5.5); g.add(c); }
        const dome = new THREE.Mesh(new THREE.SphereGeometry(6.2, 16, 8, 0, 6.3, 0, Math.PI / 2), M(0xffd24a, { metalness: 0.5, roughness: 0.3 })); dome.position.y = 9; g.add(dome);
        g.position.set(x, 6 + rnd() * 14, z); add(g); this.bobs.push({ m: g, y0: g.position.y, a: 1, sp: 0.2 }); }
      const rb = ['#ff4a4a', '#ff9a3a', '#ffe04a', '#5ad05a', '#4ab0ff', '#7a5aff'];
      rb.forEach((c, k) => { const a = add(new THREE.Mesh(new THREE.TorusGeometry(120 - k * 3, 1.5, 6, 60, Math.PI), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.45, fog: false, depthWrite: false }))); a.position.set(0, -20, -260); });
      return EMPTY;
    }
    if (theme === 'circo') { // carpas a rayas, noria, globos y focos
      const stripe = (a, b) => tex(256, 64, (c, w, h) => { for (let k = 0; k < 16; k++) { c.fillStyle = k % 2 ? a : b; c.fillRect(k * w / 16, 0, w / 16 + 1, h); } });
      const pairs = [['#e8303a', '#ffffff'], ['#3a6aff', '#ffd24a'], ['#ffd24a', '#e8303a'], ['#5ad05a', '#ffffff']];
      spots(7, 12).forEach(({ x, z }, k) => { const [a, b] = pairs[k % 4], R = 9 + rnd() * 6, H = 7 + rnd() * 4;
        const mt = new THREE.MeshStandardMaterial({ map: stripe(a, b), roughness: 0.7 });
        const wall = add(new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 24, 1, true), mt)); wall.position.set(x, wy + 14 + H / 2, z);
        const roof = add(new THREE.Mesh(new THREE.ConeGeometry(R * 1.1, H * 1.1, 24), mt)); roof.position.set(x, wy + 14 + H + H * 0.55, z);
        const flag = add(new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.6, 3), M(0xffd24a))); flag.position.set(x, wy + 14 + H + H * 1.15, z); flag.rotation.z = -Math.PI / 2;
        const isl = add(new THREE.Mesh(new THREE.CylinderGeometry(R + 2, R - 2, 6, 16), M(0x8a5a3a))); isl.position.set(x, wy + 11, z); });
      spots(1, 18).forEach(({ x, z }) => { const g = new THREE.Group(), Rw = 16, rim = new THREE.Mesh(new THREE.TorusGeometry(Rw, 0.35, 6, 48), M(0xffffff, { metalness: 0.4 })); g.add(rim);
        for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, sp = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, Rw, 5), M(0xffffff)); sp.position.set(Math.cos(a) * Rw / 2, Math.sin(a) * Rw / 2, 0); sp.rotation.z = a - Math.PI / 2; g.add(sp);
          const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.6, 1.6), M([0xe8303a, 0x3a6aff, 0xffd24a, 0x5ad05a][k % 4])); cab.position.set(Math.cos(a) * Rw, Math.sin(a) * Rw - 1, 0); g.add(cab); }
        g.position.set(x, wy + 34, z); g.rotation.y = rnd() * 3; g.rotation.order = 'YXZ'; add(g); g.userData.sp = 0.15; this.spinners.push(g);
        for (const s of [-1, 1]) { const leg = add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 34, 6), M(0xd8d8e0))); leg.position.set(x + s * 6, wy + 17, z); leg.rotation.z = s * 0.18; } });
      for (let k = 0; k < 40; k++) { const x = -160 + rnd() * 320, z = -200 + rnd() * 260; if (!clear(x, z, 2)) continue; const g = new THREE.Group();
        g.add(new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 10), M([0xe8303a, 0x3a6aff, 0xffd24a, 0x5ad05a, 0xff8ad0][k % 5], { roughness: 0.3 })));
        const str = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 3, 4), M(0xffffff)); str.position.y = -2.3; g.add(str); g.position.set(x, 4 + rnd() * 20, z); add(g); this.bobs.push({ m: g, y0: g.position.y, a: 1.2, sp: 0.5 + rnd() * 0.5 }); }
      return EMPTY;
    }
    if (theme === 'sombras') { // agujas negras, cristales violetas y ojos enormes en el cielo
      for (const { x, z } of spots(26, 3)) { const h = 20 + rnd() * 40, m = add(new THREE.Mesh(new THREE.ConeGeometry(1.5 + rnd() * 2.5, h, 5), M(0x0e0814, { roughness: 0.9, flatShading: true }))); m.position.set(x, wy + h / 2, z); m.rotation.y = rnd() * 3; }
      for (let k = 0; k < 30; k++) { const x = -160 + rnd() * 320, z = -200 + rnd() * 260; if (!clear(x, z, 2)) continue; const c = add(new THREE.Mesh(new THREE.OctahedronGeometry(0.8 + rnd() * 1.2, 0), M(0xb06aff, { emissive: 0x7a2aff, emissiveIntensity: 1, roughness: 0.2 }))); c.scale.y = 1.8; c.position.set(x, 2 + rnd() * 18, z); this.bobs.push({ m: c, y0: c.position.y, a: 1, sp: 0.6 + rnd() * 0.4 }); }
      [[-90, 70, -240], [110, 90, -220], [0, 120, -300]].forEach(([x, y, z], k) => { const g = new THREE.Group(); const w = new THREE.Mesh(new THREE.SphereGeometry(10 + k * 3, 24, 16), B(0xf0e8ff, { fog: false })); w.scale.z = 0.4; g.add(w);
        const iris = new THREE.Mesh(new THREE.CircleGeometry(5 + k, 24), B(0xa04aff, { fog: false })); iris.position.z = 4.2 + k * 1.3; g.add(iris); const pup = new THREE.Mesh(new THREE.CircleGeometry(2.4 + k * 0.5, 20), B(0x05000c, { fog: false })); pup.position.z = 4.3 + k * 1.3; g.add(pup);
        g.position.set(x, y, z); g.lookAt(0, 0, -60); add(g); this.bobs.push({ m: g, y0: y, a: 2, sp: 0.3 + k * 0.1 }); });
      return EMPTY;
    }
    if (theme === 'ovni') { // estrellas, planeta con anillos, platillos lejanos y antenas
      const sg = new THREE.BufferGeometry(), sp = []; for (let k = 0; k < 900; k++) { const a = rnd() * 6.28, b = rnd() * 1.2, r = 380; sp.push(Math.cos(a) * Math.cos(b) * r, Math.sin(b) * r + 10, Math.sin(a) * Math.cos(b) * r); }
      sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xd8fff0, size: 1.6, sizeAttenuation: false, fog: false })));
      const pl = add(new THREE.Mesh(new THREE.SphereGeometry(40, 32, 20), M(0x3a8a7a, { emissive: 0x1a4a3a, emissiveIntensity: 0.6, fog: false }))); pl.position.set(140, 110, -330);
      const ring = add(new THREE.Mesh(new THREE.RingGeometry(52, 78, 48), B(0x8affd8, { transparent: true, opacity: 0.45, side: THREE.DoubleSide, fog: false }))); ring.position.copy(pl.position); ring.rotation.set(1.2, 0.3, 0);
      for (let k = 0; k < 9; k++) { const x = -180 + rnd() * 360, z = -240 + rnd() * 300; if (!clear(x, z, 8)) continue; const g = new THREE.Group();
        const d = new THREE.Mesh(new THREE.SphereGeometry(4, 20, 8), M(0xb8c0c8, { metalness: 0.8, roughness: 0.25 })); d.scale.y = 0.28; g.add(d);
        const dome = new THREE.Mesh(new THREE.SphereGeometry(1.8, 14, 8, 0, 6.3, 0, Math.PI / 2), M(0x6affc8, { transparent: true, opacity: 0.7, emissive: 0x2aaa7a, emissiveIntensity: 0.8 })); dome.position.y = 0.7; g.add(dome);
        for (let q = 0; q < 8; q++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 5), B(q % 2 ? 0xffd24a : 0x6affc8)); const a = q / 8 * 6.28; l.position.set(Math.cos(a) * 3.6, -0.2, Math.sin(a) * 3.6); g.add(l); }
        g.position.set(x, 15 + rnd() * 30, z); add(g); g.userData.axis = 'y'; g.userData.sp = 0.8 + rnd(); this.spinners.push(g); this.bobs.push({ m: g, y0: g.position.y, a: 3, sp: 0.3 + rnd() * 0.3 }); }
      for (const { x, z } of spots(8, 3, true)) { const h = 14 + rnd() * 10, tw = add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.2, h, 6), M(0x2a3a44, { metalness: 0.6 }))); tw.position.set(x, wy + h / 2 + (0 - wy) - 4, z);
        const tip = add(new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), B(0x6affc8))); tip.position.set(x, tw.position.y + h / 2 + 0.4, z);
        const dish = add(new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 8, 0, 6.3, 0, 1.1), M(0xd8e0e8, { metalness: 0.5, side: THREE.DoubleSide }))); dish.position.set(x, tw.position.y + h / 2 - 2, z); dish.rotation.x = Math.PI * 0.75; }
      return EMPTY;
    }
    if (theme === 'cloaca') return { islands: [], houses: [], trees: [], lighthouses: [], props: [], pines: [], bigTrees: [], mushrooms: [], snow: 0 };
    if (theme === 'ruinas') { // mesetas rojas a franjas y columnas rotas
      const cols = [0xc8603a, 0xe08a50, 0xa84a32, 0xf0b070];
      this._mesas = 0; this._cols = 0;
      for (let n = 0; n < 400 && this._mesas < 16; n++) {
        const x = -160 + rnd() * 320, z = -190 + rnd() * 250, R = 8 + rnd() * 12; if (!clear(x, z, R + 3)) continue;
        this._mesas = (this._mesas || 0) + 1; const H = 18 + rnd() * 26, base = this.def.water.y;
        for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(R * (1 - k * 0.06), R * (1.05 - k * 0.05), H / 4, 7, 1), new THREE.MeshStandardMaterial({ color: cols[k], roughness: 1, flatShading: true })); m.position.set(x, base + H / 8 + k * H / 4, z); m.rotation.y = rnd() * 3; m.castShadow = true; this.root.add(m); }
      }
      for (let n = 0; n < 120 && (this._cols || 0) < 16; n++) {
        const x = -130 + rnd() * 260, z = -150 + rnd() * 200; if (!clear(x, z, 2) || clear(x, z, 9)) continue;
        this._cols = (this._cols || 0) + 1; const i = this.near(new THREE.Vector3(x, 0, z)), c = this.c[i], h = 2 + rnd() * 5;
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, h, 10), new THREE.MeshStandardMaterial({ color: 0xf0e0c0, roughness: 0.8 })); col.position.set(x, c.y - 1 + h / 2, z); col.castShadow = true; this.root.add(col);
        const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, c.y + 1 - this.def.water.y, 8), new THREE.MeshStandardMaterial({ color: 0xa06a4a })); pil.position.set(x, (c.y - 1 + this.def.water.y) / 2, z); this.root.add(pil);
      }
      return { islands: [], houses: [], trees: [], lighthouses: [], props: [], pines: [], bigTrees: [], mushrooms: [], snow: 0 };
    }
    if (theme === 'bosque') { // árboles colosales que suben desde el fondo junto a la pista
      for (let n = 0; n < 160 && bigTrees.length < 9; n++) { const x = -120 + rnd() * 240, z = -150 + rnd() * 190; if (clear(x, z, 4) && !clear(x, z, 14)) bigTrees.push({ x, z, y: -30, r: 2.4 + rnd() * 1.4, h: 60 + rnd() * 20 }); }
    }
    return { islands: isl, houses, trees, lighthouses: lights, props, pines, bigTrees, mushrooms, snow: theme === 'glaciar' ? 500 : 0 };
  }
}

// ---------- un corredor ----------
class Racer {
  constructor(race, o) {
    Object.assign(this, { item: null, roll: 0, spin: 0, spinA: 0, uses: 0, shieldT: 0, inv: 0, lap: 0, best: 0, half: false, done: false, time: 0, v: 0, yaw: 0, slip: 0, drift: 0, charge: 0, boostT: 0, bump: 0, i: 0, place: 1, wob: 0, lane: 0 }, o);
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector2(); this.race = race;
    const C = race.ctx;
    this.root = new THREE.Group(); race.root.add(this.root);
    this.body = new THREE.Group(); this.root.add(this.body);
    const K = kartById(this.kartId); this.mods = this.mods || kartMods(K.stats);
    const made = makeKart(this.kartId, this.paint === undefined ? this.color : this.paint, this.color); let kart = made.kart; this.artKart = made.art;
    this.kart = kart; this.body.add(kart);
    // piloto: el héroe sentado en el kart
    const lib = C.charLib();
    if (lib) this.ch = seatDriver(this.body, lib, this.look, this.artKart);
    try { this.wheelRig = this.ch ? rigWheel(this.ch, this.body, this.kart.userData.wheel) : null; } catch (e) { this.wheelRig = null; }
    this.mats = []; this.body.traverse(m => { if (!m.isMesh || !m.material || m.material.transparent || !m.material.color) return; const mt = m.material = m.material.clone(); this.mats.push({ mt, c: mt.color.clone() }); });
    // sombra redonda bajo el kart
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(1.5, 20), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.28, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.scale.set(0.75, 1.15, 1); race.root.add(this.shadow);
    // fuego del turbo
    const fm = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    this.flames = [-0.3, 0.3].map(x => { const f = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.9, 10), fm); f.rotation.x = -Math.PI / 2; f.position.set(x, 0.42, -1.85); this.body.add(f); return f; });
    this.flameMat = fm; const T = TRAILS.find(t => t.id === this.trail) || TRAILS[0]; this.rainbow = T.color === 'rainbow'; if (!this.rainbow) fm.color.setHex(T.color);
    // chispas del derrape
    const sm = new THREE.MeshBasicMaterial({ color: 0x6ad0ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    this.sparks = [-0.85, 0.85].map(x => { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), sm); s.position.set(x, 0.2, -1.05); this.body.add(s); return s; });
    this.sparkMat = sm;
  }
  get progress() { const L = this.race.track.L; return this.lap * L + (this.lap < 0 && this.dist < L / 2 ? this.dist + L : this.dist); }
  remove() { this.race.root.remove(this.root); this.race.root.remove(this.shadow); }
}

export class Race {
  constructor(ctx) { this.ctx = ctx; this.active = false; this.racers = []; }

  start(opts) {
    const C = this.ctx, def = TRACKS[opts.track] || TRACKS.puerto;
    this.opts = opts; this.def = def; this.laps = opts.laps || 3; this.active = true; this.paused = false;
    this.root = new THREE.Group(); this.root.name = 'carrera';
    this.track = new Track(def, this.root);
    const dec = this.track.decor(13);
    C.loadRaceZone({
      id: 'carrera_' + opts.track, arena: true, race: true, title: def.name, subtitle: 'Carreras', seed: 5,
      sky: def.sky, light: def.light, palette: def.theme.palette, water: def.water, lava: def.lava, embers: def.embers,
      start: { id: 'salida', pos: [0, 0, 0], facing: 0 }, ...dec,
      airships: def.theme.decor === 'puerto' ? [{ id: 'dirigible', x: 20, y: 18, z: -150 }] : [],
    });
    C.scene.add(this.root);
    const sv = C.getSave() || {};
    const pieces = (sv.piezas || []).length;
    const mine = sv.hero || 'lia';
    // rivales: héroes y villanos (nunca el mismo piloto que llevas tú)
    const G0 = garageOf(sv), myDriver = G0.driver || 'hero';
    const pool = DRIVERS.filter(d => d.id !== 'hero' && d.id !== myDriver && !(myDriver === 'hero' && d.look === mine)).map(d => d.id).sort(() => Math.random() - 0.5);
    const level = LEVEL[sv.difficulty || 'normal'] || LEVEL.normal;
    const n = clamp(opts.rivals ?? 5, 1, 7);
    this.racers = [];
    this.net = opts.net || null; this.isHost = !!opts.isHost; this.ep = opts.ep || 0; this.netSeen = {};
    const G = garageOf(sv), P = PAINTS.find(p => p.id === G.paint) || PAINTS[0];
    const PT = { spark: partOf(sv, 'llantas').spark, sound: partOf(sv, 'motor').sound, flame: partOf(sv, 'turbo').flame };
    const me = new Racer(this, { id: 'me', name: sv.name || 'Tú', you: true, color: COLORS[0], paint: P.color, kartId: G.kart, trail: G.trail, mods: kartMods(kartPoints(sv)), look: driverLook(sv, myDriver), skill: 1, parts: PT });
    let grid = [];
    if (opts.online) { // carrera en línea: la parrilla la decide el anfitrión (jugadores por orden y luego la CPU)
      me.id = opts.myId;
      grid = opts.grid.map((g, k) => {
        if (g.id === opts.myId) return me;
        const R = new Racer(this, { id: g.id, name: String(g.n || 'Jugador').slice(0, 16), color: COLORS[(k + 1) % COLORS.length], kartId: g.k, paint: g.pa ?? null, trail: g.tr || 'fuego',
          look: driverLook({ hero: g.h || 'lia', custom: g.c || {} }, g.d || 'hero'), skill: level * (g.sk || 0.95), lane: g.ln || 0 });
        R.cpu = !!g.cpu; R.remote = !(R.cpu && this.isHost); R.human = !g.cpu;
        if (R.human) R.plate = this._plate(R);
        return R;
      });
    }
    const others = KARTS.filter(k => k.id !== G.kart && !k.secret); // cada rival en un kart distinto (y distinto del tuyo)
    if (!opts.online) for (let k = 0; k < n; k++) { const h = pool[k % pool.length], D = DRIVERS.find(d => d.id === h); grid.push(new Racer(this, { id: 'cpu' + k, name: D.name, color: COLORS[(k + 1) % COLORS.length], kartId: others[k % others.length].id, paint: null, trail: ['fuego', 'hielo', 'veneno', 'dorada'][k % 4], look: driverLook(sv, h), skill: level * (0.94 + 0.08 * (k / Math.max(1, n - 1))), lane: ((k % 3) - 1) * 0.45 })); }
    // la jugadora sale desde el medio de la parrilla
    if (!opts.online) grid.splice(Math.min(grid.length, Math.floor(n * 0.6)), 0, me);
    this.racers = grid; this.me = me;
    const T = this.track;
    grid.forEach((R, k) => {
      const row = Math.floor(k / 2), col = k % 2 ? 1 : -1;
      const i = (T.N - 6 - row * 13) % T.N, c = T.c[i], r = T.r[i], t = T.t[i];
      R.pos.set(c.x + r.x * col * 2.6, c.y, c.z + r.z * col * 2.6); R.yaw = Math.atan2(t.x, t.z); R.i = i; R.lap = -1; R.half = true; R.dist = T.d[i];
      // caja de salida pintada en la pista, con su número
      const box = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 3.6), new THREE.MeshBasicMaterial({ map: gridTex(k + 1), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }));
      box.rotation.set(-Math.PI / 2, 0, R.yaw + Math.PI); box.position.set(R.pos.x - Math.sin(R.yaw) * 0.2, c.y + 0.03, R.pos.z - Math.cos(R.yaw) * 0.2); box.userData.grid = true; this.root.add(box);
    });
    this.gridMid = T.c[(T.N - 6 - Math.floor((grid.length - 1) / 2) * 13) % T.N].clone();
    this.items = new RaceItems(this);
    if (T.tube) for (const o of this.root.children) if (o.userData.grid) T.bend(o);
    buildHazards(this, level);
    // prepara de antemano los materiales de la escena: si no, se compilan en plena presentación y la cámara da tirones
    try { if (this.ctx.renderer) this.ctx.renderer.compile(this.ctx.scene, this.ctx.camera); } catch (e) {}
    // salida: presentación de la parrilla, semáforo de cinco luces y ¡fuera! (en línea, la misma espera para todos)
    this.phase = 'count'; this.st = 0; this.t = 1; this.track.setLights(0);
    this.hold = 0.5 + ((opts.ep || Math.floor(Math.random() * 1e6)) % 700) / 1000; this._pairT = {}; this.clock = 0; this.results = []; this._lastCount = null; this._altSeen = false; this._skySeen = false; this._skyHint = false;
    this.camPos = null; this.lookBack = false;
    this._hud(true); this._engine(true); document.body.classList.remove('raceover');
    $('raceEndTitle').textContent = ''; $('raceEndSub').textContent = ''; $('raceEndList').innerHTML = ''; this.shown = false; this._errs = 0;
    document.body.classList.toggle('netrace', !!this.net); this._chatClose();
    if (this.net) { $('chatLog').innerHTML = ''; $('chatBtn').classList.remove('hidden'); $('chatBtn').textContent = this.ctx.input.isTouch ? '💬' : '💬 Chat (T)'; }
    C.music.play('arena', { fade: 1.2 });
    this.place(); this._sync(0.016);
  }

  // ---------- un paso ----------
  update(dt) {
    if (!this.active || (this.paused && !this.net)) return; // en línea la carrera sigue aunque abras la pausa
    const C = this.ctx;
    if (this.phase === 'count') {
      this.st += dt;
      // fuera de línea, acelerar o pulsar salta la presentación
      if (!this.net && this.st < INTRO - 0.8 && this.st > 0.6 && (C.input.pressed('jump') || C.input.pressed('attack') || C.input.pressed('interact') || C.input.keys.KeyW || C.input.keys.ArrowUp)) this.st = INTRO - 0.8;
      const L = this.st < INTRO ? 0 : Math.min(5, Math.floor((this.st - INTRO) / 0.75) + 1);
      if (L !== this._lastCount) { this._lastCount = L; this.track.setLights(L); this._hudLights(L); if (L > 0) C.audio.play('beep'); }
      if (this.st >= INTRO + 5 * 0.75 + this.hold) { // ¡se apagan las luces!
        this.phase = 'race'; this.track.setLights(0); this._hudLights(-1); this._flash('¡FUERA!', '#7affa0'); C.audio.play('go'); C.input.rumble(160, 0.6);
      }
    } else this.clock += dt;
    const go = this.phase === 'race' || this.phase === 'end';
    if (this.net) this._netTick(dt);
    for (const R of this.racers) {
      if (R.remote) { this._remoteTick(R, dt); continue; }
      const ctl = R.you && !R.done ? this._myControls() : this._cpu(R, dt);
      if (!go) { if (R.you) this._revs = this._myControls().throttle; ctl.throttle = 0; ctl.brake = 0; ctl.drift = false; ctl.steer = 0; ctl.use = false; R.v = 0; } // quietos en su caja hasta que se apaguen las luces
      if (R.you && ctl.use && this.phase === 'race') this.items.use(R, ctl.back);
      this._drive(R, ctl, dt);
    }
    this._dt = dt;
    const safe = (name, fn) => { try { fn(); } catch (e) { this._err(name, e); } };
    safe('vueltas', () => { for (const R of this.racers) if (!R.remote) this._laps(R); });
    // el final va primero: nada de lo que viene después puede impedir que aparezca
    if (this.me.done && this.phase !== 'end' && !this.shown) safe('meta', () => this._finish());
    if (this.phase === 'end' && (this.endT -= dt) <= 0 && !this.shown) safe('final', () => this._showEnd());
    if (this.phase === 'end' && this.endT < -1.5 && $('raceEnd').classList.contains('hidden')) { try { this._endList(); $('raceEndTitle').textContent = `${this.me.place}.º lugar`; } catch (e) {} $('raceEnd').classList.remove('hidden'); document.body.classList.add('raceover'); this.shown = true; }
    safe('objetos', () => {
      const T = this.track, kids = this.items.root.children;
      if (T.tube) for (const o of kids) if (o.userData.lp) { o.position.copy(o.userData.lp); o.quaternion.copy(o.userData.lq); }
      tickHazards(this, dt); this.items.update(dt, this.clock + this.t);
      if (T.tube) for (const o of kids) { const u = o.userData; (u.lp || (u.lp = new THREE.Vector3())).copy(o.position); (u.lq || (u.lq = new THREE.Quaternion())).copy(o.quaternion); u.hi = T.place(o, u.hi ?? -1); }
    });
    safe('choques', () => this._collide(dt));
    safe('puestos', () => this.place());
    safe('dibujo', () => this._sync(dt));
    safe('decorado', () => { const T = this.track, tt = this.clock + this.t; if (T.spinners) for (const g of T.spinners) g.rotation[g.userData.axis || 'z'] += dt * g.userData.sp; if (T.bobs) for (const b of T.bobs) b.m.position.y = b.y0 + Math.sin(tt * b.sp + b.y0) * b.a; });
    safe('cámara', () => this._camera(dt));
    safe('pantalla', () => this._hudTick(dt));
    safe('motor', () => this._engineTick(dt));
    if (this.shown && this.net && (this._listT = (this._listT || 0) - dt) <= 0) { this._listT = 0.5; this._endList(); } // en línea: la tabla se completa a medida que llegan
  }

  _myControls() {
    const I = this.ctx.input, k = I.keys, touch = I.isTouch && !I.usingGamepad;
    const steer = -clamp(I.move.x, -1, 1); // el giro positivo del kart va hacia la izquierda de la cámara
    const throttle = touch ? (this.tBrake ? 0 : 1) : ((k.KeyW || k.ArrowUp || I._padJump || I.move.y > 0.35) ? 1 : 0);
    const brake = (k.KeyS || k.ArrowDown || I._padDodge || this.tBrake || (!touch && I.move.y < -0.5)) ? 1 : 0;
    const drift = !!(k.Space || k.ShiftLeft || k.ShiftRight || I._padShield || this.tDrift);
    this.lookBack = !!(k.KeyC || k.KeyQ);
    const use = !!(this.tUseP || ((!touch || I.usingGamepad) && (I.pressed('interact') || I.pressed('grapple') || (I.pressed('attack') && (I.usingGamepad || k.KeyJ))))); this.tUseP = false;
    const back = !!(k.KeyS || k.ArrowDown || I._padDodge || this.tBrake || I.move.y < -0.5);
    return { steer, throttle, brake: use && back ? 0 : brake, drift, use, back };
  }
  // la CPU: mira un punto más adelante en su carril y gira hacia él
  _cpu(R, dt) {
    const T = this.track, N = T.N;
    if (R.done) { // ya terminó: vuelta de honor tranquila
      R.skillNow = 0.55;
    } else {
      // goma elástica suave: quien va muy atrás de la jugadora acelera un poco, quien va muy adelante afloja
      const gap = (this.me.progress - R.progress) / T.L;
      R.skillNow = R.skill * clamp(1 + gap * 0.22, 0.9, 1.1);
    }
    R.laneT = (R.laneT || 0) - dt;
    if (R.laneT <= 0) { R.laneT = 2 + Math.random() * 3; R.laneW = clamp((R.lane || 0) + (Math.random() - 0.5) * 0.5, -0.6, 0.6); }
    R.laneNow = (R.laneNow ?? R.lane) + ((R.laneW ?? R.lane) - (R.laneNow ?? R.lane)) * damp(0.8, dt);
    const ahead = Math.round(9 + R.v * 0.45);
    const j = (R.i + ahead) % N, c = T.c[j], r = T.r[j];
    // en las curvas cerradas, va por dentro
    const bend = angD(Math.atan2(T.t[(j + 20) % N].x, T.t[(j + 20) % N].z), Math.atan2(T.t[j].x, T.t[j].z));
    const lane = clamp(R.laneNow + bend * 0.9, -0.7, 0.7) * T.hw;
    const tx = c.x + r.x * lane, tz = c.z + r.z * lane;
    const want = Math.atan2(tx - R.pos.x, tz - R.pos.z), e = angD(want, R.yaw);
    const sharp = Math.abs(bend) > 0.55 && R.v > MAXV * 0.8;
    return { steer: clamp(e * 2.6, -1, 1), throttle: sharp ? 0.6 : 1, brake: 0, drift: Math.abs(bend) > 0.35 && R.v > 16 && !R.done };
  }
  _drive(R, ctl, dt) {
    const T = this.track;
    if (R.spin > 0) { // le dieron: da vueltas y casi se para
      R.spin -= dt; R.spinA += dt * 14 * clamp(R.spin, 0.2, 1); ctl = { steer: 0, throttle: 0, brake: 0, drift: false };
      R.v -= R.v * damp(3, dt); R.drift = 0;
    } else R.spinA = 0;
    if (R.stunT > 0) { R.stunT -= dt; ctl = { steer: 0, throttle: 0, brake: 0, drift: false }; R.v -= R.v * damp(8, dt); R.drift = 0; }
    const M = R.mods; const top = MAXV * M.vel * (R.you && !R.done ? 1 : R.done ? 0.5 : R.skillNow || R.skill) * (R.boostT > 0 ? 1.42 : 1) * (R.bump > 0 ? 0.7 : 1);
    if (ctl.brake && R.v > 0.5) R.v -= BRAKE * dt;
    else if (ctl.brake) R.v = Math.max(-8, R.v - ACC * 0.6 * dt); // marcha atrás
    else if (ctl.throttle) R.v += (R.v < top ? ACC * M.acc * (R.boostT > 0 ? 1.8 : 1) * (1 - R.v / (top * 1.15)) * 1.6 : -ACC * 0.8) * dt * ctl.throttle;
    else R.v -= Math.sign(R.v) * Math.min(Math.abs(R.v), 6 * dt);
    if (R.v > top + 0.1) R.v -= (R.v - top) * damp(2.5, dt);
    // derrape: gira más, carga el turbo; al soltar, sale disparado
    const canDrift = ctl.drift && R.v > 11 && Math.abs(ctl.steer) > 0.2;
    if (canDrift && !R.drift) { R.drift = Math.sign(ctl.steer); R.charge = 0; if (R.you) this.ctx.audio.play('dodge'); }
    if (R.drift && (!ctl.drift || R.v < 8)) {
      if (R.charge > 0.9) { R.boostT = Math.max(R.boostT, (R.charge > 1.8 ? 1.25 : 0.75) * M.boost); R.v = Math.max(R.v, MAXV * 1.05); if (R.you) { this.ctx.audio.play('dash'); this.ctx.input.rumble(140, 0.5); } }
      R.drift = 0; R.charge = 0;
    }
    const grip = this.def.grip || 1; let turn = ctl.steer * TURN * M.giro * grip * clamp(Math.abs(R.v) / 9, 0, 1) * (R.v < 0 ? -1 : 1) * (1 - clamp(R.v / 60, 0, 0.3));
    if (R.drift) { turn = (R.drift * 0.65 + ctl.steer * 0.55) * TURN * M.giro * 1.25; R.charge += dt * (0.8 + Math.abs(ctl.steer) * 0.6) * M.charge * (this.def.slide ? 1.2 : 1); }
    R.yaw += turn * dt * (R.air ? 0.35 : 1);
    R.slip += ((R.drift ? R.drift * 0.38 : ctl.steer * 0.08 * (this.def.slide || 1) * clamp(R.v / MAXV, 0, 1)) - R.slip) * damp(6 / (this.def.slide || 1), dt);
    const dir = R.yaw - R.slip * 0.6;
    R.pos.x += Math.sin(dir) * R.v * dt; R.pos.z += Math.cos(dir) * R.v * dt;
    R.boostT -= dt; R.bump -= dt;
    // placas de impulso
    for (const B of T.boosts) {
      if (R.onSky || R.air) break;
      const dd = Math.abs(((T.d[R.i] - B.d + T.L * 1.5) % T.L) - T.L / 2);
      if (dd < 3.2 && Math.abs(R.lat - B.lat) < 2.1 && R.boostT < 0.9) { R.boostT = 1.1; R.v = Math.max(R.v, MAXV * 1.15); if (R.you) { this.ctx.audio.play('dash'); this.ctx.input.rumble(120, 0.4); } }
    }
    // pegado a la pista (o al atajo oculto si te metiste por el hueco de la barandilla)
    R.i = T.near(R.pos, R.i);
    let F = T.frame(R.pos, R.i); const lim = T.hw - 1.0, AL = T.alt;
    let gy = F.y, pitch = Math.atan2(T.t[R.i].y, Math.hypot(T.t[R.i].x, T.t[R.i].z));
    if (AL && !R.onAlt && Math.abs(F.lat) > lim - 0.4 && T.gap(R.i, Math.sign(F.lat))) {
      const k = AL.near(R.pos), AF = AL.frame(R.pos, k);
      if ((k < 16 || k > AL.M - 16) && Math.abs(AF.lat) < AL.hw + 1.5) { R.onAlt = true; R.ai = k; if (R.you && !this._altSeen) { this._altSeen = true; this._flash('¡Atajo secreto!'); } }
    }
    let onAlt = false;
    if (R.onAlt) {
      R.ai = AL.near(R.pos, R.ai); const AF = AL.frame(R.pos, R.ai), ends = R.ai < 6 || R.ai > AL.M - 6;
      if ((ends && Math.abs(F.lat) < lim) || (R.ai === 0 && AF.along < -0.5) || (R.ai === AL.M && AF.along > 0.5)) R.onAlt = false;
      else {
        onAlt = true; const al = AL.hw - 0.7;
        if (Math.abs(AF.lat) > al && !ends) {
          const sg = Math.sign(AF.lat), r = AL.r[R.ai], push = Math.abs(AF.lat) - al;
          R.pos.x -= r.x * sg * push; R.pos.z -= r.z * sg * push;
          const d = angD(R.yaw, Math.atan2(AL.t[R.ai].x, AL.t[R.ai].z)); if (Math.abs(d) > 0.12) R.yaw -= d * 0.35;
          if (R.v > 10 && (R.wallT || 0) <= 0) { R.v *= 0.8; R.wallT = 0.4; if (R.you) this.ctx.audio.play('block'); }
        }
        const idx = Math.min(T.N - 1, Math.round(AL.a + AL.u[R.ai] * (AL.b - AL.a)));
        R.i = idx; R.lat = 0; R.dist = T.d[idx]; gy = AL.c[R.ai].y; pitch = 0;
      }
    }
    if (!onAlt) {
      R.lat = F.lat; R.dist = F.dist;
      if (T.tube) { // dentro del tubo: al pasar por el techo se sigue por el otro lado
        if (Math.abs(F.lat) > T.hw) { const sh = -Math.sign(F.lat) * 2 * T.hw, r = T.r[R.i]; R.pos.x += r.x * sh; R.pos.z += r.z * sh; F.lat += sh; R.lat = F.lat; if (R.you && this.camPos) { this.camPos.x += r.x * sh; this.camPos.z += r.z * sh; } }
      } else if (Math.abs(F.lat) > lim && !(AL && T.gap(R.i, Math.sign(F.lat)))) { // choca con la barandilla: rebota hacia dentro
        const sg = Math.sign(F.lat), r = T.r[R.i], push = Math.abs(F.lat) - lim;
        R.pos.x -= r.x * sg * push; R.pos.z -= r.z * sg * push;
        const ty = Math.atan2(T.t[R.i].x, T.t[R.i].z), d = angD(R.yaw, ty);
        if (Math.abs(d) > 0.12) R.yaw -= d * 0.35;
        if (R.v > 10 && (R.wallT || 0) <= 0) { R.v *= 0.72; R.wallT = 0.4; if (R.you) { this.ctx.audio.play('block'); this.ctx.input.rumble(90, 0.4); } }
        R.lat = sg * lim;
      } else if (!T.tube && Math.abs(F.lat) > T.hw + 0.4) { R.pos.x -= T.r[R.i].x * Math.sign(F.lat) * (Math.abs(F.lat) - T.hw - 0.4); R.pos.z -= T.r[R.i].z * Math.sign(F.lat) * (Math.abs(F.lat) - T.hw - 0.4); }
      // rampa de nitro: solo con el nitro encendido se sube al carril colgante
      const S = T.sky;
      if (S && !R.onSky) {
        let dd = T.d[R.i] + F.along - T.d[S.r];
        if (R.you && !this._skyHint && dd > -45 && dd < -30 && !R.air) { this._skyHint = true; this._flash(R.item && /nitro/.test(R.item) ? '¡Usa el nitro antes de la rampa!' : 'Rampa de nitro más adelante'); }
        if (Math.abs(F.lat) < this.def.w * 0.46 && dd > -5 && dd < 3) {
          if (dd < 1.4) gy += 1.5 * (dd + 5) / 6.4;
          const pd = R.skyDD; R.skyDD = dd;
          if (pd != null && pd < 0.9 && dd >= 0.9 && !R.air && R.v > 6) { const nit = (R.nitroT || 0) > 0; R.air = true; R.vy = nit ? 17 : 5 + R.v * 0.1; R.y = gy; if (R.you) { this.ctx.audio.play(nit ? 'dash' : 'jump'); this.ctx.input.rumble(nit ? 160 : 80, nit ? 0.6 : 0.3); } }
        }
      }
      // rampas: la cuña levanta el kart y al final sale volando
      for (const ri of T.ramps) {
        let dd = T.d[R.i] + F.along - T.d[ri]; if (dd > T.L / 2) dd -= T.L; if (dd < -T.L / 2) dd += T.L;
        if (Math.abs(F.lat) < (T.tube ? 4.5 : this.def.w * 0.46) && dd > -3 && dd < 2.5) {
          if (dd < 1.2) gy += 0.9 * (dd + 3) / 4.2;
          const pd = R.rampDD && R.rampDD[ri]; (R.rampDD = R.rampDD || {})[ri] = dd;
          if (pd != null && pd < 0.6 && dd >= 0.6 && !R.air && R.v > 6) { R.air = true; R.vy = 4 + R.v * 0.16; R.y = gy; if (R.you) { this.ctx.audio.play('jump'); this.ctx.input.rumble(80, 0.3); } }
        }
      }
    }
    R.wallT = (R.wallT || 0) - dt; R.nitroT = (R.nitroT || 0) - dt;
    // en el carril colgante
    const S = T.sky, onSkyRange = S && !onAlt && R.i >= S.s0 && R.i <= S.s1 && Math.abs(F.lat) < S.hw + 0.3;
    if (R.onSky && !R.air) {
      if (!onSkyRange || R.i >= S.s1) { R.onSky = false; R.air = true; R.vy = 2; R.y = R.pos.y; } // se acaba: a volar
      else {
        gy = T.c[R.i].y + S.H; pitch = 0; R.boostT = Math.max(R.boostT, 0.25);
        const lim2 = S.hw - 0.6; if (Math.abs(F.lat) > lim2) { const sg = Math.sign(F.lat), r = T.r[R.i], push = Math.abs(F.lat) - lim2; R.pos.x -= r.x * sg * push; R.pos.z -= r.z * sg * push; const d = angD(R.yaw, Math.atan2(T.t[R.i].x, T.t[R.i].z)); if (Math.abs(d) > 0.12) R.yaw -= d * 0.35; }
      }
    }
    if (R.air) {
      const y0 = R.y; R.vy -= 20 * dt; R.y += R.vy * dt; R.pitch = clamp(-R.vy * 0.03, -0.3, 0.3);
      const sy = onSkyRange ? T.c[R.i].y + S.H : null;
      if (sy != null && R.vy < 0 && y0 >= sy - 0.4 && R.y <= sy) { R.air = false; R.onSky = true; R.pos.y = sy; R.pitch = 0; if (R.you) { this.ctx.audio.play('land'); this.ctx.input.rumble(130, 0.6); if (!this._skySeen) { this._skySeen = true; this._flash('¡Carril colgante!'); } } }
      else if (R.y <= gy) { R.air = false; R.pos.y = gy; R.pitch = pitch; if (R.you) { this.ctx.audio.play('land'); this.ctx.input.rumble(110, 0.5); } if (R.v > 10) R.boostT = Math.max(R.boostT, 0.35); }
      else R.pos.y = R.y;
    } else { R.pitch = pitch; R.pos.y = gy; }
  }
  _collide() {
    const L = this.racers;
    for (let a = 0; a < L.length; a++) for (let b = a + 1; b < L.length; b++) {
      const A = L[a], B = L[b], dx = B.pos.x - A.pos.x, dz = B.pos.z - A.pos.z, d = Math.hypot(dx, dz);
      if (d > 0 && d < 2.1 && Math.abs(A.pos.y - B.pos.y) < 1.5) {
        if (A.remote && B.remote) continue;
        const nx = dx / d, nz = dz / d, pa = A.remote ? 0 : B.remote ? (2.1 - d) : (2.1 - d) / 2, pb = B.remote ? 0 : A.remote ? (2.1 - d) : (2.1 - d) / 2;
        A.pos.x -= nx * pa; A.pos.z -= nz * pa; B.pos.x += nx * pb; B.pos.z += nz * pb;
        const key = A.id + B.id, now = this.clock;
        if (!this._pairT[key] || now - this._pairT[key] > 0.6) { // golpe: el de atrás pierde un poco, el de adelante recibe un empujón
          const back = (A.progress < B.progress) ? A : B, front = back === A ? B : A;
          back.v *= 0.9; front.v = Math.min(front.v + 1.5, MAXV * 1.1);
          if (A.you || B.you) { this.ctx.audio.play('land'); this.ctx.input.rumble(70, 0.3); }
        }
        this._pairT[key] = now;
      }
    }
  }
  // vueltas por puntos de control: para que una vuelta cuente hay que pasar por 1/4, 1/2 y 3/4 de la pista
  // (en orden) y cruzar la meta; no importa cómo se tome cada curva ni si un golpe te empuja en la línea
  _laps(R) {
    const L = this.track.L, f = R.dist / L;
    if (R.cp == null) R.cp = 3; // en la parrilla (detrás de la meta) ya puedes cruzarla
    const CP = [0.25, 0.5, 0.75];
    if (R.cp < 3 && f >= CP[R.cp] && f < CP[R.cp] + 0.2) R.cp++;
    if (R.prevF != null) {
      if (R.prevF > 0.8 && f < 0.2 && R.cp >= 3) { // cruzó la meta hacia delante
        R.cp = 0; R.lap++;
        if (R.lap >= 1 && this.phase !== 'count') { const lt = this.clock - (R.lapStart || 0); R.lapStart = this.clock; if (!R.best || lt < R.best) R.best = lt; }
        else R.lapStart = this.clock;
        if (R.lap >= this.laps && !R.done) {
          R.done = true; R.time = this.clock; this.results.push(R); R.finishOrder = this.results.length;
          if (R.you) this._finish();
        } else if (R.you && R.lap >= 1) {
          this._flash(R.lap === this.laps - 1 ? '¡ÚLTIMA VUELTA!' : `Vuelta ${R.lap + 1} / ${this.laps}`, '#ffffff');
          this.ctx.audio.play('checkpoint');
        }
      } else if (R.prevF < 0.2 && f > 0.8 && R.lap >= 0 && !R.done && R.cp === 0) { R.lap--; R.cp = 3; } // volvió hacia atrás por la meta
    }
    R.prevF = f;
  }
  place() {
    const order = [...this.racers].sort((a, b) => {
      if (a.done && b.done) return (a.finishOrder || 99) - (b.finishOrder || 99) || a.time - b.time; if (a.done) return -1; if (b.done) return 1;
      return b.progress - a.progress;
    });
    order.forEach((R, k) => { R.place = k + 1; });
    this.order = order;
  }
  _err(where, e) {
    this._errs = (this._errs || 0) + 1; if (this._errs <= 3) console.error('Carrera: fallo en ' + where, e);
    if (this._errs === 1 && this.ctx.onError) this.ctx.onError(where, e);
  }
  _finish() {
    const C = this.ctx;
    this.phase = 'end'; this.endT = 2.2; this._endCamT = 0; try { this._hudLights(-1); this.track.setLights(0); } catch (e) {}
    const p = this.me.place;
    this._flash(p === 1 ? '¡GANASTE!' : `¡Meta! Llegaste ${p}.º`, p === 1 ? '#ffd27a' : '#ffffff');
    C.audio.play(p <= 3 ? 'unlock' : 'checkpoint');
  }
  _showEnd() {
    const C = this.ctx; this.shown = true;
    // los que faltan llegan con el tiempo estimado
    if (!this.net) { this.place(); for (const R of this.order) if (!R.done) { R.done = true; R.time = Math.max(this.clock + 0.1, this.clock + (this.laps * this.track.L - R.progress) / Math.max(10, MAXV * (R.skill || 0.9))); this.results.push(R); R.finishOrder = this.results.length; } }
    this.place();
    const p = this.me.place, rew = (this.def.reward[p - 1] || 5) * (this.laps === 5 ? 2 : 1);
    // primero la pantalla final (pase lo que pase con el guardado, siempre se puede salir)
    $('raceEndTitle').innerHTML = p === 1 ? ICO.cup + '¡Primer lugar!' : p <= 3 ? ICO.medal + `¡Podio! ${p}.º lugar` : `${p}.º lugar`;
    $('raceEndSub').textContent = `${this.def.name} · ${this.laps} vueltas · +${rew} Ecos`;
    try { this._endList(); } catch (e) { console.warn('tabla final', e); }
    $('bRaceAgain').innerHTML = this.net ? ICO.globe + ' Volver a la sala' : ICO.rep + ' Repetir carrera';
    $('raceEnd').classList.remove('hidden'); $('racePause').classList.add('hidden'); document.body.classList.add('raceover');
    try {
      C.addEcos(rew);
      const sv = C.getSave();
      if (sv) {
        sv.race = sv.race || {}; const key = this.opts.track + '_' + this.laps;
        const prev = sv.race[key];
        if (!prev || this.me.time < prev.time) sv.race[key] = { time: this.me.time, place: p };
        const r = sv.race, t = this.opts.track;
        r.races = (r.races || 0) + 1;
        if (p <= 3) { r.podiums = (r.podiums || 0) + 1; (r.podiumAt = r.podiumAt || {})[t] = true; }
        if (p === 1) { r.wins = (r.wins || 0) + 1; (r.wonAt = r.wonAt || {})[t] = true; if (this.laps === 5) r.won5 = (r.won5 || 0) + 1; }
        this.newUnlocks = this.ctx.unlocksAfter ? this.ctx.unlocksAfter() : [];
        if (this.newUnlocks.length) { $('raceEndSub').innerHTML += `<div class="raceUnl">${ICO.unlock}¡Desbloqueaste ${this.newUnlocks.map(u => u.name).join(', ')}!</div>`; C.audio.play('unlock'); }
        C.save && C.save();
      }
    } catch (e) { console.warn('No se pudo guardar el resultado de la carrera', e); }
  }
  _endList() {
    const fmt = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;
    this.place();
    $('raceEndList').innerHTML = this.order.map(R => `<li class="${R.you ? 'me' : ''}"><b>${R.place}.º</b> <span>${R.human ? ICO.globe : ''}${R.name.replace(/[<>&]/g, '')}</span> <em>${R.done ? fmt(R.time) : R.gone ? 'se fue' : 'en carrera…'}</em></li>`).join('');
  }

  // ---------- en línea ----------
  // estado de un kart en una lista corta: posición, giro, velocidad, vuelta, distancia, banderas y tiempo
  _pack(R) {
    const f = (R.drift > 0 ? 1 : 0) | (R.drift < 0 ? 2 : 0) | (R.boostT > 0 ? 4 : 0) | (R.spin > 0 ? 8 : 0) | (R.shieldT > 0 ? 16 : 0) | (R.done ? 32 : 0);
    const r2 = v => Math.round(v * 100) / 100;
    return [r2(R.pos.x), r2(R.pos.y), r2(R.pos.z), r2(R.yaw), r2(R.v), R.lap, r2(R.dist), f, R.done ? r2(R.time) : 0];
  }
  _unpack(R, a) {
    if (!Array.isArray(a) || a.length < 9) return;
    R.net = { x: +a[0], y: +a[1], z: +a[2], yaw: +a[3] }; R.v = +a[4] || 0; R.lap = a[5] | 0; R.dist = +a[6] || 0;
    const f = a[7] | 0; R.drift = f & 1 ? 1 : f & 2 ? -1 : 0; R.boostT = f & 4 ? 0.3 : 0; R.spin = f & 8 ? 0.5 : 0; R.shieldT = f & 16 ? 1 : 0;
    if (f & 32 && !R.done) { R.done = true; R.time = +a[8] || this.clock; this.results.push(R); R.finishOrder = 50 + R.time; }
    R.seenT = this.clock;
  }
  _netTick(dt) {
    const N = this.net, sv = this.ctx.getSave() || {};
    const pres = { n: (sv.name || 'Jugador').slice(0, 16), s: 'race', ep: this.ep, r: this._pack(this.me) };
    if (this.isHost) pres.c = this.racers.filter(R => R.cpu).map(R => [R.id, ...this._pack(R)]);
    N.set(pres); N.tick(dt);
    const peers = N.others(), byId = new Map(peers.map(p => [p.id, p.pres || {}]));
    for (const R of this.racers) {
      if (!R.remote) continue;
      if (R.human) { const P = byId.get(R.id); if (P && P.s === 'race' && P.ep === this.ep) this._unpack(R, P.r); else if (!P && !R.gone && this.clock - (R.seenT || 0) > 4) this._gone(R); }
    }
    // la CPU la mueve el anfitrión
    const host = peers.find(p => p.pres && p.pres.ep === this.ep && Array.isArray(p.pres.c));
    if (host) for (const c of host.pres.c) { const R = this.racers.find(x => x.id === c[0] && x.cpu && x.remote); if (R) this._unpack(R, c.slice(1)); }
  }
  _gone(R) { R.gone = true; R.root.visible = false; R.shadow.visible = false; this._chatAdd('', '', `${R.name} se fue de la carrera`, true); }
  _remoteTick(R, dt) {
    if (R.gone) return;
    if (!R.net) return;
    const T = this.track, t = R.net, k = 1 - Math.exp(-12 * dt);
    if (Math.hypot(t.x - R.pos.x, t.z - R.pos.z) > 9) R.pos.set(t.x, t.y, t.z);
    else { R.pos.x += (t.x - R.pos.x) * k + Math.sin(R.yaw) * R.v * dt * 0.5; R.pos.z += (t.z - R.pos.z) * k + Math.cos(R.yaw) * R.v * dt * 0.5; R.pos.y += (t.y - R.pos.y) * k; }
    R.yaw += angD(t.yaw, R.yaw) * k;
    R.i = T.near(R.pos, R.i); R.pitch = Math.atan2(T.t[R.i].y, Math.hypot(T.t[R.i].x, T.t[R.i].z));
    R.slip += ((R.drift ? R.drift * 0.38 : 0) - R.slip) * damp(6, dt);
    R.charge = R.drift ? (R.charge || 0) + dt : 0;
    R.spinA = R.spin > 0 ? R.spinA + dt * 12 : 0;
  }
  // sucesos de la red: disparos, explosiones y golpes (quien dispara decide si acierta)
  onNet(from, ev) {
    if (!this.active || !ev || ev.ep !== this.ep) return;
    const owner = id => this.racers.find(R => R.id === id);
    if (ev.t === 'shot') this.items.remoteShot(ev, owner(ev.o));
    else if (ev.t === 'boom') this.items.remoteBoom(ev);
    else if (ev.t === 'hit') { const V = owner(ev.v); if (V && !V.remote) this.items.hit(V, owner(ev.o), true, ev.k || null); }
  }
  _plate(R) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const c = cv.getContext('2d');
    c.font = 'bold 30px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const w = Math.min(250, c.measureText(R.name).width + 30); c.fillStyle = 'rgba(10,16,40,.65)'; c.beginPath(); c.roundRect((256 - w) / 2, 8, w, 46, 23); c.fill();
    c.fillStyle = '#9fe3ff'; c.fillText(R.name, 128, 32);
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, depthTest: false, transparent: true })); sp.scale.set(2.2, 0.55, 1); sp.position.y = 2.4; sp.renderOrder = 10;
    R.root.add(sp); return sp;
  }
  // ---------- chat (el mismo cuadro que la Arena y el mundo) ----------
  _chatAdd(name, color, text, sys = false) {
    const box = $('chatLog'); if (!box) return; const el = document.createElement('div');
    if (sys) { el.className = 'sys'; el.textContent = text; } else { const b = document.createElement('b'); b.textContent = name + ':'; b.style.color = color; el.append(b, document.createTextNode(String(text).replace(BADW, w => '*'.repeat(w.length)))); }
    box.appendChild(el); while (box.children.length > 30) box.firstChild.remove(); setTimeout(() => el.classList.add('old'), 9000);
  }
  sendChat(text) {
    if (!this.net) return; const now = performance.now(); if (now - (this._chatT || 0) < 900) return;
    const m = this.net.chat(String(text).replace(BADW, w => '*'.repeat(w.length))); if (m) { this._chatT = now; this._chatAdd(this.me.name, '#ffd27a', m); }
  }
  _chatOpen() {
    if (!this.net) return; $('chatBox').classList.add('open'); this.chatOpenNow = true; this.ctx.input.keys = {};
    const inp = $('chatInput'); inp.value = ''; setTimeout(() => inp.focus(), 10);
    const q = $('chatQuick'); q.innerHTML = ''; for (const t of ['¡Suerte! 🍀', '¡Allá voy! 🏎', '¡GG!', '¡Revancha!', '😂', '🔥']) { const b = document.createElement('button'); b.textContent = t; b.onclick = () => { this.sendChat(t); this._chatClose(); }; q.appendChild(b); }
  }
  _chatClose() { const box = $('chatBox'); if (box) box.classList.remove('open'); this.chatOpenNow = false; const inp = $('chatInput'); if (inp) inp.blur(); }

  // ---------- dibujo ----------
  _sync(dt) {
    const T = this.track;
    for (const R of this.racers) {
      R.root.position.copy(R.pos);
      R.root.rotation.set(0, R.yaw, 0);
      if (T.tube) { const m = T.tmap(R.pos, R.i, R.root.position); R.ti = m.i; R.th = m.th; R.root.quaternion.premultiply(T.tquat(m.i, m.th, T._q)); }
      R.body.rotation.set(-R.pitch, 0, 0); R.body.position.y = R.spin > 0 ? Math.abs(Math.sin(R.spin * 5)) * 0.5 : 0;
      this._fxLook(R, dt);
      const cp = this.ctx.camera.position, near = !T.tube && !R.you && Math.hypot(cp.x - R.pos.x, cp.z - R.pos.z) < 4.2 && cp.y > R.pos.y; // no tapar la cámara con el kart que viene pegado detrás
      R.root.visible = !near && !(R.inv > 0 && R.spin <= 0 && Math.sin(this.clock * 30) > 0.3);
      R.wob += dt * (8 + R.v * 0.6);
      R.kart.rotation.set(Math.sin(R.wob) * 0.008 * clamp(R.v / 10, 0, 1), R.slip * 0.9 + R.spinA, -R.slip * 0.25 - (R.drift ? R.drift * 0.08 : 0));
      if (R.kart.userData.wheels) for (const w of R.kart.userData.wheels) { w.children[0].rotation.x += R.v * dt / 0.34; if (w.userData.front) w.rotation.y = (R.steerVis || 0) * 0.4; }
      R.steerVis = (R.steerVis || 0) + ((R.drift ? R.drift : clamp(R.yawRate || 0, -1, 1)) - (R.steerVis || 0)) * damp(10, dt);
      R.yawRate = angD(R.yaw, R.prevYaw ?? R.yaw) / Math.max(dt, 1e-3) / TURN; R.prevYaw = R.yaw;
      if (R.kart.userData.wheel) R.kart.userData.wheel.rotation.z = -(R.steerVis || 0) * 0.8;
      if (R.ch) { // el piloto se inclina en las curvas
        R.ch.root.rotation.set(0, Math.PI + R.slip * 0.4 + R.spinA, -(R.steerVis || 0) * 0.18);
        const b = R.ch.bones; if (b.head) b.head.rotation.y = -(R.steerVis || 0) * 0.25;
        if (R.wheelRig && R.root.visible && (R.you || Math.hypot(cp.x - R.pos.x, cp.z - R.pos.z) < 70)) { R.ch.root.updateMatrixWorld(true); R.wheelRig.update(clamp(R.steerVis || 0, -1, 1)); }
      }
      R.shadow.position.set(R.pos.x, R.pos.y + 0.05, R.pos.z); R.shadow.rotation.z = -R.yaw; R.shadow.visible = !T.tube;
      if (R.rainbow) R.flameMat.color.setHSL((this.clock * 1.5) % 1, 1, 0.6);
      const fl = R.boostT > 0 ? 0.9 : 0; R.flameMat.opacity += (fl - R.flameMat.opacity) * damp(12, dt);
      const fs = (R.parts && R.parts.flame) || 1; for (const f of R.flames) f.scale.set(fs * 0.9 + 0.1, (0.7 + Math.random() * 0.6 + fl) * fs, fs * 0.9 + 0.1);
      const lv = R.charge > 1.8 ? 2 : R.charge > 0.9 ? 1 : 0;
      R.sparkMat.color.setHex(lv === 2 ? 0xff8a30 : lv === 1 ? ((R.parts && R.parts.spark) || 0x6ad0ff) : 0xffffff);
      R.sparkMat.opacity = R.drift ? (lv ? 0.95 : 0.45) * (0.6 + Math.random() * 0.4) : 0;
      for (const s of R.sparks) { s.scale.setScalar(0.6 + Math.random() * (lv + 0.5) * 0.6); s.rotation.set(Math.random() * 6, Math.random() * 6, 0); }
    }
    for (const B of T.boosts) B.mat.map.offset.y -= dt * 2.2;
    // la heroína (invisible) sigue al kart: así la sombra y el sonido van con la cámara
    const P = this.ctx.player; P.pos.copy(this.me.pos);
  }
  _fxLook(R, dt) {
    const fx = R.fxT > 0 ? R.fx : null; if (R.fxT > 0) R.fxT -= dt;
    const k = fx ? clamp(R.fxT / 0.5, 0, 1) : 0; // se va pasando en el último medio segundo
    if (fx || R._fxOn) {
      for (const { mt, c } of R.mats) {
        if (fx === 'quema') mt.color.copy(c).multiplyScalar(1 - 0.96 * k);
        else if (fx === 'congela') mt.color.copy(c).lerp(this._ice || (this._ice = new THREE.Color(0xa8e8ff)), 0.75 * k);
        else mt.color.copy(c);
      }
      R._fxOn = !!fx;
    }
    // aplastado: plano como una galleta y vuelve de golpe
    const sq = fx === 'aplasta' ? clamp(R.fxT / 0.2, 0, 1) : 0; R.body.scale.set(1 + 0.4 * sq, 1 - 0.72 * sq, 1 + 0.25 * sq);
    // congelado: bloque de hielo alrededor
    if (fx === 'congela' && !R.iceBlock) { const m = R.iceBlock = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.3, 3.2), new THREE.MeshStandardMaterial({ color: 0xbff0ff, transparent: true, opacity: 0.45, roughness: 0.05, metalness: 0.1, emissive: 0x3a8aaa, emissiveIntensity: 0.4 })); m.position.y = 1.0; R.body.add(m); }
    if (R.iceBlock) { R.iceBlock.visible = fx === 'congela'; if (R.iceBlock.visible) R.iceBlock.scale.setScalar(0.85 + 0.15 * k); }
    // quemado: humo negro saliendo
    if (fx === 'quema' && (R._smk = (R._smk || 0) - dt) <= 0) { R._smk = 0.07; this.items._smoke(R.pos.clone().setY(R.pos.y + 1 + Math.random() * 0.6), 0x2a2a2a); }
  }
  _camSet(p, tgt, R) {
    const cam = this.ctx.camera, T = this.track;
    if (!T.tube) { cam.position.copy(p); cam.lookAt(tgt); return; }
    const hi = R.ti ?? R.i; T.tmap(p, hi, cam.position); const tg = T.tmap(tgt, hi, this._tv || (this._tv = new THREE.Vector3()));
    const n = T.tnorm(R.ti ?? R.i, R.th || 0, this._tn || (this._tn = new THREE.Vector3()));
    this._camUp = (this._camUp || n.clone()).lerp(n, 0.25).normalize(); cam.up.copy(this._camUp); cam.lookAt(this._tv);
  }
  _camera(dt) {
    const C = this.ctx, cam = C.camera, R = this.me;
    const back = this.lookBack ? -1 : 1, dist = 7.2 + clamp(R.v / MAXV, 0, 1.4) * 1.6, h = 3.3;
    const yaw = R.yaw - R.slip * 0.5;
    const want = new THREE.Vector3(R.pos.x - Math.sin(yaw) * dist * back, R.pos.y + h, R.pos.z - Math.cos(yaw) * dist * back);
    const look = new THREE.Vector3(R.pos.x + Math.sin(yaw) * 4 * back, R.pos.y + 1.1, R.pos.z + Math.cos(yaw) * 4 * back);
    if (this.phase === 'count' && this.st < INTRO + 0.6) {
      // presentación: cámara de frente a la parrilla que barre de un lado a otro, y luego se pasa detrás de tu kart
      const T = this.track, N = T.N, rows = Math.ceil(this.racers.length / 2), u = clamp(this.st / (INTRO - 1), 0, 1), ue = u * u * (3 - 2 * u);
      // la cámara recorre la parrilla de adelante hacia atrás, mirando a los karts de frente
      const iA = N - 6 + 12, iB = N - 6 - (rows - 1) * 13 + 2, fi = iA + (iB - iA) * ue, lf = Math.max(fi - 11, N - 6 - (rows - 1) * 13 - 2);
      const at = (arr, f) => { const a = Math.floor(f), w = f - a, A = arr[((a % N) + N) % N], B2 = arr[(((a + 1) % N) + N) % N]; return A.clone().lerp(B2, w); };
      const c = at(T.c, fi), r = at(T.r, fi), sw = Math.sin(u * Math.PI * 1.5) * 0.55;
      const front = new THREE.Vector3(c.x + r.x * T.hw * sw, c.y + 2.0 + Math.sin(u * Math.PI) * 0.8, c.z + r.z * T.hw * sw);
      const mid = at(T.c, lf); mid.y += 0.7;
      const k = clamp((this.st - (INTRO - 1.2)) / 1.6, 0, 1), e = k * k * (3 - 2 * k);
      const fp = front.lerp(want, e); this._camSet(fp, mid.lerp(look, e), R);
      this.camPos = fp.clone();
    } else if (this.phase === 'end') {
      // al llegar: cámara de frente que acompaña a tu kart por la pista mientras se ven los resultados
      const T = this.track, t = T.t[R.i], r = T.r[R.i], side = Math.sin(this.clock * 0.35) * 2.2;
      const front = new THREE.Vector3(R.pos.x + t.x * 7.5 + r.x * side, R.pos.y + 2.0, R.pos.z + t.z * 7.5 + r.z * side);
      if (!this.camPos) this.camPos = front.clone();
      this._endCamT = (this._endCamT || 0) + dt; this.camPos.lerp(front, this._endCamT > 1.5 ? 1 : damp(2.5, dt));
      this._camSet(this.camPos, new THREE.Vector3(R.pos.x, R.pos.y + 0.9, R.pos.z), R);
      if (this.shown) { const w = innerWidth, h = innerHeight; cam.setViewOffset(w, h, -w * 0.24, 0, w, h); this._offset = true; } // el kart a la derecha, los resultados a la izquierda
    } else {
      if (!this.camPos) this.camPos = want.clone();
      this.camPos.lerp(want, damp(this.lookBack ? 30 : 7, dt));
      this._camSet(this.camPos, look, R);
    }
    const fov = 64 + clamp(R.v / MAXV, 0, 1.4) * 10 + (R.boostT > 0 ? 6 : 0);
    cam.fov += (fov - cam.fov) * damp(4, dt); cam.updateProjectionMatrix();
    this.fov = cam.fov;
  }

  // ---------- interfaz ----------
  _hud(on) {
    document.body.classList.toggle('racing', on);
    $('raceHud').classList.toggle('hidden', !on);
    $('raceEnd').classList.add('hidden'); $('racePause').classList.add('hidden');
    if (on && !this._wired) {
      this._wired = true;
      const hold = (id, key) => {
        const el = $(id);
        el.addEventListener('touchstart', e => { e.preventDefault(); this[key] = true; el.classList.add('on'); }, { passive: false });
        const up = e => { e.preventDefault(); this[key] = false; el.classList.remove('on'); };
        el.addEventListener('touchend', up, { passive: false }); el.addEventListener('touchcancel', up, { passive: false });
        el.addEventListener('mousedown', () => { this[key] = true; }); addEventListener('mouseup', () => { this[key] = false; });
      };
      hold('rtDrift', 'tDrift'); hold('rtBrake', 'tBrake');
      const u = $('rtUse'); const fire = e => { e.preventDefault(); this.tUseP = true; u.classList.add('on'); setTimeout(() => u.classList.remove('on'), 120); };
      u.addEventListener('touchstart', fire, { passive: false }); u.addEventListener('mousedown', fire);
    }
    this.tDrift = this.tBrake = false; if (this.ctx.input.resetTouch) this.ctx.input.resetTouch();
    const tip = this.ctx.input.isTouch ? 'Acelera solo · palanca: girar · DERRAPE en curvas · toca el objeto para usarlo (con FRENO, hacia atrás)' : 'W/↑ acelerar · S/↓ frenar · A/D girar · Espacio: derrape · E/J: usar objeto (con S, hacia atrás) · C: mirar atrás';
    $('raceTip').textContent = ''; $('raceTip').classList.add('hidden'); void tip; this._itemKey = null;
  }
  _hudTick() {
    const R = this.me, n = this.racers.length;
    const fmt = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
    $('racePlace').innerHTML = `${R.place}<small>.º/${n}</small>`;
    $('raceLap').textContent = `Vuelta ${clamp(R.lap + 1, 1, this.laps)}/${this.laps}`;
    $('raceTime').textContent = fmt(this.clock);
    const kmh = Math.round(Math.abs(R.v) * 4.2);
    $('raceSpeed').innerHTML = `${kmh}<small> km/h</small>`;
    const lv = R.drift ? (R.charge > 1.8 ? 2 : R.charge > 0.9 ? 1 : 0) : -1;
    $('raceTurbo').className = lv < 0 ? '' : 'lv' + lv;
    { const tt = lv === 2 ? '🔥 SUPER TURBO' : lv === 1 ? '⚡ TURBO' : lv === 0 ? 'derrapando…' : ''; if (tt !== this._turboTxt) { this._turboTxt = tt; $('raceTurbo').textContent = tt; } }
    // mini clasificación
    $('raceBoard').innerHTML = this.order.slice(0, 8).map(o => `<div class="${o.you ? 'me' : ''}"><b>${o.place}</b> <i style="background:#${o.color.toString(16).padStart(6, '0')}"></i>${o.name.replace(/[<>&]/g, '').slice(0, 12)}</div>`).join('');
    if (this.phase === 'race' && this.clock > 7) $('raceTip').classList.add('fade');
    const el = $('raceItem'), id = R.roll > 0 ? Object.keys(ITEMS)[Math.floor(this.clock * 14) % 6] : R.item;
    const txt = id ? ITEMS[id].icon : '', key = (R.roll > 0 ? 'r' : '') + txt + (R.uses || 0);
    if (key !== this._itemKey) { this._itemKey = key; el.innerHTML = id ? `<span>${R.item === 'nitro3' && R.roll <= 0 ? '🔥'.repeat(R.uses) : txt}</span><small>${R.roll > 0 ? '…' : ITEMS[id].name}</small>` : '<span class="q">?</span>'; el.classList.toggle('full', !!id && R.roll <= 0); }
  }
  _hudLights(n) {
    const el = $('raceLights'); if (!el) return;
    el.classList.toggle('hidden', n < 0 || (n === 0 && this.st < INTRO - 0.2));
    [...el.children].forEach((d, k) => d.classList.toggle('on', k < n));
  }
  _flash(text, color) { const el = $('raceMsg'); el.textContent = text; el.style.color = color; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }

  // ---------- motor (sonido continuo) ----------
  _engine(on) {
    const A = this.ctx.audio, c = A.ctx;
    if (this.eng) { try { this.eng.o1.stop(); this.eng.o2.stop(); this.eng.g.disconnect(); } catch (e) {} this.eng = null; }
    if (!on || !c) return;
    const o1 = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o1.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 700; g.gain.value = 0;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(c.destination); o1.start(); o2.start();
    this.eng = { o1, o2, f, g };
  }
  _engineTick() {
    if (!this.eng) return; const A = this.ctx.audio, c = A.ctx, R = this.me, k = clamp(Math.abs(R.v) / MAXV, 0, 1.5);
    const rev = this.phase === 'count' ? (this._revs ? 0.55 + Math.random() * 0.15 : 0.08) : k;
    const f = (48 + rev * 95 + (R.boostT > 0 ? 25 : 0)) * ((R.parts && R.parts.sound) || 1);
    this.eng.o1.frequency.setTargetAtTime(f, c.currentTime, 0.05); this.eng.o2.frequency.setTargetAtTime(f * 0.5, c.currentTime, 0.05);
    this.eng.f.frequency.setTargetAtTime(500 + rev * 1400, c.currentTime, 0.08);
    const vol = this.paused ? 0 : (0.022 + rev * 0.03) * (A.volume ?? 0.7);
    this.eng.g.gain.setTargetAtTime(vol, c.currentTime, 0.08);
  }

  togglePause() {
    if (!this.active || this.phase === 'end' && this.shown) return;
    this.paused = !this.paused; $('racePause').classList.toggle('hidden', !this.paused); $('bRaceRestart').classList.toggle('hidden', !!this.net); this._engineTick();
  }
  again() { const o = this.opts; this.exit(true); this.start(o); }
  exit(keep) {
    const C = this.ctx;
    this.active = false; this._engine(false);
    for (const R of this.racers) R.remove();
    this.racers = [];
    if (this.root) { C.scene.remove(this.root); this.root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); this.root = null; }
    if (this._offset) { C.camera.clearViewOffset(); this._offset = false; }
    C.camera.up.set(0, 1, 0); this._camUp = null;
    if (!keep) this._hud(false); this._hudLights(-1); document.body.classList.remove('raceover');
    document.body.classList.remove('netrace'); this._chatClose();
    if (this.net) $('chatBtn').classList.add('hidden');
    this.net = null;
  }
}
