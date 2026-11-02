/* Treinador de Saque — câmera + microfone do iPhone, física do voo e voz.
   Fluxo de cada saque:
     1) o microfone ouve o "clac" (raquete) e, no modo lona, o "tum" (bola na lona);
     2) a câmera acha a bola amarela em cada quadro (cor + movimento);
     3) ajusta-se a trajetória física (gravidade, ar e efeito) a tudo isso e prolonga-se o voo até a quadra oficial;
     4) o celular fala o resultado e quanto mexer na mira. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var CHAVE = 'treinadorSaque.v2';

  /* ===================== configuração salva ===================== */
  var cfg = carregar() || {};
  cfg.modo = cfg.modo || 'lona'; cfg.tipo = cfg.tipo || 'chapado'; cfg.lado = cfg.lado || 1;
  cfg.mont = cfg.mont || { d: 8, hc: 2.65, larg: 3.5, zb: 0.9, zt: 3.0, esq: 2.8 };
  cfg.par = cfg.par || { d: 8, hc: 0.95, larg: 3.0, fita: 1.35 };   // backhand na parede
  cfg.jog = cfg.jog || { alt: 1.80, espaco: 10, teto: 0 };          // altura do jogador e tamanho do local
  cfg.cel = cfg.cel || { atras: 4.5, lado: 2.0, ladoEsq: true, h: 1.40, usar: true };   // tripé medido com a trena (do modo atual)
  var TRIPE_PADRAO = { lona: { atras: 4.5, lado: 2.0, h: 1.40 }, parede: { atras: 2.25, lado: 2.6, h: 1.20 }, quadra: { atras: 1.5, lado: 2.2, h: 2.50 } };
  cfg.celPor = cfg.celPor || {};      // cada modo guarda a sua posição de tripé
  cfg.aviso = cfg.aviso || { estilo: 'pt', lingua: 'en-US', forteSaque: 170, forteFundo: 110, frases: {} };
  cfg.aj = cfg.aj || { voz: true, vel: true, dica: true, gravar: false, k: 7, min: 0.02, res: 960, cor: 35, debug: false, dsim: 8 };
  cfg.perfil = cfg.perfil || {};          // efeito aprendido: {chapado:{wy,wz,swy,swz,n}, ...}
  cfg.tau = cfg.tau || { lista: [] };     // atraso áudio→vídeo (s)
  cfg.cal = cfg.cal || {};                // calibrações por modo: {lona:{...}, quadra:{...}}
  cfg.contato = cfg.contato || {};        // pontos de contato medidos de verdade, por modo: {'lona+': [[x,y,z], ...]}
  var sessao = (carregarSessao() || []);

  function carregar() { try { return JSON.parse(localStorage.getItem(CHAVE)); } catch (e) { return null; } }
  function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(cfg)); } catch (e) {} }
  function carregarSessao() { try { return JSON.parse(localStorage.getItem(CHAVE + '.sessao')); } catch (e) { return null; } }
  function salvarSessao() { try { localStorage.setItem(CHAVE + '.sessao', JSON.stringify(sessao.slice(-400))); } catch (e) {} }

  /* ===================== abas ===================== */
  var abaAtual = 'treinar';
  [].forEach.call(document.querySelectorAll('#abas button'), function (b) {
    b.onclick = function () { abrirAba(b.dataset.aba); };
  });
  function abrirAba(nome) {
    abaAtual = nome;
    [].forEach.call(document.querySelectorAll('#abas button'), function (b) { b.classList.toggle('on', b.dataset.aba === nome); });
    [].forEach.call(document.querySelectorAll('section'), function (s) { s.classList.toggle('on', s.id === nome); });
    posicionarPalco();
    if (nome === 'montagem') { desenharAlvo(); desenharParede(); desenharPlano(); }
    if (nome === 'sessao') mostrarSessao();
    if (nome === 'calibrar') mostrarPontos();
  }
  // o vídeo precisa continuar visível (o Safari para de entregar quadros de vídeo escondido)
  var palco = $('palco');
  function posicionarPalco() {
    var destino = abaAtual === 'calibrar' ? $('calibrar') : $('palcoTreino');
    if (abaAtual === 'calibrar') { if (palco.parentNode !== destino) destino.insertBefore(palco, $('btCalcular').previousElementSibling); palco.style.cssText = ''; }
    else if (abaAtual === 'treinar') { if (palco.parentNode !== destino) destino.appendChild(palco); palco.style.cssText = ''; }
    else { document.body.appendChild(palco); palco.style.cssText = 'position:fixed;right:8px;bottom:8px;width:120px;z-index:9;opacity:.85' + (rodando ? '' : ';display:none'); }
    if (video.srcObject && video.paused) video.play().catch(function () {});
    ajustarAlturaPalco();
  }
  function ajustarAlturaPalco() {
    var v = $('video'), w = palco.clientWidth || 300, r = v.videoWidth ? v.videoHeight / v.videoWidth : 9 / 16;
    palco.style.height = Math.round(w * r) + 'px';
  }
  window.addEventListener('resize', ajustarAlturaPalco);

  /* ===================== campos ligados à configuração ===================== */
  function ligar(id, obj, chave, tipo) {
    var el = $(id);
    if (el.type === 'checkbox') el.checked = !!obj[chave]; else el.value = obj[chave];
    el.onchange = function () {
      obj[chave] = el.type === 'checkbox' ? el.checked : (tipo === 'n' ? parseFloat(el.value) : el.value);
      salvar(); aoMudarConfig(id);
    };
  }
  ligar('modo', cfg, 'modo'); ligar('tipo', cfg, 'tipo');
  $('ladoSel').value = String(cfg.lado); $('ladoSel').onchange = function () { cfg.lado = +this.value; salvar(); aoMudarConfig('lado'); };
  ligar('mD', cfg.mont, 'd', 'n'); ligar('mHc', cfg.mont, 'hc', 'n'); ligar('mLarg', cfg.mont, 'larg', 'n');
  ligar('mZb', cfg.mont, 'zb', 'n'); ligar('mZt', cfg.mont, 'zt', 'n'); ligar('mEsq', cfg.mont, 'esq', 'n');
  ligar('aVoz', cfg.aj, 'voz'); ligar('aVel', cfg.aj, 'vel'); ligar('aDica', cfg.aj, 'dica'); ligar('aGravar', cfg.aj, 'gravar');
  ligar('aK', cfg.aj, 'k', 'n'); ligar('aMin', cfg.aj, 'min', 'n'); ligar('aRes', cfg.aj, 'res', 'n'); ligar('aCor', cfg.aj, 'cor', 'n');
  ligar('aDebug', cfg.aj, 'debug'); ligar('aDsim', cfg.aj, 'dsim', 'n');
  ligar('pD', cfg.par, 'd', 'n'); ligar('pHc', cfg.par, 'hc', 'n'); ligar('pLarg', cfg.par, 'larg', 'n'); ligar('pFita', cfg.par, 'fita', 'n');
  $('mVel').onchange = desenharAlvo; $('mTipo').onchange = desenharAlvo; $('pVel').onchange = desenharParede; $('pTipo').onchange = desenharParede;
  $('btUsarFita').onclick = function () { var h = alturaFitaRecomendada(); cfg.par.fita = +h.toFixed(2); $('pFita').value = cfg.par.fita; salvar(); aoMudarConfig('pFita'); };
  function aoMudarConfig(id) {
    if (id === 'modo') { trocarTripe(); montarTipos(); mostrarAviso(); }
    if (/^[mp][A-Z]/.test(id) || id === 'modo' || id === 'lado') { pontosCal = []; mostrarPontos(); calcularROI(); desenharLona(); desenharAlvo(); desenharParede(); }
    if (/^([mpc][A-Z]|j)/.test(id) || id === 'modo' || id === 'lado') desenharPlano();
    if (id === 'aK' || id === 'aMin') enviarLimiares();
    $('dSim').textContent = cfg.aj.dsim;
    desenharQuadra();
  }
  $('dSim').textContent = cfg.aj.dsim;

  /* ===================== geometria do mundo ===================== */
  function ehParede() { return cfg.modo === 'parede'; }
  function jogo() { return ehParede() ? 'fundo' : 'saque'; }
  function distAlvo() { return ehParede() ? cfg.par.d : cfg.mont.d; }
  var TIPOS = { saque: [['chapado', 'Chapado'], ['slice', 'Slice'], ['kick', 'Kick']], fundo: [['fh_top', 'Forehand topspin'], ['fh_chapado', 'Forehand chapado'], ['fh_slice', 'Forehand cortado'], ['bh_top', 'Backhand topspin'], ['bh_chapado', 'Backhand chapado'], ['bh_slice', 'Backhand cortado']] };
  function montarTipos() {
    var l = TIPOS[jogo()], sel = $('tipo');
    sel.innerHTML = l.map(function (t) { return '<option value="' + t[0] + '">' + t[1] + '</option>'; }).join('');
    if (!l.some(function (t) { return t[0] === cfg.tipo; })) { cfg.tipo = l[0][0]; salvar(); }
    sel.value = cfg.tipo;
    $('ladoSel').parentNode.style.display = ehParede() ? 'none' : '';
    $('rotTipo').textContent = ehParede() ? 'Golpe' : 'Saque';
    $('montSaque').style.display = ehParede() ? 'none' : ''; $('montParede').style.display = ehParede() ? '' : 'none';
  }
  // Origem no chão, na marca central da linha de fundo do sacador; x para a rede, y para a esquerda, z para cima.
  function contatoNominal() { return ehParede() ? [0, 0, cfg.par.hc] : [0.3, -0.3 * cfg.lado, cfg.mont.hc]; }
  function lona() {
    if (ehParede()) {     // a parede: retângulo da fita até o chão, centrado na linha de mira
      var P = cfg.par; return { x: P.d, yEsq: P.larg / 2, yDir: -P.larg / 2, zb: 0, zt: P.fita, parede: true, larg: P.larg };
    }
    var m = cfg.mont, c = contatoNominal(), x = c[0] + m.d;
    // lado +1: borda esquerda (y maior) a "esq" da linha de mira; lado -1: espelhado (borda direita a "esq" à direita)
    var yA = cfg.lado > 0 ? c[1] + m.esq : c[1] - m.esq, yB = cfg.lado > 0 ? yA - m.larg : yA + m.larg;
    return { x: x, yEsq: Math.max(yA, yB), yDir: Math.min(yA, yB), zb: m.zb, zt: m.zt };
  }
  /** Pontos a marcar na calibração (com as coordenadas no mundo). */
  function pontosDoModo() {
    var L = lona(), c = contatoNominal(), lado = cfg.lado;
    if (ehParede()) return [
      { nome: '1 · ponta esquerda da fita', X: [L.x, L.yEsq, L.zt] },
      { nome: '2 · ponta direita da fita', X: [L.x, L.yDir, L.zt] },
      { nome: '3 · pé da parede sob a ponta direita', X: [L.x, L.yDir, 0] },
      { nome: '4 · pé da parede sob a ponta esquerda', X: [L.x, L.yEsq, 0] },
      { nome: '5 · fita no chão sob o contato', X: [c[0], c[1], 0] },
      { nome: '6 · fita no chão no meio do caminho', X: [c[0] + cfg.par.d / 2, c[1], 0] }
    ];
    if (cfg.modo === 'lona') return [
      { nome: '1 · canto de cima, esquerdo', X: [L.x, L.yEsq, L.zt] },
      { nome: '2 · canto de cima, direito', X: [L.x, L.yDir, L.zt] },
      { nome: '3 · canto de baixo, direito', X: [L.x, L.yDir, L.zb] },
      { nome: '4 · canto de baixo, esquerdo', X: [L.x, L.yEsq, L.zb] },
      { nome: '5 · fita no chão sob o contato', X: [c[0], c[1], 0] },
      { nome: '6 · fita no chão no meio do caminho', X: [c[0] + cfg.mont.d / 2, c[1], 0] }
    ];
    var s = 4.115 * lado;
    return [
      { nome: '1 · nosso T (linha de saque × linha central)', X: [5.485, 0, 0] },
      { nome: '2 · nossa linha de saque × lateral (lado do alvo)', X: [5.485, s, 0] },
      { nome: '3 · T do outro lado (rede → linha de saque)', X: [18.285, 0, 0] },
      { nome: '4 · canto do quadrado-alvo (linha de saque × lateral)', X: [18.285, s, 0] },
      { nome: '5 · topo da faixa central da rede', X: [11.885, 0, 0.914] }
    ];
  }

  /* ===================== câmera e microfone ===================== */
  var video = $('video'), fluxo = null, actx = null, noDetector = null, rodando = false, gravador = null, pedacos = [];
  var proc = document.createElement('canvas'), pctx = proc.getContext('2d', { willReadFrequently: true });
  var travaTela = null;

  async function ligarCamera() {
    if (fluxo) return;
    fluxo = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 } },
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
    video.srcObject = fluxo;
    await video.play().catch(function () {});
    await new Promise(function (ok) { if (video.videoWidth) ok(); else video.onloadedmetadata = ok; });
    ajustarAlturaPalco();
    var s = fluxo.getVideoTracks()[0].getSettings();
    $('estado').textContent = 'Câmera ' + video.videoWidth + '×' + video.videoHeight + ' a ' + Math.round(s.frameRate || 0) + ' quadros/s.';
    if ((s.frameRate || 60) < 50) avisar('A câmera está a ' + Math.round(s.frameRate) + ' quadros/s. Com 60 a precisão é maior; feche outros apps que usam a câmera.');
    calcularROI();
  }
  function erroCamera(e) {
    if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError'))
      return 'O iPhone bloqueou a câmera ou o microfone. Toque em “aA” (ou no ícone à esquerda do endereço) → Ajustes do Site → Câmera e Microfone = Permitir, recarregue a página e toque de novo. ' +
             'Se abriu o link pelo WhatsApp ou Instagram, abra no Safari. Também confira em Ajustes do iPhone → Safari → Câmera / Microfone.';
    if (e && e.name === 'NotFoundError') return 'Não achei câmera ou microfone neste aparelho.';
    if (e && e.name === 'NotReadableError') return 'A câmera está ocupada por outro app. Feche os outros apps e tente de novo.';
    return (e && e.message) || String(e);
  }
  async function ligarAudio() {
    if (actx) return;
    actx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000, latencyHint: 'interactive' });
    await actx.audioWorklet.addModule('detector.js');
    var fonte = actx.createMediaStreamSource(fluxo);
    noDetector = new AudioWorkletNode(actx, 'detector-estalos');
    fonte.connect(noDetector);
    noDetector.port.onmessage = aoSom;
    enviarLimiares();
  }
  function enviarLimiares() { if (noDetector) noDetector.port.postMessage({ k: cfg.aj.k, minimo: cfg.aj.min }); }

  $('btIniciar').onclick = async function () {
    if (rodando) { parar(); return; }
    try {
      falar(' ');                          // libera a voz no iPhone (precisa de um toque)
      await ligarCamera(); await ligarAudio(); await actx.resume();
      if (!calAtual()) { avisar('Calibre a câmera antes (aba 🎯 Calibrar).'); abrirAba('calibrar'); return; }
      rodando = true; this.textContent = '⏸ Parar'; this.className = 'bt vermelho';
      try { travaTela = await navigator.wakeLock.request('screen'); } catch (e) {}
      if (cfg.aj.gravar) iniciarGravacao();
      bip('pronto'); estado('Escutando… pode sacar.');
      laçoVideo();
    } catch (e) { estado('❌ ' + erroCamera(e)); }
  };
  function parar() {
    rodando = false; $('btIniciar').textContent = '▶ Começar'; $('btIniciar').className = 'bt verde';
    if (travaTela) { travaTela.release().catch(function () {}); travaTela = null; }
    if (gravador && gravador.state !== 'inactive') gravador.stop();
    estado('Parado.');
  }
  document.addEventListener('visibilitychange', async function () {
    if (!document.hidden && rodando) { try { travaTela = await navigator.wakeLock.request('screen'); } catch (e) {} }
  });
  function iniciarGravacao() {
    if (!window.MediaRecorder) return;
    pedacos = [];
    var tipo = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : '';
    gravador = new MediaRecorder(fluxo, tipo ? { mimeType: tipo } : undefined);
    gravador.ondataavailable = function (e) { if (e.data.size) pedacos.push(e.data); };
    gravador.onstop = function () { $('btGravacao').style.display = ''; };
    gravador.start(1000);
  }
  $('btGravacao').onclick = function () {
    var blob = new Blob(pedacos, { type: pedacos[0] ? pedacos[0].type : 'video/mp4' });
    compartilharArquivo(blob, 'saques-' + agoraTxt() + '.mp4');
  };

  /* ===================== visão: acha a bola em cada quadro ===================== */
  var quadros = [];                         // [{t (s, relógio do vídeo), b: [{x, y, n}]}] dos últimos 3 s
  var roi = null, anterior = null, escala = 1, ultimoQuadro = 0;
  function calcularROI() {
    var c = calAtual(); if (!c || !video.videoWidth) { roi = null; return; }
    var cam = camDe(c), pts = [], p = contatoNominal();
    [[-0.8, -0.8, -0.9], [0.8, 0.8, 0.9], [-0.8, 0.8, 0.9], [0.8, -0.8, -0.9], [0, 0, 1.2]].forEach(function (d) { pts.push([p[0] + d[0], p[1] + d[1], p[2] + d[2]]); });
    if (cfg.modo === 'lona' || ehParede()) { var L = lona(), zt = ehParede() ? L.zt + 2.5 : L.zt; pts.push([L.x, L.yEsq, zt], [L.x, L.yDir, zt], [L.x, L.yDir, L.zb], [L.x, L.yEsq, L.zb]); }
    else for (var x = 2; x <= 24; x += 2) for (var y = -5; y <= 5; y += 5) pts.push([x, y * cfg.lado, x < 12 ? 2.4 : 0], [x, y, 0]);
    var xs = [], ys = [];
    pts.forEach(function (X) { var q = Geom.projetar(cam, X); if (q[2] > 0.3) { xs.push(q[0]); ys.push(q[1]); } });
    var W = video.videoWidth, H = video.videoHeight;
    escala = cfg.aj.res / W;
    proc.width = Math.round(W * escala); proc.height = Math.round(H * escala);
    var x0 = Math.max(0, Math.min.apply(null, xs) - 60), x1 = Math.min(W, Math.max.apply(null, xs) + 60);
    var y0 = Math.max(0, Math.min.apply(null, ys) - 60), y1 = Math.min(H, Math.max.apply(null, ys) + 60);
    roi = { x: Math.floor(x0 * escala), y: Math.floor(y0 * escala), w: Math.max(8, Math.floor((x1 - x0) * escala)), h: Math.max(8, Math.floor((y1 - y0) * escala)) };
    roi.w = Math.min(roi.w, proc.width - roi.x); roi.h = Math.min(roi.h, proc.height - roi.y);
    anterior = null;
  }
  function laçoVideo() {
    if (!rodando) return;
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(function (agora, meta) {
      var t = (meta.captureTime || meta.expectedDisplayTime || agora) / 1000;
      processarQuadro(t); laçoVideo();
    });
    else requestAnimationFrame(function () { processarQuadro(performance.now() / 1000); laçoVideo(); });
  }
  var CEL = 3;
  function processarQuadro(t) {
    if (!roi) return;
    if (t <= ultimoQuadro) return; ultimoQuadro = t;
    pctx.drawImage(video, 0, 0, proc.width, proc.height);
    var img = pctx.getImageData(roi.x, roi.y, roi.w, roi.h), d = img.data, n = roi.w * roi.h;
    if (!anterior || anterior.length !== n * 2) { anterior = new Uint8Array(n * 2); for (var i = 0; i < n; i++) { anterior[2 * i] = d[4 * i + 1]; anterior[2 * i + 1] = d[4 * i]; } return; }
    var cw = Math.ceil(roi.w / CEL), ch = Math.ceil(roi.h / CEL), cont = new Uint16Array(cw * ch), sx = new Float32Array(cw * ch), sy = new Float32Array(cw * ch);
    var dgb = cfg.aj.cor, w = roi.w;
    for (var y = 0, k = 0; y < roi.h; y++) {
      var lc = ((y / CEL) | 0) * cw;
      for (var x = 0; x < w; x++, k++) {
        var r = d[4 * k], g = d[4 * k + 1], b = d[4 * k + 2], pg = anterior[2 * k], pr = anterior[2 * k + 1];
        anterior[2 * k] = g; anterior[2 * k + 1] = r;
        if (g > 70 && g - b > dgb && r > 0.45 * g && r < 1.25 * g && (Math.abs(g - pg) + Math.abs(r - pr)) > 40) {
          var c = lc + ((x / CEL) | 0); cont[c]++; sx[c] += x; sy[c] += y;
        }
      }
    }
    // junta células vizinhas (8-vizinhança) em manchas
    var visto = new Uint8Array(cw * ch), manchas = [], pilha = [];
    for (var c0 = 0; c0 < cw * ch; c0++) {
      if (cont[c0] < 2 || visto[c0]) continue;
      var tot = 0, mx = 0, my = 0; pilha.push(c0); visto[c0] = 1;
      while (pilha.length) {
        var q = pilha.pop(); tot += cont[q]; mx += sx[q]; my += sy[q];
        var qx = q % cw, qy = (q / cw) | 0;
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
          var nx = qx + dx, ny = qy + dy; if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue;
          var nq = ny * cw + nx; if (!visto[nq] && cont[nq] >= 1) { visto[nq] = 1; pilha.push(nq); }
        }
      }
      if (tot >= 3 && tot < 2500) manchas.push({ x: (roi.x + mx / tot) / escala, y: (roi.y + my / tot) / escala, n: tot });
    }
    manchas.sort(function (a, b) { return b.n - a.n; });
    quadros.push({ t: t, b: manchas.slice(0, 12) });
    while (quadros.length && quadros[0].t < t - 3) quadros.shift();
    if (cfg.aj.debug && (abaAtual === 'treinar' || abaAtual === 'calibrar')) desenharDebug(manchas);
  }

  /* ===================== audição: clac e tum ===================== */
  var clacPendente = null, ocupadoAte = 0, mudoAte = 0, ultimoAudio = null;
  function tempoAudioEmPerf(tCtx) {
    var o = actx.getOutputTimestamp ? actx.getOutputTimestamp() : null;
    if (o && o.performanceTime) return (o.performanceTime / 1000) + (tCtx - o.contextTime);
    return performance.now() / 1000 - (actx.currentTime - tCtx);
  }
  function aoSom(e) {
    var m = e.data;
    if (m.nivel !== undefined) { $('nivel').firstChild.style.width = Math.min(100, m.nivel / (cfg.aj.min * 3) * 100) + '%'; return; }
    if (!rodando) return;
    var t = tempoAudioEmPerf(m.t), agora = performance.now() / 1000;
    if (agora < mudoAte || agora < ocupadoAte) return;          // o próprio alto-falante não conta
    if (cfg.modo === 'lona' || ehParede()) {
      var d = distAlvo(), tMin = d / (260 / 3.6), tMax = d / ((ehParede() ? 35 : 50) / 3.6) + 0.05;
      if (clacPendente && t - clacPendente.t >= tMin && t - clacPendente.t <= tMax) {
        var clac = clacPendente; clacPendente = null; ocupadoAte = agora + 1.2;
        setTimeout(function () { analisarSaque(clac.t, t); }, 140);
      } else clacPendente = { t: t, pico: m.pico };
    } else {
      ocupadoAte = agora + 1.6;
      setTimeout(function () { analisarSaque(t, null); }, 1400);
    }
  }

  /* ===================== análise de um saque ===================== */
  function calAtual() { return cfg.cal[cfg.modo + (cfg.lado > 0 ? '+' : '-')]; }
  function camDe(c) { return { R: c.R, t: c.t, f: c.f, cx: c.cx, cy: c.cy, C: c.C, H: c.H }; }
  /** Onde a raquete pega na bola: começa pela altura informada e passa a usar a mediana dos golpes bem medidos. */
  function chaveModo() { return cfg.modo + (cfg.lado > 0 ? '+' : '-'); }
  function prioriContato() {
    var l = cfg.contato[chaveModo()] || [], n = contatoNominal();
    if (l.length < 3) return { p0: n, s: cfg.modo === 'quadra' ? [0.25, 0.3, 0.15] : [0.4, 0.35, 0.3] };
    return { p0: [0, 1, 2].map(function (k) { return mediana(l.map(function (p) { return p[k]; })); }), s: [0.25, 0.25, 0.12] };
  }
  function aprenderContato(r) {
    if (!r || !r.contato || r.nObs < 8 || (r.rmsPx || 99) > 6) return;
    var k = chaveModo(), l = cfg.contato[k] = cfg.contato[k] || [];
    l.push(r.contato.map(function (x) { return Math.round(x * 1000) / 1000; })); cfg.contato[k] = l.slice(-30); salvar();
  }
  function tauPriori() {
    var l = cfg.tau.lista;
    if (l.length < 3) return { m: l.length ? mediana(l) : 0.02, s: 0.06 };
    return { m: mediana(l), s: 0.012 };
  }
  function prioriEfeito() {
    var p = cfg.perfil[cfg.tipo], e = Fisica.EFEITOS[cfg.tipo], w = e.rpm * Math.PI / 30;
    // o efeito lateral não troca de sinal com o lado: o slice do destro sempre curva para a esquerda
    if (p && p.n >= 5) return { w: [p.wy, p.wz], sw: [Math.max(p.swy, 25), Math.max(p.swz, 25)] };
    return { w: [e.eixo[1] * w, e.eixo[2] * w], sw: [90, 90] };
  }
  var ultimoBruto = null;
  function analisarSaque(tClac, tTum) {
    var c = calAtual(); if (!c) return;
    var cam = camDe(c), tp = tauPriori(), pe = prioriEfeito(), pc = prioriContato();
    var priori = { p0: pc.p0, sp0: pc.s, w: pe.w, sw: pe.sw, tau: tp.m, stau: tp.s };
    var bruto = { modo: cfg.modo, tipo: cfg.tipo, lado: cfg.lado, tClac: tClac, tTum: tTum, quadros: quadros.filter(function (q) { return q.t > tClac - 0.2 && q.t < tClac + 1.6; }), cal: c, mont: cfg.mont, priori: priori };
    ultimoBruto = bruto;
    var r;
    try { r = cfg.modo === 'quadra' ? analisarQuadra(bruto, cam, priori) : analisarLona(bruto, cam, priori); }
    catch (e) { console.error(e); r = null; }
    if (!r || r.nada) { if (r && r.nada) estado('Ouvi dois estalos, mas a bola não apareceu no alvo (quique no chão?).'); else if (cfg.modo !== 'quadra') mostrarSemLeitura(); return; }
    if (r.tau !== undefined && r.nObs >= 5 && Math.abs(r.tau - tp.m) < 3 * tp.s) { cfg.tau.lista.push(r.tau); cfg.tau.lista = cfg.tau.lista.slice(-25); salvar(); }
    aprenderContato(r);
    registrarResultado(r);
  }
  /** Associa a cada quadro a mancha mais perto da trajetória prevista (dentro do portão em px). */
  function associar(cam, p, t0, lista, portao, tFim, comNota) {
    var sel = lista.filter(function (q) { var tt = q.t - t0; return tt >= 0.004 && (!tFim || tt <= tFim) && q.b.length; });
    var obs = [], nota = 0;
    if (!sel.length) return comNota ? { obs: obs, nota: 0 } : obs;
    var pos = Ajuste.trajetoria(p, sel.map(function (q) { return q.t - t0; })).pos;
    sel.forEach(function (q, i) {
      var pr = Geom.projetar(cam, pos[i]); if (pr[2] <= 0) return;
      var melhor = null, dm = portao;
      q.b.forEach(function (b) { var dd = Math.hypot(b.x - pr[0], b.y - pr[1]); if (dd < dm) { dm = dd; melhor = b; } });
      if (melhor) obs.push({ t: q.t, x: melhor.x, y: melhor.y });
      nota += 1 - dm / portao;           // 1 = em cima da previsão, 0 = sem mancha no portão
    });
    return comNota ? { obs: obs, nota: nota } : obs;
  }
  function chuteReta(p0, alvo, T, tau, w) {
    var dx = alvo[0] - p0[0], dy = alvo[1] - p0[1], dz = alvo[2] - p0[2];
    return [p0[0], p0[1], p0[2], dx / T * 1.03, dy / T, dz / T + 0.5 * 9.81 * T, w[0], w[1], tau];
  }
  function analisarLona(br, cam, priori) {
    var L = lona(), T = br.tTum - br.tClac;
    // 1) onde a bola bateu na lona: manchas nos primeiros quadros depois do "tum" que caem dentro da lona
    var cands = [], depois = br.quadros.filter(function (q) { var dt = q.t - (br.tTum + priori.tau); return dt > -3 * priori.stau - 0.012 && dt < 3 * priori.stau + 0.06; });
    depois.forEach(function (q) {
      q.b.forEach(function (b) {
        // a bola encostada tem o centro um raio à frente do alvo
        var P = Geom.pixelNoPlanoEixo(cam, b.x, b.y, 0, L.x - Fisica.R); if (!P) return;
        var y = P[1], z = P[2];
        var zMax = L.parede ? L.zt + 3 : L.zt + 0.15, mLat = L.parede ? 1.5 : 0.15;
        if (y > L.yDir - mLat && y < L.yEsq + mLat && z > L.zb - 0.15 && z < zMax) cands.push({ X: [L.x - Fisica.R, y, z], t: q.t, n: b.n });
      });
    });
    if (!cands.length) return { nada: true };
    // 2) busca barata: para cada impacto e cada atraso áudio→vídeo, quanto a trajetória inicial "acerta" as manchas
    //    (no começo o atraso é desconhecido; com ele errado, a velocidade sai errada)
    var taus = [];
    if (priori.stau > 0.02) for (var tt = -0.05; tt <= 0.15001; tt += 0.01) taus.push(tt); else taus = [priori.tau - 0.01, priori.tau, priori.tau + 0.01];
    var top = [];
    cands.forEach(function (c) {
      taus.forEach(function (tau) {
        var ini = chuteReta(priori.p0, c.X, T, tau, priori.w), a = associar(cam, ini, br.tClac + tau, br.quadros, 90, T - 0.004, true);
        // o quadro do impacto também tem de bater com o tempo do "tum"
        var dtImp = c.t - (br.tTum + tau), pen = dtImp < -0.01 ? 2 : dtImp > 0.035 ? 1 : 0;
        top.push({ nota: a.nota - pen, c: c, tau: tau, ini: ini, obs: a.obs });
      });
    });
    top.sort(function (a, b) { return b.nota - a.nota; });
    // 3) ajuste completo só nos 3 melhores chutes
    var melhor = null;
    top.slice(0, 3).forEach(function (k) {
      if (k.obs.length < 2) return;
      var pr = Object.assign({}, priori, { tau: k.tau, stau: Math.min(priori.stau, 0.015) });
      var dados = { cam: cam, obs: k.obs, tClac: br.tClac, tTum: br.tTum, impacto: k.c.X, xLona: L.x - Fisica.R, priori: pr, inicial: k.ini, sigmaPx: 3, fat: cfg.fat };
      var aj = Ajuste.ajustar(dados, { iter: 12 });
      dados.obs = associar(cam, aj.p, br.tClac + aj.p[8], br.quadros, 25, T - 0.004); dados.inicial = aj.p;
      aj = Ajuste.ajustar(dados);
      var nota = aj.custo / Math.max(1, dados.obs.length) - dados.obs.length * 0.5;
      // atraso muito longe do já aprendido = associação errada (outra mancha amarela)
      if (priori.stau < 0.02 && Math.abs(aj.p[8] - priori.tau) > 3 * priori.stau) nota += 1000;
      if (!melhor || nota < melhor.nota) melhor = { nota: nota, aj: aj, dados: dados, c: k.c };
    });
    if (!melhor) return null;
    var aj = melhor.aj, dados = melhor.dados;
    // só vale se a bola foi vista de verdade no caminho (estalo de quique no chão + manchas soltas não contam)
    if (dados.obs.length < 4 || aj.rmsPx > 8) return { nada: true, fraco: true };
    var av = Ajuste.avaliar(aj, cfg.lado, cfg.fat, jogo());
    av.nObs = dados.obs.length; av.tau = aj.p[8]; av.impacto = melhor.c.X; av.p = aj.p; av.rmsPx = aj.rmsPx;
    av.estimativa = dados.obs.length < 4;
    return av;
  }
  function analisarQuadra(br, cam, priori) {
    // sem lona: procura entre muitos chutes iniciais a trajetória que mais "acerta" manchas nos quadros
    var t0 = br.tClac + priori.tau, melhor = null;
    for (var v = 110; v <= 200; v += 30) for (var el = -7; el <= 4; el += 1.5) for (var az = 0; az <= 16; az += 2) {
      var v0 = Fisica.vetorSaida(v, el, az * cfg.lado), p = priori.p0.concat(v0, priori.w, [priori.tau]);
      var obs = associar(cam, p, t0, br.quadros, 45, 0.33);      // só o começo do voo (antes de qualquer quique)
      if (!melhor || obs.length > melhor.obs.length) melhor = { p: p, obs: obs };
    }
    if (!melhor || melhor.obs.length < 6) return { nada: true };
    var dados = { cam: cam, obs: melhor.obs, tClac: br.tClac, priori: priori, inicial: melhor.p, sigmaPx: 3, fat: cfg.fat };
    var aj = Ajuste.ajustar(dados);
    // estende aos poucos: primeiro até 0,33 s com portão justo, depois até perto do quique previsto
    dados.obs = associar(cam, aj.p, br.tClac + aj.p[8], br.quadros, 25, 0.33); dados.inicial = aj.p; aj = Ajuste.ajustar(dados);
    var vq = Ajuste.avaliar(aj, cfg.lado, cfg.fat, jogo()), tq = vq.tQueda || 0.8;
    dados.obs = associar(cam, aj.p, br.tClac + aj.p[8], br.quadros, 25, tq - 0.02); dados.inicial = aj.p;
    var ajC = Ajuste.ajustar(dados), avC = Ajuste.avaliar(ajC, cfg.lado, cfg.fat, jogo());
    if (dados.obs.length < 8 || ajC.rmsPx > 8) return { nada: true, fraco: true };
    // quique: perto do momento e do lugar previstos, a mancha mais baixa na imagem é a bola no chão
    var quique = acharQuique(cam, ajC.p, br, avC, dados.obs);
    if (quique) {
      var dQ = Object.assign({}, dados, { quique: quique.X, sigmaQuique: quique.sigma, inicial: ajC.p }), ajQ = Ajuste.ajustar(dQ);
      if (ajQ.rmsPx > ajC.rmsPx * 1.5 + 1) quique = null;          // o quique não combina com o voo: ignora
      else { ajC = ajQ; avC = Ajuste.avaliar(ajC, cfg.lado, cfg.fat, jogo()); }
    }
    if (quique) {
      // o veredito usa o quique medido (é o que aconteceu de fato); a física dá velocidade e efeito
      avC.quiqueMedido = quique.X; avC.queda = [quique.X[0], quique.X[1], 0]; avC.sx = quique.sigma; avC.sy = Math.max(0.08, quique.sigma / 3);
      avC.res = resultadoDoQuique(quique.X, avC);
    }
    // o que a lona a "dsim" metros teria dito: só os quadros até lá (e o ponto/tempo de passagem como se fosse a lona)
    var xs = contatoNominal()[0] + cfg.aj.dsim;
    var trC = Fisica.voo([ajC.p[0], ajC.p[1], ajC.p[2]], [ajC.p[3], ajC.p[4], ajC.p[5]], Ajuste.efeitoDe(ajC.p), { xAlvo: xs, fat: cfg.fat });
    var obsS = dados.obs.filter(function (o) { return o.t - (br.tClac + ajC.p[8]) < trC.t - 0.004; });
    var avS = null;
    if (obsS.length >= 4) {
      var dS = { cam: cam, obs: obsS, tClac: br.tClac, tTum: br.tClac + trC.t, impacto: trC.p, xLona: xs, priori: priori, inicial: priori.p0.concat(Fisica.vetorSaida(150, -3, 6 * cfg.lado), priori.w, [ajC.p[8]]), sigmaPx: 3, fat: cfg.fat };
      dS.inicial = chuteReta(priori.p0, trC.p, trC.t, ajC.p[8], priori.w);
      dS.priori = Object.assign({}, priori, { tau: ajC.p[8], stau: 0.002 });
      var ajS = Ajuste.ajustar(dS); avS = Ajuste.avaliar(ajS, cfg.lado, cfg.fat, jogo());
    }
    avC.nObs = dados.obs.length; avC.tau = ajC.p[8]; avC.p = ajC.p; avC.rmsPx = ajC.rmsPx; avC.simulado = avS;
    return avC;
  }

  /** Quique: no fim do voo, a bola desce na imagem até o ponto mais baixo e depois sobe.
      Cruza a reta da descida com a da subida para achar o pixel exato do toque no chão. */
  function acharQuique(cam, p, br, av, obsVoo) {
    if (!av.queda || !av.tQueda || !obsVoo.length) return null;
    var t0 = br.tClac + p[8], prev = Geom.projetar(cam, av.queda), seq = [], ult = obsVoo[obsVoo.length - 1];
    // sequência de manchas perto do fim previsto do voo (de 0,15 s antes até 0,25 s depois)
    br.quadros.forEach(function (q) {
      var dt = q.t - t0 - av.tQueda; if (dt < -0.15 || dt > 0.25) return;
      var ref = seq.length ? seq[seq.length - 1] : (q.t > ult.t ? ult : prev.length ? { x: prev[0], y: prev[1] } : null), m = null;
      q.b.forEach(function (b) {
        var d = Math.min(Math.hypot(b.x - prev[0], b.y - prev[1]), ref ? Math.hypot(b.x - ref.x, b.y - ref.y) * 1.5 : 1e9);
        if (d < 110 && (!m || d < m.d)) m = { t: q.t, x: b.x, y: b.y, d: d };
      });
      if (m) seq.push(m);
    });
    if (seq.length < 4) return null;
    var iMax = 0; seq.forEach(function (o, i) { if (o.y > seq[iMax].y) iMax = i; });
    var pre = seq.slice(Math.max(0, iMax - 2), iMax + 1), pos = seq.slice(iMax + 1, iMax + 4);
    if (pre.length < 2 || pos.length < 2) return null;
    function reta(l) {       // x(t) e y(t) por mínimos quadrados
      var n = l.length, mt = 0, mx = 0, my = 0; l.forEach(function (o) { mt += o.t / n; mx += o.x / n; my += o.y / n; });
      var stt = 0, stx = 0, sty = 0; l.forEach(function (o) { stt += (o.t - mt) * (o.t - mt); stx += (o.t - mt) * (o.x - mx); sty += (o.t - mt) * (o.y - my); });
      return { mt: mt, mx: mx, my: my, vx: stx / stt, vy: sty / stt };
    }
    var A1 = reta(pre), A2 = reta(pos);
    if (!(A1.vy > 0 && A2.vy < 0)) return null;            // tem de descer na imagem e depois subir
    var ts = (A2.my - A2.vy * A2.mt - A1.my + A1.vy * A1.mt) / (A1.vy - A2.vy);
    if (ts < pre[0].t - 0.02 || ts > pos[0].t + 0.02) return null;
    var px = (A1.mx + A1.vx * (ts - A1.mt) + A2.mx + A2.vx * (ts - A2.mt)) / 2, py = A1.my + A1.vy * (ts - A1.mt);
    // o centro da bola, no quique, está a um raio (3,35 cm) do chão: quase rasante, isso faz diferença
    var uv = Geom.pixelNaAltura(cam, px, py, Fisica.R), uv2 = Geom.pixelNaAltura(cam, px, py + 1.5, Fisica.R);
    if (!uv || !uv2) return null;
    // incerteza em metros: quanto o ponto no chão anda com 1,5 px de erro (perto do horizonte, muito)
    var sig = Math.max(0.12, Math.hypot(uv2[0] - uv[0], uv2[1] - uv[1]));
    return { X: [uv[0], uv[1], 0], t: ts, sigma: sig };
  }
  function resultadoDoQuique(X, av) {
    if (av.res === 'rede') return 'rede';
    var Q = Fisica.QUADRA, y = X[1] * cfg.lado;
    if (X[0] < Q.rede) return 'curto';
    if (X[0] > Q.saque + Fisica.R) return 'longo';
    if (y < -Fisica.R) return 'fora_meio';
    if (y > Q.lateralSimples + Fisica.R) return 'fora_lado';
    return 'dentro';
  }

  /* ===================== resultado: tela, som e voz ===================== */
  var NOMES = { dentro: 'DENTRO', rede: 'REDE', curto: 'REDE', longo: 'LONGO', fora_lado: 'FORA (aberto)', fora_meio: 'FORA (no meio)' };
  function nomeTipo(t) { var l = TIPOS.saque.concat(TIPOS.fundo); for (var i = 0; i < l.length; i++) if (l[i][0] === t) return l[i][1]; return t; }
  function nomeRes(r) { if (ehParede() && r.res === 'fora_lado') return 'FORA (lateral)'; if (ehParede() && r.res === 'dentro') return r.fundo ? 'DENTRO · FUNDO' : 'DENTRO · CURTO'; return NOMES[r.res]; }
  function registrarResultado(r) {
    var dentro = r.res === 'dentro';
    var margem = margemLinha(r), porPouco = r.sx && margem !== null && margem < Math.max(r.sx, r.sy || 0);
    var cor = Ajuste.correcao(r.p, cfg.lado, cfg.fat, jogo());
    var item = { quando: Date.now(), modo: cfg.modo, tipo: cfg.tipo, lado: cfg.lado, res: r.res, kmh: r.kmh, rpm: r.rpm, top: r.top, lat: r.lateral,
                 elev: r.elev, az: r.az, queda: r.queda, sx: r.sx, sy: r.sy, folgaRede: r.folgaRede, contato: r.contato, nObs: r.nObs, rms: r.rmsPx,
                 impacto: r.impacto || null, p: r.p, fundo: !!r.fundo, porPouco: !!porPouco, estimativa: !!r.estimativa,
                 sim: r.simulado ? { res: r.simulado.res, queda: r.simulado.queda } : null };
    sessao.push(item); salvarSessao();
    // tela
    var v = $('veredito'); v.textContent = nomeRes(r) + (porPouco ? ' ?' : ''); v.className = dentro ? 'dentro' : 'fora';
    $('detalhe').textContent = (r.queda ? 'caiu a ' + n1(r.queda[0] - Fisica.QUADRA.rede) + ' m da rede' : 'bateu na rede (faltaram ' + Math.round(-r.folgaRede * 100) + ' cm)') +
      (r.sx ? ' · ±' + Math.round(r.sx * 100) + ' cm' : '') + (r.estimativa ? ' · poucos quadros, estimativa' : '') +
      (r.simulado ? ' · lona a ' + cfg.aj.dsim + ' m diria: ' + NOMES[r.simulado.res] : '') +
      (ehParede() && r.folgaRede !== null && r.folgaRede >= 0 ? ' · passou ' + Math.round(r.folgaRede * 100) + ' cm acima da rede' : '');
    $('nVel').textContent = Math.round(r.kmh); $('nRpm').textContent = Math.round(r.rpm / 100) * 100; $('nAng').textContent = r.elev.toFixed(1);
    var feitos = sessao.filter(function (s) { return s.tipo === cfg.tipo && s.modo === cfg.modo; }), ok = feitos.filter(function (s) { return s.res === 'dentro'; }).length;
    $('nPct').textContent = Math.round(100 * ok / Math.max(1, feitos.length)) + '%';
    var dicaTxt = textoDica(r, cor);
    $('dica').textContent = dentro ? '' : dicaTxt.tela;
    desenharQuadra(); desenharLona();
    // som e voz
    bip(dentro ? 'ok' : 'erro');
    var fala = dentro ? (porPouco ? 'Dentro, por pouco' : 'Dentro') + (ehParede() ? (r.fundo ? ', fundo' : ', curta') : '') + (cfg.aj.vel ? '. ' + Math.round(r.kmh) : '')
                      : nomeRes(r).toLowerCase().replace('(', '').replace(')', '') + (porPouco ? ', por pouco' : '') + (cfg.aj.dica && dicaTxt.voz ? '. ' + dicaTxt.voz : '');
    var av = aviso(r, porPouco);
    if (av) {                 // estilo juiz ou frases próprias: a chamada curta, e a dica (em português) depois, se ligada
      fala = av.txt; var lingua = av.lingua;
      setTimeout(function () { falar(fala, lingua); if (!dentro && cfg.aj.dica && dicaTxt.voz && cfg.aviso.estilo !== 'bip') setTimeout(function () { falar(dicaTxt.voz, 'pt-BR', true); }, 900); }, 380);
    } else if (cfg.aviso.estilo !== 'bip') setTimeout(function () { falar(fala); }, 380);
    estado((ehParede() ? 'Bola ' : 'Saque ') + sessao.length + ': ' + r.nObs + ' quadros com a bola, erro ' + (r.rmsPx || 0).toFixed(1) + ' px.');
  }
  function margemLinha(r) {
    if (!r.queda) return r.folgaRede !== null ? Math.abs(r.folgaRede) * 4 : null;
    var x = r.queda[0], y = r.queda[1] * cfg.lado, Q = Fisica.QUADRA;
    if (ehParede()) return Math.min(Math.abs(x - Q.rede), Math.abs(Q.fundo - x), Math.abs(Q.lateralSimples - Math.abs(r.queda[1])));
    return Math.min(Math.abs(x - Q.rede), Math.abs(Q.saque - x), Math.abs(y), Math.abs(Q.lateralSimples - y));
  }
  function textoDica(r, cor) {
    var partes = [], tela = [], d = cfg.modo === 'quadra' ? null : distAlvo(), alvo = ehParede() ? 'na parede' : 'na lona';
    if (cor.dElev !== null && (r.res === 'rede' || r.res === 'curto' || r.res === 'longo')) {
      var cm = d ? Math.round(Math.abs(d * Math.tan(cor.dElev * Math.PI / 180)) * 100) : null;
      var sobe = cor.dElev > 0;
      if (d) { partes.push('mire ' + cm + ' centímetros mais ' + (sobe ? 'alto' : 'baixo')); tela.push('Mire ' + cm + ' cm mais ' + (sobe ? 'alto' : 'baixo') + ' ' + alvo); }
      else { partes.push('suba ' + Math.abs(cor.dElev).toFixed(1) + ' grau'); tela.push((sobe ? 'Suba ' : 'Desça ') + Math.abs(cor.dElev).toFixed(1) + '° a saída'); if (!sobe) partes[0] = 'desça ' + Math.abs(cor.dElev).toFixed(1) + ' grau'; }
    } else if (cor.dElev === null && (r.res === 'rede' || r.res === 'curto')) { partes.push('mais forte'); tela.push('Nesta velocidade não entra: mais forte'); }
    if (r.res === 'fora_lado' || r.res === 'fora_meio') {
      var cmL = d ? Math.round(Math.abs(d * Math.tan(cor.dAz * Math.PI / 180)) * 100) : null, esq = cor.dAz > 0;
      var lado = esq ? 'à esquerda' : 'à direita';
      if (d) { partes.push('mire ' + cmL + ' centímetros ' + lado); tela.push('Mire ' + cmL + ' cm ' + lado + ' ' + alvo); }
      else { partes.push('mais ' + lado); tela.push('Mire mais ' + lado); }
    }
    return { voz: partes.join('. '), tela: tela.join(' · ') };
  }
  function mostrarSemLeitura() {
    $('veredito').textContent = 'sem leitura'; $('veredito').className = 'neutro';
    $('detalhe').textContent = 'Não achei a bola nos quadros. Confira a luz e a aba Ajustes → "Mostrar o que a câmera detecta".';
    $('dica').textContent = ''; bip('neutro');
  }

  /* ===================== sons e voz ===================== */
  function bip(tipo) {
    if (!actx) return;
    var agora = actx.currentTime, seq = { ok: [[880, 0, 0.09], [1320, 0.1, 0.14]], erro: [[220, 0, 0.32]], neutro: [[600, 0, 0.07], [600, 0.12, 0.07]], pronto: [[660, 0, 0.08], [990, 0.1, 0.08]] }[tipo];
    seq.forEach(function (s) {
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = tipo === 'erro' ? 'sawtooth' : 'sine'; o.frequency.value = s[0];
      g.gain.setValueAtTime(0.0001, agora + s[1]); g.gain.exponentialRampToValueAtTime(0.5, agora + s[1] + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, agora + s[1] + s[2]);
      o.connect(g); g.connect(actx.destination); o.start(agora + s[1]); o.stop(agora + s[1] + s[2] + 0.02);
    });
    mudoAte = performance.now() / 1000 + 0.6;
  }
  // O Safari do iPhone só deixa falar depois de uma fala feita dentro de um toque: libera no primeiro clique.
  var vozLiberada = false;
  function liberarVoz() {
    if (vozLiberada || !window.speechSynthesis) return;
    vozLiberada = true; var u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u);
  }
  document.addEventListener('click', liberarVoz, true);
  var vozes = {};
  function vozDa(lingua) {
    if (vozes[lingua] !== undefined) return vozes[lingua];
    var vs = speechSynthesis.getVoices(), base = lingua.split('-')[0];
    var v = vs.filter(function (x) { return x.lang.replace('_', '-').toLowerCase() === lingua.toLowerCase(); })[0] || vs.filter(function (x) { return x.lang.toLowerCase().indexOf(base) === 0; })[0] || null;
    if (vs.length) vozes[lingua] = v;
    return v;
  }
  function falar(txt, lingua, emSeguida) {
    if (!cfg.aj.voz || !window.speechSynthesis || !txt) return;
    lingua = lingua || 'pt-BR';
    var u = new SpeechSynthesisUtterance(txt), v = vozDa(lingua); u.lang = lingua; if (v) u.voice = v; u.rate = 1.08;
    mudoAte = performance.now() / 1000 + 4;
    u.onend = function () { mudoAte = performance.now() / 1000 + 0.3; };
    if (!emSeguida && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }
  /* Chamadas no estilo juiz de tênis (ou frases do usuário). Devolve null no estilo "português com dica". */
  var CHAMADAS = {
    juiz: { lingua: 'en-US', saque: { dentro: 'In', forte: 'Ace!', fora: 'Fault', rede: 'Net', porPouco: 'Close!' },
                             fundo: { dentro: 'In', forte: 'Winner!', fora: 'Out', rede: 'Net', porPouco: 'Close!' } },
    juizPt: { lingua: 'pt-BR', saque: { dentro: 'Boa!', forte: 'Ace!', fora: 'Fora!', rede: 'Rede!', porPouco: 'Por pouco!' },
                               fundo: { dentro: 'Boa!', forte: 'Bola vencedora!', fora: 'Fora!', rede: 'Rede!', porPouco: 'Por pouco!' } },
    juizOut: { lingua: 'en-US', saque: { dentro: 'In', forte: 'Ace!', fora: 'Out', rede: 'Net', porPouco: 'Close!' },
                                fundo: { dentro: 'In', forte: 'Smash!', fora: 'Out', rede: 'Net', porPouco: 'Close!' } }
  };
  function eventoDe(r) {
    if (r.res === 'dentro') return r.kmh >= (ehParede() ? cfg.aviso.forteFundo : cfg.aviso.forteSaque) ? 'forte' : 'dentro';
    if (r.res === 'rede' || r.res === 'curto') return 'rede';
    return 'fora';
  }
  function aviso(r, porPouco) {
    var e = cfg.aviso.estilo; if (e === 'pt') return null;
    var ev = eventoDe(r);
    if (e === 'bip') return { txt: '', lingua: 'pt-BR' };
    var base = CHAMADAS[e === 'meu' ? 'juizOut' : e] || CHAMADAS.juiz, j = ehParede() ? 'fundo' : 'saque';
    var fr = e === 'meu' ? Object.assign({}, base[j], cfg.aviso.frases[j] || {}) : base[j];
    var txt = fr[ev] + (porPouco && ev !== 'forte' ? ' — ' + fr.porPouco : '') + (ev !== 'rede' && ev !== 'fora' && cfg.aj.vel ? ' ' + Math.round(r.kmh) : '');
    return { txt: txt, lingua: e === 'meu' ? cfg.aviso.lingua : base.lingua };
  }
  $('btTesteSom').onclick = async function () {
    if (!actx) { actx = new (window.AudioContext || window.webkitAudioContext)(); }
    await actx.resume();
    var exemplos = [{ res: 'dentro', kmh: 152 }, { res: 'dentro', kmh: 185 }, { res: 'longo', kmh: 160 }, { res: 'rede', kmh: 140 }], i = 0;
    (function prox() {
      if (i >= exemplos.length) return;
      var r = exemplos[i++], dentro = r.res === 'dentro', av = aviso(r, false);
      bip(dentro ? 'ok' : 'erro');
      setTimeout(function () {
        if (av) falar(av.txt, av.lingua);
        else if (cfg.aviso.estilo !== 'bip') falar(dentro ? 'Dentro. ' + r.kmh : r.res === 'rede' ? 'Rede. Mire 12 centímetros mais alto' : 'Longo. Mire 8 centímetros mais baixo');
      }, 400);
      setTimeout(prox, 2400);
    })();
  };
  // campos do aviso sonoro
  function mostrarAviso() {
    var e = cfg.aviso.estilo; $('avEstilo').value = e; $('avFrases').style.display = e === 'meu' ? '' : 'none';
    $('avForteS').value = cfg.aviso.forteSaque; $('avForteF').value = cfg.aviso.forteFundo; $('avLingua').value = cfg.aviso.lingua;
    var j = ehParede() ? 'fundo' : 'saque', fr = Object.assign({}, CHAMADAS.juizOut[j], (cfg.aviso.frases[j] || {}));
    ['dentro', 'forte', 'fora', 'rede', 'porPouco'].forEach(function (k) { $('avF_' + k).value = fr[k]; });
    $('avJogo').textContent = ehParede() ? 'forehand/backhand' : 'saque';
  }
  $('avEstilo').onchange = function () { cfg.aviso.estilo = this.value; salvar(); mostrarAviso(); };
  $('avForteS').onchange = function () { cfg.aviso.forteSaque = +this.value; salvar(); };
  $('avForteF').onchange = function () { cfg.aviso.forteFundo = +this.value; salvar(); };
  $('avLingua').onchange = function () { cfg.aviso.lingua = this.value; vozes = {}; salvar(); };
  ['dentro', 'forte', 'fora', 'rede', 'porPouco'].forEach(function (k) {
    $('avF_' + k).onchange = function () { var j = ehParede() ? 'fundo' : 'saque'; cfg.aviso.frases[j] = cfg.aviso.frases[j] || {}; cfg.aviso.frases[j][k] = this.value; salvar(); };
  });

  /* ===================== calibração ===================== */
  var pontosCal = [], congelado = null;
  var cCal = $('cCal'), lupa = $('lupa'), lctx = lupa.getContext('2d');
  $('btCongelar').onclick = async function () {
    try { await ligarCamera(); } catch (e) { estadoCal('❌ ' + erroCamera(e)); return; }
    if (congelado) { congelado = null; this.textContent = '📷 Congelar imagem'; desenharCal(); return; }
    var c = document.createElement('canvas'); c.width = video.videoWidth; c.height = video.videoHeight;
    c.getContext('2d').drawImage(video, 0, 0); congelado = c; this.textContent = '▶ Voltar à imagem ao vivo';
    desenharCal();
  };
  $('btDesfazer').onclick = function () { pontosCal.pop(); mostrarPontos(); desenharCal(); };
  [].forEach.call(document.querySelectorAll('.setas button'), function (b) {
    b.onclick = function () { var p = pontosCal[pontosCal.length - 1]; if (!p) return; var d = b.dataset.d.split(','); p.img[0] += +d[0]; p.img[1] += +d[1]; desenharCal(); };
  });
  function mostrarPontos() {
    var lista = pontosDoModo();
    $('listaPontos').innerHTML = lista.map(function (p, i) {
      return '<span class="' + (i < pontosCal.length ? 'feito' : i === pontosCal.length ? 'atual' : '') + '">' + (i < pontosCal.length ? '✓ ' : '') + p.nome + '</span>';
    }).join('') + (cfg.modo === 'quadra' ? '<div class="peq" style="width:100%">Na quadra, quanto mais alto o celular, melhor: o chão lá longe é visto quase rasante. Com 1,6 m de altura o erro no quique é de uns 35 cm; com <b>2,5 m</b> (tripé alto ou preso no alambrado), uns 12 cm. Fique 1 a 2 m ao lado e um pouco atrás do sacador.</div>' : '') +
      (cfg.modo !== 'quadra' ? '<div class="peq" style="width:100%">Fitas no chão: um X embaixo do ponto de contato e outro X na linha de mira, a ' + n2(distAlvo() / 2) + ' m dele.' +
      (ehParede() ? ' Na parede: a fita-rede com ' + n2(cfg.par.larg) + ' m de comprimento, centrada na linha de mira, a ' + n2(cfg.par.fita) + ' m do chão.' : '') + '</div>' : '');
  }
  function retVideo() {      // retângulo onde o vídeo aparece dentro do palco
    var W = palco.clientWidth, H = palco.clientHeight, vw = video.videoWidth || 16, vh = video.videoHeight || 9, s = Math.min(W / vw, H / vh);
    return { x: (W - vw * s) / 2, y: (H - vh * s) / 2, s: s };
  }
  function toqueParaPixel(ev) {
    var b = palco.getBoundingClientRect(), r = retVideo(), t = ev.touches ? ev.touches[0] || ev.changedTouches[0] : ev;
    var px = t.clientX - b.left, py = t.clientY - b.top - 70;       // o ponto fica 70 px acima do dedo
    return { img: [(px - r.x) / r.s, (py - r.y) / r.s], tela: [px, py] };
  }
  function moverLupa(p) {
    var src = congelado || video; if (!src) return;
    lupa.style.display = 'block'; lupa.style.left = (p.tela[0] - 65) + 'px'; lupa.style.top = (p.tela[1] - 150) + 'px';
    var z = 5, lado = 130 / z;
    lctx.imageSmoothingEnabled = false;
    lctx.clearRect(0, 0, 130, 130);
    lctx.drawImage(src, p.img[0] - lado / 2, p.img[1] - lado / 2, lado, lado, 0, 0, 130, 130);
    lctx.strokeStyle = '#facc15'; lctx.lineWidth = 1; lctx.beginPath(); lctx.moveTo(65, 0); lctx.lineTo(65, 130); lctx.moveTo(0, 65); lctx.lineTo(130, 65); lctx.stroke();
  }
  var arrastando = null;
  palco.addEventListener('touchstart', function (e) { if (abaAtual !== 'calibrar') return; e.preventDefault(); arrastando = toqueParaPixel(e); moverLupa(arrastando); desenharCal(arrastando); }, { passive: false });
  palco.addEventListener('touchmove', function (e) { if (!arrastando) return; e.preventDefault(); arrastando = toqueParaPixel(e); moverLupa(arrastando); desenharCal(arrastando); }, { passive: false });
  palco.addEventListener('touchend', function (e) {
    if (!arrastando) return; e.preventDefault(); lupa.style.display = 'none';
    var lista = pontosDoModo();
    if (pontosCal.length < lista.length) pontosCal.push({ nome: lista[pontosCal.length].nome, X: lista[pontosCal.length].X, img: arrastando.img });
    arrastando = null; mostrarPontos(); desenharCal();
  }, { passive: false });
  palco.addEventListener('mousedown', function (e) {        // também funciona com mouse (Mac)
    if (abaAtual !== 'calibrar') return;
    var p = toqueParaPixel(e); p.img[1] += 70 / retVideo().s; var lista = pontosDoModo();
    if (pontosCal.length < lista.length) pontosCal.push({ nome: lista[pontosCal.length].nome, X: lista[pontosCal.length].X, img: p.img });
    mostrarPontos(); desenharCal();
  });
  function desenharCal(arr) {
    var W = palco.clientWidth, H = palco.clientHeight; cCal.width = W * devicePixelRatio; cCal.height = H * devicePixelRatio;
    var g = cCal.getContext('2d'), r = retVideo(); g.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); g.clearRect(0, 0, W, H);
    if (congelado) g.drawImage(congelado, r.x, r.y, congelado.width * r.s, congelado.height * r.s);
    function P(p) { return [r.x + p[0] * r.s, r.y + p[1] * r.s]; }
    pontosCal.forEach(function (p, i) { var q = P(p.img); g.strokeStyle = '#facc15'; g.lineWidth = 2; g.beginPath(); g.arc(q[0], q[1], 7, 0, 7); g.stroke(); g.fillStyle = '#facc15'; g.font = 'bold 13px sans-serif'; g.fillText(String(i + 1), q[0] + 9, q[1] - 7); });
    if (arr) { var q = P(arr.img); g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(q[0] - 12, q[1]); g.lineTo(q[0] + 12, q[1]); g.moveTo(q[0], q[1] - 12); g.lineTo(q[0], q[1] + 12); g.stroke(); }
    var c = calAtual();
    if (c && !arr) {             // confere: desenha a grade da lona (ou as linhas da quadra) e um saque típico
      var cam = camDe(c); g.strokeStyle = '#22c55eaa'; g.lineWidth = 1.5;
      function linha(A, B) { var a = Geom.projetar(cam, A), b = Geom.projetar(cam, B); if (a[2] <= 0 || b[2] <= 0) return; var pa = P(a), pb = P(b); g.beginPath(); g.moveTo(pa[0], pa[1]); g.lineTo(pb[0], pb[1]); g.stroke(); }
      if (ehParede()) { var Lp = lona(); g.strokeStyle = '#ef4444'; g.lineWidth = 3; linha([Lp.x, Lp.yDir, Lp.zt], [Lp.x, Lp.yEsq, Lp.zt]); g.strokeStyle = '#22c55eaa'; g.lineWidth = 1.5;
        linha([Lp.x, Lp.yDir, 0], [Lp.x, Lp.yEsq, 0]); linha([Lp.x, Lp.yDir, 0], [Lp.x, Lp.yDir, Lp.zt + 1.5]); linha([Lp.x, Lp.yEsq, 0], [Lp.x, Lp.yEsq, Lp.zt + 1.5]); }
      else if (cfg.modo === 'lona') { var L = lona(); for (var y = L.yDir; y <= L.yEsq + 1e-6; y += 0.5) linha([L.x, y, L.zb], [L.x, y, L.zt]); for (var z = L.zb; z <= L.zt + 1e-6; z += 0.5) linha([L.x, L.yDir, z], [L.x, L.yEsq, z]); }
      else { var Q = Fisica.QUADRA, s = 4.115 * cfg.lado; [[[5.485, -4.115], [5.485, 4.115]], [[Q.saque, -4.115], [Q.saque, 4.115]], [[5.485, 0], [Q.saque, 0]], [[0, s], [23.77, s]], [[0, -s], [23.77, -s]]].forEach(function (l) { linha([l[0][0], l[0][1], 0], [l[1][0], l[1][1], 0]); }); linha([Q.rede, -5.03, 1.07], [Q.rede, 5.03, 1.07]); }
      var p0 = contatoNominal(), vEx = ehParede() ? Fisica.vetorSaida(95, 8, 0) : Fisica.vetorSaida(150, -3, 7 * cfg.lado);
      var tr = Fisica.voo(p0, vEx, Fisica.EFEITOS[cfg.tipo], { guardar: true, xAlvo: cfg.modo !== 'quadra' ? lona().x : undefined });
      g.strokeStyle = '#facc15'; g.setLineDash([5, 4]); g.beginPath();
      tr.pts.forEach(function (pt, i) { if (i % 10) return; var a = Geom.projetar(cam, pt.p); if (a[2] <= 0) return; var pa = P(a); if (!i) g.moveTo(pa[0], pa[1]); else g.lineTo(pa[0], pa[1]); });
      g.stroke(); g.setLineDash([]);
      var a0 = Geom.projetar(cam, p0), pa0 = P(a0); g.fillStyle = '#38bdf8'; g.beginPath(); g.arc(pa0[0], pa0[1], 6, 0, 7); g.fill();
    }
  }
  $('btCalcular').onclick = function () {
    var lista = pontosDoModo();
    if (pontosCal.length < lista.length) { estadoCal('Faltam ' + (lista.length - pontosCal.length) + ' ponto(s).'); return; }
    var W = video.videoWidth, H = video.videoHeight, fPadrao = W * 0.75;    // ~67° de campo horizontal (câmera principal)
    var plano, uvs;
    if (cfg.modo === 'lona' || ehParede()) {
      var L = lona(); plano = { O: [L.x, L.yDir, L.zb], U: [0, 1, 0], V: [0, 0, 1] };
      uvs = pontosCal.slice(0, 4).map(function (p) { return { uv: [p.X[1] - L.yDir, p.X[2] - L.zb], img: p.img }; });
    } else {
      plano = { O: [0, 0, 0], U: [1, 0, 0], V: [0, 1, 0] };
      uvs = pontosCal.slice(0, 4).map(function (p) { return { uv: [p.X[0], p.X[1]], img: p.img }; });
    }
    var cam = Geom.camera(plano, uvs, W, H, fPadrao);
    if (!cam) { estadoCal('❌ Não consegui calcular. Confira a ordem dos pontos.'); return; }
    var priC = cfg.cel.usar && cfg.modo !== 'quadra' ? { C: SIM.posicaoCelular(cfg.cel), s: [0.10, 0.10, 0.03], sigmaPx: 1.5 } : null;
    cam = Geom.refinarCamera(cam, pontosCal.map(function (p) { return p.X; }), pontosCal.map(function (p) { return p.img; }), false, priC);
    // confere: a posição que a imagem indica bate com a medida do tripé?
    var difTripe = priC ? Math.hypot(cam.C[0] - priC.C[0], cam.C[1] - priC.C[1], cam.C[2] - priC.C[2]) : null;
    cam.H = hDoPlano(cam, plano);
    var campo = 2 * Math.atan(W / 2 / cam.f) * 180 / Math.PI;
    var c = { R: cam.R, t: cam.t, f: cam.f, cx: cam.cx, cy: cam.cy, C: cam.C, H: cam.H, W: W, Ht: H, erroPx: cam.erroPx, pontos: pontosCal, quando: Date.now() };
    cfg.cal[cfg.modo + (cfg.lado > 0 ? '+' : '-')] = c; delete cfg.contato[chaveModo()]; salvar(); calcularROI(); desenharCal();
    var ok = cam.erroPx < 6 && campo > 40 && campo < 110;
    estadoCal((ok ? '✅ Calibrado. ' : '⚠️ Confira: ') + 'erro máximo ' + cam.erroPx.toFixed(1) + ' px · campo de visão ' + campo.toFixed(0) + '° · celular a ' +
      Math.hypot(cam.C[0] - contatoNominal()[0], cam.C[1] - contatoNominal()[1]).toFixed(2) + ' m do contato, ' + cam.C[2].toFixed(2) + ' m de altura.<br>' +
      'A grade verde deve cair em cima da lona (ou das linhas) e a linha amarela é um saque típico. ' + (ok ? '' : 'Se não bater, marque os pontos de novo com a lupa.') +
      (difTripe !== null ? '<br>' + (difTripe < 0.25 ? '✅ A imagem confirma a posição do tripé que você mediu (diferença de ' + Math.round(difTripe * 100) + ' cm).'
        : '⚠️ A imagem indica o celular a ' + Math.round(difTripe * 100) + ' cm de onde você mediu. Confira as medidas do tripé na aba Montagem (atrás, ao lado, altura) ou marque os pontos de novo.') : ''));
  };
  /** Homografia plano→imagem a partir da câmera: H = K·[R·U, R·V, R·O + t]. */
  function hDoPlano(cam, pl) {
    function mul(R, x) { return [0, 1, 2].map(function (i) { return R[i][0] * x[0] + R[i][1] * x[1] + R[i][2] * x[2]; }); }
    var a = mul(cam.R, pl.U), b = mul(cam.R, pl.V), c = mul(cam.R, pl.O); c = [c[0] + cam.t[0], c[1] + cam.t[1], c[2] + cam.t[2]];
    var H = [a, b, c].map(function (col) { return [cam.f * col[0] + cam.cx * col[2], cam.f * col[1] + cam.cy * col[2], col[2]]; });
    var M = [[H[0][0], H[1][0], H[2][0]], [H[0][1], H[1][1], H[2][1]], [H[0][2], H[1][2], H[2][2]]], k = M[2][2];
    return M.map(function (l) { return l.map(function (x) { return x / k; }); });
  }
  function estadoCal(t) { $('resCal').innerHTML = t; }
  if (calAtual()) estadoCal('✅ Calibração salva em ' + new Date(calAtual().quando).toLocaleString('pt-BR') + '. Se o tripé mexeu, calibre de novo.');

  /* ===================== desenhos ===================== */
  function desenharQuadra() {
    var cv = $('cQuadra'), g = cv.getContext('2d'), W = cv.width, H = cv.height, Q = Fisica.QUADRA;
    g.clearRect(0, 0, W, H);
    // vista de cima do lado adversário: x de 11 a 24 m (vertical), y de -6 a 6 (horizontal)
    var sx = W / 13, sy = H / 13.6;
    function Pq(x, y) { return [W / 2 - y * sx, H - (x - 10.8) * sy]; }
    g.fillStyle = '#1d4d3a'; var a = Pq(23.77, 5.485), b = Pq(Q.rede, -5.485); g.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
    if (ehParede()) {      // golpe de fundo: a quadra de simples inteira; o fundo (depois da linha de saque) mais claro
      var f1 = Pq(Q.fundo, 4.115), f2 = Pq(Q.rede, -4.115), f3 = Pq(Q.saque, -4.115);
      g.fillStyle = '#2f7a59'; g.fillRect(f1[0], f1[1], f2[0] - f1[0], f2[1] - f1[1]);
      g.fillStyle = '#3c9a70'; g.fillRect(f1[0], f1[1], f3[0] - f1[0], f3[1] - f1[1]);
    } else {
      var alvo1 = Pq(Q.saque, 4.115 * cfg.lado), alvo2 = Pq(Q.rede, 0); g.fillStyle = '#2f7a59';
      g.fillRect(Math.min(alvo1[0], alvo2[0]), alvo1[1], Math.abs(alvo2[0] - alvo1[0]), alvo2[1] - alvo1[1]);
    }
    g.strokeStyle = '#fff'; g.lineWidth = 2;
    function L(x1, y1, x2, y2) { var p = Pq(x1, y1), q = Pq(x2, y2); g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke(); }
    L(Q.rede, -5.485, 23.77, -5.485); L(Q.rede, 5.485, 23.77, 5.485); L(Q.rede, -4.115, 23.77, -4.115); L(Q.rede, 4.115, 23.77, 4.115);
    L(Q.saque, -4.115, Q.saque, 4.115); L(Q.rede, 0, Q.saque, 0); L(23.77, -5.485, 23.77, 5.485);
    g.strokeStyle = '#ddd'; g.lineWidth = 4; L(Q.rede, -6, Q.rede, 6);
    g.fillStyle = '#9db8ab'; g.font = '15px sans-serif'; g.fillText('rede', 8, Pq(Q.rede, 0)[1] - 6);
    var lista = sessao.filter(function (s) { return s.modo === cfg.modo && (ehParede() || s.lado === cfg.lado); }).slice(-60);
    lista.forEach(function (s, i) {
      var ultimo = i === lista.length - 1, cor = s.res === 'dentro' ? '#22c55e' : '#ef4444';
      if (s.queda) { var p = Pq(s.queda[0], s.queda[1]); g.fillStyle = cor; g.globalAlpha = ultimo ? 1 : 0.55; g.beginPath(); g.arc(p[0], p[1], ultimo ? 9 : 6, 0, 7); g.fill();
        if (ultimo && s.sx) { g.strokeStyle = cor; g.lineWidth = 1.5; g.beginPath(); g.ellipse(p[0], p[1], Math.max(4, (s.sy || s.sx) * sx), Math.max(4, s.sx * sy), 0, 0, 7); g.stroke(); } }
      else { var pr = Pq(Q.rede, 0); g.fillStyle = cor; g.globalAlpha = ultimo ? 1 : 0.5; g.fillRect(pr[0] - 5 + (i % 7 - 3) * 8, pr[1] - 4, 8, 8); }
      g.globalAlpha = 1;
    });
  }
  function desenharLona() {
    var cv = $('cLona'), g = cv.getContext('2d'), W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    if (cfg.modo === 'quadra') { g.fillStyle = '#9db8ab'; g.font = '18px sans-serif'; g.fillText('Modo quadra: sem lona.', 20, 40); return; }
    var L = Object.assign({}, lona()); if (L.parede) { L.zt = L.zt + 2; L.yEsq += 1; L.yDir -= 1; }
    var larg = L.yEsq - L.yDir, alt = L.zt - L.zb, s = Math.min((W - 60) / larg, (H - 50) / alt), ox = 40, oy = 20;
    function P(y, z) { return [ox + (L.yEsq - y) * s, oy + (L.zt - z) * s]; }
    g.fillStyle = '#d8d4c8'; g.fillRect(ox, oy, larg * s, alt * s);
    g.strokeStyle = '#0003'; g.lineWidth = 1;
    for (var y = L.yDir; y <= L.yEsq; y += 0.2) { var a = P(y, L.zb), b = P(y, L.zt); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
    for (var z = L.zb; z <= L.zt; z += 0.2) { a = P(L.yDir, z); b = P(L.yEsq, z); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
    // faixa de "dentro" para a velocidade e o efeito do último saque
    var ult = sessao.filter(function (s) { return s.modo === cfg.modo; }).slice(-1)[0], kmh = ult ? ult.kmh : (L.parede ? 95 : 150);
    var reg = regiaoNaLona(kmh, cfg.tipo, ult && ult.p ? Ajuste.efeitoDe(ult.p) : null);
    if (reg.length) { g.fillStyle = '#22c55e55'; g.beginPath(); reg.forEach(function (q, i) { var p = P(q[0], q[1]); if (!i) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]); }); g.closePath(); g.fill(); }
    if (L.parede) { var fa = P(L.yEsq, cfg.par.fita), fb = P(L.yDir, cfg.par.fita); g.strokeStyle = '#dc2626'; g.lineWidth = 4; g.beginPath(); g.moveTo(fa[0], fa[1]); g.lineTo(fb[0], fb[1]); g.stroke();
      g.fillStyle = '#dc2626'; g.font = 'bold 14px sans-serif'; g.fillText('fita = rede (' + n2(cfg.par.fita) + ' m)', fa[0] + 6, fa[1] - 6); }
    g.fillStyle = '#111'; g.font = '14px sans-serif'; g.fillText('verde = entra a ' + Math.round(kmh) + ' km/h (' + nomeTipo(cfg.tipo).toLowerCase() + ')', ox + 6, oy + 18);
    var lista = sessao.filter(function (s) { return s.modo === cfg.modo && s.impacto && (L.parede || s.lado === cfg.lado); }).slice(-40);
    lista.forEach(function (s, i) {
      var p = P(s.impacto[1], s.impacto[2]), ultimo = i === lista.length - 1;
      g.fillStyle = s.res === 'dentro' ? '#15803d' : '#b91c1c'; g.globalAlpha = ultimo ? 1 : 0.5;
      g.beginPath(); g.arc(p[0], p[1], ultimo ? 8 : 5, 0, 7); g.fill(); g.globalAlpha = 1;
    });
    g.fillStyle = '#9db8ab'; g.font = '13px sans-serif';
    g.fillText(n1(L.zt) + ' m', 2, oy + 10); g.fillText(n1(L.zb) + ' m', 2, oy + alt * s);
  }
  /** Contorno (y, z) no alvo (lona ou parede) das bolas que entram, para uma velocidade e efeito.
      Para cada direção, acha por bissecção o ângulo mínimo (passa a rede) e o máximo (não passa da linha). */
  var MEMO = {};
  function memo(nome, fn) {        // guarda o resultado para a mesma montagem (a física é a mesma)
    return function () {
      var k = nome + JSON.stringify([].slice.call(arguments)) + cfg.modo + cfg.lado + JSON.stringify(contatoNominal()) + lona().x;
      if (!(k in MEMO)) { MEMO[k] = fn.apply(null, arguments); var ks = Object.keys(MEMO); if (ks.length > 300) delete MEMO[ks[0]]; }
      return MEMO[k];
    };
  }
  var regiaoNaLona = memo('reg', regiaoNaLonaCalc);
  function regiaoNaLonaCalc(kmh, tipo, ef, dist) {
    var p0 = contatoNominal(), xL = dist ? p0[0] + dist : lona().x, efeito = ef || Fisica.EFEITOS[tipo], cols = [], pj = ehParede();
    var Q = Fisica.QUADRA, limite = pj ? Q.fundo : Q.saque, azs = pj ? [-14, 14, 2] : [-2, 20, 1.5];
    function passa(v0) { var r = Fisica.voo(p0, v0, efeito, { xAlvo: Q.rede }); return !r.chao && r.p[2] - Fisica.R - Fisica.alturaRede(r.p[1]) >= 0; }
    function queda(v0) { return Fisica.voo(p0, v0, efeito, {}).p[0]; }
    for (var az = azs[0]; az <= azs[1]; az += azs[2]) {
      var a = pj ? az : az * cfg.lado, lo = -12, hi = 40, i, m;
      for (i = 0; i < 22; i++) { m = (lo + hi) / 2; if (passa(Fisica.vetorSaida(kmh, m, a))) hi = m; else lo = m; }
      var eMin = hi; lo = eMin; hi = 45;
      if (queda(Fisica.vetorSaida(kmh, eMin, a)) > limite) continue;
      for (i = 0; i < 22; i++) { m = (lo + hi) / 2; if (queda(Fisica.vetorSaida(kmh, m, a)) <= limite) lo = m; else hi = m; }
      var eMax = lo, meio = Fisica.vereditoJogo(jogo(), p0, Fisica.vetorSaida(kmh, (eMin + eMax) / 2, a), efeito, cfg.lado);
      if (meio.res !== 'dentro') continue;
      var l1 = Fisica.voo(p0, Fisica.vetorSaida(kmh, eMin, a), efeito, { xAlvo: xL }), l2 = Fisica.voo(p0, Fisica.vetorSaida(kmh, eMax, a), efeito, { xAlvo: xL });
      if (l1.chao || l2.chao) continue;
      cols.push({ baixo: [l1.p[1], l1.p[2]], cima: [l2.p[1], l2.p[2]] });
    }
    return cols.map(function (c) { return c.baixo; }).concat(cols.reverse().map(function (c) { return c.cima; }));
  }
  /** Altura (centro da bola) na parede da bola que passa raspando a rede, para uma velocidade e efeito. */
  var alturaRedeNaParede = memo('rede', alturaRedeNaParedeCalc), alturaNaParedePara = memo('para', alturaNaParedeParaCalc);
  function alturaRedeNaParedeCalc(kmh, tipo, D) {
    var p0 = contatoNominal(), ef = Fisica.EFEITOS[tipo], a = -10, b = 35;
    function folga(e) { var r = Fisica.voo(p0, Fisica.vetorSaida(kmh, e, 0), ef, { xAlvo: Fisica.QUADRA.rede }); return r.chao ? -1 : r.p[2] - Fisica.R - Fisica.QUADRA.redeCentro; }
    for (var i = 0; i < 20; i++) { var m = (a + b) / 2; if (folga(m) > 0) b = m; else a = m; }
    var r = Fisica.voo(p0, Fisica.vetorSaida(kmh, b, 0), ef, { xAlvo: p0[0] + D }); return r.chao ? NaN : r.p[2];
  }
  function alturaNaParedeParaCalc(kmh, tipo, D, xQueda) {   // bola que cai em x = xQueda (linha de saque ou de fundo)
    var p0 = contatoNominal(), ef = Fisica.EFEITOS[tipo], a = -10, b = 40;
    function q(e) { return Fisica.voo(p0, Fisica.vetorSaida(kmh, e, 0), ef, {}).p[0]; }
    if (q(b) < xQueda) return NaN;
    for (var i = 0; i < 20; i++) { var m = (a + b) / 2; if (q(m) > xQueda) b = m; else a = m; }
    var r = Fisica.voo(p0, Fisica.vetorSaida(kmh, b, 0), ef, { xAlvo: p0[0] + D }); return r.chao ? NaN : r.p[2];
  }
  function alturaFitaRecomendada() { return alturaRedeNaParede(+$('pVel').value, $('pTipo').value, cfg.par.d) - Fisica.R; }
  function desenharParede() {
    if (abaAtual !== 'montagem' || !ehParede()) return;
    var kmh = +$('pVel').value, tipo = $('pTipo').value, D = cfg.par.d, Q = Fisica.QUADRA;
    var hR = alturaRedeNaParede(kmh, tipo, D), hS = alturaNaParedePara(kmh, tipo, D, Q.saque), hF = alturaNaParedePara(kmh, tipo, D, Q.fundo);
    $('pRec').innerHTML = 'Para <b>' + kmh + ' km/h ' + $('pTipo').selectedOptions[0].textContent.toLowerCase() + '</b>, com a parede a <b>' + n2(D) + ' m</b>:<br>' +
      '🔴 <b>fita-rede</b> (base da bola raspando a rede): <b>' + n2(hR - Fisica.R) + ' m</b> do chão<br>' +
      '🟡 fita de profundidade (bola acima dela cai depois da linha de saque): ' + (isNaN(hS) ? '—' : n2(hS) + ' m') + '<br>' +
      '🔵 fita de fundo (bola acima dela sai pela linha de fundo): ' + (isNaN(hF) ? 'não sai nesta velocidade' : n2(hF) + ' m');
    // tabela: como a altura da fita-rede muda com a distância e a velocidade
    var Ds = [5, 6, 7, 8, 9, 10, 11.885], vs = [75, 90, 105, 120];
    $('pTab').innerHTML = '<table><tr><th>Parede a</th>' + vs.map(function (v) { return '<th>' + v + ' km/h</th>'; }).join('') + '<th>variação</th></tr>' +
      Ds.map(function (d) {
        var hs = vs.map(function (v) { return alturaRedeNaParede(v, tipo, d) - Fisica.R; }), mx = Math.max.apply(null, hs), mn = Math.min.apply(null, hs);
        return '<tr' + (Math.abs(d - D) < 0.01 ? ' style="color:#facc15"' : '') + '><td>' + (d > 11 ? '11,9 m (= rede)' : n1(d) + ' m') + '</td>' +
          hs.map(function (h) { return '<td>' + n2(h) + '</td>'; }).join('') + '<td class="' + (mx - mn < 0.1 ? 'ok' : mx - mn < 0.3 ? 'meio' : 'ruim') + '">±' + Math.round((mx - mn) / 2 * 100) + ' cm</td></tr>';
      }).join('') + '</table>';
  }
  function desenharAlvo() {
    desenharParede();
    if (abaAtual !== 'montagem' || ehParede()) return;
    var cv = $('cAlvo'), g = cv.getContext('2d'), W = cv.width, H = cv.height, kmh = +$('mVel').value, tipo = $('mTipo').value;
    var L = lona(), larg = L.yEsq - L.yDir, alt = L.zt - L.zb, s = Math.min((W - 70) / larg, (H - 40) / alt), ox = 55, oy = 15;
    function P(y, z) { return [ox + (L.yEsq - y) * s, oy + (L.zt - z) * s]; }
    g.clearRect(0, 0, W, H); g.fillStyle = '#d8d4c8'; g.fillRect(ox, oy, larg * s, alt * s);
    var reg = regiaoNaLona(kmh, tipo, null);
    g.fillStyle = '#16a34a88'; g.beginPath(); reg.forEach(function (q, i) { var p = P(q[0], q[1]); if (!i) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]); }); g.closePath(); g.fill();
    g.strokeStyle = '#000'; g.fillStyle = '#000'; g.font = '13px sans-serif'; g.lineWidth = 1;
    for (var z = Math.ceil(L.zb * 2) / 2; z <= L.zt; z += 0.5) { var p = P(L.yEsq, z); g.fillText(n1(z) + ' m', 4, p[1] + 4); g.beginPath(); g.moveTo(ox - 4, p[1]); g.lineTo(ox, p[1]); g.stroke(); }
    var c = contatoNominal(), pm = P(c[1], L.zb); g.strokeStyle = '#2563eb'; g.setLineDash([6, 4]); g.beginPath(); g.moveTo(pm[0], oy); g.lineTo(pm[0], oy + alt * s); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#2563eb'; g.fillText('linha de mira', pm[0] + 4, oy + alt * s - 6);
    // tabela: altura mínima e máxima no meio do quadrado, e posição lateral do T e do aberto
    var linhas = [110, 130, 150, 170, 190].map(function (v) {
      var r = regiaoNaLona(v, tipo, null), zs = r.map(function (q) { return q[1]; }), ys = r.map(function (q) { return (q[0] - c[1]) * cfg.lado; });
      if (!r.length) return '<tr><td>' + v + '</td><td colspan=3>não entra</td></tr>';
      return '<tr><td>' + v + ' km/h</td><td>' + n2(Math.min.apply(null, zs)) + ' a ' + n2(Math.max.apply(null, zs)) + ' m</td><td>' +
        Math.round(Math.min.apply(null, ys) * 100) + ' a ' + Math.round(Math.max.apply(null, ys) * 100) + ' cm</td></tr>';
    }).join('');
    $('tabAlvo').innerHTML = '<table><tr><th>Velocidade</th><th>Altura na lona</th><th>À ' + (cfg.lado > 0 ? 'esquerda' : 'direita') + ' da linha de mira</th></tr>' + linhas + '</table>';
  }
  function desenharDebug(manchas) {
    var W = palco.clientWidth, H = palco.clientHeight; if (abaAtual === 'calibrar' && congelado) return;
    cCal.width = W * devicePixelRatio; cCal.height = H * devicePixelRatio;
    var g = cCal.getContext('2d'), r = retVideo(); g.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); g.clearRect(0, 0, W, H);
    if (roi) { g.strokeStyle = '#38bdf8'; g.strokeRect(r.x + roi.x / escala * r.s, r.y + roi.y / escala * r.s, roi.w / escala * r.s, roi.h / escala * r.s); }
    g.strokeStyle = '#ef4444'; g.lineWidth = 2;
    manchas.slice(0, 8).forEach(function (m) { g.beginPath(); g.arc(r.x + m.x * r.s, r.y + m.y * r.s, 6 + Math.sqrt(m.n), 0, 7); g.stroke(); });
  }

  /* ===================== sessão ===================== */
  function mostrarSessao() {
    var n = sessao.length, ok = sessao.filter(function (s) { return s.res === 'dentro'; }).length;
    var tiposUsados = sessao.map(function (s) { return s.tipo; }).filter(function (t, i, l) { return l.indexOf(t) === i; });
    var porTipo = tiposUsados.map(function (t) {
      var l = sessao.filter(function (s) { return s.tipo === t; }); if (!l.length) return '';
      var o = l.filter(function (s) { return s.res === 'dentro'; }).length, v = mediana(l.map(function (s) { return s.kmh; }));
      return nomeTipo(t) + ': ' + o + '/' + l.length + ' (' + Math.round(100 * o / l.length) + '%), ' + Math.round(v) + ' km/h';
    }).filter(String).join(' · ');
    var quadra = sessao.filter(function (s) { return s.modo === 'quadra' && s.sim; }), conc = quadra.filter(function (s) { return (s.sim.res === 'dentro') === (s.res === 'dentro'); }).length;
    $('resumoSessao').innerHTML = n + ' saques, ' + ok + ' dentro (' + Math.round(100 * ok / Math.max(1, n)) + '%). ' + porTipo +
      (quadra.length ? '<br>Na quadra, a lona a ' + cfg.aj.dsim + ' m teria acertado o veredito em ' + conc + ' de ' + quadra.length + ' saques.' : '');
    $('tabSessao').innerHTML = '<table><tr><th>#</th><th>Tipo</th><th>Resultado</th><th>km/h</th><th>rpm</th><th>Queda</th></tr>' +
      sessao.slice().reverse().slice(0, 80).map(function (s, i) {
        return '<tr><td>' + (n - i) + '</td><td>' + nomeTipo(s.tipo) + '</td><td class="' + (s.res === 'dentro' ? 'ok' : 'ruim') + '">' + NOMES[s.res] + (s.porPouco ? ' ?' : '') + '</td><td>' + Math.round(s.kmh) +
          '</td><td>' + Math.round(s.rpm / 100) * 100 + '</td><td>' + (s.queda ? (s.queda[0] - Fisica.QUADRA.rede).toFixed(1) + ' m' : '–') + '</td></tr>';
      }).join('') + '</table>';
  }
  $('btLimparSessao').onclick = function () { if (confirm('Apagar os saques desta sessão?')) { sessao = []; salvarSessao(); mostrarSessao(); desenharQuadra(); desenharLona(); } };
  $('btExportar').onclick = function () {
    var cab = 'quando;modo;tipo;lado;resultado;km_h;rpm;topspin_rpm;lateral_rpm;saida_graus;direcao_graus;queda_x_m;queda_y_m;incerteza_cm;quadros\n';
    var txt = cab + sessao.map(function (s) {
      return [new Date(s.quando).toLocaleString('pt-BR'), s.modo, s.tipo, s.lado > 0 ? 'iguais' : 'vantagem', NOMES[s.res], n1(s.kmh), Math.round(s.rpm), Math.round(s.top), Math.round(s.lat), n1(s.elev), n1(s.az),
              s.queda ? n2(s.queda[0]) : '', s.queda ? n2(s.queda[1]) : '', s.sx ? Math.round(s.sx * 100) : '', s.nObs].join(';');
    }).join('\n');
    compartilharArquivo(new Blob(['﻿' + txt], { type: 'text/csv' }), 'saques-' + agoraTxt() + '.csv');
  };
  $('btBrutos').onclick = function () {
    if (!ultimoBruto) { alert('Ainda não há saque.'); return; }
    compartilharArquivo(new Blob([JSON.stringify(ultimoBruto)], { type: 'application/json' }), 'saque-bruto-' + agoraTxt() + '.json');
  };
  $('btAprender').onclick = function () {
    var msgs = [];
    ['chapado', 'slice', 'kick'].forEach(function (t) {
      var l = sessao.filter(function (s) { return s.modo === 'quadra' && s.tipo === t && s.nObs >= 15 && s.p; });
      if (l.length < 5) { msgs.push(t + ': só ' + l.length + ' saques bons na quadra (precisa de 5).'); return; }
      var wy = l.map(function (s) { return s.p[6]; }), wz = l.map(function (s) { return s.p[7]; });
      var p = { wy: mediana(wy), wz: mediana(wz), swy: dp(wy), swz: dp(wz), n: l.length };
      cfg.perfil[t] = p;
      msgs.push(t + ': ' + Math.round(Math.hypot(p.wy, p.wz) * 30 / Math.PI) + ' rpm em média (' + l.length + ' saques) ✓');
    });
    salvar(); $('resAprender').innerHTML = msgs.join('<br>');
  };

  /* ===================== montagem sob medida (altura do jogador e espaço) ===================== */
  // Proporções típicas: no saque o contato fica a ~1,5 × a altura (braço e raquete esticados, pequeno salto);
  // no forehand/backhand, a ~0,53 × a altura (cintura). Atrás do contato: 1,5 m para o lançamento e os pés;
  // atrás do alvo: 0,4 m para a lona ceder.
  var ERRO_SAQUE = [[3.5, 56], [5, 36], [6, 32], [8, 23], [10, 17]];     // erro mediano (cm) da simulação
  function interp(t, x) { if (x <= t[0][0]) return t[0][1]; for (var i = 1; i < t.length; i++) if (x <= t[i][0]) { var a = t[i - 1], b = t[i]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); } return t[t.length - 1][1]; }
  ligar('jAlt', cfg.jog, 'alt', 'n'); ligar('jEsp', cfg.jog, 'espaco', 'n'); ligar('jTeto', cfg.jog, 'teto', 'n');
  $('btMinha').onclick = function () {
    var J = cfg.jog, hcS = Math.round(J.alt * 1.5 * 100) / 100, hcF = Math.round(J.alt * 0.53 * 100) / 100;
    var livre = J.espaco - 1.5 - 0.4, dS = Math.min(10, livre), dP = Math.min(Fisica.QUADRA.rede, J.espaco - 1.5 - 0.1), avisos = [];
    if (dS < 4) { avisos.push('⚠️ Com ' + n1(J.espaco) + ' m o alvo do saque fica a ' + n1(Math.max(dS, 0)) + ' m: pouco para medir bem. O mínimo razoável é um local de 7,5 m (lona a 5,6 m).'); }
    var tetoMin = hcS + 0.9;      // o lançamento sobe uns 60–90 cm acima do contato
    if (J.teto > 0 && J.teto < tetoMin) avisos.push('⚠️ O teto de ' + n2(J.teto) + ' m é baixo para o saque: o lançamento passa de ' + n2(tetoMin) + ' m. Para o forehand/backhand não há problema.');
    cfg.mont.hc = hcS; cfg.mont.d = Math.max(3, Math.round(dS * 10) / 10);
    cfg.par.hc = hcF; cfg.par.d = Math.max(3, Math.round(dP * 10) / 10);
    // fita da parede para um topspin a 95 km/h
    var tipoAnt = cfg.tipo, modoAnt = cfg.modo; cfg.modo = 'parede';
    cfg.par.fita = Math.round((alturaRedeNaParede(95, 'fh_top', cfg.par.d) - Fisica.R) * 100) / 100;
    cfg.modo = modoAnt; cfg.tipo = tipoAnt;
    salvar();
    ['mHc', 'mD', 'pHc', 'pD', 'pFita'].forEach(function (id) { var o = id[0] === 'm' ? cfg.mont : cfg.par, k = { mHc: 'hc', mD: 'd', pHc: 'hc', pD: 'd', pFita: 'fita' }[id]; $(id).value = o[k]; });
    pontosCal = []; mostrarPontos(); calcularROI(); desenharLona(); desenharAlvo(); desenharParede(); desenharPlano();
    var sug = aplicarSugestaoTripe(true);
    $('resMinha').innerHTML =
      '🎾 <b>Saque</b>: contato a <b>' + n2(hcS) + ' m</b> · lona a <b>' + n1(cfg.mont.d) + ' m</b> do contato · erro esperado no ponto de queda ≈ <b>' + Math.round(interp(ERRO_SAQUE, cfg.mont.d)) + ' cm</b>' +
      (cfg.mont.d >= 10 ? ' (10 m já é o máximo útil)' : '') + '<br>' +
      '🧱 <b>Forehand/backhand</b>: contato a <b>' + n2(hcF) + ' m</b> · parede a <b>' + n1(cfg.par.d) + ' m</b> · fita-rede a <b>' + n2(cfg.par.fita) + ' m</b> do chão' +
      (cfg.par.d >= 11.8 ? ' (a parede está na distância real da rede: a fita vale para qualquer velocidade)' : ' (para 95 km/h com topspin)') + '<br>' +
      'Atrás de você ficam 1,5 m livres para o lançamento e os pés' + (J.teto > 0 ? '; teto necessário para o saque: ' + n2(tetoMin) + ' m' : '') + '.' +
      (avisos.length ? '<br>' + avisos.join('<br>') : '') +
      '<br>As medidas abaixo já foram preenchidas. Depois de montar, meça com a trena e corrija se ficou diferente.' +
      (sug ? '<br>📱 Mudei o tripé para caber tudo na imagem: ' + n2(cfg.cel.atras) + ' m atrás, ' + n2(cfg.cel.lado) + ' m ao lado, ' + n2(cfg.cel.h) + ' m de altura.' : '');
  };

  /* ===================== tripé e desenho da montagem ===================== */
  ligar('cAtras', cfg.cel, 'atras', 'n'); ligar('cLado', cfg.cel, 'lado', 'n'); ligar('cH', cfg.cel, 'h', 'n'); ligar('cUsar', cfg.cel, 'usar');
  $('cLadoEsq').value = cfg.cel.ladoEsq ? 'esq' : 'dir';
  $('cLadoEsq').onchange = function () { cfg.cel.ladoEsq = this.value === 'esq'; salvar(); desenharPlano(); };
  var modoDoTripe = cfg.modo;
  function trocarTripe() {      // guarda o tripé do modo anterior e carrega o do novo (o objeto é o mesmo, ligado aos campos)
    cfg.celPor[modoDoTripe] = { atras: cfg.cel.atras, lado: cfg.cel.lado, h: cfg.cel.h, ladoEsq: cfg.cel.ladoEsq };
    var n = cfg.celPor[cfg.modo] || TRIPE_PADRAO[cfg.modo] || TRIPE_PADRAO.lona;
    cfg.cel.atras = n.atras; cfg.cel.lado = n.lado; cfg.cel.h = n.h; if (n.ladoEsq !== undefined) cfg.cel.ladoEsq = n.ladoEsq;
    modoDoTripe = cfg.modo; salvar();
    $('cAtras').value = cfg.cel.atras; $('cLado').value = cfg.cel.lado; $('cH').value = cfg.cel.h; $('cLadoEsq').value = cfg.cel.ladoEsq ? 'esq' : 'dir';
  }
  function desenharPlano() {
    if (abaAtual !== 'montagem' || !window.Plano) return;
    try { var r = Plano.desenhar(); $('enqTxt').innerHTML = r ? Plano.textoEnquadramento(r) : 'No modo quadra não há lona nem parede para desenhar.'; }
    catch (e) { $('enqTxt').textContent = '❌ ' + e.message; console.error(e); }
  }
  function aplicarSugestaoTripe(soSeNaoCabe) {
    if (cfg.modo === 'quadra') return null;
    if (soSeNaoCabe) { try { if (Plano.dados().enq.ok) return null; } catch (e) {} }
    var m = Plano.sugerirTripe(); if (!m) return null;
    cfg.cel.atras = Math.round(m.atras * 100) / 100; cfg.cel.lado = Math.round(m.lado * 100) / 100; cfg.cel.h = Math.round(m.h * 100) / 100; salvar();
    $('cAtras').value = cfg.cel.atras; $('cLado').value = cfg.cel.lado; $('cH').value = cfg.cel.h;
    desenharPlano(); return m;
  }
  $('btSugerirTripe').onclick = function () {
    var m = aplicarSugestaoTripe(false);
    $('resTripe').innerHTML = m ? '✅ Tripé sugerido: <b>' + n2(m.atras) + ' m atrás</b> do contato, <b>' + n2(m.lado) + ' m ' + (cfg.cel.ladoEsq ? 'à esquerda' : 'à direita') + '</b>, celular a <b>' + n2(m.h) + ' m</b> de altura. Aponte o celular para o meio entre você e o alvo.'
                              : '⚠️ Não achei uma posição em que tudo caiba. Aumente a distância ao alvo ou use o celular mais para trás.';
  };
  $('btTestarMontagem').onclick = function () {
    var b = this; if (cfg.modo === 'quadra') { $('resTeste').textContent = 'Escolha Saque · lona ou Forehand/backhand · parede.'; return; }
    b.disabled = true; $('resTeste').textContent = 'Simulando…';
    SIM.testarMontagem(30, function (k, n) { $('resTeste').textContent = 'Simulando ' + k + ' de ' + n + ' golpes…'; }, function (s) {
      b.disabled = false;
      if (s.erro) { $('resTeste').textContent = '❌ ' + s.erro; return; }
      $('resTeste').innerHTML = '<b>' + s.pctCerto + '%</b> de veredito certo (' + s.certos + ' de ' + s.golpes + ' golpes simulados na sua montagem).<br>' +
        'Erro no ponto de queda: <b>' + s.quedaMedianaCm + ' cm</b> (mediano) · 90% abaixo de ' + s.queda90Cm + ' cm.<br>' +
        'Velocidade: erro de ' + n1(s.velMed) + ' km/h · pontos da calibração visíveis: ' + s.visiveis + ' de ' + s.total +
        (s.semLeitura ? ' · ' + s.semLeitura + ' sem leitura' : '') + '.<br><span class="peq">Simulação com a física do app, a sua altura, as distâncias e o tripé informados, 60 quadros/s, ruído de 2,5 px, uma mancha amarela falsa por quadro e 10% de quadros perdidos. Os erros de veredito costumam ser bolas rentes à linha.</span>';
    });
  };

  /* ===================== compartilhar com amigos ===================== */
  function compartilharApp() {
    var url = location.origin + location.pathname;
    var txt = 'Treinador de saque, forehand e backhand: abra no Safari do iPhone, monte a lona ou a fita na parede (aba Montagem) e calibre. O celular fala se entrou.';
    if (navigator.share) navigator.share({ title: 'Treinador de Saque — por Jorge Stefani', text: txt, url: url }).catch(function () {});
    else { try { navigator.clipboard.writeText(url); alert('Link copiado: ' + url); } catch (e) { prompt('Copie o link:', url); } }
  }
  $('btCompartilhar').onclick = compartilharApp; $('btCompartilhar2').onclick = compartilharApp;

  /* ===================== exportar / importar ===================== */
  $('btExportarCfg').onclick = function () { compartilharArquivo(new Blob([JSON.stringify(cfg)], { type: 'application/json' }), 'treinador-saque-config.json'); };
  $('btImportarCfg').onclick = function () { $('arqCfg').click(); };
  $('arqCfg').onchange = function () {
    var f = this.files[0]; if (!f) return;
    f.text().then(function (t) { try { var c = JSON.parse(t); cfg.cal = c.cal || cfg.cal; cfg.perfil = c.perfil || cfg.perfil; cfg.mont = c.mont || cfg.mont; cfg.tau = c.tau || cfg.tau; salvar(); location.reload(); } catch (e) { alert('Arquivo inválido.'); } });
  };
  $('btApagarTudo').onclick = function () { if (confirm('Apagar calibração, perfil e sessão deste aparelho?')) { localStorage.removeItem(CHAVE); localStorage.removeItem(CHAVE + '.sessao'); location.reload(); } };
  function compartilharArquivo(blob, nome) {
    var arq = new File([blob], nome, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [arq] })) { navigator.share({ files: [arq] }).catch(function () {}); return; }
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  }

  /* ===================== utilidades ===================== */
  function mediana(l) { if (!l.length) return 0; var s = l.slice().sort(function (a, b) { return a - b; }), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  function dp(l) { var m = l.reduce(function (a, b) { return a + b; }, 0) / l.length; return Math.sqrt(l.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / Math.max(1, l.length - 1)); }
  function n1(x) { return x === undefined || x === null ? '' : x.toFixed(1).replace('.', ','); }
  function n2(x) { return x.toFixed(2).replace('.', ','); }
  function agoraTxt() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() + '_' + d.getHours() + 'h' + d.getMinutes(); }
  function estado(t) { $('estado').textContent = t; }
  function avisar(t) { var d = document.createElement('div'); d.className = 'aviso'; d.textContent = t; $('treinar').insertBefore(d, $('treinar').firstChild); setTimeout(function () { d.remove(); }, 9000); }
  function atualizarTau() {
    var l = cfg.tau.lista; $('tauTxt').textContent = l.length ? Math.round(mediana(l) * 1000) + ' ms (' + l.length + ' golpes)' : 'ainda não';
    var c = cfg.contato[chaveModo()] || []; $('contTxt').textContent = c.length >= 3 ? n2(prioriContato().p0[2]) + ' m de altura (' + c.length + ' golpes)' : 'ainda não';
  }
  setInterval(atualizarTau, 3000); atualizarTau();

  cfg.fat = cfg.fat || { cd: 1, cl: 1 };
  window.TS = { cfg: cfg, lona: lona, contatoNominal: contatoNominal, analisarLona: analisarLona, analisarQuadra: analisarQuadra, camDe: camDe,
                registrarResultado: registrarResultado, pontosDoModo: pontosDoModo, hDoPlano: hDoPlano, regiaoNaLona: regiaoNaLona,
                alturaRedeNaParede: alturaRedeNaParede, alturaNaParedePara: alturaNaParedePara, distAlvo: distAlvo, aviso: aviso,
                prioriEfeito: function () { return prioriEfeito(); }, tauPriori: tauPriori, prioriContato: prioriContato, aprenderContato: aprenderContato, salvar: salvar, desenharAlvo: desenharAlvo, abrirAba: abrirAba };
  montarTipos(); mostrarAviso(); posicionarPalco(); mostrarPontos(); desenharQuadra(); desenharLona();
  if (!calAtual()) estado('Primeiro: aba 📐 Montagem (medidas) e aba 🎯 Calibrar.');
})();
