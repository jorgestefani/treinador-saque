/* Conferir a empunhadura pela câmera, de perto (MediaPipe Hand Landmarker, roda no aparelho).
   1) Referência: a pessoa encosta a palma aberta nas cordas e escorrega até o cabo (é a eastern, face 3).
   2) Depois segura do jeito que quer conferir. O app mede quanto a palma girou em volta do cabo:
      cada face do cabo = 45°. Girar para a borda de cima (sentido da face 2) = continental.
   Assim não importa a posição exata da câmera, só que a raquete continue de pé e virada para o mesmo lado. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  var VERSAO = '0.10.14';
  var URL_LIB = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + VERSAO + '/vision_bundle.mjs';
  var URL_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + VERSAO + '/wasm';
  var URL_MAO = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
  var FACES = { 1: 'backhand', 2: 'continental', 3: 'eastern', 4: 'semiwestern', 5: 'western' };

  function cfg() { return (window.TS && TS.cfg) || { post: { mao: 'd', cam: 'user' } }; }
  function canhoto() { return cfg().post && cfg().post.mao === 'e'; }
  function falar(t) { if (!t) return; if (window.TS && TS.falar) TS.falar(t); else if (window.speechSynthesis) { speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(t); u.lang = 'pt-BR'; speechSynthesis.speak(u); } }

  /* ------------------------------------------------------------------ tela */
  var div = document.createElement('div'); div.id = 'pegada';
  div.style.cssText = 'position:fixed;inset:0;z-index:56;background:#050d0a;display:none;overflow-y:auto;padding:calc(env(safe-area-inset-top) + 8px) 10px 24px';
  div.innerHTML = '<div style="max-width:640px;margin:0 auto">' +
    '<div style="display:flex;align-items:center;margin-bottom:6px"><b style="flex:1;font-size:18px">✋ Conferir a empunhadura</b>' +
    '<button id="pgFechar" style="background:#2b3f37;color:#eef5f1;border:0;border-radius:18px;height:38px;padding:0 14px;font-size:16px">Fechar ✕</button></div>' +
    '<div class="peq" id="pgComo" style="line-height:1.5">Chegue <b>perto do celular</b> (uns 50 cm) e segure a raquete <b>de pé na sua frente, ponta para cima, com a borda virada para o celular</b>.<br>' +
    '<b>1. Referência:</b> encoste a <b>palma aberta nas cordas</b> (como num forehand), escorregue até o cabo sem girar e feche a mão. Segure parado.<br>' +
    '<b>2.</b> Sem girar a raquete, segure do jeito que quer conferir e mostre a mão devagar. Eu digo a face e o nome.</div>' +
    '<div class="lado" style="margin:6px 0"><label>Câmera<br><select id="pgCam"><option value="user">Frontal (você se vê)</option><option value="environment">Traseira</option></select></label></div>' +
    '<div id="pgPalco" style="position:relative;width:100%;background:#000;border-radius:10px;overflow:hidden">' +
    '<video id="pgVideo" playsinline muted autoplay style="position:absolute;inset:0;width:100%;height:100%"></video>' +
    '<canvas id="pgDesenho" style="position:absolute;inset:0;width:100%;height:100%"></canvas>' +
    '<div id="pgGrande" style="position:absolute;left:0;right:0;top:8px;text-align:center;font-size:24px;font-weight:800;text-shadow:0 2px 6px #000"></div></div>' +
    '<div id="pgEstado" class="peq" style="text-align:center;margin-top:6px"></div>' +
    '<button class="bt cinza" id="pgRefazer" style="padding:8px;font-size:15px">↺ Refazer a referência</button>' +
    '<div id="pgRes" style="margin-top:8px"></div>' +
    '<div class="peq" style="margin-top:8px;color:#9db8ab">É uma estimativa pela posição da palma: confira também pelo desenho. Se a raquete girar entre a referência e o teste, refaça a referência. Ainda em teste: me conte se errar.</div></div>';
  document.body.appendChild(div);

  var video = $('pgVideo'), tela = $('pgDesenho'), g = tela.getContext('2d');
  var maos = null, carregando = null, fluxo = null, ativo = false, ts = 0, quadroN = 0;
  var hist = [], fase = 'ref', psiE = null, anunciado = null, candidato = null, candDesde = 0, ultimaFala = 0, ultimaCue = '', inicio = 0;
  function estado(t) { $('pgEstado').textContent = t || ''; }
  function grande(t, cor) { $('pgGrande').textContent = t || ''; $('pgGrande').style.color = cor || '#eef5f1'; }

  function carregar() {
    if (maos) return Promise.resolve();
    if (carregando) return carregando;
    estado('⏳ Carregando o reconhecimento da mão (uns 12 MB, só na primeira vez)…');
    carregando = import(URL_LIB).then(function (V) {
      return V.FilesetResolver.forVisionTasks(URL_WASM).then(function (fs) {
        function criarMao(del) { return V.HandLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: URL_MAO, delegate: del }, runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: 0.4, minHandPresenceConfidence: 0.4, minTrackingConfidence: 0.4 }); }
        return criarMao('GPU').catch(function () { return criarMao('CPU'); }).then(function (m) { maos = m; });
      });
    }).catch(function (e) { carregando = null; throw e; });
    return carregando;
  }

  async function abrir() {
    if (window.Postura && Postura.parar) Postura.parar();
    falar(' ');                                         // libera a voz no iPhone (veio de um toque)
    div.style.display = 'block'; $('pgRes').innerHTML = ''; grande('');
    $('pgCam').value = (cfg().post && cfg().post.pgCam) || 'user';
    try {
      await carregar();
      await ligarCamera();
      ativo = true; comecarRef();
      laço();
    } catch (e) {
      var msg = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'O iPhone bloqueou a câmera. Toque em “aA” → Ajustes do Site → Câmera = Permitir e recarregue.' :
        e && e.name === 'NotReadableError' ? 'A câmera está ocupada (pare o treino ou feche outros apps).' :
        'Não consegui iniciar: ' + ((e && e.message) || e) + '. Confira a internet (a primeira vez baixa o reconhecimento da mão).';
      estado('❌ ' + msg);
    }
  }
  async function ligarCamera() {
    if (fluxo) { fluxo.getTracks().forEach(function (t) { t.stop(); }); fluxo = null; }
    var cam = $('pgCam').value;
    fluxo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: cam, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    video.srcObject = fluxo; video.style.transform = tela.style.transform = cam === 'user' ? 'scaleX(-1)' : '';
    await video.play().catch(function () {});
    await new Promise(function (ok) { if (video.videoWidth) ok(); else video.onloadedmetadata = ok; });
    var vw = video.videoWidth, vh = video.videoHeight, pal = $('pgPalco').style;
    pal.aspectRatio = vw + ' / ' + vh; pal.width = 'min(100%, ' + (60 * vw / vh).toFixed(2) + 'vh)'; pal.margin = '0 auto';
    tela.width = vw; tela.height = vh;
  }
  function comecarRef() {
    hist = []; fase = 'ref'; psiE = null; anunciado = null; candidato = null; inicio = performance.now() / 1000; $('pgRes').innerHTML = ''; $('pgRes').dataset.f = '';
    falar('Chegue perto do celular e segure a raquete de pé, com a borda virada para o celular. Primeiro a referência: encoste a palma aberta nas cordas, como num forehand, escorregue até o cabo sem girar, e feche a mão. Segure parado.');
    ultimaFala = inicio + 9;
    estado('1. Referência: palma nas cordas, escorregue até o cabo e segure parado.');
  }
  function fechar() {
    ativo = false;
    if (fluxo) { fluxo.getTracks().forEach(function (t) { t.stop(); }); fluxo = null; }
    try { video.pause(); } catch (e) {}
    video.srcObject = null; div.style.display = 'none';
    if (window.speechSynthesis) speechSynthesis.cancel();
  }
  function laço() {
    if (!ativo) return;
    var prox = function () { if (!ativo) return; if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(laço); else requestAnimationFrame(laço); };
    if (video.readyState < 2) { prox(); return; }
    var agora = performance.now();
    var t = Math.max(ts + 1, Math.round(agora)); ts = t;          // relógio sempre crescente (exigência do MediaPipe)
    var rm = null; try { rm = maos.detectForVideo(video, t); } catch (e) { }
    quadro(rm, agora / 1000);
    prox();
  }
  /* ------------------------------------------------------------------ a conta */
  function sub(a, b) { return [a.x - b.x, a.y - b.y, a.z - b.z]; }
  function cruz(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  // ângulo da palma em volta do cabo (graus): 0 = palma para o celular, 90 = palma para o lado de dentro (esquerda do destro), 180 = palma para você
  function anguloPalma(w) {
    // a profundidade (z) do modelo da mão cresce para o lado da câmera: invertemos para x direita, y baixo, z longe (conferido em vídeo)
    var s = function (a, b) { return [a.x - b.x, a.y - b.y, b.z - a.z]; };
    var n = cruz(s(w[5], w[0]), s(w[17], w[0]));
    var dirPalma = canhoto() ? n : [-n[0], -n[1], -n[2]];   // mão direita: o produto aponta para as costas da mão
    var x = canhoto() ? -dirPalma[0] : dirPalma[0];
    return Math.atan2(x, -dirPalma[2]) * 180 / Math.PI;
  }
  // girar a mão da face 3 para a 2 (para a borda de cima) diminui o ângulo, no destro e no canhoto
  function face(delta) { var k = 3 + Math.round(delta / 45); return ((k - 1) % 8 + 8) % 8 + 1; }   // 1..8
  function mediana(a) { var b = a.slice().sort(function (x, y) { return x - y; }); return b[b.length >> 1]; }
  function difAng(a, b) { var d = ((a - b) % 360 + 540) % 360 - 180; return d; }

  function quadro(rm, agora) {
    g.clearRect(0, 0, tela.width, tela.height);
    var W = tela.width, H = tela.height;
    var lms = rm && rm.landmarks || [], wls = rm && rm.worldLandmarks || [];
    if (!lms.length) { hist = []; cue('👀', 'Mostre a mão que segura a raquete, perto do celular', agora); return; }
    // a mão maior (mais perto) é a que segura a raquete
    var k = 0, maior = 0;
    lms.forEach(function (l, i) { var s = Math.hypot((l[9].x - l[0].x) * W, (l[9].y - l[0].y) * H); if (s > maior) { maior = s; k = i; } });
    var im = lms[k], w = wls[k];
    desenharMao(im);
    if (maior < 0.12 * H) { hist = []; cue('🔍', 'Chegue mais perto do celular', agora); return; }
    // cabo de pé: a linha dos nós dos dedos (indicador → mindinho) fica mais ou menos na vertical, indicador em cima
    var kx = (im[17].x - im[5].x) * W, ky = (im[17].y - im[5].y) * H, inclin = Math.atan2(Math.abs(kx), ky) * 180 / Math.PI;
    if (inclin > 45) { hist = []; cue('⬆', 'Deixe a raquete de pé, com a ponta para cima', agora); return; }
    var psi = anguloPalma(w);
    hist.push({ t: agora, psi: psi });
    while (hist.length && hist[0].t < agora - 1.2) hist.shift();
    if (hist.length < 6) { grande('…', '#eef5f1'); return; }
    var ref = hist[hist.length - 1].psi, rel = hist.map(function (h) { return difAng(h.psi, ref); }), med = ref + mediana(rel);
    var espalhado = rel.some(function (r) { return Math.abs(r - mediana(rel)) > 28; });
    if (espalhado) { grande('✋ segure parado…', '#facc15'); return; }
    if (fase === 'ref') {
      if (candidato !== 'ref') { candidato = 'ref'; candDesde = agora; }
      grande('✋ segure… ' + Math.max(1, Math.ceil(2 - (agora - candDesde))), '#22c55e');
      if (agora - inicio > 6 && agora - candDesde > 2) {
        if (med < 20 || med > 160) { candidato = null; hist = []; cue('↻', 'Deixe a borda da raquete virada para o celular, com a palma nas cordas', agora); return; }
        psiE = med; fase = 'medir'; hist = []; candidato = null; anunciado = null;
        falar('Pronto, essa é a eastern, face três. Agora, sem girar a raquete, segure do jeito que quer conferir e mostre a mão devagar.'); ultimaFala = agora + 5;
        estado('2. Segure do jeito que quer conferir.'); grande('✓ referência', '#22c55e');
      }
      return;
    }
    var delta = difAng(med, psiE), f = face(delta);
    if (candidato !== f) { candidato = f; candDesde = agora; }
    mostrar(f, delta);
    if (agora - candDesde > 1.2 && anunciado !== f && agora - ultimaFala > 2.5) { anunciar(f); anunciado = f; ultimaFala = agora; }
  }
  function nomeFace(f) {
    var e = FACES[f] && window.Empunhadura && Empunhadura.G[FACES[f]];
    return e ? e.nome : null;
  }
  function correcao(f) {
    if (f === 2) return '';
    // da face 3 para a 2 a palma vira para o lado do celular (ângulo diminui)
    if (f >= 3 && f <= 5) return 'Para o saque, gire a mão no cabo ' + (f === 3 ? 'um pouco' : 'bem mais') + ', virando a palma para o lado do celular, até a face 2.';
    if (f === 1) return 'Para o saque, gire a mão no cabo um pouco, virando a palma de volta para o lado, até a face 2.';
    return '';
  }
  function mostrar(f, psi) {
    var nome = nomeFace(f), ok = f === 2;
    grande(nome ? (ok ? '✓ ' : '') + 'Face ' + f + ': ' + nome : 'Face ' + f + '?', ok ? '#22c55e' : nome ? '#facc15' : '#f87171');
    var chave = FACES[f];
    if ($('pgRes').dataset.f !== String(f)) {
      $('pgRes').dataset.f = String(f);
      $('pgRes').innerHTML = chave && window.Empunhadura ? Empunhadura.cartao(chave, '<div style="margin-top:8px;font-size:16px;color:' + (ok ? '#22c55e' : '#facc15') + '">' + (ok ? '✓ Continental: a empunhadura certa para o saque.' : correcao(f)) + '</div>') :
        '<div class="cartao">Face ' + f + ': posição incomum. Confira se a raquete não girou desde a referência (se girou, toque em Refazer a referência) e se escolheu destro ou canhoto certo na aba Posição.</div>';
      if (chave && window.Empunhadura) Empunhadura.desenharTodos($('pgRes'));
    }
    estado('Giro da mão desde a referência: ' + Math.round(psi) + '° (continental ≈ −45°, eastern = 0°, semi-western ≈ +45°).');
  }
  function anunciar(f) {
    var nome = nomeFace(f);
    if (!nome) { falar('Não reconheci. Se a raquete girou, refaça a referência.'); return; }
    falar('Face ' + f + ': ' + nome + '. ' + (f === 2 ? 'Certo para o saque!' : correcao(f)));
  }
  function cue(s, t, agora) {
    grande(s + ' ' + t, '#facc15'); candidato = null;
    if (agora - inicio > 5 && agora - ultimaFala > 3.5 && (t !== ultimaCue || agora - ultimaFala > 7)) { falar(t); ultimaFala = agora; ultimaCue = t; }
  }
  var DEDOS = [[0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [5, 9, 10, 11, 12], [9, 13, 14, 15, 16], [13, 17, 18, 19, 20], [0, 17]];
  function desenharMao(p) {
    var W = tela.width, H = tela.height; g.lineWidth = Math.max(3, W / 300); g.strokeStyle = '#22c55e';
    DEDOS.forEach(function (d) { g.beginPath(); d.forEach(function (i, j) { if (j) g.lineTo(p[i].x * W, p[i].y * H); else g.moveTo(p[i].x * W, p[i].y * H); }); g.stroke(); });
    [[5, '#facc15'], [0, '#f472b6']].forEach(function (q) { g.fillStyle = q[1]; g.beginPath(); g.arc(p[q[0]].x * W, p[q[0]].y * H, Math.max(7, W / 120), 0, 7); g.fill(); });
  }

  $('pgFechar').onclick = fechar;
  $('pgRefazer').onclick = function () { if (ativo) comecarRef(); };
  $('pgCam').onchange = function () { var c = cfg(); if (c.post) { c.post.pgCam = this.value; if (window.TS && TS.salvar) TS.salvar(); } if (ativo) ligarCamera(); };
  window.Pegada = { abrir: abrir, fechar: fechar, anguloPalma: anguloPalma, face: face };
})();
