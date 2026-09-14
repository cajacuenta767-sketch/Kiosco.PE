import type { MetodoPago, MovimientoStock, Producto, Venta } from './tipos.ts'
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

export interface LineaVendida {
  nombre: string
  cantidad: number
  /** Unidad: 'kg' si algún ítem se vendió por kilo (solo para mostrar). */
  total: number
  ganancia: number
}

export interface DetalleVendido {
  productos: LineaVendida[]
  unidades: number
  total: number
  ganancia: number
}

/** Todo lo vendido en un conjunto de ventas, producto por producto, de mayor a menor plata. */
export function detalleVendido(ventas: Venta[]): DetalleVendido {
  const m = new Map<string, LineaVendida>()
  let unidades = 0
  for (const v of ventas) {
    for (const i of v.items) {
      const l = m.get(i.nombre) ?? { nombre: i.nombre, cantidad: 0, total: 0, ganancia: 0 }
      l.cantidad = redondear(l.cantidad + i.cantidad)
      l.total = redondear(l.total + i.precio * i.cantidad)
      l.ganancia = redondear(l.ganancia + (i.precio - i.costo) * i.cantidad)
      m.set(i.nombre, l)
      unidades += i.cantidad
    }
  }
  const productos = [...m.values()].sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre))
  return {
    productos,
    unidades: redondear(unidades),
    total: redondear(productos.reduce((s, l) => s + l.total, 0)),
    ganancia: redondear(productos.reduce((s, l) => s + l.ganancia, 0)),
  }
}

/** Texto para WhatsApp con todo lo vendido de un día. */
export function textoDetalleVendido(nombreBodega: string, etiquetaDia: string, d: DetalleVendido): string {
  const fmt = (n: number) => `S/ ${n.toFixed(2)}`
  return [
    `🧾 ${nombreBodega || 'Mi bodega'} · lo vendido ${etiquetaDia}`,
    '',
    ...d.productos.map((l) => `• ${l.cantidad} ${l.nombre} — ${fmt(l.total)}`),
    '',
    `Total: ${fmt(d.total)} · ${d.productos.length} ${d.productos.length === 1 ? 'producto' : 'productos'}`,
  ].join('\n')
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
  return `${nombreBodega || 'Sencillo'}\n${fecha}\n\n${filas}\n\nTOTAL S/ ${v.total.toFixed(2)} (${etiquetaMetodo})${vuelto}\n\n¡Gracias por su compra!`
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

export interface LoteVencimiento {
  producto: Producto
  vence: string
  diasParaVencer: number // negativo si ya venció
  cantidadEstimada: number // unidades del lote que quedarían, asumiendo que sale primero lo más antiguo
}

/**
 * Lotes con fecha de vencimiento que aún tienen unidades y vencen dentro de `dias` (o ya vencieron).
 * Estimación PEPS: lo que salió después de un ingreso consume primero los lotes más antiguos.
 */
export function lotesPorVencer(productos: Producto[], movimientos: MovimientoStock[], hoy: string, dias = 7): LoteVencimiento[] {
  const porProducto = new Map<string, MovimientoStock[]>()
  for (const m of movimientos) {
    const arr = porProducto.get(m.productoId) ?? []
    arr.push(m)
    porProducto.set(m.productoId, arr)
  }
  const resultado: LoteVencimiento[] = []
  const [y, mo, d] = hoy.split('-').map(Number)
  const hoyMs = Date.UTC(y, mo - 1, d)
  for (const p of productos) {
    if (!p.activo) continue
    const movs = (porProducto.get(p.id) ?? []).slice().sort((a, b) => a.fecha.localeCompare(b.fecha))
    // Recorremos en orden: cada salida consume de los lotes más antiguos que queden.
    const lotes: { vence?: string; queda: number }[] = []
    for (const m of movs) {
      if (m.cantidad > 0) lotes.push({ vence: m.vence, queda: m.cantidad })
      else {
        let salida = -m.cantidad
        for (const l of lotes) {
          if (salida <= 0) break
          const usa = Math.min(l.queda, salida)
          l.queda -= usa
          salida -= usa
        }
      }
    }
    for (const l of lotes) {
      if (!l.vence || l.queda <= 0) continue
      const [vy, vm, vd] = l.vence.split('-').map(Number)
      const diasParaVencer = Math.round((Date.UTC(vy, vm - 1, vd) - hoyMs) / 86_400_000)
      if (diasParaVencer <= dias) resultado.push({ producto: p, vence: l.vence, diasParaVencer, cantidadEstimada: redondear(l.queda) })
    }
  }
  return resultado.sort((a, b) => a.diasParaVencer - b.diasParaVencer)
}

/** Resumen de la semana en texto, para que la dueña se lo mande a sí misma o a su familia por WhatsApp. */
export function textoResumenSemana(nombreBodega: string, desde: string, hasta: string, ventas: Venta[], gastos: { monto: number; categoria?: string }[], abonos: { monto: number }[]): string {
  const vendido = redondear(ventas.reduce((s, v) => s + v.total, 0))
  const bruta = redondear(ventas.reduce((s, v) => s + v.total - v.costoTotal, 0))
  const neta = redondear(bruta - gastosOperativos(gastos))
  const cobrado = redondear(abonos.reduce((s, a) => s + a.monto, 0))
  const fiado = redondear(ventas.filter((v) => v.metodoPago === 'fiado').reduce((s, v) => s + v.total, 0))
  const top = new Map<string, number>()
  for (const v of ventas) for (const i of v.items) top.set(i.nombre, (top.get(i.nombre) ?? 0) + i.cantidad)
  const masVendidos = [...top.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, c]) => `${n} (${c})`)
  const porDia = new Map<string, number>()
  for (const v of ventas) porDia.set(v.dia, (porDia.get(v.dia) ?? 0) + v.total)
  const mejor = [...porDia.entries()].sort((a, b) => b[1] - a[1])[0]
  const f = (d: string) => { const [yy, mm, dd] = d.split('-').map(Number); return new Date(yy, mm - 1, dd).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }) }
  const lineas = [
    `📊 *${nombreBodega || 'Mi bodega'}* · semana del ${f(desde)} al ${f(hasta)}`,
    '',
    `💰 Vendiste S/ ${vendido.toFixed(2)} en ${ventas.length} ventas`,
    `✅ Ganaste S/ ${neta.toFixed(2)}`,
    fiado > 0 ? `📒 Fiaste S/ ${fiado.toFixed(2)} y cobraste S/ ${cobrado.toFixed(2)} de fiados` : `📒 Cobraste S/ ${cobrado.toFixed(2)} de fiados`,
    mejor ? `⭐ Mejor día: ${f(mejor[0])} con S/ ${redondear(mejor[1]).toFixed(2)}` : '',
    masVendidos.length ? `🔥 Lo más vendido: ${masVendidos.join(', ')}` : '',
    '',
    'Enviado desde Sencillo',
  ]
  return lineas.filter((l) => l !== '').join('\n').replace('\n\n\n', '\n\n')
}
