import { useState } from 'react'
import { setConfig } from '../db/db'
import { sembrarDemo, sembrarSiVacio } from '../db/seed'
import { guardarNombreBodega } from '../lib/acciones'
import { activarNubeConAcceso, iniciarSesionNube, urlPorDefecto, vincularConCodigo } from '../sync/motor'
import { Campo } from '../components/ui'
import { FormLogin, FormRegistro, nombreDelDispositivo, type DatosRegistro } from './Acceso'

type Paso = 'inicio' | 'registro' | 'local'

/**
 * Primer arranque: pantalla de entrada. Arriba, el login con número y PIN (o código del otro celular);
 * abajo, crear la cuenta o empezar sin cuenta solo en este celular. Se muestra una sola vez.
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
        <img src="/icon.svg" alt="" width={64} height={64} />
        <h1>Sencillo</h1>
        <p>{paso === 'inicio' ? 'Tu bodega, sencilla. Vende, controla tu stock y cobra tus fiados desde el celular.' : 'Tu bodega, sencilla. Vende, controla tu stock y cobra tus fiados desde el celular, con o sin internet.'}</p>
      </div>

      {paso === 'inicio' && (
        <div className="bienvenida-cuerpo">
          <section className="tarjeta-login">
            <h2 className="bienvenida-titulo">Entrar a mi bodega</h2>
            <FormLogin
              url={urlPorDefecto()}
              ocupado={ocupado}
              error={error}
              modo="enlaces"
              textoEntrar="Entrar"
              textoVincular="Vincular este celular"
              onEntrar={(url, telefono, pin) => entrar(() => iniciarSesionNube(url, telefono, pin, nombreDelDispositivo()))}
              onVincular={(url, codigo) => entrar(() => vincularConCodigo(url, codigo, nombreDelDispositivo()))}
            />
          </section>
          <div className="separador"><span>¿Primera vez en Sencillo?</span></div>
          <button className="btn-secundario ancho" onClick={() => ir('registro')}>☁️ Crear mi cuenta</button>
          <button className="btn-enlace" onClick={() => ir('local')}>Empezar sin cuenta, solo en este celular</button>
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
