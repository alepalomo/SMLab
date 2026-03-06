const errorHandler = (err, req, res, next) => {
  console.error('[ERROR]', err.message);

  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ error: 'Ya existe un registro con ese valor único.' });
  }
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
  }
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(409).json({ error: 'No se puede eliminar: existen registros relacionados.' });
  }

  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Error interno del servidor.' });
};

module.exports = errorHandler;
