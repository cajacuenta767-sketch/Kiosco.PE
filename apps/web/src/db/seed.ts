import { ahoraISO, generarDemo, uuid } from '@sencillo/shared'
import { db, setConfig, type MovimientoStock, type Producto } from './db'

type Semilla = [string, string, number, number, number, number, 'und' | 'kg']
//               nombre, categoria, venta, compra, stock, minimo, unidad

const CATALOGO: Semilla[] = [
  ['Inca Kola 500ml', 'Bebidas', 3.0, 2.3, 24, 6, 'und'],
  ['Coca Cola 500ml', 'Bebidas', 3.0, 2.3, 18, 6, 'und'],
  ['Agua San Luis 625ml', 'Bebidas', 1.5, 1.0, 30, 10, 'und'],
  ['Cifrut 500ml', 'Bebidas', 1.5, 1.1, 20, 6, 'und'],
  ['Cerveza Pilsen 630ml', 'Bebidas', 7.0, 5.6, 12, 6, 'und'],
  ['Cerveza Cristal 630ml', 'Bebidas', 7.0, 5.6, 4, 6, 'und'],
  ['Leche Gloria Azul 400g', 'Abarrotes', 4.2, 3.6, 36, 12, 'und'],
  ['Arroz Costeño', 'Abarrotes', 4.5, 3.8, 25, 10, 'kg'],
  ['Azúcar Rubia', 'Abarrotes', 4.0, 3.4, 20, 8, 'kg'],
  ['Aceite Primor 900ml', 'Abarrotes', 10.5, 9.2, 10, 4, 'und'],
  ['Atún Florida 170g', 'Abarrotes', 6.5, 5.4, 15, 6, 'und'],
  ['Fideo Don Vittorio 500g', 'Abarrotes', 3.8, 3.1, 14, 6, 'und'],
  ['Huevos', 'Abarrotes', 8.0, 6.8, 6, 3, 'kg'],
  ['Sal Marina 1kg', 'Abarrotes', 1.5, 1.1, 8, 4, 'und'],
  ['Galleta Soda Field', 'Golosinas', 0.8, 0.6, 40, 12, 'und'],
  ['Sublime', 'Golosinas', 2.0, 1.5, 20, 8, 'und'],
  ['Chicle Trident', 'Golosinas', 1.0, 0.7, 30, 10, 'und'],
  ['Casino Chocolate', 'Golosinas', 1.5, 1.1, 22, 8, 'und'],
  ['Papas Lays Clásicas', 'Snacks', 2.0, 1.5, 15, 6, 'und'],
  ['Chizito', 'Snacks', 1.0, 0.7, 25, 8, 'und'],
  ['Pan Francés', 'Panadería', 0.3, 0.2, 60, 20, 'und'],
  ['Papel Higiénico Suave x4', 'Limpieza', 6.5, 5.5, 8, 4, 'und'],
  ['Detergente Bolívar 520g', 'Limpieza', 7.5, 6.4, 3, 4, 'und'],
  ['Jabón Bolívar', 'Limpieza', 2.5, 2.0, 12, 5, 'und'],
  ['Lejía Clorox 1L', 'Limpieza', 4.0, 3.2, 6, 3, 'und'],
  ['Shampoo Sachet H&S', 'Cuidado personal', 1.0, 0.7, 40, 15, 'und'],
  ['Pilas Duracell AA x2', 'Otros', 6.0, 4.6, 5, 3, 'und'],
  ['Fósforos Inti', 'Otros', 0.5, 0.35, 30, 10, 'und'],
]

const PAQUETES: Record<string, Producto['paquetes']> = {
  'Cerveza Pilsen 630ml': [{ nombre: 'Six-pack', cantidad: 6, precio: 39 }, { nombre: 'Caja x12', cantidad: 12, precio: 76 }],
  'Cerveza Cristal 630ml': [{ nombre: 'Six-pack', cantidad: 6, precio: 39 }],
  'Galleta Soda Field': [{ nombre: 'Paquete x6', cantidad: 6, precio: 4.5 }],
  'Agua San Luis 625ml': [{ nombre: 'Paquete x6', cantidad: 6, precio: 8 }],
  'Pan Francés': [{ nombre: 'Media docena', cantidad: 6, precio: 1.7 }, { nombre: 'Docena', cantidad: 12, precio: 3.3 }],
}

function catalogoBase(fecha: string): Producto[] {
  return CATALOGO.map(([nombre, categoria, precioVenta, precioCompra, stock, stockMinimo, unidad]) => ({
    id: uuid(), actualizadoEn: fecha, nombre, categoria, precioVenta, precioCompra, stock, stockMinimo, unidad, activo: true, creadoEn: fecha, paquetes: PAQUETES[nombre],
  }))
}

/** Carga un catálogo de ejemplo si no hay productos. Marca la config para que, al vincular con otra bodega, se pueda descartar. */
export async function sembrarSiVacio() {
  const n = await db.productos.count()
  if (n > 0) return
  const ahora = ahoraISO()
  const filas = catalogoBase(ahora)
  const movs: MovimientoStock[] = filas.map((p) => ({ id: uuid(), actualizadoEn: ahora, productoId: p.id, fecha: ahora, tipo: 'ingreso', cantidad: p.stock, nota: 'Stock inicial' }))
  await db.transaction('rw', [db.productos, db.movimientosStock, db.config], async () => {
    await db.productos.bulkAdd(filas)
    await db.movimientosStock.bulkAdd(movs)
    await setConfig('catalogoEjemplo', '1')
  })
}

/**
 * Bodega de ejemplo con movimiento: 14 días de ventas, fiados, abonos, gastos y cierres.
 * Para ver la app "viva" en la primera demostración. Solo si no hay productos.
 */
export async function sembrarDemo() {
  const n = await db.productos.count()
  if (n > 0) return
  const hoy = new Date()
  const inicio = new Date(hoy)
  inicio.setDate(inicio.getDate() - 14)
  const catalogo = catalogoBase(inicio.toISOString())
  const d = generarDemo(catalogo, hoy, uuid)
  await db.transaction('rw', db.tables, async () => {
    await db.productos.bulkAdd(d.productos)
    await db.movimientosStock.bulkAdd(d.movimientosStock)
    await db.ventas.bulkAdd(d.ventas)
    await db.clientes.bulkAdd(d.clientes)
    await db.movimientosFiado.bulkAdd(d.movimientosFiado)
    await db.gastos.bulkAdd(d.gastos)
    await db.cierres.bulkAdd(d.cierres)
    await setConfig('catalogoEjemplo', '1')
    if (!(await db.config.get('nombreBodega'))?.value) await setConfig('nombreBodega', 'Bodega de ejemplo')
  })
}
