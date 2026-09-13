import { useEffect, useRef, useState } from 'react'
import { Modal } from './ui'

type DetectorCtor = new (opts?: { formats?: string[] }) => { detect(src: HTMLVideoElement): Promise<{ rawValue: string }[]> }

function obtenerDetector(): DetectorCtor | null {
  const w = window as unknown as { BarcodeDetector?: DetectorCtor }
  return w.BarcodeDetector ?? null
}

export const soportaEscaner = () => obtenerDetector() !== null && !!navigator.mediaDevices?.getUserMedia

/** Escáner de código de barras con la cámara del celular (BarcodeDetector API). Sin librerías. */
export function Escaner({ onCodigo, onCerrar, titulo = 'Escanear código' }: { onCodigo: (codigo: string) => void; onCerrar: () => void; titulo?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  const [manual, setManual] = useState('')

  useEffect(() => {
    const Detector = obtenerDetector()
    if (!Detector) {
      setError('Este navegador no puede leer códigos con la cámara. Escribe el código o usa un lector.')
      return
    }
    let activo = true
    let stream: MediaStream | null = null
    let ultimo = ''
    const detector = new Detector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'] })

    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (!activo || !videoRef.current) return
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        const tick = async () => {
          if (!activo || !videoRef.current) return
          try {
            const codigos = await detector.detect(videoRef.current)
            const c = codigos[0]?.rawValue
            if (c && c !== ultimo) {
              ultimo = c
              if (navigator.vibrate) navigator.vibrate(60)
              onCodigo(c)
            }
          } catch {
            /* frame no listo */
          }
          setTimeout(tick, 250)
        }
        tick()
      } catch {
        setError('No se pudo abrir la cámara. Revisa el permiso o escribe el código.')
      }
    })()

    return () => {
      activo = false
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [onCodigo])

  return (
    <Modal titulo={titulo} onCerrar={onCerrar}>
      {!error && (
        <div className="escaner">
          <video ref={videoRef} muted playsInline />
          <div className="escaner-guia" />
        </div>
      )}
      {error && <p className="nota texto-peligro">{error}</p>}
      <div className="buscador con-boton">
        <input type="text" inputMode="numeric" placeholder="O escribe el código…" value={manual} onChange={(e) => setManual(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && manual.trim() && onCodigo(manual.trim())} />
        <button className="btn-primario" disabled={!manual.trim()} onClick={() => onCodigo(manual.trim())}>Usar</button>
      </div>
    </Modal>
  )
}
