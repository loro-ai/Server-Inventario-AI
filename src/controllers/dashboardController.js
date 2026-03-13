const mongoose = require('mongoose');
const Venta = require('../models/Venta');
const Producto = require('../models/Producto');
const VentaCredito = require('../models/VentaCredito');

exports.resumen = async (req, res) => {
  try {
    // FIX CRÍTICO: usar ObjectId real, no $toString
    const uid = new mongoose.Types.ObjectId(req.auth.id);
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const inicioSemana = new Date(ahora);
    inicioSemana.setDate(ahora.getDate() - 7);

    const [totalProductos, stockBajo, ventasMesAgg, ventasSemanaAgg, topProductos] =
      await Promise.all([
        Producto.countDocuments({ activo: true, usuario: uid }),

        Producto.find({ activo: true, usuario: uid, cantidad: { $lte: 3 } })
          .select('nombre cantidad talla categoria'),

        Venta.aggregate([
          { $match: { usuario: uid, fecha: { $gte: inicioMes } } },
          {
            $group: {
              _id: null,
              totalUtilidad: { $sum: '$utilidadTotal' },
              totalVentas: { $sum: '$cantidadVendida' }
            }
          }
        ]),

        Venta.aggregate([
          { $match: { usuario: uid, fecha: { $gte: inicioSemana } } },
          {
            $group: {
              _id: null,
              totalVentas: { $sum: '$cantidadVendida' }
            }
          }
        ]),

        Venta.aggregate([
          { $match: { usuario: uid, fecha: { $gte: inicioMes } } },
          {
            $group: {
              _id: '$nombreProducto',
              cantidad: { $sum: '$cantidadVendida' },
              ganancia: { $sum: '$utilidadTotal' }
            }
          },
          { $sort: { cantidad: -1 } },
          { $limit: 5 },
          { $project: { _id: 0, nombre: '$_id', cantidad: 1, ganancia: 1 } }
        ])
      ]);

    // Total deuda créditos pendientes
    const creditos = await VentaCredito.find({
      usuario: uid,
      estado: { $in: ['pendiente', 'abonado'] }
    }).select('totalVenta totalPagado');
    const totalDeuda = creditos.reduce((sum, vc) => sum + vc.saldoPendiente, 0);

    res.json({
      totalProductos,
      stockBajo,
      gananciaMes: ventasMesAgg[0]?.totalUtilidad || 0,
      totalVentasMes: ventasMesAgg[0]?.totalVentas || 0,
      ventasSemana: ventasSemanaAgg[0]?.totalVentas || 0,
      totalDeuda,
      topProductos
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.ventasPorSemana = async (req, res) => {
  try {
    const uid = new mongoose.Types.ObjectId(req.auth.id);
    const hace6Semanas = new Date();
    hace6Semanas.setDate(hace6Semanas.getDate() - 42);

    const ventas = await Venta.aggregate([
      { $match: { usuario: uid, fecha: { $gte: hace6Semanas } } },
      {
        $group: {
          _id: { $week: '$fecha' },
          totalVentas: { $sum: '$cantidadVendida' },
          totalUtilidad: { $sum: '$utilidadTotal' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);
    res.json(ventas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.ventasDiarias = async (req, res) => {
  try {
    const uid = new mongoose.Types.ObjectId(req.auth.id);
    const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const resultado = [];

    for (let i = 6; i >= 0; i--) {
      const inicio = new Date();
      inicio.setDate(inicio.getDate() - i);
      inicio.setHours(0, 0, 0, 0);
      const fin = new Date(inicio);
      fin.setHours(23, 59, 59, 999);

      const ventasDia = await Venta.find({
        usuario: uid,
        fecha: { $gte: inicio, $lte: fin }
      });

      resultado.push({
        dia: diasSemana[inicio.getDay()],
        ventas: ventasDia.reduce((s, v) => s + v.cantidadVendida, 0),
        ganancia: ventasDia.reduce((s, v) => s + (v.utilidadTotal || 0), 0)
      });
    }

    res.json(resultado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
