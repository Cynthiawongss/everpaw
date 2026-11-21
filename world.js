/* EverPaw Home — the 3D world: an isometric miniature room, things to furnish it with,
   and a pet that lives in it. Everything is modelled in code so it can be recoloured and rebuilt. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from './three/RoundedBoxGeometry.js';
import { GLTFLoader } from './three/loaders/GLTFLoader.js';

export const N = 8; // the floor is N × N cells
const WALL_H = 5;

/* ---------- little modelling kit ---------- */

const mats = new Map();
function mat(color, o) {
  const key = color + (o ? JSON.stringify(o) : '');
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.86, metalness: 0 }, o)));
  return mats.get(key);
}
function mesh(geo, color, o) { const m = new THREE.Mesh(geo, typeof color === 'string' ? mat(color, o) : color); m.castShadow = true; m.receiveShadow = true; return m; }
const rbox = (w, h, d, c, r = 0.08, o) => mesh(new RoundedBoxGeometry(w, h, d, 3, Math.max(0.005, Math.min(r, w / 2 - 0.004, h / 2 - 0.004, d / 2 - 0.004))), c, o);
const cyl = (rt, rb, h, c, seg = 28, o) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), c, o);
const sph = (r, c, sx = 1, sy = 1, sz = 1, o) => { const m = mesh(new THREE.SphereGeometry(r, 26, 18), c, o); m.scale.set(sx, sy, sz); return m; };
const cap = (r, len, c, o) => mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len), 6, 16), c, o);
const cone = (r, h, c, seg = 20, o) => mesh(new THREE.ConeGeometry(r, h, seg), c, o);
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
const rot = (o, x, y, z) => { o.rotation.set(x, y, z); return o; };
const grp = (...kids) => { const g = new THREE.Group(); kids.forEach((k) => k && g.add(k)); return g; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const damp = (cur, target, k, dt) => cur + (target - cur) * (1 - Math.exp(-k * dt));
function shade(hex, f) { const c = new THREE.Color(hex); c.offsetHSL(0, 0, f); return '#' + c.getHexString(); }
function wipe(g) { g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); g.clear(); }
function seeded(seed) { let s = seed || 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

/* ---------- rooms ---------- */

export const ROOMS = {
  bay: {
    trim: '#FBF5E8', accent: '#D9973F', accent2: '#93AD92', wood: '#B98556', rug: ['#F6EEDF', '#C96A4B'], bg: ['#FBEBD6', '#F1C7A6'],
    items: [['rug', 4.4, 4.8, 0], ['armchair', 7, 2.6, 3], ['plant', 7.5, 0.5, 0]], spots: { water: [7.5, 5.5], food: [7.5, 6.5] },
    frame: { at: [0.13, 3.2, 1.5], face: 'x', w: 1.0, h: 1.2 }, perchName: 'windowseat',
  },
  attic: {
    trim: '#FBF6EC', accent: '#4F6D8A', accent2: '#D9A441', wood: '#8A5F3F', rug: ['#F3EAD8', '#4F6D8A'], bg: ['#E9EEF4', '#D8CFE0'],
    items: [['rug', 4.2, 4.8, 0], ['sofa', 4.4, 1.1, 0], ['lamp', 2.4, 0.6, 0]], spots: { water: [7.5, 5.5], food: [7.5, 6.5] },
    frame: { at: [5.7, 2.9, 0.06], face: 'z', w: 0.9, h: 1.1, border: true }, perchName: 'trunk',
  },
  glass: {
    trim: '#F6F1E6', accent: '#E08A6B', accent2: '#8FB7A5', wood: '#B08258', rug: ['#FFF4DC', '#7FA98C'], bg: ['#E3F1E4', '#F6EBC6'],
    items: [['rug', 4.4, 4.8, 0], ['armchair', 7, 2.6, 3], ['monstera', 0.5, 1.5, 0]], spots: { water: [2.5, 7.5], food: [3.5, 7.5] },
    frame: { at: [6.6, 1.86, 0.02], face: 'z', w: 0.8, h: 1.0, border: true },
  },
};

/* The rooms themselves are modelled and lit in Blender (tools/build_rooms.py); what arrives here is the shell and one baked texture per time of day. */
const BAKE = '?b=2'; // change when the rooms are rebuilt, so a model is never paired with an older texture
let META = {};
try { META = await (await fetch(new URL('./rooms/rooms.json' + BAKE, import.meta.url))).json(); } catch (e) { META = {}; }
const loader = new GLTFLoader(), texLoader = new THREE.TextureLoader(), roomCache = new Map();
function loadRoom(id) {
  if (!roomCache.has(id)) roomCache.set(id, (async () => {
    const base = new URL('./rooms/', import.meta.url).href, gltf = await loader.loadAsync(base + id + '.glb' + BAKE), tex = {};
    for (const ph of ['day', 'evening', 'night']) { const t = await texLoader.loadAsync(base + id + '_' + ph + '.jpg' + BAKE); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; tex[ph] = t; }
    const shellMat = new THREE.MeshBasicMaterial({ map: tex.day }), glassMat = new THREE.MeshStandardMaterial({ color: '#DDF0F7', transparent: true, opacity: 0.18, roughness: 0.08, depthWrite: false });
    gltf.scene.traverse((o) => { if (!o.isMesh) return; const glass = /glass/i.test(o.name + ' ' + ((o.material && o.material.name) || '')); o.material = glass ? glassMat : shellMat; o.castShadow = false; o.receiveShadow = false; if (glass) o.renderOrder = 5; });
    return { scene: gltf.scene, tex, shellMat };
  })());
  return roomCache.get(id);
}

function floorTexture(kind, cols) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const x = c.getContext('2d'); x.fillStyle = cols[0]; x.fillRect(0, 0, 512, 512);
  if (kind === 'tile') {
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { if ((i + j) % 2) { x.fillStyle = cols[1]; x.fillRect(i * 64, j * 64, 64, 64); } }
    x.strokeStyle = 'rgba(0,0,0,.05)'; x.lineWidth = 2; for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, 512); x.moveTo(0, i * 64); x.lineTo(512, i * 64); x.stroke(); }
  } else {
    const r = seeded(11);
    for (let row = 0; row < 8; row++) {
      let px = -r() * 120;
      while (px < 512) { const w = 110 + r() * 110; x.fillStyle = r() > 0.5 ? cols[1] : cols[0]; x.fillRect(px, row * 64, w, 64); x.fillStyle = 'rgba(60,30,10,.16)'; x.fillRect(px + w - 2, row * 64, 2, 64); px += w; }
      x.fillStyle = 'rgba(60,30,10,.14)'; x.fillRect(0, row * 64 + 62, 512, 2);
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

function pawTexture(bg, fg) {
  const c = document.createElement('canvas'); c.width = 200; c.height = 260; const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 200, 260); x.fillStyle = fg;
  x.beginPath(); x.ellipse(100, 160, 38, 30, 0, 0, 7); x.fill();
  [[52, 112], [82, 82], [118, 82], [148, 112]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 16, 0, 7); x.fill(); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* Their picture, in a frame somewhere in the room. */
function photoFrame(R, photoTex) {
  const g = new THREE.Group(), f = R.frame; if (!f) return g;
  const pic = mesh(new THREE.PlaneGeometry(f.w, f.h), new THREE.MeshBasicMaterial({ map: photoTex || pawTexture(R.trim, R.accent) })); pic.castShadow = false;
  const hold = new THREE.Group(); hold.add(at(pic, 0, 0, 0.012));
  if (f.border) hold.add(at(rbox(f.w + 0.16, f.h + 0.16, 0.08, R.wood, 0.03), 0, 0, -0.04));
  if (f.face === 'x') hold.rotation.y = Math.PI / 2;
  g.add(at(hold, f.at[0], f.at[1], f.at[2])); return g;
}

/* ---------- things to furnish with (origin: centre of the footprint, on the floor; front faces +z) ---------- */

export const THINGS = {
  sofa: { w: 4, d: 2, solid: true, build: (R) => grp(
    at(rbox(3.8, 0.62, 1.8, R.accent, 0.2), 0, 0.5, 0), at(rbox(3.8, 1.2, 0.5, R.accent, 0.2), 0, 1.0, -0.65),
    at(rbox(0.5, 0.95, 1.8, shade(R.accent, -0.04), 0.2), -1.68, 0.72, 0), at(rbox(0.5, 0.95, 1.8, shade(R.accent, -0.04), 0.2), 1.68, 0.72, 0),
    at(rbox(1.36, 0.26, 1.2, shade(R.accent, 0.07), 0.12), -0.7, 0.9, 0.18), at(rbox(1.36, 0.26, 1.2, shade(R.accent, 0.07), 0.12), 0.7, 0.9, 0.18),
    at(rot(rbox(0.7, 0.7, 0.24, R.trim, 0.11), -0.25, 0.3, 0.1), -1.05, 1.32, -0.2),
    ...[-1.6, 1.6].flatMap((x) => [-0.7, 0.7].map((z) => at(cyl(0.07, 0.05, 0.22, R.wood, 10), x, 0.1, z)))) },
  armchair: { w: 2, d: 2, solid: true, build: (R) => grp(
    at(rbox(1.8, 0.6, 1.7, R.accent, 0.22), 0, 0.5, 0), at(rbox(1.8, 1.3, 0.5, R.accent, 0.22), 0, 1.05, -0.6),
    at(rbox(0.42, 0.9, 1.7, shade(R.accent, -0.04), 0.2), -0.7, 0.72, 0), at(rbox(0.42, 0.9, 1.7, shade(R.accent, -0.04), 0.2), 0.7, 0.72, 0),
    at(rbox(0.96, 0.24, 1.1, shade(R.accent, 0.07), 0.11), 0, 0.88, 0.2),
    ...[-0.72, 0.72].flatMap((x) => [-0.65, 0.65].map((z) => at(cyl(0.07, 0.05, 0.22, R.wood, 10), x, 0.1, z)))) },
  bookshelf: { w: 3, d: 1, solid: true, build: (R) => {
    const g = grp(at(rbox(2.8, 3.5, 0.1, shade(R.wood, -0.05), 0.03), 0, 1.78, -0.36), at(rbox(0.14, 3.6, 0.8, R.wood, 0.04), -1.36, 1.8, 0), at(rbox(0.14, 3.6, 0.8, R.wood, 0.04), 1.36, 1.8, 0));
    const r = seeded(5), cols = [R.accent, R.accent2, '#E98B6F', '#7FB0C8', R.trim, '#B79AD8', '#F1C76A'];
    [0.08, 0.95, 1.82, 2.69, 3.54].forEach((y, i) => {
      g.add(at(rbox(2.72, 0.12, 0.8, R.wood, 0.03), 0, y, 0));
      if (i > 3) return;
      let x = -1.2;
      if (i === 2) { g.add(at(cyl(0.2, 0.15, 0.3, R.trim, 16), -0.85, y + 0.21, 0.05), at(sph(0.27, '#6FA06E', 1, 0.9, 1), -0.85, y + 0.52, 0.05)); x = -0.4; }
      while (x < 1.05) { const w = 0.12 + r() * 0.12, h = 0.45 + r() * 0.26; if (r() > 0.2) g.add(at(rbox(w, h, 0.5, cols[(r() * cols.length) | 0], 0.02), x + w / 2, y + 0.06 + h / 2, 0)); x += w + 0.03; }
    });
    return g; } },
  lamp: { w: 1, d: 1, solid: true, light: [0, 3.1, 0], build: (R) => grp(
    at(cyl(0.34, 0.38, 0.1, R.wood, 24), 0, 0.05, 0), at(cyl(0.045, 0.045, 3, R.wood, 10), 0, 1.55, 0),
    at(cyl(0.3, 0.52, 0.7, R.trim, 28, { emissive: '#FFE2A8', emissiveIntensity: 0.25 }), 0, 3.25, 0)) },
  plant: { w: 1, d: 1, solid: true, build: (R) => {
    const g = grp(at(cyl(0.36, 0.27, 0.6, R.trim, 24), 0, 0.3, 0), at(cyl(0.33, 0.33, 0.04, '#6B4F3A', 20), 0, 0.59, 0)), r = seeded(3);
    for (let i = 0; i < 9; i++) { const a = r() * 6.28, d = 0.08 + r() * 0.26; g.add(at(sph(0.2 + r() * 0.14, r() > 0.5 ? '#6FA06E' : '#86B581', 1, 1.15, 1), Math.cos(a) * d, 0.86 + r() * 0.6, Math.sin(a) * d)); }
    return g; } },
  monstera: { w: 1, d: 1, solid: true, build: (R) => {
    const g = grp(at(cyl(0.4, 0.3, 0.72, R.accent, 24), 0, 0.36, 0), at(cyl(0.37, 0.37, 0.04, '#6B4F3A', 20), 0, 0.71, 0)), r = seeded(9);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * 6.28 + r(), h = 1.1 + r() * 1.1, lean = 0.25 + r() * 0.35;
      const stem = at(cyl(0.025, 0.03, h, '#5E8F5F', 6), 0, h / 2, 0), leaf = at(sph(0.34 + r() * 0.1, i % 2 ? '#5E9A63' : '#79B07A', 1, 0.12, 1.25), 0, h, 0.12);
      leaf.rotation.x = 0.5; const s = grp(stem, leaf); s.rotation.set(lean * Math.cos(a), 0, lean * Math.sin(a)); s.position.y = 0.66; g.add(s);
    }
    return g; } },
  flowers: { w: 1, d: 1, solid: true, build: (R) => {
    const g = grp(at(cyl(0.44, 0.44, 0.08, R.wood, 28), 0, 1.0, 0), at(cyl(0.06, 0.06, 0.96, R.wood, 10), 0, 0.5, 0), at(cyl(0.3, 0.34, 0.06, R.wood, 24), 0, 0.03, 0),
      at(cyl(0.13, 0.17, 0.42, R.trim, 20), 0, 1.25, 0)), r = seeded(21), cols = ['#F2A7A0', '#F6D36B', '#FFFFFF', '#E88F8A', '#F4B9C8'];
    for (let i = 0; i < 9; i++) { const a = r() * 6.28, d = r() * 0.24, h = 1.62 + r() * 0.38; g.add(at(cyl(0.012, 0.012, h - 1.3, '#6FA06E', 5), Math.cos(a) * d * 0.5, (h + 1.3) / 2, Math.sin(a) * d * 0.5), at(sph(0.09 + r() * 0.04, cols[i % 5]), Math.cos(a) * d, h, Math.sin(a) * d)); }
    return g; } },
  candles: { w: 1, d: 1, solid: true, light: [0, 1.5, 0], build: (R) => {
    const g = grp(at(rbox(0.9, 0.9, 0.8, R.wood, 0.06), 0, 0.45, 0), at(rbox(1.0, 0.08, 0.9, shade(R.wood, 0.06), 0.03), 0, 0.93, 0));
    [[-0.24, 0.42, 0.05], [0.04, 0.3, -0.1], [0.28, 0.5, 0.08]].forEach(([x, h, z]) => g.add(at(cyl(0.09, 0.09, h, '#FFF8EC', 16), x, 0.97 + h / 2, z),
      at(sph(0.05, '#FFD27A', 0.8, 1.5, 0.8, { emissive: '#FFB347', emissiveIntensity: 2.2 }), x, 1.04 + h, z)));
    return g; } },
  rug: { w: 4, d: 4, solid: false, flat: true, build: (R) => { const a = at(cyl(2.05, 2.05, 0.05, R.rug[0], 48), 0, 0.025, 0), b = at(cyl(1.62, 1.62, 0.052, R.rug[1], 48), 0, 0.026, 0), c = at(cyl(1.5, 1.5, 0.054, R.rug[0], 48), 0, 0.027, 0); [a, b, c].forEach((m) => { m.castShadow = false; }); return grp(a, b, c); } },
  petbed: { w: 2, d: 2, solid: false, rest: 0.26, build: (R) => grp(
    at(cyl(0.92, 0.96, 0.24, R.accent2, 36), 0, 0.12, 0), at(rot(mesh(new THREE.TorusGeometry(0.76, 0.22, 14, 40), shade(R.accent2, -0.03)), Math.PI / 2, 0, 0), 0, 0.3, 0),
    at(sph(0.66, R.trim, 1, 0.26, 1), 0, 0.3, 0)) },
  cattree: { w: 2, d: 2, solid: true, perch: 3.02, build: (R) => grp(
    at(rbox(1.8, 0.16, 1.8, R.trim, 0.06), 0, 0.08, 0), at(cyl(0.16, 0.16, 2.9, '#D9B98A', 16), -0.3, 1.5, -0.3), at(cyl(0.13, 0.13, 1.5, '#D9B98A', 16), 0.55, 0.85, 0.45),
    at(cyl(0.62, 0.62, 0.12, R.trim, 30), 0.55, 1.62, 0.45), at(cyl(0.8, 0.8, 0.14, R.trim, 32), -0.3, 2.95, -0.3),
    at(rot(mesh(new THREE.TorusGeometry(0.7, 0.12, 10, 32), R.accent2), Math.PI / 2, 0, 0), -0.3, 3.06, -0.3),
    at(cyl(0.012, 0.012, 0.55, '#8C7A66', 5), 0.95, 1.3, 0.75), at(sph(0.12, R.accent), 0.95, 1.0, 0.75)) },
  box: { w: 2, d: 2, solid: false, rest: 0.06, build: () => { const c = '#D6AC78', d = '#C59B66'; return grp(
    at(rbox(1.5, 0.06, 1.3, d, 0.02), 0, 0.03, 0), at(rbox(1.5, 0.8, 0.06, c, 0.02), 0, 0.4, -0.65), at(rbox(1.5, 0.8, 0.06, c, 0.02), 0, 0.4, 0.65),
    at(rbox(0.06, 0.8, 1.3, c, 0.02), -0.75, 0.4, 0), at(rbox(0.06, 0.8, 1.3, c, 0.02), 0.75, 0.4, 0),
    at(rot(rbox(0.5, 0.05, 1.3, d, 0.02), 0, 0, 0.6), -0.94, 0.92, 0), at(rot(rbox(0.5, 0.05, 1.3, d, 0.02), 0, 0, -0.6), 0.94, 0.92, 0)); } },
  ball: { w: 1, d: 1, solid: false, toy: true, build: (R) => grp(at(sph(0.22, R.accent2), 0, 0.22, 0), at(rot(mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 24), R.trim), 1.2, 0.4, 0), 0, 0.22, 0)) },
  bone: { w: 1, d: 1, solid: false, toy: true, build: (R) => grp(at(rot(cyl(0.07, 0.07, 0.5, R.trim, 12), 0, 0, Math.PI / 2), 0, 0.12, 0),
    ...[-0.27, 0.27].flatMap((x) => [-0.07, 0.07].map((z) => at(sph(0.1, R.trim), x, 0.12, z)))) },
  water: { w: 1, d: 1, solid: true, fixed: true, build: () => grp(at(cyl(0.34, 0.26, 0.2, '#7FB0C8', 28), 0, 0.1, 0), at(cyl(0.29, 0.29, 0.02, '#D4EEF7', 24, { roughness: 0.2 }), 0, 0.195, 0)) },
  food: { w: 1, d: 1, solid: true, fixed: true, build: () => { const k = at(sph(0.27, '#A9774B', 1, 0.42, 1), 0, 0.2, 0); k.name = 'kibble'; return grp(at(cyl(0.34, 0.26, 0.2, '#E98B6F', 28), 0, 0.1, 0), at(cyl(0.29, 0.29, 0.02, '#5C3E2A', 24), 0, 0.17, 0), k); } },
};
export const SHOP = ['petbed', 'cattree', 'box', 'ball', 'bone', 'sofa', 'armchair', 'bookshelf', 'lamp', 'plant', 'monstera', 'flowers', 'candles', 'rug'];

const size = (it) => { const T = THINGS[it.id]; return it.r % 2 ? [T.d, T.w] : [T.w, T.d]; };

/* ---------- pets ---------- */

export const SPECIES = {
  cat: { L: 1.12, R: 0.29, leg: 0.4, legR: 0.08, head: 0.33, snout: 0.1, ear: 'point', tail: 'long', eye: 0.058, speed: 1.6, gait: 'walk', look: { base: '#E3A35F', second: '#FBEEDB', dark: '#B9772F', pattern: 'stripes' } },
  dog: { L: 1.26, R: 0.33, leg: 0.5, legR: 0.095, head: 0.36, snout: 0.24, ear: 'flop', tail: 'wag', eye: 0.058, speed: 1.9, gait: 'walk', look: { base: '#D9A05B', second: '#F7E6C8', dark: '#B67A3A', pattern: 'belly' } },
  rabbit: { L: 0.92, R: 0.31, leg: 0.24, legR: 0.085, head: 0.3, snout: 0.07, ear: 'long', tail: 'pom', eye: 0.055, speed: 1.6, gait: 'hop', look: { base: '#F4EFE7', second: '#FFFFFF', dark: '#CDBFAE', pattern: 'belly' } },
  hamster: { L: 0.66, R: 0.3, leg: 0.11, legR: 0.07, head: 0.27, snout: 0.05, ear: 'round', tail: 'none', eye: 0.05, speed: 1.3, gait: 'scurry', look: { base: '#E8B26A', second: '#FFF6E6', dark: '#C98B3F', pattern: 'belly' } },
  parrot: { biped: true, speed: 1.1, gait: 'hop', look: { base: '#7CC576', second: '#F6D94C', dark: '#3E8FC6', pattern: 'solid' } },
  turtle: { shell: true, speed: 0.45, gait: 'crawl', look: { base: '#8FBF7A', second: '#EADFA8', dark: '#6C8F4E', pattern: 'solid' } },
};

const EYE = '#1D1714';
function eyeBall(r) { const g = grp(sph(r, EYE, 1, 1, 0.7, { roughness: 0.25 })); const h = at(sph(r * 0.36, '#FFFFFF', 1, 1, 0.7, { emissive: '#FFFFFF', emissiveIntensity: 0.6 }), r * 0.3, r * 0.34, r * 0.5); h.castShadow = false; g.add(h); return g; }

function buildQuad(P, K) {
  const root = new THREE.Group(), rig = new THREE.Group(); root.add(rig);
  const hip = P.leg + P.R * 0.55, zc = P.L / 2 - P.R, parts = { legs: [], ears: [], tail: [], eyes: [] };
  const torso = at(new THREE.Group(), 0, hip, -zc); rig.add(torso);
  const body = at(rot(cap(P.R, P.L - 2 * P.R, K.base), Math.PI / 2, 0, 0), 0, 0, zc); torso.add(body);
  const light = K.pattern === 'solid' ? K.base : K.second, pts = K.pattern === 'points' ? K.dark : null;
  if (K.pattern !== 'solid') torso.add(at(rot(cap(P.R * 0.84, P.L - 2 * P.R, light), Math.PI / 2, 0, 0), 0, -P.R * 0.24, zc + 0.02));
  if (K.pattern === 'stripes') for (let i = 0; i < 4; i++) torso.add(at(rot(mesh(new THREE.TorusGeometry(P.R * 0.995, 0.03, 6, 30, Math.PI * 0.9), K.dark), 0, 0, Math.PI * 0.05), 0, 0.004, zc - P.L * 0.3 + i * P.L * 0.19));
  if (K.pattern === 'patches') { const r = seeded(4); for (let i = 0; i < 4; i++) { const a = (r() - 0.5) * 2.2; torso.add(at(sph(P.R * (0.42 + r() * 0.2), K.dark, 1, 0.35, 1.2), Math.sin(a) * P.R * 0.86, Math.cos(a) * P.R * 0.86, zc + (r() - 0.5) * P.L * 0.55).rotateZ(-a)); } }
  // head
  const head = at(new THREE.Group(), 0, P.R * 0.5, 2 * zc + P.R * 0.55 + P.head * 0.35); torso.add(head);
  head.add(sph(P.head, K.base, 1.06, 0.94, 1));
  if (pts) head.add(at(sph(P.head * 0.72, pts, 1, 0.9, 0.6), 0, -P.head * 0.05, P.head * 0.52));
  head.add(at(sph(P.head * 0.5, pts || light, 1, 0.72, 0.55 + P.snout / P.head), 0, -P.head * 0.28, P.head * 0.72));
  head.add(at(sph(P.head * 0.13, '#3A2A24', 1.2, 0.85, 1), 0, -P.head * 0.2, P.head * 0.98 + P.snout * 0.9));
  if (K.pattern === 'patches') head.add(at(sph(P.head * 0.4, K.dark, 1, 1, 0.5), P.head * 0.42, P.head * 0.2, P.head * 0.66));
  if (K.pattern === 'stripes') [-0.14, 0, 0.14].forEach((x) => head.add(at(rbox(0.04, 0.03, P.head * 0.5, K.dark, 0.012), x, P.head * 0.9 - Math.abs(x) * 0.25, P.head * 0.22)));
  [-1, 1].forEach((s) => { const e = at(eyeBall(P.eye), s * P.head * 0.44, P.head * 0.1, P.head * 0.84); e.rotation.y = s * 0.35; head.add(e); parts.eyes.push(e); });
  if (P.ear === 'round') [-1, 1].forEach((s) => head.add(at(sph(P.head * 0.2, '#F2B8A8', 1.2, 0.8, 0.7), s * P.head * 0.62, -P.head * 0.36, P.head * 0.62))); // cheeks
  const earCol = pts || (K.pattern === 'belly' && P.ear === 'flop' ? K.dark : K.base);
  [-1, 1].forEach((s) => {
    const ear = new THREE.Group(); let m;
    if (K.ear === 'point' || (P.ear === 'point' && !K.ear)) { m = grp(at(cone(P.head * 0.36, P.head * 0.62, earCol, 4), 0, P.head * 0.28, 0), at(cone(P.head * 0.2, P.head * 0.4, '#F2B8A8', 4), 0, P.head * 0.24, P.head * 0.09)); m.scale.z = 0.55; m.rotation.y = Math.PI / 4 * 0; ear.position.set(s * P.head * 0.6, P.head * 0.6, -P.head * 0.05); ear.rotation.z = -s * 0.3; }
    else if (P.ear === 'long') { m = grp(at(cap(P.head * 0.19, P.head * 1.05, earCol), 0, P.head * 0.7, 0), at(cap(P.head * 0.1, P.head * 0.86, '#F2B8A8'), 0, P.head * 0.7, P.head * 0.11)); m.scale.z = 0.5; ear.position.set(s * P.head * 0.36, P.head * 0.72, -P.head * 0.12); ear.rotation.z = -s * 0.16; }
    else if (P.ear === 'round') { m = grp(sph(P.head * 0.3, earCol, 1, 1, 0.45), at(sph(P.head * 0.18, '#F2B8A8', 1, 1, 0.4), 0, 0, P.head * 0.08)); ear.position.set(s * P.head * 0.72, P.head * 0.72, 0); }
    else { m = at(sph(P.head * 0.42, shade(earCol, -0.06), 0.6, 1.3, 0.5), 0, -P.head * 0.46, 0); ear.position.set(s * P.head * 0.98, P.head * 0.56, P.head * 0.02); ear.rotation.z = s * 0.3; }
    ear.add(m); head.add(ear); parts.ears.push(ear);
  });
  // legs
  const legLen = hip - P.R * 0.35;
  [[-1, 0], [1, 0], [-1, 1], [1, 1]].forEach(([s, front]) => {
    const pv = at(new THREE.Group(), s * P.R * 0.56, -P.R * 0.35, front ? 2 * zc - 0.02 : 0.02);
    pv.add(at(cap(P.legR, Math.max(0.01, legLen - P.legR * 2), K.base), 0, -legLen / 2, 0), at(sph(P.legR * 1.3, pts || light, 1, 0.75, 1.35), 0, -legLen + P.legR * 0.8, P.legR * 0.35));
    torso.add(pv); parts.legs.push(pv);
  });
  // tail
  const tail = at(new THREE.Group(), 0, P.R * 0.35, -P.R * 0.85); torso.add(tail);
  if (P.tail === 'long') { let parent = tail; for (let i = 0; i < 3; i++) { const seg = at(new THREE.Group(), 0, i ? 0.3 : 0, 0); seg.add(at(cap(0.065 - i * 0.008, 0.26, i === 2 && K.pattern !== 'solid' ? K.dark : (pts || K.base)), 0, 0.16, 0)); parent.add(seg); parts.tail.push(seg); parent = seg; } }
  else if (P.tail === 'wag') { const seg = new THREE.Group(); seg.add(at(cap(0.07, 0.34, K.base), 0, 0.2, 0), at(sph(0.085, light), 0, 0.42, 0)); tail.add(seg); parts.tail.push(seg); }
  else if (P.tail === 'pom') tail.add(at(sph(0.15, K.second), 0, -0.02, -0.04));
  return { root, rig, torso, head, parts, hip, kind: 'quad', P };
}

function buildTurtle(K) {
  const root = new THREE.Group(), rig = new THREE.Group(); root.add(rig);
  const torso = at(new THREE.Group(), 0, 0.3, 0); rig.add(torso);
  const parts = { legs: [], ears: [], tail: [], eyes: [] };
  torso.add(at(sph(0.52, K.dark, 1, 0.6, 1.18), 0, 0.08, 0), at(sph(0.5, K.second, 0.98, 0.2, 1.14), 0, -0.06, 0));
  const r = seeded(2); for (let i = 0; i < 7; i++) { const a = (i / 7) * 6.28, d = i === 0 ? 0 : 0.3; torso.add(at(sph(i === 0 ? 0.19 : 0.14, shade(K.dark, 0.09), 1, 0.3, 1), Math.cos(a) * d, 0.37 - d * 0.28 + (i === 0 ? 0.02 : 0), Math.sin(a) * d * 1.15 + r() * 0)); }
  const head = at(new THREE.Group(), 0, 0.02, 0.62); torso.add(head);
  head.add(at(rot(cap(0.1, 0.2, K.base), Math.PI / 2, 0, 0), 0, 0, -0.1), at(sph(0.19, K.base, 1, 0.9, 1.1), 0, 0.03, 0.12));
  [-1, 1].forEach((s) => { const e = at(eyeBall(0.04), s * 0.13, 0.08, 0.22); e.rotation.y = s * 0.6; head.add(e); parts.eyes.push(e); });
  [[-1, 0], [1, 0], [-1, 1], [1, 1]].forEach(([s, front]) => { const pv = at(new THREE.Group(), s * 0.4, -0.1, front ? 0.36 : -0.36); pv.add(at(cap(0.1, 0.14, K.base), s * 0.06, -0.1, front ? 0.05 : -0.05)); pv.rotation.z = s * 0.5; torso.add(pv); parts.legs.push(pv); });
  torso.add(at(rot(cone(0.06, 0.2, K.base, 10), -1.9, 0, 0), 0, -0.04, -0.66));
  return { root, rig, torso, head, parts, hip: 0.3, kind: 'turtle' };
}

function buildParrot(K) {
  const root = new THREE.Group(), rig = new THREE.Group(); root.add(rig);
  const torso = at(new THREE.Group(), 0, 0.5, 0); rig.add(torso);
  const parts = { legs: [], ears: [], tail: [], eyes: [], wings: [] };
  torso.add(sph(0.34, K.base, 1, 1.22, 1.02), at(sph(0.27, K.second, 0.9, 1, 0.7), 0, -0.02, 0.17));
  const head = at(new THREE.Group(), 0, 0.5, 0.08); torso.add(head);
  head.add(sph(0.27, K.second, 1, 0.98, 1), at(sph(0.2, K.base, 1, 0.7, 1), 0, 0.12, -0.06));
  head.add(at(rot(cone(0.1, 0.24, '#F0932E', 14), 2.0, 0, 0), 0, -0.04, 0.27), at(sph(0.075, '#F7B34A', 1.1, 0.7, 1), 0, 0.02, 0.24));
  [-1, 1].forEach((s) => { const e = at(eyeBall(0.045), s * 0.19, 0.06, 0.16); e.rotation.y = s * 0.9; head.add(e); parts.eyes.push(e); head.add(at(sph(0.05, '#F4A7A0', 1, 0.7, 0.4), s * 0.2, -0.05, 0.15)); });
  head.add(at(rot(sph(0.07, K.base, 0.6, 1.6, 0.6), -0.5, 0, 0), 0, 0.3, -0.06));
  [-1, 1].forEach((s) => { const pv = at(new THREE.Group(), s * 0.3, 0.22, -0.02); pv.add(at(sph(0.3, K.dark, 0.26, 1.1, 0.8), s * 0.03, -0.28, -0.04)); torso.add(pv); parts.wings.push(pv); });
  const tail = at(new THREE.Group(), 0, -0.26, -0.24); tail.add(at(rot(rbox(0.2, 0.05, 0.62, K.dark, 0.02), -0.7, 0, 0), 0, -0.14, -0.2)); torso.add(tail); parts.tail.push(tail);
  [-1, 1].forEach((s) => { const pv = at(new THREE.Group(), s * 0.13, -0.36, 0.02); pv.add(at(cyl(0.025, 0.025, 0.18, '#E9A23F', 6), 0, -0.07, 0), at(rbox(0.1, 0.03, 0.2, '#E9A23F', 0.012), 0, -0.15, 0.04)); torso.add(pv); parts.legs.push(pv); });
  return { root, rig, torso, head, parts, hip: 0.5, kind: 'parrot' };
}

export function buildPet(def) {
  const P = SPECIES[def.species] || SPECIES.cat, K = Object.assign({}, P.look, def.look || {});
  if (K.ear === 'auto') delete K.ear;
  const m = P.shell ? buildTurtle(K) : P.biped ? buildParrot(K) : buildQuad(P, K);
  m.P = P; m.species = def.species; m.root.scale.setScalar((def.scale || 1) * 1.3);
  return m;
}

/* A pose is a handful of 0–1 dials; each frame the model eases toward them. */
function animate(m, s, t, dt) {
  const q = s.cur, P = m.P, legs = m.parts.legs, walk = q.move;
  for (const k in s.pose) q[k] = damp(q[k] || 0, s.pose[k], k === 'eyes' ? 14 : 7, dt);
  const breathe = Math.sin(t * (q.lie > 0.5 ? 1.3 : 2)) * 0.012;
  if (m.kind === 'quad') {
    const hip = m.hip, zc = P.L / 2 - P.R;
    const sitY = hip - P.leg * 0.78, lieY = P.R * 0.92;
    m.torso.position.y = hip + (sitY - hip) * q.sit + (lieY - hip) * q.lie + (P.gait === 'hop' ? 0 : Math.abs(Math.sin(s.gait * 2)) * 0.03 * walk);
    m.torso.rotation.x = -0.62 * q.sit + (P.gait === 'hop' ? -Math.max(0, Math.sin(s.gait * 2)) * 0.25 * walk : 0);
    m.torso.scale.y = 1 + breathe;
    const sw = Math.sin(s.gait * 2), amp = (P.gait === 'scurry' ? 0.5 : 0.55) * walk;
    legs.forEach((leg, i) => {
      const front = i > 1, diag = (i === 0 || i === 3) ? 1 : -1;
      const swing = P.gait === 'hop' ? (front ? -1 : 1) * Math.max(-0.3, sw) * 0.7 * walk : diag * sw * amp;
      const sit = front ? 0.62 : -0.95, lie = front ? -1.42 : -1.25;
      leg.rotation.x = swing + sit * q.sit + lie * q.lie;
    });
    m.rig.position.y = (P.gait === 'hop' ? Math.max(0, Math.sin(s.gait * 2)) * 0.26 * walk : 0) + q.bounce * Math.abs(Math.sin(t * 9)) * 0.14;
    m.head.position.y = P.R * 0.5 - q.lie * P.R * 0.42 - q.dip * P.R * 0.5;
    m.head.position.z = 2 * zc + P.R * 0.55 + P.head * 0.35 + q.dip * 0.05;
    m.head.rotation.x = 0.62 * q.sit * 0.9 + q.lie * 0.18 + q.dip * (0.75 + Math.sin(t * 9) * 0.12) + q.lookP - q.bounce * 0.2 - 0.3 * (1 - q.lie) * (1 - q.dip);
    m.head.rotation.y = q.lookY; m.head.rotation.z = q.tilt * 0.3;
    const tw = m.parts.tail;
    if (P.tail === 'long') tw.forEach((sg, i) => { sg.rotation.x = (i === 0 ? -1.05 + q.lie * -0.45 + q.sit * 0.5 : 0.48) + Math.sin(t * 1.4 + i) * 0.06; sg.rotation.z = Math.sin(t * (1.6 + q.bounce * 6) + i * 0.8) * (0.14 + q.bounce * 0.25) * (i + 1) * 0.6; });
    if (P.tail === 'wag') { tw[0].rotation.x = -0.75 + q.sit * 0.5 - q.lie * 0.5; tw[0].rotation.z = Math.sin(t * (3 + q.bounce * 16 + q.dip * 6)) * (0.18 + q.bounce * 0.6 + q.dip * 0.2); }
    m.parts.ears.forEach((e, i) => { const tw2 = Math.max(0, Math.sin(t * 0.9 + i * 2.2) - 0.94) * 5; if (P.ear === 'long') e.rotation.x = -0.12 - q.lie * 0.9 + tw2 * 0.4 - walk * 0.25; else if (P.ear === 'point' || m.parts.ears.length) e.rotation.x = tw2 * 0.3 - q.lie * 0.15; });
  } else if (m.kind === 'turtle') {
    m.torso.position.y = 0.3 - q.lie * 0.1 + Math.abs(Math.sin(s.gait * 2)) * 0.015 * walk; m.torso.scale.y = 1 + breathe;
    legs.forEach((leg, i) => { const diag = (i === 0 || i === 3) ? 1 : -1; leg.rotation.x = diag * Math.sin(s.gait * 2) * 0.5 * walk; const sc = 1 - q.lie * 0.75; leg.scale.setScalar(Math.max(0.2, sc)); });
    const hide = Math.max(q.lie * 0.9, q.shy);
    m.head.position.z = 0.62 - hide * 0.36 + q.dip * 0.06; m.head.position.y = 0.02 - q.dip * 0.12;
    m.head.rotation.x = q.dip * 0.6 + q.lookP * 0.6; m.head.rotation.y = q.lookY * 0.7;
    m.rig.position.y = q.bounce * Math.abs(Math.sin(t * 7)) * 0.05;
  } else {
    m.torso.position.y = 0.5 - q.lie * 0.16 - q.sit * 0.05; m.torso.rotation.x = q.dip * (0.42 + Math.sin(t * 8) * 0.1) + q.lie * 0.1; m.torso.scale.y = 1 + breathe;
    m.rig.position.y = Math.max(0, Math.sin(s.gait * 2)) * 0.16 * walk + q.bounce * Math.abs(Math.sin(t * 10)) * 0.22;
    m.parts.wings.forEach((w, i) => { const sgn = i ? 1 : -1; w.rotation.z = sgn * (0.04 + q.bounce * (0.9 + Math.sin(t * 22) * 0.6) + walk * 0.12); });
    legs.forEach((leg, i) => { leg.rotation.x = (i ? 1 : -1) * Math.sin(s.gait * 2) * 0.5 * walk; });
    m.head.rotation.y = q.lookY + q.lie * 2.2; m.head.rotation.x = q.lookP * 0.8 + q.lie * 0.3 - q.dip * 0.2; m.head.rotation.z = q.tilt * 0.45;
    m.head.position.y = 0.5 - q.lie * 0.08;
    m.parts.tail[0].rotation.x = Math.sin(t * 2) * 0.05 + q.bounce * 0.3;
  }
  const blink = Math.sin(t * 0.7 + 1.3) > 0.985 ? 0.1 : 1, open = Math.min(1 - q.sleepy, blink);
  m.parts.eyes.forEach((e) => { e.scale.y = Math.max(0.1, open * (1 - q.squint * 0.72)); });
}

const POSES = {
  stand: { sit: 0, lie: 0, dip: 0, sleepy: 0, squint: 0, bounce: 0, shy: 0 },
  sit: { sit: 1, lie: 0, dip: 0, sleepy: 0, squint: 0, bounce: 0, shy: 0 },
  lie: { sit: 0, lie: 1, dip: 0, sleepy: 0, squint: 0.3, bounce: 0, shy: 0 },
  sleep: { sit: 0, lie: 1, dip: 0, sleepy: 1, squint: 0, bounce: 0, shy: 0 },
  eat: { sit: 0, lie: 0, dip: 1, sleepy: 0, squint: 0.2, bounce: 0, shy: 0 },
  happy: { sit: 0.6, lie: 0, dip: 0, sleepy: 0, squint: 1, bounce: 1, shy: 0 },
  shy: { sit: 0, lie: 0.4, dip: 0, sleepy: 0, squint: 0.6, bounce: 0, shy: 1 },
};

function heartMesh() {
  const s = new THREE.Shape(); s.moveTo(0, -0.11); s.bezierCurveTo(-0.2, 0.04, -0.09, 0.2, 0, 0.09); s.bezierCurveTo(0.09, 0.2, 0.2, 0.04, 0, -0.11);
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 }), new THREE.MeshStandardMaterial({ color: '#F27C8A', emissive: '#F27C8A', emissiveIntensity: 0.35, transparent: true }));
  return m;
}

/* ---------- the world ---------- */

export function createWorld(opts = {}) {
  const canvas = document.createElement('canvas'); canvas.className = 'world';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: !!opts.snap });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(22, 4 / 3, 1, 300);
  const view = { w: 800, h: 600, zoom: 1, drift: 0, inset: { l: 0, r: 0, t: 0, b: 0 }, want: { l: 0, r: 0, t: 0, b: 0 } };
  const hemi = new THREE.HemisphereLight('#ffffff', '#E9D7C4', 1.5); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#FFF3E0', 2.3); sun.position.set(7.5, 17, 9.5); sun.target.position.set(4, 0, 4); scene.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 5; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 50 }); sun.shadow.camera.updateProjectionMatrix();
  const fill = new THREE.DirectionalLight('#DDE8FF', 0.55); fill.position.set(2, 8, 14); scene.add(fill);
  const roomG = new THREE.Group(), itemsG = new THREE.Group(), petG = new THREE.Group(), fxG = new THREE.Group(), lampsG = new THREE.Group();
  const extraG = new THREE.Group(), roomLampsG = new THREE.Group(); roomG.add(extraG, roomLampsG);
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(N, N), new THREE.ShadowMaterial({ opacity: 0.2 })); catcher.rotation.x = -Math.PI / 2; catcher.position.set(N / 2, 0.006, N / 2); catcher.receiveShadow = true;
  scene.add(roomG, catcher, itemsG, petG, fxG, lampsG);
  let roomToken = 0, roomAsset = null;

  const W = { canvas, roomId: 'bay', items: [], pet: null, mode: 'live', phase: 'day', sel: null, listeners: {}, az: Math.PI / 4, photoTex: null, fedUntil: 0 };
  const emit = (ev, ...a) => (W.listeners[ev] || []).forEach((f) => f(...a));
  W.on = (ev, f) => { (W.listeners[ev] = W.listeners[ev] || []).push(f); return W; };
  const R = () => ROOMS[W.roomId];

  const tgt = new THREE.Vector3(N / 2 - 0.1, 1.9, N / 2 - 0.1);
  function placeCamera() {
    // Stand far enough back that the room fits in whatever part of the window is free, then slide the picture so the room sits in the middle of it.
    const e = 0.55, i = view.inset, fw = Math.max(160, view.w - i.l - i.r), fh = Math.max(160, view.h - i.t - i.b), half = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const d = Math.max((5.5 / half) * (view.h / fh), (7.3 / (half * cam.aspect)) * (view.w / fw)) / view.zoom, az = W.az + view.drift;
    cam.position.set(tgt.x + d * Math.sin(az) * Math.cos(e), tgt.y + d * Math.sin(e), tgt.z + d * Math.cos(az) * Math.cos(e)); cam.lookAt(tgt);
    cam.setViewOffset(view.w, view.h, (i.r - i.l) / 2, (i.b - i.t) / 2, view.w, view.h);
  }
  W.resize = () => {
    const w = canvas.clientWidth || (canvas.parentElement && canvas.parentElement.clientWidth) || 800, h = canvas.clientHeight || (w * 3) / 4;
    view.w = w; view.h = h; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); placeCamera();
  };
  W.setInsets = (ins, now) => { Object.assign(view.want, { l: 0, r: 0, t: 0, b: 0 }, ins); if (now) Object.assign(view.inset, view.want); placeCamera(); };
  W.zoomBy = (f) => { view.zoom = clamp(view.zoom * f, 0.8, 2.4); placeCamera(); };
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); W.zoomBy(e.deltaY < 0 ? 1.06 : 1 / 1.06); }, { passive: false });

  /* --- building --- */
  const itemObj = new Map();
  const meta = () => META[W.roomId] || {};
  function rebuildFrame() { wipe(extraG); extraG.add(photoFrame(R(), W.photoTex)); }
  function rebuildRoom() {
    const id = W.roomId, token = ++roomToken;
    if (roomAsset) { roomG.remove(roomAsset.scene); roomAsset = null; }
    rebuildFrame(); roomLampsG.clear();
    (meta().lamps || []).forEach(([x, y, z]) => { const l = new THREE.PointLight('#FFC983', 0, 8, 1.7); l.position.set(x, y, z); roomLampsG.add(l); });
    applyPhase();
    loadRoom(id).then((a) => { if (token !== roomToken) return; roomAsset = a; roomG.add(a.scene); applyPhase(); emit('room', id); }).catch((e) => { if (window.console) console.warn('room did not load:', e && e.message); });
  }
  function rebuildItems() {
    wipe(itemsG); wipe(lampsG); itemObj.clear();
    W.items.forEach((it) => {
      const T = THINGS[it.id]; if (!T) return;
      const g = T.build(R()); g.position.set(it.x, 0, it.z); g.rotation.y = it.r * Math.PI / 2; g.userData.item = it.id;
      if (it.id === 'food') { const k = g.getObjectByName('kibble'); if (k) k.visible = W.fedUntil > Date.now(); }
      itemsG.add(g); itemObj.set(it.id, g);
      if (T.light) { const l = new THREE.PointLight('#FFC978', 0, 9, 1.6); l.position.set(it.x + T.light[0], T.light[1], it.z + T.light[2]); lampsG.add(l); }
    });
    applyPhase(); markSel();
  }
  function applyPhase() {
    const p = W.phase, night = p === 'night', eve = p === 'evening';
    hemi.intensity = night ? 0.62 : eve ? 1.15 : 1.5; hemi.color.set(night ? '#AEB6E8' : eve ? '#FFE6CC' : '#FFFFFF');
    sun.intensity = night ? 0.5 : eve ? 1.9 : 2.3; sun.color.set(night ? '#9DB0FF' : eve ? '#FFB877' : '#FFF3E0');
    fill.intensity = night ? 0.2 : 0.55;
    lampsG.children.forEach((l) => { l.intensity = night ? 22 : eve ? 9 : 0; });
    roomLampsG.children.forEach((l) => { l.intensity = night ? 16 : eve ? 6 : 0; });
    catcher.material.opacity = night ? 0.3 : 0.2;
    if (roomAsset) { roomAsset.shellMat.map = roomAsset.tex[p] || roomAsset.tex.day; roomAsset.shellMat.needsUpdate = true; }
  }

  /* --- the grid --- */
  function cellsOf(it) { const [w, d] = size(it), out = []; for (let x = Math.floor(it.x - w / 2 + 0.01); x <= Math.floor(it.x + w / 2 - 0.01); x++) for (let z = Math.floor(it.z - d / 2 + 0.01); z <= Math.floor(it.z + d / 2 - 0.01); z++) out.push([x, z]); return out; }
  function blocked(skip) { const b = new Set(); (meta().blocked || []).forEach(([x, z]) => b.add(x + ',' + z)); W.items.forEach((it) => { if (it.id !== skip && THINGS[it.id] && THINGS[it.id].solid) cellsOf(it).forEach(([x, z]) => b.add(x + ',' + z)); }); return b; }
  const inside = (x, z) => x >= 0 && z >= 0 && x < N && z < N;
  function fits(it) {
    const [w, d] = size(it); if (it.x - w / 2 < -0.01 || it.z - d / 2 < -0.01 || it.x + w / 2 > N + 0.01 || it.z + d / 2 > N + 0.01) return false;
    if (!THINGS[it.id].solid) return true;
    const b = blocked(it.id); return !cellsOf(it).some(([x, z]) => b.has(x + ',' + z));
  }
  function snap(it, px, pz) { const [w, d] = size(it); return [clamp(Math.round(px - w / 2) + w / 2, w / 2, N - w / 2), clamp(Math.round(pz - d / 2) + d / 2, d / 2, N - d / 2)]; }
  W.freeSpot = (id, r = 0) => { const it = { id, r, x: 0, z: 0 }, [w, d] = size(it); for (let z = N - d / 2; z >= d / 2; z -= 1) for (let x = N - w / 2; x >= w / 2; x -= 1) { it.x = x; it.z = z; if (fits(it) && !W.items.some((o) => o.id !== id && !THINGS[o.id].flat && Math.abs(o.x - x) < 1 && Math.abs(o.z - z) < 1)) return [x, z]; } return [N / 2, N / 2]; };

  function path(from, to) {
    const b = blocked(), key = (c) => c[0] + ',' + c[1], s = [Math.floor(from.x), Math.floor(from.z)], g = [clamp(Math.floor(to.x), 0, N - 1), clamp(Math.floor(to.z), 0, N - 1)];
    if (key(s) === key(g)) return [to];
    const prev = new Map([[key(s), null]]), queue = [s];
    while (queue.length) {
      const c = queue.shift(); if (key(c) === key(g)) break;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = c[0] + dx, nz = c[1] + dz, k = nx + ',' + nz;
        if (!inside(nx, nz) || prev.has(k) || (b.has(k) && k !== key(g))) continue;
        if (dx && dz && (b.has((c[0] + dx) + ',' + c[1]) || b.has(c[0] + ',' + (c[1] + dz)))) continue;
        prev.set(k, c); queue.push([nx, nz]);
      }
    }
    if (!prev.has(key(g))) return null;
    const out = []; let c = g; while (c && key(c) !== key(s)) { out.unshift({ x: c[0] + 0.5, z: c[1] + 0.5 }); c = prev.get(key(c)); }
    out[out.length - 1] = { x: clamp(to.x, 0.4, N - 0.4), z: clamp(to.z, 0.4, N - 0.4) }; return out;
  }
  function freeCellNear(x, z) { const b = blocked(); let best = null, bd = 99; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { if (b.has(i + ',' + j)) continue; const d = Math.hypot(i + 0.5 - x, j + 0.5 - z); if (d < bd) { bd = d; best = { x: i + 0.5, z: j + 0.5 }; } } return best || { x: N / 2, z: N / 2 }; }
  function randomFree() { const b = blocked(), c = []; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (!b.has(i + ',' + j)) c.push({ x: i + 0.5, z: j + 0.5 }); return c[(Math.random() * c.length) | 0] || { x: 4, z: 4 }; }

  /* --- the pet's life --- */
  let P = null; // { m, x, z, y, h (heading), state, st (anim state), path, then, timer, ... }
  const hearts = [];
  const toy = { id: null, v: new THREE.Vector3(), kicks: 0 };

  function say(key, vars) { if (P) { P.status = [key, vars || {}]; emit('status', key, vars || {}); } }
  function pose(name, extra) { P.st.pose = Object.assign({}, POSES[name], extra); }
  function setPet(def) {
    wipe(petG); P = null; if (!def) return;
    const m = buildPet(def); petG.add(m.root);
    const start = freeCellNear(4.5, 5);
    P = { m, def, x: start.x, z: start.z, y: 0, h: 0.6, state: 'idle', path: null, then: null, timer: 1.5, elev: 0,
      st: { cur: { move: 0, lookY: 0, lookP: 0, tilt: 0, sit: 0, lie: 0, dip: 0, sleepy: 0, squint: 0, bounce: 0, shy: 0 }, pose: Object.assign({}, POSES.stand), gait: 0 } };
    m.root.userData.pet = true; say('st_home');
  }
  function go(to, then, fast) {
    if (P.elev > 0.5) { P.jump = { from: [P.x, P.y, P.z], to: [P.perchExit.x, 0, P.perchExit.z], t: 0, then: () => go(to, then, fast) }; P.elev = 0; pose('stand'); return true; }
    const p = path({ x: P.x, z: P.z }, to); if (!p) return false;
    P.path = p; P.then = then || null; P.state = 'walk'; P.fast = !!fast; P.elev = 0; pose('stand'); return true;
  }
  function thing(id) { return W.items.find((i) => i.id === id); }
  function beside(it) { const c = [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1]].map(([dx, dz]) => ({ x: it.x + dx, z: it.z + dz })).filter((c2) => inside(Math.floor(c2.x), Math.floor(c2.z)) && !blocked().has(Math.floor(c2.x) + ',' + Math.floor(c2.z))); return c[0] || freeCellNear(it.x, it.z); }
  function face(x, z) { P.hTarget = Math.atan2(x - P.x, z - P.z); }

  const DO = {
    idle(t = 3) { P.state = 'idle'; pose('stand'); P.timer = t + Math.random() * 3; say('st_idle'); },
    sit() { P.state = 'sit'; pose(P.m.kind === 'quad' ? 'sit' : 'stand', P.m.kind === 'quad' ? null : { sit: 1 }); P.hTarget = W.az + (Math.random() - 0.5) * 0.8; P.timer = 7 + Math.random() * 8; say('st_sit'); },
    wander() { if (!go(randomFree(), () => (Math.random() < 0.5 ? DO.sit() : DO.idle()))) DO.idle(); else say('st_walk'); },
    sleep() {
      const sp = P.def.species, tree = thing('cattree'), bed = thing('petbed'), box = thing('box'), rp = meta().perch;
      const lieDown = (on, elev) => { P.state = 'sleep'; P.elev = elev || 0; pose('sleep'); P.timer = 22 + Math.random() * 25; say(on ? 'st_sleep_on' : 'st_sleep', { on }); };
      if (rp && R().perchName && sp !== 'turtle' && Math.random() < (sp === 'cat' ? 0.55 : 0.3)) return go({ x: rp.exit[0], z: rp.exit[1] }, () => { P.perchExit = { x: P.x, z: P.z }; P.jump = { from: [P.x, 0, P.z], to: [rp.x, rp.y, rp.z], t: 0, then: () => lieDown(R().perchName, rp.y) }; }) || DO.idle();
      if (tree && sp === 'cat' && Math.random() < 0.5) { const c = beside(tree); return go(c, () => { const top = treeTop(tree); P.perchExit = { x: P.x, z: P.z }; P.jump = { from: [P.x, 0, P.z], to: [top.x, THINGS.cattree.perch, top.z], t: 0, then: () => lieDown('cattree', THINGS.cattree.perch) }; }) || DO.idle(); }
      const spot = bed || (box && (sp === 'cat' || sp === 'hamster' || sp === 'rabbit') ? box : null);
      if (spot) return go({ x: spot.x, z: spot.z }, () => lieDown(spot.id, THINGS[spot.id].rest)) || lieDown(null);
      const rug = thing('rug'); if (rug) return go({ x: rug.x + (Math.random() - 0.5), z: rug.z + (Math.random() - 0.5) }, () => lieDown('rug')) || lieDown(null);
      lieDown(null);
    },
    eat(kind) {
      const bowl = thing(kind === 'drink' ? 'water' : 'food'); if (!bowl) return DO.idle();
      const ok = go(beside(bowl), () => { face(bowl.x, bowl.z); P.state = kind; pose('eat'); P.timer = kind === 'drink' ? 4.5 : 7; say(kind === 'drink' ? 'st_drink' : 'st_eat'); }, true);
      if (!ok) DO.idle(); else say(kind === 'drink' ? 'st_to_water' : 'st_to_food');
    },
    play(id) {
      const it = thing(id); if (!it) return DO.idle();
      if (P.elev > 0.5 && P.perchExit) { P.jump = { from: [P.x, P.y, P.z], to: [P.perchExit.x, 0, P.perchExit.z], t: 0, then: () => DO.play(id) }; P.elev = 0; P.state = 'idle'; P.timer = 5; pose('stand'); return; }
      toy.id = id; toy.kicks = 0; kick(it); P.state = 'play'; P.elev = 0; P.path = null; pose('stand'); P.timer = 30; say('st_play', { toy: id });
    },
    happy() {
      if (P.state === 'sleep') { const was = P.status, me = P; P.st.pose.sleepy = 0.45; P.st.pose.squint = 0.4; P.timer = Math.max(P.timer, 6); say('st_stir'); setTimeout(() => { if (P === me && P.state === 'sleep') { pose('sleep'); say(was[0], was[1]); } }, 2600); burst(1); return; }
      const shy = P.m.kind === 'turtle' && Math.random() < 0.5;
      P.path = null; P.state = 'happy'; pose(shy ? 'shy' : 'happy'); P.timer = shy ? 2.6 : 2.4; face(cam.position.x, cam.position.z); say(shy ? 'st_shy' : 'st_happy'); if (!shy) burst(3);
      emit('sfx', shy ? 'ui' : P.def.species === 'cat' ? 'purr' : 'happy');
    },
    come(x, z) { const c = freeCellNear(x, z); if (go({ x: clamp(x, c.x - 0.4, c.x + 0.4), z: clamp(z, c.z - 0.4, c.z + 0.4) }, () => { DO.sit(); say('st_came'); }, true)) say('st_coming'); },
  };
  const treeTop = (tree) => { const a = tree.r * Math.PI / 2, lx = -0.3, lz = -0.3; return { x: tree.x + lx * Math.cos(a) + lz * Math.sin(a), z: tree.z - lx * Math.sin(a) + lz * Math.cos(a) }; };
  function kick(it) { const a = Math.random() * 6.28, sp = 3.2 + Math.random() * 1.6; toy.v.set(Math.cos(a) * sp, 0, Math.sin(a) * sp); toy.kicks++; emit('sfx', 'ball'); }
  function burst(nh) { for (let i = 0; i < nh; i++) { const h = heartMesh(); h.position.set(P.x + (Math.random() - 0.5) * 0.6, P.y + 1.2 + i * 0.15, P.z + (Math.random() - 0.5) * 0.6); h.userData = { t: -i * 0.22 }; h.visible = false; fxG.add(h); hearts.push(h); } }

  function think() {
    const night = W.phase === 'night', r = Math.random(), toys = W.items.filter((i) => THINGS[i.id].toy);
    if (P.state === 'sleep' && r < 0.25) return DO.sleep();
    if (night ? r < 0.55 : r < 0.18) return DO.sleep();
    if (r < 0.62) return DO.wander();
    if (r < 0.74 && toys.length) return DO.play(toys[(Math.random() * toys.length) | 0].id);
    if (r < 0.9) return DO.sit();
    DO.idle();
  }

  const camGround = new THREE.Vector3(10, 0, 10), pointer = { on: false, x: 0, z: 0 };
  function stepPet(dt, t) {
    const sp = P.m.P.speed * (P.fast ? 1.5 : 1) * (P.def.scale || 1) ** 0.5; let moving = 0;
    if (P.jump) {
      const j = P.jump; j.t += dt / 0.55; const k = Math.min(1, j.t);
      P.x = j.from[0] + (j.to[0] - j.from[0]) * k; P.z = j.from[2] + (j.to[2] - j.from[2]) * k; P.y = j.from[1] + (j.to[1] - j.from[1]) * k + Math.sin(k * Math.PI) * 1.1;
      P.hTarget = Math.atan2(j.to[0] - j.from[0], j.to[2] - j.from[2]); moving = 0.4;
      if (k >= 1) { P.jump = null; P.y = j.to[1]; j.then && j.then(); }
    } else if (P.state === 'walk' && P.path) {
      const w = P.path[0], dx = w.x - P.x, dz = w.z - P.z, d = Math.hypot(dx, dz);
      if (d < 0.08) { P.path.shift(); if (!P.path.length) { P.path = null; const th = P.then; P.then = null; P.state = 'idle'; P.timer = 2; th ? th() : DO.idle(); } }
      else { const step = Math.min(d, sp * dt); P.x += (dx / d) * step; P.z += (dz / d) * step; P.hTarget = Math.atan2(dx, dz); moving = 1; }
    } else if (P.state === 'play') {
      const it = thing(toy.id), obj = it && itemObj.get(toy.id);
      if (!it || !obj) DO.idle(); else {
        it.x += toy.v.x * dt; it.z += toy.v.z * dt; toy.v.multiplyScalar(Math.exp(-0.9 * dt));
        if (it.x < 0.35 || it.x > N - 0.35) { toy.v.x *= -0.7; it.x = clamp(it.x, 0.35, N - 0.35); } if (it.z < 0.35 || it.z > N - 0.35) { toy.v.z *= -0.7; it.z = clamp(it.z, 0.35, N - 0.35); }
        const b = blocked(); if (b.has(Math.floor(it.x) + ',' + Math.floor(it.z))) { it.x -= toy.v.x * dt * 2; it.z -= toy.v.z * dt * 2; toy.v.multiplyScalar(-0.6); }
        obj.position.set(it.x, 0, it.z); obj.rotation.x += toy.v.z * dt * 3; obj.rotation.z -= toy.v.x * dt * 3;
        const dx = it.x - P.x, dz = it.z - P.z, d = Math.hypot(dx, dz);
        if (d > 0.55) { const nb = blocked(), step = Math.min(d, sp * 1.7 * dt), nx = P.x + (dx / d) * step, nz = P.z + (dz / d) * step; if (!nb.has(Math.floor(nx) + ',' + Math.floor(nz))) { P.x = nx; P.z = nz; } P.hTarget = Math.atan2(dx, dz); moving = 1; }
        else if (toy.v.length() < 0.6) { if (toy.kicks < 4) { kick(it); P.st.cur.bounce = 0.8; } else { obj.rotation.set(0, 0, 0); emit('moved', it.id, it.x, it.z, it.r); DO.happy(); say('st_played', { toy: toy.id }); } }
      }
    }
    P.timer -= dt;
    if (P.timer <= 0 && !P.path && !P.jump && W.mode !== 'frozen') {
      if (P.state === 'eat') { W.fedUntil = Date.now() + 6 * 36e5; const k = itemObj.get('food'); DO.sit(); say('st_ate'); if (k) k.getObjectByName('kibble').scale.set(1, 0.14, 1); }
      else if (P.state === 'drink') { DO.sit(); say('st_drank'); }
      else think();
    }
    // easing
    const dh = Math.atan2(Math.sin((P.hTarget ?? P.h) - P.h), Math.cos((P.hTarget ?? P.h) - P.h)); P.h += dh * (1 - Math.exp(-9 * dt));
    const beat = Math.floor(P.st.gait / (Math.PI / 2)); if (moving && beat !== P.beat) { P.beat = beat; emit('sfx', P.jump ? 'jump' : 'step'); }
    if (P.state === 'eat' || P.state === 'drink') { P.chew = (P.chew || 0) + dt; if (P.chew > 0.55) { P.chew = 0; emit('sfx', P.state === 'eat' ? 'crunch' : 'lap'); } }
    P.st.pose.move = moving; P.st.gait += dt * (moving ? (P.m.P.gait === 'scurry' ? 9 : P.m.P.gait === 'crawl' ? 3 : 5.2) * (P.fast || P.state === 'play' ? 1.4 : 1) : 0);
    if (!P.jump) P.y = damp(P.y, P.elev || 0, 8, dt);
    // look toward the pointer when there is nothing else to do
    let ly = 0, lp = 0;
    if (pointer.on && (P.state === 'idle' || P.state === 'sit') && W.mode === 'live') { const a = Math.atan2(pointer.x - P.x, pointer.z - P.z) - P.h; ly = clamp(Math.atan2(Math.sin(a), Math.cos(a)), -1, 1); lp = -0.12; }
    else if (P.state === 'idle' || P.state === 'sit') ly = Math.sin(t * 0.5) * 0.35;
    P.st.pose.lookY = ly; P.st.pose.lookP = lp; P.st.pose.tilt = P.state === 'sit' && pointer.on ? Math.sin(t * 0.8) * 0.5 : 0;
    P.m.root.position.set(P.x, P.y, P.z); P.m.root.rotation.y = P.h;
    animate(P.m, P.st, t, dt);
  }

  /* --- selection and dragging in edit mode --- */
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.56, 4, 1), new THREE.MeshBasicMaterial({ color: '#111111', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthTest: false }));
  ring.rotation.x = -Math.PI / 2; ring.renderOrder = 9; ring.visible = false; scene.add(ring);
  function markSel() {
    const it = W.sel && thing(W.sel); ring.visible = !!it && W.mode === 'edit'; if (!it) return;
    const [w, d] = size(it); ring.geometry.dispose(); const s = new THREE.Shape(); const hw = w / 2 + 0.06, hd = d / 2 + 0.06, r2 = 0.18;
    s.moveTo(-hw + r2, -hd); s.lineTo(hw - r2, -hd); s.quadraticCurveTo(hw, -hd, hw, -hd + r2); s.lineTo(hw, hd - r2); s.quadraticCurveTo(hw, hd, hw - r2, hd); s.lineTo(-hw + r2, hd); s.quadraticCurveTo(-hw, hd, -hw, hd - r2); s.lineTo(-hw, -hd + r2); s.quadraticCurveTo(-hw, -hd, -hw + r2, -hd);
    const hole = new THREE.Path(); const iw = hw - 0.07, id = hd - 0.07; hole.moveTo(-iw, -id); hole.lineTo(-iw, id); hole.lineTo(iw, id); hole.lineTo(iw, -id); hole.lineTo(-iw, -id); s.holes.push(hole);
    ring.geometry = new THREE.ShapeGeometry(s); ring.position.set(it.x, 0.07, it.z); ring.material.color.set(it.bad ? '#D4432B' : it.trial ? '#D99A00' : '#111111');
  }
  W.select = (id) => { W.sel = id; markSel(); emit('select', id); };

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  function aim(e) { const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam); }
  function pick() { const hits = ray.intersectObjects([...itemsG.children, ...petG.children], true); for (const h of hits) { let o = h.object; while (o) { if (o.userData.pet) return { pet: true }; if (o.userData.item) return { item: o.userData.item }; o = o.parent; } } return null; }
  function ground() { return ray.ray.intersectPlane(floorPlane, hit) ? hit : null; }
  let drag = null, pinch = null;
  const fingers = new Map(), spread = () => { const [a, b] = [...fingers.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
  const dropDrag = () => { if (drag && drag.what) { const it = drag.what; it.x = drag.home[0]; it.z = drag.home[1]; it.bad = false; itemObj.get(it.id).position.set(it.x, 0, it.z); markSel(); } drag = null; };
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') { fingers.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (fingers.size === 2) { dropDrag(); pinch = { d: spread(), zoom: view.zoom }; return; } }
    aim(e); const p = pick(), g = ground();
    drag = { x: e.clientX, y: e.clientY, az: W.az, moved: false, what: null };
    if (W.mode === 'edit' && p && p.item) { const it = thing(p.item); W.select(p.item); drag.what = it; drag.off = g ? [g.x - it.x, g.z - it.z] : [0, 0]; drag.home = [it.x, it.z]; }
    else if (W.mode === 'edit') W.select(null);
    drag.pick = p; try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (fingers.has(e.pointerId)) { const f = fingers.get(e.pointerId); f.x = e.clientX; f.y = e.clientY; }
    if (pinch) { if (fingers.size === 2) { view.zoom = clamp(pinch.zoom * spread() / pinch.d, 0.8, 2.4); placeCamera(); } return; }
    aim(e); const g = ground(); if (g) { pointer.on = true; pointer.x = g.x; pointer.z = g.z; }
    if (!drag) { canvas.style.cursor = W.mode === 'edit' ? (pick() ? 'grab' : 'default') : (pick() ? 'pointer' : 'default'); return; }
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 5) drag.moved = true;
    if (drag.what && g) { const it = drag.what, [x, z] = snap(it, g.x - drag.off[0], g.z - drag.off[1]); if (x !== it.x || z !== it.z) { it.x = x; it.z = z; it.bad = !fits(it); const o = itemObj.get(it.id); o.position.set(x, 0, z); markSel(); } }
    else if (drag.moved) { W.az = clamp(drag.az - (e.clientX - drag.x) * 0.006, 0.2, 1.37); placeCamera(); }
  });
  const up = (e) => {
    fingers.delete(e.pointerId); if (pinch) { if (fingers.size === 0) pinch = null; drag = null; return; }
    if (!drag) return; const d = drag; drag = null;
    if (d.what) { const it = d.what; if (it.bad) { it.x = d.home[0]; it.z = d.home[1]; it.bad = false; itemObj.get(it.id).position.set(it.x, 0, it.z); } markSel(); emit('moved', it.id, it.x, it.z, it.r); return; }
    if (d.moved || W.mode !== 'live' || !P) return;
    if (d.pick && d.pick.pet) { DO.happy(); emit('petted'); }
    else if (!d.pick) { aim(e); const g = ground(); if (g && g.x > 0 && g.z > 0 && g.x < N && g.z < N) DO.come(g.x, g.z); }
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', (e) => { fingers.delete(e.pointerId); if (!fingers.size) pinch = null; dropDrag(); }); canvas.addEventListener('pointerleave', () => { pointer.on = false; });

  /* --- public controls --- */
  W.setRoom = (id) => { W.roomId = ROOMS[id] ? id : 'bay'; rebuildRoom(); rebuildItems(); if (P) { const c = freeCellNear(4.5, 5); Object.assign(P, { x: c.x, z: c.z, y: 0, elev: 0, jump: null, path: null, then: null, state: 'idle', timer: 1.5 }); pose('stand'); say('st_home'); } };
  W.setItems = (list) => { W.items = list.map((i) => Object.assign({}, i)); rebuildItems(); };
  W.setPet = (def) => setPet(def);
  W.setPhoto = (url) => { if (W.photoTex) W.photoTex.dispose(); W.photoTex = null; if (!url) return rebuildFrame(); const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = 200; c.height = 260; const k = Math.max(200 / img.width, 260 / img.height), w = img.width * k, h = img.height * k; c.getContext('2d').drawImage(img, (200 - w) / 2, (260 - h) / 2, w, h); W.photoTex = new THREE.CanvasTexture(c); W.photoTex.colorSpace = THREE.SRGBColorSpace; rebuildFrame(); }; img.src = url; };
  W.setPhase = (p) => { W.phase = p; applyPhase(); };
  W.setMode = (m) => { W.mode = m; if (m !== 'edit') W.sel = null; markSel(); };
  W.setFed = (until) => { W.fedUntil = until || 0; const k = itemObj.get('food'); if (k) { const kb = k.getObjectByName('kibble'); kb.visible = W.fedUntil > Date.now(); kb.scale.set(1, 0.42, 1); } };
  W.act = (what, arg) => { if (!P) return; if (what === 'water') DO.eat('drink'); if (what === 'feed') { W.setFed(Date.now() + 6 * 36e5); DO.eat('eat'); } if (what === 'play') DO.play(arg); if (what === 'pet') DO.happy(); if (what === 'sleep') DO.sleep(); };
  W.rotateItem = (id) => { const it = thing(id); if (!it) return; const old = it.r; it.r = (it.r + 1) % 4; [it.x, it.z] = snap(it, it.x, it.z); if (!fits(it)) { it.r = old; [it.x, it.z] = snap(it, it.x, it.z); return false; } rebuildItems(); emit('moved', id, it.x, it.z, it.r); return true; };
  W.addItem = (it) => { W.items.push(Object.assign({}, it)); rebuildItems(); };
  W.removeItem = (id) => { W.items = W.items.filter((i) => i.id !== id); if (W.sel === id) W.sel = null; rebuildItems(); };
  W.status = () => (P ? P.status : null);
  W.fits = fits;

  /* --- the loop --- */
  let last = performance.now(), raf = 0, t = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    for (const k in view.want) view.inset[k] = damp(view.inset[k], view.want[k], 9, dt);
    view.drift = drag ? view.drift : Math.sin(t * 0.11) * 0.035; placeCamera();
    if (P) stepPet(dt, t);
    for (let i = hearts.length - 1; i >= 0; i--) { const h = hearts[i]; h.userData.t += dt; const k = h.userData.t; if (k < 0) continue; h.visible = true; h.position.y += dt * 0.9; h.quaternion.copy(cam.quaternion); h.scale.setScalar(0.7 + Math.min(1, k * 3) * 0.6); h.material.opacity = clamp(1.6 - k, 0, 1); if (k > 1.6) { fxG.remove(h); h.geometry.dispose(); h.material.dispose(); hearts.splice(i, 1); } }
    renderer.render(scene, cam);
  }
  W.start = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  W.stop = () => { cancelAnimationFrame(raf); raf = 0; };
  W.renderOnce = () => { if (P) stepPet(0.016, t); renderer.render(scene, cam); };
  W.tick = (dt) => { t += dt; for (const k in view.want) view.inset[k] = damp(view.inset[k], view.want[k], 9, dt); placeCamera(); if (P) stepPet(dt, t); renderer.render(scene, cam); };

  /* --- pictures of single things, for the catalogue --- */
  W.snapshot = (build, w = 256, h = 256) => {
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight('#fff', '#E9D7C4', 1.6)); const dl = new THREE.DirectionalLight('#FFF3E0', 2.2); dl.position.set(6, 9, 4); sc.add(dl);
    const obj = build(); sc.add(obj); const box = new THREE.Box3().setFromObject(obj), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3()), rad = Math.max(s.x, s.y, s.z) * 0.72 + 0.1;
    const oc = new THREE.OrthographicCamera(-rad * (w / h), rad * (w / h), rad, -rad, 0.1, 100); oc.position.set(c.x + 10, c.y + 8.4, c.z + 10); oc.lookAt(c);
    const old = renderer.getSize(new THREE.Vector2()), pr = renderer.getPixelRatio(); renderer.setPixelRatio(1); renderer.setSize(w, h, false); renderer.shadowMap.enabled = false; renderer.render(sc, oc);
    const url = canvas.toDataURL('image/png'); renderer.shadowMap.enabled = true; renderer.setPixelRatio(pr); renderer.setSize(old.x, old.y, false); obj.traverse((o) => o.geometry && o.geometry.dispose()); return url;
  };
  W.snapThing = (id, roomId) => W.snapshot(() => THINGS[id].build(ROOMS[roomId || W.roomId]));
  W.snapPet = (def) => W.snapPose(def, 'sit');
  W.snapPose = (def, name, px = 256) => W.snapshot(() => { const m = buildPet(def); m.root.rotation.y = 0.5; const st = { cur: { move: 0 }, pose: Object.assign({ lookY: 0, lookP: 0, tilt: 0, move: 0 }, POSES[name]), gait: 0 }; animate(m, st, 0.4, 1); animate(m, st, 0.5, 1); return m.root; }, px, px);

  placeCamera(); rebuildRoom();
  return W;
}

/* Two representative coat colours from a photo: the commonest colour near the middle, and the one most unlike it. */
export function coatFromPhoto(img) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d', { willReadFrequently: true });
  const k = Math.max(64 / img.width, 64 / img.height); x.drawImage(img, (64 - img.width * k) / 2, (64 - img.height * k) / 2, img.width * k, img.height * k);
  const d = x.getImageData(0, 0, 64, 64).data, bins = new Map();
  for (let py = 14; py < 50; py++) for (let px = 14; px < 50; px++) { const i = (py * 64 + px) * 4, wgt = 1.6 - Math.hypot(px - 32, py - 32) / 26; if (wgt <= 0) continue; const key = (d[i] >> 5) + ',' + (d[i + 1] >> 5) + ',' + (d[i + 2] >> 5), b = bins.get(key) || [0, 0, 0, 0]; b[0] += d[i] * wgt; b[1] += d[i + 1] * wgt; b[2] += d[i + 2] * wgt; b[3] += wgt; bins.set(key, b); }
  const cols = [...bins.values()].sort((a, b) => b[3] - a[3]).slice(0, 8).map((b) => [b[0] / b[3], b[1] / b[3], b[2] / b[3], b[3]]);
  if (!cols.length) return null;
  const hex = (v) => '#' + v.slice(0, 3).map((n) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0')).join('');
  const base = cols[0]; let second = cols[0], best = 0;
  cols.forEach((v) => { const dist = Math.hypot(v[0] - base[0], v[1] - base[1], v[2] - base[2]) * Math.sqrt(v[3] / base[3]); if (dist > best) { best = dist; second = v; } });
  const lum = (v) => v[0] * 0.3 + v[1] * 0.59 + v[2] * 0.11;
  const two = best > 40, lighter = lum(second) > lum(base);
  return { base: hex(base), second: two && lighter ? hex(second) : shade(hex(base), 0.18), dark: two && !lighter ? hex(second) : shade(hex(base), lum(base) < 70 ? 0.16 : -0.15), contrast: best };
}
