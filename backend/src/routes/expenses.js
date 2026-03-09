const router = require('express').Router();
const ctrl = require('../controllers/expensesController');
const { authenticate, requireRole } = require('../middleware/auth');

const ALL = ['ADMIN', 'AUTORIZADO', 'VENDEDOR'];
const PRIVILEGED = ['ADMIN', 'AUTORIZADO'];

router.use(authenticate);

router.get('/', requireRole(...ALL), ctrl.list);
router.get('/report/odc', requireRole(...ALL), ctrl.reportOdc);
router.get('/report/caja-chica', requireRole(...ALL), ctrl.reportCajaChica);
router.get('/report/caja-chica-pdf', requireRole(...ALL), ctrl.reportCajaChicaPdf);

router.post('/odc', requireRole(...ALL), ctrl.createOdc);
router.post('/caja-chica', requireRole(...ALL), ctrl.createCajaChica);
router.post('/host', requireRole(...ALL), ctrl.createHost);

router.get('/:id', requireRole(...ALL), ctrl.getOne);
router.put('/:id', requireRole(...PRIVILEGED), ctrl.updateExpense);
router.delete('/:id', requireRole(...PRIVILEGED), ctrl.deleteExpense);
router.post('/:id/receipt', requireRole(...ALL), ctrl.receiptUpload.single('image'), ctrl.uploadReceipt);
router.delete('/:id/receipt', requireRole(...ALL), ctrl.deleteReceipt);

module.exports = router;
