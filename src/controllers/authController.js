const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

const generarToken = (usuario) =>
  jwt.sign(
    { id: usuario._id, nombre: usuario.nombre, email: usuario.email },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

exports.register = async (req, res) => {
  try {
    const { nombre, email, password } = req.body;
    if (!nombre || !email || !password)
      return res.status(400).json({ error: 'Nombre, email y password son requeridos' });
    const existe = await Usuario.findOne({ email });
    if (existe)
      return res.status(409).json({ error: 'Ya existe una cuenta con ese email' });
    const usuario = new Usuario({ nombre, email, password });
    await usuario.save();
    const token = generarToken(usuario);
    res.status(201).json({
      mensaje: 'Cuenta creada exitosamente',
      token,
      usuario: { id: usuario._id, nombre: usuario.nombre, email: usuario.email }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email y password son requeridos' });
    const usuario = await Usuario.findOne({ email });
    if (!usuario)
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    const ok = await usuario.compararPassword(password);
    if (!ok)
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    const token = generarToken(usuario);
    res.json({
      token,
      usuario: { id: usuario._id, nombre: usuario.nombre, email: usuario.email }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.perfil = async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.auth.id).select('-password');
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(usuario);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
