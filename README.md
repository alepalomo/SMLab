# Spectrum Media Lab — Sistema de Cotizaciones

Sistema completo de gestión de cotizaciones, aprobaciones, gastos y presupuesto para Spectrum Media Lab.

---

## Estructura del proyecto

```
SMLab/
├── backend/    → Node.js + Express + Sequelize + PostgreSQL
└── frontend/   → React + Vite + TailwindCSS
```

---

## Requisitos

- Node.js 18+
- PostgreSQL 14+ (local o en la nube)

---

## 1. Configurar el Backend

```bash
cd backend
npm install
```

Copiá el archivo de ejemplo y editalo:

```bash
cp .env.example .env
```

Editá `.env` con tu URL de base de datos:

```
DATABASE_URL=postgresql://usuario:password@localhost:5432/smlab
JWT_SECRET=un_secreto_largo_y_aleatorio
PORT=4000
FRONTEND_URL=http://localhost:5173
ASSETS_PATH=./src/assets
```

### Imágenes para PDFs (Host)

Copiá desde el proyecto original:

```bash
cp /ruta/original/header_spectrummedia.png backend/src/assets/
cp /ruta/original/firma.png backend/src/assets/
```

### Iniciar el servidor

```bash
npm run dev       # desarrollo (nodemon)
npm start         # producción
```

Al arrancar crea automáticamente:
- Todas las tablas en la base de datos
- Usuario admin (user: `admin` / pass: `admin123`) — **cambiar en producción**
- Tipo de cambio inicial Q7.80/USD

---

## 2. Configurar el Frontend

```bash
cd frontend
npm install
npm run dev
```

El frontend corre en `http://localhost:5173` y hace proxy automático a `http://localhost:4000`.

Para producción:

```bash
npm run build   # genera la carpeta dist/
```

---

## Deploy en la nube (recomendado)

### Backend → [Railway](https://railway.app) o [Render](https://render.com)

1. Crear un proyecto nuevo
2. Agregar un servicio PostgreSQL (Railway lo hace con un click)
3. Agregar las variables de entorno del `.env.example`
4. El `DATABASE_URL` lo provee Railway/Render automáticamente

### Frontend → [Vercel](https://vercel.com) o [Netlify](https://netlify.com)

1. Conectar el repositorio
2. Build command: `npm run build`
3. Output directory: `dist`
4. Variable de entorno: `VITE_API_URL=https://tu-backend.railway.app`

> Nota: Si el frontend no usa proxy de Vite en producción, actualizá `src/lib/api.js`:
> ```js
> baseURL: import.meta.env.VITE_API_URL || '/api'
> ```

---

## Roles de usuario

| Rol        | Permisos |
|------------|---------|
| ADMIN      | Todo: cotizar, aprobar, catálogos, dashboard |
| AUTORIZADO | Cotizar, aprobar, gastos, dashboard (sin gestión de usuarios) |
| VENDEDOR   | Solo cotizar y cargar gastos propios |

---

## Módulos

| Módulo | URL | Descripción |
|--------|-----|-------------|
| Cotizador | `/cotizador` | Crear y editar cotizaciones, plantillas |
| Aprobaciones | `/aprobaciones` | Aprobar/rechazar, definir precio de venta, liquidar |
| Ejecución | `/ejecucion` | Asignar OI y ejecutar actividades aprobadas |
| Gastos Reales | `/gastos` | ODC, Caja Chica, Host (genera PDFs en ZIP) |
| Dashboard | `/dashboard` | Métricas financieras y ejecución presupuestaria |
| Catálogos | `/catalogos` | CRUD de insumos, malls, OIs, usuarios, proveedores |

---

## Flujo de una cotización

```
BORRADOR → ENVIADA → APROBADA → EJECUTADA → LIQUIDADA
              ↓ (rechazo)
           BORRADOR
```
