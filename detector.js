/* AudioWorklet: acha os estalos (o "clac" da raquete e o "tum" da bola na lona) com precisão de 1 amostra.
   Filtro passa-alta (diferença entre amostras) + envoltória rápida + ruído de fundo lento. */
class Detector extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ant = 0; this.env = 0; this.fundo = 0.002; this.trava = 0; this.k = 7; this.minimo = 0.02; this.cont = 0; this.picoBloco = 0;
    this.port.onmessage = (e) => { Object.assign(this, e.data); };
  }
  process(entradas) {
    const x = entradas[0] && entradas[0][0];
    if (!x) return true;
    for (let i = 0; i < x.length; i++) {
      const a = Math.abs(x[i] - this.ant); this.ant = x[i];
      this.env = a > this.env ? a : this.env * 0.995;
      if (this.env > this.picoBloco) this.picoBloco = this.env;
      if (this.trava > 0) { this.trava--; continue; }
      if (this.env > this.k * this.fundo && this.env > this.minimo) {
        this.port.postMessage({ t: (currentFrame + i) / sampleRate, pico: this.env, fundo: this.fundo });
        this.trava = Math.round(0.02 * sampleRate);
      } else this.fundo += (this.env - this.fundo) * 0.0002;
    }
    this.cont += x.length;
    if (this.cont >= 2400) { this.port.postMessage({ nivel: this.picoBloco, fundo: this.fundo }); this.cont = 0; this.picoBloco = 0; }
    return true;
  }
}
registerProcessor('detector-estalos', Detector);
