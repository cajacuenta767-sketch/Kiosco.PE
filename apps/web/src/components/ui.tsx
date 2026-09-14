import { useEffect, type ReactNode } from 'react'
import { soles } from '@sencillo/shared'

export function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCerrar])
  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <div className="modal-cab">
          <h2>{titulo}</h2>
          <button className="btn-icono" aria-label="Cerrar" onClick={onCerrar}>✕</button>
        </div>
        <div className="modal-cuerpo">{children}</div>
      </div>
    </div>
  )
}

export function Vacio({ icono, titulo, texto, children }: { icono: string; titulo: string; texto?: string; children?: ReactNode }) {
  return (
    <div className="vacio">
      <div className="vacio-icono">{icono}</div>
      <h3>{titulo}</h3>
      {texto && <p>{texto}</p>}
      {children}
    </div>
  )
}

export function Campo({ label, children, ayuda }: { label: string; children: ReactNode; ayuda?: string }) {
  return (
    <label className="campo">
      <span className="campo-label">{label}</span>
      {children}
      {ayuda && <span className="campo-ayuda">{ayuda}</span>}
    </label>
  )
}

export interface AccionToast {
  label: string
  fn: () => void
}

export function Toast({ mensaje, accion }: { mensaje: string | null; accion?: AccionToast | null }) {
  if (!mensaje) return null
  return (
    <div className="toast" role="status">
      <span>{mensaje}</span>
      {accion && <button className="toast-accion" onClick={accion.fn}>{accion.label}</button>}
    </div>
  )
}

export interface VentaLista {
  total: number
  vuelto: number
  metodo: string
  deshacer: () => void
}

/** Confirmación de venta: check animado, el vuelto en grande y "Deshacer" a la mano. Se va sola a los pocos segundos. */
export function ConfirmacionVenta({ venta, onCerrar }: { venta: VentaLista | null; onCerrar: () => void }) {
  useEffect(() => {
    if (!venta) return
    const t = window.setTimeout(onCerrar, 4500)
    return () => window.clearTimeout(t)
  }, [venta, onCerrar])
  if (!venta) return null
  const conVuelto = venta.vuelto > 0
  return (
    <div className="venta-lista" role="status" onClick={onCerrar}>
      <svg className="vl-check" viewBox="0 0 52 52" aria-hidden="true">
        <circle cx="26" cy="26" r="25" />
        <path d="M14 27l8 8 16-17" />
      </svg>
      <div className="vl-texto">
        {conVuelto && <em>Le das de vuelto</em>}
        <strong>{conVuelto ? soles(venta.vuelto) : '¡Listo!'}</strong>
        <span>{conVuelto ? `Venta registrada · Vuelto ${soles(venta.vuelto)}` : `Venta registrada · ${soles(venta.total)}`}{venta.metodo ? ` · ${venta.metodo}` : ''}</span>
      </div>
      <button className="vl-deshacer" onClick={(e) => { e.stopPropagation(); venta.deshacer(); onCerrar() }}>Deshacer</button>
    </div>
  )
}

/** Vibración corta para confirmar un toque (si el celular lo permite). */
export function vibrar(ms = 12) {
  try { navigator.vibrate?.(ms) } catch { /* sin vibración */ }
}
