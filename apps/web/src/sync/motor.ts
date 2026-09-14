import type { Cambio, CambioRecibido, RespuestaPull, RespuestaRegistro, Tabla } from '@sencillo/shared'
import { ahoraISO, redondear } from '@sencillo/shared'
import { db, getConfig, setConfig, TABLAS_SYNC } from '../db/db'
import { alEncolar, encolarTodo } from '../db/repo'

/** Claves de configuración de la nube (no se exportan en el respaldo). */
const K = {
  url: 'nube.url',
  token: 'nube.token',
  bodegaId: 'nube.bodegaId',
  dispositivoId: 'nube.dispositivoId',
  desde: 'nube.desde',
  ultimoSync: 'nube.ultimoSync',
  error: 'nube.error',
  estado: 'nube.estado',
} as const

const LOTE = 200

export function urlPorDefecto(): string {
  const env = (import.meta.env.VITE_API_URL as string | undefined)?.trim()
  if (env) return env.replace(/\/$/, '')
  return `${location.origin}/api`
}

export interface EstadoNube {
  activa: boolean
  url: string
  bodegaId?: string
  ultimoSync?: string
  error?: string
  sincronizando: boolean
}

/** Lee el estado (para useLiveQuery). */
export async function leerEstado(): Promise<EstadoNube> {
  const filas = await db.config.where('key').startsWith('nube.').toArray()
  const m = Object.fromEntries(filas.map((f) => [f.key, f.value]))
  return {
    activa: Boolean(m[K.token]),
    url: m[K.url] || urlPorDefecto(),
    bodegaId: m[K.bodegaId],
    ultimoSync: m[K.ultimoSync],
    error: m[K.error],
    sincronizando: m[K.estado] === 'sincronizando',
  }
}

async function pedir<T>(ruta: string, opts: { metodo?: string; cuerpo?: unknown; token?: string; url?: string } = {}): Promise<T> {
  const base = opts.url ?? (await getConfig(K.url)) ?? urlPorDefecto()
  const token = opts.token ?? (await getConfig(K.token))
  const r = await fetch(`${base}${ruta}`, {
    method: opts.metodo ?? 'GET',
    headers: { ...(opts.cuerpo != null ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: opts.cuerpo != null ? JSON.stringify(opts.cuerpo) : undefined,
  })
  const datos = (await r.json().catch(() => ({}))) as { error?: string }
  if (!r.ok) throw new Error(datos.error || `Error ${r.status} del servidor`)
  return datos as T
}

async function guardarSesion(url: string, s: RespuestaRegistro) {
  await db.transaction('rw', db.config, async () => {
    await setConfig(K.url, url)
    await setConfig(K.token, s.token)
    await setConfig(K.bodegaId, s.bodegaId)
    await setConfig(K.dispositivoId, s.dispositivoId)
    await setConfig(K.desde, '0')
    await setConfig(K.error, '')
    if (s.nombre) await setConfig('nombreBodega', s.nombre)
  })
}

/** Primer celular: crea la cuenta de la bodega en la nube y sube todo lo que ya tiene. */
export async function activarNube(url: string, nombreBodega: string, nombreDispositivo?: string) {
  const s = await pedir<RespuestaRegistro>('/v1/bodegas', { metodo: 'POST', url, cuerpo: { nombre: nombreBodega, dispositivo: nombreDispositivo }, token: '' })
  await guardarSesion(url, s)
  await encolarTodo()
  await sincronizar()
}

/** Primer celular: crea la cuenta con número y PIN para poder entrar desde cualquier otro celular. */
export async function activarNubeConAcceso(url: string, nombreBodega: string, telefono: string, pin: string, nombreDispositivo?: string) {
  const s = await pedir<RespuestaRegistro>('/v1/bodegas', { metodo: 'POST', url, cuerpo: { nombre: nombreBodega, telefono, pin, dispositivo: nombreDispositivo }, token: '' })
  await guardarSesion(url, s)
  await encolarTodo()
  await sincronizar()
}

/** Este celular entra a una bodega que ya existe en la nube. Si solo tenía el catálogo de ejemplo, lo descarta para no duplicar. */
async function entrarABodega(url: string, s: RespuestaRegistro) {
  const soloEjemplo = (await getConfig('catalogoEjemplo')) === '1' && (await db.ventas.count()) === 0
  await db.transaction('rw', db.tables, async () => {
    if (soloEjemplo) {
      await db.productos.clear()
      await db.movimientosStock.clear()
      await db.cola.clear()
      await setConfig('catalogoEjemplo', '')
    }
  })
  await guardarSesion(url, s)
  if (!soloEjemplo) await encolarTodo()
  await sincronizar()
}

/** Segundo celular: canjea el código del primero. */
export async function vincularConCodigo(url: string, codigo: string, nombreDispositivo?: string) {
  const s = await pedir<RespuestaRegistro>('/v1/dispositivos/vincular', { metodo: 'POST', url, cuerpo: { codigo, dispositivo: nombreDispositivo }, token: '' })
  await entrarABodega(url, s)
}

/** Cualquier celular: entra con el número de la bodega y su PIN (por ejemplo, tras perder el celular). */
export async function iniciarSesionNube(url: string, telefono: string, pin: string, nombreDispositivo?: string) {
  const s = await pedir<RespuestaRegistro>('/v1/sesion', { metodo: 'POST', url, cuerpo: { telefono, pin, dispositivo: nombreDispositivo }, token: '' })
  await entrarABodega(url, s)
}

export interface CuentaNube {
  nombre?: string
  telefono: string | null
  tieneAcceso: boolean
  dispositivoId: string
  dispositivos: { id: string; nombre: string | null; esteDispositivo: boolean; ultimoSync: string | null; creadoEn: string }[]
}

export async function leerCuenta(): Promise<CuentaNube> {
  return pedir('/v1/bodegas/actual')
}

export async function configurarAcceso(telefono: string, pin: string) {
  await pedir('/v1/bodegas/actual/acceso', { metodo: 'PUT', cuerpo: { telefono, pin } })
}

export async function cerrarSesionDispositivo(id: string) {
  await pedir(`/v1/dispositivos/${id}`, { metodo: 'DELETE' })
}

export async function generarCodigoVinculo(): Promise<{ codigo: string; minutos: number }> {
  return pedir('/v1/dispositivos/codigo', { metodo: 'POST' })
}

export async function desconectarNube() {
  try {
    await pedir('/v1/dispositivos/actual', { metodo: 'DELETE' })
  } catch {
    /* sin red: igual se desconecta localmente */
  }
  await db.transaction('rw', [db.config, db.cola], async () => {
    await db.config.where('key').startsWith('nube.').delete()
    await db.cola.clear()
  })
}

let enCurso: Promise<void> | null = null
let temporizador: number | undefined

/** Sube lo pendiente y baja lo ajeno. Segura de llamar muchas veces: nunca corre dos a la vez. */
export function sincronizar(): Promise<void> {
  if (enCurso) return enCurso
  enCurso = (async () => {
    if (!(await getConfig(K.token))) return
    if (!navigator.onLine) return
    await setConfig(K.estado, 'sincronizando')
    try {
      await subir()
      await bajar()
      await setConfig(K.ultimoSync, ahoraISO())
      await setConfig(K.error, '')
    } catch (e) {
      await setConfig(K.error, (e as Error).message)
    } finally {
      await setConfig(K.estado, '')
      enCurso = null
    }
  })()
  return enCurso
}

async function subir() {
  for (;;) {
    const pendientes = await db.cola.orderBy('id').limit(LOTE).toArray()
    if (pendientes.length === 0) return
    // Si el mismo registro cambió varias veces, basta con subir el último estado.
    const ultimos = new Map<string, Cambio>()
    for (const p of pendientes) ultimos.set(`${p.tabla}/${p.registroId}`, { tabla: p.tabla, registroId: p.registroId, datos: p.datos, borrado: p.borrado, actualizadoEn: p.actualizadoEn })
    await pedir('/v1/sync/push', { metodo: 'POST', cuerpo: { cambios: [...ultimos.values()] } })
    await db.cola.bulkDelete(pendientes.map((p) => p.id!))
  }
}

async function bajar() {
  for (;;) {
    const desde = Number(await getConfig(K.desde, '0')) || 0
    const r = await pedir<RespuestaPull>(`/v1/sync/pull?desde=${desde}&limite=500`)
    if (r.cambios.length > 0) await aplicar(r.cambios)
    await setConfig(K.desde, String(r.hasta))
    if (!r.hayMas) return
  }
}

/** Aplica cambios ajenos. Última escritura gana, salvo el stock, que se recalcula desde los movimientos. */
async function aplicar(cambios: CambioRecibido[]) {
  await db.transaction('rw', db.tables, async () => {
    const productosTocados = new Set<string>()
    for (const c of cambios) {
      const tabla = TABLAS_SYNC[c.tabla as Tabla]?.()
      if (!tabla) continue
      if (c.tabla === 'config') {
        const compartida = c.registroId === 'nombreBodega' || c.registroId.startsWith('pago.')
        if (!c.borrado && compartida && c.datos) await db.config.put({ key: c.registroId, value: String(c.datos.value ?? '') })
        continue
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const t = tabla as any
      const local = (await t.get(c.registroId)) as { actualizadoEn?: string; stock?: number } | undefined
      if (c.borrado) {
        if (local) await t.delete(c.registroId)
        if (c.tabla === 'movimientosStock' && local) productosTocados.add((local as { productoId?: string }).productoId ?? '')
        continue
      }
      if (!c.datos) continue
      if (local?.actualizadoEn && local.actualizadoEn > c.actualizadoEn) continue // lo local es más nuevo
      const datos = { ...c.datos }
      if (c.tabla === 'productos') {
        datos.stock = local?.stock ?? 0 // el stock se reconstruye abajo
        productosTocados.add(c.registroId)
      }
      if (c.tabla === 'movimientosStock') productosTocados.add(String(datos.productoId ?? ''))
      await t.put(datos)
    }
    for (const id of productosTocados) {
      if (!id) continue
      const p = await db.productos.get(id)
      if (!p) continue
      const movs = await db.movimientosStock.where('productoId').equals(id).toArray()
      const stock = redondear(movs.reduce((s, m) => s + m.cantidad, 0))
      if (stock !== p.stock) await db.productos.put({ ...p, stock })
    }
  })
}

function programar(ms = 2500) {
  window.clearTimeout(temporizador)
  temporizador = window.setTimeout(() => void sincronizar(), ms)
}

/** Arranca los disparadores: al iniciar, al volver la red, cada 45 s y poco después de cada cambio local. */
export function iniciarSync() {
  const quitar = alEncolar(() => programar())
  const alVolver = () => programar(500)
  window.addEventListener('online', alVolver)
  const cada = window.setInterval(() => void sincronizar(), 45_000)
  programar(1000)
  return () => {
    quitar()
    window.removeEventListener('online', alVolver)
    window.clearInterval(cada)
    window.clearTimeout(temporizador)
  }
}
