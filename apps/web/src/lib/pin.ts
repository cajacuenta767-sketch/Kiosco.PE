import { db, getConfig, setConfig } from '../db/db'

async function hash(pin: string): Promise<string> {
  const datos = new TextEncoder().encode(`sencillo-pin:${pin}`)
  const buf = await crypto.subtle.digest('SHA-256', datos)
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const PIN_VALIDO = /^\d{4}$/

export async function guardarPin(pin: string) {
  if (!PIN_VALIDO.test(pin)) throw new Error('El PIN debe tener 4 números')
  await setConfig('pin', await hash(pin))
}

export async function hayPin(): Promise<boolean> {
  return (await getConfig('pin')) !== ''
}

export async function verificarPin(pin: string): Promise<boolean> {
  const guardado = await getConfig('pin')
  return guardado !== '' && guardado === (await hash(pin))
}

export type Modo = 'duena' | 'ayudante'

export async function cambiarModo(modo: Modo) {
  await db.config.put({ key: 'modo', value: modo })
}
