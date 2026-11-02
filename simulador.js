/* Simulador de golpes: gera saques/golpes com física real (gravidade, ar e efeito), o que a câmera e o microfone
   veriam (com ruído, manchas falsas e quadros perdidos) e passa tudo pela mesma análise do app.
   Serve para o botão "Testar a precisão desta montagem" e para a bateria de testes (bateria.js). */
(function () {
  var F = Fisica, G = Geom, A = Ajuste;
  var sem = 1;
  function rnd() { sem = (sem * 16807) % 2147483647; return sem / 2147483647; }
  function gs() { return Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd()); }
  function mediana(l) { var s = l.slice().sort(function (a, b) { return a - b; }); return s.length ? s[s.length >> 1] : NaN; }
  function pct(l, p) { var s = l.slice().sort(function (a, b) { return a - b; }); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : NaN; }
  var LARG = 1920, ALT = 1080, FOCAL = 1450;        // câmera principal do iPhone em 1080p, ~67° na horizontal

  /** Posição do celular no mundo a partir das medidas do tripé (atrás do contato, ao lado, altura). */
  function posicaoCelular(cel) {
    var p0 = TS.contatoNominal(), lado = cel.ladoEsq === false ? -1 : 1;
    return [p0[0] - cel.atras, p0[1] + lado * cel.lado, cel.h];
  }
  /** Pontos que precisam aparecer na imagem: os da calibração, o contato e (na parede) a bola alta. */
  function pontosEssenciais() {
    var p0 = TS.contatoNominal(), pts = TS.pontosDoModo().map(function (p) { return { nome: p.nome, X: p.X }; });
    pts.push({ nome: 'contato', X: p0 }, { nome: 'bola logo acima do contato', X: [p0[0], p0[1], p0[2] + 0.25] });
    if (TS.cfg.modo === 'parede') { var L = TS.lona(); pts.push({ nome: 'bola alta na parede', X: [L.x, 0, Math.min(L.zt + 1.7, 4)] }); }
    return pts;
  }
  /** Para onde apontar o celular (como a pessoa faz): o centro dos ângulos de todos os pontos essenciais. */
  function miraCelular(C) {
    C = C || posicaoCelular(TS.cfg.cel);
    if (TS.cfg.modo === 'quadra') return [12, 1.5 * TS.cfg.lado, 0.8];      // na quadra: olhando para o quadrado de saque
    var pts = pontosEssenciais(), az = [], el = [], dm = 0;
    pts.forEach(function (p) { var d = [p.X[0] - C[0], p.X[1] - C[1], p.X[2] - C[2]], h = Math.hypot(d[0], d[1]); az.push(Math.atan2(d[1], d[0])); el.push(Math.atan2(d[2], h)); dm += Math.hypot(d[0], d[1], d[2]) / pts.length; });
    var a = (Math.min.apply(null, az) + Math.max.apply(null, az)) / 2, e = (Math.min.apply(null, el) + Math.max.apply(null, el)) / 2;
    return [C[0] + dm * Math.cos(e) * Math.cos(a), C[1] + dm * Math.cos(e) * Math.sin(a), C[2] + dm * Math.sin(e)];
  }

  /** Prepara uma calibração simulada. c.usarCfg = usa a montagem atual do usuário (não mexe nas medidas). */
  function preparar(c) {
    var cfg = TS.cfg;
    if (!c.usarCfg) {
      cfg.modo = c.modo; cfg.lado = c.lado || 1;
      if (c.modo === 'lona') cfg.mont = { d: c.d, hc: c.hcInformado || 2.65, larg: 3.5, zb: 0.9, zt: 3.0, esq: 2.8 };
      if (c.modo === 'parede') cfg.par = { d: c.d, hc: c.hcInformado || 0.95, larg: 3, fita: 1.35 };
    }
    cfg.tau.lista = []; cfg.contato = {};
    var p0 = TS.contatoNominal();
    var C = c.cel ? posicaoCelular(c.cel) : (function () { var pos = c.celular || [-1.5, 1.9 * cfg.lado, 1.5]; return [p0[0] + pos[0], pos[1], pos[2]]; })();
    var camV = G.cameraOlhando(C, c.alvoCam || miraCelular(C), c.focal || FOCAL, LARG, ALT);
    var todos = TS.pontosDoModo().map(function (p) { var q = G.projetar(camV, p.X); return { nome: p.nome, X: p.X, img: [q[0] + gs() * (c.ruidoToque || 1.5), q[1] + gs() * (c.ruidoToque || 1.5)], visivel: q[2] > 0 && q[0] >= 0 && q[0] <= LARG && q[1] >= 0 && q[1] <= ALT }; });
    // como na vida real: só dá para tocar nos pontos que aparecem na imagem (os 4 do alvo são obrigatórios)
    if (todos.slice(0, 4).some(function (p) { return !p.visivel; })) throw new Error('Os 4 cantos do alvo não cabem na imagem com o tripé nesta posição.');
    var pts = todos.filter(function (p) { return p.visivel; });
    var plano, uvs;
    if (cfg.modo === 'quadra') { plano = { O: [0, 0, 0], U: [1, 0, 0], V: [0, 1, 0] }; uvs = pts.slice(0, 4).map(function (p) { return { uv: [p.X[0], p.X[1]], img: p.img }; }); }
    else { var L = TS.lona(); plano = { O: [L.x, L.yDir, L.zb], U: [0, 1, 0], V: [0, 0, 1] }; uvs = pts.slice(0, 4).map(function (p) { return { uv: [p.X[1] - L.yDir, p.X[2] - L.zb], img: p.img }; }); }
    var cam = G.camera(plano, uvs, LARG, ALT, 1440);
    var pri = null;
    if (c.priC) {                // o usuário mediu o tripé com a trena: altura ±2 cm, posição ±8 cm
      var Cm = [C[0] + gs() * 0.08, C[1] + gs() * 0.08, C[2] + gs() * 0.02];
      pri = { C: Cm, s: [0.10, 0.10, 0.03], sigmaPx: c.ruidoToque || 1.5 };
    }
    cam = G.refinarCamera(cam, pts.map(function (p) { return p.X; }), pts.map(function (p) { return p.img; }), false, pri);
    cam.H = TS.hDoPlano(cam, plano);
    var cal = { R: cam.R, t: cam.t, f: cam.f, cx: cam.cx, cy: cam.cy, C: cam.C, H: cam.H, W: LARG, Ht: ALT, erroPx: cam.erroPx, pontos: pts, quando: Date.now() };
    return { camV: camV, cam: TS.camDe(cal), p0: p0, visiveis: pts.length, total: todos.length, erroFocal: Math.abs(cam.f - FOCAL) / FOCAL };
  }

  /** Um golpe simulado: devolve verdade × medido. */
  function golpe(c, ctx, g) {
    var cfg = TS.cfg, p0n = ctx.p0, camV = ctx.camV, fps = c.fps || 60;
    cfg.tipo = g.tipo;
    var ef = { rpm: g.rpm, eixo: F.EFEITOS[g.tipo].eixo }, hReal = c.hcReal || p0n[2];
    var p0 = [p0n[0] + gs() * 0.08, p0n[1] + gs() * 0.12, hReal + gs() * (cfg.modo === 'parede' ? 0.12 : 0.06)];
    var v0 = F.vetorSaida(g.kmh, g.el, g.az), jogo = cfg.modo === 'parede' ? 'fundo' : 'saque';
    var verd = F.vereditoJogo(jogo, p0, v0, ef, cfg.lado);
    var tau = c.tau !== undefined ? c.tau : 0.031, tClac = 100, w = g.rpm * Math.PI / 30;
    var par = [p0[0], p0[1], p0[2], v0[0], v0[1], v0[2], ef.eixo[1] * w, ef.eixo[2] * w, 0];
    var qs = [], fase = rnd() / fps, tTum = null, l = null, xAlvo = null;
    if (cfg.modo !== 'quadra') {
      var L = TS.lona(); xAlvo = L.x;
      l = F.voo(p0, v0, ef, { xAlvo: L.x - F.R });
      if (l.chao) return null;                  // bola que quica antes do alvo: fora do teste
      tTum = tClac + l.t + (Math.hypot(l.p[0] - camV.C[0], l.p[1] - camV.C[1], l.p[2] - camV.C[2]) - Math.hypot(p0[0] - camV.C[0], p0[1] - camV.C[1], p0[2] - camV.C[2])) / 343;
      tTum += gs() * 0.0005;
    }
    var tFim = l ? l.t : (verd.tQueda || 1.0), tClacObs = tClac + gs() * 0.0005;
    for (var tv = tClac - 0.2 + fase; tv < tClac + 1.3; tv += 1 / fps) {
      var b = [], tt = tv - (tClac + tau);
      for (var k = 0; k < (c.falsas !== undefined ? c.falsas : 1); k++) b.push({ x: 200 + rnd() * 1600, y: 80 + rnd() * 900, n: 4 + rnd() * 10 });
      if (tt > 0 && tt < tFim && rnd() > (c.perdidos !== undefined ? c.perdidos : 0.1)) {
        var P = A.trajetoria(par, [tt]).pos[0], q = G.projetar(camV, P);
        if (q[2] > 0 && q[0] > 0 && q[0] < LARG && q[1] > 0 && q[1] < ALT) b.push({ x: q[0] + gs() * (c.ruidoPx || 2.5), y: q[1] + gs() * (c.ruidoPx || 2.5), n: 20 });
      }
      if (!l && verd.queda && tt >= verd.tQueda && tt < verd.tQueda + 0.25 && rnd() > 0.1) {     // depois do quique (modo quadra)
        var dq = tt - verd.tQueda, vq = verd.vRede || v0, Pq = [verd.queda[0] + vq[0] * 0.6 * dq, verd.queda[1] + vq[1] * 0.6 * dq, F.R + 6 * dq - 4.9 * dq * dq];
        var qq = G.projetar(camV, Pq); if (qq[2] > 0) b.push({ x: qq[0] + gs() * (c.ruidoPx || 2.5), y: qq[1] + gs() * (c.ruidoPx || 2.5), n: 12 });
      }
      if (l && tt >= l.t && tt < l.t + 0.06) {          // bola encostada/caindo junto ao alvo
        var q2 = G.projetar(camV, [xAlvo - F.R - (tt - l.t) * (cfg.modo === 'parede' ? 6 : 1), l.p[1], l.p[2] - (tt - l.t) * 1.5]);
        if (q2[2] > 0 && q2[0] > 0 && q2[0] < LARG && q2[1] > 0 && q2[1] < ALT) b.push({ x: q2[0] + gs() * 2, y: q2[1] + gs() * 2, n: 20 });
      }
      qs.push({ t: tv, b: b });
    }
    var tp = TS.tauPriori(), pe = TS.prioriEfeito(), pc = TS.prioriContato();
    var priori = { p0: pc.p0, sp0: pc.s, w: pe.w, sw: pe.sw, tau: tp.m, stau: tp.s };
    var br = { tClac: tClacObs, tTum: tTum, quadros: qs }, t0 = performance.now(), r;
    try { r = cfg.modo === 'quadra' ? TS.analisarQuadra(br, ctx.cam, priori) : TS.analisarLona(br, ctx.cam, priori); }
    catch (e) { r = { erro: e.message }; }
    var ms = performance.now() - t0;
    if (r && !r.nada && !r.erro) {
      if (r.nObs >= 5 && Math.abs(r.tau - tp.m) < 3 * tp.s) { cfg.tau.lista.push(r.tau); cfg.tau.lista = cfg.tau.lista.slice(-25); }
      TS.aprenderContato(r);
    }
    return { verd: verd, r: r, ms: ms, g: g };
  }
  /** Gera golpes variados do tipo certo para o modo. */
  function sortear(c) {
    var cfg = TS.cfg, lado = cfg.lado || 1;
    if (cfg.modo === 'parede') {
      var tipos = c.tipos || ['fh_top', 'bh_top', 'fh_slice', 'bh_chapado', 'fh_chapado', 'bh_slice'], t = tipos[Math.floor(rnd() * tipos.length)];
      var v = 70 + rnd() * 60, el = (/slice/.test(t) ? 5 : /chapado/.test(t) ? 5.5 : 9) + (v < 95 ? 3 : 0) + (rnd() - 0.5) * 9;
      return { tipo: t, kmh: v, el: el, az: (rnd() - 0.5) * 18, rpm: F.EFEITOS[t].rpm * (0.5 + rnd()) };
    }
    var tp = (c.tipos || ['chapado', 'slice', 'kick'])[Math.floor(rnd() * (c.tipos ? c.tipos.length : 3))], vv = 110 + rnd() * 80;
    var el2 = { chapado: -3, slice: -3.2, kick: -1 }[tp] + (vv < 140 ? 1.5 : 0) + (vv > 170 ? -1 : 0) + (rnd() - 0.5) * 3.5;
    el2 += (2.65 - TS.contatoNominal()[2]) * 5;      // contato mais alto pede saída mais para baixo
    return { tipo: tp, kmh: vv, el: el2, az: (3 + rnd() * 12) * lado, rpm: F.EFEITOS[tp].rpm * (0.5 + rnd()) };
  }
  function resumir(c, res, falhas) {
    var cfg = TS.cfg;
    var dist = res.filter(function (x) { return x.verd.queda && x.r.queda; }).map(function (x) { return Math.hypot(x.verd.queda[0] - x.r.queda[0], x.verd.queda[1] - x.r.queda[1]) * 100; });
    var certo = res.filter(function (x) { return (x.verd.res === 'dentro') === (x.r.res === 'dentro'); }).length;
    var confiantes = res.filter(function (x) {
      if ((x.verd.res === 'dentro') === (x.r.res === 'dentro')) return false;
      var m = x.r.queda ? Math.min(Math.abs(x.r.queda[0] - 11.885), Math.abs((cfg.modo === 'parede' ? 23.77 : 18.285) - x.r.queda[0])) : 1;
      return !(x.r.sx && m < Math.max(x.r.sx, x.r.sy || 0));
    }).length;
    var vel = res.map(function (x) { return Math.abs(x.r.kmh - x.g.kmh); }), ms = res.map(function (x) { return x.ms; });
    return { cenario: c.nome, golpes: res.length, semLeitura: falhas, certos: certo, pctCerto: Math.round(100 * certo / Math.max(1, res.length)),
             veredito: certo + '/' + res.length + ' (' + Math.round(100 * certo / Math.max(1, res.length)) + '%)', errosConfiantes: confiantes,
             quedaMedianaCm: Math.round(mediana(dist)), queda90Cm: Math.round(pct(dist, 0.9)), velMed: +mediana(vel).toFixed(1), vel90: +pct(vel, 0.9).toFixed(1),
             msMed: Math.round(mediana(ms)), msMax: Math.round(Math.max.apply(null, ms.concat([0]))) };
  }
  /** Roda N golpes de um cenário (síncrono; para a bateria). */
  function rodar(c) {
    sem = c.semente || 12345;
    var ctx = preparar(c), res = [], falhas = 0, tent = 0;
    while (res.length + falhas < (c.n || 40) && tent++ < (c.n || 40) * 4) {
      var g = golpe(c, ctx, c.golpe ? c.golpe(res.length) : sortear(c));
      if (!g) continue;
      if (!g.r || g.r.nada || g.r.erro) { falhas++; continue; }
      res.push(g);
    }
    var s = resumir(c, res, falhas); s.visiveis = ctx.visiveis + '/' + ctx.total; return s;
  }
  /** Estalos sem bola (quique no chão, palmas): o app não pode inventar golpe. */
  function semBola(c) {
    sem = 777; var ctx = preparar(c), falsos = 0;
    for (var i = 0; i < (c.n || 20); i++) {
      var qs = [];
      for (var tv = 99.8; tv < 101.3; tv += 1 / 60) { var b = []; for (var k = 0; k < 3; k++) b.push({ x: 200 + rnd() * 1600, y: 80 + rnd() * 900, n: 5 }); qs.push({ t: tv, b: b }); }
      var tp = TS.tauPriori(), pe = TS.prioriEfeito(), pri = { p0: ctx.p0, sp0: [0.4, 0.35, 0.3], w: pe.w, sw: pe.sw, tau: tp.m, stau: tp.s };
      var r = TS.cfg.modo === 'quadra' ? TS.analisarQuadra({ tClac: 100, quadros: qs }, ctx.cam, pri) : TS.analisarLona({ tClac: 100, tTum: 100.35, quadros: qs }, ctx.cam, pri);
      if (r && !r.nada) falsos++;
    }
    return { cenario: c.nome, estalosSemBola: c.n || 20, inventouGolpe: falsos };
  }
  /**
   * "Testar a precisão desta montagem": usa a montagem e o tripé do usuário, roda em pedaços (sem travar a tela)
   * e devolve o resumo. Não altera calibração, perfil nem a sessão do usuário.
   */
  function testarMontagem(n, progresso, fim) {
    var cfg = TS.cfg, copia = JSON.parse(JSON.stringify({ tau: cfg.tau, contato: cfg.contato, tipo: cfg.tipo, perfil: cfg.perfil }));
    sem = 4242;
    var c = { nome: 'sua montagem', usarCfg: true, cel: cfg.cel, priC: cfg.cel && cfg.cel.usar, tipos: cfg.modo === 'parede' ? null : null };
    var ctx, res = [], falhas = 0, tent = 0;
    try { ctx = preparar(c); } catch (e) { restaurar(); fim({ erro: e.message }); return; }
    function restaurar() { cfg.tau = copia.tau; cfg.contato = copia.contato; cfg.tipo = copia.tipo; cfg.perfil = copia.perfil; }
    function passo() {
      var t0 = performance.now();
      while (res.length + falhas < n && tent++ < n * 4 && performance.now() - t0 < 120) {
        var g = golpe(c, ctx, sortear(c));
        if (!g) continue;
        if (!g.r || g.r.nada || g.r.erro) { falhas++; continue; }
        res.push(g);
      }
      progresso(res.length + falhas, n);
      if (res.length + falhas < n && tent < n * 4) { setTimeout(passo, 0); return; }
      var s = resumir(c, res, falhas); s.visiveis = ctx.visiveis; s.total = ctx.total; s.erroFocal = ctx.erroFocal;
      restaurar(); fim(s);
    }
    setTimeout(passo, 30);
  }
  window.SIM = { pontosEssenciais: pontosEssenciais, rodar: rodar, semBola: semBola, preparar: preparar, testarMontagem: testarMontagem, posicaoCelular: posicaoCelular, miraCelular: miraCelular,
                 LARG: LARG, ALT: ALT, FOCAL: FOCAL };
})();
