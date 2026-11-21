import * as THREE from 'three';

// Efectos «de cine» para la versión HD: círculos mágicos en el suelo, ondas de choque, destellos de impacto,
// chispas que brillan (bloom), cortes de espada con degradado y motas de luz flotando en el aire.
// Todo es aditivo (suma luz) para que el post-proceso de resplandor lo haga brillar.

const TEX = {};
function canvasTex(key, size, draw) {
  if (TEX[key]) return TEX[key];
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); draw(g, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (TEX[key] = t);
}
export const glowTex = () => canvasTex('glow', 64, (g, s) => {
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.18, 'rgba(255,255,255,0.85)');
  r.addColorStop(0.45, 'rgba(255,255,255,0.25)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
});
export const smokeTex = () => canvasTex('smoke', 64, (g, s) => {
  for (let i = 0; i < 7; i++) {
    const x = s / 2 + (Math.random() - 0.5) * s * 0.3, y = s / 2 + (Math.random() - 0.5) * s * 0.3, rr = s * (0.22 + Math.random() * 0.18);
    const r = g.createRadialGradient(x, y, 0, x, y, rr);
    r.addColorStop(0, 'rgba(255,255,255,0.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, s, s);
  }
});
const starTex = () => canvasTex('star', 128, (g, s) => {
  const c = s / 2;
  const r = g.createRadialGradient(c, c, 0, c, c, c);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.12, 'rgba(255,255,255,0.7)'); r.addColorStop(0.4, 'rgba(255,255,255,0.08)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
  g.globalCompositeOperation = 'lighter';
  for (const [w, h] of [[s, 3], [3, s]]) { // destello en cruz
    const l = g.createLinearGradient(c - w / 2, c - h / 2, c + w / 2, c + h / 2);
    l.addColorStop(0, 'rgba(255,255,255,0)'); l.addColorStop(0.5, 'rgba(255,255,255,0.9)'); l.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = l; g.fillRect(c - w / 2, c - h / 2, w, h);
  }
});
const ringTex = () => canvasTex('ring', 256, (g, s) => {
  const c = s / 2, r = g.createRadialGradient(c, c, 0, c, c, c);
  r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.72, 'rgba(255,255,255,0)'); r.addColorStop(0.9, 'rgba(255,255,255,0.9)');
  r.addColorStop(0.95, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
});
// círculo mágico con runas (como los hechizos del suelo en los juegos de fantasía)
const runeTex = () => canvasTex('rune', 512, (g, s) => {
  const c = s / 2; g.translate(c, c); g.strokeStyle = 'white'; g.fillStyle = 'white'; g.shadowColor = 'white'; g.shadowBlur = 10;
  const circ = (r, w) => { g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); };
  circ(c * 0.96, 5); circ(c * 0.86, 2); circ(c * 0.58, 3); circ(c * 0.5, 1.5); circ(c * 0.18, 3);
  // runas entre los dos anillos exteriores
  g.font = `${Math.round(s * 0.055)}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
  for (let i = 0; i < 24; i++) { g.save(); g.rotate(i / 24 * Math.PI * 2); g.fillText(runes[i % runes.length], 0, -c * 0.91); g.restore(); }
  // estrella de seis puntas y radios
  g.lineWidth = 3;
  for (const off of [0, Math.PI / 3]) { g.beginPath(); for (let i = 0; i <= 3; i++) { const a = off + i * Math.PI * 2 / 3 - Math.PI / 2; const x = Math.cos(a) * c * 0.58, y = Math.sin(a) * c * 0.58; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  g.lineWidth = 1.5; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * c * 0.18, Math.sin(a) * c * 0.18); g.lineTo(Math.cos(a) * c * 0.5, Math.sin(a) * c * 0.5); g.stroke(); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; g.beginPath(); g.arc(Math.cos(a) * c * 0.72, Math.sin(a) * c * 0.72, c * 0.07, 0, Math.PI * 2); g.stroke(); }
});
// corte de espada: banda brillante con el filo exterior más intenso
export const slashTex = () => canvasTex('slash', 256, (g, s) => {
  const c = s / 2, r = g.createRadialGradient(c, c, 0, c, c, c);
  r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.5, 'rgba(255,255,255,0)'); r.addColorStop(0.78, 'rgba(255,255,255,0.25)');
  r.addColorStop(0.94, 'rgba(255,255,255,1)'); r.addColorStop(0.985, 'rgba(255,255,255,0.6)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
});

const addMat = (map, color, opacity = 1) => new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
const sprMat = (map, color, opacity = 1) => new THREE.SpriteMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });

export class VFX {
  constructor(scene) {
    this.scene = scene; this.items = [];
    this.plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    // reserva de chispas (sprites que brillan)
    this.sparks = [];
    for (let i = 0; i < 160; i++) {
      const s = new THREE.Sprite(sprMat(glowTex(), 0xffffff, 1)); s.visible = false; scene.add(s);
      this.sparks.push({ s, vel: new THREE.Vector3(), life: 0, max: 1, size: 0.2, grav: 0, drag: 0.2 });
    }
    this.nextSpark = 0; this.motes = null; this.moteColor = new THREE.Color(0x9fd8ff);
  }
  _add(obj, life, upd) { this.scene.add(obj); this.items.push({ obj, life, max: life, upd }); return obj; }

  // círculo de runas en el suelo que aparece girando y se desvanece (al lanzar poderes)
  circle(pos, color = 0x6fd8ff, r = 2.4, life = 1.1) {
    const m = new THREE.Mesh(this.plane, addMat(runeTex(), color, 1));
    m.position.set(pos.x, pos.y + 0.06, pos.z); m.renderOrder = 5;
    const glow = new THREE.Mesh(this.plane, addMat(glowTex(), color, 0.55)); glow.position.y = 0.01; m.add(glow);
    this._add(m, life, (k, dt) => {
      const a = Math.min(1, k * 5); m.scale.setScalar(r * 2 * (0.6 + 0.4 * (1 - Math.pow(1 - a, 3))));
      m.rotation.y += dt * 1.6; glow.rotation.y -= dt * 3;
      m.material.opacity = (k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
      glow.material.opacity = 0.55 * m.material.opacity * (0.8 + Math.sin(k * 30) * 0.2);
    });
    // columna de luz que sube
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, rr = r * (0.3 + Math.random() * 0.7);
      this.spark(new THREE.Vector3(pos.x + Math.cos(a) * rr, pos.y + 0.1, pos.z + Math.sin(a) * rr), new THREE.Vector3(0, 2 + Math.random() * 3, 0), color, 0.18, 0.6 + Math.random() * 0.5, 0, 0.5);
    }
  }
  // columna de luz que sube con una espiral de chispas (al tocar un Sello)
  ascend(pos, color = 0xbff4ff, dur = 2.4, r = 1.6) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r, 22, 24, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    col.position.set(pos.x, pos.y + 11, pos.z);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.18, r * 0.3, 22, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    col.add(core);
    let acc = 0;
    this._add(col, dur, (k, dt) => {
      const a = k < 0.15 ? k / 0.15 : k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      col.material.opacity = 0.32 * a; core.material.opacity = 0.7 * a; col.scale.set(0.6 + a * 0.4, 0.2 + Math.min(1, k * 4) * 0.8, 0.6 + a * 0.4);
      col.position.y = pos.y + 11 * col.scale.y; col.rotation.y += dt * 2;
      acc += dt; while (acc > 0.02 && k < 0.8) { acc -= 0.02;
        const t = k * dur * 7, rr = r * (1.1 + Math.random() * 0.4);
        this.spark(new THREE.Vector3(pos.x + Math.cos(t) * rr, pos.y + 0.2, pos.z + Math.sin(t) * rr), new THREE.Vector3(-Math.sin(t) * 1.5, 5 + Math.random() * 4, Math.cos(t) * 1.5), Math.random() < 0.3 ? 0xffffff : color, 0.22, 1.1 + Math.random() * 0.6, 0, 0.1);
        this.spark(new THREE.Vector3(pos.x - Math.cos(t) * rr, pos.y + 0.2, pos.z - Math.sin(t) * rr), new THREE.Vector3(Math.sin(t) * 1.5, 5 + Math.random() * 4, -Math.cos(t) * 1.5), 0xffe7a0, 0.18, 1.1 + Math.random() * 0.6, 0, 0.1);
      }
    });
  }
  // onda de choque que se expande sobre el suelo
  shock(pos, color = 0xffffff, r = 4, life = 0.5, y = 0.08) {
    const m = new THREE.Mesh(this.plane, addMat(ringTex(), color, 1));
    m.position.set(pos.x, pos.y + y, pos.z);
    this._add(m, life, k => { const e = 1 - Math.pow(1 - k, 3); m.scale.setScalar(0.3 + r * 2 * e); m.material.opacity = (1 - k) * (1 - k); });
  }
  // destello en cruz en el punto de impacto
  flash(pos, color = 0xffffff, size = 1.6, life = 0.16) {
    const s = new THREE.Sprite(sprMat(starTex(), color, 1)); s.position.copy(pos);
    s.material.rotation = Math.random() * Math.PI;
    this._add(s, life, k => { s.scale.setScalar(size * (0.4 + k * 0.9)); s.material.opacity = 1 - k; });
  }
  spark(pos, vel, color, size = 0.15, life = 0.5, grav = -6, drag = 0.25) {
    const p = this.sparks[this.nextSpark]; this.nextSpark = (this.nextSpark + 1) % this.sparks.length;
    p.s.position.copy(pos); p.vel.copy(vel); p.life = p.max = life; p.size = size; p.grav = grav; p.drag = drag;
    p.s.material.color.set(color); p.s.visible = true;
  }
  // estallido de chispas (golpes, muertes, cristales)
  burst(pos, color = 0xffffff, n = 16, power = 1, size = 0.16) {
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 - 0.15, Math.random() - 0.5).normalize().multiplyScalar((3 + Math.random() * 5) * power);
      this.spark(pos, v, color, size * (0.6 + Math.random() * 0.8), 0.3 + Math.random() * 0.4, -9, 0.08);
    }
  }
  // impacto completo: destello + chispas + anillo pequeño
  impact(pos, color = 0xffffff, heavy = false) {
    this.flash(pos, color, heavy ? 2.4 : 1.5);
    this.burst(pos, color, heavy ? 22 : 12, heavy ? 1.3 : 1);
    if (heavy) this.shock(pos.clone().setY(pos.y - 0.5), color, 2.2, 0.35);
  }
  // halo y estela para un proyectil (se llama cada cuadro)
  trailAt(pos, color, size = 0.5) {
    if (Math.random() < 0.6) this.spark(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.15)), new THREE.Vector3(0, 0.3, 0), color, size * 0.5, 0.35, 0, 0.5);
  }
  // motas de luz que flotan alrededor de la cámara (polvo mágico en el aire)
  setMotes(color, n = 140) {
    if (!this.motes) {
      const geo = new THREE.BufferGeometry(), P = new Float32Array(n * 3), S = new Float32Array(n);
      for (let i = 0; i < n; i++) { P[i * 3] = (Math.random() - 0.5) * 40; P[i * 3 + 1] = Math.random() * 12 - 2; P[i * 3 + 2] = (Math.random() - 0.5) * 40; S[i] = Math.random() * 6.28; }
      geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('seed', new THREE.BufferAttribute(S, 1));
      const mat = new THREE.PointsMaterial({ size: 0.22, map: glowTex(), color, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, toneMapped: false });
      this.motes = new THREE.Points(geo, mat); this.motes.frustumCulled = false; this.scene.add(this.motes);
    }
    this.motes.material.color.set(color); this.motes.visible = color !== null;
  }
  update(dt, center) {
    for (const it of this.items) {
      it.life -= dt; const k = 1 - Math.max(0, it.life) / it.max;
      it.upd(k, dt);
      if (it.life <= 0) { this.scene.remove(it.obj); it.obj.material && it.obj.material.dispose(); it.done = true; }
    }
    if (this.items.some(i => i.done)) this.items = this.items.filter(i => !i.done);
    for (const p of this.sparks) {
      if (p.life <= 0) continue;
      p.life -= dt; if (p.life <= 0) { p.s.visible = false; continue; }
      p.vel.y += p.grav * dt; p.vel.multiplyScalar(Math.pow(p.drag, dt)); p.s.position.addScaledVector(p.vel, dt);
      const k = 1 - p.life / p.max; p.s.scale.setScalar(p.size * (1 - k * 0.6)); p.s.material.opacity = 1 - k * k;
    }
    if (this.motes && this.motes.visible && center) { // las motas siguen a la cámara y flotan
      const P = this.motes.geometry.attributes.position, S = this.motes.geometry.attributes.seed, t = performance.now() / 1000;
      for (let i = 0; i < P.count; i++) {
        let x = P.getX(i), y = P.getY(i), z = P.getZ(i); const sd = S.getX(i);
        x += Math.sin(t * 0.3 + sd) * dt * 0.4; y += (0.12 + Math.sin(t * 0.7 + sd * 3) * 0.1) * dt; z += Math.cos(t * 0.25 + sd) * dt * 0.4;
        if (x - center.x > 20) x -= 40; if (center.x - x > 20) x += 40;
        if (z - center.z > 20) z -= 40; if (center.z - z > 20) z += 40;
        if (y - center.y > 10) y -= 12; if (center.y - y > 3) y += 12;
        P.setXYZ(i, x, y, z);
      }
      P.needsUpdate = true;
      this.motes.material.opacity = 0.55 + Math.sin(t * 2) * 0.15;
    }
  }
  clear() {
    for (const it of this.items) this.scene.remove(it.obj); this.items = [];
    for (const p of this.sparks) { p.life = 0; p.s.visible = false; }
  }
}
