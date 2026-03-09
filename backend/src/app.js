require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { sequelize } = require('./models');
const errorHandler = require('./middleware/errorHandler');
const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use('/renders', express.static(path.join(__dirname, 'assets/renders')));
app.use('/receipts', express.static(path.join(__dirname, 'assets/receipts')));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/quotes', require('./routes/quotes'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/catalogs', require('./routes/catalogs'));
app.get('/api/health', (_, res) => res.json({ status: 'ok', timestamp: new Date() }));
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

async function connectDB() {
  const bcrypt = require('bcryptjs');
  const { User, ExchangeRate } = require('./models');
  let retries = 20;
  while (retries > 0) {
    try {
      await sequelize.authenticate();
      console.log('Conectado a la base de datos.');
      await sequelize.sync({ alter: true });
      const admin = await User.findOne({ where: { username: 'admin' } });
      if (!admin) {
        await User.create({ username: 'admin', passwordHash: bcrypt.hashSync('admin123', 10), role: 'ADMIN' });
        console.log('Admin creado');
      }
      const rate = await ExchangeRate.findOne({ where: { isActive: true } });
      if (!rate) await ExchangeRate.create({ gtqPerUsd: 7.8, isActive: true });
      console.log('DB lista.');
      return;
    } catch (err) {
      retries--;
      console.error(`Error DB, reintentando... (${retries} restantes)`, err.message);
      await new Promise(r => setTimeout(r, 10000));
    }
  }
  console.error('No se pudo conectar a la DB después de varios intentos.');
}

app.listen(PORT, () => {
  console.log(`Servidor en puerto ${PORT}`);
  connectDB();
});
