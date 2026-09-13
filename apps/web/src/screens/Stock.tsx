import { Fragment, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Producto, type Unidad } from '../db/db'
import { CATEGORIAS, desactivarProducto, diasAtras, guardarProducto, ingresarMercaderia, pedidoSugerido, textoListaPrecios, textoPedido } from '../lib/acciones'
import type { Paquete } from '@kiosco/shared'
import { fechaCorta, hora, hoyISO, redondear, soles } from '@kiosco/shared'
import { Campo, Modal, Vacio } from '../components/ui'
import { Escaner } from '../components/Escaner'
import { IconoProducto } from '../components/Icono'
import { reducirFoto } from '../lib/imagen'
import { EMOJIS_PRODUCTO, emojiPara } from '@kiosco/shared'

type Filtro = 'todos' | 'bajo' | 'agotado'

export function Stock({ avisar, ayudante = false }: { avisar: (m: string) => void; ayudante?: boolean }) {
  const productos = useLiveQuery(() => db.productos.orderBy('nombre').toArray(), []) ?? []
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [editando, setEditando] = useState<Producto | 'nuevo' | null>(null)
  const [ingresando, setIngresando] = useState<Producto | null>(null)
  const [pedido, setPedido] = useState(false)
  const [listaPrecios, setListaPrecios] = useState(false)
  const ventas14 = useLiveQuery(() => db.ventas.where('dia').between(diasAtras(14), hoyISO(), true, true).toArray(), []) ?? []
  const nombreBodega = useLiveQuery(() => db.config.get('nombreBodega'), [])?.value ?? ''
  const lineasPedido = useMemo(() => pedidoSugerido(productos, ventas14), [productos, ventas14])

  const activos = productos.filter((p) => p.activo)
  const bajos = activos.filter((p) => p.stock > 0 && p.stock <= p.stockMinimo)
  const agotados = activos.filter((p) => p.stock <= 0)
  const valorInventario = activos.reduce((s, p) => s + p.stock * p.precioCompra, 0)
  const valorVenta = activos.reduce((s, p) => s + p.stock * p.precioVenta, 0)

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return activos.filter((p) => {
      if (q && !p.nombre.toLowerCase().includes(q) && p.codigoBarras !== q) return false
      if (filtro === 'bajo') return p.stock > 0 && p.stock <= p.stockMinimo
      if (filtro === 'agotado') return p.stock <= 0
      return true
    })
  }, [activos, busqueda, filtro])

  return (
    <div className="pantalla">
      <div className="kpis">
        <div className="kpi">
          <span className="kpi-label">Productos</span>
          <strong>{activos.length}</strong>
        </div>
        <div className="kpi alerta" onClick={() => setFiltro('bajo')} role="button">
          <span className="kpi-label">Por acabarse</span>
          <strong>{bajos.length}</strong>
        </div>
        <div className="kpi peligro" onClick={() => setFiltro('agotado')} role="button">
          <span className="kpi-label">Agotados</span>
          <strong>{agotados.length}</strong>
        </div>
      </div>
      <p className="nota">
        Tienes <strong>{soles(valorInventario)}</strong> invertidos en mercadería, que vendidos serían <strong>{soles(valorVenta)}</strong>.
      </p>
      {!ayudante && activos.length > 0 && (
        <button className="btn-secundario ancho" onClick={() => setListaPrecios(true)}>🧾 Lista de precios para WhatsApp o imprimir</button>
      )}
      {lineasPedido.length > 0 && (
        <button className="banner-accion" onClick={() => setPedido(true)}>
          <span>📋 <strong>{lineasPedido.length} {lineasPedido.length === 1 ? 'producto' : 'productos'}</strong> por reponer · pedido sugerido {soles(lineasPedido.reduce((s, l) => s + l.costo, 0))}</span>
          <span>›</span>
        </button>
      )}

      <div className="buscador con-boton">
        <input type="search" placeholder="Buscar producto…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        {!ayudante && <button className="btn-primario" onClick={() => setEditando('nuevo')}>+ Producto</button>}
      </div>
      <div className="chips">
        {(['todos', 'bajo', 'agotado'] as Filtro[]).map((f) => (
          <button key={f} className={'chip' + (filtro === f ? ' activo' : '')} onClick={() => setFiltro(f)}>
            {f === 'todos' ? 'Todos' : f === 'bajo' ? '⚠️ Por acabarse' : '⛔ Agotados'}
          </button>
        ))}
      </div>

      {activos.length === 0 ? (
        <Vacio icono="📦" titulo="Aún no tienes productos" texto="Agrega lo que vendes: nombre, precio y cuánto tienes.">
          <button className="btn-primario" onClick={() => setEditando('nuevo')}>Agregar mi primer producto</button>
        </Vacio>
      ) : (
        <ul className="lista">
          {visibles.map((p) => {
            const agotado = p.stock <= 0
            const bajo = !agotado && p.stock <= p.stockMinimo
            const margen = p.precioVenta > 0 ? ((p.precioVenta - p.precioCompra) / p.precioVenta) * 100 : 0
            return (
              <li key={p.id} className="item">
                <button className="item-cuerpo" onClick={() => !ayudante && setEditando(p)}>
                  <IconoProducto p={p} tam={44} />
                  <div className="item-titulo">
                    <strong>{p.nombre}</strong>
                    <span className="item-sub">{p.categoria} · gana {soles(p.precioVenta - p.precioCompra)} ({margen.toFixed(0)}%)</span>
                  </div>
                  <div className="item-derecha">
                    <span className="item-precio">{soles(p.precioVenta)}</span>
                    <span className={'pill' + (agotado ? ' peligro' : bajo ? ' alerta' : '')}>
                      {agotado ? 'Agotado' : `${p.stock} ${p.unidad}`}
                    </span>
                  </div>
                </button>
                {!ayudante && <button className="btn-mini item-accion" title="Ingresar mercadería" onClick={() => setIngresando(p)}>＋ stock</button>}
              </li>
            )
          })}
          {visibles.length === 0 && <li className="nota-vacia">Nada por aquí.</li>}
        </ul>
      )}

      {editando && (
        <FormProducto
          producto={editando === 'nuevo' ? null : editando}
          onCerrar={() => setEditando(null)}
          onGuardado={(msg) => { setEditando(null); avisar(msg) }}
        />
      )}
      {ingresando && (
        <Ingreso producto={ingresando} onCerrar={() => setIngresando(null)} onHecho={(m) => { setIngresando(null); avisar(m) }} />
      )}
      {listaPrecios && <ListaPrecios productos={activos} nombreBodega={nombreBodega} onCerrar={() => setListaPrecios(false)} avisar={avisar} />}
      {pedido && (
        <Modal titulo="Pedido sugerido" onCerrar={() => setPedido(false)}>
          <p className="nota">Calculado con lo vendido en los últimos 14 días: cubre una semana y nunca baja de tu mínimo.</p>
          <ul className="historial">
            {lineasPedido.map((l) => (
              <li key={l.producto.id}>
                <div>
                  <strong>{l.producto.nombre}</strong>
                  <span className="item-sub">
                    Tienes {l.producto.stock} {l.producto.unidad}
                    {l.vendidoPorSemana > 0 ? ` · vendes ${l.vendidoPorSemana}/semana` : ''}
                    {l.diasDeStock !== null && l.diasDeStock < 7 ? ` · te alcanza ${Math.floor(l.diasDeStock)} ${Math.floor(l.diasDeStock) === 1 ? 'día' : 'días'}` : ''}
                  </span>
                </div>
                <span>Pedir {l.sugerido} {l.producto.unidad}<br /><em className="item-sub">{soles(l.costo)}</em></span>
              </li>
            ))}
          </ul>
          <div className="fila-total"><span>Inversión aprox.</span><strong>{soles(lineasPedido.reduce((s, l) => s + l.costo, 0))}</strong></div>
          <a className="btn-whatsapp" href={`https://wa.me/?text=${encodeURIComponent(textoPedido(lineasPedido, nombreBodega))}`} target="_blank" rel="noreferrer">💬 Enviar pedido por WhatsApp</a>
          <button className="btn-secundario ancho" onClick={async () => { try { await navigator.clipboard.writeText(textoPedido(lineasPedido, nombreBodega)); avisar('Pedido copiado') } catch { avisar('No se pudo copiar') } }}>Copiar lista</button>
        </Modal>
      )}
    </div>
  )
}

function FormProducto({ producto, onCerrar, onGuardado }: { producto: Producto | null; onCerrar: () => void; onGuardado: (m: string) => void }) {
  const [f, setF] = useState({
    nombre: producto?.nombre ?? '',
    categoria: producto?.categoria ?? CATEGORIAS[0],
    codigoBarras: producto?.codigoBarras ?? '',
    precioVenta: producto ? String(producto.precioVenta) : '',
    precioCompra: producto ? String(producto.precioCompra) : '',
    stock: producto ? String(producto.stock) : '0',
    stockMinimo: producto ? String(producto.stockMinimo) : '5',
    unidad: (producto?.unidad ?? 'und') as Unidad,
  })
  const [paquetes, setPaquetes] = useState<{ nombre: string; cantidad: string; precio: string }[]>((producto?.paquetes ?? []).map((q) => ({ nombre: q.nombre, cantidad: String(q.cantidad), precio: String(q.precio) })))
  const [emoji, setEmoji] = useState(producto?.emoji ?? '')
  const [imagen, setImagen] = useState(producto?.imagen ?? '')
  const [elegirIcono, setElegirIcono] = useState(false)
  const fotoRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [escaneando, setEscaneando] = useState(false)
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }))

  const venta = Number(f.precioVenta) || 0
  const compra = Number(f.precioCompra) || 0
  const ganancia = redondear(venta - compra)

  const paquetesValidos: Paquete[] = paquetes
    .map((q) => ({ nombre: q.nombre.trim(), cantidad: Number(q.cantidad) || 0, precio: Number(q.precio) || 0 }))
    .filter((q) => q.nombre && q.cantidad > 1 && q.precio > 0)

  async function guardar() {
    if (!f.nombre.trim()) return setError('Ponle un nombre al producto')
    if (paquetes.some((q) => (q.nombre.trim() || q.cantidad || q.precio) && !(q.nombre.trim() && Number(q.cantidad) > 1 && Number(q.precio) > 0))) return setError('Cada paquete necesita nombre, cuántas unidades trae (más de 1) y su precio')
    if (venta <= 0) return setError('El precio de venta debe ser mayor a cero')
    if (compra > venta) return setError('Ojo: el precio de compra es mayor al de venta. Estarías perdiendo plata.')
    const datos = {
      nombre: f.nombre.trim(),
      categoria: f.categoria,
      codigoBarras: f.codigoBarras.trim() || undefined,
      precioVenta: venta,
      precioCompra: compra,
      stock: Number(f.stock) || 0,
      stockMinimo: Number(f.stockMinimo) || 0,
      unidad: f.unidad,
      activo: true,
      emoji: emoji || undefined,
      imagen: imagen || undefined,
      paquetes: paquetesValidos.length ? paquetesValidos : undefined,
    }
    await guardarProducto(datos, producto ?? undefined)
    onGuardado(producto ? 'Producto actualizado' : 'Producto agregado')
  }

  async function desactivar() {
    if (!producto) return
    if (!confirm(`¿Quitar "${producto.nombre}" de tu lista? Las ventas pasadas se conservan.`)) return
    await desactivarProducto(producto)
    onGuardado('Producto quitado')
  }

  return (
    <Modal titulo={producto ? 'Editar producto' : 'Nuevo producto'} onCerrar={onCerrar}>
      <div className="imagen-producto">
        <IconoProducto p={{ nombre: f.nombre, categoria: f.categoria, emoji, imagen }} tam={72} />
        <div className="imagen-acciones">
          <button type="button" className="btn-secundario" onClick={() => fotoRef.current?.click()}>📷 Tomar foto</button>
          <button type="button" className="btn-secundario" onClick={() => setElegirIcono((v) => !v)}>😀 Elegir ícono</button>
          {(imagen || emoji) && <button type="button" className="btn-enlace" onClick={() => { setImagen(''); setEmoji('') }}>Quitar</button>}
        </div>
        <input ref={fotoRef} type="file" accept="image/*" capture="environment" hidden onChange={async (e) => { const a = e.target.files?.[0]; if (a) { try { setImagen(await reducirFoto(a)); setEmoji('') } catch { setError('No se pudo leer la foto') } } e.target.value = '' }} />
      </div>
      {elegirIcono && (
        <div className="emojis">
          {EMOJIS_PRODUCTO.map((em) => (
            <button type="button" key={em} className={'emoji-opcion' + (emoji === em ? ' activo' : '')} onClick={() => { setEmoji(em); setImagen(''); setElegirIcono(false) }}>{em}</button>
          ))}
        </div>
      )}
      <p className="nota">Sin foto ni ícono, la app le pone uno sola según el nombre: {emojiPara(f.nombre || 'x', f.categoria)}</p>
      <Campo label="Nombre">
        <input autoFocus type="text" placeholder="Ej. Inca Kola 500ml" value={f.nombre} onChange={(e) => set('nombre', e.target.value)} />
      </Campo>
      <div className="fila-2">
        <Campo label="Categoría">
          <select value={f.categoria} onChange={(e) => set('categoria', e.target.value)}>
            {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Campo>
        <Campo label="Se vende por">
          <select value={f.unidad} onChange={(e) => set('unidad', e.target.value)}>
            <option value="und">Unidad</option>
            <option value="kg">Kilo</option>
          </select>
        </Campo>
      </div>
      <div className="fila-2">
        <Campo label="Precio de venta (S/)">
          <input type="number" inputMode="decimal" step="0.1" min={0} value={f.precioVenta} onChange={(e) => set('precioVenta', e.target.value)} />
        </Campo>
        <Campo label="Te cuesta (S/)" ayuda="Lo que pagas al proveedor">
          <input type="number" inputMode="decimal" step="0.1" min={0} value={f.precioCompra} onChange={(e) => set('precioCompra', e.target.value)} />
        </Campo>
      </div>
      {venta > 0 && (
        <p className={'nota ' + (ganancia < 0 ? 'texto-peligro' : 'texto-ok')}>
          Ganas <strong>{soles(ganancia)}</strong> por {f.unidad === 'kg' ? 'kilo' : 'unidad'}{venta > 0 ? ` (${((ganancia / venta) * 100).toFixed(0)}%)` : ''}.
        </p>
      )}
      <div className="fila-2">
        <Campo label={`Stock actual (${f.unidad})`}>
          <input type="number" inputMode="decimal" min={0} value={f.stock} onChange={(e) => set('stock', e.target.value)} />
        </Campo>
        <Campo label="Avisar cuando queden" ayuda="Alerta de reposición">
          <input type="number" inputMode="decimal" min={0} value={f.stockMinimo} onChange={(e) => set('stockMinimo', e.target.value)} />
        </Campo>
      </div>
      {f.unidad === 'und' && (
        <div className="bloque">
          <span className="campo-label">Precios por paquete (opcional)</span>
          {paquetes.map((q, i) => (
            <div key={i} className="fila-paquete">
              <input type="text" placeholder="Six-pack" value={q.nombre} onChange={(e) => setPaquetes((a) => a.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))} aria-label="Nombre del paquete" />
              <input type="number" inputMode="numeric" placeholder="6" min={2} value={q.cantidad} onChange={(e) => setPaquetes((a) => a.map((x, j) => (j === i ? { ...x, cantidad: e.target.value } : x)))} aria-label="Unidades por paquete" />
              <input type="number" inputMode="decimal" placeholder="S/" step="0.1" min={0} value={q.precio} onChange={(e) => setPaquetes((a) => a.map((x, j) => (j === i ? { ...x, precio: e.target.value } : x)))} aria-label="Precio del paquete" />
              <button type="button" className="btn-icono chico" aria-label="Quitar paquete" onClick={() => setPaquetes((a) => a.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          {paquetes.length < 3 && <button type="button" className="btn-enlace" onClick={() => setPaquetes((a) => [...a, { nombre: '', cantidad: '', precio: '' }])}>+ Agregar paquete (six-pack, docena, caja)</button>}
          {paquetesValidos.length > 0 && venta > 0 && (
            <p className="nota">{paquetesValidos.map((q) => `${q.nombre}: ${soles(q.precio)} (${soles(q.precio / q.cantidad)} c/u, ${q.precio / q.cantidad < venta ? 'más barato' : 'igual o más caro'} que suelto)`).join(' · ')}</p>
          )}
        </div>
      )}
      <Campo label="Código de barras (opcional)" ayuda="Escanéalo con la cámara o un lector">
        <div className="buscador con-boton">
          <input type="text" inputMode="numeric" value={f.codigoBarras} onChange={(e) => set('codigoBarras', e.target.value)} />
          <button type="button" className="btn-secundario btn-cuadrado" aria-label="Escanear código" onClick={() => setEscaneando(true)}>📷</button>
        </div>
      </Campo>
      {escaneando && <Escaner onCodigo={(c) => { set('codigoBarras', c); setEscaneando(false) }} onCerrar={() => setEscaneando(false)} />}
      {error && <p className="texto-peligro">{error}</p>}
      {producto && <Kardex productoId={producto.id} unidad={producto.unidad} />}
      <div className="acciones">
        {producto && <button className="btn-peligro" onClick={desactivar}>Quitar</button>}
        <button className="btn-primario" onClick={guardar}>Guardar</button>
      </div>
    </Modal>
  )
}

function Ingreso({ producto, onCerrar, onHecho }: { producto: Producto; onCerrar: () => void; onHecho: (m: string) => void }) {
  const [cant, setCant] = useState('')
  const [costo, setCosto] = useState(String(producto.precioCompra))
  const n = Number(cant) || 0
  async function guardar() {
    if (n <= 0) return
    await ingresarMercaderia(producto.id, n, Number(costo) || undefined)
    onHecho(`Ingresaste ${n} ${producto.unidad} de ${producto.nombre}`)
  }
  return (
    <Modal titulo={`Ingresar: ${producto.nombre}`} onCerrar={onCerrar}>
      <p className="nota">Tienes ahora <strong>{producto.stock} {producto.unidad}</strong>.</p>
      <Campo label={`¿Cuánto llegó? (${producto.unidad})`}>
        <input autoFocus type="number" inputMode="decimal" min={0} value={cant} onChange={(e) => setCant(e.target.value)} />
      </Campo>
      <Campo label="¿A qué precio te lo dejaron? (S/ por unidad)" ayuda="Si subió el precio, actualízalo aquí">
        <input type="number" inputMode="decimal" step="0.1" min={0} value={costo} onChange={(e) => setCosto(e.target.value)} />
      </Campo>
      {n > 0 && <p className="nota">Quedará con <strong>{redondear(producto.stock + n)} {producto.unidad}</strong>. Inversión: {soles(n * (Number(costo) || 0))}.</p>}
      <button className="btn-primario grande ancho" disabled={n <= 0} onClick={guardar}>Registrar ingreso</button>
    </Modal>
  )
}

const TIPO_MOV: Record<string, string> = { venta: 'Venta', ingreso: 'Ingreso', ajuste: 'Ajuste', merma: 'Merma' }

/** Historial de movimientos de un producto: responde "¿por qué tengo 3 si ayer tenía 10?". */
function Kardex({ productoId, unidad }: { productoId: string; unidad: Unidad }) {
  const movs = useLiveQuery(() => db.movimientosStock.where('productoId').equals(productoId).reverse().sortBy('fecha'), [productoId]) ?? []
  if (movs.length === 0) return null
  return (
    <>
      <h3 className="subtitulo">Últimos movimientos</h3>
      <ul className="historial">
        {movs.slice(0, 8).map((m) => (
          <li key={m.id}>
            <div><strong>{TIPO_MOV[m.tipo] ?? m.tipo}</strong><span className="item-sub">{fechaCorta(m.fecha)} {hora(m.fecha)}{m.nota ? ` · ${m.nota}` : ''}</span></div>
            <span className={m.cantidad < 0 ? 'texto-peligro' : 'texto-ok'}>{m.cantidad > 0 ? '+' : ''}{m.cantidad} {unidad}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

/** Lista de precios con dibujos: para mandar por WhatsApp o pegar impresa en la pared. */
function ListaPrecios({ productos, nombreBodega, onCerrar, avisar }: { productos: Producto[]; nombreBodega: string; onCerrar: () => void; avisar: (m: string) => void }) {
  const texto = textoListaPrecios(productos, nombreBodega, (p) => p.emoji || emojiPara(p.nombre, p.categoria))
  const orden = [...productos].sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre))
  let cat = ''
  return (
    <Modal titulo="Lista de precios" onCerrar={onCerrar}>
      <div className="acciones">
        <a className="btn-whatsapp" style={{ flex: 1, marginTop: 0 }} href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer">💬 WhatsApp</a>
        <button className="btn-secundario" onClick={() => window.print()}>🖨️ Imprimir</button>
        <button className="btn-secundario" onClick={async () => { try { await navigator.clipboard.writeText(texto); avisar('Lista copiada') } catch { avisar('No se pudo copiar') } }}>Copiar</button>
      </div>
      <div className="imprimible lista-precios">
        <h2>{nombreBodega || 'Lista de precios'}</h2>
        <table>
          <tbody>
            {orden.map((p) => {
              const nuevaCat = p.categoria !== cat
              cat = p.categoria
              return (
                <Fragment key={p.id}>
                  {nuevaCat && <tr className="lp-cat"><td colSpan={2}>{p.categoria}</td></tr>}
                  <tr>
                    <td><IconoProducto p={p} tam={28} /> {p.nombre}{p.unidad === 'kg' ? ' (kilo)' : ''}</td>
                    <td className="lp-precio">{soles(p.precioVenta)}</td>
                  </tr>
                  {(p.paquetes ?? []).map((q) => (
                    <tr key={q.nombre} className="lp-paquete"><td>　{q.nombre} (x{q.cantidad})</td><td className="lp-precio">{soles(q.precio)}</td></tr>
                  ))}
                </Fragment>
              )
            })}
          </tbody>
        </table>
        <p className="nota">Precios sujetos a cambio. ¡Gracias por su preferencia!</p>
      </div>
    </Modal>
  )
}
