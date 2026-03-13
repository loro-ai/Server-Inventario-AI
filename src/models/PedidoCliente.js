const mongoose = require('mongoose');

const abonoSchema = new mongoose.Schema({
  monto: { type: Number, required: true, min: 1 },
  fecha: { type: Date, default: Date.now },
  nota: { type: String, trim: true }
});

const pedidoClienteSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  cliente: {
    nombre: { type: String, required: true, trim: true },
    telefono: { type: String, trim: true },
    notas: { type: String, trim: true }
  },
  descripcion: { type: String, required: true, trim: true },
  categoria: { type: String, trim: true },
  talla: { type: String, trim: true },
  color: { type: String, trim: true },
  linkReferencia: { type: String, trim: true },
  totalVenta: { type: Number, required: true, min: 0 },
  totalPagado: { type: Number, default: 0, min: 0 },
  saldoPendiente: { type: Number, default: 0 },
  abonos: [abonoSchema],
  estado: {
    type: String,
    enum: ['en_curso', 'llego', 'entregado', 'cancelado'],
    default: 'en_curso'
  },
  historialEstados: [{
    estado: { type: String },
    fecha: { type: Date, default: Date.now },
    nota: { type: String }
  }],
  notas: { type: String, trim: true },
  fechaEntrega: { type: Date }
}, { timestamps: true });

pedidoClienteSchema.pre('save', function (next) {
  this.totalPagado = this.abonos.reduce((sum, a) => sum + a.monto, 0);
  this.saldoPendiente = Math.max(0, this.totalVenta - this.totalPagado);
  next();
});

module.exports = mongoose.model('PedidoCliente', pedidoClienteSchema);
