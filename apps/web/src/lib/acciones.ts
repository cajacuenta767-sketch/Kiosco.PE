import { db, type CategoriaGasto, type Gasto, type ItemVenta, type MetodoPago, type Producto, type Venta } from '../db/db'
import { hoyISO, redondear } from '@kiosco/shared'

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
    nombre: descripcion.trim() || 'Venta rápida',
    categoria: 'Otros',
    precioVenta: redondear(monto),
    precioCompra: redondear(costo),
    stock: 0,
    stockMinimo: 0,
    unidad: 'und',
    activo: true,
    creadoEn: new Date().toISOString(),
  }
  return { clave: `libre-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, producto, cantidad: 1 }
}

export function totalCarrito(lineas: LineaCarrito[]): number {
  return redondear(lineas.reduce((s, l) => s + l.producto.precioVenta * l.cantidad, 0))
}

/** Registra una venta: guarda la venta, descuenta stock y anota el fiado si aplica. Todo en una transacción. */
export async function registrarVenta(opts: {
  lineas: LineaCarrito[]
  metodoPago: MetodoPago
  clienteId?: number
  pagoCon?: number
}): Promise<number> {
  const { lineas, metodoPago, clienteId, pagoCon } = opts
  if (lineas.length === 0) throw new Error('El carrito está vacío')
  if (metodoPago === 'fiado' && !clienteId) throw new Error('Elige a quién le fías')

  const fecha = new Date().toISOString()
  const items: ItemVenta[] = lineas.map((l) => ({
    productoId: l.producto.id ?? 0,
    nombre: l.producto.nombre,
    cantidad: l.cantidad,
    precio: l.producto.precioVenta,
    costo: l.producto.precioCompra,
  }))
  const total = totalCarrito(lineas)
  const costoTotal = redondear(items.reduce((s, i) => s + i.costo * i.cantidad, 0))
  const vuelto = metodoPago === 'efectivo' && pagoCon != null ? redondear(pagoCon - total) : undefined

  const venta: Venta = {
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

  return db.transaction('rw', [db.ventas, db.productos, db.movimientosStock, db.movimientosFiado], async () => {
    const ventaId = (await db.ventas.add(venta)) as number
    for (const l of lineas) {
      if (!l.producto.id) continue // venta rápida: no toca stock
      const p = await db.productos.get(l.producto.id)
      if (!p) continue
      await db.productos.update(p.id!, { stock: redondear(p.stock - l.cantidad) })
      await db.movimientosStock.add({ productoId: p.id!, fecha, tipo: 'venta', cantidad: -l.cantidad, nota: `Venta #${ventaId}` })
    }
    if (metodoPago === 'fiado' && clienteId) {
      await db.movimientosFiado.add({ clienteId, fecha, tipo: 'fiado', monto: total, ventaId, nota: items.map((i) => `${i.cantidad} ${i.nombre}`).join(', ') })
    }
    return ventaId
  })
}

export async function ingresarMercaderia(productoId: number, cantidad: number, nuevoCosto?: number) {
  await db.transaction('rw', [db.productos, db.movimientosStock], async () => {
    const p = await db.productos.get(productoId)
    if (!p) return
    const cambios: Partial<Producto> = { stock: redondear(p.stock + cantidad) }
    if (nuevoCosto != null && nuevoCosto > 0) cambios.precioCompra = nuevoCosto
    await db.productos.update(productoId, cambios)
    await db.movimientosStock.add({ productoId, fecha: new Date().toISOString(), tipo: 'ingreso', cantidad, nota: 'Ingreso de mercadería' })
  })
}

export async function ajustarStock(productoId: number, stockReal: number, motivo: 'ajuste' | 'merma') {
  await db.transaction('rw', [db.productos, db.movimientosStock], async () => {
    const p = await db.productos.get(productoId)
    if (!p) return
    const diff = redondear(stockReal - p.stock)
    if (diff === 0) return
    await db.productos.update(productoId, { stock: stockReal })
    await db.movimientosStock.add({ productoId, fecha: new Date().toISOString(), tipo: motivo, cantidad: diff, nota: motivo === 'merma' ? 'Merma / vencido' : 'Conteo físico' })
  })
}

export async function registrarAbono(clienteId: number, monto: number, nota?: string) {
  if (monto <= 0) throw new Error('El abono debe ser mayor a cero')
  await db.movimientosFiado.add({ clienteId, fecha: new Date().toISOString(), tipo: 'abono', monto: redondear(monto), nota })
}

export async function registrarGasto(g: { monto: number; categoria: CategoriaGasto; nota?: string; deCaja: boolean }) {
  if (g.monto <= 0) throw new Error('El gasto debe ser mayor a cero')
  const gasto: Gasto = { fecha: new Date().toISOString(), dia: hoyISO(), monto: redondear(g.monto), categoria: g.categoria, nota: g.nota?.trim() || undefined, deCaja: g.deCaja }
  await db.gastos.add(gasto)
}

export async function exportarBackup(): Promise<string> {
  const data = {
    app: 'kiosco-pe',
    version: 1,
    exportadoEn: new Date().toISOString(),
    productos: await db.productos.toArray(),
    ventas: await db.ventas.toArray(),
    clientes: await db.clientes.toArray(),
    movimientosFiado: await db.movimientosFiado.toArray(),
    movimientosStock: await db.movimientosStock.toArray(),
    cierres: await db.cierres.toArray(),
    gastos: await db.gastos.toArray(),
    config: await db.config.toArray(),
  }
  return JSON.stringify(data, null, 2)
}

export async function importarBackup(json: string) {
  const data = JSON.parse(json)
  if (data?.app !== 'kiosco-pe') throw new Error('Este archivo no es un respaldo de Kiosco.PE')
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
    await db.productos.bulkAdd(data.productos ?? [])
    await db.ventas.bulkAdd(data.ventas ?? [])
    await db.clientes.bulkAdd(data.clientes ?? [])
    await db.movimientosFiado.bulkAdd(data.movimientosFiado ?? [])
    await db.movimientosStock.bulkAdd(data.movimientosStock ?? [])
    await db.cierres.bulkAdd(data.cierres ?? [])
    await db.gastos.bulkAdd(data.gastos ?? [])
    await db.config.bulkAdd(data.config ?? [])
  })
}

export async function borrarTodo() {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
  })
}
