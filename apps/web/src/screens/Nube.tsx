import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { activarNubeConAcceso, cerrarSesionDispositivo, configurarAcceso, desconectarNube, generarCodigoVinculo, iniciarSesionNube, leerCuenta, leerEstado, sincronizar, vincularConCodigo, type CuentaNube } from '../sync/motor'
import { fechaCorta, hora } from '@sencillo/shared'
import { Campo, Modal } from '../components/ui'

/** Sección "Nube y otros celulares" de Ajustes. */
export function Nube({ avisar, nombreBodega }: { avisar: (m: string) => void; nombreBodega: string }) {
  const estado = useLiveQuery(leerEstado, [])
  const pendientes = useLiveQuery(() => db.cola.count(), []) ?? 0
  const [modal, setModal] = useState<'activar' | 'vincular' | 'codigo' | 'cuenta' | null>(null)
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
          <p className="nota">Con la nube, tus datos quedan respaldados solos, puedes atender desde dos celulares y, si pierdes el tuyo, recuperas todo con tu número y tu PIN. Es opcional: sin nube, todo sigue funcionando en este celular.</p>
          <div className="acciones-col">
            <button className="btn-primario ancho" onClick={() => setModal('activar')}>☁️ Crear mi cuenta en la nube</button>
            <button className="btn-secundario ancho" onClick={() => setModal('vincular')}>🔑 Ya tengo cuenta: entrar</button>
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
            <button className="btn-secundario ancho" onClick={() => setModal('cuenta')}>👤 Mi cuenta y mis celulares</button>
            <button className="btn-peligro ancho" disabled={ocupado} onClick={() => { if (confirm('¿Desconectar este celular de la nube? Tus datos locales se conservan.')) correr(desconectarNube, 'Desconectado de la nube') }}>Desconectar de la nube</button>
          </div>
        </>
      )}

      {modal === 'activar' && <FormActivar nombreBodega={nombreBodega} url={estado.url} ocupado={ocupado} onCerrar={() => setModal(null)} onActivar={(url, nombre, telefono, pin) => correr(() => activarNubeConAcceso(url, nombre, telefono, pin, nombreDelDispositivo()), 'Cuenta creada. Todo respaldado.')} />}
      {modal === 'vincular' && <FormEntrar url={estado.url} ocupado={ocupado} onCerrar={() => setModal(null)} onVincular={(url, codigo) => correr(() => vincularConCodigo(url, codigo, nombreDelDispositivo()), 'Celular vinculado. Bajando los datos de tu bodega…')} onEntrar={(url, telefono, pin) => correr(() => iniciarSesionNube(url, telefono, pin, nombreDelDispositivo()), 'Entraste a tu bodega. Bajando tus datos…')} />}
      {modal === 'cuenta' && <Cuenta onCerrar={() => setModal(null)} avisar={avisar} />}
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

function FormActivar({ nombreBodega, url, ocupado, onCerrar, onActivar }: { nombreBodega: string; url: string; ocupado: boolean; onCerrar: () => void; onActivar: (url: string, nombre: string, telefono: string, pin: string) => void }) {
  const [nombre, setNombre] = useState(nombreBodega)
  const [telefono, setTelefono] = useState('')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [servidor, setServidor] = useState(url)
  const [avanzado, setAvanzado] = useState(false)
  const telOk = /^\d{9}$/.test(telefono)
  const pinOk = /^\d{4,6}$/.test(pin) && pin === pin2
  return (
    <Modal titulo="Crear mi cuenta en la nube" onCerrar={onCerrar}>
      <p className="nota">Sin correo. Tu cuenta es tu número de celular y un PIN. Con ellos entras a tu bodega desde cualquier celular.</p>
      <Campo label="Nombre de tu bodega">
        <input autoFocus type="text" placeholder="Ej. Bodega Doña Carmen" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </Campo>
      <Campo label="Tu celular" ayuda="9 dígitos. Es tu usuario.">
        <input type="tel" inputMode="numeric" maxLength={9} placeholder="9xxxxxxxx" value={telefono} onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ''))} />
      </Campo>
      <div className="fila-2">
        <Campo label="PIN de la cuenta" ayuda="4 a 6 números">
          <input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
        </Campo>
        <Campo label="Repite el PIN">
          <input type="password" inputMode="numeric" maxLength={6} value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} />
        </Campo>
      </div>
      {pin && pin2 && pin !== pin2 && <p className="texto-peligro">Los dos PIN no coinciden</p>}
      {avanzado ? (
        <Campo label="Dirección del servidor" ayuda="Solo si usas tu propio servidor">
          <input type="url" value={servidor} onChange={(e) => setServidor(e.target.value)} />
        </Campo>
      ) : (
        <button className="btn-enlace" onClick={() => setAvanzado(true)}>Opciones avanzadas</button>
      )}
      <button className="btn-primario grande ancho" disabled={!nombre.trim() || !telOk || !pinOk || ocupado} onClick={() => onActivar(servidor.trim().replace(/\/$/, ''), nombre.trim(), telefono, pin)}>
        {ocupado ? 'Creando…' : 'Crear cuenta y respaldar ahora'}
      </button>
    </Modal>
  )
}

export function FormEntrar({ url, ocupado, onCerrar, onVincular, onEntrar }: { url: string; ocupado: boolean; onCerrar: () => void; onVincular: (url: string, codigo: string) => void; onEntrar: (url: string, telefono: string, pin: string) => void }) {
  const [via, setVia] = useState<'pin' | 'codigo'>('pin')
  const [telefono, setTelefono] = useState('')
  const [pin, setPin] = useState('')
  const [codigo, setCodigo] = useState('')
  const [servidor, setServidor] = useState(url)
  const [avanzado, setAvanzado] = useState(false)
  const base = () => servidor.trim().replace(/\/$/, '')
  const listoPin = /^\d{9}$/.test(telefono) && /^\d{4,6}$/.test(pin)
  const listoCodigo = /^\d{6}$/.test(codigo)
  return (
    <Modal titulo="Entrar a mi bodega" onCerrar={onCerrar}>
      <div className="chips">
        <button className={'chip' + (via === 'pin' ? ' activo' : '')} onClick={() => setVia('pin')}>🔑 Con mi número y PIN</button>
        <button className={'chip' + (via === 'codigo' ? ' activo' : '')} onClick={() => setVia('codigo')}>📱 Con código del otro celular</button>
      </div>
      {via === 'pin' ? (
        <>
          <p className="nota">El número y el PIN con los que creaste tu cuenta. Sirve aunque hayas perdido el otro celular.</p>
          <Campo label="Tu celular">
            <input autoFocus type="tel" inputMode="numeric" maxLength={9} placeholder="9xxxxxxxx" value={telefono} onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ''))} />
          </Campo>
          <Campo label="PIN de la cuenta">
            <input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && listoPin && onEntrar(base(), telefono, pin)} />
          </Campo>
        </>
      ) : (
        <>
          <p className="nota">En el celular que ya tiene la bodega, entra a <strong>Más → Sumar otro celular</strong> y escribe aquí el código de 6 dígitos.</p>
          <Campo label="Código">
            <input autoFocus type="text" inputMode="numeric" maxLength={6} placeholder="000000" value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && listoCodigo && onVincular(base(), codigo)} />
          </Campo>
        </>
      )}
      {avanzado ? (
        <Campo label="Dirección del servidor">
          <input type="url" value={servidor} onChange={(e) => setServidor(e.target.value)} />
        </Campo>
      ) : (
        <button className="btn-enlace" onClick={() => setAvanzado(true)}>Opciones avanzadas</button>
      )}
      {via === 'pin' ? (
        <button className="btn-primario grande ancho" disabled={!listoPin || ocupado} onClick={() => onEntrar(base(), telefono, pin)}>{ocupado ? 'Entrando…' : 'Entrar'}</button>
      ) : (
        <button className="btn-primario grande ancho" disabled={!listoCodigo || ocupado} onClick={() => onVincular(base(), codigo)}>{ocupado ? 'Vinculando…' : 'Vincular'}</button>
      )}
    </Modal>
  )
}

/** Mi cuenta: número, acceso y celulares conectados (con cerrar sesión del perdido). */
function Cuenta({ onCerrar, avisar }: { onCerrar: () => void; avisar: (m: string) => void }) {
  const [cuenta, setCuenta] = useState<CuentaNube | null>(null)
  const [error, setError] = useState('')
  const [editar, setEditar] = useState(false)
  const [telefono, setTelefono] = useState('')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const cargar = () => leerCuenta().then((c) => { setCuenta(c); setEditar(!c.tieneAcceso) }).catch((e: Error) => setError(e.message))
  useEffect(() => { void cargar() }, [])
  const listo = /^\d{9}$/.test(telefono) && /^\d{4,6}$/.test(pin) && pin === pin2
  return (
    <Modal titulo="Mi cuenta y mis celulares" onCerrar={onCerrar}>
      {error && <p className="texto-peligro">{error}</p>}
      {!cuenta && !error && <p className="nota">Cargando…</p>}
      {cuenta && (
        <>
          <div className="estado-nube">
            <strong>{cuenta.nombre}</strong>
            <span className="item-sub">{cuenta.tieneAcceso ? `Entras con el celular ${cuenta.telefono} y tu PIN` : 'Aún no tienes número y PIN: si pierdes este celular no podrás recuperar la bodega'}</span>
          </div>
          {!editar ? (
            <button className="btn-secundario ancho" onClick={() => setEditar(true)}>Cambiar número o PIN de la cuenta</button>
          ) : (
            <div className="bloque">
              <Campo label="Tu celular" ayuda="9 dígitos">
                <input type="tel" inputMode="numeric" maxLength={9} placeholder="9xxxxxxxx" value={telefono} onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ''))} />
              </Campo>
              <div className="fila-2">
                <Campo label="PIN de la cuenta" ayuda="4 a 6 números">
                  <input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
                </Campo>
                <Campo label="Repite el PIN">
                  <input type="password" inputMode="numeric" maxLength={6} value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} />
                </Campo>
              </div>
              <button className="btn-primario ancho" disabled={!listo} onClick={async () => { try { await configurarAcceso(telefono, pin); avisar('Acceso guardado'); setPin(''); setPin2(''); await cargar() } catch (e) { avisar((e as Error).message) } }}>Guardar acceso</button>
            </div>
          )}
          <h3 className="subtitulo">Celulares conectados</h3>
          <ul className="historial">
            {cuenta.dispositivos.map((d) => (
              <li key={d.id}>
                <div>
                  <strong>{d.nombre || 'Celular'}{d.esteDispositivo ? ' (este)' : ''}</strong>
                  <span className="item-sub">{d.ultimoSync ? `Última vez: ${fechaCorta(d.ultimoSync)} ${hora(d.ultimoSync)}` : 'Nunca sincronizó'}</span>
                </div>
                {!d.esteDispositivo && (
                  <button className="btn-peligro" onClick={async () => { if (!confirm(`¿Cerrar la sesión de "${d.nombre || 'Celular'}"? Ya no podrá ver ni cambiar tu bodega.`)) return; try { await cerrarSesionDispositivo(d.id); avisar('Sesión cerrada'); await cargar() } catch (e) { avisar((e as Error).message) } }}>Cerrar sesión</button>
                )}
              </li>
            ))}
          </ul>
          <p className="nota">Si pierdes un celular, ciérrale la sesión aquí: deja de tener acceso aunque siga con la app instalada.</p>
        </>
      )}
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
          <p className="nota">En el otro celular, abre Sencillo, entra a <strong>Más → Este es mi segundo celular</strong> y escribe:</p>
          <div className="codigo-grande" aria-label={`Código ${codigo.codigo}`}>{codigo.codigo.split('').map((d, i) => <span key={i}>{d}</span>)}</div>
          <p className="nota">Vale por {codigo.minutos} minutos y se usa una sola vez.</p>
          <button className="btn-secundario ancho" onClick={async () => { try { await navigator.clipboard.writeText(codigo.codigo); avisar('Código copiado') } catch { /* sin portapapeles */ } }}>Copiar código</button>
        </>
      )}
    </Modal>
  )
}
