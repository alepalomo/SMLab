export const fmtUSD = n => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fmtGTQ = n => `Q${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fmtPct = n => `${Number(n || 0).toFixed(1)}%`;

export const STATUS_LABELS = {
  BORRADOR: 'Borrador',
  ENVIADA: 'Enviada',
  APROBADA: 'Aprobada',
  EJECUTADA: 'Ejecutada',
  LIQUIDADA: 'Liquidada',
  PLANTILLA: 'Plantilla',
};

export const STATUS_COLORS = {
  BORRADOR:  'bg-gray-100 text-gray-700',
  ENVIADA:   'bg-yellow-100 text-yellow-800',
  APROBADA:  'bg-green-100 text-green-800',
  EJECUTADA: 'bg-blue-100 text-blue-800',
  LIQUIDADA: 'bg-purple-100 text-purple-800',
  PLANTILLA: 'bg-orange-100 text-orange-800',
};

export const CATEGORIAS = [
  'Bebidas','Comida','Decoración','Entretenimiento','Extras',
  'Logos','Mantenimiento','Mobiliario','Pantallas','Personal','Servicio','Sticker',
];

export const ROLES = ['ADMIN', 'AUTORIZADO', 'VENDEDOR'];

// Devuelve el error legible del backend
export const getApiError = err =>
  err?.response?.data?.error || err?.message || 'Error desconocido';
