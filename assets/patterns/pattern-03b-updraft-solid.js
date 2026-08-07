/* mld-pattern-03b "Updraft Solid" (square-cell variant of 03) — dither dot field for the hero.
   Ported from the alumot-pattern handoff (preset: final): density is
   bottom-weighted and the field drifts slowly upward, so it reads as
   breathing toward the top of the block. The original ran on
   three.js purely to draw a fullscreen quad; this is the same shader on raw
   WebGL2, so the page carries no extra dependency.
   The canvas is transparent — only the ink colour is drawn — so the page
   background shows through and the pattern re-tints with the theme. */
(function () {
  var FRAG_BODY = '\nprecision highp float;\n\nuniform vec3  uColor;\nuniform vec2  uResolution;\nuniform float uTime;\nuniform float uPixelSize;\nuniform int   uShapeType;\nuniform float uDensity;\nuniform float uFbmSpeed;\nuniform float uRippleSpeed;\nuniform float uRippleThickness;\nuniform float uFlowY;\nuniform float uGradientY;\n\nconst int SHAPE_SQUARE   = 0;\nconst int SHAPE_CIRCLE   = 1;\nconst int SHAPE_TRIANGLE = 2;\nconst int SHAPE_DIAMOND  = 3;\n\nconst int MAX_CLICKS = 10;\nuniform vec2  uClickPos[MAX_CLICKS];\nuniform float uClickTimes[MAX_CLICKS];\n\nout vec4 fragColor;\n\nfloat Bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }\n#define Bayer4(a) (Bayer2(0.5*(a))*0.25 + Bayer2(a))\n#define Bayer8(a) (Bayer4(0.5*(a))*0.25 + Bayer2(a))\n\n#define FBM_OCTAVES    5\n#define FBM_LACUNARITY 1.25\n#define FBM_GAIN       1.0\n#define FBM_SCALE      4.0\n\nfloat hash11(float n) { return fract(sin(n) * 43758.5453); }\n\nfloat vnoise(vec3 p) {\n  vec3 ip = floor(p);\n  vec3 fp = fract(p);\n  float n000 = hash11(dot(ip + vec3(0.0,0.0,0.0), vec3(1.0,57.0,113.0)));\n  float n100 = hash11(dot(ip + vec3(1.0,0.0,0.0), vec3(1.0,57.0,113.0)));\n  float n010 = hash11(dot(ip + vec3(0.0,1.0,0.0), vec3(1.0,57.0,113.0)));\n  float n110 = hash11(dot(ip + vec3(1.0,1.0,0.0), vec3(1.0,57.0,113.0)));\n  float n001 = hash11(dot(ip + vec3(0.0,0.0,1.0), vec3(1.0,57.0,113.0)));\n  float n101 = hash11(dot(ip + vec3(1.0,0.0,1.0), vec3(1.0,57.0,113.0)));\n  float n011 = hash11(dot(ip + vec3(0.0,1.0,1.0), vec3(1.0,57.0,113.0)));\n  float n111 = hash11(dot(ip + vec3(1.0,1.0,1.0), vec3(1.0,57.0,113.0)));\n  vec3 w = fp*fp*fp*(fp*(fp*6.0-15.0)+10.0);\n  float x00 = mix(n000, n100, w.x);\n  float x10 = mix(n010, n110, w.x);\n  float x01 = mix(n001, n101, w.x);\n  float x11 = mix(n011, n111, w.x);\n  float y0  = mix(x00, x10, w.y);\n  float y1  = mix(x01, x11, w.y);\n  return mix(y0, y1, w.z) * 2.0 - 1.0;\n}\n\nfloat fbm2(vec2 uv, float t) {\n  vec3 p = vec3(uv * FBM_SCALE, t);\n  float amp  = 1.0;\n  float freq = 1.0;\n  float sum  = 1.0;\n  for (int i = 0; i < FBM_OCTAVES; ++i) {\n    sum  += amp * vnoise(p * freq);\n    freq *= FBM_LACUNARITY;\n    amp  *= FBM_GAIN;\n  }\n  return sum * 0.5 + 0.5;\n}\n\nfloat maskCircle(vec2 p, float cov) {\n  float r = sqrt(cov) * 0.25;\n  float d = length(p - 0.5) - r;\n  float aa = 0.5 * fwidth(d);\n  return cov * (1.0 - smoothstep(-aa, aa, d * 2.0));\n}\nfloat maskTriangle(vec2 p, vec2 id, float cov) {\n  bool flip = mod(id.x + id.y, 2.0) > 0.5;\n  if (flip) p.x = 1.0 - p.x;\n  float r  = sqrt(cov);\n  float d  = p.y - r * (1.0 - p.x);\n  float aa = fwidth(d);\n  return cov * clamp(0.5 - d / aa, 0.0, 1.0);\n}\nfloat maskDiamond(vec2 p, float cov) {\n  float r = sqrt(cov) * 0.564;\n  return step(abs(p.x - 0.49) + abs(p.y - 0.49), r);\n}\n\nvoid main() {\n  float pixel = uPixelSize;\n  vec2 fragCoord = gl_FragCoord.xy - uResolution * 0.5;\n  float aspect = uResolution.x / uResolution.y;\n\n  vec2 pixelId = floor(fragCoord / pixel);\n  vec2 pixelUV = fract(fragCoord / pixel);\n\n  float cellPx = 8.0 * pixel;\n  vec2 cellId  = floor(fragCoord / cellPx);\n  vec2 cellCoord = cellId * cellPx;\n  vec2 uv = cellCoord / uResolution * vec2(aspect, 1.0);\n\n  vec2 flowUv = uv - vec2(0.0, uTime * uFlowY);\n  float feed = fbm2(flowUv, uTime * uFbmSpeed);\n\n  float ny = gl_FragCoord.y / max(uResolution.y, 1.0);\n  float dens = clamp(uDensity + uGradientY * (1.0 - ny) * 0.55, 0.0, 1.0);\n\n  feed = feed * 0.5 - mix(0.65, 0.10, dens);\n\n  const float dampT = 1.0;\n  const float dampR = 10.0;\n\n  for (int i = 0; i < MAX_CLICKS; ++i) {\n    vec2 pos = uClickPos[i];\n    if (pos.x < 0.0) continue;\n    vec2 cuv = (((pos - uResolution * 0.5 - cellPx * 0.5) / uResolution)) * vec2(aspect, 1.0);\n    float t = max(uTime - uClickTimes[i], 0.0);\n    float r = distance(uv, cuv);\n    float waveR = uRippleSpeed * t;\n    float ring  = exp(-pow((r - waveR) / uRippleThickness, 2.0));\n    float atten = exp(-dampT * t) * exp(-dampR * r);\n    feed = max(feed, ring * atten);\n  }\n\n  float bayer = Bayer8(fragCoord / uPixelSize) - 0.5;\n  float bw    = step(0.5, feed + bayer);\n\n  float coverage = bw;\n  float M;\n  if      (uShapeType == SHAPE_CIRCLE)   M = maskCircle (pixelUV, coverage);\n  else if (uShapeType == SHAPE_TRIANGLE) M = maskTriangle(pixelUV, pixelId, coverage);\n  else if (uShapeType == SHAPE_DIAMOND)  M = maskDiamond(pixelUV, coverage);\n  else                                   M = coverage;\n\n  fragColor = vec4(uColor, M);\n}';

  var VERT = '#version 300 es\nin vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}';
  var FRAG = '#version 300 es\n' + FRAG_BODY;
  var MAX = 10;

  // Light and dark get different ink AND different motion, per design direction.
  var THEMES = {
    light: { ink: [0.13, 0.11, 0.15], density: 0.90, fbmSpeed: 0.05, rippleSpeed: 0.30, autoRippleMs: 4500, alpha: 0.20, flowY: 0.030, gradientY: 0.10 },
    dark:  { ink: [1.00, 1.00, 1.00], density: 0.85, fbmSpeed: 0.08, rippleSpeed: 0.42, autoRippleMs: 3200, alpha: 0.33, flowY: 0.045, gradientY: 0.13 }
  };
    // shape 0 = square: a lit cell fills completely, so dense areas reach solid
  // ink. shape 1 = circle (pattern 03) tops out near 20% cell coverage.
var BASE = { pixelSize: 4, shape: 0, rippleThickness: 0.10 };

  function isDark() { return document.documentElement.classList.contains('dark'); }

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error('[mld-pattern]', gl.getShaderInfoLog(sh)); return null;
    }
    return sh;
  }

  function init(container) {
    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    container.appendChild(canvas);
    var gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: false });
    if (!gl) return null;   // no webgl2: container just stays empty, layout unaffected

    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('[mld-pattern]', gl.getProgramInfoLog(prog)); return null;
    }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    var U = {};
    ['uResolution','uTime','uColor','uShapeType','uPixelSize','uDensity','uFbmSpeed',
     'uRippleSpeed','uRippleThickness','uFlowY','uGradientY','uClickPos','uClickTimes']
      .forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

    var clickPos = new Float32Array(MAX * 2).fill(-1);
    var clickTimes = new Float32Array(MAX);
    var idx = 0, dpr = 1;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(container.clientWidth, 1), h = Math.max(container.clientHeight, 1);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.width = '100%'; canvas.style.height = '100%';
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(U.uResolution, canvas.width, canvas.height);
      gl.uniform1f(U.uPixelSize, BASE.pixelSize * dpr);
    }

    function applyTheme() {
      var t = THEMES[isDark() ? 'dark' : 'light'];
      gl.useProgram(prog);
      gl.uniform3f(U.uColor, t.ink[0], t.ink[1], t.ink[2]);
      gl.uniform1f(U.uDensity, t.density);
      gl.uniform1f(U.uFbmSpeed, t.fbmSpeed);
      gl.uniform1f(U.uRippleSpeed, t.rippleSpeed);
      gl.uniform1f(U.uFlowY, t.flowY);
      gl.uniform1f(U.uGradientY, t.gradientY);
      canvas.style.opacity = t.alpha;
      return t;
    }

    gl.uniform1i(U.uShapeType, BASE.shape);
    gl.uniform1f(U.uRippleThickness, BASE.rippleThickness);
    var theme = applyTheme();
    resize();
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(container);
    else window.addEventListener('resize', resize);

    // Re-tint and re-time whenever the theme toggles.
    new MutationObserver(function () { theme = applyTheme(); schedule(); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    var start = performance.now();
    function fire(x, y) {
      clickPos[idx * 2] = x; clickPos[idx * 2 + 1] = y;
      clickTimes[idx] = (performance.now() - start) / 1000;
      idx = (idx + 1) % MAX;
    }
    var host = container.parentElement || container;
    host.addEventListener('pointerdown', function (e) {
      var r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      fire((e.clientX - r.left) * (canvas.width / r.width),
           (r.height - (e.clientY - r.top)) * (canvas.height / r.height));
    });

    var autoTimer = null;
    function schedule() {
      if (autoTimer) clearInterval(autoTimer);
      autoTimer = setInterval(function () {
        if (canvas.width && canvas.height && visible) fire(Math.random() * canvas.width, Math.random() * canvas.height);
      }, theme.autoRippleMs);
    }
    schedule();
    setTimeout(function () { fire(canvas.width * 0.5, canvas.height * 0.55); }, 400);

    var visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }, { threshold: 0 }).observe(container);
    }
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    (function tick() {
      if (visible && !reduce) {
        gl.useProgram(prog);
        gl.uniform1f(U.uTime, (performance.now() - start) / 1000);
        gl.uniform2fv(U.uClickPos, clickPos);
        gl.uniform1fv(U.uClickTimes, clickTimes);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      requestAnimationFrame(tick);
    })();
    return true;
  }

  function heroEl() {
    var cta = document.querySelector('#hero-calendly');
    return cta && cta.closest('section');
  }

  // The page is hydrated by React into <body>; injecting into a React-owned
  // subtree before hydration makes the markup mismatch and React throws the
  // server render away. So: mount only after load, and into our own element
  // appended to <body>, positioned over the hero in document coordinates.
  // Runs from the top of the page down to the logo strip: everything above
  // the strip carries the pattern, the strip itself stays clean. Measured
  // from the strip element so it stays correct if content above it changes.
  function stripEl() {
    var list = document.querySelector('.clients-list');
    if (list) return list.closest('div') || list;
    var hs = document.querySelectorAll('h2');
    for (var i = 0; i < hs.length; i++) {
      if (/Trusted by/i.test(hs[i].textContent)) return hs[i];
    }
    return null;
  }

  function place(host) {
    var hero = heroEl();
    if (!hero) return;
    var r = hero.getBoundingClientRect();
    var top = 0;                              // from the very top of the page
    var strip = stripEl();
    var bottom = strip
      ? strip.getBoundingClientRect().top + window.scrollY
      : r.bottom + window.scrollY + 72;
    host.style.top = Math.round(top) + 'px';
    host.style.height = Math.max(Math.round(bottom - top), 200) + 'px';
  }

  function mount() {
    if (document.querySelector('.mld-pattern')) return;
    var hero = heroEl();
    if (!hero) return;
    var d = document.createElement('div');
    d.className = 'mld-pattern';
    document.body.appendChild(d);
    place(d);
    if (!init(d)) { d.remove(); return; }
    window.addEventListener('resize', function () { place(d); }, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(function () { place(d); }).observe(hero);
  }

  // The "$167M" stat card is styled like the hero proof blob — translucent, so
  // the same shader can run behind it and read through. Same trick as the hero:
  // the canvas lives in its own body-level element at z-index -1, positioned
  // over the card in document coordinates, so React's DOM is never touched.
  // Clipped to the card's radius so it doesn't spill past the rounded corners.
  function cardEl() { return document.querySelector('.mld-stat--accent'); }

  function placeCard(host) {
    var c = cardEl();
    if (!c) return;
    var r = c.getBoundingClientRect();
    if (!r.width || !r.height) return;
    host.style.top = Math.round(r.top + window.scrollY) + 'px';
    host.style.left = Math.round(r.left + window.scrollX) + 'px';
    host.style.width = Math.round(r.width) + 'px';
    host.style.height = Math.round(r.height) + 'px';
  }

  function mountCard() {
    if (document.querySelector('.mld-card-pattern')) return;
    var c = cardEl();
    if (!c) return;
    var d = document.createElement('div');
    d.className = 'mld-pattern mld-card-pattern';
    document.body.appendChild(d);
    placeCard(d);
    if (!init(d)) { d.remove(); return; }
    var replace = function () { placeCard(d); };
    window.addEventListener('resize', replace, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(replace).observe(document.body);
    // Late web fonts and images shift the section; re-measure a few times.
    [200, 800, 2000].forEach(function (ms) { setTimeout(replace, ms); });
  }

  function boot() { requestAnimationFrame(function () { requestAnimationFrame(function () { mount(); mountCard(); }); }); }
  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);
})();
