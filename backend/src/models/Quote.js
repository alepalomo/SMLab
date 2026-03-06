const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Quote = sequelize.define('Quote', {
  createdBy: { type: DataTypes.INTEGER, allowNull: false },
  mallId: { type: DataTypes.INTEGER, allowNull: true },
  mallIds: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
  oiId: { type: DataTypes.INTEGER, allowNull: true },
  activityName: { type: DataTypes.STRING, allowNull: false },
  activityTypeId: { type: DataTypes.INTEGER, allowNull: true },
  // BORRADOR | ENVIADA | APROBADA | EJECUTADA | LIQUIDADA | PLANTILLA
  status: { type: DataTypes.STRING, defaultValue: 'BORRADOR' },
  totalCostGtq: { type: DataTypes.FLOAT, defaultValue: 0 },
  totalCostUsd: { type: DataTypes.FLOAT, defaultValue: 0 },
  suggestedPriceUsdM70: { type: DataTypes.FLOAT, defaultValue: 0 },
  suggestedPriceUsdM60: { type: DataTypes.FLOAT, defaultValue: 0 },
  suggestedPriceUsdM50: { type: DataTypes.FLOAT, defaultValue: 0 },
  finalSalePriceUsd: { type: DataTypes.FLOAT, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
  renderImagePath: { type: DataTypes.STRING, allowNull: true },
  billingSchedule: { type: DataTypes.JSON, allowNull: true, defaultValue: [] }, // [{ month, mallId, amount }]
}, { tableName: 'quotes' });

module.exports = Quote;
