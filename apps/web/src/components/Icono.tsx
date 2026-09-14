import type { Producto } from '../db/db'
import { emojiPara } from '@sencillo/shared'

/** Foto del producto si tiene; si no, su ícono elegido; si no, uno automático por el nombre. */
export function IconoProducto({ p, tam = 40 }: { p: Pick<Producto, 'nombre' | 'categoria' | 'emoji' | 'imagen'>; tam?: number }) {
  if (p.imagen) return <img className="icono-producto" src={p.imagen} alt="" width={tam} height={tam} style={{ width: tam, height: tam }} />
  return (
    <span className="icono-producto emoji" style={{ width: tam, height: tam, fontSize: tam * 0.6 }} aria-hidden="true">
      {p.emoji || emojiPara(p.nombre, p.categoria)}
    </span>
  )
}
