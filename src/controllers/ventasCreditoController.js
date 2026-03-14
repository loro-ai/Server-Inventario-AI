const VentaCredito = require('../models/VentaCredito');
const Venta = require('../models/Venta');
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
    const venta = await VentaCredito.findOne({ _id: req.params.id, usuario: req.auth.id });
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
    res.json(venta);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { cliente, items, descripcion, notas, fechaLimitePago, abonoInicial } = req.body;
    if (!items || items.length === 0)
      return res.status(400).json({ error: 'Se requiere al menos un producto' });

    // Resolver items desde inventario y descontar stock
    const itemsCompletos = [];
    for (const item of items) {
      const cantItem = item.cantidad || 1;
      let prodDoc = null;

      if (item.productoId) {
        prodDoc = await Producto.findOne({ _id: item.productoId, usuario: req.auth.id, activo: true });
        if (!prodDoc) return res.status(404).json({ error: `Producto no encontrado` });
      } else if (item.nombreProducto) {
        prodDoc = await Producto.findOne({
          usuario: req.auth.id, activo: true,
          nombre: { $regex: new RegExp(item.nombreProducto.trim(), 'i') }
        });
        if (!prodDoc) return res.status(404).json({ error: `No encontré "${item.nombreProducto}"` });
      } else {
        return res.status(400).json({ error: 'Cada item necesita productoId o nombreProducto' });
      }

      if (prodDoc.cantidad < cantItem)
        return res.status(400).json({ error: `Solo hay ${prodDoc.cantidad} unidades de ${prodDoc.nombre}` });

      // Descontar inventario inmediatamente
      prodDoc.cantidad -= cantItem;
      await prodDoc.save();

      itemsCompletos.push({
        producto: prodDoc._id,
        nombreProducto: prodDoc.nombre,
        cantidad: cantItem,
        precioUnitario: prodDoc.precioVenta,
        precioCompra: prodDoc.precioCompra
      });
    }

    const totalCalculado = itemsCompletos.reduce((s, i) => s + i.precioUnitario * i.cantidad, 0);

    const venta = new VentaCredito({
      usuario: req.auth.id,
      cliente,
      items: itemsCompletos,
      descripcion,
      totalVenta: totalCalculado,
      notas,
      fechaLimitePago,
      abonos: abonoInicial && abonoInicial > 0
        ? [{ monto: abonoInicial, nota: 'Abono inicial' }]
        : []
    });

    await venta.save();

    // Si hay abono inicial, verificar si cubre productos
    let ventasGeneradas = [];
    if (abonoInicial && abonoInicial > 0) {
      ventasGeneradas = await _verificarProductosCubiertos(venta, req.auth.id);
    }

    res.status(201).json({ venta, ventasGeneradas });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Lógica central: cuando el abono acumulado cubre unidades completas → crear ventas
async function _verificarProductosCubiertos(creditoDoc, usuarioId) {
  const ventasCreadas = [];
  let pagadoDisponible = creditoDoc.totalPagado;

  // Iterar items en orden, cubrir unidades completas con el abono disponible
  for (const item of creditoDoc.items) {
    const precioItem = item.precioUnitario;
    let unidadesCubiertas = Math.floor(pagadoDisponible / precioItem);
    unidadesCubiertas = Math.min(unidadesCubiertas, item.cantidad);

    if (unidadesCubiertas > 0) {
      // Verificar que no se haya creado ya una venta para estas unidades
      const ventaExistente = await Venta.findOne({
        ventaCreditoOrigen: creditoDoc._id,
        'items.producto': item.producto,
      });

      const unidadesYaRegistradas = ventaExistente
        ? ventaExistente.items.find(i => String(i.producto) === String(item.producto))?.cantidadVendida || 0
        : 0;

      const unidadesNuevas = unidadesCubiertas - unidadesYaRegistradas;

      if (unidadesNuevas > 0) {
        const venta = new Venta({
          usuario: usuarioId,
          cliente: creditoDoc.cliente?.nombre,
          items: [{
            producto: item.producto,
            nombreProducto: item.nombreProducto,
            cantidadVendida: unidadesNuevas,
            precioVenta: item.precioUnitario,
            precioCompra: item.precioCompra
          }],
          nota: `Crédito pagado — ${creditoDoc.cliente?.nombre}`,
          ventaCreditoOrigen: creditoDoc._id
        });
        await venta.save();
        ventasCreadas.push(venta);
      }

      pagadoDisponible -= precioItem * unidadesCubiertas;
    }
  }

  return ventasCreadas;
}

exports.agregarAbono = async (req, res) => {
  try {
    const { monto, nota } = req.body;
    const credito = await VentaCredito.findOne({ _id: req.params.id, usuario: req.auth.id });
    if (!credito) return res.status(404).json({ error: 'Crédito no encontrado' });
    if (credito.estado === 'pagado')
      return res.status(400).json({ error: 'Esta venta ya está pagada completamente' });
    if (monto > credito.saldoPendiente + 0.01)
      return res.status(400).json({ error: `El abono ($${monto}) supera el saldo pendiente ($${credito.saldoPendiente})` });

    credito.abonos.push({ monto, nota, fecha: new Date() });
    await credito.save();

    // Verificar productos cubiertos
    const ventasGeneradas = await _verificarProductosCubiertos(credito, req.auth.id);

    res.json({
      mensaje: 'Abono registrado',
      totalPagado: credito.totalPagado,
      saldoPendiente: credito.saldoPendiente,
      estado: credito.estado,
      ventasGeneradas,
      venta: credito
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
    }).select('cliente descripcion totalVenta totalPagado saldoPendiente estado fechaLimitePago items')
      .sort({ saldoPendiente: -1 });

    const totalCartera = pendientes.reduce((sum, v) => sum + v.saldoPendiente, 0);
    res.json({ totalCartera, totalClientes: pendientes.length, deudoras: pendientes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
