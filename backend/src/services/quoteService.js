const { Quote, QuoteLine, Insumo } = require('../models');
const { getActiveRate } = require('./exchangeService');

/**
 * Calcula el costo de una línea según el modo de cobro del insumo:
 * - MULTIPLICABLE: costo = costGtq * personas * unidades
 * - FIJO/otro:     costo = costGtq * personas
 */
function computeLineCostGtq(insumo, qtyPersonas, unitsValue) {
  if (insumo.billingMode === 'MULTIPLICABLE') {
    return insumo.costGtq * qtyPersonas * unitsValue;
  }
  return insumo.costGtq * qtyPersonas;
}

/**
 * Recalcula totales y precios sugeridos para una cotización.
 * Se llama cada vez que se agrega, edita o elimina una línea.
 */
async function recalcTotals(quoteId) {
  const quote = await Quote.findByPk(quoteId, {
    include: [{ model: QuoteLine, as: 'lines' }],
  });
  if (!quote) throw new Error('Cotización no encontrada');

  const rate = await getActiveRate();
  let totalGtq = 0;
  let totalUsd = 0;

  for (const line of quote.lines) {
    totalGtq += line.lineCostGtq;
    totalUsd += line.lineCostUsd;
  }

  await quote.update({
    totalCostGtq: totalGtq,
    totalCostUsd: totalUsd,
    suggestedPriceUsdM70: totalUsd > 0 ? totalUsd / (1 - 0.70) : 0,
    suggestedPriceUsdM60: totalUsd > 0 ? totalUsd / (1 - 0.60) : 0,
    suggestedPriceUsdM50: totalUsd > 0 ? totalUsd / (1 - 0.50) : 0,
  });

  return quote.reload();
}

/**
 * Clona una cotización (para plantilla → nuevo borrador o para guardar plantilla).
 * Devuelve la nueva Quote con sus líneas creadas.
 */
async function cloneQuote(sourceId, overrides, userId) {
  const source = await Quote.findByPk(sourceId, {
    include: [{ model: QuoteLine, as: 'lines' }],
  });
  if (!source) throw new Error('Cotización origen no encontrada');

  const newQuote = await Quote.create({
    createdBy: userId,
    activityName: overrides.activityName ?? source.activityName,
    activityTypeId: source.activityTypeId,
    mallId: source.mallId,
    notes: source.notes,
    status: overrides.status ?? 'BORRADOR',
    totalCostGtq: source.totalCostGtq,
    totalCostUsd: source.totalCostUsd,
    suggestedPriceUsdM70: source.suggestedPriceUsdM70,
    suggestedPriceUsdM60: source.suggestedPriceUsdM60,
    suggestedPriceUsdM50: source.suggestedPriceUsdM50,
  });

  if (source.lines.length > 0) {
    const newLines = source.lines.map(l => ({
      quoteId: newQuote.id,
      insumoId: l.insumoId,
      qtyPersonas: l.qtyPersonas,
      unitsValue: l.unitsValue,
      lineCostGtq: l.lineCostGtq,
      lineCostUsd: l.lineCostUsd,
    }));
    await QuoteLine.bulkCreate(newLines);
  }

  return newQuote;
}

module.exports = { computeLineCostGtq, recalcTotals, cloneQuote };
