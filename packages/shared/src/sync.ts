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

export interface RespuestaRegistro {
  bodegaId: string
  dispositivoId: string
  token: string
  nombre: string
}

/** Identificador global, igual en el celular y en la nube. */
export function uuid(): string {
  return globalThis.crypto.randomUUID()
}

export function ahoraISO(): string {
  return new Date().toISOString()
}
