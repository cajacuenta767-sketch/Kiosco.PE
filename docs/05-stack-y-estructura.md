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
| **Base de datos nube** | PostgreSQL (o PGlite embebido) | Sin `DATABASE_URL` la API usa PGlite, un Postgres dentro del proceso: corre y se prueba en cualquier máquina sin instalar nada. Con miles de bodegas, Postgres administrado. |
| **ORM / migraciones** | Drizzle | Esquema en TypeScript, SQL transparente, migraciones versionadas. |
| **Android / Play Store** | Trusted Web Activity con Bubblewrap | La misma PWA empaquetada como app nativa. Cero código Java/Kotlin. |
| **Pruebas** | `node:test` (lógica y API sobre PGlite en memoria) + Playwright (flujo completo, dos celulares) | Sin frameworks extra; la lógica de dinero y la sincronización se prueban solas. |
| **CI** | GitHub Actions | Cada push: tipos, pruebas, build web, build API. |
| **Hosting web** | Cloudflare Pages / Netlify / Vercel | Estático, gratis, HTTPS automático (obligatorio para PWA y TWA). |
| **Hosting** | Un contenedor (Fly.io / Railway / Render) | La misma imagen sirve la PWA y la API bajo `/api`. Ver `docs/06-despliegue.md`. |

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
5. **Cuenta = celular + PIN.** Una bodega se registra con su nombre, el celular de la dueña y un PIN (`POST /v1/bodegas`)
   y recibe un token de dispositivo. Otro celular entra con código de 6 dígitos o con número y PIN (`POST /v1/sesion`).
   El PIN se guarda con scrypt; 5 fallos bloquean la cuenta 15 minutos. Cada celular es una sesión que se puede cerrar.

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
│   │   ├── e2e/                 Pruebas de navegador (Playwright): flujo básico, Fase 1, dos celulares.
│   │   └── src/
│   │       ├── db/db.ts         Esquema Dexie (IndexedDB): tablas con id global y cola de cambios.
│   │       ├── db/repo.ts       poner/borrar: escribe y encola para la nube en la misma transacción.
│   │       ├── db/migracion.ts  Migra datos de las versiones 0.1/0.2 (ids numéricos) una sola vez.
│   │       ├── db/seed.ts       Catálogo de ejemplo de una bodega peruana.
│   │       ├── sync/motor.ts    Motor de sincronización: activar nube, vincular, subir, bajar, aplicar.
│   │       ├── lib/acciones.ts  Transacciones: registrar venta, ingresar stock, abonar, gastos, respaldo.
│   │       ├── components/      Modal, Campo, Toast, Escáner de códigos con cámara.
│   │       ├── screens/         Bienvenida · Bloqueo · Vender · Stock · Fiados · Caja · Ajustes · Nube.
│   │       ├── App.tsx          Pestañas, cabecera, tema.
│   │       └── styles.css       Sistema de diseño (variables, modo oscuro, móvil primero).
│   │
│   └── api/                     @kiosco/api — servidor de sincronización.
│       ├── .env.example         PORT, DATABASE_URL, CORS_ORIGENES.
│       ├── drizzle.config.ts    Migraciones.
│       └── src/
│           ├── index.ts         Arranque: conecta, crea la app, escucha, apaga limpio.
│           ├── app.ts           Fábrica Fastify: CORS, límite de peticiones, /api/*, sirve la PWA.
│           ├── app.test.ts      Prueba de integración completa sobre PGlite en memoria.
│           ├── auth.ts          Tokens de dispositivo (hash SHA-256), códigos de vínculo, sesión.
│           ├── db/schema.ts     Tablas: bodegas, dispositivos, codigos_vinculo, cambios.
│           ├── db/cliente.ts    Postgres o PGlite + migraciones automáticas.
│           └── rutas/
│               ├── bodegas.ts   Crear cuenta, vincular celular, ver dispositivos, desconectar.
│               └── sync.ts      POST /v1/sync/push · GET /v1/sync/pull.
│
├── android/                     Empaquetado para Play Store (TWA).
│   ├── twa-manifest.json        Configuración Bubblewrap: paquete pe.kiosco.app, colores, ícono, versión.
│   └── README.md                Paso a paso hasta publicar.
│
├── scripts/e2e.mjs              Arranca la API con PGlite en memoria sirviendo la PWA y corre apps/web/e2e.
├── Dockerfile · fly.toml        Un contenedor sirve PWA + API. Datos en volumen (PGlite) o Postgres externo.
└── docs/                        Oportunidad, producto, arquitectura, hoja de ruta, este documento, despliegue.
```

Regla de dependencias: `shared` no depende de nadie. `web` y `api` dependen de `shared`. `web` y `api` nunca se importan entre sí.

## Cómo se ejecuta

```bash
npm install                 # instala los tres workspaces
npm run dev                 # PWA en http://localhost:5173
npm run dev:api             # API en http://localhost:3000 (sin DATABASE_URL: solo /salud)
npm run typecheck           # tipos en shared, web y api
npm test                    # pruebas de la lógica de negocio y de la API
npm run e2e                 # compila y corre las pruebas de navegador (necesita Chromium)
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

Implementado en el cliente (`apps/web/src/sync/motor.ts`): ids UUID en todas las tablas, `actualizadoEn` por fila,
cola local `cola` que llena `db/repo.ts` en cada escritura, y un motor que sube y baja al iniciar, al volver la red,
cada 45 segundos y a los pocos segundos de cada cambio. El stock nunca viaja: se reconstruye sumando `movimientosStock`.

```
POST /api/v1/dispositivos/codigo      Authorization: Bearer   → { codigo: "274257", minutos: 10 }
POST /api/v1/dispositivos/vincular    { codigo, dispositivo? } → 201 { bodegaId, dispositivoId, token, nombre }
GET  /api/v1/bodegas/actual           Authorization: Bearer   → { nombre, dispositivos: [...] }
DELETE /api/v1/dispositivos/actual    Authorization: Bearer   → { ok }
```

```
POST /api/v1/sesion                    { telefono, pin, dispositivo? } → 201 { bodegaId, dispositivoId, token, nombre }
                                        401 { error, intentosRestantes } · 423 bloqueada 15 min
PUT  /api/v1/bodegas/actual/acceso     Authorization: Bearer · { telefono, pin } → cambia el acceso
DELETE /api/v1/dispositivos/:id        Authorization: Bearer · cierra la sesión de otro celular de la bodega
```

Todas las rutas van bajo el prefijo `/api` para convivir con la PWA en el mismo origen.

## Seguridad y datos

- Tokens de dispositivo con 192 bits de entropía, guardados con SHA-256. Se revocan borrando la fila.
- Cada consulta filtra por `bodegaId` de la sesión: una bodega jamás ve datos de otra.
- CORS restringido a los orígenes de la app.
- El bodeguero puede exportar todo en JSON en cualquier momento. Los datos son suyos.
- Sin correo, sin contraseña, sin datos personales innecesarios. El teléfono es opcional y solo sirve para recuperar la cuenta.
