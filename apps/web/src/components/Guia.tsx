import { Modal } from './ui'

type Tab = 'vender' | 'stock' | 'fiados' | 'caja' | 'ajustes'

const GUIAS: Record<Tab, { titulo: string; pasos: [string, string][] }> = {
  vender: {
    titulo: '¿Cómo vendo?',
    pasos: [
      ['👆', 'Toca el producto que te piden. Si son dos, tócalo dos veces.'],
      ['💰', 'Toca el botón verde "Cobrar".'],
      ['💵', 'Elige cómo te pagan: efectivo, Yape, Plin o fiado. Si es efectivo, toca el billete con el que te pagan y verás el vuelto.'],
      ['✅', 'Toca "Confirmar". Listo: la venta queda anotada y el stock baja solo.'],
      ['🔍', '¿No encuentras el producto? Escribe su nombre arriba, dilo con el 🎤, o toca "S/" para cobrar cualquier monto.'],
      ['📦', 'Si un producto tiene precio por six-pack o docena, verás el botoncito debajo del precio. Tócalo y se cobra el paquete.'],
      ['👤', 'Toca el botón de la persona para cargar "lo de siempre" de un cliente conocido.'],
    ],
  },
  stock: {
    titulo: '¿Cómo manejo mi stock?',
    pasos: [
      ['⚠️', 'Arriba ves cuántos productos se están acabando. Tócalo para ver cuáles.'],
      ['📦', 'Cuando llega mercadería, toca "＋ stock" al lado del producto y escribe cuánto llegó.'],
      ['➕', 'Para un producto nuevo, toca "+ Producto": nombre, a cuánto lo vendes y a cuánto te cuesta.'],
      ['📋', 'Si aparece el aviso amarillo, toca y verás qué pedirle a tu proveedor. Puedes mandárselo por WhatsApp.'],
      ['⏰', 'Cuando ingresas mercadería puedes poner cuándo vence. Una semana antes verás "Por vencer" para venderlo primero.'],
    ],
  },
  fiados: {
    titulo: '¿Cómo llevo los fiados?',
    pasos: [
      ['📒', 'Cuando fías desde "Vender", el cliente aparece aquí solo, con su deuda.'],
      ['👆', 'Toca el cliente para ver todo lo que se llevó y cuándo.'],
      ['💵', 'Cuando te paga, escribe cuánto y toca "Abonar". Si paga todo, toca "Pagó todo".'],
      ['💬', 'Si tienes su celular, toca "Recordar por WhatsApp" y le llega un mensaje amable con lo que debe.'],
      ['🚧', 'Ponle un tope de fiado a cada cliente: al cobrar te avisamos si se pasa.'],
    ],
  },
  caja: {
    titulo: '¿Qué me dice la caja?',
    pasos: [
      ['💰', 'El número grande es lo que vendiste hoy. Debajo, cuánto de eso es ganancia tuya.'],
      ['💸', 'Anota los gastos (proveedor, luz, pasaje) con "+ Anotar gasto" para que la ganancia sea de verdad.'],
      ['🔒', 'Al final del día toca "Cerrar caja": cuenta tu efectivo y la app te dice si cuadra.'],
      ['📅', 'Toca el aviso del mes para ver cómo te fue todo el mes.'],
      ['💬', '"Compartir resumen de la semana" te manda por WhatsApp cuánto vendiste y ganaste. Mándatelo a ti misma cada domingo.'],
    ],
  },
  ajustes: {
    titulo: 'Ajustes',
    pasos: [
      ['🏪', 'Escribe el nombre de tu bodega: sale en los mensajes de WhatsApp.'],
      ['☁️', 'Crea tu cuenta en la nube con tu celular y un PIN: tus datos quedan guardados y, si pierdes el teléfono, entras desde otro con ese número y PIN.'],
      ['🔐', 'Con "Pedir mi PIN al abrir" nadie entra a tu bodega sin tu PIN, ni tu ayudante.'],
      ['🔤', 'Si la letra se ve chica, elige "Letra grande".'],
      ['📲', 'Sube la captura de tu QR de Yape y Plin: al cobrar, se lo muestras al cliente en grande para que escanee.'],
      ['👩‍👧', 'Con "Modo ayudante" otra persona puede vender sin ver tus ganancias ni cambiar precios.'],
    ],
  },
}

export function Guia({ tab, onCerrar }: { tab: Tab; onCerrar: () => void }) {
  const g = GUIAS[tab]
  return (
    <Modal titulo={g.titulo} onCerrar={onCerrar}>
      <ol className="guia">
        {g.pasos.map(([icono, texto], i) => (
          <li key={i}>
            <span className="guia-icono">{icono}</span>
            <span>{texto}</span>
          </li>
        ))}
      </ol>
      <button className="btn-primario grande ancho" onClick={onCerrar}>Entendido</button>
    </Modal>
  )
}
