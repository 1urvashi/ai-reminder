import { useCallback, useRef, useState } from 'react';
import { blobToMonoPCM16k } from '../utils/audioResample';

const MIN_DURATION_S = 0.6;
const SILENCE_RMS_THRESHOLD = 0.01;

// Whisper is known to "hallucinate" plausible-sounding text (leftover
// artifacts of its training data) when given very short or silent audio —
// e.g. someone tapping the mic and stopping again before actually speaking.
// Catch that here instead of sending garbage to the model.
function isTooQuietOrShort(samples) {
  if (samples.length / 16000 < MIN_DURATION_S) return true;
  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) sumSquares += samples[i] * samples[i];
  const rms = Math.sqrt(sumSquares / samples.length);
  return rms < SILENCE_RMS_THRESHOLD;
}

// Free, in-browser speech-to-text using OpenAI's Whisper model (via
// Transformers.js) — far better Gujarati/Hindi accuracy than the browser's
// built-in Web Speech API, at the cost of a one-time model download (~74MB,
// cached after) and a few seconds of processing per recording. The worker
// and model load lazily, only when the user first taps the mic.
export function useWhisperTranscription() {
  const supported =
    typeof window !== 'undefined' &&
    typeof Worker !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia);

  const [status, setStatus] = useState('idle'); // idle | loading | ready | recording | transcribing | error
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const workerRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const onFinalRef = useRef(null);
  const langRef = useRef('en');

  function ensureWorker() {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker(new URL('../workers/whisperWorker.js', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event) => {
      const { type } = event.data;
      if (type === 'progress') {
        const p = event.data.progress;
        if (typeof p?.progress === 'number') setProgress(Math.round(p.progress));
      } else if (type === 'ready') {
        setStatus((s) => (s === 'loading' ? 'ready' : s));
      } else if (type === 'result') {
        setStatus('ready');
        onFinalRef.current?.(event.data.text);
      } else if (type === 'error') {
        setStatus('error');
        setError(event.data.message || 'Speech recognition failed');
      }
    };
    // Without this, a crash while the worker module loads (before it can
    // even post an 'error' message back) fails silently and the UI just
    // hangs on "loading" forever.
    worker.onerror = (event) => {
      setStatus('error');
      setError(`Speech model failed to load: ${event.message || 'unknown worker error'}`);
    };
    workerRef.current = worker;
    return worker;
  }

  const start = useCallback(async (langCode, onFinal) => {
    if (!supported) return;
    setError('');
    onFinalRef.current = typeof onFinal === 'function' ? onFinal : null;
    langRef.current = langCode || 'en';

    const worker = ensureWorker();
    if (status === 'idle' || status === 'error') {
      setStatus('loading');
      setProgress(0);
      worker.postMessage({ type: 'load' });
      // Wait for the model to finish loading before recording.
      await new Promise((resolve) => {
        const handler = (event) => {
          if (event.data.type === 'ready' || event.data.type === 'error') {
            worker.removeEventListener('message', handler);
            resolve();
          }
        };
        worker.addEventListener('message', handler);
      });
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (chunksRef.current.length === 0) {
          setStatus('ready');
          return;
        }
        setStatus('transcribing');
        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
          const pcm = await blobToMonoPCM16k(blob);
          if (isTooQuietOrShort(pcm)) {
            setStatus('ready');
            setError('Recording was too short or too quiet — tap the mic and speak a bit longer.');
            return;
          }
          workerRef.current?.postMessage({ type: 'transcribe', audio: pcm, language: langRef.current });
        } catch (err) {
          setStatus('error');
          setError(err.message || 'Could not process the recording');
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setStatus('recording');
    } catch (err) {
      setStatus('error');
      setError(err.message || 'Microphone access denied');
    }
  }, [status, supported]);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  }, []);

  return { supported, status, progress, error, start, stop };
}
