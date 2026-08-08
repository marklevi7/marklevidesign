/* mld-shape-durer — Dürer's solid, as a library.

   Geometry per the handoff: a rhombohedron whose rhombic faces have a 72 degree
   acute angle, with both 3-fold apexes truncated at 1/phi — the one depth that
   lands all 12 vertices on a shared circumsphere. 12 verts, 8 faces (2 triangle
   caps + 6 pentagons), 18 edges.

   The handoff drives this through three.js off a CDN. three.js here would only
   be transforming a mesh and lighting it, and the site's visuals deliberately
   carry no CDN dependency (see CLAUDE.md), so this is the same geometry and the
   same rig on plain WebGL.

   This file draws nothing on its own. It hands the mesh, the shaders and the
   lighting to whoever wants to render it — currently the composite pattern,
   which renders the solid into the dither field so the pixelation filter runs
   over it too. shape-durer-standalone.js is the earlier version that owned its
   own canvas and sat on top of the pattern; kept as the undo path. */
(function () {
  /* Writes the lighting term, not a colour: the dither pass decides how a
     shading value becomes dot coverage, and that mapping flips between themes. */
  var VERT_SRC =
    '#version 300 es\n' +
    'in vec3 aPos;in vec3 aNormal;' +
    'uniform mat4 uProj;uniform mat4 uView;uniform mat4 uModel;uniform mat3 uRot;' +
    'out vec3 vN;out vec3 vW;' +
    'void main(){vec4 wp=uModel*vec4(aPos,1.0);vW=wp.xyz;vN=uRot*aNormal;' +
    'gl_Position=uProj*uView*wp;}';

  var FRAG_SRC =
    '#version 300 es\n' +
    'precision highp float;' +
    'uniform vec3 uCam;uniform vec3 uKeyDir;uniform vec3 uFillDir;' +
    'uniform float uAmbient;uniform float uKey;uniform float uFill;' +
    'in vec3 vN;in vec3 vW;' +
    'out vec4 fragColor;' +
    'void main(){' +
    'vec3 N=normalize(vN);' +
    'float k=max(dot(N,uKeyDir),0.0);' +
    'float f=max(dot(N,uFillDir),0.0);' +
    'float d=uAmbient+uKey*k+uFill*f;' +
    'float dn=clamp((d-uAmbient)/(uKey+uFill),0.0,1.0);' +
    'fragColor=vec4(dn,0.0,0.0,1.0);}';

  var H = Math.sqrt((3 * Math.sqrt(5) + 5) / 10);   /* rhombohedron half-height */
  var P = 2.0 / (1.0 + Math.sqrt(5));               /* truncation depth, 1/phi   */
  var zM = H / 2, zC = H * (1.5 - P);
  var rM = 1.0, rC = P, s60 = Math.sqrt(3) / 2;

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
    [6, 7, 8],          /* top triangle     */
    [9, 10, 11],        /* bottom triangle  */
    [6, 3, 0, 4, 7],    /* top pentagons    */
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

  window.MLD_DURER = {
    VERT_SRC: VERT_SRC,
    FRAG_SRC: FRAG_SRC,
    buildMesh: buildMesh,
    /* Lighting rig from the handoff: strong key top-left-front, soft fill
       bottom-right, ambient floor. The key carries a third more weight than it
       did, which widens the spread of the shading term rather than just
       raising it - a uniform scale of key and fill would cancel out, since the
       shader normalises by their sum. */
    LIGHTING: { ambient: 0.42, key: 1.73, fill: 0.34 },
    KEY_DIR: norm3([-4.0, 4.5, 5.5]),
    FILL_DIR: norm3([3.0, -1.5, 2.0]),
    CAM: [0, 0, 7.0],
    FOV: 38,
    /* Radians per second, from the handoff. */
    SPIN_Y: 0.45,
    SPIN_X: 0.30,
    perspective: perspective,
    translation: translation,
    mul3: mul3, rotX3: rotX3, rotY3: rotY3, toMat4: toMat4
  };
})();
