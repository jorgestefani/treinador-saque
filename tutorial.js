/* Animação "Como montar e calibrar": desenhada no canvas com as medidas do próprio usuário (altura, distâncias,
   tripé). Vista de cima para montar, vista da câmera para marcar os pontos, e um golpe de verdade da física no fim.
   Aparece na primeira visita e pelo botão "Como montar e calibrar". */
(function () {
  var F = Fisica, G = Geom, W = 720, H = 560;
  var TRIPE = { lona: { atras: 4.5, lado: 2.0, h: 1.40 }, parede: { atras: 2.25, lado: 2.6, h: 1.20 }, quadra: { atras: 1.5, lado: 2.2, h: 2.50 } };
  function n2(x) { return x.toFixed(2).replace('.', ','); }
  function n1(x) { return x.toFixed(1).replace('.', ','); }
  function $(id) { return document.getElementById(id); }

  /* ---------------------------------------------------------------- dados da cena (com as medidas do usuário) */
  /** Calcula tudo para o modo pedido, sem mudar a configuração do usuário (o modo é trocado e restaurado). */
  /** As medidas atuais do usuário para o modo (ponto de partida dos controles "mexa e veja"). */
  function medidasDe(modo) {
    var cfg = TS.cfg, cel = modo === cfg.modo ? cfg.cel : (cfg.celPor && cfg.celPor[modo]) || TRIPE[modo];
    return { d: modo === 'parede' ? cfg.par.d : cfg.mont.d, atras: cel.atras, lado: cel.lado, h: cel.h, ladoEsq: cel.ladoEsq !== false };
  }
  function cena(modo, m, comGolpe) {
    var cfg = TS.cfg, modoOrig = cfg.modo, tipoOrig = cfg.tipo, dOrig = [cfg.mont.d, cfg.par.d];
    m = m || medidasDe(modo);
    try {
      cfg.modo = modo; if (modo === 'parede') cfg.par.d = m.d; else cfg.mont.d = m.d;
      var cel = { atras: m.atras, lado: m.lado, h: m.h, ladoEsq: m.ladoEsq };
      var p0 = TS.contatoNominal(), C = SIM.posicaoCelular(cel), mira = SIM.miraCelular(C);
      var c = { modo: modo, p0: p0, C: C, cel: cel, alt: cfg.jog.alt, lado: cfg.lado, pts: TS.pontosDoModo(),
                cam: G.cameraOlhando(C, mira, 1450, 1920, 1080), ess: SIM.pontosEssenciais() };
      if (modo !== 'quadra') { c.L = TS.lona(); c.d = m.d; }
      if (modo === 'parede') try { c.fita = TS.alturaRedeNaParede(95, 'fh_top', m.d) - F.R; } catch (e) {}
      if (comGolpe !== false) c.golpe = bomGolpe(c);
      return c;
    } finally { cfg.modo = modoOrig; cfg.tipo = tipoOrig; cfg.mont.d = dOrig[0]; cfg.par.d = dOrig[1]; }
  }
  /** O que muda com estas medidas: o que sai da imagem, o tamanho da bola e o erro esperado. */
  function efeitos(c) {
    var fora = [], cabe = 0;
    c.ess.forEach(function (p) {
      var q = G.projetar(c.cam, p.X), m = q[2] > 0 ? Math.min(q[0], 1920 - q[0], q[1], 1080 - q[1]) : -1;
      if (m < 0.03 * 1080) fora.push(p.nome.replace(/^\d · /, '')); else cabe++;
    });
    var r = { fora: fora, linhas: [] }, C = c.C;
    var alvo = c.L ? [c.L.x, (c.L.yEsq + c.L.yDir) / 2, (c.L.zb + c.L.zt) / 2] : [F.QUADRA.saque - 3, 2 * c.lado, 0];
    var px = 2 * F.R * 1450 / Math.hypot(alvo[0] - C[0], alvo[1] - C[1], alvo[2] - C[2]);
    r.linhas.push(fora.length ? '⚠️ Fora da imagem: ' + fora.join(', ') + '.' : '✅ Tudo cabe na imagem.');
    r.linhas.push((px < 6 ? '⚠️' : '✅') + ' Bola no alvo: ' + n1(px) + ' px na imagem' + (px < 6 ? ' (pequena: aproxime o tripé do alvo)' : '') + '.');
    if (c.modo === 'lona') {
      var tab = [[3.5, 56], [5, 36], [6, 32], [8, 23], [10, 17]], d = c.d, e = tab[0][1];
      for (var i = 0; i < tab.length - 1; i++) if (d >= tab[i][0]) e = tab[i][1] + (tab[i + 1][1] - tab[i][1]) * Math.min(1, (d - tab[i][0]) / (tab[i + 1][0] - tab[i][0]));
      r.linhas.push((d < 6 ? '⚠️' : '✅') + ' Erro esperado no quique: ~' + Math.round(e) + ' cm' + (d < 6 ? ' — perto demais: a bola mal começou a cair' : '') + '.');
    } else if (c.modo === 'parede' && c.fita) {
      r.linhas.push('📏 Fita-rede a ' + n2(c.fita) + ' m do chão nesta distância' + (Math.abs(c.d - 11.885) < 0.3 ? ' (= rede de verdade).' : ' (topspin a 95 km/h).'));
    } else if (c.modo === 'quadra') {
      r.linhas.push((c.cel.h < 2 ? '⚠️ Celular baixo: o quique fica achatado na imagem e o erro sobe (1,6 m dá ~3× o erro de 2,5 m).' : '✅ Celular alto: o quique aparece bem.'));
    }
    return r;
  }
  /** Um golpe que entra: no meio da faixa de elevação que passa a rede e cai dentro (a mesma física do app). */
  function bomGolpe(c) {
    var parede = c.modo === 'parede', kmh = parede ? 100 : 150, ef = F.EFEITOS[parede ? 'fh_top' : 'chapado'];
    var jogo = parede ? 'fundo' : 'saque', limite = parede ? F.QUADRA.fundo : F.QUADRA.saque;
    var azs = parede ? [0, 3, -3, 6, -6] : [9, 7, 11, 5, 13], i;
    for (var k = 0; k < azs.length; k++) {
      var a = parede ? azs[k] : azs[k] * c.lado, lo = -12, hi = 40, m;
      for (i = 0; i < 18; i++) { m = (lo + hi) / 2; var r = F.voo(c.p0, F.vetorSaida(kmh, m, a), ef, { xAlvo: F.QUADRA.rede }); if (!r.chao && r.p[2] - F.R - F.alturaRede(r.p[1]) >= 0) hi = m; else lo = m; }
      var eMin = hi; lo = eMin; hi = 45;
      for (i = 0; i < 18; i++) { m = (lo + hi) / 2; if (F.voo(c.p0, F.vetorSaida(kmh, m, a), ef, {}).p[0] <= limite) lo = m; else hi = m; }
      var v0 = F.vetorSaida(kmh, eMin + (lo - eMin) * 0.45, a);
      if (F.vereditoJogo(jogo, c.p0, v0, ef, c.lado).res !== 'dentro') continue;
      var opc = { guardar: true, dt: 0.004 }; if (c.L) opc.xAlvo = c.L.x - F.R;
      var v = F.voo(c.p0, v0, ef, opc), pts = v.pts.slice();
      if (!c.L) {                                   // quadra: quique e mais um pedaço do voo
        var q = v.p, vq = [v.v[0] * 0.75, v.v[1] * 0.75, -v.v[2] * 0.7];
        var d2 = F.voo([q[0], q[1], F.R + 0.001], vq, ef, { guardar: true, dt: 0.004, tMax: 0.35 });
        d2.pts.forEach(function (p) { pts.push({ t: v.t + p.t, p: p.p }); });
      }
      return { pts: pts, tAlvo: v.t, fim: v.p, kmh: kmh };
    }
    return null;
  }

  /* ---------------------------------------------------------------- roteiro */
  function roteiro(c) {
    var nomeAlvo = c.modo === 'parede' ? 'a parede' : 'a lona', cel = c.cel, ladoTxt = cel.ladoEsq ? 'à esquerda' : 'à direita';
    var tripe = { t: 'Tripé ao lado', d: 7.5, vista: 'cima', passo: 'tripe',
                  txt: 'Celular deitado no tripé, câmera normal 1×. Meça com a trena a partir do X do contato: ' + n2(cel.atras) + ' m atrás, ' +
                       n2(cel.lado) + ' m ' + ladoTxt + ' e ' + n2(cel.h) + ' m de altura. Anote na aba Montagem.',
                  voz: 'Ponha o celular deitado no tripé, ao lado. Meça com a trena quanto ele fica atrás, ao lado, e a altura.' };
    var marcar = { t: 'Congele e marque os pontos', d: 3 + 1.6 * c.pts.length, vista: 'camera', passo: 'marcar',
                   txt: 'Na aba Calibrar, toque em Congelar imagem. Arraste o dedo até cada ponto, na ordem: a lupa mostra o lugar exato. Solte.',
                   voz: 'Na aba Calibrar, toque em congelar imagem e marque os pontos na ordem. A lupa mostra o lugar exato.' };
    var calc = { t: 'Calcular', d: 4, vista: 'camera', passo: 'calc',
                 txt: 'Toque em Calcular a calibração. As linhas verdes têm que cair em cima ' + (c.modo === 'quadra' ? 'das linhas da quadra.' : 'das fitas e da ' + (c.modo === 'parede' ? 'parede.' : 'lona.')) +
                      ' Não mexa mais no tripé.', voz: 'Toque em calcular. Pronto: não mexa mais no tripé.' };
    var bater = { t: 'Agora é só bater', d: 6, vista: 'camera', passo: 'bater',
                  txt: 'Volte à aba Treinar e toque em Começar. A cada ' + (c.modo === 'parede' ? 'golpe' : 'saque') + ', o celular mede a bola e fala o resultado.',
                  voz: 'Agora toque em começar, e bata. O celular fala o resultado.' };
    if (c.modo === 'quadra') return [
      { t: 'Celular alto, ao lado', d: 7, vista: 'cima', passo: 'tripe',
        txt: 'Na quadra de verdade não precisa de fita: a calibração usa as linhas. Tripé ' + n2(cel.atras) + ' m atrás e ' + n2(cel.lado) + ' m ' + ladoTxt +
             ' do contato, celular bem alto (' + n2(cel.h) + ' m), olhando para o quadrado de saque.',
        voz: 'Na quadra de verdade, a calibração usa as linhas. Ponha o celular bem alto, ao lado, olhando para o quadrado de saque.' },
      marcar, calc, bater ];
    return [
      { t: c.modo === 'parede' ? 'Fita na parede' : 'A lona a ' + n1(c.d) + ' m', d: 7, vista: 'cima', passo: 'alvo',
        txt: c.modo === 'parede'
          ? 'Fique a ' + n1(c.d) + ' m da parede. Cole a fita-rede a ' + n2(c.L.zt) + ' m do chão, com ' + n1(c.L.larg) + ' m de largura, centrada na sua linha de mira.'
          : 'Pendure a lona a ' + n1(c.d) + ' m do seu ponto de contato, com a base a ' + n2(c.L.zb) + ' m e o topo a ' + n2(c.L.zt) + ' m do chão.',
        voz: c.modo === 'parede' ? 'Cole a fita na parede, na altura que a aba Montagem mostra.' : 'Pendure a lona a ' + n1(c.d).replace(',', ' vírgula ') + ' metros do seu ponto de contato.' },
      { t: 'Dois X de fita no chão', d: 6, vista: 'cima', passo: 'fitas',
        txt: 'Cole um X de fita no chão bem embaixo do ponto onde você bate na bola, e outro no meio do caminho até ' + nomeAlvo + ', na mesma linha.',
        voz: 'Cole um xis de fita no chão embaixo do contato, e outro no meio do caminho.' },
      tripe, marcar, calc, bater ];
  }

  /* ---------------------------------------------------------------- desenho */
  var g, c, cenas, iCena = 0, t0 = 0, pausa = false, tPausa = 0, raf = 0, comVoz = true;
  function fonte(px, b) { g.font = (b ? 'bold ' : '') + px + 'px -apple-system, system-ui, sans-serif'; }
  function suave(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }

  /* vista de cima: x (para o alvo) vai para cima na tela, y (esquerda) para a esquerda */
  function topo() {
    var xs = [c.p0[0], c.C[0]], ys = [c.p0[1], c.C[1]];
    if (c.L) { xs.push(c.L.x + 0.4); ys.push(c.L.yEsq, c.L.yDir); } else { xs.push(F.QUADRA.saque + 0.6, -1); ys.push(5.5, -5.5); }
    var x0 = Math.min.apply(null, xs) - 0.8, x1 = Math.max.apply(null, xs) + 0.5, y0 = Math.min.apply(null, ys) - 1, y1 = Math.max.apply(null, ys) + 1;
    var s = Math.min((W - 40) / (y1 - y0), (H - 70) / (x1 - x0)), ox = W / 2 + (y0 + y1) / 2 * s, oy = H - 20 - ((H - 70) - (x1 - x0) * s) / 2;
    return function (x, y) { return [ox - y * s, oy - (x - x0) * s, s]; };
  }
  function linha(a, b, cor, lw, tracejado) {
    g.strokeStyle = cor; g.lineWidth = lw || 2; g.setLineDash(tracejado ? [10, 8] : []);
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.setLineDash([]);
  }
  function texto(t, x, y, cor, px, alinh, b) { fonte(px || 20, b); g.fillStyle = cor || '#eef5f1'; g.textAlign = alinh || 'center'; g.fillText(t, x, y); g.textAlign = 'left'; }
  function xis(p, cor, tam, a) {
    g.globalAlpha = a; linha([p[0] - tam, p[1] - tam], [p[0] + tam, p[1] + tam], cor, 5); linha([p[0] - tam, p[1] + tam], [p[0] + tam, p[1] - tam], cor, 5); g.globalAlpha = 1;
  }
  function cota(a, b, txt, cor, prog) {
    var m = [a[0] + (b[0] - a[0]) * prog, a[1] + (b[1] - a[1]) * prog];
    linha(a, m, cor, 2.5);
    if (prog > 0.98) { var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; fonte(21, true); var w = g.measureText(txt).width + 14;
      g.fillStyle = '#0a1712e0'; g.fillRect(mx - w / 2, my - 15, w, 28); texto(txt, mx, my + 7, cor, 21, 'center', true); }
  }
  function desenharCima(passo, t, d) {
    var P = topo(), s = P(0, 0)[2];
    g.fillStyle = '#0f2a1f'; g.fillRect(0, 0, W, H);
    if (c.modo === 'quadra') {                      // meia quadra mais o quadrado de saque do outro lado
      var Q = F.QUADRA, ls = [[[0, -5.485], [0, 5.485]], [[0, -4.115], [Q.saque, -4.115]], [[0, 4.115], [Q.saque, 4.115]], [[5.485, -4.115], [5.485, 4.115]],
        [[Q.saque, -4.115], [Q.saque, 4.115]], [[5.485, 0], [Q.saque, 0]], [[0, -5.485], [Q.rede, -5.485]], [[0, 5.485], [Q.rede, 5.485]]];
      ls.forEach(function (l) { linha(P(l[0][0], l[0][1]), P(l[1][0], l[1][1]), '#e8efe9', 2); });
      linha(P(Q.rede, -6.4), P(Q.rede, 6.4), '#cbd5e1', 4, true); texto('rede', P(Q.rede, -6)[0], P(Q.rede, -6)[1] - 8, '#cbd5e1', 18);
      var bx = P(Q.saque - 3.2, 2.05 * c.lado); g.fillStyle = '#22c55e33'; var a1 = P(Q.rede, 0), a2 = P(Q.saque, 4.115 * c.lado);
      g.fillRect(Math.min(a1[0], a2[0]), Math.min(a1[1], a2[1]), Math.abs(a2[0] - a1[0]), Math.abs(a2[1] - a1[1]));
      texto('alvo', bx[0], bx[1], '#86efac', 19, 'center', true);
    } else {
      var L = c.L, pa = suave(passo === 'alvo' ? t / 1.5 : 1), e = P(L.x, L.yEsq), dd = P(L.x, L.yDir);
      g.globalAlpha = pa; linha(e, dd, c.modo === 'parede' ? '#ef4444' : '#38bdf8', 9); g.globalAlpha = 1;
      if (c.modo === 'parede') { linha(P(L.x + 0.12, -6), P(L.x + 0.12, 6), '#64748b', 6); texto('parede', P(L.x + 0.3, 0)[0], P(L.x + 0.3, 0)[1], '#94a3b8', 18); }
      else texto('lona', (e[0] + dd[0]) / 2, e[1] - 16, '#7dd3fc', 20, 'center', true);
      linha(P(c.p0[0], c.p0[1]), P(L.x, c.p0[1]), '#facc1588', 2, true);                // linha de mira
      if (passo === 'alvo') cota(P(c.p0[0], c.p0[1] + 0.9 * (c.L.yEsq > 0 ? -1 : 1)), P(L.x, c.p0[1] + 0.9 * (c.L.yEsq > 0 ? -1 : 1)), n1(c.d) + ' m', '#facc15', suave((t - 1) / 2));
      if (passo !== 'alvo') {
        var a5 = suave(passo === 'fitas' ? (t - 0.5) / 0.8 : 1), a6 = suave(passo === 'fitas' ? (t - 2) / 0.8 : 1);
        var p5 = P(c.p0[0], c.p0[1]), p6 = P(c.p0[0] + c.d / 2, c.p0[1]);
        xis(p5, '#facc15', 13, a5); xis(p6, '#facc15', 13, a6);
        if (a5 > 0.9) texto('X 5', p5[0] + 34, p5[1] + 7, '#facc15', 19, 'left', true);
        if (a6 > 0.9) texto('X 6', p6[0] + 34, p6[1] + 7, '#facc15', 19, 'left', true);
        if (passo === 'fitas' && t > 3.2) cota(P(c.p0[0], c.p0[1] - 0.6), P(c.p0[0] + c.d / 2, c.p0[1] - 0.6), n1(c.d / 2) + ' m', '#facc15', suave((t - 3.2) / 1));
      }
    }
    // o jogador (visto de cima) no contato
    var pj = P(c.p0[0] - 0.25, c.p0[1]);
    g.fillStyle = '#f5d0a9'; g.beginPath(); g.arc(pj[0], pj[1], Math.max(9, 0.13 * s), 0, 7); g.fill();
    texto('você (' + n2(c.alt) + ' m)', pj[0], pj[1] + Math.max(9, 0.13 * s) + 24, '#eef5f1', 18);
    if (passo === 'tripe' || passo !== 'alvo' && passo !== 'fitas') {
      var chega = passo === 'tripe' ? suave(t / 1.6) : 1, ini = [c.C[0] - 2, c.C[1] + (c.cel.ladoEsq ? 1.5 : -1.5)];
      var cx = ini[0] + (c.C[0] - ini[0]) * chega, cy = ini[1] + (c.C[1] - ini[1]) * chega, pc = P(cx, cy);
      if (chega > 0.99) {                            // cone de visão da câmera
        var az = Math.atan2(c.cam.R[2][1], c.cam.R[2][0]), meia = 33.5 * Math.PI / 180, alc = 30;
        g.fillStyle = '#38bdf81c'; g.beginPath(); g.moveTo(pc[0], pc[1]);
        [az - meia, az + meia].forEach(function (an) { var q = P(cx + alc * Math.cos(an), cy + alc * Math.sin(an)); g.lineTo(q[0], q[1]); });
        g.closePath(); g.fill();
      }
      g.fillStyle = '#38bdf8'; g.beginPath(); g.arc(pc[0], pc[1], 11, 0, 7); g.fill();
      texto('📱', pc[0], pc[1] - 16, '#fff', 24);
      if (passo === 'tripe') {
        var lt = c.cel.ladoEsq ? 1 : -1;
        cota(P(c.p0[0], c.p0[1]), P(c.C[0], c.p0[1]), n2(c.cel.atras) + ' m', '#facc15', suave((t - 1.8) / 0.9));
        cota(P(c.C[0], c.p0[1]), P(c.C[0], c.C[1]), n2(c.cel.lado) + ' m', '#facc15', suave((t - 2.9) / 0.9));
        if (t > 4.2) texto('altura do celular: ' + n2(c.cel.h) + ' m', W / 2, 36, '#38bdf8', 22, 'center', true);
        void lt;
      }
    }
  }

  /* vista da câmera: a cena projetada como o iPhone vê (quadro 16:9) */
  var FR;
  function quadro() { var w = W - 20, h = w * 9 / 16; return { x: 10, y: (H - h) / 2 - 18, w: w, h: h, s: w / 1920 }; }
  function proj(X) { var q = G.projetar(c.cam, X); return q[2] > 0.15 ? [FR.x + q[0] * FR.s, FR.y + q[1] * FR.s] : null; }
  function seg(A, B, cor, lw) {                     // segmento 3D cortado no plano da câmera (em pedaços)
    var n = 16, ant = null; g.strokeStyle = cor; g.lineWidth = lw || 2; g.beginPath();
    for (var i = 0; i <= n; i++) { var X = [A[0] + (B[0] - A[0]) * i / n, A[1] + (B[1] - A[1]) * i / n, A[2] + (B[2] - A[2]) * i / n], p = proj(X);
      if (p && ant) g.lineTo(p[0], p[1]); else if (p) g.moveTo(p[0], p[1]); ant = p; }
    g.stroke();
  }
  function poli(Xs, cor) { var ps = Xs.map(proj); if (ps.some(function (p) { return !p; })) return; g.fillStyle = cor; g.beginPath(); ps.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.closePath(); g.fill(); }
  function cenaCamera(semLinhas) {
    g.save(); g.beginPath(); g.rect(FR.x, FR.y, FR.w, FR.h); g.clip();
    g.fillStyle = '#5b7f99'; g.fillRect(FR.x, FR.y, FR.w, FR.h);                 // céu / fundo
    var hz = proj([c.C[0] + 400 * c.cam.R[2][0], c.C[1] + 400 * c.cam.R[2][1], 0]);
    g.fillStyle = c.modo === 'quadra' ? '#2f6f8f' : '#6b6f5a'; g.fillRect(FR.x, hz ? hz[1] : FR.y, FR.w, FR.h);   // chão
    if (c.modo === 'quadra') {
      var Q = F.QUADRA;
      for (var xq = -3; xq < 27; xq += 1) poli([[xq, -7, 0], [xq + 1.02, -7, 0], [xq + 1.02, 7, 0], [xq, 7, 0]], '#3b6ea5');
      [[[0, -5.485], [0, 5.485]], [[Q.fundo, -5.485], [Q.fundo, 5.485]], [[0, -4.115], [Q.fundo, -4.115]], [[0, 4.115], [Q.fundo, 4.115]], [[0, -5.485], [Q.fundo, -5.485]], [[0, 5.485], [Q.fundo, 5.485]],
       [[5.485, -4.115], [5.485, 4.115]], [[Q.saque, -4.115], [Q.saque, 4.115]], [[5.485, 0], [Q.saque, 0]], [[0, 0], [0.15, 0]]]
        .forEach(function (l) { seg([l[0][0], l[0][1], 0], [l[1][0], l[1][1], 0], '#f1f5f9', 2); });
      poli([[Q.rede, -6.4, 0], [Q.rede, 6.4, 0], [Q.rede, 6.4, 1.07], [Q.rede, 0, 0.914], [Q.rede, -6.4, 1.07]], '#0f172a99');
      seg([Q.rede, -6.4, 1.07], [Q.rede, 0, 0.914], '#f8fafc', 3); seg([Q.rede, 0, 0.914], [Q.rede, 6.4, 1.07], '#f8fafc', 3);
    } else {
      var L = c.L;
      if (c.modo === 'parede') {
        for (var yw = -12; yw < 12; yw += 0.5) poli([[L.x + 0.02, yw, 0], [L.x + 0.02, yw + 0.52, 0], [L.x + 0.02, yw + 0.52, 5], [L.x + 0.02, yw, 5]], '#b9b4a6');   // em faixas: corta o que fica atrás da câmera
        seg([L.x, L.yEsq, L.zt], [L.x, L.yDir, L.zt], '#ef4444', 5);
        seg([L.x, L.yEsq, 0], [L.x, L.yEsq, L.zt], '#ef444488', 2); seg([L.x, L.yDir, 0], [L.x, L.yDir, L.zt], '#ef444488', 2);
      } else {
        seg([L.x, L.yEsq, 0], [L.x, L.yEsq, L.zt], '#555', 3); seg([L.x, L.yDir, 0], [L.x, L.yDir, L.zt], '#555', 3);
        poli([[L.x, L.yEsq, L.zb], [L.x, L.yDir, L.zb], [L.x, L.yDir, L.zt], [L.x, L.yEsq, L.zt]], '#1d4ed8');
        seg([L.x, L.yEsq, L.zt], [L.x, L.yDir, L.zt], '#f8fafc', 3); seg([L.x, L.yEsq, L.zb], [L.x, L.yDir, L.zb], '#f8fafc', 3);
      }
      [[c.p0[0], c.p0[1]], [c.p0[0] + c.d / 2, c.p0[1]]].forEach(function (p) {
        seg([p[0] - 0.18, p[1] - 0.18, 0], [p[0] + 0.18, p[1] + 0.18, 0], '#facc15', 4); seg([p[0] - 0.18, p[1] + 0.18, 0], [p[0] + 0.18, p[1] - 0.18, 0], '#facc15', 4);
      });
    }
    // jogador (boneco com a altura do usuário)
    var a = c.alt, x = c.p0[0] - 0.25, y = c.p0[1], cab = proj([x, y, a - 0.11]);
    seg([x, y - 0.12, 0], [x, y, a * 0.52], '#f5d0a9', 5); seg([x, y + 0.12, 0], [x, y, a * 0.52], '#f5d0a9', 5);
    seg([x, y, a * 0.52], [x, y, a * 0.82], '#f5d0a9', 6); seg([x, y, a * 0.8], [c.p0[0], c.p0[1], c.p0[2] - 0.35], '#f5d0a9', 4);
    if (cab) { g.fillStyle = '#f5d0a9'; g.beginPath(); g.arc(cab[0], cab[1], 0.11 * 1450 / Math.hypot(x - c.C[0], y - c.C[1], a - c.C[2]) * FR.s, 0, 7); g.fill(); }
    g.restore();
    if (!semLinhas) { g.strokeStyle = '#ffffff55'; g.lineWidth = 2; g.strokeRect(FR.x, FR.y, FR.w, FR.h); }
  }
  function desenharCamera(passo, t, d) {
    FR = quadro(); g.fillStyle = '#0a1712'; g.fillRect(0, 0, W, H);
    cenaCamera();
    texto(passo === 'bater' ? '● filmando' : 'imagem congelada do iPhone', FR.x + 12, FR.y - 12, passo === 'bater' ? '#ef4444' : '#9db8ab', 18, 'left', true);
    var pts = c.pts.map(function (p) { return { nome: p.nome, q: proj(p.X) }; });
    if (passo === 'marcar') {
      var dur = 1.6, k = Math.floor((t - 1) / dur), f = (t - 1) / dur - k;
      pts.forEach(function (p, i) {
        if (!p.q) return; var feito = i < k || (i === k && f > 0.75);
        if (feito) { g.fillStyle = '#22c55e'; g.beginPath(); g.arc(p.q[0], p.q[1], 13, 0, 7); g.fill(); texto(String(i + 1), p.q[0], p.q[1] + 7, '#04140b', 18, 'center', true); }
      });
      if (k >= 0 && k < pts.length && pts[k].q) {
        var alvo = pts[k].q, ant = k > 0 && pts[k - 1].q ? pts[k - 1].q : [W / 2, FR.y + FR.h + 60], m = suave(f / 0.55);
        var dx = ant[0] + (alvo[0] - ant[0]) * m, dy = ant[1] + (alvo[1] - ant[1]) * m;
        if (f > 0.4) lupa(dx, dy);
        texto('☝️', dx + 6, dy + 34, '#fff', 40);
        fonte(21, true); var nome = pts[k].nome, w = g.measureText(nome).width + 20, bx = Math.max(6, Math.min(W - w - 6, W / 2 - w / 2));
        g.fillStyle = '#facc15'; g.fillRect(bx, FR.y + FR.h + 14, w, 32); texto(nome, bx + 10, FR.y + FR.h + 37, '#1a1400', 21, 'left', true);
      }
    } else {
      pts.forEach(function (p, i) { if (!p.q) return; g.fillStyle = '#22c55e'; g.beginPath(); g.arc(p.q[0], p.q[1], 11, 0, 7); g.fill(); texto(String(i + 1), p.q[0], p.q[1] + 6, '#04140b', 15, 'center', true); });
    }
    if (passo === 'calc') {
      var pr = suave((t - 0.6) / 1.4);
      g.globalAlpha = pr; g.save(); g.beginPath(); g.rect(FR.x, FR.y, FR.w, FR.h); g.clip();
      contornos('#4ade80'); g.restore(); g.globalAlpha = 1;
      pts.forEach(function (p, i) { if (!p.q) return; g.fillStyle = '#22c55e'; g.beginPath(); g.arc(p.q[0], p.q[1], 11, 0, 7); g.fill(); texto(String(i + 1), p.q[0], p.q[1] + 6, '#04140b', 15, 'center', true); });
      if (t > 2.2) { g.fillStyle = '#04140bdd'; g.fillRect(W / 2 - 170, FR.y + FR.h + 12, 340, 44); texto('✅ Calibrado', W / 2, FR.y + FR.h + 43, '#4ade80', 27, 'center', true); }
    }
    if (passo === 'bater' && c.golpe) bola(t);
    if (passo === 'explorar') {
      foraDaImagem();
      if (c.golpe && t > 0) { bola.falou = true; bola(t + 0.8); }
    }
  }
  function foraDaImagem() {
    c.ess.forEach(function (p) {
      var q = G.projetar(c.cam, p.X), dentro = q[2] > 0 && q[0] >= 0 && q[0] <= 1920 && q[1] >= 0 && q[1] <= 1080;
      if (dentro) return;
      var u = q[2] > 0 ? q[0] : 1920 - q[0], v = q[2] > 0 ? q[1] : 1080 - q[1];
      var x = FR.x + Math.max(14, Math.min(1906, u)) * FR.s, y = FR.y + Math.max(14, Math.min(1066, v)) * FR.s;
      g.fillStyle = '#ef4444'; g.beginPath(); g.arc(x, y, 10, 0, 7); g.fill();
      texto('✕', x, y + 6, '#fff', 15, 'center', true);
    });
  }
  function contornos(cor) {
    if (c.modo === 'quadra') { var Q = F.QUADRA; [[[0, -4.115], [0, 4.115]], [[5.485, -4.115], [5.485, 4.115]], [[Q.saque, -4.115], [Q.saque, 4.115]], [[5.485, 0], [Q.saque, 0]], [[0, 4.115 * c.lado], [Q.saque, 4.115 * c.lado]]]
      .forEach(function (l) { seg([l[0][0], l[0][1], 0], [l[1][0], l[1][1], 0], cor, 3); }); seg([Q.rede, -6.4, 1.07], [Q.rede, 0, 0.914], cor, 3); seg([Q.rede, 0, 0.914], [Q.rede, 6.4, 1.07], cor, 3); return; }
    var L = c.L; [[[L.yEsq, L.zt], [L.yDir, L.zt]], [[L.yDir, L.zt], [L.yDir, L.zb]], [[L.yDir, L.zb], [L.yEsq, L.zb]], [[L.yEsq, L.zb], [L.yEsq, L.zt]]]
      .forEach(function (l) { seg([L.x, l[0][0], l[0][1]], [L.x, l[1][0], l[1][1]], cor, 3); });
    seg([c.p0[0], c.p0[1], 0], [L.x, c.p0[1], 0], cor, 2);
  }
  function lupa(x, y) {                            // a lupa do app: 2× o redor do dedo, acima dele
    var r = 54, lx = x, ly = y - 95; if (ly - r < 0) ly = y + 95;
    try {
      g.save(); g.beginPath(); g.arc(lx, ly, r, 0, 7); g.clip();
      g.drawImage(g.canvas, (x - r / 2) * escala, (y - r / 2) * escala, r * escala, r * escala, lx - r, ly - r, 2 * r, 2 * r);
      g.restore();
    } catch (e) { g.restore(); }
    g.strokeStyle = '#facc15'; g.lineWidth = 3; g.beginPath(); g.arc(lx, ly, r, 0, 7); g.stroke();
    linha([lx - 8, ly], [lx + 8, ly], '#facc15', 2); linha([lx, ly - 8], [lx, ly + 8], '#facc15', 2);
  }
  function bola(t) {
    var gp = c.golpe, tb = (t - 0.8) * 0.45, rastro = [];             // câmera lenta (0,45×)
    if (tb < 0) { texto('prepare…', W / 2, FR.y + FR.h + 40, '#9db8ab', 22, 'center'); return; }
    var fimT = gp.pts[gp.pts.length - 1].t, atual = null;
    for (var i = 0; i < gp.pts.length; i++) { if (gp.pts[i].t > tb) break; rastro.push(gp.pts[i].p); atual = gp.pts[i].p; }
    if (tb > fimT && c.L) {                       // bateu no alvo e cai
      var q = tb - fimT; atual = [gp.fim[0] - 0.05, gp.fim[1], Math.max(F.R, gp.fim[2] - 4.9 * q * q)];
    }
    g.save(); g.beginPath(); g.rect(FR.x, FR.y, FR.w, FR.h); g.clip();
    g.strokeStyle = '#facc15aa'; g.lineWidth = 2; g.beginPath();
    rastro.forEach(function (p, k) { var s = proj(p); if (!s) return; if (k) g.lineTo(s[0], s[1]); else g.moveTo(s[0], s[1]); }); g.stroke();
    if (atual) { var s2 = proj(atual); if (s2) { g.fillStyle = '#e5f230'; g.beginPath(); g.arc(s2[0], s2[1], 7, 0, 7); g.fill(); } }
    g.restore();
    if (tb > fimT * 0.98) {
      var av = null, mo = TS.cfg.modo; try { TS.cfg.modo = c.modo; av = TS.aviso({ res: 'dentro', kmh: gp.kmh }, false); } catch (e) {} finally { TS.cfg.modo = mo; }
      if (!bola.falou) { bola.falou = true; if (comVoz) { if (av && av.txt) falar(av.txt, av.lingua); else if (!av) falar('Dentro. ' + gp.kmh); } }
      g.fillStyle = '#04140bdd'; g.fillRect(W / 2 - 150, FR.y + FR.h + 10, 300, 50);
      texto((av && av.txt ? av.txt.replace(/ \d+$/, '').toUpperCase() : 'DENTRO') + ' · ' + gp.kmh + ' km/h', W / 2, FR.y + FR.h + 46, '#22c55e', 32, 'center', true);
    }
  }

  /* ---------------------------------------------------------------- execução */
  var escala = 1;
  function falar(txt, lingua) {
    if (!window.speechSynthesis || !TS.cfg.aj.voz) return;
    var u = new SpeechSynthesisUtterance(txt); u.lang = lingua || 'pt-BR'; u.rate = 1.05;
    var v = speechSynthesis.getVoices().filter(function (x) { return x.lang.replace('_', '-') === u.lang; })[0]; if (v) u.voice = v;
    speechSynthesis.speak(u);
  }
  function quadroAnim(agora) {
    raf = requestAnimationFrame(quadroAnim);
    if (pausa) return;
    var sc = cenas[iCena], t = (agora - t0) / 1000;
    if (t > sc.d) { if (iCena < cenas.length - 1) irPara(iCena + 1); else fim(); return; }
    g.setTransform(escala, 0, 0, escala, 0, 0);
    if (sc.vista === 'cima') desenharCima(sc.passo, t, sc.d); else desenharCamera(sc.passo, t, sc.d);
    $('tutBarra').style.width = ((iCena + t / sc.d) / cenas.length * 100) + '%';
  }
  function irPara(i) {
    iCena = Math.max(0, Math.min(cenas.length - 1, i)); t0 = performance.now(); pausa = false; bola.falou = false;
    $('tutFim').style.display = 'none'; $('tutPausa').textContent = '⏸';
    var sc = cenas[iCena];
    $('tutTitulo').textContent = (iCena + 1) + '/' + cenas.length + ' · ' + sc.t; $('tutTxt').textContent = sc.txt;
    if (comVoz && window.speechSynthesis) { speechSynthesis.cancel(); falar(sc.voz); }
  }
  /* ---------------------------------------------------------------- mexa e veja */
  var vistaExp = 'camera', tGolpe = 0;
  var FAIXAS = { d: { lona: [3, 11, 0.1], parede: [4, 12, 0.1] }, atras: [0, 7, 0.05], lado: [0.8, 5, 0.05], h: [0.6, 3, 0.05] };
  function montarControles() {
    var m = med, html = '';
    function sl(k, rot, f) { html += '<label class="tsl"><span>' + rot + ' <b id="tv_' + k + '"></b></span><input type="range" id="ts_' + k + '" min="' + f[0] + '" max="' + f[1] + '" step="' + f[2] + '" value="' + m[k] + '"></label>'; }
    if (modoAt !== 'quadra') sl('d', modoAt === 'parede' ? 'Distância até a parede' : 'Distância até a lona', FAIXAS.d[modoAt]);
    sl('atras', 'Tripé atrás do contato', FAIXAS.atras); sl('lado', 'Tripé ao lado', FAIXAS.lado); sl('h', 'Altura do celular', FAIXAS.h);
    $('tutSl').innerHTML = html;
    Object.keys(FAIXAS).forEach(function (k) {
      var el = $('ts_' + k); if (!el) return;
      el.oninput = function () { med[k] = parseFloat(el.value); explorar(false); };
      el.onchange = function () { explorar(true); };
    });
    valoresSl(); $('tutEfeito').innerHTML = efeitos(c).linhas.join('<br>');
  }
  function valoresSl() { ['d', 'atras', 'lado', 'h'].forEach(function (k) { if ($('tv_' + k)) $('tv_' + k).textContent = n2(med[k]) + ' m'; }); }
  function explorar(comGolpe) {
    if (!pausa) tPausa = performance.now() - t0;
    pausa = true; $('tutPausa').textContent = '▶'; if (window.speechSynthesis) speechSynthesis.cancel();
    var golpeAnt = c && c.golpe;
    c = cena(modoAt, med, !!comGolpe); if (!comGolpe) c.golpe = golpeAnt; cenas = roteiro(c);
    valoresSl(); $('tutEfeito').innerHTML = efeitos(c).linhas.join('<br>');
    $('tutTitulo').textContent = '🔧 Mexa e veja · ' + (vistaExp === 'camera' ? 'o que o iPhone vê' : 'vista de cima');
    $('tutTxt').textContent = 'Arraste os controles: o desenho mostra na hora o que muda. Pontos vermelhos ficam fora da imagem. Toque ▶ para continuar a animação com estas medidas.';
    desenharExplorar(0);
    if (comGolpe) { tGolpe = performance.now(); animarGolpe(); }
  }
  function desenharExplorar(t) {
    g.setTransform(escala, 0, 0, escala, 0, 0);
    if (vistaExp === 'cima') { desenharCima('tripe', 9, 9); return; }
    desenharCamera('explorar', t, 9);
  }
  function animarGolpe() {                        // depois de soltar o controle: um golpe com as medidas novas
    if (!pausa || vistaExp !== 'camera') return;
    var t = (performance.now() - tGolpe) / 1000; desenharExplorar(t);
    if (t < 4.5) requestAnimationFrame(animarGolpe);
  }
  function fim() { pausa = true; $('tutFim').style.display = 'flex'; $('tutBarra').style.width = '100%'; }
  var modoAt, med;
  function abrir(modo) {
    try { localStorage.setItem('ts_tutorial', '1'); } catch (e) {}
    modo = modoAt = modo || TS.cfg.modo; med = medidasDe(modo);
    document.querySelectorAll('#tutModos button').forEach(function (b) { b.classList.toggle('on', b.dataset.m === modo); });
    c = cena(modo, med); cenas = roteiro(c); montarControles();
    var cv = $('tutCanvas'); escala = Math.min(2, window.devicePixelRatio || 1); cv.width = W * escala; cv.height = H * escala; g = cv.getContext('2d');
    $('tut').style.display = 'flex'; document.body.style.overflow = 'hidden';
    cancelAnimationFrame(raf); irPara(0); raf = requestAnimationFrame(quadroAnim);
  }
  function fechar() {
    cancelAnimationFrame(raf); $('tut').style.display = 'none'; document.body.style.overflow = '';
    if (window.speechSynthesis) speechSynthesis.cancel();
  }

  /* ---------------------------------------------------------------- tela */
  var css = document.createElement('style');
  css.textContent =
    '#tut{position:fixed;inset:0;z-index:50;background:#050d0aF2;display:none;flex-direction:column;align-items:center;overflow-y:auto;' +
    'padding:calc(env(safe-area-inset-top) + 10px) 12px calc(env(safe-area-inset-bottom) + 12px)}' +
    '#tut .caixa{width:100%;max-width:640px}' +
    '#tut .topo{display:flex;align-items:center;gap:8px;margin-bottom:8px}#tut .topo b{flex:1;font-size:17px}' +
    '#tut .x{background:#2b3f37;color:#eef5f1;border:0;border-radius:18px;width:38px;height:38px;font-size:18px}' +
    '#tutModos{display:flex;gap:6px;margin-bottom:8px}#tutModos button{flex:1;background:#12261e;color:#eef5f1;border:1px solid #24463a;border-radius:16px;padding:7px 4px;font-size:14px}' +
    '#tutModos button.on{background:#22c55e;color:#04140b;border-color:#22c55e;font-weight:700}' +
    '#tutCanvas{width:100%;aspect-ratio:720/560;border-radius:12px;background:#0a1712;display:block}' +
    '#tutProg{height:5px;background:#12261e;border-radius:3px;margin:8px 0;overflow:hidden}#tutBarra{height:100%;width:0;background:#22c55e}' +
    '#tutTitulo{font-weight:700;font-size:18px;margin:4px 0}#tutTxt{font-size:16px;line-height:1.45;color:#d6e6dd;min-height:70px}' +
    '#tut .ctl{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;margin-top:10px}#tut .ctl button{background:#2b3f37;color:#eef5f1;border:0;border-radius:10px;padding:11px 0;font-size:18px}' +
    '#tutFim{display:none;flex-direction:column;gap:6px;margin-top:10px}' +
    '#tut .tsl{display:block;margin:8px 0;font-size:14.5px}#tut .tsl span{display:flex;justify-content:space-between}#tut .tsl input{width:100%;accent-color:#22c55e;height:28px}';
  document.head.appendChild(css);
  var div = document.createElement('div'); div.id = 'tut';
  div.innerHTML =
    '<div class="caixa">' +
    '<div class="topo"><b>🎬 Como montar e calibrar</b><button class="x" id="tutVoz" title="voz">🔊</button><button class="x" id="tutFechar">✕</button></div>' +
    '<div id="tutModos"><button data-m="lona">Saque · lona</button><button data-m="parede">Parede</button><button data-m="quadra">Quadra</button></div>' +
    '<canvas id="tutCanvas"></canvas><div id="tutProg"><div id="tutBarra"></div></div>' +
    '<div id="tutTitulo"></div><div id="tutTxt"></div>' +
    '<div class="ctl"><button id="tutAnt">⏮</button><button id="tutPausa">⏸</button><button id="tutProx">⏭</button><button id="tutDeNovo">↺</button></div>' +
    '<div class="cartao" style="margin-top:10px;padding:10px"><div class="lado" style="align-items:center"><b style="flex:2 1 160px">🔧 Mexa e veja</b>' +
    '<button class="x" id="tutVista" style="flex:1 1 120px;width:auto;border-radius:10px;font-size:14px">vista de cima</button></div>' +
    '<div id="tutSl"></div><div id="tutEfeito" class="peq" style="margin-top:6px;font-size:14.5px;color:#d6e6dd"></div>' +
    '<button class="bt verde" id="tutSalvar" style="padding:10px;font-size:15px">💾 Usar estas medidas no app</button><div id="tutSalvo" class="peq"></div></div>' +
    '<div id="tutFim"><button class="bt verde" id="tutIrMont">📐 Ir para a Montagem (minhas medidas)</button><button class="bt cinza" id="tutIrCal">🎯 Ir para Calibrar</button></div>' +
    '<div class="peq" style="text-align:center;margin-top:10px">As medidas do desenho são as suas (aba Montagem). Mude lá e a animação acompanha.</div>' +
    '</div>';
  document.body.appendChild(div);
  $('tutFechar').onclick = fechar;
  $('tutAnt').onclick = function () { irPara(iCena - 1); };
  $('tutProx').onclick = function () { if (iCena < cenas.length - 1) irPara(iCena + 1); else fim(); };
  $('tutDeNovo').onclick = function () { irPara(0); };
  $('tutPausa').onclick = function () {
    if (pausa) { pausa = false; t0 = performance.now() - tPausa; this.textContent = '⏸'; $('tutFim').style.display = 'none'; if (iCena === cenas.length - 1 && tPausa >= cenas[iCena].d * 1000) irPara(0); }
    else { pausa = true; tPausa = performance.now() - t0; this.textContent = '▶'; if (window.speechSynthesis) speechSynthesis.cancel(); }
  };
  $('tutVoz').onclick = function () { comVoz = !comVoz; this.textContent = comVoz ? '🔊' : '🔇'; if (!comVoz && window.speechSynthesis) speechSynthesis.cancel(); };
  document.querySelectorAll('#tutModos button').forEach(function (b) { b.onclick = function () { abrir(b.dataset.m); }; });
  $('tutVista').onclick = function () { vistaExp = vistaExp === 'camera' ? 'cima' : 'camera'; this.textContent = vistaExp === 'camera' ? 'vista de cima' : 'vista da câmera'; explorar(false); };
  $('tutSalvar').onclick = function () {
    var cfg = TS.cfg;
    function poe(id, v) { var el = $(id); el.value = v; el.dispatchEvent(new Event('change')); }
    if (modoAt !== 'quadra') poe(modoAt === 'parede' ? 'pD' : 'mD', med.d);
    if (modoAt === cfg.modo) { poe('cAtras', med.atras); poe('cLado', med.lado); poe('cH', med.h); }
    else { cfg.celPor[modoAt] = { atras: med.atras, lado: med.lado, h: med.h, ladoEsq: med.ladoEsq }; TS.salvar(); }
    $('tutSalvo').textContent = '✔ Guardado. Confira a aba Montagem e calibre de novo depois de mudar o tripé.';
    setTimeout(function () { $('tutSalvo').textContent = ''; }, 5000);
  };
  $('tutIrMont').onclick = function () { fechar(); TS.abrirAba('montagem'); };
  $('tutIrCal').onclick = function () { fechar(); TS.abrirAba('calibrar'); };
  document.querySelectorAll('.btTutorial').forEach(function (b) { b.onclick = function () { abrir(); }; });

  // primeira visita: convida (a voz só pode começar depois de um toque, então abre pelo convite)
  var visto = false; try { visto = localStorage.getItem('ts_tutorial') === '1'; } catch (e) {}
  if (!visto && $('convite')) $('convite').style.display = '';

  window.Tutorial = { abrir: abrir, fechar: fechar, cena: cena, roteiro: roteiro };
})();
