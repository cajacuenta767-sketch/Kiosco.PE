import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setConfig } from '../db/db'
import { borrarTodo, exportarBackup, guardarNombreBodega, importarBackup } from '../lib/acciones'
import { Nube } from './Nube'
import { sembrarDemo } from '../db/seed'
import { PIN_VALIDO, cambiarModo, guardarPin, hayPin, verificarPin } from '../lib/pin'
import { Modal } from '../components/ui'
import { sembrarSiVacio } from '../db/seed'
import { Campo } from '../components/ui'

export function Ajustes({ avisar, ayudante = false }: { avisar: (m: string) => void; ayudante?: boolean }) {
  const nombreGuardado = useLiveQuery(() => db.config.get('nombreBodega'), [])?.value ?? ''
  const tema = useLiveQuery(() => db.config.get('tema'), [])?.value ?? 'auto'
  const letra = useLiveQuery(() => db.config.get('letra'), [])?.value ?? 'normal'
  const sonido = useLiveQuery(() => db.config.get('sonido'), [])?.value ?? '1'
  const tienePin = useLiveQuery(hayPin, []) ?? false
  const [modalPin, setModalPin] = useState<'crear' | 'salir' | null>(null)
  const [nombre, setNombre] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const conteos = useLiveQuery(async () => ({
    productos: await db.productos.count(),
    ventas: await db.ventas.count(),
    clientes: await db.clientes.count(),
  }), [])

  useEffect(() => setNombre(nombreGuardado), [nombreGuardado])

  async function guardarNombre() {
    await guardarNombreBodega(nombre)
    avisar('Nombre guardado')
  }

  async function exportar() {
    const json = await exportarBackup()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kiosco-pe-respaldo-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    avisar('Respaldo descargado')
  }

  async function importar(f: File) {
    if (!confirm('Esto reemplaza TODOS los datos actuales por los del respaldo. ¿Continuar?')) return
    try {
      await importarBackup(await f.text())
      avisar('Respaldo restaurado')
    } catch (e) {
      avisar((e as Error).message)
    }
  }

  async function reiniciar() {
    if (!confirm('¿Borrar todo y empezar de cero? Esta acción no se puede deshacer.')) return
    await borrarTodo()
    avisar('Datos borrados')
  }

  if (ayudante) {
    return (
      <div className="pantalla">
        <div className="vacio">
          <div className="vacio-icono">👩‍👧</div>
          <h3>Modo ayudante</h3>
          <p>Puedes vender, ver el stock y cobrar fiados. Las ganancias, los precios y los ajustes están guardados con PIN.</p>
          <button className="btn-primario grande" onClick={() => setModalPin('salir')}>🔓 Volver a modo dueña</button>
        </div>
        {modalPin === 'salir' && <PedirPin titulo="Escribe tu PIN" onCerrar={() => setModalPin(null)} onOk={async () => { await cambiarModo('duena'); setModalPin(null); avisar('Modo dueña') }} />}
      </div>
    )
  }

  return (
    <div className="pantalla">
      <h3 className="subtitulo">Mi bodega</h3>
      <Campo label="Nombre de tu bodega" ayuda="Aparece en los recordatorios de WhatsApp">
        <div className="buscador con-boton">
          <input type="text" placeholder="Ej. Bodega Doña Carmen" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <button className="btn-primario" onClick={guardarNombre}>Guardar</button>
        </div>
      </Campo>

      <Nube avisar={avisar} nombreBodega={nombreGuardado} />

      <h3 className="subtitulo">Modo ayudante</h3>
      <p className="nota">Para que tu hijo, sobrina o ayudante atienda sin ver tus ganancias ni cambiar precios. Se sale con tu PIN de 4 números.</p>
      <div className="acciones-col">
        {tienePin ? (
          <>
            <button className="btn-primario ancho" onClick={async () => { await cambiarModo('ayudante'); avisar('Modo ayudante activado') }}>👩‍👧 Entrar en modo ayudante</button>
            <button className="btn-secundario ancho" onClick={() => setModalPin('crear')}>Cambiar PIN</button>
          </>
        ) : (
          <button className="btn-secundario ancho" onClick={() => setModalPin('crear')}>🔐 Crear PIN y activar</button>
        )}
      </div>

      <h3 className="subtitulo">Apariencia</h3>
      <div className="chips">
        {([['auto', '📱 Como el celular'], ['claro', '☀️ Claro'], ['oscuro', '🌙 Oscuro']] as const).map(([id, label]) => (
          <button key={id} className={'chip' + (tema === id ? ' activo' : '')} onClick={() => setConfig('tema', id)}>{label}</button>
        ))}
      </div>
      <div className="chips">
        {([['normal', '🔤 Letra normal'], ['grande', '🔠 Letra grande']] as const).map(([id, label]) => (
          <button key={id} className={'chip' + (letra === id ? ' activo' : '')} onClick={() => setConfig('letra', id)}>{label}</button>
        ))}
      </div>
      <label className="check">
        <input type="checkbox" checked={sonido === '1'} onChange={(e) => setConfig('sonido', e.target.checked ? '1' : '0')} />
        <span>Sonido al cobrar</span>
      </label>

      <h3 className="subtitulo">Tus datos</h3>
      <p className="nota">
        Todo se guarda <strong>en este celular</strong>, funciona sin internet.
        {conteos && ` Tienes ${conteos.productos} productos, ${conteos.ventas} ventas y ${conteos.clientes} clientes registrados.`}
      </p>
      <div className="acciones-col">
        <button className="btn-secundario ancho" onClick={exportar}>⬇️ Descargar respaldo</button>
        <button className="btn-secundario ancho" onClick={() => fileRef.current?.click()}>⬆️ Restaurar desde respaldo</button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importar(e.target.files[0])} />
        <button className="btn-secundario ancho" onClick={async () => { await sembrarSiVacio(); avisar('Catálogo de ejemplo cargado (solo si no tenías productos)') }}>📦 Cargar catálogo de ejemplo</button>
        <button className="btn-secundario ancho" onClick={async () => { await sembrarDemo(); avisar('Bodega de ejemplo cargada (solo si no tenías productos)') }}>👀 Bodega de ejemplo con 2 semanas de ventas</button>
        <button className="btn-peligro ancho" onClick={reiniciar}>🗑️ Borrar todo</button>
      </div>

      <h3 className="subtitulo">Consejo</h3>
      <p className="nota">Descarga un respaldo cada semana y guárdalo en tu WhatsApp o Google Drive. Si cambias de celular, restáuralo y sigues donde te quedaste.</p>

      <p className="pie">Kiosco.PE v0.5 · Hecho para las bodegas del Perú 🇵🇪</p>
      {modalPin === 'crear' && <CrearPin onCerrar={() => setModalPin(null)} onOk={async () => { setModalPin(null); await cambiarModo('ayudante'); avisar('PIN guardado · Modo ayudante activado') }} />}
    </div>
  )
}

function CrearPin({ onCerrar, onOk }: { onCerrar: () => void; onOk: () => void }) {
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [error, setError] = useState('')
  async function guardar() {
    if (!PIN_VALIDO.test(pin)) return setError('El PIN debe tener 4 números')
    if (pin !== pin2) return setError('Los dos PIN no coinciden')
    await guardarPin(pin)
    onOk()
  }
  return (
    <Modal titulo="Tu PIN de dueña" onCerrar={onCerrar}>
      <p className="nota">Cuatro números que solo tú sepas. Con él vuelves al modo dueña.</p>
      <Campo label="PIN"><input autoFocus type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} /></Campo>
      <Campo label="Repite el PIN"><input type="password" inputMode="numeric" maxLength={4} value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} /></Campo>
      {error && <p className="texto-peligro">{error}</p>}
      <button className="btn-primario grande ancho" disabled={pin.length < 4 || pin2.length < 4} onClick={guardar}>Guardar y entrar en modo ayudante</button>
    </Modal>
  )
}

function PedirPin({ titulo, onCerrar, onOk }: { titulo: string; onCerrar: () => void; onOk: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  async function comprobar() {
    if (await verificarPin(pin)) onOk()
    else { setError('PIN incorrecto'); setPin('') }
  }
  return (
    <Modal titulo={titulo} onCerrar={onCerrar}>
      <Campo label="PIN"><input autoFocus type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && pin.length === 4 && comprobar()} /></Campo>
      {error && <p className="texto-peligro">{error}</p>}
      <button className="btn-primario grande ancho" disabled={pin.length < 4} onClick={comprobar}>Entrar</button>
    </Modal>
  )
}
