import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/db'
import { sembrarSiVacio } from './db/seed'
import { Toast } from './components/ui'
import { Vender } from './screens/Vender'
import { Stock } from './screens/Stock'
import { Fiados } from './screens/Fiados'
import { Caja } from './screens/Caja'
import { Ajustes } from './screens/Ajustes'
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

  useEffect(() => {
    sembrarSiVacio().finally(() => setListo(true))
  }, [])

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

  return (
    <div className="app">
      <header className="cabecera">
        <div>
          <h1>{nombre || 'Kiosco.PE'}</h1>
          <span className="cab-sub">{TABS.find((t) => t.id === tab)?.label}</span>
        </div>
        {tab !== 'caja' && totalHoy > 0 && <button className="cab-hoy" onClick={() => setTab('caja')}>Hoy S/ {totalHoy.toFixed(2)}</button>}
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
