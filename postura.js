/* Posição do saque: a câmera reconhece o corpo (MediaPipe Pose, roda no próprio aparelho) e
   1) GUIA posição por posição, falando o que corrigir;
   2) na TENTATIVA (jogando a bola, com ou sem bater) acha o toss, o troféu e o impulso e diz o que errou;
   3) também analisa um vídeo já gravado.
   Pontos do MediaPipe: 0 nariz · 11/12 ombros · 13/14 cotovelos · 15/16 punhos · 23/24 quadris · 25/26 joelhos · 27/28 tornozelos · 29/30 calcanhares · 31/32 pontas dos pés
   (11, 13, 15, 23, 25, 27… = lado ESQUERDO da pessoa). */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  var VERSAO = '0.10.14';
  var URL_LIB = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + VERSAO + '/vision_bundle.mjs';
  var URL_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + VERSAO + '/wasm';
  var URL_MODELO = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';

  var cfg = (window.TS && TS.cfg) || {};
  cfg.post = cfg.post || { mao: 'd', cam: 'environment' };
  function salvar() { if (window.TS) TS.salvar(); }
  function alt() { return (cfg.jog && cfg.jog.alt) || 1.80; }
  function falar(t) { if (!t) return; if (window.TS && TS.falar) TS.falar(t); else if (window.speechSynthesis) { speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(t); u.lang = 'pt-BR'; speechSynthesis.speak(u); } }
  function n2(x) { return x.toFixed(2).replace('.', ','); }

  /* ------------------------------------------------------------------ tela */
  var sec = document.createElement('section'); sec.id = 'postura';
  sec.innerHTML =
    '<div class="cartao"><h2>🧍 Posição do saque</h2>' +
    '<div class="peq">O celular reconhece o seu corpo e confere as posições do saque: de lado, toss com o braço esticado, troféu, joelhos e impulso. ' +
    'Tudo roda no aparelho; nenhuma imagem sai dele.</div>' +
    '<details style="margin-top:6px"><summary class="peq" style="color:#eef5f1">📱 Como pôr o celular: de frente para você (toque para ver)</summary><div class="peq" style="line-height:1.55">' +
    '• Fique <b>de frente para o celular</b>: na posição de saque você fica de lado para a rede, então o celular vai do lado para onde o seu peito aponta.<br>' +
    '• Celular <b>em pé</b> (retrato) no tripé, a uns <b>3 a 4 m</b>, na altura da cintura.<br>' +
    '• No quadro: o corpo inteiro, <b>com os pés</b>, e mais <b>1,5 m acima da cabeça</b>, para o app ver o toss.<br>' +
    '• Boa luz, sem ninguém passando atrás. Bola amarela de tênis.</div></details>' +
    '<div class="lado" style="margin-top:8px">' +
    '<label>Você é<br><select id="poMao"><option value="d">Destro</option><option value="e">Canhoto</option></select></label>' +
    '<label>Câmera<br><select id="poCam"><option value="environment">Traseira (melhor)</option><option value="user">Frontal (você se vê)</option></select></label></div>' +
    '<button id="poGuiado" class="bt verde">🧭 Guiado: posição por posição</button>' +
    '<button id="poTentar" class="bt verde">🎾 Tentativa: faça o movimento jogando a bola</button>' +
    '<button id="poArquivo" class="bt cinza" style="padding:10px;font-size:15px">📂 Analisar um vídeo gravado</button>' +
    '<input type="file" id="poArq" accept="video/*" style="display:none">' +
    '<button id="poParar" class="bt vermelho" style="display:none">⏹ Parar</button>' +
    '<div id="poEstado" class="peq" style="text-align:center">Escolha um modo.</div></div>' +
    '<div class="cartao" id="poPassoC" style="display:none"><div style="display:flex;gap:10px;align-items:center">' +
    '<canvas id="poIdeal" width="240" height="300" style="width:120px;height:150px;background:#0a1712;border-radius:8px;flex:none"></canvas>' +
    '<div style="flex:1"><div id="poPasso" style="font-size:19px;font-weight:700"></div><div id="poDica" style="color:#facc15;font-size:17px;margin-top:6px"></div></div></div>' +
    '<div id="poLista" class="pontos"></div></div>' +
    '<div id="poPalco" style="position:relative;width:100%;background:#000;border-radius:10px;overflow:hidden;display:none">' +
    '<video id="poVideo" playsinline muted autoplay style="position:absolute;inset:0;width:100%;height:100%"></video>' +
    '<canvas id="poDesenho" style="position:absolute;inset:0;width:100%;height:100%"></canvas>' +
    '<div id="poGrande" style="position:absolute;left:0;right:0;top:8px;text-align:center;font-size:24px;font-weight:800;text-shadow:0 2px 6px #000"></div></div>' +
    '<div class="cartao" id="poRes" style="display:none"><h2>📋 Última tentativa</h2>' +
    '<div style="display:flex;gap:8px;justify-content:center"><div style="text-align:center"><canvas id="poFoto" style="max-width:100%;height:260px;border-radius:8px;background:#000"></canvas><div class="peq">você no troféu</div></div>' +
    '<div style="text-align:center"><canvas id="poFotoIdeal" width="220" height="520" style="height:260px;border-radius:8px;background:#0a1712"></canvas><div class="peq">o troféu ideal</div></div></div>' +
    '<div id="poRepC" style="display:none;margin-top:10px"><b>🔁 Replay do contato (câmera lenta)</b>' +
    '<div class="peq">Veja a <b>pronação</b>: depois do contato, a palma da mão da raquete vira para fora e o polegar aponta para baixo. ' +
    'A câmera não mede esse giro com segurança, então confira você mesmo. O braço da raquete aparece em amarelo.</div>' +
    '<canvas id="poReplay" style="width:100%;max-width:420px;display:block;margin:6px auto;border-radius:8px;background:#000"></canvas>' +
    '<div class="lado"><button class="bt cinza" id="poRepLento" style="padding:8px;font-size:15px">🐢 ¼ da velocidade</button><button class="bt cinza" id="poRepPausa" style="padding:8px;font-size:15px">⏸ Pausar</button></div></div>' +
    '<div id="poTab" style="margin-top:8px"></div></div>';
  document.body.insertBefore(sec, $('ajustes'));
  var bt = document.createElement('button'); bt.dataset.aba = 'postura'; bt.textContent = '🧍 Posição';
  $('abas').insertBefore(bt, $('abas').children[1]);
  bt.onclick = function () { TS.abrirAba('postura'); };
  [].forEach.call(document.querySelectorAll('#abas button'), function (b) { b.addEventListener('click', function () { if (b.dataset.aba !== 'postura') parar(); }); });
  $('poMao').value = cfg.post.mao; $('poCam').value = cfg.post.cam;
  $('poMao').onchange = function () { cfg.post.mao = this.value; salvar(); };
  $('poCam').onchange = function () { cfg.post.cam = this.value; salvar(); if (fluxo) { var m = modo; parar(); iniciar(m); } };

  /* ------------------------------------------------------------------ reconhecimento do corpo */
  var lm = null, carregando = null;
  function carregar() {
    if (lm) return Promise.resolve(lm);
    if (carregando) return carregando;
    estado('⏳ Carregando o reconhecimento do corpo (uns 10 MB, só na primeira vez)…');
    carregando = import(URL_LIB).then(function (V) {
      return V.FilesetResolver.forVisionTasks(URL_WASM).then(function (fs) {
        function criar(del) {
          return V.PoseLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: URL_MODELO, delegate: del }, runningMode: 'VIDEO', numPoses: 1,
            minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
        }
        return criar('GPU').catch(function () { return criar('CPU'); });
      });
    }).then(function (x) { lm = x; return x; }, function (e) { carregando = null; throw e; });
    return carregando;
  }

  /* ------------------------------------------------------------------ medidas de cada quadro */
  function v3(w, i) { return [w[i].x, -w[i].y, w[i].z]; }                         // mundo: metros, y para cima
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function nor(a) { return Math.sqrt(dot(a, a)) || 1e-9; }
  function angulo(a, b, c) { var u = sub(a, b), v = sub(c, b); return Math.acos(Math.max(-1, Math.min(1, dot(u, v) / nor(u) / nor(v)))) * 180 / Math.PI; }
  function media(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; }
  // lados: 'E' = esquerdo da pessoa. Para o destro, o braço da bola (toss) é o esquerdo e o pé da frente também.
  var IDX = { E: { om: 11, co: 13, pu: 15, qu: 23, jo: 25, to: 27, ca: 29, pe: 31 }, D: { om: 12, co: 14, pu: 16, qu: 24, jo: 26, to: 28, ca: 30, pe: 32 } };
  function medir(w, ladoBola, im) {
    var B = IDX[ladoBola], R = IDX[ladoBola === 'E' ? 'D' : 'E'];
    var nariz = v3(w, 0), omB = v3(w, B.om), omR = v3(w, R.om), coB = v3(w, B.co), coR = v3(w, R.co), puB = v3(w, B.pu), puR = v3(w, R.pu);
    var quF = v3(w, B.qu), quT = v3(w, R.qu), joF = v3(w, B.jo), joT = v3(w, R.jo), toF = v3(w, B.to), toT = v3(w, R.to);
    var joelhoF = angulo(quF, joF, toF), joelhoT = angulo(quT, joT, toT);
    var hor = function (a) { return [a[0], 0, a[2]]; };
    var linhaOmb = hor(sub(omB, omR)), linhaPes = hor(sub(toF, toT));
    var lado = Math.acos(Math.min(1, Math.abs(dot(linhaOmb, linhaPes)) / nor(linhaOmb) / nor(linhaPes))) * 180 / Math.PI;
    var quadril = media(quF, quT), pp = sub(toF, toT), tPeso = dot(sub(quadril, toT), pp) / Math.max(1e-6, dot(pp, pp));
    var cima = [0, 1, 0], braco = sub(puB, omB);
    // na imagem (de frente o braço que sobe aparece bem): cotovelo 2D e quanto o punho está à frente do ombro, para o lado da rede
    var cot2 = null, frente = null;
    if (im) {
      var a2 = im[B.om], b2 = im[B.co], c2 = im[B.pu];
      if (a2.v > 0.5 && b2.v > 0.5 && c2.v > 0.5) { var ux = a2.x - b2.x, uy = a2.y - b2.y, vx = c2.x - b2.x, vy = c2.y - b2.y; cot2 = Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy) || 1)))) * 180 / Math.PI; }
      var pF = im[B.pe], pT = im[R.pe], chao = Math.max(im[29].y, im[30].y), pxm = (chao - im[0].y) / (0.92 * alt());
      if (pxm > 5 && Math.abs(pF.x - pT.x) > 0.15 * pxm) frente = (c2.x - a2.x) * Math.sign(pF.x - pT.x) / pxm;
    }
    return {
      bolaCot2: cot2, frente: frente,
      joelho: 180 - Math.min(joelhoF, joelhoT),                      // quanto dobrou (0 = esticado)
      bolaCot: Math.max(angulo(omB, coB, puB), cot2 || 0),            // 180 = braço da bola esticado (o melhor entre 3D e 2D)
      bolaVert: Math.acos(Math.max(-1, Math.min(1, dot(braco, cima) / nor(braco)))) * 180 / Math.PI,   // 0 = apontando para o céu
      bolaAcima: puB[1] - nariz[1],                                   // punho da bola acima do nariz (m)
      racCot: angulo(omR, coR, puR),                                  // ângulo do braço da raquete (90 = L)
      racCotAlt: coR[1] - omR[1],                                     // cotovelo da raquete acima do ombro (m)
      racAcima: puR[1] - nariz[1],
      incl: omB[1] - omR[1],                                          // ombro da bola mais alto que o da raquete (m)
      lado: lado,                                                     // 0 = ombros na linha dos pés (de lado)
      pes: nor(linhaPes),                                             // distância entre os pés (m)
      peso: tPeso,                                                    // 0 = sobre o pé de trás, 1 = sobre o da frente
      quadrilAlt: quadril[1] - Math.min(toF[1], toT[1]),              // altura do quadril sobre o tornozelo mais baixo
      maxPunho: Math.max(puB[1], puR[1]) - nariz[1],
      linha: linha2D(im, B, R) !== null ? linha2D(im, B, R) : Math.acos(Math.max(-1, Math.min(1, dot(sub(omR, coR), sub(omB, omR)) / nor(sub(omR, coR)) / nor(sub(omB, omR))))) * 180 / Math.PI   // 0 = cotovelo da raquete na linha dos ombros
    };
  }
  // na imagem (melhor que o 3D para quem está de frente): o cotovelo da raquete na linha dos ombros
  // = ângulo entre cotovelo da raquete→ombro da raquete e ombro da raquete→ombro da bola (0 = alinhados)
  function linha2D(im, B, R) {
    if (!im) return null; var c = im[R.co], o = im[R.om], p = im[B.om]; if (c.v < 0.5 || o.v < 0.5 || p.v < 0.5) return null;
    var ux = o.x - c.x, uy = o.y - c.y, vx = p.x - o.x, vy = p.y - o.y, n = Math.hypot(ux, uy) * Math.hypot(vx, vy) || 1;
    return Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / n))) * 180 / Math.PI;
  }
  // orientação da mão da raquete em volta do antebraço (graus). Pontos da mão: 17/18 mindinho, 19/20 indicador.
  // A diferença entre o troféu e a finalização mostra a pronação (a palma vira para fora, o polegar para baixo).
  function giroMao(w, lb) {
    // giro do antebraço medido em relação ao BRAÇO (plano do cotovelo): é a definição anatômica de pronação/supinação
    // e não depende para onde o braço aponta. Precisa do cotovelo um pouco dobrado (> 20°).
    var R = lb === 'E' ? { om: 12, co: 14, pu: 16, mi: 18, ind: 20 } : { om: 11, co: 13, pu: 15, mi: 17, ind: 19 };
    var om = v3(w, R.om), co = v3(w, R.co), pu = v3(w, R.pu), f = sub(pu, co), nf = nor(f); f = [f[0] / nf, f[1] / nf, f[2] / nf];
    function perp(v) { var k = dot(v, f); return [v[0] - k * f[0], v[1] - k * f[1], v[2] - k * f[2]]; }
    var ref = perp(sub(co, om));                       // direção do braço, sem a parte ao longo do antebraço
    if (nor(ref) < 0.35 * nor(sub(co, om))) return null;   // braço quase esticado: giro indefinido
    var hm = perp(sub(v3(w, R.ind), v3(w, R.mi)));
    var cr = [ref[1] * hm[2] - ref[2] * hm[1], ref[2] * hm[0] - ref[0] * hm[2], ref[0] * hm[1] - ref[1] * hm[0]];
    return Math.atan2(dot(cr, f), dot(ref, hm)) * 180 / Math.PI;
  }
  function ladoBolaPadrao() { return cfg.post.mao === 'e' ? 'D' : 'E'; }

  /* ------------------------------------------------------------------ câmera / vídeo e laço */
  var video = $('poVideo'), tela = $('poDesenho'), gt = tela.getContext('2d');
  var fluxo = null, ativo = false, modo = null, deArquivo = false, ultimoTs = -1, tsGlobal = 0, tsDesloc = null;   // o MediaPipe exige relógio sempre crescente
  var proc = document.createElement('canvas'), pctx = proc.getContext('2d', { willReadFrequently: true }), anterior = null;
  var hist = [];   // {t, w (mundo), im (imagem, px de proc), bola:[x,y]|null, foto: canvas pequeno}
  function estado(t) { $('poEstado').textContent = t; }
  function grande(t, cor) { $('poGrande').textContent = t || ''; $('poGrande').style.color = cor || '#eef5f1'; }

  async function iniciar(m) {
    try {
      if (window.TS && TS.falar) TS.falar(' ');           // libera a voz no iPhone (precisa de toque)
      parar(); deArquivo = m === 'arquivo' || m === 'guiadoArquivo'; if (m === 'guiadoArquivo') m = 'guiado'; modo = m;
      await carregar();
      if (!deArquivo) {
        fluxo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: cfg.post.cam, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, audio: false });
        video.srcObject = fluxo; video.style.transform = cfg.post.cam === 'user' ? 'scaleX(-1)' : ''; tela.style.transform = video.style.transform;
      } else video.style.transform = tela.style.transform = '';
      $('poPalco').style.display = ''; $('poParar').style.display = '';
      await video.play().catch(function () {});
      await new Promise(function (ok) { if (video.videoWidth) ok(); else video.onloadedmetadata = ok; });
      var vw = video.videoWidth, vh = video.videoHeight, pal = $('poPalco').style;      // palco com a mesma proporção do vídeo (o esqueleto cai no lugar certo)
      pal.height = 'auto'; pal.aspectRatio = vw + ' / ' + vh; pal.width = 'min(100%, ' + (72 * vw / vh).toFixed(2) + 'vh)'; pal.margin = '0 auto';
      tela.width = video.videoWidth; tela.height = video.videoHeight;
      var esc = Math.min(1, 480 / Math.max(video.videoWidth, video.videoHeight)); proc.width = Math.round(video.videoWidth * esc); proc.height = Math.round(video.videoHeight * esc);
      anterior = null; hist = []; ultimoTs = -1; tsDesloc = null; tentativa = null; ativo = true;
      if (m === 'guiado') comecarGuia();
      if (m === 'tentar') { $('poPassoC').style.display = 'none'; falar('Pode começar. Faça o movimento do saque jogando a bola. Eu analiso cada tentativa.'); estado('🎾 Faça o movimento jogando a bola. Eu analiso cada tentativa.'); }
      if (deArquivo && m !== 'guiado') { $('poPassoC').style.display = 'none'; video.playbackRate = 0.5; estado('📂 Analisando o vídeo em câmera lenta…'); video.onended = function () { fecharTentativa(true); estado('✅ Fim do vídeo.'); }; }
      laço();
    } catch (e) {
      ativo = false;
      var msg = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'O iPhone bloqueou a câmera. Toque em “aA” → Ajustes do Site → Câmera = Permitir e recarregue.' :
        e && e.name === 'NotReadableError' ? 'A câmera está ocupada (pare o treino na aba Treinar ou feche outros apps).' :
        'Não consegui iniciar: ' + ((e && e.message) || e) + '. Confira a internet (a primeira vez baixa o reconhecimento do corpo).';
      estado('❌ ' + msg);
    }
  }
  function parar() {
    ativo = false; modo = null;
    if (fluxo) { fluxo.getTracks().forEach(function (t) { t.stop(); }); fluxo = null; }
    try { video.pause(); } catch (e) {}
    if (video.srcObject) video.srcObject = null;
    $('poParar').style.display = 'none'; grande('');
    if (window.speechSynthesis) speechSynthesis.cancel();
  }
  function laço() {
    if (!ativo) return;
    var proximo = function () { if (!ativo) return; if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(laço); else requestAnimationFrame(laço); };
    if (video.readyState < 2 || video.paused && !deArquivo) { proximo(); return; }
    var t = deArquivo ? video.currentTime : performance.now() / 1000, bruto = Math.round(t * 1000);
    if (bruto <= ultimoTs) { proximo(); return; }
    ultimoTs = bruto;
    if (tsDesloc === null) tsDesloc = Math.max(0, tsGlobal + 40 - bruto);
    var ts = bruto + tsDesloc; if (ts <= tsGlobal) ts = tsGlobal + 1; tsGlobal = ts;
    var res = null; try { res = lm.detectForVideo(video, ts); } catch (e) { }
    quadro(t, res);
    proximo();
  }

  /* ------------------------------------------------------------------ cada quadro */
  function quadro(t, res) {
    gt.clearRect(0, 0, tela.width, tela.height);
    var w = res && res.worldLandmarks && res.worldLandmarks[0], im = res && res.landmarks && res.landmarks[0];
    // a imagem pequena serve para achar a bola e para a foto do troféu
    pctx.drawImage(video, 0, 0, proc.width, proc.height);
    var foto = document.createElement('canvas'); foto.width = proc.width >> 1; foto.height = proc.height >> 1; foto.getContext('2d').drawImage(proc, 0, 0, foto.width, foto.height);
    if (!w || !im) { if (modo === 'guiado') guia(null, t); hist.push({ t: t, w: null }); limpar(t); return; }
    var imp = im.map(function (p) { return { x: p.x * proc.width, y: p.y * proc.height, v: p.visibility === undefined ? 1 : p.visibility }; });
    var bola = modo !== 'guiado' ? acharBola(imp) : null;
    var mao = modo !== 'guiado' ? recorteBraco(imp) : null;
    hist.push({ t: t, w: w, im: imp, bola: bola, foto: foto, mao: mao });
    limpar(t);
    esqueleto(gt, imp, tela.width / proc.width, tela.height / proc.height, null);
    if (bola) { gt.strokeStyle = '#facc15'; gt.lineWidth = 4; gt.beginPath(); gt.arc(bola[0] * tela.width / proc.width, bola[1] * tela.height / proc.height, 16, 0, 7); gt.stroke(); }
    if (modo === 'guiado') guia(w, t, imp); else acompanhar(t);
  }
  // recorte em boa resolução em volta do braço da raquete (para o replay da pronação)
  function recorteBraco(p) {
    var R = IDX[ladoBolaPadrao() === 'E' ? 'D' : 'E'], sx = video.videoWidth / proc.width, sy = video.videoHeight / proc.height;
    var cx = (p[R.pu].x + p[R.co].x) / 2 * sx, cy = (p[R.pu].y + p[R.co].y) / 2 * sy;
    var lado = Math.max(80, Math.abs(p[0].y - p[R.qu].y) * sy * 1.1);
    var x0 = Math.max(0, Math.min(video.videoWidth - lado, cx - lado / 2)), y0 = Math.max(0, Math.min(video.videoHeight - lado, cy - lado / 2));
    var c = document.createElement('canvas'); c.width = c.height = 200; c.getContext('2d').drawImage(video, x0, y0, lado, lado, 0, 0, 200, 200);
    return { c: c, x0: x0 / sx, y0: y0 / sy, lado: lado / sx };   // em px da imagem de análise
  }
  function limpar(t) {   // guarda 7 s de pontos e só 5 s de fotos (memória do iPhone)
    while (hist.length && hist[0].t < t - 7) hist.shift();
    for (var i = 0; i < hist.length && hist[i].t < t - 5; i++) { hist[i].foto = null; hist[i].mao = null; }
  }
  var OSSOS = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32], [27, 29], [28, 30]];
  function esqueleto(g, p, sx, sy, cores) {
    g.lineWidth = Math.max(3, 4 * sx); g.lineCap = 'round';
    OSSOS.forEach(function (o) {
      var a = p[o[0]], b = p[o[1]]; if (a.v < 0.4 || b.v < 0.4) return;
      g.strokeStyle = (cores && cores[o[0] + '-' + o[1]]) || (o[0] % 2 ? '#22c55e' : '#38bdf8');
      g.beginPath(); g.moveTo(a.x * sx, a.y * sy); g.lineTo(b.x * sx, b.y * sy); g.stroke();
    });
    [0, 13, 14, 15, 16, 25, 26].forEach(function (i) { var a = p[i]; if (a.v < 0.4) return; g.fillStyle = '#facc15'; g.beginPath(); g.arc(a.x * sx, a.y * sy, Math.max(4, 5 * sx), 0, 7); g.fill(); });
  }

  /* ------------------------------------------------------------------ bola amarela (só acima dos ombros, e que se mexeu) */
  function acharBola(p) {
    var x0 = Math.min(p[11].x, p[12].x), x1 = Math.max(p[11].x, p[12].x), ombroY = Math.min(p[11].y, p[12].y);
    var corpo = Math.max(30, Math.abs(Math.max(p[29].y, p[30].y) - p[0].y));     // altura nariz→calcanhar em px
    var X0 = Math.max(0, Math.floor(x0 - corpo * 0.8)), X1 = Math.min(proc.width, Math.ceil(x1 + corpo * 0.8)), Y1 = Math.max(1, Math.min(proc.height, Math.ceil(ombroY)));
    var img = pctx.getImageData(0, 0, proc.width, proc.height).data;
    var antes = anterior; anterior = img;
    if (!antes || antes.length !== img.length) return null;
    var CEL = 4, cw = Math.ceil(proc.width / CEL), cont = {}, melhor = null;
    for (var y = 0; y < Y1; y++) for (var x = X0; x < X1; x++) {
      var k = (y * proc.width + x) * 4, r = img[k], gg = img[k + 1], b = img[k + 2];
      if (gg > 90 && gg - b > 45 && r > 0.55 * gg && r < 1.3 * gg && (Math.abs(gg - antes[k + 1]) + Math.abs(r - antes[k])) > 30) {
        var c = ((y / CEL) | 0) * cw + ((x / CEL) | 0), q = cont[c] || (cont[c] = { n: 0, x: 0, y: 0 }); q.n++; q.x += x; q.y += y;
      }
    }
    Object.keys(cont).forEach(function (c) {      // junta a célula com as 8 vizinhas
      c = +c; var s = { n: 0, x: 0, y: 0 };
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { var q = cont[c + dy * cw + dx]; if (q) { s.n += q.n; s.x += q.x; s.y += q.y; } }
      if (!melhor || s.n > melhor.n) melhor = s;
    });
    if (!melhor || melhor.n < 3 || melhor.n > 220) return null;
    return [melhor.x / melhor.n, melhor.y / melhor.n];
  }

  /* ------------------------------------------------------------------ modo guiado */
  var PASSOS = [
    { id: 'quadro', nome: 'Corpo inteiro', pose: 'parado', fala: 'Fique de frente para o celular, de corpo inteiro na imagem, com os pés aparecendo, a uns três ou quatro metros.',
      ok: function (f, inteiro) { return inteiro; }, dica: function () { return 'Não vejo o corpo inteiro. Afaste-se ou incline o celular.'; }, cue: function (f, inteiro) { return inteiro ? null : { s: '↔', t: 'Afaste-se: quero ver dos pés à cabeça' }; } },
    { id: 'lado', nome: 'De lado', pose: 'parado', fala: 'Fique de lado para a rede: o pé da frente apontando para o poste da rede, e o pé de trás paralelo à linha de fundo.',
      ok: function (f) { return f.lado < 45 && f.pes > 0.25; }, dica: function (f) { return f.pes <= 0.25 ? 'Afaste mais os pés, uns dois palmos.' : 'Vire mais de lado: os ombros na mesma linha dos pés.'; }, cue: function (f) { return f.pes <= 0.25 ? { s: '↔', t: 'Afaste mais os pés' } : f.lado >= 45 ? { s: '↻', t: 'Vire mais de lado', m: 'ombros × pés ' + Math.round(f.lado) + '° → 45°' } : null; } },
    { id: 'peso', nome: 'Peso atrás', pose: 'peso', fala: 'Ponha o peso no pé de trás, com a bola e a raquete juntas à sua frente.',
      ok: function (f) { return f.peso < 0.45; }, dica: function () { return 'Jogue o peso para o pé de trás.'; }, cue: function (f) { return f.peso < 0.45 ? null : { s: '⬅', t: 'Peso no pé de trás' }; } },
    { id: 'braco', nome: 'Braço da bola', pose: 'solta', fala: 'Agora suba o braço da bola, bem esticado, até apontar para o céu. Segure aí.',
      ok: function (f) { return f.bolaCot > 150 && f.bolaVert < 32 && f.bolaAcima > 0.12; },
      dica: function (f) { return f.bolaCot <= 150 ? 'Estique o braço da bola, sem dobrar o cotovelo.' : 'Suba mais o braço da bola, apontando para cima.'; }, cue: function (f) { return f.bolaAcima <= 0.12 ? { s: '⬆', t: 'Mais alto', m: 'mão ' + Math.round(f.bolaAcima * 100) + ' cm acima do nariz → 12 cm' } : f.bolaCot <= 150 ? { s: '↕', t: 'Estique o cotovelo', m: 'cotovelo ' + Math.round(f.bolaCot) + '° → 150°' } : f.bolaVert >= 32 ? (f.frente !== null && f.frente < 0 ? { s: '➡', t: 'Mais à frente, para o lado da rede' } : { s: '⬆', t: 'Mais para cima', m: Math.round(f.bolaVert) + '° da vertical → 32°' }) : null; } },
    { id: 'trofeu', nome: 'Troféu', pose: 'trofeu', segurar: 3, fala: 'Com o braço da bola no alto, leve a raquete para trás: cotovelo na altura do ombro, formando um L, e na mesma linha dos ombros. Segure três segundos.',
      ok: function (f) { return f.racCotAlt > -0.13 && f.racCotAlt < 0.22 && f.racCot > 55 && f.racCot < 135 && f.bolaVert < 40 && f.linha < 35; },
      dica: function (f) { return f.bolaVert >= 40 ? 'Mantenha o braço da bola lá no alto.' : f.racCotAlt <= -0.13 ? 'Suba o cotovelo da raquete até a altura do ombro.' : f.racCotAlt >= 0.22 ? 'O cotovelo da raquete subiu demais: deixe na altura do ombro.' :
        f.racCot >= 135 ? 'Dobre o braço da raquete, em L.' : f.racCot <= 55 ? 'Abra um pouco o braço da raquete, em L.' : 'Alinhe o cotovelo da raquete com a linha dos ombros.'; }, cue: function (f) { return f.bolaVert >= 40 ? { s: '⬆', t: 'Braço da bola lá no alto' } : f.racCotAlt <= -0.13 ? { s: '⬆', t: 'Suba o cotovelo da raquete', m: Math.round(-f.racCotAlt * 100) + ' cm abaixo do ombro' } : f.racCotAlt >= 0.22 ? { s: '⬇', t: 'Cotovelo um pouco mais baixo' } : f.racCot >= 135 ? { s: '↙', t: 'Dobre o braço da raquete em L', m: Math.round(f.racCot) + '° → 90 a 135°' } : f.racCot <= 55 ? { s: '↗', t: 'Abra um pouco o braço da raquete' } : f.linha >= 35 ? { s: '↔', t: 'Cotovelo na linha dos ombros', m: Math.round(f.linha) + '° → 35°' } : null; } },
    { id: 'joelhos', nome: 'Joelhos', pose: 'trofeu', fala: 'Mantenha o troféu e dobre os joelhos.',
      ok: function (f, inteiro) { return inteiro && f.joelho >= 25 && f.racCotAlt > -0.14; }, dica: function (f, inteiro) { return !inteiro ? 'Deixe os pés aparecerem na imagem.' : f.joelho < 25 ? 'Dobre mais os joelhos.' : 'Sem baixar o cotovelo da raquete.'; }, cue: function (f, inteiro) { return !inteiro ? { s: '⬇', t: 'Deixe os pés aparecerem' } : f.joelho < 25 ? { s: '⬇', t: 'Dobre mais os joelhos', m: 'joelhos ' + Math.round(f.joelho) + '° → 25°' } : f.racCotAlt <= -0.14 ? { s: '⬆', t: 'Sem baixar o cotovelo' } : null; } },
    { id: 'ombro', nome: 'Ombros', pose: 'trofeu', fala: 'Incline o corpo: o ombro do braço da bola fica mais alto que o ombro da raquete.',
      ok: function (f) { return f.incl > 0.05; }, dica: function () { return 'Suba o ombro do braço da bola e abaixe o da raquete.'; }, cue: function (f) { return f.incl > 0.05 ? null : { s: '↗', t: 'Suba o ombro do braço da bola', m: Math.round(f.incl * 100) + ' cm → 5 cm' }; } },
    { id: 'contato', nome: 'Contato', pose: 'contato', fala: 'Agora estique as pernas e suba a raquete até o ponto de contato, com o braço todo esticado, bem no alto.',
      ok: function (f) { return f.racCot > 150 && f.racAcima > 0.25 && f.joelho < 18; },
      dica: function (f) { return f.joelho >= 18 ? 'Estique as pernas.' : 'Estique o braço da raquete, bem no alto.'; }, cue: function (f) { return f.joelho >= 18 ? { s: '⬆', t: 'Estique as pernas' } : f.racCot <= 150 ? { s: '↕', t: 'Estique o braço da raquete', m: Math.round(f.racCot) + '° → 150°' } : f.racAcima <= 0.25 ? { s: '⬆', t: 'Raquete mais alta' } : null; } }
  ];
  var passo = 0, desde = 0, ultimaDica = 0, okDesde = 0, ultimaFala = 0, ultimaCue = '';
  function comecarGuia() {
    passo = 0; okDesde = 0; $('poPassoC').style.display = ''; mostrarPasso(); falar(PASSOS[0].fala);
    estado('🧭 Siga a voz. Quando a posição estiver certa por um instante, eu passo para a próxima.');
  }
  function mostrarPasso() {
    var P = PASSOS[passo]; desde = performance.now() / 1000; ultimaDica = desde;
    $('poPasso').textContent = (passo + 1) + '/' + PASSOS.length + ' · ' + P.nome; $('poDica').textContent = P.fala;
    $('poLista').innerHTML = PASSOS.map(function (q, i) { return '<span class="' + (i < passo ? 'feito' : i === passo ? 'atual' : '') + '">' + (i < passo ? '✓ ' : '') + q.nome + '</span>'; }).join('');
    desenharIdeal($('poIdeal'), P.pose);
  }
  function desenharIdeal(c, nome) {
    var g = c.getContext('2d'); g.fillStyle = '#0a1712'; g.fillRect(0, 0, c.width, c.height);
    var s = Math.min((c.height - 20) / 3.1, c.width / 1.7), esp = cfg.post.mao === 'e';
    g.fillStyle = '#0f3a2b'; g.fillRect(0, c.height - 14, c.width, 14);
    Boneco.desenhar(g, Boneco.chave(nome), { x: c.width / 2 + (esp ? 0.15 : -0.15) * s, y: c.height - 14, s: s, juntas: true, espelho: esp, bola: nome === 'solta' ? [0.27, 2.2] : null });
  }
  function guia(w, t, imp) {
    if (passo >= PASSOS.length) return;
    var agora = performance.now() / 1000, P = PASSOS[passo];
    var inteiro = !!imp && [0, 11, 12, 27, 28, 29, 30].every(function (i) { return imp[i].v > 0.5 && imp[i].y > 0 && imp[i].y < proc.height * 0.97; });
    var ok = false, f = null;
    if (w) {
      var lb = ladoBolaPadrao();
      // se o modelo trocou esquerda/direita (visto de costas), o braço mais alto é o da bola
      if (P.id !== 'quadro' && P.id !== 'lado' && P.id !== 'peso') { var fa = medir(w, 'E'), fb = medir(w, 'D'); if (P.id === 'contato' ? false : Math.abs(fa.bolaAcima - fb.bolaAcima) > 0.15) lb = fa.bolaAcima > fb.bolaAcima ? 'E' : 'D'; }
      f = medir(w, lb, imp); ok = P.ok(f, inteiro);
    }
    var dica = w ? P.cue(f, inteiro) : { s: '👀', t: 'Não estou vendo você' };
    if (ok) {
      if (!okDesde) { okDesde = agora; if (P.segurar || agora - desde > 2) { falar('Isso, segure!'); ultimaFala = agora; } }
      grande(P.segurar ? '✓ segure… ' + Math.max(1, Math.ceil(P.segurar - (agora - okDesde))) : '✓ isso!', '#22c55e');
      $('poDica').textContent = '✓ Certo! Segure um instante.';
    } else {
      okDesde = 0;
      if (dica) {
        grande(dica.s + ' ' + dica.t, '#facc15'); $('poDica').innerHTML = dica.t + (dica.m ? '<br><span class="peq" style="color:#d6e6dd">' + dica.m + '</span>' : '');
        // fala curta, sem atropelar a explicação do passo
        var falando = window.speechSynthesis && speechSynthesis.speaking;
        if (agora - desde > 2 && (!falando || agora - ultimaFala > 6) && agora - ultimaFala > 2.5 && (dica.t !== ultimaCue || agora - ultimaFala > 4)) { falar(dica.t); ultimaFala = agora; ultimaCue = dica.t; }
      } else grande('');
    }
    if (ok && agora - okDesde > (P.segurar || 0.7)) {
      passo++; okDesde = 0;
      if (passo >= PASSOS.length) {
        $('poLista').innerHTML = PASSOS.map(function (q) { return '<span class="feito">✓ ' + q.nome + '</span>'; }).join('');
        $('poPasso').textContent = '🏆 Todas as posições certas!'; $('poDica').textContent = 'Agora toque em Tentativa e faça o movimento inteiro jogando a bola.';
        falar('Muito bem! Todas as posições certas. Agora toque em Tentativa e faça o movimento inteiro jogando a bola.'); grande('🏆', '#22c55e');
        return;
      }
      mostrarPasso(); falar('Isso! ' + PASSOS[passo].fala); ultimaFala = agora;
      return;
    }
  }

  /* ------------------------------------------------------------------ tentativa: acha o começo e o fim do movimento */
  var tentativa = null, descansoAte = 0;
  function acompanhar(t) {
    var h = hist[hist.length - 1]; if (!h.w) return;
    var f = medir(h.w, 'E'), g2 = medir(h.w, 'D'), alto = Math.max(f.bolaAcima, g2.bolaAcima);
    if (!tentativa) {
      if (t < descansoAte) return;
      if (alto > 0.12) { tentativa = { ini: t, pico: t, picoV: alto }; grande('👀'); }
      return;
    }
    if (alto > tentativa.picoV) { tentativa.picoV = alto; tentativa.pico = t; }
    if ((t - tentativa.pico > 1.6 && alto < -0.15) || t - tentativa.ini > 5) fecharTentativa(false);
  }
  function fecharTentativa(fimDoVideo) {
    if (!tentativa) return;
    var tt = tentativa; tentativa = null; descansoAte = hist.length ? hist[hist.length - 1].t + 0.8 : 0;
    var r = analisar(tt);
    if (r) mostrarResultado(r);
    else if (!fimDoVideo) { grande(''); falar('Não consegui analisar. Fique de corpo inteiro na imagem e tente de novo.'); }
  }

  /* ------------------------------------------------------------------ análise da tentativa */
  function mediana(a) { if (!a.length) return NaN; var b = a.slice().sort(function (x, y) { return x - y; }); return b[b.length >> 1]; }
  function analisar(tt) {
    var fr = hist.filter(function (h) { return h.w && h.t >= tt.ini - 1.5; });
    if (fr.length < 8) return null;
    // qual braço jogou a bola: o primeiro que subiu acima do nariz
    var lb = ladoBolaPadrao(), trocado = false;
    for (var i = 0; i < fr.length; i++) {
      var a = medir(fr[i].w, 'E'), b = medir(fr[i].w, 'D');
      if (a.bolaAcima > 0.12 || b.bolaAcima > 0.12) { var l = a.bolaAcima >= b.bolaAcima ? 'E' : 'D'; trocado = l !== lb; lb = l; break; }
    }
    fr.forEach(function (h) { h.f = medir(h.w, lb, h.im); });
    var antes = fr.filter(function (h) { return h.t < tt.ini - 0.25; });
    if (antes.length < 3) antes = fr.slice(0, 3);
    var j0 = mediana(antes.map(function (h) { return h.f.joelho; }));
    // soltou a bola: o punho da bola no ponto mais alto (até 1,6 s depois de subir)
    var janela = fr.filter(function (h) { return h.t >= tt.ini - 0.3 && h.t <= tt.ini + 1.6; }), rel = janela[0];
    janela.forEach(function (h) { if (h.f.bolaAcima > rel.f.bolaAcima) rel = h; });
    // troféu: depois de soltar, o momento mais agachado (até 1 s)
    // troféu: depois de soltar, com o braço da bola ainda no alto; o mais agachado (ou, sem pés, o do cotovelo da raquete mais alto)
    var dep = fr.filter(function (h) { return h.t >= rel.t && h.t <= rel.t + 1.0 && h.f.bolaAcima > -0.12; }), tro = dep[0] || rel;
    var nota = function (h) { return h.f.joelho + 60 * Math.min(0, h.f.racCotAlt) + 40 * Math.min(0.2, h.f.racAcima + 0.3); };
    dep.forEach(function (h) { if (nota(h) > nota(tro)) tro = h; });
    var impulso = 0; fr.forEach(function (h) { if (h.t > tro.t && h.t <= tro.t + 1.0) impulso = Math.max(impulso, h.f.quadrilAlt - tro.f.quadrilAlt); });
    // escala da imagem: nariz→chão = 0,92 × altura (média dos quadros parados)
    var pxm = mediana(antes.map(function (h) { var chao = Math.max(h.im[29].y, h.im[30].y, h.im[31].y, h.im[32].y); return (chao - h.im[0].y) / (0.92 * alt()); }));
    var chaoPx = mediana(antes.map(function (h) { return Math.max(h.im[29].y, h.im[30].y, h.im[31].y, h.im[32].y); }));
    // toss: a bola mais alta vista depois de soltar, que tenha vizinhas coerentes (não é mancha solta)
    var bolas = fr.filter(function (h) { return h.bola && h.t >= rel.t - 0.1 && h.t <= rel.t + 1.6; }), apice = null, saiu = false;
    bolas.forEach(function (h, k) {
      var viz = bolas.filter(function (o, m) { return m !== k && Math.abs(o.t - h.t) < 0.2 && Math.abs(o.bola[1] - h.bola[1]) < 0.35 * pxm; }).length;
      if (viz >= 1 && (!apice || h.bola[1] < apice.bola[1])) apice = h;
    });
    if (apice && apice.bola[1] < proc.height * 0.03) saiu = true;
    var maoPx = rel.im[IDX[lb].pu].y;
    if (apice && !saiu) {     // só vale se a bola subiu acima da mão e depois desceu (senão era a bola ainda na mão)
      var desceu = bolas.some(function (h) { return h.t > apice.t + 0.1 && h.bola[1] - apice.bola[1] > 0.15 * pxm; });
      var subiu = (maoPx - apice.bola[1]) > 0.2 * pxm;
      if (!desceu || !subiu) { apice = null; if (bolas.some(function (h) { return h.bola[1] < proc.height * 0.12; })) saiu = true; }
    }
    var contato = 1.5 * alt(), tossAlt = apice && pxm > 0 ? (chaoPx - apice.bola[1]) / pxm : null;
    var tossLado = apice && pxm > 0 ? Math.abs(apice.bola[0] - apice.im[lb === 'E' ? 11 : 12].x) / pxm : null;
    // para frente (dentro da quadra): só dá para ver com a câmera de lado, quando os pés aparecem separados na horizontal
    var tossFrente = null, ini = antes[antes.length - 1].im, pF = ini[IDX[lb].pe], pT = ini[IDX[lb === 'E' ? 'D' : 'E'].pe];
    if (apice && pxm > 0 && Math.abs(pF.x - pT.x) > 0.3 * pxm) tossFrente = (apice.bola[0] - pF.x) * Math.sign(pF.x - pT.x) / pxm;

    // pronação: só quando a raquete subiu ao contato e desceu na finalização
    var contatoQ = null;
    fr.forEach(function (h) { if (h.t > tro.t && h.t <= tro.t + 1.2 && (!contatoQ || h.f.racAcima > contatoQ.f.racAcima)) contatoQ = h; });
    var itens = [];
    function item(nome, valor, nota, dica, peso) { itens.push({ nome: nome, valor: valor, nota: nota, dica: dica, peso: peso || 1 }); }
    var a0 = antes[antes.length - 1].f;
    item('De lado no começo', Math.round(a0.lado) + '°', a0.lado < 35 ? 'ok' : a0.lado < 50 ? 'meio' : 'ruim', 'Comece mais de lado: os ombros na linha dos pés, o pé da frente apontando para o poste da rede.', 0.6);
    item('Peso no pé de trás', a0.peso < 0.45 ? 'sim' : 'não', a0.peso < 0.45 ? 'ok' : 'meio', 'Comece com o peso no pé de trás e passe para a frente ao jogar a bola.', 0.5);
    item('Braço da bola esticado', Math.round(rel.f.bolaCot) + '°', rel.f.bolaCot >= 155 ? 'ok' : rel.f.bolaCot >= 140 ? 'meio' : 'ruim', 'Estique o braço da bola: jogue a partir do ombro, sem dobrar o cotovelo.', 1.2);
    item('Soltou a bola no alto', n2(rel.f.bolaAcima) + ' m acima do nariz', rel.f.bolaAcima >= 0.22 ? 'ok' : rel.f.bolaAcima >= 0.1 ? 'meio' : 'ruim', 'Solte a bola mais no alto, com a mão subindo até acima da cabeça.', 1);
    // sem os pés na imagem o modelo "chuta" os tornozelos: aí não dá para medir joelhos nem impulso
    function pesVis(h) { return [27, 28, 29, 30].every(function (i) { return h.im[i].v > 0.5 && h.im[i].y < proc.height * 0.97; }); }
    var janP = fr.filter(function (h) { return h.t >= tt.ini - 0.5 && h.t <= tro.t + 0.5; });
    var pesOk = janP.filter(pesVis).length >= 0.7 * janP.length;
    var subindo = fr.filter(function (h) { return h.t >= tt.ini - 0.6 && h.t <= rel.t && h.f.bolaAcima >= -0.05; })[0] || rel;
    var dobraAntes = subindo.f.joelho - j0;
    if (!pesOk) item('Joelhos e pernas', 'pés fora da imagem', 'meio', 'Deixe os pés aparecerem na imagem para eu medir os joelhos e o impulso.', 0.9);
    if (pesOk) item('Pernas só depois de soltar', dobraAntes > 15 ? 'dobrou antes' : 'ok', dobraAntes > 15 ? 'ruim' : 'ok', 'Você dobrou as pernas antes de soltar a bola. O toss é só com o braço; dobre os joelhos enquanto a bola sobe.', 1);
    var jb = tro.f.joelho;
    if (pesOk) item('Joelhos no troféu', Math.round(jb) + '°', jb >= 25 ? 'ok' : jb >= 15 ? 'meio' : 'ruim', jb < 15 ? 'A perna não dobrou. Dobre os joelhos no troféu.' : 'Dobre um pouco mais os joelhos no troféu.', 1.3);
    item('Cotovelo da raquete', tro.f.racCotAlt >= -0.13 ? 'na altura do ombro' : n2(-tro.f.racCotAlt) + ' m abaixo', tro.f.racCotAlt >= -0.13 ? 'ok' : tro.f.racCotAlt >= -0.22 ? 'meio' : 'ruim', 'Suba o cotovelo da raquete até a altura do ombro no troféu.', 1);
    item('Braço da raquete em L', Math.round(tro.f.racCot) + '°', tro.f.racCot >= 55 && tro.f.racCot <= 135 ? 'ok' : 'meio', tro.f.racCot > 135 ? 'No troféu, dobre o braço da raquete em L.' : 'No troféu, abra um pouco o braço da raquete, em L.', 0.7);
    item('Braço da bola no alto no troféu', Math.round(tro.f.bolaVert) + '° da vertical', tro.f.bolaVert < 40 ? 'ok' : 'meio', 'Mantenha o braço da bola apontando para cima até a raquete começar a subir.', 0.7);
    item('Cotovelo na linha dos ombros', Math.round(tro.f.linha) + '°', tro.f.linha < 35 ? 'ok' : 'meio', 'No troféu, o cotovelo da raquete fica na mesma linha dos ombros, como uma reta inclinada.', 0.7);
    if (tro.f.racCotAlt > 0.22) itens.forEach(function (i) { if (i.nome === 'Cotovelo da raquete') { i.nota = 'meio'; i.valor = n2(tro.f.racCotAlt) + ' m acima (alto)'; i.dica = 'O cotovelo da raquete subiu demais no troféu: deixe na altura do ombro.'; } });
    item('Ombro da bola mais alto', n2(tro.f.incl) + ' m', tro.f.incl > 0.04 ? 'ok' : 'meio', 'No troféu, incline: o ombro do braço da bola mais alto que o da raquete.', 0.6);
    if (pesOk) item('Impulso das pernas', '+' + n2(impulso) + ' m', impulso >= 0.06 ? 'ok' : 'meio', 'Depois do troféu, empurre o chão e estique as pernas para subir.', 0.6);
    if (saiu) item('Altura do toss', 'saiu do quadro', 'meio', 'A bola saiu por cima da imagem: afaste o celular ou deixe mais espaço acima da cabeça.', 0.4);
    else if (tossAlt !== null) {
      var acima = tossAlt - contato;
      item('Altura do toss', n2(tossAlt) + ' m (' + (acima >= 0 ? '+' : '') + n2(acima) + ' do contato)', acima < 0.05 ? 'ruim' : acima > 1.0 ? 'ruim' : acima > 0.7 ? 'meio' : 'ok',
        acima < 0.05 ? 'O toss foi muito baixo: a bola tem que subir acima do ponto de contato, uns 30 a 60 centímetros.' : 'O toss foi alto demais: suba a bola só uns 30 a 60 centímetros acima do contato.', 1.2);
      if (tossFrente !== null) item('Toss para dentro da quadra', (tossFrente >= 0 ? n2(tossFrente) + ' m à frente do pé' : n2(-tossFrente) + ' m atrás do pé'), tossFrente >= -0.05 ? 'ok' : tossFrente >= -0.3 ? 'meio' : 'ruim',
        'Jogue a bola para dentro da quadra, à frente do corpo: nunca em cima da cabeça ou atrás. Se o toss sair errado, segure a bola e recomece.', 1.1);
      if (tossLado !== null) item('Toss perto do corpo', n2(tossLado) + ' m do ombro', tossLado < 0.7 ? 'ok' : 'meio', 'A bola foi longe do corpo: solte a bola mais em cima do ombro, um pouco à frente.', 0.6);
    } else item('Altura do toss', 'não vi a bola no alto', 'meio', 'Não vi a bola subir e descer: use bola amarela, boa luz e deixe uns 1,5 m livres acima da cabeça na imagem.', 0.2);
    // pronação: a câmera não mede com segurança (testado com saques de profissional: ruído maior que o sinal).
    // Em vez de um palpite, guardamos os quadros do contato para o replay em câmera lenta.
    var replay = contatoQ && contatoQ.f.racAcima > 0.3 ? fr.filter(function (h) { return h.mao && h.t >= contatoQ.t - 0.35 && h.t <= contatoQ.t + 0.6; }) : [];
    return { itens: itens, tro: tro, rel: rel, trocado: trocado, lb: lb, tossAlt: tossAlt, replay: replay };
  }

  function mostrarResultado(r) {
    var ruins = r.itens.filter(function (i) { return i.nota === 'ruim'; }).sort(function (a, b) { return b.peso - a.peso; });
    var meios = r.itens.filter(function (i) { return i.nota === 'meio'; }).sort(function (a, b) { return b.peso - a.peso; });
    var toss = r.tossAlt !== null ? ' Toss a ' + n2(r.tossAlt).replace(',', ' vírgula ') + ' metros.' : '';
    var fala;
    if (!ruins.length && !meios.filter(function (i) { return i.peso >= 1; }).length) { fala = 'Ótimo! Posições certas.' + toss; grande('✅ Ótimo!', '#22c55e'); }
    else { var lst = ruins.concat(meios).slice(0, 2); fala = lst.map(function (i) { return i.dica; }).join(' ') + toss; grande(ruins.length ? '⚠️ ' + ruins[0].nome : '👍 Quase', ruins.length ? '#facc15' : '#38bdf8'); }
    falar(fala);
    $('poRes').style.display = '';
    $('poTab').innerHTML = '<table><tr><th>Ponto</th><th>Medido</th><th></th></tr>' + r.itens.map(function (i) {
      return '<tr><td style="text-align:left">' + i.nome + '</td><td>' + i.valor + '</td><td class="' + i.nota + '">' + (i.nota === 'ok' ? '✓' : i.nota === 'meio' ? '~' : '✗') + '</td></tr>';
    }).join('') + '</table>' +
      (ruins.concat(meios).length ? '<div class="peq" style="margin-top:8px;font-size:15px;line-height:1.5">' + ruins.concat(meios).slice(0, 4).map(function (i) { return '• ' + i.dica; }).join('<br>') + '</div>' : '') +
      (r.trocado ? '<div class="peq" style="margin-top:6px">Obs.: quem jogou a bola foi o braço ' + (r.lb === 'E' ? 'esquerdo' : 'direito') + '. Confira destro/canhoto.</div>' : '') +
      '<div class="peq" style="margin-top:6px">Ângulos medidos pela câmera: valem como guia, com erro de alguns graus.</div>';
    // foto do troféu com o esqueleto
    var c = $('poFoto'), h = r.tro, s = 2, fw = proc.width >> 1, fh = proc.height >> 1; c.width = fw * s; c.height = fh * s;
    var g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); if (h.foto) g.drawImage(h.foto, 0, 0, c.width, c.height);
    s = s / 2;
    var B = IDX[r.lb], R = IDX[r.lb === 'E' ? 'D' : 'E'], cores = {};
    var notas = {}; r.itens.forEach(function (i) { notas[i.nome] = i.nota; });
    var cor = function (n) { return n === 'ok' ? '#22c55e' : n === 'meio' ? '#facc15' : '#ef4444'; };
    cores[Math.min(B.qu, B.jo) + '-' + Math.max(B.qu, B.jo)] = cores[Math.min(R.qu, R.jo) + '-' + Math.max(R.qu, R.jo)] = cor(notas['Joelhos no troféu']);
    cores[Math.min(B.jo, B.to) + '-' + Math.max(B.jo, B.to)] = cores[Math.min(R.jo, R.to) + '-' + Math.max(R.jo, R.to)] = cor(notas['Joelhos no troféu']);
    cores[Math.min(R.om, R.co) + '-' + Math.max(R.om, R.co)] = cores[Math.min(R.co, R.pu) + '-' + Math.max(R.co, R.pu)] = cor(notas['Cotovelo da raquete']);
    cores[Math.min(B.om, B.co) + '-' + Math.max(B.om, B.co)] = cores[Math.min(B.co, B.pu) + '-' + Math.max(B.co, B.pu)] = cor(notas['Braço da bola no alto no troféu']);
    esqueleto(g, h.im, s, s, cores);
    desenharIdeal($('poFotoIdeal'), 'trofeu');
    iniciarReplay(r);
  }
  var rep = { q: [], i: 0, timer: 0, lento: 4, pausa: false, lb: 'E' };
  function iniciarReplay(r) {
    clearInterval(rep.timer); rep.q = r.replay || []; rep.i = 0; rep.lb = r.lb; rep.pausa = false; $('poRepPausa').textContent = '⏸ Pausar';
    $('poRepC').style.display = rep.q.length >= 4 ? '' : 'none';
    if (rep.q.length < 4) return;
    var dt = (rep.q[rep.q.length - 1].t - rep.q[0].t) / (rep.q.length - 1) || 1 / 30;
    rep.timer = setInterval(function () { if (!rep.pausa) { desenharReplay(); rep.i = (rep.i + 1) % (rep.q.length + 6); } }, dt * 1000 * rep.lento);
  }
  function desenharReplay() {
    var c = $('poReplay'), h = rep.q[Math.min(rep.i, rep.q.length - 1)], m = h.mao, k = 400 / m.lado, R = IDX[rep.lb === 'E' ? 'D' : 'E'];
    c.width = 400; c.height = 400; var g = c.getContext('2d'); g.drawImage(m.c, 0, 0, 400, 400);
    g.strokeStyle = '#facc15'; g.lineWidth = 4; g.lineCap = 'round'; g.globalAlpha = 0.8; g.beginPath();
    [R.om, R.co, R.pu].forEach(function (i, n) { var px = (h.im[i].x - m.x0) * k, py = (h.im[i].y - m.y0) * k; if (n) g.lineTo(px, py); else g.moveTo(px, py); }); g.stroke(); g.globalAlpha = 1;
    g.fillStyle = '#fff'; g.font = 'bold 18px -apple-system, sans-serif'; g.fillText(Math.round((h.t - rep.q[0].t) * 1000) + ' ms', 10, 26);
  }
  $('poRepLento').onclick = function () { rep.lento = rep.lento === 4 ? 1 : 4; this.textContent = rep.lento === 4 ? '🐢 ¼ da velocidade' : '▶ velocidade normal'; var r0 = { replay: rep.q, lb: rep.lb }; iniciarReplay(r0); };
  $('poRepPausa').onclick = function () { rep.pausa = !rep.pausa; this.textContent = rep.pausa ? '▶ Continuar' : '⏸ Pausar'; };

  /* ------------------------------------------------------------------ botões */
  $('poGuiado').onclick = function () { iniciar('guiado'); };
  $('poTentar').onclick = function () { iniciar('tentar'); };
  $('poParar').onclick = function () { fecharTentativa(true); parar(); estado('Parado.'); };
  $('poArquivo').onclick = function () { $('poArq').click(); };
  $('poArq').onchange = function () {
    var f = this.files[0]; if (!f) return; parar();
    video.srcObject = null; video.src = URL.createObjectURL(f); video.muted = true; this.value = '';
    iniciar('arquivo');
  };
  window.Postura = { giroMao: giroMao, iniciar: iniciar, parar: parar, medir: medir, hist: function () { return hist; }, analisar: analisar,
    usarVideo: function (url, m) { parar(); video.srcObject = null; video.src = url; video.muted = true; return iniciar(m === 'guiado' ? 'guiadoArquivo' : 'arquivo'); } };   // para testes
})();
