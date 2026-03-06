const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Insumo = sequelize.define('Insumo', {
  name: { type: DataTypes.STRING, unique: true, allowNull: false },
  unitType: { type: DataTypes.STRING }, // HORA | DIA | UNIDAD | GLOBAL
  costGtq: { type: DataTypes.FLOAT, defaultValue: 0 },
  billingMode: { type: DataTypes.STRING }, // MULTIPLICABLE | FIJO
  category: { type: DataTypes.STRING, allowNull: true },
  description: { type: DataTypes.STRING, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'insumos' });

module.exports = Insumo;
