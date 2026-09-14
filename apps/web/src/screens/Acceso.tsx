import { useState, type ReactNode } from 'react'
import { Campo } from '../components/ui'

/**
 * Formularios de registro y de entrada a la cuenta. Los usan la bienvenida (pantalla completa)
 * y la sección "Mi cuenta y la nube" de Más (en un modal), para que el login sea el mismo en los dos sitios.
 */

export const TELEFONO_OK = /^\d{9}$/
export const PIN_CUENTA_OK = /^\d{4,6}$/
export const soloDigitos = (v: string) => v.replace(/\D/g, '')
const limpiarUrl = (u: string) => u.trim().replace(/\/$/, '')

export function nombreDelDispositivo(): string {
  const ua = navigator.userAgent
  if (/Android/i.test(ua)) return 'Celular Android'
  if (/iPhone|iPad/i.test(ua)) return 'iPhone'
  return 'Computadora'
}

export interface DatosRegistro {
  url: string
  nombre: string
  telefono: string
  pin: string
}

function ServidorAvanzado({ servidor, onCambio }: { servidor: string; onCambio: (v: string) => void }) {
  const [avanzado, setAvanzado] = useState(false)
  if (!avanzado) return <button type="button" className="btn-enlace" onClick={() => setAvanzado(true)}>Opciones avanzadas</button>
  return (
    <Campo label="Dirección del servidor" ayuda="Solo si usas tu propio servidor">
      <input type="url" value={servidor} onChange={(e) => onCambio(e.target.value)} />
    </Campo>
  )
}

/** Registro: nombre de la bodega, celular y PIN (dos veces). `children` va antes del botón, para opciones extra. */
export function FormRegistro({ nombreInicial = '', url, ocupado, error, textoBoton = 'Crear mi cuenta', children, onRegistrar }: {
  nombreInicial?: string
  url: string
  ocupado: boolean
  error?: string
  textoBoton?: string
  children?: ReactNode
  onRegistrar: (d: DatosRegistro) => void
}) {
  const [nombre, setNombre] = useState(nombreInicial)
  const [telefono, setTelefono] = useState('')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [servidor, setServidor] = useState(url)
  const telOk = TELEFONO_OK.test(telefono)
  const pinOk = PIN_CUENTA_OK.test(pin) && pin === pin2
  const listo = Boolean(nombre.trim()) && telOk && pinOk && !ocupado
  const enviar = () => listo && onRegistrar({ url: limpiarUrl(servidor), nombre: nombre.trim(), telefono, pin })
  return (
    <>
      <p className="nota">Sin correo. Tu cuenta es tu número de celular y un PIN. Con ellos entras a tu bodega desde cualquier celular.</p>
      <Campo label="Nombre de tu bodega">
        <input autoFocus type="text" placeholder="Ej. Bodega Doña Carmen" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </Campo>
      <Campo label="Tu celular" ayuda="9 dígitos. Es tu usuario.">
        <input type="tel" inputMode="numeric" maxLength={9} placeholder="9xxxxxxxx" autoComplete="tel-national" value={telefono} onChange={(e) => setTelefono(soloDigitos(e.target.value))} />
      </Campo>
      <div className="fila-2">
        <Campo label="PIN de la cuenta" ayuda="4 a 6 números">
          <input type="password" inputMode="numeric" maxLength={6} autoComplete="new-password" value={pin} onChange={(e) => setPin(soloDigitos(e.target.value))} />
        </Campo>
        <Campo label="Repite el PIN">
          <input type="password" inputMode="numeric" maxLength={6} autoComplete="new-password" value={pin2} onChange={(e) => setPin2(soloDigitos(e.target.value))} onKeyDown={(e) => e.key === 'Enter' && enviar()} />
        </Campo>
      </div>
      {pin && pin2 && pin !== pin2 && <p className="texto-peligro">Los dos PIN no coinciden</p>}
      {children}
      <ServidorAvanzado servidor={servidor} onCambio={setServidor} />
      {error && <p className="texto-peligro" role="alert">{error}</p>}
      <button className="btn-primario grande ancho" disabled={!listo} onClick={enviar}>{ocupado ? 'Creando tu cuenta…' : textoBoton}</button>
    </>
  )
}

export type ViaLogin = 'pin' | 'codigo'

/** Entrar: con número y PIN (desde cualquier celular) o con el código de 6 dígitos que da otro celular ya dentro. */
export function FormLogin({ url, ocupado, error, viaInicial = 'pin', textoEntrar = 'Entrar', textoVincular = 'Vincular', onEntrar, onVincular }: {
  url: string
  ocupado: boolean
  error?: string
  viaInicial?: ViaLogin
  textoEntrar?: string
  textoVincular?: string
  onEntrar: (url: string, telefono: string, pin: string) => void
  onVincular: (url: string, codigo: string) => void
}) {
  const [via, setVia] = useState<ViaLogin>(viaInicial)
  const [telefono, setTelefono] = useState('')
  const [pin, setPin] = useState('')
  const [codigo, setCodigo] = useState('')
  const [servidor, setServidor] = useState(url)
  const listoPin = TELEFONO_OK.test(telefono) && PIN_CUENTA_OK.test(pin) && !ocupado
  const listoCodigo = /^\d{6}$/.test(codigo) && !ocupado
  const entrar = () => listoPin && onEntrar(limpiarUrl(servidor), telefono, pin)
  const vincular = () => listoCodigo && onVincular(limpiarUrl(servidor), codigo)
  return (
    <>
      <div className="chips">
        <button type="button" className={'chip' + (via === 'pin' ? ' activo' : '')} onClick={() => setVia('pin')}>🔑 Con mi número y PIN</button>
        <button type="button" className={'chip' + (via === 'codigo' ? ' activo' : '')} onClick={() => setVia('codigo')}>📱 Con código del otro celular</button>
      </div>
      {via === 'pin' ? (
        <>
          <p className="nota">El número y el PIN con los que creaste tu cuenta. Sirve aunque hayas perdido el otro celular.</p>
          <Campo label="Tu celular">
            <input autoFocus type="tel" inputMode="numeric" maxLength={9} placeholder="9xxxxxxxx" autoComplete="tel-national" value={telefono} onChange={(e) => setTelefono(soloDigitos(e.target.value))} />
          </Campo>
          <Campo label="PIN de la cuenta">
            <input type="password" inputMode="numeric" maxLength={6} autoComplete="current-password" value={pin} onChange={(e) => setPin(soloDigitos(e.target.value))} onKeyDown={(e) => e.key === 'Enter' && entrar()} />
          </Campo>
        </>
      ) : (
        <>
          <p className="nota">En el celular que ya tiene la bodega, entra a <strong>Más → Sumar otro celular</strong> y escribe aquí el código de 6 dígitos.</p>
          <Campo label="Código">
            <input autoFocus type="text" inputMode="numeric" maxLength={6} placeholder="000000" value={codigo} onChange={(e) => setCodigo(soloDigitos(e.target.value))} onKeyDown={(e) => e.key === 'Enter' && vincular()} />
          </Campo>
        </>
      )}
      <ServidorAvanzado servidor={servidor} onCambio={setServidor} />
      {error && <p className="texto-peligro" role="alert">{error}</p>}
      {via === 'pin' ? (
        <button className="btn-primario grande ancho" disabled={!listoPin} onClick={entrar}>{ocupado ? 'Entrando…' : textoEntrar}</button>
      ) : (
        <button className="btn-primario grande ancho" disabled={!listoCodigo} onClick={vincular}>{ocupado ? 'Vinculando…' : textoVincular}</button>
      )}
      {via === 'pin' && <p className="nota centrado">¿Olvidaste tu PIN? Desde un celular que ya esté dentro de la bodega, en <strong>Más → Mi cuenta</strong> puedes cambiar el número o el PIN.</p>}
    </>
  )
}
