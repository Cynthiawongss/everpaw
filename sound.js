/* EverPaw Home — sound, made in the browser: a quiet room tone and small noises for what happens in it.
   Nothing plays until the first tap, and it can be switched off. */
export function createSound() {
  let ctx = null, master = null, bed = null, bedGain = null, on = true, phase = 'day';
  const Ctx = window.AudioContext || window.webkitAudioContext;

  function noise(seconds, brown) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate), d = buf.getChannelData(0); let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
    return buf;
  }
  let white = null, brown = null;
  function ensure() {
    if (ctx || !Ctx) return !!ctx;
    ctx = new Ctx(); master = ctx.createGain(); master.gain.value = on ? 1 : 0; master.connect(ctx.destination);
    white = noise(1, false); brown = noise(4, true);
    bed = ctx.createBufferSource(); bed.buffer = brown; bed.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    bedGain = ctx.createGain(); bedGain.gain.value = 0; bed.connect(lp).connect(bedGain).connect(master); bed.start();
    setPhase(phase); return true;
  }
  function env(node, peak, attack, decay, when = 0) {
    const g = ctx.createGain(), t0 = ctx.currentTime + when; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    node.connect(g).connect(master); return t0;
  }
  function burst(freq, q, peak, decay, when = 0, type = 'bandpass') {
    const s = ctx.createBufferSource(); s.buffer = white; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; s.connect(f);
    const t0 = env(f, peak, 0.004, decay, when); s.start(t0); s.stop(t0 + decay + 0.05);
  }
  function tone(freq, peak, decay, when = 0, to) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(freq, ctx.currentTime + when); if (to) o.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + when + decay);
    const t0 = env(o, peak, 0.008, decay, when); o.start(t0); o.stop(t0 + decay + 0.05);
  }
  const SFX = {
    step: () => burst(900 + Math.random() * 500, 1.2, 0.012, 0.05, 0, 'lowpass'),
    crunch: () => { burst(2400, 2, 0.03, 0.05); burst(1800, 2, 0.025, 0.06, 0.09); },
    lap: () => { tone(520, 0.03, 0.07, 0, 300); tone(460, 0.025, 0.07, 0.16, 280); },
    happy: () => { tone(660, 0.045, 0.35); tone(880, 0.04, 0.45, 0.12); },
    jump: () => tone(320, 0.03, 0.18, 0, 620),
    ball: () => burst(500, 3, 0.05, 0.09, 0, 'lowpass'),
    place: () => tone(150, 0.09, 0.16, 0, 80),
    ui: () => burst(3200, 4, 0.012, 0.03),
    purr: () => {
      const s = ctx.createBufferSource(); s.buffer = brown; s.loop = true; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
      const am = ctx.createGain(); am.gain.value = 0.5; const lfo = ctx.createOscillator(); lfo.frequency.value = 23; const depth = ctx.createGain(); depth.gain.value = 0.5; lfo.connect(depth).connect(am.gain);
      s.connect(lp).connect(am); const t0 = env(am, 0.22, 0.25, 2.2); s.start(t0); lfo.start(t0); s.stop(t0 + 2.6); lfo.stop(t0 + 2.6);
    },
  };
  function setPhase(p) { phase = p; if (bedGain) bedGain.gain.setTargetAtTime(p === 'night' ? 0.035 : 0.06, ctx.currentTime, 1.5); }
  return {
    wake() { if (ensure() && ctx.state === 'suspended') ctx.resume(); },
    play(name) { if (!on || !ctx || ctx.state !== 'running' || !SFX[name]) return; try { SFX[name](); } catch (e) { /* a sound is never worth an error */ } },
    setPhase,
    setOn(v) { on = v; if (master) master.gain.setTargetAtTime(v ? 1 : 0, ctx.currentTime, 0.08); },
    isOn: () => on,
  };
}
