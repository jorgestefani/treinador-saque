/* Apresentação do app (roda sozinha ao abrir) + o "boneco" do saque, usado também no modo Posição.
   O Safari do iPhone só deixa falar depois de um toque: a animação começa muda e um toque liga a narração. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }

  /* ------------------------------------------------------------ boneco do saque (vista de lado, olhando para a rede à direita) */
  // posições em metros (x para a rede, y para cima); rk = ponta da raquete
  var K = [
    { t: 0.00, head: [0.04, 1.63], neck: [0.02, 1.47], hip: [0.00, 0.95], fKn: [0.25, 0.50], fAn: [0.38, 0.05], bKn: [-0.18, 0.50], bAn: [-0.32, 0.05],
      tElb: [0.18, 1.22], tWri: [0.38, 1.08], hElb: [0.15, 1.18], hWri: [0.32, 1.05], rk: [0.80, 1.20] },
    { t: 0.70, head: [-0.02, 1.62], neck: [-0.03, 1.46], hip: [-0.06, 0.94], fKn: [0.22, 0.50], fAn: [0.38, 0.05], bKn: [-0.22, 0.49], bAn: [-0.32, 0.05],
      tElb: [0.15, 1.15], tWri: [0.30, 0.98], hElb: [0.05, 1.12], hWri: [0.15, 0.92], rk: [0.45, 0.55] },
    { t: 1.30, head: [0.07, 1.63], neck: [0.05, 1.47], hip: [0.04, 0.93], fKn: [0.27, 0.49], fAn: [0.38, 0.05], bKn: [-0.17, 0.49], bAn: [-0.32, 0.05],
      tElb: [0.14, 1.78], tWri: [0.22, 2.08], hElb: [-0.18, 1.20], hWri: [-0.32, 0.98], rk: [-0.62, 0.62] },
    { t: 1.75, head: [-0.03, 1.47], neck: [-0.04, 1.31], hip: [0.05, 0.80], fKn: [0.33, 0.45], fAn: [0.38, 0.05], bKn: [-0.10, 0.42], bAn: [-0.30, 0.05],
      tElb: [0.12, 1.70], tWri: [0.22, 2.00], hElb: [-0.28, 1.38], hWri: [-0.22, 1.66], rk: [-0.12, 2.25] },
    { t: 2.00, head: [0.13, 1.64], neck: [0.10, 1.48], hip: [0.12, 0.95], fKn: [0.30, 0.52], fAn: [0.38, 0.10], bKn: [-0.05, 0.52], bAn: [-0.20, 0.12],
      tElb: [0.20, 1.50], tWri: [0.32, 1.55], hElb: [-0.05, 1.62], hWri: [-0.20, 1.40], rk: [-0.35, 0.85] },
    { t: 2.15, head: [0.36, 1.78], neck: [0.32, 1.62], hip: [0.25, 1.12], fKn: [0.35, 0.65], fAn: [0.42, 0.20], bKn: [0.05, 0.68], bAn: [-0.05, 0.30],
      tElb: [0.30, 1.30], tWri: [0.38, 1.12], hElb: [0.38, 1.92], hWri: [0.48, 2.20], rk: [0.62, 2.85] },
    { t: 2.65, head: [0.82, 1.60], neck: [0.75, 1.45], hip: [0.55, 0.95], fKn: [0.65, 0.50], fAn: [0.60, 0.05], bKn: [0.35, 0.60], bAn: [0.20, 0.35],
      tElb: [0.60, 1.25], tWri: [0.45, 1.05], hElb: [0.85, 1.10], hWri: [0.70, 0.85], rk: [0.30, 0.60] }
  ];
  var DUR = 3.2, T_SOLTA = 1.30, T_CONTATO = 2.15, APICE = 3.30, CONTATO = [0.62, 2.80];
  var NOMES = ['parado', 'peso atrás', 'soltou a bola', 'troféu', 'raquete atrás', 'contato', 'finalização'];
  function suave(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  function poseEm(t) {
    t = Math.max(0, Math.min(K[K.length - 1].t, t));
    for (var i = 0; i < K.length - 1 && t > K[i + 1].t; i++);
    var a = K[i], b = K[Math.min(i + 1, K.length - 1)], u = b.t > a.t ? suave((t - a.t) / (b.t - a.t)) : 0, p = {};
    Object.keys(a).forEach(function (k) { if (k !== 't') p[k] = [a[k][0] + (b[k][0] - a[k][0]) * u, a[k][1] + (b[k][1] - a[k][1]) * u]; });
    return p;
  }
  // bola: na mão até soltar, sobe até o ápice e desce até o contato; depois sai rápida para a rede
  function bolaEm(t) {
    if (t < T_SOLTA) { var p = poseEm(t); return [p.tWri[0] + 0.03, p.tWri[1] + 0.05]; }
    var x0 = 0.25, y0 = 2.13, T = T_CONTATO - T_SOLTA;
    var subida = Math.sqrt(2 * (APICE - y0) / 9.8), v = 9.8 * subida;
    if (t <= T_CONTATO) { var s = t - T_SOLTA, k = s / T, ac = 2 * (y0 + v * T - CONTATO[1]) / (T * T);   // aceleração que fecha no contato (≈ g)
      return [x0 + (CONTATO[0] - x0) * k, y0 + v * s - ac / 2 * s * s]; }
    var d = t - T_CONTATO; return [CONTATO[0] + 30 * d, CONTATO[1] - 4 * d];
  }
  // desenha o boneco. o = {x, y (chão), s (px por metro), espelho, cor, juntas (bolinhas), sem bola}
  function desenhar(g, p, o) {
    var e = o.espelho ? -1 : 1;
    function P(q) { return [o.x + e * q[0] * o.s, o.y - q[1] * o.s]; }
    function L(a, b, cor, lw) { var A = P(a), B = P(b); g.strokeStyle = cor; g.lineWidth = lw; g.lineCap = 'round'; g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke(); }
    var cor = o.cor || '#eef5f1', trás = o.corTras || '#9db8ab', lw = Math.max(3, o.s * 0.055);
    var sh = [p.neck[0], p.neck[1] - 0.07];
    // perna e braço de trás (mais apagados)
    L(p.hip, p.bKn, trás, lw); L(p.bKn, p.bAn, trás, lw); L(p.bAn, [p.bAn[0] - 0.05, p.bAn[1] - 0.03], trás, lw);
    L(sh, p.hElb, trás, lw); L(p.hElb, p.hWri, trás, lw);
    // raquete
    var A = P(p.hWri), B = P(p.rk), dx = B[0] - A[0], dy = B[1] - A[1], n = Math.hypot(dx, dy) || 1;
    var cabo = 0.42, C = [A[0] + dx * cabo, A[1] + dy * cabo];
    g.strokeStyle = '#facc15'; g.lineWidth = lw * 0.6; g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(C[0], C[1]); g.stroke();
    g.save(); g.translate((C[0] + B[0]) / 2, (C[1] + B[1]) / 2); g.rotate(Math.atan2(dy, dx));
    g.beginPath(); g.ellipse(0, 0, n * (1 - cabo) / 2, n * 0.17, 0, 0, 7); g.strokeStyle = '#facc15'; g.lineWidth = lw * 0.55; g.stroke(); g.restore();
    // tronco, perna e braço da frente
    L(p.hip, sh, cor, lw * 1.25); L(p.neck, sh, cor, lw);
    L(p.hip, p.fKn, cor, lw); L(p.fKn, p.fAn, cor, lw); L(p.fAn, [p.fAn[0] + 0.12, p.fAn[1] - 0.03], cor, lw);
    L(sh, p.tElb, cor, lw); L(p.tElb, p.tWri, cor, lw);
    var H = P(p.head); g.fillStyle = cor; g.beginPath(); g.arc(H[0], H[1], o.s * 0.115, 0, 7); g.fill();
    if (o.juntas) [p.fKn, p.bKn, p.tElb, p.hElb, p.tWri, p.hWri, p.hip, sh].forEach(function (q) { var Q = P(q); g.fillStyle = '#22c55e'; g.beginPath(); g.arc(Q[0], Q[1], lw * 0.75, 0, 7); g.fill(); });
    if (o.bola) { var b = P(o.bola); g.fillStyle = '#d9f20f'; g.beginPath(); g.arc(b[0], b[1], Math.max(4, o.s * 0.06), 0, 7); g.fill(); }
    return P;
  }
  window.Boneco = { poseEm: poseEm, bolaEm: bolaEm, desenhar: desenhar, DUR: DUR, T: { solta: T_SOLTA, contato: T_CONTATO },
    chave: function (nome) { var i = { parado: 0, peso: 1, solta: 2, trofeu: 3, atras: 4, contato: 5, fim: 6 }[nome]; return poseEm(K[i].t); } };

  /* ------------------------------------------------------------ apresentação */
  var W = 720, H = 560, g, cv, iCena = 0, t0 = 0, raf = 0, comVoz = false, aberta = false, pausa = false, tPausa = 0;
  function fonte(px, b) { g.font = (b ? 'bold ' : '') + px + 'px -apple-system, system-ui, sans-serif'; }
  function texto(t, x, y, cor, px, al, b) { fonte(px, b); g.fillStyle = cor; g.textAlign = al || 'center'; g.fillText(t, x, y); g.textAlign = 'left'; }
  function balao(t, x, y, cor) {
    fonte(26, true); var w = g.measureText(t).width + 30;
    g.fillStyle = cor || '#22c55e'; g.beginPath(); g.roundRect ? g.roundRect(x - w / 2, y - 26, w, 44, 14) : g.rect(x - w / 2, y - 26, w, 44); g.fill();
    g.beginPath(); g.moveTo(x - 10, y + 18); g.lineTo(x, y + 32); g.lineTo(x + 10, y + 18); g.fill();
    texto(t, x, y + 5, '#04140b', 26, 'center', true);
  }
  function celular(x, y, s, falando) {      // celular no tripé (de lado)
    g.strokeStyle = '#9db8ab'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y - 1.25 * s); g.lineTo(x - 0.35 * s, y); g.moveTo(x, y - 1.25 * s); g.lineTo(x + 0.35 * s, y); g.moveTo(x, y - 1.25 * s); g.lineTo(x, y); g.stroke();
    g.fillStyle = '#e2e8f0'; g.fillRect(x - 0.05 * s, y - 1.45 * s, 0.1 * s, 0.22 * s);
    if (falando) { g.strokeStyle = '#22c55e'; g.lineWidth = 2; for (var k = 1; k <= 3; k++) { g.beginPath(); g.arc(x + 0.05 * s, y - 1.34 * s, k * 7, -0.6, 0.6); g.stroke(); } }
  }
  function chao(y) { g.fillStyle = '#0f3a2b'; g.fillRect(0, y, W, H - y); g.strokeStyle = '#e8efe9'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }

  var CENAS = [
    { t: 'Treinador de Saque', txt: 'Este é o Treinador de Saque. O iPhone, num tripé, vê a bola, ouve a raquete e fala o resultado de cada golpe.',
      d: function (t) {
        chao(480); celular(560, 480, 120, Math.sin(t * 6) > 0);
        var tt = (t * 0.9) % (DUR + 0.6); Boneco.desenhar(g, poseEm(tt), { x: 230, y: 480, s: 105, bola: tt < DUR ? bolaEm(tt) : null });
        texto('🎾 Treinador de Saque', W / 2, 70, '#eef5f1', 40, 'center', true);
        texto('desenvolvido por Jorge Stefani', W / 2, 108, '#9db8ab', 20);
      } },
    { t: 'Saque na lona, em casa', txt: 'Em casa, você saca numa lona a oito metros. O app mede a velocidade e o efeito, e diz onde a bola cairia na quadra de verdade.',
      d: function (t) {
        var s = 105, y0 = 500, x0 = 110, D = 5.2; chao(y0);            // a distância de 8 m aparece encurtada no desenho
        var lx = x0 + D * s; g.fillStyle = '#1e40af'; g.fillRect(lx, y0 - 3.0 * s, 10, 2.1 * s); g.fillStyle = '#16a34a'; g.fillRect(lx - 2, y0 - 1.6 * s, 14, 0.45 * s);
        texto('lona a 8 m', lx + 5, y0 - 3.1 * s, '#9db8ab', 16);
        celular(x0 - 70, y0, s * 0.8, false); texto('8 m (desenho fora de escala)', x0 + D * s / 2, y0 + 30, '#9db8ab', 16);
        var tt = Math.min(t * 0.8, DUR); Boneco.desenhar(g, poseEm(tt), { x: x0, y: y0, s: s, bola: tt < T_CONTATO ? bolaEm(tt) : null });
        var dt = t * 0.8 - T_CONTATO;
        if (dt > 0) {
          var k = Math.min(1, dt / 0.35), bx = x0 + (CONTATO[0] + (D - CONTATO[0]) * k) * s, by = y0 - (CONTATO[1] - 1.45 * k) * s;
          g.strokeStyle = '#facc1599'; g.setLineDash([6, 6]); g.lineWidth = 2; g.beginPath(); g.moveTo(x0 + CONTATO[0] * s, y0 - CONTATO[1] * s); g.lineTo(bx, by); g.stroke(); g.setLineDash([]);
          g.fillStyle = '#d9f20f'; g.beginPath(); g.arc(bx, by, 6, 0, 7); g.fill();
          if (k >= 1) { balao('Dentro! 152 km/h', 400, 110); g.strokeStyle = '#22c55e'; g.lineWidth = 3; g.beginPath(); g.arc(bx, by, 14 + 10 * Math.sin(dt * 8), 0, 7); g.stroke(); }
        }
      } },
    { t: 'Quadra de verdade', txt: 'Na quadra de verdade, ele segue a bola até o quique, fala se entrou e a velocidade de todos os saques.',
      d: function (t) {
        g.fillStyle = '#1d4ed8'; g.fillRect(110, 40, 500, 480); g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(160, 60, 400, 440);
        g.beginPath(); g.moveTo(110, 280); g.lineTo(610, 280); g.stroke();
        g.beginPath(); g.moveTo(160, 160); g.lineTo(560, 160); g.moveTo(360, 160); g.lineTo(360, 400); g.moveTo(160, 400); g.lineTo(560, 400); g.stroke();
        g.fillStyle = '#e2e8f0'; g.fillRect(105, 276, 510, 8);
        var k = Math.min(1, (t % 4) / 1.2), sx = 400, sy = 510, ax = 270, ay = 190, bx = sx + (ax - sx) * k, by = sy + (ay - sy) * k;
        g.fillStyle = '#ef4444'; g.beginPath(); g.arc(sx, sy + 6, 10, 0, 7); g.fill();
        g.strokeStyle = '#facc15'; g.setLineDash([7, 6]); g.lineWidth = 2; g.beginPath(); g.moveTo(sx, sy); g.lineTo(bx, by); g.stroke(); g.setLineDash([]);
        g.fillStyle = '#d9f20f'; g.beginPath(); g.arc(bx, by, 7 + 5 * Math.sin(k * Math.PI), 0, 7); g.fill();
        if (k >= 1) { g.strokeStyle = '#22c55e'; g.lineWidth = 3; g.beginPath(); g.arc(ax, ay, 16, 0, 7); g.stroke(); balao('In! 168 km/h', 470, 120); }
      } },
    { t: 'Forehand e backhand na parede', txt: 'Na parede, treine forehand e backhand. Uma fita faz o papel da rede, e o app diz se a bola passou e onde cairia.',
      d: function (t) {
        var s = 100, y0 = 500, x0 = 110, D = 5.3; chao(y0);
        g.fillStyle = '#57534e'; g.fillRect(x0 + D * s, 40, 40, y0 - 40); g.fillStyle = '#ef4444'; g.fillRect(x0 + D * s - 4, y0 - 1.35 * s - 3, 48, 7);
        texto('fita = rede', x0 + D * s - 60, y0 - 1.35 * s - 12, '#fca5a5', 18);
        var p = poseEm(0); p.hWri = [0.25 + 0.3 * Math.sin(t * 2), 0.95]; p.hElb = [0.12, 1.15]; p.rk = [p.hWri[0] + 0.55, 1.0];
        Boneco.desenhar(g, p, { x: x0, y: y0, s: s });
        var c = (t % 2.4) / 1.0;
        if (c <= 1) { var bx = x0 + (0.8 + (D - 0.8) * c) * s, by = y0 - (0.95 + 0.9 * Math.sin(c * Math.PI * 0.9)) * s; g.fillStyle = '#d9f20f'; g.beginPath(); g.arc(bx, by, 6, 0, 7); g.fill(); }
        else balao('Boa! 95 km/h', 360, 110);
      } },
    { t: 'Novo: posição do saque', txt: 'Novidade: o modo Posição do Saque. De frente para o celular, a câmera reconhece o seu corpo, guia cada posição e, depois de cada tentativa, diz o que corrigir e mostra o contato em câmera lenta. E o app ensina, com desenhos, como segurar a raquete em cada golpe.',
      d: function (t) {
        var s = 130, y0 = 500, x0 = 200; chao(y0);
        var tt = (t * 0.55) % DUR; Boneco.desenhar(g, poseEm(tt), { x: x0, y: y0, s: s, juntas: true, bola: bolaEm(tt) });
        var itens = [['✓ De lado, pés alinhados', 0.6], ['✓ Toss com o braço esticado', 2.2], ['✓ Troféu: cotovelo em L', 3.6], ['⚠ Dobre mais os joelhos', 5.0], ['✓ Toss 40 cm acima do contato', 6.4]];
        itens.forEach(function (it, i) { if (t > it[1]) texto(it[0], 360, 110 + i * 46, it[0][0] === '⚠' ? '#facc15' : '#22c55e', 21, 'left', true); });
      } },
    { t: 'Montagem e calibração', txt: 'A aba Montagem calcula as distâncias com a sua altura. A calibração leva um minuto: é só marcar seis pontos na imagem.',
      d: function (t) {
        g.fillStyle = '#0f3a2b'; g.fillRect(0, 330, W, 230); g.fillStyle = '#1e40af'; g.fillRect(200, 90, 320, 200);
        g.fillStyle = '#16a34a'; g.fillRect(250, 170, 110, 50); texto('MIRE AQUI', 305, 200, '#fff', 15, 'center', true);
        g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(80, 470); g.lineTo(640, 470); g.moveTo(360, 470); g.lineTo(360, 330); g.stroke();
        var pts = [[200, 90], [520, 90], [520, 290], [200, 290], [360, 470], [600, 470]];
        pts.forEach(function (p, i) { if (t > 0.6 + i * 0.9) { g.fillStyle = '#22c55e'; g.beginPath(); g.arc(p[0], p[1], 15, 0, 7); g.fill(); texto(String(i + 1), p[0], p[1] + 7, '#04140b', 18, 'center', true); } });
        var i = Math.min(5, Math.floor((t - 0.6) / 0.9)); if (i >= 0 && t < 6.5) { var p = pts[i]; g.strokeStyle = '#facc15'; g.lineWidth = 3; g.beginPath(); g.arc(p[0] - 20, p[1] - 70, 50, 0, 7); g.stroke(); texto('☝️', p[0] + 18, p[1] + 48, '#fff', 34); }
      } },
    { t: 'Sessão e amigos', txt: 'Na aba Sessão você vê os acertos e as velocidades, e exporta a planilha. Dá também para compartilhar o app com os amigos. Toque em Começar, e bom treino!',
      d: function (t) {
        var v = [138, 151, 129, 160, 147, 165, 152, 158], ok = [1, 1, 0, 1, 1, 0, 1, 1];
        texto('Velocidade dos saques (km/h)', W / 2, 60, '#eef5f1', 22, 'center', true);
        v.forEach(function (x, i) { var h = Math.min(1, Math.max(0, (t - i * 0.25) / 0.6)) * (x - 100) * 4.5; g.fillStyle = ok[i] ? '#22c55e' : '#ef4444'; g.fillRect(110 + i * 64, 420 - h, 44, h); if (h > 10) texto(String(x), 132 + i * 64, 412 - h, '#eef5f1', 16); });
        g.strokeStyle = '#24463a'; g.beginPath(); g.moveTo(90, 420); g.lineTo(640, 420); g.stroke();
        if (t > 2.5) texto('75% de acertos · média 150 km/h', W / 2, 470, '#facc15', 22, 'center', true);
        if (t > 4) texto('🤝 Compartilhar com amigos', W / 2, 520, '#38bdf8', 22, 'center', true);
      } }
  ];
  CENAS.forEach(function (c) { c.dur = Math.max(7, c.txt.length / 13.5 + 1.5); });

  function falar(txt) {
    if (!comVoz || !window.speechSynthesis) return;
    speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(txt); u.lang = 'pt-BR'; u.rate = 1.05;
    var v = speechSynthesis.getVoices().filter(function (x) { return /^pt[-_]BR/i.test(x.lang); })[0]; if (v) u.voice = v;
    speechSynthesis.speak(u);
  }
  function irPara(i) {
    iCena = Math.max(0, Math.min(CENAS.length - 1, i)); t0 = performance.now(); pausa = false; $('apPausa').textContent = '⏸';
    $('apTitulo').textContent = (iCena + 1) + '/' + CENAS.length + ' · ' + CENAS[iCena].t; $('apTxt').textContent = CENAS[iCena].txt;
    $('apFim').style.display = 'none'; falar(CENAS[iCena].txt);
  }
  function quadro(agora) {
    raf = requestAnimationFrame(quadro);
    var sc = CENAS[iCena], t = ((pausa ? tPausa + t0 : agora) - t0) / 1000;
    if (!pausa && t > sc.dur) { if (iCena < CENAS.length - 1) { irPara(iCena + 1); return; } pausa = true; tPausa = sc.dur * 1000; $('apFim').style.display = 'flex'; }
    g.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
    g.fillStyle = '#0a1712'; g.fillRect(0, 0, W, H);
    try { sc.d(Math.min(t, sc.dur)); } catch (e) { }
    $('apBarra').style.width = ((iCena + Math.min(1, t / sc.dur)) / CENAS.length * 100) + '%';
  }
  function abrir() {
    aberta = true; $('apres').style.display = 'flex'; document.body.style.overflow = 'hidden';
    var r = window.devicePixelRatio || 1; cv.width = W * Math.min(2, r); cv.height = H * Math.min(2, r);
    $('apSom').style.display = comVoz ? 'none' : '';
    cancelAnimationFrame(raf); irPara(0); raf = requestAnimationFrame(quadro);
  }
  function fechar() {
    aberta = false; cancelAnimationFrame(raf); $('apres').style.display = 'none'; document.body.style.overflow = '';
    if (window.speechSynthesis) speechSynthesis.cancel();
  }

  var css = document.createElement('style');
  css.textContent =
    '#apres{position:fixed;inset:0;z-index:60;background:#050d0a;display:none;flex-direction:column;align-items:center;overflow-y:auto;' +
    'padding:calc(env(safe-area-inset-top) + 10px) 12px calc(env(safe-area-inset-bottom) + 12px)}' +
    '#apres .caixa{width:100%;max-width:640px}#apres .topo{display:flex;align-items:center;gap:8px;margin-bottom:8px}#apres .topo b{flex:1;font-size:17px}' +
    '#apres .x{background:#2b3f37;color:#eef5f1;border:0;border-radius:18px;padding:0 14px;height:38px;font-size:16px}' +
    '#apCanvas{width:100%;aspect-ratio:720/560;border-radius:12px;background:#0a1712;display:block}' +
    '#apProg{height:5px;background:#12261e;border-radius:3px;margin:8px 0;overflow:hidden}#apBarra{height:100%;width:0;background:#22c55e}' +
    '#apTitulo{font-weight:700;font-size:18px;margin:4px 0}#apTxt{font-size:16px;line-height:1.45;color:#d6e6dd;min-height:70px}' +
    '#apres .ctl{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;margin-top:10px}#apres .ctl button{background:#2b3f37;color:#eef5f1;border:0;border-radius:10px;padding:11px 0;font-size:18px}' +
    '#apSom{background:#facc15;color:#1a1400;border:0;border-radius:12px;padding:12px;font-size:17px;font-weight:700;width:100%;margin-bottom:8px}' +
    '#apFim{display:none;flex-direction:column;gap:6px;margin-top:10px}';
  document.head.appendChild(css);
  var div = document.createElement('div'); div.id = 'apres';
  div.innerHTML =
    '<div class="caixa">' +
    '<div class="topo"><b>🎬 Conheça o app</b><button class="x" id="apPular">Pular ✕</button></div>' +
    '<button id="apSom">🔊 Toque aqui para ouvir a narração</button>' +
    '<canvas id="apCanvas"></canvas><div id="apProg"><div id="apBarra"></div></div>' +
    '<div id="apTitulo"></div><div id="apTxt"></div>' +
    '<div class="ctl"><button id="apAnt">⏮</button><button id="apPausa">⏸</button><button id="apProx">⏭</button><button id="apDeNovo">↺</button></div>' +
    '<div id="apFim"><button class="bt verde" id="apComecar">🎾 Começar a usar</button><button class="bt cinza" id="apPostura">🧍 Experimentar a Posição do saque</button></div>' +
    '<label class="lin peq" style="margin-top:12px"><span>Não mostrar mais ao abrir o app</span><input type="checkbox" id="apNao"></label>' +
    '</div>';
  document.body.appendChild(div);
  cv = $('apCanvas'); g = cv.getContext('2d');
  $('apPular').onclick = fechar; $('apComecar').onclick = fechar;
  $('apPostura').onclick = function () { fechar(); if (window.TS) TS.abrirAba('postura'); };
  $('apSom').onclick = function () { comVoz = true; this.style.display = 'none'; falar(CENAS[iCena].txt); };
  $('apAnt').onclick = function () { irPara(iCena - 1); };
  $('apProx').onclick = function () { if (iCena < CENAS.length - 1) irPara(iCena + 1); };
  $('apDeNovo').onclick = function () { irPara(0); };
  $('apPausa').onclick = function () {
    if (pausa) { if ($('apFim').style.display === 'flex') { irPara(0); return; } pausa = false; t0 = performance.now() - tPausa; this.textContent = '⏸'; }
    else { pausa = true; tPausa = performance.now() - t0; this.textContent = '▶'; if (window.speechSynthesis) speechSynthesis.cancel(); }
  };
  var nao = false; try { nao = localStorage.getItem('ts_apres_nao') === '1'; } catch (e) {}
  $('apNao').checked = nao;
  $('apNao').onchange = function () { try { localStorage.setItem('ts_apres_nao', this.checked ? '1' : '0'); } catch (e) {} };
  document.querySelectorAll('.btApresentacao').forEach(function (b) { b.onclick = abrir; });

  window.Apresentacao = { abrir: abrir, fechar: fechar, ver: function (i, t) { irPara(i); t0 = performance.now() - t * 1000; } };
  // roda sozinha ao abrir (a menos que a pessoa tenha pedido para não mostrar, ou o endereço tenha #sem-apresentacao)
  if (!nao && location.hash !== '#sem-apresentacao') abrir();
})();
