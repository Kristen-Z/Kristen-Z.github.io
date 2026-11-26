/* StereoViT project page: point-cloud viewers (hero background + interactive section).
   Clouds: static/pc/<key>.bin = b'PC01', uint32 n, float32 center[3], float32 half-extent, int16 xyz[n], uint8 rgb[n]
   (camera frame: x right, y down, z forward). Each point is drawn as a square whose size matches its pixel footprint,
   so the cloud looks like the photo from the original camera and turns 3D when you orbit.
   scenes.json `up` = gravity in camera axes (RANSAC on the ground / table plane, site_tools/gravity.py): the cloud is
   turned so the ground is level and dragging is a turntable about true vertical; perspective camera (the rest pose is the
   real camera, pixel for pixel). As in VidMap's viewer, middle-drag (or Alt-drag) rolls the scene about the view axis to
   level it by hand; the camera button restores the estimated gravity and the photo view. */
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
    float foot = uFoot * max(-position.z, 1e-3);   // position: camera frame, so -z is the original depth
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
    // free 360 turntable about true vertical; stop a little below the horizon (under the ground there is nothing to see)
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, rotateSpeed: 0.55, zoomSpeed: 0.7,
      enableZoom: this.opt.zoom, enablePan: this.opt.pan, minPolarAngle: 0.03, maxPolarAngle: Math.PI / 2 + 0.12 });
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG,
      uniforms: { uScale: { value: 1 }, uFoot: { value: 0.002 }, uMul: { value: this.opt.mul } } });
    this.q = new THREE.Quaternion();
    if (this.opt.roll) this.rollGesture();
    this.auto = true;
    this.idleSince = -1e9;
    this.mouse = { x: 0, y: 0 };
    this.target = new THREE.Vector3();
    this.controls.addEventListener('start', () => { this.dragging = true; if (!this.opt.still) this.auto = false; });  // interactive: stay where the user leaves it
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
    if (this.opt.avoid && asp > 1.25) {
      // hero: put the cloud in the free space right of the title block, never under the text
      const cr = this.canvas.getBoundingClientRect();
      const R = Math.max(...[...document.querySelectorAll(this.opt.avoid)].map(e => e.getBoundingClientRect().right - cr.left));
      const L = R + 12, Rr = w - 24, avail = Rr - L;  // the cloud may tuck slightly under the text edge: close, not boxed off
      if (avail > 320) { frac = Math.min(frac, 0.9 * avail / w); this._side = (L + Rr) / 2 + 0.045 * avail - w / 2; } else this._side = 0;
    } else this._side = 0;
    const t = frac ? tx / (asp * frac) : tFitH * 1.06;
    const P = this.camera;
    P.fov = 2 * Math.atan(t) * 180 / Math.PI;
    P.aspect = asp;
    const side = this._side;
    if (side) P.setViewOffset(w, h, -side, 0, w, h);
    else if (this.opt.shift && asp > 1.25) P.setViewOffset(w, h, -Math.min(w * this.opt.shift, this.opt.maxShift || 1e9), 0, w, h);
    else P.clearViewOffset();
    P.updateProjectionMatrix();
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
    this.q.setFromUnitVectors(new THREE.Vector3().fromArray(meta.up || [0, 1, 0]).normalize(), new THREE.Vector3(0, 1, 0));
    this.points.quaternion.copy(this.q);  // ground level, y = up
    this.target.set(0, 0, -pc.zmed).applyQuaternion(this.q);
    this.home();
    this.fit();
    this.kick();
    return pc;
  }
  home() {
    if (this.points) { this.points.quaternion.copy(this.q); this.points.position.set(0, 0, 0); }  // undo any manual roll
    this.camera.position.set(0, 0, 0);  // the real camera (roll levelled: up is gravity)
    this.camera.up.set(0, 1, 0);
    this.controls.target.copy(this.target);
    this.camera.near = this.zmed * 0.02;
    this.camera.far = this.zmed * 60;
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.rest = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.target));
    this.idleSince = performance.now() - 5000;
    this.auto = true;
    this.onHome && this.onHome();
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
      // ease the angles (not the position), so returning from behind swings round instead of cutting through the scene
      const off = this.camera.position.clone().sub(this.controls.target), sph = new THREE.Spherical().setFromVector3(off);
      if (!sph.radius) sph.radius = this.zmed;
      const rest = this.rest || { theta: 0, phi: Math.PI / 2 };
      const wantT = rest.theta + az, wantP = Math.min(this.controls.maxPolarAngle, Math.max(0.05, rest.phi - el));
      let dT = wantT - sph.theta; dT = Math.atan2(Math.sin(dT), Math.cos(dT));
      sph.theta += dT * 0.04; sph.phi += (wantP - sph.phi) * 0.04;
      this.camera.position.setFromSpherical(sph).add(this.controls.target);
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.kick();
  }
  rollGesture() {  // middle-drag or Alt-drag: roll the scene about the view axis (through the orbit target) to level it by hand
    const el = this.canvas, axis = new THREE.Vector3(), q = new THREE.Quaternion();
    let id = null, lastX = 0;
    el.addEventListener('pointerdown', e => {
      if (!this.points || !(e.button === 1 || (e.button === 0 && e.altKey))) return;
      e.preventDefault(); e.stopImmediatePropagation();  // keep OrbitControls out of this drag
      id = e.pointerId; lastX = e.clientX; el.setPointerCapture(id);
      this.dragging = true; this.auto = false; this.onHome && this.onHome();
    }, { capture: true });
    el.addEventListener('pointermove', e => {
      if (e.pointerId !== id) return;
      const dx = e.clientX - lastX; lastX = e.clientX;
      this.camera.getWorldDirection(axis);
      q.setFromAxisAngle(axis, -dx * 0.005);
      const t = this.controls.target;
      this.points.position.sub(t).applyQuaternion(q).add(t);
      this.points.quaternion.premultiply(q);
      this.kick();
    });
    const end = e => { if (e.pointerId !== id) return; id = null; this.dragging = false; this.idleSince = performance.now(); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    el.addEventListener('auxclick', e => { if (e.button === 1) e.preventDefault(); });
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
  const hero = new Viewer(document.getElementById('hero-canvas'), { amp: 16, still: [-14, 5], avoid: '.hero-title, .hero-sub, .authors, .affils, .links .btn', frac: 0.6, maxW: 880, maxShift: 400, fracNarrow: 1.5, shift: 0.25, zoom: false, pan: false, maxDpr: 1.5, mul: 1.8 });
  hero.show(heroScene);
  document.fonts && document.fonts.ready.then(() => hero.fit());

  // interactive section
  const v = new Viewer(document.getElementById('pc-canvas'), { amp: 22, roll: true });
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
  const syncOrbit = () => orbitBtn.classList.toggle('on', v.auto);  // dragging pauses the orbit, reset / new scene resumes it
  v.controls.addEventListener('start', syncOrbit);
  v.onHome = syncOrbit;
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
