class MorphProcessor2D extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = { tl: null, tr: null, bl: null, br: null };
    this.frames  = { tl: 1,    tr: 1,    bl: 1,    br: 1    };
    this.gains   = { tl: 1,    tr: 1,    bl: 1,    br: 1    };
    this.xTarget = 0.5; this.yTarget = 0.5;
    this.xSmooth = 0.5; this.ySmooth = 0.5;
    this.smoothTime = 0.15;
    this.durationMode = 'morph';
    this.pos = 0;
    this.playing = false;

    this.port.onmessage = (e) => {
      const d = e.data;
      if (d.type === 'samples') {
        ['tl','tr','bl','br'].forEach(id => {
          this.samples[id] = d[id];
          this.frames[id]  = d[id + '_frames'];
        });
        this.pos = 0;
      }
      if (d.type === 'xy')         { this.xTarget = d.x; this.yTarget = d.y; }
      if (d.type === 'gains')      { ['tl','tr','bl','br'].forEach(id => { this.gains[id] = d[id]; }); }
      if (d.type === 'gain')       { this.gains[d.id] = d.value; }
      if (d.type === 'smoothTime') { this.smoothTime = d.value; }
      if (d.type === 'durationMode') { this.durationMode = d.value; }
      if (d.type === 'play')       { this.pos = 0; this.playing = true; }
      if (d.type === 'stop')       { this.playing = false; this.pos = 0; }
    };
  }

  getWeights(x, y) {
    return {
      tl: (1 - x) * (1 - y),
      tr: x       * (1 - y),
      bl: (1 - x) * y,
      br: x       * y
    };
  }

  getTargetLen(w) {
    const ids = ['tl','tr','bl','br'];
    if (this.durationMode === 'morph') {
      return Math.round(ids.reduce((sum, id) => sum + this.frames[id] * w[id], 0));
    }
    return Math.max(...ids.map(id => this.frames[id]));
  }

  getSample(data, frames, norm, ch) {
    const offset = ch * frames;
    const pos = norm * (frames - 1);
    const idx = Math.floor(pos), frac = pos - idx;
    const v0 = data[offset + idx] || 0;
    const v1 = data[offset + Math.min(idx + 1, frames - 1)] || 0;
    return v0 + frac * (v1 - v0);
  }

  process(inputs, outputs) {
    const outL = outputs[0][0];
    const outR = outputs[0][1] || outL;

    if (!this.playing || !this.samples.tl) {
      outL.fill(0); if (outR !== outL) outR.fill(0);
      return true;
    }

    const coeff = 1 - Math.exp(-1 / (sampleRate * (this.smoothTime || 0.15)));

    for (let i = 0; i < outL.length; i++) {
      this.xSmooth += (this.xTarget - this.xSmooth) * coeff;
      this.ySmooth += (this.yTarget - this.ySmooth) * coeff;

      const w = this.getWeights(this.xSmooth, this.ySmooth);
      const targetLen = this.getTargetLen(w);

      if (this.pos >= targetLen) this.pos = 0; // loop continuo mientras se mantiene pulsado

      const norm = targetLen > 1 ? this.pos / (targetLen - 1) : 0;

      let vL = 0, vR = 0;
      const ids = ['tl','tr','bl','br'];
      ids.forEach(id => {
        if (!this.samples[id]) return;
        vL += this.getSample(this.samples[id], this.frames[id], norm, 0) * this.gains[id] * w[id];
        vR += this.getSample(this.samples[id], this.frames[id], norm, 1) * this.gains[id] * w[id];
      });

      outL[i] = vL;
      if (outR !== outL) outR[i] = vR;
      this.pos++;
    }
    return true;
  }
}

registerProcessor('morph-processor-2d', MorphProcessor2D);
