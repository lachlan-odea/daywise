import { useEffect, useRef, useState } from 'react'

// Minimal typings for the Web Speech API (not in lib.dom for all TS versions).
interface SpeechRecognitionEventLike {
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>
}
interface SpeechRecognitionErrorLike {
  error?: string
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: SpeechRecognitionErrorLike) => void) | null
  onend: (() => void) | null
}

function getCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const join = (a: string, b: string) => (a && b ? `${a} ${b}` : a || b)

/**
 * Wraps the browser Web Speech API.
 *
 * Runs in NON-continuous mode and auto-restarts while the user is recording.
 * Mobile Chrome (Android) in continuous mode re-emits growing partial phrases as
 * repeated "final" results, which produces escalating word duplication when the
 * results array is concatenated. Short per-utterance sessions each yield a single
 * clean final; we commit that to an accumulated transcript and restart. Within a
 * session the transcript is *replaced* (never appended) so partials can't duplicate.
 */
export function useSpeechRecognition() {
  const [supported] = useState(() => !!getCtor())
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const recRef = useRef<SpeechRecognitionLike | null>(null)

  const committedRef = useRef('') // text finalised in previous sessions
  const sessionRef = useRef('') // final text for the current session
  const wantRef = useRef(false) // whether the user still wants to record

  useEffect(() => {
    const Ctor = getCtor()
    if (!Ctor) return
    const rec = new Ctor()
    rec.lang = 'en-AU'
    rec.continuous = false
    rec.interimResults = true

    rec.onresult = (e) => {
      let fin = ''
      let intr = ''
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i]
        const t = r[0].transcript
        if (r.isFinal) fin = join(fin, t.trim())
        else intr += t
      }
      // Replace (not append) the current session's final text each event.
      sessionRef.current = fin
      setTranscript(join(committedRef.current, fin))
      setInterim(intr)
    }

    rec.onend = () => {
      // Commit this session's final text, then continue if still recording.
      committedRef.current = join(committedRef.current, sessionRef.current)
      sessionRef.current = ''
      setTranscript(committedRef.current)
      setInterim('')
      if (wantRef.current) {
        try {
          rec.start()
        } catch {
          /* engine not ready yet — a later onend will retry */
        }
      } else {
        setListening(false)
      }
    }

    rec.onerror = (e) => {
      // Permission / fatal errors should stop; transient ones (e.g. no-speech)
      // fall through to onend, which restarts while recording.
      if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
        wantRef.current = false
        setListening(false)
      }
      setInterim('')
    }

    recRef.current = rec
    return () => {
      wantRef.current = false
      try {
        rec.abort()
      } catch {
        /* ignore */
      }
    }
  }, [])

  const start = () => {
    if (!recRef.current || listening) return
    committedRef.current = ''
    sessionRef.current = ''
    setTranscript('')
    setInterim('')
    wantRef.current = true
    try {
      recRef.current.start()
      setListening(true)
    } catch {
      /* already started */
    }
  }

  const stop = () => {
    wantRef.current = false
    recRef.current?.stop()
    setListening(false)
  }

  return { supported, listening, transcript, interim, start, stop }
}
