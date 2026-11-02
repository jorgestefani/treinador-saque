/* Geometria da câmera: homografia de um retângulo conhecido (lona ou quadrado de saque),
   distância focal e posição do celular, projeção de pontos 3D na imagem.
   Imagem: x para a direita, y para baixo. Câmera: z para a frente. */
(function (raiz) {
  function resolver(A, b) {             // eliminação de Gauss com pivô parcial (A n×n)
    var n = b.length, M = A.map(function (l, i) { return l.concat([b[i]]); });
    for (var c = 0; c < n; c++) {
      var p = c;
      for (var l = c + 1; l < n; l++) if (Math.abs(M[l][c]) > Math.abs(M[p][c])) p = l;
      var tmp = M[c]; M[c] = M[p]; M[p] = tmp;
      if (Math.abs(M[c][c]) < 1e-15) return null;
      for (l = c + 1; l < n; l++) { var f = M[l][c] / M[c][c]; for (var k = c; k <= n; k++) M[l][k] -= f * M[c][k]; }
    }
    var x = new Array(n);
    for (var i = n - 1; i >= 0; i--) { var s = M[i][n]; for (var j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; }
    return x;
  }
  function inversa(A) {
    var n = A.length, I = [];
    for (var j = 0; j < n; j++) { var e = A.map(function (_, i) { return i === j ? 1 : 0; }); var c = resolver(A, e); if (!c) return null; I.push(c); }
    return A.map(function (_, i) { return I.map(function (c) { return c[i]; }); });
  }
  /** Homografia plano→imagem a partir de 4 ou mais pares ([u,v] no plano, [x,y] na imagem), h33 = 1, mínimos quadrados. */
  function homografia(plano, img) {
    var AtA = [], Atb = [], i, j;
    for (i = 0; i < 8; i++) { AtA.push([0, 0, 0, 0, 0, 0, 0, 0]); Atb.push(0); }
    function soma(l, b) { for (var a = 0; a < 8; a++) { Atb[a] += l[a] * b; for (var c = 0; c < 8; c++) AtA[a][c] += l[a] * l[c]; } }
    for (i = 0; i < plano.length; i++) {
      var u = plano[i][0], v = plano[i][1], x = img[i][0], y = img[i][1];
      soma([u, v, 1, 0, 0, 0, -u * x, -v * x], x);
      soma([0, 0, 0, u, v, 1, -u * y, -v * y], y);
    }
    var h = resolver(AtA, Atb);
    if (!h) return null;
    return [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]];
  }
  function aplicarH(H, u, v) {
    var w = H[2][0] * u + H[2][1] * v + H[2][2];
    return [(H[0][0] * u + H[0][1] * v + H[0][2]) / w, (H[1][0] * u + H[1][1] * v + H[1][2]) / w];
  }
  function cruz(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function pesc(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function normal(a) { var n = Math.hypot(a[0], a[1], a[2]); return [a[0] / n, a[1] / n, a[2] / n]; }

  /**
   * Câmera a partir de um retângulo conhecido.
   * plano = {O, U, V}: ponto origem e eixos (unitários, perpendiculares) do plano no mundo; pontos do plano = O + u·U + v·V.
   * pts: [{uv:[u,v], img:[x,y]}] (≥ 4). larg/alt: tamanho da imagem. focalPadrao: usada se a estimativa falhar.
   * Devolve {R, t, f, cx, cy, C (posição do celular no mundo), H, erroPx}.
   */
  function camera(plano, pts, larg, alt, focalPadrao) {
    var cx = larg / 2, cy = alt / 2;
    var H = homografia(pts.map(function (p) { return p.uv; }), pts.map(function (p) { return p.img; }));
    if (!H) return null;
    // tira o centro da imagem
    var Hc = [0, 1, 2].map(function (c) { return [H[0][c] - cx * H[2][c], H[1][c] - cy * H[2][c], H[2][c]]; });
    var h1 = Hc[0], h2 = Hc[1], h3 = Hc[2];
    // ω = diag(w, w, 1), w = 1/f²: h1ᵀωh2 = 0 e h1ᵀωh1 = h2ᵀωh2 (mínimos quadrados em w)
    var A1 = h1[0] * h2[0] + h1[1] * h2[1], C1 = h1[2] * h2[2];
    var A2 = h1[0] * h1[0] + h1[1] * h1[1] - h2[0] * h2[0] - h2[1] * h2[1], C2 = h1[2] * h1[2] - h2[2] * h2[2];
    var w = -(A1 * C1 + A2 * C2) / (A1 * A1 + A2 * A2), f = w > 0 ? 1 / Math.sqrt(w) : NaN, estimada = true;
    if (!(f > focalPadrao * 0.5 && f < focalPadrao * 2)) { f = focalPadrao; estimada = false; }
    var k1 = [h1[0] / f, h1[1] / f, h1[2]], k2 = [h2[0] / f, h2[1] / f, h2[2]], k3 = [h3[0] / f, h3[1] / f, h3[2]];
    var lam = 2 / (Math.hypot(k1[0], k1[1], k1[2]) + Math.hypot(k2[0], k2[1], k2[2]));
    if (k3[2] * lam < 0) lam = -lam;                  // o plano fica na frente da câmera
    var r1 = k1.map(function (x) { return x * lam; }), r2 = k2.map(function (x) { return x * lam; }), t = k3.map(function (x) { return x * lam; });
    // ortonormaliza r1, r2 de forma simétrica
    var a = normal(r1), b = normal(r2), m = normal([a[0] + b[0], a[1] + b[1], a[2] + b[2]]), n = normal(cruz(a, b)), q = normal(cruz(n, m));
    var s = Math.SQRT1_2;
    r1 = normal([s * (m[0] + q[0]), s * (m[1] + q[1]), s * (m[2] + q[2])]);
    r2 = normal([s * (m[0] - q[0]), s * (m[1] - q[1]), s * (m[2] - q[2])]);
    if (pesc(r1, a) < pesc(r2, a)) { var tt = r1; r1 = r2; r2 = tt; }
    var r3 = cruz(r1, r2);
    // Rp = [r1 r2 r3] leva coordenadas do plano (u, v, n) para a câmera; no mundo: Rw = Rp · [U V N]ᵀ
    var N = cruz(plano.U, plano.V), Bw = [plano.U, plano.V, N];
    var R = [0, 1, 2].map(function (i) {
      return [0, 1, 2].map(function (j) { return r1[i] * Bw[0][j] + r2[i] * Bw[1][j] + r3[i] * Bw[2][j]; });
    });
    var RO = mul(R, plano.O), tw = [t[0] - RO[0], t[1] - RO[1], t[2] - RO[2]];
    var cam = { R: R, t: tw, f: f, cx: cx, cy: cy, H: H, focalEstimada: estimada, larg: larg, alt: alt };
    cam.C = mulT(R, [-tw[0], -tw[1], -tw[2]]);
    cam.erroPx = 0;
    pts.forEach(function (p) {
      var X = [plano.O[0] + p.uv[0] * plano.U[0] + p.uv[1] * plano.V[0], plano.O[1] + p.uv[0] * plano.U[1] + p.uv[1] * plano.V[1],
               plano.O[2] + p.uv[0] * plano.U[2] + p.uv[1] * plano.V[2]];
      var pr = projetar(cam, X); cam.erroPx = Math.max(cam.erroPx, Math.hypot(pr[0] - p.img[0], pr[1] - p.img[1]));
    });
    return cam;
  }
  function mul(R, x) { return [pesc(R[0], x), pesc(R[1], x), pesc(R[2], x)]; }
  function mulT(R, x) { return [R[0][0] * x[0] + R[1][0] * x[1] + R[2][0] * x[2], R[0][1] * x[0] + R[1][1] * x[1] + R[2][1] * x[2], R[0][2] * x[0] + R[1][2] * x[1] + R[2][2] * x[2]]; }
  /** Ponto do mundo → pixel. Devolve [x, y, profundidade]. */
  function projetar(cam, X) {
    var c = mul(cam.R, X); c[0] += cam.t[0]; c[1] += cam.t[1]; c[2] += cam.t[2];
    return [cam.f * c[0] / c[2] + cam.cx, cam.f * c[1] / c[2] + cam.cy, c[2]];
  }
  /** Pixel → ponto no plano (u, v) usando a homografia inversa. */
  function pixelNoPlano(cam, x, y) {
    if (!cam.Hi) cam.Hi = inversa(cam.H);
    return aplicarH(cam.Hi, x, y);
  }
  /** Rotação de Rodrigues (vetor de rotação → matriz). */
  function rodrigues(w) {
    var a = Math.hypot(w[0], w[1], w[2]);
    if (a < 1e-12) return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    var k = [w[0] / a, w[1] / a, w[2] / a], c = Math.cos(a), s = Math.sin(a), v = 1 - c;
    return [[c + k[0] * k[0] * v, k[0] * k[1] * v - k[2] * s, k[0] * k[2] * v + k[1] * s],
            [k[1] * k[0] * v + k[2] * s, c + k[1] * k[1] * v, k[1] * k[2] * v - k[0] * s],
            [k[2] * k[0] * v - k[1] * s, k[2] * k[1] * v + k[0] * s, c + k[2] * k[2] * v]];
  }
  function mulM(A, B) { return A.map(function (l) { return [0, 1, 2].map(function (j) { return l[0] * B[0][j] + l[1] * B[1][j] + l[2] * B[2][j]; }); }); }
  /**
   * Refina f, R e t minimizando o erro de reprojeção de pontos 3D conhecidos (não precisam estar num plano só).
   * Com pontos em dois planos (lona + marcas no chão) a distância focal fica bem determinada.
   */
  function refinarCamera(cam, X, img, fixarF, pri) {
    // pri (opcional) = {C: posição medida do celular, s: incerteza de cada eixo (m), sigmaPx: erro do toque (px)}
    var c = { R: cam.R, t: cam.t.slice(), f: cam.f, cx: cam.cx, cy: cam.cy, H: cam.H, larg: cam.larg, alt: cam.alt, focalEstimada: true };
    function com(p) {
      return { R: mulM(rodrigues([p[1], p[2], p[3]]), c.R), t: [c.t[0] + p[4], c.t[1] + p[5], c.t[2] + p[6]], f: c.f * Math.exp(p[0]), cx: c.cx, cy: c.cy };
    }
    function res(p) {
      var k = com(p), r = [], sp = pri ? pri.sigmaPx || 1.5 : 1;
      X.forEach(function (x, i) { var q = projetar(k, x); r.push((q[0] - img[i][0]) / sp, (q[1] - img[i][1]) / sp); });
      if (pri) {      // o celular está onde foi medido com a trena (altura principalmente)
        var C = mulT(k.R, [-k.t[0], -k.t[1], -k.t[2]]);
        for (var e = 0; e < 3; e++) r.push((C[e] - pri.C[e]) / pri.s[e]);
      }
      return r;
    }
    var p = [0, 0, 0, 0, 0, 0, 0], r = res(p), custo = r.reduce(function (s, x) { return s + x * x; }, 0), lam = 1e-3;
    var h = [1e-4, 1e-5, 1e-5, 1e-5, 1e-4, 1e-4, 1e-4];
    for (var it = 0; it < 50; it++) {
      var J = h.map(function (hh, k) { var q = p.slice(); q[k] += hh; return res(q).map(function (x, i) { return (x - r[i]) / hh; }); });
      if (fixarF) J[0] = J[0].map(function () { return 0; });
      var JtJ = J.map(function (a) { return J.map(function (b) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }); });
      var g = J.map(function (a) { var s = 0; for (var i = 0; i < a.length; i++) s -= a[i] * r[i]; return s; });
      var ok = false;
      for (var t = 0; t < 10; t++) {
        var A = JtJ.map(function (l, i) { return l.map(function (x, j) { return i === j ? x * (1 + lam) + 1e-9 : x; }); });
        var d = resolver(A, g); if (!d) { lam *= 10; continue; }
        var q = p.map(function (x, i) { return x + d[i]; }), rq = res(q), cq = rq.reduce(function (s, x) { return s + x * x; }, 0);
        if (cq < custo) { var ganho = custo - cq; p = q; r = rq; custo = cq; lam /= 3; ok = true; if (ganho < 1e-10) it = 99; break; }
        lam *= 8;
      }
      if (!ok) break;
    }
    var k = com(p);
    c.R = k.R; c.t = k.t; c.f = k.f;
    c.C = mulT(c.R, [-c.t[0], -c.t[1], -c.t[2]]);
    c.erroPx = 0; X.forEach(function (x, i) { var q = projetar(c, x); c.erroPx = Math.max(c.erroPx, Math.hypot(q[0] - img[i][0], q[1] - img[i][1])); });
    return c;
  }
  /** Pixel → ponto no plano horizontal z = zPlano (raio que sai do celular). */
  function pixelNaAltura(cam, x, y, zPlano) { return pixelNoPlanoEixo(cam, x, y, 2, zPlano); }
  /** Pixel → ponto no plano em que a coordenada "eixo" (0 = x, 2 = z) vale "valor". */
  function pixelNoPlanoEixo(cam, x, y, eixo, valor) {
    var d = mulT(cam.R, [(x - cam.cx) / cam.f, (y - cam.cy) / cam.f, 1]);   // direção no mundo
    if (Math.abs(d[eixo]) < 1e-9) return null;
    var k = (valor - cam.C[eixo]) / d[eixo]; if (k <= 0) return null;
    return [cam.C[0] + k * d[0], cam.C[1] + k * d[1], cam.C[2] + k * d[2]];
  }
  /** Câmera "olhando para" (usada nos testes). */
  function cameraOlhando(C, alvo, f, larg, alt) {
    var z = normal([alvo[0] - C[0], alvo[1] - C[1], alvo[2] - C[2]]), x = normal(cruz(z, [0, 0, 1])), y = cruz(z, x);
    var R = [x, y, z], t = mul(R, C).map(function (v) { return -v; });
    return { R: R, t: t, f: f, cx: larg / 2, cy: alt / 2, C: C, larg: larg, alt: alt };
  }
  var api = { pixelNaAltura: pixelNaAltura, pixelNoPlanoEixo: pixelNoPlanoEixo, refinarCamera: refinarCamera, rodrigues: rodrigues, resolver: resolver, inversa: inversa, homografia: homografia, aplicarH: aplicarH, camera: camera,
              projetar: projetar, pixelNoPlano: pixelNoPlano, cameraOlhando: cameraOlhando, cruz: cruz, normal: normal };
  if (typeof module !== 'undefined') module.exports = api; else raiz.Geom = api;
})(this);
