import { useState } from 'react'
import { verificarPin, type Modo } from '../lib/pin'

/**
 * Pantalla de entrada al abrir la app cuando la dueña activó "Pedir PIN al abrir".
 * La dueña entra con su PIN; si el modo ayudante está activo, el ayudante entra sin PIN pero solo a lo suyo.
 */
export function Bloqueo({ nombreBodega, modo, onEntrar }: { nombreBodega: string; modo: Modo; onEntrar: (como: Modo) => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [comprobando, setComprobando] = useState(false)

  async function entrarDuena() {
    setComprobando(true)
    try {
      if (await verificarPin(pin)) onEntrar('duena')
      else {
        setError('PIN incorrecto')
        setPin('')
      }
    } finally {
      setComprobando(false)
    }
  }

  return (
    <div className="bienvenida bloqueo">
      <div className="bienvenida-cab">
        <img src="/icon.svg" alt="" width={72} height={72} />
        <h1>{nombreBodega || 'Sencillo'}</h1>
        <p>Escribe tu PIN para entrar</p>
      </div>
      <div className="bienvenida-cuerpo">
        <input
          className="pin-grande"
          autoFocus
          type="password"
          inputMode="numeric"
          maxLength={6}
          placeholder="••••"
          aria-label="PIN"
          value={pin}
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError('') }}
          onKeyDown={(e) => e.key === 'Enter' && pin.length >= 4 && entrarDuena()}
        />
        {error && <p className="texto-peligro centrado">{error}</p>}
        <button className="btn-primario grande ancho" disabled={pin.length < 4 || comprobando} onClick={entrarDuena}>Entrar</button>
        {modo === 'ayudante' && (
          <button className="btn-secundario ancho" onClick={() => onEntrar('ayudante')}>👩‍👧 Entrar como ayudante (sin PIN)</button>
        )}
        <p className="nota centrado">¿Olvidaste tu PIN? Desde otro celular con la bodega puedes cambiarlo en Más, o restaura tu respaldo.</p>
      </div>
    </div>
  )
}
