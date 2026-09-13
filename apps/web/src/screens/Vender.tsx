import { useCallback, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Cliente, type MetodoPago, type Producto } from '../db/db'
import { METODOS, diasAtras, guardarCliente, lineaLibre, registrarVenta, totalCarrito, unidadesVendidas, type LineaCarrito } from '../lib/acciones'
import { hoyISO, redondear, soles } from '@kiosco/shared'
import { Campo, Modal } from '../components/ui'
import { Escaner } from '../components/Escaner'

const MAS_VENDIDOS = '🔥 Más vendidos'

export function Vender({ avisar }: { avisar: (m: string) => void }) {
  const productos = useLiveQuery(() => db.productos.toArray(), []) ?? []
  const clientes = useLiveQuery(() => db.clientes.orderBy('nombre').toArray(), []) ?? []
  const ventas30 = useLiveQuery(() => db.ventas.where('dia').between(diasAtras(30), hoyISO(), true, true).toArray(), []) ?? []
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState<string>('Todo')
  const [carrito, setCarrito] = useState<LineaCarrito[]>([])
  const [cobrando, setCobrando] = useState(false)
  const [verCarrito, setVerCarrito] = useState(false)
  const [ventaRapida, setVentaRapida] = useState(false)
  const [escaneando, setEscaneando] = useState(false)

  const activos = productos.filter((p) => p.activo)
  const vendidos = useMemo(() => unidadesVendidas(ventas30), [ventas30])
  const hayHistorial = vendidos.size >= 3
  const categorias = useMemo(
    () => ['Todo', ...(hayHistorial ? [MAS_VENDIDOS] : []), ...Array.from(new Set(activos.map((p) => p.categoria)))],
    [activos, hayHistorial],
  )

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    let lista = activos.filter((p) => {
      const okQ = !q || p.nombre.toLowerCase().includes(q) || p.codigoBarras === q
      const okC = categoria === 'Todo' || categoria === MAS_VENDIDOS || p.categoria === categoria
      return okQ && okC
    })
    if (categoria === MAS_VENDIDOS) lista = lista.filter((p) => (vendidos.get(p.id) ?? 0) > 0).slice().sort((a, b) => (vendidos.get(b.id) ?? 0) - (vendidos.get(a.id) ?? 0)).slice(0, 16)
    else if (categoria === 'Todo' && !q && hayHistorial) lista = lista.slice().sort((a, b) => (vendidos.get(b.id) ?? 0) - (vendidos.get(a.id) ?? 0) || a.nombre.localeCompare(b.nombre))
    return lista
  }, [activos, busqueda, categoria, vendidos, hayHistorial])

  const total = totalCarrito(carrito)
  const unidades = carrito.reduce((s, l) => s + (l.producto.unidad === 'kg' ? 1 : l.cantidad), 0)

  function agregar(p: Producto) {
    setCarrito((c) => {
      const clave = `p-${p.id}`
      const i = c.findIndex((l) => l.clave === clave)
      if (i === -1) return [...c, { clave, producto: p, cantidad: p.unidad === 'kg' ? 0.5 : 1 }]
      const paso = p.unidad === 'kg' ? 0.25 : 1
      return c.map((l, j) => (j === i ? { ...l, cantidad: redondear(l.cantidad + paso) } : l))
    })
    if (busqueda) setBusqueda('')
  }

  function cambiar(clave: string, delta: number) {
    setCarrito((c) => c.map((l) => (l.clave === clave ? { ...l, cantidad: redondear(l.cantidad + delta) } : l)).filter((l) => l.cantidad > 0))
  }

  function fijar(clave: string, cant: number) {
    setCarrito((c) => c.map((l) => (l.clave === clave ? { ...l, cantidad: Math.max(0, cant) } : l)))
  }

  const alEscanear = useCallback(
    (codigo: string) => {
      const p = productos.find((x) => x.activo && x.codigoBarras === codigo)
      if (p) {
        agregar(p)
        avisar(`${p.nombre} agregado`)
      } else {
        setEscaneando(false)
        setBusqueda(codigo)
        avisar('Ese código no está en tu catálogo. Agrégalo en Stock.')
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [productos],
  )

  async function confirmar(metodo: MetodoPago, clienteId?: string, pagoCon?: number) {
    try {
      await registrarVenta({ lineas: carrito, metodoPago: metodo, clienteId, pagoCon })
      setCarrito([])
      setCobrando(false)
      setVerCarrito(false)
      const vuelto = metodo === 'efectivo' && pagoCon != null ? redondear(pagoCon - total) : 0
      avisar(vuelto > 0 ? `Venta registrada · Vuelto ${soles(vuelto)}` : `Venta registrada · ${soles(total)}`)
    } catch (e) {
      avisar((e as Error).message)
    }
  }

  return (
    <div className="pantalla vender">
      <div className="buscador con-boton">
        <input
          type="search"
          inputMode="search"
          placeholder="Buscar producto o escanear código…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && visibles.length === 1) agregar(visibles[0])
          }}
        />
        <button className="btn-secundario btn-cuadrado" title="Escanear con la cámara" aria-label="Escanear con la cámara" onClick={() => setEscaneando(true)}>📷</button>
        <button className="btn-secundario btn-cuadrado" title="Venta rápida sin producto" aria-label="Venta rápida" onClick={() => setVentaRapida(true)}>S/</button>
      </div>
      <div className="chips">
        {categorias.map((c) => (
          <button key={c} className={'chip' + (c === categoria ? ' activo' : '')} onClick={() => setCategoria(c)}>
            {c}
          </button>
        ))}
      </div>

      <div className="grilla-productos">
        {visibles.map((p) => {
          const enCarrito = carrito.find((l) => l.clave === `p-${p.id}`)
          const agotado = p.stock <= 0
          const bajo = !agotado && p.stock <= p.stockMinimo
          return (
            <button key={p.id} className={'tarjeta-producto' + (enCarrito ? ' seleccionado' : '') + (agotado ? ' agotado' : '')} onClick={() => agregar(p)}>
              <span className="tp-nombre">{p.nombre}</span>
              <span className="tp-precio">{soles(p.precioVenta)}{p.unidad === 'kg' ? '/kg' : ''}</span>
              <span className={'tp-stock' + (bajo ? ' bajo' : '') + (agotado ? ' cero' : '')}>{agotado ? 'Sin stock' : `${p.stock} ${p.unidad}`}</span>
              {enCarrito && <span className="tp-badge">{enCarrito.cantidad}</span>}
            </button>
          )
        })}
        {visibles.length === 0 && (
          <div className="nota-vacia">
            <p>No hay productos con ese nombre.</p>
            <button className="btn-secundario" onClick={() => setVentaRapida(true)}>Cobrar un monto sin producto</button>
          </div>
        )}
      </div>

      {carrito.length > 0 && (
        <div className="barra-cobro">
          <button className="btn-secundario" onClick={() => setVerCarrito(true)}>🛒 {unidades} {unidades === 1 ? 'ítem' : 'ítems'}</button>
          <button className="btn-primario grande" onClick={() => setCobrando(true)}>Cobrar {soles(total)}</button>
        </div>
      )}

      {verCarrito && (
        <Modal titulo="Carrito" onCerrar={() => setVerCarrito(false)}>
          <ul className="lista-carrito">
            {carrito.map((l) => (
              <li key={l.clave}>
                <div className="lc-info">
                  <strong>{l.producto.nombre}</strong>
                  <span>{soles(l.producto.precioVenta)} × {l.cantidad} {l.producto.unidad}</span>
                </div>
                <div className="lc-controles">
                  <button className="btn-mini" onClick={() => cambiar(l.clave, l.producto.unidad === 'kg' ? -0.25 : -1)}>−</button>
                  <input type="number" inputMode="decimal" step={l.producto.unidad === 'kg' ? 0.05 : 1} value={l.cantidad} onChange={(e) => fijar(l.clave, Number(e.target.value))} />
                  <button className="btn-mini" onClick={() => cambiar(l.clave, l.producto.unidad === 'kg' ? 0.25 : 1)}>+</button>
                </div>
                <div className="lc-total">{soles(l.producto.precioVenta * l.cantidad)}</div>
              </li>
            ))}
          </ul>
          <div className="fila-total"><span>Total</span><strong>{soles(total)}</strong></div>
          <div className="acciones">
            <button className="btn-secundario" onClick={() => { setCarrito([]); setVerCarrito(false) }}>Vaciar</button>
            <button className="btn-primario" onClick={() => { setVerCarrito(false); setCobrando(true) }}>Cobrar</button>
          </div>
        </Modal>
      )}

      {ventaRapida && (
        <VentaRapida
          onCerrar={() => setVentaRapida(false)}
          onAgregar={(l) => { setCarrito((c) => [...c, l]); setVentaRapida(false); avisar(`${soles(l.producto.precioVenta)} agregado al carrito`) }}
        />
      )}

      {escaneando && <Escaner onCodigo={alEscanear} onCerrar={() => setEscaneando(false)} />}

      {cobrando && <Cobrar total={total} clientes={clientes} onCerrar={() => setCobrando(false)} onConfirmar={confirmar} />}
    </div>
  )
}

function VentaRapida({ onCerrar, onAgregar }: { onCerrar: () => void; onAgregar: (l: LineaCarrito) => void }) {
  const [monto, setMonto] = useState('')
  const [desc, setDesc] = useState('')
  const [costo, setCosto] = useState('')
  const n = Number(monto) || 0
  const rapidos = [0.5, 1, 2, 5, 10]
  return (
    <Modal titulo="Venta rápida" onCerrar={onCerrar}>
      <p className="nota">Para lo que no está en tu catálogo: pan, caramelos sueltos, una recarga… Cobra el monto y sigue.</p>
      <Campo label="¿Cuánto cobras? (S/)">
        <input autoFocus type="number" inputMode="decimal" step="0.1" min={0} placeholder="0.00" value={monto} onChange={(e) => setMonto(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && n > 0 && onAgregar(lineaLibre(n, desc, Number(costo) || 0))} />
      </Campo>
      <div className="chips">
        {rapidos.map((r) => (
          <button key={r} className={'chip' + (n === r ? ' activo' : '')} onClick={() => setMonto(String(r))}>S/ {r}</button>
        ))}
      </div>
      <Campo label="¿Qué es? (opcional)">
        <input type="text" placeholder="Ej. 3 panes, recarga Claro" value={desc} onChange={(e) => setDesc(e.target.value)} />
      </Campo>
      <Campo label="¿Te costó? (opcional)" ayuda="Para que la ganancia del día sea exacta">
        <input type="number" inputMode="decimal" step="0.1" min={0} placeholder="0.00" value={costo} onChange={(e) => setCosto(e.target.value)} />
      </Campo>
      <button className="btn-primario grande ancho" disabled={n <= 0} onClick={() => onAgregar(lineaLibre(n, desc, Number(costo) || 0))}>Agregar {n > 0 ? soles(n) : ''}</button>
    </Modal>
  )
}

function Cobrar({ total, clientes, onCerrar, onConfirmar }: { total: number; clientes: Cliente[]; onCerrar: () => void; onConfirmar: (m: MetodoPago, clienteId?: string, pagoCon?: number) => Promise<void> }) {
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
  const [pagoCon, setPagoCon] = useState<string>('')
  const [clienteId, setClienteId] = useState<string | undefined>(clientes[0]?.id)
  const [nuevoCliente, setNuevoCliente] = useState('')
  const [guardando, setGuardando] = useState(false)

  const pago = pagoCon === '' ? total : Number(pagoCon)
  const vuelto = redondear(pago - total)
  const billetes = [10, 20, 50, 100, 200].filter((b) => b >= total).slice(0, 3)
  const sugeridos = Array.from(new Set([Math.ceil(total), ...billetes])).filter((b) => b >= total)

  async function confirmar() {
    setGuardando(true)
    try {
      let cid = clienteId
      if (metodo === 'fiado' && nuevoCliente.trim()) {
        cid = (await guardarCliente({ nombre: nuevoCliente.trim() })).id
      }
      await onConfirmar(metodo, cid, metodo === 'efectivo' ? pago : undefined)
    } finally {
      setGuardando(false)
    }
  }

  const listo = metodo !== 'fiado' ? metodo !== 'efectivo' || vuelto >= 0 : Boolean(clienteId) || nuevoCliente.trim().length > 0

  return (
    <Modal titulo={`Cobrar ${soles(total)}`} onCerrar={onCerrar}>
      <div className="metodos">
        {METODOS.map((m) => (
          <button key={m.id} className={'metodo' + (metodo === m.id ? ' activo' : '')} onClick={() => setMetodo(m.id)}>
            <span>{m.icono}</span>
            {m.label}
          </button>
        ))}
      </div>

      {metodo === 'efectivo' && (
        <div className="bloque">
          <Campo label="¿Con cuánto paga?">
            <input type="number" inputMode="decimal" step="0.1" min={0} placeholder={total.toFixed(2)} value={pagoCon} onChange={(e) => setPagoCon(e.target.value)} />
          </Campo>
          <div className="chips">
            <button className={'chip' + (pagoCon === '' ? ' activo' : '')} onClick={() => setPagoCon('')}>Exacto</button>
            {sugeridos.map((b) => (
              <button key={b} className={'chip' + (Number(pagoCon) === b ? ' activo' : '')} onClick={() => setPagoCon(String(b))}>S/ {b}</button>
            ))}
          </div>
          <div className={'vuelto' + (vuelto < 0 ? ' negativo' : '')}>
            <span>Vuelto</span>
            <strong>{vuelto < 0 ? `Faltan ${soles(-vuelto)}` : soles(vuelto)}</strong>
          </div>
        </div>
      )}

      {(metodo === 'yape' || metodo === 'plin' || metodo === 'tarjeta') && (
        <p className="nota">Confirma que llegó la notificación de {metodo === 'tarjeta' ? 'la tarjeta' : metodo === 'yape' ? 'Yape' : 'Plin'} antes de entregar.</p>
      )}

      {metodo === 'fiado' && (
        <div className="bloque">
          {clientes.length > 0 && (
            <Campo label="¿A quién le fías?">
              <select value={clienteId ?? ''} onChange={(e) => setClienteId(e.target.value || undefined)}>
                <option value="">— Elegir —</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Campo>
          )}
          <Campo label={clientes.length > 0 ? 'O escribe un cliente nuevo' : 'Nombre del cliente'} ayuda="Se creará en tu lista de fiados">
            <input type="text" placeholder="Ej. Sra. Rosa (casa verde)" value={nuevoCliente} onChange={(e) => setNuevoCliente(e.target.value)} />
          </Campo>
        </div>
      )}

      <button className="btn-primario grande ancho" disabled={!listo || guardando} onClick={confirmar}>
        {metodo === 'fiado' ? `Anotar fiado ${soles(total)}` : `Confirmar ${soles(total)}`}
      </button>
    </Modal>
  )
}

