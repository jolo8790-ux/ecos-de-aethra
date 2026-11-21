// Logros: se guardan para todo el juego (no por ranura). El modo Automático no los desbloquea.
const KEY = 'aethra_logros_v1';
// tier: trofeo (grandes metas), medalla (hazañas), insignia (primeros pasos). goal/key: barra de progreso.

export const LOGROS = [
  { id: 'primer_fragmento', tier: 'insignia', icon: '◆', title: 'Primer eco', desc: 'Encuentra tu primer fragmento.' },
  { id: 'zona_completa', tier: 'medalla', icon: '◈', title: 'Ojo atento', desc: 'Encuentra todos los fragmentos de una zona.' },
  { id: 'todos_fragmentos', tier: 'trofeo', icon: '✷', title: 'Coleccionista de Aethra', desc: 'Encuentra todos los fragmentos del juego.' },
  { id: 'primera_reliquia', tier: 'insignia', icon: '✦', title: 'Tesoro escondido', desc: 'Rompe un objeto y descubre una Reliquia de Aethra.' },
  { id: 'todas_reliquias', tier: 'trofeo', icon: '♛', title: 'Arqueóloga', desc: 'Reúne todas las Reliquias de Aethra.' },
  { id: 'jefe_intacto', tier: 'medalla', icon: '❖', title: 'Intocable', desc: 'Vence a un guardián sin recibir daño.' },
  { id: 'cinco_guardianes', tier: 'trofeo', icon: '⚔', title: 'Guardiana de Aethra', desc: 'Vence a los cinco guardianes de la historia.', key: 'guardianes', goal: 5 },
  { id: 'eco_secreto', tier: 'trofeo', icon: '☾', title: 'El Eco Olvidado', desc: 'Vence al jefe secreto del capítulo extra.' },
  { id: 'un_final', tier: 'medalla', icon: '☀', title: 'Fin del viaje', desc: 'Llega a un final de la historia.' },
  { id: 'dos_finales', tier: 'trofeo', icon: '☯', title: 'Los dos caminos', desc: 'Mira los dos finales.' },
  { id: 'leyenda', tier: 'trofeo', icon: '♜', title: 'Leyenda viva', desc: 'Termina la historia en dificultad Leyenda.' },
  { id: 'ave', tier: 'medalla', icon: '➶', title: 'Ave de Aethra', desc: 'Planea 12 segundos seguidos sin tocar el suelo.' },
  { id: 'cazavispas', tier: 'medalla', icon: '✕', title: 'Cazavispas', desc: 'Derrota 10 avispas de cristal.', key: 'avispas', goal: 10 },
  { id: 'oro', tier: 'medalla', icon: '★', title: 'Medalla de oro', desc: 'Consigue el oro en un desafío.' },
  { id: 'todo_oro', tier: 'trofeo', icon: '✪', title: 'Cielo dorado', desc: 'Consigue el oro en todos los desafíos.' },
  { id: 'forja', tier: 'trofeo', icon: '♨', title: 'Corazón de fuego', desc: 'Consigue el Corazón de la Forja en Las Forjas de Ignis.' },
  { id: 'mareth', tier: 'trofeo', icon: '◎', title: 'Corazón del mar', desc: 'Consigue la Perla de Mareth en las profundidades.' },
  { id: 'pulmones', tier: 'medalla', icon: '○', title: 'Pulmones de acero', desc: 'Recoge 15 burbujas de aire.', key: 'burbujas', goal: 15 },
  { id: 'pies_ligeros', tier: 'medalla', icon: '⚡', title: 'Pies ligeros', desc: 'Pisa 25 rocas que se desploman.', key: 'rocas', goal: 25 },
  { id: 'cazaecos', tier: 'medalla', icon: '✧', title: 'Cazaecos', desc: 'Recoge 60 ecos flotantes en los Senderos.', key: 'orbes', goal: 60 },
  { id: 'sin_rasguno', tier: 'medalla', icon: '❖', title: 'Sin un rasguño', desc: 'Termina un Sendero sin perder ningún corazón.' },
  { id: 'estilo', tier: 'insignia', icon: '✎', title: 'Estilo propio', desc: 'Cambia el aspecto de tu personaje.' },
];

// Los logros viven dentro de cada partida (save.logros). Las partidas de versiones anteriores
// heredan una vez los logros que antes eran comunes a todo el juego.
export function loadLogros() { // logros antiguos, comunes
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.got) return d; } catch (e) {}
  return { got: {}, n: {} };
}
export function storeOf(sv) {
  if (!sv) return { got: {}, n: {} };
  if (!sv.logros) { const old = loadLogros(); sv.logros = { got: { ...old.got }, n: { ...old.n } }; }
  return sv.logros;
}
// Devuelve el logro si se acaba de conseguir (para avisar); null si ya lo tenía o no cuenta.
export function unlock(sv, id, blocked = false) {
  if (blocked || !sv) return null;
  const d = storeOf(sv); if (d.got[id]) return null;
  const L = LOGROS.find(x => x.id === id); if (!L) return null;
  d.got[id] = Date.now(); return L;
}
// Contadores (avispas vencidas, rocas pisadas...). Devuelve el valor nuevo.
export function bump(sv, key, by = 1) { const d = storeOf(sv); d.n[key] = (d.n[key] || 0) + by; return d.n[key]; }
export function addTo(sv, key, val) { const d = storeOf(sv); const st = new Set(d.n[key] || []); st.add(val); d.n[key] = [...st]; return st.size; }
