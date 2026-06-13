// Tiny Web-Audio sound kit (no audio files). Sounds are played by only ONE
// phone per team (the team's "audio leader") so a room of phones doesn't turn
// the timer into a jumbled mess. Browsers require a user gesture before audio
// can start, so call unlockAudio() from a tap (e.g. the Ready button).

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export function unlockAudio() {
  ac();
}

function tone(freq: number, dur: number, type: OscillatorType = "sine", gain = 0.18, delay = 0) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.connect(g);
  g.connect(c.destination);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t);
  o.stop(t + dur + 0.03);
}

export const SOUND = {
  tick: () => tone(880, 0.06, "sine", 0.1),
  warn: () => tone(700, 0.16, "triangle", 0.16),
  timeUp: () => {
    tone(180, 0.45, "sawtooth", 0.22);
    tone(138, 0.5, "sawtooth", 0.16, 0.02);
  },
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, "sine", 0.18, i * 0.13)),
};
