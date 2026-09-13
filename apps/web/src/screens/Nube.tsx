import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { activarNube, desconectarNube, generarCodigoVinculo, leerEstado, sincronizar, vincularConCodigo } from '../sync/motor'
import { fechaCorta, hora } from '@kiosco/shared'
import { Campo, Modal } from '../components/ui'

/** Sección "Nube y otros celulares" de Ajustes. */
export function Nube({ avisar, nombreBodega }: { avisar: (m: string) => void; nombreBodega: string }) {
  const estado = useLiveQuery(leerEstado, [])
  const pendientes = useLiveQuery(() => db.cola.count(), []) ?? 0
  const [modal, setModal] = useState<'activar' | 'vincular' | 'codigo' | null>(null)
  const [ocupado, setOcupado] = useState(false)

  if (!estado) return null

  async function correr(fn: () => Promise<void>, ok: string) {
    setOcupado(true)
    try {
      await fn()
      avisar(ok)
      setModal(null)
    } catch (e) {
      avisar((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <>
      <h3 className="subtitulo">Nube y otros celulares</h3>
      {!estado.activa ? (
        <>
          <p className="nota">Con la nube, tus datos quedan respaldados solos y puedes atender desde dos celulares a la vez. Es opcional: sin nube, todo sigue funcionando en este celular.</p>
          <div className="acciones-col">
            <button className="btn-primario ancho" onClick={() => setModal('activar')}>☁️ Activar respaldo en la nube</button>
            <button className="btn-secundario ancho" onClick={() => setModal('vincular')}>🔗 Este es mi segundo celular</button>
          </div>
        </>
      ) : (
        <>
          <div className="estado-nube">
            <strong>
              <span className={'punto ' + (estado.error ? 'error' : pendientes > 0 || estado.sincronizando ? 'pendiente' : 'ok')} />
              {estado.error ? 'Sin conexión con la nube' : estado.sincronizando ? 'Sincronizando…' : pendientes > 0 ? `${pendientes} cambios por subir` : 'Todo respaldado'}
            </strong>
            <span className="item-sub">
              {estado.ultimoSync ? `Última sincronización: ${fechaCorta(estado.ultimoSync)} ${hora(estado.ultimoSync)}` : 'Aún no se ha sincronizado'}
              {estado.error ? ` · ${estado.error}` : ''}
            </span>
            <span className="item-sub">Servidor: {estado.url}</span>
          </div>
          <div className="acciones-col">
            <button className="btn-secundario ancho" disabled={ocupado} onClick={() => correr(sincronizar, 'Sincronizado')}>🔄 Sincronizar ahora</button>
            <button className="btn-secundario ancho" onClick={() => setModal('codigo')}>📱 Sumar otro celular</button>
            <button className="btn-peligro ancho" disabled={ocupado} onClick={() => { if (confirm('¿Desconectar este celular de la nube? Tus datos locales se conservan.')) correr(desconectarNube, 'Desconectado de la nube') }}>Desconectar de la nube</button>
          </div>
        </>
      )}

      {modal === 'activar' && <FormActivar nombreBodega={nombreBodega} url={estado.url} ocupado={ocupado} onCerrar={() => setModal(null)} onActivar={(url, nombre) => correr(() => activarNube(url, nombre, nombreDelDispositivo()), 'Nube activada. Todo respaldado.')} />}
      {modal === 'vincular' && <FormVincular url={estado.url} ocupado={ocupado} onCerrar={() => setModal(null)} onVincular={(url, codigo) => correr(() => vincularConCodigo(url, codigo, nombreDelDispositivo()), 'Celular vinculado. Bajando los datos de tu bodega…')} />}
      {modal === 'codigo' && <MostrarCodigo onCerrar={() => setModal(null)} avisar={avisar} />}
    </>
  )
}

function nombreDelDispositivo(): string {
  const ua = navigator.userAgent
  if (/Android/i.test(ua)) return 'Celular Android'
  if (/iPhone|iPad/i.test(ua)) return 'iPhone'
  return 'Computadora'
}

function FormActivar({ nombreBodega, url, ocupado, onCerrar, onActivar }: { nombreBodega: string; url: string; ocupado: boolean; onCerrar: () => void; onActivar: (url: string, nombre: string) => void }) {
  const [nombre, setNombre] = useState(nombreBodega)
  const [servidor, setServidor] = useState(url)
  const [avanzado, setAvanzado] = useState(false)
  return (
    <Modal titulo="Activar respaldo en la nube" onCerrar={onCerrar}>
      <p className="nota">Sin correo ni contraseña. Solo el nombre de tu bodega. Este celular queda registrado como el primero.</p>
      <Campo label="Nombre de tu bodega">
        <input autoFocus type="text" placeholder="Ej. Bodega Doña Carmen" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </Campo>
      {avanzado ? (
        <Campo label="Dirección del servidor" ayuda="Solo si usas tu propio servidor">
          <input type="url" value={servidor} onChange={(e) => setServidor(e.target.value)} />
        </Campo>
      ) : (
        <button className="btn-enlace" onClick={() => setAvanzado(true)}>Opciones avanzadas</button>
      )}
      <button className="btn-primario grande ancho" disabled={!nombre.trim() || ocupado} onClick={() => onActivar(servidor.trim().replace(/\/$/, ''), nombre.trim())}>
        {ocupado ? 'Activando…' : 'Activar y respaldar ahora'}
      </button>
    </Modal>
  )
}

function FormVincular({ url, ocupado, onCerrar, onVincular }: { url: string; ocupado: boolean; onCerrar: () => void; onVincular: (url: string, codigo: string) => void }) {
  const [codigo, setCodigo] = useState('')
  const [servidor, setServidor] = useState(url)
  const [avanzado, setAvanzado] = useState(false)
  const listo = /^\d{6}$/.test(codigo)
  return (
    <Modal titulo="Vincular este celular" onCerrar={onCerrar}>
      <p className="nota">En el celular que ya tiene la bodega, entra a <strong>Más → Sumar otro celular</strong> y escribe aquí el código de 6 dígitos.</p>
      <Campo label="Código">
        <input autoFocus type="text" inputMode="numeric" maxLength={6} placeholder="000000" value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && listo && onVincular(servidor, codigo)} />
      </Campo>
      {avanzado ? (
        <Campo label="Dirección del servidor">
          <input type="url" value={servidor} onChange={(e) => setServidor(e.target.value)} />
        </Campo>
      ) : (
        <button className="btn-enlace" onClick={() => setAvanzado(true)}>Opciones avanzadas</button>
      )}
      <button className="btn-primario grande ancho" disabled={!listo || ocupado} onClick={() => onVincular(servidor.trim().replace(/\/$/, ''), codigo)}>
        {ocupado ? 'Vinculando…' : 'Vincular'}
      </button>
    </Modal>
  )
}

function MostrarCodigo({ onCerrar, avisar }: { onCerrar: () => void; avisar: (m: string) => void }) {
  const [codigo, setCodigo] = useState<{ codigo: string; minutos: number } | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    generarCodigoVinculo().then(setCodigo).catch((e: Error) => setError(e.message))
  }, [])
  return (
    <Modal titulo="Sumar otro celular" onCerrar={onCerrar}>
      {error ? (
        <p className="texto-peligro">{error}</p>
      ) : !codigo ? (
        <p className="nota">Generando código…</p>
      ) : (
        <>
          <p className="nota">En el otro celular, abre Kiosco.PE, entra a <strong>Más → Este es mi segundo celular</strong> y escribe:</p>
          <div className="codigo-grande" aria-label={`Código ${codigo.codigo}`}>{codigo.codigo.split('').map((d, i) => <span key={i}>{d}</span>)}</div>
          <p className="nota">Vale por {codigo.minutos} minutos y se usa una sola vez.</p>
          <button className="btn-secundario ancho" onClick={async () => { try { await navigator.clipboard.writeText(codigo.codigo); avisar('Código copiado') } catch { /* sin portapapeles */ } }}>Copiar código</button>
        </>
      )}
    </Modal>
  )
}
