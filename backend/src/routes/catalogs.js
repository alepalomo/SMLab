const router = require('express').Router();
const ctrl = require('../controllers/catalogsController');
const { authenticate, requireRole } = require('../middleware/auth');

const ALL = ['ADMIN', 'AUTORIZADO', 'VENDEDOR'];
const ADMIN_AUTH = ['ADMIN', 'AUTORIZADO'];

router.use(authenticate);

// Insumos
router.get('/insumos', requireRole(...ALL), ctrl.listInsumos);
router.post('/insumos', requireRole(...ADMIN_AUTH), ctrl.createInsumo);
router.put('/insumos/:id', requireRole(...ADMIN_AUTH), ctrl.updateInsumo);
router.delete('/insumos/:id', requireRole(...ADMIN_AUTH), ctrl.deleteInsumo);
router.post('/insumos/bulk', requireRole(...ADMIN_AUTH), ctrl.upload.single('file'), ctrl.bulkInsumos);

// Malls
router.get('/malls', requireRole(...ALL), ctrl.listMalls);
router.post('/malls', requireRole(...ADMIN_AUTH), ctrl.createMall);
router.put('/malls/:id', requireRole(...ADMIN_AUTH), ctrl.updateMall);
router.delete('/malls/:id', requireRole(...ADMIN_AUTH), ctrl.deleteMall);

// OIs
router.get('/ois', requireRole(...ALL), ctrl.listOIs);
router.post('/ois', requireRole(...ADMIN_AUTH), ctrl.createOI);
router.put('/ois/:id', requireRole(...ADMIN_AUTH), ctrl.updateOI);
router.delete('/ois/:id', requireRole(...ADMIN_AUTH), ctrl.deleteOI);
router.post('/ois/bulk', requireRole(...ADMIN_AUTH), ctrl.upload.single('file'), ctrl.bulkOIs);

// Tipos de Actividad
router.get('/activity-types', requireRole(...ALL), ctrl.listActivityTypes);
router.post('/activity-types/bulk', requireRole(...ADMIN_AUTH), ctrl.upload.single('file'), ctrl.bulkActivityTypes);
router.post('/activity-types', requireRole(...ADMIN_AUTH), ctrl.createActivityType);
router.put('/activity-types/:id', requireRole(...ADMIN_AUTH), ctrl.updateActivityType);
router.delete('/activity-types/:id', requireRole(...ADMIN_AUTH), ctrl.deleteActivityType);

// Usuarios (solo ADMIN)
router.get('/users', requireRole('ADMIN'), ctrl.listUsers);
router.post('/users', requireRole('ADMIN'), ctrl.createUser);
router.put('/users/:id', requireRole('ADMIN'), ctrl.updateUser);
router.delete('/users/:id', requireRole('ADMIN'), ctrl.deleteUser);

// Proveedores
router.get('/proveedores', requireRole(...ALL), ctrl.listProveedores);
router.post('/proveedores', requireRole(...ADMIN_AUTH), ctrl.createProveedor);
router.put('/proveedores/:id', requireRole(...ADMIN_AUTH), ctrl.updateProveedor);
router.delete('/proveedores/:id', requireRole(...ADMIN_AUTH), ctrl.deleteProveedor);
router.post('/proveedores/bulk', requireRole(...ADMIN_AUTH), ctrl.upload.single('file'), ctrl.bulkProveedores);

// Tipos de cambio
router.get('/exchange-rates', requireRole(...ALL), ctrl.listRates);
router.post('/exchange-rates', requireRole(...ADMIN_AUTH), ctrl.createRate);
router.put('/exchange-rates/:id/activate', requireRole(...ADMIN_AUTH), ctrl.activateRate);

module.exports = router;
