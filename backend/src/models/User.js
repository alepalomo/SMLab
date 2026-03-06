const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  username: { type: DataTypes.STRING, unique: true, allowNull: false },
  passwordHash: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.STRING, allowNull: false }, // ADMIN | AUTORIZADO | VENDEDOR
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'users' });

module.exports = User;
