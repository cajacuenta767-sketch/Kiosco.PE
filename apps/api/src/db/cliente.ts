import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema.ts'

export type DB = NodePgDatabase<typeof schema>

/** Devuelve la base de datos si hay DATABASE_URL; si no, null y la API corre en modo sin nube. */
export function conectar(): DB | null {
  const url = process.env.DATABASE_URL
  if (!url) return null
  const pool = new pg.Pool({ connectionString: url, max: 10 })
  return drizzle(pool, { schema })
}
