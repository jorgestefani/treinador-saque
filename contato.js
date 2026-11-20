/* 🎾 Contato com a bola: animação narrada (contato-saque.mp4, feita para o app) + trechos reais do YouTube
   só da fase do contato (incorporados do próprio YouTube, com início e fim; nada é copiado). */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  var CLIPES = [
    { t: 'Chapado: a bola esmagada nas cordas (6.000 quadros/s)', id: 'VHV1YbeznCo', ini: 8, fim: 40, por: 'Anatoly Antipin / Olympus IMS',
      d: 'Close real de um saque de 228 km/h: as cordas batem atrás da bola e ela achata.' },
    { t: 'Slice em câmera lenta', id: '5aJtdopjCyg', ini: 22, fim: 28, por: 'PURE TENNIS sense',
      d: 'Repare na raquete passando por fora (à direita) da bola no contato.' },
    { t: 'Kick visto por trás', id: '3nKQtDzcRMc', ini: 8, fim: 12, por: 'PURE TENNIS sense',
      d: 'Bola mais atrás, sobre a cabeça; a raquete sobe por trás dela, das 7 para a 1 hora.' }
  ];
  var div = document.createElement('div'); div.id = 'contatoTela';
  div.style.cssText = 'display:none;position:fixed;inset:0;z-index:60;background:#050d0a;overflow:auto;padding:12px';
  div.innerHTML = '<div style="max-width:720px;margin:0 auto">' +
    '<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:6px 0">🎾 Contato com a bola</h2><button id="ctFechar" class="bt cinza" style="width:auto;padding:8px 14px">✕ Fechar</button></div>' +
    '<div class="peq">Chapado, slice e kick: onde as cordas pegam na bola e para onde deslizam. Toque no ▶ (o áudio explica).</div>' +
    '<video id="ctVideo" src="contato-saque.mp4" controls playsinline preload="metadata" style="width:100%;max-height:70vh;background:#000;border-radius:10px;margin:8px 0"></video>' +
    '<h3 style="margin:14px 0 4px">📹 Trechos reais (só o contato)</h3><div class="peq">Vídeos do YouTube, cortados no momento do contato. Toque em ⟲ para repetir o trecho. No YouTube dá para pôr em 0,25×.</div>' +
    '<div id="ctClipes"></div></div>';
  document.body.appendChild(div);
  $('ctClipes').innerHTML = CLIPES.map(function (c, i) {
    return '<div class="cartao" style="margin-top:10px"><b>' + c.t + '</b><div class="peq">' + c.d + ' <i>(' + c.por + ')</i></div>' +
      '<div style="position:relative;width:100%;aspect-ratio:16/9;margin-top:6px"><iframe id="ctF' + i + '" data-src="https://www.youtube-nocookie.com/embed/' + c.id + '?start=' + c.ini + '&end=' + c.fim + '&rel=0&playsinline=1" ' +
      'style="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:8px" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>' +
      '<button class="bt cinza" data-rep="' + i + '" style="padding:8px;font-size:15px;margin-top:6px">⟲ Repetir o contato</button></div>';
  }).join('');
  function abrir() {
    div.style.display = ''; document.body.style.overflow = 'hidden';
    CLIPES.forEach(function (c, i) { var f = $('ctF' + i); if (!f.src) f.src = f.dataset.src; });
  }
  function fechar() {
    div.style.display = 'none'; document.body.style.overflow = ''; $('ctVideo').pause();
    CLIPES.forEach(function (c, i) { $('ctF' + i).removeAttribute('src'); });   // para os vídeos do YouTube
  }
  $('ctFechar').onclick = fechar;
  div.addEventListener('click', function (e) { var r = e.target.dataset && e.target.dataset.rep; if (r !== undefined) { var f = $('ctF' + r); f.src = f.dataset.src + '&autoplay=1&mute=1'; } });
  function botao(onde, antes) {
    if (!onde) return; var b = document.createElement('button'); b.textContent = '🎾 Contato com a bola (vídeo)'; b.onclick = abrir;
    if (antes) onde.insertBefore(b, antes); else onde.appendChild(b); return b;
  }
  botao(document.querySelector('#postura .chips'));
  var cam = $('caEstado');
  if (cam) { var ch = document.createElement('div'); ch.className = 'chips'; cam.parentNode.insertBefore(ch, cam); botao(ch); }
  window.Contato = { abrir: abrir, fechar: fechar };
})();
