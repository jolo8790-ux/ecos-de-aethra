// Física simple y predecible para un juego de aventura:
// cajas sólidas (AABB) y rampas caminables. El jugador es un cilindro (radio + altura).

export const STEP_HEIGHT = 0.42;   // altura máxima que se sube sin saltar (escalones)

export class Physics {
  constructor() {
    this.boxes = [];   // {minX,minY,minZ,maxX,maxY,maxZ, moving?:obj}
    this.ramps = [];   // {minX,maxX,minZ,maxZ, y0, y1, axis:'x'|'z'}  y0 en el lado min, y1 en el lado max
  }
  clear() { this.boxes.length = 0; this.ramps.length = 0; }

  addBox(cx, cy, cz, w, h, d, extra = {}) {
    const b = { minX: cx - w / 2, maxX: cx + w / 2, minY: cy - h / 2, maxY: cy + h / 2, minZ: cz - d / 2, maxZ: cz + d / 2, ...extra };
    this.boxes.push(b);
    return b;
  }
  addRamp(r) { this.ramps.push(r); return r; }

  rampHeight(r, x, z) {
    if (x < r.minX || x > r.maxX || z < r.minZ || z > r.maxZ) return -Infinity;
    const t = r.axis === 'x' ? (x - r.minX) / (r.maxX - r.minX) : (z - r.minZ) / (r.maxZ - r.minZ);
    return r.y0 + (r.y1 - r.y0) * t;
  }

  // Superficie caminable más alta bajo (x,z) que no esté por encima de maxY.
  groundAt(x, z, radius, maxY) {
    let best = -Infinity, hit = null;
    const rr = radius * 0.75;
    for (const b of this.boxes) {
      if (b.off) continue;
      if (x + rr <= b.minX || x - rr >= b.maxX || z + rr <= b.minZ || z - rr >= b.maxZ) continue;
      if (b.maxY <= maxY && b.maxY > best) { best = b.maxY; hit = b; }
    }
    for (const r of this.ramps) {
      const h = this.rampHeight(r, x, z);
      if (h <= maxY && h > best) { best = h; hit = r; }
    }
    return { y: best, obj: hit };
  }

  // Mueve el cuerpo (pos = pies) por un eje, resolviendo choques con cajas.
  // Devuelve true si chocó con una pared.
  moveHorizontal(pos, axis, amount, radius, height, grounded) {
    if (amount === 0) return false;
    pos[axis] += amount;
    let blocked = false;
    for (const b of this.boxes) {
      if (b.off) continue;
      if (pos.x + radius <= b.minX || pos.x - radius >= b.maxX || pos.z + radius <= b.minZ || pos.z - radius >= b.maxZ) continue;
      if (pos.y + height <= b.minY + 0.001 || pos.y >= b.maxY - 0.001) continue;
      // ¿es un escalón que se puede subir?
      const rise = b.maxY - pos.y;
      if (grounded && rise <= STEP_HEIGHT && !this._blockedAbove(pos, radius, height, b.maxY)) {
        pos.y = b.maxY;
        continue;
      }
      if (axis === 'x') pos.x = amount > 0 ? b.minX - radius - 0.0005 : b.maxX + radius + 0.0005;
      else pos.z = amount > 0 ? b.minZ - radius - 0.0005 : b.maxZ + radius + 0.0005;
      blocked = true;
    }
    return blocked;
  }

  _blockedAbove(pos, radius, height, newFeet) {
    for (const b of this.boxes) {
      if (b.off) continue;
      if (pos.x + radius <= b.minX || pos.x - radius >= b.maxX || pos.z + radius <= b.minZ || pos.z - radius >= b.maxZ) continue;
      if (b.minY < newFeet + height && b.maxY > newFeet + 0.001) return true;
    }
    return false;
  }

  // Techo: la caja más baja cuyo fondo está sobre la cabeza.
  ceilingAt(pos, radius, headY) {
    let best = Infinity;
    for (const b of this.boxes) {
      if (b.off) continue;
      if (pos.x + radius <= b.minX || pos.x - radius >= b.maxX || pos.z + radius <= b.minZ || pos.z - radius >= b.maxZ) continue;
      if (b.minY >= headY - 0.05 && b.minY < best) best = b.minY;
    }
    return best;
  }

  // Rayo contra cajas (para que la cámara no atraviese paredes). Devuelve distancia o Infinity.
  raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    let best = maxDist;
    for (const b of this.boxes) {
      if (b.noCamera || b.off) continue;
      let tmin = 0, tmax = best;
      const axes = [[ox, dx, b.minX, b.maxX], [oy, dy, b.minY, b.maxY], [oz, dz, b.minZ, b.maxZ]];
      let ok = true;
      for (const [o, d, mn, mx] of axes) {
        if (Math.abs(d) < 1e-8) { if (o < mn || o > mx) { ok = false; break; } continue; }
        let t1 = (mn - o) / d, t2 = (mx - o) / d;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        if (tmin > tmax) { ok = false; break; }
      }
      if (ok && tmin > 0 && tmin < best) best = tmin;
    }
    return best;
  }
}
