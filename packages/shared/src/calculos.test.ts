import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deudaDe, pedidoSugerido, resumirVentas } from './calculos.ts'
import type { Producto, Venta } from './tipos.ts'

const producto = (p: Partial<Producto>): Producto => ({ id: 'p1', actualizadoEn: '', nombre: 'X', categoria: 'Otros', precioVenta: 3, precioCompra: 2.3, stock: 10, stockMinimo: 5, unidad: 'und', activo: true, creadoEn: '', ...p })
const venta = (v: Partial<Venta>): Venta => ({ id: 'v', actualizadoEn: '', fecha: '', dia: '2026-09-13', items: [], total: 0, costoTotal: 0, metodoPago: 'efectivo', ...v })

test('deudaDe suma fiados y resta abonos', () => {
  assert.equal(deudaDe([{ tipo: 'fiado', monto: 7 }, { tipo: 'abono', monto: 3 }]), 4)
  assert.equal(deudaDe([]), 0)
})

test('resumirVentas calcula total, ganancia y método', () => {
  const r = resumirVentas([
    venta({ total: 8, costoTotal: 6.1, metodoPago: 'efectivo', items: [{ productoId: 'p1', nombre: 'Inca Kola', cantidad: 2, precio: 3, costo: 2.3 }, { productoId: 'p2', nombre: 'Sublime', cantidad: 1, precio: 2, costo: 1.5 }] }),
    venta({ total: 7, costoTotal: 5.6, metodoPago: 'fiado', items: [{ productoId: 'p3', nombre: 'Pilsen', cantidad: 1, precio: 7, costo: 5.6 }] }),
  ], '2026-09-13')
  assert.equal(r.totalVentas, 15)
  assert.equal(r.ganancia, 3.3)
  assert.equal(r.numVentas, 2)
  assert.equal(r.porMetodo.efectivo, 8)
  assert.equal(r.porMetodo.fiado, 7)
  assert.equal(r.topProductos[0].nombre, 'Pilsen')
})

test('pedidoSugerido repone lo que se acaba según rotación', () => {
  const productos = [
    producto({ id: 'p1', nombre: 'Rota rápido', stock: 4, stockMinimo: 2 }),
    producto({ id: 'p2', nombre: 'Bajo mínimo', stock: 1, stockMinimo: 5, precioCompra: 2 }),
    producto({ id: 'p3', nombre: 'Sobrado', stock: 50, stockMinimo: 5 }),
  ]
  // 28 unidades del producto 1 en 14 días = 2/día → 4 en stock alcanzan 2 días
  const ventas = Array.from({ length: 14 }, () => venta({ items: [{ productoId: 'p1', nombre: 'Rota rápido', cantidad: 2, precio: 3, costo: 2.3 }] }))
  const lineas = pedidoSugerido(productos, ventas)
  assert.deepEqual(lineas.map((l) => l.producto.id), ['p1', 'p2'])
  assert.equal(lineas[0].sugerido, 10) // objetivo 14/semana − 4 en stock
  assert.equal(lineas[1].sugerido, 9) // objetivo 2×5 − 1
  assert.equal(lineas[1].costo, 18)
})

test('resumirMes agrega ventas, gastos y fiados del mes', async () => {
  const { resumirMes, textoComprobante } = await import('./calculos.ts')
  const ventas = [
    venta({ dia: '2026-09-01', total: 10, costoTotal: 7, items: [{ productoId: 'p1', nombre: 'A', cantidad: 2, precio: 5, costo: 3.5 }] }),
    venta({ dia: '2026-09-02', total: 30, costoTotal: 20, items: [{ productoId: 'p2', nombre: 'B', cantidad: 1, precio: 30, costo: 20 }] }),
    venta({ dia: '2026-08-31', total: 99, costoTotal: 1, items: [] }),
  ]
  const r = resumirMes('2026-09', ventas, [{ monto: 5, dia: '2026-09-02' }, { monto: 50, dia: '2026-08-15' }], [{ tipo: 'fiado', monto: 8, fecha: '2026-09-03T10:00:00Z' }, { tipo: 'abono', monto: 3, fecha: '2026-09-04T10:00:00Z' }])
  assert.equal(r.vendido, 40)
  assert.equal(r.gananciaBruta, 13)
  assert.equal(r.gastos, 5)
  assert.equal(r.gananciaNeta, 8)
  assert.equal(r.numVentas, 2)
  assert.equal(r.diasConVenta, 2)
  assert.equal(r.promedioDiario, 20)
  assert.deepEqual(r.mejorDia, { dia: '2026-09-02', total: 30 })
  assert.equal(r.fiado, 8)
  assert.equal(r.cobradoFiado, 3)
  assert.equal(r.topProductos[0].nombre, 'B')
  const texto = textoComprobante(venta({ fecha: '2026-09-13T15:00:00Z', total: 8, items: [{ productoId: 'p1', nombre: 'Inca Kola', cantidad: 2, precio: 3, costo: 2.3 }], pagoCon: 10, vuelto: 2 }), 'Bodega X', 'Efectivo')
  assert.match(texto, /Bodega X/)
  assert.match(texto, /2 × Inca Kola  S\/ 6\.00/)
  assert.match(texto, /TOTAL S\/ 8\.00 \(Efectivo\)/)
  assert.match(texto, /Vuelto S\/ 2\.00/)
})

test('loDeSiempre encuentra la compra habitual', async () => {
  const { loDeSiempre } = await import('./calculos.ts')
  const it = (productoId: string, nombre: string, cantidad: number) => ({ productoId, nombre, cantidad, precio: 1, costo: 0.5 })
  const ventas = [
    venta({ fecha: '2026-09-01T10:00:00Z', items: [it('pan', 'Pan', 4), it('leche', 'Leche', 1)] }),
    venta({ fecha: '2026-09-02T10:00:00Z', items: [it('pan', 'Pan', 5), it('leche', 'Leche', 1), it('arroz', 'Arroz', 1)] }),
    venta({ fecha: '2026-09-03T10:00:00Z', items: [it('pan', 'Pan', 4), it('gaseosa', 'Gaseosa', 1)] }),
    venta({ fecha: '2026-09-04T10:00:00Z', items: [it('pan', 'Pan', 6), it('leche', 'Leche', 2)] }),
  ]
  assert.deepEqual(loDeSiempre(ventas), [
    { productoId: 'leche', nombre: 'Leche', cantidad: 1 },
    { productoId: 'pan', nombre: 'Pan', cantidad: 5 },
  ])
  // Con pocas compras, es la última
  assert.deepEqual(loDeSiempre(ventas.slice(0, 2)), [{ productoId: 'pan', nombre: 'Pan', cantidad: 5 }, { productoId: 'leche', nombre: 'Leche', cantidad: 1 }, { productoId: 'arroz', nombre: 'Arroz', cantidad: 1 }])
  assert.deepEqual(loDeSiempre([]), [])
})

test('textoListaPrecios agrupa por categoría e incluye paquetes', async () => {
  const { textoListaPrecios } = await import('./calculos.ts')
  const t = textoListaPrecios([
    producto({ id: 'a', nombre: 'Pilsen', categoria: 'Bebidas', precioVenta: 7, paquetes: [{ nombre: 'Six-pack', cantidad: 6, precio: 38 }] }),
    producto({ id: 'b', nombre: 'Arroz', categoria: 'Abarrotes', precioVenta: 4.5, unidad: 'kg' }),
    producto({ id: 'c', nombre: 'Viejo', categoria: 'Abarrotes', precioVenta: 1, activo: false }),
  ], 'Bodega X', () => '•')
  assert.match(t, /\*Bodega X\*/)
  assert.ok(t.indexOf('ABARROTES') < t.indexOf('BEBIDAS'))
  assert.match(t, /Arroz — S\/ 4\.50 el kilo/)
  assert.match(t, /Six-pack \(x6\) — S\/ 38\.00/)
  assert.doesNotMatch(t, /Viejo/)
})
