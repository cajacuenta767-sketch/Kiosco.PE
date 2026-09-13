# 07 · Ideas para que lo use la señora de la bodega

Regla para evaluar cada idea: **¿la señora Carmen, 58 años, que usa WhatsApp y nada más, lo entiende sin que nadie le explique?**
Si hay que explicarlo, no va. Cada idea tiene su estado y por qué está o no está.

## Ya está en la app (v0.5)

| Idea | Por qué ayuda | Estado |
|---|---|---|
| **Dibujos en cada producto, solos** | Reconoce la Inca Kola por el 🥤 antes de leer. Sin configurar nada. | ✅ Automático por nombre y categoría |
| **Foto del producto con un toque** | "📷 Tomar foto" abre la cámara. La foto se guarda chiquita, no pesa. | ✅ |
| **Elegir un ícono a mano** | Para lo que la app no adivina. 40 dibujos, un toque. | ✅ |
| **Bodega de ejemplo con movimiento** | En la primera demostración ya se ve cómo se vería *su* bodega: dos semanas de ventas, fiados, gastos y cierres. | ✅ Desde la bienvenida o desde Más |
| **Deshacer la última venta** | Se equivocó de producto: toca "Deshacer" y el stock vuelve. Sin buscar en Caja. | ✅ 6 segundos después de cobrar |
| **Sonido al cobrar** | Un "tin" confirma sin mirar la pantalla, como la caja registradora. | ✅ Se apaga en Más |
| **Letra grande** | Muchas bodegueras no usan lentes en el mostrador. | ✅ Un toque en Más |
| **"¿Cómo se usa?" en cada pantalla** | El botón "?" arriba muestra 4 pasos con dibujos, sin palabras técnicas. | ✅ |
| **Modo ayudante con PIN** | Su hijo o sobrina atiende y vende, pero no ve cuánto gana ni cambia precios. Vuelve a modo dueña con 4 números. | ✅ |
| Venta rápida sin producto, vuelto automático, fiados con WhatsApp, pedido al proveedor, cierre de caja | Ver `02-producto.md` | ✅ |

| **QR de Yape y Plin al cobrar** | Sube la captura de su QR y su número una vez. Al cobrar con Yape o Plin, un toque lo muestra en grande con el monto: gira el celular y el cliente escanea. Se comparte con el segundo celular. | ✅ v0.6 |
| **"Lo de siempre" por cliente** | El botón 👤 en Vender: toca al cliente y su compra habitual entra al carrito. Se aprende sola de lo que fía (lo que se lleva en la mayoría de sus compras, con su cantidad típica). | ✅ v0.6 |
| **Precios por paquete** | Six-pack, docena, caja: un botoncito debajo del precio. Cobra el precio del paquete y descuenta las unidades del stock. | ✅ v0.6 |
| **Lista de precios con dibujos** | Un botón en Stock: por WhatsApp, impresa para la pared, o copiada. Incluye los paquetes. | ✅ v0.6 |

## Siguientes, en orden de valor para ella

1. **Calculadora de vuelto sin registrar venta.** Para cuando vende algo que no quiere anotar. Un botón "Vuelto" arriba, escribe total y con cuánto pagan.
2. **Recordatorio de cierre de caja.** A la hora que ella elija, la app le recuerda cerrar caja. Necesita notificaciones (Fase 3) o, más simple, un aviso al abrir la app después de las 9 p. m.
3. **Fechas de vencimiento por lote.** Ingresa mercadería con fecha; la app avisa "el yogur vence en 3 días, véndelo primero". Merma evitada = ganancia.
4. **Buscar por voz.** El micrófono del teclado ya funciona en el buscador, pero un botón grande "🎤" en Vender lo hace evidente para quien no escribe rápido.
5. **Cuenta regresiva de crédito.** Al fiar, mostrar "Rosa ya debe S/ 45, su tope es S/ 50". Evita el fiado que después no se cobra.
6. **Resumen semanal por WhatsApp a ella misma.** Los domingos, un mensaje: "Esta semana vendiste S/ 2 340 y ganaste S/ 410. Lo que más salió: Pilsen". Sin abrir la app.
7. **Catálogo maestro peruano con códigos de barras.** Escanea y el producto ya viene con nombre, foto y precio sugerido. Convierte 2 horas de carga en 10 minutos.

## Lo que NO conviene, aunque suene bien

- **Login con correo y contraseña.** Se olvida, se bloquea, se pierde la cuenta. Kiosco.PE usa nombre + código de 6 dígitos.
- **Reportes en PDF o Excel.** La señora quiere ver la cifra, no imprimirla. Cuando lo pida un contador, se exporta el JSON.
- **Muchas categorías, marcas, proveedores, almacenes.** Es un solo mostrador. La complejidad se paga en abandono.
- **Chatbot o asistente con IA dentro de la app.** Otra cosa que aprender. La app debe responder sola con números grandes.
- **Notificaciones de marketing.** Nada de "¡Vuelve a vender!". Solo avisos que le hagan ganar o no perder plata.

## Cómo probar cada idea antes de programarla

Llevar el celular a tres bodegas distintas. No preguntar "¿te gustaría…?". Ponerlo en el mostrador y mirar:
¿Lo toca sin que le digan? ¿Lo vuelve a usar en la segunda visita? Si no, la idea muere, aunque sea bonita.
