/* Desenho da montagem (aba Montagem): vista de frente do alvo com as fitas, vista de cima do espaço e vista de lado
   com o jogador na altura dele e o celular no tripé. Também confere se tudo cabe no enquadramento do iPhone. */
(function () {
  var F = Fisica, G = Geom;
  var CAMPO_H = 2 * Math.atan(1920 / 2 / 1450) * 180 / Math.PI, CAMPO_V = 2 * Math.atan(1080 / 2 / 1450) * 180 / Math.PI;   // ~67° × 41°
  function n2(x) { return x.toFixed(2).replace('.', ','); }
  function n1(x) { return x.toFixed(1).replace('.', ','); }
  function cm(x) { return Math.round(x * 100) + ' cm'; }

  /** Tudo o que o desenho precisa, calculado com a física do app para a montagem atual. */
  function dados() {
    var cfg = TS.cfg, parede = cfg.modo === 'parede', p0 = TS.contatoNominal(), L = TS.lona(), d = parede ? cfg.par.d : cfg.mont.d;
    var r = { parede: parede, p0: p0, L: L, d: d, alt: cfg.jog.alt, cel: cfg.cel, lado: cfg.lado };
    if (parede) {
      var kmh = +document.getElementById('pVel').value, tipo = document.getElementById('pTipo').value;
      r.kmh = kmh; r.tipo = tipo;
      r.fitaRede = TS.alturaRedeNaParede(kmh, tipo, d) - F.R;            // recomendada
      r.fitaColada = cfg.par.fita;                                         // a que o usuário colou (medida)
      r.fitaFunda = TS.alturaNaParedePara(kmh, tipo, d, F.QUADRA.saque) - F.R;
      r.fitaFundo = TS.alturaNaParedePara(kmh, tipo, d, F.QUADRA.fundo) - F.R;
      var reg = TS.regiaoNaLona(kmh, tipo, null);
      var ys = reg.map(function (q) { return q[0]; });
      r.lateral = ys.length ? Math.max(Math.abs(Math.min.apply(null, ys)), Math.abs(Math.max.apply(null, ys))) : 1.6;
      r.reg = reg;
    } else {
      var kmh2 = +document.getElementById('mVel').value, tipo2 = document.getElementById('mTipo').value;
      r.kmh = kmh2; r.tipo = tipo2;
      r.reg = TS.regiaoNaLona(kmh2, tipo2, null);
      var zs = r.reg.map(function (q) { return q[1]; }), ys2 = r.reg.map(function (q) { return q[0]; });
      if (zs.length) r.alvo = { zMin: Math.min.apply(null, zs) - F.R, zMax: Math.max.apply(null, zs) + F.R, yMin: Math.min.apply(null, ys2), yMax: Math.max.apply(null, ys2) };
    }
    r.C = SIM.posicaoCelular(cfg.cel);
    r.enq = enquadramento(r);
    return r;
  }
  /** O celular apontado para o meio da cena: os pontos importantes cabem no quadro (com 5% de margem)? */
  function enquadramento(r) {
    var C = r.C, alvo = SIM.miraCelular(C), cam = G.cameraOlhando(C, alvo, 1450, 1920, 1080);
    var pts = SIM.pontosEssenciais();
    var fora = [], piorMargem = 1, chaoVisto = 0, medido = TS.cfg.cel.usar && TS.cfg.modo !== 'quadra';
    pts.forEach(function (p) {
      var q = G.projetar(cam, p.X), mx = Math.min(q[0], 1920 - q[0]) / 1920, my = Math.min(q[1], 1080 - q[1]) / 1080;
      var m = q[2] > 0 ? Math.min(mx, my) : -1, chao = /fita no chão/.test(p.nome);
      if (chao && m >= 0.03) chaoVisto++;
      if (chao && medido) return;             // com o tripé medido, basta uma das fitas do chão (conferido abaixo)
      piorMargem = Math.min(piorMargem, m);
      if (m < 0.03) fora.push(p.nome);
    });
    if (medido && !chaoVisto) fora.push('as duas fitas do chão (pelo menos uma precisa aparecer)');
    // distância (em px) da bola no contato e no alvo: quanto maior, mais precisa a medida
    var bolaContato = 2 * F.R * 1450 / Math.hypot(r.p0[0] - C[0], r.p0[1] - C[1], r.p0[2] - C[2]);
    var bolaAlvo = 2 * F.R * 1450 / Math.hypot(r.L.x - C[0], (r.L.yEsq + r.L.yDir) / 2 - C[1], 1.8 - C[2]);
    return { ok: !fora.length, fora: fora, margem: piorMargem, bolaContato: bolaContato, bolaAlvo: bolaAlvo, cam: cam, alvoCam: alvo };
  }

  /* ---------------------------------------------------------------- desenho */
  function desenhar() {
    var cv = document.getElementById('cPlano'); if (!cv || TS.cfg.modo === 'quadra') { if (cv) cv.style.display = 'none'; return null; }
    cv.style.display = '';
    var r = dados(), g = cv.getContext('2d'), W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H); g.font = '21px -apple-system, sans-serif'; g.textBaseline = 'middle';
    var h1 = Math.round(H * 0.40), h2 = Math.round(H * 0.30);
    frente(g, r, 0, 0, W, h1);
    cima(g, r, 0, h1, W, h2);
    lado(g, r, 0, h1 + h2, W, H - h1 - h2);
    return r;
  }
  function titulo(g, t, x, y) { g.fillStyle = '#eef5f1'; g.font = 'bold 23px -apple-system, sans-serif'; g.fillText(t, x, y); g.font = '20px -apple-system, sans-serif'; }
  function seta(g, x1, y1, x2, y2, txt, cor, lado) {   // cota com setas
    g.strokeStyle = cor || '#9db8ab'; g.fillStyle = cor || '#9db8ab'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    var a = Math.atan2(y2 - y1, x2 - x1);
    [[x1, y1, a + Math.PI], [x2, y2, a]].forEach(function (p) {
      g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(p[0] - 7 * Math.cos(p[2] - 0.4), p[1] - 7 * Math.sin(p[2] - 0.4));
      g.lineTo(p[0] - 7 * Math.cos(p[2] + 0.4), p[1] - 7 * Math.sin(p[2] + 0.4)); g.closePath(); g.fill();
    });
    if (txt) { g.save(); var mx = (x1 + x2) / 2, my = (y1 + y2) / 2; g.fillStyle = '#0b1a14'; var w = g.measureText(txt).width + 8;
      var ox = lado === 'd' ? w / 2 + 6 : lado === 'e' ? -w / 2 - 6 : 0, oy = lado === 'c' ? -16 : 0;
      g.fillRect(mx + ox - w / 2, my + oy - 13, w, 26); g.fillStyle = cor || '#eef5f1'; g.textAlign = 'center'; g.fillText(txt, mx + ox, my + oy); g.restore(); }
  }

  /* vista de frente: a lona ou a parede, com as fitas e as cotas */
  function frente(g, r, X0, Y0, W, H) {
    titulo(g, r.parede ? '🧱 Parede vista de frente (você olhando para ela)' : '🎯 Lona vista de frente (você olhando para ela)', X0 + 12, Y0 + 16);
    var L = r.L, mira = r.p0[1];
    var yMin, yMax, zTop;
    if (r.parede) { var meia = Math.max(L.larg ? L.larg / 2 : 1.5, r.lateral + 0.4); yMin = -meia - 0.3; yMax = meia + 0.3; zTop = Math.max(r.fitaFundo || 3, r.fitaColada) + 0.5; }
    else { yMin = L.yDir - 0.4; yMax = L.yEsq + 0.4; zTop = L.zt + 0.3; }
    var mE = 80, mD = r.parede ? 230 : 120, mT = 46, mB = 34, s = Math.min((W - mE - mD) / (yMax - yMin), (H - mT - mB) / zTop);
    var ox = X0 + mE + ((W - mE - mD) - (yMax - yMin) * s) / 2, oy = Y0 + mT;
    function P(y, z) { return [ox + (yMax - y) * s, oy + (zTop - z) * s]; }     // esquerda do jogador = esquerda do desenho
    // chão
    var c0 = P(yMax, 0), c1 = P(yMin, 0); g.strokeStyle = '#6b8f80'; g.lineWidth = 2; g.beginPath(); g.moveTo(c0[0], c0[1]); g.lineTo(c1[0], c1[1]); g.stroke();
    if (r.parede) {
      var w0 = P(yMax, zTop), w1 = P(yMin, 0); g.fillStyle = '#cfcac0'; g.fillRect(w0[0], w0[1], w1[0] - w0[0], w1[1] - w0[1]);
      // fitas horizontais
      var meiaF = L.larg / 2;
      function fita(z, cor, nome, grossa) { var a = P(meiaF, z), b = P(-meiaF, z); g.strokeStyle = cor; g.lineWidth = grossa ? 6 : 4; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
        g.fillStyle = cor; g.textAlign = 'left'; g.font = 'bold 20px -apple-system, sans-serif'; g.fillText(nome, b[0] + 6, b[1]); g.font = '20px -apple-system, sans-serif'; }
      if (!isNaN(r.fitaFundo)) fita(r.fitaFundo, '#2563eb', 'azul ' + n2(r.fitaFundo) + ' m');
      if (!isNaN(r.fitaFunda)) fita(r.fitaFunda, '#ca8a04', 'amarela ' + n2(r.fitaFunda) + ' m');
      fita(r.fitaColada, '#dc2626', 'vermelha (rede) ' + n2(r.fitaColada) + ' m', true);
      if (Math.abs(r.fitaColada - r.fitaRede) > 0.02) {       // a recomendada, se a colada for diferente
        var a2 = P(meiaF, r.fitaRede), b2 = P(-meiaF, r.fitaRede); g.setLineDash([6, 5]); g.strokeStyle = '#dc2626'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(a2[0], a2[1]); g.lineTo(b2[0], b2[1]); g.stroke(); g.setLineDash([]);
        g.fillStyle = '#7f1d1d'; g.textAlign = 'right'; g.fillText('ideal ' + n2(r.fitaRede) + ' m', a2[0] - 6, a2[1]);
      }
      // laterais da quadra
      [r.lateral, -r.lateral].forEach(function (y) { var a = P(y, r.fitaColada - 0.25), b = P(y, Math.min(zTop - 0.1, (r.fitaFundo || 3) + 0.2)); g.strokeStyle = '#16a34a'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); });
      // marcas da calibração: pontas da fita vermelha e pé da parede
      [[meiaF, r.fitaColada], [-meiaF, r.fitaColada], [meiaF, 0], [-meiaF, 0]].forEach(function (q, i) { var p = P(q[0], q[1]); marca(g, p[0], p[1], ['1', '2', '4', '3'][i]); });
      // cotas
      var cx = P(-meiaF - 0.15, 0)[0];
      seta(g, cx, P(0, 0)[1], cx, P(0, r.fitaColada)[1], n2(r.fitaColada) + ' m', '#fca5a5', 'd');
      var la = P(r.lateral, 0.25), lb = P(-r.lateral, 0.25); seta(g, la[0], la[1], lb[0], lb[1], 'laterais: ' + n2(r.lateral) + ' m para cada lado da linha de mira', '#86efac', 'c');
      var fa = P(meiaF, r.fitaColada + 0.18), fb = P(-meiaF, r.fitaColada + 0.18); seta(g, fa[0], fa[1], fb[0], fb[1], 'fita com ' + n2(L.larg) + ' m', '#fca5a5', 'c');
    } else {
      var t0 = P(L.yEsq, L.zt), t1 = P(L.yDir, L.zb); g.fillStyle = '#dcd8cf'; g.fillRect(t0[0], t0[1], t1[0] - t0[0], t1[1] - t0[1]);
      g.strokeStyle = '#0003'; g.lineWidth = 1;
      for (var z = Math.ceil(L.zb * 2) / 2; z < L.zt; z += 0.5) { var a = P(L.yEsq, z), b = P(L.yDir, z); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
      // região que entra (a curva exata) e o retângulo de fita que a contém
      if (r.reg.length) { g.fillStyle = '#16a34a44'; g.beginPath(); r.reg.forEach(function (q, i) { var p = P(q[0], q[1]); if (!i) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]); }); g.closePath(); g.fill(); }
      if (r.alvo) {
        var A0 = P(r.alvo.yMax, r.alvo.zMax), A1 = P(r.alvo.yMin, r.alvo.zMin); g.strokeStyle = '#15803d'; g.lineWidth = 5; g.strokeRect(A0[0], A0[1], A1[0] - A0[0], A1[1] - A0[1]);
        g.fillStyle = '#14532d'; g.textAlign = 'center'; g.font = 'bold 20px -apple-system, sans-serif'; g.fillText('MIRE AQUI', (A0[0] + A1[0]) / 2, (A0[1] + A1[1]) / 2 + 7); g.font = '20px -apple-system, sans-serif'; g.textAlign = 'left';
        var xc = A1[0] + 14;
        seta(g, xc, P(0, L.zb)[1], xc, A1[1], 'base ' + n2(r.alvo.zMin) + ' m', '#86efac', 'd');
        seta(g, xc + 0, A1[1], xc, A0[1], 'altura ' + cm(r.alvo.zMax - r.alvo.zMin), '#86efac', 'd');
        var dl = (r.alvo.yMin - mira) * r.lado, dr = (r.alvo.yMax - mira) * r.lado, yy = A0[1] - 12;
        var pm = P(mira, 0)[0];
        seta(g, pm, yy, A1[0], yy, cm(Math.abs(dl)), '#86efac', 'c');
        seta(g, pm, yy - 22, A0[0], yy - 22, cm(Math.abs(dr)) + (r.lado > 0 ? ' à esquerda' : ' à direita'), '#86efac', 'c');
      }
      // cantos (calibração)
      [[L.yEsq, L.zt], [L.yDir, L.zt], [L.yDir, L.zb], [L.yEsq, L.zb]].forEach(function (q, i) { var p = P(q[0], q[1]); marca(g, p[0], p[1], String(i + 1)); });
      var cl = P(L.yDir, 0)[0] + 18; seta(g, cl, P(0, 0)[1], cl, P(0, L.zb)[1], n2(L.zb) + ' m', '#9db8ab', 'd'); seta(g, cl + 70, P(0, 0)[1], cl + 70, P(0, L.zt)[1], n2(L.zt) + ' m', '#9db8ab', 'd');
      var borda = r.lado > 0 ? L.yEsq : L.yDir, le = P(borda, L.zt + 0.15), lm = P(mira, L.zt + 0.15);
      seta(g, le[0], le[1], lm[0], lm[1], 'borda ' + (r.lado > 0 ? 'esquerda' : 'direita') + ' a ' + n2(Math.abs(borda - mira)) + ' m da mira', '#9db8ab', 'c');
    }
    // linha de mira
    var m0 = P(mira, 0), m1 = P(mira, zTop); g.strokeStyle = '#38bdf8'; g.setLineDash([7, 5]); g.lineWidth = 2; g.beginPath(); g.moveTo(m0[0], m0[1]); g.lineTo(m1[0], m1[1] + 18); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#38bdf8'; g.textAlign = 'center'; g.fillText(r.parede ? 'linha de mira' : 'linha de mira (reta à sua frente)', m0[0], m0[1] + 14); g.textAlign = 'left';
    // régua de alturas
    g.fillStyle = '#9db8ab'; g.textAlign = 'right';
    for (var zz = 0; zz <= zTop + 1e-6; zz += 0.5) { var pz = P(yMax, zz); g.fillText(n1(zz) + ' m', ox - 8, pz[1]); g.strokeStyle = '#24463a'; g.beginPath(); g.moveTo(ox - 4, pz[1]); g.lineTo(ox, pz[1]); g.stroke(); }
    g.textAlign = 'left';
  }
  function marca(g, x, y, t) {
    g.strokeStyle = '#111'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 9, y - 9); g.lineTo(x + 9, y + 9); g.moveTo(x + 9, y - 9); g.lineTo(x - 9, y + 9); g.stroke();
    g.fillStyle = '#facc15'; g.beginPath(); g.arc(x + 14, y - 14, 12, 0, 7); g.fill(); g.fillStyle = '#111'; g.textAlign = 'center'; g.font = 'bold 16px sans-serif'; g.fillText(t, x + 14, y - 14); g.textAlign = 'left'; g.font = '20px -apple-system, sans-serif';
  }

  /* vista de cima: o espaço, a linha de mira, as fitas do chão e o tripé com o campo de visão */
  function cima(g, r, X0, Y0, W, H) {
    titulo(g, '⬇️ Vista de cima', X0 + 12, Y0 + 16);
    var L = r.L, C = r.C, xMin = Math.min(r.p0[0] - 1.5, C[0]) - 0.6, xMax = L.x + 0.6;
    var ys = [L.yEsq, L.yDir, C[1], r.p0[1]]; var yMin = Math.min.apply(null, ys) - 0.6, yMax = Math.max.apply(null, ys) + 0.6;
    var mT = 36, mB = 28, s = Math.min((W - 40) / (xMax - xMin), (H - mT - mB) / (yMax - yMin));
    var ox = X0 + (W - (xMax - xMin) * s) / 2, oy = Y0 + mT + ((H - mT - mB) - (yMax - yMin) * s) / 2;
    function P(x, y) { return [ox + (x - xMin) * s, oy + (yMax - y) * s]; }      // esquerda do jogador = em cima
    // campo de visão do celular
    var e = r.enq, dir = [e.alvoCam[0] - C[0], e.alvoCam[1] - C[1]], ang = Math.atan2(dir[1], dir[0]), meio = CAMPO_H / 2 * Math.PI / 180, alc = 16;
    var pc = P(C[0], C[1]), pa = P(C[0] + alc * Math.cos(ang + meio), C[1] + alc * Math.sin(ang + meio)), pb = P(C[0] + alc * Math.cos(ang - meio), C[1] + alc * Math.sin(ang - meio));
    g.save(); g.beginPath(); g.rect(X0, Y0 + 24, W, H - 24); g.clip();
    g.fillStyle = e.ok ? '#38bdf822' : '#ef444422'; g.beginPath(); g.moveTo(pc[0], pc[1]); g.lineTo(pa[0], pa[1]); g.lineTo(pb[0], pb[1]); g.closePath(); g.fill(); g.restore();
    // alvo
    var a = P(L.x, L.yEsq), b = P(L.x, L.yDir); g.strokeStyle = r.parede ? '#cfcac0' : '#dcd8cf'; g.lineWidth = 7; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    // linha de mira e fitas do chão
    var m0 = P(r.p0[0], r.p0[1]), m1 = P(L.x, r.p0[1]); g.strokeStyle = '#38bdf8'; g.setLineDash([7, 5]); g.lineWidth = 2; g.beginPath(); g.moveTo(m0[0], m0[1]); g.lineTo(m1[0], m1[1]); g.stroke(); g.setLineDash([]);
    marca(g, m0[0], m0[1], '5'); var mm = P(r.p0[0] + r.d / 2, r.p0[1]); marca(g, mm[0], mm[1], '6');
    // jogador
    g.fillStyle = '#facc15'; g.beginPath(); g.arc(m0[0] - 6, m0[1], 7, 0, 7); g.fill();
    // celular
    g.fillStyle = e.ok ? '#38bdf8' : '#ef4444'; g.fillRect(pc[0] - 7, pc[1] - 7, 14, 14);
    g.fillStyle = '#eef5f1'; g.textAlign = 'center'; g.fillText('📱', pc[0], pc[1] - 16);
    // cotas
    var yc = Math.max(m0[1], m1[1]) + 22;
    seta(g, m0[0], yc + 14, m1[0], yc + 14, n2(r.d) + ' m até ' + (r.parede ? 'a parede' : 'a lona'), '#eef5f1', 'c');
    var pt = P(C[0], r.p0[1]); seta(g, pc[0], pc[1], pt[0], pt[1], n2(r.cel.lado) + ' m', '#38bdf8', 'd');
    seta(g, pt[0], pt[1] + 0, m0[0], m0[1], n2(r.cel.atras) + ' m atrás', '#38bdf8', 'c');
    g.textAlign = 'left';
    var esp = (r.p0[0] - Math.min(C[0], r.p0[0] - 1.5)) + r.d + 0.4;
    g.fillStyle = '#9db8ab'; g.fillText('Espaço usado: ' + n1(esp) + ' m de comprimento', X0 + 12, Y0 + H - 10);
  }

  /* vista de lado: o jogador na altura dele, o contato, a trajetória e o celular no tripé */
  function lado(g, r, X0, Y0, W, H) {
    titulo(g, '➡️ Vista de lado', X0 + 12, Y0 + 16);
    var L = r.L, C = r.C, xMin = Math.min(C[0], r.p0[0] - 0.8) - 0.5, xMax = L.x + 0.5;
    var zTop = Math.max(r.parede ? (r.fitaFundo || 3) + 0.4 : L.zt + 0.4, r.p0[2] + 0.9, r.alt + 0.4);
    var mT = 40, mB = 30, s = Math.min((W - 130) / (xMax - xMin), (H - mT - mB) / zTop);
    var ox = X0 + 100, oy = Y0 + mT;
    function P(x, z) { return [ox + (x - xMin) * s, oy + (zTop - z) * s]; }
    var g0 = P(xMin, 0), g1 = P(xMax, 0); g.strokeStyle = '#6b8f80'; g.lineWidth = 2; g.beginPath(); g.moveTo(g0[0], g0[1]); g.lineTo(g1[0], g1[1]); g.stroke();
    // alvo
    var a = P(L.x, r.parede ? 0 : L.zb), b = P(L.x, r.parede ? zTop : L.zt); g.strokeStyle = r.parede ? '#cfcac0' : '#dcd8cf'; g.lineWidth = 8; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    if (r.parede) { var fr = P(L.x, r.fitaColada); g.fillStyle = '#dc2626'; g.fillRect(fr[0] - 6, fr[1] - 3, 12, 6); }
    // jogador (boneco na altura informada) com a raquete no contato
    var xp = r.p0[0] - (r.parede ? 0.6 : 0.3), pe = P(xp, 0), cab = P(xp, r.alt - 0.12), quadril = P(xp, r.alt * 0.53), ombro = P(xp, r.alt * 0.82);
    g.strokeStyle = '#facc15'; g.lineWidth = 4; g.beginPath(); g.moveTo(pe[0] - 8, pe[1]); g.lineTo(quadril[0], quadril[1]); g.lineTo(pe[0] + 8, pe[1]); g.moveTo(quadril[0], quadril[1]); g.lineTo(ombro[0], ombro[1]); g.stroke();
    g.fillStyle = '#facc15'; g.beginPath(); g.arc(cab[0], cab[1], 0.12 * s, 0, 7); g.fill();
    var pcn = P(r.p0[0], r.p0[2]); g.strokeStyle = '#facc15'; g.lineWidth = 3; g.beginPath(); g.moveTo(ombro[0], ombro[1]); g.lineTo(pcn[0], pcn[1]); g.stroke();
    g.fillStyle = '#d9f99d'; g.beginPath(); g.arc(pcn[0], pcn[1], 6, 0, 7); g.fill();
    // trajetória típica até o alvo
    var ef = F.EFEITOS[r.tipo] || F.EFEITOS.chapado, el = r.parede ? 9 : -3 + (2.65 - r.p0[2]) * 5;
    if (!r.parede && r.alvo) el = Math.atan2((r.alvo.zMin + r.alvo.zMax) / 2 - r.p0[2], r.d) * 180 / Math.PI + 1.2;
    if (r.parede) el = Math.atan2((r.fitaColada + 0.35) - r.p0[2], r.d) * 180 / Math.PI + 3;
    var tr = F.voo(r.p0, F.vetorSaida(r.kmh, el, 0), ef, { guardar: true, xAlvo: L.x - F.R });
    g.strokeStyle = '#d9f99d'; g.setLineDash([5, 4]); g.lineWidth = 2; g.beginPath();
    tr.pts.forEach(function (pt, i) { if (i % 8) return; var q = P(pt.p[0], pt.p[2]); if (!i) g.moveTo(q[0], q[1]); else g.lineTo(q[0], q[1]); }); g.stroke(); g.setLineDash([]);
    // celular no tripé
    var pc = P(C[0], C[2]), pch = P(C[0], 0); g.strokeStyle = '#9db8ab'; g.lineWidth = 2; g.beginPath(); g.moveTo(pc[0], pc[1]); g.lineTo(pch[0] - 10, pch[1]); g.moveTo(pc[0], pc[1]); g.lineTo(pch[0] + 10, pch[1]); g.stroke();
    g.fillStyle = r.enq.ok ? '#38bdf8' : '#ef4444'; g.fillRect(pc[0] - 9, pc[1] - 5, 18, 10);
    // cotas
    seta(g, pch[0] - 22, pch[1], pch[0] - 22, pc[1], n2(C[2]) + ' m', '#38bdf8', 'e');
    var cc = P(r.p0[0] + 0.25, 0); seta(g, cc[0], cc[1], cc[0], pcn[1], 'contato ' + n2(r.p0[2]) + ' m', '#d9f99d', 'd');
    var hh = P(xp - 0.35, 0); seta(g, hh[0], hh[1], hh[0], cab[1] - 0.12 * s, n2(r.alt) + ' m', '#facc15', 'e');
  }

  /**
   * Procura a posição do tripé em que tudo cabe na imagem com folga e a bola aparece maior no alvo,
   * mantendo o celular de lado (pelo menos 1,2 m), que é o que dá melhor noção de profundidade.
   */
  function sugerirTripe() {
    var cfg = TS.cfg, orig = JSON.parse(JSON.stringify(cfg.cel)), melhor = null;
    for (var atras = 0.5; atras <= 6.01; atras += 0.25) for (var lado = 1.2; lado <= 4.01; lado += 0.2) for (var h = 1.0; h <= 2.01; h += 0.2) {
      cfg.cel.atras = atras; cfg.cel.lado = lado; cfg.cel.h = h;
      var r = { parede: cfg.modo === 'parede', p0: TS.contatoNominal(), L: TS.lona(), d: TS.distAlvo(), cel: cfg.cel };
      if (r.parede) r.fitaFundo = TS.alturaNaParedePara(+document.getElementById('pVel').value, document.getElementById('pTipo').value, r.d, F.QUADRA.fundo) - F.R;
      r.C = SIM.posicaoCelular(cfg.cel);
      var e = enquadramento(r);
      if (!e.ok || e.margem < 0.05) continue;
      var nota = Math.min(e.bolaAlvo, 14) * 2 + Math.min(e.bolaContato, 40) * 0.1 - atras * 0.3;   // bola grande no alvo, sem ficar longe demais
      if (!melhor || nota > melhor.nota) melhor = { nota: nota, atras: atras, lado: lado, h: h };
    }
    cfg.cel.atras = orig.atras; cfg.cel.lado = orig.lado; cfg.cel.h = orig.h;
    return melhor;
  }
  /** Texto do enquadramento e o que fazer se não couber. */
  function textoEnquadramento(r) {
    var e = r.enq;
    var t = e.ok ? '✅ Com o celular nesta posição, o contato e ' + (r.parede ? 'as fitas' : 'a lona') + ' cabem na imagem (câmera normal 1×, deitado).'
                 : '⚠️ Não cabe tudo na imagem: ' + e.fora.join(', ') + '. Afaste o tripé para trás ou para o lado, ou abaixe/levante o celular.';
    t += '<br>Tamanho da bola na imagem: ' + Math.round(e.bolaContato) + ' px no contato e ' + Math.round(e.bolaAlvo) + ' px no alvo' +
         (e.bolaAlvo < 5 ? ' — pequena: aproxime o tripé do alvo' : '') + '.';
    return t;
  }
  window.Plano = { desenhar: desenhar, dados: dados, textoEnquadramento: textoEnquadramento, sugerirTripe: sugerirTripe };
})();
