# Kiosco.PE — Tu bodega en orden

**Ventas, stock y fiados para las bodegas del Perú. Funciona sin internet, desde el celular del bodeguero.**

> En el Perú hay más de 500 000 bodegas. Casi todas se administran con un cuaderno, una calculadora y la memoria.
> El bodeguero no sabe cuánto gana. No sabe qué se le está acabando hasta que un cliente se lo pide. Y el cuaderno de fiados
> se pierde, se moja o se olvida. Kiosco.PE reemplaza el cuaderno con algo tan simple como WhatsApp.

## Qué hace hoy (v0.1)

| Módulo | Qué resuelve |
|---|---|
| **Vender** | Cobrar en 3 toques. Productos en cuadrícula, búsqueda, calculadora de vuelto, Efectivo / Yape / Plin / Tarjeta / Fiado. |
| **Stock** | Qué tienes, qué se acaba, qué está agotado. Ingreso de mercadería, precio de compra y ganancia por producto. |
| **Fiados** | El cuaderno de fiados que no se pierde. Deuda por cliente, abonos, historial y recordatorio por WhatsApp con un toque. |
| **Caja** | Cuánto vendiste y cuánto ganaste hoy, por método de pago. Últimos 7 días. Cierre de caja con cuadre de efectivo. |
| **Más** | Nombre de la bodega, respaldo y restauración de datos, catálogo de ejemplo. |

Todo se guarda en el propio celular (IndexedDB). No necesita cuenta, no necesita internet, y se instala como app desde el navegador (PWA).

## Probar

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # genera dist/ listo para publicar en cualquier hosting estático
```

Abre la dirección desde el celular en la misma red Wi-Fi y elige "Agregar a pantalla de inicio".

## Documentación

- [`docs/01-oportunidad.md`](docs/01-oportunidad.md) — El problema, el nicho y el ángulo ganador.
- [`docs/02-producto.md`](docs/02-producto.md) — Principios de diseño, módulos y flujos.
- [`docs/03-arquitectura.md`](docs/03-arquitectura.md) — Stack, modelo de datos, decisiones técnicas.
- [`docs/04-hoja-de-ruta.md`](docs/04-hoja-de-ruta.md) — Fases, mejoras propuestas y modelo de negocio.

## Stack

React 19 · TypeScript · Vite · Dexie (IndexedDB) · PWA con Workbox. Cero backend en esta fase: eso es una decisión, no una limitación (ver arquitectura).
