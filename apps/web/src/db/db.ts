import Dexie, { type EntityTable } from 'dexie'

import type { CierreCaja, Cliente, Gasto, MovimientoFiado, MovimientoStock, Producto, Venta } from '@kiosco/shared'

export type { CategoriaGasto, CierreCaja, Cliente, Gasto, ItemVenta, MetodoPago, MovimientoFiado, MovimientoStock, Producto, Unidad, Venta } from '@kiosco/shared'

export interface Config {
  key: string
  value: string
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

  constructor() {
    super('kiosco-pe')
    this.version(1).stores({
      productos: '++id, nombre, categoria, codigoBarras, activo',
      ventas: '++id, fecha, dia, metodoPago, clienteId',
      clientes: '++id, nombre',
      movimientosFiado: '++id, clienteId, fecha, tipo',
      movimientosStock: '++id, productoId, fecha, tipo',
      cierres: '++id, dia',
      config: 'key',
    })
    this.version(2).stores({
      gastos: '++id, fecha, dia, categoria',
    })
  }
}

export const db = new KioscoDB()

export async function getConfig(key: string, fallback = ''): Promise<string> {
  const row = await db.config.get(key)
  return row?.value ?? fallback
}

export async function setConfig(key: string, value: string) {
  await db.config.put({ key, value })
}
