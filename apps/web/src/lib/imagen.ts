/** Reduce una foto a un cuadrado pequeño (JPEG) para guardarla junto al producto sin pesar. */
export async function reducirFoto(archivo: File, lado = 144, calidad = 0.72): Promise<string> {
  const url = URL.createObjectURL(archivo)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = () => rej(new Error('No se pudo leer la foto'))
      i.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = lado
    canvas.height = lado
    const ctx = canvas.getContext('2d')!
    const min = Math.min(img.width, img.height)
    const sx = (img.width - min) / 2
    const sy = (img.height - min) / 2
    ctx.drawImage(img, sx, sy, min, min, 0, 0, lado, lado)
    return canvas.toDataURL('image/jpeg', calidad)
  } finally {
    URL.revokeObjectURL(url)
  }
}
