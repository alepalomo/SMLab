const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Mall = sequelize.define('Mall', {
  name: { type: DataTypes.STRING, unique: true, allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'malls' });

module.exports = Mall;
