import 'dotenv/config'
import { conectar } from './db/cliente.ts'
import { compactar } from './compactar.ts'

const conexion = await conectar()
const r = await compactar(conexion.db)
console.log(`Compactación lista: ${r.cambiosBorrados} cambios y ${r.codigosBorrados} códigos borrados.`)
await conexion.cerrar()
