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
  var CONTROLS = [
    { k: 'brightness', label: 'Brightness',  min: 0,   max: 1,   step: 0.01, fmt: pct },
    { k: 'depth',      label: 'Depth',       min: 0.1, max: 1,   step: 0.01, fmt: pct,
      hint: 'light-to-dark range across the faces' },
    { k: 'contrast',   label: 'Contrast',    min: 0.5, max: 2.5, step: 0.05, fmt: x },
    { k: 'key',        label: 'Key light',   min: 0.2, max: 6,   step: 0.05, fmt: n2 },
    { k: 'fill',       label: 'Fill light',  min: 0,   max: 2,   step: 0.02, fmt: n2 },
    { k: 'metal',      label: 'Metallic',    min: 0,   max: 1,   step: 0.01, fmt: pct,
      hint: 'specular highlight strength' },
    { k: 'shine',      label: 'Sharpness',   min: 2,   max: 120, step: 1,    fmt: n0,
      hint: 'how tight that highlight is' },
    { k: 'angle',      label: 'Light angle', min: -180, max: 180, step: 1,   fmt: deg },
    { k: 'size',       label: 'Size',        min: 0.4, max: 2,   step: 0.01, fmt: x },
    { k: 'spin',       label: 'Spin speed',  min: 0,   max: 3,   step: 0.05, fmt: x }
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

    var defaults = JSON.parse(JSON.stringify(D.LIVE));

    CONTROLS.forEach(function (c) {
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

      box.appendChild(row);
      box.appendChild(slider);
      if (c.hint) {
        var h = document.createElement('div');
        h.className = 'hint'; h.textContent = c.hint;
        box.appendChild(h);
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
