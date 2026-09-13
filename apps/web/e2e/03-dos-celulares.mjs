import { abrirNavegador, celular, capturas, reportar, esperar } from './comun.mjs'
const browser = await abrirNavegador()
const errores = []
const shot = capturas()
const stockDe = async (page, nombre) => (await page.getByRole('button', { name: new RegExp(nombre) }).locator('.tp-stock').innerText())
async function vender(page, producto, metodo = 'efectivo') {
  await page.getByRole('button', { name: 'Vender' }).click()
  await page.getByRole('button', { name: new RegExp(producto) }).click()
  await page.getByRole('button', { name: /^Cobrar/ }).click()
  if (metodo !== 'efectivo') await page.locator('.metodo', { hasText: metodo }).click()
  await page.getByRole('button', { name: /^Confirmar/ }).click()
  await page.getByText(/Venta registrada/).waitFor()
}
async function alDia(page) {
  await page.getByRole('button', { name: 'Más' }).click()
  await page.getByRole('button', { name: /Sincronizar ahora/ }).click()
  await page.locator('.estado-nube strong', { hasText: 'Todo respaldado' }).waitFor({ timeout: 15000 })
}

// ── Celular A: activa la nube ──
const A = await celular(browser, 'A', errores)
await A.getByRole('button', { name: 'Más' }).click()
await A.getByRole('button', { name: /Activar respaldo en la nube/ }).click()
await A.getByPlaceholder(/Doña Carmen/).last().fill('Bodega San Martín')
await shot(A, '30-activar-nube')
await A.getByRole('button', { name: 'Activar y respaldar ahora' }).click()
await A.locator('.estado-nube strong', { hasText: 'Todo respaldado' }).waitFor({ timeout: 20000 })
await shot(A, '31-nube-activa')
console.log('A: nube activa')

// A vende 2 Inca Kola
await vender(A, 'Inca Kola')
await vender(A, 'Inca Kola')
console.log('A: Inca Kola stock', await stockDe(A, 'Inca Kola'))
await alDia(A)

// A genera código
await A.getByRole('button', { name: /Sumar otro celular/ }).click()
try { await A.locator('.codigo-grande').waitFor({ timeout: 10000 }) } catch (e) { await shot(A, 'debug-codigo'); console.log('MODAL:', await A.locator('.modal').innerText().catch(() => 'sin modal')); throw e }
const codigo = (await A.locator('.codigo-grande').innerText()).replace(/\s/g, '')
await shot(A, '32-codigo')
console.log('A: código', codigo)
await A.getByRole('button', { name: 'Cerrar', exact: true }).click()

// ── Celular B: se vincula con el código ──
const B = await celular(browser, 'B', errores)
await B.getByRole('button', { name: 'Más' }).click()
await B.getByRole('button', { name: /segundo celular/ }).click()
await B.getByPlaceholder('000000').fill(codigo)
await shot(B, '33-vincular')
await B.getByRole('button', { name: 'Vincular', exact: true }).click()
await B.locator('.estado-nube strong', { hasText: 'Todo respaldado' }).waitFor({ timeout: 20000 })
await alDia(B)
await B.getByRole('button', { name: 'Vender' }).click()
await B.getByText('Inca Kola 500ml').waitFor()
console.log('B: cabecera', await B.locator('.cabecera h1').innerText())
const stockB = await stockDe(B, 'Inca Kola')
esperar(stockB === '22 und', `B ve el stock de A tras vincular: ${stockB}`)
esperar((await B.locator('.tarjeta-producto').count()) === 28, 'B no duplica el catálogo')
await shot(B, '34-b-vender')

// B vende 1 Inca Kola por Yape y fía a un cliente nuevo
await vender(B, 'Inca Kola', 'Yape')
await B.getByRole('button', { name: /Cerveza Pilsen/ }).click()
await B.getByRole('button', { name: /^Cobrar/ }).click()
await B.locator('.metodo', { hasText: 'Fiado' }).click()
await B.getByPlaceholder(/Sra. Rosa/).fill('Don Pepe (taller)')
await B.getByRole('button', { name: /Anotar fiado/ }).click()
await B.getByText(/Venta registrada/).waitFor()
await alDia(B)

// A baja lo de B
await alDia(A)
await A.getByRole('button', { name: 'Vender' }).click()
esperar((await stockDe(A, 'Inca Kola')) === '21 und', 'A ve la venta de B en el stock')
console.log('A: Pilsen stock tras venta de B', await stockDe(A, 'Cerveza Pilsen'))
await A.getByRole('button', { name: 'Caja' }).click()
console.log('A: caja', (await A.locator('.hero-cifra').innerText()).replace(/\n/g, ' '))
await A.getByRole('button', { name: 'Fiados' }).click()
await A.getByRole('button', { name: /Don Pepe/ }).waitFor()
console.log('A: fiados', (await A.locator('.kpis').innerText()).replace(/\n/g, ' '))
await shot(A, '35-a-fiados-desde-b')

// Anulación en A se refleja en B
await A.getByRole('button', { name: 'Caja' }).click()
await A.locator('.fila-simple.clic').first().click()
await A.getByRole('button', { name: 'Anular venta' }).click()
await A.getByText('Venta anulada').waitFor()
await alDia(A)
await alDia(B)
await B.getByRole('button', { name: 'Caja' }).click()
await B.locator('.fila-simple.clic').first().waitFor()
console.log('B: caja tras anulación en A', (await B.locator('.hero-cifra').innerText()).replace(/\n/g, ' '))
esperar((await B.locator('.fila-simple.clic').count()) === 3, 'B ve 3 ventas tras la anulación hecha en A')

// Estado final: ambos sin pendientes
for (const [n, p] of [['A', A], ['B', B]]) {
  await p.getByRole('button', { name: 'Más' }).click()
  console.log(`${n}: estado`, await p.locator('.estado-nube strong').innerText())
}
esperar(await A.locator('.estado-nube strong').innerText() === 'Todo respaldado', 'A al día')
esperar(await B.locator('.estado-nube strong').innerText() === 'Todo respaldado', 'B al día')
reportar(errores)
await browser.close()
