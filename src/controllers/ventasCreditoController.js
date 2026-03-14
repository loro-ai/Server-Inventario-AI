import { useState, useEffect } from 'react'
import { Users, Plus, X, DollarSign, ChevronRight, Search } from 'lucide-react'
import { toast } from 'sonner'
import api from '../lib/api'
import { formatCOP, fechaRelativa, getIniciales, colorEstadoCredito } from '../lib/utils'

export default function Deudas() {
  const [cartera, setCartera] = useState({ totalCartera: 0, deudoras: [] })
  const [loading, setLoading] = useState(true)
  const [modalDeudora, setModalDeudora] = useState(null)
  const [mostrarFormNueva, setMostrarFormNueva] = useState(false)
  const [mostrarFormAbono, setMostrarFormAbono] = useState(false)
  const [montoAbono, setMontoAbono] = useState('')
  const [notaAbono, setNotaAbono] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [clienteNombre, setClienteNombre] = useState('')
  const [abonoInicial, setAbonoInicial] = useState('')

  // Buscador producto
  const [busquedaProducto, setBusquedaProducto] = useState('')
  const [productosResultado, setProductosResultado] = useState([])
  const [productoSeleccionado, setProductoSeleccionado] = useState(null)
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)
  const [cantidad, setCantidad] = useState(1)

  useEffect(() => {
    if (busquedaProducto.trim().length < 1) { setProductosResultado([]); return }
    const t = setTimeout(() => {
      api.get('/api/productos', { params: { busqueda: busquedaProducto } })
        .then(r => setProductosResultado(r.data.slice(0, 6)))
        .catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [busquedaProducto])

  const totalDeuda = productoSeleccionado ? productoSeleccionado.precioVenta * cantidad : 0

  const seleccionarProducto = (p) => {
    setProductoSeleccionado(p)
    setBusquedaProducto(p.nombre)
    setMostrarSugerencias(false)
  }

  const abrirNuevaDeuda = () => {
    setClienteNombre('')
    setAbonoInicial('')
    setBusquedaProducto('')
    setProductoSeleccionado(null)
    setCantidad(1)
    setMostrarSugerencias(false)
    setMostrarFormNueva(true)
  }

  const cargar = () => {
    setLoading(true)
    api.get('/api/credito/cartera')
      .then(r => setCartera(r.data))
      .catch(() => toast.error('Error cargando deudas'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [])

  const abrirModal = async (d) => {
    try {
      const { data } = await api.get(`/api/credito/${d._id}`)
      setModalDeudora(data)
    } catch {
      setModalDeudora(d)
    }
  }

  const handleNuevaDeuda = async (e) => {
    e.preventDefault()
    if (!clienteNombre.trim()) { toast.error('El nombre es obligatorio'); return }
    if (!productoSeleccionado) { toast.error('Selecciona un producto del inventario'); return }
    setGuardando(true)
    try {
      await api.post('/api/credito', {
        cliente: { nombre: clienteNombre },
        descripcion: `${cantidad > 1 ? cantidad + 'x ' : ''}${productoSeleccionado.nombre}`,
        totalVenta: totalDeuda,
        abonoInicial: abonoInicial ? parseFloat(abonoInicial) : undefined,
      })
      toast.success('¡Deuda registrada!')
      setMostrarFormNueva(false)
      cargar()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error guardando')
    } finally { setGuardando(false) }
  }

  const handleAbono = async (e) => {
    e.preventDefault()
    if (!montoAbono || !modalDeudora) { toast.error('Ingresa el monto del abono'); return }
    setGuardando(true)
    try {
      await api.post(`/api/credito/${modalDeudora._id}/abonos`, {
        monto: parseFloat(montoAbono),
        nota: notaAbono || undefined
      })
      toast.success('¡Abono registrado!')
      setMostrarFormAbono(false)
      setMontoAbono(''); setNotaAbono('')
      cargar()
      const { data } = await api.get(`/api/credito/${modalDeudora._id}`)
      setModalDeudora(data)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error registrando abono')
    } finally { setGuardando(false) }
  }

  const { totalCartera, deudoras } = cartera

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-gray-900">Quién me debe</h1>
        <button onClick={abrirNuevaDeuda}
          className="flex items-center gap-1.5 bg-[#7C3AED] text-white font-bold text-sm px-4 py-2.5 rounded-xl hover:bg-[#5B21B6] transition-colors">
          <Plus className="w-4 h-4" /> Nueva
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-xs font-bold text-red-600 mb-1">Total que me deben</p>
          <p className="text-2xl font-black text-red-700">{formatCOP(totalCartera)}</p>
        </div>
        <div className="bg-white border border-purple-100 rounded-2xl p-4">
          <p className="text-xs font-bold text-gray-400 mb-1">Clientas con deuda</p>
          <p className="text-2xl font-black text-gray-900">{deudoras.length}</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-white rounded-2xl border border-purple-100 animate-pulse" />)}</div>
      ) : deudoras.length === 0 ? (
        <div className="bg-white rounded-2xl border border-purple-100 p-8 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 font-semibold">¡Ninguna clienta te debe nada!</p>
          <p className="text-sm text-gray-400 mt-1">Cuando alguien se lleve algo a crédito, aparecerá aquí</p>
        </div>
      ) : (
        <div className="space-y-3">
          {deudoras.map(d => {
            const pct = d.totalVenta > 0 ? Math.min(100, (d.totalPagado / d.totalVenta) * 100) : 0
            return (
              <button key={d._id} onClick={() => abrirModal(d)}
                className="w-full bg-white rounded-2xl border border-purple-100 p-4 shadow-sm text-left hover:border-[#7C3AED] transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                    <span className="font-black text-[#7C3AED] text-sm">{getIniciales(d.cliente?.nombre || d.clienteNombre || '')}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-gray-900 text-base leading-tight truncate">{d.cliente?.nombre || d.clienteNombre}</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${colorEstadoCredito(d.estado)}`}>
                        {d.estado === 'pagado' ? 'Pagada ✓' : d.estado === 'abonado' ? 'Abonando' : 'Pendiente'}
                      </span>
                    </div>
                    {d.descripcion && <p className="text-sm text-gray-400 mt-0.5 truncate">{d.descripcion}</p>}
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Pagado: {formatCOP(d.totalPagado)}</span>
                        <span className="font-bold text-red-500">Falta: {formatCOP(d.saldoPendiente)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-[#7C3AED]' : 'bg-red-400'}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">{fechaRelativa(d.createdAt)}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" />
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Modal detalle deudora */}
      {modalDeudora && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40">
          <div className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center">
                    <span className="font-black text-[#7C3AED]">{getIniciales(modalDeudora.cliente?.nombre || '')}</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-gray-900">{modalDeudora.cliente?.nombre}</h2>
                    {modalDeudora.descripcion && <p className="text-sm text-gray-400">{modalDeudora.descripcion}</p>}
                  </div>
                </div>
                <button onClick={() => { setModalDeudora(null); setMostrarFormAbono(false) }} className="p-2 rounded-xl hover:bg-gray-100"><X className="w-5 h-5" /></button>
              </div>

              <div className="bg-purple-50 rounded-xl p-4 mb-4">
                <div className="flex justify-between mb-2"><span className="text-sm text-gray-500">Total</span><span className="font-bold text-gray-900">{formatCOP(modalDeudora.totalVenta)}</span></div>
                <div className="flex justify-between mb-2"><span className="text-sm text-gray-500">Pagado</span><span className="font-bold text-emerald-600">{formatCOP(modalDeudora.totalPagado)}</span></div>
                <div className="flex justify-between"><span className="text-sm font-bold text-gray-700">Falta</span><span className="font-black text-red-600 text-lg">{formatCOP(modalDeudora.saldoPendiente)}</span></div>
              </div>

              <h3 className="font-bold text-gray-900 mb-3">Historial de abonos</h3>
              {modalDeudora.abonos?.length > 0 ? (
                <div className="space-y-2 mb-4">
                  {modalDeudora.abonos.map((a, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{formatCOP(a.monto)}</p>
                        {a.nota && <p className="text-xs text-gray-400">{a.nota}</p>}
                      </div>
                      <p className="text-xs text-gray-400">{fechaRelativa(a.fecha)}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-gray-400 mb-4">Sin abonos registrados</p>}

              {modalDeudora.estado !== 'pagado' && (
                !mostrarFormAbono ? (
                  <button onClick={() => setMostrarFormAbono(true)}
                    className="w-full flex items-center justify-center gap-2 bg-[#7C3AED] text-white font-bold py-4 rounded-xl hover:bg-[#5B21B6] transition-colors">
                    <DollarSign className="w-5 h-5" /> Registrar abono
                  </button>
                ) : (
                  <form onSubmit={handleAbono} className="space-y-3">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Monto del abono ($)</label>
                      <input type="number" min="1" value={montoAbono} onChange={e => setMontoAbono(e.target.value)}
                        placeholder="Ej: 30000" autoFocus required
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-purple-400" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Nota (opcional)</label>
                      <input type="text" value={notaAbono} onChange={e => setNotaAbono(e.target.value)}
                        placeholder="Ej: Pago en efectivo"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-purple-400" />
                    </div>
                    <div className="flex gap-3">
                      <button type="button" onClick={() => setMostrarFormAbono(false)}
                        className="flex-1 py-3 rounded-xl border border-gray-200 font-bold text-gray-700 hover:bg-gray-50">Cancelar</button>
                      <button type="submit" disabled={guardando}
                        className="flex-1 bg-[#7C3AED] text-white font-bold py-3 rounded-xl hover:bg-[#5B21B6] disabled:opacity-60">
                        {guardando ? 'Guardando...' : 'Guardar abono'}
                      </button>
                    </div>
                  </form>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal nueva deuda */}
      {mostrarFormNueva && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40">
          <div className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-5">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-black text-gray-900">Nueva venta a crédito</h2>
                <button onClick={() => setMostrarFormNueva(false)} className="p-2 rounded-xl hover:bg-gray-100"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleNuevaDeuda} className="space-y-4">

                {/* Nombre clienta */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Nombre de la clienta *</label>
                  <input type="text" value={clienteNombre} onChange={e => setClienteNombre(e.target.value)}
                    placeholder="Ej: Ana García" required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-purple-400" />
                </div>

                {/* Buscador producto */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Producto *</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" placeholder="Buscar en inventario..."
                      value={busquedaProducto}
                      onChange={e => {
                        setBusquedaProducto(e.target.value)
                        setProductoSeleccionado(null)
                        setMostrarSugerencias(true)
                      }}
                      onFocus={() => setMostrarSugerencias(true)}
                      className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-purple-400" />
                    {busquedaProducto && (
                      <button type="button" onClick={() => { setBusquedaProducto(''); setProductoSeleccionado(null) }}
                        className="absolute right-3 top-1/2 -translate-y-1/2">
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    )}
                    {mostrarSugerencias && productosResultado.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white rounded-xl border border-purple-100 shadow-lg overflow-hidden">
                        {productosResultado.map(p => (
                          <button key={p._id} type="button" onMouseDown={() => seleccionarProducto(p)}
                            className="w-full px-4 py-3 text-left hover:bg-purple-50 transition-colors border-b border-gray-50 last:border-0">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-bold text-gray-900 text-sm">{p.nombre}</p>
                                <p className="text-xs text-gray-400">{p.talla && `Talla ${p.talla} · `}{p.color}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-[#7C3AED]">{formatCOP(p.precioVenta)}</p>
                                <p className="text-xs text-gray-400">{p.cantidad} und.</p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Cantidad, total y abono — solo si hay producto */}
                {productoSeleccionado && (
                  <>
                    <div className="bg-purple-50 rounded-xl p-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500">Precio unitario</p>
                        <p className="font-bold text-[#7C3AED]">{formatCOP(productoSeleccionado.precioVenta)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Stock disponible</p>
                        <p className="font-bold text-gray-900">{productoSeleccionado.cantidad} und.</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Cantidad</label>
                      <input type="number" min="1" max={productoSeleccionado.cantidad} value={cantidad}
                        onChange={e => setCantidad(parseInt(e.target.value) || 1)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-purple-400" />
                    </div>

                    <div className="bg-red-50 rounded-xl p-3 flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-700">Total que debe</span>
                      <span className="font-black text-red-600 text-xl">{formatCOP(totalDeuda)}</span>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Abono inicial (opcional)</label>
                      <input type="number" min="0" max={totalDeuda} value={abonoInicial}
                        onChange={e => setAbonoInicial(e.target.value)}
                        placeholder="0"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-purple-400" />
                      {abonoInicial && parseFloat(abonoInicial) > 0 && (
                        <p className="text-xs text-gray-400 mt-1">
                          Queda debiendo: {formatCOP(totalDeuda - parseFloat(abonoInicial))}
                        </p>
                      )}
                    </div>
                  </>
                )}

                <button type="submit" disabled={guardando || !productoSeleccionado}
                  className="w-full bg-[#7C3AED] text-white font-black text-lg py-4 rounded-xl hover:bg-[#5B21B6] transition-colors disabled:opacity-60">
                  {guardando ? 'Guardando...' : 'Registrar deuda'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
