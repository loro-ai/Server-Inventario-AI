# inventario-mama — Backend

API REST Express + MongoDB Atlas

## Variables de entorno (Railway)

```
MONGO_URI=mongodb+srv://...
PORT=3001
JWT_SECRET=una_clave_muy_secreta_larga
OPENAI_API_KEY=sk-...         (opcional — para chat IA)
N8N_WEBHOOK_URL=https://...   (opcional — para automatizaciones)
FRONTEND_URL=https://tu-app.vercel.app
```

## Deploy en Railway

1. Sube este folder a un repo en GitHub
2. En Railway → New Project → Deploy from GitHub Repo
3. Agrega las variables de entorno
4. Railway detecta `package.json` y hace `npm start` automáticamente

## Endpoints

### Auth
- `POST /api/auth/register` — `{ nombre, email, password }`
- `POST /api/auth/login` — `{ email, password }` → devuelve `{ token, usuario }`
- `GET  /api/auth/perfil` — requiere Bearer token

### Productos
- `GET    /api/productos` — `?categoria=blusa&stockBajo=true&busqueda=rosada`
- `GET    /api/productos/:id`
- `POST   /api/productos` — `{ nombre, categoria, talla, color, cantidad, precioCompra, precioVenta }`
- `PUT    /api/productos/:id`
- `DELETE /api/productos/:id` — soft delete
- `PATCH  /api/productos/:id/stock` — `{ delta: 5 }` (positivo o negativo)

### Ventas (contado)
- `GET  /api/ventas` — `?desde=2024-01-01&hasta=2024-12-31`
- `GET  /api/ventas/:id`
- `POST /api/ventas` — `{ productoId?, nombreProducto, cantidadVendida, precioVenta, precioCompra, nota }`
- `PUT  /api/ventas/:id` — editar nota/precios

### Dashboard
- `GET /api/dashboard/resumen`
- `GET /api/dashboard/ventas-semana`
- `GET /api/dashboard/ventas-diarias`

### Ventas a crédito
- `GET  /api/credito` — `?estado=pendiente&cliente=Ana`
- `GET  /api/credito/cartera`
- `GET  /api/credito/:id`
- `POST /api/credito` — `{ cliente:{nombre,telefono}, descripcion, totalVenta, items?, abonoInicial, notas }`
- `POST /api/credito/:id/abonos` — `{ monto, nota }`

### Pedidos a Temu
- `GET    /api/pedidos` — `?estado=en_camino`
- `GET    /api/pedidos/:id`
- `POST   /api/pedidos` — `{ descripcion, categoria, talla, color, precioEstimado, linkTemu, notas }`
- `PUT    /api/pedidos/:id`
- `PATCH  /api/pedidos/:id/estado` — `{ estado, nota }`
- `DELETE /api/pedidos/:id`

### Pedidos de clientas (encargos)
- `GET    /api/pedidos-cliente` — `?estado=en_curso&cliente=Ana`
- `GET    /api/pedidos-cliente/cartera`
- `GET    /api/pedidos-cliente/:id`
- `POST   /api/pedidos-cliente` — `{ cliente:{nombre,telefono}, descripcion, totalVenta, abonoInicial, talla, color, notas }`
- `PATCH  /api/pedidos-cliente/:id/estado` — `{ estado, nota }`
- `POST   /api/pedidos-cliente/:id/abonos` — `{ monto, nota }`
- `DELETE /api/pedidos-cliente/:id`

### Chat IA
- `GET    /api/chat/historial`
- `POST   /api/chat/enviar` — `{ mensaje }`
- `DELETE /api/chat/historial`
# Server-Inventario-AI
