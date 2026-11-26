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

  /* ───── teaser: hovering a panel lifts it out of the figure and brings it to life (desktop); a click or tap opens its section.
     stereo pair = disparity probe (a point and its match on the same row) · disparity = lens onto the left image · StereoViT box =
     what is inside · policy frames = the recording they are cut from · point cloud = turntable rendered with the teaser's own
     renderer · grasps = a Franka hand visiting the figure's grasps (animation) ───── */
  (() => {
    const box = $('#teaser-inner');
    if (!box) return;
    const IW = 2750, IH = 917, T = 'static/teaser/', NS = 'http://www.w3.org/2000/svg';
    const pct = (v, d) => `${(100 * v / d).toFixed(3)}%`;
    const place = (e, [x, y, w, h], [cx, cy, cw, ch] = [0, 0, IW, IH]) =>
      Object.assign(e.style, { left: pct(x - cx, cw), top: pct(y - cy, ch), width: pct(w, cw), height: pct(h, ch) });
    const mk = (tag, cls, parent, html) => {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (html != null) e.innerHTML = html;
      if (parent) parent.appendChild(e);
      return e;
    };
    const sv = (tag, attrs, parent) => {
      const e = document.createElementNS(NS, tag);
      for (const k in attrs) e.setAttribute(k, attrs[k]);
      if (parent) parent.appendChild(e);
      return e;
    };
    const U = (a, b) => { const x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1]); return [x, y, Math.max(a[0] + a[2], b[0] + b[2]) - x, Math.max(a[1] + a[3], b[1] + b[3]) - y]; };
    const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const hint = $('.teaser-hint');
    if (hint) hint.textContent = fine ? 'Hover a panel to try it; click to open its section.' : 'Tap a panel to open its section.';
    const base = $('img', box);
    const teaserURL = () => base.currentSrc || base.src;
    const still = (parent, r, card) => {  // the panel's own pixels of the figure, shown until the live content is ready
      const s = mk('div', 'tz-still', parent);
      place(s, r, card);
      s.style.backgroundImage = `url("${teaserURL()}")`;
      s.style.backgroundSize = `${100 * IW / r[2]}% ${100 * IH / r[3]}%`;
      s.style.backgroundPosition = `${100 * r[0] / (IW - r[2])}% ${100 * r[1] / (IH - r[3])}%`;
      return s;
    };

    fetch(T + 'live.json' + V).then(r => r.json()).then(G => {
      const dim = fine ? mk('div', 'tz-dim', box) : null, hole = dim && mk('i', 'tz-hole', dim);
      let active = null, scrollT = 0, warmed = false, probe = null;
      addEventListener('scroll', () => { scrollT = performance.now(); }, { passive: true });
      const P = G.probe;
      const disp = (u, v) => {  // left-image px (1920 x 1080) -> StereoViT-L disparity (px)
        if (!probe) return null;
        const i = Math.min(P.w - 1, Math.max(0, Math.floor(u / P.W * P.w))), j = Math.min(P.h - 1, Math.max(0, Math.floor(v / P.H * P.h)));
        return probe[j * P.w + i] / P.q + P.off;
      };
      const seqs = {};
      const clip = (v, src) => { if (!v.src) { v.preload = 'auto'; v.src = `${T}${src}${V}`; } };  // preload="none" would never fetch it
      function warm() {  // load the live content (about 1.5 MB) on the first hover, or when the figure has been on screen for a while
        if (warmed) return;
        warmed = true;
        $$('img[data-src]', box).forEach(im => { im.addEventListener('load', () => im.classList.add('ok'), { once: true }); im.src = im.dataset.src; });
        $$('[data-bg]', box).forEach(e => { e.style.backgroundImage = `url("${e.dataset.bg}")`; });
        fetch(T + 'probe.bin' + V).then(r => r.arrayBuffer()).then(b => { probe = new Uint8Array(b); if (active && active.refresh) active.refresh(); });
        Object.values(seqs).forEach(s => s.load());
        box.querySelectorAll('.tz-slot video').forEach(v => clip(v, G.frames.video));
        box.querySelectorAll('.tz-vid').forEach(v => clip(v, G.grasp.video));
      }
      function open(z) {
        if (active === z) return;
        if (active) close(active);
        active = z;
        z.a.classList.add('on');
        warm();
        if (dim) {
          box.classList.add('dim');
          if (z.hole) place(hole, z.hole); else Object.assign(hole.style, { width: '0px', height: '0px' });
        }
        if (z.open) z.open();
      }
      function close(z) {
        z.a.classList.remove('on');
        if (active === z) { active = null; box.classList.remove('dim'); }
        if (z.close) z.close();
      }
      // one zone per panel: a link over the panel and, on desktop, a card that lifts out of the figure (scale s about origin o,
      // shifted so that it stays inside the figure; s0: start scale of a card that grows out of a smaller panel)
      function zone(href, label, rect, card, s, o, s0 = 1) {
        const a = mk('a', 'tz', box);
        a.href = href;
        a.setAttribute('aria-label', label);
        place(a, rect);
        const z = { a, rect, card, s };
        if (fine) {
          const go = () => { if (performance.now() - scrollT > 250) open(z); };
          a.addEventListener('pointerenter', go);
          a.addEventListener('pointermove', go);
          a.addEventListener('pointerleave', () => close(z));
          a.addEventListener('focus', () => open(z));
          a.addEventListener('blur', () => close(z));
        }
        if (!card || !fine) return z;
        const c = z.c = mk('div', 'tz-card', a);
        place(c, card, rect);
        const [x, y, w, h] = card, X = x + o[0] * w * (1 - s), Y = y + o[1] * h * (1 - s);
        const dx = Math.max(-16 - X, 0) + Math.min(IW + 16 - (X + w * s), 0), dy = Math.max(-60 - Y, 0) + Math.min(IH + 60 - (Y + h * s), 0);
        Object.assign(c.style, { transformOrigin: `${100 * o[0]}% ${100 * o[1]}%` });
        c.style.setProperty('--s', s);
        c.style.setProperty('--s0', s0);
        c.style.setProperty('--tx', pct(dx, w));
        c.style.setProperty('--ty', pct(dy, h));
        return z;
      }
      const chip = (c, html, top) => mk('span', 'tz-chip' + (top ? ' top' : ''), c, html);

      /* (a) plots: the points show their numbers */
      const plot = zone('#accuracy', 'Accuracy vs. latency: open the interactive plot', [40, 10, 660, 840]);
      plot.hole = [40, 10, 660, 840];
      if (fine) {
        const tip = mk('div', 'teaser-tip', box);
        const PTS = [  // marker centres in the figure (px) and the PANELS entry they show
          [0, 'StereoViT-L', 487, 80], [0, 'StereoViT-M', 628, 97], [0, 'NBS', 294, 104], [0, 'WAFT-Stereo-L', 420, 172],
          [0, 'S2M2-XL', 408, 187], [0, 'FoundationStereo', 234, 322], [1, 'StereoViT-L', 488, 480], [1, 'S2M2-XL', 409, 500],
          [1, 'NBS', 295, 519], [1, 'WAFT-Stereo-L', 420, 598], [1, 'FoundationStereo', 234, 706]];
        PTS.forEach(([p, name, x, y]) => {
          const pan = PANELS[p], v = pan.pts[name], ours = name.startsWith('StereoViT'), r = ours ? 24 : 19;
          const s = mk('span', 'tp' + (ours ? ' ours' : ''), plot.a);
          place(s, [x - r, y - r, 2 * r, 2 * r], plot.rect);
          s.addEventListener('pointerenter', () => {
            tip.innerHTML = `<div class="tt-h${ours ? ' ours' : ''}">${name}</div>`
              + `<div class="tt-m">${pan.y.replace(' (%)', '')} <b>${v[1].toFixed(2)}%</b></div>`
              + `<div class="tt-m">Latency <b>${v[0]} ms</b></div>`;
            tip.style.left = pct(x + r + 16, IW);
            const hh = tip.offsetHeight / box.offsetHeight * IH || 300;
            tip.style.top = pct(Math.max(4, Math.min(IH - hh - 4, y - hh / 2)), IH);
            tip.classList.add('on');
          });
          s.addEventListener('pointerleave', () => tip.classList.remove('on'));
        });
      }

      /* (b) stereo pair: a point in L, its match in R on the same image row, shifted left by the disparity */
      const pair = zone('#method', 'Stereo pair: see the architecture', U(G.pair.L, G.pair.R), G.pair.card, 1.75, [0, 0]);
      if (pair.c) {
        const c = pair.c, C = G.pair.card, rel = r => [r[0] - C[0], r[1] - C[1], r[2], r[3]];
        const L = rel(G.pair.L), R = rel(G.pair.R);
        still(c, U(G.pair.L, G.pair.R), C);
        [['pair_L', G.pair.L, 'L'], ['pair_R', G.pair.R, 'R']].forEach(([n, r, t]) => {
          const im = mk('img', 'tz-img', c);
          im.dataset.src = `${T}${n}.jpg${V}`;
          im.alt = '';
          place(im, r, C);
          const tag = mk('b', 'tz-lr', c, t);
          place(tag, [r[0] + 6, r[1] + 6, 26, 26], C);
        });
        const g = sv('svg', { viewBox: `0 0 ${C[2]} ${C[3]}`, preserveAspectRatio: 'none', class: 'tz-svg' }, c);
        const epL = sv('line', { class: 'epi' }, g), epR = sv('line', { class: 'epi' }, g), sh = sv('line', { class: 'sh' }, g);
        const gh = sv('circle', { class: 'ghost', r: 7 }, g), dL = sv('circle', { class: 'dot', r: 8 }, g), dR = sv('circle', { class: 'dot', r: 8 }, g);
        const tL = sv('text', {}, g), tR = sv('text', { 'text-anchor': 'middle' }, g);
        chip(c, 'Point at either image').classList.add('tr');
        let last = [900, 560];
        const set = (u, v) => {  // u, v: left-image px
          last = [u, v];
          const d = disp(u, v);
          g.style.opacity = d == null ? 0 : 1;
          if (d == null) return;
          const yL = L[1] + v / P.H * L[3], yR = R[1] + v / P.H * R[3];
          const xL = L[0] + u / P.W * L[2], xR = R[0] + (u - d) / P.W * R[2], xG = R[0] + u / P.W * R[2];
          const at = (e, o) => { for (const k in o) e.setAttribute(k, o[k]); };
          at(epL, { x1: L[0], x2: L[0] + L[2], y1: yL, y2: yL });
          at(epR, { x1: R[0], x2: R[0] + R[2], y1: yR, y2: yR });
          at(sh, { x1: xG, x2: xR, y1: yR, y2: yR });
          at(gh, { cx: xG, cy: yR });
          at(dL, { cx: xL, cy: yL });
          at(dR, { cx: xR, cy: yR });
          const right = xL < L[0] + L[2] * 0.62, below = yL < L[1] + 34;  // labels stay inside the card
          at(tL, { x: xL + (right ? 14 : -14), y: below ? yL + 26 : yL - 12, 'text-anchor': right ? 'start' : 'end' });
          tL.textContent = `depth ${(P.fB / d).toFixed(2)} m`;
          at(tR, { x: Math.max(R[0] + 80, Math.min(R[0] + R[2] - 80, (xG + xR) / 2)), y: yR < R[1] + 34 ? yR + 28 : yR - 14 });
          tR.textContent = `disparity ${Math.round(d)} px`;
        };
        pair.open = () => set(900, 560);  // start on the glass bottle
        pair.refresh = () => set(...last);
        c.addEventListener('pointermove', e => {
          const b = c.getBoundingClientRect(), x = (e.clientX - b.left) / b.width * C[2], y = (e.clientY - b.top) / b.height * C[3];
          const inR = (r) => x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3];
          if (inR(L)) set((x - L[0]) / L[2] * P.W, (y - L[1]) / L[3] * P.H);
          else if (inR(R)) {  // a point in R: find the left pixel whose match it is (fixed point along the row)
            const uR = (x - R[0]) / R[2] * P.W, v = (y - R[1]) / R[3] * P.H;
            let u = uR + 140;
            for (let k = 0; k < 6; k++) u = uR + (disp(Math.min(P.W - 1, u), v) || 140);
            set(Math.min(P.W - 1, u), v);
          }
        });
      }

      /* (b) StereoViT box: open it to see what is inside (encoder + decoder of the architecture figure) */
      const bx = G.box, peek = zone('#method', 'StereoViT: see the architecture', bx.rect, bx.card, 1,
        [(bx.rect[0] + bx.rect[2] / 2 - bx.card[0]) / bx.card[2], (bx.rect[1] + bx.rect[3] / 2 - bx.card[1]) / bx.card[3]], bx.rect[2] / bx.card[2]);
      if (peek.c) {
        peek.c.classList.add('peek');
        const im = mk('img', 'tz-img tz-fill', peek.c);
        im.dataset.src = `${T}arch.jpg${V}`;
        im.alt = 'Inside StereoViT: shared ViT encoder, decoder with window, shifted-window and global attention, stereo features';
        chip(peek.c, 'Inside StereoViT', true);
        chip(peek.c, 'Click for the architecture <i class="fas fa-arrow-down"></i>');
      }

      /* (b) disparity: a lens onto the left image, with the disparity and depth under it */
      const dz = zone('#compare', 'Disparity: see the comparisons', G.disp.rect, G.disp.rect, 1.75, [0.6, 0.3]);
      if (dz.c) {
        const c = dz.c;
        still(c, G.disp.rect, G.disp.rect);
        const im = mk('img', 'tz-img tz-fill', c);
        im.dataset.src = `${T}disp.jpg${V}`;
        im.alt = '';
        const lens = mk('div', 'tz-lens', c), read = mk('div', 'tz-read', c);
        lens.dataset.bg = `${T}pair_L.jpg${V}`;
        chip(c, 'Disparity · lens: left image', true);
        let last = [900 / 1920, 560 / 1080];
        const set = (fx, fy) => {
          last = [fx, fy];
          const W = c.offsetWidth, H = c.offsetHeight, r = 0.27 * H;
          Object.assign(lens.style, { width: `${2 * r}px`, height: `${2 * r}px`, left: `${fx * W - r}px`, top: `${fy * H - r}px`,
            backgroundSize: `${W}px ${H}px`, backgroundPosition: `${r - fx * W}px ${r - fy * H}px` });
          const d = disp(fx * P.W, fy * P.H);
          read.textContent = d == null ? '' : `${Math.round(d)} px · ${(P.fB / d).toFixed(2)} m`;
          read.style.opacity = d == null ? 0 : 1;
          Object.assign(read.style, { left: `${fx * W}px`, top: `${Math.min(H - 14, fy * H + r + 3)}px` });
        };
        dz.open = () => set(...last);
        dz.refresh = () => set(...last);
        c.addEventListener('pointermove', e => {
          const b = c.getBoundingClientRect();
          set(Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)), Math.max(0, Math.min(1, (e.clientY - b.top) / b.height)));
        });
      }

      /* (b) policy frames: the recording they are cut from (same crop, 2x); each frame loops its phase of the rollout, from its still on */
      const fr = G.frames, fz = zone('#robot', 'Robot policy: see the rollouts', U(fr.rects[0], fr.rects[2]), fr.card, 1.28, [0.5, 1]);
      if (fz.c) {
        const vids = fr.rects.map((r, i) => {
          const slot = still(fz.c, r, fr.card);
          slot.classList.add('tz-slot');
          const v = mk('video', '', slot);
          v.muted = true; v.playsInline = true; v.preload = 'none';
          v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
          v.addEventListener('playing', () => v.classList.add('ok'));
          [v._a, v._b] = fr.segs[i];
          v._t = fr.at[i];
          return v;
        });
        chip(fz.c, 'StereoViT policy · 2×', true);
        let raf = 0;
        fz.open = () => {
          vids.forEach(v => {
            clip(v, fr.video);
            const go = () => { v.currentTime = v._t; v.play().catch(() => {}); };
            if (v.readyState >= 1) go(); else v.addEventListener('loadedmetadata', go, { once: true });
          });
          const tick = () => {
            vids.forEach(v => { if (v.readyState >= 1 && !v.seeking && (v.currentTime >= v._b || v.currentTime < v._a - 0.3)) v.currentTime = v._a; });
            raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
        };
        fz.close = () => { cancelAnimationFrame(raf); vids.forEach(v => { v.pause(); v.classList.remove('ok'); }); };
      }

      /* (c) grasps: a Franka hand visiting the figure's grasps (an animation: same renderer, camera and grasps as the figure) */
      const gz = zone('#more', 'Grasps: see grasping', G.grasp.rect, G.grasp.card, 1.32, [1, 1]);
      if (gz.c) {
        const st = still(gz.c, G.grasp.rect, G.grasp.card), v = mk('video', 'tz-fill tz-vid', gz.c);
        v.muted = true; v.playsInline = true; v.loop = true; v.preload = 'none';
        v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
        v.addEventListener('playing', () => { v.classList.add('ok'); st.style.opacity = 0; });
        chip(gz.c, 'Franka hand on the predicted grasps (animation)');
        gz.open = () => {
          clip(v, G.grasp.video);
          const go = () => { v.currentTime = 0; v.play().catch(() => {}); };
          if (v.readyState >= 1) go(); else v.addEventListener('loadedmetadata', go, { once: true });
        };
        gz.close = () => { v.pause(); v.classList.remove('ok'); st.style.opacity = 1; };
      }

      /* (c) point cloud: move the mouse to turn it (frames from the teaser's renderer, -26..26 deg) */
      [['cloud', '#in3d', 'Point cloud: open the 3D viewer', [1, 0], 'Move to turn the cloud · click for the 3D viewer']].forEach(([k, href, label, o, tipText]) => {
        const g = G[k], z = zone(href, label, g.rect, g.card, 1.32, o);
        const frames = [];
        let draw = () => {};
        seqs[k] = { load() {
          for (let i = 0; i < g.n; i++) {
            const im = new Image();
            im.decoding = 'async';
            if (i === g.zero) im.onload = () => { if (active === z) draw(); };
            im.src = `${T}${k}_${String(i).padStart(2, '0')}.webp${V}`;
            frames[i] = im;
          }
        } };
        if (!z.c) return;
        const c = z.c, st = still(c, g.rect, g.card), cv = mk('canvas', 'tz-fill', c), ctx = cv.getContext('2d');
        chip(c, tipText);
        let cur = g.zero, tgt = g.zero, raf = 0, x0 = null, a0 = 0, hintT = [];
        draw = () => {
          const im = frames[Math.round(cur)];
          if (!im || !im.complete || !im.naturalWidth) return;
          const W = Math.round(c.offsetWidth * z.s * devicePixelRatio), H = Math.round(c.offsetHeight * z.s * devicePixelRatio);
          if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
          ctx.drawImage(im, 0, 0, W, H);
          st.style.opacity = 0;
        };
        const loop = () => {
          cur += (tgt - cur) * 0.2;
          if (Math.abs(tgt - cur) < 0.03) cur = tgt;
          draw();
          raf = cur === tgt ? 0 : requestAnimationFrame(loop);
        };
        const turn = t => { tgt = Math.max(0, Math.min(g.n - 1, t)); if (!raf) raf = requestAnimationFrame(loop); };
        z.open = () => {
          x0 = null; cur = tgt = g.zero; draw();
          // a small turn back and forth so people see it is 3D; the mouse takes over as soon as it moves
          hintT = [setTimeout(() => turn(g.zero - 5), 380), setTimeout(() => turn(g.zero + 5), 1000), setTimeout(() => turn(g.zero), 1600)];
        };
        z.close = () => { hintT.forEach(clearTimeout); cancelAnimationFrame(raf); raf = 0; cur = tgt = g.zero; st.style.opacity = 1; };
        c.addEventListener('pointermove', e => {
          const b = c.getBoundingClientRect();
          if (x0 == null) { x0 = e.clientX; a0 = tgt; hintT.forEach(clearTimeout); }
          turn(a0 - (e.clientX - x0) / b.width * 46);  // ~92 deg per card width; moving right turns the scene's front to the right
        });
      });

      if (fine) new IntersectionObserver((es, ob) => {  // fetch the live content once the figure has been on screen for a moment
        if (!es[0].isIntersecting) return;
        ob.disconnect();
        setTimeout(() => (window.requestIdleCallback || setTimeout)(warm), 2500);
      }, { threshold: 0.5 }).observe(box);
    });
  })();

  /* ───── comparisons (all checked against ground truth): drag slider, StereoViT vs one baseline at a time ───── */
  const MNAME = { fs: 'FoundationStereo', waft: 'WAFT-Stereo-L', s2m2: 'S2M2-XL', gt: 'Ground truth' };
  // shown instead of the scene text while the ground truth is on the slider (white = nothing measured)
  const GT_TEXT = {
    glassdoors: 'The laser scan has no ground truth on the glass itself (white): scanners cannot measure glass either. Frame and walls match.',
  };
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
    const methods = c.gt ? [...c.methods, 'gt'] : c.methods;
    if (!methods.includes(cmpMethod)) cmpMethod = methods[0];
    const seg = $('#cmp-methods');
    seg.innerHTML = '';
    methods.forEach(m => {
      const b = document.createElement('button');
      b.textContent = MNAME[m];
      b.classList.toggle('on', m === cmpMethod);
      b.addEventListener('click', () => { cmpMethod = m; selectCmp(cmpIdx); });
      seg.appendChild(b);
    });
    $('.cmp-a', cmpMain).src = `static/cmp/${c.key}_${cmpMethod}.jpg${V}`;
    $('.cmp-b', cmpMain).src = `static/cmp/${c.key}_oursL.jpg${V}`;
    $('#cmp-tag-a').textContent = MNAME[cmpMethod];
    $('#cmp-text').textContent = cmpMethod === 'gt' ? (GT_TEXT[c.key] || 'White in the ground truth: nothing measured there.') : (CMP_TEXT[c.key] || ['', ''])[1];
    $('#cmp-input').src = `static/cmp/${c.key}_img.jpg${V}`;
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
