import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Cliente, type MetodoPago, type MovimientoFiado } from '../db/db'
import { METODOS, deudaDe, guardarCliente, registrarAbono } from '../lib/acciones'
import { fechaCorta, hora, hoyISO, soles } from '@kiosco/shared'
import { Campo, Modal, Vacio } from '../components/ui'

export function Fiados({ avisar }: { avisar: (m: string) => void }) {
  const clientes = useLiveQuery(() => db.clientes.orderBy('nombre').toArray(), []) ?? []
  const movs = useLiveQuery(() => db.movimientosFiado.orderBy('fecha').toArray(), []) ?? []
  const nombreBodega = useLiveQuery(() => db.config.get('nombreBodega'), [])?.value ?? 'la bodega'
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState<Cliente | null>(null)
  const [nuevo, setNuevo] = useState(false)

  const porCliente = useMemo(() => {
    const m = new Map<string, MovimientoFiado[]>()
    for (const mv of movs) {
      const arr = m.get(mv.clienteId) ?? []
      arr.push(mv)
      m.set(mv.clienteId, arr)
    }
    return m
  }, [movs])

  const filas = clientes
    .map((c) => {
      const lista = porCliente.get(c.id) ?? []
      const ultimo = lista[lista.length - 1]
      return { cliente: c, deuda: deudaDe(lista), ultimo }
    })
    .filter((f) => !busqueda || f.cliente.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    .sort((a, b) => b.deuda - a.deuda)

  const totalCalle = filas.reduce((s, f) => s + Math.max(0, f.deuda), 0)
  const deudores = filas.filter((f) => f.deuda > 0).length

  return (
    <div className="pantalla">
      <div className="kpis">
        <div className="kpi">
          <span className="kpi-label">Te deben en total</span>
          <strong>{soles(totalCalle)}</strong>
        </div>
        <div className="kpi">
          <span className="kpi-label">Clientes con deuda</span>
          <strong>{deudores}</strong>
        </div>
      </div>
      <div className="buscador con-boton">
        <input type="search" placeholder="Buscar cliente…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <button className="btn-primario" onClick={() => setNuevo(true)}>+ Cliente</button>
      </div>

      {clientes.length === 0 ? (
        <Vacio icono="📒" titulo="Tu cuaderno de fiados, pero que nunca se pierde" texto="Cuando fíes desde Vender, el cliente aparece aquí con su deuda al día.">
          <button className="btn-primario" onClick={() => setNuevo(true)}>Agregar cliente</button>
        </Vacio>
      ) : (
        <ul className="lista">
          {filas.map(({ cliente, deuda, ultimo }) => (
            <li key={cliente.id} className="item">
              <button className="item-cuerpo" onClick={() => setAbierto(cliente)}>
                <div className="item-titulo">
                  <strong>{cliente.nombre}</strong>
                  <span className="item-sub">
                    {ultimo ? `${ultimo.tipo === 'fiado' ? 'Fió' : 'Abonó'} ${soles(ultimo.monto)} · ${fechaCorta(ultimo.fecha)}` : 'Sin movimientos'}
                    {deuda > 0 && cliente.pagaEl && (cliente.pagaEl < hoyISO() ? <b className="texto-peligro"> · venció {fechaCorta(cliente.pagaEl)}</b> : cliente.pagaEl === hoyISO() ? <b className="texto-ok"> · paga hoy</b> : ` · paga ${fechaCorta(cliente.pagaEl)}`)}
                  </span>
                </div>
                <div className="item-derecha">
                  <span className={'item-precio ' + (deuda > 0 ? 'texto-peligro' : 'texto-ok')}>{deuda > 0 ? soles(deuda) : 'Al día'}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {nuevo && (
        <FormCliente onCerrar={() => setNuevo(false)} onGuardado={() => { setNuevo(false); avisar('Cliente agregado') }} />
      )}
      {abierto && (
        <DetalleCliente
          cliente={abierto}
          movs={porCliente.get(abierto.id) ?? []}
          nombreBodega={nombreBodega}
          onCerrar={() => setAbierto(null)}
          avisar={avisar}
        />
      )}
    </div>
  )
}

function FormCliente({ cliente, onCerrar, onGuardado }: { cliente?: Cliente; onCerrar: () => void; onGuardado: () => void }) {
  const [nombre, setNombre] = useState(cliente?.nombre ?? '')
  const [telefono, setTelefono] = useState(cliente?.telefono ?? '')
  const [nota, setNota] = useState(cliente?.nota ?? '')
  const [pagaEl, setPagaEl] = useState(cliente?.pagaEl ?? '')
  async function guardar() {
    if (!nombre.trim()) return
    await guardarCliente({ nombre: nombre.trim(), telefono: telefono.trim() || undefined, nota: nota.trim() || undefined, pagaEl: pagaEl || undefined }, cliente)
    onGuardado()
  }
  return (
    <Modal titulo={cliente ? 'Editar cliente' : 'Nuevo cliente'} onCerrar={onCerrar}>
      <Campo label="Nombre o cómo lo conoces">
        <input autoFocus type="text" placeholder="Ej. Don Pepe (taller)" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </Campo>
      <Campo label="Celular (opcional)" ayuda="Para recordarle por WhatsApp">
        <input type="tel" inputMode="tel" placeholder="9xxxxxxxx" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
      </Campo>
      <Campo label="Nota (opcional)">
        <input type="text" placeholder="Ej. paga los viernes" value={nota} onChange={(e) => setNota(e.target.value)} />
      </Campo>
      <Campo label="Fecha de pago acordada (opcional)" ayuda="Te avisamos cuando venza">
        <input type="date" value={pagaEl} onChange={(e) => setPagaEl(e.target.value)} />
      </Campo>
      <button className="btn-primario grande ancho" disabled={!nombre.trim()} onClick={guardar}>Guardar</button>
    </Modal>
  )
}

function DetalleCliente({ cliente, movs, nombreBodega, onCerrar, avisar }: { cliente: Cliente; movs: MovimientoFiado[]; nombreBodega: string; onCerrar: () => void; avisar: (m: string) => void }) {
  const deuda = deudaDe(movs)
  const [monto, setMonto] = useState('')
  const [metodo, setMetodo] = useState<Exclude<MetodoPago, 'fiado'>>('efectivo')
  const [editar, setEditar] = useState(false)
  const n = Number(monto) || 0

  async function abonar(cantidad: number) {
    try {
      await registrarAbono(cliente.id, cantidad, metodo)
      setMonto('')
      avisar(`Abono de ${soles(cantidad)} registrado`)
    } catch (e) {
      avisar((e as Error).message)
    }
  }

  const mensaje = encodeURIComponent(`Hola ${cliente.nombre}, le escribo de ${nombreBodega}. Su cuenta pendiente es de ${soles(deuda)}. ¡Gracias! 🙏`)
  const tel = cliente.telefono?.replace(/\D/g, '')
  const linkWa = tel ? `https://wa.me/${tel.length === 9 ? '51' + tel : tel}?text=${mensaje}` : null

  return (
    <Modal titulo={cliente.nombre} onCerrar={onCerrar}>
      <div className={'saldo ' + (deuda > 0 ? 'debe' : 'aldia')}>
        <span>{deuda > 0 ? 'Debe' : 'Está al día'}</span>
        <strong>{soles(Math.max(deuda, 0))}</strong>
        {cliente.nota && <em>{cliente.nota}</em>}
      </div>

      {deuda > 0 && (
        <div className="bloque">
          <Campo label="Registrar abono (S/)">
            <input type="number" inputMode="decimal" step="0.5" min={0} placeholder={deuda.toFixed(2)} value={monto} onChange={(e) => setMonto(e.target.value)} />
          </Campo>
          <div className="chips">
            {METODOS.filter((m) => m.id !== 'fiado').map((m) => (
              <button key={m.id} className={'chip' + (metodo === m.id ? ' activo' : '')} onClick={() => setMetodo(m.id as Exclude<MetodoPago, 'fiado'>)}>{m.icono} {m.label}</button>
            ))}
          </div>
          <div className="acciones">
            <button className="btn-secundario" onClick={() => abonar(deuda)}>Pagó todo</button>
            <button className="btn-primario" disabled={n <= 0} onClick={() => abonar(n)}>Abonar {n > 0 ? soles(n) : ''}</button>
          </div>
          {linkWa ? (
            <a className="btn-whatsapp" href={linkWa} target="_blank" rel="noreferrer">💬 Recordar por WhatsApp</a>
          ) : (
            <p className="nota">Agrega su celular para recordarle por WhatsApp con un toque.</p>
          )}
        </div>
      )}

      <h3 className="subtitulo">Historial</h3>
      {movs.length === 0 ? (
        <p className="nota">Sin movimientos todavía.</p>
      ) : (
        <ul className="historial">
          {[...movs].reverse().map((m) => (
            <li key={m.id} className={m.tipo}>
              <div>
                <strong>{m.tipo === 'fiado' ? 'Fiado' : 'Abono'}</strong>
                <span className="item-sub">{fechaCorta(m.fecha)} {hora(m.fecha)}{m.tipo === 'abono' ? ` · ${METODOS.find((x) => x.id === (m.metodo ?? 'efectivo'))?.label}` : ''}{m.nota ? ` · ${m.nota}` : ''}</span>
              </div>
              <span className={m.tipo === 'fiado' ? 'texto-peligro' : 'texto-ok'}>{m.tipo === 'fiado' ? '+' : '−'}{soles(m.monto)}</span>
            </li>
          ))}
        </ul>
      )}
      <button className="btn-enlace" onClick={() => setEditar(true)}>Editar datos del cliente</button>
      {editar && <FormCliente cliente={cliente} onCerrar={() => setEditar(false)} onGuardado={() => { setEditar(false); onCerrar(); avisar('Cliente actualizado') }} />}
    </Modal>
  )
}
