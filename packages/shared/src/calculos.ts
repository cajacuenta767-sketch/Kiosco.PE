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
export function unidadesVendidas(ventas: Venta[]): Map<string, number> {
  const m = new Map<string, number>()
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
    const porDia = (vendido.get(p.id) ?? 0) / 14
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

/** Texto de comprobante simple para enviar por WhatsApp o imprimir. */
export function textoComprobante(v: Venta, nombreBodega: string, etiquetaMetodo: string): string {
  const filas = v.items.map((i) => `${i.cantidad} × ${i.nombre}  S/ ${(i.precio * i.cantidad).toFixed(2)}`).join('\n')
  const fecha = new Date(v.fecha).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const vuelto = v.vuelto != null && v.vuelto > 0 ? `\nPagó con S/ ${v.pagoCon!.toFixed(2)} · Vuelto S/ ${v.vuelto.toFixed(2)}` : ''
  return `${nombreBodega || 'Kiosco.PE'}\n${fecha}\n\n${filas}\n\nTOTAL S/ ${v.total.toFixed(2)} (${etiquetaMetodo})${vuelto}\n\n¡Gracias por su compra!`
}

/** Los pagos a proveedores reponen mercadería: ya están descontados como costo en cada venta. No bajan la ganancia, pero sí salen de la caja. */
export function gastosOperativos(gastos: { monto: number; categoria?: string }[]): number {
  return redondear(gastos.filter((g) => g.categoria !== 'proveedor').reduce((s, g) => s + g.monto, 0))
}

export interface ResumenMes {
  mes: string // YYYY-MM
  vendido: number
  gananciaBruta: number
  gastos: number // todo lo que salió, incluidos proveedores
  pagosProveedor: number
  gananciaNeta: number // bruta menos gastos que no son mercadería
  numVentas: number
  diasConVenta: number
  promedioDiario: number
  mejorDia: { dia: string; total: number } | null
  fiado: number
  cobradoFiado: number
  topProductos: { nombre: string; cantidad: number; total: number }[]
}

export function resumirMes(mes: string, ventas: Venta[], gastos: { monto: number; dia: string; categoria?: string }[], movsFiado: { tipo: 'fiado' | 'abono'; monto: number; fecha: string }[]): ResumenMes {
  const vm = ventas.filter((v) => v.dia.startsWith(mes))
  const gm = gastos.filter((g) => g.dia.startsWith(mes))
  const fm = movsFiado.filter((m) => m.fecha.startsWith(mes))
  const porDia = new Map<string, number>()
  const top = new Map<string, { nombre: string; cantidad: number; total: number }>()
  let vendido = 0
  let gananciaBruta = 0
  for (const v of vm) {
    vendido += v.total
    gananciaBruta += v.total - v.costoTotal
    porDia.set(v.dia, (porDia.get(v.dia) ?? 0) + v.total)
    for (const i of v.items) {
      const t = top.get(i.nombre) ?? { nombre: i.nombre, cantidad: 0, total: 0 }
      t.cantidad += i.cantidad
      t.total += i.precio * i.cantidad
      top.set(i.nombre, t)
    }
  }
  const totalGastos = gm.reduce((s, g) => s + g.monto, 0)
  const operativos = gastosOperativos(gm)
  const mejor = [...porDia.entries()].sort((a, b) => b[1] - a[1])[0]
  return {
    mes,
    vendido: redondear(vendido),
    gananciaBruta: redondear(gananciaBruta),
    gastos: redondear(totalGastos),
    pagosProveedor: redondear(totalGastos - operativos),
    gananciaNeta: redondear(gananciaBruta - operativos),
    numVentas: vm.length,
    diasConVenta: porDia.size,
    promedioDiario: porDia.size ? redondear(vendido / porDia.size) : 0,
    mejorDia: mejor ? { dia: mejor[0], total: redondear(mejor[1]) } : null,
    fiado: redondear(fm.filter((m) => m.tipo === 'fiado').reduce((s, m) => s + m.monto, 0)),
    cobradoFiado: redondear(fm.filter((m) => m.tipo === 'abono').reduce((s, m) => s + m.monto, 0)),
    topProductos: [...top.values()].sort((a, b) => b.total - a.total).slice(0, 5),
  }
}

/**
 * "Lo de siempre" de un cliente: los productos que se lleva en al menos la mitad de sus últimas compras,
 * con la cantidad más habitual. Si compró pocas veces, es su última compra.
 */
export function loDeSiempre(ventasCliente: Venta[], maximo = 10): { productoId: string; nombre: string; cantidad: number }[] {
  const ultimas = [...ventasCliente].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, maximo)
  if (ultimas.length === 0) return []
  if (ultimas.length < 3) return ultimas[0].items.filter((i) => i.productoId).map((i) => ({ productoId: i.productoId, nombre: i.nombre, cantidad: i.cantidad }))
  const veces = new Map<string, { nombre: string; cantidades: number[] }>()
  for (const v of ultimas) {
    const vistos = new Set<string>()
    for (const i of v.items) {
      if (!i.productoId || vistos.has(i.productoId)) continue
      vistos.add(i.productoId)
      const e = veces.get(i.productoId) ?? { nombre: i.nombre, cantidades: [] }
      e.cantidades.push(i.cantidad)
      veces.set(i.productoId, e)
    }
  }
  const minimo = Math.ceil(ultimas.length / 2)
  const resultado: { productoId: string; nombre: string; cantidad: number }[] = []
  for (const [productoId, e] of veces) {
    if (e.cantidades.length < minimo) continue
    const orden = [...e.cantidades].sort((a, b) => a - b)
    resultado.push({ productoId, nombre: e.nombre, cantidad: orden[Math.floor(orden.length / 2)] })
  }
  if (resultado.length === 0) return ultimas[0].items.filter((i) => i.productoId).map((i) => ({ productoId: i.productoId, nombre: i.nombre, cantidad: i.cantidad }))
  return resultado.sort((a, b) => a.nombre.localeCompare(b.nombre))
}

/** Lista de precios en texto, agrupada por categoría, lista para WhatsApp. */
export function textoListaPrecios(productos: Producto[], nombreBodega: string, emojiDe: (p: Producto) => string): string {
  const activos = productos.filter((p) => p.activo).sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre))
  const lineas: string[] = [`📋 *${nombreBodega || 'Lista de precios'}*`, '']
  let cat = ''
  for (const p of activos) {
    if (p.categoria !== cat) {
      cat = p.categoria
      lineas.push(`*${cat.toUpperCase()}*`)
    }
    lineas.push(`${emojiDe(p)} ${p.nombre} — S/ ${p.precioVenta.toFixed(2)}${p.unidad === 'kg' ? ' el kilo' : ''}`)
    for (const q of p.paquetes ?? []) lineas.push(`    ${q.nombre} (x${q.cantidad}) — S/ ${q.precio.toFixed(2)}`)
  }
  lineas.push('', 'Precios sujetos a cambio. ¡Gracias por su preferencia!')
  return lineas.join('\n')
}
