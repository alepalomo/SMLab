const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado. Token requerido.' });
  }
  try {
    const token = header.slice(7);
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado.' });
  }
};

// Uso: requireRole('ADMIN', 'AUTORIZADO')
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'No tenés permisos para esta acción.' });
  }
  next();
};

module.exports = { authenticate, requireRole };
