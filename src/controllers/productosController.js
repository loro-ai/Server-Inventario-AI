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
