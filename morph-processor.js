class MorphProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samplesA = null;
    this.samplesB = null;
    this.morphTarget = 0;
    this.morphSmooth = 0;
    this.pos = 0;
    this.loop = false;
    this.playing = false;
    this.durationMode = 'morph';

    this.port.onmessage = (e) => {
      const d = e.data;
      if (d.type === 'samples') {
        this.samplesA = d.a;
        this.samplesB = d.b;
        this.pos = 0;
        this.playing = false;
        this.morphSmooth = this.morphTarget;
      }
      if (d.type === 'morph') this.morphTarget = d.value;
      if (d.type === 'play') {
        this.morphSmooth = this.morphTarget;
        this.pos = 0;
        this.playing = true;
      }
      if (d.type === 'stop') { this.playing = false; this.pos = 0; }
      if (d.type === 'loop') this.loop = d.value;
      if (d.type === 'durationMode') this.durationMode = d.value;
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
    const smoothTime = 0.15;
    const coeff = 1 - Math.exp(-1 / (sampleRate * smoothTime));

    for (let i = 0; i < out.length; i++) {
      this.morphSmooth += (this.morphTarget - this.morphSmooth) * coeff;
      const t = this.morphSmooth;

      let targetLen;
      if (this.durationMode === 'morph') {
        targetLen = Math.round(lenA * (1 - t) + lenB * t);
      } else {
        targetLen = lenA;
      }

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
