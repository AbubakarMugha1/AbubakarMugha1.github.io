// Small looping illustrations for the development projects (RAG, solar detection,
// web security, LUMScape). Each is a pure function of time, drawn into an inline SVG.
// Paused when off-screen; a single still frame under prefers-reduced-motion.
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function mk(parent, tag, attrs) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    parent.appendChild(e);
    return e;
  }
  function txt(parent, x, y, s, cls, anchor) {
    var t = mk(parent, 'text', { x: x, y: y, class: cls, 'text-anchor': anchor || 'middle' });
    t.textContent = s;
    return t;
  }
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function seg(t, a, b) { return clamp((t - a) / (b - a)); }
  function ease(p) { return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; }
  function lerp(a, b, p) { return a + (b - a) * p; }
  function arrow(svg, id) {
    var defs = mk(svg, 'defs', {});
    var m = mk(defs, 'marker', { id: id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6,
      orient: 'auto-start-reverse' });
    mk(m, 'path', { d: 'M0 0 L10 5 L0 10 z', class: 'pa-head' });
    return 'url(#' + id + ')';
  }
  function rng(seed) {
    return function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  }

  function run(svg, period, render, stillT) {
    if (reduce) { render(stillT, 0); return; }
    var visible = true, last = null, t = 0;
    if ('IntersectionObserver' in window)
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; last = null; }).observe(svg);
    (function frame(ts) {
      if (visible && !document.hidden) {
        if (last !== null) t += Math.min(0.05, (ts - last) / 1000);
        last = ts;
        render(t % period, Math.floor(t / period));
      } else last = null;
      requestAnimationFrame(frame);
    })(performance.now());
  }

  // ------------------------------------------------------------------ RAG
  (function () {
    var svg = document.getElementById('rag-sim');
    if (!svg) return;
    var head = arrow(svg, 'rag-arrow');
    var root = mk(svg, 'g', {});
    var docs = [['PDF', 14], ['DOC', 72], ['TXT', 130]];
    var widths = [[40, 32, 38], [36, 40, 28], [30, 40, 36]];
    var chunks = [];
    docs.forEach(function (d, i) {
      var x = 14, y = d[1], w = 60, h = 50;
      mk(root, 'line', { x1: x + w, y1: y + 25, x2: 108, y2: 96, class: 'pa-faint' });
      mk(root, 'path', { d: 'M' + x + ' ' + y + ' H' + (x + w - 10) + ' L' + (x + w) + ' ' + (y + 10) + ' V' + (y + h) +
        ' H' + x + ' Z', class: 'pa-box' });
      mk(root, 'path', { d: 'M' + (x + w - 10) + ' ' + y + ' V' + (y + 10) + ' H' + (x + w), class: 'pa-line' });
      txt(root, x + 7, y + 13, d[0], 'pa-tiny', 'start');
      for (var c = 0; c < 3; c++) {
        var bx = x + 7, by = y + 20 + c * 8, bw = widths[i][c];
        chunks.push({ x: bx, y: by, w: bw, el: mk(root, 'rect', { x: bx, y: by, width: bw, height: 4, rx: 2, class: 'pa-bar' }) });
      }
    });
    var q = mk(root, 'g', {});
    mk(q, 'rect', { x: 102, y: 10, width: 66, height: 22, rx: 11, class: 'pa-pill' });
    mk(q, 'circle', { cx: 116, cy: 20, r: 4, class: 'pa-line' });
    mk(q, 'line', { x1: 119, y1: 23, x2: 122, y2: 26, class: 'pa-line' });
    txt(q, 145, 24.5, 'query', 'pa-small');
    mk(root, 'line', { x1: 135, y1: 34, x2: 135, y2: 74, class: 'pa-dash', 'marker-end': head });
    var llm = mk(root, 'rect', { x: 110, y: 76, width: 50, height: 40, rx: 8, class: 'pa-box' });
    txt(root, 135, 100, 'LLM', 'pa-label');
    mk(root, 'line', { x1: 160, y1: 96, x2: 192, y2: 96, class: 'pa-line', 'marker-end': head });
    mk(root, 'rect', { x: 194, y: 64, width: 64, height: 64, rx: 8, class: 'pa-box' });
    txt(root, 202, 79, 'answer', 'pa-tiny', 'start');
    var ans = [44, 38, 26].map(function (w, k) {
      return { w: w, el: mk(root, 'rect', { x: 202, y: 88 + k * 10, width: 0, height: 4, rx: 2, class: 'pa-hit' }) };
    });
    var flyers = [0, 1, 2].map(function () { return mk(root, 'rect', { height: 4, rx: 2, class: 'pa-hit' }); });

    run(svg, 7.5, function (t, cycle) {
      var r = rng(cycle * 7 + 3), pick = [];
      while (pick.length < 3) { var k = Math.floor(r() * 9); if (pick.indexOf(k) < 0) pick.push(k); }
      root.style.opacity = 1 - seg(t, 6.9, 7.5);
      q.style.opacity = seg(t, 0, 0.5);
      chunks.forEach(function (c, i) {
        var s0 = 0.6 + i * 0.1, cls = 'pa-bar';
        if (t >= s0 && t < s0 + 0.3) cls = 'pa-scan';
        if (t >= 1.7 && pick.indexOf(i) >= 0) cls = 'pa-hit';
        c.el.setAttribute('class', cls);
      });
      pick.forEach(function (i, j) {
        var c = chunks[i], f = flyers[j], p = ease(seg(t, 2.1 + j * 0.15, 2.9 + j * 0.15));
        var on = t >= 2.1 + j * 0.15 && p < 1;
        f.style.opacity = on ? 1 - p * 0.6 : 0;
        f.setAttribute('x', lerp(c.x, 120, p));
        f.setAttribute('y', lerp(c.y, 94, p));
        f.setAttribute('width', lerp(c.w, 30, p));
      });
      llm.setAttribute('class', t >= 2.9 && t < 4.0 ? 'pa-box pa-active' : 'pa-box');
      ans.forEach(function (a, k) { a.el.setAttribute('width', a.w * ease(seg(t, 3.9 + k * 0.45, 4.4 + k * 0.45))); });
    }, 4.6);
  })();

  // ------------------------------------------------------------------ Solar panels
  (function () {
    var svg = document.getElementById('solar-sim');
    if (!svg) return;
    var defs = mk(svg, 'defs', {});
    var f = mk(defs, 'filter', { id: 'sp-blur', x: '-5%', y: '-5%', width: '110%', height: '110%' });
    mk(f, 'feGaussianBlur', { stdDeviation: 2.4 });
    var cp = mk(defs, 'clipPath', { id: 'sp-clip' });
    var reveal = mk(cp, 'rect', { x: 10, y: 8, width: 0, height: 180 });
    var frameClip = mk(defs, 'clipPath', { id: 'sp-frame' });
    mk(frameClip, 'rect', { x: 10, y: 8, width: 250, height: 180, rx: 8 });

    var roofs = [[22, 18, 52, 36], [86, 20, 44, 62], [22, 60, 48, 28], [164, 16, 82, 34], [164, 58, 40, 28],
      [214, 58, 36, 28], [22, 112, 64, 42], [98, 112, 40, 64], [164, 112, 48, 42], [222, 112, 30, 64]];
    var panels = [[28, 24, 5, 3], [28, 66, 4, 2], [172, 22, 8, 2], [220, 64, 3, 2], [30, 120, 6, 3], [172, 120, 4, 3]];

    function scene(g) {
      mk(g, 'rect', { x: 10, y: 8, width: 250, height: 180, class: 'sp-ground' });
      mk(g, 'rect', { x: 10, y: 93, width: 250, height: 12, class: 'sp-road' });
      mk(g, 'rect', { x: 145, y: 8, width: 12, height: 180, class: 'sp-road' });
      roofs.forEach(function (r, i) {
        mk(g, 'rect', { x: r[0], y: r[1], width: r[2], height: r[3], rx: 2, class: i % 2 ? 'sp-roof' : 'sp-roof2' });
      });
      panels.forEach(function (p) {
        for (var c = 0; c < p[2]; c++)
          for (var rr = 0; rr < p[3]; rr++)
            mk(g, 'rect', { x: p[0] + c * 8, y: p[1] + rr * 6, width: 7, height: 5, class: 'sp-panel' });
      });
    }
    var outer = mk(svg, 'g', { 'clip-path': 'url(#sp-frame)' });
    var blurred = mk(outer, 'g', { filter: 'url(#sp-blur)' });
    scene(blurred);
    var sharp = mk(outer, 'g', { 'clip-path': 'url(#sp-clip)' });
    scene(sharp);
    mk(svg, 'rect', { x: 10, y: 8, width: 250, height: 180, rx: 8, class: 'pa-box', style: 'fill:none' });
    var scan = mk(svg, 'line', { x1: 10, y1: 8, x2: 10, y2: 188, class: 'sp-scan' });
    var boxes = panels.map(function (p) {
      var g = mk(svg, 'g', {});
      var x = p[0] - 3, y = p[1] - 3, w = p[2] * 8 + 5, h = p[3] * 6 + 5;
      mk(g, 'rect', { x: x, y: y, width: w, height: h, rx: 2, class: 'sp-box' });
      mk(g, 'rect', { x: x, y: y - 5, width: 12, height: 5, rx: 1, class: 'sp-tag' });
      return g;
    });

    run(svg, 8, function (t) {
      var sweep = ease(seg(t, 0.6, 2.2));
      var fadeBack = seg(t, 7.2, 8);
      reveal.setAttribute('width', 250 * sweep);
      sharp.style.opacity = 1 - fadeBack;
      var sx = 10 + 250 * sweep;
      scan.setAttribute('x1', sx); scan.setAttribute('x2', sx);
      scan.style.opacity = t > 0.6 && t < 2.3 ? 1 : 0;
      boxes.forEach(function (b, i) {
        var a = seg(t, 2.5 + i * 0.3, 2.8 + i * 0.3);
        b.style.opacity = a * (1 - fadeBack);
      });
    }, 5);
  })();

  // ------------------------------------------------------------------ Web security
  (function () {
    var svg = document.getElementById('sec-sim');
    if (!svg) return;
    var root = mk(svg, 'g', {});
    function browser(x, y, label, cls) {
      mk(root, 'rect', { x: x, y: y, width: 56, height: 42, rx: 5, class: cls });
      mk(root, 'line', { x1: x, y1: y + 10, x2: x + 56, y2: y + 10, class: 'pa-faint' });
      for (var i = 0; i < 3; i++) mk(root, 'circle', { cx: x + 6 + i * 5, cy: y + 5, r: 1.5, class: 'pa-dot' });
      txt(root, x + 28, y + 29, label, 'pa-small');
    }
    browser(10, 32, 'user', 'pa-box');
    browser(10, 122, 'attacker', 'pa-box pa-evil');
    mk(root, 'line', { x1: 66, y1: 53, x2: 124, y2: 84, class: 'pa-faint' });
    mk(root, 'line', { x1: 66, y1: 143, x2: 124, y2: 116, class: 'pa-faint' });
    mk(root, 'line', { x1: 146, y1: 100, x2: 204, y2: 100, class: 'pa-faint' });
    var gate = mk(root, 'rect', { x: 125, y: 30, width: 20, height: 140, rx: 10, class: 'sc-gate' });
    mk(root, 'path', { d: 'M135 90 l8 3 v6 c0 5 -4 8 -8 10 c-4 -2 -8 -5 -8 -10 v-6 z', class: 'sc-shield' });
    txt(root, 135, 22, 'token check', 'pa-tiny');
    mk(root, 'rect', { x: 204, y: 66, width: 56, height: 68, rx: 6, class: 'pa-box' });
    for (var i = 0; i < 3; i++) {
      mk(root, 'rect', { x: 212, y: 80 + i * 14, width: 40, height: 9, rx: 2, class: 'pa-bar' });
      mk(root, 'circle', { cx: 247, cy: 84.5 + i * 14, r: 1.6, class: 'pa-dot' });
    }
    txt(root, 232, 76, 'API', 'pa-tiny');

    function packet() {
      var g = mk(root, 'g', {});
      var r = mk(g, 'rect', { x: -10, y: -7, width: 20, height: 14, rx: 3 });
      var s = txt(g, 0, 3.5, '', 'sc-glyph');
      return { g: g, r: r, s: s };
    }
    var P = [packet(), packet(), packet()];
    var mark = txt(root, 112, 126, '✕', 'sc-x');
    var reply = mk(root, 'circle', { r: 2.5, class: 'pa-ack' });

    function place(p, x, y, cls, glyph, op) {
      p.g.setAttribute('transform', 'translate(' + x + ' ' + y + ')');
      p.r.setAttribute('class', cls);
      p.s.textContent = glyph;
      p.g.style.opacity = op;
    }
    function path(pts, prog) {
      var n = pts.length - 1, sgi = Math.min(n - 1, Math.floor(prog * n)), lp = prog * n - sgi;
      return [lerp(pts[sgi][0], pts[sgi + 1][0], lp), lerp(pts[sgi][1], pts[sgi + 1][1], lp)];
    }

    run(svg, 7.2, function (t) {
      var gateCls = 'sc-gate';
      // 1) valid request with token: passes, server replies
      var a = seg(t, 0, 1.8), pa = path([[72, 56], [135, 88], [135, 100], [200, 100]], ease(a));
      place(P[0], pa[0], pa[1], 'sc-ok', '✓', t < 1.9 ? 1 : 0);
      if (t > 0.6 && t < 1.1) gateCls = 'sc-gate sc-pass';
      var rp = seg(t, 1.9, 2.6);
      reply.setAttribute('cx', lerp(204, 66, rp)); reply.setAttribute('cy', lerp(96, 60, rp));
      reply.style.opacity = t > 1.9 && t < 2.6 ? 1 : 0;
      // 2) forged cross-site request without a token: blocked at the gate
      var b = seg(t, 2.6, 3.5), pb = path([[72, 140], [118, 118]], ease(b));
      var shake = t > 3.5 && t < 3.9 ? Math.sin(t * 60) * 1.5 : 0;
      var fadeB = 1 - seg(t, 3.9, 4.3);
      place(P[1], pb[0] + shake, pb[1], t > 3.5 ? 'sc-bad sc-blocked' : 'sc-bad', t > 3.5 ? '✕' : '?', t >= 2.6 && t < 4.3 ? fadeB : 0);
      if (t > 3.5 && t < 4.1) gateCls = 'sc-gate sc-block';
      mark.style.opacity = 0;
      // 3) script payload: sanitized at the gate, then passes as plain text
      var c = seg(t, 4.5, 6.6), pc = path([[72, 140], [135, 112], [135, 100], [200, 104]], ease(c));
      var clean = ease(c) > 0.45;
      place(P[2], pc[0], pc[1], clean ? 'sc-clean' : 'sc-bad', clean ? '··' : '</>', t >= 4.5 && t < 6.7 ? 1 : 0);
      if (ease(c) > 0.38 && ease(c) < 0.6) gateCls = 'sc-gate sc-pass';
      gate.setAttribute('class', gateCls);
    }, 3.7);
  })();

  // ------------------------------------------------------------------ LUMScape (isometric campus)
  (function () {
    var svg = document.getElementById('map-sim');
    if (!svg) return;
    var OX = 135, OY = 44, S = 14;
    function P(gx, gy, z) {
      return [OX + (gx - gy) * S * 0.866, OY + (gx + gy) * S * 0.5 - (z || 0) * S * 0.8];
    }
    function poly(g, pts, cls) {
      return mk(g, 'polygon', { points: pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '),
        class: cls });
    }
    var root = mk(svg, 'g', {});
    poly(root, [P(0, 0), P(8, 0), P(8, 8), P(0, 8)], 'ls-ground');
    [[[4, 0], [4, 8]], [[0, 4], [8, 4]]].forEach(function (l) {
      var a = P(l[0][0], l[0][1]), b = P(l[1][0], l[1][1]);
      mk(root, 'line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'ls-walk' });
    });
    var nodesXY = { F1: [4, 1.3], F2: [1.4, 4], F3: [6.6, 4], F4: [4, 6.7], C: [4, 4] };
    var rings = {};
    Object.keys(nodesXY).forEach(function (k) {
      if (k === 'C') return;
      var p = P(nodesXY[k][0], nodesXY[k][1]);
      mk(root, 'ellipse', { cx: p[0], cy: p[1], rx: 6, ry: 3.4, class: 'ls-node' });
      rings[k] = mk(root, 'ellipse', { cx: p[0], cy: p[1], rx: 6, ry: 3.4, class: 'ls-ring' });
    });
    var blds = [[0.8, 0.8, 2.4, 2.2, 2.8], [5, 0.8, 2.2, 1.6, 1.8], [5.2, 2.6, 0.9, 0.8, 0.7],
      [0.8, 5, 2, 2.2, 1.2], [5, 5, 2.2, 2.2, 0.9]];
    var tops = [];
    var marker = mk(root, 'g', {});
    mk(marker, 'ellipse', { cx: 0, cy: 0, rx: 4.5, ry: 2.2, class: 'ls-shadow' });
    mk(marker, 'path', { d: 'M0 -1 C -6 -8 -6 -16 0 -16 C 6 -16 6 -8 0 -1 z', class: 'ls-pin' });
    mk(marker, 'circle', { cx: 0, cy: -11, r: 2, class: 'ls-pin-dot' });
    var badge = mk(svg, 'g', {});
    var bp = P(2, 1.9, 2.8);
    mk(badge, 'rect', { x: bp[0] - 18, y: bp[1] - 26, width: 36, height: 14, rx: 7, class: 'ls-badge' });
    txt(badge, bp[0], bp[1] - 16, 'event', 'ls-badge-t');
    mk(badge, 'line', { x1: bp[0], y1: bp[1] - 12, x2: bp[0], y2: bp[1] - 4, class: 'ls-badge-l' });

    // draw back-to-front; the marker's layer is re-inserted each frame by depth
    var layer = [];
    blds.forEach(function (b) {
      var g = mk(root, 'g', {});
      var x = b[0], y = b[1], w = b[2], d = b[3], h = b[4];
      poly(g, [P(x, y + d, 0), P(x + w, y + d, 0), P(x + w, y + d, h), P(x, y + d, h)], 'ls-l');
      poly(g, [P(x + w, y, 0), P(x + w, y + d, 0), P(x + w, y + d, h), P(x + w, y, h)], 'ls-r');
      tops.push(poly(g, [P(x, y, h), P(x + w, y, h), P(x + w, y + d, h), P(x, y + d, h)], 'ls-top'));
      layer.push({ g: g, depth: x + w / 2 + y + d / 2 });
    });
    layer.sort(function (a, b) { return a.depth - b.depth; });

    function route(pts, p) {
      var L = [], tot = 0;
      for (var i = 1; i < pts.length; i++) { var l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(l); tot += l; }
      var dist = p * tot;
      for (var j = 0; j < L.length; j++) {
        if (dist <= L[j] || j === L.length - 1) {
          var q = L[j] ? dist / L[j] : 0;
          return [lerp(pts[j][0], pts[j + 1][0], q), lerp(pts[j][1], pts[j + 1][1], q)];
        }
        dist -= L[j];
      }
    }
    var N = nodesXY;
    run(svg, 9, function (t) {
      var pos, op = 1;
      if (t < 2.6) pos = route([N.F1, N.C, N.F3], ease(seg(t, 0, 2.6)));
      else if (t < 3.3) { pos = N.F3; op = 1 - seg(t, 3.0, 3.3); }
      else if (t < 6.4) { pos = N.F2; op = seg(t, 3.4, 3.7); }
      else pos = route([N.F2, N.C, N.F1], ease(seg(t, 6.4, 8.8)));
      if (t >= 3.3 && t < 3.4) op = 0;
      var sp = P(pos[0], pos[1]);
      marker.setAttribute('transform', 'translate(' + sp[0].toFixed(1) + ' ' + sp[1].toFixed(1) + ')');
      marker.style.opacity = op;
      // keep the marker hidden behind buildings that are in front of it
      var md = pos[0] + pos[1];
      root.appendChild(marker);
      layer.forEach(function (l) { if (l.depth > md) root.appendChild(l.g); else root.insertBefore(l.g, marker); });
      Object.keys(rings).forEach(function (k) {
        var on = (k === 'F3' && t > 2.9 && t < 3.5) || (k === 'F2' && t > 3.3 && t < 3.9);
        rings[k].style.opacity = on ? 1 : 0;
      });
      var ev = seg(t, 3.9, 4.3) * (1 - seg(t, 6.2, 6.6));
      badge.style.opacity = ev;
      badge.setAttribute('transform', 'translate(0 ' + (1 - ev) * 4 + ')');
      tops[0].setAttribute('class', ev > 0.05 ? 'ls-top ls-event' : 'ls-top');
    }, 4.8);
  })();
})();
