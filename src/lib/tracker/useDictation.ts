'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SpeechLang } from './spoken';

/**
 * The browser's own speech recognition, held open for as long as you are talking.
 *
 * Recognition sessions end on their own — after a pause on iOS, after a minute on
 * Chrome — so while `listening` is meant to be on, an ended session is quietly
 * started again. Each final result is handed over once; iOS in particular re-reports
 * results it has already finalised, and those are dropped by index.
 *
 * Nothing leaves this hook but text. Where the API does not exist at all
 * (`supported` is false) the screen falls back to typing.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

function recognitionCtor(): any {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useDictation({ lang, onFinal }: { lang: SpeechLang; onFinal: (text: string) => void }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  const want = useRef(false);
  const rec = useRef<any>(null);
  const handed = useRef(new Set<number>());
  const finalRef = useRef(onFinal);
  finalRef.current = onFinal;
  /** the latest `begin`, so a restart after a language switch uses the new language */
  const beginRef = useRef<() => void>(() => {});

  useEffect(() => setSupported(recognitionCtor() !== null), []);

  const begin = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    handed.current = new Set();

    r.onresult = (event: any) => {
      let live = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = String(result[0]?.transcript ?? '').trim();
        if (result.isFinal) {
          if (!handed.current.has(i) && text) {
            handed.current.add(i);
            finalRef.current(text);
          }
        } else live += `${text} `;
      }
      setInterim(live.trim());
    };

    r.onerror = (event: any) => {
      const code = event?.error as string | undefined;
      if (code === 'no-speech' || code === 'aborted') return;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        want.current = false;
        setListening(false);
        setError('Microphone access was refused. Allow it for this site, or type instead.');
        return;
      }
      setError(code ? `Dictation stopped (${code}).` : 'Dictation stopped.');
    };

    r.onend = () => {
      setInterim('');
      if (want.current) {
        // the session timed out under us, not because we asked — pick it back up
        try {
          beginRef.current();
        } catch {
          want.current = false;
          setListening(false);
        }
      } else setListening(false);
    };

    rec.current = r;
    try {
      r.start();
    } catch {
      /* already started — harmless */
    }
  }, [lang]);
  beginRef.current = begin;

  const start = useCallback(() => {
    setError(null);
    want.current = true;
    setListening(true);
    begin();
  }, [begin]);

  const stop = useCallback(() => {
    want.current = false;
    setListening(false);
    setInterim('');
    try {
      rec.current?.stop();
    } catch {
      /* not running */
    }
  }, []);

  // switching language mid-session restarts with the new one
  useEffect(() => {
    if (!want.current) return;
    try {
      rec.current?.abort();
    } catch {
      /* ignore */
    }
  }, [lang]);

  useEffect(
    () => () => {
      want.current = false;
      try {
        rec.current?.abort();
      } catch {
        /* ignore */
      }
    },
    [],
  );

  return { supported, listening, interim, error, start, stop };
}
