const mongoose = require('mongoose');

const pedidoSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  descripcion: { type: String, required: true, trim: true },
  categoria: { type: String, trim: true },
  talla: { type: String, trim: true },
  color: { type: String, trim: true },
  precioEstimado: { type: Number, min: 0 },
  linkTemu: { type: String, trim: true },
  // "llego" sin tilde — consistente con PedidoCliente y frontend
  estado: {
    type: String,
    enum: ['pendiente', 'pedido_en_temu', 'en_camino', 'llego', 'entregado', 'cancelado'],
    default: 'pendiente'
  },
  historialEstados: [{
    estado: { type: String },
    fecha: { type: Date, default: Date.now },
    nota: { type: String }
  }],
  anticipo: { type: Number, default: 0, min: 0 },
  totalPagado: { type: Number, default: 0, min: 0 },
  productoVinculado: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Producto',
    default: null
  },
  fechaPedidoTemu: { type: Date },
  fechaEstimadaLlegada: { type: Date },
  fechaEntrega: { type: Date },
  notas: { type: String, trim: true }
}, { timestamps: true });

module.exports = mongoose.model('Pedido', pedidoSchema);
