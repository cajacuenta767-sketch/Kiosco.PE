# Kiosco.PE — Tu bodega en orden

**Ventas, stock y fiados para las bodegas del Perú. Funciona sin internet, desde el celular del bodeguero.**

> En el Perú hay más de 500 000 bodegas. Casi todas se administran con un cuaderno, una calculadora y la memoria.
> El bodeguero no sabe cuánto gana. No sabe qué se le está acabando hasta que un cliente se lo pide. Y el cuaderno de fiados
> se pierde, se moja o se olvida. Kiosco.PE reemplaza el cuaderno con algo tan simple como WhatsApp.

## Qué hace hoy (v0.3)

| Módulo | Qué resuelve |
|---|---|
| **Vender** | Cobrar en 3 toques. Productos ordenados por lo más vendido, búsqueda, escáner de código de barras con la cámara, venta rápida sin producto, calculadora de vuelto, Efectivo / Yape / Plin / Tarjeta / Fiado. |
| **Stock** | Qué tienes, qué se acaba, qué está agotado. Ingreso de mercadería, ganancia por producto y **pedido sugerido** al proveedor según la rotación de 14 días, listo para WhatsApp. |
| **Fiados** | El cuaderno de fiados que no se pierde. Deuda por cliente, abonos, historial y recordatorio por WhatsApp con un toque. |
| **Caja** | Cuánto vendiste y cuánto ganaste hoy (neto de gastos), por método de pago. Gastos del día. Últimos 7 días. Cierre de caja con cuadre de efectivo. |
| **Nube** | Opcional. Respaldo automático con cuenta sin contraseña y un segundo celular vinculado con un código de 6 dígitos. Dos personas atienden la misma bodega y el stock cuadra. |
| **Más** | Nombre de la bodega, modo oscuro, respaldo y restauración de datos, catálogo de ejemplo. |

Todo se guarda en el propio celular (IndexedDB). No necesita cuenta ni internet, y se instala como app desde el navegador (PWA). La nube es opcional y se activa con un toque.

## Probar

```bash
npm install
npm run dev        # PWA en http://localhost:5173
npm run dev:api    # API en http://localhost:3000 con Postgres embebido (PGlite), sin instalar nada
npm test           # pruebas de la lógica de negocio y de la API
npm run build      # apps/web/dist listo para publicar
docker build -t kiosco-pe . && docker run -p 3000:3000 kiosco-pe   # PWA + API en un contenedor
```

Abre la dirección desde el celular en la misma red Wi-Fi y elige "Agregar a pantalla de inicio".

## Documentación

- [`docs/01-oportunidad.md`](docs/01-oportunidad.md) — El problema, el nicho y el ángulo ganador.
- [`docs/02-producto.md`](docs/02-producto.md) — Principios de diseño, módulos y flujos.
- [`docs/03-arquitectura.md`](docs/03-arquitectura.md) — Stack, modelo de datos, decisiones técnicas.
- [`docs/04-hoja-de-ruta.md`](docs/04-hoja-de-ruta.md) — Fases, mejoras propuestas y modelo de negocio.
- [`docs/05-stack-y-estructura.md`](docs/05-stack-y-estructura.md) — Stack completo, estructura de carpetas, API de sincronización y camino a Play Store.
- [`docs/06-despliegue.md`](docs/06-despliegue.md) — Un contenedor para todo, Fly.io, Postgres administrado, variables de entorno.

## Estructura

```
packages/shared   Tipos y lógica de negocio pura (ganancia, deuda, pedido sugerido). Con pruebas.
apps/web          La PWA del bodeguero: React + Dexie (IndexedDB). Offline, instalable.
apps/api          API de sincronización: Fastify + Postgres/PGlite (Drizzle). Cuenta sin contraseña, bitácora de cambios.
android/          Empaquetado para Play Store como Trusted Web Activity (Bubblewrap).
docs/             Estrategia, producto, arquitectura y hoja de ruta.
```

## Stack

TypeScript de punta a punta. React 19 · Vite · Dexie · PWA (Workbox) · Fastify 5 · Zod · PostgreSQL · Drizzle · Bubblewrap (TWA).
El celular es la fuente de verdad; la nube es una copia opcional. Detalle y justificación en `docs/05-stack-y-estructura.md`.
