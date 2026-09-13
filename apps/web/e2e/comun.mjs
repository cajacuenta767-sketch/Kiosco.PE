// Utilidades compartidas por las pruebas de navegador. Usan playwright-core con el Chromium que indique CHROME_PATH.
import { chromium } from 'playwright-core'

export const BASE = process.env.E2E_URL ?? 'http://localhost:3001'
const executablePath = process.env.CHROME_PATH || undefined

export async function abrirNavegador() {
  return chromium.launch({ executablePath, args: ['--no-sandbox'] })
}

/** Abre la app en un "celular" nuevo (contexto aislado, IndexedDB propio) y pasa la bienvenida con el catálogo de ejemplo. */
export async function celular(browser, nombre, errores, { conEjemplo = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-PE' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errores.push(`${nombre} pageerror: ${e.message}`))
  // Las respuestas 4xx esperadas (PIN equivocado, sesión cerrada) salen en consola como "Failed to load resource": no son errores de la app.
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push(`${nombre} console: ${m.text()}`) })
  page.on('dialog', (d) => d.accept())
  await page.goto(BASE + '/')
  await page.getByText('¿Cómo se llama tu bodega?').waitFor()
  if (conEjemplo) {
    await page.getByRole('button', { name: 'Empezar con productos de ejemplo' }).click()
    await page.getByText('Inca Kola 500ml').waitFor()
  }
  return page
}

export function capturas(dir = process.env.E2E_SHOTS ?? '') {
  return (page, nombre) => (dir ? page.screenshot({ path: `${dir}/${nombre}.png` }) : Promise.resolve())
}

export function reportar(errores) {
  if (errores.length) {
    console.error('ERRORES:', errores)
    process.exitCode = 1
  } else {
    console.log('Sin errores de consola.')
  }
}

export function esperar(cond, msg) {
  if (!cond) {
    console.error('FALLÓ:', msg)
    process.exitCode = 1
  } else {
    console.log('OK:', msg)
  }
}
