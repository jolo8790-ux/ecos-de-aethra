// Guardado en el navegador + código de exportación para llevar la partida a otro dispositivo.
const KEY = 'aethra_save_v1', SETTINGS_KEY = 'aethra_settings_v1', PREFIX = 'AETHRA1:';

export const DEFAULT_SETTINGS = { sens: 1, invert: false, volume: 0.7, music: 0.6, difficulty: 'normal', custom: null, debug: false };

export function newSave() {
  return { v: 1, zone: 'puerto_bruma', checkpoint: 'inicio', fragments: [], relics: [], flags: {}, playTime: 0 };
}

// Tres ranuras de partida (para que juegue más de una persona en el mismo dispositivo).
// La ranura 1 usa la clave de siempre, así las partidas anteriores siguen ahí.
export const SLOTS = 3;
const slotKey = n => n === 1 ? KEY : `${KEY}_${n}`;
let slot = 1;
try { slot = Math.min(SLOTS, Math.max(1, parseInt(localStorage.getItem('aethra_slot') || '1', 10) || 1)); } catch (e) {}
export const getSlot = () => slot;
export function setSlot(n) { slot = n; try { localStorage.setItem('aethra_slot', String(n)); } catch (e) {} }
export function peekSave(n) {
  try { const s = JSON.parse(localStorage.getItem(slotKey(n))); return s && s.v === 1 ? s : null; } catch (e) { return null; }
}
export function loadSave() { return peekSave(slot); }
export function writeSave(s) {
  try { localStorage.setItem(slotKey(slot), JSON.stringify(s)); return true; } catch (e) { return false; }
}
export function deleteSave(n) { try { localStorage.removeItem(slotKey(n)); } catch (e) {} }
export function loadSettings() {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch (e) { return { ...DEFAULT_SETTINGS }; }
}
export function writeSettings(s) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) {} }

export function exportCode(s) {
  const json = JSON.stringify(s);
  return PREFIX + btoa(unescape(encodeURIComponent(json)));
}
export function importCode(code) {
  code = (code || '').trim();
  if (!code.startsWith(PREFIX)) throw new Error('El código no es de Ecos de Aethra.');
  let s;
  try { s = JSON.parse(decodeURIComponent(escape(atob(code.slice(PREFIX.length))))); } catch (e) { throw new Error('El código está incompleto o dañado.'); }
  if (!s || s.v !== 1 || typeof s.zone !== 'string' || !Array.isArray(s.fragments)) throw new Error('El código no tiene una partida válida.');
  return s;
}
