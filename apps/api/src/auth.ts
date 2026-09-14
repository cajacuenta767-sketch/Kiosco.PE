import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { eq } from 'drizzle-orm'
import type { DB } from './db/cliente.ts'
import { dispositivos } from './db/schema.ts'

export function generarToken(): string {
  return 'kp_' + randomBytes(24).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function generarCodigo(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

export interface Sesion {
  bodegaId: string
  dispositivoId: string
}

declare module 'fastify' {
  interface FastifyRequest {
    sesion?: Sesion
  }
}

/** Autenticación por token de dispositivo: `Authorization: Bearer kp_...` */
export function requerirSesion(db: DB) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const cab = req.headers.authorization ?? ''
    const token = cab.startsWith('Bearer ') ? cab.slice(7) : ''
    if (!token) return reply.code(401).send({ error: 'Falta el token del dispositivo', codigo: 'sin_sesion' })
    const d = await db.query.dispositivos.findFirst({ where: eq(dispositivos.tokenHash, hashToken(token)) })
    // `codigo` deja que el celular distinga "me cerraron la sesión" de cualquier otro error.
    if (!d) return reply.code(401).send({ error: 'La sesión de este celular se cerró', codigo: 'sesion_cerrada' })
    req.sesion = { bodegaId: d.bodegaId, dispositivoId: d.id }
  }
}

/** PIN de 4 a 6 dígitos guardado con scrypt y sal propia. */
export const PIN_VALIDO = /^\d{4,6}$/

export function hashPin(pin: string): string {
  const sal = randomBytes(16).toString('hex')
  const h = scryptSync(pin, sal, 32).toString('hex')
  return `${sal}:${h}`
}

export function verificarPin(pin: string, guardado: string | null | undefined): boolean {
  if (!guardado) return false
  const [sal, h] = guardado.split(':')
  if (!sal || !h) return false
  const calc = scryptSync(pin, sal, 32)
  const esperado = Buffer.from(h, 'hex')
  return calc.length === esperado.length && timingSafeEqual(calc, esperado)
}

export const MAX_INTENTOS = 5
export const MINUTOS_BLOQUEO = 15
