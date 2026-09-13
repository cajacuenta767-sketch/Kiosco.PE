import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type CategoriaGasto, type Gasto, type Venta } from '../db/db'
import { CATEGORIAS_GASTO, METODOS, anularVenta, cerrarCaja, eliminarGasto, registrarGasto, resumirVentas } from '../lib/acciones'
import { aDia, diaLabel, fechaCorta, fechaLarga, hora, hoyISO, mesLabel, redondear, resumirMes, soles, textoComprobante } from '@kiosco/shared'
import { Campo, Modal, Vacio } from '../components/ui'

export function Caja({ avisar }: { avisar: (m: string) => void }) {
  const hoy = hoyISO()
  const [dia, setDia] = useState(hoy)
  const ventasDia = useLiveQuery(() => db.ventas.where('dia').equals(dia).reverse().sortBy('fecha'), [dia]) ?? []
  const cierre = useLiveQuery(() => db.cierres.where('dia').equals(dia).first(), [dia])
  const gastosDia = useLiveQuery(() => db.gastos.where('dia').equals(dia).reverse().sortBy('fecha'), [dia]) ?? []
  const abonosDia = useLiveQuery(() => db.movimientosFiado.where('fecha').between(`${dia}T00:00:00`, `${dia}T23:59:59.999Z`, true, true).filter((m) => m.tipo === 'abono').toArray(), [dia]) ?? []
  const cobradoFiado = redondear(abonosDia.reduce((s, m) => s + m.monto, 0))
  const [nuevoGasto, setNuevoGasto] = useState(false)
  const ultimos7 = useMemo(() => {
    const dias: string[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      dias.push(aDia(d))
    }
    return dias
  }, [])
  const semana = useLiveQuery(() => db.ventas.where('dia').between(ultimos7[0], ultimos7[6], true, true).toArray(), [ultimos7]) ?? []
  const gastosSemana = useLiveQuery(() => db.gastos.where('dia').between(ultimos7[0], ultimos7[6], true, true).toArray(), [ultimos7]) ?? []
  const [cerrando, setCerrando] = useState(false)
  const [detalle, setDetalle] = useState<Venta | null>(null)
  const [verMes, setVerMes] = useState(false)
  const mes = dia.slice(0, 7)
  const ventasMes = useLiveQuery(() => db.ventas.where('dia').between(`${mes}-01`, `${mes}-31`, true, true).toArray(), [mes]) ?? []
  const gastosMes = useLiveQuery(() => db.gastos.where('dia').between(`${mes}-01`, `${mes}-31`, true, true).toArray(), [mes]) ?? []
  const fiadosMes = useLiveQuery(() => db.movimientosFiado.where('fecha').between(`${mes}-01`, `${mes}-31T23:59:59.999Z`, true, true).toArray(), [mes]) ?? []
  const nombreBodega = useLiveQuery(() => db.config.get('nombreBodega'), [])?.value ?? ''
  const rm = resumirMes(mes, ventasMes, gastosMes, fiadosMes)

  const r = resumirVentas(ventasDia, dia)
  const porDia = ultimos7.map((d) => ({ dia: d, total: redondear(semana.filter((v) => v.dia === d).reduce((s, v) => s + v.total, 0)) }))
  const maxDia = Math.max(...porDia.map((p) => p.total), 1)
  const totalSemana = redondear(porDia.reduce((s, p) => s + p.total, 0))
  const gananciaSemana = redondear(semana.reduce((s, v) => s + v.total - v.costoTotal, 0) - gastosSemana.reduce((s, g) => s + g.monto, 0))
  const totalGastos = redondear(gastosDia.reduce((s, g) => s + g.monto, 0))
  const gastosDeCaja = redondear(gastosDia.filter((g) => g.deCaja).reduce((s, g) => s + g.monto, 0))
  const gananciaNeta = redondear(r.ganancia - totalGastos)

  async function anular(v: Venta) {
    if (!confirm(`¿Anular la venta de ${soles(v.total)}? El stock vuelve a su lugar.`)) return
    await anularVenta(v)
    setDetalle(null)
    avisar('Venta anulada')
  }

  return (
    <div className="pantalla">
      <div className="selector-dia">
        <button className="btn-mini" onClick={() => setDia(mover(dia, -1))}>‹</button>
        <div className="selector-dia-titulo">
          <strong>{dia === hoy ? 'Hoy' : fechaLarga(dia)}</strong>
          {dia === hoy && <span className="item-sub">{fechaLarga(dia)}</span>}
        </div>
        <button className="btn-mini" disabled={dia >= hoy} onClick={() => setDia(mover(dia, 1))}>›</button>
      </div>

      <div className="hero-cifra">
        <span>Vendiste</span>
        <strong>{soles(r.totalVentas)}</strong>
        <span className="hero-sub">
          Ganancia <b className={gananciaNeta >= 0 ? 'texto-ok' : 'texto-peligro'}>{soles(gananciaNeta)}</b> · {r.numVentas} {r.numVentas === 1 ? 'venta' : 'ventas'}
          {totalGastos > 0 && <> · gastos {soles(totalGastos)}</>}
        </span>
      </div>

      <div className="metodos-resumen">
        {METODOS.map((m) => (
          <div key={m.id} className={'mr' + (r.porMetodo[m.id] > 0 ? '' : ' apagado')}>
            <span>{m.icono} {m.label}</span>
            <strong>{soles(r.porMetodo[m.id])}</strong>
          </div>
        ))}
        <div className={'mr' + (cobradoFiado > 0 ? '' : ' apagado')}>
          <span>✅ Fiados cobrados</span>
          <strong>{soles(cobradoFiado)}</strong>
        </div>
      </div>

      {cierre ? (
        <div className={'cierre-hecho ' + (cierre.diferencia === 0 ? 'ok' : cierre.diferencia < 0 ? 'peligro' : 'alerta')}>
          <strong>Caja cerrada</strong>
          <span>Contado {soles(cierre.efectivoContado)} · Esperado {soles(cierre.efectivoEsperado)} · {cierre.diferencia === 0 ? 'Cuadró perfecto ✓' : cierre.diferencia < 0 ? `Faltan ${soles(-cierre.diferencia)}` : `Sobran ${soles(cierre.diferencia)}`}</span>
        </div>
      ) : (
        dia === hoy && <button className="btn-secundario ancho" onClick={() => setCerrando(true)}>🔒 Cerrar caja de hoy</button>
      )}

      <div className="subtitulo con-accion">
        <span>Gastos del día · {soles(totalGastos)}</span>
        {dia === hoy && <button className="btn-enlace" onClick={() => setNuevoGasto(true)}>+ Anotar gasto</button>}
      </div>
      {gastosDia.length === 0 ? (
        <p className="nota">Anota lo que sale de caja (proveedor, luz, pasaje) para que la ganancia y el cierre sean reales.</p>
      ) : (
        <ul className="lista compacta">
          {gastosDia.map((g) => (
            <li key={g.id} className="fila-simple">
              <span>{CATEGORIAS_GASTO.find((c) => c.id === g.categoria)?.icono} {g.nota || CATEGORIAS_GASTO.find((c) => c.id === g.categoria)?.label}{!g.deCaja && <em className="item-sub"> · no salió de caja</em>}</span>
              <strong className="texto-peligro">−{soles(g.monto)}</strong>
              <button className="btn-icono chico" aria-label="Eliminar gasto" onClick={async () => { if (confirm('¿Eliminar este gasto?')) await eliminarGasto(g.id) }}>✕</button>
            </li>
          ))}
        </ul>
      )}

      <h3 className="subtitulo">Últimos 7 días · {soles(totalSemana)} vendido · {soles(gananciaSemana)} ganado</h3>
      <div className="barras">
        {porDia.map((p) => (
          <button key={p.dia} className={'barra' + (p.dia === dia ? ' activa' : '')} onClick={() => setDia(p.dia)} title={soles(p.total)}>
            <span className="barra-valor">{p.total > 0 ? Math.round(p.total) : ''}</span>
            <span className="barra-relleno" style={{ height: `${Math.max(4, (p.total / maxDia) * 100)}%` }} />
            <span className="barra-label">{diaLabel(p.dia)}</span>
          </button>
        ))}
      </div>

      <button className="banner-accion" onClick={() => setVerMes(true)}>
        <span>📅 <strong>{mesLabel(mes)}</strong> · vendido {soles(rm.vendido)} · ganancia neta {soles(rm.gananciaNeta)}</span>
        <span>›</span>
      </button>

      {r.topProductos.length > 0 && (
        <>
          <h3 className="subtitulo">Lo más vendido</h3>
          <ul className="lista compacta">
            {r.topProductos.map((t, i) => (
              <li key={t.nombre} className="fila-simple">
                <span>{i + 1}. {t.nombre} <em className="item-sub">× {t.cantidad}</em></span>
                <strong>{soles(t.total)}</strong>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="subtitulo">Ventas del día</h3>
      {ventasDia.length === 0 ? (
        <Vacio icono="🧾" titulo="Sin ventas este día" texto="Las ventas que registres en Vender aparecerán aquí." />
      ) : (
        <ul className="lista compacta">
          {ventasDia.map((v) => (
            <li key={v.id} className="fila-simple clic" onClick={() => setDetalle(v)}>
              <span>
                {hora(v.fecha)} · {METODOS.find((m) => m.id === v.metodoPago)?.icono} {v.items.map((i) => `${i.cantidad} ${i.nombre}`).join(', ')}
              </span>
              <strong>{soles(v.total)}</strong>
            </li>
          ))}
        </ul>
      )}

      {cerrando && (
        <CerrarCaja efectivoVentas={r.porMetodo.efectivo} cobradoFiado={cobradoFiado} gastosDeCaja={gastosDeCaja} totalVentas={r.totalVentas} dia={dia} onCerrar={() => setCerrando(false)} onHecho={() => { setCerrando(false); avisar('Caja cerrada') }} />
      )}
      {nuevoGasto && (
        <FormGasto onCerrar={() => setNuevoGasto(false)} onHecho={(g) => { setNuevoGasto(false); avisar(`Gasto de ${soles(g.monto)} anotado`) }} />
      )}
      {detalle && (
        <Modal titulo={`Venta · ${hora(detalle.fecha)}`} onCerrar={() => setDetalle(null)}>
          <ul className="historial">
            {detalle.items.map((i, k) => (
              <li key={k}>
                <div><strong>{i.nombre}</strong><span className="item-sub">{i.cantidad} × {soles(i.precio)}</span></div>
                <span>{soles(i.cantidad * i.precio)}</span>
              </li>
            ))}
          </ul>
          <div className="fila-total"><span>Total ({METODOS.find((m) => m.id === detalle.metodoPago)?.label})</span><strong>{soles(detalle.total)}</strong></div>
          {detalle.vuelto != null && detalle.vuelto > 0 && <p className="nota">Pagó con {soles(detalle.pagoCon!)} · vuelto {soles(detalle.vuelto)}</p>}
          <a className="btn-whatsapp" href={`https://wa.me/?text=${encodeURIComponent(textoComprobante(detalle, nombreBodega, METODOS.find((m) => m.id === detalle.metodoPago)?.label ?? ''))}`} target="_blank" rel="noreferrer">💬 Enviar comprobante por WhatsApp</a>
          <button className="btn-peligro ancho" onClick={() => anular(detalle)}>Anular venta</button>
        </Modal>
      )}
      {verMes && (
        <Modal titulo={`Resumen de ${mesLabel(mes)}`} onCerrar={() => setVerMes(false)}>
          <div className="kpis">
            <div className="kpi"><span className="kpi-label">Vendido</span><strong>{soles(rm.vendido)}</strong></div>
            <div className="kpi"><span className="kpi-label">Ganancia neta</span><strong className={rm.gananciaNeta >= 0 ? 'texto-ok' : 'texto-peligro'}>{soles(rm.gananciaNeta)}</strong></div>
            <div className="kpi"><span className="kpi-label">Gastos</span><strong>{soles(rm.gastos)}</strong></div>
            <div className="kpi"><span className="kpi-label">Ventas</span><strong>{rm.numVentas}</strong></div>
            <div className="kpi"><span className="kpi-label">Promedio por día</span><strong>{soles(rm.promedioDiario)}</strong></div>
            <div className="kpi"><span className="kpi-label">Mejor día</span><strong>{rm.mejorDia ? `${fechaCorta(rm.mejorDia.dia)} · ${soles(rm.mejorDia.total)}` : '—'}</strong></div>
            <div className="kpi"><span className="kpi-label">Fiado en el mes</span><strong>{soles(rm.fiado)}</strong></div>
            <div className="kpi"><span className="kpi-label">Fiado cobrado</span><strong className="texto-ok">{soles(rm.cobradoFiado)}</strong></div>
          </div>
          <p className="nota">Ganancia bruta {soles(rm.gananciaBruta)} menos gastos {soles(rm.gastos)}. {rm.diasConVenta} {rm.diasConVenta === 1 ? 'día' : 'días'} con ventas.</p>
          {rm.topProductos.length > 0 && (
            <>
              <h3 className="subtitulo">Lo más vendido del mes</h3>
              <ul className="lista compacta">
                {rm.topProductos.map((t, i) => (
                  <li key={t.nombre} className="fila-simple"><span>{i + 1}. {t.nombre} <em className="item-sub">× {t.cantidad}</em></span><strong>{soles(t.total)}</strong></li>
                ))}
              </ul>
            </>
          )}
        </Modal>
      )}
    </div>
  )
}

function mover(dia: string, n: number): string {
  const [y, m, d] = dia.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  return aDia(dt)
}

function FormGasto({ onCerrar, onHecho }: { onCerrar: () => void; onHecho: (g: Pick<Gasto, 'monto'>) => void }) {
  const [monto, setMonto] = useState('')
  const [categoria, setCategoria] = useState<CategoriaGasto>('proveedor')
  const [nota, setNota] = useState('')
  const [deCaja, setDeCaja] = useState(true)
  const n = Number(monto) || 0
  async function guardar() {
    await registrarGasto({ monto: n, categoria, nota, deCaja })
    onHecho({ monto: n })
  }
  return (
    <Modal titulo="Anotar gasto" onCerrar={onCerrar}>
      <Campo label="¿Cuánto salió? (S/)">
        <input autoFocus type="number" inputMode="decimal" step="0.1" min={0} placeholder="0.00" value={monto} onChange={(e) => setMonto(e.target.value)} />
      </Campo>
      <div className="chips">
        {CATEGORIAS_GASTO.map((c) => (
          <button key={c.id} className={'chip' + (categoria === c.id ? ' activo' : '')} onClick={() => setCategoria(c.id)}>{c.icono} {c.label}</button>
        ))}
      </div>
      <Campo label="¿En qué? (opcional)">
        <input type="text" placeholder="Ej. pago a Backus, recibo de luz" value={nota} onChange={(e) => setNota(e.target.value)} />
      </Campo>
      <label className="check">
        <input type="checkbox" checked={deCaja} onChange={(e) => setDeCaja(e.target.checked)} />
        <span>Salió del efectivo de la caja</span>
      </label>
      <button className="btn-primario grande ancho" disabled={n <= 0} onClick={guardar}>Anotar gasto {n > 0 ? soles(n) : ''}</button>
    </Modal>
  )
}

function CerrarCaja({ efectivoVentas, cobradoFiado, gastosDeCaja, totalVentas, dia, onCerrar, onHecho }: { efectivoVentas: number; cobradoFiado: number; gastosDeCaja: number; totalVentas: number; dia: string; onCerrar: () => void; onHecho: () => void }) {
  const [inicial, setInicial] = useState('')
  const [contado, setContado] = useState('')
  const esperado = redondear((Number(inicial) || 0) + efectivoVentas + cobradoFiado - gastosDeCaja)
  const dif = redondear((Number(contado) || 0) - esperado)
  async function guardar() {
    await cerrarCaja({ dia, montoInicial: Number(inicial) || 0, efectivoEsperado: esperado, efectivoContado: Number(contado) || 0, diferencia: dif, totalVentas })
    onHecho()
  }
  return (
    <Modal titulo="Cerrar caja" onCerrar={onCerrar}>
      <Campo label="¿Con cuánto efectivo empezaste el día? (S/)" ayuda="Tu sencillo / caja chica">
        <input autoFocus type="number" inputMode="decimal" min={0} value={inicial} onChange={(e) => setInicial(e.target.value)} />
      </Campo>
      <p className="nota">
        Ventas en efectivo de hoy: <strong>{soles(efectivoVentas)}</strong>.{cobradoFiado > 0 && <> Fiados cobrados: <strong>{soles(cobradoFiado)}</strong>.</>}{gastosDeCaja > 0 && <> Gastos que salieron de caja: <strong>{soles(gastosDeCaja)}</strong>.</>} Deberías tener <strong>{soles(esperado)}</strong> en caja.
      </p>
      <Campo label="¿Cuánto efectivo hay realmente? (S/)">
        <input type="number" inputMode="decimal" min={0} value={contado} onChange={(e) => setContado(e.target.value)} />
      </Campo>
      {contado !== '' && (
        <div className={'vuelto' + (dif < 0 ? ' negativo' : '')}>
          <span>{dif === 0 ? 'Cuadra perfecto' : dif < 0 ? 'Faltante' : 'Sobrante'}</span>
          <strong>{dif === 0 ? '✓' : soles(Math.abs(dif))}</strong>
        </div>
      )}
      <button className="btn-primario grande ancho" disabled={contado === ''} onClick={guardar}>Cerrar caja</button>
    </Modal>
  )
}
