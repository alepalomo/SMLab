require('dotenv').config();
const { Sequelize } = require('sequelize');

const isInternal = (process.env.DATABASE_URL || '').includes('railway.internal');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: (!isInternal && process.env.NODE_ENV === 'production')
    ? { ssl: { require: true, rejectUnauthorized: false } }
    : {},
});

module.exports = sequelize;
