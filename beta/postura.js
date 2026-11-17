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
    '<details id="poOpc" style="margin-top:6px"><summary class="peq" style="color:#eef5f1">⚙️ Opções: <span id="poOpcResumo"></span></summary>' +
    '<div class="lado" style="margin-top:6px">' +
    '<label>Você é<br><select id="poMao"><option value="d">Destro</option><option value="e">Canhoto</option></select></label>' +
    '<label>Guiado<br><select id="poProg"><option value="viks">Do zero (VIKSTENNIS)</option><option value="classico">Posições clássicas</option></select></label>' +
    '<label>Análise<br><select id="poNivel"><option value="ini">Iniciante: sem agachar</option><option value="av">Avançado: joelhos e impulso</option></select></label>' +
    '<label>Câmera<br><select id="poCam"><option value="environment">Traseira (melhor)</option><option value="user">Frontal (você se vê)</option><option value="pc">Do computador (Mac)</option></select></label></div></details>' +
    '<div class="lado"><button id="poGuiado" class="bt verde">🧭 Guiado</button><button id="poTentar" class="bt verde">🎾 Tentativa</button></div>' +
    '<div class="chips"><button id="poTelao">🖥 Telão</button><button id="poPegada">✋ Conferir empunhadura</button><button id="poArquivo">📂 Analisar vídeo</button></div>' +
    '<input type="file" id="poArq" accept="video/*" style="display:none">' +
    '<button id="poParar" class="bt vermelho" style="display:none">⏹ Parar</button>' +
    '<div id="poEstado" class="peq" style="text-align:center">Escolha um modo.</div></div>' +
    '<details class="cartao" id="poEmp" style="padding:10px 12px"><summary style="font-weight:700;font-size:16px">✋ Como segurar a raquete no saque (continental)</summary><div id="poEmpC"></div></details>' +
    '<div id="poArea"><div class="cartao" id="poPassoC" style="display:none"><button id="poSairTelao" class="bt cinza" style="display:none;padding:8px;font-size:16px;margin-bottom:8px">✕ Sair do telão</button><div style="display:flex;gap:10px;align-items:center">' +
    '<canvas id="poIdeal" width="240" height="300" style="width:120px;height:150px;background:#0a1712;border-radius:8px;flex:none"></canvas>' +
    '<div style="flex:1"><div id="poPasso" style="font-size:19px;font-weight:700"></div><div id="poDica" style="color:#facc15;font-size:17px;margin-top:6px"></div></div></div>' +
    '<div id="poCel" style="display:none;margin-top:8px;padding:8px 10px;border-radius:8px;background:#13293d;font-size:16px"></div>' +
    '<div id="poRaq" style="display:none;margin-top:8px;padding:8px 10px;border-radius:8px;background:#1e293b;font-size:16px"></div>' +
    '<div id="poInfo"></div>' +
    '<div id="poLista" class="pontos"></div>' +
    '<div class="lado"><button class="bt cinza" id="poVolta" style="padding:8px;font-size:15px">⏮ Voltar</button><button class="bt cinza" id="poPula" style="padding:8px;font-size:15px">⏭ Pular passo</button></div></div>' +
    '<div id="poPalco" style="position:relative;width:100%;background:#000;border-radius:10px;overflow:hidden;display:none">' +
    '<video id="poVideo" playsinline muted autoplay style="position:absolute;inset:0;width:100%;height:100%"></video>' +
    '<canvas id="poDesenho" style="position:absolute;inset:0;width:100%;height:100%"></canvas>' +
    '<div id="poGrande" style="position:absolute;left:0;right:0;top:8px;text-align:center;font-size:24px;font-weight:800;text-shadow:0 2px 6px #000"></div></div></div>' +
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
  // no computador (Mac/PC) a câmera é a webcam: sem frontal/traseira, e a imagem espelhada como num espelho
  var PC = !('ontouchend' in document) && !/iPhone|iPad|Android/i.test(navigator.userAgent);
  if (PC && !cfg.post.camEscolhida) cfg.post.cam = 'pc';
  $('poMao').value = cfg.post.mao; $('poCam').value = cfg.post.cam;
  function resumoOpc() { var t = function (id) { var s = $(id); return s.options[s.selectedIndex] ? s.options[s.selectedIndex].text.split(/[ :(]/)[0] : ''; };
    $('poOpcResumo').textContent = [t('poMao'), $('poProg').value === 'viks' ? 'VIKSTENNIS' : 'Clássico', t('poNivel'), 'câmera ' + t('poCam').toLowerCase()].join(' · '); }
  ['poMao', 'poProg', 'poNivel', 'poCam'].forEach(function (id) { $(id).addEventListener('change', resumoOpc); });
  if (window.Empunhadura) { $('poEmpC').innerHTML = Empunhadura.cartao('continental', '<button class="bt cinza" id="poTodasEmp" style="padding:9px;font-size:15px">Ver todas as empunhaduras</button>');
    $('poEmp').addEventListener('toggle', function () { Empunhadura.desenharTodos($('poEmp')); }); $('poTodasEmp').onclick = Empunhadura.abrirTodas; }
  $('poMao').onchange = function () { cfg.post.mao = this.value; salvar(); };
  cfg.post.prog = cfg.post.prog || 'viks'; cfg.post.nivel = cfg.post.nivel || 'ini';
  $('poProg').value = cfg.post.prog; $('poNivel').value = cfg.post.nivel; resumoOpc();
  $('poProg').onchange = function () { cfg.post.prog = this.value; salvar(); if (modo === 'guiado') comecarGuia(); };
  $('poNivel').onchange = function () { cfg.post.nivel = this.value; salvar(); };
  $('poCam').onchange = function () { cfg.post.cam = this.value; cfg.post.camEscolhida = true; salvar(); if (fluxo) { var m = modo; parar(); iniciar(m); } };

  /* ------------------------------------------------------------------ telão: imagem e dicas grandes, para ver de longe (Mac + monitor) */
  var css = document.createElement('style');
  css.textContent = 'body.telao #abas{display:none}' +
    '#postura.telao>*:not(#poArea){display:none!important}' +
    '#postura.telao{position:fixed;inset:0;z-index:40;background:#050d0a;margin:0;max-width:none;padding:12px;overflow:auto}' +
    '#postura.telao #poArea{display:flex;gap:16px;align-items:flex-start;flex-direction:row-reverse}' +
    '#postura.telao #poPassoC{flex:1 1 0;margin:0;max-height:calc(100vh - 24px);overflow:auto}' +
    '#postura.telao #poPasso{font-size:30px!important}#postura.telao #poDica{font-size:32px!important;line-height:1.3}' +
    '#postura.telao #poCel,#postura.telao #poRaq{font-size:22px!important}#postura.telao #poGrande{font-size:46px!important}' +
    '#postura.telao.estreito #poArea{flex-direction:column-reverse;align-items:center}#postura.telao.estreito #poPassoC{width:100%;max-height:none}' +
    '#postura.telao #poIdeal{width:180px!important;height:225px!important}';
  document.head.appendChild(css);
  var telao = false;
  function ajustarPalco() {
    var vw = video.videoWidth || 16, vh = video.videoHeight || 9, pal = $('poPalco').style; pal.aspectRatio = vw + ' / ' + vh;
    var largo = innerWidth >= 900; sec.classList.toggle('estreito', telao && !largo);
    if (telao) { var H = largo ? Math.min(innerHeight - 24, 0.62 * innerWidth * vh / vw) : Math.min(innerHeight * 0.55, (innerWidth - 24) * vh / vw); pal.height = H + 'px'; pal.width = (H * vw / vh) + 'px'; pal.margin = '0'; pal.flex = 'none'; }
    else { pal.height = 'auto'; pal.width = 'min(100%, ' + (72 * vw / vh).toFixed(2) + 'vh)'; pal.margin = '0 auto'; pal.flex = ''; }
  }
  function mudarTelao(on) {
    telao = on; sec.classList.toggle('telao', on); document.body.classList.toggle('telao', on);
    $('poSairTelao').style.display = on ? '' : 'none'; ajustarPalco();
    try { if (on && document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(function () {}); 
          if (!on && document.fullscreenElement) document.exitFullscreen().catch(function () {}); } catch (e) {}
  }
  $('poTelao').onclick = function () { mudarTelao(true); if (!ativo) iniciar('guiado'); };
  $('poSairTelao').onclick = function () { mudarTelao(false); };
  document.addEventListener('fullscreenchange', function () { if (!document.fullscreenElement && telao) mudarTelao(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && telao) mudarTelao(false); });
  addEventListener('resize', function () { if (telao) ajustarPalco(); });

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
      abd: angulo(quT, omR, coR),                                     // abertura do ombro da raquete (90 = cotovelo na altura do ombro, de lado)
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
        var vc = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }; if (cfg.post.cam !== 'pc') vc.facingMode = cfg.post.cam;
        fluxo = await navigator.mediaDevices.getUserMedia({ video: vc, audio: false });
        video.srcObject = fluxo; video.style.transform = cfg.post.cam === 'user' || cfg.post.cam === 'pc' ? 'scaleX(-1)' : ''; tela.style.transform = video.style.transform;
      } else video.style.transform = tela.style.transform = '';
      $('poPalco').style.display = ''; $('poParar').style.display = '';
      await video.play().catch(function () {});
      await new Promise(function (ok) { if (video.videoWidth) ok(); else video.onloadedmetadata = ok; });
      var vw = video.videoWidth, vh = video.videoHeight, pal = $('poPalco').style;      // palco com a mesma proporção do vídeo (o esqueleto cai no lugar certo)
      ajustarPalco();
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
  /* pouca luz (câmera do Mac, quarto escuro): mede o brilho e, se estiver escuro, clareia a imagem que vai para o reconhecimento */
  var amostra = document.createElement('canvas'); amostra.width = 64; amostra.height = 36; var actxA = amostra.getContext('2d', { willReadFrequently: true });
  var det = document.createElement('canvas'), dctx = det.getContext('2d', { willReadFrequently: true }), luz = 128, luzT = -1, ganho = 1;
  function medirLuz() {
    try { actxA.drawImage(video, 0, 0, 64, 36); var d = actxA.getImageData(0, 0, 64, 36).data, s = 0;
      for (var i = 0; i < d.length; i += 4) s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      luz = s / (d.length / 4); } catch (e) {}
    ganho = luz < 90 ? Math.min(2.6, 120 / Math.max(25, luz)) : 1;
    video.style.filter = ganho > 1.05 ? 'brightness(' + ganho.toFixed(2) + ') contrast(1.1)' : '';
  }
  function fonteClara(t) {
    if (t - luzT > 0.5 || t < luzT) { luzT = t; medirLuz(); }
    if (ganho <= 1.05 || !video.videoWidth) return video;
    var esc = Math.min(1, 640 / video.videoWidth); det.width = Math.round(video.videoWidth * esc); det.height = Math.round(video.videoHeight * esc);
    dctx.drawImage(video, 0, 0, det.width, det.height);
    var im = dctx.getImageData(0, 0, det.width, det.height), d = im.data, g = ganho;
    for (var i = 0; i < d.length; i += 4) { d[i] = d[i] * g; d[i + 1] = d[i + 1] * g; d[i + 2] = d[i + 2] * g; }   // Uint8Clamped: satura em 255
    dctx.putImageData(im, 0, 0); return det;
  }
  function naoVejo() {
    return luz < 45 ? { s: '💡', e: 'Está muito escuro e eu não consigo ver você', t: 'Acenda mais luz, ou fique de frente para uma janela', k: 'luz' }
      : { s: '👀', e: 'Não estou vendo o seu corpo', t: 'Afaste-se ' + (cfg.post.cam === 'pc' ? 'da câmera' : 'do celular') + ' até aparecer dos pés à cabeça', k: 'naoVejo' };
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
    var res = null; try { res = lm.detectForVideo(fonteClara(t), ts); } catch (e) { }
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
    var bolas = modo !== 'guiado' ? acharBola(imp) || [] : [], bola = bolas[0] || null;
    var mao = modo !== 'guiado' ? recorteBraco(imp) : null;
    hist.push({ t: t, w: w, im: imp, bola: bola, bolas: bolas, foto: foto, mao: mao });
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
    var CEL = 3, cw = Math.ceil(proc.width / CEL), cont = {}, cands = [];
    for (var y = 0; y < Y1; y++) for (var x = X0; x < X1; x++) {
      var k = (y * proc.width + x) * 4, r = img[k], gg = img[k + 1], b = img[k + 2];
      if (gg > 90 && gg - b > 45 && r > 0.55 * gg && r < 1.3 * gg && (Math.abs(gg - antes[k + 1]) + Math.abs(r - antes[k])) > 30) {
        var c = ((y / CEL) | 0) * cw + ((x / CEL) | 0), q = cont[c] || (cont[c] = { n: 0, x: 0, y: 0 }); q.n++; q.x += x; q.y += y;
      }
    }
    // manchas ligadas; a bola é pequena e redonda (a moldura amarela de uma raquete dá manchas compridas)
    var bolaPx = Math.max(2, 0.067 * corpo / (0.92 * alt())), maxCel = Math.max(2, Math.ceil(bolaPx * 1.8 / CEL) + 1), visto = {};
    Object.keys(cont).forEach(function (c0) {
      if (visto[c0]) return; var pilha = [+c0], s2 = { n: 0, x: 0, y: 0, x0: 1e9, x1: -1, y0: 1e9, y1: -1 }; visto[c0] = 1;
      while (pilha.length) {
        var c = pilha.pop(), q = cont[c], cx = c % cw, cy = (c / cw) | 0;
        s2.n += q.n; s2.x += q.x; s2.y += q.y; s2.x0 = Math.min(s2.x0, cx); s2.x1 = Math.max(s2.x1, cx); s2.y0 = Math.min(s2.y0, cy); s2.y1 = Math.max(s2.y1, cy);
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { var v = c + dy * cw + dx; if (cont[v] && !visto[v]) { visto[v] = 1; pilha.push(v); } }
      }
      var w = s2.x1 - s2.x0 + 1, h = s2.y1 - s2.y0 + 1;
      if (w > maxCel || h > maxCel || Math.max(w, h) > 2.2 * Math.min(w, h) + 1) return;      // comprida ou grande demais
      if (s2.n < 3) return;
      cands.push(s2);
    });
    cands.sort(function (a, b) { return b.n - a.n; });
    return cands.slice(0, 6).map(function (m) { return [m.x / m.n, m.y / m.n]; });
  }

  /* ------------------------------------------------------------------ modo guiado */
  var PASSOS = [
    { id: 'quadro', nome: 'Corpo inteiro', pose: 'parado', fala: 'Fique a uns três ou quatro metros, no meio da imagem, de corpo inteiro, com os pés aparecendo. Eu digo se precisa ir para a frente, para trás ou para o lado.',
      ok: function (f, inteiro, e) { return e.ok; }, cue: function (f, inteiro, e) { return e.cue; } },
    { id: 'lado', nome: 'De lado', pose: 'parado', fala: 'Fique de lado para a rede: o pé da frente apontando para o poste da rede, e o pé de trás paralelo à linha de fundo.',
      ok: function (f) { return f.lado < 45 && f.pes > 0.25; }, dica: function (f) { return f.pes <= 0.25 ? 'Afaste mais os pés, uns dois palmos.' : 'Vire mais de lado: os ombros na mesma linha dos pés.'; }, cue: function (f) { return f.pes <= 0.25 ? Q('↔', 'Seus pés estão juntos demais, ' + cmTxt(f.pes) + ' de distância', 'Afaste mais os pés', f.pes, 0.25, 'cm') : f.lado >= 45 ? Q('↻', 'Você está muito de frente: ombros a ' + graus(f.lado) + ' da linha dos pés', 'Vire mais de lado', f.lado, 45, 'graus') : null; } },
    { id: 'peso', nome: 'Peso atrás', pose: 'peso', fala: 'Ponha o peso no pé de trás, com a bola e a raquete juntas à sua frente.',
      ok: function (f) { return f.peso < 0.45; }, dica: function () { return 'Jogue o peso para o pé de trás.'; }, cue: function (f) { return f.peso < 0.45 ? null : { s: '⬅', e: 'Seu peso está ' + (f.peso > 0.6 ? 'no pé da frente' : 'no meio'), t: 'Passe o peso para o pé de trás', k: 'peso', v: f.peso, a: 0.45 }; } },
    { id: 'braco', troca: true, nome: 'Braço da bola', pose: 'solta', fala: 'Agora suba o braço da bola, bem esticado, até apontar para o céu. Segure aí.',
      ok: function (f) { return f.bolaCot > 150 && f.bolaVert < 32 && f.bolaAcima > 0.12; },
      dica: function (f) { return f.bolaCot <= 150 ? 'Estique o braço da bola, sem dobrar o cotovelo.' : 'Suba mais o braço da bola, apontando para cima.'; }, cue: function (f) { return f.bolaAcima <= 0.12 ? Q('⬆', 'Sua mão da bola está baixa, ' + cmTxt(f.bolaAcima) + (f.bolaAcima < 0 ? ' abaixo' : ' acima') + ' do nariz', 'Suba mais o braço da bola', f.bolaAcima, 0.12, 'cm') : f.bolaCot <= 150 ? Q('↕', 'Seu braço da bola está dobrado, ' + graus(f.bolaCot), 'Estique o cotovelo do braço da bola', f.bolaCot, 150, 'graus') : f.bolaVert >= 32 ? (f.frente !== null && f.frente < 0 ? { s: '➡', e: 'Seu braço da bola está para trás', t: 'Leve mais à frente, para o lado da rede' } : Q('⬆', 'Seu braço da bola está inclinado, ' + graus(f.bolaVert) + ' da vertical', 'Aponte mais para cima', f.bolaVert, 32, 'graus')) : null; } },
    { id: 'trofeu', troca: true, nome: 'Troféu', pose: 'trofeu', segurar: 4, raq: 'ponta para cima, borda virada para a frente. As cordas olham para o lado, não para a rede.', fala: 'Com o braço da bola no alto, leve a raquete para trás: cotovelo na altura do ombro, formando um L, e na mesma linha dos ombros. Segure três segundos.',
      ok: function (f) { return f.racCotAlt > -0.13 && f.racCotAlt < 0.22 && f.racCot > 55 && f.racCot < 135 && f.bolaVert < 40 && f.linha < 35; },
      dica: function (f) { return f.bolaVert >= 40 ? 'Mantenha o braço da bola lá no alto.' : f.racCotAlt <= -0.13 ? 'Suba o cotovelo da raquete até a altura do ombro.' : f.racCotAlt >= 0.22 ? 'O cotovelo da raquete subiu demais: deixe na altura do ombro.' :
        f.racCot >= 135 ? 'Dobre o braço da raquete, em L.' : f.racCot <= 55 ? 'Abra um pouco o braço da raquete, em L.' : 'Alinhe o cotovelo da raquete com a linha dos ombros.'; }, cue: function (f) { return f.bolaVert >= 40 ? Q('⬆', 'O braço da bola está caído, ' + graus(f.bolaVert) + ' da vertical', 'Braço da bola lá no alto', f.bolaVert, 40, 'graus') : f.racCotAlt <= -0.13 ? Q('⬆', altCot(f), 'Suba o cotovelo da raquete até a altura do ombro', f.racCotAlt, -0.13, 'cm') : f.racCotAlt >= 0.22 ? Q('⬇', 'Seu cotovelo está alto demais, ' + cmTxt(f.racCotAlt) + ' acima do ombro', 'Baixe um pouco o cotovelo', f.racCotAlt, 0.22, 'cm') : f.racCot >= 135 ? Q('↙', 'Seu braço da raquete está muito aberto, ' + graus(f.racCot), 'Dobre o braço em L', f.racCot, 135, 'graus') : f.racCot <= 55 ? Q('↗', 'Seu braço da raquete está muito fechado, ' + graus(f.racCot), 'Abra um pouco o braço', f.racCot, 55, 'graus') : f.linha >= 35 ? Q('↔', 'Seu cotovelo está fora da linha dos ombros, ' + graus(f.linha), 'Alinhe o cotovelo com os ombros', f.linha, 35, 'graus') : null; } },
    { id: 'joelhos', troca: true, nome: 'Joelhos', pose: 'trofeu', fala: 'Mantenha o troféu e dobre os joelhos.',
      ok: function (f, inteiro) { return inteiro && f.joelho >= 25 && f.racCotAlt > -0.14; }, dica: function (f, inteiro) { return !inteiro ? 'Deixe os pés aparecerem na imagem.' : f.joelho < 25 ? 'Dobre mais os joelhos.' : 'Sem baixar o cotovelo da raquete.'; }, cue: function (f, inteiro) { return !inteiro ? { s: '⬇', t: 'Deixe os pés aparecerem' } : f.joelho < 25 ? Q('⬇', 'Seus joelhos estão pouco dobrados, ' + graus(f.joelho), 'Dobre mais os joelhos', f.joelho, 25, 'graus') : f.racCotAlt <= -0.14 ? Q('⬆', altCot(f), 'Suba o cotovelo, sem baixar', f.racCotAlt, -0.14, 'cm') : null; } },
    { id: 'ombro', troca: true, nome: 'Ombros', pose: 'trofeu', fala: 'Incline o corpo: o ombro do braço da bola fica mais alto que o ombro da raquete.',
      ok: function (f) { return f.incl > 0.05; }, dica: function () { return 'Suba o ombro do braço da bola e abaixe o da raquete.'; }, cue: function (f) { return f.incl > 0.05 ? null : Q('↗', f.incl < 0 ? 'O ombro da raquete está mais alto, ' + cmTxt(f.incl) : 'Os ombros estão quase nivelados', 'Suba o ombro do braço da bola', f.incl, 0.05, 'cm'); } },
    { id: 'contato', nome: 'Contato', pose: 'contato', raq: 'no contato, as cordas viradas para o quadrado de saque; depois, a mão continua girando até o polegar apontar para baixo (pronação, também no slice e no kick).', fala: 'Agora estique as pernas e suba a raquete até o ponto de contato, com o braço todo esticado, bem no alto.',
      ok: function (f) { return f.racCot > 150 && f.racAcima > 0.25 && f.joelho < 18; },
      dica: function (f) { return f.joelho >= 18 ? 'Estique as pernas.' : 'Estique o braço da raquete, bem no alto.'; }, cue: function (f) { return f.joelho >= 18 ? Q('⬆', 'Seus joelhos estão dobrados, ' + graus(f.joelho), 'Estique as pernas', f.joelho, 18, 'graus') : f.racCot > 150 && f.racAcima > 0.25 ? null : cueEsticado(f); } }
  ];
  // Programa "do zero", na ordem do VIKSTENNIS (Learn the Tennis Serve From Zero): o de maior peso no app
  var COT_ARMADO = function (f) { return f.racCotAlt > 0.05 && f.racCot < 125; };            // cotovelo alto, raquete atrás
  var ESTICADO = function (f) { return f.racCot > 150 && f.racAcima > 0.25; };               // braço esticado no alto
  var BOLA_ALTA = function (f) { return f.bolaAcima > -0.05; };                                // mão da bola levantada (na altura do nariz ou mais)
  var ARMADO = function (f) { return COT_ARMADO(f) && BOLA_ALTA(f); };
  function maoBola() { return cfg.post.mao === 'e' ? 'direita' : 'esquerda'; }
  function cm(x) { return Math.round(x * 100) + ' cm'; }
  /* dica = { s: ícone, e: como você está agora, t: o que fazer, v: medida atual, a: meta, un: 'cm' | 'graus' }.
     A voz diz primeiro como você está e o que fazer; depois acompanha: "melhorou, falta…", "quase lá", "piorou". */
  function Q(s, e, t, v, a, un) {
    var m = un === 'cm' ? 'agora ' + cm(v) + ' · meta ' + cm(a) : un === 'graus' ? 'agora ' + Math.round(v) + '° · meta ' + Math.round(a) + '°' : '';
    return { s: s, e: e, t: t, k: t, v: v, a: a, un: un, m: m };
  }
  function graus(x) { return Math.round(x) + ' graus'; }
  function cmTxt(x) { return Math.round(Math.abs(x) * 100) + ' centímetros'; }
  function altCot(f, quanto) { return f.racCotAlt < 0 ? 'Seu cotovelo da raquete está ' + cmTxt(f.racCotAlt) + ' abaixo do ombro' : 'Seu cotovelo da raquete está só ' + cmTxt(f.racCotAlt) + ' acima do ombro'; }
  function maoBaixa(f) { return 'Sua mão ' + maoBola() + ' está baixa, ' + cmTxt(f.bolaAcima) + ' abaixo do nariz'; }
  // o que falta para a posição armada: cotovelo alto, raquete atrás e a mão da bola levantada
  function cueArmado(f) {
    if (f.racCotAlt <= 0.05) return Q('⬆', altCot(f), 'Suba o cotovelo da raquete', f.racCotAlt, 0.05, 'cm');
    if (f.racCot >= 125) return Q('↙', 'Seu braço da raquete está muito aberto, ' + graus(f.racCot), 'Dobre o braço, com a raquete solta atrás das costas', f.racCot, 125, 'graus');
    if (!BOLA_ALTA(f)) return Q('☝', maoBaixa(f), 'Levante a mão ' + maoBola() + ', apontando para cima', f.bolaAcima, -0.05, 'cm');
    return { s: '✓', t: 'Isso! Agora estique o braço da raquete para cima' };
  }
  // o que falta para o braço esticado no alto
  function cueEsticado(f) {
    if (f.racCot <= 150) return Q('↕', 'Seu braço da raquete está dobrado, ' + graus(f.racCot), 'Estique todo o braço, sem dobrar o cotovelo', f.racCot, 150, 'graus');
    if (f.racAcima <= 0.25) return Q('⬆', 'Sua mão da raquete está baixa, ' + cmTxt(f.racAcima) + (f.racAcima < 0 ? ' abaixo' : ' acima') + ' do nariz', 'Suba mais a mão da raquete', f.racAcima, 0.25, 'cm');
    return { s: '✓', t: 'Isso! Gire a mão e volte' };
  }
  /* posição em relação ao celular: o peito sempre virado para ele (a câmera vê os dois braços).
     De frente: o celular faz o papel da rede. De lado: a rede fica à esquerda do destro (à direita do canhoto). */
  var VISTA = { quadro: 'frente', cotovelo: 'frente', esticar: 'frente', lado: 'lado', peso: 'lado', braco: 'lado', trofeu: 'lado', joelhos: 'lado', ombro: 'lado', contato: 'lado',
    deLado: 'lado', esticarLado: 'lado', pronacao: 'lado', trofeuArco: 'lado', quadrilCot: 'lado', toss: 'lado' };
  function ladoRede() { return cfg.post.mao === 'e' ? 'direito' : 'esquerdo'; }
  function peFrente() { return cfg.post.mao === 'e' ? 'direito' : 'esquerdo'; }
  function peTras() { return cfg.post.mao === 'e' ? 'esquerdo' : 'direito'; }
  function celFala(v) {
    if (v === 'frente') return 'Em relação ao celular: fique de frente para ele, com o peito e os pés apontando para o celular, como se a rede estivesse ali.';
    var pf = peFrente(), pt = peTras(), dir = function (x) { return x === 'direito' ? 'direita' : 'esquerda'; };
    return 'Em relação ao celular: agora a rede fica do seu lado ' + ladoRede() + '. Vire o pé ' + pf + ' para a ' + dir(pf) + ', apontando para a rede, e afaste o pé ' + pt + ' para a ' + dir(pt) + ', paralelo à linha de fundo. O peito continua virado para o celular.';
  }
  function celCurto(v) { return v === 'frente' ? '📱 <b>De frente para o celular</b>: peito e pés apontando para ele (o celular faz o papel da rede).' : '📱 <b>Peito para o celular</b>, rede do seu lado ' + ladoRede() + ': pé ' + peFrente() + ' apontando para ela, pé ' + peTras() + ' atrás.'; }
  // onde a pessoa está na imagem: distância, lado e giro. grave = atrapalha a medida (vale em todos os passos)
  function enquadrar(imp, w, P) {
    if (!imp) return { ok: false, grave: true, cue: naoVejo() };
    var W = proc.width, H = proc.height, vis = function (i) { return imp[i].v > 0.5; };
    var cabeca = vis(0) && imp[0].y > 0.02 * H, pes = [27, 28, 29, 30].every(function (i) { return vis(i) && imp[i].y < 0.97 * H; });
    if (!pes && !cabeca) return { ok: false, grave: true, cue: { s: '⬇', t: 'Dê uns três passos para trás, para longe do celular', m: 'não vejo a cabeça nem os pés' } };
    if (!pes) return { ok: false, grave: true, cue: { s: '⬇', t: 'Dê dois passos para trás: seus pés estão fora da imagem' } };
    if (!cabeca) return { ok: false, grave: true, cue: { s: '⬇', t: 'Dê dois passos para trás: sua cabeça está fora da imagem' } };
    var chao = Math.max(imp[29].y, imp[30].y), tam = (chao - imp[0].y) / H, cx = (imp[23].x + imp[24].x) / 2 / W;
    // a imagem do processamento não é espelhada: à esquerda dela = à direita de quem está de frente para o celular
    if (cx < 0.2 || cx > 0.8) return { ok: false, grave: true, cue: { s: '↔', e: 'Você está muito à sua ' + (cx < 0.5 ? 'direita' : 'esquerda') + ', na beirada da imagem', t: 'Dê ' + (cx < 0.08 || cx > 0.92 ? 'dois passos' : 'um passo') + ' para a sua ' + (cx < 0.5 ? 'esquerda' : 'direita'), k: 'meioX', v: cx, a: 0.5 } };
    var giro = null;
    if (w && vis(11) && vis(12)) {
      var d3 = Math.hypot(w[11].x - w[12].x, w[11].y - w[12].y, w[11].z - w[12].z), pxm = (chao - imp[0].y) / (0.92 * alt());
      var r = Math.abs(imp[11].x - imp[12].x) / Math.max(1e-6, d3 * pxm); giro = Math.acos(Math.min(1, r)) * 180 / Math.PI;
      var nariz = imp[0].x - (imp[11].x + imp[12].x) / 2;   // nariz à esquerda da imagem = virou para a própria direita
      if (giro > 45 && P && VISTA[P.id] === 'frente') return { ok: false, grave: true, cue: Q(nariz < 0 ? '↺' : '↻', 'Você está virado para a sua ' + (nariz < 0 ? 'direita' : 'esquerda') + ', ' + graus(giro) + ' fora do celular', 'Gire o peito para a sua ' + (nariz < 0 ? 'esquerda' : 'direita'), giro, 45, 'graus') };
    }
    if (cx < 0.3 || cx > 0.7) return { ok: false, cue: { s: '↔', e: 'Você está um pouco à sua ' + (cx < 0.5 ? 'direita' : 'esquerda'), t: 'Dê meio passo para a sua ' + (cx < 0.5 ? 'esquerda' : 'direita'), k: 'meioX', v: cx, a: 0.5 } };
    if (tam < 0.33) return { ok: false, cue: { s: '⬆', e: 'Você está longe: ocupa só ' + Math.round(tam * 100) + ' por cento da altura da imagem', t: 'Dê dois passos para a frente, na direção do celular', k: 'perto', v: tam, a: 0.4 } };
    if (imp[0].y < 0.15 * H) return { ok: false, cue: { s: '⬇', e: 'Sua cabeça está quase no alto da imagem, sem espaço para o toss', t: 'Dê um passo para trás, ou incline o celular um pouco para cima', k: 'topo', v: imp[0].y / H, a: 0.2 } };
    if (giro !== null && giro > 30) return { ok: false, cue: Q('↻', 'Você está um pouco virado, ' + graus(giro) + ' fora do celular', 'Vire o peito de frente para o celular', giro, 30, 'graus') };
    return { ok: true, cue: null };
  }
  // primeira volta: só para conhecer as posições, sem corrigir
  var LIVRE = { cotovelo: 'Levante o cotovelo da raquete, bem alto e à frente, com a raquete solta atrás das costas, e a outra mão levantada.',
    esticar: 'Daí, estique o braço para cima e gire a mão, e volte ao cotovelo alto. Faça algumas vezes, no seu ritmo.',
    deLado: 'Agora de lado: gire o quadril para a frente, peso no pé da frente, cotovelo alto e a outra mão levantada.',
    esticarLado: 'De lado, estique o braço para cima, gire a mão e volte. Algumas vezes.',
    pronacao: 'Estique o braço e gire a mão: cordas para o alvo e continue girando até o polegar apontar para baixo. Algumas vezes.',
    trofeuArco: 'Troféu, como quem puxa um arco: cotovelo dobrado na altura do ombro e o braço da bola no alto.',
    quadrilCot: 'Do troféu, leve o quadril para a frente e suba o cotovelo, enquanto o braço da bola desce.' };
  function comAquecimento(lista) {
    var i = lista.findIndex(function (q) { return q.id === 'quadro'; }); if (i < 0) return lista;
    var corr = lista.slice(i + 1).filter(function (q) { return q.pose && !q.info; });
    var livres = corr.map(function (q) {
      return { id: q.id, livre: q.reps ? 7 : 4, nome: 'Conhecer: ' + q.nome, pose: q.pose, raq: q.raq,
        fala: LIVRE[q.id] || q.fala.split('. ')[0].replace(/\.?$/, '.') };
    });
    var aviso = { id: 'aviso', nome: 'Agora com correção', info: 12,
      fala: 'Pronto, você já conhece as posições. Agora vou corrigir cada posição conforme os profissionais. Só passo para a próxima quando estiver certa.' };
    return lista.slice(0, i + 1).concat(livres, [aviso], lista.slice(i + 1));
  }
  var PASSOS_V = [
    { id: 'empunhadura', nome: 'Empunhadura', info: 16, emp: 'continental',
      fala: 'Primeiro a empunhadura continental, como no desenho: a junta do indicador e a base da mão na face dois do cabo. Mão inclinada, um espaço entre o indicador e o dedo médio, e o dedo mínimo no fim do cabo. Aperte como num aperto de mão firme, com o cotovelo e o ombro soltos. Para eu conferir, toque em Conferir pela câmera.' },
    { id: 'quadro', nome: 'Corpo inteiro', pose: 'parado', fala: 'Fique a uns três ou quatro metros do celular, no meio da imagem, de corpo inteiro, com os pés aparecendo. Eu digo se precisa ir para a frente, para trás ou para o lado.',
      ok: function (f, inteiro, e) { return e.ok; }, cue: function (f, inteiro, e) { return e.cue; } },
    { id: 'cotovelo', nome: 'Cotovelo alto', pose: 'atras', segurar: 1.5, raq: 'solta atrás das costas, com a ponta para o chão.',
      fala: 'Com os pés apontando para o celular, suba o cotovelo da raquete o mais alto e o mais à frente que puder, com a raquete solta atrás das costas, e a outra mão levantada, apontando para cima.',
      ok: ARMADO, cue: function (f) { return ARMADO(f) ? null : cueArmado(f); } },
    { id: 'esticar', nome: 'Esticar e girar', pose: 'contato', reps: 6, a: ARMADO, b: ESTICADO, nomeA: 'cotovelo alto', nomeB: 'braço esticado no alto',
      raq: 'sobe com a borda na frente, de lado, e lá no alto as cordas giram para o quadrado de saque, e a mão segue girando para fora.', raqCurta: 'Borda na frente, depois cordas para o quadrado.',
      fala: 'Agora, daí, estique o braço para cima e gire a mão, para as cordas apontarem para o quadrado de saque. Volte ao cotovelo alto, com a outra mão levantada, e repita, solto, como quem joga uma bola. Quadrado um, quadrado dois.',
      cueA: cueArmado, cueB: cueEsticado },
    { id: 'deLado', nome: 'De lado, quadril', pose: 'peso', segurar: 1.5, raq: 'atrás das costas, solta, com a ponta para o chão.',
      fala: 'Gire o quadril de trás para a frente, com o peso no pé da frente e as pernas esticadas, sem dobrar os joelhos. Cotovelo alto e à frente, e a outra mão levantada.',
      ok: function (f) { return f.lado < 50 && f.joelho < 18 && f.racCotAlt > 0.02 && BOLA_ALTA(f); },
      cue: function (f) {
        if (f.lado >= 50) return Q('↻', 'Você está muito de frente: ombros a ' + graus(f.lado) + ' da linha dos pés', 'Gire os ombros e o quadril mais de lado', f.lado, 50, 'graus');
        if (f.joelho >= 18) return Q('⬆', 'Seus joelhos estão dobrados, ' + graus(f.joelho), 'Estique as pernas', f.joelho, 18, 'graus');
        if (f.racCotAlt <= 0.02) return Q('⬆', altCot(f), 'Suba o cotovelo da raquete, à frente', f.racCotAlt, 0.02, 'cm');
        return Q('☝', maoBaixa(f), 'Levante a mão ' + maoBola() + ', apontando para cima', f.bolaAcima, -0.05, 'cm'); } },
    { id: 'esticarLado', nome: 'Esticar de lado', pose: 'contato', reps: 6, a: ARMADO, b: ESTICADO, nomeA: 'cotovelo alto', nomeB: 'braço esticado no alto',
      raq: 'sobe de lado, com a borda na frente, e só no alto as cordas giram para o quadrado.', raqCurta: 'Borda na frente, depois gire as cordas.',
      fala: 'De lado, com a outra mão levantada, repita: estique para cima e gire a mão para o quadrado. Um, dois.',
      cueA: cueArmado, cueB: cueEsticado },
    { id: 'pronacao', nome: 'Pronação 180°', pose: 'contato', reps: 6, a: ARMADO, b: ESTICADO, nomeA: 'cotovelo alto', nomeB: 'braço esticado, mão girada para fora',
      raq: 'sobe de lado, com a borda na frente, como uma faca. No contato, as cordas olham para o alvo. Depois do contato, a mão continua girando até a palma olhar para fora e o polegar apontar para baixo: meia volta, 180 graus.',
      raqCurta: 'Borda, cordas no alvo, e continue girando: polegar para baixo.',
      fala: 'Agora a pronação, o giro do antebraço. Os profissionais fazem em todos os saques: chapado, slice e kick. A raquete sobe de lado, com a borda na frente. No alto, as cordas giram para o alvo, e a mão não para: continua girando até a palma olhar para fora e o polegar apontar para baixo. Meia volta, de dentro para fora. Para onde as cordas olham no contato, a bola vai. Estique, gire e volte ao cotovelo alto.',
      cueA: cueArmado, cueB: function (f) { var c = cueEsticado(f); return c.s === '✓' ? { s: '✓', t: 'Isso! Continue girando a mão até o polegar apontar para baixo, e volte' } : c; } },
    { id: 'trofeuArco', nome: 'Troféu 90/90', pose: 'trofeu', segurar: 4, troca: true, raq: 'ponta para cima, borda virada para a frente, como uma faca. As cordas olham para o lado, não para a rede.',
      fala: 'Posição de troféu, como quem puxa a corda de um arco: noventa graus no cotovelo e noventa graus no ombro. A ponta da raquete para a frente e para cima, e o braço da bola no alto. Segure três segundos.',
      ok: function (f) { return f.racCot > 65 && f.racCot < 120 && f.abd > 65 && f.abd < 120 && f.bolaVert < 40; },
      cue: function (f) {
        if (f.bolaVert >= 40) return Q('⬆', 'O braço da bola está caído, ' + graus(f.bolaVert) + ' da vertical', 'Suba o braço da bola, apontando para o céu', f.bolaVert, 40, 'graus');
        if (f.abd <= 65) return Q('⬆', 'Seu cotovelo está baixo: o ombro abre só ' + graus(f.abd), 'Suba o cotovelo até a altura do ombro', f.abd, 65, 'graus');
        if (f.abd >= 120) return Q('⬇', 'Seu cotovelo está alto demais: o ombro abre ' + graus(f.abd), 'Baixe o cotovelo até a altura do ombro', f.abd, 120, 'graus');
        if (f.racCot >= 120) return Q('↙', 'Seu braço está muito aberto, ' + graus(f.racCot) + ' no cotovelo', 'Dobre o cotovelo em noventa graus', f.racCot, 120, 'graus');
        return Q('↗', 'Seu braço está muito fechado, ' + graus(f.racCot) + ' no cotovelo', 'Abra um pouco o cotovelo, até noventa graus', f.racCot, 65, 'graus'); } },
    { id: 'quadrilCot', nome: 'Quadril e cotovelo', pose: 'contato', reps: 5, nomeA: 'troféu', nomeB: 'cotovelo para cima, quadril à frente',
      raq: 'cai solta atrás das costas, com a ponta para o chão.', raqCurta: 'Raquete solta, ponta para o chão.',
      a: function (f) { return f.racCot < 125 && f.bolaAcima > -0.1; }, b: function (f) { return f.racCotAlt > 0.18 && f.bolaAcima < -0.2; },
      fala: 'Do troféu, leve o quadril para a frente e suba o cotovelo ao mesmo tempo, enquanto o braço da bola desce. A mão da raquete cai solta atrás das costas. Volte ao troféu e repita.',
      cueA: function (f) { return f.bolaAcima <= -0.1 ? Q('☝', maoBaixa(f), 'Volte ao troféu: levante a mão ' + maoBola(), f.bolaAcima, -0.1, 'cm') : Q('↩', 'Seu braço da raquete está aberto, ' + graus(f.racCot), 'Volte ao troféu: dobre o braço da raquete', f.racCot, 125, 'graus'); },
      cueB: function (f) { return f.racCotAlt <= 0.18 ? Q('⬆', altCot(f), 'Suba mais o cotovelo da raquete', f.racCotAlt, 0.18, 'cm') : Q('⬇', 'Sua mão ' + maoBola() + ' ainda está alta, ' + cmTxt(f.bolaAcima) + (f.bolaAcima < 0 ? ' abaixo' : ' acima') + ' do nariz', 'Agora baixe a mão ' + maoBola() + ' junto ao corpo', f.bolaAcima, -0.2, 'cm'); } },
    { id: 'toss', nome: 'Toss parado', info: 14, pose: 'trofeu',
      fala: 'Por fim, o toss. No troféu, só o braço da bola se mexe: solte a bola na altura dos olhos, com o braço e o punho retos, sem agachar. Espere a bola parar lá no alto e só então bata, de baixo para cima. Toque em Tentativa para treinar assim.' }
  ];
  var PROGRAMAS = { viks: comAquecimento(PASSOS_V), classico: comAquecimento(PASSOS) }, LISTA = PROGRAMAS.viks;
  var passo = 0, desde = 0, ultimaDica = 0, okDesde = 0, ultimaFala = 0, ultimaCue = '', repN = 0, repFase = 'a', ultimoOk = 0, disseSegure = false, ultimoFalando = 0;
  var movHist = [], paradoDesde = 0;
  function atualizarParado(f, agora) {
    var v = [f.racCot / 100, f.racAcima, f.racCotAlt, f.bolaAcima];
    movHist.push({ t: agora, v: v }); while (movHist.length && agora - movHist[0].t > 0.8) movHist.shift();
    var mexeu = movHist.some(function (h) { return h.v.some(function (x, i) { return Math.abs(x - v[i]) > 0.08; }); });
    if (mexeu) paradoDesde = agora; else if (!paradoDesde) paradoDesde = agora;
    return !mexeu && agora - paradoDesde > 0.4;
  }
  function cueDe(c, f) { return typeof c === 'function' ? c(f) : c; }
  function vistaAntes(k) { for (var j = k - 1; j >= 0; j--) if (LISTA[j].pose) return VISTA[LISTA[j].id]; return null; }
  function falaDe(P, k) {
    if (k === undefined) k = LISTA.indexOf(P);
    var v = P.pose && VISTA[P.id], cel = v && v !== vistaAntes(k) ? celFala(v) + ' ' : '';
    return cel + P.fala + (P.raq ? ' Raquete: ' + P.raq : '');
  }
  function faltamTxt(n) { return n === 1 ? 'Falta uma, a última!' : 'Faltam ' + n + '.'; }
  function comecarGuia() {
    LISTA = PROGRAMAS[cfg.post.prog || 'viks'] || PROGRAMAS.viks;
    passo = 0; okDesde = 0; $('poPassoC').style.display = ''; mostrarPasso(); falar(falaDe(LISTA[0], 0)); ultimaFala = performance.now() / 1000;
    estado('🧭 Siga a voz. Primeiro uma volta só para conhecer as posições; depois eu corrijo cada uma. ⏭ pula um passo.');
  }
  function mostrarPasso() {
    var P = LISTA[passo]; desde = performance.now() / 1000; ultimaDica = desde; repN = 0; repFase = 'a'; okDesde = 0; ultimoOk = 0; disseSegure = false; ultimoFalando = desde; movHist = []; paradoDesde = 0; cueRef = null; tendencia = ''; ultimaCue = '';
    $('poPasso').textContent = (passo + 1) + '/' + LISTA.length + ' · ' + P.nome + (P.reps ? ' (' + P.reps + ' vezes)' : ''); $('poDica').textContent = P.fala;
    $('poLista').innerHTML = LISTA.map(function (q, i) { return '<span class="' + (i < passo ? 'feito' : i === passo ? 'atual' : '') + '">' + (i < passo ? '✓ ' : '') + q.nome + '</span>'; }).join('');
    var vi = P.pose && VISTA[P.id]; $('poCel').style.display = vi ? '' : 'none'; $('poCel').innerHTML = vi ? celCurto(vi) : '';
    $('poRaq').style.display = P.raq ? '' : 'none'; $('poRaq').innerHTML = P.raq ? '🎾 <b>Raquete:</b> ' + P.raq + '<div class="peq" style="margin-top:4px">A câmera não enxerga a raquete: confira você.</div>' : '';
    $('poInfo').innerHTML = P.emp && window.Empunhadura ? Empunhadura.cartao(P.emp) : '';
    if (P.emp && window.Empunhadura) { Empunhadura.desenharTodos($('poInfo')); if (window.Pegada) { var bp = document.createElement('button'); bp.className = 'bt verde'; bp.textContent = '✋ Conferir pela câmera, de perto'; bp.onclick = function () { Pegada.abrir(); }; $('poInfo').appendChild(bp); } }
    $('poIdeal').style.display = P.pose ? '' : 'none';
    if (P.pose) desenharIdeal($('poIdeal'), P.pose);
  }
  function irPasso(k) {
    passo = Math.max(0, Math.min(LISTA.length - 1, k)); mostrarPasso(); falar(falaDe(LISTA[passo])); ultimaFala = performance.now() / 1000;
  }
  function concluirPasso(agora) {
    passo++; okDesde = 0;
    if (passo >= LISTA.length) {
      $('poLista').innerHTML = LISTA.map(function (q) { return '<span class="feito">✓ ' + q.nome + '</span>'; }).join('');
      $('poPasso').textContent = '🏆 Programa completo!'; $('poDica').textContent = 'Agora toque em Tentativa e faça o movimento inteiro jogando a bola.'; $('poInfo').innerHTML = ''; $('poRaq').style.display = 'none'; $('poCel').style.display = 'none';
      falar('Muito bem! Programa completo. Agora toque em Tentativa e faça o movimento inteiro jogando a bola.'); grande('🏆', '#22c55e');
      return;
    }
    var antes = LISTA[passo - 1]; mostrarPasso(); falar((antes.livre || antes.info ? '' : 'Isso! ') + falaDe(LISTA[passo], passo)); ultimaFala = agora;
  }
  function desenharIdeal(c, nome) {
    var g = c.getContext('2d'); g.fillStyle = '#0a1712'; g.fillRect(0, 0, c.width, c.height);
    var s = Math.min((c.height - 20) / 3.1, c.width / 1.7), esp = cfg.post.mao === 'e';
    g.fillStyle = '#0f3a2b'; g.fillRect(0, c.height - 14, c.width, 14);
    Boneco.desenhar(g, Boneco.chave(nome), { x: c.width / 2 + (esp ? 0.15 : -0.15) * s, y: c.height - 14, s: s, juntas: true, espelho: esp, bola: nome === 'solta' ? [0.27, 2.2] : null });
  }
  // acompanha a correção: compara a medida de agora com a da última fala, rumo à meta
  var cueRef = null, cueIni = null, tendencia = '';
  function faltaTxt(d, un) { return un === 'cm' ? (Math.round(d * 100) || 1) + ' centímetros' : un === 'graus' ? (Math.round(d) || 1) + ' graus' : ''; }
  function minimo(un) { return un === 'cm' ? 0.03 : un === 'graus' ? 5 : 0.04; }
  function progresso(dica) {      // 'melhor' | 'pior' | 'igual' | null, comparado com a última fala
    if (!dica.k || dica.k !== ultimaCue || dica.v == null || cueRef == null) return null;
    var d0 = Math.abs(cueRef - dica.a), d1 = Math.abs(dica.v - dica.a), lim = Math.max(minimo(dica.un), 0.15 * d0);
    return d0 - d1 > lim ? 'melhor' : d1 - d0 > lim ? 'pior' : 'igual';
  }
  function dizer(dica, agora, parado) {     // fala curta, sem atropelar a explicação do passo
    var falando = window.speechSynthesis && speechSynthesis.speaking, chave = dica.k || dica.t;
    if (agora - desde <= 2 || (falando && agora - ultimaFala <= 6) || agora - ultimaFala <= 2.5) return;
    var nova = chave !== ultimaCue, pr = nova ? null : progresso(dica), txt;
    if (parado === false && pr !== 'melhor') return;           // em movimento só fala se estiver melhorando
    if (nova) { txt = (dica.e ? dica.e + '. ' : '') + dica.t; cueIni = dica.v; }
    else {
      if (agora - ultimaFala <= 3.5) return;
      var d1 = dica.v != null ? Math.abs(dica.v - dica.a) : null, falta = d1 != null ? faltaTxt(d1, dica.un) : '';
      if (pr === 'melhor') txt = (cueIni != null && d1 < 0.35 * Math.abs(cueIni - dica.a) ? 'Quase lá! ' : 'Melhorou! Continue. ') + (falta ? 'Falta ' + falta + '.' : dica.t);
      else if (pr === 'pior') txt = 'Piorou. ' + (dica.e ? dica.e + '. ' : '') + dica.t;
      else txt = (dica.e ? 'Ainda: ' + dica.e.charAt(0).toLowerCase() + dica.e.slice(1) + '. ' : '') + dica.t + (falta ? ', falta ' + falta : '');
    }
    tendencia = pr === 'melhor' ? '↗ melhorando' : pr === 'pior' ? '↘ piorou' : '';
    falar(txt); ultimaFala = agora; ultimaCue = chave; cueRef = dica.v != null ? dica.v : null;
  }
  function linhaDica(dica) {
    return (dica.e ? '<span style="color:#eef5f1">' + dica.e + '</span><br>' : '') + dica.t +
      (dica.m || tendencia ? '<br><span class="peq" style="color:#d6e6dd">' + (dica.m || '') + (tendencia && dica.k === ultimaCue ? (dica.m ? ' · ' : '') + tendencia : '') + '</span>' : '');
  }
  function mostrarDica(dica) { grande(dica.s + ' ' + dica.t, '#facc15'); $('poDica').innerHTML = linhaDica(dica); }
  function guia(w, t, imp) {
    if (passo >= LISTA.length) return;
    var agora = performance.now() / 1000, P = LISTA[passo];
    if (P.livre) {                                  // só para conhecer: sem corrigir, passa depois de uns segundos na posição
      var fal = window.speechSynthesis && speechSynthesis.speaking; if (fal) ultimoFalando = agora;
      var resta = Math.max(0, Math.ceil(P.livre - (agora - ultimoFalando)));
      grande(fal ? '👂 ouça' : '🙂 faça… ' + resta, '#9db8ab'); $('poDica').textContent = P.fala + ' (sem correção)';
      if (agora - desde > 3 && !fal && agora - ultimoFalando > P.livre) concluirPasso(agora);
      return;
    }
    if (P.info) {                                   // passo só de explicação: passa sozinho depois de falar
      grande(''); var falando = window.speechSynthesis && speechSynthesis.speaking;
      if (agora - desde > P.info || (agora - desde > 6 && !falando)) { if (passo === LISTA.length - 1) { concluirPasso(agora); } else concluirPasso(agora); }
      return;
    }
    var inteiro = !!imp && [0, 11, 12, 27, 28, 29, 30].every(function (i) { return imp[i].v > 0.5 && imp[i].y > 0 && imp[i].y < proc.height * 0.97; });
    var enq = enquadrar(imp, w, P);
    if (enq.grave && P.id !== 'quadro') { okDesde = 0; mostrarDica(enq.cue); dizer(enq.cue, agora, true); return; }
    var f = null;
    if (w) {
      var lb = ladoBolaPadrao();
      // se o modelo trocou esquerda/direita, nas posições com o braço da bola no alto, o braço mais alto é o da bola
      if (P.troca) { var fa = medir(w, 'E'), fb = medir(w, 'D'); if (Math.abs(fa.bolaAcima - fb.bolaAcima) > 0.15) lb = fa.bolaAcima > fb.bolaAcima ? 'E' : 'D'; }
      f = medir(w, lb, imp);
    }
    var parado = f ? atualizarParado(f, agora) : true;   // fala a correção só quando a pessoa para (no meio do movimento passa por posições erradas)
    if (P.reps) {                                   // repetições contadas: vai de A (armado) a B (esticado) e volta
      if (!f) { mostrarDica(naoVejo()); return; }
      var placar = function () { return repN + ' de ' + P.reps + ' · ' + faltamTxt(P.reps - repN).replace(', a última!', ''); };
      var mostrarRep = function (cue, pos) {
        grande(cue.s + ' ' + cue.t, '#facc15');
        $('poDica').innerHTML = (pos ? '✓ ' + pos + '<br>' : '') + linhaDica(cue) + '<br><span class="peq" style="color:#d6e6dd">' + placar() + '</span>';
      };
      if (repFase === 'a') {
        if (P.a(f)) { repFase = 'b'; mostrarRep(cueDe(P.cueB, f), P.nomeA ? 'Posição: ' + P.nomeA : ''); }
        else { var ca = cueDe(P.cueA, f); mostrarRep(ca); if (parado) dizer(ca, agora, true); }
      }
      if (repFase === 'b') {
        if (P.b(f)) {
          repN++; repFase = 'a';
          if (repN >= P.reps) { grande('✓ ' + repN + ' de ' + P.reps, '#22c55e'); concluirPasso(agora); return; }
          grande('✓ ' + repN + ' de ' + P.reps + ' · faltam ' + (P.reps - repN), '#22c55e');
          $('poDica').innerHTML = '✓ ' + (P.nomeB ? 'Posição: ' + P.nomeB : 'Isso') + '<br>Volte: ' + (P.nomeA || 'posição inicial') + '<br><span class="peq" style="color:#d6e6dd">' + placar() + '</span>';
          // fala o número e quantos faltam; na 1ª e na do meio lembra a raquete
          var lembra = P.raqCurta && (repN === 1 || repN === Math.ceil(P.reps / 2)) ? ' ' + P.raqCurta : '';
          falar(repN + '. ' + faltamTxt(P.reps - repN) + lembra); ultimaFala = agora + (lembra ? 1.5 : 0); ultimaCue = '';
        } else if (!P.a(f) || agora - ultimaFala > 3) { var cb = cueDe(P.cueB, f); mostrarRep(cb); if (parado) dizer(cb, agora, true); }
      }
      return;
    }
    var ok = f ? P.ok(f, inteiro, enq) : false;
    var dica = f ? P.cue(f, inteiro, enq) : naoVejo();
    // tolerância: uma oscilação curta (< 0,4 s) não zera a contagem
    if (ok) ultimoOk = agora;
    var segurando = okDesde && agora - ultimoOk < 0.4;
    if (ok || segurando) {
      if (!okDesde) okDesde = agora;
      if (!disseSegure && P.segurar && agora - ultimaFala > 1.5) { falar(P.raq && P.segurar >= 3 ? 'Isso, segure! Confira a raquete: ponta para cima, borda para a frente.' : 'Isso, segure!'); ultimaFala = agora; disseSegure = true; }
      grande(P.segurar ? '✓ segure… ' + Math.max(1, Math.ceil(P.segurar - (agora - okDesde))) : '✓ isso!', '#22c55e');
      $('poDica').textContent = '✓ Certo! Segure um instante.';
      if (agora - okDesde > (P.segurar || 0.7)) concluirPasso(agora);
    } else {
      okDesde = 0;
      if (dica) { mostrarDica(dica); dizer(dica, agora, parado || P.id === 'quadro'); } else grande('');
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
    // segue a bola desde a mão do toss, quadro a quadro (manchas amarelas fora da trajetória, como a raquete, ficam de fora)
    var apice = null, saiu = false, bolas = [], puB = IDX[lb].pu;
    (function () {
      var jan = fr.filter(function (h) { return h.t >= rel.t - 0.3 && h.t <= rel.t + 1.6; }), ult = null, vel = [0, -4.5 * pxm], falta = 0, tUlt = 0;   // começa supondo a bola subindo (toss)
      for (var k = 0; k < jan.length; k++) {
        var h = jan[k], cs = h.bolas || [];
        if (!ult) {       // início: perto da mão do toss, perto do instante em que soltou
          if (h.t > rel.t + 0.3) break;
          var m = h.im[puB], c0 = null;
          cs.forEach(function (c) { var d = Math.hypot(c[0] - m.x, c[1] - m.y); if (d < 0.45 * pxm && (!c0 || d < c0.d)) c0 = { c: c, d: d }; });
          if (c0) { ult = c0.c; tUlt = h.t; bolas.push({ t: h.t, bola: c0.c, im: h.im }); }
          continue;
        }
        var dt = h.t - tUlt, pred = [ult[0] + vel[0] * dt, ult[1] + vel[1] * dt + 0.5 * 9.8 * pxm * dt * dt], gate = (bolas.length < 2 ? 0.8 : 0.45) * pxm + 0.9 * dt * pxm, best = null;
        cs.forEach(function (c) { var d = Math.hypot(c[0] - pred[0], c[1] - pred[1]); if (d < gate && (!best || d < best.d)) best = { c: c, d: d }; });
        if (best) {
          vel = [(best.c[0] - ult[0]) / dt, (best.c[1] - ult[1]) / dt - 0.5 * 9.8 * pxm * dt]; ult = best.c; tUlt = h.t; falta = 0;
          bolas.push({ t: h.t, bola: best.c, im: h.im });
        } else if (++falta > 8) break;
      }
      bolas.forEach(function (h) { if (!apice || h.bola[1] < apice.bola[1]) apice = h; });
      if (bolas.length && ult && ult[1] < proc.height * 0.12 && falta > 0) saiu = true;    // sumiu pelo alto
    })();
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
    // "frente" = para onde aponta a ponta do pé da frente (de lado, ele aponta para a rede). Com os pés para a câmera, não dá para saber.
    var tossFrente = null, ini = antes[antes.length - 1].im, pF = ini[IDX[lb].pe], cF = ini[IDX[lb].ca];
    var pe = Math.hypot(pF.x - cF.x, pF.y - cF.y);
    if (apice && pxm > 0 && pe > 0.12 * pxm && Math.abs(pF.x - cF.x) > 0.6 * pe) tossFrente = (apice.bola[0] - pF.x) * Math.sign(pF.x - cF.x) / pxm;

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
    var ini = (cfg.post.nivel || 'ini') === 'ini';
    if (pesOk) item('Pernas só depois de soltar', dobraAntes > 15 ? 'dobrou antes' : 'ok', dobraAntes > 15 ? 'ruim' : 'ok', ini ? 'Você agachou para jogar a bola. O toss é só com o braço: as pernas ficam paradas (VIKSTENNIS).' : 'Você dobrou as pernas antes de soltar a bola. O toss é só com o braço; dobre os joelhos enquanto a bola sobe.', 1);
    var jb = tro.f.joelho;
    if (pesOk && !ini) item('Joelhos no troféu', Math.round(jb) + '°', jb >= 25 ? 'ok' : jb >= 15 ? 'meio' : 'ruim', jb < 15 ? 'A perna não dobrou. Dobre os joelhos no troféu.' : 'Dobre um pouco mais os joelhos no troféu.', 1.3);
    item('Cotovelo da raquete', tro.f.racCotAlt >= -0.13 ? 'na altura do ombro' : n2(-tro.f.racCotAlt) + ' m abaixo', tro.f.racCotAlt >= -0.13 ? 'ok' : tro.f.racCotAlt >= -0.22 ? 'meio' : 'ruim', 'Suba o cotovelo da raquete até a altura do ombro no troféu.', 1);
    if (ini) item('Troféu 90° e 90° (arco e flecha)', 'cotovelo ' + Math.round(tro.f.racCot) + '° · ombro ' + Math.round(tro.f.abd) + '°',
      tro.f.racCot > 60 && tro.f.racCot < 125 && tro.f.abd > 60 && tro.f.abd < 125 ? 'ok' : 'meio',
      tro.f.abd <= 60 ? 'No troféu, suba o cotovelo até a altura do ombro: noventa graus no ombro, como quem puxa a corda de um arco.' : tro.f.abd >= 125 ? 'No troféu, o cotovelo subiu demais: noventa graus no ombro.' : 'No troféu, noventa graus no cotovelo, como quem puxa a corda de um arco.', 0.9);
    else item('Braço da raquete em L', Math.round(tro.f.racCot) + '°', tro.f.racCot >= 55 && tro.f.racCot <= 135 ? 'ok' : 'meio', tro.f.racCot > 135 ? 'No troféu, dobre o braço da raquete em L.' : 'No troféu, abra um pouco o braço da raquete, em L.', 0.7);
    item('Braço da bola no alto no troféu', Math.round(tro.f.bolaVert) + '° da vertical', tro.f.bolaVert < 40 ? 'ok' : 'meio', 'Mantenha o braço da bola apontando para cima até a raquete começar a subir.', 0.7);
    item('Cotovelo na linha dos ombros', Math.round(tro.f.linha) + '°', tro.f.linha < 35 ? 'ok' : 'meio', 'No troféu, o cotovelo da raquete fica na mesma linha dos ombros, como uma reta inclinada.', 0.7);
    if (tro.f.racCotAlt > 0.22) itens.forEach(function (i) { if (i.nome === 'Cotovelo da raquete') { i.nota = 'meio'; i.valor = n2(tro.f.racCotAlt) + ' m acima (alto)'; i.dica = 'O cotovelo da raquete subiu demais no troféu: deixe na altura do ombro.'; } });
    item('Ombro da bola mais alto', n2(tro.f.incl) + ' m', tro.f.incl > 0.04 ? 'ok' : 'meio', 'No troféu, incline: o ombro do braço da bola mais alto que o da raquete.', 0.6);
    // VIKSTENNIS: no toss só o braço da bola se mexe, e o golpe só começa quando a bola para no alto
    if (ini) {
      var iniT = fr.filter(function (h) { return h.t >= tt.ini - 0.3 && h.t <= rel.t; }), p0 = iniT[0] && iniT[0].im[IDX[lb === 'E' ? 'D' : 'E'].pu], mov = 0;
      iniT.forEach(function (h) { var q = h.im[IDX[lb === 'E' ? 'D' : 'E'].pu]; if (p0 && pxm > 0) mov = Math.max(mov, Math.hypot(q.x - p0.x, q.y - p0.y) / pxm); });
      if (iniT.length >= 3) item('Corpo parado no toss', mov < 0.35 ? 'sim' : 'a raquete andou ' + n2(mov) + ' m', mov < 0.35 ? 'ok' : 'meio', 'No toss, só o braço da bola se mexe: deixe a raquete parada no troféu até a bola chegar no alto (VIKSTENNIS).', 0.8);
      var apiceT = apice ? apice.t : null, cot0 = rel.f.racCotAlt;      // só avalia quando a bola foi vista no alto
      var golpe = apiceT !== null && fr.filter(function (h) { return h.t > rel.t && (h.f.racCotAlt > cot0 + 0.15 || h.f.racAcima > 0.15); })[0];
      if (golpe) item('Esperou a bola no alto', golpe.t < apiceT - 0.2 ? 'começou ' + Math.round((apiceT - golpe.t) * 1000) + ' ms antes' : 'sim', golpe.t < apiceT - 0.2 ? 'meio' : 'ok',
        'Espere a bola parar no ponto mais alto e só então suba o cotovelo e bata (VIKSTENNIS).', 0.9);
    }
    if (pesOk && !ini) item('Impulso das pernas', '+' + n2(impulso) + ' m', impulso >= 0.06 ? 'ok' : 'meio', 'Depois do troféu, empurre o chão e estique as pernas para subir.', 0.6);
    if (saiu) item('Altura do toss', 'saiu do quadro', 'meio', 'A bola saiu por cima da imagem: afaste o celular ou deixe mais espaço acima da cabeça.', 0.4);
    else if (tossAlt !== null) {
      var acima = tossAlt - contato;
      item('Altura do toss', n2(tossAlt) + ' m (' + (acima >= 0 ? '+' : '') + n2(acima) + ' do contato)', acima < 0.05 ? 'ruim' : acima > 1.0 ? 'ruim' : acima > 0.7 ? 'meio' : 'ok',
        acima < 0.05 ? 'O toss foi muito baixo: a bola tem que subir acima do ponto de contato, uns 30 a 60 centímetros.' : 'O toss foi alto demais: suba a bola só uns 30 a 60 centímetros acima do contato.', 1.2);
      // iniciante (VIKSTENNIS): bola em cima da cabeça, um pouco à frente; avançado: para dentro da quadra
      var lim = ini ? [-0.3, -0.5] : [-0.05, -0.3];
      if (tossFrente !== null) item(ini ? 'Toss em cima da cabeça, um pouco à frente' : 'Toss para dentro da quadra', (tossFrente >= 0 ? n2(tossFrente) + ' m à frente do pé' : n2(-tossFrente) + ' m atrás do pé'), tossFrente >= lim[0] ? 'ok' : tossFrente >= lim[1] ? 'meio' : 'ruim',
        ini ? 'A bola foi para trás: jogue em cima da cabeça, um pouco à frente, para subir e bater de baixo para cima. Se o toss sair errado, segure a bola e recomece.' :
              'Jogue a bola para dentro da quadra, à frente do corpo: nunca em cima da cabeça ou atrás. Se o toss sair errado, segure a bola e recomece.', 1.1);
      if (tossLado !== null) item('Toss perto do corpo', n2(tossLado) + ' m do ombro', tossLado < 0.7 ? 'ok' : 'meio', 'A bola foi longe do corpo: solte a bola mais em cima do ombro, um pouco à frente.', 0.6);
    } else item('Altura do toss', 'não vi a bola no alto', 'meio', 'Não vi a bola subir e descer: use bola amarela, boa luz e deixe uns 1,5 m livres acima da cabeça na imagem.', 0.2);
    // pronação: a câmera não mede com segurança (testado com saques de profissional: ruído maior que o sinal).
    // Em vez de um palpite, guardamos os quadros do contato para o replay em câmera lenta.
    var replay = contatoQ && contatoQ.f.racAcima > 0.3 ? fr.filter(function (h) { return h.mao && h.t >= contatoQ.t - 0.35 && h.t <= contatoQ.t + 0.6; }) : [];
    return { itens: itens, tro: tro, rel: rel, trocado: trocado, lb: lb, tossAlt: tossAlt, replay: replay, apice: apice && { t: apice.t, b: apice.bola, om: apice.im[IDX[lb].om], pxm: pxm } };
  }

  function mostrarResultado(r) {
    window.PosturaUltimo = r;
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
  $('poVolta').onclick = function () { if (modo === 'guiado') irPasso(passo - 1); };
  $('poPula').onclick = function () {
    if (modo !== 'guiado' || passo >= LISTA.length) return;
    if (LISTA[passo].livre) { var k = LISTA.findIndex(function (q) { return q.id === 'aviso'; }); passo = k - 1; }
    concluirPasso(performance.now() / 1000);
  };
  $('poTentar').onclick = function () { iniciar('tentar'); };
  $('poPegada').onclick = function () { if (window.Pegada) Pegada.abrir(); };
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
