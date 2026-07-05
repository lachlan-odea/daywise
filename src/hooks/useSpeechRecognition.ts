import { useEffect, useRef, useState } from 'react'

// Minimal typings for the Web Speech API (not in lib.dom for all TS versions).
interface SpeechRecognitionEventLike {
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}

function getCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/**
 * Wraps the browser Web Speech API. Reports the full session `transcript`
 * (finalised text) and the in-progress `interim` text. The transcript is
 * rebuilt from the complete results list on every event and replaces the
 * previous value — this avoids the word-duplication bug on Android Chrome,
 * which re-delivers the whole results array (with resultIndex 0) each event.
 */
export function useSpeechRecognition() {
  const [supported] = useState(() => !!getCtor())
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const recRef = useRef<SpeechRecognitionLike | null>(null)

  useEffect(() => {
    const Ctor = getCtor()
    if (!Ctor) return
    const rec = new Ctor()
    rec.lang = 'en-AU'
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (e) => {
      let finalStr = ''
      let interimStr = ''
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i]
        const t = r[0].transcript
        if (r.isFinal) finalStr += (finalStr ? ' ' : '') + t.trim()
        else interimStr += t
      }
      setTranscript(finalStr)
      setInterim(interimStr)
    }
    rec.onend = () => {
      setListening(false)
      setInterim('')
    }
    rec.onerror = () => {
      setListening(false)
      setInterim('')
    }
    recRef.current = rec
    return () => {
      try {
        rec.stop()
      } catch {
        /* ignore */
      }
    }
  }, [])

  const start = () => {
    if (!recRef.current || listening) return
    setTranscript('')
    setInterim('')
    try {
      recRef.current.start()
      setListening(true)
    } catch {
      /* already started */
    }
  }
  const stop = () => {
    recRef.current?.stop()
    setListening(false)
  }

  return { supported, listening, transcript, interim, start, stop }
}
