require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { sequelize } = require('./models');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ─── Seguridad y parseo ───────────────────────────────────────────────────────
// crossOriginResourcePolicy: cross-origin permite que el frontend cargue las imágenes
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));

// ─── Archivos estáticos — imágenes de render ──────────────────────────────────
app.use('/renders', express.static(path.join(__dirname, 'assets/renders')));

// ─── Rutas ────────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/quotes', require('./routes/quotes'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/catalogs', require('./routes/catalogs'));

app.get('/api/health', (_, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ─── Manejo global de errores ─────────────────────────────────────────────────
app.use(errorHandler);

// ─── Arranque ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await sequelize.authenticate();
    console.log('Conectado a la base de datos.');
    // alter:true actualiza tablas si cambian los modelos (no destruye datos)
    await sequelize.sync({ alter: true });
    console.log('Tablas sincronizadas.');

    // Crear admin inicial si no existe
    const bcrypt = require('bcryptjs');
    const { User, ExchangeRate } = require('./models');
    const admin = await User.findOne({ where: { username: 'admin' } });
    if (!admin) {
      await User.create({
        username: 'admin',
        passwordHash: bcrypt.hashSync('admin123', 10),
        role: 'ADMIN',
      });
      console.log('Admin inicial creado (user: admin / pass: admin123)');
    }
    const rate = await ExchangeRate.findOne({ where: { isActive: true } });
    if (!rate) {
      await ExchangeRate.create({ gtqPerUsd: 7.8, isActive: true });
    }

    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Error al iniciar:', err);
    process.exit(1);
  }
}

start();
