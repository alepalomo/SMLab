const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Expense = sequelize.define('Expense', {
  date: { type: DataTypes.DATEONLY, allowNull: false },
  year: { type: DataTypes.INTEGER },
  month: { type: DataTypes.INTEGER },
  mallId: { type: DataTypes.INTEGER, allowNull: true },
  oiId: { type: DataTypes.INTEGER, allowNull: true },
  quoteId: { type: DataTypes.INTEGER, allowNull: false },
  category: { type: DataTypes.STRING }, // ODC | CAJA_CHICA | HOST
  description: { type: DataTypes.STRING, allowNull: true },
  amountGtq: { type: DataTypes.FLOAT, defaultValue: 0 },
  amountUsd: { type: DataTypes.FLOAT, defaultValue: 0 },
  docNumber: { type: DataTypes.STRING, allowNull: true },
  odcNumber: { type: DataTypes.STRING, allowNull: true },
  textAdditional: { type: DataTypes.STRING, allowNull: true },
  hostDetails: { type: DataTypes.JSONB, allowNull: true }, // [{desc, rate, days}]
  companyId: { type: DataTypes.INTEGER, allowNull: true },
  payTo: { type: DataTypes.STRING, allowNull: true },
  receiptImagePath: { type: DataTypes.STRING, allowNull: true },
}, { tableName: 'expenses' });

module.exports = Expense;
