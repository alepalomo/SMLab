const bcrypt = require('bcryptjs');
const multer = require('multer');
const XLSX = require('xlsx');
const { parse } = require('csv-parse/sync');
const { Insumo, Mall, OI, ActivityType, User, Proveedor, ExchangeRate } = require('../models');
const { Op } = require('sequelize');

const upload = multer({ storage: multer.memoryStorage() });
exports.upload = upload;

// ─── INSUMOS ────────────────────────────────────────────────────────────────
exports.listInsumos = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.active === 'true') where.isActive = true;
    if (req.query.category) where.category = req.query.category;
    res.json(await Insumo.findAll({ where, order: [['name', 'ASC']] }));
  } catch (err) { next(err); }
};

exports.createInsumo = async (req, res, next) => {
  try {
    const i = await Insumo.create(req.body);
    res.status(201).json(i);
  } catch (err) { next(err); }
};

exports.updateInsumo = async (req, res, next) => {
  try {
    const item = await Insumo.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: 'Insumo no encontrado.' });
    await item.update(req.body);
    res.json(item);
  } catch (err) { next(err); }
};

exports.deleteInsumo = async (req, res, next) => {
  try {
    const item = await Insumo.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: 'Insumo no encontrado.' });
    await item.destroy();
    res.json({ message: 'Eliminado.' });
  } catch (err) { next(err); }
};

// Carga masiva de insumos vía CSV o XLSX
exports.bulkInsumos = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Archivo requerido.' });

    let rows = [];
    if (file.originalname.endsWith('.xlsx')) {
      const wb = XLSX.read(file.buffer, { type: 'buffer' });
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    } else {
      rows = parse(file.buffer, { columns: true, skip_empty_lines: true, encoding: 'utf8' });
    }

    // Mapeo inteligente de columnas
    const remap = r => ({
      name: r.name || r.nombre || r.Nombre || r.insumo || r.Insumo || '',
      costGtq: parseFloat(String(r.cost_gtq || r.costo || r.Costo || r.precio || 0).replace(/[Q,]/g, '')) || 0,
      unitType: r.unit_type || r.unidad || r.Unidad || 'UNIDAD',
      billingMode: r.billing_mode || r.cobro || r.Cobro || 'MULTIPLICABLE',
      category: r.category || r.categoria || r.Categoria || 'Varios',
      description: r.description || r.descripcion || r.Descripcion || '',
      isActive: true, // Asegurar que siempre queden activos al importar
    });

    const existing = new Set((await Insumo.findAll({ attributes: ['name'] })).map(i => i.name));
    const toCreate = [];
    let skipped = 0;

    for (const raw of rows) {
      const data = remap(raw);
      if (!data.name || data.name === 'nan' || existing.has(data.name)) { skipped++; continue; }
      toCreate.push(data);
      existing.add(data.name);
    }

    await Insumo.bulkCreate(toCreate);

    // Corregir insumos previos con isActive = null (importados antes del fix)
    await Insumo.update({ isActive: true }, { where: { isActive: null } });

    res.json({ created: toCreate.length, skipped });
  } catch (err) { next(err); }
};

// ─── MALLS ──────────────────────────────────────────────────────────────────
exports.listMalls = async (req, res, next) => {
  try {
    res.json(await Mall.findAll({ order: [['name', 'ASC']] }));
  } catch (err) { next(err); }
};

exports.createMall = async (req, res, next) => {
  try {
    const m = await Mall.create({ name: req.body.name });
    res.status(201).json(m);
  } catch (err) { next(err); }
};

exports.updateMall = async (req, res, next) => {
  try {
    const m = await Mall.findByPk(req.params.id);
    if (!m) return res.status(404).json({ error: 'Mall no encontrado.' });
    await m.update(req.body);
    res.json(m);
  } catch (err) { next(err); }
};

exports.deleteMall = async (req, res, next) => {
  try {
    const m = await Mall.findByPk(req.params.id);
    if (!m) return res.status(404).json({ error: 'Mall no encontrado.' });
    await m.destroy();
    res.json({ message: 'Mall eliminado.' });
  } catch (err) { next(err); }
};

// ─── OIs ────────────────────────────────────────────────────────────────────
exports.listOIs = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.active === 'true') where.isActive = true;
    if (req.query.mallId) where.mallId = req.query.mallId;
    res.json(await OI.findAll({
      where,
      include: [{ model: Mall, as: 'mall', attributes: ['id', 'name'] }],
      order: [['oiCode', 'ASC']],
    }));
  } catch (err) { next(err); }
};

exports.createOI = async (req, res, next) => {
  try {
    const oi = await OI.create(req.body);
    res.status(201).json(oi);
  } catch (err) { next(err); }
};

exports.updateOI = async (req, res, next) => {
  try {
    const oi = await OI.findByPk(req.params.id);
    if (!oi) return res.status(404).json({ error: 'OI no encontrada.' });
    await oi.update(req.body);
    res.json(oi);
  } catch (err) { next(err); }
};

exports.deleteOI = async (req, res, next) => {
  try {
    const oi = await OI.findByPk(req.params.id);
    if (!oi) return res.status(404).json({ error: 'OI no encontrada.' });
    await oi.destroy();
    res.json({ message: 'OI eliminada.' });
  } catch (err) { next(err); }
};

// Carga masiva de OIs vía XLSX o CSV
exports.bulkOIs = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Archivo requerido.' });

    let rows = [];
    if (file.originalname.endsWith('.xlsx')) {
      const wb = XLSX.read(file.buffer, { type: 'buffer' });
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: false });
    } else {
      rows = parse(file.buffer, { columns: true, skip_empty_lines: true, encoding: 'utf8' });
    }

    const mallsDb = await Mall.findAll();
    const mallMap = Object.fromEntries(mallsDb.map(m => [m.name.toLowerCase().trim(), m.id]));

    let created = 0, updated = 0;
    const errors = [];

    for (const row of rows) {
      try {
        const mallName = String(row.Mall || row.mall || '').trim();
        const rawCode = String(row.Codigo || row.codigo || row.Code || '').trim().replace(/\.0$/, '');
        const oiName = String(row.Nombre || row.nombre || '').trim();
        const budget = parseFloat(String(row.Presupuesto || row.presupuesto || 0).replace(/,/g, '')) || 0;

        const mallId = mallMap[mallName.toLowerCase()];
        if (!mallId) { errors.push(`Mall '${mallName}' no encontrado.`); continue; }

        const [oi, wasCreated] = await OI.findOrCreate({
          where: { oiCode: rawCode },
          defaults: { mallId, oiCode: rawCode, oiName, annualBudgetUsd: budget },
        });
        if (!wasCreated) {
          await oi.update({ mallId, oiName, annualBudgetUsd: budget });
          updated++;
        } else {
          created++;
        }
      } catch (e) {
        errors.push(e.message);
      }
    }

    res.json({ created, updated, errors });
  } catch (err) { next(err); }
};

// ─── TIPOS DE ACTIVIDAD ─────────────────────────────────────────────────────
exports.listActivityTypes = async (req, res, next) => {
  try {
    res.json(await ActivityType.findAll({ order: [['name', 'ASC']] }));
  } catch (err) { next(err); }
};

exports.createActivityType = async (req, res, next) => {
  try {
    const t = await ActivityType.create(req.body);
    res.status(201).json(t);
  } catch (err) { next(err); }
};

exports.updateActivityType = async (req, res, next) => {
  try {
    const t = await ActivityType.findByPk(req.params.id);
    if (!t) return res.status(404).json({ error: 'Tipo no encontrado.' });
    await t.update(req.body);
    res.json(t);
  } catch (err) { next(err); }
};

exports.deleteActivityType = async (req, res, next) => {
  try {
    const t = await ActivityType.findByPk(req.params.id);
    if (!t) return res.status(404).json({ error: 'Tipo no encontrado.' });
    await t.destroy();
    res.json({ message: 'Eliminado.' });
  } catch (err) { next(err); }
};

exports.bulkActivityTypes = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Archivo requerido.' });

    let rows = [];
    if (file.originalname.endsWith('.xlsx')) {
      const wb = XLSX.read(file.buffer, { type: 'buffer' });
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    } else {
      rows = parse(file.buffer, { columns: true, skip_empty_lines: true, encoding: 'utf8' });
    }

    const existing = new Set((await ActivityType.findAll({ attributes: ['name'] })).map(t => t.name));
    let created = 0, skipped = 0;

    for (const row of rows) {
      const name = String(row.name || row.nombre || row.Nombre || '').trim();
      const description = String(row.description || row.descripcion || row.Descripcion || '').trim();
      if (!name || existing.has(name)) { skipped++; continue; }
      await ActivityType.create({ name, description });
      existing.add(name);
      created++;
    }

    res.json({ created, skipped });
  } catch (err) { next(err); }
};

// ─── USUARIOS ────────────────────────────────────────────────────────────────
exports.listUsers = async (req, res, next) => {
  try {
    res.json(await User.findAll({ attributes: ['id', 'username', 'role', 'isActive', 'createdAt'] }));
  } catch (err) { next(err); }
};

exports.createUser = async (req, res, next) => {
  try {
    const { username, password, role } = req.body;
    if (!password) return res.status(400).json({ error: 'Password requerido.' });
    const user = await User.create({
      username,
      passwordHash: bcrypt.hashSync(password, 10),
      role,
    });
    res.status(201).json({ id: user.id, username: user.username, role: user.role });
  } catch (err) { next(err); }
};

exports.updateUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
    const { username, role, password, isActive } = req.body;
    const updates = { username, role, isActive };
    if (password) updates.passwordHash = bcrypt.hashSync(password, 10);
    await user.update(updates);
    res.json({ id: user.id, username: user.username, role: user.role });
  } catch (err) { next(err); }
};

exports.deleteUser = async (req, res, next) => {
  try {
    if (parseInt(req.params.id) === 1) {
      return res.status(403).json({ error: 'No se puede eliminar el admin principal.' });
    }
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
    await user.destroy();
    res.json({ message: 'Usuario eliminado.' });
  } catch (err) { next(err); }
};

// ─── PROVEEDORES ─────────────────────────────────────────────────────────────
exports.listProveedores = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.active === 'true') where.isActive = true;
    res.json(await Proveedor.findAll({ where, order: [['name', 'ASC']] }));
  } catch (err) { next(err); }
};

exports.createProveedor = async (req, res, next) => {
  try {
    const p = await Proveedor.create(req.body);
    res.status(201).json(p);
  } catch (err) { next(err); }
};

exports.updateProveedor = async (req, res, next) => {
  try {
    const p = await Proveedor.findByPk(req.params.id);
    if (!p) return res.status(404).json({ error: 'Proveedor no encontrado.' });
    await p.update(req.body);
    res.json(p);
  } catch (err) { next(err); }
};

exports.deleteProveedor = async (req, res, next) => {
  try {
    const p = await Proveedor.findByPk(req.params.id);
    if (!p) return res.status(404).json({ error: 'Proveedor no encontrado.' });
    await p.destroy();
    res.json({ message: 'Eliminado.' });
  } catch (err) { next(err); }
};

exports.bulkProveedores = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Archivo requerido.' });

    let rows = [];
    if (file.originalname.endsWith('.xlsx')) {
      const wb = XLSX.read(file.buffer, { type: 'buffer' });
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: false });
    } else {
      rows = parse(file.buffer, { columns: true, skip_empty_lines: true, encoding: 'utf8' });
    }

    let created = 0, skipped = 0;
    for (const row of rows) {
      const name = String(row['Nombre Comercial'] || row.nombre || row.name || '').trim();
      if (!name) continue;
      const exists = await Proveedor.findOne({ where: { name: { [Op.iLike]: name } } });
      if (exists) { skipped++; continue; }
      await Proveedor.create({
        name,
        legalName: row['Razón Social'] || row['Razon Social'] || '',
        providerType: row.Tipo || 'Certificado',
        nit: String(row.NIT || row.nit || ''),
        cui: String(row.CUI || row.DPI || ''),
        bankName: row.Banco || '',
        accountNumber: String(row['No. de Cuenta'] || row.Cuenta || ''),
      });
      created++;
    }
    res.json({ created, skipped });
  } catch (err) { next(err); }
};

// ─── TIPO DE CAMBIO ──────────────────────────────────────────────────────────
exports.listRates = async (req, res, next) => {
  try {
    res.json(await ExchangeRate.findAll({ order: [['createdAt', 'DESC']] }));
  } catch (err) { next(err); }
};

exports.createRate = async (req, res, next) => {
  try {
    // Desactivar todas las anteriores y activar la nueva
    await ExchangeRate.update({ isActive: false }, { where: {} });
    const rate = await ExchangeRate.create({ ...req.body, isActive: true });
    res.status(201).json(rate);
  } catch (err) { next(err); }
};

exports.activateRate = async (req, res, next) => {
  try {
    await ExchangeRate.update({ isActive: false }, { where: {} });
    const rate = await ExchangeRate.findByPk(req.params.id);
    if (!rate) return res.status(404).json({ error: 'Tipo de cambio no encontrado.' });
    await rate.update({ isActive: true });
    res.json(rate);
  } catch (err) { next(err); }
};
