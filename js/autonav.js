// Navegación del modo automático: Lía recorre el nivel de verdad (camina, salta, planea,
// usa corrientes de aire, setas y el garfio) en vez de volar en línea recta.
// Construye un grafo con las superficies de la física y busca el camino más corto hasta el objetivo.

const GRAV = 28;

function rectGap(a, b) { // distancia horizontal entre dos rectángulos (0 si se tocan)
  const dx = Math.max(0, a.minX - b.maxX, b.minX - a.maxX), dz = Math.max(0, a.minZ - b.maxZ, b.minZ - a.maxZ);
  return Math.hypot(dx, dz);
}
const clampTo = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// punto de un rectángulo más cercano a (x,z), metido hacia dentro "inset" metros
function nearestIn(r, x, z, inset = 0.6) {
  const ix = Math.min(inset, (r.maxX - r.minX) / 2 - 0.05), iz = Math.min(inset, (r.maxZ - r.minZ) / 2 - 0.05);
  return { x: clampTo(x, r.minX + ix, r.maxX - ix), z: clampTo(z, r.minZ + iz, r.maxZ - iz) };
}

export class AutoNav {
  constructor() { this.path = null; this.edge = null; this.fails = new Map(); }

  // Superficies pisables: cajas de al menos 1.2 × 1.2 m y rampas
  nodes(physics) {
    const out = [];
    for (const b of physics.boxes) {
      if (b.off && !b.crumble && !b.blink) continue; // las rocas que se desploman vuelven: siguen contando
      const sw = Math.min(b.maxX - b.minX, b.maxZ - b.minZ), sl = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
      if (sw < 0.5 || sl < 1.2) continue;
      const narrow = sw < 1.2; // peldaños de escalera: solo se andan
      out.push({ b, narrow, get minX() { return b.minX; }, get maxX() { return b.maxX; }, get minZ() { return b.minZ; }, get maxZ() { return b.maxZ; }, get top() { return b.maxY; }, moving: !!b.delta, bounce: b.bounce || 0, crumble: !!b.crumble });
    }
    for (const r of physics.ramps) out.push({ ramp: r, minX: r.minX, maxX: r.maxX, minZ: r.minZ, maxZ: r.maxZ, top: Math.max(r.y0, r.y1), low: Math.min(r.y0, r.y1) });
    return out;
  }
  // nodo bajo un punto (el más alto que no esté por encima)
  nodeAt(nodes, x, z, y) {
    let best = null;
    for (const n of nodes) {
      if (x < n.minX - 0.3 || x > n.maxX + 0.3 || z < n.minZ - 0.3 || z > n.maxZ + 0.3) continue;
      const top = n.ramp ? n.top : n.top;
      if (top > y + 0.6) continue;
      if (!best || top > best.top) best = n;
    }
    return best;
  }

  // Aristas posibles desde A con las habilidades de Lía
  edges(A, nodes, caps, extras) {
    const out = [];
    for (const B of nodes) {
      if (B === A) continue;
      const gap = rectGap(A, B), dy = B.top - (A.ramp ? A.top : A.top), dyLow = B.ramp ? B.low - A.top : dy;
      // caminar: se tocan y la altura casi coincide (o es una rampa)
      if (gap < 0.35 && (Math.abs(dy) < 0.5 || A.ramp || B.ramp && Math.abs(dyLow) < 0.6 || dy < 0 && dy > -2.5)) { out.push({ to: B, kind: 'walk', cost: 1 + gap }); continue; }
      if (A.narrow || B.narrow) continue;
      // saltar (doble salto) y planear
      let reach = dy > 3 ? 0 : dy > 1.6 ? 4.2 : 6.8;
      if (caps.glide && dy < 2.6) reach = Math.max(reach, Math.min(16, 4.8 + 1.5 * (Math.max(0, -dy) + 3.2) - Math.max(0, dy) * 1.5));
      if (caps.dash && reach > 0) reach += caps.glide ? 3 : 4.4; // impulso aéreo
      if (B.moving) reach *= 0.9;
      if (gap > 0.3 && gap <= reach) out.push({ to: B, kind: 'jump', cost: 3 + gap * 1.5, glide: gap > 6 || (caps.glide && dy < -1 && gap > 4.5) });
      else if (gap <= 0.3 && dy >= 0.5 && dy <= 2.7) out.push({ to: B, kind: 'jump', cost: 3 + dy, climb: true }); // trepar a un saliente pegado
    }
    // corrientes de aire
    if (caps.glide) for (const u of extras.updrafts) {
      if (u.active === false) continue;
      if (u.x < A.minX - 0.5 || u.x > A.maxX + 0.5 || u.z < A.minZ - 0.5 || u.z > A.maxZ + 0.5 || Math.abs(A.top - u.y0) > 3.5) continue;
      for (const B of nodes) {
        if (B === A || B.narrow || B.top > u.y1 - 0.8) continue;
        const d = rectGap({ minX: u.x, maxX: u.x, minZ: u.z, maxZ: u.z }, B);
        if (d < 1.4 * (u.y1 - B.top) + 2) out.push({ to: B, kind: 'updraft', u, cost: 6 + d });
      }
    }
    // setas que rebotan
    if (A.bounce) {
      const h = A.bounce * A.bounce / (2 * GRAV) + 1.4;
      for (const B of nodes) if (B !== A && !B.narrow && B.top > A.top + 0.5 && B.top < A.top + h && rectGap(A, B) < 5 + (caps.glide ? 4 : 0)) out.push({ to: B, kind: 'bounce', cost: 4 + rectGap(A, B) });
    }
    // garfio: anillos al alcance desde este suelo
    if (caps.grapple) for (const g of extras.grapples) {
      if (g.active === false) continue;
      const ga = rectGap(A, { minX: g.pos.x, maxX: g.pos.x, minZ: g.pos.z, maxZ: g.pos.z });
      if (ga > 14 || g.pos.y < A.top + 1) continue;
      for (const B of nodes) {
        if (B === A || B.narrow || B.top > g.pos.y + 1) continue;
        const gb = rectGap(B, { minX: g.pos.x, maxX: g.pos.x, minZ: g.pos.z, maxZ: g.pos.z });
        if (gb < 9 && rectGap(A, B) > 2) out.push({ to: B, kind: 'grapple', g, cost: 5 + ga + gb });
      }
    }
    return out;
  }

  // Dijkstra desde el suelo actual hasta el suelo del objetivo
  plan(physics, from, T, caps, extras) {
    const nodes = this.nodes(physics);
    let A = this.nodeAt(nodes, from.x, from.z, from.y + 0.2);
    if (!A) { // de pie sobre algo pequeño (una caja, un escalón): la superficie más cercana por debajo
      const pt = { minX: from.x, maxX: from.x, minZ: from.z, maxZ: from.z }; let bg = 1.6;
      for (const n of nodes) { if (n.top > from.y + 0.2 || n.top < from.y - 1.5) continue; const g = rectGap(n, pt); if (g < bg) { bg = g; A = n; } }
    }
    let Bn = this.nodeAt(nodes, T.x, T.z, T.y + 1.5);
    if (A && !Bn) { // objetivo sobre el vacío (un cristal entre dos islas): ir a la isla más cercana a él que no sea esta, y se recoge al saltar
      const pt = { minX: T.x, maxX: T.x, minZ: T.z, maxZ: T.z };
      let bg = 8;
      for (const n of nodes) { if (n === A || n.narrow || n.top > T.y + 1.5) continue; const g = rectGap(n, pt); if (g < bg) { bg = g; Bn = n; } }
    }
    if (!A || !Bn) return null;
    if (A === Bn) return [];
    const dist = new Map([[A, 0]]), prev = new Map(), open = [A], done = new Set();
    while (open.length) {
      open.sort((a, b) => dist.get(a) - dist.get(b));
      const n = open.shift(); if (done.has(n)) continue; done.add(n);
      if (n === Bn) break;
      if (done.size > 400) break;
      for (const e of this.edges(n, nodes, caps, extras)) {
        const key = (n.b || n.ramp), fk = this.fails.get(key) && this.fails.get(key).get(e.to.b || e.to.ramp);
        const c = dist.get(n) + e.cost + (fk ? fk * 25 : 0);
        if (c < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, c); prev.set(e.to, { from: n, e }); open.push(e.to); }
      }
    }
    if (!prev.has(Bn)) return null;
    const path = []; let n = Bn;
    while (n !== A) { const p = prev.get(n); path.unshift({ ...p.e, from: p.from }); n = p.from; }
    return path;
  }
  fail(e) {
    const k = e.from.b || e.from.ramp; if (!this.fails.has(k)) this.fails.set(k, new Map());
    const m = this.fails.get(k), t = e.to.b || e.to.ramp; m.set(t, (m.get(t) || 0) + 1);
    return m.get(t);
  }
  reset() { this.path = null; this.edge = null; this.fails = new Map(); }

  // Camino a pie entre dos superficies que se tocan: puntos intermedios (rampas por sus extremos; puertas y muelles de frente)
  walkPoints(e, goal) {
    const A = e.from, B = e.to;
    const end = (r, y, out) => { // extremo de la rampa a la altura y (out: metros hacia fuera, negativo = hacia dentro)
      const R = r.ramp, lowAtMin = R.y0 <= R.y1, wantLow = Math.abs(y - Math.min(R.y0, R.y1)) < Math.abs(y - Math.max(R.y0, R.y1));
      const atMin = wantLow === lowAtMin;
      if (R.axis === 'x') return { x: atMin ? R.minX - out : R.maxX + out, z: (R.minZ + R.maxZ) / 2 };
      return { x: (R.minX + R.maxX) / 2, z: atMin ? R.minZ - out : R.maxZ + out };
    };
    if (B.ramp) return [end(B, A.top, 0.8), end(B, A.top, -1.0)];
    if (A.ramp) return [end(A, B.top, -0.6), end(A, B.top, 1.2)];
    const bc = { x: (B.minX + B.maxX) / 2, z: (B.minZ + B.maxZ) / 2 };
    if (B.narrow) { // peldaño: se entra por el lado que no tiene el siguiente peldaño (el contrario al objetivo)
      if (A.narrow) return [bc];
      const ax = (B.maxX - B.minX) < (B.maxZ - B.minZ);
      if (ax) { const s = Math.sign(bc.x - goal.x) || 1; return [{ x: (s > 0 ? B.maxX : B.minX) + s * 0.9, z: bc.z }, { x: bc.x + s * 0.1, z: bc.z }]; }
      const s = Math.sign(bc.z - goal.z) || 1; return [{ x: bc.x, z: (s > 0 ? B.maxZ : B.minZ) + s * 0.9 }, { x: bc.x, z: bc.z + s * 0.1 }];
    }
    if (A.narrow) return [nearestIn(B, bc.x, bc.z, 1.0)];
    const p1 = nearestIn(A, bc.x, bc.z, 1.0), p2 = nearestIn(B, p1.x, p1.z, 1.2);
    const last = this.landing(e, p2, goal);
    return [p1, p2, last];
  }

  // Puntos de despegue y de aterrizaje de una arista
  takeoff(e, here) {
    const B = e.to, cx = (B.minX + B.maxX) / 2, cz = (B.minZ + B.maxZ) / 2;
    if (e.climb && here) { // saliente dentro de esta superficie: ponerse junto a su borde, por fuera
      const p = nearestIn(B, here.x, here.z, 0), dx = p.x - cx, dz = p.z - cz, l = Math.hypot(dx, dz) || 1;
      const ex = (B.maxX - B.minX) / 2, ez = (B.maxZ - B.minZ) / 2;
      // borde más cercano del rectángulo y 0.7 m hacia fuera
      const tx = Math.abs(dx) / ex > Math.abs(dz) / ez ? cx + Math.sign(dx || 1) * (ex + 0.7) : clampTo(p.x, B.minX + 0.3, B.maxX - 0.3);
      const tz = Math.abs(dx) / ex > Math.abs(dz) / ez ? clampTo(p.z, B.minZ + 0.3, B.maxZ - 0.3) : cz + Math.sign(dz || 1) * (ez + 0.7);
      return { x: tx, z: tz };
    }
    if (e.kind === 'updraft') return { x: e.u.x, z: e.u.z };
    if (e.kind === 'bounce') { const A = e.from; return { x: (A.minX + A.maxX) / 2, z: (A.minZ + A.maxZ) / 2 }; }
    if (e.kind === 'grapple') return nearestIn(e.from, e.g.pos.x, e.g.pos.z, 1.0);
    return nearestIn(e.from, cx, cz, e.kind === 'walk' ? 0 : 0.5);
  }
  landing(e, from, goal) {
    const B = e.to, cx = (B.minX + B.maxX) / 2, cz = (B.minZ + B.maxZ) / 2, A = e.from;
    const ax = (A.minX + A.maxX) / 2, az = (A.minZ + A.maxZ) / 2;
    if (goal && ax >= B.minX && ax <= B.maxX && az >= B.minZ && az <= B.maxZ) { // bajar de algo que está encima de B: salir por el lado del objetivo
      let dx = goal.x - ax, dz = goal.z - az; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const ex = (A.maxX - A.minX) / 2 + 1.2, ez = (A.maxZ - A.minZ) / 2 + 1.2;
      const k = Math.min(Math.abs(dx) > 1e-3 ? ex / Math.abs(dx) : 1e9, Math.abs(dz) > 1e-3 ? ez / Math.abs(dz) : 1e9);
      return { x: clampTo(ax + dx * k, B.minX + 0.4, B.maxX - 0.4), z: clampTo(az + dz * k, B.minZ + 0.4, B.maxZ - 0.4) };
    }
    const p = nearestIn(B, from.x, from.z, Math.min(1.4, (B.maxX - B.minX) / 3, (B.maxZ - B.minZ) / 3));
    return { x: (p.x * 2 + cx) / 3, z: (p.z * 2 + cz) / 3 };
  }
}
