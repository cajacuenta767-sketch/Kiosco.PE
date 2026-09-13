import type { Tabla } from '@kiosco/shared'
import { ahoraISO } from '@kiosco/shared'
import { db, TABLAS_SYNC } from './db'

type Fila = { id: string; actualizadoEn: string } | { key: string; value: string }

const oyentes = new Set<() => void>()

/** Avisa al motor de sincronización que hay cambios nuevos en la cola. */
export function alEncolar(fn: () => void) {
  oyentes.add(fn)
  return () => oyentes.delete(fn)
}

function idDe(fila: Fila): string {
  return 'id' in fila ? fila.id : fila.key
}

/**
 * Guarda una fila y la deja en la cola para subirla a la nube.
 * Debe llamarse dentro de una transacción que incluya la tabla y `db.cola`.
 */
export async function poner<T extends Fila>(tabla: Tabla, fila: T): Promise<T> {
  const datos = 'id' in fila ? { ...fila, actualizadoEn: fila.actualizadoEn || ahoraISO() } : fila
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (TABLAS_SYNC[tabla]() as any).put(datos)
  await db.cola.add({ tabla, registroId: idDe(datos), datos: datos as unknown as Record<string, unknown>, borrado: false, actualizadoEn: 'actualizadoEn' in datos ? datos.actualizadoEn : ahoraISO() })
  queueMicrotask(() => oyentes.forEach((f) => f()))
  return datos as T
}

/** Borra una fila y anota el borrado para la nube. */
export async function borrar(tabla: Tabla, id: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (TABLAS_SYNC[tabla]() as any).delete(id)
  await db.cola.add({ tabla, registroId: id, datos: null, borrado: true, actualizadoEn: ahoraISO() })
  queueMicrotask(() => oyentes.forEach((f) => f()))
}

/** Pone en cola todo lo que hay localmente (al activar la nube por primera vez). */
export async function encolarTodo() {
  await db.transaction('rw', db.tables, async () => {
    for (const tabla of Object.keys(TABLAS_SYNC) as Tabla[]) {
      if (tabla === 'config') {
        const nombre = await db.config.get('nombreBodega')
        if (nombre) await db.cola.add({ tabla, registroId: nombre.key, datos: nombre as unknown as Record<string, unknown>, borrado: false, actualizadoEn: ahoraISO() })
        continue
      }
      const filas = (await TABLAS_SYNC[tabla]().toArray()) as { id: string; actualizadoEn: string }[]
      for (const f of filas) await db.cola.add({ tabla, registroId: f.id, datos: f as unknown as Record<string, unknown>, borrado: false, actualizadoEn: f.actualizadoEn })
    }
  })
  queueMicrotask(() => oyentes.forEach((f) => f()))
}
