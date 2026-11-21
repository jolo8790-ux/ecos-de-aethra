// «Aethra HD»: capa visual experimental (rama visual-hd). No cambia la jugabilidad, solo cómo se ve:
//  · cielo pintado con sol, halo y nubes altas
//  · mar de nubes volumétrico con cimas iluminadas por el sol (en lugar del plano facetado)
//  · cúmulos suaves hechos de «bocanadas» en vez de esferas
//  · luz de borde cálida en todo (personajes y escenario se despegan del fondo)
//  · corrección de color cinematográfica + viñeta (con el resplandor en calidad Alta)
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// sol «visual» compartido (bajo, de amanecer); el sol de las sombras sigue siendo el de siempre
export const HD = { sunDir: new THREE.Vector3(0.55, 0.16, -0.82).normalize(), sunCol: new THREE.Color(0xffd9a0), on: true };

// ---------- ruido compartido (GLSL) ----------
const NOISE = /* glsl */`
float hdHash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float hdNoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hdHash(i), hdHash(i+vec2(1,0)), u.x), mix(hdHash(i+vec2(0,1)), hdHash(i+vec2(1,1)), u.x), u.y); }
float hdFbm(vec2 p){ float v = 0.0, a = 0.5; mat2 r = mat2(0.8,-0.6,0.6,0.8); for (int i=0;i<5;i++){ v += a*hdNoise(p); p = r*p*2.03 + 17.1; a *= 0.5; } return v; }
`;

// ---------- luz de borde en todos los materiales estándar ----------
// (se inyecta en el código de sombreado común de three.js antes de que se compile nada)
let rimPatched = false;
export function patchRim() {
  if (rimPatched) return; rimPatched = true;
  THREE.ShaderChunk.emissivemap_fragment += /* glsl */`
  #if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG ) || defined( TOON )
  {
    vec3 hdV = normalize( vViewPosition );
    float hdRim = pow( 1.0 - clamp( dot( normal, hdV ), 0.0, 1.0 ), 3.0 );
    vec3 hdUp = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
    hdRim *= 1.0 - smoothstep( 0.35, 0.8, dot( normal, hdUp ) ); // el suelo no se ilumina de borde
    totalEmissiveRadiance += vec3( 1.0, 0.82, 0.6 ) * hdRim * 0.09;
  }
  #endif
  `;
}

// ---------- cielo ----------
export function upgradeSky(skyMat) {
  skyMat.uniforms.sunDir = { value: new THREE.Vector3(0.45, 0.35, -0.8).normalize() };
  skyMat.uniforms.sunCol = { value: new THREE.Color(0xffe2b0) };
  skyMat.uniforms.horizon = { value: new THREE.Color(0xffd9a8) };
  skyMat.uniforms.uTime = { value: 0 };
  skyMat.uniforms.warm = { value: 1 };
  skyMat.fragmentShader = NOISE + /* glsl */`
  uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunCol; uniform vec3 horizon; uniform float uTime; uniform float warm;
  varying vec3 vP;
  void main(){
    vec3 d = normalize(vP);
    float h = clamp(d.y*1.4+0.25, 0.0, 1.0);
    vec3 col = mix(bottom, top, pow(h, 0.85));
    // banda cálida en el horizonte, más fuerte del lado del sol
    float sd = max(dot(d, sunDir), 0.0);
    float band = exp(-abs(d.y + 0.02) * 7.0);
    col = mix(col, horizon, band * (0.18 + 0.5 * pow(sd, 2.0)) * warm);
    // sol: disco + halo
    col += sunCol * (pow(sd, 900.0) * 3.0 + pow(sd, 40.0) * 0.45 + pow(sd, 6.0) * 0.18) * warm;
    // nubes altas (cirros) que se mueven despacio
    if (d.y > 0.02) {
      vec2 uv = d.xz / (d.y + 0.25) * 1.6 + vec2(uTime * 0.004, uTime * 0.002);
      float n = hdFbm(uv * 1.3);
      float c = smoothstep(0.58, 0.9, n) * smoothstep(0.04, 0.3, d.y);
      vec3 cc = mix(vec3(1.0), sunCol, 0.35 + 0.5 * pow(sd, 3.0));
      col = mix(col, cc, c * 0.45);
    }
    gl_FragColor = vec4(col, 1.0);
  }`;
  skyMat.needsUpdate = true;
}

// ---------- mar de nubes ----------
export function makeCloudSea({ y, color, size = 900, sunDir, sunCol }) {
  const geo = new THREE.PlaneGeometry(size, size, 160, 160);
  geo.rotateX(-Math.PI / 2);
  const base = new THREE.Color(color ?? 0xeaf2ff).lerp(new THREE.Color(0xffffff), 0.3);
  const mat = new THREE.ShaderMaterial({
    fog: true, transparent: false,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, base: { value: base }, sunDir: { value: sunDir }, sunCol: { value: sunCol },
      shade: { value: new THREE.Color(base).lerp(new THREE.Color(0x6f6aa8), 0.5) },
    }]),
    vertexShader: NOISE + /* glsl */`
    uniform float uTime; varying vec3 vW; varying float vH;
    #include <fog_pars_vertex>
    void main(){
      vec3 p = position; vec4 w = modelMatrix * vec4(p, 1.0);
      vec2 q = w.xz * 0.035 + vec2(uTime * 0.012, uTime * 0.006);
      float h = hdFbm(q); h = smoothstep(0.25, 0.95, h);
      w.y += (h - 1.0) * 7.0; vH = h; vW = w.xyz; // las cimas llegan justo al nivel del mar de nubes
      vec4 mvPosition = viewMatrix * w;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`,
    fragmentShader: NOISE + /* glsl */`
    uniform float uTime; uniform vec3 base; uniform vec3 shade; uniform vec3 sunDir; uniform vec3 sunCol;
    varying vec3 vW; varying float vH;
    #include <fog_pars_fragment>
    float hgt(vec2 x){ return smoothstep(0.25, 0.95, hdFbm(x*0.035 + vec2(uTime*0.012, uTime*0.006))) * 7.0 + hdFbm(x*0.16 + uTime*0.02) * 1.6; }
    void main(){
      // normal a partir de la altura (bultos esponjosos)
      float e = 0.6; float h0 = hgt(vW.xz);
      vec3 n = normalize(vec3((h0 - hgt(vW.xz + vec2(e,0.0))) * 2.6, e, (h0 - hgt(vW.xz + vec2(0.0,e))) * 2.6));
      float lit = clamp(dot(n, normalize(sunDir)) * 0.6 + 0.45, 0.0, 1.0);
      vec3 col = mix(shade, base, smoothstep(0.2, 0.9, lit));
      col = mix(col, shade * 0.92, (1.0 - smoothstep(0.0, 0.7, vH)) * 0.55); // valles más sombreados
      // cimas encendidas por el sol + destello hacia la cámara
      vec3 V = normalize(cameraPosition - vW);
      float fwd = pow(max(dot(-V, normalize(sunDir)), 0.0), 6.0);
      col += sunCol * (pow(lit, 6.0) * 0.35 * smoothstep(0.3, 1.0, vH) + fwd * 0.25);
      float fres = pow(1.0 - max(dot(n, V), 0.0), 4.0);
      col += sunCol * fres * 0.12;
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`,
  });
  const m = new THREE.Mesh(geo, mat); m.position.y = y; m.receiveShadow = false; m.frustumCulled = false;
  m.userData.hdSea = true;
  return m;
}

// ---------- cúmulos de bocanadas ----------
let puffTex = null;
function puffTexture() {
  if (puffTex) return puffTex;
  const s = 128, cv = document.createElement('canvas'); cv.width = cv.height = s;
  const g = cv.getContext('2d');
  // varias manchas suaves para que no sea un círculo perfecto
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * s * 0.18;
    const x = s / 2 + Math.cos(a) * r, y = s / 2 + Math.sin(a) * r * 0.8, rad = s * (0.22 + Math.random() * 0.14);
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  puffTex = new THREE.CanvasTexture(cv); puffTex.colorSpace = THREE.SRGBColorSpace;
  return puffTex;
}
export function makeCumulus(rnd, { tint = 0xffffff, sunCol = new THREE.Color(0xffe2b0), shade = 0xb9b3d8 } = {}) {
  const g = new THREE.Group();
  const tex = puffTexture();
  const lit = new THREE.Color(tint).lerp(sunCol, 0.35), dark = new THREE.Color(tint).lerp(new THREE.Color(shade), 0.55);
  const n = 9 + Math.floor(rnd() * 8), len = 10 + rnd() * 14;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), up = Math.sin(t * Math.PI);
    const y = rnd() * 3 * up + up * 2.5;
    const sm = new THREE.SpriteMaterial({ map: tex, color: new THREE.Color().copy(dark).lerp(lit, Math.min(1, 0.25 + y / 5)), transparent: true, depthWrite: false, fog: true, opacity: 0.95 });
    const sp = new THREE.Sprite(sm);
    const sc = (5 + rnd() * 5) * (0.6 + up * 0.6);
    sp.scale.set(sc * 1.35, sc, 1);
    sp.position.set((t - 0.5) * len + (rnd() - 0.5) * 2, y, (rnd() - 0.5) * 4);
    g.add(sp);
  }
  return g;
}

// ---------- corrección de color (paso de post-proceso) ----------
export const GradeShader = {
  uniforms: { tDiffuse: { value: null }, warmth: { value: 0.07 }, sat: { value: 1.14 }, contrast: { value: 1.1 }, vig: { value: 0.38 }, lift: { value: new THREE.Color(0x1a1230) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: /* glsl */`
  uniform sampler2D tDiffuse; uniform float warmth, sat, contrast, vig; uniform vec3 lift; varying vec2 vUv;
  void main(){
    vec4 c = texture2D(tDiffuse, vUv);
    vec3 col = c.rgb;
    float l = dot(col, vec3(0.299,0.587,0.114));
    col = mix(vec3(l), col, sat);                       // saturación
    col = (col - 0.5) * contrast + 0.5;                 // contraste
    col += vec3(warmth, warmth*0.35, -warmth*0.6) * smoothstep(0.35, 1.0, l); // luces cálidas
    col += lift * 0.12 * (1.0 - smoothstep(0.0, 0.45, l));                    // sombras violetas
    col += vec3(-0.025, 0.012, 0.04) * (1.0 - smoothstep(0.05, 0.55, l));   // sombras frías (look de cine: luces cálidas, sombras azuladas)
    vec2 d = vUv - 0.5; col *= 1.0 - vig * smoothstep(0.35, 0.85, length(d * vec2(1.15, 1.0)));
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
  }`,
};

// paleta de amanecer: acerca el horizonte y la niebla de cada zona a un dorado suave (sin perder su color propio)
export function warmZone(zone, skyMat, scene, hemi, sun) {
  if (!zone || !zone.sky) return;
  const warm = new THREE.Color(0xffd6a6), deep = new THREE.Color(0x3f7fd6);
  const zb = new THREE.Color(zone.sky.bottom), already = Math.max(0, (zb.r - zb.b) * 1.6);
  const k = zone.hdWarm ?? Math.max(0.08, 0.42 - already);
  skyMat.uniforms.bottom.value.setHex(zone.sky.bottom).lerp(warm, k);
  skyMat.uniforms.top.value.setHex(zone.sky.top).lerp(deep, 0.15);
  skyMat.uniforms.horizon.value.copy(warm).lerp(new THREE.Color(0xffb27a), 0.3);
  if (scene.fog) { scene.fog.color.setHex(zone.sky.fog).lerp(warm, k * 0.8); scene.fog.near *= 1.3; scene.fog.far *= 1.6; }
  sun.color.lerp(new THREE.Color(0xffd2a0), 0.3); sun.intensity = 1.9;
  hemi.color.lerp(new THREE.Color(0xbcd4ff), 0.2); hemi.groundColor.lerp(new THREE.Color(0x6a5a7a), 0.25);
}

// ---------- islas: costados de roca irregular que se estrechan hacia abajo y borde de pasto que sobresale ----------
const nz = (x, y, z) => { // ruido de valor 3D barato (para deformar geometría en JS)
  const s = Math.sin(x * 1.7 + y * 3.1 + z * 0.9) * 0.5 + Math.sin(x * 0.53 - z * 1.31 + y * 0.7) * 0.35 + Math.sin(z * 2.3 + x * 0.21 - y * 1.9) * 0.15;
  return s; // ~[-1,1]
};
function planarUV(geo, tile) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, x / tile, z / tile);
    else uv.setXY(i, (Math.abs(n.getX(i)) > 0.5 ? z : x) / tile, y / tile);
  }
}
export function islandSideGeo(w, depth, d, seed = 0) {
  const geo = new THREE.BoxGeometry(w, depth, d, Math.max(2, Math.ceil(w / 1.1)), Math.max(2, Math.ceil(depth / 0.7)), Math.max(2, Math.ceil(d / 1.1)));
  planarUV(geo, 3.5);
  const p = geo.attributes.position, hw = w / 2, hd = d / 2, hh = depth / 2, taper = Math.min(w, d) * 0.07, e = 1e-3;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = (hh - y) / depth; // 0 arriba, 1 abajo
    const onX = Math.abs(Math.abs(x) - hw) < e, onZ = Math.abs(Math.abs(z) - hd) < e;
    if (!onX && !onZ) continue;
    const n = nz(x * 0.9 + seed, y * 1.3, z * 0.9 - seed);
    const pull = t < 0.01 ? -0.12 : -(0.12 + (n * 0.5 + 0.5) * 0.38 + t * t * taper);
    if (onX) x += Math.sign(x) * pull;
    if (onZ) z += Math.sign(z) * pull;
    if (onX && onZ) { x -= Math.sign(x) * 0.25; z -= Math.sign(z) * 0.25; } // esquinas redondeadas
    if (t > 0.01) y += n * 0.12;
    p.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}
export function islandCapGeo(w, d, seed = 0) {
  const geo = new THREE.BoxGeometry(w, 0.4, d, Math.max(2, Math.ceil(w / 0.9)), 1, Math.max(2, Math.ceil(d / 0.9)));
  planarUV(geo, 3);
  const p = geo.attributes.position, hw = w / 2, hd = d / 2, e = 1e-3;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const onX = Math.abs(Math.abs(x) - hw) < e, onZ = Math.abs(Math.abs(z) - hd) < e;
    if (onX && onZ) { x -= Math.sign(x) * 0.22; z -= Math.sign(z) * 0.22; }
    if ((onX || onZ) && y < 0) y -= (nz(x * 1.7 + seed, 0, z * 1.7) * 0.5 + 0.5) * 0.32; // flecos de pasto que cuelgan
    p.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

// ---------- cascadas que caen de las islas al mar de nubes ----------
let fallMat = null;
export function waterfall(root, animated, { x, z, top, seaY, dir, outlet }) {
  if (!fallMat) {
    fallMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
      vertexShader: '#include <fog_pars_vertex>\nvarying vec2 vUv; void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition; \n#include <fog_vertex>\n}',
      fragmentShader: NOISE + `#include <fog_pars_fragment>
      uniform float uTime; varying vec2 vUv;
      void main(){
        float s = hdNoise(vec2(vUv.x * 9.0, vUv.y * 2.0 + uTime * 2.4)) * 0.6 + hdNoise(vec2(vUv.x * 23.0, vUv.y * 5.0 + uTime * 3.6)) * 0.4;
        float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
        float fade = smoothstep(0.0, 0.25, vUv.y);
        vec3 col = mix(vec3(0.62, 0.84, 0.98), vec3(1.0), smoothstep(0.35, 0.8, s));
        gl_FragColor = vec4(col, (0.55 + s * 0.45) * edge * fade);
        #include <fog_fragment>
      }`,
    });
  }
  const h = top - seaY + 1.5, wdt = 1.8;
  const geo = new THREE.PlaneGeometry(wdt, h, 1, 8);
  // se curva hacia afuera al salir del borde
  const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const yy = p.getY(i), k = (h / 2 - yy) / h; p.setZ(i, Math.sqrt(Math.max(0, k)) * 1.6); }
  const m = new THREE.Mesh(geo, fallMat); m.renderOrder = 2;
  const g = new THREE.Group(); g.position.set(x, top - h / 2 + 0.05, z); g.rotation.y = dir; g.add(m); root.add(g);
  // boca de roca de la que brota el agua (para que no parezca salir del pasto)
  if (outlet) {
    const rockAt = (rx, ry, rz, rs) => { const geo = new THREE.DodecahedronGeometry(rs, 1); const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const k = 1 + nz(p.getX(i) * 3 + rx, p.getY(i) * 3, p.getZ(i) * 3) * 0.18; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.8, p.getZ(i) * k); }
      geo.computeVertexNormals(); const m = new THREE.Mesh(geo, outlet); m.position.set(rx, ry, rz); m.castShadow = true; g.add(m); };
    const yTop = h / 2;
    rockAt(-1.2, yTop - 0.55, -0.35, 0.55); rockAt(1.2, yTop - 0.5, -0.3, 0.58); rockAt(0, yTop - 0.45, -0.75, 0.6);
    rockAt(-0.9, yTop - 0.9, 0.05, 0.42); rockAt(1.0, yTop - 1.0, 0.1, 0.38);
  }
  // espuma en la cima y bruma abajo
  const tex = puffTexture();
  { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, depthWrite: false, opacity: 0.7, fog: true }));
    sp.scale.set(2.2, 1.1, 1); sp.position.set(0, h / 2 - 0.15, 0.25); g.add(sp); }
  for (let i = 0; i < 5; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, depthWrite: false, opacity: 0.8, fog: true }));
    const sc = 3 + Math.random() * 3; sp.scale.set(sc, sc * 0.7, 1);
    sp.position.set((Math.random() - 0.5) * 2, -h / 2 + 0.6 + Math.random(), 1.6 + Math.random()); g.add(sp);
    const ph = Math.random() * 6; animated.push(t => { sp.material.opacity = 0.55 + Math.sin(t * 1.5 + ph) * 0.2; });
  }
  animated.push(t => { fallMat.uniforms.uTime.value = t; });
}

// ---------- árbol de copa esponjosa (en lugar del modelo facetado) ----------
const leafMats = {};
function leafMat(key) { return leafMats[key] || (leafMats[key] = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })); }
// una «nube» de hojas: esfera deformada con color más oscuro abajo y dorado arriba donde da el sol
export function canopyBlob(r, leaf, seed = 0, detail = 3) {
  let geo = new THREE.IcosahedronGeometry(r, detail); geo.deleteAttribute('normal'); geo.deleteAttribute('uv'); geo = mergeVertices(geo);
  const p = geo.attributes.position, cols = [];
  const base = new THREE.Color(leaf), dark = base.clone().multiplyScalar(0.5), lite = base.clone().lerp(new THREE.Color(0xfff0a0), 0.4);
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i));
    const n = nz(v.x / r * 2.6 + seed, v.y / r * 2.6, v.z / r * 2.6 - seed);
    const lumps = 1 + n * 0.13 + nz(v.x / r * 7 + seed, v.y / r * 7, v.z / r * 7) * 0.05;
    v.multiplyScalar(lumps); if (v.y < 0) v.y *= 0.8; p.setXYZ(i, v.x, v.y, v.z);
    const up = Math.max(0, Math.min(1, v.y / r * 0.5 + 0.5)), sunK = Math.max(0, (v.x * 0.55 + v.y * 0.5 - v.z * 0.6) / r);
    const c = dark.clone().lerp(base, Math.min(1, up * 1.4)).lerp(lite, Math.min(1, Math.max(0, up - 0.55) * 1.6 + sunK * 0.25));
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, leafMat(leaf)); m.castShadow = true; m.receiveShadow = true;
  return m;
}
export function fluffyTree(g, rnd, { leaf = 0x5fa83e, trunk = 0x6b4a2e, seed = 0 } = {}) {
  const tm = new THREE.MeshStandardMaterial({ color: trunk, roughness: 0.9 });
  // tronco algo curvo con raíces y dos ramas
  const trG = new THREE.CylinderGeometry(0.14, 0.32, 2.1, 9, 6); const tp = trG.attributes.position;
  for (let i = 0; i < tp.count; i++) { const yy = tp.getY(i) + 1.05; tp.setX(i, tp.getX(i) + Math.sin(yy * 1.3 + seed) * 0.08); if (yy < 0.25) { const k = 1 + (0.25 - yy) * 2.2; tp.setX(i, tp.getX(i) * k); tp.setZ(i, tp.getZ(i) * k); } }
  trG.computeVertexNormals();
  const tr = new THREE.Mesh(trG, tm); tr.position.y = 1.05; tr.castShadow = true; g.add(tr);
  for (const [ax, az, len] of [[0.7, 0.2, 0.9], [-0.6, -0.3, 0.8]]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, len, 6), tm); b.position.set(ax * 0.45, 1.85, az * 0.45); b.rotation.z = -ax * 0.9; b.rotation.x = az * 0.9; g.add(b);
  }
  const blobs = [[0, 2.65, 0, 1.15], [0.85, 2.25, 0.3, 0.8], [-0.8, 2.3, -0.25, 0.85], [0.15, 3.35, 0.15, 0.8], [-0.25, 2.15, 0.85, 0.72],
    [0.3, 2.2, -0.8, 0.7], [0.65, 3.0, -0.35, 0.62], [-0.6, 3.0, 0.4, 0.6]];
  blobs.forEach(([bx, by, bz, r], i) => { const m = canopyBlob(r, leaf, seed + i * 1.7, 3); m.position.set(bx, by, bz); g.add(m); });
}

// ---------- suelo con manchas de color (pasto más claro, más dorado o más oscuro por zonas) ----------
export function patchGround(mat) {
  if (mat.userData.hdGround) return mat; mat.userData.hdGround = true;
  mat.onBeforeCompile = sh => {
    sh.vertexShader = 'varying vec3 vHdW;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vHdW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'varying vec3 vHdW;\n' + NOISE + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      { float hn = smoothstep(0.28, 0.72, hdFbm(vHdW.xz * 0.06)); float hm = hdNoise(vHdW.xz * 0.6);
        diffuseColor.rgb *= mix(0.72, 1.15, hn) * mix(0.92, 1.05, hm);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.18, 1.1, 0.7), smoothstep(0.6, 1.0, hn) * 0.7);
        // detalle fino (moteado) y un poco menos de saturación: pasto más natural
        float hf = hdNoise(vHdW.xz * 2.7) * 0.6 + hdNoise(vHdW.xz * 7.3) * 0.4;
        diffuseColor.rgb *= mix(0.84, 1.1, hf);
        float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)); diffuseColor.rgb = mix(vec3(lum), diffuseColor.rgb, 0.82) * 0.94; }`);
  };
  mat.customProgramCacheKey = () => 'hdGround';
  mat.needsUpdate = true;
  return mat;
}

// ---------- islas orgánicas: contorno redondeado e irregular, raíz de roca que termina en punta ----------
// El contorno contiene siempre al rectángulo de la física (se agranda r metros por fuera), así no hay huecos.
function islandOutline(w, d, r, seed) {
  const hw = w / 2, hd = d / 2, per = 2 * (w + d) + Math.PI * 2 * r;
  const N = Math.max(28, Math.min(180, Math.round(per / 0.55)));
  const pts = [];
  for (let i = 0; i < N; i++) {
    let s = (i / N) * per, x, z, nx, nz2;
    // recorre: lado +z, esquina, lado +x, esquina, lado -z, esquina, lado -x, esquina
    const segs = [[w, 'L'], [Math.PI / 2 * r, 'C'], [d, 'L'], [Math.PI / 2 * r, 'C'], [w, 'L'], [Math.PI / 2 * r, 'C'], [d, 'L'], [Math.PI / 2 * r, 'C']];
    let k = 0; while (s > segs[k][0] && k < 7) { s -= segs[k][0]; k++; }
    const side = Math.floor(k / 2), corner = k % 2 === 1;
    // centros de esquina en orden: (+hw,+hd) (+hw,-hd) (-hw,-hd) (-hw,+hd)
    const C = [[hw, hd], [hw, -hd], [-hw, -hd], [-hw, hd]];
    const startAng = [Math.PI / 2, 0, -Math.PI / 2, Math.PI];
    if (!corner) {
      if (side === 0) { x = -hw + s; z = hd + r; nx = 0; nz2 = 1; }
      else if (side === 1) { x = hw + r; z = hd - s; nx = 1; nz2 = 0; }
      else if (side === 2) { x = hw - s; z = -hd - r; nx = 0; nz2 = -1; }
      else { x = -hw - r; z = -hd + s; nx = -1; nz2 = 0; }
    } else {
      const a = startAng[side] - s / r; x = C[side][0] + Math.cos(a) * r; z = C[side][1] + Math.sin(a) * r; nx = Math.cos(a); nz2 = Math.sin(a);
    }
    const bump = (nz(x * 0.45 + seed, 0.3, z * 0.45 - seed) * 0.5 + 0.5) * Math.min(0.6, r * 0.6);
    pts.push({ x: x + nx * bump, z: z + nz2 * bump, nx, nz: nz2 });
  }
  return pts;
}
export function organicIsland({ w, d, top, depth, rock = true, seed = 0, sideMat, topMat }) {
  const g = new THREE.Group();
  const r = Math.min(1.1, Math.max(0.35, Math.min(w, d) * 0.09));
  const out = islandOutline(w, d, r, seed), N = out.length;
  // --- cara de pasto (forma plana triangulada) ---
  const shape = new THREE.Shape(out.map(p => new THREE.Vector2(p.x, -p.z)));
  const topGeo = new THREE.ShapeGeometry(shape); topGeo.rotateX(-Math.PI / 2);
  { const p = topGeo.attributes.position, uv = topGeo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 3, p.getZ(i) / 3); }
  // el suelo cede ante cualquier cosa apoyada a su misma altura (muelles, losas, caminos): sin parpadeo
  topMat.polygonOffset = true; topMat.polygonOffsetFactor = 1; topMat.polygonOffsetUnits = 4;
  const topM = new THREE.Mesh(topGeo, topMat); topM.position.y = top; topM.receiveShadow = true; g.add(topM);
  // --- borde de pasto que cuelga (faldón) ---
  const lip = [], lipUv = [], lipIdx = [];
  for (let i = 0; i < N; i++) {
    const p = out[i], drop = 0.28 + (nz(p.x * 1.9 + seed, 1, p.z * 1.9) * 0.5 + 0.5) * 0.35;
    lip.push(p.x, top, p.z, p.x + p.nx * 0.06, top - drop, p.z + p.nz * 0.06);
    lipUv.push(i * 0.18, 0.4, i * 0.18, 0.4 - drop / 3);
  }
  for (let i = 0; i < N; i++) { const j = (i + 1) % N, a = i * 2, b = j * 2; lipIdx.push(a, a + 1, b, b, a + 1, b + 1); }
  const lipGeo = new THREE.BufferGeometry(); lipGeo.setAttribute('position', new THREE.Float32BufferAttribute(lip, 3)); lipGeo.setAttribute('uv', new THREE.Float32BufferAttribute(lipUv, 2)); lipGeo.setIndex(lipIdx); lipGeo.computeVertexNormals();
  const lipM = new THREE.Mesh(lipGeo, topMat); lipM.castShadow = true; g.add(lipM);
  // --- raíz de roca: anillos que se estrechan y terminan en punta ---
  const minS = Math.min(w, d), tipDepth = rock ? depth + Math.min(22, minS * 0.75) : depth + 0.3;
  const rings = rock ? 7 : 3, pos = [], uvs = [], idx = [];
  let cx = 0, cz = 0; // la punta se desplaza un poco para que no sea simétrica
  const rs = (k) => nz(seed * 3.1 + k, k * 1.7, seed) ;
  cx = rs(1) * minS * 0.12; cz = rs(2) * minS * 0.12;
  for (let k = 0; k < rings; k++) {
    const t = k / (rings - 1); // 0 = justo bajo el pasto, 1 = cerca de la punta
    const yy = top - 0.25 - (rock ? Math.pow(t, 1.35) * (tipDepth - 0.6) : t * depth);
    const sc = rock ? (k === 0 ? 0.985 : Math.max(0.06, 1 - Math.pow(t, 0.85) * 0.94)) : 0.98 - t * 0.06;
    let acc = 0;
    for (let i = 0; i <= N; i++) {
      const p = out[i % N], q = out[(i + N - 1) % N];
      if (i > 0) acc += Math.hypot(p.x - q.x, p.z - q.z);
      const bumpy = k === 0 ? 0 : nz(p.x * 0.6 + k * 1.3, yy * 0.8, p.z * 0.6 - seed) * Math.min(1.1, minS * 0.06) * (1 - t * 0.5);
      const px = cx * t + p.x * sc + p.nx * bumpy, pz = cz * t + p.z * sc + p.nz * bumpy;
      pos.push(px, yy + (k ? nz(p.x, k, p.z) * 0.25 : 0), pz); uvs.push(acc / 3.5, yy / 3.5);
    }
  }
  const tip = pos.length / 3; pos.push(cx, top - tipDepth, cz); uvs.push(0, (top - tipDepth) / 3.5);
  const W = N + 1;
  for (let k = 0; k < rings - 1; k++) for (let i = 0; i < N; i++) { const a = k * W + i, b = a + 1, c = a + W, e = c + 1; idx.push(a, c, b, b, c, e); }
  if (rock) { const k = rings - 1; for (let i = 0; i < N; i++) idx.push(k * W + i, tip, k * W + i + 1); }
  else { const k = rings - 1, ctr = tip; pos[ctr * 3 + 1] = top - depth - 0.25; for (let i = 0; i < N; i++) idx.push(k * W + i, ctr, k * W + i + 1); }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); rg.setIndex(idx); rg.computeVertexNormals();
  const rm = new THREE.Mesh(rg, sideMat); rm.castShadow = true; rm.receiveShadow = true; g.add(rm);
  g.userData.outline = out; g.userData.r = r;
  return g;
}

// ---------- contorno de ilustración en los personajes (casco invertido que sigue al esqueleto) ----------
const outlineMats = {};
function outlineMat(th) {
  if (outlineMats[th]) return outlineMats[th];
  const m = new THREE.MeshBasicMaterial({ color: 0x2b1a14, side: THREE.BackSide });
  m.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <skinning_vertex>', `#include <skinning_vertex>\n#ifdef USE_SKINNING\n transformed += normalize(objectNormal) * ${th.toFixed(4)};\n#endif`); };
  m.customProgramCacheKey = () => 'hdOutline' + th;
  return (outlineMats[th] = m);
}
export function outlineCharacter(model, th = 0.012) {
  const list = []; model.traverse(o => { if (o.isSkinnedMesh && !o.userData.hdOutline) list.push(o); });
  for (const o of list) {
    const ol = new THREE.SkinnedMesh(o.geometry, outlineMat(th));
    ol.bind(o.skeleton, o.bindMatrix); ol.userData.hdOutline = true; ol.frustumCulled = false; ol.castShadow = false;
    ol.position.copy(o.position); ol.quaternion.copy(o.quaternion); ol.scale.copy(o.scale);
    o.parent.add(ol); o.userData.hdOutline = true;
  }
}

// ---------- mochila de exploradora con manta enrollada (como en el video), colgada del pecho por detrás ----------
export function backpack(model) {
  let chest = null; model.traverse(o => { if (!chest && o.isBone && o.name === 'chest') chest = o; });
  if (!chest || model.userData.hdPack) return null; model.userData.hdPack = true;
  const sk = []; model.traverse(o => { if (o.isSkinnedMesh) sk.push(o); }); if (sk[0]) sk[0].skeleton.pose();
  model.updateMatrixWorld(true);
  const inv = model.matrixWorld.clone().invert(), c = chest.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
  const leather = new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.85 }), dark = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.9 });
  const cloth = new THREE.MeshStandardMaterial({ color: 0xb8a27a, roughness: 0.95 }), brass = new THREE.MeshStandardMaterial({ color: 0xd8b060, metalness: 0.6, roughness: 0.35 });
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.22, 6, 12), leather); body.scale.set(1.15, 1, 0.62); g.add(body);
  const flap = new THREE.Mesh(new THREE.SphereGeometry(0.235, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), dark); flap.scale.set(1.12, 0.5, 0.66); flap.position.y = 0.16; g.add(flap);
  const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.06), dark); pocket.position.set(0, -0.06, -0.14); g.add(pocket);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), brass); buckle.position.set(0, 0.0, -0.18); g.add(buckle);
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 12), cloth); roll.rotation.z = Math.PI / 2; roll.position.set(0, 0.33, 0.01); g.add(roll);
  for (const sx of [-0.13, 0.13]) { const st = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.012, 5, 12), dark); st.position.set(sx, 0.33, 0.01); st.rotation.y = Math.PI / 2; g.add(st); }
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.08, 8), brass); cup.position.set(0.24, -0.08, 0); g.add(cup);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.scale.setScalar(0.85); g.position.set(c.x, c.y - 0.16, c.z - 0.38);
  model.add(g); model.updateMatrixWorld(true); chest.attach(g);
  return g;
}

// ---------- lava: costra oscura que se agrieta sobre ríos incandescentes que fluyen ----------
export function lavaMaterial() {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
    vertexShader: NOISE + `uniform float uTime; varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){ vec4 w = modelMatrix * vec4(position,1.0); w.y += (hdNoise(w.xz*0.08 + uTime*0.05) - 0.5) * 0.8; vW = w.xyz;
        vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: NOISE + `uniform float uTime; varying vec3 vW;
      #include <fog_pars_fragment>
      void main(){
        vec2 p = vW.xz * 0.06;
        // corriente deformada (domain warping) para que parezca que fluye y se enrosca
        vec2 q = vec2(hdFbm(p + vec2(0.0, uTime*0.03)), hdFbm(p + vec2(5.2, 1.3) - uTime*0.02));
        float f = hdFbm(p * 1.6 + q * 2.2 + vec2(uTime*0.04, -uTime*0.025));
        // placas de costra: celdas con bordes calientes
        float cell = hdFbm(p * 3.5 + q * 1.4 - uTime*0.01);
        float crack = smoothstep(0.08, 0.0, abs(cell - 0.5)) ;
        float heat = smoothstep(0.45, 0.75, f) + crack * 0.8;
        heat = clamp(heat, 0.0, 1.0);
        vec3 crust = mix(vec3(0.05,0.02,0.02), vec3(0.18,0.07,0.04), hdNoise(vW.xz*0.9));
        vec3 hot = mix(vec3(0.9,0.18,0.02), vec3(1.0,0.62,0.12), smoothstep(0.5, 0.95, heat));
        hot = mix(hot, vec3(1.0,0.95,0.6), smoothstep(0.9, 1.0, heat));
        float pulse = 0.85 + 0.15 * sin(uTime*1.7 + f*8.0);
        vec3 col = mix(crust, hot * (1.4 * pulse), heat);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

// ---------- fuego: llama con ruido que sube, del blanco amarillo al rojo y humo arriba ----------
export function flameMaterial(strength = 1) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uStr: { value: strength } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: NOISE + `uniform float uTime; uniform float uStr; varying vec2 vUv;
      void main(){
        float y = vUv.y, x = vUv.x;
        float n = hdFbm(vec2(x * 6.0, y * 2.5 - uTime * 3.2)) ;
        float n2 = hdNoise(vec2(x * 14.0, y * 6.0 - uTime * 5.0));
        float body = smoothstep(1.05, 0.15, y + n * 0.55 + n2 * 0.15);   // se deshilacha arriba
        float a = body * (0.55 + n * 0.6) * uStr;
        vec3 col = mix(vec3(1.0,0.95,0.7), vec3(1.0,0.55,0.12), smoothstep(0.0, 0.45, y + n*0.2));
        col = mix(col, vec3(0.85,0.18,0.03), smoothstep(0.4, 0.85, y + n*0.25));
        gl_FragColor = vec4(col * a * 1.6, a);
      }`,
  });
}

// llama de frente a la cámara: forma de lágrima con bordes que se deshilachan, núcleo blanco y lenguas que suben
export function flameSheetMaterial(strength = 1, seed = 0) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uStr: { value: strength }, uSeed: { value: seed } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: NOISE + `uniform float uTime; uniform float uStr; uniform float uSeed; varying vec2 vUv;
      void main(){
        float y = vUv.y, x = (vUv.x - 0.5) * 2.0;
        float t = uTime * 2.6 + uSeed;
        float n = hdFbm(vec2(vUv.x * 3.0 + uSeed, y * 2.2 - t));
        float n2 = hdFbm(vec2(vUv.x * 7.0 - uSeed, y * 4.5 - t * 1.7));
        float sway = (n - 0.5) * 0.5 * y;                      // la llama ondea más arriba
        float w = mix(0.95, 0.08, pow(y, 0.8)) * (0.75 + n2 * 0.5); // ancha abajo, fina arriba
        float d = abs(x + sway) / max(w, 0.02);
        float shape = smoothstep(1.0, 0.25, d) * smoothstep(0.0, 0.06, y) * smoothstep(1.0, 0.55, y + (n2 - 0.5) * 0.5);
        float core = smoothstep(0.45, 0.0, d) * smoothstep(0.6, 0.05, y + n * 0.3);
        float heat = clamp(core * 1.2 + (1.0 - y) * 0.35, 0.0, 1.0);
        vec3 col = mix(vec3(0.75, 0.08, 0.01), vec3(1.0, 0.42, 0.05), smoothstep(0.05, 0.45, heat));
        col = mix(col, vec3(1.0, 0.82, 0.35), smoothstep(0.45, 0.8, heat));
        col = mix(col, vec3(1.0, 0.93, 0.7), smoothstep(0.88, 1.0, heat));
        float a = shape * (0.55 + n2 * 0.7) * uStr;
        gl_FragColor = vec4(col * a * 0.85, a);
      }`,
  });
}
// ---------- agua: olas en dos direcciones, reflejo del cielo en ángulo (Fresnel), brillo del sol ----------
export function waterMaterial({ shallow = 0x3fc2d8, deep = 0x0d4f7a, sky = 0xcfe8ff, opacity = 0.88, scale = 1 } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, shallow: { value: new THREE.Color(shallow) }, deep: { value: new THREE.Color(deep) }, sky: { value: new THREE.Color(sky) },
      sunDir: { value: HD.sunDir }, sunCol: { value: HD.sunCol }, uOp: { value: opacity }, uScale: { value: scale },
    }]),
    vertexShader: `varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: NOISE + `uniform float uTime, uOp, uScale; uniform vec3 shallow, deep, sky, sunDir, sunCol; varying vec3 vW;
      #include <fog_pars_fragment>
      float h(vec2 p){ p *= uScale;
        float w = sin(dot(p, vec2(0.21, 0.13)) + uTime*0.9) * 0.3 + sin(dot(p, vec2(-0.117, 0.273)) + uTime*1.13) * 0.22 + sin(dot(p, vec2(0.371, -0.313)) + uTime*1.61) * 0.12
                + sin(dot(p, vec2(-0.53, -0.41)) + uTime*2.3) * 0.07 + sin(dot(p, vec2(0.71, 0.29)) + uTime*2.9) * 0.05;
        return 0.5 + w * 0.5 + (hdFbm(p*0.6 + vec2(uTime*0.06, uTime*0.035)) - 0.5) * 0.7; }
      void main(){
        float e = 0.15; float h0 = h(vW.xz);
        vec3 V = normalize(cameraPosition - vW);
        float fadeN = exp(-length(cameraPosition - vW) / 70.0); // lejos el agua se ve lisa (sin parpadeo)
        vec3 n = normalize(vec3((h0 - h(vW.xz + vec2(e,0.))) * 1.4 * fadeN, e, (h0 - h(vW.xz + vec2(0.,e))) * 1.4 * fadeN));
        if (V.y < 0.0) n.y = -n.y; // visto desde abajo (submarino)
        float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
        float lit = clamp(dot(n, normalize(sunDir)) * 0.5 + 0.5, 0.0, 1.0);
        vec3 col = deep * (0.75 + 0.35 * lit) + shallow * 0.22 * pow(lit, 3.0);
        col = mix(col, sky, fres * 0.5);
        vec3 R = reflect(-V, n);
        float spec = pow(max(dot(R, normalize(sunDir)), 0.0), 180.0) * 2.5 + pow(max(dot(R, normalize(sunDir)), 0.0), 18.0) * 0.18;
        col += sunCol * spec;
        float foam = smoothstep(0.95, 1.1, h0) * 0.15 * fadeN; col += vec3(foam);
        gl_FragColor = vec4(col, mix(uOp, 1.0, fres * 0.6));
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

// ---------- personajes generados con Artlist: se les pone el esqueleto del juego (mismos nombres de huesos) ----------
// Las animaciones del juego guardan giros por hueso: si el esqueleto nuevo conserva las orientaciones de reposo
// y solo cambia el largo de los huesos, los mismos giros funcionan sobre el cuerpo nuevo.
// Registro: cada modelo generado reemplaza a un modelo de KayKit (y a todas sus variantes de color) en la versión HD.
export const HD_CHARS = [
  { id: 'heroina', replaces: 'lia' },      // la exploradora (protagonista)
  { id: 'kael_hd', replaces: 'kael' },     // Kael y el estilo «Encapuchada»
  { id: 'marta_hd', replaces: 'marta' },   // Marta, Nerea, Brasa y el estilo «Maga»
  { id: 'tomas_hd', replaces: 'tomas' },   // Tomás, Ilan, Vaelor y el estilo «Caballera»
];
// Mide las articulaciones sobre la malla (personaje en cruz, pies en y=0, alto 1.9, mira a +z):
// hombro = donde el torso se angosta y empieza el brazo; codo, muñeca y mano en proporción del brazo;
// cadera, rodilla y tobillo en proporción del alto (medidas sobre la protagonista y comprobadas en la malla).
export function measureJoints(geo) {
  const P = geo.attributes.position, n = P.count;
  let maxX = 0; for (let i = 0; i < n; i++) maxX = Math.max(maxX, Math.abs(P.getX(i)));
  const ys = [], zs = [];
  for (let i = 0; i < n; i++) if (Math.abs(P.getX(i)) > maxX * 0.8) { ys.push(P.getY(i)); zs.push(P.getZ(i)); }
  ys.sort((a, b) => a - b); zs.sort((a, b) => a - b);
  const armY = ys[ys.length >> 1] ?? 1.17, armZ = zs[zs.length >> 1] ?? 0.05;
  // recorre hacia afuera hasta que la franja deja de ser torso (alto vertical chico = brazo)
  let shoulder = maxX * 0.3;
  for (let x = 0.08; x < maxX * 0.7; x += 0.01) {
    let lo = 9, hi = -9, c = 0;
    for (let i = 0; i < n; i++) { const vx = P.getX(i); if (vx >= x && vx < x + 0.02) { const y = P.getY(i); if (Math.abs(y - armY) < 0.5) { lo = Math.min(lo, y); hi = Math.max(hi, y); c++; } } }
    if (c > 3 && hi - lo < 0.24) { shoulder = x - 0.03; break; }
  }
  const L = maxX - shoulder, H = 1.9;
  let lx = 0, lc = 0, lz = 0; for (let i = 0; i < n; i++) { const x = P.getX(i), y = P.getY(i); if (x > 0.02 && y > 0.36 * H * 0.5 && y < 0.25 * H) { lx += x; lz += P.getZ(i); lc++; } }
  const legX = lc ? lx / lc : 0.11, legZ = lc ? lz / lc : 0.06;
  return {
    hips: [0, 0.405 * H, 0], spine: [0, 0.484 * H, 0], chest: [0, 0.558 * H, 0], head: [0, 0.7 * H, 0],
    upperarm: [shoulder, armY, armZ], lowerarm: [shoulder + 0.29 * L, armY, armZ], wrist: [shoulder + 0.5 * L, armY, armZ], hand: [shoulder + 0.63 * L, armY - 0.005, armZ], handslot: [shoulder + 0.72 * L, armY - 0.05, armZ],
    upperleg: [legX, 0.326 * H, legZ], lowerleg: [legX, 0.216 * H, legZ + 0.005], foot: [legX + 0.005, 0.068 * H, legZ - 0.01], toes: [legX + 0.01, 0.016 * H, legZ + 0.11],
  };
}
function jointTarget(J, name) {
  const m = name.match(/^(upperarm|lowerarm|wrist|hand|handslot|upperleg|lowerleg|foot|toes)([lr])$/);
  if (m) { const p = J[m[1]]; return new THREE.Vector3(m[2] === 'l' ? p[0] : -p[0], p[1], p[2]); }
  if (J[name]) return new THREE.Vector3(...J[name]);
  return null;
}
export function rigGenerated(staticScene, kayModel, name = 'Generado') {
  // 1) malla: centrada, pies en y=0, alto 1.9
  let mesh = null; staticScene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
  staticScene.updateMatrixWorld(true);
  const geo = mesh.geometry.clone(); geo.applyMatrix4(mesh.matrixWorld);
  geo.computeBoundingBox(); const bb = geo.boundingBox;
  geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  const Hs = bb.max.y - bb.min.y; geo.scale(1.9 / Hs, 1.9 / Hs, 1.9 / Hs);
  const J = measureJoints(geo);
  // 2) esqueleto: copia del de KayKit en reposo, con los huesos movidos a las articulaciones medidas
  const src = SkeletonUtilsClone(kayModel);
  let srcSk = null; src.traverse(o => { if (o.isSkinnedMesh && !srcSk) srcSk = o; });
  srcSk.skeleton.pose(); src.updateMatrixWorld(true);
  const rootBone = srcSk.skeleton.bones.find(b => !b.parent || !b.parent.isBone);
  const bones = srcSk.skeleton.bones;
  const order = []; rootBone.traverse(b => { if (b.isBone) order.push(b); });
  for (const b of order) {
    const t = jointTarget(J, b.name); if (!t) continue;
    b.parent.updateMatrixWorld(true);
    b.position.copy(b.parent.worldToLocal(t.clone().applyMatrix4(src.matrixWorld)));
    b.updateMatrixWorld(true);
  }
  // 3) pesos por zona del cuerpo, con pliegues cortos centrados en cada articulación (dobla justo ahí)
  const P = geo.attributes.position, n = P.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  const I = {}; for (const b of bones) I[b.name] = bones.indexOf(b);
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const sh = J.upperarm[0], el = J.lowerarm[0], wr = J.wrist[0], ha = J.hand[0], armY = J.upperarm[1];
  const hipJ = J.upperleg[1], knee = J.lowerleg[1], ank = J.foot[1], hipsY = J.hips[1], neck = J.head[1] - 0.09;
  for (let i = 0; i < n; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), ax = Math.abs(x), s = x >= 0 ? 'l' : 'r';
    let w;
    if (ax > sh - 0.02 && Math.abs(y - armY) < 0.16 && z > -0.2) { // brazos
      const k1 = sm(sh - 0.015, sh + 0.045, ax), k2 = sm(el - 0.02, el + 0.02, ax), k3 = sm(wr - 0.015, wr + 0.015, ax), k4 = sm(ha - 0.02, ha + 0.02, ax);
      w = [[I.chest, 1 - k1], [I['upperarm' + s], k1 * (1 - k2)], [I['lowerarm' + s], k2 * (1 - k3)], [I['wrist' + s], k3 * (1 - k4)], [I['hand' + s], k4]];
    } else if (y > neck) { const k = sm(neck, neck + 0.1, y); w = [[I.chest, 1 - k], [I.head, k]]; } // cabeza
    else if (y < hipJ - 0.02) { // piernas
      const k1 = sm(hipJ - 0.07, hipJ, y), kk = sm(knee - 0.02, knee + 0.02, y), kf = sm(ank - 0.015, ank + 0.02, y), toe = z > J.foot[2] + 0.07 ? sm(J.foot[2] + 0.07, J.foot[2] + 0.15, z) : 0;
      w = [[I['upperleg' + s], kk * (1 - k1)], [I['lowerleg' + s], kf * (1 - kk)], [I['foot' + s], (1 - kf) * (1 - toe)], [I['toes' + s], (1 - kf) * toe], [I.hips, k1]];
    } else { // torso (lo que cuelga atrás, como mochilas, va con el pecho)
      const k1 = sm(hipsY + 0.03, hipsY + 0.13, y), k2 = sm(J.chest[1] - 0.11, J.chest[1] - 0.01, y);
      w = z < -0.12 && y > hipsY + 0.08 ? [[I.chest, 1]] : [[I.hips, 1 - k1], [I.spine, k1 * (1 - k2)], [I.chest, k2]];
      if (y < hipsY + 0.01 && ax > 0.04) { const kl = 1 - sm(hipJ - 0.02, hipsY + 0.01, y); w.push([I['upperleg' + s], kl * 0.7]); } // faldas y túnicas siguen un poco a las piernas
    }
    w = w.filter(e => e[0] >= 0 && e[1] > 0.001).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const tot = w.reduce((a, e) => a + e[1], 0) || 1;
    for (let j = 0; j < 4; j++) { si[i * 4 + j] = w[j] ? w[j][0] : 0; sw[i * 4 + j] = w[j] ? w[j][1] / tot : 0; }
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  // 4) modelo final
  const mat = mesh.material; mat.metalness = Math.min(mat.metalness ?? 0, 0.55); mat.roughness = Math.max(mat.roughness ?? 0.75, 0.42); // el metal (armaduras) refleja el cielo, la tela no
  const out = new THREE.Group(); out.name = name; out.userData.armorScale = 0.5; out.userData.hipsY = J.hips[1];
  const rig = rootBone.parent && !rootBone.parent.isBone ? rootBone.parent : rootBone;
  out.add(rig);
  { const drop = []; rig.traverse(o => { if (o.isMesh) drop.push(o); }); for (const o of drop) o.parent.remove(o); }
  const sk = new THREE.SkinnedMesh(geo, mat); sk.name = name + '_Body';
  out.add(sk); out.updateMatrixWorld(true);
  sk.bind(new THREE.Skeleton(bones), sk.matrixWorld);
  return out;
}
let SkeletonUtilsClone = null;
export function setSkeletonClone(fn) { SkeletonUtilsClone = fn; }
// clips para un personaje generado: solo giros (y la posición de la cadera, escalada) — los largos de hueso son los suyos
export function genClips(clips, hipsY = 0.77) {
  const out = {}, k = hipsY / 0.406 * 0.62;
  for (const [name, c] of Object.entries(clips)) {
    const tracks = [];
    for (const t of c.tracks) {
      if (t.name.endsWith('.quaternion')) tracks.push(t);
      else if (t.name === 'hips.position') { const tt = t.clone(); const v = tt.values; for (let i = 0; i < v.length; i += 3) { v[i] *= k; v[i + 1] = hipsY + (v[i + 1] - 0.406) * k; v[i + 2] *= k; } tracks.push(tt); }
    }
    out[name] = new THREE.AnimationClip(c.name, c.duration, tracks);
  }
  return out;
}
// ---------- iluminación de entorno: el cielo de cada zona se refleja en todos los materiales ----------
let pmrem = null, envTex = null;
export function skyEnvironment(renderer, scene, skyMat) {
  if (!pmrem) { pmrem = new THREE.PMREMGenerator(renderer); }
  const es = new THREE.Scene();
  es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), skyMat));
  // un suelo cálido difuso abajo, para que la luz que rebota no sea azul
  const fl = new THREE.Mesh(new THREE.CircleGeometry(40, 24), new THREE.MeshBasicMaterial({ color: 0x8a8070 })); fl.rotation.x = -Math.PI / 2; fl.position.y = -8; es.add(fl);
  const rt = pmrem.fromScene(es, 0.02, 0.1, 200);
  if (envTex) envTex.dispose();
  envTex = rt.texture; scene.environment = envTex;
  es.traverse(o => { if (o.geometry) o.geometry.dispose(); });
}

