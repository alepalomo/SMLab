require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? false : false,
  dialectOptions:
    process.env.NODE_ENV === 'production'
      ? { ssl: { require: true, rejectUnauthorized: false } }
      : {},
});

module.exports = sequelize;
