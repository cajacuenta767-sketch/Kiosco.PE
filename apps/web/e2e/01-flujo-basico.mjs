import { abrirNavegador, celular, capturas, reportar, esperar } from './comun.mjs'
const browser = await abrirNavegador()
const errores = []
const page = await celular(browser, 'A', errores)
const shot = (n) => capturas()(page, n)
await shot('01-vender')

// Venta en efectivo: 2 Inca Kola + 1 Sublime, paga con 20
await page.getByRole('button', { name: /Inca Kola 500ml/ }).click()
await page.getByRole('button', { name: /Inca Kola 500ml/ }).click()
await page.getByRole('button', { name: /^Sublime/ }).click()
await shot('02-carrito')
await page.getByRole('button', { name: /Cobrar S\/ 8[.,]00/ }).click()
await page.getByRole('button', { name: 'S/ 10', exact: true }).click()
await shot('03-cobrar-efectivo')
await page.getByRole('button', { name: /Confirmar S\/ 8[.,]00/ }).click()
await page.getByText(/Vuelto S\/ 2[.,]00/).waitFor()
await shot('04-toast-vuelto')

// Venta fiada a cliente nuevo
await page.getByRole('button', { name: /Cerveza Pilsen/ }).click()
await page.getByRole('button', { name: /Cobrar S\/ 7[.,]00/ }).click()
await page.locator('.metodo', { hasText: 'Fiado' }).click()
await page.getByPlaceholder(/Sra. Rosa/).fill('Don Pepe (taller)')
await shot('05-cobrar-fiado')
await page.getByRole('button', { name: /Anotar fiado/ }).click()
await page.getByText(/Venta registrada · S\/ 7[.,]00/).waitFor()

// Venta con Yape
await page.getByRole('button', { name: /Arroz Costeño/ }).click()
await page.getByRole('button', { name: /Cobrar/ }).click()
await page.locator('.metodo', { hasText: 'Yape' }).click()
await page.getByRole('button', { name: /^Confirmar/ }).click()
await page.getByText(/Venta registrada · S\/ 2[.,]25/).waitFor()

// Stock: verificar descuento y hacer ingreso
await page.getByRole('button', { name: 'Stock', exact: true }).click()
await page.locator('.kpi', { hasText: 'Por acabarse' }).waitFor()
await shot('06-stock')
await page.getByRole('button', { name: '⚠️ Por acabarse' }).click()
await shot('07-stock-bajo')
const fila = page.locator('.item', { hasText: 'Cerveza Cristal' })
await fila.getByRole('button', { name: /stock/ }).click()
await page.getByLabel(/Cuánto llegó/).fill('12')
await shot('08-ingreso')
await page.getByRole('button', { name: 'Registrar ingreso' }).click()
await page.getByText(/Ingresaste 12/).waitFor()

// Nuevo producto
await page.getByRole('button', { name: '+ Producto' }).click()
await page.getByPlaceholder(/Inca Kola/).fill('Gaseosa Kola Real 1L')
await page.getByLabel('Precio de venta (S/)').fill('3.5')
await page.getByLabel(/Te cuesta/).fill('2.8')
await page.getByLabel(/Stock actual/).fill('10')
await shot('09-nuevo-producto')
await page.getByRole('button', { name: 'Guardar' }).click()
await page.getByText('Producto agregado').waitFor()

// Fiados
await page.getByRole('button', { name: 'Fiados', exact: true }).click()
await page.getByText('Te deben en total').waitFor()
await shot('10-fiados')
await page.getByRole('button', { name: /Don Pepe/ }).click()
await shot('11-fiado-detalle')
await page.getByLabel(/Registrar abono/).fill('3')
await page.getByRole('button', { name: /Abonar S\/ 3[.,]00/ }).click()
await page.getByText(/Abono de S\/ 3[.,]00 registrado/).waitFor()
await shot('12-fiado-abono')
await page.getByRole('button', { name: 'Cerrar' }).click()

// Caja
await page.getByRole('button', { name: 'Caja', exact: true }).click()
await page.getByText('Vendiste').waitFor()
await shot('13-caja')
// Detalle de lo vendido: cada venta con sus productos, filtro por método y tabla producto por producto
esperar((await page.locator('.fila-simple.venta').count()) === 3, 'la caja lista las 3 ventas del día')
esperar((await page.locator('.fila-simple.venta', { hasText: 'Don Pepe' }).count()) === 1, 'la venta fiada muestra a quién se fió')
await page.locator('.mr', { hasText: 'Yape' }).click()
await page.locator('.fila-simple.venta', { hasText: 'Arroz' }).waitFor()
esperar((await page.locator('.fila-simple.venta').count()) === 1, 'tocar Yape deja solo la venta por Yape')
await page.getByRole('button', { name: 'Ver todas' }).click()
await page.getByRole('button', { name: /Ver todo lo vendido/ }).click()
await page.locator('.tabla-vendido').waitFor()
const filaInca = page.locator('.tabla-vendido li', { hasText: 'Inca Kola 500ml' })
esperar((await filaInca.innerText()).replace(/\s+/g, ' ').includes('2 S/ 6.00'), `producto por producto: ${(await filaInca.innerText()).replace(/\s+/g, ' ')}`)
esperar((await page.locator('.tabla-vendido .tv-total').innerText()).includes('S/ 17.25'), 'la tabla suma el total del día')
await shot('13b-todo-lo-vendido')
await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
await page.getByRole('button', { name: /Cerrar caja de hoy/ }).click()
await page.getByLabel(/empezaste el día/).fill('50')
await page.getByLabel(/hay realmente/).fill('58')
await shot('14-cerrar-caja')
await page.getByRole('button', { name: 'Cerrar caja', exact: true }).click()
await page.getByText('Caja cerrada', { exact: true }).first().waitFor()
await shot('15-caja-cerrada')

// Ajustes
await page.getByRole('button', { name: 'Más', exact: true }).click()
await page.getByPlaceholder(/Doña Carmen/).fill('Bodega San Martín')
await page.getByRole('button', { name: 'Guardar' }).click()
await page.getByText('Nombre guardado').waitFor()
await shot('16-ajustes')

// Persistencia tras recarga (IndexedDB)
await page.reload()
await page.getByRole('button', { name: 'Caja', exact: true }).click()
await page.getByText('Caja cerrada', { exact: true }).first().waitFor()
const total = await page.locator('.hero-cifra strong').innerText()
console.log('Total del día tras recarga:', total)

// Tablet / escritorio
await page.setViewportSize({ width: 1024, height: 768 })
await page.getByRole('button', { name: 'Vender', exact: true }).click()
await shot('17-escritorio')

esperar(total === 'S/ 17.25', `total del día persistido tras recargar: ${total}`)
reportar(errores)
await browser.close()
