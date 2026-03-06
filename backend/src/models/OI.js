const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OI = sequelize.define('OI', {
  mallId: { type: DataTypes.INTEGER, allowNull: true },
  oiCode: { type: DataTypes.STRING, unique: true, allowNull: false },
  oiName: { type: DataTypes.STRING, allowNull: false },
  annualBudgetUsd: { type: DataTypes.FLOAT, defaultValue: 0 },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'ois' });

module.exports = OI;
