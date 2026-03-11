const { Op } = require('sequelize');
const { Quote, Expense, OI, Mall, ActivityType } = require('../models');

// GET /api/dashboard/financials?year=2026&mallIds=1,2&typeIds=&quoteIds=
exports.financials = async (req, res, next) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const mallIds = req.query.mallIds ? req.query.mallIds.split(',').map(Number) : [];
    const typeIds = req.query.typeIds ? req.query.typeIds.split(',').map(Number) : [];
    const quoteIds = req.query.quoteIds ? req.query.quoteIds.split(',').map(Number) : [];

    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59);

    // Query de ventas (cotizaciones visibles)
    const salesWhere = {
      status: { [Op.in]: ['APROBADA', 'EJECUTADA', 'LIQUIDADA'] },
      createdAt: { [Op.between]: [start, end] },
    };
    // No filtramos por mallId en DB porque las cotizaciones multi-mall tienen
    // mallId = primer mall; el filtro real se hace en JS usando el array mallIds
    if (typeIds.length) salesWhere.activityTypeId = { [Op.in]: typeIds };
    if (quoteIds.length) salesWhere.id = { [Op.in]: quoteIds };

    const salesData = await Quote.findAll({
      where: salesWhere,
      include: [
        { model: Mall, as: 'mall', attributes: ['id', 'name'] },
        { model: ActivityType, as: 'activityType', attributes: ['id', 'name'] },
      ],
    });

    // Filtrar por malls en JS: incluir si algún mallId del array coincide
    const filteredSales = mallIds.length
      ? salesData.filter(q => {
          const qMalls = Array.isArray(q.mallIds) && q.mallIds.length > 0
            ? q.mallIds
            : (q.mallId ? [q.mallId] : []);
          return qMalls.length === 0 || qMalls.some(id => mallIds.includes(id));
        })
      : salesData;

    const visibleIds = filteredSales.map(q => q.id);

    // Total venta: para cotizaciones multi-mall con billing schedule,
    // atribuir solo la porción facturada a los malls del filtro
    const totalVentaUsd = filteredSales.reduce((s, q) => {
      if (mallIds.length && q.billingSchedule?.length) {
        const billedForMalls = q.billingSchedule
          .filter(e => !e.mallId || mallIds.includes(e.mallId))
          .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        return s + billedForMalls;
      }
      return s + (q.finalSalePriceUsd != null ? q.finalSalePriceUsd : q.suggestedPriceUsdM60);
    }, 0);
    const totalCostoPresupuestoUsd = filteredSales.reduce((s, q) => s + q.totalCostUsd, 0);

    // Gastos reales vinculados a esas cotizaciones
    let totalGastoRealUsd = 0;
    if (visibleIds.length) {
      const expWhere = { quoteId: { [Op.in]: visibleIds } };
      if (mallIds.length) expWhere.mallId = { [Op.in]: mallIds };
      const gastos = await Expense.findAll({ where: expWhere });
      totalGastoRealUsd = gastos.reduce((s, e) => s + e.amountUsd, 0);
    }

    const utilidadRealUsd = totalVentaUsd - totalGastoRealUsd;
    const margenRealPct = totalVentaUsd > 0 ? (utilidadRealUsd / totalVentaUsd) * 100 : 0;
    const variacionPresupuesto = totalCostoPresupuestoUsd - totalGastoRealUsd;

    res.json({
      totalVentaUsd,
      totalCostoPresupuestoUsd,
      totalGastoRealUsd,
      utilidadRealUsd,
      margenRealPct,
      variacionPresupuesto,
      actividades: filteredSales.length,
    });
  } catch (err) { next(err); }
};

// GET /api/dashboard/oi-execution?year=2026&mallIds=
exports.oiExecution = async (req, res, next) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const mallIds = req.query.mallIds ? req.query.mallIds.split(',').map(Number) : [];

    // OIs activas
    const oiWhere = { isActive: true };
    if (mallIds.length) oiWhere.mallId = { [Op.in]: mallIds };
    const ois = await OI.findAll({ where: oiWhere, include: [{ model: Mall, as: 'mall' }] });

    // Gastos reales del año
    const expWhere = { year };
    if (mallIds.length) expWhere.mallId = { [Op.in]: mallIds };
    const expenses = await Expense.findAll({
      where: expWhere,
      include: [{ model: OI, as: 'oi' }],
    });

    // Construir mapa OI → { budget, real }
    const oiMap = {};
    for (const oi of ois) {
      oiMap[oi.oiCode] = {
        oiCode: oi.oiCode,
        oiName: oi.oiName,
        mall: oi.mall?.name || 'N/A',
        budgetUsd: oi.annualBudgetUsd,
        realUsd: 0,
        realGtq: 0,
      };
    }

    for (const e of expenses) {
      const code = e.oi?.oiCode;
      if (!code) continue;
      if (!oiMap[code]) {
        oiMap[code] = {
          oiCode: code,
          oiName: e.oi.oiName,
          mall: 'N/A',
          budgetUsd: e.oi.annualBudgetUsd,
          realUsd: 0,
          realGtq: 0,
        };
      }
      oiMap[code].realUsd += e.amountUsd;
      oiMap[code].realGtq += e.amountGtq;
    }

    const result = Object.values(oiMap).map(o => ({
      ...o,
      pctEjecucion: o.budgetUsd > 0 ? (o.realUsd / o.budgetUsd) * 100 : 0,
      disponibleUsd: o.budgetUsd - o.realUsd,
    }));

    res.json(result);
  } catch (err) { next(err); }
};

// GET /api/dashboard/billing?year= — facturación mensual agregada
exports.billingByMonth = async (req, res, next) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const mallIdsFilter = req.query.mallIds ? req.query.mallIds.split(',').map(Number) : [];

    const quotes = await Quote.findAll({
      attributes: ['id', 'billingSchedule'],
      where: { status: { [Op.in]: ['APROBADA', 'EJECUTADA', 'LIQUIDADA'] } },
    });

    const mallList = await Mall.findAll({ attributes: ['id', 'name'] });
    const mallMap = Object.fromEntries(mallList.map(m => [m.id, m.name]));

    const byMonth = {};
    for (const q of quotes) {
      if (!q.billingSchedule?.length) continue;
      for (const entry of q.billingSchedule) {
        const { month, mallId, amount } = entry;
        if (!month || !month.startsWith(String(year))) continue;
        if (mallIdsFilter.length && mallId && !mallIdsFilter.includes(mallId)) continue;
        if (!byMonth[month]) byMonth[month] = { month, total: 0, byMall: {} };
        byMonth[month].total += Number(amount) || 0;
        const key = mallId ?? '_';
        if (!byMonth[month].byMall[key]) {
          byMonth[month].byMall[key] = { mallId: mallId || null, name: mallId ? (mallMap[mallId] || `Mall #${mallId}`) : 'General', amount: 0 };
        }
        byMonth[month].byMall[key].amount += Number(amount) || 0;
      }
    }

    const result = Object.values(byMonth)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => ({ ...m, byMall: Object.values(m.byMall) }));

    res.json(result);
  } catch (err) { next(err); }
};

// GET /api/dashboard/filters?year= — opciones disponibles para los filtros
exports.filterOptions = async (req, res, next) => {
  try {
    const [malls, types] = await Promise.all([
      Mall.findAll({ attributes: ['id', 'name'] }),
      ActivityType.findAll({ attributes: ['id', 'name'] }),
    ]);
    res.json({ malls, types });
  } catch (err) { next(err); }
};
