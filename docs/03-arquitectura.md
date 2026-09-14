# 03 · Arquitectura

## Decisión central: local-first, sin backend

En esta fase **no hay servidor**. Los datos viven en el celular, en IndexedDB, a través de Dexie.

Por qué:
- **La bodega no tiene internet confiable.** Un sistema que necesita red para cobrar es un sistema que falla en hora punta.
- **Cero fricción de entrada.** Sin cuenta, sin contraseña, sin "verifica tu correo". Abre y usa.
- **Privacidad por defecto.** Los datos del negocio son del bodeguero, no nuestros.
- **Costo cero de operación** mientras validamos. No hay servidores que pagar por usuarios que aún no pagan.

Lo que se gana después con sincronización (respaldo automático, multi-dispositivo, panel web) se construye
encima de este modelo, no reemplazándolo: el celular sigue siendo la fuente de verdad y la nube es una copia.

## Stack

| Capa | Elección | Motivo |
|---|---|---|
| UI | React 19 + TypeScript | Estándar, tipado fuerte, ecosistema enorme |
| Build | Vite | Rápido, PWA con un plugin |
| Datos | Dexie 4 sobre IndexedDB | Transacciones, índices, consultas reactivas con `useLiveQuery` |
| Offline | vite-plugin-pwa (Workbox) | Precache de la app completa; se abre sin red |
| Estilos | CSS plano con variables | 14 KB, sin dependencias, control total del tacto móvil |

Sin router (5 pestañas, estado local), sin gestor de estado global (la base de datos *es* el estado, y `useLiveQuery`
re-renderiza cuando cambia), sin librería de componentes (los controles nativos bien estilizados son más rápidos en gama media).

## Modelo de datos

```
productos          ventas                clientes           movimientosFiado
─────────          ──────                ────────           ────────────────
id                 id                    id                 id
nombre             fecha (ISO)           nombre             clienteId ─► clientes
categoria          dia (YYYY-MM-DD)      telefono           fecha
codigoBarras       items[]               nota               tipo: fiado | abono
precioVenta          productoId          creadoEn           monto
precioCompra         nombre (copia)                         ventaId ─► ventas
stock                cantidad                               nota
stockMinimo          precio (copia)
unidad: und | kg     costo (copia)       movimientosStock   cierres
activo             total                 ────────────────   ───────
creadoEn           costoTotal            id                 id
                   metodoPago            productoId         dia
                   clienteId             fecha              montoInicial
                   pagoCon / vuelto      tipo: venta |      efectivoEsperado
                                           ingreso |        efectivoContado
config                                     ajuste | merma   diferencia
──────                                   cantidad (±)       totalVentas
key / value                              nota
```

Decisiones importantes:

- **Las ventas copian nombre, precio y costo del producto** en el momento de la venta. Si mañana sube el precio de la
  Inca Kola, las ventas de hoy siguen mostrando lo que realmente se cobró y lo que realmente costó. La ganancia histórica
  no se reescribe.
- **La ganancia se calcula por venta** (`total − costoTotal`), no por producto. Es exacta aunque el costo cambie.
- **El campo `dia`** es redundante con `fecha` pero está indexado: "ventas de hoy" y "últimos 7 días" son consultas de rango
  sobre un índice, no un recorrido de toda la tabla.
- **Los movimientos son inmutables.** El stock actual se guarda en el producto por velocidad, pero cada cambio deja un
  movimiento. Esto permite auditar ("¿por qué tengo 3 si ayer tenía 10?") y reconstruir el stock si hiciera falta.
- **La deuda de un cliente no se guarda:** se calcula sumando fiados y restando abonos. No hay forma de que se desincronice.
- **Anular una venta** devuelve el stock con un movimiento de ajuste y elimina el fiado asociado, en una sola transacción.
- **Los productos no se borran, se desactivan** (`activo: false`). Las ventas pasadas los siguen referenciando.

## Transacciones

`registrarVenta` hace cuatro cosas (guardar venta, descontar stock por cada ítem, anotar movimiento de stock,
anotar fiado) dentro de una transacción Dexie `rw`. O se hacen todas o ninguna. Lo mismo para ingresos, ajustes y anulaciones.

## Respaldo

`exportarBackup` serializa todas las tablas a un JSON con marca `app: "sencillo"` y `version: 1`.
`importarBackup` valida la marca, limpia todo y restaura dentro de una transacción. Es la base de la futura sincronización:
el mismo formato viaja a la nube.

## Estructura del código

```
src/
  db/
    db.ts          Esquema Dexie y tipos
    seed.ts        Catálogo de ejemplo de una bodega peruana
  lib/
    acciones.ts    Toda la lógica de negocio (ventas, stock, fiados, resúmenes, respaldo)
    format.ts      Soles, fechas, redondeo
  components/
    ui.tsx         Modal, Campo, Vacío, Toast
  screens/
    Vender.tsx · Stock.tsx · Fiados.tsx · Caja.tsx · Ajustes.tsx
  App.tsx          Pestañas, cabecera, avisos
  styles.css       Sistema de diseño (variables, componentes, móvil primero)
```

La lógica de negocio no depende de React. Se puede probar sola y reutilizar en un backend o en otra interfaz.

## Camino a la sincronización (Fase 2)

1. Cada fila lleva `updatedAt` y un `deviceId`.
2. Un servicio mínimo (por ejemplo, Supabase o un Postgres con una API pequeña) recibe cambios y devuelve los ajenos.
3. Conflictos: último en escribir gana por fila, salvo stock, que se resuelve reaplicando movimientos (por eso son inmutables).
4. El celular sigue funcionando exactamente igual sin red; sincroniza cuando puede.
