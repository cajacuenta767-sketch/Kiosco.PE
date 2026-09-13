import { db, type CategoriaGasto, type CierreCaja, type Cliente, type Gasto, type ItemVenta, type MetodoPago, type Producto, type Venta } from '../db/db'
import { borrar, poner } from '../db/repo'
import { ahoraISO, hoyISO, redondear, uuid } from '@kiosco/shared'

export { CATEGORIAS, CATEGORIAS_GASTO, METODOS, deudaDe, diasAtras, pedidoSugerido, resumirVentas, textoPedido, unidadesVendidas } from '@kiosco/shared'
export type { LineaPedido, ResumenDia } from '@kiosco/shared'

export interface LineaCarrito {
  clave: string
  producto: Producto
  cantidad: number
}

/** Crea una línea de venta rápida: un monto libre que no está en el catálogo. */
export function lineaLibre(monto: number, descripcion: string, costo = 0): LineaCarrito {
  const producto: Producto = {
    id: '',
    actualizadoEn: '',
    nombre: descripcion.trim() || 'Venta rápida',
    categoria: 'Otros',
    precioVenta: redondear(monto),
    precioCompra: redondear(costo),
    stock: 0,
    stockMinimo: 0,
    unidad: 'und',
    activo: true,
    creadoEn: ahoraISO(),
  }
  return { clave: `libre-${uuid()}`, producto, cantidad: 1 }
}

export function totalCarrito(lineas: LineaCarrito[]): number {
  return redondear(lineas.reduce((s, l) => s + l.producto.precioVenta * l.cantidad, 0))
}

const TABLAS_VENTA = () => [db.ventas, db.productos, db.movimientosStock, db.movimientosFiado, db.cola]

/** Registra una venta: guarda la venta, descuenta stock y anota el fiado si aplica. Todo en una transacción. */
export async function registrarVenta(opts: { lineas: LineaCarrito[]; metodoPago: MetodoPago; clienteId?: string; pagoCon?: number }): Promise<string> {
  const { lineas, metodoPago, clienteId, pagoCon } = opts
  if (lineas.length === 0) throw new Error('El carrito está vacío')
  if (metodoPago === 'fiado' && !clienteId) throw new Error('Elige a quién le fías')

  const fecha = ahoraISO()
  const items: ItemVenta[] = lineas.map((l) => ({ productoId: l.producto.id, nombre: l.producto.nombre, cantidad: l.cantidad, precio: l.producto.precioVenta, costo: l.producto.precioCompra }))
  const total = totalCarrito(lineas)
  const costoTotal = redondear(items.reduce((s, i) => s + i.costo * i.cantidad, 0))
  const vuelto = metodoPago === 'efectivo' && pagoCon != null ? redondear(pagoCon - total) : undefined
  const venta: Venta = {
    id: uuid(),
    actualizadoEn: fecha,
    fecha,
    dia: hoyISO(),
    items,
    total,
    costoTotal,
    metodoPago,
    clienteId: metodoPago === 'fiado' ? clienteId : undefined,
    pagoCon: metodoPago === 'efectivo' ? pagoCon : undefined,
    vuelto,
  }

  return db.transaction('rw', TABLAS_VENTA(), async () => {
    await poner('ventas', venta)
    for (const l of lineas) {
      if (!l.producto.id) continue // venta rápida: no toca stock
      await moverStock(l.producto.id, -l.cantidad, 'venta', `Venta ${venta.id.slice(0, 8)}`, fecha)
    }
    if (metodoPago === 'fiado' && clienteId) {
      await poner('movimientosFiado', { id: uuid(), actualizadoEn: fecha, clienteId, fecha, tipo: 'fiado', monto: total, ventaId: venta.id, nota: items.map((i) => `${i.cantidad} ${i.nombre}`).join(', ') })
    }
    return venta.id
  })
}

/** Anula una venta: el stock vuelve y el fiado asociado se borra. */
export async function anularVenta(v: Venta) {
  await db.transaction('rw', TABLAS_VENTA(), async () => {
    const fecha = ahoraISO()
    for (const i of v.items) {
      if (!i.productoId) continue
      await moverStock(i.productoId, i.cantidad, 'ajuste', `Anulación venta ${v.id.slice(0, 8)}`, fecha)
    }
    const fiados = await db.movimientosFiado.where('ventaId').equals(v.id).toArray()
    for (const f of fiados) await borrar('movimientosFiado', f.id)
    await borrar('ventas', v.id)
  })
}

/** Cambia el stock de un producto y deja el movimiento. Debe llamarse dentro de una transacción. */
async function moverStock(productoId: string, cantidad: number, tipo: 'venta' | 'ingreso' | 'ajuste' | 'merma', nota: string, fecha = ahoraISO(), cambiosProducto: Partial<Producto> = {}) {
  const p = await db.productos.get(productoId)
  if (!p) return
  await poner('productos', { ...p, ...cambiosProducto, stock: redondear(p.stock + cantidad), actualizadoEn: fecha })
  await poner('movimientosStock', { id: uuid(), actualizadoEn: fecha, productoId, fecha, tipo, cantidad, nota })
}

export async function ingresarMercaderia(productoId: string, cantidad: number, nuevoCosto?: number) {
  await db.transaction('rw', [db.productos, db.movimientosStock, db.cola], async () => {
    await moverStock(productoId, cantidad, 'ingreso', 'Ingreso de mercadería', ahoraISO(), nuevoCosto != null && nuevoCosto > 0 ? { precioCompra: nuevoCosto } : {})
  })
}

export async function ajustarStock(productoId: string, stockReal: number, motivo: 'ajuste' | 'merma') {
  await db.transaction('rw', [db.productos, db.movimientosStock, db.cola], async () => {
    const p = await db.productos.get(productoId)
    if (!p) return
    const diff = redondear(stockReal - p.stock)
    if (diff === 0) return
    await moverStock(productoId, diff, motivo, motivo === 'merma' ? 'Merma / vencido' : 'Conteo físico')
  })
}

/** Crea o edita un producto. Si es nuevo con stock, registra el stock inicial como ingreso. */
export async function guardarProducto(datos: Omit<Producto, 'id' | 'actualizadoEn' | 'creadoEn'>, existente?: Producto): Promise<Producto> {
  return db.transaction('rw', [db.productos, db.movimientosStock, db.cola], async () => {
    const fecha = ahoraISO()
    if (existente) {
      const stockAnterior = existente.stock
      const p = await poner('productos', { ...existente, ...datos, stock: stockAnterior, actualizadoEn: fecha })
      if (stockAnterior !== datos.stock) await moverStock(p.id, redondear(datos.stock - stockAnterior), 'ajuste', 'Conteo físico', fecha)
      return (await db.productos.get(p.id))!
    }
    const p = await poner('productos', { ...datos, id: uuid(), actualizadoEn: fecha, creadoEn: fecha, stock: 0 })
    if (datos.stock > 0) await moverStock(p.id, datos.stock, 'ingreso', 'Stock inicial', fecha)
    return (await db.productos.get(p.id))!
  })
}

export async function desactivarProducto(p: Producto) {
  await db.transaction('rw', [db.productos, db.cola], async () => {
    await poner('productos', { ...p, activo: false, actualizadoEn: ahoraISO() })
  })
}

export async function guardarCliente(datos: { nombre: string; telefono?: string; nota?: string; pagaEl?: string }, existente?: Cliente): Promise<Cliente> {
  return db.transaction('rw', [db.clientes, db.cola], async () => {
    const fecha = ahoraISO()
    if (existente) return poner('clientes', { ...existente, ...datos, actualizadoEn: fecha })
    return poner('clientes', { ...datos, id: uuid(), actualizadoEn: fecha, creadoEn: fecha })
  })
}

export async function registrarAbono(clienteId: string, monto: number, nota?: string) {
  if (monto <= 0) throw new Error('El abono debe ser mayor a cero')
  await db.transaction('rw', [db.movimientosFiado, db.cola], async () => {
    const fecha = ahoraISO()
    await poner('movimientosFiado', { id: uuid(), actualizadoEn: fecha, clienteId, fecha, tipo: 'abono', monto: redondear(monto), nota })
  })
}

export async function registrarGasto(g: { monto: number; categoria: CategoriaGasto; nota?: string; deCaja: boolean }) {
  if (g.monto <= 0) throw new Error('El gasto debe ser mayor a cero')
  await db.transaction('rw', [db.gastos, db.cola], async () => {
    const fecha = ahoraISO()
    const gasto: Gasto = { id: uuid(), actualizadoEn: fecha, fecha, dia: hoyISO(), monto: redondear(g.monto), categoria: g.categoria, nota: g.nota?.trim() || undefined, deCaja: g.deCaja }
    await poner('gastos', gasto)
  })
}

export async function eliminarGasto(id: string) {
  await db.transaction('rw', [db.gastos, db.cola], async () => borrar('gastos', id))
}

export async function cerrarCaja(c: Omit<CierreCaja, 'id' | 'actualizadoEn' | 'fecha'>) {
  await db.transaction('rw', [db.cierres, db.cola], async () => {
    const fecha = ahoraISO()
    await poner('cierres', { ...c, id: uuid(), actualizadoEn: fecha, fecha })
  })
}

export async function guardarNombreBodega(nombre: string) {
  await db.transaction('rw', [db.config, db.cola], async () => {
    await poner('config', { key: 'nombreBodega', value: nombre.trim() })
  })
}

export async function exportarBackup(): Promise<string> {
  const data = {
    app: 'kiosco-pe',
    version: 2,
    exportadoEn: ahoraISO(),
    productos: await db.productos.toArray(),
    ventas: await db.ventas.toArray(),
    clientes: await db.clientes.toArray(),
    movimientosFiado: await db.movimientosFiado.toArray(),
    movimientosStock: await db.movimientosStock.toArray(),
    cierres: await db.cierres.toArray(),
    gastos: await db.gastos.toArray(),
    config: (await db.config.toArray()).filter((c) => !c.key.startsWith('nube.')),
  }
  return JSON.stringify(data, null, 2)
}

export async function importarBackup(json: string) {
  const data = JSON.parse(json)
  if (data?.app !== 'kiosco-pe') throw new Error('Este archivo no es un respaldo de Kiosco.PE')
  if (data.version !== 2) throw new Error('Este respaldo es de una versión anterior. Ábrelo en esa versión y vuelve a exportarlo.')
  await db.transaction('rw', db.tables, async () => {
    const nube = (await db.config.toArray()).filter((c) => c.key.startsWith('nube.'))
    await Promise.all(db.tables.map((t) => t.clear()))
    await db.productos.bulkAdd(data.productos ?? [])
    await db.ventas.bulkAdd(data.ventas ?? [])
    await db.clientes.bulkAdd(data.clientes ?? [])
    await db.movimientosFiado.bulkAdd(data.movimientosFiado ?? [])
    await db.movimientosStock.bulkAdd(data.movimientosStock ?? [])
    await db.cierres.bulkAdd(data.cierres ?? [])
    await db.gastos.bulkAdd(data.gastos ?? [])
    await db.config.bulkAdd([...(data.config ?? []), ...nube])
  })
}

export async function borrarTodo() {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
  })
}
