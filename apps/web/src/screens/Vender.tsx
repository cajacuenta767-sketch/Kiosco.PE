import { useCallback, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Cliente, type MetodoPago, type Producto } from '../db/db'
import { METODOS, anularVenta, deudaDe, diasAtras, guardarCliente, lineaLibre, lineaPaquete, loDeSiempre, precioLinea, registrarVenta, totalCarrito, unidadesVendidas, type LineaCarrito } from '../lib/acciones'
import { Microfono } from '../components/Microfono'
import { MEDIOS_DIGITALES, leerMedios, type MedioDigital } from '../lib/pagos'
import type { MedioPago, Venta } from '@sencillo/shared'
import { hoyISO, redondear, soles } from '@sencillo/shared'
import { Campo, Modal } from '../components/ui'
import { Escaner } from '../components/Escaner'
import { IconoProducto } from '../components/Icono'
import { sonarCobro } from '../lib/sonido'
import type { AccionToast } from '../components/ui'

const MAS_VENDIDOS = '🔥 Más vendidos'

export function Vender({ avisar }: { avisar: (m: string, accion?: AccionToast) => void }) {
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
  const [verClientes, setVerClientes] = useState(false)
  const [calculadora, setCalculadora] = useState(false)
  const [clientePre, setClientePre] = useState<string | undefined>(undefined)
  const medios = useLiveQuery(leerMedios, [])
  const movsFiado = useLiveQuery(() => db.movimientosFiado.toArray(), []) ?? []
  const deudas = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of clientes) m.set(c.id, deudaDe(movsFiado.filter((x) => x.clienteId === c.id)))
    return m
  }, [clientes, movsFiado])

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

  function agregarPaquete(p: Producto, i: number) {
    const paq = p.paquetes?.[i]
    if (!paq) return
    setCarrito((c) => {
      const l = lineaPaquete(p, paq)
      const j = c.findIndex((x) => x.clave === l.clave)
      if (j === -1) return [...c, l]
      return c.map((x, k) => (k === j ? { ...x, cantidad: x.cantidad + paq.cantidad } : x))
    })
  }

  function agregarLoDeSiempre(cliente: Cliente, items: { productoId: string; cantidad: number }[]) {
    const nuevas: LineaCarrito[] = []
    for (const it of items) {
      const p = productos.find((x) => x.id === it.productoId && x.activo)
      if (p) nuevas.push({ clave: `p-${p.id}`, producto: p, cantidad: it.cantidad })
    }
    setCarrito((c) => {
      const copia = [...c]
      for (const n of nuevas) {
        const j = copia.findIndex((x) => x.clave === n.clave)
        if (j === -1) copia.push(n)
        else copia[j] = { ...copia[j], cantidad: redondear(copia[j].cantidad + n.cantidad) }
      }
      return copia
    })
    setClientePre(cliente.id)
    setVerClientes(false)
    avisar(nuevas.length ? `Lo de siempre de ${cliente.nombre} en el carrito` : `${cliente.nombre} aún no tiene compras habituales`)
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
      const ventaId = await registrarVenta({ lineas: carrito, metodoPago: metodo, clienteId, pagoCon })
      setCarrito([])
      setCobrando(false)
      setVerCarrito(false)
      setClientePre(undefined)
      void sonarCobro()
      const vuelto = metodo === 'efectivo' && pagoCon != null ? redondear(pagoCon - total) : 0
      const deshacer: AccionToast = {
        label: 'Deshacer',
        fn: async () => {
          const v = await db.ventas.get(ventaId)
          if (v) {
            await anularVenta(v)
            avisar('Venta deshecha · el stock volvió')
          }
        },
      }
      avisar(vuelto > 0 ? `Venta registrada · Vuelto ${soles(vuelto)}` : `Venta registrada · ${soles(total)}`, deshacer)
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
        <Microfono onTexto={(t) => setBusqueda(t)} />
        <button className="btn-secundario btn-cuadrado" title="Escanear con la cámara" aria-label="Escanear con la cámara" onClick={() => setEscaneando(true)}>📷</button>
        <button className="btn-secundario btn-cuadrado" title="Venta rápida sin producto" aria-label="Venta rápida" onClick={() => setVentaRapida(true)}>S/</button>
        <button className="btn-secundario btn-cuadrado" title="Lo de siempre de un cliente" aria-label="Clientes" onClick={() => setVerClientes(true)}>👤</button>
        <button className="btn-secundario btn-cuadrado" title="Calcular vuelto sin registrar venta" aria-label="Calcular vuelto" onClick={() => setCalculadora(true)}>🧮</button>
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
          const lineasDeEste = carrito.filter((l) => l.producto.id === p.id)
          const enCarrito = lineasDeEste.length ? { cantidad: redondear(lineasDeEste.reduce((s, l) => s + l.cantidad, 0)) } : undefined
          const agotado = p.stock <= 0
          const bajo = !agotado && p.stock <= p.stockMinimo
          return (
            <div key={p.id} className={'tarjeta-producto' + (enCarrito ? ' seleccionado' : '') + (agotado ? ' agotado' : '')}>
              <button className="tp-principal" onClick={() => agregar(p)}>
                <IconoProducto p={p} tam={40} />
                <span className="tp-nombre">{p.nombre}</span>
                <span className="tp-precio">{soles(p.precioVenta)}{p.unidad === 'kg' ? '/kg' : ''}</span>
                <span className={'tp-stock' + (bajo ? ' bajo' : '') + (agotado ? ' cero' : '')}>{agotado ? 'Sin stock' : `${p.stock} ${p.unidad}`}</span>
                {enCarrito && <span className="tp-badge">{enCarrito.cantidad}</span>}
              </button>
              {p.paquetes && p.paquetes.length > 0 && (
                <div className="tp-paquetes">
                  {p.paquetes.map((q, i) => (
                    <button key={q.nombre} className="tp-paquete" onClick={() => agregarPaquete(p, i)} title={`${q.cantidad} unidades por ${soles(q.precio)}`} aria-label={`${q.nombre} ${soles(q.precio)}`}>
                      📦 {q.nombre} {soles(q.precio)}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
                  <strong>{l.producto.nombre}{l.etiqueta ? ` (${l.etiqueta})` : ''}</strong>
                  <span>{soles(precioLinea(l))} × {l.cantidad} {l.producto.unidad}</span>
                </div>
                <div className="lc-controles">
                  <button className="btn-mini" onClick={() => cambiar(l.clave, l.producto.unidad === 'kg' ? -0.25 : -1)}>−</button>
                  <input type="number" inputMode="decimal" step={l.producto.unidad === 'kg' ? 0.05 : 1} value={l.cantidad} onChange={(e) => fijar(l.clave, Number(e.target.value))} />
                  <button className="btn-mini" onClick={() => cambiar(l.clave, l.producto.unidad === 'kg' ? 0.25 : 1)}>+</button>
                </div>
                <div className="lc-total">{soles(precioLinea(l) * l.cantidad)}</div>
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

      {calculadora && <CalculadoraVuelto onCerrar={() => setCalculadora(false)} />}
      {verClientes && <LoDeSiempre clientes={clientes} onCerrar={() => setVerClientes(false)} onElegir={agregarLoDeSiempre} />}

      {cobrando && <Cobrar total={total} clientes={clientes} deudas={deudas} clienteInicial={clientePre} medios={medios} onCerrar={() => setCobrando(false)} onConfirmar={confirmar} />}
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

function Cobrar({ total, clientes, deudas, clienteInicial, medios, onCerrar, onConfirmar }: { total: number; clientes: Cliente[]; deudas: Map<string, number>; clienteInicial?: string; medios?: Record<MedioDigital, MedioPago>; onCerrar: () => void; onConfirmar: (m: MetodoPago, clienteId?: string, pagoCon?: number) => Promise<void> }) {
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
  const [pagoCon, setPagoCon] = useState<string>('')
  const [clienteId, setClienteId] = useState<string | undefined>(clienteInicial ?? clientes[0]?.id)
  const [pantallaCompleta, setPantallaCompleta] = useState(false)
  const medio = metodo === 'yape' || metodo === 'plin' ? medios?.[metodo] : undefined
  const infoMedio = MEDIOS_DIGITALES.find((m) => m.id === metodo)
  const clienteSel = clientes.find((c) => c.id === clienteId)
  const deudaActual = clienteSel ? (deudas.get(clienteSel.id) ?? 0) : 0
  const pasaTope = Boolean(clienteSel?.tope && deudaActual + total > clienteSel.tope!)
  const [nuevoCliente, setNuevoCliente] = useState('')
  const [guardando, setGuardando] = useState(false)

  const pago = pagoCon === '' ? total : Number(pagoCon)
  const vuelto = redondear(pago - total)
  const billetes = [10, 20, 50, 100, 200].filter((b) => b >= total).slice(0, 3)
  const sugeridos = Array.from(new Set([Math.ceil(total), ...billetes])).filter((b) => b >= total)

  async function confirmar() {
    if (metodo === 'fiado' && pasaTope && !nuevoCliente.trim()) {
      if (!confirm(`${clienteSel!.nombre} ya debe ${soles(deudaActual)} y su tope es ${soles(clienteSel!.tope!)}. ¿Le fías igual?`)) return
    }
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

      {(metodo === 'yape' || metodo === 'plin') && (
        <div className="bloque">
          {medio?.qr || medio?.numero ? (
            <div className="pago-digital" style={{ borderColor: infoMedio?.color }}>
              {medio.qr && <img className="pago-qr" src={medio.qr} alt={`QR de ${infoMedio?.label}`} />}
              <div className="pago-datos">
                {medio.numero && <strong className="pago-numero">{medio.numero.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')}</strong>}
                {medio.titular && <span>{medio.titular}</span>}
                <span className="item-sub">{infoMedio?.label} · {soles(total)}</span>
              </div>
              <button className="btn-secundario ancho" onClick={() => setPantallaCompleta(true)}>📲 Mostrar al cliente en grande</button>
            </div>
          ) : (
            <p className="nota">Sube tu QR y número de {infoMedio?.label} en <strong>Más → Cobros con Yape y Plin</strong> y aparecerán aquí para que el cliente escanee.</p>
          )}
          <p className="nota">Confirma que llegó la notificación de {infoMedio?.label} antes de entregar.</p>
        </div>
      )}
      {metodo === 'tarjeta' && <p className="nota">Confirma que el POS aprobó el pago antes de entregar.</p>}
      {pantallaCompleta && medio && (
        <div className="pago-completo" style={{ background: infoMedio?.color }} onClick={() => setPantallaCompleta(false)} role="dialog" aria-label="QR para el cliente">
          <span className="pago-completo-titulo">Paga con {infoMedio?.label}</span>
          <strong className="pago-completo-monto">{soles(total)}</strong>
          {medio.qr && <img src={medio.qr} alt="" />}
          {medio.numero && <span className="pago-completo-numero">{medio.numero.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')}</span>}
          {medio.titular && <span className="pago-completo-titular">{medio.titular}</span>}
          <span className="pago-completo-pie">Toca para volver</span>
        </div>
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
          {clienteSel && !nuevoCliente.trim() && (
            <p className={'nota ' + (pasaTope ? 'texto-peligro' : deudaActual > 0 ? 'texto-alerta' : 'texto-ok')}>
              {deudaActual > 0 ? `${clienteSel.nombre} ya debe ${soles(deudaActual)}` : `${clienteSel.nombre} está al día`}
              {clienteSel.tope ? ` · tope ${soles(clienteSel.tope)}` : ''}
              {pasaTope ? ` · con esta venta pasaría su tope (${soles(deudaActual + total)})` : ''}
            </p>
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


/** Elegir un cliente y cargar "lo de siempre": lo que se lleva en la mayoría de sus compras. */
function LoDeSiempre({ clientes, onCerrar, onElegir }: { clientes: Cliente[]; onCerrar: () => void; onElegir: (c: Cliente, items: { productoId: string; nombre: string; cantidad: number }[]) => void }) {
  const ventas = useLiveQuery(() => db.ventas.filter((v) => !!v.clienteId).toArray(), []) ?? []
  const [busqueda, setBusqueda] = useState('')
  const porCliente = useMemo(() => {
    const m = new Map<string, Venta[]>()
    for (const v of ventas) {
      const arr = m.get(v.clienteId!) ?? []
      arr.push(v)
      m.set(v.clienteId!, arr)
    }
    return m
  }, [ventas])
  const visibles = clientes.filter((c) => !busqueda || c.nombre.toLowerCase().includes(busqueda.toLowerCase()))
  return (
    <Modal titulo="Lo de siempre" onCerrar={onCerrar}>
      <p className="nota">Toca un cliente y su compra habitual entra al carrito. Se aprende sola de lo que fía.</p>
      <div className="buscador"><input type="search" placeholder="Buscar cliente…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} /></div>
      {visibles.length === 0 && <p className="nota">No hay clientes todavía. Aparecen cuando fías desde Cobrar.</p>}
      <ul className="lista">
        {visibles.map((c) => {
          const items = loDeSiempre(porCliente.get(c.id) ?? [])
          return (
            <li key={c.id} className="item">
              <button className="item-cuerpo" onClick={() => onElegir(c, items)}>
                <div className="item-titulo">
                  <strong>{c.nombre}</strong>
                  <span className="item-sub">{items.length ? items.map((i) => `${i.cantidad} ${i.nombre}`).join(', ') : 'Sin compras habituales aún'}</span>
                </div>
                <span className="item-precio">⭐</span>
              </button>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}

/** Calcular el vuelto sin anotar nada: para lo que no quiere registrar o para comprobar. */
function CalculadoraVuelto({ onCerrar }: { onCerrar: () => void }) {
  const [total, setTotal] = useState('')
  const [paga, setPaga] = useState('')
  const t = Number(total) || 0
  const p = Number(paga) || 0
  const vuelto = redondear(p - t)
  const billetes = [5, 10, 20, 50, 100, 200].filter((b) => b >= t && t > 0).slice(0, 4)
  return (
    <Modal titulo="Calcular vuelto" onCerrar={onCerrar}>
      <p className="nota">Solo calcula. No anota la venta.</p>
      <Campo label="¿Cuánto es? (S/)">
        <input autoFocus type="number" inputMode="decimal" step="0.1" min={0} placeholder="0.00" value={total} onChange={(e) => setTotal(e.target.value)} />
      </Campo>
      <Campo label="¿Con cuánto paga? (S/)">
        <input type="number" inputMode="decimal" step="0.1" min={0} placeholder="0.00" value={paga} onChange={(e) => setPaga(e.target.value)} />
      </Campo>
      {billetes.length > 0 && (
        <div className="chips">
          {billetes.map((b) => <button key={b} className={'chip' + (p === b ? ' activo' : '')} onClick={() => setPaga(String(b))}>S/ {b}</button>)}
        </div>
      )}
      {t > 0 && p > 0 && (
        <div className={'vuelto' + (vuelto < 0 ? ' negativo' : '')}>
          <span>{vuelto < 0 ? 'Falta' : 'Vuelto'}</span>
          <strong>{soles(Math.abs(vuelto))}</strong>
        </div>
      )}
    </Modal>
  )
}
