// Iconos propios de Ecos de Aethra: trazo redondeado de 24×24 con un relleno suave («d»), siempre del color del texto.
// Sustituyen a los emojis del sistema (que cambian según el móvil) en todo el juego: un observador cambia
// cualquier emoji conocido que aparezca en la página por su icono, así que el resto del código puede seguir
// escribiendo textos normales.

const P = {
  fuego: '<path class="d" d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.6 2-5.2.8 1.5 1.7 2.2 2.6 2.2.3-2.4-.6-4.7-1.6-7z"/><path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.6 2-5.2.8 1.5 1.7 2.2 2.6 2.2.3-2.4-.6-4.7-1.6-7z"/><path d="M12 20.5a2.3 2.3 0 0 1-2.3-2.3c0-1.5 1.3-2.3 2.3-3.7 1 1.4 2.3 2.2 2.3 3.7a2.3 2.3 0 0 1-2.3 2.3z"/>',
  candado: '<rect class="d" x="5" y="11" width="14" height="10" rx="2.5"/><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/><path d="M12 15v2.5"/>',
  mundo: '<circle class="d" cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18"/>',
  engranaje: '<path class="d" d="M12 2.8l1.6 2.3 2.7-.6.6 2.7 2.3 1.6-1.2 2.5 1.2 2.5-2.3 1.6-.6 2.7-2.7-.6L12 21.2l-1.6-2.3-2.7.6-.6-2.7-2.3-1.6 1.2-2.5-1.2-2.5 2.3-1.6.6-2.7 2.7.6z"/><path d="M12 2.8l1.6 2.3 2.7-.6.6 2.7 2.3 1.6-1.2 2.5 1.2 2.5-2.3 1.6-.6 2.7-2.7-.6L12 21.2l-1.6-2.3-2.7.6-.6-2.7-2.3-1.6 1.2-2.5-1.2-2.5 2.3-1.6.6-2.7 2.7.6z"/><circle cx="12" cy="12" r="3"/>',
  portal: '<circle class="d" cx="12" cy="12" r="9"/><path d="M13 12a1 1 0 1 0-1 1 2.6 2.6 0 0 0 2.6-2.6A4.2 4.2 0 0 0 10.4 6.2 5.8 5.8 0 0 0 4.6 12a7.4 7.4 0 0 0 7.4 7.4 8.4 8.4 0 0 0 8.4-8.4"/>',
  chat: '<path class="d" d="M4 5h16v11H10l-5 4v-4H4z"/><path d="M4 5h16v11H10l-5 4v-4H4z"/><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" stroke-width="3"/>',
  espadas: '<path d="M4 4l10.5 10.5M20 4 9.5 14.5"/><path d="M7.5 12.5l4 4M12.5 16.5l4-4"/><path d="M5 19l3.2-3.2M19 19l-3.2-3.2"/><path class="d" d="M4 4h3l7.5 7.5-3 3L4 7z"/>',
  hielo: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5M4.4 11l3.3 1-1 3.4M19.6 13l-3.3-1 1-3.4"/>',
  reloj: '<circle class="d" cx="12" cy="13.5" r="7.5"/><circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M9.5 2.5h5M12 2.5V6M18.2 6.8l1.5-1.5"/>',
  risa: '<circle class="d" cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="9"/><path d="M7.8 10q1.2-1.8 2.4 0M13.8 10q1.2-1.8 2.4 0"/><path d="M7.5 13.5h9a4.5 4.5 0 0 1-9 0z"/>',
  rayo: '<path class="d" d="M13 2 4.5 13.5h6.5l-1 8.5 8.5-11.5H12z"/><path d="M13 2 4.5 13.5h6.5l-1 8.5 8.5-11.5H12z"/>',
  corona: '<path class="d" d="M3.5 8l4.2 4L12 5l4.3 7 4.2-4-1.8 11H5.3z"/><path d="M3.5 8l4.2 4L12 5l4.3 7 4.2-4-1.8 11H5.3z"/><path d="M5.3 19h13.4"/>',
  meta: '<path d="M5 21.5V3.5"/><path d="M5 4h14v10H5"/><path fill="currentColor" stroke="none" d="M5 4h3.5v3.3H5zM12 4h3.5v3.3H12zM8.5 7.3H12v3.4H8.5zM15.5 7.3H19v3.4h-3.5zM5 10.7h3.5V14H5zM12 10.7h3.5V14H12z"/>',
  saludo: '<path class="d" d="M8 13V6a1.5 1.5 0 0 1 3 0v5V4.5a1.5 1.5 0 0 1 3 0V11V6.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7c-2.5 0-4-1.2-5.4-3.4L2.8 14.6a1.5 1.5 0 0 1 2.6-1.5L8 16z"/><path d="M8 13V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7c-2.5 0-4-1.2-5.4-3.4L2.8 14.6a1.5 1.5 0 0 1 2.6-1.5L8 16"/><path d="M19.5 3.5l1.5-1M20.5 7h1.8"/>',
  sol: '<circle class="d" cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
  ancla: '<circle cx="12" cy="5" r="2"/><path d="M12 7v14M8 11h8"/><path d="M4.5 14a7.5 7.5 0 0 0 15 0"/><path d="M3 15.5l1.5-1.5 1.5 1.5M18 15.5l1.5-1.5 1.5 1.5"/>',
  arbol: '<path class="d" d="M12 3a5 5 0 0 1 4.8 3.6A4 4 0 0 1 17 14.5H7a4 4 0 0 1 .2-7.9A5 5 0 0 1 12 3z"/><path d="M12 3a5 5 0 0 1 4.8 3.6A4 4 0 0 1 17 14.5H7a4 4 0 0 1 .2-7.9A5 5 0 0 1 12 3z"/><path d="M12 14.5V21M9 21h6M12 17.5l-2.5-2"/>',
  kart: '<path class="d" d="M3 15.5l2-5h7.5l3 3h4.5l1 2v2H3z"/><path d="M3 15.5l2-5h7.5l3 3h4.5l1 2v2H3z"/><circle cx="10" cy="7.5" r="2.2"/><circle cx="7" cy="18.5" r="2"/><circle cx="17" cy="18.5" r="2"/>',
  bomba: '<circle class="d" cx="10.5" cy="14" r="7"/><circle cx="10.5" cy="14" r="7"/><path d="M15.5 9l2-2M17.5 7c.8-1.2 2.2-1.4 3-.4"/><path d="M20.5 2.5v1.5M22 4.2h-1.5M7.5 12a3 3 0 0 1 2.5-2"/>',
  cohete: '<path class="d" d="M12 2.5c3 2 5 6 5 10l-1.8 3.5H8.8L7 12.5c0-4 2-8 5-10z"/><path d="M12 2.5c3 2 5 6 5 10l-1.8 3.5H8.8L7 12.5c0-4 2-8 5-10z"/><circle cx="12" cy="9.5" r="1.8"/><path d="M7 12.5l-2.8 3V19L8 16.5M17 12.5l2.8 3V19L16 16.5M10.2 19l1.8 3 1.8-3"/>',
  diana: '<circle class="d" cx="11" cy="13" r="8"/><circle cx="11" cy="13" r="8"/><circle cx="11" cy="13" r="4.2"/><path d="M11 13l8.5-8.5M16.5 4.5h3v3"/>',
  burbuja: '<circle class="d" cx="11" cy="13" r="8"/><circle cx="11" cy="13" r="8"/><path d="M7.5 11a4.2 4.2 0 0 1 3-3"/><circle cx="19" cy="5" r="2"/>',
  llave: '<path class="d" d="M14.5 3.5a4.5 4.5 0 0 0-5.6 5.6L3.5 14.5a2.1 2.1 0 0 0 3 3l5.4-5.4a4.5 4.5 0 0 0 5.6-5.6l-2.8 2.8-2.4-.6-.6-2.4z"/><path d="M14.5 3.5a4.5 4.5 0 0 0-5.6 5.6L3.5 14.5a2.1 2.1 0 0 0 3 3l5.4-5.4a4.5 4.5 0 0 0 5.6-5.6l-2.8 2.8-2.4-.6-.6-2.4z"/>',
  forja: '<path class="d" d="M3.5 9.5 9 4l2.5 2.5L6 12z"/><path d="M3.5 9.5 9 4l2.5 2.5L6 12z"/><path d="M8.7 9.2 19 19.5a1.5 1.5 0 0 1-2.1 2.1L6.6 11.3"/><path d="M14 4.5c3 0 5.5 2.5 5.5 5.5M17 7l-5 5"/>',
  rueda: '<circle class="d" cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/>',
  cara: '<circle class="d" cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="9"/><path d="M9 10h.01M15 10h.01" stroke-width="3"/><path d="M8.5 14.5a4 4 0 0 0 7 0"/>',
  escudo: '<path class="d" d="M12 3l8 3v6c0 5-3.5 8-8 9.5C7.5 20 4 17 4 12V6z"/><path d="M12 3l8 3v6c0 5-3.5 8-8 9.5C7.5 20 4 17 4 12V6z"/><path d="M12 8v8M8.5 11.5h7"/>',
  peto: '<path class="d" d="M12 3l8 3v6c0 5-3.5 8-8 9.5C7.5 20 4 17 4 12V6z"/><path d="M12 3l8 3v6c0 5-3.5 8-8 9.5C7.5 20 4 17 4 12V6z"/><path d="M12 7v11"/>',
  pluma: '<path class="d" d="M20 3.5c-7 0-12 5-13 12.5h6c4 0 7-5 7-12.5z"/><path d="M20 3.5c-7 0-12 5-13 12.5h6c4 0 7-5 7-12.5z"/><path d="M15 9 4 20.5M10.5 13h4M13.5 9.5h4"/>',
  espada: '<path class="d" d="M18 3h3v3L9.5 17.5l-3-3z"/><path d="M18 3h3v3L9.5 17.5l-3-3z"/><path d="M5 14l5 5M7.5 16.5 4 20M14 7l3 3"/>',
  caja: '<rect class="d" x="3.5" y="3.5" width="17" height="17" rx="4"/><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.7 2.2c-.8.5-1.2 1-1.2 1.9v.6"/><path d="M12 17h.01" stroke-width="3"/>',
  equilibrio: '<circle class="d" cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="9"/><path d="M12 3a4.5 4.5 0 0 1 0 9 4.5 4.5 0 0 0 0 9"/><path d="M12 7.5h.01M12 16.5h.01" stroke-width="3"/>',
  ave: '<path class="d" d="M2.5 12.5c3.5-2 6.5-1 9 1.5 2-4 5-6.5 10-7.5-1 6-5 10-11 10-2.2 0-4.5-1.5-8-4z"/><path d="M2.5 12.5c3.5-2 6.5-1 9 1.5 2-4 5-6.5 10-7.5-1 6-5 10-11 10-2.2 0-4.5-1.5-8-4z"/><path d="M11.5 14l-2 4"/>',
  calor: '<path class="d" d="M4 12.5h16a8 8 0 0 1-16 0z"/><path d="M4 12.5h16a8 8 0 0 1-16 0z"/><path d="M8 3.5c-1.5 1.5 1.5 3 0 4.5M12 2.5c-1.5 1.5 1.5 3 0 4.5M16 3.5c-1.5 1.5 1.5 3 0 4.5"/>',
  ocaso: '<path class="d" d="M2 19l6-8 4 5 3-3 7 6z"/><path d="M2 19l6-8 4 5 3-3 7 6z"/><path d="M8.5 8.5a3.5 3.5 0 0 1 7 0M12 2.5v1.5M6.5 5l1 1M17.5 5l-1 1M2 21.5h20"/>',
  trebol: '<path class="d" d="M12 11a3.3 3.3 0 1 1 0-6.6 3.3 3.3 0 1 1 0 6.6zM11 12a3.3 3.3 0 1 1-6.6 0 3.3 3.3 0 1 1 6.6 0zM13 12a3.3 3.3 0 1 1 6.6 0 3.3 3.3 0 1 1-6.6 0zM12 13a3.3 3.3 0 1 1 0 6.6 3.3 3.3 0 1 1 0-6.6z"/><circle cx="12" cy="7.7" r="3.3"/><circle cx="7.7" cy="12" r="3.3"/><circle cx="16.3" cy="12" r="3.3"/><circle cx="12" cy="16.3" r="3.3"/><path d="M13.5 17.5l3.5 4"/>',
  viento: '<path d="M3 8.5h11a3 3 0 1 0-3-3M3 12.5h15a3 3 0 1 1-3 3M3 16.5h6"/>',
  vasija: '<path class="d" d="M10 3c0 2-3 3-3 7.5s2 6.5 2 8.5h6c0-2 2-4 2-8.5S14 5 14 3z"/><path d="M9 3h6M10 3c0 2-3 3-3 7.5s2 6.5 2 8.5h6c0-2 2-4 2-8.5S14 5 14 3M8 21h8M7.5 10h9"/>',
  puno: '<path class="d" d="M7 11V8.5a1.5 1.5 0 0 1 3 0V7.5a1.5 1.5 0 0 1 3 0v1a1.5 1.5 0 0 1 3 0v1.5a1.5 1.5 0 0 1 3 0v3a7 7 0 0 1-7 7h-1a5 5 0 0 1-5-5v-2a2 2 0 0 1 2-2z"/><path d="M7 11V8.5a1.5 1.5 0 0 1 3 0v1M10 9.5v-2a1.5 1.5 0 0 1 3 0v2M13 9.5v-1a1.5 1.5 0 0 1 3 0v1.5M16 10a1.5 1.5 0 0 1 3 0v3a7 7 0 0 1-7 7h-1a5 5 0 0 1-5-5v-2a2 2 0 0 1 2-2h3.5a1.5 1.5 0 0 1 0 3H11"/>',
  mano: '<path class="d" d="M7 13V7a1.5 1.5 0 0 1 3 0V4.5a1.5 1.5 0 0 1 3 0v1a1.5 1.5 0 0 1 3 0v3a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7c-2.6 0-4.3-1.2-5.6-3.4L4 13.5a1.5 1.5 0 0 1 2.6-1.5L8 14z"/><path d="M7 13V7a1.5 1.5 0 0 1 3 0v4M10 11V4.5a1.5 1.5 0 0 1 3 0V11M13 11V5.5a1.5 1.5 0 0 1 3 0V12M16 12V8.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7c-2.6 0-4.3-1.2-5.6-3.4L4 13.5a1.5 1.5 0 0 1 2.6-1.5L8 14"/>',
  ojo: '<path class="d" d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  arco: '<path d="M6 3.5a17 17 0 0 1 14.5 14.5"/><path d="M6 3.5l14.5 14.5" stroke-width="1.3"/><path d="M3 21 15 9M15 9h-3.5M15 9v3.5M3 21l2.5-.5M3 21l.5-2.5"/>',
  baston: '<path d="M4.5 20.5 15 10M13 8l3 3"/><path class="d" d="M18 2l.9 2.1L21 5l-2.1.9L18 8l-.9-2.1L15 5l2.1-.9z"/><path d="M18 2l.9 2.1L21 5l-2.1.9L18 8l-.9-2.1L15 5l2.1-.9z"/>',
  tunica: '<path class="d" d="M8 3l-5 3 2 4.5 3-1.2V21h8V9.3l3 1.2 2-4.5-5-3a4 4 0 0 1-8 0z"/><path d="M8 3l-5 3 2 4.5 3-1.2V21h8V9.3l3 1.2 2-4.5-5-3a4 4 0 0 1-8 0z"/>',
  concha: '<path class="d" d="M12 20.5 3.5 10a9 9 0 0 1 17 0z"/><path d="M12 20.5 3.5 10a9 9 0 0 1 17 0z"/><path d="M12 20.5V5.5M12 20.5 8 6.5M12 20.5l4-14M12 20.5 5 8M12 20.5l7-12.5"/>',
  volcan: '<path class="d" d="M2 21l6-10.5h8L22 21z"/><path d="M2 21l6-10.5h8L22 21z"/><path d="M8 10.5l2-3h4l2 3M11 5c0-1.2 1-2.5 2.2-2.5M14.5 5.5c1-1 2.2-1 3 0M9 15l2-1.5 2 2 2-1"/>',
  arena: '<path d="M6 2.5h12M6 21.5h12"/><path class="d" d="M7 2.5c0 5 10 5 10 9.5s-10 4.5-10 9.5h10c0-5-10-5-10-9.5S17 7.5 17 2.5z"/><path d="M7 2.5c0 5 10 5 10 9.5s-10 4.5-10 9.5M17 2.5c0 5-10 5-10 9.5s10 4.5 10 9.5"/>',
  nube: '<path class="d" d="M7 18.5h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.5A3.4 3.4 0 0 0 7 18.5z"/><path d="M7 18.5h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.5A3.4 3.4 0 0 0 7 18.5z"/>',
  trofeo: '<path class="d" d="M7 3h10v5a5 5 0 0 1-10 0z"/><path d="M7 3h10v5a5 5 0 0 1-10 0z"/><path d="M7 5H4a3 3 0 0 0 3 4.5M17 5h3a3 3 0 0 1-3 4.5M12 13v4M8 21h8l-1-4H9z"/>',
  corazon: '<path class="d" d="M12 20s-8-5-8-10.8A4.4 4.4 0 0 1 12 6.8a4.4 4.4 0 0 1 8 2.4C20 15 12 20 12 20z"/><path d="M12 20s-8-5-8-10.8A4.4 4.4 0 0 1 12 6.8a4.4 4.4 0 0 1 8 2.4C20 15 12 20 12 20z"/>',
  regla: '<path class="d" d="M3 17 17 3l4 4L7 21z"/><path d="M3 17 17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
  robot: '<rect class="d" x="4.5" y="8" width="15" height="11.5" rx="3"/><rect x="4.5" y="8" width="15" height="11.5" rx="3"/><path d="M12 8V4.5M2.5 13v2.5M21.5 13v2.5M9.5 16.2h5"/><circle cx="12" cy="3.5" r="1"/><path d="M9 12.3h.01M15 12.3h.01" stroke-width="3.2"/>',
  paleta: '<path class="d" d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 0 0 4-4c0-4.5-4-8-9-8z"/><path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 0 0 4-4c0-4.5-4-8-9-8z"/><path d="M7.5 11h.01M9.5 7h.01M14.5 7h.01M17 10.5h.01" stroke-width="3"/>',
  piloto: '<path class="d" d="M5 12a7 7 0 0 1 14 0v3H5z"/><path d="M5 12a7 7 0 0 1 14 0v3H5z"/><path d="M8.5 12h7M4 21a8 8 0 0 1 16 0"/>',
  villano: '<circle class="d" cx="12" cy="13.5" r="7.5"/><circle cx="12" cy="13.5" r="7.5"/><path d="M5.5 7 4 3l4 2.5M18.5 7 20 3l-4 2.5M8.5 12l2 1M15.5 12l-2 1M9 16.5q3 2 6 0"/>',
  ok: '<path d="M4.5 12.5l5 5L20 6.5"/>',
  carrito: '<path class="d" d="M6 6h15l-2 8H7.5z"/><path d="M2.5 3.5H5L7.5 14H19l2-8H6"/><path d="M7.5 14 6.8 17H19"/><circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/>',
  carpa: '<path class="d" d="M3 20 12 4l9 16z"/><path d="M3 20 12 4l9 16zM12 4v16M7.5 12.5 12 20l4.5-7.5M12 4V2l2.5 1L12 4"/>',
  fantasma: '<path class="d" d="M5 21V11a7 7 0 0 1 14 0v10l-2.3-1.8L14.3 21 12 19.2 9.7 21l-2.4-1.8z"/><path d="M5 21V11a7 7 0 0 1 14 0v10l-2.3-1.8L14.3 21 12 19.2 9.7 21l-2.4-1.8z"/><path d="M9.5 11h.01M14.5 11h.01" stroke-width="3"/>',
  ovni: '<path class="d" d="M2.5 13.5c0-1.7 4.3-3 9.5-3s9.5 1.3 9.5 3-4.3 3-9.5 3-9.5-1.3-9.5-3z"/><path d="M2.5 13.5c0-1.7 4.3-3 9.5-3s9.5 1.3 9.5 3-4.3 3-9.5 3-9.5-1.3-9.5-3z"/><path d="M7.5 10.8a4.5 4.5 0 0 1 9 0M8 16.3 6 21M16 16.3l2 4.7M12 16.5V21"/>',
  cristal: '<path class="d" d="M7 3h10l4 6-9 12L3 9z"/><path d="M7 3h10l4 6-9 12L3 9z"/><path d="M3 9h18M9.5 3 8 9l4 12 4-12-1.5-6"/>',
  farol: '<path class="d" d="M7 7.5h10a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z"/><path d="M7 7.5h10a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM9 7.5V5h6v2.5M12 2.5V5M9 17.5V20h6v-2.5M12 20v1.5M6 12.5h12"/>',
  medalla: '<path class="d" d="M8 2h3l2 6.5h-3zM16 2h-3l-2 6.5h3z"/><path d="M8 2h3l2 6.5M16 2h-3l-2 6.5"/><circle class="d" cx="12" cy="15" r="6"/><circle cx="12" cy="15" r="6"/>',
};
// medallas de color (oro, plata, bronce)
const MED = (fill, n) => `<path d="M8 2h3l2 6.5h-3zM16 2h-3l-2 6.5h3z" fill="#7ad7ff" stroke="#3a8ac0" stroke-width="1.4"/><circle cx="12" cy="15" r="6.2" fill="${fill}" stroke="rgba(0,0,0,.35)" stroke-width="1.4"/><text x="12" y="18.3" text-anchor="middle" font-size="9" font-weight="800" fill="rgba(0,0,0,.55)" stroke="none" font-family="system-ui,sans-serif">${n}</text>`;
// arena de destrucción
P.metralla = '<path class="d" d="M3 9h13v4H9l-1.5 5h-3L6 13H3z"/><path d="M3 9h13v4H9l-1.5 5h-3L6 13H3z"/><path d="M16 10h5M16 12h5M7 9V6.5h4V9"/>';
P.mina = '<ellipse class="d" cx="12" cy="15" rx="8" ry="4"/><ellipse cx="12" cy="15" rx="8" ry="4"/><path d="M12 11V8M8 11.5 6.5 9M16 11.5 17.5 9"/><circle cx="12" cy="6.5" r="1.5"/>';
P.boom = '<path class="d" d="M12 2.5l2 5 5-2-2 5 4.5 2-4.5 2 2 5-5-2-2 5-2-5-5 2 2-5-4.5-2 4.5-2-2-5 5 2z"/><path d="M12 2.5l2 5 5-2-2 5 4.5 2-4.5 2 2 5-5-2-2 5-2-5-5 2 2-5-4.5-2 4.5-2-2-5 5 2z"/>';
P.camion = '<path class="d" d="M2.5 15V9h9v-3h5l3.5 4.5V15z"/><path d="M2.5 15V9h9v-3h5l3.5 4.5V15z"/><path d="M11.5 9h8.5M14 6v3"/><circle cx="7" cy="17" r="3"/><circle cx="17" cy="17" r="3"/>';
P.oro = MED('#ffd24a', 1); P.plata = MED('#d8e0ea', 2); P.bronce = MED('#d08a4a', 3);

// emoji (o símbolo que el sistema pinta como emoji) → icono
export const EMOJI_ICON = {
  '🧑‍✈️': 'piloto', '🧑‍✈': 'piloto',
  '🔥': 'fuego', '🔒': 'candado', '🌐': 'mundo', '⚙': 'engranaje', '🌀': 'portal', '💬': 'chat', '⚔': 'espadas', '❄': 'hielo',
  '⏱': 'reloj', '😂': 'risa', '⚡': 'rayo', '👑': 'corona', '🏁': 'meta', '👋': 'saludo', '☀': 'sol', '⚓': 'ancla', '🌳': 'arbol',
  '🏎': 'kart', '💣': 'bomba', '🚀': 'cohete', '🎯': 'diana', '🫧': 'burbuja', '🔧': 'llave', '⚒': 'forja', '🛞': 'rueda', '☺': 'cara',
  '⛨': 'escudo', '🛡': 'peto', '🪶': 'pluma', '🗡': 'espada', '❓': 'caja', '☯': 'equilibrio', '➶': 'ave', '♨': 'calor', '🌄': 'ocaso',
  '🍀': 'trebol', '💨': 'viento', '🌬': 'viento', '⚱': 'vasija', '✊': 'puno', '✋': 'mano', '👁': 'ojo', '🏹': 'arco', '🪄': 'baston',
  '👕': 'tunica', '🐚': 'concha', '🌋': 'volcan', '⏳': 'arena', '☁': 'nube', '🏆': 'trofeo', '🥇': 'oro', '🥈': 'plata', '🥉': 'bronce',
  '❤': 'corazon', '📏': 'regla', '🤖': 'robot', '🎨': 'paleta', '🧑': 'piloto', '😈': 'villano', '✔': 'ok', '🏅': 'medalla', '💎': 'cristal', '🏮': 'farol', '🎪': 'carpa', '🔫': 'metralla', '🧨': 'mina', '💥': 'boom', '🚚': 'camion', '🛒': 'carrito', '👻': 'fantasma', '🛸': 'ovni',
};

export const icon = (name, cls = '') => P[name] ? `<svg class="gi ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name]}</svg>` : '';

const keys = Object.keys(EMOJI_ICON).sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const RX = new RegExp(`(${keys.join('|')})\\uFE0F?`, 'gu');
const TEST = new RegExp(RX.source, 'u');

// cambia emojis por iconos dentro de un texto (para el HTML que se arma a mano)
export const iconize = s => String(s).replace(RX, (m, k) => icon(EMOJI_ICON[k]));

const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'OPTION', 'TITLE', 'svg', 'SVG', 'text']);
function fixText(node) {
  const t = node.nodeValue; if (!t || !TEST.test(t)) return;
  const p = node.parentNode; if (!p || SKIP.has(p.nodeName) || (p.closest && p.closest('[data-noicon]'))) return;
  const tpl = document.createElement('template'); tpl.innerHTML = t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(RX, (m, k) => icon(EMOJI_ICON[k]));
  p.replaceChild(tpl.content, node);
}
function scan(root) {
  if (root.nodeType === 3) return fixText(root);
  if (root.nodeType !== 1 || SKIP.has(root.nodeName)) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), list = [];
  while (w.nextNode()) if (TEST.test(w.currentNode.nodeValue)) list.push(w.currentNode);
  list.forEach(fixText);
}

export function installIcons() {
  const css = document.createElement('style');
  css.textContent = `.gi{width:1.2em;height:1.2em;vertical-align:-.22em;display:inline-block;flex:none;overflow:visible}
.gi .d{fill:currentColor;opacity:.22;stroke:none}
.gi + .gi{margin-left:.06em}
#raceItem span{white-space:nowrap;display:inline-flex;align-items:center;justify-content:center}
#raceItem span .gi + .gi{margin-left:-.25em}`;
  document.head.appendChild(css);
  scan(document.body);
  new MutationObserver(ms => { for (const m of ms) { if (m.type === 'characterData') fixText(m.target); else m.addedNodes.forEach(scan); } })
    .observe(document.body, { childList: true, subtree: true, characterData: true });
  // también los títulos emergentes (title="…")
  document.querySelectorAll('[title]').forEach(e => { e.title = e.title.replace(RX, ''); });
}
