require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
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

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || origin.includes('vercel.app') || origin === 'http://localhost:5173') {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
}))


app.use(morgan('dev'));
app.use(express.json());

app.get('/', (req, res) =>
  res.json({ status: 'ok', mensaje: 'API Inventario v2 funcionando ✅' })
);

app.use('/api/auth', authRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/credito', ventasCreditoRoutes);
app.use('/api/pedidos-cliente', pedidosClienteRoutes);
app.use('/api/chat', chatRoutes);

// Error handler
app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
