/* mld-type-controls — hero type tuner. Sandbox only, phones and desktop.

   A small bar pinned under the header with plus/minus steppers for the hero
   title and subtitle: size in 1px steps, weight in 100 steps across the
   variable font's range. Writes one style element with !important so it wins
   over every breakpoint rule while playing; Copy hands the numbers back for
   baking in. Body-level, mounted after load, so React's DOM is untouched. */
(function () {
  /* The hero is done - the panel now drives the section titles (every h2 that
     is not the hero kicker: Testimonials, Let's talk, and friends). */
  var SEL = 'h2:not(.mld-kicker)';
  var ROWS = [
    { key: 'hs', label: 'H2 px', sel: SEL, prop: 'font-size',      step: 1,    min: 16, max: 96 },
    { key: 'hw', label: 'H2 wt', sel: SEL, prop: 'font-weight',    step: 100,  min: 300, max: 900 },
    { key: 'hl', label: 'H2 lh', sel: SEL, prop: 'line-height',    step: 0.05, min: 0.8, max: 2,  dec: 2 },
    { key: 'hx', label: 'H2 ls', sel: SEL, prop: 'letter-spacing', step: 0.2,  min: -4,  max: 6,  dec: 1 }
  ];

  var CSS =
    '#mld-type{position:absolute;z-index:7;left:50%;transform:translateX(-50%);' +
    'display:flex;flex-wrap:nowrap;gap:6px;justify-content:flex-start;align-items:center;' +
    'max-width:calc(100vw - 16px);overflow-x:auto;-webkit-overflow-scrolling:touch;padding:8px;border-radius:var(--border-radius-m);' +
    'background:color-mix(in srgb,var(--color-grey) 80%,transparent);' +
    '-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);' +
    'font-family:DM Mono,monospace;font-size:12px;color:var(--color-black)}' +
    '#mld-type .grp{display:flex;align-items:center;gap:2px;background:var(--color-white);' +
    'border-radius:var(--border-radius-s);padding:2px 4px}' +
    '#mld-type .grp span.lbl{opacity:.6;margin-right:2px}' +
    '#mld-type .grp span.val{font-variant-numeric:tabular-nums;min-width:3ch;text-align:center}' +
    '#mld-type button{width:30px;height:30px;border:none;background:transparent;' +
    'color:var(--color-black);font:inherit;font-size:16px;cursor:pointer;padding:0}' +
    '#mld-type button.cp{width:auto;padding:0 8px;font-size:12px;letter-spacing:.04em;' +
    'background:var(--color-accent);color:#fff;border-radius:var(--border-radius-s);height:30px}';

  function build() {
    if (document.getElementById('mld-type')) return;
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    var out = document.createElement('style');
    out.id = 'mld-type-style';
    document.head.appendChild(out);

    var vals = {};
    ROWS.forEach(function (r) {
      var el = document.querySelector(r.sel);
      var v = r.min;
      if (el) {
        var cs = getComputedStyle(el);
        if (r.prop === 'font-size') v = parseFloat(cs.fontSize);
        else if (r.prop === 'font-weight') v = parseFloat(cs.fontWeight);
        else if (r.prop === 'letter-spacing') v = parseFloat(cs.letterSpacing) || 0;
        else v = parseFloat(cs.lineHeight) / parseFloat(cs.fontSize);
      }
      vals[r.key] = r.dec ? Math.round(v * 100) / 100 : Math.round(v);
    });

    function apply() {
      out.textContent =
        'h2:not(.mld-kicker){font-size:' + vals.hs + 'px!important;font-weight:' + vals.hw +
        '!important;line-height:' + vals.hl + '!important;letter-spacing:' + vals.hx + 'px!important}';
      ROWS.forEach(function (r) {
        var s = document.querySelector('#mld-type [data-val="' + r.key + '"]');
        if (s) s.textContent = r.dec ? vals[r.key].toFixed(r.dec) : vals[r.key];
      });
    }

    var bar = document.createElement('div');
    bar.id = 'mld-type';
    ROWS.forEach(function (r) {
      var g = document.createElement('div');
      g.className = 'grp';
      var lbl = document.createElement('span'); lbl.className = 'lbl'; lbl.textContent = r.label;
      var minus = document.createElement('button'); minus.type = 'button'; minus.textContent = '−';
      minus.setAttribute('aria-label', r.label + ' minus');
      var val = document.createElement('span'); val.className = 'val'; val.setAttribute('data-val', r.key);
      var plus = document.createElement('button'); plus.type = 'button'; plus.textContent = '+';
      plus.setAttribute('aria-label', r.label + ' plus');
      minus.addEventListener('click', function () {
        vals[r.key] = Math.max(r.min, Math.round((vals[r.key] - r.step) * 100) / 100); apply();
      });
      plus.addEventListener('click', function () {
        vals[r.key] = Math.min(r.max, Math.round((vals[r.key] + r.step) * 100) / 100); apply();
      });
      g.appendChild(lbl); g.appendChild(minus); g.appendChild(val); g.appendChild(plus);
      bar.appendChild(g);
    });

    var cp = document.createElement('button');
    cp.type = 'button'; cp.className = 'cp'; cp.textContent = 'COPY';
    cp.addEventListener('click', function () {
      var text = 'h2 titles: ' + vals.hs + 'px/' + vals.hw + '/lh' + vals.hl + '/ls' + vals.hx + 'px';
      var done = function () { cp.textContent = 'OK'; setTimeout(function () { cp.textContent = 'COPY'; }, 1200); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, done);
      } else done();
    });
    bar.appendChild(cp);

    document.body.appendChild(bar);
    function place() {
      var cta = document.getElementById('hero-calendly');
      if (!cta) { bar.style.top = '96px'; return; }
      var r = cta.getBoundingClientRect();
      bar.style.top = Math.round(r.bottom + window.scrollY + 16) + 'px';
    }
    place();
    window.addEventListener('resize', place, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(place).observe(document.body);
    [200, 800, 2000].forEach(function (ms) { setTimeout(place, ms); });
    apply();
  }

  function boot() { requestAnimationFrame(function () { requestAnimationFrame(build); }); }
  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);
  [1500, 3000, 5000, 8000].forEach(function (ms) { setTimeout(boot, ms); });
})();
