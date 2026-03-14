const Venta = require('../models/Venta');
const Producto = require('../models/Producto');

exports.getAll = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const filtro = { usuario: req.auth.id };
    if (desde || hasta) {
      filtro.fecha = {};
      if (desde) filtro.fecha.$gte = new Date(desde);
      if (hasta) filtro.fecha.$lte = new Date(hasta);
    }
    const ventas = await Venta.find(filtro)
      .sort({ fecha: -1 })
      .populate('producto', 'nombre categoria');
    res.json(ventas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const venta = await Venta.findOne({ _id: req.params.id, usuario: req.auth.id })
      .populate('producto', 'nombre categoria');
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
    res.json(venta);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { productoId, cantidadVendida, cantidad, nota, precioVenta, precioCompra, nombreProducto, _usuarioId } = req.body;
    const cantidadFinal = cantidadVendida || cantidad || 1;
    const usuarioId = req.auth?.id || _usuarioId;

    let prodDoc = null;
    let finalNombre = nombreProducto;
    let finalPrecioVenta = precioVenta;
    let finalPrecioCompra = precioCompra || 0;

    if (productoId) {
      prodDoc = await Producto.findOne({ _id: productoId, usuario: usuarioId });
      if (!prodDoc) return res.status(404).json({ error: 'Producto no encontrado' });
    } else if (nombreProducto) {
      // Buscar por nombre (viene de n8n sin productoId)
      prodDoc = await Producto.findOne({
        usuario: usuarioId,
        activo: true,
        nombre: { $regex: new RegExp(nombreProducto.trim(), 'i') }
      });
      if (!prodDoc) {
        return res.status(404).json({ error: `No encontré "${nombreProducto}" en el inventario. Verifica el nombre del producto.` });
      }
    }

    if (prodDoc) {
      if (prodDoc.cantidad < cantidadFinal)
        return res.status(400).json({ error: `Solo hay ${prodDoc.cantidad} unidades de ${prodDoc.nombre}` });
      // Siempre tomar nombre y precios desde la BD — ignorar lo que venga en el body
      finalNombre = prodDoc.nombre;
      finalPrecioVenta = prodDoc.precioVenta;
      finalPrecioCompra = prodDoc.precioCompra;
    }

    if (!finalNombre) return res.status(400).json({ error: 'Nombre del producto requerido' });
    if (!finalPrecioVenta) return res.status(400).json({ error: `No se encontró el precio de "${finalNombre}" en el inventario. Verifica que el producto exista.` });

    const venta = new Venta({
      usuario: usuarioId,
      producto: prodDoc?._id || undefined,
      nombreProducto: finalNombre,
      cantidadVendida: cantidadFinal,
      precioVenta: finalPrecioVenta || 0,
      precioCompra: finalPrecioCompra,
      nota
    });
    await venta.save();

    if (prodDoc) {
      prodDoc.cantidad -= cantidadFinal;
      await prodDoc.save();
    }

    res.status(201).json(venta);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const venta = await Venta.findOne({ _id: req.params.id, usuario: req.auth.id });
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
    await venta.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const venta = await Venta.findOne({ _id: req.params.id, usuario: req.auth.id });
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
    const { nota, precioVenta, precioCompra } = req.body;
    if (nota !== undefined) venta.nota = nota;
    if (precioVenta !== undefined) venta.precioVenta = precioVenta;
    if (precioCompra !== undefined) venta.precioCompra = precioCompra;
    await venta.save();
    res.json(venta);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
