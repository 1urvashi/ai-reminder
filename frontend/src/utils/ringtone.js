// A classic two-tone "ring-ring" pattern synthesized with the Web Audio API —
// no audio file, no third-party asset, works fully offline and free.
let audioCtx = null;
let timerId = null;

function playPulse(ctx, startAt, freq, duration) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.25, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.05);
}

function ringCycle() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  // Two quick tones (like a classic phone ring), then a pause before the loop repeats.
  playPulse(audioCtx, now, 480, 0.35);
  playPulse(audioCtx, now + 0.4, 440, 0.35);
}

export function startRingtone() {
  if (timerId) return; // already ringing
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  ringCycle();
  timerId = setInterval(ringCycle, 2200);
}

export function stopRingtone() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  if (audioCtx) {
    audioCtx.close().catch(() => {});
    audioCtx = null;
  }
}
