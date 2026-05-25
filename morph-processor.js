class MorphProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samplesA = null;
    this.samplesB = null;
    this.morphTarget = 0;
    this.morphSmooth = 0;
    this.gainA = 1;
    this.gainB = 1;
    this.pos = 0;
    this.loop = false;
    this.playing = false;
    this.durationMode = 'morph';
    this.stereo = false;

    this.port.onmessage = (e) => {
      const d = e.data;
      if (d.type === 'samples') {
        this.samplesA = d.a;
        this.samplesB = d.b;
        this.stereo = d.stereo;
        this.pos = 0;
        this.playing = false;
        this.morphSmooth = this.morphTarget; // respect already-set target
      }
      if (d.type === 'morph') this.morphTarget = d.value;
      if (d.type === 'gainA') this.gainA = d.value;
      if (d.type === 'gainB') this.gainB = d.value;
      if (d.type === 'play') { this.morphSmooth = this.morphTarget; this.pos = 0; this.playing = true; }
      if (d.type === 'stop') { this.playing = false; this.pos = 0; }
      if (d.type === 'loop') this.loop = d.value;
      if (d.type === 'durationMode') this.durationMode = d.value;
    };
  }

  getSample(data, normalizedPos, ch) {
    const chLen = data.length / (this.stereo ? 2 : 1);
    const offset = this.stereo ? ch * chLen : 0;
    const pos = normalizedPos * (chLen - 1);
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const v0 = data[offset + idx] || 0;
    const v1 = data[offset + Math.min(idx + 1, chLen - 1)] || 0;
    return v0 + frac * (v1 - v0);
  }

  process(inputs, outputs) {
    const outL = outputs[0][0];
    const outR = outputs[0][1] || outL;
    if (!this.playing || !this.samplesA || !this.samplesB) {
      outL.fill(0); if (outR !== outL) outR.fill(0);
      return true;
    }

    const channels = this.stereo ? 2 : 1;
    const chLenA = this.samplesA.length / channels;
    const chLenB = this.samplesB.length / channels;
    const smoothTime = 0.15;
    const coeff = 1 - Math.exp(-1 / (sampleRate * smoothTime));

    for (let i = 0; i < outL.length; i++) {
      this.morphSmooth += (this.morphTarget - this.morphSmooth) * coeff;
      const t = this.morphSmooth;

      let targetLen;
      if (this.durationMode === 'morph') {
        targetLen = Math.round(chLenA * (1 - t) + chLenB * t);
      } else {
        targetLen = chLenA;
      }

      if (this.pos >= targetLen) {
        if (this.loop) { this.pos = 0; }
        else { this.playing = false; outL[i] = 0; if (outR !== outL) outR[i] = 0; this.port.postMessage({ type: 'ended' }); continue; }
      }

      const norm = targetLen > 1 ? this.pos / (targetLen - 1) : 0;

      const vaL = this.getSample(this.samplesA, norm, 0) * this.gainA;
      const vbL = this.getSample(this.samplesB, norm, 0) * this.gainB;
      outL[i] = vaL * (1 - t) + vbL * t;

      if (outR !== outL) {
        const vaR = this.getSample(this.samplesA, norm, this.stereo ? 1 : 0) * this.gainA;
        const vbR = this.getSample(this.samplesB, norm, this.stereo ? 1 : 0) * this.gainB;
        outR[i] = vaR * (1 - t) + vbR * t;
      }

      this.pos++;
    }
    return true;
  }
}

registerProcessor('morph-processor', MorphProcessor);
