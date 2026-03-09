import { NavLink, useNavigate } from 'react-router-dom';
import useAuthStore from '../features/auth/authStore';

const NAV = [
  { to: '/cotizador',    label: 'Cotizador',        icon: '📝', roles: ['ADMIN','AUTORIZADO','VENDEDOR'] },
  { to: '/aprobaciones', label: 'Aprobaciones',     icon: '✅', roles: ['ADMIN','AUTORIZADO'] },
  { to: '/gastos',       label: 'Gastos Reales',    icon: '💸', roles: ['ADMIN','AUTORIZADO','VENDEDOR'] },
  { to: '/dashboard',    label: 'Dashboard',        icon: '📊', roles: ['ADMIN','AUTORIZADO','VENDEDOR'] },
  { to: '/catalogos',    label: 'Catálogos',        icon: '⚙️', roles: ['ADMIN','AUTORIZADO'] },
];

export default function Layout({ children }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const links = NAV.filter(n => n.roles.includes(user?.role));

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 flex flex-col bg-brand-900 text-white">
        {/* Header sidebar */}
        <div className="px-5 py-6 border-b border-white/10">
          <p className="font-bold text-base leading-tight">Spectrum Media Lab</p>
          <p className="text-brand-300 text-xs mt-0.5">Sistema de Cotizaciones</p>
        </div>

        {/* Usuario */}
        <div className="px-5 py-4 border-b border-white/10">
          <p className="text-sm font-medium">👋 {user?.username}</p>
          <span className="text-xs text-brand-300">Rol: {user?.role}</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {links.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-brand-200 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <span>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-brand-200 hover:bg-white/10 hover:text-white transition-colors"
          >
            <span>🚪</span>
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
