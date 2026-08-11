/* mld-type-controls — hero type tuner. Sandbox only, phones and desktop.

   A small bar pinned under the header with plus/minus steppers for the hero
   title and subtitle: size in 1px steps, weight in 100 steps across the
   variable font's range. Writes one style element with !important so it wins
   over every breakpoint rule while playing; Copy hands the numbers back for
   baking in. Body-level, mounted after load, so React's DOM is untouched. */
(function () {
  var ROWS = [
    { key: 'ts', label: 'T px', sel: 'section:has(#hero-calendly) h1', prop: 'font-size',   step: 1,    min: 24,  max: 120 },
    { key: 'tw', label: 'T wt', sel: 'section:has(#hero-calendly) h1', prop: 'font-weight', step: 100,  min: 300, max: 900 },
    { key: 'tl', label: 'T lh', sel: 'section:has(#hero-calendly) h1', prop: 'line-height', step: 0.05, min: 0.8, max: 2, dec: 2 },
    { key: 'ss', label: 'S px', sel: 'h2.mld-kicker',                  prop: 'font-size',   step: 1,    min: 14,  max: 48 },
    { key: 'sw', label: 'S wt', sel: 'h2.mld-kicker',                  prop: 'font-weight', step: 100,  min: 300, max: 900 },
    { key: 'sl', label: 'S lh', sel: 'h2.mld-kicker',                  prop: 'line-height', step: 0.05, min: 0.8, max: 2, dec: 2 }
  ];

  var CSS =
    '#mld-type{position:fixed;z-index:7;top:96px;left:50%;transform:translateX(-50%);' +
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
        else v = parseFloat(cs.lineHeight) / parseFloat(cs.fontSize);
      }
      vals[r.key] = r.dec ? Math.round(v * 100) / 100 : Math.round(v);
    });

    function apply() {
      out.textContent =
        'section:has(#hero-calendly) h1{font-size:' + vals.ts + 'px!important;font-weight:' + vals.tw +
        '!important;line-height:' + vals.tl + '!important}' +
        'h2.mld-kicker{font-size:' + vals.ss + 'px!important;font-weight:' + vals.sw +
        '!important;line-height:' + vals.sl + '!important}';
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
      var text = 'hero type: title ' + vals.ts + 'px/' + vals.tw + '/lh' + vals.tl +
                 ', subtitle ' + vals.ss + 'px/' + vals.sw + '/lh' + vals.sl;
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
