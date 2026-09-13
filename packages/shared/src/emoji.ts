/** Ícono automático según el nombre o la categoría del producto. Cero configuración: la señora ve dibujos desde el primer día. */
const POR_NOMBRE: [RegExp, string][] = [
  [/inca kola|coca|pepsi|gaseosa|fanta|sprite|kola|cifrut|frugos|refresco/i, '🥤'],
  [/cerveza|pilsen|cristal|cusque|corona/i, '🍺'],
  [/agua/i, '💧'],
  [/leche/i, '🥛'],
  [/yogur/i, '🍶'],
  [/arroz/i, '🍚'],
  [/az[uú]car/i, '🍬'],
  [/aceite/i, '🫙'],
  [/at[uú]n|conserva|sardina/i, '🥫'],
  [/fideo|tallar[ií]n|pasta|spaghetti/i, '🍝'],
  [/huevo/i, '🥚'],
  [/sal\b|sal marina/i, '🧂'],
  [/galleta|soda|vainilla|oreo|casino|morocha|chaplin|rellenita/i, '🍪'],
  [/chocolate|sublime|triángulo|princesa|nestl/i, '🍫'],
  [/chicle|trident|caramelo|chupetín|gomita/i, '🍭'],
  [/papa|lays|piqueo|chizito|doritos|snack|cheetos/i, '🍟'],
  [/pan\b|panes|bizcocho|kekes?|torta/i, '🍞'],
  [/papel higi/i, '🧻'],
  [/detergente|lej[ií]a|clorox|limpia|desinfect|poett|sapolio/i, '🧴'],
  [/jab[oó]n/i, '🧼'],
  [/shampoo|champ[uú]|acondicionador/i, '🧴'],
  [/pasta dental|colgate|cepillo/i, '🪥'],
  [/pila|bater[ií]a/i, '🔋'],
  [/f[oó]sforo|encendedor/i, '🔥'],
  [/cigarr|hamilton|lucky|marlboro/i, '🚬'],
  [/recarga|claro|movistar|entel|bitel/i, '📱'],
  [/pollo|carne|embutido|hot ?dog|salchicha|jam[oó]n/i, '🍗'],
  [/queso/i, '🧀'],
  [/mantequilla|margarina/i, '🧈'],
  [/caf[eé]|nescaf/i, '☕'],
  [/t[eé]\b|manzanilla|an[ií]s|infusi/i, '🍵'],
  [/avena|quinua|cereal/i, '🌾'],
  [/frijol|lenteja|menestra|garbanzo|pallar/i, '🫘'],
  [/harina/i, '🌾'],
  [/tomate|cebolla|papa\b|verdura|lim[oó]n|ajo|zanahoria/i, '🥬'],
  [/pl[aá]tano|manzana|naranja|fruta|mandarina|uva/i, '🍎'],
  [/helado|d.?onofrio/i, '🍦'],
  [/vela/i, '🕯️'],
  [/pañal|toalla|higi/i, '🧷'],
  [/gas\b|bal[oó]n/i, '🔥'],
  [/mayonesa|k[eé]tchup|mostaza|salsa|sillao|vinagre/i, '🥫'],
]

const POR_CATEGORIA: Record<string, string> = {
  Bebidas: '🥤',
  Abarrotes: '🛒',
  Golosinas: '🍬',
  Snacks: '🍿',
  Panadería: '🍞',
  Limpieza: '🧼',
  'Cuidado personal': '🧴',
  Otros: '📦',
}

export function emojiPara(nombre: string, categoria: string): string {
  for (const [re, e] of POR_NOMBRE) if (re.test(nombre)) return e
  return POR_CATEGORIA[categoria] ?? '📦'
}

/** Íconos para elegir a mano en el formulario de producto. */
export const EMOJIS_PRODUCTO = ['🥤', '🍺', '💧', '🥛', '🍚', '🍬', '🫙', '🥫', '🍝', '🥚', '🧂', '🍪', '🍫', '🍭', '🍟', '🍿', '🍞', '🧻', '🧴', '🧼', '🪥', '🔋', '🔥', '📱', '🍗', '🧀', '🧈', '☕', '🍵', '🌾', '🫘', '🥬', '🍎', '🍦', '🕯️', '🧷', '🛒', '📦', '🎁', '💊']
