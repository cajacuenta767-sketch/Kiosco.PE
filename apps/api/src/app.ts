import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import fastifyStatic from '@fastify/static'
import type { Conexion } from './db/cliente.ts'
import { rutasBodegas } from './rutas/bodegas.ts'
import { rutasSync } from './rutas/sync.ts'

export const VERSION = '0.5.0'

export interface OpcionesApp {
  conexion: Conexion
  corsOrigenes?: string[]
  servirWeb?: boolean
  logger?: boolean
}

/** Construye la API. Separado del arranque para poder probarla con `app.inject()` sin abrir un puerto. */
export async function crearApp(opts: OpcionesApp): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false })
  const { db, motor } = opts.conexion

  await app.register(cors, { origin: opts.corsOrigenes ?? true })
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' })

  await app.register(
    async (api) => {
      api.get('/salud', async () => ({ ok: true, servicio: 'kiosco-api', version: VERSION, baseDeDatos: motor, hora: new Date().toISOString() }))
      rutasBodegas(api, db)
      rutasSync(api, db)
    },
    { prefix: '/api' },
  )

  // La misma imagen sirve la PWA si está compilada: un solo despliegue para todo.
  const carpetaWeb = fileURLToPath(new URL('../../web/dist', import.meta.url))
  if (opts.servirWeb && existsSync(carpetaWeb)) {
    await app.register(fastifyStatic, { root: carpetaWeb, wildcard: true, decorateReply: true })
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'Ruta no encontrada' })
      return reply.sendFile('index.html')
    })
    app.log.info(`Sirviendo la PWA desde ${carpetaWeb}`)
  }

  return app
}
