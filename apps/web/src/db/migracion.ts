import Dexie from 'dexie'
import { ahoraISO, uuid } from '@sencillo/shared'
import { db } from './db'

const NOMBRE_ANTERIOR = 'kiosco-pe'

/**
 * Las versiones 0.1 y 0.2 guardaban en la base "kiosco-pe" con ids numéricos.
 * Si existe, copia todo a la base nueva con ids globales (UUID) y la elimina. Solo ocurre una vez.
 */
export async function migrarDesdeVersionAnterior(): Promise<boolean> {
  if (!(await Dexie.exists(NOMBRE_ANTERIOR))) return false
  if ((await db.productos.count()) > 0) {
    await Dexie.delete(NOMBRE_ANTERIOR)
    return false
  }
  const vieja = new Dexie(NOMBRE_ANTERIOR)
  vieja.version(2).stores({
    productos: '++id', ventas: '++id', clientes: '++id', movimientosFiado: '++id', movimientosStock: '++id', cierres: '++id', gastos: '++id', config: 'key',
  })
  await vieja.open()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leer = (t: string) => vieja.table(t).toArray() as Promise<any[]>
  const [productos, ventas, clientes, movF, movS, cierres, gastos, config] = await Promise.all(
    ['productos', 'ventas', 'clientes', 'movimientosFiado', 'movimientosStock', 'cierres', 'gastos', 'config'].map(leer),
  )
  const ahora = ahoraISO()
  const mapa = (filas: { id: number }[]) => new Map(filas.map((f) => [f.id, uuid()]))
  const mp = mapa(productos), mv = mapa(ventas), mc = mapa(clientes)
  const conv = <T extends { id: number }>(filas: T[], m: Map<number, string>, extra: (f: T) => object) =>
    filas.map((f) => ({ ...f, ...extra(f), id: m.get(f.id)!, actualizadoEn: ahora }))

  await db.transaction('rw', db.tables, async () => {
    await db.productos.bulkPut(conv(productos, mp, () => ({})))
    await db.ventas.bulkPut(conv(ventas, mv, (v) => ({
      clienteId: v.clienteId != null ? mc.get(v.clienteId) : undefined,
      items: (v.items as { productoId: number }[]).map((i) => ({ ...i, productoId: i.productoId ? (mp.get(i.productoId) ?? '') : '' })),
    })))
    await db.clientes.bulkPut(conv(clientes, mc, () => ({})))
    await db.movimientosFiado.bulkPut(conv(movF, mapa(movF), (m) => ({ clienteId: mc.get(m.clienteId) ?? '', ventaId: m.ventaId != null ? mv.get(m.ventaId) : undefined })).filter((m) => m.clienteId))
    const movimientos = conv(movS, mapa(movS), (m) => ({ productoId: mp.get(m.productoId) ?? '' })).filter((m) => m.productoId)
    // Garantiza el invariante stock = suma de movimientos, creando un ajuste por la diferencia.
    for (const p of productos) {
      const id = mp.get(p.id)!
      const suma = movimientos.filter((m) => m.productoId === id).reduce((s, m) => s + m.cantidad, 0)
      const dif = Math.round((p.stock - suma) * 100) / 100
      if (dif !== 0) movimientos.push({ id: uuid(), actualizadoEn: ahora, productoId: id, fecha: ahora, tipo: 'ajuste', cantidad: dif, nota: 'Stock inicial (migración)' })
    }
    await db.movimientosStock.bulkPut(movimientos)
    await db.cierres.bulkPut(conv(cierres, mapa(cierres), () => ({})))
    await db.gastos.bulkPut(conv(gastos, mapa(gastos), () => ({})))
    await db.config.bulkPut(config)
  })
  vieja.close()
  await Dexie.delete(NOMBRE_ANTERIOR)
  return true
}
