# 04 · Hoja de ruta y mejoras propuestas

## Fase 0 · MVP funcional ✅ (esta entrega)

- Vender, Stock, Fiados, Caja, Ajustes.
- Offline total, instalable como app.
- Catálogo de ejemplo con productos reales de bodega.
- Respaldo y restauración.
- Probado de punta a punta en navegador: venta con vuelto, fiado a cliente nuevo, Yape, ingreso de mercadería,
  producto nuevo, abono, cierre de caja, persistencia tras recarga.

## Fase 1 · Validación en la calle (2 a 4 semanas)

Objetivo: **10 bodegas en Lima usándolo a diario**, con el catálogo cargado por nosotros en persona.

Qué medir (sin preguntar, observando):
- Segundos por venta comparado con calculadora.
- ¿Registran los fiados? ¿Todos o solo los grandes?
- ¿Abren la pestaña Caja al final del día?
- ¿Qué producto no encuentran y cómo lo buscan?

Mejoras que casi seguro saldrán de ahí y ya están pensadas:
- **Botón "venta rápida sin producto":** escribir S/ 2.50 y cobrar, para lo que no está en el catálogo. Sin esto, el bodeguero
  deja de usar la app en hora punta.
- **Favoritos / más vendidos primero** en la cuadrícula de Vender.
- **Precios múltiples:** unidad y paquete (una Inca Kola a S/ 3, el six-pack a S/ 16).
- **Modo oscuro** para bodegas que atienden de noche.

## Fase 2 · Lo que hace que se quede (1 a 2 meses)

- **Escáner de código de barras con la cámara** (BarcodeDetector API / ZXing). Sin lector externo.
- **Catálogo maestro peruano:** los 2 000 productos más vendidos con código de barras y precio sugerido.
  Escaneas la Inca Kola y ya está creada. Esto convierte la carga inicial de 2 horas en 10 minutos.
- **Respaldo automático en la nube** (opcional, con cuenta). El respaldo manual queda para quien no quiera cuenta.
- **Alertas útiles:** "Mañana es lunes y te quedan 4 Pilsen" según la rotación de la semana pasada.
- **Sugerencia de pedido:** lista de lo que hay que reponer, calculada con ventas de los últimos 14 días, lista para enviar
  al proveedor por WhatsApp.
- **Fiados con fecha de pago acordada** y recordatorio automático el día que toca.
- **Gastos:** anotar lo que sale de caja (pasaje, luz, compra a proveedor) para que el cierre cuadre de verdad
  y la ganancia neta sea real.

## Fase 3 · Formalización y crecimiento (3 a 6 meses)

- **Boleta electrónica SUNAT** mediante un proveedor de servicios electrónicos (PSE) integrado. Se emite desde la
  pantalla de cobro con un toque extra, solo cuando el cliente la pide.
- **Multi-dispositivo:** el hijo atiende con su celular, la mamá revisa la caja desde el suyo.
- **Panel web** para ver la bodega desde una computadora.
- **Integración con Yape/Plin para negocios:** conciliación automática de lo que entró.
- **Pedidos a distribuidores** desde la app (Backus, Alicorp, Gloria tienen canales digitales para bodegas).

## Modelo de negocio

**Gratis lo esencial, para siempre.** Vender, stock, fiados y caja no se cobran nunca. Es la única forma de llegar a medio
millón de bodegas y ganarse su confianza.

Se cobra por lo que genera o protege dinero directamente, con un precio que la bodega recupera el primer día:

| Plan | Precio referencial | Incluye |
|---|---|---|
| Bodega | Gratis | Todo lo de la Fase 0 y 1 |
| Bodega Pro | S/ 15 / mes | Respaldo en nube, multi-dispositivo, sugerencia de pedidos, recordatorios automáticos de fiados |
| Bodega Formal | S/ 29 / mes | Pro + boletas electrónicas SUNAT ilimitadas |

Ingresos adicionales a mediano plazo, sin cobrarle al bodeguero: comisiones de distribuidores por pedidos canalizados
y datos agregados y anónimos de rotación por zona (lo que las marcas pagan hoy a encuestadoras).

## Canal de adquisición

El bodeguero no busca apps. Aprende de la bodega de al lado.

1. **Primeras 100 bodegas a mano**, barrio por barrio, instalando en persona. Cada instalación toma 15 minutos con el catálogo maestro.
2. **Referidos:** "Pásale la app a otra bodega y ambos reciben un mes de Pro".
3. **Distribuidores como aliados:** el preventista de gaseosas visita 60 bodegas por semana. Si la app le simplifica el pedido, él la instala.
4. **Contenido corto en TikTok/YouTube:** "cuánto pierde tu bodega por los fiados olvidados", con el gancho de la primera pantalla.

## Riesgos y cómo se mitigan

| Riesgo | Mitigación |
|---|---|
| El bodeguero no registra todo y los números no cuadran | Venta rápida sin producto; la app es útil aunque se use al 60 % |
| Cambio de celular = pérdida de datos | Respaldo manual hoy; automático en Fase 2 con recordatorio semanal |
| Un competidor grande (Yape, Rappi, Alicorp) lanza algo similar | Ventaja del que llega primero con la comunidad; ellos venden su producto, nosotros el orden de la bodega |
| Baja alfabetización digital | Diseño sin jerga, botones grandes, catálogo precargado, instalación asistida |

## Próximo paso concreto

Publicar `dist/` en un hosting estático gratuito (Netlify, Vercel, Cloudflare Pages), abrirlo en un Android de gama media,
instalarlo como app, y llevarlo a la primera bodega. Sin encuestas: mirar cómo lo usa y anotar dónde se traba.
