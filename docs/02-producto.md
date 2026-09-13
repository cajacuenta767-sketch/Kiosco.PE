# 02 · El producto

## Principios de diseño (innegociables)

1. **Tres toques o menos para cobrar.** Si un flujo frecuente toma más, está mal diseñado.
2. **Cero jerga.** No decimos "inventario", decimos "stock". No decimos "cuentas por cobrar", decimos "te deben".
   No decimos "margen bruto", decimos "ganas S/ 0.70 por unidad".
3. **El dato importante, grande.** Cada pantalla tiene una sola cifra protagonista: el total a cobrar,
   cuánto te deben, cuánto vendiste hoy.
4. **Botones para dedos, no para cursores.** Mínimo 44 px de alto. Nada de menús ocultos.
5. **Funciona sin internet, siempre.** No hay estado "sin conexión". Simplemente funciona.
6. **Nunca pierde una venta.** Cada acción se guarda al instante. Recargar, cerrar la app o quedarse sin batería no borra nada.
7. **Confirma con lenguaje humano.** "Venta registrada · Vuelto S/ 2.00", no "Operación exitosa".

## Los módulos

### 👋 Bienvenida (solo la primera vez)
- Nombre de la bodega y tres caminos: empezar con 28 productos de ejemplo, empezar desde cero, o vincular este celular a una bodega que ya usa Kiosco.PE.
- Sin cuenta, sin correo, sin permisos. En 10 segundos está vendiendo.

### 🛒 Vender
- Cuadrícula de productos con nombre, precio y stock visible. Los que se acaban se ven en ámbar; los agotados, en rojo.
- Búsqueda instantánea por nombre o código de barras (un lector USB/Bluetooth escribe el código y Enter agrega el producto).
- Chips de categoría para llegar rápido a Bebidas, Abarrotes, Golosinas…
- Toque para agregar; toque de nuevo para sumar uno. Productos por kilo suman de 0.25 en 0.25 y se editan a mano.
- **Cobrar:** elige método (Efectivo / Yape / Plin / Tarjeta / Fiado).
  - Efectivo: botones rápidos con los billetes que cubren el total (S/ 10, 20, 50…) y el vuelto en grande.
  - Fiado: elige un cliente o escribe uno nuevo. Se crea y queda registrado en el mismo gesto.
- Al confirmar: descuenta stock, guarda la venta, anota el fiado. Todo en una sola transacción.

### 📦 Stock
- Tres números arriba: cuántos productos tienes, cuántos están **por acabarse**, cuántos **agotados**. Tocar filtra.
- Cuánto dinero tienes invertido en mercadería y cuánto valdría vendido.
- Cada producto muestra cuánto ganas por unidad (en soles y en %). Si el precio de compra supera el de venta, la app avisa.
- **Últimos movimientos** de cada producto (venta, ingreso, ajuste, merma) al editarlo: responde "¿por qué tengo 3 si ayer tenía 10?".
- **＋ stock:** ingreso de mercadería en dos campos: cuánto llegó y a cuánto te lo dejaron. Si el proveedor subió el precio,
  se actualiza aquí y la ganancia se recalcula sola.
- Editar el stock a mano se registra como ajuste (conteo físico), para que el historial cuadre.

### 📒 Fiados
- Arriba: cuánto te deben en total y cuántos clientes deben. Es la primera cifra que el bodeguero quiere ver.
- Lista ordenada por deuda. Cada cliente muestra su último movimiento.
- Detalle del cliente: deuda en grande, registrar abono (parcial o "pagó todo"), historial completo con qué se llevó.
- **Fecha de pago acordada** por cliente: la lista marca "paga hoy" o "venció".
- **Recordar por WhatsApp:** un toque abre WhatsApp con el mensaje listo: "Hola Don Pepe, le escribo de Bodega San Martín.
  Su cuenta pendiente es de S/ 7.00. ¡Gracias!". Cordial, sin incomodar, y funciona.

### 💰 Caja
- Cifra protagonista: cuánto vendiste hoy y, debajo, **cuánto ganaste** y cuántas ventas.
- Desglose por método de pago: cuánto hay en efectivo, cuánto entró por Yape, cuánto se fió.
- Gráfico de los últimos 7 días, con el total vendido y ganado en la semana.
- Lo más vendido del día.
- Lista de ventas del día. Tocar una muestra el detalle, permite enviar un **comprobante por WhatsApp** y anularla (el stock vuelve y el fiado se borra).
- **Resumen del mes:** vendido, ganancia neta, gastos, promedio diario, mejor día, fiado otorgado y cobrado, lo más vendido.
- **Gastos del día** con categoría y si salieron de caja. La ganancia mostrada es neta de gastos del negocio (luz, pasajes, personal); los pagos a proveedores no la bajan porque son mercadería ya descontada como costo en cada venta, pero sí cuentan para el cuadre de caja.
- **Cerrar caja:** con cuánto empezaste + ventas en efectivo = cuánto deberías tener. Ingresas cuánto hay y ves si cuadra,
  falta o sobra. Queda registrado por día.
- Navegación por días para revisar cualquier fecha pasada.

### ☁️ Nube (dentro de Más)
- Activar respaldo con el nombre de la bodega: sin contraseña, este celular queda como el primero.
- Sumar otro celular con un código de 6 dígitos que vale 10 minutos. Los dos venden sobre el mismo stock.
- Estado siempre visible: todo respaldado, cambios por subir, o sin conexión (y sigue funcionando).

### ⚙️ Más
- Nombre de la bodega (se usa en los mensajes de WhatsApp).
- Respaldo: descarga un archivo con todo. Restaurar: súbelo en otro celular y sigues donde estabas.
- Cargar catálogo de ejemplo / borrar todo.

## Flujos críticos medidos

| Flujo | Toques | Tiempo objetivo |
|---|---|---|
| Vender 1 producto en efectivo con vuelto | 3 (producto → Cobrar → billete → Confirmar = 4 con vuelto; 3 si es exacto) | < 5 s |
| Fiar a un cliente existente | 4 | < 8 s |
| Registrar que llegó mercadería | 3 | < 10 s |
| Ver cuánto te deben | 1 | < 1 s |
| Cerrar caja | 3 | < 30 s |

## Lo que deliberadamente NO hace (todavía)

- No pide correo ni contraseña, ni siquiera para la nube.
- No emite boletas electrónicas. Primero cobrar bien; SUNAT viene en la Fase 3.
- No tiene múltiples usuarios ni permisos. Es la bodega de una persona.
- No tiene informes en PDF ni exportación a Excel. El bodeguero quiere ver la cifra, no imprimirla.

Cada una de estas es una decisión. Se revierten cuando 10 bodegas reales las pidan, no antes.
