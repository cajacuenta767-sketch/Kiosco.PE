import { lt, notInArray, sql } from 'drizzle-orm'
import type { DB } from './db/cliente.ts'
import { cambios, codigosVinculo } from './db/schema.ts'

/**
 * Mantenimiento de la bitácora: conserva solo el último cambio de cada registro y borra códigos de vínculo vencidos.
 * Es seguro con "última escritura gana": un celular atrasado recibe igual el estado final de cada registro.
 */
export async function compactar(db: DB): Promise<{ cambiosBorrados: number; codigosBorrados: number }> {
  const ultimos = db
    .select({ secuencia: sql<number>`max(${cambios.secuencia})` })
    .from(cambios)
    .groupBy(cambios.bodegaId, cambios.tabla, cambios.registroId)
  const c = await db.delete(cambios).where(notInArray(cambios.secuencia, ultimos)).returning()
  const k = await db.delete(codigosVinculo).where(lt(codigosVinculo.expiraEn, new Date())).returning()
  return { cambiosBorrados: c.length, codigosBorrados: k.length }
}
