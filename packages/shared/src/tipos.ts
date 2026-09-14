/** Tipos de dominio de Sencillo. No dependen de ninguna base de datos ni framework. */

export type MetodoPago = 'efectivo' | 'yape' | 'plin' | 'tarjeta' | 'fiado'
export type Unidad = 'und' | 'kg'
export type CategoriaGasto = 'proveedor' | 'pasaje' | 'servicios' | 'personal' | 'otro'

/** Campos comunes a todo registro sincronizable. `id` es un UUID global; `actualizadoEn` decide conflictos. */
export interface Registro {
  id: string
  actualizadoEn: string
}

export interface Producto extends Registro {
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
  emoji?: string // ícono elegido a mano
  imagen?: string // foto pequeña (data URL, ~5 KB)
  paquetes?: Paquete[] // precios por paquete: six-pack, docena, caja
}

/** Un precio alternativo por varias unidades del mismo producto. El stock siempre se lleva en unidades. */
export interface Paquete {
  nombre: string // "Six-pack", "Docena", "Caja x12"
  cantidad: number // unidades que contiene
  precio: number // precio del paquete completo
}

/** Medios de pago digitales de la bodega: número y foto del QR para mostrar al cliente. */
export interface MedioPago {
  numero?: string
  titular?: string
  qr?: string // data URL
}

export interface ItemVenta {
  productoId: string // '' = venta rápida sin producto del catálogo
  nombre: string
  cantidad: number
  precio: number
  costo: number
}

export interface Venta extends Registro {
  fecha: string
  dia: string // YYYY-MM-DD, para agrupar rápido
  items: ItemVenta[]
  total: number
  costoTotal: number
  metodoPago: MetodoPago
  clienteId?: string
  pagoCon?: number
  vuelto?: number
}

export interface Cliente extends Registro {
  nombre: string
  telefono?: string
  nota?: string
  pagaEl?: string // YYYY-MM-DD, fecha de pago acordada
  tope?: number // máximo que se le fía; sin tope, sin límite
  creadoEn: string
}

export interface MovimientoFiado extends Registro {
  clienteId: string
  fecha: string
  tipo: 'fiado' | 'abono'
  monto: number
  metodo?: Exclude<MetodoPago, 'fiado'> // cómo pagó el abono; si falta, efectivo
  ventaId?: string
  nota?: string
}

export interface MovimientoStock extends Registro {
  productoId: string
  fecha: string
  tipo: 'venta' | 'ingreso' | 'ajuste' | 'merma'
  cantidad: number // positivo entra, negativo sale
  nota?: string
  vence?: string // YYYY-MM-DD, solo en ingresos: fecha de vencimiento del lote
}

export interface CierreCaja extends Registro {
  dia: string
  fecha: string
  montoInicial: number
  efectivoEsperado: number
  efectivoContado: number
  diferencia: number
  totalVentas: number
  nota?: string
}

export interface Gasto extends Registro {
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
