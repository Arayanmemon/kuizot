import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Badge } from '../../components/ui/badge';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/admin', label: 'Dashboard', icon: '📊', exact: true },
  { path: '/admin/users', label: 'Users', icon: '👥' },
  { path: '/admin/quizzes', label: 'Quizzes', icon: '📝' },
  { path: '/admin/orgs', label: 'Organizations', icon: '🏢' },
  { path: '/admin/subscriptions', label: 'Subscriptions', icon: '💳' },
  { path: '/admin/payments', label: 'Payment Requests', icon: '💰' },
  { path: '/admin/audit-log', label: 'Audit Log', icon: '🔍' },
  { path: '/admin/settings', label: 'Settings', icon: '⚙️' },
];

const PAGE_TITLES: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/users': 'Users',
  '/admin/quizzes': 'Quizzes',
  '/admin/orgs': 'Organizations',
  '/admin/subscriptions': 'Subscriptions',
  '/admin/payments': 'Payment Requests',
  '/admin/audit-log': 'Audit Log',
  '/admin/settings': 'Settings',
};

export const AdminLayout = () => {
  const location = useLocation();
  const { user } = useAuthStore();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('admin-sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('admin-sidebar-collapsed', String(collapsed));
    } catch {
      // ignore storage errors
    }
  }, [collapsed]);

  const pageTitle = PAGE_TITLES[location.pathname] ?? 'Admin';

  const roleBadgeVariant = (role: string) => {
    if (role === 'super_admin') return 'destructive' as const;
    if (role === 'admin') return 'warning' as const;
    return 'default' as const;
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-900">
      {/* Sidebar */}
      <aside
        className={[
          'flex flex-col bg-gray-900 border-r border-gray-700 transition-all duration-200 flex-shrink-0',
          collapsed ? 'w-16' : 'w-64',
        ].join(' ')}
      >
        {/* Sidebar header */}
        <div className="flex items-center h-16 px-3 border-b border-gray-700 gap-2">
          {!collapsed && (
            <span className="text-white font-bold text-sm truncate flex-1">Kuizot Admin</span>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="ml-auto text-gray-400 hover:text-white transition-colors p-1 rounded"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? '→' : '←'}
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white',
                  collapsed ? 'justify-center' : '',
                ].join(' ')
              }
              title={collapsed ? item.label : undefined}
            >
              <span className="text-base flex-shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between bg-gray-800 border-b border-gray-700 px-6 py-4 h-16 flex-shrink-0">
          <h1 className="text-white font-semibold text-lg">{pageTitle}</h1>
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-gray-300 text-sm">{user.username}</span>
              <Badge variant={roleBadgeVariant(user.role)}>
                {user.role.replace('_', ' ')}
              </Badge>
            </div>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
