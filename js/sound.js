// Sonidos sintetizados (sin archivos).
let ctx;
export const sound = { enabled: true };

function tone(freq, dur, type = 'sine', gain = 0.15, when = 0) {
  if (!sound.enabled) return;
  try {
    ctx ||= new AudioContext();
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur);
  } catch { /* sin audio */ }
}

function knock(gain = 0.35, freq = 180) {
  if (!sound.enabled) return;
  try {
    ctx ||= new AudioContext();
    const len = 0.06;
    const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 4);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq * 6;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(ctx.destination);
    src.start();
  } catch { /* sin audio */ }
}

export const sfx = {
  move: () => knock(0.35, 220),
  capture: () => { knock(0.55, 160); knock(0.3, 300); },
  check: () => { knock(0.4, 220); tone(880, 0.12, 'triangle', 0.06); },
  good: () => { tone(660, 0.1, 'sine', 0.08); tone(990, 0.15, 'sine', 0.08, 0.08); },
  bad: () => { tone(300, 0.18, 'triangle', 0.08); tone(220, 0.25, 'triangle', 0.08, 0.12); },
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'sine', 0.08, i * 0.1)),
  play(mv, chessAfter) {
    if (chessAfter?.inCheck()) this.check();
    else if (mv?.captured) this.capture();
    else this.move();
  },
};
