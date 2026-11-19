/* 🤖 Análise do jogo com IA (aba "Análise IA") — roda TODO no aparelho; o vídeo não sai do celular.
   1) Escolhe (ou grava) um vídeo de treino/jogo com o jogador inteiro no quadro e o celular parado.
   2) IA do Google no próprio aparelho (MediaPipe): Pose (corpo, 33 pontos) + Object Detector (bola: "sports ball").
   3) Acha cada GOLPE pelo pico de velocidade do punho da raquete, separa SAQUE / FOREHAND / BACKHAND,
      dá NOTA da técnica (0–100) com o que corrigir, estima a velocidade da bola quando ela aparece
      depois do golpe, e monta os DESTAQUES (só os trechos com golpe, sem o tempo parado), que dá para salvar em vídeo.
   4) Guarda o resumo de cada análise (histórico/evolução). Na aba 📊 Sessão: mapa das quedas dos saques medidos.
   Pontos do MediaPipe: 0 nariz · 11/12 ombros · 13/14 cotovelos · 15/16 punhos · 23/24 quadris · 25/26 joelhos · 27/28 tornozelos
   (ímpar = lado ESQUERDO da pessoa). */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  var VERSAO = '0.10.14';
  var URL_LIB = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + VERSAO + '/vision_bundle.mjs';
  var URL_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + VERSAO + '/wasm';
  var URL_POSE = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';
  var URL_BOLA = 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite';
  var CHAVE_HIST = 'ts.jogos';
  var cfg = (window.TS && TS.cfg) || {};
  cfg.post = cfg.post || { mao: 'd' };
  var NOME = { saque: 'Saque', fh: 'Forehand', bh: 'Backhand' };
  var COR = { saque: '#facc15', fh: '#22c55e', bh: '#38bdf8' };

  /* ------------------------------------------------------------------ tela */
  var sec = document.createElement('section'); sec.id = 'jogoia';
  sec.innerHTML =
    '<div class="cartao"><h2>🤖 Análise do jogo com IA</h2>' +
    '<div class="peq">Grave um treino ou jogo com o <b>celular parado</b> (tripé ou apoiado), pegando você <b>de corpo inteiro</b>. ' +
    'A IA acha cada golpe, separa <b>saque, forehand e backhand</b>, dá uma <b>nota da técnica</b> com o que corrigir e monta os ' +
    '<b>destaques sem o tempo parado</b>. Tudo roda no aparelho: o vídeo não sai do celular.</div>' +
    '<div class="lado" style="margin-top:8px"><label class="bt verde" style="text-align:center">🎬 Escolher ou gravar vídeo<input type="file" id="jgArq" accept="video/*" style="display:none"></label></div>' +
    '<div class="peq" style="margin-top:6px">Mão da raquete: <select id="jgMao"><option value="d">direita</option><option value="e">esquerda</option></select></div>' +
    '<div id="jgEstado" class="peq" style="margin-top:6px"></div>' +
    '<div id="jgBarra" style="height:8px;background:#0a1712;border-radius:4px;overflow:hidden;margin-top:6px;display:none"><div style="height:100%;width:0;background:var(--azul)"></div></div>' +
    '</div>' +
    '<div class="cartao" id="jgPlayer" style="display:none">' +
    '<div id="jgPar" style="display:flex;gap:6px;align-items:stretch">' +
    '<div style="position:relative;background:#000;border-radius:8px;overflow:hidden;flex:3;min-width:0">' +
    '<video id="jgVideo" playsinline muted preload="auto" style="width:100%;display:block"></video>' +
    '<canvas id="jgDes" style="position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none"></canvas></div>' +
    '<div id="jgBonC" style="flex:2;min-width:0;position:relative;background:#0a1712;border-radius:8px;overflow:hidden"><canvas id="jgBon" style="position:absolute;inset:0;width:100%;height:100%;display:block"></canvas></div></div>' +
    '<canvas id="jgLinha" style="width:100%;height:34px;display:block;margin-top:6px;border-radius:6px;background:#0a1712"></canvas>' +
    '<div class="chips" id="jgFiltro"><button data-f="todos" class="on">Todos</button><button data-f="saque">Saques</button><button data-f="fh">Forehand</button><button data-f="bh">Backhand</button></div>' +
    '<div class="chips"><button id="jgDestaques">▶ Destaques</button><button id="jgVel">Velocidade 1×</button><button id="jgEsq">🦴 Esqueleto: sim</button><button id="jgLado">🧍 Desenho ao lado: sim</button><button id="jgSalvar">💾 Salvar vídeo</button></div>' +
    '</div>' +
    '<div class="cartao" id="jgRes" style="display:none"><h2>📋 Resultado</h2><div id="jgResumo"></div><div id="jgLista" style="margin-top:8px"></div></div>' +
    '<div class="cartao"><h2>📈 Histórico das análises</h2><div id="jgHist" class="peq"></div></div>';
  document.body.insertBefore(sec, $('ajustes'));
  var bt = document.createElement('button'); bt.dataset.aba = 'jogoia'; bt.textContent = '🤖 Análise IA';
  $('abas').insertBefore(bt, $('abas').children[2] || null);
  bt.onclick = function () { TS.abrirAba('jogoia'); mostrarHist(); };
  $('jgMao').value = cfg.post.mao || 'd';
  $('jgMao').onchange = function () { cfg.post.mao = this.value; if (window.TS) TS.salvar(); if (frames.length) { analisar(); } };

  function estado(t) { $('jgEstado').innerHTML = t; }
  function barra(f) { var b = $('jgBarra'); b.style.display = f === null ? 'none' : 'block'; if (f !== null) b.firstChild.style.width = Math.round(f * 100) + '%'; }

  /* ------------------------------------------------------------------ IA no aparelho */
  var pose = null, bola = null, carregando = null, ultTs = 0;
  function carregar() {
    if (pose) return Promise.resolve();
    if (carregando) return carregando;
    estado('⏳ Carregando a IA (uns 15 MB, só na primeira vez)…');
    carregando = import(URL_LIB).then(function (V) {
      return V.FilesetResolver.forVisionTasks(URL_WASM).then(function (fs) {
        function criarPose(del) {
          return V.PoseLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: URL_POSE, delegate: del }, runningMode: 'VIDEO', numPoses: 1,
            minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
        }
        function criarBola(del) {
          return V.ObjectDetector.createFromOptions(fs, { baseOptions: { modelAssetPath: URL_BOLA, delegate: del }, runningMode: 'VIDEO',
            categoryAllowlist: ['sports ball'], scoreThreshold: 0.2, maxResults: 2 });
        }
        return Promise.all([criarPose('GPU').catch(function () { return criarPose('CPU'); }),
                            criarBola('GPU').catch(function () { return criarBola('CPU'); }).catch(function () { return null; })]);
      });
    }).then(function (r) { pose = r[0]; bola = r[1]; }, function (e) { carregando = null; throw e; });
    return carregando;
  }
  function ts() { ultTs = Math.max(ultTs + 1, Math.round(performance.now())); return ultTs; }

  /* ------------------------------------------------------------------ passar o vídeo pela IA */
  var video = $('jgVideo'), frames = [], golpes = [], url = null, nomeArq = '', processando = false;
  $('jgArq').onchange = function (e) {
    var f = e.target.files[0]; e.target.value = ''; if (!f) return;
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(f); nomeArq = f.name || 'vídeo';
    frames = []; golpes = []; $('jgRes').style.display = 'none';
    video.src = url; $('jgPlayer').style.display = 'block';
    video.onloadedmetadata = function () { video.onloadedmetadata = null; processar(); };
  };

  function processar() {
    processando = true; parar();
    carregar().then(function () {
      estado('🤖 A IA está assistindo o vídeo… (' + Math.round(video.duration) + ' s; deixe a tela ligada)');
      barra(0); frames = [];
      video.currentTime = 0; video.playbackRate = 0.5; video.muted = true;
      var ocupado = false, temRVFC = !!video.requestVideoFrameCallback, timer = null;
      function passo(t) {
        if (ocupado) return; ocupado = true;
        var fr = { t: t, k: null, b: null };
        try { var r = pose.detectForVideo(video, ts()); if (r.landmarks && r.landmarks[0]) fr.k = r.landmarks[0].map(function (p) { return [p.x, p.y, p.visibility || 0]; }); } catch (e) {}
        if (bola) try {
          var d = bola.detectForVideo(video, ts()).detections || [];
          if (d.length) { var bb = d[0].boundingBox, W = video.videoWidth, H = video.videoHeight;
            fr.b = [(bb.originX + bb.width / 2) / W, (bb.originY + bb.height / 2) / H, bb.width / W, d[0].categories[0].score]; }
        } catch (e) {}
        frames.push(fr); ocupado = false;
        barra(t / video.duration); desenharQuadro(fr);
        // aparelho lento: diminui a velocidade até a IA ver ~20 quadros por segundo de vídeo
        if (t > 0.8 && frames.length % 8 === 0) {
          var dens = frames.length / t, alvo = video.playbackRate * dens / 20;
          video.playbackRate = Math.max(0.1, Math.min(1, alvo));
        }
      }
      function cb(agora, meta) { if (!processando) return; passo(meta.mediaTime); if (!video.ended) video.requestVideoFrameCallback(cb); }
      function fim() {
        if (!processando) return; processando = false; clearInterval(timer);
        video.pause(); video.playbackRate = 1; barra(null);
        frames.sort(function (a, b) { return a.t - b.t; });
        analisar();
      }
      video.onended = fim;
      if (temRVFC) video.requestVideoFrameCallback(cb);
      else timer = setInterval(function () { if (!video.paused) passo(video.currentTime); }, 66);
      video.play().catch(function () { estado('Toque no vídeo para começar.'); video.onclick = function () { video.onclick = null; video.play(); }; });
    }).catch(function (e) { processando = false; estado('❌ Não consegui carregar a IA: ' + (e && e.message || e) + '. Precisa de internet na primeira vez.'); });
  }

  /* ------------------------------------------------------------------ geometria (em pixels do vídeo) */
  function P(fr, i) { var W = video.videoWidth || 1, H = video.videoHeight || 1, p = fr.k[i]; return [p[0] * W, p[1] * H, p[2]]; }
  function med(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
  function ang(a, b, c) {   // ângulo em b (graus)
    var u = [a[0] - b[0], a[1] - b[1]], v = [c[0] - b[0], c[1] - b[1]];
    return Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / ((Math.hypot(u[0], u[1]) * Math.hypot(v[0], v[1])) || 1)))) * 180 / Math.PI;
  }
  function tronco(fr) { return dist(med(P(fr, 11), P(fr, 12)), med(P(fr, 23), P(fr, 24))) || 1; }
  function lados() { var e = (cfg.post.mao || 'd') === 'e'; return { pu: e ? 15 : 16, co: e ? 13 : 14, om: e ? 11 : 12, qu: e ? 23 : 24, oq: e ? 24 : 23, oo: e ? 12 : 11 }; }
  function janela(t0, t1) { return frames.filter(function (f) { return f.k && f.t >= t0 && f.t <= t1; }); }
  function joelhoMin(lista) {
    var m = 999;
    lista.forEach(function (f) {
      [[23, 25, 27], [24, 26, 28]].forEach(function (j) {
        if (f.k[j[1]][2] > 0.5 && f.k[j[2]][2] > 0.5) m = Math.min(m, ang(P(f, j[0]), P(f, j[1]), P(f, j[2])));
      });
    });
    return m === 999 ? null : m;
  }

  /* ------------------------------------------------------------------ achar e classificar os golpes */
  function analisar() {
    var L = lados(), com = frames.filter(function (f) { return f.k; });
    if (com.length < 10) { estado('😕 A IA não achou uma pessoa no vídeo. Grave de corpo inteiro, com boa luz.'); return; }
    // velocidade do punho da raquete, em "troncos por segundo" (independe da distância da câmera)
    var vel = [];
    for (var i = 1; i < com.length; i++) {
      var a = com[i - 1], b = com[i], dt = b.t - a.t;
      if (dt <= 0 || dt > 0.25) { vel.push(0); continue; }
      vel.push(dist(P(a, L.pu), P(b, L.pu)) / tronco(b) / dt);
    }
    var lim = 5.5, picos = [];
    for (i = 1; i < vel.length - 1; i++) {
      var v = (vel[i - 1] + vel[i] + vel[i + 1]) / 3;
      if (v < lim || vel[i] < vel[i - 1] || vel[i] < vel[i + 1]) continue;
      var t = com[i + 1].t;
      if (picos.length && t - picos[picos.length - 1].t < 1.0) { if (v > picos[picos.length - 1].v) picos[picos.length - 1] = { t: t, v: v, i: i + 1 }; continue; }
      picos.push({ t: t, v: v, i: i + 1 });
    }
    golpes = picos.map(function (pk) { return classificar(com[pk.i], pk, L); });
    mostrarResultado(); salvarHist();
  }

  function classificar(fr, pk, L) {
    var T = tronco(fr), pu = P(fr, L.pu), nariz = P(fr, 0);
    // saque: o punho da raquete passa bem acima da cabeça perto do contato
    var perto = janela(pk.t - 0.25, pk.t + 0.05), alto = perto.some(function (f) { return P(f, 0)[1] - P(f, L.pu)[1] > 0.35 * tronco(f); });
    var tipo;
    if (alto) tipo = 'saque';
    else {
      // forehand = punho do lado da mão da raquete; backhand = cruzou o corpo (lado definido pelos quadris)
      var qd = P(fr, L.qu), qo = P(fr, L.oq), centro = med(qd, qo), lado = qd[0] - qo[0];
      if (Math.abs(lado) < 0.08 * T) { var od = P(fr, L.om), oo = P(fr, L.oo); lado = od[0] - oo[0]; }
      // lado de onde o golpe VEM (preparação, 0,4 s antes do pico): no pico o punho já pode estar cruzando o corpo
      var prep = janela(pk.t - 0.4, pk.t - 0.06), soma = 0;
      prep.forEach(function (f) { soma += P(f, L.pu)[0] - med(P(f, L.qu), P(f, L.oq))[0]; });
      var lateral = prep.length ? soma / prep.length : pu[0] - centro[0];
      tipo = lateral * lado >= 0 ? 'fh' : 'bh';
    }
    var g = { t: pk.t, tipo: tipo, forca: pk.v };
    avaliar(g, fr, L); velocidadeBola(g, fr);
    return g;
  }

  /* nota da técnica: só os itens que a câmera consegue ver contam */
  function avaliar(g, fr, L) {
    var itens = [], antes, depois;
    function item(peso, ok, txtOk, txtRuim, valor) { if (ok === null) return; itens.push({ peso: peso, ok: ok, txt: ok ? txtOk : txtRuim, valor: valor }); }
    var cot = fr.k[L.co][2] > 0.5 ? ang(P(fr, L.om), P(fr, L.co), P(fr, L.pu)) : null;
    if (g.tipo === 'saque') {
      item(30, cot === null ? null : cot >= 155, 'Braço esticado no contato', 'Estique o braço no contato (cotovelo a ' + Math.round(cot) + '°, o ideal é 160°+)', cot);
      var alt = (P(fr, 0)[1] - P(fr, L.pu)[1]) / tronco(fr);
      item(25, alt >= 0.85, 'Contato bem alto', 'Bata mais alto: suba no ar e alcance a bola no ponto mais alto', alt);
      antes = janela(g.t - 1.6, g.t);
      var jm = joelhoMin(antes);
      item(25, jm === null ? null : jm <= 155, 'Flexionou os joelhos', 'Dobre mais os joelhos antes de subir (chegou a ' + Math.round(jm) + '°)', jm);
      var trofeu = antes.filter(function (f) { return f.t < g.t - 0.12; }).some(function (f) {
        var c = P(f, L.co), o = P(f, L.om), p = P(f, L.pu); return c[1] <= o[1] + 0.2 * tronco(f) && p[1] < c[1];
      });
      item(20, antes.length > 5 ? trofeu : null, 'Passou pela posição de troféu', 'Faça a posição de troféu: cotovelo na altura do ombro e raquete para cima antes de bater');
    } else {
      antes = janela(g.t - 1.0, g.t); depois = janela(g.t, g.t + 0.9);
      var jk = joelhoMin(antes);
      item(30, jk === null ? null : jk <= 160, 'Base baixa (joelhos flexionados)', 'Dobre os joelhos na preparação: base mais baixa', jk);
      var term = depois.some(function (f) { return P(f, L.pu)[1] < Math.min(P(f, 11)[1], P(f, 12)[1]); });
      item(35, depois.length > 4 ? term : null, 'Terminou o golpe por cima do ombro', 'Termine o movimento: a raquete passa por cima do ombro');
      var minCot = g.tipo === 'fh' ? 120 : 110;
      item(35, cot === null ? null : cot >= minCot, 'Bateu com espaço (braço estendido)', 'Bata mais longe do corpo: braço colado demais no contato (' + Math.round(cot) + '°)', cot);
    }
    var tot = itens.reduce(function (s, x) { return s + x.peso; }, 0), pts = itens.reduce(function (s, x) { return s + (x.ok ? x.peso : 0); }, 0);
    g.nota = tot ? Math.round(100 * pts / tot) : null; g.itens = itens;
  }

  /* velocidade da bola logo depois do golpe (estimativa: precisa de câmera DE LADO, longe) */
  function velocidadeBola(g, fr) {
    var bs = frames.filter(function (f) { return f.b && f.t > g.t && f.t < g.t + 0.3; });
    if (bs.length < 3) return;
    var W = video.videoWidth, H = video.videoHeight, a = bs[0], b = bs[bs.length - 1];
    var px = Math.hypot((b.b[0] - a.b[0]) * W, (b.b[1] - a.b[1]) * H) / (b.t - a.t);
    // escala: altura da pessoa em pixels (nariz → tornozelo ≈ 87% da altura)
    var alturaPx = (Math.max(P(fr, 27)[1], P(fr, 28)[1]) - P(fr, 0)[1]) / 0.87, alt = (cfg.jog && cfg.jog.alt) || 1.80;
    if (alturaPx < 40) return;
    var kmh = px * alt / alturaPx * 3.6;
    if (kmh > 20 && kmh < 260) g.kmh = Math.round(kmh);
  }

  /* ------------------------------------------------------------------ resultado */
  var filtro = 'todos';
  function visiveis() { return golpes.filter(function (g) { return filtro === 'todos' || g.tipo === filtro; }); }
  function mmss(t) { var m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + (s < 10 ? '0' : '') + s; }
  function mostrarResultado() {
    $('jgRes').style.display = 'block';
    if (!golpes.length) { estado('😕 Não achei golpes. Confira se o braço da raquete aparece e a mão escolhida.'); $('jgResumo').innerHTML = ''; $('jgLista').innerHTML = ''; desenharLinha(); return; }
    var por = {}; golpes.forEach(function (g) { (por[g.tipo] = por[g.tipo] || []).push(g); });
    estado('✅ Pronto: ' + golpes.length + ' golpes. Toque num golpe para ver em câmera lenta, ou em <b>▶ Destaques</b>.');
    $('jgResumo').innerHTML = '<div class="numeros" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;text-align:center">' +
      ['saque', 'fh', 'bh'].map(function (t) {
        var l = por[t] || [], n = l.filter(function (g) { return g.nota !== null; }), m = n.length ? Math.round(n.reduce(function (s, g) { return s + g.nota; }, 0) / n.length) : null;
        var vs = l.filter(function (g) { return g.kmh; }).map(function (g) { return g.kmh; });
        return '<div><b style="color:' + COR[t] + '">' + l.length + '</b><span>' + NOME[t] + (m !== null ? ' · nota ' + m : '') + (vs.length ? '<br>até ≈' + Math.max.apply(null, vs) + ' km/h' : '') + '</span></div>';
      }).join('') + '</div>' + dicaGeral(por);
    desenharLista(); desenharLinha();
  }
  function dicaGeral(por) {
    // o que mais se repetiu errado
    var cont = {};
    golpes.forEach(function (g) { (g.itens || []).forEach(function (x) { if (!x.ok) { var k = NOME[g.tipo] + ': ' + x.txt.replace(/\s*\(.*\)$/, ''); cont[k] = (cont[k] || 0) + 1; } }); });
    var top = Object.keys(cont).sort(function (a, b) { return cont[b] - cont[a]; }).slice(0, 2);
    return top.length ? '<div class="peq" style="margin-top:8px;color:var(--amarelo)">🎯 Para treinar: ' + top.map(function (k) { return k + ' (' + cont[k] + '×)'; }).join(' · ') + '</div>' : '';
  }
  function desenharLista() {
    $('jgLista').innerHTML = visiveis().map(function (g) {
      var i = golpes.indexOf(g);
      return '<div class="cartao" style="margin:6px 0;padding:8px;background:#0a1712" data-g="' + i + '">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px"><b style="color:' + COR[g.tipo] + '">' + NOME[g.tipo] + '</b>' +
        '<span class="peq">' + mmss(g.t) + (g.kmh ? ' · ≈' + g.kmh + ' km/h' : '') + '</span>' +
        '<b>' + (g.nota !== null ? g.nota + '/100' : '–') + '</b>' +
        '<button class="bt cinza" style="padding:5px 10px;font-size:14px;width:auto" data-ver="' + i + '">▶</button></div>' +
        '<div class="peq">' + (g.itens || []).map(function (x) { return (x.ok ? '✅ ' : '⚠️ ') + x.txt; }).join('<br>') + '</div>' +
        '<div class="peq" style="margin-top:4px">Errei o tipo? <a href="#" data-tipo="' + i + '" style="color:var(--azul)">trocar</a></div></div>';
    }).join('') || '<div class="peq">Nenhum golpe deste tipo.</div>';
  }
  $('jgLista').onclick = function (e) {
    var v = e.target.dataset.ver, tp = e.target.dataset.tipo;
    if (v !== undefined) { var gv = golpes[+v]; tocarClipes([clipe(gv)], false, true); estado('▶ ' + NOME[gv.tipo] + ' de ' + mmss(gv.t) + (vel !== 1 ? ' em câmera lenta' : '') + '. Toque em ▶ Destaques para ver todos.'); }
    if (tp !== undefined) {
      e.preventDefault();
      var g = golpes[+tp], ordem = ['saque', 'fh', 'bh'], fr = frames.filter(function (f) { return f.k; }).reduce(function (m, f) { return Math.abs(f.t - g.t) < Math.abs(m.t - g.t) ? f : m; });
      g.tipo = ordem[(ordem.indexOf(g.tipo) + 1) % 3]; avaliar(g, fr, lados()); mostrarResultado(); salvarHist();
    }
  };
  [].forEach.call($('jgFiltro').children, function (b) { b.onclick = function () {
    filtro = b.dataset.f; [].forEach.call($('jgFiltro').children, function (x) { x.classList.toggle('on', x === b); }); desenharLista(); desenharLinha();
  }; });

  /* linha do tempo com os golpes */
  function desenharLinha() {
    var c = $('jgLinha'), W = c.clientWidth * 2, H = 68; c.width = W; c.height = H; var g = c.getContext('2d');
    g.clearRect(0, 0, W, H); if (!video.duration) return;
    visiveis().forEach(function (x) { g.fillStyle = COR[x.tipo]; g.fillRect(x.t / video.duration * W - 3, 8, 6, H - 16); });
    g.fillStyle = '#fff'; g.fillRect(video.currentTime / video.duration * W - 1, 0, 2, H);
  }
  $('jgLinha').onclick = function (e) { var r = this.getBoundingClientRect(); if (video.duration) { parar(); video.currentTime = (e.clientX - r.left) / r.width * video.duration; } };

  /* ------------------------------------------------------------------ destaques (sem tempo parado) */
  var fila = [], filaI = 0, tocando = false, vel = 1, esq = true;
  function clipe(g) { return g.tipo === 'saque' ? { a: Math.max(0, g.t - 2.0), b: g.t + 1.0, g: g } : { a: Math.max(0, g.t - 1.3), b: g.t + 1.2, g: g }; }
  function juntar(cl) {   // trechos que se encostam viram um só (uma troca de bola inteira)
    var out = [];
    cl.forEach(function (c) { var u = out[out.length - 1]; if (u && c.a <= u.b + 0.6) u.b = Math.max(u.b, c.b); else out.push({ a: c.a, b: c.b, g: c.g }); });
    return out;
  }
  // Vai ao trecho e só toca depois que o vídeo chegou lá. Antes, logo após a análise o vídeo estava
  // "terminado" (ended) e o laço achava que o trecho já tinha acabado: o ▶ não reproduzia nada.
  function irPara(t, depois) {
    var feito = false;
    function ok() { if (feito) return; feito = true; video.removeEventListener('seeked', ok); depois(); }
    video.addEventListener('seeked', ok);
    video.currentTime = t;
    setTimeout(ok, 900);   // garantia, se o 'seeked' não vier
  }
  function tocarClipes(lista, gravar, rolar) {
    if (!lista.length) return;
    if (!video.paused) video.pause();
    fila = lista; filaI = 0; tocando = false; processando = false; buscando = true; rastro = [];
    caixa = caixaDe(lista[0].a, lista[lista.length - 1].b) || caixaDe(0, video.duration || 1e9);
    if (rolar) $('jgPlayer').scrollIntoView({ behavior: 'smooth', block: 'start' });
    irPara(fila[0].a, function () {
      buscando = false; tocando = true; video.playbackRate = vel;
      var p = video.play(); if (p && p.catch) p.catch(function () { estado('Toque no vídeo para tocar.'); video.onclick = function () { video.onclick = null; video.play(); }; });
      if (gravar) iniciarGravacao();
    });
  }
  var buscando = false;
  function parar() { tocando = false; buscando = false; if (!video.paused) video.pause(); pararGravacao(); }
  $('jgDestaques').onclick = function () { if (tocando || buscando) { parar(); return; } tocarClipes(juntar(visiveis().map(clipe)), false); };
  $('jgVel').onclick = function () { vel = vel === 1 ? 0.5 : vel === 0.5 ? 0.25 : 1; this.textContent = 'Velocidade ' + (vel === 1 ? '1×' : vel === 0.5 ? '½' : '¼'); if (!video.paused) video.playbackRate = vel; };
  $('jgLado').onclick = function () { lado = !lado; this.textContent = '🧍 Desenho ao lado: ' + (lado ? 'sim' : 'não'); $('jgBonC').style.display = lado ? 'block' : 'none'; };
  $('jgEsq').onclick = function () { esq = !esq; this.textContent = '🦴 Esqueleto: ' + (esq ? 'sim' : 'não'); desenharQuadro(quadroEm(video.currentTime)); };
  function laco() {
    if (!processando && video.src && video.duration) {
      if (tocando && fila.length && !buscando && !video.seeking) {
        var c = fila[filaI];
        if (video.currentTime >= c.b || (video.ended && video.currentTime >= c.a)) {
          filaI++;
          if (filaI >= fila.length) { parar(); estado('✅ Fim do trecho.'); }
          else { buscando = true; video.pause(); irPara(fila[filaI].a, function () { buscando = false; video.play(); }); }
        }
      }
      var frI = quadroInterp(video.currentTime);
      desenharQuadro(frI); desenharBoneco(frI, video.currentTime); desenharLinha();
      if (gravando) compor();
    }
    requestAnimationFrame(laco);
  }
  requestAnimationFrame(laco);
  window.JogoIAteste = { tocarEm: function (t) { tocarClipes([{ a: Math.max(0, t - 2), b: t + 1 }], false, true); }, estado: function () { return { t: video.currentTime, pausado: video.paused, tocando: tocando, buscando: buscando, processando: processando, golpes: golpes.length }; } };   // usado nos testes

  /* ------------------------------------------------------------------ desenho por cima do vídeo */
  var LIG = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
  function quadroEm(t) {
    if (!frames.length) return null;
    var lo = 0, hi = frames.length - 1;
    while (lo < hi) { var m = (lo + hi) >> 1; if (frames[m].t < t) lo = m + 1; else hi = m; }
    var f = frames[lo]; return Math.abs(f.t - t) < 0.2 ? f : null;
  }
  // Entre dois quadros analisados, calcula a posição intermediária: o desenho anda junto com o vídeo
  function quadroInterp(t) {
    if (!frames.length) return null;
    var lo = 0, hi = frames.length - 1;
    while (lo < hi) { var m = (lo + hi) >> 1; if (frames[m].t < t) lo = m + 1; else hi = m; }
    var i1 = lo; while (i1 < frames.length && !frames[i1].k) i1++;
    var i0 = lo - 1; while (i0 >= 0 && !frames[i0].k) i0--;
    var f0 = i0 >= 0 ? frames[i0] : null, f1 = i1 < frames.length ? frames[i1] : null;
    if (f0 && f1 && f1.t - f0.t < 0.4 && f1.t > f0.t) {
      var a = Math.max(0, Math.min(1, (t - f0.t) / (f1.t - f0.t)));
      return { t: t, k: f0.k.map(function (p, j) { var q = f1.k[j]; return [p[0] + (q[0] - p[0]) * a, p[1] + (q[1] - p[1]) * a, Math.min(p[2], q[2])]; }), b: a < 0.5 ? f0.b : f1.b };
    }
    var f = f0 && (!f1 || t - f0.t < f1.t - t) ? f0 : f1;
    return f && Math.abs(f.t - t) < 0.25 ? f : null;
  }
  var lado = true, caixa = null;
  function caixaDe(a, b) {   // enquadra o corpo no trecho todo, para o desenho não pular de tamanho
    var xs = [], ys = [];
    frames.forEach(function (f) { if (f.k && f.t >= a && f.t <= b) f.k.forEach(function (p, j) { if (j > 10 && p[2] > 0.4) { xs.push(p[0]); ys.push(p[1]); } }); });
    if (xs.length < 10) return null;
    xs.sort(function (p, q) { return p - q; }); ys.sort(function (p, q) { return p - q; });
    var q = function (v, f) { return v[Math.floor(f * (v.length - 1))]; };
    var x0 = q(xs, 0.02), x1 = q(xs, 0.98), y0 = q(ys, 0.02), y1 = q(ys, 0.98);
    return { x0: x0, x1: x1, y0: y0 - (y1 - y0) * 0.35, y1: y1 };   // espaço acima para o braço e o toss
  }
  var rastro = [];
  function desenharBoneco(fr, t) {
    var c = $('jgBon'); if (!c || !lado) return;
    var W = c.clientWidth * 2, H = c.clientHeight * 2; if (!W || !H) return;
    if (c.width !== W) c.width = W; if (c.height !== H) c.height = H;
    var g = c.getContext('2d'); g.fillStyle = '#0a1712'; g.fillRect(0, 0, W, H);
    var L = lados(), cx = caixa || { x0: 0, x1: 1, y0: 0, y1: 1 };
    var vw = video.videoWidth || 16, vh = video.videoHeight || 9;
    var bw = Math.max(1, (cx.x1 - cx.x0) * vw), bh = Math.max(1, (cx.y1 - cx.y0) * vh), esc = Math.min(W * 0.86 / bw, H * 0.80 / bh);
    var ox = W / 2 - (cx.x0 + cx.x1) / 2 * vw * esc, oy = H * 0.1 - cx.y0 * vh * esc;
    var P = function (p) { return [ox + p[0] * vw * esc, oy + p[1] * vh * esc]; };
    g.strokeStyle = '#ffffff22'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, oy + cx.y1 * vh * esc + 6); g.lineTo(W, oy + cx.y1 * vh * esc + 6); g.stroke();
    g.fillStyle = '#9fb3a8'; g.font = Math.round(W / 16) + 'px -apple-system,sans-serif'; g.textBaseline = 'top';
    g.fillText(mmss(t) + '.' + Math.floor((t % 1) * 10), W * 0.04, H * 0.015);
    if (!fr || !fr.k) { g.fillText('sem corpo aqui', W * 0.04, H * 0.5); rastro = []; return; }
    var k = fr.k;
    var pu = P(k[L.pu]); if (k[L.pu][2] > 0.4) rastro.push([pu[0], pu[1], t]);
    rastro = rastro.filter(function (r) { return t - r[2] < 0.6 && r[2] <= t; });
    g.lineCap = 'round';
    if (rastro.length > 1) { g.strokeStyle = '#facc1588'; g.lineWidth = W / 60; g.beginPath(); rastro.forEach(function (r, i) { if (i) g.lineTo(r[0], r[1]); else g.moveTo(r[0], r[1]); }); g.stroke(); }
    LIG.forEach(function (l) {
      var a = k[l[0]], b = k[l[1]]; if (a[2] < 0.35 || b[2] < 0.35) return;
      var braco = (l[0] === L.om || l[0] === L.co) && (l[1] === L.co || l[1] === L.pu);
      g.strokeStyle = braco ? '#facc15' : '#e8f5ee'; g.lineWidth = braco ? W / 34 : W / 45;
      var A = P(a), B = P(b); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke();
    });
    if (k[0][2] > 0.4) { var N = P(k[0]), o1 = P(k[11]), o2 = P(k[12]); g.strokeStyle = '#e8f5ee'; g.lineWidth = W / 60; g.beginPath(); g.arc(N[0], N[1], Math.max(W / 28, Math.hypot(o1[0] - o2[0], o1[1] - o2[1]) * 0.35), 0, 7); g.stroke(); }
    [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].forEach(function (j) { if (k[j][2] < 0.35) return; var Q = P(k[j]); g.fillStyle = (j === L.co || j === L.pu || j === L.om) ? '#facc15' : '#3fb950'; g.beginPath(); g.arc(Q[0], Q[1], W / 55, 0, 7); g.fill(); });
    var rot = function (txt, Q) { g.font = 'bold ' + Math.round(W / 15) + 'px -apple-system,sans-serif'; var w = g.measureText(txt).width; g.fillStyle = '#000b'; g.fillRect(Q[0] + W * 0.03, Q[1] - W * 0.04, w + W * 0.03, W / 12); g.fillStyle = '#fff'; g.fillText(txt, Q[0] + W * 0.045, Q[1] - W * 0.03); };
    if (k[L.om][2] > 0.4 && k[L.co][2] > 0.4 && k[L.pu][2] > 0.4) rot(Math.round(ang(P(k[L.om]), P(k[L.co]), P(k[L.pu]))) + '°', P(k[L.co]));
    var jo = L.qu === 24 ? [24, 26, 28] : [23, 25, 27];
    if (k[jo[0]][2] > 0.4 && k[jo[1]][2] > 0.4 && k[jo[2]][2] > 0.4) rot(Math.round(ang(P(k[jo[0]]), P(k[jo[1]]), P(k[jo[2]]))) + '°', P(k[jo[1]]));
    if (fr.b) { var Bb = P(fr.b); g.fillStyle = '#d9f99d'; g.beginPath(); g.arc(Bb[0], Bb[1], W / 40, 0, 7); g.fill(); }
    var gp = golpeEm(t); if (gp) { g.fillStyle = COR[gp.tipo]; g.font = 'bold ' + Math.round(W / 14) + 'px -apple-system,sans-serif'; g.fillText(NOME[gp.tipo], W * 0.04, H * 0.92); }
  }
  function golpeEm(t) { for (var i = 0; i < golpes.length; i++) if (t >= golpes[i].t - 1.3 && t <= golpes[i].t + 1.2) return golpes[i]; return null; }
  function desenharQuadro(fr) {
    var c = $('jgDes'), W = c.clientWidth * 2, H = c.clientHeight * 2; if (!W) return;
    if (c.width !== W) { c.width = W; c.height = H; }
    var g = c.getContext('2d'); g.clearRect(0, 0, W, H);
    pintar(g, W, H, fr, video.currentTime);
  }
  function pintar(g, W, H, fr, t) {
    var L = lados();
    if (fr && fr.k && esq) {
      g.lineWidth = Math.max(2, W / 250); g.lineCap = 'round';
      LIG.forEach(function (l) {
        var a = fr.k[l[0]], b = fr.k[l[1]]; if (a[2] < 0.4 || b[2] < 0.4) return;
        var braco = (l[0] === L.om || l[0] === L.co) && (l[1] === L.co || l[1] === L.pu);
        g.strokeStyle = braco ? '#facc15' : '#ffffffcc';
        g.beginPath(); g.moveTo(a[0] * W, a[1] * H); g.lineTo(b[0] * W, b[1] * H); g.stroke();
      });
    }
    if (fr && fr.b) { g.strokeStyle = '#22c55e'; g.lineWidth = Math.max(2, W / 300); g.beginPath(); g.arc(fr.b[0] * W, fr.b[1] * H, Math.max(8, fr.b[2] * W * 0.8), 0, 7); g.stroke(); }
    var gp = golpeEm(t);
    if (gp) {
      var txt = NOME[gp.tipo] + (gp.nota !== null ? ' · ' + gp.nota + '/100' : '') + (gp.kmh ? ' · ≈' + gp.kmh + ' km/h' : '');
      g.font = 'bold ' + Math.round(W / 22) + 'px -apple-system, sans-serif'; g.textBaseline = 'top';
      var w = g.measureText(txt).width; g.fillStyle = '#000a'; g.fillRect(W * 0.02, H * 0.03, w + W * 0.03, W / 22 * 1.5);
      g.fillStyle = COR[gp.tipo]; g.fillText(txt, W * 0.035, H * 0.03 + W / 22 * 0.25);
    }
  }

  /* ------------------------------------------------------------------ salvar o vídeo dos destaques */
  var gravando = false, gravador = null, pedacos = [], tela = null;
  function iniciarGravacao() {
    var c = document.createElement('canvas'), esc = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    c.width = Math.round(video.videoWidth * esc); c.height = Math.round(video.videoHeight * esc); tela = c;
    if (!c.captureStream || !window.MediaRecorder) { estado('Este aparelho não consegue gravar o vídeo dos destaques.'); return; }
    var tipo = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : (MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '');
    pedacos = []; gravador = new MediaRecorder(c.captureStream(30), tipo ? { mimeType: tipo } : undefined);
    gravador.ondataavailable = function (e) { if (e.data.size) pedacos.push(e.data); };
    gravador.onstop = function () {
      var blob = new Blob(pedacos, { type: gravador.mimeType || 'video/mp4' }), ext = /webm/.test(blob.type) ? 'webm' : 'mp4';
      var nome = 'destaques-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.' + ext, f = new File([blob], nome, { type: blob.type });
      if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f] }).catch(function () {});
      else { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; a.click(); }
      estado('💾 Vídeo dos destaques pronto.');
    };
    gravador.start(500); gravando = true; estado('⏺ Gravando os destaques… espere terminar.');
  }
  function compor() { var g = tela.getContext('2d'); g.drawImage(video, 0, 0, tela.width, tela.height); pintar(g, tela.width, tela.height, quadroInterp(video.currentTime), video.currentTime); }
  function pararGravacao() { if (gravando && gravador && gravador.state !== 'inactive') gravador.stop(); gravando = false; }
  $('jgSalvar').onclick = function () { if (!golpes.length) return; tocarClipes(juntar(visiveis().map(clipe)), true); };

  /* ------------------------------------------------------------------ histórico / evolução */
  function lerHist() { try { return JSON.parse(localStorage.getItem(CHAVE_HIST)) || []; } catch (e) { return []; } }
  var idAtual = null;
  function salvarHist() {
    if (!golpes.length) return;
    var h = lerHist(), r = { quando: Date.now(), nome: nomeArq, dur: Math.round(video.duration || 0) };
    ['saque', 'fh', 'bh'].forEach(function (t) {
      var l = golpes.filter(function (g) { return g.tipo === t; }), n = l.filter(function (g) { return g.nota !== null; });
      r[t] = { n: l.length, nota: n.length ? Math.round(n.reduce(function (s, g) { return s + g.nota; }, 0) / n.length) : null };
    });
    if (idAtual !== null) h = h.filter(function (x) { return x.quando !== idAtual; });
    idAtual = r.quando; h.push(r); localStorage.setItem(CHAVE_HIST, JSON.stringify(h.slice(-60))); mostrarHist();
  }
  $('jgArq').addEventListener('change', function () { idAtual = null; });
  function mostrarHist() {
    var h = lerHist();
    if (!h.length) { $('jgHist').innerHTML = 'Ainda não há análises. A primeira aparece aqui, e a partir da segunda dá para ver a evolução das notas.'; return; }
    var cel = function (x) { return x.n ? x.n + (x.nota !== null ? ' · <b>' + x.nota + '</b>' : '') : '–'; };
    $('jgHist').innerHTML = '<table><tr><th>Dia</th><th>Saque</th><th>Forehand</th><th>Backhand</th></tr>' +
      h.slice().reverse().slice(0, 20).map(function (r) {
        return '<tr><td>' + new Date(r.quando).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + '</td><td>' + cel(r.saque) + '</td><td>' + cel(r.fh) + '</td><td>' + cel(r.bh) + '</td></tr>';
      }).join('') + '</table><div style="margin-top:4px">Quantidade de golpes · <b>nota média</b>.</div>' + grafico(h);
  }
  function grafico(h) {
    if (h.length < 2) return '';
    var W = 320, H = 90, n = h.length, linhas = '';
    ['saque', 'fh', 'bh'].forEach(function (t) {
      var pts = h.map(function (r, i) { return r[t] && r[t].nota !== null ? [10 + i * (W - 20) / Math.max(1, n - 1), H - 8 - r[t].nota / 100 * (H - 16)] : null; }).filter(Boolean);
      if (pts.length > 1) linhas += '<polyline fill="none" stroke="' + COR[t] + '" stroke-width="2.5" points="' + pts.map(function (p) { return p.join(','); }).join(' ') + '"/>';
    });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;max-width:420px;margin-top:6px;background:#0a1712;border-radius:6px">' +
      '<line x1="0" x2="' + W + '" y1="' + (H - 8 - 0.7 * (H - 16)) + '" y2="' + (H - 8 - 0.7 * (H - 16)) + '" stroke="#24463a" stroke-dasharray="4"/>' + linhas + '</svg>' +
      '<div>Evolução da nota: <span style="color:' + COR.saque + '">saque</span>, <span style="color:' + COR.fh + '">forehand</span>, <span style="color:' + COR.bh + '">backhand</span> (tracejado = 70).</div>';
  }
  mostrarHist();

  /* ------------------------------------------------------------------ 📊 Sessão: mapa das quedas dos saques medidos */
  var mapa = document.createElement('div'); mapa.className = 'cartao';
  mapa.innerHTML = '<h2>🗺️ Mapa dos saques</h2><canvas id="jgMapa" style="width:100%;max-width:420px;display:block;margin:auto;background:#1d4d3a;border-radius:8px"></canvas>' +
    '<div class="peq" style="margin-top:6px">Onde cada saque medido caiu (quadrado de saque visto de cima). <span class="ok">●</span> dentro <span class="ruim">●</span> fora. Os mais recentes ficam maiores.</div>';
  var secSessao = $('sessao'); if (secSessao) secSessao.insertBefore(mapa, secSessao.children[1] || null);
  function desenharMapa() {
    var l = (window.TS && TS.sessao ? TS.sessao() : []).filter(function (s) { return s.queda; }).slice(-150), c = $('jgMapa'); if (!c) return;
    var Q = (window.Fisica && Fisica.QUADRA) || { rede: 11.885, saque: 18.285, fundo: 23.77, lateralSimples: 4.115 };
    // vista de cima: da rede (embaixo) até depois da linha de saque; largura = quadra simples
    var x0 = Q.rede - 0.5, x1 = Q.saque + 3, yMax = Q.lateralSimples + 1.2, W = 400, H = Math.round(W * (x1 - x0) / (2 * yMax));
    c.width = W; c.height = H; var g = c.getContext('2d');
    function px(y) { return (y + yMax) / (2 * yMax) * W; } function py(x) { return H - (x - x0) / (x1 - x0) * H; }
    g.strokeStyle = '#fff'; g.lineWidth = 2;
    g.strokeRect(px(-Q.lateralSimples), py(Q.saque), px(Q.lateralSimples) - px(-Q.lateralSimples), py(Q.rede) - py(Q.saque));
    g.beginPath(); g.moveTo(px(0), py(Q.rede)); g.lineTo(px(0), py(Q.saque)); g.stroke();
    g.strokeStyle = '#ddd'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, py(Q.rede)); g.lineTo(W, py(Q.rede)); g.stroke();
    l.forEach(function (s, i) {
      g.fillStyle = s.res === 'dentro' ? '#22c55e' : '#ef4444'; g.globalAlpha = 0.45 + 0.55 * (i + 1) / l.length;
      g.beginPath(); g.arc(px(s.queda[1]), py(s.queda[0]), 3 + 4 * (i + 1) / l.length, 0, 7); g.fill();
    });
    g.globalAlpha = 1;
    if (!l.length) { g.fillStyle = '#fff'; g.font = '15px -apple-system, sans-serif'; g.textAlign = 'center'; g.fillText('Ainda não há saques medidos no modo quadra/lona', W / 2, H / 2); }
  }
  [].forEach.call(document.querySelectorAll('#abas button'), function (b) { if (b.dataset.aba === 'sessao') b.addEventListener('click', function () { setTimeout(desenharMapa, 30); }); });
  desenharMapa();

  window.JogoIA = { frames: function () { return frames; }, golpes: function () { return golpes; }, analisar: analisar, processar: processar };
})();
