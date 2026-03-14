require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const helmet = require('helmet');
const connectDB = require('./db');

const authRoutes = require('./routes/auth');
const productosRoutes = require('./routes/productos');
const ventasRoutes = require('./routes/ventas');
const dashboardRoutes = require('./routes/dashboard');
const pedidosRoutes = require('./routes/pedidos');
const ventasCreditoRoutes = require('./routes/ventasCredito');
const pedidosClienteRoutes = require('./routes/pedidosCliente');
const chatRoutes = require('./routes/chat');

const app = express();
connectDB();

// ─── Seguridad: headers HTTP seguros ───────────────────────────────────────
app.use(helmet());

// ─── CORS ──────────────────────────────────────────────────────────────────
app.use(cors({
  origin: function(origin, callback) {
    if (!origin || origin.includes('vercel.app') || origin === 'http://localhost:5173') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// ─── Rate limiting global — 100 req / 15 min por IP ───────────────────────
const limitadorGlobal = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intenta en 15 minutos.' }
});
app.use(limitadorGlobal);

// ─── Rate limiting estricto en login — 5 intentos / 15 min por IP ─────────
const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Intenta en 15 minutos.' }
});

// ─── Logging ───────────────────────────────────────────────────────────────
app.use(morgan('dev'));

// ─── Body parser ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' })); // limitar tamaño del body

// ─── Sanitización NoSQL injection — bloquea $gt, $ne, etc. en inputs ──────
app.use(mongoSanitize());

// ─── Rutas ─────────────────────────────────────────────────────────────────
app.get('/', (req, res) =>
  res.json({ status: 'ok', mensaje: 'API Inventario v2 funcionando ✅' })
);

app.use('/api/auth', limitadorLogin, authRoutes); // login con rate limit estricto
app.use('/api/productos', productosRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/credito', ventasCreditoRoutes);
app.use('/api/pedidos-cliente', pedidosClienteRoutes);
app.use('/api/chat', chatRoutes);

// ─── Error handler ─────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' }); // no exponer err.message en producción
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
