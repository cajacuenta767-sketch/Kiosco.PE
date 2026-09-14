import type { Tabla } from './tipos.ts'

/** Un cambio en la bitácora de sincronización: "la tabla X, el registro Y, quedó así". */
export interface Cambio {
  tabla: Tabla
  registroId: string
  datos: Record<string, unknown> | null
  borrado: boolean
  actualizadoEn: string
}

export interface CambioRecibido extends Cambio {
  secuencia: number
}

export interface RespuestaPull {
  cambios: CambioRecibido[]
  hasta: number
  hayMas: boolean
}

/** Lo que recibe un celular al crear la cuenta, entrar con número y PIN o canjear un código. */
export interface RespuestaRegistro {
  bodegaId: string
  dispositivoId: string
  token: string
  nombre: string
  /** Celular de la cuenta, enmascarado ("987 *** 321"). Null si la bodega aún no tiene número y PIN. */
  telefono?: string | null
}

/** Identificador global, igual en el celular y en la nube. */
export function uuid(): string {
  return globalThis.crypto.randomUUID()
}

export function ahoraISO(): string {
  return new Date().toISOString()
}
