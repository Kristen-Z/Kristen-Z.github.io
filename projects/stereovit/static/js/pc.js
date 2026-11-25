/* StereoViT project page: point-cloud viewers (hero background + interactive section).
   Clouds: static/pc/<key>.bin = b'PC01', uint32 n, float32 center[3], float32 half-extent, int16 xyz[n], uint8 rgb[n]
   (camera frame: x right, y down, z forward). Each point is drawn as a square whose size matches its pixel footprint,
   so the cloud looks like the photo from the original camera and turns 3D when you orbit. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const V = new URL(import.meta.url).search;  // cache-busting for data files

const VERT = /* glsl */`
  uniform float uScale;   // drawing-buffer pixels per unit at depth 1
  uniform float uFoot;    // point footprint per metre of depth (pixel pitch / fx)
  uniform float uMul;
  attribute vec3 rgb;
  varying vec3 vC;
  void main() {
    vC = rgb;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float foot = uFoot * max(-position.z, 1e-3);
    gl_PointSize = clamp(foot * uScale / max(-mv.z, 1e-3) * uMul, 1.0, 28.0);
  }`;
const FRAG = /* glsl */`
  varying vec3 vC;
  void main() { gl_FragColor = vec4(vC, 1.0); }`;

const cache = new Map();
function loadPC(key) {
  if (!cache.has(key)) cache.set(key, fetch(`static/pc/${key}.bin${V}`).then(r => r.arrayBuffer()).then(buf => {
    const dv = new DataView(buf);
    const n = dv.getUint32(4, true);
    const c = [dv.getFloat32(8, true), dv.getFloat32(12, true), dv.getFloat32(16, true)], s = dv.getFloat32(20, true) / 32767;
    const q = new Int16Array(buf, 24, n * 3), rgb = new Uint8Array(buf, 24 + n * 6, n * 3);
    const pos = new Float32Array(n * 3), zs = new Float32Array(n);
    for (let i = 0; i < n; i++) {  // to three.js axes: y up, camera looks down -z
      pos[3 * i] = c[0] + q[3 * i] * s;
      pos[3 * i + 1] = -(c[1] + q[3 * i + 1] * s);
      const z = c[2] + q[3 * i + 2] * s;
      pos[3 * i + 2] = -z;
      zs[i] = z;
    }
    const zmed = zs.slice().sort()[n >> 1];
    return { n, pos, rgb, zmed };
  }));
  return cache.get(key);
}

class Viewer {
  constructor(canvas, opt = {}) {
    this.canvas = canvas;
    this.opt = Object.assign({ amp: 20, frac: 0, fracNarrow: 0, shift: 0, mul: 1.75, zoom: true, pan: true }, opt);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, opt.maxDpr || 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.005, 500);
    this.controls = new OrbitControls(this.camera, canvas);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, rotateSpeed: 0.55, zoomSpeed: 0.7,
      enableZoom: this.opt.zoom, enablePan: this.opt.pan, minPolarAngle: 0.35 * Math.PI, maxPolarAngle: 0.65 * Math.PI,
      minAzimuthAngle: -Math.PI / 3, maxAzimuthAngle: Math.PI / 3 });
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG,
      uniforms: { uScale: { value: 1 }, uFoot: { value: 0.002 }, uMul: { value: this.opt.mul } } });
    this.auto = true;
    this.idleSince = -1e9;
    this.mouse = { x: 0, y: 0 };
    this.target = new THREE.Vector3();
    this.controls.addEventListener('start', () => { this.dragging = true; });
    this.controls.addEventListener('end', () => { this.dragging = false; this.idleSince = performance.now(); });
    this.visible = true;
    new ResizeObserver(() => this.resize()).observe(canvas);
    new IntersectionObserver(es => { this.visible = es[0].isIntersecting; if (this.visible) this.kick(); }).observe(canvas);
    this.t0 = performance.now();
  }
  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.fit();
    this.kick();
  }
  fit() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight, m = this.meta;
    if (!m) return;
    const asp = w / h;
    const ty = 640 / m.aspect / m.fx, tx = 640 / m.fx;           // half extents of the image at depth 1
    const tFitH = Math.max(ty, tx / asp);
    // frac: share of the canvas width the image spans (hero: a floating cloud on the right; phones: fills the screen)
    let frac = asp > 1.25 ? this.opt.frac : this.opt.fracNarrow;
    if (this.opt.maxW && asp > 1.25) frac = Math.min(frac, this.opt.maxW / w);  // cap the cloud width on wide screens
    const t = frac ? tx / (asp * frac) : tFitH * 1.06;
    this.camera.fov = 2 * Math.atan(t) * 180 / Math.PI;
    this.camera.aspect = asp;
    if (this.opt.shift && asp > 1.25) this.camera.setViewOffset(w, h, -Math.min(w * this.opt.shift, this.opt.maxShift || 1e9), 0, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    const v = new THREE.Vector2();
    this.renderer.getDrawingBufferSize(v);
    this.mat.uniforms.uScale.value = v.y / 2 / t;
  }
  async show(meta) {
    this.meta = meta;
    const pc = await loadPC(meta.key);
    if (this.meta !== meta) return;
    if (this.points) { this.scene.remove(this.points); this.points.geometry.dispose(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pc.pos, 3));
    g.setAttribute('rgb', new THREE.Uint8BufferAttribute(pc.rgb, 3, true));
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
    this.mat.uniforms.uFoot.value = meta.foot;
    this.zmed = pc.zmed;
    this.target.set(0, 0, -pc.zmed);
    this.home();
    this.fit();
    this.kick();
    return pc;
  }
  home() {
    this.camera.position.set(0, 0, 0);
    this.controls.target.copy(this.target);
    this.camera.near = this.zmed * 0.02;
    this.camera.far = this.zmed * 60;
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.idleSince = performance.now() - 5000;
  }
  kick() { if (!this.raf) this.raf = requestAnimationFrame(t => this.frame(t)); }
  frame(t) {
    this.raf = null;
    if (!this.visible || !this.points) return;
    const idle = !this.dragging && t - this.idleSince > 2500;
    if (this.auto && idle) {  // gentle orbit about the scene's median depth (+ pointer parallax in the hero)
      const s = (t - this.t0) / 1000, A = this.opt.amp * Math.PI / 180;
      const still = this.opt.still;  // hero: hold one slightly turned view instead of orbiting
      const az = still ? still[0] * Math.PI / 180 : A * Math.sin(s * 0.32) + this.mouse.x * 0.12;
      const el = still ? still[1] * Math.PI / 180 : 0.35 * A * Math.sin(s * 0.21 + 1) - this.mouse.y * 0.08;
      const r = this.camera.position.distanceTo(this.controls.target) || this.zmed;
      const want = new THREE.Vector3(r * Math.sin(az) * Math.cos(el), r * Math.sin(el), r * Math.cos(az) * Math.cos(el)).add(this.controls.target);
      this.camera.position.lerp(want, 0.04);
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.kick();
  }
}

function webgl() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

const CREDIT = { flowerbed: 'SouthKensington SV', fence: 'SouthKensington SV', cloth: 'DROID', bathroom: 'DROID',
  checkered: 'DROID', motorcycle: 'Middlebury' };

async function main() {
  const all = await fetch('static/pc/scenes.json' + V).then(r => r.json());
  const heroScene = all.find(m => m.key === 'tabletop'), scenes = all.filter(m => m.key !== 'tabletop');
  if (!webgl()) {
    document.querySelector('.hero').style.background = `#141c38 url(static/pc/tabletop_img.jpg) center/cover`;
    return;
  }
  // hero: tabletop scene, no zoom / pan so the page still scrolls
  const hero = new Viewer(document.getElementById('hero-canvas'), { amp: 16, still: [-14, 5], frac: 0.55, maxW: 780, maxShift: 400, fracNarrow: 1.5, shift: 0.25, zoom: false, pan: false, maxDpr: 1.5, mul: 1.8 });
  hero.show(heroScene);

  // interactive section
  const v = new Viewer(document.getElementById('pc-canvas'), { amp: 22 });
  const chips = document.getElementById('pc-chips'), load = document.getElementById('pc-load');
  const pair = window.SVIT.makeCompare(document.getElementById('pc-pair'));
  let swept = false;
  const pick = async i => {
    const m = scenes[i];
    [...chips.children].forEach((c, j) => c.classList.toggle('on', j === i));
    document.getElementById('pc-name').textContent = m.name;
    document.getElementById('pc-count').textContent = '';
    pair.querySelector('.cmp-a').src = `static/pc/${m.key}_img.jpg${V}`;
    pair.querySelector('.cmp-b').src = `static/pc/${m.key}_disp.jpg${V}`;
    load.classList.remove('done');
    const pc = await v.show(m);
    if (pc && v.meta === m) {
      load.classList.add('done');
      document.getElementById('pc-count').textContent = `${(pc.n / 1000).toFixed(0)}k points`;
    }
  };
  scenes.forEach((m, i) => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.innerHTML = `<img src="static/pc/${m.key}_img.jpg" alt="" loading="lazy"><span>${m.name}<small>${CREDIT[m.key] || ''}</small></span>`;
    b.addEventListener('click', () => pick(i));
    chips.appendChild(b);
  });
  const orbitBtn = document.getElementById('pc-orbit');
  orbitBtn.addEventListener('click', () => { v.auto = !v.auto; orbitBtn.classList.toggle('on', v.auto); });
  document.getElementById('pc-reset').addEventListener('click', () => v.home());
  // load the section's first cloud once the user gets close
  new IntersectionObserver((es, ob) => {
    if (!es[0].isIntersecting) return;
    ob.disconnect();
    pick(0);
  }, { rootMargin: '400px 0px' }).observe(document.getElementById('viewer'));
  new IntersectionObserver((es, ob) => {
    if (!es[0].isIntersecting || swept) return;
    swept = true;
    ob.disconnect();
    setTimeout(pair.sweep, 300);
  }, { threshold: 0.6 }).observe(pair);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main); else main();
