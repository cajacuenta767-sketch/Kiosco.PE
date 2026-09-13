import 'dotenv/config'
import { conectar } from './db/cliente.ts'
import { crearApp } from './app.ts'

const conexion = await conectar()
const app = await crearApp({
  conexion,
  logger: true,
  servirWeb: process.env.SERVIR_WEB !== 'false',
  corsOrigenes: process.env.CORS_ORIGENES ? process.env.CORS_ORIGENES.split(',').map((s) => s.trim()) : undefined,
})

app.log.info(`Base de datos: ${conexion.motor}`)
const puerto = Number(process.env.PORT ?? 3000)
await app.listen({ port: puerto, host: '0.0.0.0' })

for (const señal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(señal, async () => {
    await app.close()
    await conexion.cerrar()
    process.exit(0)
  })
}
