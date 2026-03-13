const router = require('express').Router();
const auth = require('../middlewares/auth');
const c = require('../controllers/dashboardController');
router.use(auth);
router.get('/resumen', c.resumen);
router.get('/ventas-semana', c.ventasPorSemana);
router.get('/ventas-diarias', c.ventasDiarias);
module.exports = router;
