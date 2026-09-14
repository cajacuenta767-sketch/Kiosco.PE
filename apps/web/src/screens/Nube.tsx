import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { SESION_CERRADA, activarNubeConAcceso, cerrarSesionDispositivo, configurarAcceso, desconectarNube, generarCodigoVinculo, iniciarSesionNube, leerCuenta, leerEstado, sincronizar, vincularConCodigo, type CuentaNube } from '../sync/motor'
import { fechaCorta, hora } from '@sencillo/shared'
import { Campo, Modal } from '../components/ui'
import { FormLogin, FormRegistro, PIN_CUENTA_OK, TELEFONO_OK, nombreDelDispositivo, soloDigitos } from './Acceso'

type ModalNube = 'registro' | 'entrar' | 'codigo' | 'cuenta' | null

/** Sección "Mi cuenta y la nube" de Más: registro, entrar, estado de la sincronización y celulares conectados. */
export function Nube({ avisar, nombreBodega }: { avisar: (m: string) => void; nombreBodega: string }) {
  const estado = useLiveQuery(leerEstado, [])
  const pendientes = useLiveQuery(() => db.cola.count(), []) ?? 0
  const [modal, setModal] = useState<ModalNube>(null)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  if (!estado) return null

  function abrir(m: ModalNube) {
    setError('')
    setModal(m)
  }

  async function correr(fn: () => Promise<void>, ok: string) {
    setOcupado(true)
    setError('')
    try {
      await fn()
      avisar(ok)
      setModal(null)
    } catch (e) {
      const m = (e as Error).message
      if (modal) setError(m)
      else avisar(m)
    } finally {
      setOcupado(false)
    }
  }

  function cerrarSesionAqui() {
    if (!confirm('¿Cerrar la sesión de este celular? Tus datos locales se conservan y puedes volver a entrar cuando quieras.')) return
    void correr(desconectarNube, 'Sesión cerrada en este celular')
  }

  return (
    <>
      <h3 className="seccion-titulo"><span aria-hidden="true">☁️</span>Mi cuenta y la nube</h3>
      {!estado.activa ? (
        <>
          <p className="nota">Con tu cuenta, tus datos quedan respaldados solos, puedes atender desde dos celulares y, si pierdes el tuyo, recuperas todo con tu número y tu PIN. Es opcional: sin cuenta, todo sigue funcionando en este celular.</p>
          <div className="acciones-col">
            <button className="btn-primario ancho" onClick={() => abrir('registro')}>☁️ Crear mi cuenta en la nube</button>
            <button className="btn-secundario ancho" onClick={() => abrir('entrar')}>🔑 Ya tengo cuenta: entrar</button>
          </div>
        </>
      ) : estado.sesionCerrada ? (
        <>
          <div className="estado-nube">
            <strong><span className="punto error" />Tu sesión se cerró</strong>
            <span className="item-sub">{SESION_CERRADA}</span>
            {estado.telefono && <span className="item-sub">Cuenta: celular {estado.telefono}</span>}
          </div>
          <div className="acciones-col">
            <button className="btn-primario ancho" onClick={() => abrir('entrar')}>🔑 Entrar de nuevo</button>
            <button className="btn-secundario ancho" disabled={ocupado} onClick={cerrarSesionAqui}>Salir de la cuenta en este celular</button>
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
            <span className="item-sub">{estado.telefono ? `Cuenta: celular ${estado.telefono}` : 'Cuenta sin número y PIN: ponlos en "Mi cuenta" para poder entrar desde otro celular'}</span>
            <span className="item-sub">Servidor: {estado.url}</span>
          </div>
          <div className="acciones-col">
            <button className="btn-secundario ancho" disabled={ocupado} onClick={() => correr(sincronizar, 'Sincronizado')}>🔄 Sincronizar ahora</button>
            <button className="btn-secundario ancho" onClick={() => abrir('codigo')}>📱 Sumar otro celular</button>
            <button className="btn-secundario ancho" onClick={() => abrir('cuenta')}>👤 Mi cuenta y mis celulares</button>
            <button className="btn-peligro ancho" disabled={ocupado} onClick={cerrarSesionAqui}>Cerrar sesión en este celular</button>
          </div>
        </>
      )}

      {modal === 'registro' && (
        <Modal titulo="Crear mi cuenta en la nube" onCerrar={() => setModal(null)}>
          <FormRegistro nombreInicial={nombreBodega} url={estado.url} ocupado={ocupado} error={error} textoBoton="Crear cuenta y respaldar ahora" onRegistrar={(d) => correr(() => activarNubeConAcceso(d.url, d.nombre, d.telefono, d.pin, nombreDelDispositivo()), 'Cuenta creada. Todo respaldado.')} />
        </Modal>
      )}
      {modal === 'entrar' && (
        <Modal titulo="Entrar a mi bodega" onCerrar={() => setModal(null)}>
          <FormLogin
            url={estado.url}
            ocupado={ocupado}
            error={error}
            onEntrar={(url, telefono, pin) => correr(() => iniciarSesionNube(url, telefono, pin, nombreDelDispositivo()), 'Entraste a tu bodega. Bajando tus datos…')}
            onVincular={(url, codigo) => correr(() => vincularConCodigo(url, codigo, nombreDelDispositivo()), 'Celular vinculado. Bajando los datos de tu bodega…')}
          />
        </Modal>
      )}
      {modal === 'cuenta' && <Cuenta onCerrar={() => setModal(null)} avisar={avisar} />}
      {modal === 'codigo' && <MostrarCodigo onCerrar={() => setModal(null)} avisar={avisar} />}
    </>
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
  const listo = TELEFONO_OK.test(telefono) && PIN_CUENTA_OK.test(pin) && pin === pin2
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
                <input type="tel" inputMode="numeric" maxLength={9} placeholder="9xxxxxxxx" value={telefono} onChange={(e) => setTelefono(soloDigitos(e.target.value))} />
              </Campo>
              <div className="fila-2">
                <Campo label="PIN de la cuenta" ayuda="4 a 6 números">
                  <input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(soloDigitos(e.target.value))} />
                </Campo>
                <Campo label="Repite el PIN">
                  <input type="password" inputMode="numeric" maxLength={6} value={pin2} onChange={(e) => setPin2(soloDigitos(e.target.value))} />
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
          <p className="nota">En el otro celular, abre Sencillo y elige <strong>Ya tengo cuenta: entrar → Con código del otro celular</strong> (o, si ya lo usa, en <strong>Más</strong>) y escribe:</p>
          <div className="codigo-grande" aria-label={`Código ${codigo.codigo}`}>{codigo.codigo.split('').map((d, i) => <span key={i}>{d}</span>)}</div>
          <p className="nota">Vale por {codigo.minutos} minutos y se usa una sola vez.</p>
          <button className="btn-secundario ancho" onClick={async () => { try { await navigator.clipboard.writeText(codigo.codigo); avisar('Código copiado') } catch { /* sin portapapeles */ } }}>Copiar código</button>
        </>
      )}
    </Modal>
  )
}
