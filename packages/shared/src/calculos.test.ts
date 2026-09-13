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
