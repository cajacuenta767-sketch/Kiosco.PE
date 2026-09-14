import { useEffect, useRef, useState } from 'react'

type Reconocedor = { lang: string; interimResults: boolean; maxAlternatives: number; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null }
type Ctor = new () => Reconocedor

function obtener(): Ctor | null {
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Buscar por voz: "inca kola", "arroz". Solo aparece si el navegador lo soporta (Chrome en Android sí). */
export function Microfono({ onTexto }: { onTexto: (t: string) => void }) {
  const [soporta, setSoporta] = useState(false)
  const [escuchando, setEscuchando] = useState(false)
  const ref = useRef<Reconocedor | null>(null)
  useEffect(() => setSoporta(obtener() !== null), [])
  if (!soporta) return null

  function escuchar() {
    const C = obtener()
    if (!C) return
    if (escuchando) {
      ref.current?.stop()
      return
    }
    const r = new C()
    r.lang = 'es-PE'
    r.interimResults = false
    r.maxAlternatives = 1
    r.onresult = (e) => {
      const t = e.results[0]?.[0]?.transcript?.trim()
      if (t) onTexto(t)
    }
    r.onend = () => setEscuchando(false)
    r.onerror = () => setEscuchando(false)
    ref.current = r
    setEscuchando(true)
    try {
      r.start()
    } catch {
      setEscuchando(false)
    }
  }

  return (
    <button className={'btn-secundario btn-cuadrado' + (escuchando ? ' escuchando' : '')} title="Buscar por voz" aria-label="Buscar por voz" onClick={escuchar}>
      🎤
    </button>
  )
}
