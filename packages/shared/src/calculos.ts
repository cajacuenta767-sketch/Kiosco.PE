import type { MetodoPago, Producto, Venta } from './tipos.ts'
import { aDia, redondear } from './format.ts'

/** Deuda actual de un cliente: fiados menos abonos. Nunca se guarda, siempre se calcula. */
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

/** Unidades vendidas por producto. */
export function unidadesVendidas(ventas: Venta[]): Map<number, number> {
  const m = new Map<number, number>()
  for (const v of ventas) for (const i of v.items) if (i.productoId) m.set(i.productoId, (m.get(i.productoId) ?? 0) + i.cantidad)
  return m
}

export function diasAtras(n: number, desde = new Date()): string {
  const d = new Date(desde)
  d.setDate(d.getDate() - n)
  return aDia(d)
}

export interface LineaPedido {
  producto: Producto
  vendidoPorSemana: number
  diasDeStock: number | null
  sugerido: number
  costo: number
}

/**
 * Pedido sugerido: qué reponer y cuánto, según lo vendido en los últimos 14 días.
 * Objetivo: cubrir una semana de ventas y nunca bajar del doble del mínimo.
 */
export function pedidoSugerido(productos: Producto[], ventas14: Venta[]): LineaPedido[] {
  const vendido = unidadesVendidas(ventas14)
  const lineas: LineaPedido[] = []
  for (const p of productos) {
    if (!p.activo) continue
    const porDia = (vendido.get(p.id!) ?? 0) / 14
    const porSemana = porDia * 7
    const diasDeStock = porDia > 0 ? p.stock / porDia : null
    const objetivo = Math.max(porSemana, p.stockMinimo * 2)
    const necesita = p.stock <= p.stockMinimo || (diasDeStock !== null && diasDeStock < 7)
    if (!necesita) continue
    const sugerido = Math.max(1, Math.ceil(objetivo - p.stock))
    lineas.push({ producto: p, vendidoPorSemana: redondear(porSemana), diasDeStock, sugerido, costo: redondear(sugerido * p.precioCompra) })
  }
  return lineas.sort((a, b) => (a.diasDeStock ?? 999) - (b.diasDeStock ?? 999))
}

export function textoPedido(lineas: LineaPedido[], nombreBodega: string): string {
  const filas = lineas.map((l) => `• ${l.sugerido} ${l.producto.unidad} ${l.producto.nombre}`).join('\n')
  return `Pedido de ${nombreBodega || 'mi bodega'}:\n${filas}\n\nGracias.`
}
