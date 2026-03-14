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
    const ventas = await Venta.find(filtro).sort({ fecha: -1 });
    res.json(ventas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const venta = await Venta.findOne({ _id: req.params.id, usuario: req.auth.id });
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
    res.json(venta);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Crear venta — soporta items[] (múltiples productos) o nombreProducto (legacy n8n)
exports.create = async (req, res) => {
  try {
    const { items, cliente, nota, nombreProducto, cantidad, cantidadVendida, _usuarioId } = req.body;
    const usuarioId = req.auth?.id || _usuarioId;

    let itemsFinales = [];

    // Modo nuevo: array de items
    if (items && items.length > 0) {
      for (const item of items) {
        const cantItem = item.cantidad || item.cantidadVendida || 1;
        let prodDoc = null;

        if (item.productoId) {
          prodDoc = await Producto.findOne({ _id: item.productoId, usuario: usuarioId, activo: true });
          if (!prodDoc) return res.status(404).json({ error: `Producto ${item.productoId} no encontrado` });
        } else if (item.nombreProducto) {
          prodDoc = await Producto.findOne({
            usuario: usuarioId, activo: true,
            nombre: { $regex: new RegExp(item.nombreProducto.trim(), 'i') }
          });
          if (!prodDoc) return res.status(404).json({ error: `No encontré "${item.nombreProducto}" en el inventario` });
        } else {
          return res.status(400).json({ error: 'Cada item debe tener productoId o nombreProducto' });
        }

        if (prodDoc.cantidad < cantItem)
          return res.status(400).json({ error: `Solo hay ${prodDoc.cantidad} unidades de ${prodDoc.nombre}` });

        prodDoc.cantidad -= cantItem;
        await prodDoc.save();

        itemsFinales.push({
          producto: prodDoc._id,
          nombreProducto: prodDoc.nombre,
          cantidadVendida: cantItem,
          precioVenta: prodDoc.precioVenta,
          precioCompra: prodDoc.precioCompra
        });
      }
    }
    // Modo legacy: nombreProducto simple (n8n)
    else if (nombreProducto) {
      const cantFinal = cantidadVendida || cantidad || 1;
      const prodDoc = await Producto.findOne({
        usuario: usuarioId, activo: true,
        nombre: { $regex: new RegExp(nombreProducto.trim(), 'i') }
      });
      if (!prodDoc) return res.status(404).json({ error: `No encontré "${nombreProducto}" en el inventario` });
      if (prodDoc.cantidad < cantFinal)
        return res.status(400).json({ error: `Solo hay ${prodDoc.cantidad} unidades de ${prodDoc.nombre}` });

      prodDoc.cantidad -= cantFinal;
      await prodDoc.save();

      itemsFinales.push({
        producto: prodDoc._id,
        nombreProducto: prodDoc.nombre,
        cantidadVendida: cantFinal,
        precioVenta: prodDoc.precioVenta,
        precioCompra: prodDoc.precioCompra
      });
    } else {
      return res.status(400).json({ error: 'Se requiere items[] o nombreProducto' });
    }

    const venta = new Venta({
      usuario: usuarioId,
      cliente: cliente || undefined,
      items: itemsFinales,
      nota: nota || undefined
    });
    await venta.save();
    res.status(201).json(venta);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const venta = await Venta.findOne({ _id: req.params.id, usuario: req.auth.id });
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
    const { nota, cliente } = req.body;
    if (nota !== undefined) venta.nota = nota;
    if (cliente !== undefined) venta.cliente = cliente;
    await venta.save();
    res.json(venta);
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
