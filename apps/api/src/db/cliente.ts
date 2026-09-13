import { fileURLToPath } from 'node:url'
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator'
import { drizzle as drizzleLite, type PgliteDatabase } from 'drizzle-orm/pglite'
import { migrate as migrateLite } from 'drizzle-orm/pglite/migrator'
import { PGlite } from '@electric-sql/pglite'
import pg from 'pg'
import * as schema from './schema.ts'

export type DB = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>

const carpetaMigraciones = fileURLToPath(new URL('../../drizzle', import.meta.url))

export interface Conexion {
  db: DB
  motor: 'postgres' | 'pglite'
  cerrar: () => Promise<void>
}

/**
 * Con DATABASE_URL usa Postgres. Sin ella, usa PGlite: un Postgres embebido que guarda en disco (o en memoria para pruebas).
 * Así la API completa corre en cualquier máquina sin instalar nada.
 */
export async function conectar(opts: { url?: string; rutaPglite?: string | 'memoria' } = {}): Promise<Conexion> {
  const url = opts.url ?? process.env.DATABASE_URL
  if (url) {
    const pool = new pg.Pool({ connectionString: url, max: 10 })
    const db = drizzlePg(pool, { schema })
    await migratePg(db, { migrationsFolder: carpetaMigraciones })
    return { db, motor: 'postgres', cerrar: () => pool.end() }
  }
  const ruta = opts.rutaPglite ?? process.env.PGLITE_DIR ?? './data/kiosco'
  const lite = ruta === 'memoria' ? new PGlite() : new PGlite(ruta)
  const db = drizzleLite(lite, { schema })
  await migrateLite(db, { migrationsFolder: carpetaMigraciones })
  return { db, motor: 'pglite', cerrar: () => lite.close() }
}
