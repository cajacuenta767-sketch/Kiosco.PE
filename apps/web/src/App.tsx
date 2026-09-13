import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getConfig, setConfig } from './db/db'
import { migrarDesdeVersionAnterior } from './db/migracion'
import { iniciarSync, leerEstado } from './sync/motor'
import { Toast } from './components/ui'
import { Vender } from './screens/Vender'
import { Stock } from './screens/Stock'
import { Fiados } from './screens/Fiados'
import { Caja } from './screens/Caja'
import { Ajustes } from './screens/Ajustes'
import { Bienvenida } from './screens/Bienvenida'
import { hoyISO } from '@kiosco/shared'
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
  const timer = useRef<number | undefined>(undefined)
  const [listo, setListo] = useState(false)
  const [bienvenida, setBienvenida] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const migrado = await migrarDesdeVersionAnterior()
        if (migrado) await setConfig('bienvenida', '1')
        const hecha = (await getConfig('bienvenida')) === '1' || (await db.productos.count()) > 0
        setBienvenida(!hecha)
      } finally {
        setListo(true)
      }
    })()
    return iniciarSync()
  }, [])
  const nube = useLiveQuery(leerEstado, [])
  const pendientes = useLiveQuery(() => db.cola.count(), []) ?? 0

  const avisar = useCallback((m: string) => {
    setToast(m)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast(null), 2800)
  }, [])

  const nombre = useLiveQuery(() => db.config.get('nombreBodega'), [])?.value
  const tema = useLiveQuery(() => db.config.get('tema'), [])?.value ?? 'auto'
  useEffect(() => {
    document.documentElement.dataset.tema = tema
    const color = tema === 'oscuro' || (tema === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? '#0b5d57' : '#0f766e'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
  }, [tema])
  const bajos = useLiveQuery(async () => (await db.productos.toArray()).filter((p) => p.activo && p.stock <= p.stockMinimo).length, []) ?? 0
  const ventasHoy = useLiveQuery(() => db.ventas.where('dia').equals(hoyISO()).toArray(), []) ?? []
  const movs = useLiveQuery(() => db.movimientosFiado.toArray(), []) ?? []
  const totalHoy = ventasHoy.reduce((s, v) => s + v.total, 0)
  const deudaTotal = Math.max(0, deudaDe(movs))

  const badges: Partial<Record<Tab, string>> = {
    stock: bajos > 0 ? String(bajos) : undefined,
    fiados: deudaTotal > 0 ? `S/${Math.round(deudaTotal)}` : undefined,
    caja: totalHoy > 0 ? `S/${Math.round(totalHoy)}` : undefined,
  }

  if (!listo) return <div className="cargando">Cargando tu bodega…</div>
  if (bienvenida) return <Bienvenida onListo={() => setBienvenida(false)} />

  return (
    <div className="app">
      <header className="cabecera">
        <div>
          <h1>{nombre || 'Kiosco.PE'}</h1>
          <span className="cab-sub">{TABS.find((t) => t.id === tab)?.label}</span>
        </div>
        <div className="cab-derecha">
          {nube?.activa && (
            <button className={'cab-nube' + (nube.error ? ' error' : pendientes > 0 || nube.sincronizando ? ' pendiente' : ' ok')} onClick={() => setTab('ajustes')} title={nube.error ? `Sin conexión: ${nube.error}` : pendientes > 0 ? `${pendientes} cambios por subir` : 'Nube al día'} aria-label="Estado de la nube">
              ☁️{pendientes > 0 && <span>{pendientes}</span>}
            </button>
          )}
          {tab !== 'caja' && totalHoy > 0 && <button className="cab-hoy" onClick={() => setTab('caja')}>Hoy S/ {totalHoy.toFixed(2)}</button>}
        </div>
      </header>

      <main className="contenido">
        {tab === 'vender' && <Vender avisar={avisar} />}
        {tab === 'stock' && <Stock avisar={avisar} />}
        {tab === 'fiados' && <Fiados avisar={avisar} />}
        {tab === 'caja' && <Caja avisar={avisar} />}
        {tab === 'ajustes' && <Ajustes avisar={avisar} />}
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
      <Toast mensaje={toast} />
    </div>
  )
}
