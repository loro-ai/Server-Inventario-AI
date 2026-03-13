const PedidoCliente = require('../models/PedidoCliente');

const ESTADOS_VALIDOS = ['en_curso', 'llego', 'entregado', 'cancelado'];

exports.getAll = async (req, res) => {
  try {
    const { estado, cliente } = req.query;
    const filtro = { usuario: req.auth.id };
    if (estado) {
      if (!ESTADOS_VALIDOS.includes(estado))
        return res.status(400).json({ error: `Estado inválido. Válidos: ${ESTADOS_VALIDOS.join(', ')}` });
      filtro.estado = estado;
    }
    if (cliente) filtro['cliente.nombre'] = { $regex: cliente, $options: 'i' };
    const pedidos = await PedidoCliente.find(filtro).sort({ createdAt: -1 });
    res.json(pedidos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const pedido = await PedidoCliente.findOne({ _id: req.params.id, usuario: req.auth.id });
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(pedido);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { cliente, descripcion, categoria, talla, color, linkReferencia,
      totalVenta, notas, abonoInicial, fechaEntrega } = req.body;

    const pedido = new PedidoCliente({
      usuario: req.auth.id,
      cliente,
      descripcion,
      categoria,
      talla,
      color,
      linkReferencia,
      totalVenta,
      notas,
      fechaEntrega,
      abonos: abonoInicial && abonoInicial > 0
        ? [{ monto: abonoInicial, nota: 'Anticipo inicial' }]
        : [],
      historialEstados: [{ estado: 'en_curso', nota: 'Pedido registrado', fecha: new Date() }]
    });
    await pedido.save();
    res.status(201).json(pedido);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.actualizarEstado = async (req, res) => {
  try {
    const { estado, nota } = req.body;
    if (!ESTADOS_VALIDOS.includes(estado))
      return res.status(400).json({ error: `Estado inválido. Válidos: ${ESTADOS_VALIDOS.join(', ')}` });

    const pedido = await PedidoCliente.findOne({ _id: req.params.id, usuario: req.auth.id });
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

    pedido.estado = estado;
    pedido.historialEstados.push({ estado, nota, fecha: new Date() });
    if (estado === 'entregado') pedido.fechaEntrega = new Date();

    await pedido.save();
    res.json(pedido);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.agregarAbono = async (req, res) => {
  try {
    const { monto, nota } = req.body;
    if (!monto || monto <= 0)
      return res.status(400).json({ error: 'El monto debe ser mayor a 0' });

    const pedido = await PedidoCliente.findOne({ _id: req.params.id, usuario: req.auth.id });
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

    if (pedido.saldoPendiente <= 0)
      return res.status(400).json({ error: 'Este pedido ya está pagado completamente' });
    if (monto > pedido.saldoPendiente + 0.01)
      return res.status(400).json({
        error: `El abono ($${monto}) supera el saldo pendiente ($${pedido.saldoPendiente})`
      });

    pedido.abonos.push({ monto, nota, fecha: new Date() });
    await pedido.save();

    res.json({
      mensaje: 'Abono registrado',
      totalPagado: pedido.totalPagado,
      saldoPendiente: pedido.saldoPendiente,
      pedido
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.resumenCartera = async (req, res) => {
  try {
    const pendientes = await PedidoCliente.find({
      usuario: req.auth.id,
      saldoPendiente: { $gt: 0 },
      estado: { $ne: 'cancelado' }
    }).select('cliente descripcion totalVenta totalPagado saldoPendiente estado')
      .sort({ saldoPendiente: -1 });

    const totalCartera = pendientes.reduce((sum, p) => sum + p.saldoPendiente, 0);
    res.json({ totalCartera, totalPedidos: pendientes.length, pendientes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    await PedidoCliente.findOneAndDelete({ _id: req.params.id, usuario: req.auth.id });
    res.json({ mensaje: 'Pedido eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
