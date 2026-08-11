/* mld-type-controls — hero type tuner. Sandbox only, phones and desktop.

   A small bar pinned under the header with plus/minus steppers for the hero
   title and subtitle: size in 1px steps, weight in 100 steps across the
   variable font's range. Writes one style element with !important so it wins
   over every breakpoint rule while playing; Copy hands the numbers back for
   baking in. Body-level, mounted after load, so React's DOM is untouched. */
(function () {
  var ROWS = [
    { key: 'ts', label: 'Title px',  sel: 'section:has(#hero-calendly) h1', prop: 'font-size',   step: 1,   min: 24,  max: 120, unit: 'px' },
    { key: 'tw', label: 'Title wt',  sel: 'section:has(#hero-calendly) h1', prop: 'font-weight', step: 100, min: 300, max: 900, unit: '' },
    { key: 'ss', label: 'Sub px',    sel: 'h2.mld-kicker',                  prop: 'font-size',   step: 1,   min: 14,  max: 48,  unit: 'px' },
    { key: 'sw', label: 'Sub wt',    sel: 'h2.mld-kicker',                  prop: 'font-weight', step: 100, min: 300, max: 900, unit: '' }
  ];

  var CSS =
    '#mld-type{position:fixed;z-index:7;top:96px;left:50%;transform:translateX(-50%);' +
    'display:flex;flex-wrap:wrap;gap:6px;justify-content:center;align-items:center;' +
    'max-width:calc(100vw - 16px);padding:8px;border-radius:var(--border-radius-m);' +
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
      var v = el ? parseFloat(getComputedStyle(el)[r.prop === 'font-size' ? 'fontSize' : 'fontWeight']) : r.min;
      vals[r.key] = Math.round(v);
    });

    function apply() {
      out.textContent =
        'section:has(#hero-calendly) h1{font-size:' + vals.ts + 'px!important;font-weight:' + vals.tw + '!important}' +
        'h2.mld-kicker{font-size:' + vals.ss + 'px!important;font-weight:' + vals.sw + '!important}';
      ROWS.forEach(function (r) {
        var s = document.querySelector('#mld-type [data-val="' + r.key + '"]');
        if (s) s.textContent = vals[r.key];
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
        vals[r.key] = Math.max(r.min, vals[r.key] - r.step); apply();
      });
      plus.addEventListener('click', function () {
        vals[r.key] = Math.min(r.max, vals[r.key] + r.step); apply();
      });
      g.appendChild(lbl); g.appendChild(minus); g.appendChild(val); g.appendChild(plus);
      bar.appendChild(g);
    });

    var cp = document.createElement('button');
    cp.type = 'button'; cp.className = 'cp'; cp.textContent = 'COPY';
    cp.addEventListener('click', function () {
      var text = 'hero type: title ' + vals.ts + 'px/' + vals.tw +
                 ', subtitle ' + vals.ss + 'px/' + vals.sw;
      var done = function () { cp.textContent = 'OK'; setTimeout(function () { cp.textContent = 'COPY'; }, 1200); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, done);
      } else done();
    });
    bar.appendChild(cp);

    document.body.appendChild(bar);
    apply();
  }

  function boot() { requestAnimationFrame(function () { requestAnimationFrame(build); }); }
  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);
  [1500, 3000, 5000, 8000].forEach(function (ms) { setTimeout(boot, ms); });
})();
