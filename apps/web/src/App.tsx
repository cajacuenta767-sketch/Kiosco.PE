import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getConfig, setConfig } from './db/db'
import { migrarDesdeVersionAnterior } from './db/migracion'
import { iniciarSync, leerEstado } from './sync/motor'
import { Toast, type AccionToast } from './components/ui'
import { Guia } from './components/Guia'
import type { Modo } from './lib/pin'
import { Vender } from './screens/Vender'
import { Stock } from './screens/Stock'
import { Fiados } from './screens/Fiados'
import { Caja } from './screens/Caja'
import { Ajustes } from './screens/Ajustes'
import { Bienvenida } from './screens/Bienvenida'
import { Bloqueo } from './screens/Bloqueo'
import { cambiarModo } from './lib/pin'
import { hoyISO, soles } from '@sencillo/shared'
import { deudaDe } from './lib/acciones'

type Tab = 'vender' | 'stock' | 'fiados' | 'caja' | 'ajustes'

const TABS: { id: Tab; label: string; icono: string }[] = [
  { id: 'vender', label: 'Vender', icono: '🛒' },
  { id: 'stock', label: 'Stock', icono: '📦' },
  { id: 'fiados', label: 'Fiados', icono: '📒' },
  { id: 'caja', label: 'Caja', icono: '💰' },
  { id: 'ajustes', label: 'Más', icono: '⚙️' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('vender')
  const [toast, setToast] = useState<string | null>(null)
  const [accion, setAccion] = useState<AccionToast | null>(null)
  const [guia, setGuia] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const [listo, setListo] = useState(false)
  const [bienvenida, setBienvenida] = useState(false)
  const [bloqueado, setBloqueado] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const migrado = await migrarDesdeVersionAnterior()
        if (migrado) await setConfig('bienvenida', '1')
        const hecha = (await getConfig('bienvenida')) === '1' || (await db.productos.count()) > 0
        setBienvenida(!hecha)
        setBloqueado(hecha && (await getConfig('bloqueo')) === '1' && (await getConfig('pin')) !== '')
      } finally {
        setListo(true)
      }
    })()
    return iniciarSync()
  }, [])
  const nube = useLiveQuery(leerEstado, [])
  const pendientes = useLiveQuery(() => db.cola.count(), []) ?? 0

  const avisar = useCallback((m: string, acc?: AccionToast) => {
    setToast(m)
    setAccion(acc ?? null)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => { setToast(null); setAccion(null) }, acc ? 6000 : 2800)
  }, [])

  const nombre = useLiveQuery(() => db.config.get('nombreBodega'), [])?.value
  const tema = useLiveQuery(() => db.config.get('tema'), [])?.value ?? 'auto'
  const letra = useLiveQuery(() => db.config.get('letra'), [])?.value ?? 'normal'
  const modo = (useLiveQuery(() => db.config.get('modo'), [])?.value ?? 'duena') as Modo
  const ayudante = modo === 'ayudante'
  useEffect(() => {
    document.documentElement.dataset.letra = letra
  }, [letra])
  useEffect(() => {
    document.documentElement.dataset.tema = tema
    const color = tema === 'oscuro' || (tema === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? '#9a3412' : '#c2410c'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
  }, [tema])
  const bajos = useLiveQuery(async () => (await db.productos.toArray()).filter((p) => p.activo && p.stock <= p.stockMinimo).length, []) ?? 0
  const ventasHoy = useLiveQuery(() => db.ventas.where('dia').equals(hoyISO()).toArray(), []) ?? []
  const movs = useLiveQuery(() => db.movimientosFiado.toArray(), []) ?? []
  const totalHoy = ventasHoy.reduce((s, v) => s + v.total, 0)
  const cierreHoy = useLiveQuery(() => db.cierres.where('dia').equals(hoyISO()).first(), [])
  const avisoVisto = useLiveQuery(() => db.config.get('avisoCierre'), [])?.value
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setAhora(new Date()), 60_000)
    return () => window.clearInterval(t)
  }, [])
  const mostrarAvisoCierre = !ayudante && ahora.getHours() >= 20 && ventasHoy.length > 0 && !cierreHoy && avisoVisto !== hoyISO() && tab !== 'caja'
  const deudaTotal = Math.max(0, deudaDe(movs))

  const badges: Partial<Record<Tab, string>> = {
    stock: bajos > 0 ? String(bajos) : undefined,
    fiados: deudaTotal > 0 ? `S/${Math.round(deudaTotal)}` : undefined,
    caja: totalHoy > 0 ? `S/${Math.round(totalHoy)}` : undefined,
  }

  if (!listo) return <div className="cargando">Cargando tu bodega…</div>
  if (bienvenida) return <Bienvenida onListo={() => setBienvenida(false)} />
  if (bloqueado) {
    return (
      <Bloqueo
        nombreBodega={nombre ?? ''}
        modo={modo}
        nubeActiva={Boolean(nube?.activa && !nube.sesionCerrada)}
        onEntrar={async (como, recuperado) => {
          await cambiarModo(como)
          setBloqueado(false)
          if (recuperado) avisar('Entraste con el PIN de tu cuenta. Cambia tu PIN de la app en Más.')
        }}
      />
    )
  }

  return (
    <div className="app">
      <header className="cabecera">
        <div>
          <h1>{nombre || 'Sencillo'}</h1>
          <span className="cab-sub">{TABS.find((t) => t.id === tab)?.label}{ayudante ? ' · Modo ayudante' : ''}</span>
        </div>
        <div className="cab-derecha">
          <button className="cab-ayuda" onClick={() => setGuia(true)} aria-label="¿Cómo se usa?" title="¿Cómo se usa?">?</button>
          {nube?.activa && (
            <button className={'cab-nube' + (nube.error ? ' error' : pendientes > 0 || nube.sincronizando ? ' pendiente' : ' ok')} onClick={() => setTab('ajustes')} title={nube.sesionCerrada ? 'Sesión cerrada: entra de nuevo' : nube.error ? `Sin conexión: ${nube.error}` : pendientes > 0 ? `${pendientes} cambios por subir` : 'Nube al día'} aria-label="Estado de la nube">
              ☁️{pendientes > 0 && <span>{pendientes}</span>}
            </button>
          )}
          {tab !== 'caja' && totalHoy > 0 && !ayudante && <button className="cab-hoy" onClick={() => setTab('caja')}>Hoy S/ {totalHoy.toFixed(2)}</button>}
        </div>
      </header>

      {nube?.sesionCerrada && tab !== 'ajustes' && (
        <div className="aviso-cierre" role="status">
          <span>🔒 La sesión de la nube en este celular se cerró. Tus ventas siguen guardándose aquí.</span>
          <div className="aviso-cierre-acciones">
            <button className="btn-primario" onClick={() => setTab('ajustes')}>Entrar de nuevo</button>
          </div>
        </div>
      )}
      {mostrarAvisoCierre && (
        <div className="aviso-cierre" role="status">
          <span>🌙 Ya es de noche y vendiste {soles(totalHoy)}. ¿Cerramos la caja?</span>
          <div className="aviso-cierre-acciones">
            <button className="btn-primario" onClick={() => setTab('caja')}>Cerrar caja</button>
            <button className="btn-enlace" onClick={() => setConfig('avisoCierre', hoyISO())}>Más tarde</button>
          </div>
        </div>
      )}
      <main className="contenido">
        {tab === 'vender' && <Vender avisar={avisar} />}
        {tab === 'stock' && <Stock avisar={avisar} ayudante={ayudante} />}
        {tab === 'fiados' && <Fiados avisar={avisar} />}
        {tab === 'caja' && <Caja avisar={avisar} ayudante={ayudante} />}
        {tab === 'ajustes' && <Ajustes avisar={avisar} ayudante={ayudante} />}
      </main>

      <nav className="nav">
        {TABS.map((t) => (
          <button key={t.id} className={'nav-btn' + (tab === t.id ? ' activo' : '')} onClick={() => setTab(t.id)} aria-label={t.label}>
            <span className="nav-icono">{t.icono}</span>
            <span className="nav-label">{t.label}</span>
            {badges[t.id] && <span className="nav-badge">{badges[t.id]}</span>}
          </button>
        ))}
      </nav>
      <Toast mensaje={toast} accion={accion} />
      {guia && <Guia tab={tab} onCerrar={() => setGuia(false)} />}
    </div>
  )
}
