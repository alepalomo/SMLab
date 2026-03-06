const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Quote, QuoteLine, Insumo, Mall, OI, ActivityType, User } = require('../models');
const { getActiveRate } = require('../services/exchangeService');
const { computeLineCostGtq, recalcTotals, cloneQuote } = require('../services/quoteService');

// ── Configuración de multer para renders ─────────────────────────────────────
const RENDERS_DIR = path.join(__dirname, '../assets/renders');
if (!fs.existsSync(RENDERS_DIR)) fs.mkdirSync(RENDERS_DIR, { recursive: true });

const renderStorage = multer.diskStorage({
  destination: RENDERS_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `render_${req.params.id}_${Date.now()}${ext}`);
  },
});
const renderUpload = multer({
  storage: renderStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});
exports.renderUpload = renderUpload;

const QUOTE_INCLUDE = [
  { model: User, as: 'creator', attributes: ['id', 'username'] },
  { model: Mall, as: 'mall', attributes: ['id', 'name'] },
  { model: OI, as: 'oi', attributes: ['id', 'oiCode', 'oiName'] },
  { model: ActivityType, as: 'activityType', attributes: ['id', 'name'] },
  {
    model: QuoteLine, as: 'lines',
    include: [{ model: Insumo, as: 'insumo' }],
  },
];

// GET /api/quotes?status=BORRADOR
exports.list = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.status) where.status = req.query.status;
    // Vendedores solo ven sus propias cotizaciones (excepto ADMIN/AUTORIZADO)
    if (req.user.role === 'VENDEDOR') where.createdBy = req.user.id;

    const quotes = await Quote.findAll({
      where,
      include: QUOTE_INCLUDE,
      order: [['createdAt', 'DESC']],
    });
    res.json(quotes);
  } catch (err) { next(err); }
};

// GET /api/quotes/templates
exports.listTemplates = async (req, res, next) => {
  try {
    const templates = await Quote.findAll({
      where: { status: 'PLANTILLA' },
      include: [{ model: QuoteLine, as: 'lines', include: [{ model: Insumo, as: 'insumo' }] }],
      order: [['createdAt', 'DESC']],
    });
    res.json(templates);
  } catch (err) { next(err); }
};

// GET /api/quotes/:id
exports.getOne = async (req, res, next) => {
  try {
    const quote = await Quote.findByPk(req.params.id, { include: QUOTE_INCLUDE });
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada.' });
    res.json(quote);
  } catch (err) { next(err); }
};

// POST /api/quotes
exports.create = async (req, res, next) => {
  try {
    const { activityName, activityTypeId, mallIds, notes } = req.body;
    if (!activityName) return res.status(400).json({ error: 'Nombre de actividad requerido.' });

    const ids = Array.isArray(mallIds) ? mallIds.map(Number).filter(Boolean) : [];
    const quote = await Quote.create({
      createdBy: req.user.id,
      activityName,
      activityTypeId: activityTypeId || null,
      mallId: ids[0] || null,
      mallIds: ids,
      notes: notes || '',
      status: 'BORRADOR',
    });
    res.status(201).json(quote);
  } catch (err) { next(err); }
};

// PUT /api/quotes/:id — editar cabecera (solo BORRADOR)
exports.update = async (req, res, next) => {
  try {
    const quote = await Quote.findByPk(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada.' });
    if (quote.status !== 'BORRADOR') {
      return res.status(409).json({ error: 'Solo se pueden editar cotizaciones en BORRADOR.' });
    }
    const { activityName, activityTypeId, mallIds, notes } = req.body;
    const ids = Array.isArray(mallIds) ? mallIds.map(Number).filter(Boolean) : (quote.mallIds || []);
    await quote.update({ activityName, activityTypeId, mallId: ids[0] || null, mallIds: ids, notes });
    res.json(quote);
  } catch (err) { next(err); }
};

// DELETE /api/quotes/:id
exports.remove = async (req, res, next) => {
  try {
    const quote = await Quote.findByPk(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada.' });
    await QuoteLine.destroy({ where: { quoteId: quote.id } });
    await quote.destroy();
    res.json({ message: 'Cotización eliminada.' });
  } catch (err) { next(err); }
};

// POST /api/quotes/:id/lines — agregar insumo a cotización
exports.addLine = async (req, res, next) => {
  try {
    const quote = await Quote.findByPk(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada.' });
    if (quote.status !== 'BORRADOR') {
      return res.status(409).json({ error: 'Solo se pueden agregar líneas en BORRADOR.' });
    }

    const { insumoId, qtyPersonas = 1, unitsValue = 1 } = req.body;
    const insumo = await Insumo.findByPk(insumoId);
    if (!insumo) return res.status(404).json({ error: 'Insumo no encontrado.' });

    const rate = await getActiveRate();
    const costGtq = computeLineCostGtq(insumo, qtyPersonas, unitsValue);

    const line = await QuoteLine.create({
      quoteId: quote.id,
      insumoId,
      qtyPersonas,
      unitsValue,
      lineCostGtq: costGtq,
      lineCostUsd: costGtq / rate,
    });

    const updated = await recalcTotals(quote.id);
    res.status(201).json({ line, quote: updated });
  } catch (err) { next(err); }
};

// PUT /api/quotes/:id/lines/:lineId
exports.updateLine = async (req, res, next) => {
  try {
    const line = await QuoteLine.findByPk(req.params.lineId, {
      include: [{ model: Insumo, as: 'insumo' }],
    });
    if (!line) return res.status(404).json({ error: 'Línea no encontrada.' });

    const { qtyPersonas, unitsValue } = req.body;
    const rate = await getActiveRate();
    const costGtq = computeLineCostGtq(line.insumo, qtyPersonas, unitsValue);

    await line.update({
      qtyPersonas,
      unitsValue,
      lineCostGtq: costGtq,
      lineCostUsd: costGtq / rate,
    });

    const updated = await recalcTotals(line.quoteId);
    res.json({ line, quote: updated });
  } catch (err) { next(err); }
};

// DELETE /api/quotes/:id/lines/:lineId
exports.removeLine = async (req, res, next) => {
  try {
    const line = await QuoteLine.findByPk(req.params.lineId);
    if (!line) return res.status(404).json({ error: 'Línea no encontrada.' });
    const quoteId = line.quoteId;
    await line.destroy();
    const updated = await recalcTotals(quoteId);
    res.json({ message: 'Línea eliminada.', quote: updated });
  } catch (err) { next(err); }
};

// POST /api/quotes/:id/submit — BORRADOR → ENVIADA
exports.submit = async (req, res, next) => {
  try {
    const quote = await Quote.findByPk(req.params.id, {
      include: [{ model: QuoteLine, as: 'lines' }],
    });
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada.' });
    if (quote.status !== 'BORRADOR') return res.status(409).json({ error: 'Solo se pueden enviar borradores.' });
    if (quote.lines.length === 0) return res.status(400).json({ error: 'La cotización está vacía.' });
    await quote.update({ status: 'ENVIADA' });
    res.json(quote);
  } catch (err) { next(err); }
};

// POST /api/quotes/:id/approve — ENVIADA → APROBADA (ADMIN/AUTORIZADO)
exports.approve = async (req, res, next) => {
  try {
    const quote = await Quote.findByPk(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada.' });
    if (quote.status !== 'ENVIADA') return res.status(409).json({ error: 'Solo se pueden aprobar cotizaciones enviadas.' });

    const { finalSalePriceUsd } = req.body;
    await quote.update({
      status: 'APROBADA',
      finalSalePriceUsd: finalSalePriceUsd ?? quote.suggestedPriceUsdM70,
    });
    res.json(quote);
  } catch (err) { next(err); }
};

// POST /api/quotes/:id/reject — ENVIADA → BORRADOR
exports.reject = async (req, res, next) => {
  try {
    const quote = await Quote.findByPk(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada.' });
    await quote.update({ status: 'BORRADOR' });
    res.json(quote);
  } catch (err) { next(err); }
};

// POST /api/quotes/:id/execute — APROBADA → EJECUTADA + asignar OI
exports.execute = async (req, res, next) => {
  try {
    const quote = await Quote.findByPk(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada.' });
    if (quote.status !== 'APROBADA') return res.status(409).json({ error: 'Solo se pueden ejecutar cotizaciones aprobadas.' });

    const { oiId } = req.body;
    if (!oiId) return res.status(400).json({ error: 'OI requerida para ejecutar.' });

    const oi = await OI.findByPk(oiId);
    if (!oi) return res.status(404).json({ error: 'OI no encontrada.' });

    await quote.update({
      status: 'EJECUTADA',
      oiId,
      mallId: quote.mallId || oi.mallId,
    });
    res.json(quote);
  } catch (err) { next(err); }
};

// POST /api/quotes/:id/liquidate — APROBADA/EJECUTADA → LIQUIDADA
exports.liquidate = async (req, res, next) => {
  try {
    const quote = await Quote.findByPk(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada.' });
    await quote.update({ status: 'LIQUIDADA' });
    res.json(quote);
  } catch (err) { next(err); }
};

// POST /api/quotes/:id/reactivate — LIQUIDADA → APROBADA
exports.reactivate = async (req, res, next) => {
  try {
    const quote = await Quote.findByPk(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada.' });
    await quote.update({ status: 'APROBADA' });
    res.json(quote);
  } catch (err) { next(err); }
};

// POST /api/quotes/:id/clone — clonar como nuevo BORRADOR o como PLANTILLA
exports.clone = async (req, res, next) => {
  try {
    const { activityName, asTemplate = false } = req.body;
    const newQuote = await cloneQuote(
      req.params.id,
      { activityName, status: asTemplate ? 'PLANTILLA' : 'BORRADOR' },
      req.user.id
    );
    res.status(201).json(newQuote);
  } catch (err) { next(err); }
};

// POST /api/quotes/:id/add-line-admin — admin agrega línea extra a cotización ENVIADA
exports.addLineAdmin = async (req, res, next) => {
  try {
    const quote = await Quote.findByPk(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada.' });

    const { insumoId, qtyPersonas = 1, unitsValue = 1 } = req.body;
    const insumo = await Insumo.findByPk(insumoId);
    if (!insumo) return res.status(404).json({ error: 'Insumo no encontrado.' });

    const rate = await getActiveRate();
    const costGtq = computeLineCostGtq(insumo, qtyPersonas, unitsValue);

    const line = await QuoteLine.create({
      quoteId: quote.id,
      insumoId,
      qtyPersonas,
      unitsValue,
      lineCostGtq: costGtq,
      lineCostUsd: costGtq / rate,
    });

    // Actualizar manualmente los totales de la cabecera
    await quote.increment({
      totalCostGtq: costGtq,
      totalCostUsd: costGtq / rate,
    });

    const updated = await Quote.findByPk(quote.id);
    res.status(201).json({ line, quote: updated });
  } catch (err) { next(err); }
};

// POST /api/quotes/:id/render — subir imagen de render (cotizador o aprobaciones)
exports.uploadRender = async (req, res, next) => {
  try {
    const quote = await Quote.findByPk(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada.' });
    if (!req.file) return res.status(400).json({ error: 'Imagen requerida.' });

    // Eliminar imagen anterior si existía
    if (quote.renderImagePath) {
      const oldPath = path.join(RENDERS_DIR, quote.renderImagePath);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    await quote.update({ renderImagePath: req.file.filename });
    res.json({ renderImagePath: req.file.filename });
  } catch (err) { next(err); }
};

// PUT /api/quotes/:id/billing — guardar schedule de facturación mensual
exports.updateBilling = async (req, res, next) => {
  try {
    const quote = await Quote.findByPk(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada.' });
    const { billingSchedule } = req.body;
    if (!Array.isArray(billingSchedule)) return res.status(400).json({ error: 'billingSchedule debe ser un arreglo.' });
    await quote.update({ billingSchedule });
    res.json({ billingSchedule });
  } catch (err) { next(err); }
};

// DELETE /api/quotes/:id/render — eliminar imagen de render
exports.deleteRender = async (req, res, next) => {
  try {
    const quote = await Quote.findByPk(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada.' });

    if (quote.renderImagePath) {
      const filePath = path.join(RENDERS_DIR, quote.renderImagePath);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      await quote.update({ renderImagePath: null });
    }
    res.json({ message: 'Imagen eliminada.' });
  } catch (err) { next(err); }
};
