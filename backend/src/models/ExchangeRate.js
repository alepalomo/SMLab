const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ExchangeRate = sequelize.define('ExchangeRate', {
  effectiveDate: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW },
  gtqPerUsd: { type: DataTypes.FLOAT, allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'exchange_rates' });

module.exports = ExchangeRate;
