type ChimeKind = "wake" | "success" | "error";

let audioContext: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioContext) {
    const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctor) return null;
    audioContext = new Ctor();
  }
  return audioContext;
}

function tone(ctx: AudioContext, frequency: number, startAt: number, duration: number, gainValue: number) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(gainValue, startAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}

/** Short synthesized feedback, so no audio assets are required. */
export function playAtlasChime(kind: ChimeKind): void {
  const ctx = context();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  const now = ctx.currentTime + 0.01;

  if (kind === "wake") {
    tone(ctx, 660, now, 0.12, 0.05);
    tone(ctx, 990, now + 0.13, 0.16, 0.05);
    return;
  }
  if (kind === "success") {
    tone(ctx, 880, now, 0.1, 0.045);
    tone(ctx, 1320, now + 0.1, 0.14, 0.045);
    return;
  }
  tone(ctx, 320, now, 0.18, 0.05);
  tone(ctx, 220, now + 0.16, 0.22, 0.05);
}
