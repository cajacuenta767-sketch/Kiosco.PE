import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setConfig } from '../db/db'
import { borrarTodo, exportarBackup, importarBackup } from '../lib/acciones'
import { sembrarSiVacio } from '../db/seed'
import { Campo } from '../components/ui'

export function Ajustes({ avisar }: { avisar: (m: string) => void }) {
  const nombreGuardado = useLiveQuery(() => db.config.get('nombreBodega'), [])?.value ?? ''
  const tema = useLiveQuery(() => db.config.get('tema'), [])?.value ?? 'auto'
  const [nombre, setNombre] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const conteos = useLiveQuery(async () => ({
    productos: await db.productos.count(),
    ventas: await db.ventas.count(),
    clientes: await db.clientes.count(),
  }), [])

  useEffect(() => setNombre(nombreGuardado), [nombreGuardado])

  async function guardarNombre() {
    await setConfig('nombreBodega', nombre.trim())
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

  return (
    <div className="pantalla">
      <h3 className="subtitulo">Mi bodega</h3>
      <Campo label="Nombre de tu bodega" ayuda="Aparece en los recordatorios de WhatsApp">
        <div className="buscador con-boton">
          <input type="text" placeholder="Ej. Bodega Doña Carmen" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <button className="btn-primario" onClick={guardarNombre}>Guardar</button>
        </div>
      </Campo>

      <h3 className="subtitulo">Apariencia</h3>
      <div className="chips">
        {([['auto', '📱 Como el celular'], ['claro', '☀️ Claro'], ['oscuro', '🌙 Oscuro']] as const).map(([id, label]) => (
          <button key={id} className={'chip' + (tema === id ? ' activo' : '')} onClick={() => setConfig('tema', id)}>{label}</button>
        ))}
      </div>

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
        <button className="btn-peligro ancho" onClick={reiniciar}>🗑️ Borrar todo</button>
      </div>

      <h3 className="subtitulo">Consejo</h3>
      <p className="nota">Descarga un respaldo cada semana y guárdalo en tu WhatsApp o Google Drive. Si cambias de celular, restáuralo y sigues donde te quedaste.</p>

      <p className="pie">Kiosco.PE v0.1 · Hecho para las bodegas del Perú 🇵🇪</p>
    </div>
  )
}
