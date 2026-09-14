import { useState } from 'react'
import { verificarPin, type Modo } from '../lib/pin'
import { verificarPinCuenta } from '../sync/motor'
import { Campo } from '../components/ui'
import { PIN_CUENTA_OK, soloDigitos } from './Acceso'

/**
 * Pantalla de entrada al abrir la app cuando la dueña activó "Pedir PIN al abrir".
 * La dueña entra con su PIN; si el modo ayudante está activo, el ayudante entra sin PIN pero solo a lo suyo.
 * Si olvidó el PIN local y tiene cuenta en la nube, entra con el PIN de la cuenta.
 */
export function Bloqueo({ nombreBodega, modo, nubeActiva, onEntrar }: { nombreBodega: string; modo: Modo; nubeActiva: boolean; onEntrar: (como: Modo, recuperado?: boolean) => void }) {
  const [pin, setPin] = useState('')
  const [pinCuenta, setPinCuenta] = useState('')
  const [recuperar, setRecuperar] = useState(false)
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

  async function entrarConCuenta() {
    setComprobando(true)
    setError('')
    try {
      await verificarPinCuenta(pinCuenta)
      onEntrar('duena', true)
    } catch (e) {
      setError((e as Error).message)
      setPinCuenta('')
    } finally {
      setComprobando(false)
    }
  }

  return (
    <div className="bienvenida bloqueo">
      <div className="bienvenida-cab">
        <img src="/icon.svg" alt="" width={72} height={72} />
        <h1>{nombreBodega || 'Sencillo'}</h1>
        <p>{recuperar ? 'Escribe el PIN de tu cuenta en la nube' : 'Escribe tu PIN para entrar'}</p>
      </div>
      {!recuperar ? (
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
            onChange={(e) => { setPin(soloDigitos(e.target.value)); setError('') }}
            onKeyDown={(e) => e.key === 'Enter' && pin.length >= 4 && entrarDuena()}
          />
          {error && <p className="texto-peligro centrado">{error}</p>}
          <button className="btn-primario grande ancho" disabled={pin.length < 4 || comprobando} onClick={entrarDuena}>Entrar</button>
          {modo === 'ayudante' && (
            <button className="btn-secundario ancho" onClick={() => onEntrar('ayudante')}>👩‍👧 Entrar como ayudante (sin PIN)</button>
          )}
          {nubeActiva ? (
            <button className="btn-enlace" onClick={() => { setRecuperar(true); setError('') }}>¿Olvidaste tu PIN?</button>
          ) : (
            <p className="nota centrado">¿Olvidaste tu PIN? Desde otro celular con la bodega puedes cambiarlo en Más, o restaura tu respaldo.</p>
          )}
        </div>
      ) : (
        <div className="bienvenida-cuerpo">
          <p className="nota centrado">Es el PIN con el que creaste tu cuenta (el que usas con tu número de celular). Necesitas internet.</p>
          <Campo label="PIN de la cuenta">
            <input autoFocus type="password" inputMode="numeric" maxLength={6} autoComplete="current-password" value={pinCuenta} onChange={(e) => { setPinCuenta(soloDigitos(e.target.value)); setError('') }} onKeyDown={(e) => e.key === 'Enter' && PIN_CUENTA_OK.test(pinCuenta) && entrarConCuenta()} />
          </Campo>
          {error && <p className="texto-peligro centrado">{error}</p>}
          <button className="btn-primario grande ancho" disabled={!PIN_CUENTA_OK.test(pinCuenta) || comprobando} onClick={entrarConCuenta}>{comprobando ? 'Comprobando…' : 'Entrar con mi cuenta'}</button>
          <button className="btn-enlace" onClick={() => { setRecuperar(false); setError('') }}>Volver</button>
        </div>
      )}
    </div>
  )
}
