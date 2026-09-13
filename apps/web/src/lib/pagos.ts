import type { MedioPago } from '@kiosco/shared'
import { db } from '../db/db'
import { poner } from '../db/repo'

export type MedioDigital = 'yape' | 'plin'
export const MEDIOS_DIGITALES: { id: MedioDigital; label: string; color: string }[] = [
  { id: 'yape', label: 'Yape', color: '#742284' },
  { id: 'plin', label: 'Plin', color: '#00b0a6' },
]

export function leerMedio(valor?: string): MedioPago {
  if (!valor) return {}
  try {
    return JSON.parse(valor) as MedioPago
  } catch {
    return {}
  }
}

export async function leerMedios(): Promise<Record<MedioDigital, MedioPago>> {
  const filas = await db.config.where('key').startsWith('pago.').toArray()
  const m = Object.fromEntries(filas.map((f) => [f.key, f.value]))
  return { yape: leerMedio(m['pago.yape']), plin: leerMedio(m['pago.plin']) }
}

/** Guarda número, titular y QR de un medio de pago. Viaja a la nube para que el otro celular también lo muestre. */
export async function guardarMedio(id: MedioDigital, medio: MedioPago) {
  const limpio: MedioPago = { numero: medio.numero?.trim() || undefined, titular: medio.titular?.trim() || undefined, qr: medio.qr || undefined }
  await db.transaction('rw', [db.config, db.cola], async () => {
    await poner('config', { key: `pago.${id}`, value: JSON.stringify(limpio) })
  })
}
