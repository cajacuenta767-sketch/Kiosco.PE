import { sql } from 'drizzle-orm'
import { bigserial, boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

/**
 * Una bodega = una cuenta. Sin correo: se identifica por el celular de la dueña y un PIN.
 * El PIN se guarda con scrypt; tras 5 intentos fallidos la cuenta se bloquea 15 minutos.
 */
export const bodegas = pgTable(
  'bodegas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nombre: text('nombre').notNull(),
    telefono: text('telefono'),
    pinHash: text('pin_hash'),
    intentosFallidos: integer('intentos_fallidos').notNull().default(0),
    bloqueadoHasta: timestamp('bloqueado_hasta', { withTimezone: true }),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('bodegas_telefono_idx').on(t.telefono).where(sql`${t.telefono} is not null`)],
)

/** Cada celular que sincroniza. El token se guarda hasheado. */
export const dispositivos = pgTable(
  'dispositivos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bodegaId: uuid('bodega_id').notNull().references(() => bodegas.id, { onDelete: 'cascade' }),
    nombre: text('nombre'),
    tokenHash: text('token_hash').notNull(),
    ultimoSync: timestamp('ultimo_sync', { withTimezone: true }),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('dispositivos_token_idx').on(t.tokenHash)],
)

/** Código de 6 dígitos, válido 10 minutos, para vincular otro celular a la misma bodega. */
export const codigosVinculo = pgTable(
  'codigos_vinculo',
  {
    codigo: text('codigo').primaryKey(),
    bodegaId: uuid('bodega_id').notNull().references(() => bodegas.id, { onDelete: 'cascade' }),
    expiraEn: timestamp('expira_en', { withTimezone: true }).notNull(),
    usado: boolean('usado').notNull().default(false),
  },
  (t) => [index('codigos_bodega_idx').on(t.bodegaId)],
)

/**
 * Bitácora de cambios: la unidad de sincronización.
 * Cada fila es "la tabla X, el registro Y, quedó así, a esta hora, desde este dispositivo".
 * El celular sube sus cambios y baja los ajenos a partir de una secuencia. Última escritura gana por registro.
 */
export const cambios = pgTable(
  'cambios',
  {
    secuencia: bigserial('secuencia', { mode: 'number' }).primaryKey(),
    bodegaId: uuid('bodega_id').notNull().references(() => bodegas.id, { onDelete: 'cascade' }),
    dispositivoId: uuid('dispositivo_id').notNull().references(() => dispositivos.id, { onDelete: 'cascade' }),
    tabla: text('tabla').notNull(),
    registroId: text('registro_id').notNull(),
    datos: jsonb('datos'),
    borrado: boolean('borrado').notNull().default(false),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull(),
    recibidoEn: timestamp('recibido_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('cambios_bodega_secuencia_idx').on(t.bodegaId, t.secuencia), index('cambios_registro_idx').on(t.bodegaId, t.tabla, t.registroId)],
)
