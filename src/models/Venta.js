const mongoose = require('mongoose');

const ventaSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  producto: { type: mongoose.Schema.Types.ObjectId, ref: 'Producto' },
  nombreProducto: { type: String, required: true },
  cantidadVendida: { type: Number, required: true, min: 1 },
  precioVenta: { type: Number, required: true },
  precioCompra: { type: Number, required: true },
  utilidadTotal: { type: Number },
  nota: { type: String },
  fecha: { type: Date, default: Date.now }
}, { timestamps: true });

ventaSchema.pre('save', function (next) {
  this.utilidadTotal = (this.precioVenta - this.precioCompra) * this.cantidadVendida;
  next();
});

module.exports = mongoose.model('Venta', ventaSchema);
