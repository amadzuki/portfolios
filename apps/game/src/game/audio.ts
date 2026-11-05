/** Tiny generative WebAudio score: a warm pad plus pentatonic chimes that climb with your combo. */
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const ROOT = 220; // A3

export function createAudio() {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let verb: ConvolverNode | null = null;
  let muted = false;
  try {
    muted = localStorage.getItem('lumen:muted') === '1';
  } catch {
    /* storage unavailable */
  }

  const freq = (semi: number) => ROOT * 2 ** (semi / 12);

  function impulse(c: AudioContext, seconds = 2.8) {
    const len = c.sampleRate * seconds;
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++)
        d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    }
    return buf;
  }

  function startPad(c: AudioContext, out: AudioNode) {
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const g = c.createGain();
    g.gain.value = 0.05;
    filter.connect(g).connect(out);
    const chords = [
      [0, 7, 12, 16],
      [-3, 4, 9, 12],
      [-5, 2, 7, 14],
      [-7, 0, 5, 12],
    ];
    const oscs = chords[0].flatMap((s) =>
      [-6, 6].map((detune) => {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = freq(s - 12);
        o.detune.value = detune;
        o.connect(filter);
        o.start();
        return o;
      }),
    );
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 400;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
    let step = 0;
    setInterval(() => {
      step = (step + 1) % chords.length;
      chords[step].forEach((s, i) => {
        oscs[i * 2].frequency.setTargetAtTime(freq(s - 12), c.currentTime, 1.2);
        oscs[i * 2 + 1].frequency.setTargetAtTime(
          freq(s - 12),
          c.currentTime,
          1.2,
        );
      });
    }, 8000);
  }

  function tone(
    f: number,
    dur: number,
    vol: number,
    type: OscillatorType = 'sine',
  ) {
    if (!ctx || !master || !verb) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(master);
    g.connect(verb);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  return {
    get muted() {
      return muted;
    },
    /** Must be called from a user gesture. */
    unlock() {
      if (ctx) {
        void ctx.resume();
        return;
      }
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.8;
      master.connect(ctx.destination);
      verb = ctx.createConvolver();
      verb.buffer = impulse(ctx);
      const wet = ctx.createGain();
      wet.gain.value = 0.35;
      verb.connect(wet).connect(master);
      startPad(ctx, master);
    },
    toggleMute() {
      muted = !muted;
      try {
        localStorage.setItem('lumen:muted', muted ? '1' : '0');
      } catch {
        /* ignore */
      }
      if (ctx && master)
        master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.05);
      return muted;
    },
    mote(combo: number) {
      const n = PENTA[Math.min(PENTA.length - 1, combo % PENTA.length)];
      tone(freq(n + 12), 0.6, 0.08, 'triangle');
    },
    gate(multiplier: number) {
      const base = PENTA[Math.min(PENTA.length - 3, multiplier)];
      tone(freq(base + 12), 1.4, 0.07);
      tone(freq(base + 19), 1.6, 0.05);
      tone(freq(base + 24), 1.8, 0.035);
    },
    miss() {
      tone(freq(-5), 0.5, 0.05, 'triangle');
    },
    crash() {
      tone(55, 1.4, 0.25, 'sawtooth');
      tone(41, 1.8, 0.2, 'sine');
    },
    suspend() {
      void ctx?.suspend();
    },
    resume() {
      void ctx?.resume();
    },
  };
}
