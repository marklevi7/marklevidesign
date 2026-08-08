/* mld-shape-durer — Dürer's solid (truncated triangular trapezohedron), rotating.

   Geometry per the handoff: a rhombohedron whose rhombic faces have a 72 degree
   acute angle, with both 3-fold apexes truncated at 1/phi — the one depth that
   lands all 12 vertices on a shared circumsphere. 12 verts, 8 faces (2 triangle
   caps + 6 pentagons), 18 edges.

   The handoff drives this through three.js off a CDN. The rest of this site
   deliberately carries no CDN dependency for its visuals (see CLAUDE.md), and
   three.js here would only be doing what ~120 lines of raw WebGL do: transform a
   mesh and light it. So this is the same geometry and the same lighting rig on
   plain WebGL — flat-shaded via per-face duplicated vertices, key light
   top-left-front, soft fill bottom-right.

   Colour comes from --color-black, which the theme already inverts: deep plum on
   the light page, white on the dark one. No new tokens. */
(function () {
  var VERT_SRC =
    'attribute vec3 aPos;attribute vec3 aNormal;' +
    'uniform mat4 uProj;uniform mat4 uView;uniform mat4 uModel;uniform mat3 uRot;' +
    'varying vec3 vN;varying vec3 vW;' +
    'void main(){vec4 wp=uModel*vec4(aPos,1.0);vW=wp.xyz;vN=uRot*aNormal;' +
    'gl_Position=uProj*uView*wp;}';

  var FRAG_SRC =
    'precision highp float;' +
    'uniform vec3 uColor;uniform vec3 uCam;uniform vec3 uKeyDir;uniform vec3 uFillDir;' +
    'uniform float uAmbient;uniform float uKey;uniform float uFill;uniform float uSpec;' +
    'varying vec3 vN;varying vec3 vW;' +
    'void main(){' +
    'vec3 N=normalize(vN);' +
    'vec3 V=normalize(uCam-vW);' +
    'float k=max(dot(N,uKeyDir),0.0);' +
    'float f=max(dot(N,uFillDir),0.0);' +
    'float d=uAmbient+uKey*k+uFill*f;' +
    'vec3 H=normalize(uKeyDir+V);' +
    'float s=pow(max(dot(N,H),0.0),26.0)*uSpec*k;' +
    'gl_FragColor=vec4(uColor*d+vec3(s),1.0);}';

  /* --- geometry ------------------------------------------------------- */

  var H = Math.sqrt((3 * Math.sqrt(5) + 5) / 10);   /* rhombohedron half-height */
  var P = 2.0 / (1.0 + Math.sqrt(5));               /* truncation depth, 1/phi   */
  var zM = H / 2;                                   /* middle-ring half-height   */
  var zC = H * (1.5 - P);                           /* cap half-height           */
  var rM = 1.0;                                     /* middle-ring radius        */
  var rC = P;                                       /* cap radius                */
  var s60 = Math.sqrt(3) / 2;

  var V = [
    [ rM,       0,        -zM],   /*  0  lower ring,   0deg */
    [-rM * 0.5, rM * s60, -zM],   /*  1  lower ring, 120deg */
    [-rM * 0.5, -rM * s60, -zM],  /*  2  lower ring, 240deg */
    [ rM * 0.5, rM * s60,  zM],   /*  3  upper ring,  60deg */
    [ rM * 0.5, -rM * s60, zM],   /*  4  upper ring, 300deg */
    [-rM,       0,         zM],   /*  5  upper ring, 180deg */
    [ rC * 0.5, rC * s60,  zC],   /*  6  top cap,     60deg */
    [ rC * 0.5, -rC * s60, zC],   /*  7  top cap,    300deg */
    [-rC,       0,         zC],   /*  8  top cap,    180deg */
    [ rC,       0,        -zC],   /*  9  bottom cap,   0deg */
    [-rC * 0.5, rC * s60, -zC],   /* 10  bottom cap, 120deg */
    [-rC * 0.5, -rC * s60, -zC]   /* 11  bottom cap, 240deg */
  ];

  var FACES = [
    [6, 7, 8],          /* top triangle    */
    [9, 10, 11],        /* bottom triangle */
    [6, 3, 0, 4, 7],    /* top pentagons   */
    [8, 5, 1, 3, 6],
    [7, 4, 2, 5, 8],
    [9, 0, 3, 1, 10],   /* bottom pentagons */
    [10, 1, 5, 2, 11],
    [11, 2, 4, 0, 9]
  ];

  function buildMesh() {
    var positions = [], normals = [];
    for (var fi = 0; fi < FACES.length; fi++) {
      var verts = FACES[fi].map(function (i) { return V[i]; });
      var p0 = verts[0], p1 = verts[1], p2 = verts[2];
      var u = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
      var v = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
      var n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      /* The raw face winding is inconsistent. The solid is centred on the origin,
         so a normal pointing inward is exactly the case dot(n, p0) < 0. */
      if (n[0] * p0[0] + n[1] * p0[1] + n[2] * p0[2] < 0) {
        verts = verts.slice().reverse();
        n = [-n[0], -n[1], -n[2]];
      }
      var len = Math.hypot(n[0], n[1], n[2]) || 1;
      n = [n[0] / len, n[1] / len, n[2] / len];
      /* Fan-triangulate; every triangle carries the face normal, so each
         pentagon reads as one flat plane with no interior seam. */
      for (var i = 1; i < verts.length - 1; i++) {
        var tri = [verts[0], verts[i], verts[i + 1]];
        for (var t = 0; t < 3; t++) {
          positions.push(tri[t][0], tri[t][1], tri[t][2]);
          normals.push(n[0], n[1], n[2]);
        }
      }
    }
    return { positions: new Float32Array(positions), normals: new Float32Array(normals) };
  }

  /* --- tiny matrix helpers -------------------------------------------- */

  function perspective(fovDeg, aspect, near, far) {
    var f = 1 / Math.tan(fovDeg * Math.PI / 360), nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0
    ]);
  }
  function translation(x, y, z) {
    return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]);
  }
  function mul3(a, b) {   /* 3x3, column-major */
    var o = new Float32Array(9);
    for (var c = 0; c < 3; c++) for (var r = 0; r < 3; r++) {
      o[c * 3 + r] = a[r] * b[c * 3] + a[3 + r] * b[c * 3 + 1] + a[6 + r] * b[c * 3 + 2];
    }
    return o;
  }
  function rotX3(a) { var s = Math.sin(a), c = Math.cos(a);
    return new Float32Array([1,0,0, 0,c,s, 0,-s,c]); }
  function rotY3(a) { var s = Math.sin(a), c = Math.cos(a);
    return new Float32Array([c,0,-s, 0,1,0, s,0,c]); }
  function toMat4(m3, scale) {
    return new Float32Array([
      m3[0] * scale, m3[1] * scale, m3[2] * scale, 0,
      m3[3] * scale, m3[4] * scale, m3[5] * scale, 0,
      m3[6] * scale, m3[7] * scale, m3[8] * scale, 0,
      0, 0, 0, 1
    ]);
  }
  function norm3(v) {
    var l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }

  /* --- theme ----------------------------------------------------------- */

  function isDark() { return document.documentElement.classList.contains('dark'); }

  /* Lighting rig from the handoff. Light mode carries a dark solid on a pale
     page, so it needs the brighter setup to keep the facets apart. */
  var LIGHTING = {
    light: { ambient: 0.45, key: 2.40, fill: 0.60, spec: 0.05 },
    dark:  { ambient: 0.26, key: 0.58, fill: 0.16, spec: 0.14 }
  };
  var KEY_DIR = norm3([-4.0, 4.5, 5.5]);    /* top-left-front */
  var FILL_DIR = norm3([3.0, -1.5, 2.0]);   /* soft bottom-right */
  var CAM = [0, 0, 7.0];

  function shapeColor() {
    /* --color-black is the theme's foreground: deep plum on light, white on dark. */
    var raw = getComputedStyle(document.documentElement).getPropertyValue('--color-black');
    var m = raw && raw.match(/[\d.]+/g);
    if (!m || m.length < 3) return isDark() ? [1, 1, 1] : [0.125, 0.114, 0.153];
    return [m[0] / 255, m[1] / 255, m[2] / 255];
  }

  /* --- renderer -------------------------------------------------------- */

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error('[mld-shape]', gl.getShaderInfoLog(sh)); return null;
    }
    return sh;
  }

  function init(container) {
    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    container.appendChild(canvas);
    var gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true })
          || canvas.getContext('experimental-webgl', { alpha: true, antialias: true });
    if (!gl) return false;   /* no WebGL: the container stays empty, layout unaffected */

    var vs = compile(gl, gl.VERTEX_SHADER, VERT_SRC);
    var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vs || !fs) return false;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('[mld-shape]', gl.getProgramInfoLog(prog)); return false;
    }
    gl.useProgram(prog);

    var mesh = buildMesh();
    var triCount = mesh.positions.length / 3;

    var posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

    var nrmBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, nrmBuf);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.normals, gl.STATIC_DRAW);
    var aNormal = gl.getAttribLocation(prog, 'aNormal');
    gl.enableVertexAttribArray(aNormal);
    gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);

    var U = {};
    ['uProj','uView','uModel','uRot','uColor','uCam','uKeyDir','uFillDir',
     'uAmbient','uKey','uFill','uSpec'].forEach(function (n) {
      U[n] = gl.getUniformLocation(prog, n);
    });

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    gl.uniformMatrix4fv(U.uView, false, translation(-CAM[0], -CAM[1], -CAM[2]));
    gl.uniform3f(U.uCam, CAM[0], CAM[1], CAM[2]);
    gl.uniform3f(U.uKeyDir, KEY_DIR[0], KEY_DIR[1], KEY_DIR[2]);
    gl.uniform3f(U.uFillDir, FILL_DIR[0], FILL_DIR[1], FILL_DIR[2]);

    var scale = 1.62;

    function applyTheme() {
      var L = LIGHTING[isDark() ? 'dark' : 'light'];
      var c = shapeColor();
      gl.useProgram(prog);
      gl.uniform3f(U.uColor, c[0], c[1], c[2]);
      gl.uniform1f(U.uAmbient, L.ambient);
      gl.uniform1f(U.uKey, L.key);
      gl.uniform1f(U.uFill, L.fill);
      gl.uniform1f(U.uSpec, L.spec);
    }

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(container.clientWidth, 1), h = Math.max(container.clientHeight, 1);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.width = '100%'; canvas.style.height = '100%';
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(prog);
      gl.uniformMatrix4fv(U.uProj, false, perspective(38, w / h, 0.1, 100));
      /* Ease the solid down a touch in short boxes so it never crops. */
      var fit = Math.min(1, h / 460);
      scale = 1.62 * (0.82 + fit * 0.18);
    }

    applyTheme();
    resize();
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(container);
    else window.addEventListener('resize', resize);
    new MutationObserver(applyTheme)
      .observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    var visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }, { threshold: 0 })
        .observe(container);
    }
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var start = performance.now();
    (function tick() {
      if (visible) {
        var t = reduce ? 0.8 : (performance.now() - start) / 1000;
        var rot = mul3(rotX3(t * 0.30), rotY3(t * 0.45));
        gl.useProgram(prog);
        gl.uniformMatrix4fv(U.uModel, false, toMat4(rot, scale));
        gl.uniformMatrix3fv(U.uRot, false, rot);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, triCount);
      }
      requestAnimationFrame(tick);
    })();
    return true;
  }

  /* --- mount ------------------------------------------------------------ */

  /* Same rule as the hero pattern: the page is hydrated by React into <body>,
     so never inject into a React-owned subtree. The canvas lives in its own
     body-level element, positioned over the hero in document coordinates. */
  function heroEl() {
    var cta = document.querySelector('#hero-calendly');
    return cta && cta.closest('section');
  }

  function place(host) {
    var hero = heroEl();
    if (!hero) return;
    var r = hero.getBoundingClientRect();
    var cs = getComputedStyle(hero);
    var padL = parseFloat(cs.paddingLeft) || 0, padR = parseFloat(cs.paddingRight) || 0;
    var padT = parseFloat(cs.paddingTop) || 0, padB = parseFloat(cs.paddingBottom) || 0;
    var left = r.left + window.scrollX + padL;
    var right = r.right + window.scrollX - padR;
    var desktop = window.innerWidth >= 992;

    if (desktop) {
      /* Right-hand 40% of the hero's content column, filling its height. */
      var colW = (right - left) * 0.40;
      host.style.left = Math.round(right - colW) + 'px';
      host.style.width = Math.round(colW) + 'px';
      host.style.top = Math.round(r.top + window.scrollY + padT) + 'px';
      host.style.height = Math.max(Math.round(r.height - padT - padB), 300) + 'px';
    } else {
      /* Under the CTA, in the band the hero's bottom padding reserves for it. */
      var cta = document.getElementById('hero-calendly');
      var top = cta
        ? cta.getBoundingClientRect().bottom + window.scrollY + 24
        : r.top + window.scrollY + padT;
      var bottom = r.bottom + window.scrollY - 24;
      host.style.left = Math.round(left) + 'px';
      host.style.width = Math.round(right - left) + 'px';
      host.style.top = Math.round(top) + 'px';
      host.style.height = Math.max(Math.round(bottom - top), 240) + 'px';
    }
  }

  function mount() {
    if (document.querySelector('.mld-shape')) return;
    if (!heroEl()) return;
    var d = document.createElement('div');
    d.className = 'mld-shape';
    document.body.appendChild(d);
    place(d);
    if (!init(d)) { d.remove(); return; }
    document.documentElement.classList.add('mld-shape-on');
    var replace = function () { place(d); };
    window.addEventListener('resize', replace, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(replace).observe(document.body);
    [200, 800, 2000].forEach(function (ms) { setTimeout(replace, ms); });
  }

  function boot() { requestAnimationFrame(function () { requestAnimationFrame(mount); }); }
  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);
})();
