import { useState } from 'react'
import { setConfig } from '../db/db'
import { sembrarDemo, sembrarSiVacio } from '../db/seed'
import { guardarNombreBodega } from '../lib/acciones'
import { activarNubeConAcceso, iniciarSesionNube, urlPorDefecto, vincularConCodigo } from '../sync/motor'
import { Campo } from '../components/ui'
import { FormLogin, FormRegistro, nombreDelDispositivo, type DatosRegistro } from './Acceso'

type Paso = 'inicio' | 'registro' | 'entrar' | 'local'

/**
 * Primer arranque. Tres caminos: crear la cuenta (registro), entrar a una cuenta que ya existe (login)
 * o usar la app solo en este celular, sin cuenta. Se muestra una sola vez.
 */
export function Bienvenida({ onListo }: { onListo: () => void }) {
  const [paso, setPaso] = useState<Paso>('inicio')
  const [nombre, setNombre] = useState('')
  const [conEjemplo, setConEjemplo] = useState(true)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  function ir(p: Paso) {
    setError('')
    setPaso(p)
  }

  async function terminarLocal(ejemplo: boolean, conMovimiento = false) {
    setOcupado(true)
    try {
      if (nombre.trim()) await guardarNombreBodega(nombre)
      if (conMovimiento) await sembrarDemo()
      else if (ejemplo) await sembrarSiVacio()
      await setConfig('bienvenida', '1')
      onListo()
    } finally {
      setOcupado(false)
    }
  }

  /** Registro: guarda el nombre y el catálogo en el celular y recién después crea la cuenta, para que suban en el primer respaldo. */
  async function registrar(d: DatosRegistro) {
    setOcupado(true)
    setError('')
    setNombre(d.nombre)
    try {
      await guardarNombreBodega(d.nombre)
      if (conEjemplo) await sembrarSiVacio()
      await activarNubeConAcceso(d.url, d.nombre, d.telefono, d.pin, nombreDelDispositivo())
      await setConfig('bienvenida', '1')
      onListo()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  async function entrar(fn: () => Promise<void>) {
    setOcupado(true)
    setError('')
    try {
      await fn()
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
        <h1>Sencillo</h1>
        <p>Tu bodega, sencilla. Vende, controla tu stock y cobra tus fiados desde el celular, con o sin internet.</p>
      </div>

      {paso === 'inicio' && (
        <div className="bienvenida-cuerpo">
          <button className="opcion principal" onClick={() => ir('registro')}>
            <span className="opcion-icono" aria-hidden="true">☁️</span>
            <span className="opcion-texto"><strong>Crear mi cuenta</strong><span>Con tu celular y un PIN. Tus datos quedan respaldados y entras desde cualquier teléfono.</span></span>
          </button>
          <button className="opcion" onClick={() => ir('entrar')}>
            <span className="opcion-icono" aria-hidden="true">🔑</span>
            <span className="opcion-texto"><strong>Ya tengo cuenta: entrar</strong><span>Con tu número y PIN, o con un código del otro celular.</span></span>
          </button>
          <button className="opcion" onClick={() => ir('local')}>
            <span className="opcion-icono" aria-hidden="true">📱</span>
            <span className="opcion-texto"><strong>Empezar sin cuenta</strong><span>Solo en este celular. Puedes crear tu cuenta después desde Más.</span></span>
          </button>
        </div>
      )}

      {paso === 'registro' && (
        <div className="bienvenida-cuerpo">
          <h2 className="bienvenida-titulo">Crear mi cuenta</h2>
          <FormRegistro nombreInicial={nombre} url={urlPorDefecto()} ocupado={ocupado} error={error} textoBoton="Crear mi cuenta y empezar" onRegistrar={registrar}>
            <label className="check">
              <input type="checkbox" checked={conEjemplo} onChange={(e) => setConEjemplo(e.target.checked)} />
              <span>Empezar con 28 productos de ejemplo (los cambias o borras cuando quieras)</span>
            </label>
          </FormRegistro>
          {error && <button className="btn-secundario ancho" disabled={ocupado} onClick={() => terminarLocal(conEjemplo)}>Empezar sin cuenta por ahora</button>}
          <button className="btn-enlace" onClick={() => ir('inicio')}>Volver</button>
        </div>
      )}

      {paso === 'entrar' && (
        <div className="bienvenida-cuerpo">
          <h2 className="bienvenida-titulo">Entrar a mi bodega</h2>
          <FormLogin
            url={urlPorDefecto()}
            ocupado={ocupado}
            error={error}
            textoEntrar="Entrar y bajar mis datos"
            textoVincular="Vincular y bajar mis datos"
            onEntrar={(url, telefono, pin) => entrar(() => iniciarSesionNube(url, telefono, pin, nombreDelDispositivo()))}
            onVincular={(url, codigo) => entrar(() => vincularConCodigo(url, codigo, nombreDelDispositivo()))}
          />
          <button className="btn-enlace" onClick={() => ir('inicio')}>Volver</button>
        </div>
      )}

      {paso === 'local' && (
        <div className="bienvenida-cuerpo">
          <Campo label="¿Cómo se llama tu bodega?">
            <input autoFocus type="text" placeholder="Ej. Bodega Doña Carmen" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </Campo>
          <button className="btn-primario grande ancho" disabled={ocupado} onClick={() => terminarLocal(true)}>Empezar con productos de ejemplo</button>
          <p className="nota centrado">Verás cómo funciona con 28 productos típicos. Los cambias o borras cuando quieras.</p>
          <button className="btn-secundario ancho" disabled={ocupado} onClick={() => terminarLocal(false)}>Empezar desde cero</button>
          <button className="btn-secundario ancho" disabled={ocupado} onClick={() => terminarLocal(true, true)}>👀 Ver una bodega de ejemplo con movimiento</button>
          <p className="nota centrado">Todo se guarda en este celular. Cuando quieras, crea tu cuenta desde <strong>Más</strong> para respaldar y entrar desde otro celular.</p>
          <button className="btn-enlace" onClick={() => ir('inicio')}>Volver</button>
        </div>
      )}
      <p className="pie">Hecho para las bodegas del Perú 🇵🇪</p>
    </div>
  )
}
