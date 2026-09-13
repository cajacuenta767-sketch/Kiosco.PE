import type { CierreCaja, Cliente, Gasto, MetodoPago, MovimientoFiado, MovimientoStock, Producto, Venta } from './tipos.ts'
import { aDia, redondear } from './format.ts'

/** Generador determinista (misma semilla, mismos datos) para que la bodega de ejemplo se vea igual en todos lados. */
function azar(semilla: number) {
  let s = semilla >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export interface DatosDemo {
  productos: Producto[]
  movimientosStock: MovimientoStock[]
  ventas: Venta[]
  clientes: Cliente[]
  movimientosFiado: MovimientoFiado[]
  gastos: Gasto[]
  cierres: CierreCaja[]
}

const CLIENTES_DEMO: [string, string | undefined, string | undefined][] = [
  ['Sra. Rosa (casa verde)', '987654321', 'Paga los viernes'],
  ['Don Pepe (taller)', '912345678', undefined],
  ['Srta. Karen (2do piso)', undefined, 'Solo fía hasta S/ 30'],
  ['Familia Quispe', '998877665', undefined],
]

/**
 * Crea 14 días de vida de una bodega: ventas con horas realistas, fiados con abonos, gastos y cierres de caja.
 * El stock final de cada producto coincide con el catálogo: el ingreso inicial es "stock del catálogo + todo lo vendido".
 */
export function generarDemo(catalogo: Producto[], hoy: Date, uuid: () => string, dias = 14): DatosDemo {
  const r = azar(20260913)
  const elegir = <T>(arr: T[]) => arr[Math.floor(r() * arr.length)]
  const iso = (d: Date, h: number, m: number) => {
    const x = new Date(d)
    x.setHours(h, m, Math.floor(r() * 60), 0)
    return x.toISOString()
  }
  // Los productos de mayor rotación tienen más peso.
  const pesos = catalogo.map((p) => (p.precioVenta <= 1.5 ? 6 : p.precioVenta <= 4 ? 4 : p.precioVenta <= 8 ? 2 : 1))
  const totalPesos = pesos.reduce((a, b) => a + b, 0)
  const productoAlAzar = () => {
    let x = r() * totalPesos
    for (let i = 0; i < catalogo.length; i++) {
      x -= pesos[i]
      if (x <= 0) return catalogo[i]
    }
    return catalogo[catalogo.length - 1]
  }

  const clientes: Cliente[] = CLIENTES_DEMO.map(([nombre, telefono, nota]) => {
    const creado = new Date(hoy)
    creado.setDate(creado.getDate() - dias)
    return { id: uuid(), actualizadoEn: creado.toISOString(), nombre, telefono, nota, creadoEn: creado.toISOString() }
  })

  const ventas: Venta[] = []
  const movimientosFiado: MovimientoFiado[] = []
  const gastos: Gasto[] = []
  const cierres: CierreCaja[] = []
  const vendido = new Map<string, number>()
  const metodos: MetodoPago[] = ['efectivo', 'efectivo', 'efectivo', 'efectivo', 'yape', 'yape', 'plin', 'fiado']

  for (let d = dias - 1; d >= 0; d--) {
    const fecha = new Date(hoy)
    fecha.setDate(fecha.getDate() - d)
    const dia = aDia(fecha)
    const finDeSemana = fecha.getDay() === 0 || fecha.getDay() === 6
    const numVentas = d === 0 ? 3 : Math.floor((finDeSemana ? 18 : 12) + r() * 8)
    let efectivo = 0
    for (let v = 0; v < numVentas; v++) {
      const hora = 7 + Math.floor(r() * 14) // 7 a 21 h
      const minuto = Math.floor(r() * 60)
      const nItems = r() < 0.6 ? 1 : r() < 0.8 ? 2 : 3
      const items = new Map<string, { p: Producto; cantidad: number }>()
      for (let i = 0; i < nItems; i++) {
        const p = productoAlAzar()
        const cant = p.unidad === 'kg' ? elegir([0.5, 1, 1, 2]) : elegir([1, 1, 1, 2, 2, 3, 6])
        const it = items.get(p.id) ?? { p, cantidad: 0 }
        it.cantidad += cant
        items.set(p.id, it)
      }
      const lista = [...items.values()]
      const total = redondear(lista.reduce((s, i) => s + i.p.precioVenta * i.cantidad, 0))
      const costoTotal = redondear(lista.reduce((s, i) => s + i.p.precioCompra * i.cantidad, 0))
      let metodo = elegir(metodos)
      if (metodo === 'fiado' && total < 5) metodo = 'efectivo'
      const cliente = metodo === 'fiado' ? elegir(clientes) : undefined
      const f = iso(fecha, hora, minuto)
      const pagoCon = metodo === 'efectivo' ? elegir([total, total, Math.ceil(total / 5) * 5, Math.ceil(total / 10) * 10, 20]) : undefined
      const venta: Venta = {
        id: uuid(),
        actualizadoEn: f,
        fecha: f,
        dia,
        items: lista.map((i) => ({ productoId: i.p.id, nombre: i.p.nombre, cantidad: i.cantidad, precio: i.p.precioVenta, costo: i.p.precioCompra })),
        total,
        costoTotal,
        metodoPago: metodo,
        clienteId: cliente?.id,
        pagoCon,
        vuelto: pagoCon != null ? redondear(pagoCon - total) : undefined,
      }
      ventas.push(venta)
      for (const i of lista) vendido.set(i.p.id, (vendido.get(i.p.id) ?? 0) + i.cantidad)
      if (metodo === 'efectivo') efectivo += total
      if (cliente) {
        movimientosFiado.push({ id: uuid(), actualizadoEn: f, clienteId: cliente.id, fecha: f, tipo: 'fiado', monto: total, ventaId: venta.id, nota: lista.map((i) => `${i.cantidad} ${i.p.nombre}`).join(', ') })
      }
    }
    // Abonos: los viernes y algún otro día
    if (fecha.getDay() === 5 || r() < 0.25) {
      for (const c of clientes) {
        const deuda = redondear(movimientosFiado.filter((m) => m.clienteId === c.id).reduce((s, m) => s + (m.tipo === 'fiado' ? m.monto : -m.monto), 0))
        if (deuda > 0 && r() < 0.6) {
          const monto = r() < 0.5 ? deuda : redondear(Math.max(5, Math.floor(deuda / 2)))
          const f = iso(fecha, 18, Math.floor(r() * 60))
          movimientosFiado.push({ id: uuid(), actualizadoEn: f, clienteId: c.id, fecha: f, tipo: 'abono', monto, metodo: r() < 0.7 ? 'efectivo' : 'yape' })
          if (r() < 0.7) efectivo += monto
        }
      }
    }
    // Gastos: al proveedor se le paga con parte del efectivo del día, nunca más de lo que hay
    if (d % 3 === 0 && d > 0) {
      const f = iso(fecha, 19, 0)
      const monto = redondear(Math.min(60 + Math.floor(r() * 120), Math.floor(efectivo * 0.6)))
      if (monto > 0) {
        gastos.push({ id: uuid(), actualizadoEn: f, fecha: f, dia, monto, categoria: 'proveedor', nota: elegir(['Pago a Backus', 'Distribuidora de abarrotes', 'Panadería', 'Gloria']), deCaja: true })
        efectivo -= monto
      }
    }
    if (d === 7) {
      const f = iso(fecha, 16, 0)
      gastos.push({ id: uuid(), actualizadoEn: f, fecha: f, dia, monto: 45.9, categoria: 'servicios', nota: 'Recibo de luz', deCaja: true })
      efectivo -= 45.9
    }
    if (d === 3) {
      const f = iso(fecha, 8, 15)
      gastos.push({ id: uuid(), actualizadoEn: f, fecha: f, dia, monto: 6, categoria: 'pasaje', nota: 'Pasaje al mercado', deCaja: true })
      efectivo -= 6
    }
    // Cierre de caja de los días pasados
    if (d > 0) {
      const inicial = 50
      const esperado = redondear(inicial + efectivo)
      const dif = r() < 0.7 ? 0 : redondear((r() - 0.5) * 6)
      const f = iso(fecha, 21, 30)
      cierres.push({ id: uuid(), actualizadoEn: f, dia, fecha: f, montoInicial: inicial, efectivoEsperado: esperado, efectivoContado: redondear(esperado + dif), diferencia: dif, totalVentas: redondear(ventas.filter((v) => v.dia === dia).reduce((s, v) => s + v.total, 0)) })
    }
  }

  // Ingreso inicial = stock del catálogo + todo lo vendido, así el stock de hoy es el del catálogo.
  const inicio = new Date(hoy)
  inicio.setDate(inicio.getDate() - dias)
  inicio.setHours(6, 0, 0, 0)
  const movimientosStock: MovimientoStock[] = catalogo.map((p) => ({
    id: uuid(),
    actualizadoEn: inicio.toISOString(),
    productoId: p.id,
    fecha: inicio.toISOString(),
    tipo: 'ingreso',
    cantidad: redondear(p.stock + (vendido.get(p.id) ?? 0)),
    nota: 'Stock inicial',
  }))
  for (const v of ventas) for (const i of v.items) movimientosStock.push({ id: uuid(), actualizadoEn: v.fecha, productoId: i.productoId, fecha: v.fecha, tipo: 'venta', cantidad: -i.cantidad, nota: `Venta ${v.id.slice(0, 8)}` })

  return { productos: catalogo, movimientosStock, ventas: ventas.sort((a, b) => a.fecha.localeCompare(b.fecha)), clientes, movimientosFiado, gastos, cierres }
}
