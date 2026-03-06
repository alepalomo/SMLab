const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const QuoteLine = sequelize.define('QuoteLine', {
  quoteId: { type: DataTypes.INTEGER, allowNull: false },
  insumoId: { type: DataTypes.INTEGER, allowNull: false },
  qtyPersonas: { type: DataTypes.FLOAT, defaultValue: 1 },
  unitsValue: { type: DataTypes.FLOAT, defaultValue: 1 },
  lineCostGtq: { type: DataTypes.FLOAT, defaultValue: 0 },
  lineCostUsd: { type: DataTypes.FLOAT, defaultValue: 0 },
}, { tableName: 'quote_lines' });

module.exports = QuoteLine;
