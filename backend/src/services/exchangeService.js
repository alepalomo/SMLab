const { ExchangeRate } = require('../models');

const DEFAULT_RATE = 7.8;

async function getActiveRate() {
  const rate = await ExchangeRate.findOne({ where: { isActive: true } });
  return rate ? rate.gtqPerUsd : DEFAULT_RATE;
}

module.exports = { getActiveRate, DEFAULT_RATE };
