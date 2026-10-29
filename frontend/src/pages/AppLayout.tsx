import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { ChevronRight, ExternalLink, PenSquare } from 'lucide-react';
import { Apps, errorMessage, type AppItem } from '../lib/api';
import { cn } from '../lib/utils';
import { Alert, Button, Spinner } from '../components/ui';
import { AppIcon } from '../components/Layout';

interface AppCtx {
  app: AppItem;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside AppLayout');
  return ctx;
}

const tabs = [
  { to: '', label: 'Overview', end: true },
  { to: 'notifications', label: 'Notifications' },
  { to: 'devices', label: 'Devices' },
  { to: 'settings', label: 'Settings' },
];

export function AppLayout() {
  const { appId = '' } = useParams();
  const [app, setApp] = useState<AppItem | null>(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setApp(await Apps.get(appId));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [appId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (error) return <Alert>{error}</Alert>;
  if (!app) return <Spinner />;

  return (
    <Ctx.Provider value={{ app, refresh }}>
      <nav className="mb-4 flex items-center gap-1 text-sm text-slate-500">
        <Link to="/" className="hover:text-slate-800">
          Apps
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-slate-800">{app.name}</span>
      </nav>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <AppIcon name={app.name} iconUrl={app.iconUrl} size="lg" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{app.name}</h1>
            <div className="mt-0.5 flex items-center gap-3 text-sm text-slate-500">
              <span className="font-mono text-xs">{app.packageName}</span>
              {app.playStoreUrl && (
                <a href={app.playStoreUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-brand-600 hover:underline">
                  Play Store <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>
        <Link to={`/apps/${app.id}/notifications/new`}>
          <Button>
            <PenSquare className="h-4 w-4" /> New notification
          </Button>
        </Link>
      </div>

      {!app.fcm.configured && (
        <div className="mb-6">
          <Alert kind="warn">
            Firebase is not connected for this app yet. Upload the service account in{' '}
            <Link to={`/apps/${app.id}/settings`} className="font-medium underline">
              Settings
            </Link>{' '}
            before sending notifications.
          </Alert>
        </div>
      )}

      <div className="mb-6 flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <NavLink
            key={t.label}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              cn(
                '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'
              )
            }
          >
            {t.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </Ctx.Provider>
  );
}
