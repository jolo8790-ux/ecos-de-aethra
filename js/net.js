// Conexión para la Arena online.
// Usa la sala en tiempo real de la página publicada (claude.use("room")): cada jugador comparte su estado
// en «presence» (posición, animación, vida y una lista corta de sucesos con número de orden).
// Si la página no puede conectarse (abierta fuera de claude.ai), usa un canal entre pestañas de este
// navegador para que se pueda jugar abriendo el juego dos veces.

// servidor propio (Cloudflare): se usa cuando el juego se abre fuera de claude.ai
export const SERVER = (typeof window !== 'undefined' && window.AETHRA_SERVER) || 'wss://aethra-salas.rocketrip-jolo8790.workers.dev';
const EV_KEEP = 14; // sucesos recientes que viajan en la presencia (se repiten hasta que caducan: nada se pierde)

export class Net {
  constructor() {
    this.me = null; this.kind = ''; this.room = null; this.peersList = []; this.myPres = {}; this.seq = 0; this.evs = [];
    this.lastSeq = {}; this.handlers = []; this.closed = false; this.sendT = 0;
    this.chats = []; this.cseq = 0; this.lastChat = {}; this.chatHandlers = [];
  }
  static async open(code, prefix = 'arena-') {
    const n = new Net(); const name = prefix + String(code).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
    let lobby = null;
    try { if (window.claude && window.claude.use) lobby = await Promise.race([window.claude.use('room'), new Promise(r => setTimeout(() => r(null), 6000))]); } catch (e) { lobby = null; }
    if (lobby) {
      try {
        const room = await lobby.join(name);
        n.room = room; n.kind = 'room';
        room.onPeers(ch => { n.peersList = ch.peers.map(p => ({ id: p.peer, me: !!p.sameTab, pres: p.presence || {}, guest: p.guest })); const me = ch.peers.find(p => p.sameTab); if (me) n.me = me.peer; });
        // la etiqueta propia llega con el primer onPeers; mientras, una provisional
        n.me = n.me || 'yo';
        return n;
      } catch (e) { console.warn('Sala no disponible, se usa el canal local', e); }
    }
    // fuera de claude.ai: el servidor de salas de Ecos de Aethra (WebSocket)
    if (SERVER && typeof WebSocket !== 'undefined') { try { if (await n._ws(name)) return n; } catch (e) { console.warn('Servidor de salas no disponible', e); } }
    // canal local entre pestañas
    n.kind = 'local'; n.me = 'p' + Math.random().toString(36).slice(2, 10);
    const bc = new BroadcastChannel('aethra-' + name); n.bc = bc; const seen = {};
    bc.onmessage = e => { const d = e.data; if (!d || !d.peer) return; if (d.bye) delete seen[d.peer]; else seen[d.peer] = { pres: d.pres, t: performance.now() }; };
    n._local = () => {
      const now = performance.now();
      for (const k of Object.keys(seen)) if (now - seen[k].t > 3500) delete seen[k];
      n.peersList = [{ id: n.me, me: true, pres: n.myPres }, ...Object.entries(seen).map(([id, v]) => ({ id, me: false, pres: v.pres || {} }))];
    };
    addEventListener('beforeunload', () => { try { bc.postMessage({ peer: n.me, bye: true }); } catch (e) {} });
    n._local();
    return n;
  }
  _ws(name) {
    return new Promise(res => {
      let done = false; const fin = ok => { if (!done) { done = true; res(ok); } };
      const others = new Map(); this.kind = 'ws'; this._wsName = name;
      const ws = new WebSocket(`${SERVER}/room/${name}`); this.ws = ws;
      const t = setTimeout(() => { try { ws.close(); } catch (e) {} fin(false); }, 15000); // generoso: al cargar una isla el teléfono puede estar ocupado unos segundos
      ws.onmessage = e => {
        let d; try { d = JSON.parse(e.data); } catch (er) { return; }
        if (d.t === 'hi') { this.me = d.id; for (const p of d.peers || []) others.set(p.id, p.p || {}); clearTimeout(t); fin(true); }
        else if (d.t === 'p') others.set(d.id, d.p || {});
        else if (d.t === 'bye') others.delete(d.id);
        this.peersList = [{ id: this.me, me: true, pres: this.myPres }, ...[...others].map(([id, pres]) => ({ id, me: false, pres }))];
      };
      ws.onclose = () => { clearTimeout(t); fin(false); if (!this.closed && done) setTimeout(() => { if (!this.closed) this._ws(this._wsName); }, 2000); }; // se reconecta sola
      ws.onerror = () => {};
    });
  }
  get connected() { return this.kind === 'local' ? true : this.kind === 'ws' ? !!(this.ws && this.ws.readyState === 1) : !!(this.room && this.room.connected()); }
  // todos los jugadores de la sala (yo incluido)
  peers() { if (this._local) this._local(); return this.peersList.filter(p => p.me || (p.pres && p.pres.n)); }
  others() { return this.peers().filter(p => !p.me); }
  // estado propio (se envía unas 15 veces por segundo)
  set(patch) { Object.assign(this.myPres, patch); }
  // chat: los últimos mensajes viajan en la presencia (texto limpio, máximo 100 caracteres)
  chat(text) {
    const m = String(text).replace(/[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, '').trim().slice(0, 100);
    if (!m) return null;
    this.chats.push({ q: ++this.cseq, m }); if (this.chats.length > 4) this.chats.shift();
    return m;
  }
  onChat(fn) { this.chatHandlers.push(fn); }
  event(ev) { this.evs.push({ ...ev, q: ++this.seq }); if (this.evs.length > EV_KEEP) this.evs.shift(); }
  tick(dt) {
    if (this.closed) return;
    this.sendT -= dt;
    if (this.sendT <= 0) {
      this.sendT = 1 / 15;
      this.myPres.ev = this.evs; this.myPres.cm = this.chats;
      if (this.kind === 'room') this.room.presence(this.myPres).catch(() => {});
      else if (this.kind === 'ws') { if (this.ws && this.ws.readyState === 1) try { this.ws.send(JSON.stringify({ t: 'p', p: this.myPres })); } catch (e) {} }
      else { try { this.bc.postMessage({ peer: this.me, pres: JSON.parse(JSON.stringify(this.myPres)) }); } catch (e) {} }
    }
    // sucesos nuevos de los demás
    for (const p of this.others()) {
      const list = (p.pres && p.pres.ev) || [];
      if (this.lastSeq[p.id] === undefined) { this.lastSeq[p.id] = list.reduce((m, e) => Math.max(m, (e && e.q) || 0), 0); continue; } // lo anterior a conocerlo no cuenta
      const last = this.lastSeq[p.id];
      let max = last;
      for (const e of list) if (e && e.q > last) { max = Math.max(max, e.q); for (const h of this.handlers) h(p.id, e); }
      this.lastSeq[p.id] = max;
      const cl = (p.pres && p.pres.cm) || [];
      if (this.lastChat[p.id] === undefined) { this.lastChat[p.id] = cl.reduce((m, e) => Math.max(m, (e && e.q) || 0), 0); continue; }
      let cm = this.lastChat[p.id];
      for (const c of cl) if (c && c.q > this.lastChat[p.id] && typeof c.m === 'string') { cm = Math.max(cm, c.q); for (const h of this.chatHandlers) h(p.id, c.m.slice(0, 100)); }
      this.lastChat[p.id] = cm;
    }
  }
  onEvent(fn) { this.handlers.push(fn); }
  close() {
    this.closed = true;
    try { if (this.room) this.room.leave(); } catch (e) {}
    try { if (this.ws) this.ws.close(); } catch (e) {}
    try { if (this.bc) { this.bc.postMessage({ peer: this.me, bye: true }); this.bc.close(); } } catch (e) {}
  }
}
