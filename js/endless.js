// Aethra sin fin: un mapa que nunca se acaba.
// Mientras avanzas se van creando sectores nuevos por delante (islas, escaleras, plataformas que se mueven,
// rocas que se desploman, corrientes de aire, chorros de fuego, péndulos, enemigos, vasijas e islotes
// laterales con chispas) y los que quedan muy atrás se borran. Cada 2 sectores cambia el paisaje.
import * as THREE from 'three';

export const ENDLESS_ZONE = {
  id: 'infinito', endless: true, title: 'Aethra sin fin', subtitle: 'Llega tan lejos como puedas', seed: 9,
  sky: { top: 0x5aa8f0, bottom: 0xd8f0ff, fog: 0xcfe8ff, fogNear: 45, fogFar: 175 },
  light: { hemiSky: 0xe8f4ff, hemiGround: 0x5c6a50, sun: 0xfff1d6 },
  palette: { top: 0x7cc35a, side: 0x7a5a3c },
  water: { y: -26, color: 0xcfe8ff },
  start: { id: 'inicio', pos: [0, 0, 3], facing: 0 },
  islands: [{ x: 0, z: 0, w: 10, d: 10, top: 0, depth: 4 }],
  lanterns: [], fragments: [],
};
const BIOMES = [
  { name: 'Pradera flotante', music: 'bosque', top: 0x7cc35a, side: 0x7a5a3c, sky: [0x5aa8f0, 0xd8f0ff, 0xcfe8ff], deco: 'tree', crystal: 0x9ff0ff, foes: ['brote', 'avispa'] },
  { name: 'Dunas del cielo', music: 'puerto', top: 0xe3c27a, side: 0xb07a4a, sky: [0x6ab0e8, 0xffe8c0, 0xf3dcb0], deco: 'rock', crystal: 0xffd27a, foes: ['brote', 'espora'] },
  { name: 'Glaciar eterno', music: 'glaciar', top: 0xeef6ff, side: 0x8aa6c8, sky: [0x7aa8d8, 0xe8f4ff, 0xdde8f4], deco: 'pine', crystal: 0xbff4ff, foes: ['brote_hielo', 'avispa'] },
  { name: 'Forjas ardientes', music: 'forja', top: 0x6a4a40, side: 0x3a2a2a, sky: [0x2a1018, 0xff7a3a, 0x8a3a2a], deco: 'rock', crystal: 0xff8a3a, foes: ['automata', 'espora'], jets: true },
  { name: 'Ruinas de cristal', music: 'ruinas', top: 0xb8a8d8, side: 0x6a5a8a, sky: [0x10183a, 0x6a4aa8, 0x3a3a6a], deco: 'crystal', crystal: 0xc8a8ff, foes: ['sombra', 'avispa', 'brote'] },
];
const SECTOR_SEGS = 6;
function rng(seed) { let s = (Math.floor(seed) * 9301 + 49297) % 233280 || 1; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }

export class Endless {
  // C: { scene, world, physics, combat, fx, audio, player, toast, setSky(top,bottom,fog), setMusic(key) }
  constructor(C) { this.C = C; this.active = false; }

  start() {
    const C = this.C;
    this.active = true; this.sectors = []; this.nextId = 0; this.dist = 0; this.chispas = 0; this.best = 0; this.over = false;
    this.cur = { x: 0, y: 0, z: -5, h: 0, len: 5 }; // cursor del camino: posición, rumbo y metros recorridos
    this.spawn = { x: 0, y: 0.05, z: 3, f: 0 }; this.sectorNow = 0; this.orbs = []; this.flags = [];
    this.skyNow = null;
    for (let i = 0; i < 3; i++) this._makeSector();
    this._biomeFx(0, true);
  }
  stop() {
    const C = this.C;
    for (const s of this.sectors) this._unload(s, true);
    this.sectors = []; this.active = false;
  }
  biomeOf(sectorId) { return BIOMES[Math.floor(sectorId / 2) % BIOMES.length]; }

  // ---------- un sector nuevo al final del camino ----------
  _makeSector() {
    const C = this.C, W = C.world, P = C.physics, id = this.nextId++, B = this.biomeOf(id), R = rng(id * 977 + 31);
    const g = new THREE.Group(); W.root.add(g);
    const keepRoot = W.root, keepHz = W.hz.root;
    const mark = { boxes: P.boxes.length, anim: W.animated.length, up: W.updrafts.length, mov: W.movers.length, br: W.breakables.length, cr: W.hz.crumbles.length, jets: W.hz.jets.length, pends: W.hz.pends.length };
    const enemies = [], orbs = [], flags = [], islandsForGrass = [];
    W.root = g; W.hz.root = g; W.pal = { top: B.top, side: B.side };
    const d = Math.min(1, (this.cur.len) / 1600); // dificultad: crece con la distancia
    const fwd = () => new THREE.Vector3(-Math.sin(this.cur.h), 0, -Math.cos(this.cur.h));
    const side = () => new THREE.Vector3(Math.cos(this.cur.h), 0, -Math.sin(this.cur.h));
    const at = (along, lat = 0, dy = 0) => { const f = fwd(), s = side(); return { x: this.cur.x + f.x * along + s.x * lat, y: this.cur.y + dy, z: this.cur.z + f.z * along + s.z * lat }; };
    let minY = this.cur.y;
    const advance = (n, dy = 0) => { if (dy) dy -= this.cur.y * 0.05; const p = at(n, 0, dy); minY = Math.min(minY, p.y); this.cur.x = p.x; this.cur.y = p.y; this.cur.z = p.z; this.cur.len += n; };
    const island = (x, y, z, w, dd, opts = {}) => {
      W._island({ x, z, w, d: dd, top: y, depth: opts.depth || 2.2 + R() * 2, rock: opts.rock !== false });
      const box = P.boxes[P.boxes.length - 1]; box.pl = opts.pl ?? this.cur.len;
      islandsForGrass.push({ x, z, w, d: dd, top: y });
      return box;
    };
    const orb = (x, y, z) => orbs.push(this._orb(g, x, y + 1.1, z, B.crystal));
    const deco = (x, y, z, s = 1) => {
      if (B.deco === 'tree') W._tree({ x, z, y, s: 0.7 + s * 0.4 }); else if (B.deco === 'pine') W._pine({ x, z, y, s: 0.7 + s * 0.4 });
      else if (B.deco === 'crystal') W._crystalCluster({ x, z, y, s: 0.6 + s * 0.4, color: B.crystal }); else W._rock({ x, z, y, s: 0.6 + s * 0.5 });
    };
    // islote lateral: a veces alcanzable, siempre con chispas, para que el mapa se vea lleno
    const sideIsle = () => {
      const lat = (R() < 0.5 ? -1 : 1) * (7 + R() * 9), up = (R() - 0.3) * 4;
      const p = at(-2 - R() * 4, lat, up), w = 3 + R() * 4;
      island(p.x, p.y, p.z, w, w, { pl: this.cur.len });
      if (R() < 0.6) deco(p.x + (R() - 0.5) * w * 0.4, p.y, p.z + (R() - 0.5) * w * 0.4, R());
      orb(p.x, p.y, p.z); if (R() < 0.5) orb(p.x + 1, p.y, p.z + 1);
    };
    // fondo: islas lejanas sin colisión para dar sensación de mapa enorme
    const farIsle = () => {
      const lat = (R() < 0.5 ? -1 : 1) * (28 + R() * 40), p = at(-R() * 30, lat, (R() - 0.5) * 24), w = 6 + R() * 14;
      const m = new THREE.Mesh(new THREE.ConeGeometry(w * 0.55, w * 0.9, 7), new THREE.MeshStandardMaterial({ color: B.side, flatShading: true, roughness: 1 }));
      m.rotation.x = Math.PI; m.position.set(p.x, p.y - w * 0.45, p.z); g.add(m);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.58, w * 0.55, 0.6, 7), new THREE.MeshStandardMaterial({ color: B.top, flatShading: true })); cap.position.set(p.x, p.y + 0.1, p.z); g.add(cap);
    };

    // bandera de control al principio del sector
    const startP = at(0); const sb = island(startP.x, startP.y, startP.z - 0, 7, 7, { pl: this.cur.len });
    flags.push(this._flag(g, startP.x + 2.2, startP.y, startP.z, id, this.cur.len, this.cur.h));
    orb(startP.x - 1.5, startP.y, startP.z);
    advance(3.5);
    for (let k = 0; k < 2 + Math.floor(R() * 2); k++) farIsle();

    const kinds = ['stones', 'stairs', 'mover', 'crumble', 'updraft', 'arena', 'pendulum', 'zigzag'];
    if (B.jets) kinds.push('jets', 'jets');
    for (let sgi = 0; sgi < SECTOR_SEGS; sgi++) {
      // curva suave del camino (sin alejarse demasiado de la dirección inicial)
      if (R() < 0.35) this.cur.h = Math.max(-0.9, Math.min(0.9, this.cur.h + (R() - 0.5) * 0.7));
      const kind = sgi === SECTOR_SEGS - 1 ? 'stones' : kinds[Math.floor(R() * kinds.length)];
      const gap = () => 2.0 + R() * (1.0 + d * 1.2);
      if (kind === 'stones') {
        const n = 3 + Math.floor(R() * 3);
        for (let i = 0; i < n; i++) { const w = 3.4 - d * 0.8 + R() * 1.2; advance(gap() + w / 2, (R() - 0.45) * 1.2); const p = at(0, (R() - 0.5) * 2); island(p.x, p.y, p.z, w, w); if (R() < 0.7) orb(p.x, p.y, p.z); if (R() < 0.25) deco(p.x + w * 0.25, p.y, p.z + w * 0.25, 0.3); advance(w / 2); }
      }
      if (kind === 'stairs') {
        const n = 3 + Math.floor(R() * 3);
        for (let i = 0; i < n; i++) { advance(1.6 + R() * 0.6 + 1.3, 1.1); const p = at(0); island(p.x, p.y, p.z, 2.6, 2.6, { depth: 1.2 }); if (i === n - 1) orb(p.x, p.y, p.z); advance(1.3); }
        advance(2.2 + 2.5, -0.4); const p = at(0); island(p.x, p.y, p.z, 5, 5); deco(p.x, p.y, p.z, R()); advance(2.5);
      }
      if (kind === 'mover') {
        this.cur.h = 0; // la plataforma va y viene en línea recta con el camino
        advance(2.5); const p0 = at(0); // plataforma que va y viene sobre un hueco grande
        const span = 8 + d * 4; const mid = at(span / 2);
        const f = fwd(); const axis = Math.abs(f.x) > Math.abs(f.z) ? 'x' : 'z';
        W._mover({ x: mid.x, y: mid.y, z: mid.z, w: 3, d: 3, axis, range: span / 2 - 1.2, speed: 0.55 + d * 0.35, phase: R() * 6, color: B.side });
        P.boxes[P.boxes.length - 1].pl = this.cur.len + span / 2;
        orb(mid.x, mid.y + 0.5, mid.z);
        advance(span + 2.5); const p = at(0); island(p.x, p.y, p.z, 5, 5); advance(2.5);
        void p0;
      }
      if (kind === 'crumble') {
        const n = 3 + Math.floor(R() * 2 + d * 2);
        for (let i = 0; i < n; i++) { advance(2.2 + R() * 0.6 + 1.3, (R() - 0.5) * 0.6); const p = at(0); W.hz._crumble({ x: p.x, y: p.y, z: p.z, w: 2.6, d: 2.6, delay: 0.85 - d * 0.25, color: B.jets ? 0xc4553a : B.side }); P.boxes[P.boxes.length - 1].pl = this.cur.len; orb(p.x, p.y, p.z); advance(1.3); }
        advance(2.2 + 2.5); const p = at(0); island(p.x, p.y, p.z, 5, 5); advance(2.5);
      }
      if (kind === 'updraft') { // corriente de aire: sube y planea hasta la isla siguiente
        advance(2.5); const p = at(0); island(p.x, p.y, p.z, 5, 5);
        W._updraft({ x: p.x, z: p.z, y0: p.y, y1: p.y + 9, color: 0xffffff });
        const far = 11 + R() * 4 + d * 3; advance(far, 2 + R() * 2); const q = at(0); island(q.x, q.y, q.z, 5.5, 5.5); orb(q.x, q.y, q.z); deco(q.x + 1.5, q.y, q.z - 1.2, R());
        const mid = at(-far / 2, 0, 3); orb(mid.x, mid.y, mid.z); orb(mid.x, mid.y + 2, mid.z);
        advance(2.75);
      }
      if (kind === 'arena') { // isla ancha con enemigos y vasijas
        advance(gap() + 6); const p = at(0); island(p.x, p.y, p.z, 12, 12, { depth: 4 });
        const nE = 1 + Math.floor(R() * (2 + d * 3));
        for (let i = 0; i < nE; i++) {
          const t = B.foes[Math.floor(R() * B.foes.length)], q = at((R() - 0.5) * 6, (R() - 0.5) * 7);
          const e = t === 'avispa' ? C.combat.addEnemy('avispa', q.x, q.y + 1.8, q.z, { r: 2.5, speed: 0.8 }) : C.combat.addEnemy(t, q.x, q.y, q.z);
          e.sight = 14; e.leash = 9; enemies.push(e);
        }
        for (let i = 0; i < 2; i++) { const q = at(-4 + i * 8, 4.5 * (i ? 1 : -1)); W._breakable({ id: `inf_${id}_${sgi}_${i}`, x: q.x, y: q.y, z: q.z, kind: R() < 0.3 ? 'cofre' : 'vasija', loot: R() < 0.5 ? 'corazon' : undefined }, null); }
        deco(at(4, -4).x, p.y, at(4, -4).z, R()); orb(p.x, p.y, p.z);
        advance(6);
      }
      if (kind === 'jets') { // camino largo con chorros de fuego
        advance(gap() + 4); const p = at(0); island(p.x, p.y, p.z, 8, 8);
        for (let i = -1; i <= 1; i += 2) { const q = at(i * 1.9, -i * 0.8); W.hz._jet({ x: q.x, y: q.y, z: q.z, h: 5, period: 2.6 - d * 0.6, on: 1, phase: R() * 3 }); }
        orb(p.x, p.y, p.z); advance(4);
      }
      if (kind === 'pendulum') {
        advance(gap() + 3.5); const p = at(0); island(p.x, p.y, p.z, 7, 7);
        const f = fwd(); const axis = Math.abs(f.x) > Math.abs(f.z) ? 'z' : 'x';
        W.hz._pendulum({ x: p.x, y: p.y, z: p.z, len: 4.5, axis, amp: 1.0, speed: 1.6 + d, phase: R() * 6 });
        orb(p.x, p.y, p.z); advance(3.5);
      }
      if (kind === 'zigzag') { // islas a un lado y a otro
        const n = 4 + Math.floor(R() * 2);
        for (let i = 0; i < n; i++) { advance(2.4 + R() * 0.8, (R() - 0.4) * 0.8); const p = at(0, (i % 2 ? 1 : -1) * 2.6); island(p.x, p.y, p.z, 2.8, 2.8); if (i % 2) orb(p.x, p.y, p.z); advance(1.4); }
      }
      // islotes laterales y fondo: el mapa siempre está lleno
      if (R() < 0.75) sideIsle();
      if (R() < 0.45) sideIsle();
      if (R() < 0.5) farIsle();
    }
    advance(3.5);
    W._scatter({ islands: islandsForGrass, seed: id + 3 });
    W.root = keepRoot; W.hz.root = keepHz;
    const sec = {
      id, g, biome: B, startLen: sb.pl, minY, endLen: this.cur.len, enemies, orbs, flags,
      boxes: P.boxes.slice(mark.boxes), anim: W.animated.slice(mark.anim), up: W.updrafts.slice(mark.up), mov: W.movers.slice(mark.mov),
      br: W.breakables.slice(mark.br), cr: W.hz.crumbles.slice(mark.cr), jets: W.hz.jets.slice(mark.jets), pends: W.hz.pends.slice(mark.pends),
    };
    for (const e of enemies) e.sector = id;
    this.sectors.push(sec);
    return sec;
  }
  _unload(sec) {
    const C = this.C, W = C.world, P = C.physics;
    const prune = (arr, items) => { if (!items.length) return; const S = new Set(items); for (let i = arr.length - 1; i >= 0; i--) if (S.has(arr[i])) arr.splice(i, 1); };
    prune(P.boxes, sec.boxes); prune(W.animated, sec.anim); prune(W.updrafts, sec.up); prune(W.movers, sec.mov); prune(W.breakables, sec.br);
    prune(W.hz.crumbles, sec.cr); prune(W.hz.jets, sec.jets); prune(W.hz.pends, sec.pends);
    for (const e of sec.enemies) if (e.alive) { e.alive = false; C.combat.root.remove(e.group); }
    C.combat.enemies = C.combat.enemies.filter(e => e.sector !== sec.id);
    sec.g.parent && sec.g.parent.remove(sec.g);
    sec.g.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }

  _orb(g, x, y, z, color) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: color, emissiveIntensity: 1.5, flatShading: true }));
    m.position.set(x, y, z); g.add(m);
    return { m, base: y, taken: false };
  }
  _flag(g, x, y, z, id, pl, h = 0) {
    const f = new THREE.Group(); f.position.set(x, y, z); g.add(f);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3, 8), new THREE.MeshStandardMaterial({ color: 0x8a6a4a })); pole.position.y = 1.5; f.add(pole);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7), new THREE.MeshStandardMaterial({ color: 0x9a9a9a, side: THREE.DoubleSide, emissive: 0x000000 })); cloth.position.set(0.55, 2.6, 0); f.add(cloth);
    return { f, cloth, pos: new THREE.Vector3(x - 2.2, y, z), id, pl, h, lit: id === 0 };
  }
  _biomeFx(sectorId, instant = false) {
    const B = this.biomeOf(sectorId);
    if (this.skyNow === B) return;
    this.skyNow = B;
    this.C.setSky(B.sky[0], B.sky[1], B.sky[2], instant);
    this.C.setMusic(B.music);
    if (!instant) this.C.banner(B.name, `Sector ${sectorId + 1}`);
  }

  // ---------- cada fotograma ----------
  update(dt, t) {
    if (!this.active || this.over) return;
    const C = this.C, pl = C.player;
    // distancia: el punto del camino más lejano que has pisado
    if (pl.grounded && pl.ground && pl.ground.pl !== undefined) this.dist = Math.max(this.dist, pl.ground.pl);
    // sector en el que estás
    const here = this.sectors.find(s => this.dist >= s.startLen - 1 && this.dist < s.endLen) || (this.dist < this.sectors[0].startLen ? this.sectors[0] : this.sectors[this.sectors.length - 1]);
    if (here && here.id !== this.sectorNow) { this.sectorNow = here.id; this._biomeFx(here.id); }
    // crear por delante y borrar lo que quedó muy atrás
    const last = this.sectors[this.sectors.length - 1];
    if (last.endLen - this.dist < 140) this._makeSector();
    while (this.sectors.length > 4 && this.sectors[1].endLen < this.dist - 40) this._unload(this.sectors.shift());
    // chispas y banderas
    for (const s of this.sectors) {
      for (const o of s.orbs) {
        if (o.taken) continue;
        o.m.rotation.y += dt * 2; o.m.position.y = o.base + Math.sin(t * 3 + o.base) * 0.12;
        if (Math.abs(o.m.position.x - pl.pos.x) < 1 && Math.abs(o.m.position.z - pl.pos.z) < 1 && Math.abs(o.m.position.y - 1 - pl.pos.y) < 1.4) {
          o.taken = true; o.m.visible = false; this.chispas++; C.audio.play('crystal'); C.fx.sparkle(o.m.position, 10, 0xffffff);
          if (this.chispas % 40 === 0) { pl.heal(1); C.toast(`✦ ${this.chispas} chispas: ¡un corazón!`); C.audio.play('heal'); }
        }
      }
      for (const f of s.flags) {
        f.cloth.rotation.y = Math.sin(t * 3 + f.id) * 0.25;
        if (!f.lit && pl.pos.distanceTo(f.pos) < 4.5) {
          f.lit = true; f.cloth.material.color.setHex(0xffd27a); f.cloth.material.emissive.setHex(0x8a5a10);
          this.spawn = { x: f.pos.x, y: f.pos.y + 0.05, z: f.pos.z, f: f.h };
          C.audio.play('checkpoint'); C.fx.sparkle(f.f.position.clone().setY(f.f.position.y + 2.5), 20, 0xffd27a);
          C.toast(`Bandera del sector ${f.id + 1} · ${Math.round(this.dist)} m`);
        }
      }
    }
  }
  respawnPoint() { return this.spawn; }
}
