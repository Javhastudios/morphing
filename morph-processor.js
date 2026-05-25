class MorphProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samplesA = null;
    this.samplesB = null;
    this.morphT = 0;
    this.pos = 0;
    this.loop = false;
    this.playing = false;
    this.length = 0;

    this.port.onmessage = (e) => {
      const d = e.data;
      if (d.type === 'samples') {
        this.samplesA = d.a;
        this.samplesB = d.b;
        this.length = Math.max(d.a.length, d.b.length);
        this.pos = 0;
        this.playing = false;
      }
      if (d.type === 'morph') this.morphT = d.value;
      if (d.type === 'play') { this.pos = 0; this.playing = true; }
      if (d.type === 'stop') { this.playing = false; this.pos = 0; }
      if (d.type === 'loop') this.loop = d.value;
    };
  }

  process(inputs, outputs) {
    const out = outputs[0][0];
    if (!this.playing || !this.samplesA || !this.samplesB) {
      out.fill(0);
      return true;
    }

    const t = this.morphT;
    const a = this.samplesA;
    const b = this.samplesB;

    for (let i = 0; i < out.length; i++) {
      if (this.pos >= this.length) {
        if (this.loop) {
          this.pos = 0;
        } else {
          this.playing = false;
          out[i] = 0;
          this.port.postMessage({ type: 'ended' });
          continue;
        }
      }
      const va = this.pos < a.length ? a[this.pos] : 0;
      const vb = this.pos < b.length ? b[this.pos] : 0;
      out[i] = va * (1 - t) + vb * t;
      this.pos++;
    }
    return true;
  }
}

registerProcessor('morph-processor', MorphProcessor);
