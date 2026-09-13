import type { FastifyInstance } from 'fastify'
import { and, eq, gt } from 'drizzle-orm'
import { z } from 'zod'
import type { DB } from '../db/cliente.ts'
import { bodegas, codigosVinculo, dispositivos } from '../db/schema.ts'
import { MAX_INTENTOS, MINUTOS_BLOQUEO, PIN_VALIDO, generarCodigo, generarToken, hashPin, hashToken, requerirSesion, verificarPin } from '../auth.ts'

const Telefono = z.string().trim().regex(/^\d{9}$/, 'El celular debe tener 9 dígitos')
const Pin = z.string().regex(PIN_VALIDO, 'El PIN debe tener de 4 a 6 números')

const Registro = z.object({
  nombre: z.string().trim().min(1).max(80),
  telefono: Telefono.optional(),
  pin: Pin.optional(),
  dispositivo: z.string().trim().max(80).optional(),
})

const Acceso = z.object({ telefono: Telefono, pin: Pin })

const Ingreso = z.object({ telefono: Telefono, pin: Pin, dispositivo: z.string().trim().max(80).optional() })

const enmascarar = (t?: string | null) => (t ? `${t.slice(0, 3)} *** ${t.slice(-3)}` : null)

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
    if (!r.success) return reply.code(400).send({ error: r.error.issues[0]?.message ?? 'Datos inválidos' })
    if ((r.data.telefono && !r.data.pin) || (!r.data.telefono && r.data.pin)) return reply.code(400).send({ error: 'Para entrar desde otro celular necesitas número y PIN, los dos' })
    if (r.data.telefono) {
      const existe = await db.query.bodegas.findFirst({ where: eq(bodegas.telefono, r.data.telefono) })
      if (existe) return reply.code(409).send({ error: 'Ese celular ya tiene una bodega. Entra con tu número y PIN.' })
    }
    const token = generarToken()
    const resultado = await db.transaction(async (tx) => {
      const [b] = await tx.insert(bodegas).values({ nombre: r.data.nombre, telefono: r.data.telefono, pinHash: r.data.pin ? hashPin(r.data.pin) : null }).returning()
      const [d] = await tx.insert(dispositivos).values({ bodegaId: b.id, nombre: r.data.dispositivo, tokenHash: hashToken(token) }).returning()
      return { bodegaId: b.id, dispositivoId: d.id, nombre: b.nombre }
    })
    return reply.code(201).send({ ...resultado, token })
  })

  /** Entrar desde cualquier celular con el número de la bodega y su PIN. Crea un dispositivo nuevo. */
  app.post('/v1/sesion', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const r = Ingreso.safeParse(req.body)
    if (!r.success) return reply.code(400).send({ error: r.error.issues[0]?.message ?? 'Datos inválidos' })
    const b = await db.query.bodegas.findFirst({ where: eq(bodegas.telefono, r.data.telefono) })
    const generico = { error: 'Número o PIN incorrectos' }
    if (!b || !b.pinHash) return reply.code(401).send(generico)
    if (b.bloqueadoHasta && b.bloqueadoHasta > new Date()) {
      const min = Math.ceil((b.bloqueadoHasta.getTime() - Date.now()) / 60_000)
      return reply.code(423).send({ error: `Demasiados intentos. Espera ${min} ${min === 1 ? 'minuto' : 'minutos'}.` })
    }
    if (!verificarPin(r.data.pin, b.pinHash)) {
      const intentos = b.intentosFallidos + 1
      const bloquear = intentos >= MAX_INTENTOS
      await db.update(bodegas).set({ intentosFallidos: bloquear ? 0 : intentos, bloqueadoHasta: bloquear ? new Date(Date.now() + MINUTOS_BLOQUEO * 60_000) : null }).where(eq(bodegas.id, b.id))
      return reply.code(401).send(bloquear ? { error: `Demasiados intentos. Espera ${MINUTOS_BLOQUEO} minutos.` } : { ...generico, intentosRestantes: MAX_INTENTOS - intentos })
    }
    const token = generarToken()
    const [d] = await db.transaction(async (tx) => {
      await tx.update(bodegas).set({ intentosFallidos: 0, bloqueadoHasta: null }).where(eq(bodegas.id, b.id))
      return tx.insert(dispositivos).values({ bodegaId: b.id, nombre: r.data.dispositivo, tokenHash: hashToken(token) }).returning()
    })
    return reply.code(201).send({ bodegaId: b.id, dispositivoId: d.id, nombre: b.nombre, token })
  })

  /** Poner o cambiar el número y PIN de acceso de la bodega (desde un celular ya dentro). */
  app.put('/v1/bodegas/actual/acceso', { preHandler: auth }, async (req, reply) => {
    const r = Acceso.safeParse(req.body)
    if (!r.success) return reply.code(400).send({ error: r.error.issues[0]?.message ?? 'Datos inválidos' })
    const { bodegaId } = req.sesion!
    const otra = await db.query.bodegas.findFirst({ where: eq(bodegas.telefono, r.data.telefono) })
    if (otra && otra.id !== bodegaId) return reply.code(409).send({ error: 'Ese celular ya está en otra bodega' })
    await db.update(bodegas).set({ telefono: r.data.telefono, pinHash: hashPin(r.data.pin), intentosFallidos: 0, bloqueadoHasta: null }).where(eq(bodegas.id, bodegaId))
    return { ok: true, telefono: enmascarar(r.data.telefono) }
  })

  /** Cerrar la sesión de otro celular de la misma bodega (por ejemplo, uno perdido). */
  app.delete('/v1/dispositivos/:id', { preHandler: auth }, async (req, reply) => {
    const { bodegaId, dispositivoId } = req.sesion!
    const id = (req.params as { id: string }).id
    if (id === dispositivoId) return reply.code(400).send({ error: 'Para este celular usa "Desconectar de la nube"' })
    const borrados = await db.delete(dispositivos).where(and(eq(dispositivos.id, id), eq(dispositivos.bodegaId, bodegaId))).returning()
    if (borrados.length === 0) return reply.code(404).send({ error: 'Ese celular no está en tu bodega' })
    return { ok: true }
  })

  /** Quién soy: datos de la bodega y sus dispositivos. */
  app.get('/v1/bodegas/actual', { preHandler: auth }, async (req) => {
    const { bodegaId, dispositivoId } = req.sesion!
    const b = await db.query.bodegas.findFirst({ where: eq(bodegas.id, bodegaId) })
    const ds = await db.query.dispositivos.findMany({ where: eq(dispositivos.bodegaId, bodegaId) })
    return {
      bodegaId,
      nombre: b?.nombre,
      telefono: enmascarar(b?.telefono),
      tieneAcceso: Boolean(b?.telefono && b?.pinHash),
      dispositivoId,
      dispositivos: ds.map((d) => ({ id: d.id, nombre: d.nombre, esteDispositivo: d.id === dispositivoId, ultimoSync: d.ultimoSync?.toISOString() ?? null, creadoEn: d.creadoEn.toISOString() })),
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
