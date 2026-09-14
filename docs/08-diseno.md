# 08 · Sistema de diseño

La app la usa una señora de bodega con el celular en una mano, a veces sin lentes y a veces a contraluz.
Todo el diseño sale de esa escena. La hoja de estilos (`apps/web/src/styles.css`) es la única fuente de
verdad; este documento explica las reglas para que cualquier pantalla nueva se vea y se sienta igual.

## Reglas

1. **Un color por significado.** Naranja = Sencillo (marca, acciones normales). Verde = cobrar y "está bien"
   (el botón Cobrar, el vuelto, "al día", la confirmación de venta). Rojo = deuda, agotado, faltante.
   Ámbar = ojo (por acabarse, por vencer, avisos). Nunca se usa un color fuera de su significado.
2. **Letra grande y redonda.** Nunito (variable, autoalojada, funciona sin internet). Cuerpo 17 px, nunca
   menos de 13 px. "Letra grande" en Más sube todo a 20 px.
3. **Botones para el pulgar.** Mínimo 52 px de alto (`--toque`); los de cobrar y confirmar, 60 px.
   Los botones principales tienen un borde inferior de 3 px que "se hunde" al tocar.
4. **Una cifra protagonista por pantalla** (`.hero-cifra`): cuánto vendiste, cuánto te deben, cuánto cobrar.
   Debajo, una frase humana: "De cada S/ 10 vendidos, te quedan S/ 2.25".
5. **Cada toque confirma.** La tarjeta del producto rebota y muestra un contador verde; el contador del
   carrito salta; el celular vibra (si puede); al cobrar suena un "tin" y aparece la tarjeta verde con el
   vuelto en grande y "Deshacer" a la mano. Todo respeta `prefers-reduced-motion`.
6. **Pasos numerados en lo importante.** Cobrar es 1 · 2 · 3 (cómo te paga, con cuánto, confirmar). El número
   se pone verde cuando el paso está resuelto.
7. **Sin jerga y con pistas.** La primera vez que abre Vender, una pista amarilla le dice qué tocar. Los
   atajos (Escanear, Otro monto, Cliente, Vuelto) llevan nombre, no solo ícono.
8. **Íconos = emoji.** Son parte de la marca: se ven igual en cualquier celular, no pesan y la señora los
   reconoce (📒 fiados, 💰 caja, 📦 stock).

## Tokens principales

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--fondo` | `#fbf7f1` | `#14130f` | Fondo de la app |
| `--superficie` | `#ffffff` | `#1f1d18` | Tarjetas, botones secundarios |
| `--primario` | `#c2410c` | `#ea580c` | Marca, cabecera, botón principal |
| `--ok` / `--ok-suave` | `#15803d` / `#dcf5e3` | `#4ade80` / `#113a20` | Cobrar, vuelto, al día |
| `--peligro` / `--peligro-suave` | `#d92626` / `#fee2e2` | `#f87171` / `#431414` | Deuda, agotado |
| `--acento` / `--acento-suave` | `#f59e0b` / `#fef1c7` | — / `#3d2e08` | Avisos, por acabarse |
| `--radio` / `--radio-chico` | 18 px / 12 px | | Tarjetas / campos |
| `--toque` | 52 px | | Alto mínimo de botones y campos |

## Componentes con nombre

`.tarjeta-producto` (con `.tp-mas` / `.tp-badge`), `.barra-cobro` + `.btn-cobrar`, `.paso` + `.paso-num`,
`.billete`, `.vuelto`, `.venta-lista` (confirmación), `.hero-cifra` + `.hero-frase`, `.avatar`, `.kpi`
(tocable con `.activo`), `.seccion` (tarjetas de Más), `.opcion` (bienvenida), `.atajo`, `.pista`.

El lienzo de diseño con las pantallas clave y dos direcciones alternativas se generó con
`design` y vive como artefacto compartido; sus artboards usan estos mismos valores.
