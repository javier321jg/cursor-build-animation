/*! cursor-build.js — animación de cursores colaborativos que "arman" una interfaz.
 *  Sin dependencias. Licencia MIT.
 *
 *  Uso mínimo:
 *    <div id="ui" style="width:1920px;height:1080px"> ...UI anotada con data-b... </div>
 *    <script src="cursor-build.js"></script>
 *    <script>CursorBuild.mount('#ui', { count: 8 })</script>
 *
 *  Vocabulario de atributos (ver SKILL.md):
 *    data-b            marca el elemento como "pieza" que un cursor construye
 *    data-k            slide | rise | pop (cajas)  ·  line | bar | prog | arc | fade (gráficos)
 *    data-s            orden/tiempo de inicio (segundos aprox.; los menores se construyen antes)
 *    data-ax, data-ay  desplazamiento inicial (px) que un cursor "corrige" en data-at (segundos)
 *    data-sel          al soltar, muestra manijas y guías de alineación
 *    data-len          (arc) longitud del arco, 0–100
 *    data-count        (texto) valor final de un contador animado; con data-dec, data-pre, data-suf
 */
(function (global) {
  'use strict';

  var COLORS = ['#4C8DFF', '#9B7BFF', '#3DD6F5', '#FF5CA8', '#FFB547', '#4ADE9B', '#FF7A59', '#7FAEFF', '#E07BFF', '#5CE1E6', '#FFD15C', '#C3F53D'];
  var DARK_TXT = { '#3DD6F5': 1, '#FFB547': 1, '#4ADE9B': 1, '#5CE1E6': 1, '#FFD15C': 1, '#C3F53D': 1 };
  var NAMES = ['Ana', 'Kenji', 'Lucía', 'Omar', 'Priya', 'Mateo', 'Sofía', 'Lars', 'Zoe', 'Diego', 'Mei', 'Iván'];
  var BOXK = { slide: 1, rise: 1, pop: 1 };
  var I18N = {
    es: { phases: ['01 Lienzo vacío', '02 Estructura', '03 Ensamblaje', '04 Ajustes finales', '05 Revelación'], loop: 'Bucle', paths: 'Trayectorias', cursors: ' cursores', play: 'Reproducir / pausar', restart: 'Reiniciar' },
    en: { phases: ['01 Empty canvas', '02 Structure', '03 Assembly', '04 Final tweaks', '05 Reveal'], loop: 'Loop', paths: 'Paths', cursors: ' cursors', play: 'Play / pause', restart: 'Restart' }
  };
  var DEFAULTS = {
    width: 1920, height: 1080,
    count: 8, speed: 1, loop: true, paths: false, labels: true, cameraMotion: true,
    autoplay: true, hud: true, lang: 'es', query: true,
    names: NAMES, colors: COLORS, phases: null,
    background: '#05070B', stageBackground: '#080A0F', grid: true
  };

  // ───────── utilidades ─────────
  function cl(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function eOut(p) { return 1 - Math.pow(1 - p, 3); }
  function eIO(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  function eBack(p) { var c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); }
  // hash determinista → [0,1): mismo resultado en cada reproducción
  function H(a, b) {
    var x = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x9e37, 0x165667b1);
    x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d); x = Math.imul(x ^ (x >>> 12), 0x297a2d39); x ^= x >>> 15;
    return (x >>> 0) / 4294967296;
  }
  function el(tag, cls, css) { var n = document.createElement(tag); if (cls) n.className = cls; if (css) n.style.cssText = css; return n; }

  var CSS = [
    '.cb-root{position:fixed;inset:0;overflow:hidden;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#E8EAF0}',
    '.cb-stage{position:absolute;left:0;top:0;overflow:hidden;transform-origin:0 0}',
    '.cb-grid{position:absolute;inset:0;opacity:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:40px 40px;background-position:-1px -1px}',
    '.cb-world{position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform}',
    '.cb-canvas{position:absolute;left:0;top:0;pointer-events:none}',
    '.cb-hud{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);display:flex;align-items:center;gap:12px;padding:6px 12px;border-radius:12px;background:rgba(14,17,26,.88);border:1px solid rgba(255,255,255,.09);backdrop-filter:blur(14px);font-size:12px;white-space:nowrap;z-index:5}',
    '.cb-hud button{all:unset;cursor:pointer;padding:4px 9px;border-radius:7px;color:#8A91A3;font:500 12px system-ui,sans-serif}',
    '.cb-hud button:hover{color:#fff}.cb-hud button.on{background:rgba(255,255,255,.12);color:#fff}',
    '.cb-hud .cb-sep{width:1px;height:16px;background:rgba(255,255,255,.1)}',
    '.cb-bar{position:relative;width:240px;height:6px;border-radius:3px;background:rgba(255,255,255,.1);cursor:pointer}',
    '.cb-prog{height:100%;width:0;border-radius:3px;background:linear-gradient(90deg,#4C8DFF,#9B7BFF)}',
    '.cb-time{font:500 11px ui-monospace,Menlo,monospace;color:#8A91A3;min-width:44px;text-align:right}',
    '.cb-phase{font:500 12px system-ui,sans-serif;color:#E8EAF0;min-width:132px}',
    '.cb-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:middle}'
  ].join('\n');

  // ───────── autoAnnotate: anota HTML ajeno con data-b / data-k / data-s ─────────
  var DEFAULT_RULES = [
    { sel: 'aside, nav, header, [data-cb~="slide"]', k: 'slide', at: 2.0, step: 0.45 },
    { sel: 'section, article, [class*="card"], [class*="panel"], [data-cb~="rise"]', k: 'rise', at: 3.8, step: 0.4 },
    { sel: 'button, [class*="btn"], [class*="chip"], [class*="badge"], [class*="pill"], input, select, img, [data-cb~="pop"]', k: 'pop', at: 5.2, step: 0.12 },
    { sel: 'svg path[data-cb~="line"], svg polyline[data-cb~="line"]', k: 'line', at: 6.0, step: 0.5 },
    { sel: '[class*="bar"]:not([class*="progress"]):not([class*="sidebar"]):not([class*="toolbar"]):not([class*="navbar"]), [data-cb~="bar"]', k: 'bar', at: 7.0, step: 0.09 },
    { sel: '[class*="progress"] > *, [role="progressbar"] > *, [data-cb~="prog"]', k: 'prog', at: 9.6, step: 0.3 },
    { sel: 'tbody tr, li, [data-cb~="fade"]', k: 'fade', at: 8.2, step: 0.16 }
  ];

  function autoAnnotate(root, opts) {
    opts = opts || {};
    var rules = opts.rules || DEFAULT_RULES, max = opts.max || 140, n = 0;
    root = typeof root === 'string' ? document.querySelector(root) : root;
    if (!root) return 0;
    rules.forEach(function (r) {
      var i = 0;
      Array.prototype.forEach.call(root.querySelectorAll(r.sel), function (node) {
        if (n >= max || node.hasAttribute('data-b') || node.closest('[data-cb="skip"]')) return;
        node.setAttribute('data-b', '1');
        node.setAttribute('data-k', r.k);
        node.setAttribute('data-s', (r.at + i * r.step).toFixed(2));
        if (r.k === 'rise' || r.k === 'slide') node.setAttribute('data-sel', '1');
        i++; n++;
      });
    });
    if (opts.counters !== false) {
      // textos puramente numéricos → contadores
      Array.prototype.forEach.call(root.querySelectorAll('[data-cb~="count"]'), function (node) {
        if (node.hasAttribute('data-count')) return;
        var m = /^([^\d-]*)(-?[\d,]+(?:\.(\d+))?)(.*)$/.exec(node.textContent.trim());
        if (!m) return;
        node.setAttribute('data-count', m[2].replace(/,/g, ''));
        node.setAttribute('data-dec', m[3] ? m[3].length : 0);
        node.setAttribute('data-pre', m[1]); node.setAttribute('data-suf', m[4]);
      });
    }
    return n;
  }

  // ───────── motor ─────────
  function CB(ui, opts) {
    var o = this.o = Object.assign({}, DEFAULTS, opts || {});
    if (o.query) readQuery(o);
    this.tx = I18N[o.lang] || I18N.es;
    this.phases = o.phases || this.tx.phases;
    this.W = o.width; this.Hh = o.height;
    this.state = { playing: !!o.autoplay, speed: o.speed, count: o.count, loop: !!o.loop, paths: !!o.paths, phase: 0 };
    this.t = o.t0 || 0; this.E = []; this.counters = []; this.cur = []; this.L = 10; this.END = 14;
    this.CAM = [[0, 1, this.W / 2, this.Hh / 2]];
    this.build(ui);
  }

  function readQuery(o) {
    try {
      var q = new URLSearchParams(location.search), num = function (k) { return q.has(k) ? parseFloat(q.get(k)) : undefined; };
      if (q.get('hud') === '0') o.hud = false;
      if (num('count')) o.count = num('count');
      if (num('speed')) o.speed = num('speed');
      if (q.get('loop') === '0') o.loop = false;
      if (q.get('paths') === '1') o.paths = true;
      if (q.get('labels') === '0') o.labels = false;
      if (q.get('lang')) o.lang = q.get('lang');
      if (q.has('t')) { o.t0 = num('t'); o.autoplay = false; }
    } catch (e) { /* sin query */ }
  }

  var P = CB.prototype;

  P.build = function (ui) {
    var self = this, W = this.W, Hh = this.Hh, o = this.o;
    if (!document.getElementById('cb-style')) { var st = el('style'); st.id = 'cb-style'; st.textContent = CSS; document.head.appendChild(st); }
    var root = this.root = el('div', 'cb-root', 'background:' + o.background);
    var stage = this.stage = el('div', 'cb-stage', 'width:' + W + 'px;height:' + Hh + 'px;background:' + o.stageBackground);
    var grid = this.grid = el('div', 'cb-grid'); if (!o.grid) grid.style.display = 'none';
    var world = this.world = el('div', 'cb-world', 'width:' + W + 'px;height:' + Hh + 'px');
    var cv = this.cv = el('canvas', 'cb-canvas', 'width:' + W + 'px;height:' + Hh + 'px');
    ui.parentNode.insertBefore(root, ui);
    ui.style.position = 'absolute'; ui.style.left = '0'; ui.style.top = '0'; ui.style.width = W + 'px'; ui.style.height = Hh + 'px';
    world.appendChild(ui); stage.appendChild(grid); stage.appendChild(world); stage.appendChild(cv); root.appendChild(stage);
    this.ui = ui;
    if (o.hud) this.buildHUD(); else this.hud = null;
    this.makeSprites();
    this.collect();
    this.onResize = function () { self.resize(); };
    window.addEventListener('resize', this.onResize);
    this.onKey = function (e) {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); self.toggle(); }
      else if (e.key === 'r' || e.key === 'R') self.restart();
      else if (e.key === 'ArrowRight') self.seek(self.t + 1);
      else if (e.key === 'ArrowLeft') self.seek(self.t - 1);
    };
    window.addEventListener('keydown', this.onKey);
    this.resize();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { self.measure(); });
    setTimeout(function () { self.measure(); }, 600);
    this.last = performance.now();
    var tick = function (now) {
      self.raf = requestAnimationFrame(tick);
      try { self.frame(now); } catch (err) { if (!self.warned) { self.warned = 1; console.warn('cursor-build frame failed: ' + (err && err.stack || err)); } }
    };
    this.raf = requestAnimationFrame(tick);
  };

  P.destroy = function () {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKey);
  };

  P.buildHUD = function () {
    var self = this, s = this.state, tx = this.tx;
    var hud = this.hud = el('div', 'cb-hud');
    var bPlay = el('button'); bPlay.title = tx.play; bPlay.onclick = function () { self.toggle(); };
    var bRe = el('button'); bRe.textContent = '↺'; bRe.title = tx.restart; bRe.onclick = function () { self.restart(); };
    var bar = el('div', 'cb-bar'), prog = el('div', 'cb-prog'); bar.appendChild(prog);
    bar.onclick = function (ev) { var r = bar.getBoundingClientRect(); self.seek(cl((ev.clientX - r.left) / r.width) * self.END); };
    var time = el('span', 'cb-time'), phase = el('span', 'cb-phase');
    function group(vals, cur, label, fn) {
      var wrap = el('span'), btns = vals.map(function (v) {
        var b = el('button'); b.textContent = label(v); b.onclick = function () { fn(v); sync(); }; b._v = v; wrap.appendChild(b); return b;
      });
      wrap._sync = function () { btns.forEach(function (b) { b.classList.toggle('on', cur() === b._v); }); };
      return wrap;
    }
    var gSpeed = group([0.5, 1, 2], function () { return s.speed; }, function (v) { return v + '×'; }, function (v) { s.speed = v; });
    var gCount = group([4, 8, 12], function () { return s.count; }, String, function (v) { self.setCount(v); });
    var tLoop = el('button'), tPaths = el('button');
    tLoop.onclick = function () { s.loop = !s.loop; sync(); }; tPaths.onclick = function () { s.paths = !s.paths; sync(); };
    function sep() { return el('span', 'cb-sep'); }
    [bPlay, bRe, bar, time, phase, sep(), gSpeed, sep(), gCount, sep(), tLoop, tPaths].forEach(function (n) { hud.appendChild(n); });
    function sync() {
      bPlay.textContent = s.playing ? '❚❚' : '▶';
      gSpeed._sync(); gCount._sync();
      tLoop.innerHTML = '<i class="cb-dot" style="background:' + (s.loop ? '#4C8DFF' : 'rgba(255,255,255,.18)') + '"></i>' + tx.loop;
      tPaths.innerHTML = '<i class="cb-dot" style="background:' + (s.paths ? '#9B7BFF' : 'rgba(255,255,255,.18)') + '"></i>' + tx.paths;
    }
    this.hudRefs = { prog: prog, time: time, phase: phase, sync: sync };
    sync(); this.root.appendChild(hud);
  };

  P.makeSprites = function () {
    var pts = [[0, 0], [0, 16], [4.4, 12.3], [7.2, 18.6], [9.9, 17.4], [7.2, 11.3], [12.8, 11.3]], S = 4, Pd = 3;
    this.sprites = this.o.colors.map(function (c) {
      var cv = document.createElement('canvas'); cv.width = (14 + Pd * 2) * S; cv.height = (20 + Pd * 2) * S;
      var g = cv.getContext('2d'); g.scale(S, S); g.translate(Pd, Pd);
      g.beginPath(); pts.forEach(function (p, i) { i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }); g.closePath();
      g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 3 * S; g.shadowOffsetY = S;
      g.fillStyle = c; g.fill(); g.shadowColor = 'transparent';
      g.lineJoin = 'round'; g.lineWidth = 1.3; g.strokeStyle = '#FFFFFF'; g.stroke();
      return cv;
    });
  };

  P.collect = function () {
    var world = this.world, nodes = [].slice.call(world.querySelectorAll('[data-b]')), idx = new Map();
    this.E = nodes.map(function (n, i) {
      idx.set(n, i);
      var g = function (k, d) { var v = n.getAttribute('data-' + k); return v == null ? d : parseFloat(v); };
      var par = n.parentElement && n.parentElement.closest('[data-b]'), k = n.getAttribute('data-k') || 'pop';
      if (k === 'line') { n.setAttribute('pathLength', '1'); n.style.strokeDasharray = '1'; }
      if (k === 'arc') n.setAttribute('pathLength', '100');
      return { n: n, k: k, s: g('s', 1 + i * 0.1), ax: g('ax', 0), ay: g('ay', 0), at: g('at', 0), sel: n.hasAttribute('data-sel'), len: g('len', 0),
        parent: par ? idx.get(par) : -1, tag: n.tagName.toLowerCase(), ox: 0, oy: 0, x: 0, y: 0, rw: 0, rh: 0, lt: null, lo: null };
    });
    this.counters = [].slice.call(world.querySelectorAll('[data-count]')).map(function (n) {
      var own = n.closest('[data-b]');
      return { n: n, to: parseFloat(n.getAttribute('data-count')), dec: +n.getAttribute('data-dec') || 0, pre: n.getAttribute('data-pre') || '', suf: n.getAttribute('data-suf') || '',
        owner: own ? idx.get(own) : -1, cs0: parseFloat(n.getAttribute('data-cs')) || 0, cs: 0, last: '' };
    });
  };

  P.measure = function () {
    var world = this.world, W = this.W; if (!this.E.length) this.collect();
    var prev = world.style.transform; world.style.transform = 'none';
    this.E.forEach(function (e) { e.n.style.transform = ''; e.lt = null; });
    var b = world.getBoundingClientRect(), sc = b.width / W || 1;
    this.E.forEach(function (e) {
      var r = e.n.getBoundingClientRect();
      e.x = (r.left - b.left) / sc; e.y = (r.top - b.top) / sc; e.rw = r.width / sc; e.rh = r.height / sc;
    });
    world.style.transform = prev;
    this.schedule();
  };

  // Reparte las piezas entre los cursores: cada pieza la toma el cursor que llegue antes.
  P.schedule = function () {
    var self = this, E = this.E, N = this.state.count, W = this.W, Hh = this.Hh, o = this.o;
    if (!E.length) return;
    var per = 2 * (W + Hh), cur = [], c;
    for (c = 0; c < N; c++) {
      var p = ((c * 0.618 + 0.13) % 1) * per, x, y;   // entran por el borde, repartidos por razón áurea
      if (p < W) { x = p; y = -50; } else if ((p -= W) < Hh) { x = W + 50; y = p; } else if ((p -= Hh) < W) { x = W - p; y = Hh + 50; } else { x = -50; y = Hh - (p - W); }
      cur.push({ id: c, free: 0.3 + c * 0.2, x: x, y: y, sx: x, sy: y, segs: [], col: c % o.colors.length, name: o.names[c % o.names.length], px: x, py: y });
    }
    var tasks = [], eff = [];
    // un hijo nunca se construye antes que su padre (aunque su data-s sea menor)
    function effKey(i) {
      if (eff[i] !== undefined) return eff[i];
      var k = E[i].s; if (E[i].parent >= 0) k = Math.max(k, effKey(E[i].parent) + 0.01);
      return (eff[i] = k);
    }
    E.forEach(function (e, i) {
      e.rel = 1e9; e.at2 = null; e.ps = 1e9; e.ds = null;
      tasks.push({ i: i, key: effKey(i), adj: false });
      if (e.at) tasks.push({ i: i, key: Math.max(e.at, effKey(i) + 0.01), adj: true });   // el ajuste va después de construir la pieza
    });
    tasks.sort(function (a, b) { return a.key - b.key; });
    function disp(i) { var dx = 0, dy = 0; for (var j = i; j >= 0; j = E[j].parent) if (E[j].at2 == null) { dx += E[j].ax; dy += E[j].ay; } return [dx, dy]; }
    tasks.forEach(function (tk) {
      var e = E[tk.i], earliest = 0.5;
      if (tk.adj) earliest = Math.max(earliest, e.rel + 0.3);
      else if (e.parent >= 0) { var pe = E[e.parent]; earliest = Math.max(earliest, (BOXK[pe.k] ? pe.rel : pe.ps) + 0.05); }
      var d = disp(tk.i), x = e.x + d[0], y = e.y + d[1], w = e.rw, h = e.rh, a, b, dur;
      if (tk.adj) { a = [x + w * 0.5, y + h * 0.4]; b = [a[0] - e.ax, a[1] - e.ay]; dur = 0.5; }
      else switch (e.k) {
        case 'line': a = [x, y + h * 0.75]; b = [x + w, y + h * 0.15]; dur = Math.min(1.4, Math.max(0.55, w / 650)); break;
        case 'bar': a = [x + w / 2, y + h]; b = [x + w / 2, y]; dur = 0.32; break;
        case 'prog': a = [x, y + h / 2]; b = [x + w, y + h / 2]; dur = 0.45; break;
        case 'arc': a = [x + w / 2, y]; b = [x + w, y + h / 2]; dur = 0.42; break;
        case 'fade': a = [x + w * 0.2, y + h / 2]; b = [x + w * 0.8, y + h / 2]; dur = 0.35; break;
        default: a = [x, y]; b = [x + w, y + h]; dur = Math.min(0.95, Math.max(0.3, 0.22 + Math.sqrt(w * h) / 900));
      }
      var best = null, bArr = 1e9, bTr = 0;
      cur.forEach(function (cc) {
        var dist = Math.hypot(a[0] - cc.x, a[1] - cc.y), tr = Math.min(0.75, Math.max(0.28, 0.24 + dist / 2400)), arr = Math.max(cc.free + tr, earliest);
        if (arr < bArr - 1e-6) { bArr = arr; best = cc; bTr = tr; }
      });
      if (!best) { best = cur[0]; bTr = 0.3; bArr = best.free + bTr; }   // salvaguarda: nunca dejar una pieza sin cursor
      var cc = best, t0 = bArr - bTr;
      cc.segs.push({ t0: t0, t1: bArr, x0: cc.x, y0: cc.y, x1: a[0], y1: a[1], drag: false, bend: (H(tk.i, cc.id) - 0.5) * 0.5 });
      var d0 = bArr + 0.07, d1 = d0 + dur;
      cc.segs.push({ t0: d0, t1: d1, x0: a[0], y0: a[1], x1: b[0], y1: b[1], drag: true, bend: 0 });
      cc.free = d1 + 0.08; cc.x = b[0]; cc.y = b[1];
      if (tk.adj) { e.at2 = d0; e.atd = dur; e.ac = cc.col; }
      else if (BOXK[e.k]) { e.ds = d0; e.rel = d1; e.bx = x; e.by = y; e.cc = cc.col; }
      else { e.ps = d0; e.pd = dur; e.rel = d1; }
    });
    var L = Math.max.apply(null, cur.map(function (c2) { return c2.free; }));
    cur.forEach(function (c2, i) {   // al terminar, cada cursor se va por donde entró
      var t0 = Math.max(c2.free + 0.15, L + 0.1 + i * 0.06);
      c2.segs.push({ t0: t0, t1: t0 + 0.9, x0: c2.x, y0: c2.y, x1: c2.sx, y1: c2.sy, drag: false, bend: 0.25, exit: true });
    });
    this.cur = cur; this.L = L; this.END = L + 4.4;
    var kf = [[0, 1, 0.5, 0.5], [L * 0.18, 1.07, 0.396, 0.370], [L * 0.5, 1.1, 0.594, 0.481], [L * 0.85, 1.07, 0.521, 0.602], [L + 0.4, 1.03, 0.5, 0.5], [L + 2.0, 0.94, 0.5, 0.5]];
    this.CAM = kf.map(function (k) { return [k[0], k[1], k[2] * W, k[3] * Hh]; });
    this.counters.forEach(function (ct) { ct.cs = ct.owner >= 0 && E[ct.owner] ? E[ct.owner].rel : ct.cs0; });
    if (this.t > this.END) this.t = this.END;
    this.draw(this.t);
  };

  P.resize = function () {
    var W = this.W, Hh = this.Hh, hudH = this.hud ? 54 : 0;
    var fit = Math.min(window.innerWidth / W, (window.innerHeight - hudH) / Hh);
    this.stage.style.transform = 'translate(' + ((window.innerWidth - W * fit) / 2).toFixed(2) + 'px,' + ((window.innerHeight - hudH - Hh * fit) / 2).toFixed(2) + 'px) scale(' + fit + ')';
    this.k = Math.max(0.5, Math.min(2, (window.devicePixelRatio || 1) * fit * 1.15));
    this.cv.width = Math.round(W * this.k); this.cv.height = Math.round(Hh * this.k);
    this.ctx = this.cv.getContext('2d');
    this.measure();
  };

  P.updateEls = function (t) {
    var E = this.E, i, e;
    for (i = 0; i < E.length; i++) {
      e = E[i];
      var st = e.n.style, dx = 0, dy = 0, sc = 1, op = 1, tr = null;
      if (BOXK[e.k]) {
        var p0 = cl((t - e.rel) / 0.35);
        op = t < e.rel ? 0 : 0.35 + 0.65 * eOut(p0); sc = 0.985 + 0.015 * eBack(p0);
      } else {
        var p = cl((t - e.ps) / e.pd), q = eIO(p);
        switch (e.k) {
          case 'line': { var v = (1 - q).toFixed(4); if (e.lt !== v) { st.strokeDashoffset = v; e.lt = v; } op = p > 0 ? 1 : 0; break; }
          case 'bar': tr = 'scaleY(' + q.toFixed(4) + ')'; op = p > 0 ? 1 : 0; break;
          case 'prog': tr = 'scaleX(' + q.toFixed(4) + ')'; break;
          case 'arc': { var v2 = (e.len * q).toFixed(2) + ' 100'; if (e.lt !== v2) { st.strokeDasharray = v2; e.lt = v2; } op = p > 0 ? 1 : 0; break; }
          case 'fade': op = q; break;
        }
      }
      if (e.ax || e.ay) { var m = e.at2 == null ? 1 : 1 - eIO(cl((t - e.at2) / e.atd)); dx += e.ax * m; dy += e.ay * m; }
      var Pn = e.parent >= 0 ? E[e.parent] : null;
      e.ox = dx + (Pn ? Pn.ox : 0); e.oy = dy + (Pn ? Pn.oy : 0);
      if (BOXK[e.k]) tr = 'translate3d(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px,0) scale(' + sc.toFixed(4) + ')';
      if (tr !== null && tr !== e.lt) { st.transform = tr; e.lt = tr; }
      var o = op.toFixed(3); if (o !== e.lo) { st.opacity = o; e.lo = o; }
    }
    var L = this.L;
    this.counters.forEach(function (c) {
      var v = c.to * (0.62 * eOut(cl((t - c.cs) / 1.2)) + 0.38 * eIO(cl((t - L - 0.4) / 1.8)));
      var s = c.pre + v.toLocaleString('en-US', { minimumFractionDigits: c.dec, maximumFractionDigits: c.dec }) + c.suf;
      if (s !== c.last) { c.n.textContent = s; c.last = s; }
    });
  };

  P.camera = function (t) {
    var s = 1, cx = this.W / 2, cy = this.Hh / 2, K = this.CAM, W = this.W, Hh = this.Hh;
    if (this.o.cameraMotion !== false) {
      var i = 0; while (i < K.length - 1 && t > K[i + 1][0]) i++;
      var A = K[i], B = K[Math.min(i + 1, K.length - 1)], q = B === A ? 1 : eIO(cl((t - A[0]) / (B[0] - A[0])));
      s = A[1] + (B[1] - A[1]) * q; cx = A[2] + (B[2] - A[2]) * q; cy = A[3] + (B[3] - A[3]) * q;
    }
    var tx = W / 2 - cx * s, ty = Hh / 2 - cy * s;
    if (s >= 1) { tx = Math.min(0, Math.max(W - W * s, tx)); ty = Math.min(0, Math.max(Hh - Hh * s, ty)); }
    this.world.style.transform = 'translate3d(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px,0) scale(' + s.toFixed(4) + ')';
  };

  P.cursorAt = function (c, t) {
    var S = c.segs, sg = null, i;
    for (i = 0; i < S.length; i++) { if (S[i].t0 <= t) sg = S[i]; else break; }
    if (!sg) return { x: c.sx, y: c.sy, a: 0, drag: false };
    var a = cl((t - S[0].t0) / 0.25);
    if (sg.exit && t >= sg.t1) a = 0;
    if (t < sg.t1) {
      var u = eIO((t - sg.t0) / (sg.t1 - sg.t0)), dx = sg.x1 - sg.x0, dy = sg.y1 - sg.y0;
      if (sg.drag) return { x: sg.x0 + dx * u, y: sg.y0 + dy * u, a: a, drag: true };
      var qx = (sg.x0 + sg.x1) / 2 - dy * sg.bend, qy = (sg.y0 + sg.y1) / 2 + dx * sg.bend, m = 1 - u;   // curva de Bézier: el cursor "viaja" en arco
      return { x: m * m * sg.x0 + 2 * m * u * qx + u * u * sg.x1, y: m * m * sg.y0 + 2 * m * u * qy + u * u * sg.y1, a: a, drag: false };
    }
    return { x: sg.x1 + Math.sin(t * 3 + c.id) * 1.5, y: sg.y1 + Math.cos(t * 2.6 + c.id * 2) * 1.5, a: a, drag: false };
  };

  P.draw = function (t) {
    if (!this.ctx || !this.E.length || !this.cur.length) return;
    var self = this, L = this.L, ctx = this.ctx, k = this.k, o = this.o, colors = o.colors, W = this.W, Hh = this.Hh;
    this.updateEls(t); this.camera(t);
    this.grid.style.opacity = (cl(t / 0.9) * (1 - 0.45 * cl((t - L) / 2))).toFixed(3);
    var f = t / L, ph = t < 0.6 ? 0 : f < 0.35 ? 1 : f < 0.75 ? 2 : f <= 1 ? 3 : 4;
    this.state.phase = ph;
    if (this.hudRefs) {
      this.hudRefs.prog.style.width = (t / this.END * 100).toFixed(2) + '%';
      this.hudRefs.time.textContent = t.toFixed(1) + ' s';
      this.hudRefs.phase.textContent = this.phases[ph] || '';
    }
    ctx.setTransform(k, 0, 0, k, 0, 0); ctx.clearRect(0, 0, W, Hh);
    this.drawOverlays(ctx, t);
    var Ps = this.cur.map(function (c) { return self.cursorAt(c, t); });
    if (this.state.paths) {
      ctx.setLineDash([4, 5]); ctx.lineWidth = 1.2;
      this.cur.forEach(function (c, i) {
        var p = Ps[i]; if (!p.a) return;
        var nx = c.segs.find(function (s) { return s.t1 > t && !s.exit; }); if (!nx) return;
        ctx.globalAlpha = 0.55; ctx.strokeStyle = colors[c.col];
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(nx.x1, nx.y1); ctx.stroke();
        ctx.beginPath(); ctx.arc(nx.x1, nx.y1, 3, 0, 6.283); ctx.fillStyle = colors[c.col]; ctx.fill();
      });
      ctx.setLineDash([]);
    }
    ctx.lineCap = 'round';
    this.cur.forEach(function (c, i) {   // estela + ondas al empezar/soltar un arrastre
      var p = Ps[i]; if (!p.a) return;
      var dx = p.x - c.px, dy = p.y - c.py;
      if (dx * dx + dy * dy > 9 && dx * dx + dy * dy < 40000) {
        ctx.globalAlpha = 0.25 * p.a; ctx.strokeStyle = colors[c.col]; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(p.x - dx * 2, p.y - dy * 2); ctx.lineTo(p.x, p.y); ctx.stroke();
      }
      c.segs.forEach(function (s) {
        if (!s.drag) return;
        [[s.t0, s.x0, s.y0], [s.t1, s.x1, s.y1]].forEach(function (z) {
          var ag = t - z[0]; if (ag < 0 || ag > 0.45) return;
          var q = ag / 0.45; ctx.globalAlpha = (1 - q) * 0.7 * p.a; ctx.strokeStyle = colors[c.col]; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(z[1], z[2], 3 + 18 * eOut(q), 0, 6.283); ctx.stroke();
        });
      });
    });
    ctx.font = '500 12px system-ui, sans-serif'; ctx.textBaseline = 'middle';
    this.cur.forEach(function (c, i) {   // cursores + etiqueta con nombre
      var p = Ps[i]; c.px = p.x; c.py = p.y; if (!p.a) return;
      var s = p.drag ? 1.15 : 1.3; ctx.globalAlpha = p.a;
      ctx.drawImage(self.sprites[c.col], p.x - 3 * s, p.y - 3 * s, 20 * s, 26 * s);
      if (o.labels !== false) {
        var col = colors[c.col], tw = ctx.measureText(c.name).width, x = p.x + 14, y = p.y + 20;
        ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, tw + 14, 20, 6) : ctx.rect(x, y, tw + 14, 20); ctx.fill();
        ctx.fillStyle = DARK_TXT[col] ? '#0A0D14' : '#FFFFFF'; ctx.fillText(c.name, x + 7, y + 10.5);
      }
    });
    ctx.globalAlpha = 1;
  };

  P.handles = function (ctx, x, y, w, h, col) {
    ctx.strokeStyle = col; ctx.lineWidth = 1.3; ctx.strokeRect(x, y, w, h);
    if (w < 40 || h < 20) return;
    ctx.fillStyle = '#FFFFFF';
    [[x, y], [x + w / 2, y], [x + w, y], [x + w, y + h / 2], [x + w, y + h], [x + w / 2, y + h], [x, y + h], [x, y + h / 2]].forEach(function (c) {
      ctx.fillRect(c[0] - 3, c[1] - 3, 6, 6); ctx.strokeRect(c[0] - 3, c[1] - 3, 6, 6);
    });
  };
  P.tag = function (ctx, x, y, txt, col) {
    var tw = ctx.measureText(txt).width;
    ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y - 22, tw + 12, 17, 4) : ctx.rect(x, y - 22, tw + 12, 17); ctx.fill();
    ctx.fillStyle = DARK_TXT[col] ? '#0A0D14' : '#FFFFFF'; ctx.fillText(txt, x + 6, y - 13);
  };
  P.guides = function (ctx, x, y, w, g) {   // líneas rosa de alineación
    if (g <= 0.01) return;
    ctx.globalAlpha = g * 0.8; ctx.strokeStyle = '#FF5CA8'; ctx.lineWidth = 1; ctx.beginPath();
    ctx.moveTo(0, y + 0.5); ctx.lineTo(this.W, y + 0.5); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, this.Hh); ctx.moveTo(x + w - 0.5, 0); ctx.lineTo(x + w - 0.5, this.Hh); ctx.stroke();
  };

  // Rectángulo de selección que crece mientras el cursor arrastra, manijas al soltar y tag de coordenadas al ajustar.
  P.drawOverlays = function (ctx, t) {
    var self = this, colors = this.o.colors, cl01 = cl;
    ctx.font = '500 10px ui-monospace, Menlo, monospace'; ctx.textBaseline = 'middle';
    this.E.forEach(function (e) {
      if (e.ds != null && t >= e.ds && t < e.rel) {
        var col = colors[e.cc % colors.length], q = eIO((t - e.ds) / (e.rel - e.ds)), w = e.rw * q, h = e.rh * q;
        ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(76,141,255,.10)'; ctx.fillRect(e.bx, e.by, w, h);
        ctx.strokeStyle = col; ctx.lineWidth = 1.3; ctx.strokeRect(e.bx, e.by, w, h);
        self.tag(ctx, e.bx, e.by, (e.tag === 'div' || e.tag === 'span' ? 'Frame' : e.tag) + ' ' + Math.round(w) + ' × ' + Math.round(h), col);
      } else if (e.ds != null && t >= e.rel && t < e.rel + 0.7) {
        var col2 = colors[e.cc % colors.length], a = 1 - cl01((t - e.rel - 0.35) / 0.35), x = e.x + e.ox, y = e.y + e.oy;
        ctx.globalAlpha = a; self.handles(ctx, x, y, e.rw, e.rh, col2);
        if (e.sel || e.rw * e.rh > 20000) self.guides(ctx, x, y, e.rw, Math.sin(cl01((t - e.rel) / 0.6) * Math.PI) * a);
      }
      if (e.at2 != null && t >= e.at2 - 0.1 && t < e.at2 + e.atd + 0.5) {
        var col3 = colors[e.ac % colors.length], a2 = 1 - cl01((t - e.at2 - e.atd - 0.2) / 0.3), x2 = e.x + e.ox, y2 = e.y + e.oy;
        ctx.globalAlpha = a2; self.handles(ctx, x2, y2, e.rw, e.rh, col3);
        ctx.globalAlpha = a2; self.tag(ctx, x2, y2, 'x ' + Math.round(x2) + '  y ' + Math.round(y2), col3);
        self.guides(ctx, e.x, e.y, e.rw, Math.sin(cl01((t - e.at2) / (e.atd + 0.3)) * Math.PI) * a2);
      }
    });
    ctx.globalAlpha = 1;
  };

  // ───────── control ─────────
  P.frame = function (now) {
    var dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    var s = this.state;
    if (s.playing) {
      this.t += dt * s.speed;
      if (this.t > this.END) { if (s.loop) this.t = 0; else { this.t = this.END; s.playing = false; this.sync(); } }
    }
    this.draw(this.t);
  };
  P.sync = function () { if (this.hudRefs) this.hudRefs.sync(); };
  P.play = function () { if (this.t >= this.END) this.t = 0; this.state.playing = true; this.sync(); };
  P.pause = function () { this.state.playing = false; this.sync(); };
  P.toggle = function () { this.state.playing ? this.pause() : this.play(); };
  P.restart = function () { this.t = 0; this.state.playing = true; this.sync(); };
  P.seek = function (t) { this.t = Math.max(0, Math.min(this.END, t)); this.draw(this.t); };   // determinista: ideal para capturar fotogramas
  P.setCount = function (n) { this.state.count = n; this.schedule(); this.t = 0; this.sync(); };
  P.setSpeed = function (v) { this.state.speed = v; this.sync(); };

  global.CursorBuild = {
    mount: function (target, opts) {
      var ui = typeof target === 'string' ? document.querySelector(target) : target;
      if (!ui) throw new Error('CursorBuild.mount: no se encontró ' + target);
      if (opts && opts.auto) autoAnnotate(ui, typeof opts.auto === 'object' ? opts.auto : undefined);
      var inst = new CB(ui, opts); global.__cb = inst; return inst;
    },
    autoAnnotate: autoAnnotate,
    DEFAULT_RULES: DEFAULT_RULES,
    COLORS: COLORS, NAMES: NAMES
  };
})(window);
