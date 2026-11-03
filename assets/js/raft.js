// Raft cluster animation: heartbeats, log replication, leader failure and re-election.
// A small simulation, not a canned loop. Pauses when off-screen; static under reduced motion.
(function () {
  var svg = document.getElementById('raft-sim');
  if (!svg) return;

  var NS = 'http://www.w3.org/2000/svg';
  var N = 5, CX = 135, CY = 108, R = 70, NODE_R = 15, LOG_MAX = 5;
  var HB = 1.3, FLIGHT = 0.7, CRASH_AFTER = 7, RECOVER_AFTER = 3.5;

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    (parent || svg).appendChild(e);
    return e;
  }

  // ---------- layout ----------
  var gLinks = el('g', {});
  var gPackets = el('g', {});
  var gNodes = el('g', {});
  var status = el('text', { x: CX, y: 222, 'text-anchor': 'middle', class: 'rf-status' });

  var nodes = [];
  for (var i = 0; i < N; i++) {
    var a = (-90 + i * 72) * Math.PI / 180;
    var x = CX + R * Math.cos(a), y = CY + R * Math.sin(a);
    nodes.push({ id: i, x: x, y: y });
  }
  for (var p = 0; p < N; p++)
    for (var q = p + 1; q < N; q++)
      el('line', { x1: nodes[p].x, y1: nodes[p].y, x2: nodes[q].x, y2: nodes[q].y, class: 'rf-link' }, gLinks);

  var RING = 2 * Math.PI * (NODE_R + 4);
  nodes.forEach(function (n) {
    var g = el('g', {}, gNodes);
    n.ring = el('circle', { cx: n.x, cy: n.y, r: NODE_R + 4, class: 'rf-timer',
      'stroke-dasharray': RING, 'stroke-dashoffset': RING,
      transform: 'rotate(-90 ' + n.x + ' ' + n.y + ')' }, g);
    n.circle = el('circle', { cx: n.x, cy: n.y, r: NODE_R, class: 'rf-node' }, g);
    n.label = el('text', { x: n.x, y: n.y + 3.5, 'text-anchor': 'middle', class: 'rf-label' }, g);
    n.label.textContent = 'S' + (n.id + 1);
    // log strip on the server's outer side: above S1, beside S2/S5, below S3/S4
    n.cells = [];
    var w = 6, gap = 2, total = LOG_MAX * w + (LOG_MAX - 1) * gap, x0, y0;
    if (n.id === 0) { x0 = n.x - total / 2; y0 = n.y - NODE_R - 16; }
    else if (n.id === 1) { x0 = n.x + NODE_R + 10; y0 = n.y - 3; }
    else if (n.id === 4) { x0 = n.x - NODE_R - 10 - total; y0 = n.y - 3; }
    else { x0 = n.x - total / 2; y0 = n.y + NODE_R + 10; }
    for (var c = 0; c < LOG_MAX; c++)
      n.cells.push(el('rect', { x: x0 + c * (w + gap), y: y0, width: w, height: 6, rx: 1.5,
        class: 'rf-cell' }, g));
  });

  // ---------- simulation state ----------
  var now = 0, packets = [], cycleStart = 0, recoverAt = -1, resetAt = -1;

  // Randomised election timeouts, spread further apart than a message's flight time
  // so one follower usually times out first and wins (as Raft intends).
  var slots = [0, 1, 2, 3, 4];
  function shuffle() {
    for (var i = slots.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = slots[i]; slots[i] = slots[j]; slots[j] = t;
    }
  }
  function rndTimeout(n) { return 2.2 + slots[n.id] * 0.9 + Math.random() * 0.2; }

  function init(leaderId, term) {
    shuffle();
    nodes.forEach(function (n) {
      n.role = n.id === leaderId ? 'leader' : 'follower';
      n.term = term; n.log = 1; n.commit = 1; n.crashed = false;
      n.lastHeard = now; n.timeout = rndTimeout(n); n.votes = 0; n.votedFor = -1;
    });
    var L = nodes[leaderId];
    L.match = nodes.map(function () { return 1; });
    L.nextHb = now + 0.3; L.hbCount = 0;
    cycleStart = now; recoverAt = -1; resetAt = -1;
  }

  function leader() {
    for (var i = 0; i < N; i++) if (nodes[i].role === 'leader' && !nodes[i].crashed) return nodes[i];
    return null;
  }

  function send(from, to, type, data) {
    packets.push({ from: from, to: to, type: type, data: data || {}, t0: now });
  }

  function deliver(pk) {
    var n = nodes[pk.to], d = pk.data;
    if (n.crashed) return;
    if (pk.type === 'hb' || pk.type === 'entry') {
      if (d.term < n.term) return;
      n.term = d.term; n.role = 'follower'; n.lastHeard = now; n.votes = 0;
      if (pk.type === 'entry' && d.idx === n.log + 1) n.log = d.idx;
      if (pk.type === 'entry' && d.idx <= n.log) send(n.id, pk.from, 'ack', { idx: d.idx, term: n.term });
      n.commit = Math.min(d.commit, n.log);
    } else if (pk.type === 'ack') {
      if (n.role !== 'leader') return;
      n.match[pk.from] = Math.max(n.match[pk.from], d.idx);
      for (var k = n.log; k > n.commit; k--) {
        var cnt = 0;
        for (var j = 0; j < N; j++) if (j === n.id || n.match[j] >= k) cnt++;
        if (cnt >= 3) { n.commit = k; break; }
      }
    } else if (pk.type === 'req') {
      if (d.term > n.term) { n.term = d.term; n.role = 'follower'; n.votedFor = -1; }
      if (d.term === n.term && (n.votedFor === -1 || n.votedFor === pk.from) && n.role !== 'leader') {
        n.votedFor = pk.from; n.lastHeard = now;
        send(n.id, pk.from, 'vote', { term: d.term });
      }
    } else if (pk.type === 'vote') {
      if (n.role !== 'candidate' || d.term !== n.term) return;
      n.votes++;
      if (n.votes >= 3) {
        n.role = 'leader';
        n.match = nodes.map(function (m) { return Math.min(m.log, n.log); });
        n.match[n.id] = n.log;
        n.nextHb = now; n.hbCount = 0;
        setStatus('S' + (n.id + 1) + ' wins the vote · leader for term ' + n.term);
      }
    }
  }

  var statusText = '', statusUntil = 0;
  function setStatus(t, hold) { statusText = t; statusUntil = now + (hold || 2.2); }

  function step(dt) {
    now += dt;

    // packets in flight
    for (var i = packets.length - 1; i >= 0; i--) {
      if (now - packets[i].t0 >= FLIGHT) { var pk = packets.splice(i, 1)[0]; deliver(pk); }
    }

    var L = leader();

    // leader: heartbeats / entries
    if (L && now >= L.nextHb) {
      L.hbCount++;
      if (L.hbCount % 2 === 0 && L.log < LOG_MAX) { L.log++; L.match[L.id] = L.log; }
      nodes.forEach(function (f) {
        if (f.id === L.id) return;
        var idx = L.match[f.id] + 1;
        if (idx <= L.log) send(L.id, f.id, 'entry', { term: L.term, idx: idx, commit: L.commit });
        else send(L.id, f.id, 'hb', { term: L.term, commit: L.commit });
      });
      L.nextHb = now + HB;
      if (now - statusUntil > 0) setStatus('Term ' + L.term + ' · S' + (L.id + 1) + ' is leader · replicating log', 0.1);
    }

    // scripted failure: crash the leader once per cycle
    if (L && recoverAt < 0 && resetAt < 0 && now - cycleStart > CRASH_AFTER && L.commit >= 3) {
      L.crashed = true; L.role = 'down';
      shuffle();
      nodes.forEach(function (n) { if (!n.crashed) n.timeout = rndTimeout(n); });
      recoverAt = now + RECOVER_AFTER + 2.5;
      setStatus('S' + (L.id + 1) + ' goes down · heartbeats stop', 2.5);
    }

    // follower / candidate timers
    nodes.forEach(function (n) {
      if (n.crashed || n.role === 'leader') return;
      if (now - n.lastHeard > n.timeout) {
        n.role = 'candidate'; n.term++; n.votes = 1; n.votedFor = n.id;
        n.lastHeard = now; n.timeout = rndTimeout(n);
        nodes.forEach(function (m) { if (m.id !== n.id) send(n.id, m.id, 'req', { term: n.term }); });
        setStatus('S' + (n.id + 1) + ' times out · requests votes for term ' + n.term, 2.5);
      }
    });

    // recovery of the old leader
    if (recoverAt > 0 && now >= recoverAt) {
      nodes.forEach(function (n) {
        if (n.crashed) {
          n.crashed = false; n.role = 'follower'; n.lastHeard = now; n.timeout = 4;
          setStatus('S' + (n.id + 1) + ' recovers as a follower and catches up', 2.5);
        }
      });
      recoverAt = -1; resetAt = 0;
    }

    // once everyone has the full committed log, start a new cycle
    L = leader();
    if (L && resetAt === 0) {
      var done = nodes.every(function (n) { return !n.crashed && n.log === LOG_MAX && n.commit === LOG_MAX; });
      if (done) resetAt = now + 2.5;
    }
    if (L && resetAt > 0 && now >= resetAt) { packets = []; init(L.id, L.term); }
  }

  // ---------- drawing ----------
  var pkEls = [];
  function draw() {
    nodes.forEach(function (n) {
      n.circle.setAttribute('class', 'rf-node rf-' + n.role);
      n.label.setAttribute('class', 'rf-label rf-label-' + n.role);
      var showTimer = !n.crashed && n.role !== 'leader';
      var frac = showTimer ? Math.min(1, (now - n.lastHeard) / n.timeout) : 0;
      n.ring.setAttribute('stroke-dashoffset', RING * (1 - frac));
      n.ring.style.opacity = showTimer ? 1 : 0;
      n.cells.forEach(function (c, k) {
        var cls = 'rf-cell';
        if (k < n.commit) cls += ' rf-committed';
        else if (k < n.log) cls += ' rf-pending';
        if (n.crashed) cls += ' rf-dim';
        c.setAttribute('class', cls);
      });
    });

    while (pkEls.length < packets.length) pkEls.push(el('circle', { r: 3.5 }, gPackets));
    pkEls.forEach(function (e, k) {
      var pk = packets[k];
      if (!pk) { e.style.display = 'none'; return; }
      e.style.display = '';
      var a = nodes[pk.from], b = nodes[pk.to];
      var t = Math.min(1, (now - pk.t0) / FLIGHT);
      var dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
      var sx = a.x + dx / len * NODE_R, sy = a.y + dy / len * NODE_R;
      var ex = b.x - dx / len * NODE_R, ey = b.y - dy / len * NODE_R;
      e.setAttribute('cx', sx + (ex - sx) * t);
      e.setAttribute('cy', sy + (ey - sy) * t);
      e.setAttribute('r', pk.type === 'ack' || pk.type === 'vote' ? 2.5 : 3.5);
      e.setAttribute('class', 'rf-pk rf-pk-' + pk.type + (nodes[pk.to].crashed ? ' rf-dim' : ''));
    });

    status.textContent = statusText;
  }

  // ---------- run ----------
  init(0, 1);
  setStatus('Term 1 · S1 is leader · replicating log', 0.1);

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    for (var s = 0; s < 120; s++) step(0.05);
    draw();
    return;
  }

  var visible = true, last = null;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; last = null; }).observe(svg);
  }
  function frame(ts) {
    if (visible && !document.hidden) {
      if (last !== null) step(Math.min(0.05, (ts - last) / 1000));
      last = ts;
      draw();
    } else {
      last = null;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
