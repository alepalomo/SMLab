import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import useAuthStore from './features/auth/authStore';
import Layout from './components/Layout';
import LoginPage from './features/auth/LoginPage';
import CotizadorPage from './features/cotizador/CotizadorPage';
import AprobacionesPage from './features/aprobaciones/AprobacionesPage';
import EjecucionPage from './features/ejecucion/EjecucionPage';
import GastosPage from './features/gastos/GastosPage';
import DashboardPage from './features/dashboard/DashboardPage';
import CatalogosPage from './features/catalogos/CatalogosPage';

function PrivateRoute({ children, roles }) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  const { isAuthenticated, loadMe } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) loadMe();
  }, []);

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />

      <Route path="/" element={<Navigate to="/cotizador" replace />} />

      <Route path="/cotizador" element={
        <PrivateRoute roles={['ADMIN','AUTORIZADO','VENDEDOR']}>
          <CotizadorPage />
        </PrivateRoute>
      } />
      <Route path="/aprobaciones" element={
        <PrivateRoute roles={['ADMIN','AUTORIZADO']}>
          <AprobacionesPage />
        </PrivateRoute>
      } />
      <Route path="/ejecucion" element={
        <PrivateRoute roles={['ADMIN','AUTORIZADO']}>
          <EjecucionPage />
        </PrivateRoute>
      } />
      <Route path="/gastos" element={
        <PrivateRoute roles={['ADMIN','AUTORIZADO','VENDEDOR']}>
          <GastosPage />
        </PrivateRoute>
      } />
      <Route path="/dashboard" element={
        <PrivateRoute roles={['ADMIN','AUTORIZADO','VENDEDOR']}>
          <DashboardPage />
        </PrivateRoute>
      } />
      <Route path="/catalogos" element={
        <PrivateRoute roles={['ADMIN','AUTORIZADO']}>
          <CatalogosPage />
        </PrivateRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
