const mongoose = require('mongoose');

const ventaItemSchema = new mongoose.Schema({
  producto: { type: mongoose.Schema.Types.ObjectId, ref: 'Producto' },
  nombreProducto: { type: String, required: true },
  cantidadVendida: { type: Number, required: true, min: 1 },
  precioVenta: { type: Number, required: true },
  precioCompra: { type: Number, required: true },
  utilidadItem: { type: Number }
});

const ventaSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  // Cliente opcional
  cliente: { type: String, trim: true },
  // Items de la venta (siempre array, mínimo 1)
  items: [ventaItemSchema],
  // Totales calculados
  totalVenta: { type: Number, default: 0 },
  totalCompra: { type: Number, default: 0 },
  utilidadTotal: { type: Number, default: 0 },
  nota: { type: String },
  // Referencia a deuda de origen (si vino de un crédito)
  ventaCreditoOrigen: { type: mongoose.Schema.Types.ObjectId, ref: 'VentaCredito' },
  fecha: { type: Date, default: Date.now }
}, { timestamps: true });

ventaSchema.pre('save', function (next) {
  this.items.forEach(item => {
    item.utilidadItem = (item.precioVenta - item.precioCompra) * item.cantidadVendida;
  });
  this.totalVenta = this.items.reduce((s, i) => s + i.precioVenta * i.cantidadVendida, 0);
  this.totalCompra = this.items.reduce((s, i) => s + i.precioCompra * i.cantidadVendida, 0);
  this.utilidadTotal = this.totalVenta - this.totalCompra;
  next();
});

module.exports = mongoose.model('Venta', ventaSchema);
