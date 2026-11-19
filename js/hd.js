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
    totalEmissiveRadiance += vec3( 1.0, 0.82, 0.6 ) * hdRim * 0.16;
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
  const base = new THREE.Color(color ?? 0xeaf2ff);
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
  uniforms: { tDiffuse: { value: null }, warmth: { value: 0.06 }, sat: { value: 1.12 }, contrast: { value: 1.06 }, vig: { value: 0.32 }, lift: { value: new THREE.Color(0x1a1230) } },
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
    vec2 d = vUv - 0.5; col *= 1.0 - vig * smoothstep(0.35, 0.85, length(d * vec2(1.15, 1.0)));
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
  }`,
};

// paleta de amanecer: acerca el horizonte y la niebla de cada zona a un dorado suave (sin perder su color propio)
export function warmZone(zone, skyMat, scene, hemi, sun) {
  if (!zone || !zone.sky) return;
  const warm = new THREE.Color(0xffd6a6), deep = new THREE.Color(0x3f7fd6);
  const k = zone.hdWarm ?? 0.42;
  skyMat.uniforms.bottom.value.setHex(zone.sky.bottom).lerp(warm, k);
  skyMat.uniforms.top.value.setHex(zone.sky.top).lerp(deep, 0.15);
  skyMat.uniforms.horizon.value.copy(warm).lerp(new THREE.Color(0xffb27a), 0.3);
  if (scene.fog) { scene.fog.color.setHex(zone.sky.fog).lerp(warm, k * 0.8); scene.fog.near *= 1.15; scene.fog.far *= 1.35; }
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
export function waterfall(root, animated, { x, z, top, seaY, dir }) {
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
  // espuma en la cima y bruma abajo
  const tex = puffTexture();
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
export function fluffyTree(g, rnd, { leaf = 0x5fa83e, trunk = 0x6b4a2e } = {}) {
  const tm = new THREE.MeshStandardMaterial({ color: trunk, roughness: 0.9 });
  const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 1.9, 8), tm); tr.position.y = 0.95; tr.castShadow = true; g.add(tr);
  const lm = leafMats[leaf] || (leafMats[leaf] = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
  const base = new THREE.Color(leaf), dark = base.clone().multiplyScalar(0.55), lite = base.clone().lerp(new THREE.Color(0xfff2a0), 0.35);
  const blobs = [[0, 2.5, 0, 1.25], [0.75, 2.1, 0.25, 0.85], [-0.7, 2.2, -0.2, 0.9], [0.1, 3.25, 0.1, 0.85], [-0.2, 2.0, 0.75, 0.75]];
  for (const [bx, by, bz, r] of blobs) {
    let geo = new THREE.IcosahedronGeometry(r, 3); geo.deleteAttribute('normal'); geo.deleteAttribute('uv'); geo = mergeVertices(geo);
    const p = geo.attributes.position, cols = [];
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)), k = 1 + nz(v.x * 3 + bx, v.y * 3, v.z * 3 + bz) * 0.12;
      v.multiplyScalar(k); p.setXYZ(i, v.x, v.y, v.z);
      const up = v.y / r * 0.5 + 0.5, c = dark.clone().lerp(base, Math.min(1, up * 1.3)).lerp(lite, Math.max(0, up - 0.65) * 1.5);
      cols.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, lm); m.position.set(bx, by, bz); m.castShadow = true; m.receiveShadow = true; g.add(m);
  }
}

// ---------- suelo con manchas de color (pasto más claro, más dorado o más oscuro por zonas) ----------
export function patchGround(mat) {
  if (mat.userData.hdGround) return mat; mat.userData.hdGround = true;
  mat.onBeforeCompile = sh => {
    sh.vertexShader = 'varying vec3 vHdW;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vHdW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'varying vec3 vHdW;\n' + NOISE + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      { float hn = smoothstep(0.28, 0.72, hdFbm(vHdW.xz * 0.06)); float hm = hdNoise(vHdW.xz * 0.6);
        diffuseColor.rgb *= mix(0.72, 1.15, hn) * mix(0.92, 1.05, hm);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.18, 1.1, 0.7), smoothstep(0.6, 1.0, hn) * 0.7); }`);
  };
  mat.customProgramCacheKey = () => 'hdGround';
  mat.needsUpdate = true;
  return mat;
}
