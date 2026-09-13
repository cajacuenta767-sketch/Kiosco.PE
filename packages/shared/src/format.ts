const nf = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function soles(n: number): string {
  return `S/ ${nf.format(Math.round(n * 100) / 100)}`
}

export function cantidad(n: number, unidad: 'und' | 'kg'): string {
  if (unidad === 'kg') return `${Number(n.toFixed(3))} kg`
  return `${n} und`
}

export function redondear(n: number): number {
  return Math.round(n * 100) / 100
}

export function hoyISO(): string {
  return aDia(new Date())
}

export function aDia(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
}

export function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
}

export function fechaLarga(dia: string): string {
  const [y, m, d] = dia.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })
}

export function diaLabel(dia: string): string {
  const [y, m, d] = dia.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-PE', { weekday: 'short' }).replace('.', '')
}

export function mesLabel(mes: string): string {
  const [y, m] = mes.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })
}
