// Logros: se guardan para todo el juego (no por ranura). El modo Automático no los desbloquea.
const KEY = 'aethra_logros_v1';

export const LOGROS = [
  { id: 'primer_fragmento', icon: '◆', title: 'Primer eco', desc: 'Encuentra tu primer fragmento.' },
  { id: 'zona_completa', icon: '◈', title: 'Ojo atento', desc: 'Encuentra todos los fragmentos de una zona.' },
  { id: 'todos_fragmentos', icon: '✷', title: 'Coleccionista de Aethra', desc: 'Encuentra todos los fragmentos del juego.' },
  { id: 'primera_reliquia', icon: '✦', title: 'Tesoro escondido', desc: 'Rompe un objeto y descubre una Reliquia de Aethra.' },
  { id: 'todas_reliquias', icon: '♛', title: 'Arqueóloga', desc: 'Reúne todas las Reliquias de Aethra.' },
  { id: 'jefe_intacto', icon: '❖', title: 'Intocable', desc: 'Vence a un guardián sin recibir daño.' },
  { id: 'cinco_guardianes', icon: '⚔', title: 'Guardiana de Aethra', desc: 'Vence a los cinco guardianes de la historia.' },
  { id: 'eco_secreto', icon: '☾', title: 'El Eco Olvidado', desc: 'Vence al jefe secreto del capítulo extra.' },
  { id: 'un_final', icon: '☀', title: 'Fin del viaje', desc: 'Llega a un final de la historia.' },
  { id: 'dos_finales', icon: '☯', title: 'Los dos caminos', desc: 'Mira los dos finales.' },
  { id: 'leyenda', icon: '♜', title: 'Leyenda viva', desc: 'Termina la historia en dificultad Leyenda.' },
  { id: 'ave', icon: '➶', title: 'Ave de Aethra', desc: 'Planea 12 segundos seguidos sin tocar el suelo.' },
  { id: 'cazavispas', icon: '✕', title: 'Cazavispas', desc: 'Derrota 10 avispas de cristal.' },
  { id: 'oro', icon: '★', title: 'Medalla de oro', desc: 'Consigue el oro en un desafío.' },
  { id: 'todo_oro', icon: '✪', title: 'Cielo dorado', desc: 'Consigue el oro en los cinco desafíos.' },
  { id: 'estilo', icon: '✎', title: 'Estilo propio', desc: 'Cambia el aspecto de tu personaje.' },
];

export function loadLogros() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.got) return d; } catch (e) {}
  return { got: {}, n: {} };
}
function store(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }

// Devuelve el logro si se acaba de conseguir (para avisar); null si ya lo tenía o no cuenta.
export function unlock(id, blocked = false) {
  if (blocked) return null;
  const d = loadLogros(); if (d.got[id]) return null;
  const L = LOGROS.find(x => x.id === id); if (!L) return null;
  d.got[id] = Date.now(); store(d); return L;
}
// Contadores (avispas vencidas, guardianes...). Devuelve el valor nuevo.
export function bump(key, by = 1) { const d = loadLogros(); d.n[key] = (d.n[key] || 0) + by; store(d); return d.n[key]; }
export function addTo(key, val) { const d = loadLogros(); const s = new Set(d.n[key] || []); s.add(val); d.n[key] = [...s]; store(d); return s.size; }
