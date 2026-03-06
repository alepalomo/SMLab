require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { sequelize, User, ExchangeRate, ActivityType } = require('../models');

async function seed() {
  await sequelize.sync({ alter: true });
  console.log('Tablas sincronizadas.');

  // Admin
  const existing = await User.findOne({ where: { username: 'admin' } });
  if (!existing) {
    await User.create({
      username: 'admin',
      passwordHash: bcrypt.hashSync('admin123', 10),
      role: 'ADMIN',
    });
    console.log('Usuario admin creado (password: admin123).');
  }

  // Tipo de cambio inicial
  const rate = await ExchangeRate.findOne({ where: { isActive: true } });
  if (!rate) {
    await ExchangeRate.create({ gtqPerUsd: 7.8, isActive: true });
    console.log('Tipo de cambio inicial: Q7.80/USD');
  }

  // Tipos de actividad de ejemplo
  const types = ['Activación de Marca', 'Evento', 'Sampling', 'Exhibición', 'Producción'];
  for (const name of types) {
    await ActivityType.findOrCreate({ where: { name } });
  }
  console.log('Tipos de actividad cargados.');

  console.log('\nSeed completado exitosamente.');
  process.exit(0);
}

seed().catch(err => {
  console.error('Error en seed:', err);
  process.exit(1);
});
