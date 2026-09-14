import type { FastifyInstance } from 'fastify'
import { and, eq, gt, ne } from 'drizzle-orm'
import { z } from 'zod'
import { TABLAS } from '@sencillo/shared'
import type { DB } from '../db/cliente.ts'
import { cambios, dispositivos } from '../db/schema.ts'
import { requerirSesion } from '../auth.ts'

const Cambio = z.object({
  tabla: z.enum(TABLAS),
  registroId: z.string().min(1).max(120),
  datos: z.record(z.string(), z.unknown()).nullable(),
  borrado: z.boolean().default(false),
  actualizadoEn: z.iso.datetime(),
})

const Push = z.object({ cambios: z.array(Cambio).max(500) })
const Pull = z.object({ desde: z.coerce.number().int().min(0).default(0), limite: z.coerce.number().int().min(1).max(1000).default(500) })

export function rutasSync(app: FastifyInstance, db: DB) {
  const auth = requerirSesion(db)

  /** El celular sube sus cambios. Idempotente: reenviar el mismo lote no rompe nada (última escritura gana). */
  app.post('/v1/sync/push', { preHandler: auth }, async (req, reply) => {
    const r = Push.safeParse(req.body)
    if (!r.success) return reply.code(400).send({ error: 'Lote inválido', detalle: r.error.issues })
    const { bodegaId, dispositivoId } = req.sesion!
    if (r.data.cambios.length === 0) return { recibidos: 0 }
    await db.transaction(async (tx) => {
      await tx.insert(cambios).values(
        r.data.cambios.map((c) => ({ bodegaId, dispositivoId, tabla: c.tabla, registroId: c.registroId, datos: c.datos, borrado: c.borrado, actualizadoEn: new Date(c.actualizadoEn) })),
      )
      await tx.update(dispositivos).set({ ultimoSync: new Date() }).where(eq(dispositivos.id, dispositivoId))
    })
    return { recibidos: r.data.cambios.length }
  })

  /** El celular baja los cambios de otros dispositivos de la misma bodega, a partir de una secuencia. */
  app.get('/v1/sync/pull', { preHandler: auth }, async (req, reply) => {
    const r = Pull.safeParse(req.query)
    if (!r.success) return reply.code(400).send({ error: 'Parámetros inválidos' })
    const { bodegaId, dispositivoId } = req.sesion!
    const filas = await db
      .select()
      .from(cambios)
      .where(and(eq(cambios.bodegaId, bodegaId), gt(cambios.secuencia, r.data.desde), ne(cambios.dispositivoId, dispositivoId)))
      .orderBy(cambios.secuencia)
      .limit(r.data.limite)
    const ultima = filas.length ? filas[filas.length - 1].secuencia : r.data.desde
    return {
      cambios: filas.map((f) => ({ secuencia: f.secuencia, tabla: f.tabla, registroId: f.registroId, datos: f.datos, borrado: f.borrado, actualizadoEn: f.actualizadoEn.toISOString() })),
      hasta: ultima,
      hayMas: filas.length === r.data.limite,
    }
  })
}
