// chatController.js — proxy hacia n8n. El cerebro IA vive en el workflow de n8n.
const MensajeChat = require('../models/MensajeChat');
const Producto = require('../models/Producto');
const VentaCredito = require('../models/VentaCredito');
const PedidoCliente = require('../models/PedidoCliente');

async function getContexto(usuarioId) {
  const [productos, creditos, encargos] = await Promise.all([
    Producto.find({ usuario: usuarioId, activo: true }).limit(50).lean(),
    VentaCredito.find({ usuario: usuarioId, estado: { $in: ['pendiente', 'abonado'] } }).limit(30).lean(),
    PedidoCliente.find({ usuario: usuarioId, estado: { $in: ['en_curso', 'llego'] } }).limit(20).lean(),
  ]);

  return {
    inventario: productos.map(p => ({
      id: p._id, nombre: p.nombre, categoria: p.categoria,
      talla: p.talla, color: p.color, cantidad: p.cantidad,
      precioCompra: p.precioCompra, precioVenta: p.precioVenta,
    })),
    deudasPendientes: creditos.map(c => ({
      id: c._id, clienteNombre: c.cliente?.nombre,
      totalVenta: c.totalVenta, saldoPendiente: c.saldoPendiente, estado: c.estado,
    })),
    encargosPendientes: encargos.map(e => ({
      id: e._id, clienteNombre: e.cliente?.nombre,
      descripcion: e.descripcion, saldoPendiente: e.saldoPendiente, estado: e.estado,
    })),
    alertasStock: productos.filter(p => p.cantidad <= 3).map(p => ({
      nombre: p.nombre, cantidad: p.cantidad,
    })),
  };
}

exports.historial = async (req, res) => {
  try {
    const mensajes = await MensajeChat.find({ usuario: req.auth.id })
      .sort({ createdAt: -1 }).limit(20).lean();
    res.json(mensajes.reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.enviar = async (req, res) => {
  try {
    const { mensaje } = req.body;
    if (!mensaje?.trim()) return res.status(400).json({ error: 'Mensaje requerido' });

    const n8nUrl = process.env.N8N_WEBHOOK_URL;
    if (!n8nUrl) {
      return res.status(503).json({ error: 'N8N_WEBHOOK_URL no configurado en .env' });
    }

    // Guardar mensaje del usuario
    await MensajeChat.create({ usuario: req.auth.id, rol: 'user', contenido: mensaje });

    // Historial reciente (contexto conversacional)
    const historialReciente = await MensajeChat.find({ usuario: req.auth.id })
      .sort({ createdAt: -1 }).limit(10).lean();

    // Contexto del negocio en tiempo real
    const contexto = await getContexto(req.auth.id);

    // Token interno para n8n — NUNCA pasar el JWT del usuario
    const tokenInterno = process.env.N8N_INTERNAL_TOKEN || '';

    let respuestaFinal = '';
    let accionRealizada = false;

    try {
      const n8nResponse = await fetch(n8nUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuarioId: req.auth.id,
          mensaje,
          historial: historialReciente.reverse().map(m => ({
            rol: m.rol,
            contenido: m.contenido,
          })),
          contexto,
          token: tokenInterno,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!n8nResponse.ok) throw new Error(`n8n status ${n8nResponse.status}`);

      const data = await n8nResponse.json();
      // n8n responde con { respuesta, accionRealizada }
      respuestaFinal = data.respuesta || data.output || data.message || 'Listo 💜';
      accionRealizada = data.accionRealizada || false;

    } catch (err) {
      console.error('[Chat→n8n] Error:', err.message);
      respuestaFinal = 'Tuve un problema con el agente. Intenta de nuevo 💜';
    }

    await MensajeChat.create({ usuario: req.auth.id, rol: 'assistant', contenido: respuestaFinal });
    res.json({ respuesta: respuestaFinal, accionRealizada });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.limpiarHistorial = async (req, res) => {
  try {
    await MensajeChat.deleteMany({ usuario: req.auth.id });
    res.json({ mensaje: 'Historial limpiado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
