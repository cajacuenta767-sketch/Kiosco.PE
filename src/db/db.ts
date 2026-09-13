import Dexie, { type EntityTable } from 'dexie'

export type MetodoPago = 'efectivo' | 'yape' | 'plin' | 'tarjeta' | 'fiado'
export type Unidad = 'und' | 'kg'

export interface Producto {
  id?: number
  nombre: string
  categoria: string
  codigoBarras?: string
  precioVenta: number
  precioCompra: number
  stock: number
  stockMinimo: number
  unidad: Unidad
  activo: boolean
  creadoEn: string
}

export interface ItemVenta {
  productoId: number
  nombre: string
  cantidad: number
  precio: number
  costo: number
}

export interface Venta {
  id?: number
  fecha: string
  dia: string // YYYY-MM-DD, para agrupar rápido
  items: ItemVenta[]
  total: number
  costoTotal: number
  metodoPago: MetodoPago
  clienteId?: number
  pagoCon?: number
  vuelto?: number
}

export interface Cliente {
  id?: number
  nombre: string
  telefono?: string
  nota?: string
  creadoEn: string
}

export interface MovimientoFiado {
  id?: number
  clienteId: number
  fecha: string
  tipo: 'fiado' | 'abono'
  monto: number
  ventaId?: number
  nota?: string
}

export interface MovimientoStock {
  id?: number
  productoId: number
  fecha: string
  tipo: 'venta' | 'ingreso' | 'ajuste' | 'merma'
  cantidad: number // positivo entra, negativo sale
  nota?: string
}

export interface CierreCaja {
  id?: number
  dia: string
  fecha: string
  montoInicial: number
  efectivoEsperado: number
  efectivoContado: number
  diferencia: number
  totalVentas: number
  nota?: string
}

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
