import { abrirNavegador, celular, capturas, reportar, esperar } from './comun.mjs'
const browser = await abrirNavegador()
const errores = []
const page = await celular(browser, 'A', errores)
const shot = (n) => capturas()(page, n)

// Venta rápida sin producto: S/ 2.50 "3 panes" costo 1.50 + 1 Inca Kola, pagar con Yape
await page.getByRole('button', { name: 'Venta rápida' }).click()
await page.getByLabel(/Cuánto cobras/).fill('2.5')
await page.getByPlaceholder(/3 panes/).fill('3 panes')
await page.getByLabel(/Te costó/).fill('1.5')
await shot('20-venta-rapida')
await page.getByRole('button', { name: /^Agregar S\/ 2[.,]50/ }).click()
await page.getByRole('button', { name: /Inca Kola 500ml/ }).click()
await page.getByRole('button', { name: /Cobrar S\/ 5[.,]50/ }).click()
await page.locator('.metodo', { hasText: 'Yape' }).click()
await page.getByRole('button', { name: /^Confirmar/ }).click()
await page.getByText(/Venta registrada · S\/ 5[.,]50/).waitFor()

// Varias ventas para alimentar "más vendidos" y el pedido sugerido
for (let i = 0; i < 3; i++) {
  await page.getByRole('button', { name: /Cerveza Cristal/ }).click()
  await page.getByRole('button', { name: /^Cobrar/ }).click()
  await page.getByRole('button', { name: /^Confirmar/ }).click()
  await page.getByText(/Venta registrada/).waitFor()
  await page.waitForTimeout(150)
}
await page.getByRole('button', { name: /Detergente Bolívar/ }).click()
await page.getByRole('button', { name: /^Cobrar/ }).click()
await page.getByRole('button', { name: /^Confirmar/ }).click()
await page.getByText(/Venta registrada/).waitFor()
await page.getByRole('button', { name: '🔥 Más vendidos' }).click()
await shot('21-mas-vendidos')
const primero = await page.locator('.tarjeta-producto .tp-nombre').first().innerText()
console.log('Más vendido primero:', primero)

// Stock: pedido sugerido
await page.getByRole('button', { name: 'Stock' }).click()
await page.locator('.banner-accion').waitFor()
await shot('22-stock-banner')
await page.locator('.banner-accion').click()
await page.getByText('Pedido sugerido').first().waitFor()
await shot('23-pedido-sugerido')
const pedido = await page.locator('.historial li').allInnerTexts()
console.log('Pedido:', pedido.map((t) => t.replace(/\n/g, ' | ')).join(' || '))
await page.getByRole('button', { name: 'Cerrar', exact: true }).click()

// Caja: gasto + cierre con gasto
await page.getByRole('button', { name: 'Caja' }).click()
await page.getByText('Vendiste').waitFor()
await page.getByRole('button', { name: '+ Anotar gasto' }).click()
await page.getByLabel(/Cuánto salió/).fill('20')
await page.getByRole('button', { name: /Luz \/ agua/ }).click()
await page.getByPlaceholder(/recibo de luz/).fill('Recibo de luz')
await shot('24-gasto')
await page.getByRole('button', { name: /Anotar gasto S\/ 20/ }).click()
await page.getByText(/Gasto de S\/ 20[.,]00 anotado/).waitFor()
await shot('25-caja-con-gasto')
const hero = await page.locator('.hero-sub').innerText()
console.log('Caja:', hero.replace(/\n/g, ' '))
await page.getByRole('button', { name: /Cerrar caja de hoy/ }).click()
await page.getByLabel(/empezaste el día/).fill('100')
const esperado = await page.locator('.modal .nota').innerText()
console.log('Cierre:', esperado)
await page.getByRole('button', { name: 'Cerrar', exact: true }).click()

// Tema oscuro
await page.getByRole('button', { name: 'Más' }).click()
await page.getByRole('button', { name: '🌙 Oscuro' }).click()
await page.waitForTimeout(300)
await shot('26-ajustes-oscuro')
await page.getByRole('button', { name: 'Vender' }).click()
await page.getByText('Inca Kola 500ml').waitFor()
await shot('27-vender-oscuro')
console.log('data-tema:', await page.evaluate(() => document.documentElement.dataset.tema))

// Escáner: abrir (sin cámara en headless → mensaje o vídeo) y usar código manual
await page.getByRole('button', { name: 'Escanear con la cámara' }).click()
await page.getByPlaceholder(/escribe el código/).fill('7750182000017')
await page.getByRole('button', { name: 'Usar' }).click()
await page.getByText(/no está en tu catálogo/).waitFor()
await shot('28-escaner')

esperar(primero === 'Cerveza Cristal 630ml', 'más vendido primero')
esperar(hero.includes('-13.00'), 'ganancia neta descuenta gastos')
esperar(esperado.includes('108.50'), 'cierre descuenta gastos de caja')
reportar(errores)
await browser.close()
