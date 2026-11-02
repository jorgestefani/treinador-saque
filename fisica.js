/* Física do saque: gravidade + arrasto + Magnus (efeito).
   Eixos: x = para a frente (rumo à rede / à lona), y = para a esquerda do sacador, z = para cima.
   Origem: no chão, na marca central da linha de fundo do sacador.
   Coeficientes: ajustes de Goodwill & Haake usados por Cross & Lindsey para bola de tênis. */
(function (raiz) {
  var G = 9.81, RHO = 1.2, M = 0.0577, R = 0.0335, A = Math.PI * R * R, K = RHO * A / (2 * M);
  var QUADRA = { rede: 11.885, saque: 18.285, fundo: 23.77, lateralSimples: 4.115, redeCentro: 0.914, redePoste: 1.07 };

  function coef(v, w) {               // w em rad/s
    if (w < 1) return { cd: 0.55, cl: 0 };
    var s = v / (R * w);
    return { cd: 0.55 + 1 / Math.pow(22.5 + 4.2 * Math.pow(s, 2.5), 0.4), cl: 1 / (2 + s) };
  }
  // ef = {rpm, eixo:[ex,ey,ez]} (eixo unitário; topspin = +y, slice de destro = +z)
  function acel(p, v, ef, fat) {
    var vv = Math.hypot(v[0], v[1], v[2]), w = ef ? ef.rpm * Math.PI / 30 : 0, c = coef(vv, w);
    var cd = c.cd * (fat ? fat.cd : 1), cl = c.cl * (fat ? fat.cl : 1);
    var a = [-K * cd * vv * v[0], -K * cd * vv * v[1], -G - K * cd * vv * v[2]];
    if (w > 0 && vv > 0) {
      var e = ef.eixo, cx = e[1] * v[2] - e[2] * v[1], cy = e[2] * v[0] - e[0] * v[2], cz = e[0] * v[1] - e[1] * v[0];
      var n = Math.hypot(cx, cy, cz) || 1;   // força de Magnus perpendicular a v, |F| ∝ CL v²
      a[0] += K * cl * vv * vv * cx / n; a[1] += K * cl * vv * vv * cy / n; a[2] += K * cl * vv * vv * cz / n;
    }
    return a;
  }
  /** Integra (RK4, 1 ms) até x >= xAlvo, até tocar o chão, ou até tMax. Devolve pontos {t,p,v}. */
  function voo(p0, v0, ef, opc) {
    opc = opc || {};
    var dt = opc.dt || 0.001, p = p0.slice(), v = v0.slice(), t = 0, pts = opc.guardar ? [{ t: 0, p: p.slice(), v: v.slice() }] : null;
    var xAlvo = typeof opc.xAlvo === 'number' ? opc.xAlvo : Infinity,   // null/undefined = sem plano-alvo
        tMax = opc.tMax || 3, fat = opc.fat;
    var ultimo = { t: 0, p: p.slice(), v: v.slice() };
    while (t < tMax) {
      var k1v = acel(p, v, ef, fat), k1p = v;
      var p2 = p.map(function (x, i) { return x + k1p[i] * dt / 2 }), v2 = v.map(function (x, i) { return x + k1v[i] * dt / 2 });
      var k2v = acel(p2, v2, ef, fat), k2p = v2;
      var p3 = p.map(function (x, i) { return x + k2p[i] * dt / 2 }), v3 = v.map(function (x, i) { return x + k2v[i] * dt / 2 });
      var k3v = acel(p3, v3, ef, fat), k3p = v3;
      var p4 = p.map(function (x, i) { return x + k3p[i] * dt }), v4 = v.map(function (x, i) { return x + k3v[i] * dt });
      var k4v = acel(p4, v4, ef, fat), k4p = v4;
      var np = p.map(function (x, i) { return x + dt / 6 * (k1p[i] + 2 * k2p[i] + 2 * k3p[i] + k4p[i]) });
      var nv = v.map(function (x, i) { return x + dt / 6 * (k1v[i] + 2 * k2v[i] + 2 * k3v[i] + k4v[i]) });
      // cruzou o plano x = xAlvo ou o chão: interpola linearmente dentro do passo
      if (np[0] >= xAlvo || np[2] <= R) {
        var f = np[0] >= xAlvo ? (xAlvo - p[0]) / (np[0] - p[0]) : (p[2] - R) / (p[2] - np[2]);
        if (np[0] >= xAlvo && np[2] <= R) f = Math.min((xAlvo - p[0]) / (np[0] - p[0]), (p[2] - R) / (p[2] - np[2]));
        var pf = p.map(function (x, i) { return x + (np[i] - x) * f }), vf = v.map(function (x, i) { return x + (nv[i] - x) * f });
        var r = { t: t + dt * f, p: pf, v: vf, chao: pf[2] <= R + 1e-6 && !(pf[0] >= xAlvo - 1e-9), pts: pts };
        if (pts) pts.push({ t: r.t, p: pf, v: vf });
        return r;
      }
      p = np; v = nv; t += dt;
      if (pts) pts.push({ t: t, p: p.slice(), v: v.slice() });
    }
    return { t: t, p: p, v: v, chao: false, pts: pts };
  }
  function vetorSaida(kmh, elevGrau, azGrau) {
    var v = kmh / 3.6, e = elevGrau * Math.PI / 180, a = azGrau * Math.PI / 180;
    return [v * Math.cos(e) * Math.cos(a), v * Math.cos(e) * Math.sin(a), v * Math.sin(e)];
  }
  /** Altura da rede no ponto y (a rede cede no meio: 0,914 no centro, 1,07 nos postes de simples ~5,03 m). */
  function alturaRede(y) { var u = Math.min(Math.abs(y) / 5.03, 1); return QUADRA.redeCentro + (QUADRA.redePoste - QUADRA.redeCentro) * u * u; }
  /** Veredito completo de um saque a partir do contato p0 e da velocidade v0. lado = +1 (quadrado à esquerda do sacador). */
  function veredito(p0, v0, ef, lado, fat) {
    lado = lado || 1;
    var r1 = voo(p0, v0, ef, { xAlvo: QUADRA.rede, fat: fat });
    if (r1.chao) return { res: 'curto', pRede: null, queda: r1.p, folgaRede: null };
    var folga = r1.p[2] - R - alturaRede(r1.p[1]);
    if (folga < 0) return { res: 'rede', folgaRede: folga, pRede: r1.p, queda: null };
    var r2 = voo(r1.p, r1.v, ef, { fat: fat });
    var q = r2.p, yl = q[1] * lado, res;
    if (q[0] > QUADRA.saque + R) res = 'longo';
    else if (yl < -R) res = 'fora_meio';
    else if (yl > QUADRA.lateralSimples + R) res = 'fora_lado';
    else res = 'dentro';
    return { res: res, folgaRede: folga, pRede: r1.p, queda: q, tQueda: r1.t + r2.t, vRede: r1.v };
  }
  /** Golpe de fundo (backhand/forehand) da linha de base: passa a rede e cai até a linha de fundo, dentro das laterais de simples. */
  function vereditoFundo(p0, v0, ef, lado, fat) {
    var r1 = voo(p0, v0, ef, { xAlvo: QUADRA.rede, fat: fat });
    if (r1.chao) return { res: 'curto', pRede: null, queda: r1.p, folgaRede: null };
    var folga = r1.p[2] - R - alturaRede(r1.p[1]);
    if (folga < 0) return { res: 'rede', folgaRede: folga, pRede: r1.p, queda: null };
    var r2 = voo(r1.p, r1.v, ef, { fat: fat }), q = r2.p, res;
    if (q[0] > QUADRA.fundo + R) res = 'longo';
    else if (Math.abs(q[1]) > QUADRA.lateralSimples + R) res = 'fora_lado';
    else res = 'dentro';
    return { res: res, folgaRede: folga, pRede: r1.p, queda: q, tQueda: r1.t + r2.t, vRede: r1.v, fundo: q[0] >= QUADRA.saque };
  }
  function vereditoJogo(jogo, p0, v0, ef, lado, fat) { return jogo === 'fundo' ? vereditoFundo(p0, v0, ef, lado, fat) : veredito(p0, v0, ef, lado, fat); }
  var EFEITOS = {
    chapado: { rpm: 1500, eixo: norm([0, 0.6, 0.4]) },
    slice:   { rpm: 2500, eixo: norm([0, 0.4, 0.9]) },
    kick:    { rpm: 3500, eixo: norm([0, 0.95, -0.3]) },
    nenhum:  { rpm: 0, eixo: [0, 1, 0] },
    fh_top:     { rpm: 2200, eixo: [0, 1, 0] },     // forehand com topspin (costuma ter mais efeito que o backhand)
    fh_chapado: { rpm: 500, eixo: [0, 1, 0] },
    fh_slice:   { rpm: 900, eixo: [0, -1, 0] },
    bh_top:     { rpm: 1800, eixo: [0, 1, 0] },     // backhand com topspin
    bh_chapado: { rpm: 400, eixo: [0, 1, 0] },
    bh_slice:   { rpm: 1000, eixo: [0, -1, 0] }     // backhand cortado (backspin)
  };
  function norm(e) { var n = Math.hypot(e[0], e[1], e[2]); return e.map(function (x) { return x / n }); }
  var api = { voo: voo, veredito: veredito, vereditoFundo: vereditoFundo, vereditoJogo: vereditoJogo, vetorSaida: vetorSaida, alturaRede: alturaRede, coef: coef, acel: acel,
              QUADRA: QUADRA, EFEITOS: EFEITOS, norm: norm, R: R, K: K, G: G };
  if (typeof module !== 'undefined') module.exports = api; else raiz.Fisica = api;
})(this);
