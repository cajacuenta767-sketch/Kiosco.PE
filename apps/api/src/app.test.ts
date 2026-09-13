import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import type { FastifyInstance } from 'fastify'
import { conectar, type Conexion } from './db/cliente.ts'
import { crearApp } from './app.ts'

let app: FastifyInstance
let conexion: Conexion

before(async () => {
  conexion = await conectar({ rutaPglite: 'memoria' })
  app = await crearApp({ conexion })
})
after(async () => {
  await app.close()
  await conexion.cerrar()
})

const json = (r: { body: string }) => JSON.parse(r.body)

test('salud responde con el motor de base de datos', async () => {
  const r = await app.inject({ method: 'GET', url: '/api/salud' })
  assert.equal(r.statusCode, 200)
  assert.equal(json(r).baseDeDatos, 'pglite')
})

test('flujo completo: registrar bodega, vincular segundo celular, push y pull', async () => {
  // Celular A crea la cuenta
  const reg = await app.inject({ method: 'POST', url: '/api/v1/bodegas', payload: { nombre: 'Bodega San Martín', dispositivo: 'Celular A' } })
  assert.equal(reg.statusCode, 201)
  const a = json(reg)
  assert.match(a.token, /^kp_/)

  // Sin token no se puede sincronizar
  const sinToken = await app.inject({ method: 'POST', url: '/api/v1/sync/push', payload: { cambios: [] } })
  assert.equal(sinToken.statusCode, 401)

  // A sube una venta y un producto
  const push = await app.inject({
    method: 'POST',
    url: '/api/v1/sync/push',
    headers: { authorization: `Bearer ${a.token}` },
    payload: {
      cambios: [
        { tabla: 'productos', registroId: 'p1', datos: { nombre: 'Inca Kola', precioVenta: 3 }, borrado: false, actualizadoEn: '2026-09-13T10:00:00.000Z' },
        { tabla: 'ventas', registroId: 'v1', datos: { total: 3 }, borrado: false, actualizadoEn: '2026-09-13T10:01:00.000Z' },
      ],
    },
  })
  assert.equal(push.statusCode, 200)
  assert.equal(json(push).recibidos, 2)

  // A no recibe sus propios cambios
  const pullA = await app.inject({ method: 'GET', url: '/api/v1/sync/pull?desde=0', headers: { authorization: `Bearer ${a.token}` } })
  assert.equal(json(pullA).cambios.length, 0)

  // A genera un código y B lo canjea
  const cod = await app.inject({ method: 'POST', url: '/api/v1/dispositivos/codigo', headers: { authorization: `Bearer ${a.token}` } })
  assert.equal(cod.statusCode, 201)
  const codigo = json(cod).codigo
  assert.match(codigo, /^\d{6}$/)
  const vinc = await app.inject({ method: 'POST', url: '/api/v1/dispositivos/vincular', payload: { codigo, dispositivo: 'Celular B' } })
  assert.equal(vinc.statusCode, 201)
  const b = json(vinc)
  assert.equal(b.bodegaId, a.bodegaId)
  assert.equal(b.nombre, 'Bodega San Martín')

  // El código no se puede usar dos veces
  const repetido = await app.inject({ method: 'POST', url: '/api/v1/dispositivos/vincular', payload: { codigo } })
  assert.equal(repetido.statusCode, 404)

  // B baja los cambios de A
  const pullB = await app.inject({ method: 'GET', url: '/api/v1/sync/pull?desde=0', headers: { authorization: `Bearer ${b.token}` } })
  const rb = json(pullB)
  assert.equal(rb.cambios.length, 2)
  assert.equal(rb.cambios[0].registroId, 'p1')
  assert.equal(rb.hasta, 2)
  assert.equal(rb.hayMas, false)

  // B sube un cambio, A lo recibe desde su última secuencia
  await app.inject({
    method: 'POST',
    url: '/api/v1/sync/push',
    headers: { authorization: `Bearer ${b.token}` },
    payload: { cambios: [{ tabla: 'gastos', registroId: 'g1', datos: { monto: 20 }, borrado: false, actualizadoEn: '2026-09-13T11:00:00.000Z' }] },
  })
  const pullA2 = await app.inject({ method: 'GET', url: '/api/v1/sync/pull?desde=0', headers: { authorization: `Bearer ${a.token}` } })
  assert.deepEqual(json(pullA2).cambios.map((c: { registroId: string }) => c.registroId), ['g1'])

  // Los dispositivos se ven en la cuenta
  const yo = await app.inject({ method: 'GET', url: '/api/v1/bodegas/actual', headers: { authorization: `Bearer ${a.token}` } })
  assert.equal(json(yo).dispositivos.length, 2)

  // Otra bodega no ve nada de esta
  const otra = json(await app.inject({ method: 'POST', url: '/api/v1/bodegas', payload: { nombre: 'Otra' } }))
  const pullOtra = await app.inject({ method: 'GET', url: '/api/v1/sync/pull?desde=0', headers: { authorization: `Bearer ${otra.token}` } })
  assert.equal(json(pullOtra).cambios.length, 0)

  // Desconectar B: su token muere
  const del = await app.inject({ method: 'DELETE', url: '/api/v1/dispositivos/actual', headers: { authorization: `Bearer ${b.token}` } })
  assert.equal(del.statusCode, 200)
  const muerto = await app.inject({ method: 'GET', url: '/api/v1/sync/pull?desde=0', headers: { authorization: `Bearer ${b.token}` } })
  assert.equal(muerto.statusCode, 401)
})

test('push rechaza tablas desconocidas', async () => {
  const reg = json(await app.inject({ method: 'POST', url: '/api/v1/bodegas', payload: { nombre: 'X' } }))
  const r = await app.inject({
    method: 'POST',
    url: '/api/v1/sync/push',
    headers: { authorization: `Bearer ${reg.token}` },
    payload: { cambios: [{ tabla: 'usuarios', registroId: '1', datos: {}, borrado: false, actualizadoEn: '2026-09-13T10:00:00.000Z' }] },
  })
  assert.equal(r.statusCode, 400)
})

test('login con número y PIN: entra, bloquea tras 5 fallos y permite cerrar sesión de otro celular', async () => {
  const reg = await app.inject({ method: 'POST', url: '/api/v1/bodegas', payload: { nombre: 'Bodega Carmen', telefono: '987654321', pin: '2468', dispositivo: 'Celular A' } })
  assert.equal(reg.statusCode, 201)
  const a = json(reg)

  // El mismo número no puede registrar otra bodega
  const dup = await app.inject({ method: 'POST', url: '/api/v1/bodegas', payload: { nombre: 'Otra', telefono: '987654321', pin: '1111' } })
  assert.equal(dup.statusCode, 409)

  // Número sin PIN no vale
  const sinPin = await app.inject({ method: 'POST', url: '/api/v1/bodegas', payload: { nombre: 'X', telefono: '911111111' } })
  assert.equal(sinPin.statusCode, 400)

  // Entrar desde el celular B
  const mal = await app.inject({ method: 'POST', url: '/api/v1/sesion', payload: { telefono: '987654321', pin: '0000' } })
  assert.equal(mal.statusCode, 401)
  assert.equal(json(mal).intentosRestantes, 4)
  const ok = await app.inject({ method: 'POST', url: '/api/v1/sesion', payload: { telefono: '987654321', pin: '2468', dispositivo: 'Celular B' } })
  assert.equal(ok.statusCode, 201)
  const b = json(ok)
  assert.equal(b.bodegaId, a.bodegaId)
  assert.equal(b.nombre, 'Bodega Carmen')

  // La cuenta muestra el número enmascarado y los dos celulares
  const yo = json(await app.inject({ method: 'GET', url: '/api/v1/bodegas/actual', headers: { authorization: `Bearer ${a.token}` } }))
  assert.equal(yo.telefono, '987 *** 321')
  assert.equal(yo.tieneAcceso, true)
  assert.equal(yo.dispositivos.length, 2)

  // A cierra la sesión de B: el token de B muere
  const otro = yo.dispositivos.find((d: { esteDispositivo: boolean }) => !d.esteDispositivo)
  const cierre = await app.inject({ method: 'DELETE', url: `/api/v1/dispositivos/${otro.id}`, headers: { authorization: `Bearer ${a.token}` } })
  assert.equal(cierre.statusCode, 200)
  const muerto = await app.inject({ method: 'GET', url: '/api/v1/sync/pull?desde=0', headers: { authorization: `Bearer ${b.token}` } })
  assert.equal(muerto.statusCode, 401)
  // No puede cerrarse a sí mismo por esta ruta
  const propio = await app.inject({ method: 'DELETE', url: `/api/v1/dispositivos/${a.dispositivoId}`, headers: { authorization: `Bearer ${a.token}` } })
  assert.equal(propio.statusCode, 400)

  // Cambiar número y PIN desde dentro
  const cambio = await app.inject({ method: 'PUT', url: '/api/v1/bodegas/actual/acceso', headers: { authorization: `Bearer ${a.token}` }, payload: { telefono: '999888777', pin: '135790' } })
  assert.equal(cambio.statusCode, 200)
  const viejo = await app.inject({ method: 'POST', url: '/api/v1/sesion', payload: { telefono: '987654321', pin: '2468' } })
  assert.equal(viejo.statusCode, 401)
  const nuevo = await app.inject({ method: 'POST', url: '/api/v1/sesion', payload: { telefono: '999888777', pin: '135790' } })
  assert.equal(nuevo.statusCode, 201)

  // Bloqueo tras 5 intentos fallidos
  for (let i = 0; i < 5; i++) await app.inject({ method: 'POST', url: '/api/v1/sesion', payload: { telefono: '999888777', pin: '0000' } })
  const bloqueado = await app.inject({ method: 'POST', url: '/api/v1/sesion', payload: { telefono: '999888777', pin: '135790' } })
  assert.equal(bloqueado.statusCode, 423)
  assert.match(json(bloqueado).error, /Espera/)
})
