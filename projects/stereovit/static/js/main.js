/* StereoViT project page: UI (nav, reveal, counters, anaglyph title, plot, drag-compare, comparisons, robot results). */
(() => {
  const V = (document.currentScript && new URL(document.currentScript.src).search) || '';  // cache-busting for data files
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ease = k => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);

  /* ───── nav ───── */
  const nav = $('#nav'), hero = $('.hero');
  const onScroll = () => nav.classList.toggle('solid', scrollY > hero.offsetHeight - 90);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  const links = $$('.nav-links a');
  const secObs = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  links.forEach(a => { const s = $(a.getAttribute('href')); if (s) secObs.observe(s); });
  secObs.observe(hero);  // back at the top: no link highlighted

  /* ───── reveal + counters ───── */
  const revObs = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    e.target.dispatchEvent(new Event('reveal'));
    revObs.unobserve(e.target);
  }), { threshold: 0.12 });
  $$('.reveal').forEach(el => revObs.observe(el));

  $$('.count').forEach(el => {
    const to = +el.dataset.to, dec = +(el.dataset.dec || 0);
    if (REDUCE) return;
    el.textContent = (0).toFixed(dec);
    el.closest('.reveal').addEventListener('reveal', () => {
      const t0 = performance.now();
      const step = t => {
        const k = (t - t0) / 1500;
        el.textContent = (to * ease(k)).toFixed(dec);
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { once: true });
  });

  /* anaglyph title: static small offset (set in CSS), no motion */

  /* ───── placeholder links ───── */
  $$('a[data-todo]').forEach(a => a.addEventListener('click', e => {
    if (a.getAttribute('href') !== '#') return;
    e.preventDefault();
    toast('Coming soon');
  }));
  function toast(msg) {
    let t = $('#toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      Object.assign(t.style, { position: 'fixed', left: '50%', bottom: '28px', transform: 'translateX(-50%)', zIndex: 120,
        background: '#141c38', color: '#fff', padding: '10px 16px', borderRadius: '999px', fontSize: '14px', fontWeight: 600,
        boxShadow: '0 10px 30px rgba(0,0,0,.3)', transition: 'opacity .3s', opacity: 0 });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = 1;
    clearTimeout(t._h);
    t._h = setTimeout(() => { t.style.opacity = 0; }, 1600);
  }

  /* ───── overview video: YouTube embed when data-youtube holds an id, else the local mp4 ───── */
  const vf = $('.video-frame[data-youtube]');
  if (vf && vf.dataset.youtube) {
    vf.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(vf.dataset.youtube)}?rel=0"
      title="StereoViT overview video" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      allowfullscreen loading="lazy"></iframe>`;
  }

  /* ───── lightbox ───── */
  const lb = $('#lightbox');
  $$('.zoomable').forEach(b => b.addEventListener('click', () => { $('img', lb).src = b.dataset.full; lb.classList.add('on'); }));
  lb.addEventListener('click', () => lb.classList.remove('on'));
  addEventListener('keydown', e => { if (e.key === 'Escape') lb.classList.remove('on'); });

  /* ───── bibtex ───── */
  $('#bib-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('#bib-text').textContent); toast('BibTeX copied'); } catch { toast('Select the text to copy'); }
  });

  /* ───── drag compare (shared with the 3D section) ───── */
  function makeCompare(el) {
    const set = x => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--u', (Math.min(1, Math.max(0, (x - r.left) / r.width)) * 100).toFixed(2) + '%');
    };
    let drag = false;
    el.addEventListener('pointerdown', e => { drag = true; el.setPointerCapture(e.pointerId); set(e.clientX); el._touched = true; });
    el.addEventListener('pointermove', e => { if (drag || e.pointerType === 'mouse') { set(e.clientX); el._touched = true; } });
    el.addEventListener('pointerup', () => { drag = false; });
    el.addEventListener('pointercancel', () => { drag = false; });
    el.sweep = () => {  // one gentle sweep so people see it is draggable
      if (REDUCE || el._touched) return;
      const keys = [[0, 50], [0.3, 18], [0.65, 82], [1, 50]], D = 2600, t0 = performance.now();
      const step = t => {
        if (el._touched) return;
        const k = (t - t0) / D;
        let i = 0;
        while (i < keys.length - 2 && k > keys[i + 1][0]) i++;
        const [a, ua] = keys[i], [b, ub] = keys[i + 1];
        const s = (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, (k - a) / (b - a))))) / 2;
        el.style.setProperty('--u', (ua + (ub - ua) * s) + '%');
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    return el;
  }
  window.SVIT = { makeCompare, REDUCE };

  /* ───── accuracy vs latency (paper Table 1; latency at 544x960, GH200, FP32) ───── */
  const PANELS = [
    { y: 'ETH3D BP-0.5 (%)', lim: [1.75, 0.42], ticks: [0.5, 1.0, 1.5], pts: {
      'StereoViT-L': [97, 0.64, 0, -18, 'middle'], 'StereoViT-M': [41, 0.68, 0, 28, 'middle'],
      'WAFT-Stereo-L': [150, 0.97, -14, -6, 'end'], 'S2M2-XL': [160, 1.03, -14, 18, 'end'],
      'NBS': [323, 0.71, -14, 5, 'end'], 'FoundationStereo': [469, 1.56, 14, 5, 'start'] } },
    { y: 'Middlebury BP-4 (%)', lim: [3.0, 1.2], ticks: [1.5, 2.0, 2.5], pts: {
      'StereoViT-L': [97, 1.52, 0, -18, 'middle'], 'S2M2-XL': [160, 1.63, 14, 16, 'start'],
      'NBS': [323, 1.73, -14, 5, 'end'], 'WAFT-Stereo-L': [150, 2.15, 14, 5, 'start'], 'FoundationStereo': [469, 2.72, 14, 5, 'start'] } },
    { y: 'KITTI 2012 BP-3 (%)', lim: [1.5, 0.68], ticks: [0.8, 1.0, 1.2, 1.4], pts: {
      'StereoViT-L': [97, 0.78, 0, -18, 'middle'], 'StereoViT-M': [41, 0.84, 0, 28, 'middle'],
      'WAFT-Stereo-L': [150, 0.95, -14, 5, 'end'], 'BridgeDepth': [97, 1.03, 14, 5, 'start'],
      'Selective-IGEV': [199, 1.38, 14, 5, 'start'] } },
    { y: 'KITTI 2015 D1-all (%)', lim: [2.6, 1.05], ticks: [1.2, 1.6, 2.0, 2.4], pts: {
      'StereoViT-L': [97, 1.20, 0, -18, 'middle'], 'StereoViT-M': [41, 1.33, 0, 28, 'middle'],
      'WAFT-Stereo-L': [150, 1.28, -14, 5, 'end'], 'BridgeDepth': [97, 1.40, -14, 5, 'end'],
      'Selective-IGEV': [199, 1.55, -14, 5, 'end'], 'UniMatch': [53, 1.77, 14, 5, 'start'],
      'RAFT-Stereo': [139, 2.42, 14, 5, 'start'] } },
    { y: 'Spring 1px (%)', xmax: 1500, xt: [1000, 400, 200, 100, 50], lim: [16.5, 4.5], ticks: [6, 9, 12, 15], pts: {
      'StereoViT-L': [97, 5.81, 0, -18, 'middle'], 'StereoViT-M': [41, 6.07, 0, 28, 'middle'],
      'CroCo-Stereo': [1100, 7.14, 14, 5, 'start'], 'RAFT-Stereo': [139, 15.27, 14, 5, 'start'] } },
  ];
  const NAMES = ['CroCo-Stereo', 'RAFT-Stereo', 'UniMatch', 'Selective-IGEV', 'BridgeDepth', 'FoundationStereo', 'NBS', 'S2M2-XL', 'WAFT-Stereo-L', 'StereoViT-M', 'StereoViT-L'];
  const svg = $('#plot'), tip = $('#plot-tip');
  const W = 560, H = 380, M = { l: 62, r: 22, t: 24, b: 54 };
  let XMAX = 600;
  const X = ms => M.l + (Math.log(XMAX) - Math.log(ms)) / (Math.log(XMAX) - Math.log(28)) * (W - M.l - M.r);
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs, parent = svg) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; };
  const gAxes = mk('g', {});
  const link = mk('line', { stroke: '#2e9f62', 'stroke-width': 2, 'stroke-dasharray': '5 4', opacity: 0 });
  const dots = {};
  NAMES.forEach(n => {
    const ours = n.startsWith('StereoViT');
    const halo = ours ? mk('circle', { class: 'halo', r: 15, cx: X(600), cy: H / 2 }) : null;
    const c = mk('circle', { class: 'pt ' + (ours ? 'ours' : 'base'), r: ours ? 8 : 7, cx: X(600), cy: H / 2 });
    const l = mk('text', { class: 'lbl' + (ours ? ' ours' : ''), x: X(600), y: H / 2 });
    l.textContent = n;
    dots[n] = { c, l, halo };
    c.addEventListener('pointerenter', () => showTip(n));
    c.addEventListener('pointerleave', () => { tip.style.opacity = 0; c.setAttribute('r', ours ? 8 : 7); });
  });
  let panel = 0, shown = false;
  function showTip(n) {
    const p = PANELS[panel].pts[n];
    if (!p) return;
    const ours = n.startsWith('StereoViT');
    dots[n].c.setAttribute('r', ours ? 10 : 9);
    const r = svg.getBoundingClientRect(), pr = svg.parentElement.getBoundingClientRect();
    const Y = yScale(PANELS[panel]);
    tip.innerHTML = `${ours ? '<b>' + n + '</b>' : n} · ${p[0]} ms · ${p[1].toFixed(2)}%`;
    tip.style.left = (r.left - pr.left + X(p[0]) / W * r.width) + 'px';
    tip.style.top = (r.top - pr.top + Y(p[1]) / H * r.height - 6) + 'px';
    tip.style.opacity = 1;
  }
  function yScale(P) { return v => M.t + (v - P.lim[1]) / (P.lim[0] - P.lim[1]) * (H - M.t - M.b); }
  function drawPanel(i) {
    panel = i;
    const P = PANELS[i], Y = yScale(P);
    XMAX = P.xmax || 600;
    gAxes.innerHTML = '';
    P.ticks.forEach(v => {
      mk('line', { class: 'grid', x1: M.l, x2: W - M.r, y1: Y(v), y2: Y(v) }, gAxes);
      mk('text', { class: 'tick', x: M.l - 10, y: Y(v) + 4, 'text-anchor': 'end' }, gAxes).textContent = v.toFixed(1);
    });
    (P.xt || [400, 200, 100, 50]).forEach(ms => {
      mk('line', { class: 'grid', x1: X(ms), x2: X(ms), y1: M.t, y2: H - M.b }, gAxes);
      mk('text', { class: 'tick', x: X(ms), y: H - M.b + 20, 'text-anchor': 'middle' }, gAxes).textContent = ms;
    });
    mk('line', { class: 'axis', x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b }, gAxes);
    mk('line', { class: 'axis', x1: M.l, x2: M.l, y1: M.t, y2: H - M.b }, gAxes);
    mk('text', { class: 'alabel', x: (M.l + W - M.r) / 2, y: H - 12, 'text-anchor': 'middle' }, gAxes).textContent = 'Latency (ms)';
    const yl = mk('text', { class: 'alabel', x: 0, y: 0, 'text-anchor': 'middle', transform: `translate(16 ${(M.t + H - M.b) / 2}) rotate(-90)` }, gAxes);
    yl.textContent = P.y;
    const bx = W - M.r - 70, by = H - M.b - 46;
    mk('path', { d: `M${bx} ${by + 26} l26 -26 m-10 0 h10 v10`, fill: 'none', stroke: '#8a93a8', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, gAxes);
    mk('text', { class: 'better', x: bx + 32, y: by + 30 }, gAxes).textContent = 'better';
    NAMES.forEach(n => {
      const p = P.pts[n], d = dots[n];
      const on = !!p && shown;
      const cx = p ? X(p[0]) : X(600), cy = p ? Y(p[1]) : H / 2;
      const tx = shown ? cx : X(600), ty = shown ? cy : Y(P.lim[0]);
      [d.c, d.halo].forEach(e => { if (e) { e.setAttribute('cx', p ? tx : cx); e.setAttribute('cy', p ? ty : cy); e.style.opacity = on ? 1 : 0; } });
      d.l.setAttribute('x', (p ? tx : cx) + (p ? p[2] : 0));
      d.l.setAttribute('y', (p ? ty : cy) + (p ? p[3] : 0));
      d.l.setAttribute('text-anchor', p ? p[4] : 'middle');
      d.l.style.opacity = on ? 1 : 0;
    });
    const a = P.pts['StereoViT-L'], b = P.pts['StereoViT-M'];
    if (a && b && shown) {
      Object.entries({ x1: X(a[0]), y1: Y(a[1]), x2: X(b[0]), y2: Y(b[1]) }).forEach(([k, v]) => link.setAttribute(k, v));
      link.style.transition = 'opacity .4s .5s';
      link.style.opacity = 1;
    } else {
      link.style.transition = 'opacity .2s';
      link.style.opacity = 0;
    }
    $$('#plot-tabs button').forEach(bt => bt.classList.toggle('on', +bt.dataset.panel === i));
  }
  $$('#plot-tabs button').forEach(bt => bt.addEventListener('click', () => drawPanel(+bt.dataset.panel)));
  drawPanel(0);
  svg.closest('.reveal').addEventListener('reveal', () => { shown = true; setTimeout(() => drawPanel(panel), 120); }, { once: true });

  /* ───── comparisons (all checked against ground truth): drag slider, StereoViT vs one baseline at a time ───── */
  const MNAME = { fs: 'FoundationStereo', waft: 'WAFT-Stereo-L', s2m2: 'S2M2-XL' };
  const CMP_TEXT = {
    glassdoors: ['Glass doors', 'The baselines see through the glass or leave holes; StereoViT keeps the doors solid.'],
    bin: ['Metal rods', 'Shiny rods break up the bin floor for the baselines; StereoViT keeps it flat.'],
    crates: ['Wooden crates', 'StereoViT recovers every handle cut-out, with the lowest error against ground truth.'],
  };
  const cmpMain = makeCompare($('#cmp-main'));
  let cmpData = [], cmpIdx = 0, cmpMethod = 'fs';
  fetch('static/cmp/cmp.json' + V).then(r => r.json()).then(list => {
    cmpData = list;
    const tabs = $('#cmp-tabs');
    list.forEach((c, i) => {
      const b = document.createElement('button');
      b.textContent = (CMP_TEXT[c.key] || [c.name])[0];
      b.title = c.name;
      b.addEventListener('click', () => selectCmp(i));
      tabs.appendChild(b);
    });
    new IntersectionObserver((es, ob) => {
      if (!es[0].isIntersecting) return;
      ob.disconnect();
      selectCmp(0);
      list.forEach(c => ['img', 'gt', 'oursL', ...c.methods].forEach(m => { const im = new Image(); im.src = `static/cmp/${c.key}_${m}.jpg${V}`; }));
    }, { rootMargin: '800px 0px' }).observe($('#compare'));
  });
  function selectCmp(i) {
    const c = cmpData[i];
    cmpIdx = i;
    $$('#cmp-tabs button').forEach((b, k) => b.classList.toggle('on', k === i));
    if (!c.methods.includes(cmpMethod)) cmpMethod = c.methods[0];
    const seg = $('#cmp-methods');
    seg.innerHTML = '';
    c.methods.forEach(m => {
      const b = document.createElement('button');
      b.textContent = MNAME[m];
      b.classList.toggle('on', m === cmpMethod);
      b.addEventListener('click', () => { cmpMethod = m; selectCmp(cmpIdx); });
      seg.appendChild(b);
    });
    $('.cmp-a', cmpMain).src = `static/cmp/${c.key}_${cmpMethod}.jpg${V}`;
    $('.cmp-b', cmpMain).src = `static/cmp/${c.key}_oursL.jpg${V}`;
    $('#cmp-tag-a').textContent = MNAME[cmpMethod];
    $('#cmp-text').textContent = (CMP_TEXT[c.key] || ['', ''])[1];
    $('#cmp-input').src = `static/cmp/${c.key}_img.jpg${V}`;
    $('#cmp-gt-fig').style.display = c.gt ? '' : 'none';
    if (c.gt) $('#cmp-gt').src = `static/cmp/${c.key}_gt.jpg${V}`;
  }
  cmpMain.closest('.reveal').addEventListener('reveal', () => setTimeout(cmpMain.sweep, 400), { once: true });

  /* ───── real robot: per-task comparison, mean bars ───── */
  const METHODS = ['StereoViT (ours)', 'FoundationStereo', 'StereoPolicy', 'Stereo-DP', 'DP'];
  // task success (%) over 20 rollouts per policy in unseen scenes (latest results, all six tasks)
  const SR = {
    'Pour Glass': [95, 90, 35, 0, 0], 'Place Lid': [65, 20, 5, 0, 0], 'Insert Straw': [30, 5, 0, 0, 0],
    'Stack Cube': [40, 25, 5, 0, 0], 'Hang Cup': [75, 50, 5, 0, 0], 'Place Riser': [40, 15, 0, 0, 0],
  };
  const TASK_TEXT = {
    'Pour Glass': ['fa-glass-water', 'Pour from a transparent glass.'],
    'Place Lid': ['fa-kitchen-set', 'Lid on a reflective steel pot.'],
    'Insert Straw': ['fa-bottle-water', 'Straw into a glass bottle.'],
    'Stack Cube': ['fa-cubes-stacked', 'Cube on a block of new height.'],
    'Hang Cup': ['fa-mug-hot', 'Mug handle onto a thin branch.'],
    'Place Riser': ['fa-layer-group', 'Cube on a riser of new height.'],
  };
  const vOurs = $('#v-ours'), bOurs = $('#b-ours');
  let tasks = [], cur = 0, userPicked = false, taskVisible = false, advanceTimer = null;
  const pctHTML = v => `<b>${v}%</b> success`;

  fetch('static/robot/robot.json' + V).then(r => r.json()).then(data => {
    tasks = data.tasks;
    const tabs = $('#task-tabs');
    tasks.forEach((t, i) => {
      const b = document.createElement('button');
      b.innerHTML = `<i class="fas ${(TASK_TEXT[t.task] || ['fa-robot'])[0]} ico"></i>${t.task}`;
      b.addEventListener('click', () => { userPicked = true; selectTask(i); });
      tabs.appendChild(b);
    });
    const grid = $('#base-grid');
    tasks[0].base.forEach((b, j) => {
      const f = document.createElement('figure');
      f.innerHTML = `<div class="vid"><video muted playsinline preload="none"></video><span class="badge"></span></div>
        <figcaption><span class="mname"></span><div class="bar"><i></i></div><span class="pct"></span></figcaption>`;
      grid.appendChild(f);
    });
    selectTask(0, false);
    buildMean();
  });

  function baseTiles() { return $$('#base-grid figure'); }
  function allVideos() { return [vOurs, ...baseTiles().map(f => $('video', f))]; }

  function selectTask(i, play = true) {
    cur = i;
    clearTimeout(advanceTimer);
    const t = tasks[i], sr = SR[t.task] || [0, 0, 0, 0, 0];
    $$('#task-tabs button').forEach((b, j) => b.classList.toggle('on', j === i));
    $('#task-title').textContent = t.task;
    $('#task-desc').textContent = (TASK_TEXT[t.task] || ['', ''])[1];
    $('#task-unseen').textContent = 'Unseen scene · ' + t.unseen.replace(/^Unseen scene: /, '').replace(/^New/, 'new');
    $('#task-train').src = `static/robot/${t.slug}_train.jpg`;
    vOurs.poster = `static/robot/${t.slug}_ours.jpg`;
    vOurs.src = `static/robot/${t.slug}_ours.mp4`;
    bOurs.className = 'badge';
    setBar($('#bar-ours'), $('#p-ours'), sr[0]);
    baseTiles().forEach((f, j) => {
      const b = t.base[j], v = $('video', f);
      v.poster = `static/robot/${t.slug}_${b.key}.jpg`;
      v.src = `static/robot/${t.slug}_${b.key}.mp4`;
      v._stopped = b.stopped;
      $('.vid', f).classList.remove('dim');
      $('.badge', f).className = 'badge';
      $('.mname', f).textContent = b.name;
      setBar($('.bar i', f), $('.pct', f), sr[1 + j]);
    });
    if (play && taskVisible) restart();
  }
  function setBar(fill, label, v) {
    fill.style.transition = 'none';
    fill.style.width = '0%';
    label.innerHTML = pctHTML(0);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      fill.style.transition = '';
      fill.style.width = Math.max(v, 0.8) + '%';
      countTo(label, v);
    }));
  }
  function countTo(label, v) {
    if (REDUCE) { label.innerHTML = pctHTML(v); return; }
    const t0 = performance.now();
    const step = t => { const k = (t - t0) / 1100; label.innerHTML = pctHTML(Math.round(v * ease(k))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  function restart() {
    allVideos().forEach(v => { v.currentTime = 0; const p = v.play(); if (p) p.catch(() => {}); });
  }
  vOurs.addEventListener('ended', () => {
    bOurs.className = 'badge ok show';
    bOurs.textContent = '✓ Success';
    if (!userPicked && taskVisible) advanceTimer = setTimeout(() => selectTask((cur + 1) % tasks.length), 3200);
  });
  document.addEventListener('ended', e => {
    const v = e.target;
    if (!(v instanceof HTMLVideoElement) || !v.closest('#base-grid')) return;
    const f = v.closest('figure'), badge = $('.badge', f);
    badge.className = 'badge show ' + (v._stopped ? 'stop' : 'fail');
    badge.textContent = v._stopped ? '✗ Stopped for safety' : '✗ Failure';
    if (v._stopped) $('.vid', f).classList.add('dim');
  }, true);
  $('#task-replay').addEventListener('click', () => { userPicked = true; selectTask(cur); });
  new IntersectionObserver(es => {
    taskVisible = es[0].isIntersecting;
    if (taskVisible) restart(); else { allVideos().forEach(v => v.pause()); clearTimeout(advanceTimer); }
  }, { threshold: 0.35 }).observe($('#task'));

  function buildMean() {
    const n = Object.keys(SR).length;
    const mean = METHODS.map((_, j) => Object.values(SR).reduce((s, v) => s + v[j], 0) / n);
    $('#mean h3').textContent = `Mean success over ${n} tasks`;
    const box = $('#mean-bars');
    METHODS.forEach((m, j) => {
      const row = document.createElement('div');
      row.className = 'mrow' + (j === 0 ? ' ours' : '');
      row.innerHTML = `<span class="mlabel">${m}</span><div class="bar${j === 0 ? ' ours' : ''}"><i></i></div><span class="mval">0%</span>`;
      box.appendChild(row);
    });
    $('#mean').addEventListener('reveal', () => {
      $$('.mrow', box).forEach((row, j) => {
        setTimeout(() => {
          $('i', row).style.width = Math.max(mean[j], 0.6) + '%';
          const lab = $('.mval', row), t0 = performance.now();
          const step = t => { const k = (t - t0) / 1200; lab.textContent = (mean[j] * ease(k)).toFixed(1) + '%'; if (k < 1) requestAnimationFrame(step); };
          if (REDUCE) lab.textContent = mean[j].toFixed(1) + '%'; else requestAnimationFrame(step);
        }, j * 110);
      });
    }, { once: true });
  }

  /* ───── real robot: depth from the robot's top camera, ZED sensor depth and stereo baselines vs StereoViT ───── */
  const RD_NAME = { zed: 'ZED depth (sensor)', fs: 'FoundationStereo', waft: 'WAFT-Stereo' };
  const RD = [
    ['pour_glass', 'Pour Glass', 'The ZED depth leaves holes in the wine glass; StereoViT keeps it whole.'],
    ['place_lid', 'Place Lid', 'The steel pot and the glass lid break up the ZED depth; StereoViT keeps both, down to the knob on the lid.'],
    ['insert_straw', 'Insert Straw', 'The glass bottle and the edges of the arm break up the ZED depth. The stereo models recover the bottle, and StereoViT also keeps the thin cable whole.'],
    ['place_riser', 'Place Riser', 'Close up, the white arm has little texture: the ZED depth has large holes and WAFT breaks up, while StereoViT stays smooth.'],
  ];
  const rdMain = makeCompare($('#rd-main'));
  let rdIdx = 0, rdMethod = 'zed';
  RD.forEach((r, i) => {
    const b = document.createElement('button');
    b.textContent = r[1];
    b.addEventListener('click', () => selectRd(i));
    $('#rd-tabs').appendChild(b);
  });
  function selectRd(i) {
    const [key, , text] = RD[i];
    rdIdx = i;
    $$('#rd-tabs button').forEach((b, k) => b.classList.toggle('on', k === i));
    const seg = $('#rd-methods');
    seg.innerHTML = '';
    Object.keys(RD_NAME).forEach(m => {
      const b = document.createElement('button');
      b.textContent = RD_NAME[m];
      b.classList.toggle('on', m === rdMethod);
      b.addEventListener('click', () => { rdMethod = m; selectRd(rdIdx); });
      seg.appendChild(b);
    });
    $('.cmp-a', rdMain).src = `static/rdepth/${key}_${rdMethod}.jpg${V}`;
    $('.cmp-b', rdMain).src = `static/rdepth/${key}_ours.jpg${V}`;
    $('#rd-tag-a').textContent = RD_NAME[rdMethod];
    $('#rd-text').textContent = text;
    $('#rd-input').src = `static/rdepth/${key}_img.jpg${V}`;
  }
  new IntersectionObserver((es, ob) => {
    if (!es[0].isIntersecting) return;
    ob.disconnect();
    selectRd(0);
    RD.forEach(([k]) => ['img', 'ours', ...Object.keys(RD_NAME)].forEach(m => { const im = new Image(); im.src = `static/rdepth/${k}_${m}.jpg${V}`; }));
  }, { rootMargin: '800px 0px' }).observe($('#rdepth'));
  $('#rdepth').addEventListener('reveal', () => setTimeout(rdMain.sweep, 400), { once: true });
})();
