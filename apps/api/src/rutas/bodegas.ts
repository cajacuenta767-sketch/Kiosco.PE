import type { FastifyInstance } from 'fastify'
import { and, eq, gt } from 'drizzle-orm'
import { z } from 'zod'
import type { DB } from '../db/cliente.ts'
import { bodegas, codigosVinculo, dispositivos } from '../db/schema.ts'
import { generarCodigo, generarToken, hashToken, requerirSesion } from '../auth.ts'

const Registro = z.object({
  nombre: z.string().trim().min(1).max(80),
  telefono: z.string().trim().regex(/^\d{9}$/).optional(),
  dispositivo: z.string().trim().max(80).optional(),
})

const Vinculo = z.object({
  codigo: z.string().trim().regex(/^\d{6}$/),
  dispositivo: z.string().trim().max(80).optional(),
})

const MINUTOS_CODIGO = 10

export function rutasBodegas(app: FastifyInstance, db: DB) {
  const auth = requerirSesion(db)

  /** Crea la cuenta de una bodega y el token de su primer dispositivo. Sin correo ni contraseña. */
  app.post('/v1/bodegas', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const r = Registro.safeParse(req.body)
    if (!r.success) return reply.code(400).send({ error: 'Datos inválidos', detalle: r.error.issues })
    const token = generarToken()
    const resultado = await db.transaction(async (tx) => {
      const [b] = await tx.insert(bodegas).values({ nombre: r.data.nombre, telefono: r.data.telefono }).returning()
      const [d] = await tx.insert(dispositivos).values({ bodegaId: b.id, nombre: r.data.dispositivo, tokenHash: hashToken(token) }).returning()
      return { bodegaId: b.id, dispositivoId: d.id, nombre: b.nombre }
    })
    return reply.code(201).send({ ...resultado, token })
  })

  /** Quién soy: datos de la bodega y sus dispositivos. */
  app.get('/v1/bodegas/actual', { preHandler: auth }, async (req) => {
    const { bodegaId, dispositivoId } = req.sesion!
    const b = await db.query.bodegas.findFirst({ where: eq(bodegas.id, bodegaId) })
    const ds = await db.query.dispositivos.findMany({ where: eq(dispositivos.bodegaId, bodegaId) })
    return {
      bodegaId,
      nombre: b?.nombre,
      dispositivoId,
      dispositivos: ds.map((d) => ({ id: d.id, nombre: d.nombre, esteDispositivo: d.id === dispositivoId, ultimoSync: d.ultimoSync?.toISOString() ?? null })),
    }
  })

  /** Un celular ya vinculado pide un código para sumar otro celular a la misma bodega. */
  app.post('/v1/dispositivos/codigo', { preHandler: auth }, async (req, reply) => {
    const { bodegaId } = req.sesion!
    const expiraEn = new Date(Date.now() + MINUTOS_CODIGO * 60_000)
    for (let intento = 0; intento < 5; intento++) {
      const codigo = generarCodigo()
      try {
        await db.insert(codigosVinculo).values({ codigo, bodegaId, expiraEn })
        return reply.code(201).send({ codigo, expiraEn: expiraEn.toISOString(), minutos: MINUTOS_CODIGO })
      } catch {
        /* código repetido: reintentar */
      }
    }
    return reply.code(500).send({ error: 'No se pudo generar el código, intenta de nuevo' })
  })

  /** El celular nuevo canjea el código y recibe su propio token. */
  app.post('/v1/dispositivos/vincular', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const r = Vinculo.safeParse(req.body)
    if (!r.success) return reply.code(400).send({ error: 'El código debe tener 6 dígitos' })
    const token = generarToken()
    const resultado = await db.transaction(async (tx) => {
      const c = await tx.query.codigosVinculo.findFirst({
        where: and(eq(codigosVinculo.codigo, r.data.codigo), eq(codigosVinculo.usado, false), gt(codigosVinculo.expiraEn, new Date())),
      })
      if (!c) return null
      await tx.update(codigosVinculo).set({ usado: true }).where(eq(codigosVinculo.codigo, c.codigo))
      const b = await tx.query.bodegas.findFirst({ where: eq(bodegas.id, c.bodegaId) })
      const [d] = await tx.insert(dispositivos).values({ bodegaId: c.bodegaId, nombre: r.data.dispositivo, tokenHash: hashToken(token) }).returning()
      return { bodegaId: c.bodegaId, dispositivoId: d.id, nombre: b?.nombre ?? '' }
    })
    if (!resultado) return reply.code(404).send({ error: 'Código inválido o vencido. Pide uno nuevo desde el otro celular.' })
    return reply.code(201).send({ ...resultado, token })
  })

  /** Desconectar este celular: su token deja de servir. Los datos locales no se tocan. */
  app.delete('/v1/dispositivos/actual', { preHandler: auth }, async (req) => {
    await db.delete(dispositivos).where(eq(dispositivos.id, req.sesion!.dispositivoId))
    return { ok: true }
  })
}
