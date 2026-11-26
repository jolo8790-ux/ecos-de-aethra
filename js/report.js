// Avisos de problemas: los errores del juego se envían solos (sin datos personales) y el jugador puede
// mandar un reporte con una captura desde la pausa. Llegan al servidor de salas (POST /reporte).
import { SERVER } from './net.js';

const URL_R = SERVER.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:') + '/reporte';
const ver = (() => { try { const s = document.querySelector('script[src*="main.js"]'); return (s && (s.src.match(/v=(\d+)/) || [])[1]) || ''; } catch (e) { return ''; } })();
const disp = (() => { try { let d = localStorage.getItem('aethra_disp'); if (!d) { d = Math.random().toString(36).slice(2, 10); localStorage.setItem('aethra_disp', d); } return d; } catch (e) { return 'anon'; } })();
const crumbs = []; // últimas cosas que pasaron (para entender el contexto de un error)
export const crumb = s => { crumbs.push(`${(performance.now() / 1000).toFixed(1)}s ${String(s).slice(0, 80)}`); if (crumbs.length > 25) crumbs.shift(); };

let getCtx = () => ({}), shooter = null, sentAuto = 0;
const sentMsgs = new Set();
const device = () => ({ ua: navigator.userAgent.slice(0, 180), pantalla: `${innerWidth}x${innerHeight}@${devicePixelRatio || 1}`, mem: navigator.deviceMemory || null, idioma: navigator.language });

function send(body) {
  try {
    const data = JSON.stringify({ disp, ver, ...body });
    return fetch(URL_R, { method: 'POST', headers: { 'content-type': 'application/json' }, body: data, keepalive: data.length < 60000 }).then(r => r.ok).catch(() => false);
  } catch (e) { return Promise.resolve(false); }
}

// error automático (como mucho 8 por partida, sin repetir el mismo)
export function reportError(where, err) {
  try {
    const msg = String((err && (err.message || err.reason && err.reason.message)) || err || 'error').slice(0, 300), key = where + '|' + msg;
    if (sentMsgs.has(key) || sentAuto >= 8) return; sentMsgs.add(key); sentAuto++;
    let ctx = {}; try { ctx = getCtx(); } catch (e) {}
    send({ tipo: 'error', cat: where, msg, datos: { pila: String((err && err.stack) || '').slice(0, 1800), ctx, pasos: crumbs.slice(-15), ...device() } });
  } catch (e) {}
}

export function installReporting(opts) {
  getCtx = opts.getCtx || getCtx; shooter = opts.shot || null;
  addEventListener('error', e => { if (e && e.message && !/ResizeObserver|Script error/.test(e.message)) reportError('ventana', e.error || e.message + ` @${(e.filename || '').split('/').pop()}:${e.lineno}`); });
  addEventListener('unhandledrejection', e => { const r = e.reason; if (r && /AbortError|NotAllowedError|play\(\)/.test(String(r.name || r))) return; reportError('promesa', r); });
}

// captura reducida de lo que se ve en el juego
function snapshot() {
  try {
    const src = shooter && shooter(); if (!src) return null;
    const w = 480, h = Math.round(w * src.height / src.width), c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(src, 0, 0, w, h); return c.toDataURL('image/jpeg', 0.6);
  } catch (e) { return null; }
}

// ventana «Reportar un problema»
let box = null, shot = null;
export function openReport(onClose) {
  shot = snapshot();
  if (!box) {
    box = document.createElement('div'); box.id = 'reportBox'; box.className = 'hidden';
    box.innerHTML = `<div class="rbIn"><h2>Reportar un problema</h2>
      <div class="rbCats">${[['error', 'Algo falló'], ['graficos', 'Se ve mal'], ['control', 'Controles'], ['multijugador', 'En línea'], ['idea', 'Idea'], ['otro', 'Otro']].map(([k, t], i) => `<button class="btn alt small${i ? '' : ' on'}" data-k="${k}">${t}</button>`).join('')}</div>
      <textarea id="rbTxt" maxlength="1500" placeholder="¿Qué pasó? ¿Qué estabas haciendo?"></textarea>
      <label class="rbShot"><input type="checkbox" id="rbShotOn" checked> Adjuntar captura de pantalla <img id="rbImg" alt=""></label>
      <div class="row2"><button class="btn small" id="rbSend">Enviar</button><button class="btn alt small" id="rbCancel">Cancelar</button></div>
      <p class="rbNote">Se envía tu texto, la captura y datos técnicos del juego (modelo de navegador, pantalla, zona). Nada personal.</p></div>`;
    document.body.appendChild(box);
    const css = document.createElement('style'); css.textContent = `#reportBox{position:fixed;inset:0;z-index:60;background:rgba(6,10,30,.72);display:flex;align-items:center;justify-content:center;padding:12px}
#reportBox.hidden{display:none}#reportBox .rbIn{background:#1c2450;border:2px solid rgba(255,255,255,.18);border-radius:18px;padding:14px 16px;width:min(520px,96vw);max-height:94vh;overflow:auto;color:#fff}
#reportBox h2{margin:0 0 8px;font-size:20px}#reportBox .rbCats{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}#reportBox .rbCats .on{background:#ffc83a;color:#1a1a2a}
#reportBox textarea{width:100%;box-sizing:border-box;min-height:84px;border-radius:12px;border:none;padding:8px 10px;font:inherit;font-size:15px}
#reportBox .rbShot{display:flex;align-items:center;gap:8px;margin:8px 0;font-size:14px}#reportBox .rbShot img{height:48px;border-radius:6px;margin-left:auto}
#reportBox .rbNote{font-size:11px;opacity:.65;margin:8px 0 0}`;
    document.head.appendChild(css);
    box.querySelector('.rbCats').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; box.querySelectorAll('.rbCats button').forEach(x => x.classList.toggle('on', x === b)); });
    box.querySelector('#rbCancel').onclick = () => close();
    box.querySelector('#rbSend').onclick = async () => {
      const txt = box.querySelector('#rbTxt').value.trim(), cat = (box.querySelector('.rbCats .on') || {}).dataset?.k || 'otro', btn = box.querySelector('#rbSend');
      if (!txt && cat !== 'error') { box.querySelector('#rbTxt').focus(); return; }
      btn.disabled = true; btn.textContent = 'Enviando…';
      let ctx = {}; try { ctx = getCtx(); } catch (e) {}
      const ok = await send({ tipo: 'jugador', cat, msg: txt, captura: box.querySelector('#rbShotOn').checked ? shot : null, datos: { ctx, pasos: crumbs.slice(-15), ...device() } });
      btn.disabled = false; btn.textContent = 'Enviar';
      close(ok ? '¡Gracias! Tu reporte nos llegó.' : 'No se pudo enviar ahora. Revisa la conexión e inténtalo otra vez.');
    };
  }
  const img = box.querySelector('#rbImg'); img.src = shot || ''; img.style.display = shot ? '' : 'none'; box.querySelector('#rbShotOn').checked = !!shot; box.querySelector('#rbShotOn').disabled = !shot;
  box.querySelector('#rbTxt').value = ''; box.classList.remove('hidden');
  function close(msg) { box.classList.add('hidden'); if (onClose) onClose(msg); }
}

// ---- opinión del jugador: una tarjeta amable, una sola vez (o dos si dijo «ahora no») ----
let opBox = null;
export function maybeAskOpinion(reason) {
  try {
    const st = JSON.parse(localStorage.getItem('aethra_opinion') || '{}');
    if (st.done || (st.later && Date.now() - st.later < 20 * 60000) || (st.later && st.n >= 2) || (opBox && !opBox.classList.contains('hidden'))) return;
    showOpinion(reason, st);
  } catch (e) {}
}
function showOpinion(reason, st) {
  if (!opBox) {
    opBox = document.createElement('div'); opBox.id = 'opBox'; opBox.className = 'hidden';
    opBox.innerHTML = `<div class="opIn"><b>¿Qué te parece Ecos de Aethra?</b>
      <div class="opStars">${[1, 2, 3, 4, 5].map(n => `<button data-n="${n}" aria-label="${n} estrellas">★</button>`).join('')}</div>
      <textarea id="opTxt" maxlength="800" placeholder="¿Qué te gustó? ¿Qué mejorarías? (opcional)"></textarea>
      <div class="row2"><button class="btn small" id="opSend" disabled>Enviar</button><button class="btn alt small" id="opLater">Ahora no</button></div></div>`;
    document.body.appendChild(opBox);
    const css = document.createElement('style'); css.textContent = `#opBox{position:fixed;right:12px;bottom:12px;z-index:58;width:min(340px,92vw)}#opBox.hidden{display:none}
#opBox .opIn{background:#1c2450;border:2px solid rgba(255,210,74,.5);border-radius:16px;padding:12px 14px;color:#fff;box-shadow:0 8px 30px rgba(0,0,0,.45)}
#opBox .opStars{display:flex;gap:4px;margin:8px 0}#opBox .opStars button{font-size:30px;line-height:1;background:none;border:none;color:rgba(255,255,255,.3);cursor:pointer;padding:0 2px}
#opBox .opStars button.on{color:#ffd24a}#opBox textarea{width:100%;box-sizing:border-box;min-height:56px;border-radius:10px;border:none;padding:6px 8px;font:inherit;font-size:14px;margin-bottom:8px}`;
    document.head.appendChild(css);
    let stars = 0;
    opBox.querySelectorAll('.opStars button').forEach(b => b.onclick = () => { stars = +b.dataset.n; opBox.querySelectorAll('.opStars button').forEach(x => x.classList.toggle('on', +x.dataset.n <= stars)); opBox.querySelector('#opSend').disabled = false; });
    opBox.querySelector('#opLater').onclick = () => { const s2 = JSON.parse(localStorage.getItem('aethra_opinion') || '{}'); s2.later = Date.now(); s2.n = (s2.n || 0) + 1; localStorage.setItem('aethra_opinion', JSON.stringify(s2)); opBox.classList.add('hidden'); };
    opBox.querySelector('#opSend').onclick = async () => {
      let ctx = {}; try { ctx = getCtx(); } catch (e) {}
      send({ tipo: 'jugador', cat: 'opinion', msg: `${stars}★ ${opBox.querySelector('#opTxt').value.trim()}`.trim(), datos: { estrellas: stars, motivo: opBox.dataset.reason, ctx, ...device() } });
      localStorage.setItem('aethra_opinion', JSON.stringify({ done: Date.now(), stars }));
      opBox.querySelector('.opIn').innerHTML = '<b>¡Gracias por tu opinión!</b>'; setTimeout(() => opBox.classList.add('hidden'), 1800);
    };
  }
  opBox.dataset.reason = reason || ''; opBox.classList.remove('hidden');
}
