const Producto = require('../models/Producto');

// Escapa caracteres especiales de regex para evitar ReDoS
function escaparRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

exports.getAll = async (req, res) => {
  try {
    const { categoria, talla, stockBajo, busqueda } = req.query;
    const filtro = { activo: true, usuario: req.auth.id };
    if (categoria) filtro.categoria = categoria;
    if (talla) filtro.talla = talla;
    if (stockBajo === 'true') filtro.cantidad = { $lte: 3 };
    if (busqueda) {
      const b = escaparRegex(busqueda.slice(0, 100)); // max 100 chars
      filtro.$or = [
        { nombre: { $regex: b, $options: 'i' } },
        { color: { $regex: b, $options: 'i' } },
        { talla: { $regex: b, $options: 'i' } },
        { categoria: { $regex: b, $options: 'i' } }
      ];
    }
    const productos = await Producto.find(filtro).sort({ createdAt: -1 });
    res.json(productos);
  } catch (err) {
    res.status(500).json({ error: 'Error cargando productos' });
  }
};

exports.getOne = async (req, res) => {
  try {
    const producto = await Producto.findOne({ _id: req.params.id, usuario: req.auth.id });
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(producto);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const producto = new Producto({ ...req.body, usuario: req.auth.id });
    await producto.save();
    res.status(201).json(producto);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const producto = await Producto.findOne({ _id: req.params.id, usuario: req.auth.id });
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    Object.assign(producto, req.body);
    await producto.save(); // pre-save recalcula utilidades
    res.json(producto);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    await Producto.findOneAndUpdate(
      { _id: req.params.id, usuario: req.auth.id },
      { activo: false }
    );
    res.json({ mensaje: 'Producto eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.buscar = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const b = escaparRegex(q.slice(0, 100)); // max 100 chars
    const productos = await Producto.find({
      activo: true,
      usuario: req.auth.id,
      $or: [
        { nombre: { $regex: b, $options: 'i' } },
        { categoria: { $regex: b, $options: 'i' } },
        { color: { $regex: b, $options: 'i' } },
        { talla: { $regex: b, $options: 'i' } }
      ]
    });
    res.json(productos);
  } catch (err) {
    res.status(500).json({ error: 'Error en búsqueda' });
  }
};

exports.ajustarStock = async (req, res) => {
  try {
    const { delta } = req.body;
    if (delta === undefined) return res.status(400).json({ error: 'delta es requerido' });
    const producto = await Producto.findOne({ _id: req.params.id, usuario: req.auth.id });
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    const nuevaCantidad = producto.cantidad + delta;
    if (nuevaCantidad < 0) return res.status(400).json({ error: 'No hay suficiente stock' });
    producto.cantidad = nuevaCantidad;
    await producto.save();
    res.json({ cantidad: producto.cantidad, producto });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.historial = async (req, res) => {
  try {
    const Venta = require('../models/Venta');
    const VentaCredito = require('../models/VentaCredito');

    const producto = await Producto.findOne({ _id: req.params.id, usuario: req.auth.id });
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

    // Ventas de contado donde aparece este producto
    const ventas = await Venta.find({
      usuario: req.auth.id,
      'items.producto': producto._id
    }).sort({ fecha: -1 }).limit(20).lean();

    // Créditos donde aparece este producto
    const creditos = await VentaCredito.find({
      usuario: req.auth.id,
      'items.productoId': producto._id
    }).sort({ createdAt: -1 }).limit(20).lean();

    // Formatear ventas
    const ventasFormateadas = ventas.map(v => {
      const item = v.items?.find(i => String(i.producto) === String(producto._id));
      return {
        tipo: 'venta',
        fecha: v.fecha,
        cliente: v.cliente || null,
        cantidad: item?.cantidadVendida || 0,
        total: item ? item.cantidadVendida * item.precioVenta : 0,
        nota: v.nota || null,
        ventaCreditoOrigen: v.ventaCreditoOrigen || null,
      };
    });

    // Formatear créditos
    const creditosFormateados = creditos.map(c => {
      const item = c.items?.find(i => String(i.productoId) === String(producto._id));
      return {
        tipo: 'credito',
        fecha: c.createdAt,
        cliente: c.cliente?.nombre || null,
        cantidad: item?.cantidad || 0,
        total: item ? item.cantidad * item.precioUnitario : 0,
        saldoPendiente: c.saldoPendiente,
        estado: c.estado,
      };
    });

    // Unir y ordenar por fecha
    const historial = [...ventasFormateadas, ...creditosFormateados]
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    res.json({ producto, historial });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
