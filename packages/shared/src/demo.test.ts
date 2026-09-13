import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generarDemo } from './demo.ts'
import { emojiPara } from './emoji.ts'
import type { Producto } from './tipos.ts'

test('emojiPara reconoce productos típicos de bodega', () => {
  assert.equal(emojiPara('Inca Kola 500ml', 'Bebidas'), '🥤')
  assert.equal(emojiPara('Cerveza Pilsen 630ml', 'Bebidas'), '🍺')
  assert.equal(emojiPara('Papel Higiénico Suave x4', 'Limpieza'), '🧻')
  assert.equal(emojiPara('Cosa rara', 'Golosinas'), '🍬')
  assert.equal(emojiPara('Cosa rara', 'Inventada'), '📦')
})

test('generarDemo deja el stock final igual al catálogo y es determinista', () => {
  let n = 0
  const uuid = () => `id-${n++}`
  const catalogo: Producto[] = [
    { id: 'p1', actualizadoEn: '', nombre: 'Inca Kola', categoria: 'Bebidas', precioVenta: 3, precioCompra: 2.3, stock: 24, stockMinimo: 6, unidad: 'und', activo: true, creadoEn: '' },
    { id: 'p2', actualizadoEn: '', nombre: 'Arroz', categoria: 'Abarrotes', precioVenta: 4.5, precioCompra: 3.8, stock: 25, stockMinimo: 10, unidad: 'kg', activo: true, creadoEn: '' },
    { id: 'p3', actualizadoEn: '', nombre: 'Pilsen', categoria: 'Bebidas', precioVenta: 7, precioCompra: 5.6, stock: 12, stockMinimo: 6, unidad: 'und', activo: true, creadoEn: '' },
  ]
  const hoy = new Date(2026, 8, 13, 12, 0, 0)
  const d = generarDemo(catalogo, hoy, uuid)
  assert.ok(d.ventas.length > 100, `ventas generadas: ${d.ventas.length}`)
  assert.equal(d.cierres.length, 13)
  assert.ok(d.movimientosFiado.some((m) => m.tipo === 'abono'))
  for (const p of catalogo) {
    const suma = d.movimientosStock.filter((m) => m.productoId === p.id).reduce((s, m) => s + m.cantidad, 0)
    assert.equal(Math.round(suma * 100) / 100, p.stock, `stock final de ${p.nombre}`)
  }
  for (const v of d.ventas) assert.equal(v.total, Math.round(v.items.reduce((s, i) => s + i.precio * i.cantidad, 0) * 100) / 100)
  n = 0
  const d2 = generarDemo(catalogo, hoy, uuid)
  assert.equal(d2.ventas.length, d.ventas.length)
  assert.equal(d2.ventas[5].total, d.ventas[5].total)
})
