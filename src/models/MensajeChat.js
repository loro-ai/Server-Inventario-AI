const mongoose = require('mongoose');

const mensajeChatSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  rol: { type: String, enum: ['user', 'assistant'], required: true },
  contenido: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('MensajeChat', mensajeChatSchema);
