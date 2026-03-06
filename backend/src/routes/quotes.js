const router = require('express').Router();
const ctrl = require('../controllers/quotesController');
const { authenticate, requireRole } = require('../middleware/auth');

const ALL = ['ADMIN', 'AUTORIZADO', 'VENDEDOR'];
const ADMIN_AUTH = ['ADMIN', 'AUTORIZADO'];

router.use(authenticate);

router.get('/templates', ctrl.listTemplates);
router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);

router.post('/', requireRole(...ALL), ctrl.create);
router.put('/:id', requireRole(...ALL), ctrl.update);
router.delete('/:id', requireRole(...ADMIN_AUTH), ctrl.remove);

// Líneas
router.post('/:id/lines', requireRole(...ALL), ctrl.addLine);
router.put('/:id/lines/:lineId', requireRole(...ALL), ctrl.updateLine);
router.delete('/:id/lines/:lineId', requireRole(...ALL), ctrl.removeLine);

// Admin agrega línea extra a cotización ENVIADA
router.post('/:id/lines-admin', requireRole(...ADMIN_AUTH), ctrl.addLineAdmin);

// Flujo de estados
router.post('/:id/submit', requireRole(...ALL), ctrl.submit);
router.post('/:id/approve', requireRole(...ADMIN_AUTH), ctrl.approve);
router.post('/:id/reject', requireRole(...ADMIN_AUTH), ctrl.reject);
router.post('/:id/execute', requireRole(...ADMIN_AUTH), ctrl.execute);
router.post('/:id/liquidate', requireRole(...ADMIN_AUTH), ctrl.liquidate);
router.post('/:id/reactivate', requireRole(...ADMIN_AUTH), ctrl.reactivate);
router.post('/:id/clone', requireRole(...ALL), ctrl.clone);

// Facturación mensual
router.put('/:id/billing', requireRole(...ALL), ctrl.updateBilling);

// Render (imagen de visualización)
router.post('/:id/render', requireRole(...ALL), ctrl.renderUpload.single('image'), ctrl.uploadRender);
router.delete('/:id/render', requireRole(...ALL), ctrl.deleteRender);

module.exports = router;
