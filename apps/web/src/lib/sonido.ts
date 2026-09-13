import { getConfig } from '../db/db'

let ctx: AudioContext | null = null

/** Un "tin" corto y agradable al cobrar. Confirma sin mirar la pantalla. */
export async function sonarCobro() {
  if ((await getConfig('sonido', '1')) !== '1') return
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') await ctx.resume()
    const t = ctx.currentTime
    for (const [f, inicio] of [[880, 0], [1320, 0.09]] as const) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = f
      g.gain.setValueAtTime(0.0001, t + inicio)
      g.gain.exponentialRampToValueAtTime(0.25, t + inicio + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t + inicio + 0.18)
      o.connect(g).connect(ctx.destination)
      o.start(t + inicio)
      o.stop(t + inicio + 0.2)
    }
  } catch {
    /* sin audio: no pasa nada */
  }
}
