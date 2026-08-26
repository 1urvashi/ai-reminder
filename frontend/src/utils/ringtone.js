// A classic two-tone "ring-ring" pattern synthesized with the Web Audio API —
// no audio file, no third-party asset, works fully offline and free.

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

// Each caller gets its OWN independent ringer (own AudioContext/timer). Two
// unrelated features (e.g. the "AI is calling" overlay and the location
// proximity alert) must never share start/stop state — one finishing early
// or late would otherwise silence or restart the other's ring.
export function createRingtone() {
  let audioCtx = null;
  let timerId = null;

  function ringCycle() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    playPulse(audioCtx, now, 480, 0.35);
    playPulse(audioCtx, now + 0.4, 440, 0.35);
  }

  function start() {
    if (timerId) return; // already ringing
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    ringCycle();
    timerId = setInterval(ringCycle, 2200);
  }

  function stop() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    if (audioCtx) {
      audioCtx.close().catch(() => {});
      audioCtx = null;
    }
  }

  return { start, stop };
}
