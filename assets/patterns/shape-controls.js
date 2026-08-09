/* mld-shape-controls — a tuning panel for the 3D layer. Sandbox only, desktop only.

   Writes straight into window.MLD_DURER.LIVE, which the renderer reads every
   frame, so every slider is live. Nothing here touches the dither: the two
   coverage sliders (brightness, depth) move where the solid sits in the dot
   range, which is the only way brightness works once the solid is under the
   filter — the field, the dot size and the dither maths are all untouched.

   Ambient is deliberately absent. The mesh shader normalises by (key + fill)
   after subtracting ambient, so moving it changes nothing on screen.

   Mounted after load into a body-level element, like everything else here, so
   React's DOM is never touched. */
(function () {
  /* Grouped into tabs. Ceilings are deliberately generous - the owner reached
     the top of contrast, key, fill, depth and sharpness on the first pass, so
     none of them should bottom out again. */
  var TABS = [
    { id: 'light',   label: 'Light' },
    { id: 'surface', label: 'Surface' },
    { id: 'tone',    label: 'Tone' },
    { id: 'motion',  label: 'Motion' }
  ];

  var CONTROLS = [
    { tab: 'light', k: 'key',       label: 'Key light',   min: 0.2, max: 20,  step: 0.1,  fmt: n2 },
    { tab: 'light', k: 'fill',      label: 'Fill light',  min: 0,   max: 8,   step: 0.05, fmt: n2 },
    { tab: 'light', k: 'angle',     label: 'Light angle', min: -180, max: 180, step: 1,   fmt: deg,
      hint: 'swings the key around the solid' },
    { tab: 'light', k: 'elevation', label: 'Light height', min: -90, max: 90, step: 1,    fmt: deg,
      hint: 'lifts it above or drops it below' },
    { tab: 'light', k: 'rim',       label: 'Rim light',   min: 0,   max: 1.5, step: 0.01, fmt: pct,
      hint: 'catches faces turned away from you' },

    { tab: 'surface', k: 'metal', label: 'Metallic',  min: 0, max: 2,   step: 0.01, fmt: pct,
      hint: 'tight specular flash' },
    { tab: 'surface', k: 'shine', label: 'Sharpness', min: 2, max: 400, step: 1,    fmt: n0,
      hint: 'higher is a smaller, harder hotspot' },
    { tab: 'surface', k: 'sheen', label: 'Sheen',     min: 0, max: 1.5, step: 0.01, fmt: pct,
      hint: 'broad glow near the light - the magical one' },
    { tab: 'surface', k: 'gamma', label: 'Falloff',   min: 0.3, max: 3, step: 0.02, fmt: x,
      hint: 'below 1 lifts the mid faces, above 1 crushes them' },

    { tab: 'tone', k: 'brightness', label: 'Brightness', min: 0,   max: 1,   step: 0.01, fmt: pct },
    { tab: 'tone', k: 'depth',      label: 'Depth',      min: 0.1, max: 1.8, step: 0.01, fmt: pct,
      hint: 'light-to-dark range across the faces' },
    { tab: 'tone', k: 'contrast',   label: 'Contrast',   min: 0.5, max: 6,   step: 0.05, fmt: x },

    { tab: 'motion', k: 'size',   label: 'Size',       min: 0.4, max: 2, step: 0.01, fmt: x },
    { tab: 'motion', k: 'spin',   label: 'Spin speed', min: 0,   max: 3, step: 0.05, fmt: x },
    { tab: 'motion', k: 'tumble', label: 'Tumble',     min: 0,   max: 3, step: 0.05, fmt: x,
      hint: 'how much it rolls as well as turns' }
  ];

  function pct(v) { return Math.round(v * 100) + '%'; }
  function x(v)   { return v.toFixed(2) + '×'; }
  function n2(v)  { return v.toFixed(2); }
  function n0(v)  { return String(Math.round(v)); }
  function deg(v) { return Math.round(v) + '°'; }

  var CSS =
    '#mld-ctl{position:absolute;z-index:6;width:320px;max-width:calc(100vw - 32px);' +
    'box-sizing:border-box;padding:var(--gap-s);border-radius:var(--border-radius-m);' +
    'background:var(--color-grey);color:var(--color-black);' +
    'font-family:DM Mono,monospace;font-size:12px;line-height:1.35}' +
    '#mld-ctl h3{margin:0 0 var(--gap-xs);font-family:DM Mono,monospace;font-size:12px;' +
    'letter-spacing:.12em;text-transform:uppercase;font-weight:400;opacity:.6}' +
    '#mld-ctl .row{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-top:10px}' +
    '#mld-ctl .row span:last-child{font-variant-numeric:tabular-nums;opacity:.7}' +
    '#mld-ctl input[type=range]{width:100%;margin:2px 0 0;accent-color:var(--color-accent);' +
    'height:18px;display:block}' +
    '#mld-ctl .tabs{display:flex;gap:4px;margin:0 0 2px}' +
    '#mld-ctl .tabs button{flex:1;padding:7px 4px;font-size:11px;letter-spacing:.04em;' +
    'border:1px solid transparent;background:transparent;opacity:.5}' +
    '#mld-ctl .tabs button[aria-selected="true"]{opacity:1;background:var(--color-white);' +
    'border-color:var(--color-white)}' +
    '#mld-ctl .pane{display:none}#mld-ctl .pane.on{display:block}' +
    '#mld-ctl .btns{display:flex;gap:8px;margin-top:var(--gap-s)}' +
    '#mld-ctl button{flex:1;font-family:DM Mono,monospace;font-size:12px;letter-spacing:.06em;' +
    'text-transform:uppercase;padding:10px 8px;border-radius:var(--border-radius-s);' +
    'border:1px solid var(--color-black);background:transparent;color:var(--color-black);cursor:pointer}' +
    '#mld-ctl button.primary{background:var(--color-accent);border-color:var(--color-accent);color:#fff}' +
    '#mld-ctl .hint{margin-top:2px;font-size:11px;opacity:.5}' +
    '#mld-ctl .note{margin-top:var(--gap-xs);font-size:11px;opacity:.5}' +
    '@media(max-width:991px){#mld-ctl{display:none}}';

  function build() {
    var D = window.MLD_DURER;
    if (!D || !D.LIVE) return;
    if (document.getElementById('mld-ctl')) return;
    var cta = document.getElementById('hero-calendly');
    if (!cta) return;

    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    var box = document.createElement('div');
    box.id = 'mld-ctl';
    box.innerHTML = '<h3>3D layer</h3>';

    /* A lit ball, shaded with the exact maths the solid's faces use - same
       key/fill mix, same contrast, falloff, metallic flash, sheen and rim,
       same key direction from angle and elevation. A sphere shows the whole
       ramp at once, so every slider's effect is visible here the moment it
       moves. Bright means strong light; the dither then turns that into
       dot density on the page. */
    var ball = document.createElement('canvas');
    ball.width = 120; ball.height = 120;
    ball.style.cssText = 'display:block;margin:6px auto 2px;width:120px;height:120px';
    box.appendChild(ball);
    var cap = document.createElement('div');
    cap.className = 'hint';
    cap.style.textAlign = 'center';
    cap.textContent = 'the lighting rig, on a ball - bright = lit';
    box.appendChild(cap);

    (function ballLoop() {
      var g = ball.getContext('2d');
      var img = g.createImageData(120, 120);
      var last = '';
      function frame() {
        var L = D.LIVE;
        var sig = [L.key, L.fill, L.angle, L.elevation, L.rim, L.metal,
                   L.shine, L.sheen, L.gamma, L.contrast].join(',');
        if (sig !== last) {
          last = sig;
          /* Same key rotation as the renderer: azimuth about Y, then
             elevation. Fill stays on the rig's fixed arm. */
          var a = L.angle * Math.PI / 180, e = L.elevation * Math.PI / 180;
          var kd = D.KEY_DIR;
          var ca = Math.cos(a), sa = Math.sin(a);
          var kx = kd[0] * ca - kd[2] * sa, ky0 = kd[1], kz0 = kd[0] * sa + kd[2] * ca;
          var ce = Math.cos(e), se = Math.sin(e);
          var ky = ky0 * ce - kz0 * se, kz = ky0 * se + kz0 * ce;
          var kl = Math.hypot(kx, ky, kz) || 1;
          kx /= kl; ky /= kl; kz /= kl;
          var fd = D.FILL_DIR;
          /* Half vector for the speculars, with the viewer straight on. */
          var hx = kx, hy = ky, hz = kz + 1;
          var hl = Math.hypot(hx, hy, hz) || 1;
          hx /= hl; hy /= hl; hz /= hl;
          var d = img.data, R = 56, cx = 60, cy = 60;
          for (var py = 0; py < 120; py++) {
            for (var px = 0; px < 120; px++) {
              var i = (py * 120 + px) * 4;
              var nx = (px - cx) / R, nyy = -(py - cy) / R;
              var rr = nx * nx + nyy * nyy;
              if (rr > 1) { d[i + 3] = 0; continue; }
              var nz = Math.sqrt(1 - rr);
              var k = Math.max(nx * kx + nyy * ky + nz * kz, 0);
              var f = Math.max(nx * fd[0] + nyy * fd[1] + nz * fd[2], 0);
              var dn = Math.min(Math.max((L.key * k + L.fill * f) / (L.key + L.fill), 0), 1);
              dn = Math.min(Math.max((dn - 0.5) * L.contrast + 0.5, 0), 1);
              dn = Math.pow(dn, L.gamma);
              var ndh = Math.max(nx * hx + nyy * hy + nz * hz, 0);
              dn += Math.pow(ndh, L.shine) * L.metal;
              dn += Math.pow(ndh, 4) * L.sheen;
              dn += Math.pow(1 - nz, 3) * L.rim;
              var v = Math.round(Math.min(Math.max(dn, 0), 1) * 255);
              d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
            }
          }
          g.putImageData(img, 0, 0);
        }
        if (document.getElementById('mld-ctl')) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    })();

    var defaults = JSON.parse(JSON.stringify(D.LIVE));

    var tabBar = document.createElement('div');
    tabBar.className = 'tabs';
    var panes = {};
    TABS.forEach(function (t, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = t.label;
      btn.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      btn.addEventListener('click', function () {
        TABS.forEach(function (o) {
          panes[o.id].classList.toggle('on', o.id === t.id);
        });
        [].forEach.call(tabBar.children, function (b) {
          b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
        });
      });
      tabBar.appendChild(btn);
      var pane = document.createElement('div');
      pane.className = 'pane' + (i === 0 ? ' on' : '');
      panes[t.id] = pane;
    });
    box.appendChild(tabBar);
    TABS.forEach(function (t) { box.appendChild(panes[t.id]); });

    CONTROLS.forEach(function (c) {
      var host = panes[c.tab] || box;
      var row = document.createElement('div');
      row.className = 'row';
      var name = document.createElement('span');
      name.textContent = c.label;
      var val = document.createElement('span');
      val.textContent = c.fmt(D.LIVE[c.k]);
      row.appendChild(name); row.appendChild(val);

      var slider = document.createElement('input');
      slider.type = 'range';
      slider.min = c.min; slider.max = c.max; slider.step = c.step;
      slider.value = D.LIVE[c.k];
      slider.setAttribute('aria-label', c.label);
      slider.addEventListener('input', function () {
        D.LIVE[c.k] = parseFloat(slider.value);
        val.textContent = c.fmt(D.LIVE[c.k]);
        /* brightness and depth land in the dither's coverage band, which is only
           recomputed on demand; everything else is pushed per frame. */
        if ((c.k === 'brightness' || c.k === 'depth') && window.MLD_SHAPE_REFRESH) {
          window.MLD_SHAPE_REFRESH();
        }
      });

      host.appendChild(row);
      host.appendChild(slider);
      if (c.hint) {
        var h = document.createElement('div');
        h.className = 'hint'; h.textContent = c.hint;
        host.appendChild(h);
      }
    });

    var btns = document.createElement('div');
    btns.className = 'btns';

    var copy = document.createElement('button');
    copy.className = 'primary';
    copy.type = 'button';
    copy.textContent = 'Copy params';
    copy.addEventListener('click', function () {
      var lines = ['3D layer params (' +
        (document.documentElement.classList.contains('dark') ? 'dark' : 'light') + ' mode)'];
      CONTROLS.forEach(function (c) {
        lines.push('  ' + c.label + ': ' + c.fmt(D.LIVE[c.k]) + '   [' + c.k + '=' + D.LIVE[c.k] + ']');
      });
      var text = lines.join('\n');
      var done = function () {
        copy.textContent = 'Copied';
        setTimeout(function () { copy.textContent = 'Copy params'; }, 1400);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { fallback(text, done); });
      } else fallback(text, done);
    });

    var reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = 'Reset';
    reset.addEventListener('click', function () {
      CONTROLS.forEach(function (c) { D.LIVE[c.k] = defaults[c.k]; });
      if (window.MLD_SHAPE_REFRESH) window.MLD_SHAPE_REFRESH();
      box.remove(); st.remove();
      build(); place();
    });

    btns.appendChild(copy); btns.appendChild(reset);
    box.appendChild(btns);

    var note = document.createElement('div');
    note.className = 'note';
    note.textContent = 'Sandbox only. Nothing here is on the live homepage.';
    box.appendChild(note);

    document.body.appendChild(box);
  }

  function fallback(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-1000px;left:-1000px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { /* nothing else to try */ }
    ta.remove();
  }

  function place() {
    var box = document.getElementById('mld-ctl');
    var cta = document.getElementById('hero-calendly');
    if (!box || !cta) return;
    var r = cta.getBoundingClientRect();
    box.style.left = Math.round(r.left + window.scrollX) + 'px';
    box.style.top = Math.round(r.bottom + window.scrollY + 24) + 'px';
  }

  function boot() {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        build(); place();
        window.addEventListener('resize', place, { passive: true });
        if ('ResizeObserver' in window) new ResizeObserver(place).observe(document.body);
        [200, 800, 2000].forEach(function (ms) { setTimeout(place, ms); });
      });
    });
  }
  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);
})();
