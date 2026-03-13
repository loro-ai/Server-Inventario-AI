const mongoose = require('mongoose');

const productoSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  nombre: { type: String, required: true, trim: true },
  categoria: {
    type: String,
    enum: ['blusa', 'vestido', 'pantalon', 'falda', 'conjunto', 'accesorio', 'otro'],
    default: 'otro'
  },
  talla: { type: String, trim: true },
  color: { type: String, trim: true },
  cantidad: { type: Number, required: true, min: 0, default: 0 },
  precioCompra: { type: Number, required: true, min: 0 },
  precioVenta: { type: Number, required: true, min: 0 },
  utilidadUnitaria: { type: Number },
  utilidadTotal: { type: Number },
  imagen: { type: String },
  activo: { type: Boolean, default: true }
}, { timestamps: true });

productoSchema.pre('save', function (next) {
  this.utilidadUnitaria = this.precioVenta - this.precioCompra;
  this.utilidadTotal = this.utilidadUnitaria * this.cantidad;
  next();
});

// También recalcular en findOneAndUpdate
productoSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function (next) {
  const update = this.getUpdate();
  if (update.$set) {
    const pv = update.$set.precioVenta;
    const pc = update.$set.precioCompra;
    const qty = update.$set.cantidad;
    if (pv !== undefined || pc !== undefined) {
      // No podemos calcular sin valores actuales; se hará en el controller
    }
  }
  next();
});

module.exports = mongoose.model('Producto', productoSchema);
