const path = require('path');
const fs = require('fs');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const { Expense, Quote, OI, Mall, Proveedor } = require('../models');
const { getActiveRate } = require('../services/exchangeService');
const { generateHostZip } = require('../services/pdfService');

// ── Multer para facturas de Caja Chica ───────────────────────────────────────
const RECEIPTS_DIR = path.join(__dirname, '../assets/receipts');
if (!fs.existsSync(RECEIPTS_DIR)) fs.mkdirSync(RECEIPTS_DIR, { recursive: true });

const receiptStorage = multer.diskStorage({
  destination: RECEIPTS_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `receipt_${req.params.id}_${Date.now()}${ext}`);
  },
});
const receiptUpload = multer({
  storage: receiptStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});
exports.receiptUpload = receiptUpload;

// POST /api/expenses/odc
exports.createOdc = async (req, res, next) => {
  try {
    const { odcNumber, date, oiId, companyId, amountGtq, description, quoteId } = req.body;
    const rate = await getActiveRate();
    const oi = await OI.findByPk(oiId);
    const quote = await Quote.findByPk(quoteId);
    if (!oi || !quote) return res.status(404).json({ error: 'OI o Actividad no encontrada.' });

    const d = new Date(date);
    const expense = await Expense.create({
      date,
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      mallId: quote.mallId || oi.mallId,
      oiId,
      quoteId,
      category: 'ODC',
      description,
      amountGtq,
      amountUsd: amountGtq / rate,
      odcNumber,
      companyId: companyId || null,
    });
    res.status(201).json(expense);
  } catch (err) { next(err); }
};

// POST /api/expenses/caja-chica
exports.createCajaChica = async (req, res, next) => {
  try {
    const { date, oiId, companyId, amountGtq, docNumber, textAdditional, payTo, quoteId } = req.body;
    const rate = await getActiveRate();
    const oi = await OI.findByPk(oiId);
    const quote = await Quote.findByPk(quoteId);
    if (!oi || !quote) return res.status(404).json({ error: 'OI o Actividad no encontrada.' });

    const d = new Date(date);
    const expense = await Expense.create({
      date,
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      mallId: quote.mallId || oi.mallId,
      oiId,
      quoteId,
      category: 'CAJA_CHICA',
      description: `Factura ${docNumber || ''}`,
      amountGtq,
      amountUsd: amountGtq / rate,
      docNumber,
      textAdditional,
      payTo,
      companyId: companyId || null,
    });
    res.status(201).json(expense);
  } catch (err) { next(err); }
};

// POST /api/expenses/host
exports.createHost = async (req, res, next) => {
  try {
    const { date, quoteId, companyId, contractDesc, rows } = req.body;
    // rows = [{ desc, rate, days }]

    const rate = await getActiveRate();
    const quote = await Quote.findByPk(quoteId);
    const proveedor = await Proveedor.findByPk(companyId);

    if (!quote) return res.status(404).json({ error: 'Actividad no encontrada.' });
    if (!proveedor) return res.status(404).json({ error: 'Proveedor no encontrado.' });
    if (!proveedor.cui) return res.status(400).json({ error: 'El proveedor no tiene CUI registrado.' });

    const totalGtq = rows.reduce((s, r) => s + (r.rate || 0) * (r.days || 0), 0);
    const d = new Date(date);

    // Necesitamos una OI para el gasto; si la quote no tiene, tomamos la primera activa
    let oiId = quote.oiId;
    if (!oiId) {
      const firstOi = await OI.findOne();
      oiId = firstOi?.id || null;
    }

    const expense = await Expense.create({
      date,
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      mallId: quote.mallId,
      oiId,
      quoteId,
      category: 'HOST',
      description: `Host ${proveedor.name} - ${contractDesc}`,
      amountGtq: totalGtq,
      amountUsd: totalGtq / rate,
      companyId,
      hostDetails: rows,
    });

    // Generar ZIP con PDFs
    const zipBuffer = await generateHostZip(expense, proveedor, contractDesc, rows);
    const receiptId = String(expense.id).padStart(5, '0');

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="Pack_Legal_${proveedor.name}_${receiptId}.zip"`,
    });
    res.send(zipBuffer);
  } catch (err) { next(err); }
};

// GET /api/expenses/:id
exports.getOne = async (req, res, next) => {
  try {
    const expense = await Expense.findByPk(req.params.id, {
      include: [
        { model: OI, as: 'oi', attributes: ['oiCode', 'oiName'] },
        { model: Proveedor, as: 'company', attributes: ['name', 'nit', 'legalName'] },
        { model: Quote, as: 'quote', attributes: ['activityName'] },
        { model: Mall, as: 'mall', attributes: ['name'] },
      ],
    });
    if (!expense) return res.status(404).json({ error: 'Gasto no encontrado.' });
    res.json(expense);
  } catch (err) { next(err); }
};

// PUT /api/expenses/:id
exports.updateExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findByPk(req.params.id);
    if (!expense) return res.status(404).json({ error: 'Gasto no encontrado.' });

    const allowed = ['date', 'description', 'amountGtq', 'odcNumber', 'docNumber', 'textAdditional', 'payTo', 'oiId', 'quoteId', 'companyId'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    if (updates.amountGtq !== undefined) {
      const rate = await getActiveRate();
      updates.amountUsd = updates.amountGtq / rate;
    }
    if (updates.date) {
      const d = new Date(updates.date);
      updates.year = d.getFullYear();
      updates.month = d.getMonth() + 1;
    }

    await expense.update(updates);
    res.json(expense);
  } catch (err) { next(err); }
};

// DELETE /api/expenses/:id
exports.deleteExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findByPk(req.params.id);
    if (!expense) return res.status(404).json({ error: 'Gasto no encontrado.' });
    await expense.destroy();
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// GET /api/expenses?category=ODC&from=2024-01-01&to=2024-12-31&limit=10
exports.list = async (req, res, next) => {
  try {
    const { Op } = require('sequelize');
    const where = {};
    if (req.query.category) where.category = req.query.category;
    if (req.query.from && req.query.to) {
      where.date = { [Op.between]: [req.query.from, req.query.to] };
    }
    const expenses = await Expense.findAll({
      where,
      include: [
        { model: OI, as: 'oi', attributes: ['oiCode', 'oiName'] },
        { model: Proveedor, as: 'company', attributes: ['name', 'nit', 'legalName'] },
        { model: Quote, as: 'quote', attributes: ['activityName'] },
        { model: Mall, as: 'mall', attributes: ['name'] },
      ],
      order: [['date', 'DESC'], ['createdAt', 'DESC']],
      limit: req.query.limit ? parseInt(req.query.limit) : undefined,
    });
    res.json(expenses);
  } catch (err) { next(err); }
};

// GET /api/expenses/report/odc?from=&to= — devuelve CSV
exports.reportOdc = async (req, res, next) => {
  try {
    const { Op } = require('sequelize');
    const { from, to } = req.query;
    const where = { category: 'ODC' };
    if (from && to) where.date = { [Op.between]: [from, to] };

    const data = await Expense.findAll({
      where,
      include: [
        { model: OI, as: 'oi' },
        { model: Proveedor, as: 'company' },
        { model: Quote, as: 'quote' },
      ],
      order: [['date', 'ASC']],
    });

    const header = 'Fecha,ODC,OI,Proveedor,Monto Q,Descripcion,Actividad\n';
    const rows = data.map(e =>
      [e.date, e.odcNumber || '', e.oi?.oiCode || '', e.company?.name || '',
        e.amountGtq, `"${e.description || ''}"`, `"${e.quote?.activityName || ''}"`,
      ].join(',')
    ).join('\n');

    res.set({ 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="reporte_odc.csv"' });
    res.send(header + rows);
  } catch (err) { next(err); }
};

// GET /api/expenses/report/caja-chica?from=&to= — devuelve CSV contable
exports.reportCajaChica = async (req, res, next) => {
  try {
    const { Op } = require('sequelize');
    const { from, to } = req.query;
    const where = { category: 'CAJA_CHICA' };
    if (from && to) where.date = { [Op.between]: [from, to] };

    const data = await Expense.findAll({
      where,
      include: [
        { model: OI, as: 'oi' },
        { model: Proveedor, as: 'company' },
        { model: Quote, as: 'quote' },
      ],
      order: [['date', 'ASC']],
    });

    const header = 'Operacion Contable,Monto,ST.doc,Ind.Impuesto,Libro Mayor,NIT,RAZON SOCIAL,Fecha Documento,# FACT,Orden Interna,Texto,Texto Adicional 2,Pagar A,Actividad\n';
    const rows = data.map(e =>
      [
        'COSTO O GASTO GRAVADO',
        e.amountGtq,
        '',
        'V1',
        '7006080000',
        e.company?.nit || '',
        `"${e.company?.legalName || ''}"`,
        e.date,
        e.docNumber || '',
        e.oi?.oiCode || '',
        'B',
        `"${e.textAdditional || ''}"`,
        `"${e.payTo || ''}"`,
        `"${e.quote?.activityName || ''}"`,
      ].join(',')
    ).join('\n');

    res.set({ 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="caja_chica_contable.csv"' });
    res.send(header + rows);
  } catch (err) { next(err); }
};

// POST /api/expenses/:id/receipt — subir imagen de factura
exports.uploadReceipt = async (req, res, next) => {
  try {
    const expense = await Expense.findByPk(req.params.id);
    if (!expense) return res.status(404).json({ error: 'Gasto no encontrado.' });
    if (!req.file) return res.status(400).json({ error: 'Imagen requerida.' });

    if (expense.receiptImagePath) {
      const oldPath = path.join(RECEIPTS_DIR, expense.receiptImagePath);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    await expense.update({ receiptImagePath: req.file.filename });
    res.json({ receiptImagePath: req.file.filename });
  } catch (err) { next(err); }
};

// DELETE /api/expenses/:id/receipt — eliminar imagen de factura
exports.deleteReceipt = async (req, res, next) => {
  try {
    const expense = await Expense.findByPk(req.params.id);
    if (!expense) return res.status(404).json({ error: 'Gasto no encontrado.' });

    if (expense.receiptImagePath) {
      const filePath = path.join(RECEIPTS_DIR, expense.receiptImagePath);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      await expense.update({ receiptImagePath: null });
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// GET /api/expenses/report/caja-chica-pdf?from=&to=&oiId= — PDF con todas las facturas
exports.reportCajaChicaPdf = async (req, res, next) => {
  try {
    const { Op } = require('sequelize');
    const { from, to, oiId } = req.query;
    const where = { category: 'CAJA_CHICA' };
    if (from && to) where.date = { [Op.between]: [from, to] };
    if (oiId) where.oiId = oiId;

    const data = await Expense.findAll({
      where,
      include: [
        { model: OI, as: 'oi' },
        { model: Proveedor, as: 'company' },
        { model: Quote, as: 'quote' },
      ],
      order: [['date', 'ASC']],
    });

    const doc = new PDFDocument({ autoFirstPage: false, margin: 40 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));

    for (const e of data) {
      doc.addPage();

      // Encabezado
      doc.fontSize(14).font('Helvetica-Bold').text('Factura de Caja Chica', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');

      const info = [
        ['Fecha', e.date],
        ['# Factura', e.docNumber || '—'],
        ['Proveedor', e.company?.name || '—'],
        ['NIT', e.company?.nit || '—'],
        ['OI', e.oi?.oiCode ? `${e.oi.oiCode} — ${e.oi.oiName}` : '—'],
        ['Actividad', e.quote?.activityName || '—'],
        ['Monto', `Q ${Number(e.amountGtq).toFixed(2)}`],
        ['Pagar a', e.payTo || '—'],
        ['Texto adicional', e.textAdditional || '—'],
      ];

      info.forEach(([label, value]) => {
        doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
        doc.font('Helvetica').text(String(value));
      });

      // Imagen de factura
      if (e.receiptImagePath) {
        const imgPath = path.join(RECEIPTS_DIR, e.receiptImagePath);
        if (fs.existsSync(imgPath)) {
          doc.moveDown(1);
          const ext = path.extname(e.receiptImagePath).toLowerCase();
          if (ext === '.pdf') {
            doc.fillColor('#555555').fontSize(9)
              .text(`Factura adjunta en formato PDF: ${e.receiptImagePath}`, { align: 'center' });
            doc.fillColor('#000000');
          } else {
            const pageW = doc.page.width - 80;
            const maxH = doc.page.height - doc.y - 60;
            doc.image(imgPath, { fit: [pageW, maxH], align: 'center' });
          }
        }
      } else {
        doc.moveDown(1);
        doc.fillColor('#aaaaaa').fontSize(9).text('(Sin imagen de factura adjunta)', { align: 'center' });
        doc.fillColor('#000000');
      }
    }

    if (data.length === 0) {
      doc.addPage();
      doc.fontSize(12).text('No hay registros de Caja Chica en el período seleccionado.', { align: 'center' });
    }

    doc.end();

    await new Promise(resolve => doc.on('end', resolve));
    const pdfBuffer = Buffer.concat(chunks);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="facturas_caja_chica_${from}_${to}.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (err) { next(err); }
};
