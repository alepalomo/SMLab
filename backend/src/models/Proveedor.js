const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Proveedor = sequelize.define('Proveedor', {
  name: { type: DataTypes.STRING, unique: true, allowNull: false },
  providerType: { type: DataTypes.STRING, allowNull: true }, // Certificado | Directo
  bankName: { type: DataTypes.STRING, allowNull: true },
  accountNumber: { type: DataTypes.STRING, allowNull: true },
  legalName: { type: DataTypes.STRING, allowNull: true },
  nit: { type: DataTypes.STRING, allowNull: true },
  cui: { type: DataTypes.STRING, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'proveedores' });

module.exports = Proveedor;
