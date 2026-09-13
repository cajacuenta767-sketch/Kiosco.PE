import Dexie, { type EntityTable } from 'dexie'
import type { Cambio, CierreCaja, Cliente, Gasto, MovimientoFiado, MovimientoStock, Producto, Venta } from '@kiosco/shared'

export type { CategoriaGasto, CierreCaja, Cliente, Gasto, ItemVenta, MetodoPago, MovimientoFiado, MovimientoStock, Producto, Unidad, Venta } from '@kiosco/shared'

export interface Config {
  key: string
  value: string
}

/** Cambio local pendiente de subir a la nube. */
export interface CambioPendiente extends Cambio {
  id?: number
}

class KioscoDB extends Dexie {
  productos!: EntityTable<Producto, 'id'>
  ventas!: EntityTable<Venta, 'id'>
  clientes!: EntityTable<Cliente, 'id'>
  movimientosFiado!: EntityTable<MovimientoFiado, 'id'>
  movimientosStock!: EntityTable<MovimientoStock, 'id'>
  cierres!: EntityTable<CierreCaja, 'id'>
  gastos!: EntityTable<Gasto, 'id'>
  config!: EntityTable<Config, 'key'>
  cola!: EntityTable<CambioPendiente, 'id'>

  constructor() {
    super('kiosco')
    this.version(1).stores({
      productos: 'id, nombre, categoria, codigoBarras',
      ventas: 'id, fecha, dia, metodoPago, clienteId',
      clientes: 'id, nombre',
      movimientosFiado: 'id, clienteId, fecha, tipo, ventaId',
      movimientosStock: 'id, productoId, fecha, tipo',
      cierres: 'id, dia',
      gastos: 'id, fecha, dia, categoria',
      config: 'key',
      cola: '++id, tabla, registroId',
    })
  }
}

export const db = new KioscoDB()

/** Tablas que viajan a la nube (config solo sincroniza el nombre de la bodega). */
export const TABLAS_SYNC = {
  productos: () => db.productos,
  ventas: () => db.ventas,
  clientes: () => db.clientes,
  movimientosFiado: () => db.movimientosFiado,
  movimientosStock: () => db.movimientosStock,
  cierres: () => db.cierres,
  gastos: () => db.gastos,
  config: () => db.config,
} as const

export async function getConfig(key: string, fallback = ''): Promise<string> {
  const row = await db.config.get(key)
  return row?.value ?? fallback
}

export async function setConfig(key: string, value: string) {
  await db.config.put({ key, value })
}
