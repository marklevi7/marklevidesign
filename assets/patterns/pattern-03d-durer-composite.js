/* mld-pattern-03d "Updraft Durer" — pattern 03b with the solid composited INTO the field.

   Layer order, which is the whole point of this variant:
     waves (the fBm feed)  ->  Durer's solid  ->  the dither/pixelation filter

   So the solid is not a canvas sitting on top of the pattern; it is rendered
   into the same field and then run through the same Bayer dither, which is why
   it comes out pixelated like everything else. That needs one WebGL context,
   not two: the mesh renders to a framebuffer sized to its own box, and the
   dither pass samples that framebuffer and lets it replace the noise feed
   inside the silhouette.

   Geometry and lighting for the solid live in shape-durer.js, which this file
   reads off window.MLD_DURER. Without it, this behaves exactly like 03b.

   Original 03b notes follow.
   "Updraft Solid" (square-cell variant of 03) — dither dot field for the hero.
   Ported from the alumot-pattern handoff (preset: final): density is
   bottom-weighted and the field drifts slowly upward, so it reads as
   breathing toward the top of the block. The original ran on
   three.js purely to draw a fullscreen quad; this is the same shader on raw
   WebGL2, so the page carries no extra dependency.
   The canvas is transparent — only the ink colour is drawn — so the page
   background shows through and the pattern re-tints with the theme. */
(function () {
  var FRAG_BODY = '\nprecision highp float;\n\nuniform vec3  uColor;\nuniform vec2  uResolution;\nuniform float uTime;\nuniform float uPixelSize;\nuniform int   uShapeType;\nuniform float uDensity;\nuniform float uFbmSpeed;\nuniform float uRippleSpeed;\nuniform float uRippleThickness;\nuniform float uFlowY;\nuniform float uGradientY;\nuniform sampler2D uShape;\nuniform vec2 uShapeOrigin;\nuniform vec2 uShapeSize;\nuniform float uShapeLo;\nuniform float uShapeHi;\n\nconst int SHAPE_SQUARE   = 0;\nconst int SHAPE_CIRCLE   = 1;\nconst int SHAPE_TRIANGLE = 2;\nconst int SHAPE_DIAMOND  = 3;\n\nconst int MAX_CLICKS = 10;\nuniform vec2  uClickPos[MAX_CLICKS];\nuniform float uClickTimes[MAX_CLICKS];\n\nout vec4 fragColor;\n\nfloat Bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }\n#define Bayer4(a) (Bayer2(0.5*(a))*0.25 + Bayer2(a))\n#define Bayer8(a) (Bayer4(0.5*(a))*0.25 + Bayer2(a))\n\n#define FBM_OCTAVES    5\n#define FBM_LACUNARITY 1.25\n#define FBM_GAIN       1.0\n#define FBM_SCALE      4.0\n\nfloat hash11(float n) { return fract(sin(n) * 43758.5453); }\n\nfloat vnoise(vec3 p) {\n  vec3 ip = floor(p);\n  vec3 fp = fract(p);\n  float n000 = hash11(dot(ip + vec3(0.0,0.0,0.0), vec3(1.0,57.0,113.0)));\n  float n100 = hash11(dot(ip + vec3(1.0,0.0,0.0), vec3(1.0,57.0,113.0)));\n  float n010 = hash11(dot(ip + vec3(0.0,1.0,0.0), vec3(1.0,57.0,113.0)));\n  float n110 = hash11(dot(ip + vec3(1.0,1.0,0.0), vec3(1.0,57.0,113.0)));\n  float n001 = hash11(dot(ip + vec3(0.0,0.0,1.0), vec3(1.0,57.0,113.0)));\n  float n101 = hash11(dot(ip + vec3(1.0,0.0,1.0), vec3(1.0,57.0,113.0)));\n  float n011 = hash11(dot(ip + vec3(0.0,1.0,1.0), vec3(1.0,57.0,113.0)));\n  float n111 = hash11(dot(ip + vec3(1.0,1.0,1.0), vec3(1.0,57.0,113.0)));\n  vec3 w = fp*fp*fp*(fp*(fp*6.0-15.0)+10.0);\n  float x00 = mix(n000, n100, w.x);\n  float x10 = mix(n010, n110, w.x);\n  float x01 = mix(n001, n101, w.x);\n  float x11 = mix(n011, n111, w.x);\n  float y0  = mix(x00, x10, w.y);\n  float y1  = mix(x01, x11, w.y);\n  return mix(y0, y1, w.z) * 2.0 - 1.0;\n}\n\nfloat fbm2(vec2 uv, float t) {\n  vec3 p = vec3(uv * FBM_SCALE, t);\n  float amp  = 1.0;\n  float freq = 1.0;\n  float sum  = 1.0;\n  for (int i = 0; i < FBM_OCTAVES; ++i) {\n    sum  += amp * vnoise(p * freq);\n    freq *= FBM_LACUNARITY;\n    amp  *= FBM_GAIN;\n  }\n  return sum * 0.5 + 0.5;\n}\n\nfloat maskCircle(vec2 p, float cov) {\n  float r = sqrt(cov) * 0.25;\n  float d = length(p - 0.5) - r;\n  float aa = 0.5 * fwidth(d);\n  return cov * (1.0 - smoothstep(-aa, aa, d * 2.0));\n}\nfloat maskTriangle(vec2 p, vec2 id, float cov) {\n  bool flip = mod(id.x + id.y, 2.0) > 0.5;\n  if (flip) p.x = 1.0 - p.x;\n  float r  = sqrt(cov);\n  float d  = p.y - r * (1.0 - p.x);\n  float aa = fwidth(d);\n  return cov * clamp(0.5 - d / aa, 0.0, 1.0);\n}\nfloat maskDiamond(vec2 p, float cov) {\n  float r = sqrt(cov) * 0.564;\n  return step(abs(p.x - 0.49) + abs(p.y - 0.49), r);\n}\n\nvoid main() {\n  float pixel = uPixelSize;\n  vec2 fragCoord = gl_FragCoord.xy - uResolution * 0.5;\n  float aspect = uResolution.x / uResolution.y;\n\n  vec2 pixelId = floor(fragCoord / pixel);\n  vec2 pixelUV = fract(fragCoord / pixel);\n\n  float cellPx = 8.0 * pixel;\n  vec2 cellId  = floor(fragCoord / cellPx);\n  vec2 cellCoord = cellId * cellPx;\n  vec2 uv = cellCoord / uResolution * vec2(aspect, 1.0);\n\n  vec2 flowUv = uv - vec2(0.0, uTime * uFlowY);\n  float feed = fbm2(flowUv, uTime * uFbmSpeed);\n\n  float ny = gl_FragCoord.y / max(uResolution.y, 1.0);\n  float dens = clamp(uDensity + uGradientY * (1.0 - ny) * 0.55, 0.0, 1.0);\n\n  feed = feed * 0.5 - mix(0.65, 0.10, dens);\n\n  // A plain over: the solid sits on the field and hides what is behind it,\n  // then the dither below runs over the pair. Nothing else passes between\n  // them - no bleed-through, no bias, just occlusion.\n  // Sampled at the centre of each dot cell, not per fragment. Per fragment the\n  // silhouette follows the true polygon edge at full resolution while every\n  // other boundary on screen is quantised to the dot grid, and that mismatch\n  // is what makes the edge read as a mask laid over the dither instead of\n  // part of it. On the dot grid it steps like everything else.\n  if (uShapeSize.x > 0.5) {\n    vec2 dotCentre = (pixelId + 0.5) * pixel + uResolution * 0.5;\n    vec2 sUV = (dotCentre - uShapeOrigin) / uShapeSize;\n    if (sUV.x > 0.0 && sUV.x < 1.0 && sUV.y > 0.0 && sUV.y < 1.0) {\n      vec4 sh = texture(uShape, sUV);\n      feed = mix(feed, mix(uShapeLo, uShapeHi, sh.r), sh.a);\n    }\n  }\n\n  const float dampT = 1.0;\n  const float dampR = 10.0;\n\n  for (int i = 0; i < MAX_CLICKS; ++i) {\n    vec2 pos = uClickPos[i];\n    if (pos.x < 0.0) continue;\n    vec2 cuv = (((pos - uResolution * 0.5 - cellPx * 0.5) / uResolution)) * vec2(aspect, 1.0);\n    float t = max(uTime - uClickTimes[i], 0.0);\n    float r = distance(uv, cuv);\n    float waveR = uRippleSpeed * t;\n    float ring  = exp(-pow((r - waveR) / uRippleThickness, 2.0));\n    float atten = exp(-dampT * t) * exp(-dampR * r);\n    feed = max(feed, ring * atten);\n  }\n\n  float bayer = Bayer8(fragCoord / uPixelSize) - 0.5;\n  float bw    = step(0.5, feed + bayer);\n\n  float coverage = bw;\n  float M;\n  if      (uShapeType == SHAPE_CIRCLE)   M = maskCircle (pixelUV, coverage);\n  else if (uShapeType == SHAPE_TRIANGLE) M = maskTriangle(pixelUV, pixelId, coverage);\n  else if (uShapeType == SHAPE_DIAMOND)  M = maskDiamond(pixelUV, coverage);\n  else                                   M = coverage;\n\n  fragColor = vec4(uColor, M);\n}';

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
  // The stat card is a small window onto the same field, so it needs its own
  // settings: a stronger alpha to stay visible at that size, a lower density so
  // the field reads as scattered pixels instead of solid slabs, and no vertical
  // ramp — the hero's bottom-weighting has nothing to say inside a 180px box.
  // alpha is per-theme here: halving it in light mode moves the pixels half
  // way back to the card surface, which is what "50% lighter" means. Dark
  // mode matches at 0.225 - 0.45 read too bright on the dark card.
  var CARD = { alpha: { light: 0.225, dark: 0.225 }, density: 0.55, gradientY: 0 };

  function isDark() { return document.documentElement.classList.contains('dark'); }

  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* 1.62 was the size it first shipped at; the owner asked for twice that. */
  var SOLID_SCALE = 1.62;

  /* Where the solid sits, in CSS pixels relative to the pattern host. Desktop
     puts it in the hero's right-hand column at twice the size it first shipped
     at; mobile keeps it under the CTA. */
  function solidBox(host) {
    var hostRect = host.getBoundingClientRect();
    var cta = document.getElementById('hero-calendly');
    var hero = cta && cta.closest('section');
    if (!hero) return null;
    var hr = hero.getBoundingClientRect();
    var cs = getComputedStyle(hero);
    var padL = parseFloat(cs.paddingLeft) || 0, padR = parseFloat(cs.paddingRight) || 0;
    var padT = parseFloat(cs.paddingTop) || 0, padB = parseFloat(cs.paddingBottom) || 0;
    var left, top, w, h;

    if (window.innerWidth >= 992) {
      /* Bleeds to the viewport edge so the extra size has somewhere to go
         without crowding the copy on the left. */
      var right = hr.right;
      w = Math.max(640, Math.round(window.innerWidth * 0.52));
      h = Math.round(w * 1.15);
      left = right - w;
      var mid = hr.top + padT + (hr.height - padT - padB) / 2;
      top = mid - h / 2;
    } else {
      /* Twice the size it was, which is wider than the phone - so it is centred
         on the viewport and allowed to bleed off both sides and downward under
         the proof blob. Still anchored 24px below the CTA. */
      /* Three lines of body copy higher than it sat. Mobile body text is 16px
         on a 1.5 line-height, so a line is 24px. The solid does not fill its
         box, so it still clears the button by a comfortable margin. */
      var ctaB = cta.getBoundingClientRect().bottom;
      top = ctaB + 24 - 72;
      h = Math.round(window.innerWidth * 1.79);
      w = Math.round(h * 0.78);
      left = hr.left + (hr.width - w) / 2;
    }
    /* Only the top is pinned. Pushing the box up to fit inside the host would
       drag the solid back over the CTA, and on mobile it is meant to run past
       the bottom of the hero anyway. */
    var x = left - hostRect.left, y = top - hostRect.top;
    if (y < 0) y = 0;
    if (window.innerWidth >= 992 && y + h > hostRect.height) {
      y = Math.max(0, hostRect.height - h);
    }
    return { x: x, y: y, w: w, h: h };
  }

  /* Renders the solid to an offscreen target and points the dither pass at it. */
  function buildSolid(gl, U, canvas, getDpr) {
    var D = window.MLD_DURER;
    var vs = compile(gl, gl.VERTEX_SHADER, D.VERT_SRC);
    var fs = compile(gl, gl.FRAGMENT_SHADER, D.FRAG_SRC);
    if (!vs || !fs) return null;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('[mld-shape]', gl.getProgramInfoLog(prog)); return null;
    }

    var mesh = D.buildMesh();
    var count = mesh.positions.length / 3;
    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    var pb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pb);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
    var nb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, nb);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.normals, gl.STATIC_DRAW);
    var aNrm = gl.getAttribLocation(prog, 'aNormal');
    gl.enableVertexAttribArray(aNrm);
    gl.vertexAttribPointer(aNrm, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    var MU = {};
    ['uProj','uView','uModel','uRot','uCam','uKeyDir','uFillDir','uAmbient','uKey','uFill','uContrast',
     'uMetal','uShine','uRim','uSheen','uGamma']
      .forEach(function (n) { MU[n] = gl.getUniformLocation(prog, n); });

    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var fbo = gl.createFramebuffer();
    var depth = gl.createRenderbuffer();
    var texW = 0, texH = 0, ok = false;

    gl.useProgram(prog);
    gl.uniform3f(MU.uCam, D.CAM[0], D.CAM[1], D.CAM[2]);
    gl.uniform3f(MU.uKeyDir, D.KEY_DIR[0], D.KEY_DIR[1], D.KEY_DIR[2]);
    gl.uniform3f(MU.uFillDir, D.FILL_DIR[0], D.FILL_DIR[1], D.FILL_DIR[2]);
    gl.uniform1f(MU.uAmbient, D.LIGHTING.ambient);
    gl.uniform1f(MU.uKey, D.LIGHTING.key);
    gl.uniform1f(MU.uFill, D.LIGHTING.fill);
    gl.uniform1f(MU.uContrast, D.LIGHTING.contrast || 1.0);

    function sync() {
      var host = canvas.parentElement;
      var box = host && solidBox(host);
      if (!box || box.w < 40 || box.h < 40) {
        ok = false;
        if (progRef()) { gl.useProgram(progRef()); gl.uniform2f(U.uShapeSize, 0, 0); }
        return;
      }
      var dpr = getDpr();
      var w = Math.max(8, Math.round(box.w * dpr));
      var h = Math.max(8, Math.round(box.h * dpr));
      if (w !== texW || h !== texH) {
        texW = w; texH = h;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
      gl.useProgram(prog);
      gl.uniformMatrix4fv(MU.uProj, false, D.perspective(D.FOV, w / h, 0.1, 100));
      gl.uniformMatrix4fv(MU.uView, false, D.translation(-D.CAM[0], -D.CAM[1], -D.CAM[2]));

      /* The dither reads device pixels with the origin at the bottom-left. */
      var originX = box.x * dpr;
      var originY = canvas.height - (box.y + box.h) * dpr;
      if (!progRef()) return;
      gl.useProgram(progRef());
      gl.uniform2f(U.uShapeOrigin, originX, originY);
      gl.uniform2f(U.uShapeSize, w, h);
      /* Ink is dark on the light page and white on the dark one, so which end of
         the shading ramp should read as dense flips with the theme. */
      var dark = isDark();
      /* Both ends have to stay strictly inside the dither's working range.
         Above 1.0 every Bayer threshold passes and the cell fills solid, which
         is what turned the faces into flat plates with hard vector edges
         between them. Below 0.37 the solid drops under the field and reads as
         a hole. 0.45 to 0.90 keeps every part of it genuinely dithered. */
      /* Brightness and depth drive the coverage band. Polarity flips with the
         theme because the ink does: on the light page brighter means thinning
         out, on the dark page it means packing tighter. Sliders at their
         defaults reproduce the shipped values exactly. */
      var LV = D.LIVE;
      var half = LV.depth * 0.35;
      if (dark) {
        var cD = 0.35 + LV.brightness * 0.63;
        gl.uniform1f(U.uShapeLo, cD - half);
        gl.uniform1f(U.uShapeHi, cD + half);
      } else {
        var cL = 0.90 - LV.brightness * 0.75;
        gl.uniform1f(U.uShapeLo, cL + half);
        gl.uniform1f(U.uShapeHi, cL - half);
      }
      ok = true;
      /* Only now does the layout reserve room for the solid, so a browser
         without the mesh gets the plain hero rather than an empty band. Guarded:
         a class-list write here would re-trigger the theme observer that called
         sync() in the first place. */
      if (!document.documentElement.classList.contains('mld-shape-on')) {
        document.documentElement.classList.add('mld-shape-on');
      }
    }

    var progRefFn = null;
    function progRef() { return progRefFn; }
    function setDitherProgram(p) { progRefFn = p; }

    function draw(t) {
      if (!ok || !texW) return;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, texW, texH);
      gl.disable(gl.BLEND);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(prog);
      gl.bindVertexArray(vao);
      var L = D.LIVE;
      gl.uniform1f(MU.uKey, L.key);
      gl.uniform1f(MU.uFill, L.fill);
      gl.uniform1f(MU.uContrast, L.contrast);
      gl.uniform1f(MU.uMetal, L.metal);
      gl.uniform1f(MU.uShine, L.shine);
      gl.uniform1f(MU.uRim, L.rim);
      gl.uniform1f(MU.uSheen, L.sheen);
      gl.uniform1f(MU.uGamma, L.gamma);
      /* Key direction: swing around the solid, then lift or drop. */
      var a = L.angle * Math.PI / 180, e = L.elevation * Math.PI / 180;
      var kd = D.KEY_DIR;
      var ca = Math.cos(a), sa = Math.sin(a);
      var kx = kd[0] * ca - kd[2] * sa, ky = kd[1], kz = kd[0] * sa + kd[2] * ca;
      var ce = Math.cos(e), se = Math.sin(e);
      var ny = ky * ce - kz * se, nz = ky * se + kz * ce;
      var kl = Math.hypot(kx, ny, nz) || 1;
      gl.uniform3f(MU.uKeyDir, kx / kl, ny / kl, nz / kl);
      var spin = REDUCE ? 0.8 : t * L.spin;
      /* The geometry's 3-fold axis runs along Z, which points at the camera. A
         fixed quarter turn about X stands it up first, so with tumble at zero
         the solid turns on its own upright axis instead of sweeping that axis
         across the view. Applied innermost, before the spin. */
      var rot = D.mul3(
        D.mul3(D.rotX3(spin * D.SPIN_X * L.tumble), D.rotY3(spin * D.SPIN_Y)),
        D.rotX3(-Math.PI / 2)
      );
      gl.uniformMatrix4fv(MU.uModel, false, D.toMat4(rot, SOLID_SCALE * L.size));
      gl.uniformMatrix3fv(MU.uRot, false, rot);
      gl.drawArrays(gl.TRIANGLES, 0, count);
      gl.bindVertexArray(null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.BLEND);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
    }

    return { sync: sync, draw: draw, setDitherProgram: setDitherProgram };
  }


  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error('[mld-pattern]', gl.getShaderInfoLog(sh)); return null;
    }
    return sh;
  }

  function init(container, over) {
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
     'uRippleSpeed','uRippleThickness','uFlowY','uGradientY','uClickPos','uClickTimes',
     'uShape','uShapeOrigin','uShapeSize','uShapeLo','uShapeHi']
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
      if (typeof solid !== 'undefined' && solid) solid.sync();
    }

    function applyTheme() {
      var t = THEMES[isDark() ? 'dark' : 'light'];
      gl.useProgram(prog);
      gl.uniform3f(U.uColor, t.ink[0], t.ink[1], t.ink[2]);
      gl.uniform1f(U.uDensity, over && over.density != null ? over.density : t.density);
      gl.uniform1f(U.uFbmSpeed, t.fbmSpeed);
      gl.uniform1f(U.uRippleSpeed, t.rippleSpeed);
      gl.uniform1f(U.uFlowY, t.flowY);
      gl.uniform1f(U.uGradientY, over && over.gradientY != null ? over.gradientY : t.gradientY);
      var oa = over && over.alpha;
      if (oa && typeof oa === 'object') oa = isDark() ? oa.dark : oa.light;
      canvas.style.opacity = oa != null ? oa : t.alpha;
      return t;
    }

    gl.uniform1i(U.uShapeType, BASE.shape);
    gl.uniform1f(U.uRippleThickness, BASE.rippleThickness);
    gl.uniform1i(U.uShape, 0);
    gl.uniform2f(U.uShapeOrigin, 0, 0);
    gl.uniform2f(U.uShapeSize, 0, 0);

    /* Durer's solid, rendered into this same context so the dither below runs
       over it. Its target is only as large as the solid's own box, which costs
       a fraction of a full-canvas buffer. Absent the library, nothing changes
       and this behaves as plain 03b. */
    /* Hero only. The stat card runs this same shader for its own dot field and
       must not get the solid as well. */
    var wantsSolid = window.MLD_DURER && !container.classList.contains('mld-card-pattern');
    var solid = wantsSolid ? buildSolid(gl, U, canvas, function () { return dpr; }) : null;
    if (solid) solid.setDitherProgram(prog);

    var theme = applyTheme();
    resize();
    if (solid) solid.sync();
    /* The control panel needs the coverage band recomputed without waiting
       for a theme change. */
    if (solid) window.MLD_SHAPE_REFRESH = function () { applyTheme(); solid.sync(); };
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(container);
    else window.addEventListener('resize', resize);

    // Re-tint and re-time whenever the theme toggles.
    new MutationObserver(function () { theme = applyTheme(); if (solid) solid.sync(); schedule(); })
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
        if (solid) solid.draw((performance.now() - start) / 1000);
        /* The solid pass leaves its own program, buffer and viewport bound. */
        gl.useProgram(prog);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        gl.viewport(0, 0, canvas.width, canvas.height);
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
    if (!init(d, CARD)) { d.remove(); return; }
    // The card only goes transparent once the canvas is actually running,
    // so a browser without WebGL2 keeps a solid grey card instead of a hole.
    document.documentElement.classList.add('mld-cardfx');
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
