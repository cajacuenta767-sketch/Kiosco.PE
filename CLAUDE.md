# Kiosco.PE — guía para trabajar en este repositorio

Sistema de ventas, stock y fiados para bodegas del Perú. Local-first: el celular es la fuente de verdad, la nube es una copia opcional.
Lee `docs/05-stack-y-estructura.md` antes de tocar la arquitectura.

## Comandos
```bash
npm install            # instala los tres workspaces
npm run dev            # PWA (apps/web) en :5173
npm run dev:api        # API (apps/api) en :3000 con PGlite embebido
npm run typecheck      # tipos en shared, web y api
npm test               # node:test en shared (cálculos) y api (integración sobre PGlite en memoria)
npm run e2e            # compila y corre apps/web/e2e con Playwright contra la API sirviendo la PWA en :3001
npm run build && npm run build:api
```

## Reglas del proyecto
- **TypeScript en todo.** Textos de interfaz en español peruano, sin jerga contable ("te deben", no "cuentas por cobrar").
- **`packages/shared` no depende de nadie.** Tipos de dominio y cálculos puros van ahí, con prueba.
- **Toda escritura local pasa por `apps/web/src/db/repo.ts`** (`poner`/`borrar`) dentro de una transacción que incluya `db.cola`. Nunca `db.tabla.put` directo fuera de `sync/motor.ts` y `db/seed.ts`.
- **Ids son UUID (`uuid()` de shared) y cada fila lleva `actualizadoEn`.** Última escritura gana en la sincronización.
- **El stock es la suma de `movimientosStock`.** Cualquier cambio de stock crea un movimiento (ver `moverStock` en `lib/acciones.ts`). Nunca viaja a la nube; se reconstruye al recibir cambios.
- **La API no tiene lógica de negocio.** Solo cuentas, tokens, códigos de vínculo y la bitácora `cambios` bajo `/api`.
- **Cambios de esquema en la API:** editar `apps/api/src/db/schema.ts` y correr `npm run db:generate -w @kiosco/api`; las migraciones se aplican solas al arrancar.
- **Cambios de esquema en Dexie:** nueva versión en `db/db.ts`; no cambiar el tipo de la clave primaria (Dexie no lo permite).
- Botones de al menos 44 px, una cifra protagonista por pantalla, tres toques para cobrar. Ver `docs/02-producto.md`.

## Antes de dar por terminado un cambio
`npm run typecheck && npm test && npm run build` en verde. Si tocaste flujos de usuario, también `npm run e2e`
(necesita Chromium; `CHROME_PATH` apunta al binario si Playwright no lo encuentra).
