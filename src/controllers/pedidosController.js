const Pedido = require('../models/Pedido');

const ESTADOS_VALIDOS = ['pendiente', 'pedido_en_temu', 'en_camino', 'llego', 'entregado', 'cancelado'];

exports.getAll = async (req, res) => {
  try {
    const { estado } = req.query;
    const filtro = { usuario: req.auth.id };
    if (estado) {
      if (!ESTADOS_VALIDOS.includes(estado))
        return res.status(400).json({ error: `Estado inválido. Válidos: ${ESTADOS_VALIDOS.join(', ')}` });
      filtro.estado = estado;
    }
    const pedidos = await Pedido.find(filtro)
      .sort({ createdAt: -1 })
      .populate('productoVinculado', 'nombre cantidad');
    res.json(pedidos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const pedido = await Pedido.findOne({ _id: req.params.id, usuario: req.auth.id })
      .populate('productoVinculado', 'nombre cantidad precioVenta');
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(pedido);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const pedido = new Pedido({ ...req.body, usuario: req.auth.id });
    pedido.historialEstados.push({ estado: 'pendiente', nota: 'Pedido creado', fecha: new Date() });
    await pedido.save();
    res.status(201).json(pedido);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.actualizarEstado = async (req, res) => {
  try {
    const { estado, nota } = req.body;
    // FIX: validación de estado que faltaba
    if (!ESTADOS_VALIDOS.includes(estado))
      return res.status(400).json({ error: `Estado inválido. Válidos: ${ESTADOS_VALIDOS.join(', ')}` });

    const pedido = await Pedido.findOne({ _id: req.params.id, usuario: req.auth.id });
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

    pedido.estado = estado;
    pedido.historialEstados.push({ estado, nota, fecha: new Date() });

    if (estado === 'pedido_en_temu') {
      pedido.fechaPedidoTemu = new Date();
      if (req.body.fechaEstimadaLlegada)
        pedido.fechaEstimadaLlegada = new Date(req.body.fechaEstimadaLlegada);
    }
    if (estado === 'entregado') pedido.fechaEntrega = new Date();

    await pedido.save();
    res.json(pedido);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    // No permitir cambiar estado por esta ruta
    const { estado, ...datos } = req.body;
    const pedido = await Pedido.findOneAndUpdate(
      { _id: req.params.id, usuario: req.auth.id },
      datos,
      { new: true, runValidators: true }
    );
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(pedido);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    await Pedido.findOneAndDelete({ _id: req.params.id, usuario: req.auth.id });
    res.json({ mensaje: 'Pedido eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
