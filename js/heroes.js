// Héroes que se pueden llevar en la partida. Cada uno tiene su aspecto y una ventaja propia.
// Los tres últimos se desbloquean reuniendo Piezas especiales.
import { LOOKS, customLook } from './characters.js';

export const HEROES = [
  { id: 'lia', name: 'Tu heroína', perk: 'Equilibrada', desc: 'Tu personaje con el aspecto que elegiste. Sin puntos débiles.', color: 0x2fa36a, mods: {} },
  { id: 'kael', name: 'Kael', perk: 'Veloz', desc: 'Corre un 15 % más rápido y esquiva más lejos.', color: 0x7a4ad0, mods: { speed: 1.15, dodge: 1.25 } },
  { id: 'marta', name: 'Marta', perk: 'Capitana del viento', desc: 'Planea un 35 % más y su pulso de luz llega más lejos.', color: 0x3a6ad8, mods: { glide: 1.35, pulseR: 1.4 } },
  { id: 'tomas', name: 'Tomás', perk: 'Brazo fuerte', desc: 'Sus golpes de bastón hacen 1 punto más de daño.', color: 0xd8a83a, mods: { dmg: 1 } },
  { id: 'nerea', name: 'Nerea', perk: 'Buzo de Mareth', desc: 'Aguanta un 60 % más sin aire y nada más rápido.', color: 0x16a39a, mods: { air: 1.6, swim: 1.3 }, need: 3 },
  { id: 'brasa', name: 'Brasa', perk: 'Herrera de Ignis', desc: 'Dos corazones más y el fuego le hace menos daño.', color: 0xd8481e, mods: { hp: 2, fire: 0.5 }, need: 6 },
  { id: 'ilan', name: 'Ilan', perk: 'Eco del abuelo', desc: 'Salta más alto, corre algo más y planea mejor.', color: 0x8ac8e8, mods: { jump: 1.12, speed: 1.08, glide: 1.2 }, need: 10 },
];
export const heroById = id => HEROES.find(h => h.id === id) || HEROES[0];
export const heroUnlocked = (h, piezas) => !h.need || piezas >= h.need;

// aspecto del héroe: la protagonista usa la personalización de la partida
export function heroLook(id, custom) {
  if (!id || id === 'lia') return customLook(custom || {});
  const base = LOOKS[id] || LOOKS.lia;
  return { ...base, glider: undefined };
}
