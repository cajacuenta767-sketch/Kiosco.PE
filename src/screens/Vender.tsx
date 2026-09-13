import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Cliente, type MetodoPago, type Producto } from '../db/db'
import { METODOS, registrarVenta, totalCarrito, type LineaCarrito } from '../lib/acciones'
import { redondear, soles } from '../lib/format'
import { Campo, Modal } from '../components/ui'

export function Vender({ avisar }: { avisar: (m: string) => void }) {
  const productos = useLiveQuery(() => db.productos.toArray(), []) ?? []
  const clientes = useLiveQuery(() => db.clientes.orderBy('nombre').toArray(), []) ?? []
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState<string>('Todo')
  const [carrito, setCarrito] = useState<LineaCarrito[]>([])
  const [cobrando, setCobrando] = useState(false)
  const [verCarrito, setVerCarrito] = useState(false)

  const activos = productos.filter((p) => p.activo)
  const categorias = useMemo(() => ['Todo', ...Array.from(new Set(activos.map((p) => p.categoria)))], [activos])
  const visibles = activos.filter((p) => {
    const q = busqueda.trim().toLowerCase()
    const okQ = !q || p.nombre.toLowerCase().includes(q) || p.codigoBarras === q
    const okC = categoria === 'Todo' || p.categoria === categoria
    return okQ && okC
  })

  const total = totalCarrito(carrito)
  const unidades = carrito.reduce((s, l) => s + (l.producto.unidad === 'kg' ? 1 : l.cantidad), 0)

  function agregar(p: Producto) {
    setCarrito((c) => {
      const i = c.findIndex((l) => l.producto.id === p.id)
      if (i === -1) return [...c, { producto: p, cantidad: p.unidad === 'kg' ? 0.5 : 1 }]
      const paso = p.unidad === 'kg' ? 0.25 : 1
      return c.map((l, j) => (j === i ? { ...l, cantidad: redondear(l.cantidad + paso) } : l))
    })
    if (busqueda) setBusqueda('')
  }

  function cambiar(id: number, delta: number) {
    setCarrito((c) =>
      c
        .map((l) => (l.producto.id === id ? { ...l, cantidad: redondear(l.cantidad + delta) } : l))
        .filter((l) => l.cantidad > 0),
    )
  }

  function fijar(id: number, cant: number) {
    setCarrito((c) => c.map((l) => (l.producto.id === id ? { ...l, cantidad: Math.max(0, cant) } : l)))
  }

  async function confirmar(metodo: MetodoPago, clienteId?: number, pagoCon?: number) {
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
      <div className="buscador">
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
          const enCarrito = carrito.find((l) => l.producto.id === p.id)
          const agotado = p.stock <= 0
          const bajo = !agotado && p.stock <= p.stockMinimo
          return (
            <button
              key={p.id}
              className={'tarjeta-producto' + (enCarrito ? ' seleccionado' : '') + (agotado ? ' agotado' : '')}
              onClick={() => agregar(p)}
            >
              <span className="tp-nombre">{p.nombre}</span>
              <span className="tp-precio">{soles(p.precioVenta)}{p.unidad === 'kg' ? '/kg' : ''}</span>
              <span className={'tp-stock' + (bajo ? ' bajo' : '') + (agotado ? ' cero' : '')}>
                {agotado ? 'Sin stock' : `${p.stock} ${p.unidad}`}
              </span>
              {enCarrito && <span className="tp-badge">{enCarrito.cantidad}</span>}
            </button>
          )
        })}
        {visibles.length === 0 && <p className="nota-vacia">No hay productos con ese nombre. Agrégalo en Stock.</p>}
      </div>

      {carrito.length > 0 && (
        <div className="barra-cobro">
          <button className="btn-secundario" onClick={() => setVerCarrito(true)}>
            🛒 {unidades} {unidades === 1 ? 'ítem' : 'ítems'}
          </button>
          <button className="btn-primario grande" onClick={() => setCobrando(true)}>
            Cobrar {soles(total)}
          </button>
        </div>
      )}

      {verCarrito && (
        <Modal titulo="Carrito" onCerrar={() => setVerCarrito(false)}>
          <ul className="lista-carrito">
            {carrito.map((l) => (
              <li key={l.producto.id}>
                <div className="lc-info">
                  <strong>{l.producto.nombre}</strong>
                  <span>{soles(l.producto.precioVenta)} × {l.cantidad} {l.producto.unidad}</span>
                </div>
                <div className="lc-controles">
                  <button className="btn-mini" onClick={() => cambiar(l.producto.id!, l.producto.unidad === 'kg' ? -0.25 : -1)}>−</button>
                  <input
                    type="number"
                    inputMode="decimal"
                    step={l.producto.unidad === 'kg' ? 0.05 : 1}
                    value={l.cantidad}
                    onChange={(e) => fijar(l.producto.id!, Number(e.target.value))}
                  />
                  <button className="btn-mini" onClick={() => cambiar(l.producto.id!, l.producto.unidad === 'kg' ? 0.25 : 1)}>+</button>
                </div>
                <div className="lc-total">{soles(l.producto.precioVenta * l.cantidad)}</div>
              </li>
            ))}
          </ul>
          <div className="fila-total">
            <span>Total</span>
            <strong>{soles(total)}</strong>
          </div>
          <div className="acciones">
            <button className="btn-secundario" onClick={() => { setCarrito([]); setVerCarrito(false) }}>Vaciar</button>
            <button className="btn-primario" onClick={() => { setVerCarrito(false); setCobrando(true) }}>Cobrar</button>
          </div>
        </Modal>
      )}

      {cobrando && (
        <Cobrar total={total} clientes={clientes} onCerrar={() => setCobrando(false)} onConfirmar={confirmar} />
      )}
    </div>
  )
}

function Cobrar({
  total,
  clientes,
  onCerrar,
  onConfirmar,
}: {
  total: number
  clientes: Cliente[]
  onCerrar: () => void
  onConfirmar: (m: MetodoPago, clienteId?: number, pagoCon?: number) => Promise<void>
}) {
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
  const [pagoCon, setPagoCon] = useState<string>('')
  const [clienteId, setClienteId] = useState<number | undefined>(clientes[0]?.id)
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
        cid = await db.clientes.add({ nombre: nuevoCliente.trim(), creadoEn: new Date().toISOString() })
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
              <select value={clienteId ?? ''} onChange={(e) => setClienteId(e.target.value ? Number(e.target.value) : undefined)}>
                <option value="">— Elegir —</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
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
