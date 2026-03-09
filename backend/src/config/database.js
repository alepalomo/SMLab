require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: process.env.DATABASE_URL?.includes('railway.internal') 
    ? {} 
    : { ssl: { require: true, rejectUnauthorized: false } }
});

module.exports = sequelize;
