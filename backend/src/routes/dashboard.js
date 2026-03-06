const router = require('express').Router();
const ctrl = require('../controllers/dashboardController');
const { authenticate, requireRole } = require('../middleware/auth');

const ALL = ['ADMIN', 'AUTORIZADO', 'VENDEDOR'];
router.use(authenticate);

router.get('/financials', requireRole(...ALL), ctrl.financials);
router.get('/oi-execution', requireRole(...ALL), ctrl.oiExecution);
router.get('/billing', requireRole(...ALL), ctrl.billingByMonth);
router.get('/filters', requireRole(...ALL), ctrl.filterOptions);

module.exports = router;
