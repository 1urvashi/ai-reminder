// Runs OpenAI's Whisper speech-recognition model entirely in the browser via
// Transformers.js (ONNX Runtime + WebAssembly) — free, no server round-trip,
// no API cost. Whisper's multilingual training gives it far better Gujarati/
// Hindi accuracy than the browser's built-in Web Speech API. Runs in a
// worker so the (CPU-heavy) transcription doesn't freeze the UI.
import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;

// 'large-v3-turbo' only shrinks the DECODER (4 layers vs 32) for speed — it
// keeps the full large-v3 ENCODER, so the download is still 300-500MB+.
// Not practical for a free, one-time-download browser model. 'small' is a
// genuinely smaller encoder+decoder pair (~250MB at q8) while still clearly
// better than 'base' on Gujarati/Hindi — the right size/accuracy tradeoff
// for something that has to download over a phone connection.
// Use the onnx-community repo (not Xenova/*) — Xenova's older repos were
// converted for the legacy @xenova/transformers (v2) toolchain.
// This model's default (and its q8 variant) picks a quantized decoder file
// with broken dequantization metadata ("missing required scale") in ONNX
// Runtime Web. Force fp32 for every sub-model explicitly — bigger download,
// but no quantization ops involved at all, so it can't hit that bug.
const MODEL = 'onnx-community/whisper-small';
const DTYPE = { encoder_model: 'fp32', decoder_model_merged: 'fp32' };

class TranscriberSingleton {
  static instance = null;

  static async getInstance(progressCallback) {
    if (this.instance === null) {
      this.instance = pipeline('automatic-speech-recognition', MODEL, {
        dtype: DTYPE,
        progress_callback: progressCallback,
      });
    }
    return this.instance;
  }
}

self.addEventListener('message', async (event) => {
  const { type, audio, language } = event.data;

  if (type === 'load') {
    try {
      await TranscriberSingleton.getInstance((progress) => {
        self.postMessage({ type: 'progress', progress });
      });
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message });
    }
    return;
  }

  if (type === 'transcribe') {
    try {
      const transcriber = await TranscriberSingleton.getInstance();
      const output = await transcriber(audio, {
        language,
        task: 'transcribe',
        chunk_length_s: 30,
      });
      self.postMessage({ type: 'result', text: (output.text || '').trim() });
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message });
    }
  }
});
