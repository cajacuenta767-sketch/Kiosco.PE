# 05 · Stack, arquitectura y estructura del proyecto

Decisión de fondo: **un solo lenguaje, TypeScript, de punta a punta.** El mismo tipo `Venta` que se guarda en el celular
viaja a la API y se guarda en Postgres. Una sola persona puede mantener todo el sistema.

## El stack, capa por capa

| Capa | Elección | Por qué esta y no otra |
|---|---|---|
| **Lenguaje** | TypeScript | Un solo lenguaje en app, API y lógica compartida. Tipado fuerte evita errores de dinero (S/ 7 vs "7"). |
| **Frontend** | React 19 + Vite 6 | Estándar de la industria, ecosistema enorme, compila en segundos. |
| **Datos en el celular** | Dexie 4 (IndexedDB) | Transacciones reales, índices, consultas reactivas. Offline total. |
| **Offline / instalable** | PWA (vite-plugin-pwa + Workbox) | Se instala desde el navegador sin tienda. La app entera queda en caché. |
| **Estilos** | CSS plano con variables | 15 KB, cero dependencias, modo oscuro con `data-tema`. |
| **Backend** | Node 22 + Fastify 5 | El servidor HTTP más rápido del ecosistema Node, con validación por esquema y logs integrados. |
| **Validación** | Zod 4 | Un esquema valida el JSON de entrada y genera el tipo TypeScript. |
| **Base de datos nube** | PostgreSQL | Fiable, gratis en Neon/Supabase para empezar, JSONB para la bitácora de cambios. |
| **ORM / migraciones** | Drizzle | Esquema en TypeScript, SQL transparente, migraciones versionadas. |
| **Android / Play Store** | Trusted Web Activity con Bubblewrap | La misma PWA empaquetada como app nativa. Cero código Java/Kotlin. |
| **Pruebas** | `node:test` (lógica) + Playwright (flujo completo) | Sin frameworks extra; la lógica de dinero se prueba sola. |
| **CI** | GitHub Actions | Cada push: tipos, pruebas, build web, build API. |
| **Hosting web** | Cloudflare Pages / Netlify / Vercel | Estático, gratis, HTTPS automático (obligatorio para PWA y TWA). |
| **Hosting API** | Fly.io / Railway / Render | Un contenedor Node pequeño. Postgres administrado aparte. |

### Lo que se descartó, y por qué
- **React Native / Flutter:** dos bases de código, tiendas obligatorias, y el bodeguero no descarga apps. La PWA llega
  primero por WhatsApp con un enlace; la tienda es un canal más, no el único.
- **Electron / app de escritorio:** la bodega no tiene computadora. Tiene celular.
- **Firebase / Supabase como backend completo:** cómodo al inicio, caro y rígido al escalar. Postgres + una API propia
  de 300 líneas da control total y se puede mover de proveedor en una tarde.
- **Un framework de componentes (MUI, Chakra):** pesados en celulares de gama media. Botones nativos bien estilizados
  responden mejor.

## Arquitectura: local-first con sincronización por bitácora

```
   CELULAR DEL BODEGUERO                         NUBE (opcional)
 ┌────────────────────────────┐              ┌───────────────────────────┐
 │  PWA (React)               │              │  API Fastify              │
 │    │                       │   push       │    │                      │
 │    ▼                       │ ───────────► │    ▼                      │
 │  IndexedDB (Dexie)         │   pull       │  Postgres (Drizzle)       │
 │  fuente de verdad          │ ◄─────────── │  bodegas · dispositivos   │
 │  funciona sin red          │              │  cambios (bitácora)       │
 └────────────────────────────┘              └───────────────────────────┘
        ▲ misma lógica ▲                            ▲ misma lógica ▲
        └──────────── packages/shared (tipos + cálculos) ────────────┘
```

Principios:
1. **El celular es la fuente de verdad.** Vender, fiar, cerrar caja: todo se escribe primero en IndexedDB. La nube es una copia.
2. **La API no tiene lógica de negocio.** No calcula ganancias ni stock. Recibe cambios, los guarda, los reparte. Toda la
   lógica vive en `packages/shared` y corre en el celular (y en el servidor solo si hace falta un reporte).
3. **Sincronización por bitácora de cambios (`cambios`).** Cada modificación es una fila: tabla, id del registro, datos
   completos, fecha, dispositivo. El celular sube las suyas (`POST /v1/sync/push`) y baja las ajenas desde una secuencia
   (`GET /v1/sync/pull?desde=N`). Es idempotente: reenviar un lote no duplica nada.
4. **Conflictos:** última escritura gana por registro, salvo el stock, que se reconstruye reaplicando `movimientosStock`
   (por eso son inmutables). Dos celulares vendiendo a la vez nunca "pisan" el stock del otro.
5. **Cuenta sin contraseña.** Una bodega se registra con su nombre (`POST /v1/bodegas`) y recibe un token de dispositivo.
   Añadir otro celular es escanear un QR. El teléfono con OTP por WhatsApp llega en la Fase 2 para recuperar la cuenta.

## Estructura de carpetas

```
Kiosco.PE/
├── package.json                 Raíz del monorepo (npm workspaces). Scripts: dev, build, typecheck, test.
├── .github/workflows/ci.yml     CI: tipos + pruebas + builds en cada push.
│
├── packages/
│   └── shared/                  @kiosco/shared — el corazón. Cero dependencias.
│       └── src/
│           ├── tipos.ts         Producto, Venta, Cliente, Gasto… y constantes (métodos de pago, categorías).
│           ├── format.ts        Soles, fechas, redondeo.
│           ├── calculos.ts      Ganancia del día, deuda de un cliente, pedido sugerido, más vendidos.
│           └── calculos.test.ts Pruebas de la lógica de dinero.
│
├── apps/
│   ├── web/                     @kiosco/web — la PWA que usa el bodeguero.
│   │   ├── index.html
│   │   ├── vite.config.ts       Manifest PWA, service worker, íconos.
│   │   ├── public/              Íconos y .well-known/assetlinks.json (enlace con la app Android).
│   │   └── src/
│   │       ├── db/db.ts         Esquema Dexie (IndexedDB) con versiones y migraciones.
│   │       ├── db/seed.ts       Catálogo de ejemplo de una bodega peruana.
│   │       ├── lib/acciones.ts  Transacciones: registrar venta, ingresar stock, abonar, gastos, respaldo.
│   │       ├── components/      Modal, Campo, Toast, Escáner de códigos con cámara.
│   │       ├── screens/         Vender · Stock · Fiados · Caja · Ajustes.
│   │       ├── App.tsx          Pestañas, cabecera, tema.
│   │       └── styles.css       Sistema de diseño (variables, modo oscuro, móvil primero).
│   │
│   └── api/                     @kiosco/api — servidor de sincronización.
│       ├── .env.example         PORT, DATABASE_URL, CORS_ORIGENES.
│       ├── drizzle.config.ts    Migraciones.
│       └── src/
│           ├── index.ts         Arranque Fastify, CORS, /salud. Sin DATABASE_URL corre en modo sin nube.
│           ├── auth.ts          Tokens de dispositivo (hash SHA-256) y middleware de sesión.
│           ├── db/schema.ts     Tablas: bodegas, dispositivos, cambios.
│           ├── db/cliente.ts    Conexión Postgres.
│           └── rutas/
│               ├── bodegas.ts   POST /v1/bodegas — crear cuenta y primer dispositivo.
│               └── sync.ts      POST /v1/sync/push · GET /v1/sync/pull.
│
├── android/                     Empaquetado para Play Store (TWA).
│   ├── twa-manifest.json        Configuración Bubblewrap: paquete pe.kiosco.app, colores, ícono, versión.
│   └── README.md                Paso a paso hasta publicar.
│
└── docs/                        Oportunidad, producto, arquitectura, hoja de ruta, este documento.
```

Regla de dependencias: `shared` no depende de nadie. `web` y `api` dependen de `shared`. `web` y `api` nunca se importan entre sí.

## Cómo se ejecuta

```bash
npm install                 # instala los tres workspaces
npm run dev                 # PWA en http://localhost:5173
npm run dev:api             # API en http://localhost:3000 (sin DATABASE_URL: solo /salud)
npm run typecheck           # tipos en shared, web y api
npm test                    # pruebas de la lógica de negocio
npm run build               # apps/web/dist listo para publicar
npm run build:api           # apps/api/dist listo para desplegar
```

Con Postgres:
```bash
cp apps/api/.env.example apps/api/.env   # poner DATABASE_URL
npm run db:generate -w @kiosco/api       # genera la migración desde schema.ts
npm run db:migrate -w @kiosco/api        # la aplica
npm run dev:api
```

## Del navegador a Play Store: los tres niveles de instalación

| Nivel | Cómo llega | Qué necesita | Cuándo |
|---|---|---|---|
| **1. Web** | Un enlace por WhatsApp. Se abre y funciona. | Publicar `apps/web/dist` en HTTPS. | Hoy. |
| **2. Instalable (PWA)** | "Agregar a pantalla de inicio". Ícono, pantalla completa, sin barra de navegador, offline. | Lo mismo que el nivel 1. Ya está configurado (manifest + service worker). | Hoy. |
| **3. Play Store (TWA)** | Buscar "Kiosco.PE" en Play Store e instalar. Confianza, actualizaciones automáticas, reseñas. | Cuenta de Play Console (USD 25), `bubblewrap build`, huella SHA-256 en `assetlinks.json`. | Fase 1, cuando haya 10 bodegas validando. |

Los tres niveles son **la misma app y el mismo código**. No hay una "versión Android" que mantener. Si algún día se
necesita hardware que el navegador no expone (ticketera Bluetooth, por ejemplo), `apps/web` se envuelve con Capacitor
y sigue siendo la fuente única.

## Protocolo de sincronización (referencia)

```
POST /v1/bodegas
  { nombre: "Bodega San Martín", telefono?: "9xxxxxxxx", dispositivo?: "Celular de Carmen" }
  → 201 { bodegaId, dispositivoId, token: "kp_..." }

POST /v1/sync/push          Authorization: Bearer kp_...
  { cambios: [ { tabla: "ventas", registroId: "uuid", datos: {...}, borrado: false, actualizadoEn: "ISO" } ] }
  → 200 { recibidos: n }

GET  /v1/sync/pull?desde=0&limite=500     Authorization: Bearer kp_...
  → 200 { cambios: [ { secuencia, tabla, registroId, datos, borrado, actualizadoEn } ], hasta, hayMas }

GET  /salud
  → 200 { ok, servicio, version, baseDeDatos, hora }
```

Pendiente en el cliente (Fase 2): ids UUID en lugar de autoincrementales, columna `actualizadoEn` en cada tabla Dexie,
una cola local de cambios pendientes y un worker que empuja/baja cuando hay red. La API ya está lista para recibirlo.

## Seguridad y datos

- Tokens de dispositivo con 192 bits de entropía, guardados con SHA-256. Se revocan borrando la fila.
- Cada consulta filtra por `bodegaId` de la sesión: una bodega jamás ve datos de otra.
- CORS restringido a los orígenes de la app.
- El bodeguero puede exportar todo en JSON en cualquier momento. Los datos son suyos.
- Sin correo, sin contraseña, sin datos personales innecesarios. El teléfono es opcional y solo sirve para recuperar la cuenta.
