/* Reconstrução do saque: ajusta a trajetória física (gravidade + arrasto + efeito) às observações
   — a bola em cada quadro do vídeo, o "clac" e o "tum" do microfone e o ponto onde bateu na lona —
   e prolonga o voo até a quadra oficial. */
(function (raiz) {
  var F = raiz.Fisica || (typeof require !== 'undefined' ? require('./fisica.js') : null);
  var G = raiz.Geom || (typeof require !== 'undefined' ? require('./geom.js') : null);
  var SOM = 343;   // m/s

  // parâmetros: [x0, y0, z0, vx, vy, vz, wy, wz, tau]  (w em rad/s: wy = topspin, wz = slice; tau em s)
  function efeitoDe(p) {
    var w = Math.hypot(p[6], p[7]);
    return w < 1 ? null : { rpm: w * 30 / Math.PI, eixo: [0, p[6] / w, p[7] / w] };
  }
  /** Posições nos tempos pedidos (s depois do contato) e o cruzamento do plano x = xLona. */
  function trajetoria(p, tempos, xLona, fat, ateChao) {
    var tMax = Math.max(0.05, Math.max.apply(null, tempos.concat([0])) + 0.01);
    var r = F.voo([p[0], p[1], p[2]], [p[3], p[4], p[5]], efeitoDe(p), { guardar: true, tMax: xLona || ateChao ? 2.5 : tMax, xAlvo: xLona || undefined, fat: fat });
    var pts = r.pts, pos = tempos.map(function (t) {
      if (t <= 0) return pts[0].p;
      var i = Math.min(pts.length - 1, Math.max(1, Math.ceil(t / 0.001)));
      while (i < pts.length - 1 && pts[i].t < t) i++;
      var a = pts[i - 1], b = pts[i], f = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
      return [a.p[0] + f * (b.p[0] - a.p[0]), a.p[1] + f * (b.p[1] - a.p[1]), a.p[2] + f * (b.p[2] - a.p[2])];
    });
    return { pos: pos, cruz: xLona && r.p[0] >= xLona - 1e-6 ? { t: r.t, p: r.p } : null, chao: r.chao ? { t: r.t, p: r.p } : null };
  }
  /**
   * dados = {
   *   cam, obs: [{t, x, y}] (tempo do quadro no relógio do vídeo, s), tClac, tTum (relógio do áudio, s; tTum opcional),
   *   impacto: [x, y, z] no mundo (opcional), xLona (opcional),
   *   priori: {p0:[..], sp0:[..], w:[wy, wz], sw:[..], tau, stau}, sigmaPx, fat
   * }
   */
  function ajustar(dados, opc) {
    opc = opc || {};
    var pr = dados.priori, sPx = dados.sigmaPx || 3, temLona = dados.xLona && dados.tTum !== undefined && dados.impacto;
    var obs = dados.obs.slice();
    function residuos(p) {
      var t0 = dados.tClac + p[8], tempos = obs.map(function (o) { return o.t - t0; });
      var tr = trajetoria(p, tempos, temLona ? dados.xLona : null, dados.fat, !!dados.quique), r = [];
      obs.forEach(function (o, i) {
        var pp = G.projetar(dados.cam, tr.pos[i]);
        if (tempos[i] < -0.002 || pp[2] <= 0) { r.push(0, 0); return; }
        r.push((pp[0] - o.x) / sPx, (pp[1] - o.y) / sPx);
      });
      if (temLona) {
        if (!tr.cruz) { r.push(50, 50, 50); }
        else {
          var C = dados.cam.C, dC = Math.hypot(p[0] - C[0], p[1] - C[1], p[2] - C[2]);
          var dI = Math.hypot(tr.cruz.p[0] - C[0], tr.cruz.p[1] - C[1], tr.cruz.p[2] - C[2]);
          var Tobs = dados.tTum - dados.tClac, Tmod = tr.cruz.t + (dI - dC) / SOM;
          r.push((Tmod - Tobs) / 0.0015, (tr.cruz.p[1] - dados.impacto[1]) / 0.03, (tr.cruz.p[2] - dados.impacto[2]) / 0.03);
        }
      }
      if (dados.quique) {        // quique visto no chão (modo quadra): âncora do fim do voo
        if (!tr.chao) r.push(50, 50); else var sq = dados.sigmaQuique || 0.25; r.push((tr.chao.p[0] - dados.quique[0]) / sq, (tr.chao.p[1] - dados.quique[1]) / Math.max(0.08, sq / 3));
      }
      for (var k = 0; k < 3; k++) r.push((p[k] - pr.p0[k]) / pr.sp0[k]);
      r.push((p[6] - pr.w[0]) / pr.sw[0], (p[7] - pr.w[1]) / pr.sw[1], (p[8] - pr.tau) / pr.stau);
      return r;
    }
    var p = dados.inicial.slice(), H = [0.005, 0.005, 0.005, 0.05, 0.05, 0.05, 3, 3, 0.0005];
    var r = residuos(p), custo = soma2(r), lam = 1e-3, J;
    for (var it = 0; it < (opc.iter || 25); it++) {
      J = H.map(function (h, k) { var q = p.slice(); q[k] += h; var rq = residuos(q); return rq.map(function (x, i) { return (x - r[i]) / h; }); });
      var n = p.length, JtJ = [], Jtr = [];
      for (var a = 0; a < n; a++) { JtJ.push([]); Jtr.push(-pescV(J[a], r)); for (var b = 0; b < n; b++) JtJ[a].push(pescV(J[a], J[b])); }
      var melhorou = false;
      for (var tent = 0; tent < 8; tent++) {
        var A = JtJ.map(function (l, i) { return l.map(function (x, j) { return i === j ? x * (1 + lam) + 1e-9 : x; }); });
        var d = G.resolver(A, Jtr);
        if (!d) { lam *= 10; continue; }
        var q = p.map(function (x, i) { return x + d[i]; }), rq = residuos(q), cq = soma2(rq);
        if (cq < custo) { p = q; r = rq; var ganho = custo - cq; custo = cq; lam = Math.max(lam / 3, 1e-7); melhorou = true;
          if (ganho < 1e-4 * custo) it = 99; break; }
        lam *= 8;
      }
      if (!melhorou) break;
    }
    // covariância ≈ (JᵀJ)⁻¹ no ponto final
    J = H.map(function (h, k) { var q = p.slice(); q[k] += h; var rq = residuos(q); return rq.map(function (x, i) { return (x - r[i]) / h; }); });
    var JtJf = J.map(function (a) { return J.map(function (b) { return pescV(a, b); }); }), Cov = G.inversa(JtJf);
    var nObs = obs.length, resPx = 0;
    for (var i = 0; i < nObs; i++) resPx += r[2 * i] * r[2 * i] + r[2 * i + 1] * r[2 * i + 1];
    return { p: p, custo: custo, cov: Cov, rmsPx: nObs ? Math.sqrt(resPx / nObs) * sPx : 0, residuos: r };
  }
  function soma2(r) { var s = 0; for (var i = 0; i < r.length; i++) s += r[i] * r[i]; return s; }
  function pescV(a, b) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }

  /** Veredito na quadra + incerteza do ponto de queda (propagando a covariância). */
  function avaliar(aj, lado, fat, jogo) {
    var p = aj.p, v = F.vereditoJogo(jogo, [p[0], p[1], p[2]], [p[3], p[4], p[5]], efeitoDe(p), lado, fat);
    var sx = null, sy = null;
    if (aj.cov && v.queda) {
      var H = [0.005, 0.005, 0.005, 0.05, 0.05, 0.05, 3, 3, 0], gx = [], gy = [];
      for (var k = 0; k < 9; k++) {
        if (!H[k]) { gx.push(0); gy.push(0); continue; }
        var q = p.slice(); q[k] += H[k];
        var r2 = F.voo([q[0], q[1], q[2]], [q[3], q[4], q[5]], efeitoDe(q), { fat: fat });
        gx.push((r2.p[0] - v.queda[0]) / H[k]); gy.push((r2.p[1] - v.queda[1]) / H[k]);
      }
      var vx = 0, vy = 0;
      for (var a = 0; a < 9; a++) for (var b = 0; b < 9; b++) { vx += gx[a] * aj.cov[a][b] * gx[b]; vy += gy[a] * aj.cov[a][b] * gy[b]; }
      sx = Math.sqrt(Math.max(vx, 0)); sy = Math.sqrt(Math.max(vy, 0));
    }
    v.sx = sx; v.sy = sy;
    v.kmh = Math.hypot(p[3], p[4], p[5]) * 3.6;
    v.elev = Math.atan2(p[5], Math.hypot(p[3], p[4])) * 180 / Math.PI;
    v.az = Math.atan2(p[4], p[3]) * 180 / Math.PI;
    var e = efeitoDe(p); v.rpm = e ? e.rpm : 0; v.top = p[6] * 30 / Math.PI; v.lateral = p[7] * 30 / Math.PI;
    v.contato = [p[0], p[1], p[2]];
    return v;
  }
  /** Quanto mudar a mira (em graus) para cair no meio do quadrado, mantendo velocidade e efeito. */
  function correcao(p, lado, fat, jogo) {
    var ef = efeitoDe(p), sp = Math.hypot(p[3], p[4], p[5]), el = Math.atan2(p[5], Math.hypot(p[3], p[4])), az = Math.atan2(p[4], p[3]);
    function quedaCom(de, da) {
      var e = el + de * Math.PI / 180, a = az + da * Math.PI / 180;
      var v0 = [sp * Math.cos(e) * Math.cos(a), sp * Math.cos(e) * Math.sin(a), sp * Math.sin(e)];
      return F.vereditoJogo(jogo, [p[0], p[1], p[2]], v0, ef, lado, fat);
    }
    // varre a elevação: janela de "dentro" (ignorando a lateral) e mira no meio dela
    var ok = [];
    for (var de = -8; de <= 8; de += 0.05) { var r = quedaCom(de, 0); if (r.res !== 'rede' && r.res !== 'longo' && r.res !== 'curto') ok.push(de); }
    var dElev = ok.length ? (ok[0] + ok[ok.length - 1]) / 2 : null;
    // lateral: o mínimo para entrar com 40 cm de folga (sem puxar tudo para o meio do quadrado)
    var base = quedaCom(dElev || 0, 0), dAz = 0;
    if (base.queda) {
      var yl = base.queda[1] * (lado || 1), alvoY = jogo === 'fundo' ? Math.min(Math.max(base.queda[1], -3.7), 3.7) : Math.min(Math.max(yl, 0.4), 3.7) * (lado || 1), dist = Math.hypot(base.queda[0] - p[0], base.queda[1] - p[1]);
      dAz = Math.atan2(alvoY - base.queda[1], dist) * 180 / Math.PI;
    }
    return { dElev: dElev, dAz: dAz, janela: ok.length ? [ok[0], ok[ok.length - 1]] : null };
  }
  var api = { ajustar: ajustar, avaliar: avaliar, correcao: correcao, trajetoria: trajetoria, efeitoDe: efeitoDe, SOM: SOM };
  if (typeof module !== 'undefined') module.exports = api; else raiz.Ajuste = api;
})(this);
