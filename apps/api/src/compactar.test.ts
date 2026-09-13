import { test } from 'node:test'
import assert from 'node:assert/strict'
import { conectar } from './db/cliente.ts'
import { crearApp } from './app.ts'
import { compactar } from './compactar.ts'

test('compactar conserva solo el último cambio de cada registro', async () => {
  const conexion = await conectar({ rutaPglite: 'memoria' })
  const app = await crearApp({ conexion })
  const reg = JSON.parse((await app.inject({ method: 'POST', url: '/api/v1/bodegas', payload: { nombre: 'X' } })).body)
  const auth = { authorization: `Bearer ${reg.token}` }
  const cambio = (registroId: string, stock: number, hora: string) => ({ tabla: 'productos', registroId, datos: { stock }, borrado: false, actualizadoEn: `2026-09-13T${hora}:00.000Z` })
  await app.inject({ method: 'POST', url: '/api/v1/sync/push', headers: auth, payload: { cambios: [cambio('p1', 10, '10:00'), cambio('p1', 9, '10:01'), cambio('p2', 5, '10:02')] } })
  await app.inject({ method: 'POST', url: '/api/v1/sync/push', headers: auth, payload: { cambios: [cambio('p1', 8, '10:03')] } })
  await app.inject({ method: 'POST', url: '/api/v1/dispositivos/codigo', headers: auth })

  const r = await compactar(conexion.db)
  assert.equal(r.cambiosBorrados, 2)
  assert.equal(r.codigosBorrados, 0) // el código aún no venció

  // Otro celular sigue recibiendo el estado final de cada registro
  const codigo = JSON.parse((await app.inject({ method: 'POST', url: '/api/v1/dispositivos/codigo', headers: auth })).body).codigo
  const b = JSON.parse((await app.inject({ method: 'POST', url: '/api/v1/dispositivos/vincular', payload: { codigo } })).body)
  const pull = JSON.parse((await app.inject({ method: 'GET', url: '/api/v1/sync/pull?desde=0', headers: { authorization: `Bearer ${b.token}` } })).body)
  assert.deepEqual(pull.cambios.map((c: { registroId: string; datos: { stock: number } }) => [c.registroId, c.datos.stock]), [['p2', 5], ['p1', 8]])

  await app.close()
  await conexion.cerrar()
})
