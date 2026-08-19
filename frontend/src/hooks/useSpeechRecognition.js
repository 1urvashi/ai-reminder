import { useCallback, useEffect, useRef, useState } from 'react';

// Wraps the browser Web Speech API (Chrome/Edge). The caller starts listening
// with a language and a callback that fires once with the final transcript, so
// a spoken sentence can be forwarded straight to the reminder chat pipeline.
export function useSpeechRecognition() {
  const SRClass =
    typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  const supported = Boolean(SRClass);

  const recognitionRef = useRef(null);
  const onFinalRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supported) {
      return undefined;
    }
    const recognition = new SRClass();
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (text && onFinalRef.current) {
            onFinalRef.current(text);
          }
        } else {
          interimText += result[0].transcript;
        }
      }
      setInterim(interimText);
    };
    recognition.onerror = (event) => setError(event.error || 'speech recognition error');
    recognition.onend = () => {
      setListening(false);
      setInterim('');
    };

    recognitionRef.current = recognition;
    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
    };
  }, [supported, SRClass]);

  const start = useCallback((lang, onFinal) => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      return;
    }
    onFinalRef.current = typeof onFinal === 'function' ? onFinal : null;
    recognition.lang = lang || 'en-IN';
    setError('');
    try {
      recognition.start();
      setListening(true);
    } catch {
      // start() throws if already running; ignore and keep the current session.
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  return { supported, listening, interim, error, start, stop };
}
