const mongoose = require('mongoose');

const abonoSchema = new mongoose.Schema({
  monto: { type: Number, required: true, min: 1 },
  fecha: { type: Date, default: Date.now },
  nota: { type: String, trim: true }
});

const ventaCreditoSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  cliente: {
    nombre: { type: String, required: true, trim: true },
    telefono: { type: String, trim: true }
  },
  items: [{
    producto: { type: mongoose.Schema.Types.ObjectId, ref: 'Producto' },
    nombreProducto: { type: String, required: true },
    cantidad: { type: Number, required: true, min: 1 },
    precioUnitario: { type: Number, required: true },
    precioCompra: { type: Number, default: 0 }
  }],
  descripcion: { type: String, trim: true },
  totalVenta: { type: Number, required: true, min: 0 },
  totalPagado: { type: Number, default: 0, min: 0 },
  saldoPendiente: { type: Number },
  abonos: [abonoSchema],
  // Estado con "abonado" (no "abonando") — consistente con spec original
  estado: {
    type: String,
    enum: ['pendiente', 'abonado', 'pagado'],
    default: 'pendiente'
  },
  notas: { type: String, trim: true },
  fechaLimitePago: { type: Date }
}, { timestamps: true });

ventaCreditoSchema.pre('save', function (next) {
  this.totalPagado = this.abonos.reduce((sum, a) => sum + a.monto, 0);
  this.saldoPendiente = Math.max(0, this.totalVenta - this.totalPagado);
  if (this.saldoPendiente <= 0) {
    this.estado = 'pagado';
    this.saldoPendiente = 0;
  } else if (this.totalPagado > 0) {
    this.estado = 'abonado';
  } else {
    this.estado = 'pendiente';
  }
  next();
});

module.exports = mongoose.model('VentaCredito', ventaCreditoSchema);
