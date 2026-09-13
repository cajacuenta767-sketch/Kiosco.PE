import { useState } from 'react'
import { setConfig } from '../db/db'
import { sembrarDemo, sembrarSiVacio } from '../db/seed'
import { guardarNombreBodega } from '../lib/acciones'
import { urlPorDefecto, vincularConCodigo } from '../sync/motor'
import { Campo } from '../components/ui'

/** Primer arranque: nombre de la bodega y cómo empezar. Se muestra una sola vez. */
export function Bienvenida({ onListo }: { onListo: () => void }) {
  const [nombre, setNombre] = useState('')
  const [modo, setModo] = useState<'inicio' | 'vincular'>('inicio')
  const [codigo, setCodigo] = useState('')
  const [servidor, setServidor] = useState(urlPorDefecto())
  const [avanzado, setAvanzado] = useState(false)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function terminar(conEjemplo: boolean, conMovimiento = false) {
    setOcupado(true)
    try {
      if (nombre.trim()) await guardarNombreBodega(nombre)
      if (conMovimiento) await sembrarDemo()
      else if (conEjemplo) await sembrarSiVacio()
      await setConfig('bienvenida', '1')
      onListo()
    } finally {
      setOcupado(false)
    }
  }

  async function vincular() {
    setOcupado(true)
    setError('')
    try {
      await vincularConCodigo(servidor.trim().replace(/\/$/, ''), codigo, 'Segundo celular')
      await setConfig('bienvenida', '1')
      onListo()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="bienvenida">
      <div className="bienvenida-cab">
        <img src="/icon.svg" alt="" width={72} height={72} />
        <h1>Kiosco.PE</h1>
        <p>Tu bodega en orden. Ventas, stock y fiados desde tu celular, con o sin internet.</p>
      </div>

      {modo === 'inicio' ? (
        <div className="bienvenida-cuerpo">
          <Campo label="¿Cómo se llama tu bodega?">
            <input autoFocus type="text" placeholder="Ej. Bodega Doña Carmen" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </Campo>
          <button className="btn-primario grande ancho" disabled={ocupado} onClick={() => terminar(true)}>Empezar con productos de ejemplo</button>
          <p className="nota centrado">Verás cómo funciona con 28 productos típicos. Los cambias o borras cuando quieras.</p>
          <button className="btn-secundario ancho" disabled={ocupado} onClick={() => terminar(false)}>Empezar desde cero</button>
          <button className="btn-secundario ancho" disabled={ocupado} onClick={() => terminar(true, true)}>👀 Ver una bodega de ejemplo con movimiento</button>
          <button className="btn-enlace" onClick={() => setModo('vincular')}>Ya uso Kiosco.PE en otro celular</button>
        </div>
      ) : (
        <div className="bienvenida-cuerpo">
          <p className="nota">En el celular que ya tiene la bodega, entra a <strong>Más → Sumar otro celular</strong> y escribe aquí el código.</p>
          <Campo label="Código de 6 dígitos">
            <input autoFocus type="text" inputMode="numeric" maxLength={6} placeholder="000000" value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} />
          </Campo>
          {avanzado ? (
            <Campo label="Dirección del servidor">
              <input type="url" value={servidor} onChange={(e) => setServidor(e.target.value)} />
            </Campo>
          ) : (
            <button className="btn-enlace" onClick={() => setAvanzado(true)}>Opciones avanzadas</button>
          )}
          {error && <p className="texto-peligro">{error}</p>}
          <button className="btn-primario grande ancho" disabled={!/^\d{6}$/.test(codigo) || ocupado} onClick={vincular}>{ocupado ? 'Vinculando…' : 'Vincular y bajar mis datos'}</button>
          <button className="btn-enlace" onClick={() => setModo('inicio')}>Volver</button>
        </div>
      )}
      <p className="pie">Hecho para las bodegas del Perú 🇵🇪</p>
    </div>
  )
}
