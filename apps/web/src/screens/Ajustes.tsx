import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setConfig } from '../db/db'
import { borrarTodo, exportarBackup, guardarNombreBodega, importarBackup } from '../lib/acciones'
import { Nube } from './Nube'
import { sembrarDemo } from '../db/seed'
import { PIN_VALIDO, cambiarModo, guardarPin, hayPin, verificarPin } from '../lib/pin'
import { Modal } from '../components/ui'
import { MEDIOS_DIGITALES, guardarMedio, leerMedios, type MedioDigital } from '../lib/pagos'
import { ajustarImagen } from '../lib/imagen'
import type { MedioPago } from '@sencillo/shared'
import { sembrarSiVacio } from '../db/seed'
import { Campo } from '../components/ui'

export function Ajustes({ avisar, ayudante = false }: { avisar: (m: string) => void; ayudante?: boolean }) {
  const nombreGuardado = useLiveQuery(() => db.config.get('nombreBodega'), [])?.value ?? ''
  const tema = useLiveQuery(() => db.config.get('tema'), [])?.value ?? 'auto'
  const letra = useLiveQuery(() => db.config.get('letra'), [])?.value ?? 'normal'
  const sonido = useLiveQuery(() => db.config.get('sonido'), [])?.value ?? '1'
  const tienePin = useLiveQuery(hayPin, []) ?? false
  const bloqueo = useLiveQuery(() => db.config.get('bloqueo'), [])?.value === '1'
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
    a.download = `sencillo-respaldo-${new Date().toISOString().slice(0, 10)}.json`
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
      <section className="seccion">
        <h3 className="seccion-titulo"><span aria-hidden="true">🏪</span>Mi bodega</h3>
        <Campo label="Nombre de tu bodega" ayuda="Aparece en los recordatorios de WhatsApp">
          <div className="buscador con-boton">
            <input type="text" placeholder="Ej. Bodega Doña Carmen" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <button className="btn-primario" onClick={guardarNombre}>Guardar</button>
          </div>
        </Campo>
      </section>

      <section className="seccion">
        <h3 className="seccion-titulo"><span aria-hidden="true">📲</span>Cobros con Yape y Plin</h3>
        <p className="nota">Sube la captura de tu QR y escribe tu número. Al cobrar con Yape o Plin, se lo muestras al cliente en grande para que escanee.</p>
        <MediosPago avisar={avisar} />
      </section>

      <section className="seccion">
        <Nube avisar={avisar} nombreBodega={nombreGuardado} />
      </section>

      <section className="seccion">
        <h3 className="seccion-titulo"><span aria-hidden="true">🔐</span>Tu PIN y quién entra</h3>
        <p className="nota">Un PIN de 4 números que solo tú sepas. Sirve para pedirlo al abrir la app y para el modo ayudante.</p>
        <div className="acciones-col">
          <button className="btn-secundario ancho" onClick={() => setModalPin('crear')}>{tienePin ? '🔐 Cambiar PIN' : '🔐 Crear mi PIN'}</button>
          <label className={'check' + (tienePin ? '' : ' apagado')}>
            <input type="checkbox" disabled={!tienePin} checked={bloqueo} onChange={async (e) => { const activar = e.target.checked; await setConfig('bloqueo', activar ? '1' : '0'); avisar(activar ? 'Al abrir la app pedirá tu PIN' : 'La app abrirá sin PIN') }} />
            <span>Pedir mi PIN al abrir la app</span>
          </label>
          <button className="btn-primario ancho" disabled={!tienePin} onClick={async () => { await cambiarModo('ayudante'); avisar('Modo ayudante activado') }}>👩‍👧 Entrar en modo ayudante</button>
          <p className="nota">En modo ayudante, tu hijo o sobrina vende y cobra fiados, pero no ve tus ganancias ni cambia precios. Se sale con tu PIN.</p>
        </div>
      </section>

      <section className="seccion">
        <h3 className="seccion-titulo"><span aria-hidden="true">🎨</span>Cómo se ve</h3>
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
      </section>

      <section className="seccion">
        <h3 className="seccion-titulo"><span aria-hidden="true">💾</span>Tus datos</h3>
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
        <p className="nota">💡 Descarga un respaldo cada semana y guárdalo en tu WhatsApp o Google Drive. Si cambias de celular, restáuralo y sigues donde te quedaste.</p>
      </section>

      <p className="pie">Sencillo v0.8 · Hecho para las bodegas del Perú 🇵🇪</p>
      {modalPin === 'crear' && <CrearPin onCerrar={() => setModalPin(null)} onOk={() => { setModalPin(null); avisar('PIN guardado') }} />}
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
      <p className="nota">Cuatro números que solo tú sepas. Con él entras a la app y vuelves al modo dueña.</p>
      <Campo label="PIN"><input autoFocus type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} /></Campo>
      <Campo label="Repite el PIN"><input type="password" inputMode="numeric" maxLength={4} value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} /></Campo>
      {error && <p className="texto-peligro">{error}</p>}
      <button className="btn-primario grande ancho" disabled={pin.length < 4 || pin2.length < 4} onClick={guardar}>Guardar PIN</button>
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

function MediosPago({ avisar }: { avisar: (m: string) => void }) {
  const medios = useLiveQuery(leerMedios, [])
  if (!medios) return null
  return (
    <div className="acciones-col">
      {MEDIOS_DIGITALES.map((m) => (
        <MedioPagoForm key={m.id} id={m.id} label={m.label} color={m.color} medio={medios[m.id]} avisar={avisar} />
      ))}
    </div>
  )
}

function MedioPagoForm({ id, label, color, medio, avisar }: { id: MedioDigital; label: string; color: string; medio: MedioPago; avisar: (m: string) => void }) {
  const [numero, setNumero] = useState(medio.numero ?? '')
  const [titular, setTitular] = useState(medio.titular ?? '')
  const [qr, setQr] = useState(medio.qr ?? '')
  const [abierto, setAbierto] = useState(false)
  const qrRef = useRef<HTMLInputElement>(null)
  const configurado = Boolean(medio.numero || medio.qr)
  useEffect(() => { setNumero(medio.numero ?? ''); setTitular(medio.titular ?? ''); setQr(medio.qr ?? '') }, [medio.numero, medio.titular, medio.qr])
  const cambiado = numero !== (medio.numero ?? '') || titular !== (medio.titular ?? '') || qr !== (medio.qr ?? '')

  async function guardar() {
    if (numero && !/^\d{9}$/.test(numero)) return avisar('El número debe tener 9 dígitos')
    await guardarMedio(id, { numero, titular, qr })
    setAbierto(false)
    avisar(`${label} guardado`)
  }

  return (
    <div className="medio-pago" style={{ borderColor: color }}>
      <button className="medio-pago-cab" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>
        <span className="medio-pago-nombre" style={{ color }}>{label}</span>
        <span className="item-sub">{configurado ? `${medio.numero ?? ''}${medio.qr ? ' · QR listo' : ' · sin QR'}` : 'Sin configurar'}</span>
        <span>{abierto ? '▴' : '▾'}</span>
      </button>
      {abierto && (
        <div className="bloque">
          <div className="imagen-producto">
            {qr ? <img className="qr-mini" src={qr} alt={`QR de ${label}`} /> : <span className="icono-producto emoji" style={{ width: 72, height: 72, fontSize: 36 }}>▦</span>}
            <div className="imagen-acciones">
              <button type="button" className="btn-secundario" onClick={() => qrRef.current?.click()}>🖼️ {qr ? 'Cambiar QR' : 'Subir imagen del QR'}</button>
              {qr && <button type="button" className="btn-enlace" onClick={() => setQr('')}>Quitar QR</button>}
            </div>
            <input ref={qrRef} type="file" accept="image/*" hidden onChange={async (e) => { const a = e.target.files?.[0]; if (a) { try { setQr(await ajustarImagen(a)) } catch { avisar('No se pudo leer la imagen') } } e.target.value = '' }} />
          </div>
          <p className="nota">En {label}, entra a tu QR, toma captura de pantalla y súbela aquí.</p>
          <Campo label={`Número de ${label}`} ayuda="9 dígitos">
            <input type="tel" inputMode="numeric" maxLength={9} placeholder="9xxxxxxxx" value={numero} onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))} />
          </Campo>
          <Campo label="Nombre que aparece (opcional)">
            <input type="text" placeholder="Ej. Carmen R." value={titular} onChange={(e) => setTitular(e.target.value)} />
          </Campo>
          <button className="btn-primario ancho" disabled={!cambiado} onClick={guardar}>Guardar {label}</button>
        </div>
      )}
    </div>
  )
}
