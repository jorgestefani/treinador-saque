/* Empunhaduras: desenho do cabo visto de baixo (8 faces numeradas) com onde vão a junta do indicador e a base da mão,
   mais a mão e a raquete. Base: VIKSTENNIS (continental em detalhe) e Aylex Tennis Academy (mão no fim do cabo, punho solto). */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  // face (1 = em cima, contando no sentido horário, para o destro, olhando o cabo pela ponta de baixo)
  var G = {
    continental: { nome: 'Continental', face: 2, uso: 'Saque, voleio, smash e slice',
      passos: ['Raquete de lado (cordas na vertical), como se fosse martelar um prego com a borda.',
        'A junta do indicador e a base da mão (o "calcanhar" da mão) vão na <b>face 2</b>, a aresta entre o topo e o lado.',
        'Mão inclinada, não fechada como um punho: a junta do indicador fica um pouco abaixo da junta do polegar.',
        'Um <b>espaço entre o indicador e o dedo médio</b> (dedo de gatilho): dá liberdade ao punho.',
        'O <b>dedo mínimo no fim do cabo</b>: o punho fica mais solto e você ganha altura (Aylex).',
        'Força de um <b>aperto de mão firme</b>: dedos firmes, cotovelo e ombro soltos.'] },
    eastern: { nome: 'Eastern de forehand', face: 3, uso: 'Forehand chapado, devolução firme',
      passos: ['Mão espalmada nas cordas e deslize até o cabo: é como "apertar a mão" da raquete.',
        'Junta do indicador e base da mão na <b>face 3</b> (o lado direito do cabo).',
        'A palma fica atrás do cabo, na mesma direção das cordas.'] },
    semiwestern: { nome: 'Semi-western', face: 4, uso: 'Forehand com topspin (o mais usado hoje)',
      passos: ['Parta da eastern e gire a mão um oitavo para baixo.',
        'Junta do indicador e base da mão na <b>face 4</b>.',
        'Facilita bater de baixo para cima, com topspin e bola alta.'] },
    western: { nome: 'Western', face: 5, uso: 'Forehand com muito topspin (bolas altas)',
      passos: ['Junta do indicador e base da mão na <b>face 5</b>, embaixo do cabo.',
        'Muito efeito, mas difícil para bolas baixas. Para a maioria, a semi-western é melhor.'] },
    backhand: { nome: 'Eastern de backhand (uma mão)', face: 1, uso: 'Backhand de uma mão com topspin ou chapado',
      passos: ['Junta do indicador e base da mão na <b>face 1</b>, em cima do cabo.',
        'O polegar pode ficar na diagonal, atrás do cabo, para dar apoio.',
        'Para o backhand cortado (slice), use a continental.'] },
    duas: { nome: 'Backhand de duas mãos', face: 2, face2: 7, uso: 'Backhand de duas mãos',
      passos: ['Mão de baixo (a da raquete) na <b>continental</b>, face 2, encostada no fim do cabo.',
        'Mão de cima (a outra) em <b>eastern de forehand dela</b>: face 7, encostada na de baixo.',
        'A mão de cima é quem manda no golpe: é como um forehand da outra mão.'] }
  };
  var DO_TREINO = { chapado: ['continental'], slice: ['continental'], kick: ['continental'],
    fh_top: ['semiwestern', 'eastern'], fh_chapado: ['eastern'], fh_slice: ['continental'],
    bh_top: ['duas', 'backhand'], bh_chapado: ['backhand', 'duas'], bh_slice: ['continental'] };
  function canhoto() { return window.TS && TS.cfg.post && TS.cfg.post.mao === 'e'; }

  // desenha num canvas: o cabo octogonal visto de baixo, a face marcada e uma seta da palma da mão
  function desenhar(c, chave) {
    var g = c.getContext('2d'), W = c.width, H = c.height, e = G[chave], esp = canhoto();
    g.fillStyle = '#0a1712'; g.fillRect(0, 0, W, H);
    var cx = W * 0.27, cy = H * 0.52, R = H * 0.3, sx = esp ? -1 : 1;
    function ang(f) { return -Math.PI / 2 + (f - 1) * Math.PI / 4; }      // centro de cada face (destro: sentido horário)
    function P(a, r) { return [cx + sx * r * Math.cos(a), cy + r * Math.sin(a)]; }
    // octógono
    g.beginPath();
    for (var i = 0; i < 8; i++) { var q = P(-Math.PI / 2 - Math.PI / 8 + i * Math.PI / 4, R); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }
    g.closePath(); g.fillStyle = '#334155'; g.fill(); g.strokeStyle = '#94a3b8'; g.lineWidth = 2; g.stroke();
    function marca(f, cor) {
      var a = P(ang(f) - Math.PI / 8, R * 1.04), b = P(ang(f) + Math.PI / 8, R * 1.04);
      g.strokeStyle = cor; g.lineWidth = 10; g.lineCap = 'round'; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      // seta da palma: de dentro do cabo para a face
      var p0 = P(ang(f), R * 1.18), p1 = P(ang(f), R * 1.5);
      g.lineWidth = 4; g.beginPath(); g.moveTo(p1[0], p1[1]); g.lineTo(p0[0], p0[1]); g.stroke();
      var dx = p0[0] - p1[0], dy = p0[1] - p1[1], n = Math.hypot(dx, dy); dx /= n; dy /= n;
      g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p0[0] - 12 * dx - 8 * dy, p0[1] - 12 * dy + 8 * dx); g.lineTo(p0[0] - 12 * dx + 8 * dy, p0[1] - 12 * dy - 8 * dx); g.closePath(); g.fillStyle = cor; g.fill();
    }
    marca(e.face, '#22c55e'); if (e.face2) marca(e.face2, '#38bdf8');
    g.textAlign = 'center';
    for (var f = 1; f <= 8; f++) { var t = P(ang(f), R * 0.66); var on = f === e.face || f === e.face2;
      g.fillStyle = on ? '#fff' : '#94a3b8'; g.font = (on ? 'bold ' : '') + Math.round(R * (on ? 0.36 : 0.27)) + 'px -apple-system, sans-serif'; g.fillText(String(f), t[0], t[1] + R * 0.11); }
    g.fillStyle = '#facc15'; g.font = Math.round(H * 0.052) + 'px -apple-system, sans-serif'; g.textAlign = 'left';
    g.fillText('↑ borda de cima', 8, H * 0.08);
    g.fillStyle = '#9db8ab'; g.fillText('cabo visto pela ponta de baixo' + (esp ? ' (canhoto)' : ''), W * 0.56, H * 0.9);
    // legenda à direita
    var lx = W * 0.56, y = H * 0.2;
    g.textAlign = 'left'; g.fillStyle = '#eef5f1'; var px = Math.round(H * 0.085); g.font = 'bold ' + px + 'px -apple-system, sans-serif';
    while (g.measureText(e.nome).width > W - lx - 10 && px > 12) { px--; g.font = 'bold ' + px + 'px -apple-system, sans-serif'; }
    g.fillText(e.nome, lx, y);
    g.font = Math.round(H * 0.065) + 'px -apple-system, sans-serif';
    var linhas = e.face2 ? [['#22c55e', 'Mão da raquete: face ' + e.face], ['#38bdf8', 'Outra mão: face ' + e.face2], ['#9db8ab', 'Seta = para onde vai a palma']]
                         : [['#22c55e', 'Face ' + e.face + ':'], ['#eef5f1', '• junta do indicador'], ['#eef5f1', '• base da mão'], ['#9db8ab', 'Seta = para onde vai a palma']];
    linhas.forEach(function (l, k) { g.fillStyle = l[0]; g.fillText(l[1], lx, y + H * (0.14 + k * 0.11)); });
  }
  function cartao(chave, extra) {
    var e = G[chave];
    return '<div class="cartao"><h2>✋ ' + e.nome + '</h2><div class="peq">' + e.uso + '</div>' +
      '<canvas class="emp" data-g="' + chave + '" width="640" height="300" style="width:100%;max-width:520px;display:block;margin:8px auto;border-radius:10px"></canvas>' +
      '<div style="font-size:15px;line-height:1.5">' + e.passos.map(function (p) { return '• ' + p; }).join('<br>') + '</div>' + (extra || '') + '</div>';
  }
  function desenharTodos(raiz) { [].forEach.call((raiz || document).querySelectorAll('canvas.emp'), function (c) { desenhar(c, c.dataset.g); }); }

  // cartão na aba Treinar, conforme o treino escolhido
  var box = document.createElement('div'); box.id = 'empTreino';
  var ref = $('cQuadra'); ref.parentNode.insertBefore(box, ref);
  function atualizar() {
    var tipo = window.TS ? TS.cfg.tipo : 'chapado', l = DO_TREINO[tipo] || ['continental'];
    box.innerHTML = '<details class="cartao" style="padding:10px 12px"><summary style="font-weight:700;font-size:16px">✋ Como segurar a raquete neste treino: ' + G[l[0]].nome + (l[1] ? ' (ou ' + G[l[1]].nome + ')' : '') + '</summary>' +
      l.map(function (k) { return cartao(k); }).join('') +
      '<button class="bt verde" id="btPegadaEmp" style="padding:9px;font-size:15px">✋ Conferir minha empunhadura pela câmera</button>' +
      '<button class="bt cinza" id="btTodasEmp" style="padding:9px;font-size:15px">Ver todas as empunhaduras</button></details>';
    box.querySelector('details').addEventListener('toggle', function () { desenharTodos(box); });
    $('btTodasEmp').onclick = abrirTodas;
    $('btPegadaEmp').onclick = function () { if (window.Pegada) Pegada.abrir(); };
    desenharTodos(box);
  }
  ['modo', 'tipo'].forEach(function (id) { $(id).addEventListener('change', function () { setTimeout(atualizar, 0); }); });
  atualizar();

  // janela com todas
  var div = document.createElement('div'); div.id = 'empTodas';
  div.style.cssText = 'position:fixed;inset:0;z-index:55;background:#050d0aF2;display:none;overflow-y:auto;padding:calc(env(safe-area-inset-top) + 10px) 12px 30px';
  div.innerHTML = '<div style="max-width:640px;margin:0 auto"><div style="display:flex;align-items:center;margin-bottom:8px"><b style="flex:1;font-size:18px">✋ Empunhaduras</b>' +
    '<button id="empFechar" style="background:#2b3f37;color:#eef5f1;border:0;border-radius:18px;height:38px;padding:0 14px;font-size:16px">Fechar ✕</button></div>' +
    '<div class="peq" style="margin-bottom:8px">Olhando o cabo pela ponta de baixo, com a raquete de lado (cordas na vertical), as 8 faces são numeradas a partir da de cima, no sentido horário (para o canhoto, no sentido anti-horário). ' +
    'A face indica onde ficam a <b>junta do indicador</b> e a <b>base da mão</b>.</div>' +
    '<div id="empLista"></div></div>';
  document.body.appendChild(div);
  function abrirTodas() {
    $('empLista').innerHTML = ['continental', 'eastern', 'semiwestern', 'western', 'backhand', 'duas'].map(function (k) { return cartao(k); }).join('');
    div.style.display = 'block'; desenharTodos(div);
  }
  $('empFechar').onclick = function () { div.style.display = 'none'; };

  window.Empunhadura = { desenhar: desenhar, cartao: cartao, desenharTodos: desenharTodos, abrirTodas: abrirTodas, G: G };
})();
