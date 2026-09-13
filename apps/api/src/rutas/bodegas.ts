import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { DB } from '../db/cliente.ts'
import { bodegas, dispositivos } from '../db/schema.ts'
import { generarToken, hashToken } from '../auth.ts'

const Registro = z.object({
  nombre: z.string().trim().min(1).max(80),
  telefono: z.string().trim().regex(/^\d{9}$/).optional(),
  dispositivo: z.string().trim().max(80).optional(),
})

export function rutasBodegas(app: FastifyInstance, db: DB) {
  /** Crea la cuenta de una bodega y el token de su primer dispositivo. Sin correo ni contraseña. */
  app.post('/v1/bodegas', async (req, reply) => {
    const r = Registro.safeParse(req.body)
    if (!r.success) return reply.code(400).send({ error: 'Datos inválidos', detalle: r.error.issues })
    const token = generarToken()
    const resultado = await db.transaction(async (tx) => {
      const [b] = await tx.insert(bodegas).values({ nombre: r.data.nombre, telefono: r.data.telefono }).returning()
      const [d] = await tx.insert(dispositivos).values({ bodegaId: b.id, nombre: r.data.dispositivo, tokenHash: hashToken(token) }).returning()
      return { bodegaId: b.id, dispositivoId: d.id }
    })
    return reply.code(201).send({ ...resultado, token })
  })
}
