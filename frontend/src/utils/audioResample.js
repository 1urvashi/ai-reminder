// Whisper expects mono PCM samples at 16kHz. MediaRecorder gives us a
// compressed (webm/opus) blob, so decode it and resample via an
// OfflineAudioContext — the standard free, in-browser way to do this
// (no server, no extra library).
const WHISPER_SAMPLE_RATE = 16000;

export async function blobToMonoPCM16k(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const decodingCtx = new AudioCtx();
  let decoded;
  try {
    decoded = await decodingCtx.decodeAudioData(arrayBuffer);
  } finally {
    decodingCtx.close().catch(() => {});
  }

  const offlineCtx = new OfflineAudioContext(
    1,
    Math.ceil(decoded.duration * WHISPER_SAMPLE_RATE),
    WHISPER_SAMPLE_RATE
  );
  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start(0);
  const rendered = await offlineCtx.startRendering();
  return rendered.getChannelData(0);
}
