import { db, type ItemVenta, type MetodoPago, type Producto, type Venta } from '../db/db'
import { hoyISO, redondear } from './format'

export interface LineaCarrito {
  producto: Producto
  cantidad: number
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
    productoId: l.producto.id!,
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
      const p = await db.productos.get(l.producto.id!)
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

export function deudaDe(movs: { tipo: 'fiado' | 'abono'; monto: number }[]): number {
  return redondear(movs.reduce((s, m) => s + (m.tipo === 'fiado' ? m.monto : -m.monto), 0))
}

export interface ResumenDia {
  dia: string
  totalVentas: number
  ganancia: number
  numVentas: number
  porMetodo: Record<MetodoPago, number>
  topProductos: { nombre: string; cantidad: number; total: number }[]
}

export function resumirVentas(ventas: Venta[], dia: string): ResumenDia {
  const porMetodo: Record<MetodoPago, number> = { efectivo: 0, yape: 0, plin: 0, tarjeta: 0, fiado: 0 }
  const top = new Map<string, { nombre: string; cantidad: number; total: number }>()
  let totalVentas = 0
  let ganancia = 0
  for (const v of ventas) {
    totalVentas += v.total
    ganancia += v.total - v.costoTotal
    porMetodo[v.metodoPago] += v.total
    for (const i of v.items) {
      const t = top.get(i.nombre) ?? { nombre: i.nombre, cantidad: 0, total: 0 }
      t.cantidad += i.cantidad
      t.total += i.precio * i.cantidad
      top.set(i.nombre, t)
    }
  }
  return {
    dia,
    totalVentas: redondear(totalVentas),
    ganancia: redondear(ganancia),
    numVentas: ventas.length,
    porMetodo,
    topProductos: [...top.values()].sort((a, b) => b.total - a.total).slice(0, 5),
  }
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
    await db.config.bulkAdd(data.config ?? [])
  })
}

export async function borrarTodo() {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
  })
}

export const METODOS: { id: MetodoPago; label: string; icono: string }[] = [
  { id: 'efectivo', label: 'Efectivo', icono: '💵' },
  { id: 'yape', label: 'Yape', icono: '📱' },
  { id: 'plin', label: 'Plin', icono: '📲' },
  { id: 'tarjeta', label: 'Tarjeta', icono: '💳' },
  { id: 'fiado', label: 'Fiado', icono: '📒' },
]

export const CATEGORIAS = ['Bebidas', 'Abarrotes', 'Golosinas', 'Snacks', 'Panadería', 'Limpieza', 'Cuidado personal', 'Otros']
