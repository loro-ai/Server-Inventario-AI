const router = require('express').Router();
const auth = require('../middlewares/auth');
const c = require('../controllers/chatController');
router.use(auth);
router.get('/historial', c.historial);
router.post('/enviar', c.enviar);
router.delete('/historial', c.limpiarHistorial);
module.exports = router;
