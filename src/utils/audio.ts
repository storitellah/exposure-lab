/**
 * Synthesised UI sounds (no audio assets needed). All sounds respect the
 * user's sound preference and fail silently where WebAudio is missing.
 */
let ctx: AudioContext | null = null;

function audioCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Short mechanical click resembling a shutter actuation. */
export function playShutterSound(enabled: boolean): void {
  if (!enabled) return;
  const ac = audioCtx();
  if (!ac) return;
  const now = ac.currentTime;
  const noise = ac.createBufferSource();
  const buffer = ac.createBuffer(1, ac.sampleRate * 0.06, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.18));
  }
  noise.buffer = buffer;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.35, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2400;
  noise.connect(filter).connect(gain).connect(ac.destination);
  noise.start(now);
  noise.stop(now + 0.09);
}

/** Gentle success chime for completed lessons and badges. */
export function playSuccessSound(enabled: boolean): void {
  if (!enabled) return;
  const ac = audioCtx();
  if (!ac) return;
  const now = ac.currentTime;
  [523.25, 659.25, 783.99].forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + i * 0.09);
    gain.gain.exponentialRampToValueAtTime(0.12, now + i * 0.09 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + 0.3);
    osc.connect(gain).connect(ac.destination);
    osc.start(now + i * 0.09);
    osc.stop(now + i * 0.09 + 0.32);
  });
}
