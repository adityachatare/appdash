import { Link, NavLink, Outlet } from 'react-router-dom';
import { BellRing, LayoutGrid, LogOut, Smartphone } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/utils';

export function AppShell() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <BellRing className="h-4 w-4" />
            </span>
            <span className="text-base font-semibold tracking-tight">AppDash</span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium', isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50')
              }
            >
              <LayoutGrid className="h-4 w-4" /> Apps
            </NavLink>
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-800">{user?.name}</p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
            <button onClick={logout} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800" title="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}

export function AppIcon({ name, iconUrl, size = 'md' }: { name: string; iconUrl?: string; size?: 'sm' | 'md' | 'lg' }) {
  const dims = { sm: 'h-8 w-8 text-xs rounded-lg', md: 'h-11 w-11 text-sm rounded-xl', lg: 'h-14 w-14 text-base rounded-2xl' }[size];
  if (iconUrl) return <img src={iconUrl} alt={name} className={cn(dims, 'object-cover border border-slate-200')} />;
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <span className={cn(dims, 'flex items-center justify-center bg-gradient-to-br from-brand-500 to-violet-600 font-semibold text-white')}>
      {initials || <Smartphone className="h-4 w-4" />}
    </span>
  );
}
