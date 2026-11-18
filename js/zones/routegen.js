// Generador de «Senderos»: un recorrido largo de plataformas que sale de un lado de la zona.
// Siempre es el mismo para cada zona (semilla fija). Solo usa saltos que la protagonista puede hacer
// con las habilidades que tiene en ese capítulo (caps): doble salto siempre; planeo, impulso y garfio si los tiene.

function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

export function buildRoute({ seed, start, dir = -1, caps = {}, segs, length = 140, palette, fire = false, crystal = 0x9fe3ff, idp }) {
  const R = rng(seed), pick = a => a[Math.floor(R() * a.length)], rr = (a, b) => a + R() * (b - a);
  const out = { islands: [], crumbles: [], movers: [], bridges: [], updrafts: [], grapples: [], fireJets: [], pendulums: [], enemies: [], lanterns: [], fragments: [], breakables: [], crystals: [], rocks: [] };
  let ex = start[0], y = start[1], z0 = start[2], z = z0; // ex: borde lejano de la última plataforma
  const X = d => ex + dir * d; // avanzar desde el borde
  const island = (gap, w, d, top, dz = 0, extra = {}) => {
    const cx = X(gap + w / 2); z = Math.max(z0 - 9, Math.min(z0 + 9, z + dz));
    out.islands.push({ x: +cx.toFixed(2), z: +z.toFixed(2), w, d, top: +top.toFixed(2), depth: 3 + R() * 2, ...extra });
    ex = cx + dir * w / 2; y = top; return { x: cx, z, top };
  };
  let n = 0, frag = 0, lant = 0;
  const kinds = {
    hop() { const k = 2 + Math.floor(R() * 2); for (let i = 0; i < k; i++) island(rr(2.2, 3), 3, 3, y + pick([-0.8, 0, 0.6, 1.1]), rr(-1.6, 1.6)); },
    crumbles() {
      const k = 4 + Math.floor(R() * 3), cz = z;
      island(0.6, 3, 3, y, 0); // apoyo antes de las rocas
      for (let i = 0; i < k; i++) { const cx = X(0.25 + 1.3); out.crumbles.push({ x: +cx.toFixed(2), y: +y.toFixed(2), z: +(cz + Math.sin(i * 1.3) * 0.5).toFixed(2), w: 2.6, d: 2.6 }); ex = cx + dir * 1.3; }
      island(0.25, 4, 4, y, 0);
    },
    mover() {
      const gap = 7.5, mx = X(gap / 2);
      out.movers.push({ x: +mx.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2), w: 3, d: 3, axis: 'x', range: 2, speed: rr(0.5, 0.75), phase: R() * 6 });
      island(gap, 4, 4, y, 0);
    },
    pend() {
      island(0.5, 4, 4, y, rr(-1, 1));
      const len = 12, x1 = ex, x2 = ex + dir * len;
      out.bridges.push({ x1: +x1.toFixed(2), z1: +z.toFixed(2), x2: +x2.toFixed(2), z2: +z.toFixed(2), y: +y.toFixed(2), w: 2.4 });
      for (const f of [0.33, 0.7]) out.pendulums.push({ x: +(x1 + dir * len * f).toFixed(2), y: +(y + 6.2).toFixed(2), z: +z.toFixed(2), len: 5, axis: 'z', amp: 0.75, speed: rr(1.7, 2.2), phase: R() * 6, post: 16 });
      ex = x2; island(0, 5, 5, y, 0);
    },
    fire() {
      island(0.5, 3.4, 3.4, y, 0);
      const gap = 3, jx = X(gap / 2);
      out.fireJets.push({ x: +jx.toFixed(2), y: +(y - 3.5).toFixed(2), z: +z.toFixed(2), h: 8, period: 2.8, on: 1, phase: R() * 2.8, pillar: 14 });
      island(gap, 3.4, 3.4, y + pick([0, 0.6]), 0);
    },
    glide() { island(rr(7, 8.5), 4, 4, y - 2.2, rr(-2, 2)); },
    dash() { island(5.2, 3.5, 3.5, y + 0.4, rr(-1, 1)); },
    updraft() {
      const I = island(1.5, 6, 6, y, 0);
      out.updrafts.push({ x: +I.x.toFixed(2), z: +I.z.toFixed(2), y0: +y.toFixed(2), y1: +(y + 13).toFixed(2), r: 1.6 });
      island(3.5, 4, 4, y + 5, 0);
    },
    grapple() {
      const gap = 10, gx = X(gap / 2);
      out.grapples.push({ x: +gx.toFixed(2), y: +(y + 5).toFixed(2), z: +z.toFixed(2) });
      island(gap, 4, 4, y, 0);
    },
    wasp() {
      const x0 = ex; kinds.hop();
      out.enemies.push({ type: 'avispa', x: +((x0 + ex) / 2).toFixed(2), y: +(y + 2.5).toFixed(2), z: +z.toFixed(2), r: 3 });
    },
  };
  const rest = () => {
    const I = island(rr(2, 2.8), 7, 7, y + pick([0, 0.5]), rr(-2, 2));
    lant++;
    out.lanterns.push({ id: `${idp}_farol${lant}`, x: +(I.x - dir * 2).toFixed(2), y: +I.top.toFixed(2), z: +(I.z + 2.2).toFixed(2), facing: 0 });
    if (lant % 2 === 1) { frag++; out.fragments.push({ id: `${idp}_frag${frag}`, x: +(I.x + dir * 1.5).toFixed(2), y: +I.top.toFixed(2), z: +(I.z - 1.5).toFixed(2) }); }
    else out.breakables.push({ id: `${idp}_vasija${lant}`, kind: 'vasija', x: +(I.x + dir * 2.2).toFixed(2), y: +I.top.toFixed(2), z: +(I.z - 2.2).toFixed(2), loot: R() < 0.5 ? 'corazon' : undefined });
    out.crystals.push({ x: +(I.x - dir * 2.5).toFixed(2), y: +I.top.toFixed(2), z: +(I.z - 2.4).toFixed(2), s: 0.8 + R() * 0.4, color: crystal });
  };
  // plan: segmentos permitidos, descanso cada 3, hasta cubrir la longitud
  const allowed = segs.filter(s => (s !== 'glide' && s !== 'updraft') || caps.glide).filter(s => s !== 'dash' || caps.dash).filter(s => s !== 'grapple' || caps.grapple).filter(s => s !== 'fire' || fire);
  let last = '';
  island(1.8, 4, 4, y, 0); // primera piedra, separada de la isla de la zona
  while (Math.abs(ex - start[0]) < length) {
    let k = pick(allowed); if (k === last && allowed.length > 1) k = pick(allowed); last = k;
    kinds[k](); n++;
    if (n % 3 === 0) rest();
    if (y > start[1] + 9) y = start[1] + 9; // que no suba sin fin
    if (y < start[1] - 1.5) y = start[1] - 1.5;
  }
  // altar del sello
  const A = island(2.5, 9, 9, y, 0);
  out.altar = { x: +A.x.toFixed(2), y: +A.top.toFixed(2), z: +A.z.toFixed(2) };
  out.crystals.push({ x: +(A.x + 3).toFixed(2), y: A.top, z: +(A.z - 3).toFixed(2), s: 1.3, color: crystal }, { x: +(A.x - 3).toFixed(2), y: A.top, z: +(A.z + 3).toFixed(2), s: 1.1, color: crystal });
  out.length = Math.abs(ex - start[0]);
  return out;
}
