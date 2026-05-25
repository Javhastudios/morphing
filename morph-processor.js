class MorphProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samplesA = null;
    this.samplesB = null;
    this.morphTarget = 0;
    this.morphSmooth = 0;
    this.slewRate = 0.0001;
    this.pos = 0;
    this.loop = false;
    this.playing = false;

    this.port.onmessage = (e) => {
      const d = e.data;
      if (d.type === 'samples') {
        this.samplesA = d.a;
        this.samplesB = d.b;
        this.pos = 0;
        this.playing = false;
      }
      if (d.type === 'morph') this.morphTarget = d.value;
      if (d.type === 'play') { this.pos = 0; this.playing = true; }
      if (d.type === 'stop') { this.playing = false; this.pos = 0; }
      if (d.type === 'loop') this.loop = d.value;
    };
  }

  getSample(data, normalizedPos) {
    const pos = normalizedPos * (data.length - 1);
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const v0 = data[idx];
    const v1 = idx + 1 < data.length ? data[idx + 1] : data[idx];
    return v0 + frac * (v1 - v0);
  }

  process(inputs, outputs) {
    const out = outputs[0][0];
    if (!this.playing || !this.samplesA || !this.samplesB) {
      out.fill(0);
      return true;
    }

    const lenA = this.samplesA.length;
    const lenB = this.samplesB.length;

    for (let i = 0; i < out.length; i++) {
      this.morphSmooth += (this.morphTarget - this.morphSmooth) * this.slewRate;
      const t = this.morphSmooth;

      const targetLen = lenA * (1 - t) + lenB * t;

      if (this.pos >= targetLen) {
        if (this.loop) {
          this.pos = 0;
        } else {
          this.playing = false;
          out[i] = 0;
          this.port.postMessage({ type: 'ended' });
          continue;
        }
      }

      const norm = targetLen > 1 ? this.pos / (targetLen - 1) : 0;
      const va = this.getSample(this.samplesA, norm);
      const vb = this.getSample(this.samplesB, norm);
      out[i] = va * (1 - t) + vb * t;
      this.pos++;
    }
    return true;
  }
}

registerProcessor('morph-processor', MorphProcessor);
