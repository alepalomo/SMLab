const sequelize = require('../config/database');

const User = require('./User');
const Mall = require('./Mall');
const OI = require('./OI');
const ExchangeRate = require('./ExchangeRate');
const ActivityType = require('./ActivityType');
const Insumo = require('./Insumo');
const Quote = require('./Quote');
const QuoteLine = require('./QuoteLine');
const Proveedor = require('./Proveedor');
const Expense = require('./Expense');

// --- Asociaciones ---

// Mall → OI
Mall.hasMany(OI, { foreignKey: 'mallId', as: 'ois' });
OI.belongsTo(Mall, { foreignKey: 'mallId', as: 'mall' });

// Quote
Quote.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
Quote.belongsTo(Mall, { foreignKey: 'mallId', as: 'mall' });
Quote.belongsTo(OI, { foreignKey: 'oiId', as: 'oi' });
Quote.belongsTo(ActivityType, { foreignKey: 'activityTypeId', as: 'activityType' });
Quote.hasMany(QuoteLine, { foreignKey: 'quoteId', as: 'lines' });

// QuoteLine
QuoteLine.belongsTo(Quote, { foreignKey: 'quoteId', as: 'quote' });
QuoteLine.belongsTo(Insumo, { foreignKey: 'insumoId', as: 'insumo' });

// Expense
Expense.belongsTo(Mall, { foreignKey: 'mallId', as: 'mall' });
Expense.belongsTo(OI, { foreignKey: 'oiId', as: 'oi' });
Expense.belongsTo(Quote, { foreignKey: 'quoteId', as: 'quote' });
Expense.belongsTo(Proveedor, { foreignKey: 'companyId', as: 'company' });

module.exports = {
  sequelize,
  User,
  Mall,
  OI,
  ExchangeRate,
  ActivityType,
  Insumo,
  Quote,
  QuoteLine,
  Proveedor,
  Expense,
};
