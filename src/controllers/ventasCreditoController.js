const VentaCredito = require('../models/VentaCredito');
const Producto = require('../models/Producto');

exports.getAll = async (req, res) => {
  try {
    const { estado, cliente } = req.query;
    const filtro = { usuario: req.auth.id };
    if (estado) filtro.estado = estado;
    if (cliente) filtro['cliente.nombre'] = { $regex: cliente, $options: 'i' };
    const ventas = await VentaCredito.find(filtro).sort({ createdAt: -1 });
    res.json(ventas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const venta = await VentaCredito.findOne({ _id: req.params.id, usuario: req.auth.id })
      .populate('items.producto', 'nombre precioVenta');
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
    res.json(venta);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { cliente, items, descripcion, notas, fechaLimitePago, abonoInicial, totalVenta } = req.body;

    let itemsCompletos = [];
    let totalCalculado = 0;

    if (items && items.length > 0) {
      itemsCompletos = await Promise.all(items.map(async (item) => {
        if (item.productoId) {
          const producto = await Producto.findOne({ _id: item.productoId, usuario: req.auth.id });
          if (!producto) throw new Error(`Producto ${item.productoId} no encontrado`);
          if (producto.cantidad < item.cantidad)
            throw new Error(`Solo hay ${producto.cantidad} unidades de ${producto.nombre}`);
          producto.cantidad -= item.cantidad;
          await producto.save();
          totalCalculado += producto.precioVenta * item.cantidad;
          return {
            producto: producto._id,
            nombreProducto: producto.nombre,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario || producto.precioVenta,
            precioCompra: producto.precioCompra
          };
        }
        // Item sin producto vinculado
        totalCalculado += (item.precioUnitario || 0) * (item.cantidad || 1);
        return {
          nombreProducto: item.nombreProducto || 'Producto',
          cantidad: item.cantidad || 1,
          precioUnitario: item.precioUnitario || 0,
          precioCompra: item.precioCompra || 0
        };
      }));
    }

    // Si no hay items, usar totalVenta directamente
    const total = itemsCompletos.length > 0 ? totalCalculado : (totalVenta || 0);

    const venta = new VentaCredito({
      usuario: req.auth.id,
      cliente,
      items: itemsCompletos,
      descripcion,
      totalVenta: total,
      notas,
      fechaLimitePago,
      abonos: abonoInicial && abonoInicial > 0
        ? [{ monto: abonoInicial, nota: 'Abono inicial' }]
        : []
    });

    await venta.save();
    res.status(201).json(venta);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.agregarAbono = async (req, res) => {
  try {
    const { monto, nota } = req.body;
    const venta = await VentaCredito.findOne({ _id: req.params.id, usuario: req.auth.id });
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
    if (venta.estado === 'pagado')
      return res.status(400).json({ error: 'Esta venta ya está pagada completamente' });
    if (monto > venta.saldoPendiente + 0.01)
      return res.status(400).json({
        error: `El abono ($${monto}) supera el saldo pendiente ($${venta.saldoPendiente})`
      });

    venta.abonos.push({ monto, nota, fecha: new Date() });
    await venta.save(); // pre-save recalcula totalPagado, saldoPendiente y estado

    res.json({
      mensaje: 'Abono registrado',
      totalPagado: venta.totalPagado,
      saldoPendiente: venta.saldoPendiente,
      estado: venta.estado,
      venta
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.resumenCartera = async (req, res) => {
  try {
    const pendientes = await VentaCredito.find({
      usuario: req.auth.id,
      estado: { $in: ['pendiente', 'abonado'] }
    }).select('cliente descripcion totalVenta totalPagado saldoPendiente estado fechaLimitePago')
      .sort({ saldoPendiente: -1 });

    const totalCartera = pendientes.reduce((sum, v) => sum + v.saldoPendiente, 0);
    res.json({
      totalCartera,
      totalClientes: pendientes.length,
      deudoras: pendientes
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
