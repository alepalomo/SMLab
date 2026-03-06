const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ActivityType = sequelize.define('ActivityType', {
  name: { type: DataTypes.STRING, unique: true, allowNull: false },
  description: { type: DataTypes.STRING, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'activity_types' });

module.exports = ActivityType;
