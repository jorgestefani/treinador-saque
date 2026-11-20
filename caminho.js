/* 🎵 Caminho com som: a câmera acompanha a MÃO DA RAQUETE durante o saque (feito devagar) e um som guia ao vivo:
   tom limpo que sobe = no caminho certo; zumbido grave = saiu do caminho; "plim" ao passar certo pelo troféu e pelo contato.
   Ao fim de cada repetição fala a nota e onde desviou (mão alta/baixa, à frente/atrás, em cm).
   O caminho de referência é o "modelo padrão" (o mesmo da fita na parede, medidas médias) ou o SEU modelo gravado.
   Coordenadas: origem no meio do quadril, unidade = tamanho do tronco (quadril→ombros) na imagem; u = para o lado da rede, v = para cima.
   Montagem igual à aba Posição: peito para o celular (o celular faz o papel da parede), rede à esquerda do destro. */
(function () {
  'use strict';
  var N = 80;   // pontos do caminho de referência

  /* ================================================================ núcleo (sem tela: testável no node) */
  function cr(p0, p1, p2, p3, t) {
    var t2 = t * t, t3 = t2 * t, r = [];
    for (var k = 0; k < p1.length; k++) { var a = p0[k], b = p1[k], c = p2[k], d = p3[k];
      r.push(0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)); }
    return r;
  }
  // reamostra uma linha [[u,v,...],...] em n pontos igualmente espaçados pelo comprimento (só u,v contam)
  function reamostrar(pts, n) {
    if (pts.length < 2) return null;
    var L = [0];
    for (var i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    var tot = L[L.length - 1]; if (tot < 1e-6) return null;
    var out = [], j = 0;
    for (var k = 0; k < n; k++) {
      var alvo = tot * k / (n - 1);
      while (j < pts.length - 2 && L[j + 1] < alvo) j++;
      var f = (alvo - L[j]) / ((L[j + 1] - L[j]) || 1e-9), p = [];
      for (var c = 0; c < pts[j].length; c++) p.push(pts[j][c] + (pts[j + 1][c] - pts[j][c]) * f);
      out.push(p);
    }
    return out;
  }
  // modelo padrão = os pontos da fita na parede (1,77 m: tronco ≈ 0,50 m, quadril a 0,95 m, ombro da raquete 0,2 m atrás do meio do corpo)
  // [u, v, giro dos ombros em graus (+ = virando para a rede)]
  var CHAVE_PADRAO = [
    [0.2, 0.1, 0], [-0.4, -0.2, 0], [-1.2, 0.3, -15], [-1.1, 1.3, -25],   // início, quadril, sobe atrás, TROFÉU
    [-0.6, 1.2, -10], [0.2, 2.7, 60], [0.7, 1.3, 80], [0.8, 0.1, 90]       // queda, CONTATO, terminação
  ];
  function modeloPadrao() {
    var K = CHAVE_PADRAO, denso = [];
    for (var i = 0; i < K.length - 1; i++)
      for (var s = 0; s < 20; s++) denso.push(cr(K[Math.max(0, i - 1)], K[i], K[i + 1], K[Math.min(K.length - 1, i + 2)], s / 20));
    denso.push(K[K.length - 1].slice());
    var pts = reamostrar(denso, N), m = completar({ pts: pts, nome: 'padrão' });
    var perto = function (k) { var b = 0; pts.forEach(function (p, i) { if (Math.hypot(p[0] - k[0], p[1] - k[1]) < Math.hypot(pts[b][0] - k[0], pts[b][1] - k[1])) b = i; }); return b; };
    m.trofeu = perto(K[3]); m.contato = perto(K[5]); return m;
  }
  // acha troféu (mão mais atrás, já no alto, antes do contato) e contato (ponto mais alto)
  function completar(m) {
    var p = m.pts, ic = 0, it = 0, i;
    for (i = 1; i < p.length; i++) if (p[i][1] > p[ic][1]) ic = i;
    var melhor = 1e9; for (i = 0; i < ic; i++) if (p[i][1] > 0.4 * p[ic][1] && p[i][0] < melhor) { melhor = p[i][0]; it = i; }
    m.trofeu = it; m.contato = ic; return m;
  }
  function fase(m, i) {
    if (i < m.trofeu - 4) return 'preparação';
    if (i <= m.trofeu + 3) return 'troféu';
    if (i < m.contato - 3) return 'queda da raquete';
    if (i <= m.contato + 3) return 'contato';
    return 'terminação';
  }
  // um passo do acompanhamento: procura o ponto do modelo mais perto, só para a frente (o caminho não volta)
  function seguir(m, s, u, v) {
    // janela curta para a frente: o caminho do saque dá voltas, e uma janela larga "pularia" para outro trecho
    var a = Math.max(0, s - 2), b = Math.min(m.pts.length - 1, s + 8), best = s, bc = 1e9;
    for (var i = a; i <= b; i++) { var c = Math.hypot(u - m.pts[i][0], v - m.pts[i][1]) + 0.012 * Math.abs(i - s); if (c < bc) { bc = c; best = i; } }
    return { s: Math.max(s, best), d: Math.hypot(u - m.pts[best][0], v - m.pts[best][1]), i: best };
  }
  // nota e comentário de uma repetição. amostras: [{i, u, v, d, giro}]; tol em troncos; cmTronco = cm de 1 tronco
  function avaliar(m, amostras, tol, cmTronco, sFinal) {
    if (amostras.length < 4) return null;
    var soma = 0, porFase = {};
    amostras.forEach(function (a) {
      var e = a.d / tol; soma += Math.max(0, Math.min(1, 1.5 - e));
      var f = fase(m, a.i), q = porFase[f] || (porFase[f] = { n: 0, fora: 0, du: 0, dv: 0, dg: 0, ng: 0 });
      q.n++; if (a.d > tol) q.fora++;
      if (a.giro !== null && a.giro !== undefined && m.pts[a.i][2] !== undefined) { q.dg += a.giro - m.pts[a.i][2]; q.ng++; }
    });
    // direção do erro: o seu caminho inteiro reamostrado ponto a ponto contra o modelo (o ponto mais perto esconderia o desvio)
    var seu = reamostrar(amostras.map(function (a) { return [a.u, a.v]; }), m.pts.length), M = sFinal + 1;
    if (seu) for (var k = 0; k < m.pts.length; k++) { var kk = Math.min(m.pts.length - 1, Math.round(k * M / m.pts.length)), q2 = porFase[fase(m, kk)];
      if (q2) { q2.du += seu[k][0] - m.pts[kk][0]; q2.dv += seu[k][1] - m.pts[kk][1]; q2.nd = (q2.nd || 0) + 1; } }
    var nota = 100 * soma / amostras.length, chegou = sFinal >= m.contato - 2;
    if (!chegou) nota = Math.min(nota, 45);
    var ordem = ['preparação', 'troféu', 'queda da raquete', 'contato', 'terminação'], fases = [];
    ordem.forEach(function (f) { var q = porFase[f]; if (!q) return;
      var du = q.du / (q.nd || 1) * cmTronco, dv = q.dv / (q.nd || 1) * cmTronco;
      fases.push({ fase: f, certo: Math.round(100 * (1 - q.fora / q.n)), du: Math.round(du), dv: Math.round(dv), giro: q.ng ? Math.round(q.dg / q.ng) : null }); });
    var pior = fases.slice().sort(function (a, b) { return a.certo - b.certo; })[0];
    return { nota: Math.round(nota), chegou: chegou, fases: fases, pior: pior };
  }
  function direcao(f) {   // "a mão ficou 12 cm baixa e 8 cm à frente"
    var p = [];
    if (Math.abs(f.dv) >= 6) p.push(Math.abs(f.dv) + ' centímetros ' + (f.dv > 0 ? 'alta demais' : 'baixa demais'));
    if (Math.abs(f.du) >= 6) p.push(Math.abs(f.du) + ' centímetros ' + (f.du > 0 ? 'à frente, para o lado da rede' : 'atrás'));
    return p.length ? 'a mão ficou ' + p.join(' e ') : 'a mão oscilou em volta do caminho';
  }
  function frase(r) {
    if (!r) return '';
    var t = 'Nota ' + r.nota + '. ';
    if (!r.chegou) return t + 'O movimento parou antes do contato. Vá até o fim, com a mão bem no alto.';
    var pior = r.fases.slice().sort(function (a, b) { return (Math.abs(b.du) + Math.abs(b.dv)) * (100 - b.certo) - (Math.abs(a.du) + Math.abs(a.dv)) * (100 - a.certo); })[0];
    if (pior && (pior.certo < 85 || Math.max(Math.abs(pior.du), Math.abs(pior.dv)) >= 10)) { r.pior = pior; t += { 'preparação': 'Na preparação', 'troféu': 'No troféu', 'queda da raquete': 'Na queda da raquete', contato: 'No contato', 'terminação': 'Na terminação' }[r.pior.fase] + ', ' + direcao(r.pior) + '. '; }
    else t += r.nota >= 85 ? 'Muito bem, caminho certo! ' : 'Bom caminho. ';
    var g = r.fases.filter(function (f) { return f.fase === 'contato' && f.giro !== null; })[0];
    if (g && g.giro < -25) t += 'Gire mais o corpo para a rede no contato.';
    return t.trim();
  }
  var nucleo = { N: N, reamostrar: reamostrar, modeloPadrao: modeloPadrao, completar: completar, seguir: seguir, avaliar: avaliar, frase: frase, fase: fase };
  if (typeof document === 'undefined') { module.exports = nucleo; return; }

  /* ================================================================ tela */
  function $(id) { return document.getElementById(id); }
  var VERSAO = '0.10.14';
  var URL_LIB = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + VERSAO + '/vision_bundle.mjs';
  var URL_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + VERSAO + '/wasm';
  var URL_MODELO = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';
  var cfg = (window.TS && TS.cfg) || {};
  cfg.post = cfg.post || { mao: 'd', cam: 'environment' };
  cfg.cam2 = cfg.cam2 || { exig: 'normal', usarMeu: false, meu: null, notas: [] };
  var C = cfg.cam2;
  function salvar() { if (window.TS) TS.salvar(); }
  function alt() { return (cfg.jog && cfg.jog.alt) || 1.77; }
  function falar(t) { if (!t) return; if (window.TS && TS.falar) TS.falar(t); else if (window.speechSynthesis) { speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(t); u.lang = 'pt-BR'; speechSynthesis.speak(u); } }
  var TOL = { facil: 0.42, normal: 0.30, dificil: 0.20 };

  var sec = document.createElement('section'); sec.id = 'caminho';
  sec.innerHTML =
    '<div class="cartao"><h2>🎵 Caminho com som</h2>' +
    '<div class="peq">Faça o saque <b>devagar</b>. A câmera segue a mão da raquete e o som guia na hora: ' +
    '<b>tom limpo subindo</b> = no caminho certo · <b>zumbido grave</b> = saiu do caminho · <b>plim</b> = passou certo pelo troféu e pelo contato. ' +
    'No fim de cada repetição eu falo a nota e onde a mão desviou.</div>' +
    '<details style="margin-top:6px"><summary class="peq" style="color:#eef5f1">📱 Como pôr o celular (toque para ver)</summary><div class="peq" style="line-height:1.55">' +
    '• Celular <b>em pé</b> no tripé, a uns <b>3 m</b>, na altura da cintura, e você com o <b>peito virado para ele</b> (ele faz o papel da parede). Destro: a rede fica à sua esquerda.<br>' +
    '• No quadro: o corpo inteiro e mais <b>1 m acima da cabeça</b>.<br>' +
    '• <b>Tire o iPhone do silencioso</b> (chave do lado) e aumente o volume: senão o som não sai.<br>' +
    '• Não precisa pôr nada na raquete: o app segue a sua mão.</div></details>' +
    '<div class="lado" style="margin-top:6px">' +
    '<label>Você é<br><select id="caMao"><option value="d">Destro</option><option value="e">Canhoto</option></select></label>' +
    '<label>Exigência<br><select id="caExig"><option value="facil">Fácil (±20 cm)</option><option value="normal">Normal (±15 cm)</option><option value="dificil">Difícil (±10 cm)</option></select></label>' +
    '<label>Caminho<br><select id="caMod"><option value="padrao">Padrão (fita da parede)</option><option value="meu">O meu (gravado)</option></select></label>' +
    '<label>Câmera<br><select id="caCam"><option value="environment">Traseira</option><option value="user">Frontal (você se vê)</option><option value="pc">Do computador</option></select></label></div>' +
    '<div class="lado"><button id="caIr" class="bt verde">▶ Começar com som</button><button id="caGravar" class="bt cinza">🎥 Gravar meu caminho</button></div>' +
    '<button id="caParar" class="bt vermelho" style="display:none">⏹ Parar</button>' +
    '<div id="caEstado" class="peq" style="text-align:center">Escolha um modo.</div></div>' +
    '<div id="caPalco" style="position:relative;width:100%;background:#000;border-radius:10px;overflow:hidden;display:none">' +
    '<video id="caVideo" playsinline muted autoplay style="position:absolute;inset:0;width:100%;height:100%"></video>' +
    '<canvas id="caDesenho" style="position:absolute;inset:0;width:100%;height:100%"></canvas>' +
    '<div id="caGrande" style="position:absolute;left:0;right:0;top:8px;text-align:center;font-size:26px;font-weight:800;text-shadow:0 2px 6px #000"></div></div>' +
    '<div class="cartao" id="caRes" style="display:none"><h2>📋 Última repetição</h2><div id="caResC"></div><canvas id="caHist" width="600" height="160" style="width:100%;margin-top:8px;background:#0a1712;border-radius:8px"></canvas></div>';
  document.body.insertBefore(sec, $('ajustes'));
  var bt = document.createElement('button'); bt.dataset.aba = 'caminho'; bt.textContent = '🎵 Caminho';
  var abaPos = document.querySelector('#abas button[data-aba="postura"]');
  $('abas').insertBefore(bt, abaPos ? abaPos.nextSibling : $('abas').children[1]);
  bt.onclick = function () { TS.abrirAba('caminho'); };
  [].forEach.call(document.querySelectorAll('#abas button'), function (b) { b.addEventListener('click', function () { if (b.dataset.aba !== 'caminho') parar(); }); });
  var PC = !('ontouchend' in document) && !/iPhone|iPad|Android/i.test(navigator.userAgent);
  $('caMao').value = cfg.post.mao || 'd'; $('caExig').value = C.exig; $('caMod').value = C.usarMeu && C.meu ? 'meu' : 'padrao';
  $('caCam').value = cfg.post.cam || (PC ? 'pc' : 'environment');
  $('caMao').onchange = function () { cfg.post.mao = this.value; salvar(); };
  $('caExig').onchange = function () { C.exig = this.value; salvar(); };
  $('caMod').onchange = function () {
    if (this.value === 'meu' && !C.meu) { this.value = 'padrao'; estado('Você ainda não gravou o seu caminho: toque em 🎥 Gravar meu caminho.'); return; }
    C.usarMeu = this.value === 'meu'; salvar(); modelo = modeloAtual(); };
  $('caCam').onchange = function () { cfg.post.cam = this.value; cfg.post.camEscolhida = true; salvar(); };

  function modeloAtual() { return C.usarMeu && C.meu ? completar({ pts: C.meu, nome: 'meu' }) : modeloPadrao(); }
  var modelo = modeloAtual();
  function estado(t) { $('caEstado').textContent = t; }
  function grande(t, cor) { $('caGrande').textContent = t || ''; $('caGrande').style.color = cor || '#eef5f1'; }

  /* ---------------------------------------------------------------- som (Web Audio) */
  var ac = null, osc = null, ganho = null, filtro = null;
  function somLigar() {
    var A = window.AudioContext || window.webkitAudioContext; if (!A) return;
    if (!ac) ac = new A();
    if (ac.state === 'suspended') ac.resume();
    if (osc) return;
    osc = ac.createOscillator(); ganho = ac.createGain(); filtro = ac.createBiquadFilter();
    filtro.type = 'lowpass'; filtro.frequency.value = 2500; ganho.gain.value = 0;
    osc.connect(filtro); filtro.connect(ganho); ganho.connect(ac.destination); osc.start();
  }
  function tom(freq, vol, tipo) {
    if (!osc) return; var t = ac.currentTime;
    if (tipo && osc.type !== tipo) osc.type = tipo;
    osc.frequency.setTargetAtTime(freq, t, 0.03); ganho.gain.setTargetAtTime(vol, t, 0.04);
  }
  function plim(f, dur) {
    if (!ac) return; var o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
    o.type = 'sine'; o.frequency.value = f || 1320; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.35));
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + (dur || 0.35) + 0.05);
  }
  function somDesligar() { if (osc) { try { osc.stop(); } catch (e) {} osc.disconnect(); osc = null; } }

  /* ---------------------------------------------------------------- câmera e reconhecimento do corpo (instância própria) */
  var lm = null, carregando = null;
  function carregar() {
    if (lm) return Promise.resolve(lm);
    if (carregando) return carregando;
    estado('⏳ Carregando o reconhecimento do corpo (só na primeira vez)…');
    carregando = import(URL_LIB).then(function (V) {
      return V.FilesetResolver.forVisionTasks(URL_WASM).then(function (fs) {
        function criar(del) { return V.PoseLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: URL_MODELO, delegate: del }, runningMode: 'VIDEO', numPoses: 1,
          minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5 }); }
        return criar('GPU').catch(function () { return criar('CPU'); });
      });
    }).then(function (x) { lm = x; return x; }, function (e) { carregando = null; throw e; });
    return carregando;
  }
  var video = $('caVideo'), tela = $('caDesenho'), g = tela.getContext('2d');
  var fluxo = null, ativo = false, modo = null, ultimoTs = 0, simulando = false;

  async function iniciar(m) {
    try {
      if (window.TS && TS.falar) TS.falar(' ');
      somLigar();                       // precisa ser no toque (iPhone)
      parar(); modo = m; modelo = modeloAtual();
      if (!simulando) {
        await carregar();
        var vc = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }; if (cfg.post.cam !== 'pc') vc.facingMode = cfg.post.cam || 'environment';
        fluxo = await navigator.mediaDevices.getUserMedia({ video: vc, audio: false });
        video.srcObject = fluxo; var esp = cfg.post.cam === 'user' || cfg.post.cam === 'pc' ? 'scaleX(-1)' : ''; video.style.transform = tela.style.transform = esp;
        $('caPalco').style.display = '';
        await video.play().catch(function () {});
        await new Promise(function (ok) { if (video.videoWidth) ok(); else video.onloadedmetadata = ok; });
        tela.width = video.videoWidth; tela.height = video.videoHeight;
        $('caPalco').style.aspectRatio = video.videoWidth + ' / ' + video.videoHeight;
        $('caPalco').style.width = 'min(100%, ' + (72 * video.videoWidth / video.videoHeight).toFixed(2) + 'vh)'; $('caPalco').style.margin = '0 auto';
      }
      $('caParar').style.display = ''; ativo = true; zerar();
      if (m === 'gravar') { gravadas = []; falar('Vamos gravar o seu caminho. Faça três saques bem feitos, devagar. Comece parado, com a raquete embaixo.'); estado('🎥 Gravando: faça 3 saques bem feitos, devagar (0 de 3).'); }
      else { falar('Fique parado na posição inicial, com a mão no círculo. Quando ouvir o bip, faça o saque devagar.'); estado('Fique parado com a mão no círculo amarelo.'); }
      if (!simulando) laço();
    } catch (e) {
      ativo = false;
      var msg = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'O iPhone bloqueou a câmera. Toque em “aA” → Ajustes do Site → Câmera = Permitir e recarregue.' :
        e && e.name === 'NotReadableError' ? 'A câmera está ocupada (pare a outra aba que usa a câmera).' : 'Não consegui iniciar: ' + ((e && e.message) || e) + '. Confira a internet.';
      estado('❌ ' + msg);
    }
  }
  function parar() {
    ativo = false; modo = null; tom(200, 0); somDesligar();
    if (fluxo) { fluxo.getTracks().forEach(function (t) { t.stop(); }); fluxo = null; }
    try { video.pause(); } catch (e) {} if (video.srcObject) video.srcObject = null;
    $('caParar').style.display = 'none'; grande('');
  }
  function laço() {
    if (!ativo) return;
    var prox = function () { if (!ativo) return; if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(laço); else requestAnimationFrame(laço); };
    if (video.readyState < 2) { prox(); return; }
    var ts = Math.round(performance.now()); if (ts <= ultimoTs) ts = ultimoTs + 1; ultimoTs = ts;
    var res = null; try { res = lm.detectForVideo(video, ts); } catch (e) {}
    var im = res && res.landmarks && res.landmarks[0], w = res && res.worldLandmarks && res.worldLandmarks[0];
    quadro(ts / 1000, im, w, tela.width, tela.height);
    prox();
  }

  /* ---------------------------------------------------------------- acompanhamento */
  var st, gravadas = [];
  function zerar() { st = { fase: 'espera', paradoDesde: null, ult: null, T: null, Ts: [], dir: 1, s: 0, amostras: [], rastro: [], ini: 0, plimT: false, plimC: false, u: null, v: null, perdido: 0, fim: 0, bruto: [] }; }
  function lados() { return cfg.post.mao === 'e' ? { R: [11, 13, 15], B: [12, 14, 16] } : { R: [12, 14, 16], B: [11, 13, 15] }; }
  function quadro(t, im, w, W, H) {
    g.clearRect(0, 0, W, H);
    if (!ativo) return;
    if (!im) { naoVejo(t); desenhar(null, W, H); return; }
    var L = lados(), P = function (i) { return { x: im[i].x * W, y: im[i].y * H, v: im[i].visibility === undefined ? 1 : im[i].visibility }; };
    var q1 = P(23), q2 = P(24), o1 = P(11), o2 = P(12), pu = P(L.R[2]), oR = P(L.R[0]), oB = P(L.B[0]);
    if (Math.min(q1.v, q2.v, o1.v, o2.v) < 0.4 || pu.v < 0.15) { naoVejo(t); return; }
    st.perdido = 0;
    var Hx = (q1.x + q2.x) / 2, Hy = (q1.y + q2.y) / 2, Sx = (o1.x + o2.x) / 2, Sy = (o1.y + o2.y) / 2, Tnow = Math.hypot(Sx - Hx, Sy - Hy);
    var T = st.T || Tnow;
    var giro = null;
    if (w) { var a = w[L.B[0]], b = w[L.R[0]]; giro = Math.atan2(a.z - b.z, Math.abs(a.x - b.x) + 1e-6) * 180 / Math.PI; }
    var u = (pu.x - Hx) * st.dir / T, v = (Hy - pu.y) / T;
    st.u = st.u === null ? u : 0.5 * st.u + 0.5 * u; st.v = st.v === null ? v : 0.5 * st.v + 0.5 * v;
    var ref = { Hx: Hx, Hy: Hy, T: T };
    var vel = st.ult ? Math.hypot(st.u - st.ult.u, st.v - st.ult.v) / Math.max(0.01, t - st.ult.t) : 0;
    st.ult = { u: st.u, v: st.v, t: t };
    if (modo === 'gravar') passoGravar(t, st.u, st.v, vel, giro, Tnow, oB, oR);
    else passoTreino(t, st.u, st.v, vel, giro, Tnow, oB, oR);
    desenhar(ref, W, H, pu);
  }
  function naoVejo(t) {
    st.perdido = (st.perdido || 0) + 1;
    if (st.fase === 'indo' && st.perdido > 20) terminar(t);
    if (st.fase === 'espera') { grande('👀 Não vejo o corpo inteiro', '#facc15'); tom(200, 0); }
  }
  function prepararParado(t, Tnow, oB, oR, vel, perto) {
    // parado (mão quase sem mexer) por 0,6 s: fixa o tamanho do tronco e o lado da rede
    if (vel < 0.6 && perto) {
      if (st.paradoDesde === null) st.paradoDesde = t;
      st.Ts.push(Tnow); if (st.Ts.length > 20) st.Ts.shift();
      if (t - st.paradoDesde > 0.6) {
        var o = st.Ts.slice().sort(function (a, b) { return a - b; }); st.T = o[o.length >> 1];
        st.dir = (oB.x - oR.x) >= 0 ? 1 : -1;
        return true;
      }
    } else { st.paradoDesde = null; st.Ts = []; }
    return false;
  }
  function passoTreino(t, u, v, vel, giro, Tnow, oB, oR) {
    var tol = TOL[C.exig] || 0.3, m = modelo;
    if (st.fase === 'espera') {
      var dIni = Math.hypot(u - m.pts[0][0], v - m.pts[0][1]);
      grande(dIni < 0.45 ? '✋ Parado…' : '⭕ Mão no círculo amarelo', '#facc15');
      if (prepararParado(t, Tnow, oB, oR, vel, dIni < 0.45)) { st.fase = 'pronto'; plim(880, 0.18); grande('▶ Pode ir, devagar', '#22c55e'); }
      return;
    }
    if (st.fase === 'pronto') {
      var r0 = seguir(m, 0, u, v);
      if (r0.s >= 3 && r0.d < tol * 2) { st.fase = 'indo'; st.ini = t; st.s = 0; st.amostras = []; st.rastro = []; st.plimT = st.plimC = false; }
      else return;
    }
    if (st.fase === 'indo') {
      var r = seguir(m, st.s, u, v); st.s = r.s;
      st.amostras.push({ i: r.i, u: u, v: v, d: r.d, giro: giro });
      st.rastro.push({ u: u, v: v, ok: r.d <= tol });
      var prog = st.s / (m.pts.length - 1);
      if (r.d <= tol) tom(330 + 600 * prog, 0.16, 'sine');
      else tom(150, Math.min(0.28, 0.12 + 0.1 * (r.d / tol - 1)), 'sawtooth');
      if (!st.plimT && st.s >= m.trofeu) { st.plimT = true; if (r.d <= tol) { plim(1320); grande('🏆 Troféu', '#22c55e'); } else grande('Troféu fora do caminho', '#ef4444'); }
      if (!st.plimC && st.s >= m.contato) { st.plimC = true; if (r.d <= tol) { plim(1760); grande('🎾 Contato!', '#22c55e'); } else grande('Contato fora do caminho', '#ef4444'); }
      var acabou = st.s >= m.pts.length - 3 || t - st.ini > 9 || (st.s >= m.contato && vel < 0.4 && t - st.ini > 1);
      if (acabou) terminar(t);
      return;
    }
    if (st.fase === 'fim' && t - st.fim > 2.5) { zerar(); }
  }
  function terminar(t) {
    tom(200, 0); var m = modelo, tol = TOL[C.exig] || 0.3;
    var cm = 100 * 0.283 * alt();   // 1 tronco ≈ 0,283 × altura
    var r = avaliar(m, st.amostras, tol, cm, st.s);
    st.fase = 'fim'; st.fim = t;
    if (!r) { zerar(); return; }
    var txt = frase(r); falar(txt);
    grande(r.nota + ' pontos', r.nota >= 80 ? '#22c55e' : r.nota >= 60 ? '#facc15' : '#ef4444');
    C.notas = (C.notas || []).concat([{ n: r.nota, d: Date.now() }]).slice(-60); salvar();
    mostrar(r, txt);
  }
  /* gravar o próprio caminho: 3 repetições; começa quando a mão sai do repouso embaixo, termina quando volta a parar depois de passar acima da cabeça */
  function passoGravar(t, u, v, vel, giro, Tnow, oB, oR) {
    if (st.fase === 'espera') {
      grande(v < 0.9 ? '✋ Parado, raquete embaixo…' : '⬇ Abaixe a mão da raquete', '#facc15');
      if (prepararParado(t, Tnow, oB, oR, vel, v < 0.9)) { st.fase = 'pronto'; plim(880, 0.18); grande('▶ Pode ir, devagar', '#22c55e'); st.base = { u: u, v: v }; }
      return;
    }
    if (st.fase === 'pronto') { if (Math.hypot(u - st.base.u, v - st.base.v) > 0.2) { st.fase = 'indo'; st.ini = t; st.bruto = [[st.base.u, st.base.v, 0]]; st.alto = false; } else return; }
    if (st.fase === 'indo') {
      st.bruto.push([u, v, giro === null ? 0 : giro]); st.rastro.push({ u: u, v: v, ok: true });
      if (v > 2.0) st.alto = true;
      if ((st.alto && v < 0.9 && vel < 0.5) || t - st.ini > 9) {
        st.fase = 'fim'; st.fim = t;
        var rs = st.alto ? reamostrar(st.bruto, N) : null;
        if (rs) { gravadas.push(rs); plim(1320); }
        var n = gravadas.length;
        if (!rs) { falar('Não vi a mão passar acima da cabeça. Repita.'); }
        else if (n < 3) { falar('Gravei a ' + n + '. Faltam ' + (3 - n) + '.'); }
        estado('🎥 Gravando: ' + n + ' de 3.');
        if (n >= 3) {
          var media = [];
          for (var i = 0; i < N; i++) { var p = [0, 0, 0]; gravadas.forEach(function (gv) { p[0] += gv[i][0] / 3; p[1] += gv[i][1] / 3; p[2] += gv[i][2] / 3; }); media.push(p); }
          C.meu = media.map(function (p) { return p.map(function (x) { return Math.round(x * 1000) / 1000; }); });
          C.usarMeu = true; salvar(); $('caMod').value = 'meu'; modelo = modeloAtual();
          falar('Pronto! Gravei o seu caminho. Agora toque em Começar com som para treinar com ele.');
          estado('✅ Seu caminho foi gravado e já está escolhido.'); parar();
        }
      }
      return;
    }
    if (st.fase === 'fim' && t - st.fim > 1.5) { var keep = gravadas; zerar(); gravadas = keep; }
  }

  /* ---------------------------------------------------------------- desenho por cima do vídeo */
  function desenhar(ref, W, H, pu) {
    if (!ref || !ref.T) return;
    var m = modelo, X = function (p) { return ref.Hx + p[0] * ref.T * st.dir; }, Y = function (p) { return ref.Hy - p[1] * ref.T; };
    var lw = Math.max(4, W / 150);
    if (modo !== 'gravar') {
      g.lineWidth = lw * 2.2; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = 'rgba(240,140,20,.75)';
      g.beginPath(); m.pts.forEach(function (p, i) { if (i) g.lineTo(X(p), Y(p)); else g.moveTo(X(p), Y(p)); }); g.stroke();
      [m.trofeu, m.contato].forEach(function (i) { var x = X(m.pts[i]), y = Y(m.pts[i]), r = lw * 3; g.strokeStyle = '#ef4444'; g.lineWidth = lw * 1.3;
        g.beginPath(); g.moveTo(x - r, y - r); g.lineTo(x + r, y + r); g.moveTo(x - r, y + r); g.lineTo(x + r, y - r); g.stroke(); });
      if (st.fase === 'espera' || st.fase === 'pronto') { g.strokeStyle = '#facc15'; g.lineWidth = lw; g.beginPath(); g.arc(X(m.pts[0]), Y(m.pts[0]), 0.45 * ref.T, 0, 7); g.stroke(); }
      if (st.fase === 'indo') { var alvo = m.pts[Math.min(m.pts.length - 1, st.s + 4)]; g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(X(alvo), Y(alvo), lw * 1.6, 0, 7); g.fill(); }
    }
    for (var i = 1; i < st.rastro.length; i++) { var a = st.rastro[i - 1], b = st.rastro[i];
      g.strokeStyle = b.ok ? '#22c55e' : '#ef4444'; g.lineWidth = lw * 1.3; g.beginPath(); g.moveTo(X([a.u, a.v]), Y([a.u, a.v])); g.lineTo(X([b.u, b.v]), Y([b.u, b.v])); g.stroke(); }
    if (pu) { g.fillStyle = '#38bdf8'; g.beginPath(); g.arc(pu.x, pu.y, lw * 2, 0, 7); g.fill(); }
  }
  function mostrar(r, txt) {
    $('caRes').style.display = '';
    var cor = function (c) { return c >= 80 ? '#22c55e' : c >= 60 ? '#facc15' : '#ef4444'; };
    $('caResC').innerHTML = '<div style="font-size:30px;font-weight:800;color:' + cor(r.nota) + '">' + r.nota + ' pontos</div><div style="margin:4px 0 8px">' + txt + '</div>' +
      r.fases.map(function (f) { return '<div style="display:flex;justify-content:space-between;border-top:1px solid #1f3a2f;padding:4px 0"><span>' + f.fase + '</span><span style="color:' + cor(f.certo) + '">' + f.certo + '% no caminho' +
        ((Math.abs(f.dv) >= 6 || Math.abs(f.du) >= 6) && f.certo < 90 ? ' · ' + (Math.abs(f.dv) >= 6 ? (f.dv > 0 ? '↑' : '↓') + Math.abs(f.dv) + ' cm ' : '') + (Math.abs(f.du) >= 6 ? (f.du > 0 ? '→ frente ' : '← atrás ') + Math.abs(f.du) + ' cm' : '') : '') + '</span></div>'; }).join('');
    var c = $('caHist'), x = c.getContext('2d'), ns = (C.notas || []).slice(-30);
    x.clearRect(0, 0, c.width, c.height); x.fillStyle = '#8aa'; x.font = '18px sans-serif'; x.fillText('Suas últimas notas', 10, 22);
    x.strokeStyle = '#22c55e'; x.lineWidth = 3; x.beginPath();
    ns.forEach(function (n, i) { var px = 20 + i * (c.width - 40) / Math.max(1, ns.length - 1), py = c.height - 15 - (n.n / 100) * (c.height - 45); if (i) x.lineTo(px, py); else x.moveTo(px, py); });
    x.stroke();
  }

  $('caIr').onclick = function () { iniciar('treino'); };
  $('caGravar').onclick = function () { iniciar('gravar'); };
  $('caParar').onclick = function () { parar(); estado('Parado.'); };

  /* teste sem câmera: Caminho.simular(erroU, erroV) — passa uma mão sintética pelo caminho (desvio opcional, em troncos) */
  function simular(eu, ev, gravar) {
    simulando = true; iniciar(gravar ? 'gravar' : 'treino');
    var W = 720, H = 1280; tela.width = W; tela.height = H; $('caPalco').style.display = ''; $('caPalco').style.aspectRatio = '720 / 1280'; $('caPalco').style.width = '300px';
    var m = modelo, T = 0.18 * H, Hx = 0.5 * W, Hy = 0.55 * H, k = 0, t0 = performance.now() / 1000;
    function lmk(u, v) {
      var a = []; for (var i = 0; i < 33; i++) a.push({ x: 0.5, y: 0.5, visibility: 1 });
      a[23] = { x: (Hx + 0.12 * T) / W, y: Hy / H, visibility: 1 }; a[24] = { x: (Hx - 0.12 * T) / W, y: Hy / H, visibility: 1 };
      a[11] = { x: (Hx + 0.4 * T) / W, y: (Hy - T) / H, visibility: 1 }; a[12] = { x: (Hx - 0.4 * T) / W, y: (Hy - T) / H, visibility: 1 };
      a[16] = { x: (Hx + u * T) / W, y: (Hy - v * T) / H, visibility: 1 }; return a;
    }
    var seq = [], i, r;
    for (r = 0; r < (gravar ? 3 : 1); r++) {
      for (i = 0; i < 30; i++) seq.push(m.pts[0]);
      for (i = 0; i < m.pts.length; i++) seq.push([m.pts[i][0] + (eu || 0) * (i > m.trofeu - 6 && i < m.contato ? 1 : 0), m.pts[i][1] + (ev || 0) * (i > m.trofeu - 6 && i < m.contato ? 1 : 0)]);
      for (i = 0; i < 90; i++) seq.push(m.pts[m.pts.length - 1]);
    }
    (function passo() {
      if (!ativo || k >= seq.length) { simulando = false; return; }
      var p = seq[k++]; quadro(t0 + k / 30, lmk(p[0], p[1]), null, W, H); setTimeout(passo, 33);
    })();
  }
  window.Caminho = { iniciar: iniciar, parar: parar, simular: simular, nucleo: nucleo, estado: function () { return st; } };
})();
