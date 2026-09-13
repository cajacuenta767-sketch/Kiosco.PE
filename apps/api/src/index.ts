import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { conectar } from './db/cliente.ts'
import { rutasBodegas } from './rutas/bodegas.ts'
import { rutasSync } from './rutas/sync.ts'

const app = Fastify({ logger: true })
const db = conectar()

await app.register(cors, {
  origin: (process.env.CORS_ORIGENES ?? 'http://localhost:5173').split(',').map((s) => s.trim()),
})

app.get('/salud', async () => ({ ok: true, servicio: 'kiosco-api', version: '0.2.0', baseDeDatos: db !== null, hora: new Date().toISOString() }))

if (db) {
  rutasBodegas(app, db)
  rutasSync(app, db)
} else {
  app.log.warn('Sin DATABASE_URL: la API corre sin base de datos. Solo /salud está disponible.')
  app.all('/v1/*', async (_req, reply) => reply.code(503).send({ error: 'La nube no está configurada en este servidor' }))
}

const puerto = Number(process.env.PORT ?? 3000)
await app.listen({ port: puerto, host: '0.0.0.0' })
