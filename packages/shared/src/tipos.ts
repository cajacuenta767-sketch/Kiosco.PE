/** Tipos de dominio de Kiosco.PE. No dependen de ninguna base de datos ni framework. */

export type MetodoPago = 'efectivo' | 'yape' | 'plin' | 'tarjeta' | 'fiado'
export type Unidad = 'und' | 'kg'
export type CategoriaGasto = 'proveedor' | 'pasaje' | 'servicios' | 'personal' | 'otro'

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
  productoId: number // 0 = venta rápida sin producto del catálogo
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

export interface Gasto {
  id?: number
  fecha: string
  dia: string
  monto: number
  categoria: CategoriaGasto
  nota?: string
  deCaja: boolean
}

export const METODOS: { id: MetodoPago; label: string; icono: string }[] = [
  { id: 'efectivo', label: 'Efectivo', icono: '💵' },
  { id: 'yape', label: 'Yape', icono: '📱' },
  { id: 'plin', label: 'Plin', icono: '📲' },
  { id: 'tarjeta', label: 'Tarjeta', icono: '💳' },
  { id: 'fiado', label: 'Fiado', icono: '📒' },
]

export const CATEGORIAS = ['Bebidas', 'Abarrotes', 'Golosinas', 'Snacks', 'Panadería', 'Limpieza', 'Cuidado personal', 'Otros']

export const CATEGORIAS_GASTO: { id: CategoriaGasto; label: string; icono: string }[] = [
  { id: 'proveedor', label: 'Proveedor', icono: '🚚' },
  { id: 'servicios', label: 'Luz / agua / internet', icono: '💡' },
  { id: 'pasaje', label: 'Pasaje / movilidad', icono: '🚌' },
  { id: 'personal', label: 'Personal / familia', icono: '👤' },
  { id: 'otro', label: 'Otro', icono: '📝' },
]

/** Formato del respaldo y del protocolo de sincronización. */
export const TABLAS = ['productos', 'ventas', 'clientes', 'movimientosFiado', 'movimientosStock', 'cierres', 'gastos', 'config'] as const
export type Tabla = (typeof TABLAS)[number]
