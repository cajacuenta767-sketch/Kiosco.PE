import { abrirNavegador, capturas, reportar, esperar } from './comun.mjs'
import { BASE } from './comun.mjs'
const browser = await abrirNavegador()
const errores = []
const shot = capturas()

// Reloj fijo a las 21:00 de hoy para ver el aviso de cierre de caja
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-PE' })
const page = await ctx.newPage()
page.on('pageerror', (e) => errores.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push('console: ' + m.text()) })
let respuesta // undefined: aceptar con el valor por defecto · string: aceptar con ese texto · null: cancelar
let dialogos = 0
page.on('dialog', (d) => { dialogos++; if (respuesta === null) d.dismiss(); else d.accept(respuesta ?? d.defaultValue()); respuesta = undefined })
const noche = new Date()
noche.setHours(21, 0, 0, 0)
await page.clock.install({ time: noche })
await page.goto(BASE + '/')
await page.getByText('¿Cómo se llama tu bodega?').waitFor()
await page.getByRole('button', { name: 'Empezar con productos de ejemplo' }).click()
await page.getByText('Inca Kola 500ml').waitFor()
const hoy = `${noche.getFullYear()}-${String(noche.getMonth() + 1).padStart(2, '0')}-${String(noche.getDate()).padStart(2, '0')}`
const enDias = (n) => { const d = new Date(noche); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

// ── Sin ventas no hay aviso; con una venta a las 21:00, sí ──
esperar((await page.locator('.aviso-cierre').count()) === 0, 'sin ventas no molesta con el aviso de cierre')
await page.getByRole('button', { name: /Inca Kola 500ml/ }).click()
await page.getByRole('button', { name: /^Cobrar/ }).click()
await page.getByRole('button', { name: /^Confirmar/ }).click()
await page.getByText(/Venta registrada/).waitFor()
await page.locator('.aviso-cierre').waitFor()
await shot(page, '80-aviso-cierre')
esperar(true, 'de noche y con ventas aparece "¿Cerramos la caja?"')
await page.getByRole('button', { name: 'Más tarde' }).click()
await page.locator('.aviso-cierre').waitFor({ state: 'hidden' })
esperar(true, '"Más tarde" lo esconde por hoy')

// ── Vencimiento por lote ──
await page.getByRole('button', { name: 'Stock', exact: true }).click()
esperar((await page.locator('.kpi', { hasText: 'Por vencer' }).count()) === 0, 'sin lotes con fecha no hay tarjeta "Por vencer"')
await page.locator('.item', { hasText: 'Leche Gloria' }).getByRole('button', { name: /stock/ }).click()
await page.getByLabel(/Cuánto llegó/).fill('6')
await page.getByLabel(/Cuándo vence/).fill(enDias(3))
await page.getByRole('button', { name: 'Registrar ingreso' }).click()
await page.getByText(/Ingresaste 6/).waitFor()
await page.locator('.kpi', { hasText: 'Por vencer' }).waitFor()
await page.getByRole('button', { name: '⏰ Por vencer' }).click()
await page.locator('.item', { hasText: 'Leche Gloria' }).waitFor()
const textoLote = await page.locator('.item', { hasText: 'Leche Gloria' }).innerText()
esperar(/Vence en 3 días · ~6 und/.test(textoLote), `el lote aparece con su fecha: ${textoLote.split('\n').find((l) => l.includes('Vence'))}`)
await shot(page, '81-por-vencer')
// Un ingreso lejano no aparece
await page.getByRole('button', { name: 'Todos' }).click()
await page.locator('.item', { hasText: 'Atún Florida' }).getByRole('button', { name: /stock/ }).click()
await page.getByLabel(/Cuánto llegó/).fill('4')
await page.getByLabel(/Cuándo vence/).fill(enDias(90))
await page.getByRole('button', { name: 'Registrar ingreso' }).click()
await page.getByText(/Ingresaste 4/).waitFor()
await page.getByRole('button', { name: '⏰ Por vencer' }).click()
esperar((await page.locator('.item').count()) === 1, 'solo el lote que vence pronto está en "Por vencer"')
// Merma: dar de baja 2
const stockLeche = await page.locator('.item', { hasText: 'Leche Gloria' }).locator('.pill').innerText()
respuesta = '2'
await page.locator('.item', { hasText: 'Leche Gloria' }).getByRole('button', { name: /merma/ }).click()
await page.getByText(/dadas de baja/).waitFor()
const stockLeche2 = await page.locator('.item', { hasText: 'Leche Gloria' }).locator('.pill').innerText()
esperar(stockLeche === '42 und' && stockLeche2 === '40 und', `la merma descuenta del stock (${stockLeche} → ${stockLeche2})`)

// ── Tope de fiado ──
await page.getByRole('button', { name: 'Fiados', exact: true }).click()
await page.getByRole('button', { name: '+ Cliente' }).click()
await page.getByPlaceholder(/Don Pepe/).fill('Sra. Rosa')
await page.getByLabel(/Tope de fiado/).fill('10')
await page.getByRole('button', { name: 'Guardar' }).click()
await page.getByText('Cliente agregado').waitFor()
esperar((await page.locator('.item', { hasText: 'Sra. Rosa' }).locator('.pill').innerText()) === 'tope S/ 10.00', 'el tope se ve en la lista de fiados')
await page.getByRole('button', { name: 'Vender', exact: true }).click()
await page.getByRole('button', { name: /Cerveza Pilsen 630ml/ }).click()
await page.getByRole('button', { name: /^Cobrar/ }).click()
await page.locator('.metodo', { hasText: 'Fiado' }).click()
await page.locator('select').selectOption({ label: 'Sra. Rosa' })
esperar((await page.locator('.modal .nota.texto-ok').innerText()).includes('está al día · tope S/ 10.00'), 'al fiar muestra la deuda y el tope')
await page.getByRole('button', { name: /Anotar fiado/ }).click()
await page.getByText(/Venta registrada/).waitFor()
await page.getByRole('button', { name: /Cerveza Pilsen 630ml/ }).click()
await page.getByRole('button', { name: /^Cobrar/ }).click()
await page.locator('.metodo', { hasText: 'Fiado' }).click()
await page.locator('select').selectOption({ label: 'Sra. Rosa' })
const aviso = await page.locator('.modal .nota.texto-peligro').innerText()
esperar(aviso.includes('ya debe S/ 7.00') && aviso.includes('pasaría su tope'), `avisa que pasaría el tope: ${aviso}`)
await shot(page, '82-tope-fiado')
const antesDialogos = dialogos
respuesta = null
await page.getByRole('button', { name: /Anotar fiado/ }).click()
await page.waitForTimeout(300)
esperar(dialogos === antesDialogos + 1 && (await page.locator('.modal').count()) === 1, 'pide confirmación y, si dice que no, no fía')
await page.getByRole('button', { name: 'Cerrar', exact: true }).click()

// ── Resumen semanal por WhatsApp ──
await page.getByRole('button', { name: 'Caja', exact: true }).click()
const href = await page.locator('a.btn-whatsapp', { hasText: 'resumen de la semana' }).getAttribute('href')
const texto = decodeURIComponent(href.split('text=')[1])
esperar(texto.includes('Vendiste S/ 10.00 en 2 ventas') && texto.includes('Fiaste S/ 7.00'), `resumen semanal: ${texto.split('\n')[2]}`)
await shot(page, '83-caja-resumen')

// ── Micrófono: si el navegador lo soporta, el botón existe y no rompe ──
await page.getByRole('button', { name: 'Vender', exact: true }).click()
const mic = page.getByRole('button', { name: 'Buscar por voz' })
if (await mic.count()) { await mic.click(); await page.waitForTimeout(300); esperar(true, 'el micrófono se puede tocar sin errores') } else esperar(true, 'sin soporte de voz, el botón no aparece')

reportar(errores)
await browser.close()
