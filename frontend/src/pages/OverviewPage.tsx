import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, CheckCircle2, Send, Smartphone, XCircle } from 'lucide-react';
import { Apps, errorMessage, type Overview } from '../lib/api';
import { formatNumber, timeAgo, truncate } from '../lib/utils';
import { useApp } from './AppLayout';
import { Alert, Badge, Card, Spinner, StatTile, StatusBadge } from '../components/ui';

export function OverviewPage() {
  const { app } = useApp();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Apps.overview(app.id).then(setData).catch((err) => setError(errorMessage(err)));
  }, [app.id]);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Spinner />;

  const maxBar = Math.max(1, ...data.timeline.map((t) => t.success + t.failure));
  const platforms = Object.entries(data.devicesByPlatform);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Active devices" value={formatNumber(app.stats.activeDevices)} sub={`${formatNumber(app.stats.devices)} registered in total`} icon={<Smartphone className="h-4 w-4" />} />
        <StatTile label="Campaigns" value={formatNumber(data.totals.campaigns)} icon={<BellRing className="h-4 w-4" />} />
        <StatTile label="Delivered" value={formatNumber(data.totals.sent)} sub="Accepted by FCM" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatTile label="Failed" value={formatNumber(data.totals.failed)} sub="Rejected by FCM" icon={<XCircle className="h-4 w-4" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Deliveries, last 30 days" className="lg:col-span-2">
          {data.timeline.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">Nothing sent in the last 30 days.</p>
          ) : (
            <div className="flex h-44 items-end gap-1">
              {data.timeline.map((t) => {
                const total = t.success + t.failure;
                return (
                  <div key={t.date} className="group relative flex flex-1 flex-col justify-end" title={`${t.date}: ${t.success} delivered, ${t.failure} failed`}>
                    <div className="w-full rounded-t bg-rose-300" style={{ height: `${(t.failure / maxBar) * 100}%` }} />
                    <div className="w-full bg-brand-500" style={{ height: `${(t.success / maxBar) * 100}%` }} />
                    <span className="mt-1 truncate text-center text-[10px] text-slate-400">{t.date.slice(5)}</span>
                    <span className="sr-only">{total}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-3 flex gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand-500" /> Delivered</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose-300" /> Failed</span>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Devices by platform">
            {platforms.length === 0 ? (
              <p className="text-sm text-slate-500">No active devices yet.</p>
            ) : (
              <ul className="space-y-2">
                {platforms.map(([p, n]) => (
                  <li key={p} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-slate-700">{p}</span>
                    <span className="font-semibold">{formatNumber(n)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Top tags">
            {data.tags.length === 0 ? (
              <p className="text-sm text-slate-500">Devices have no tags yet. Tags let you target segments.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {data.tags.map((t) => (
                  <Badge key={t.tag} color="brand">
                    {t.tag} · {t.count}
                  </Badge>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Card
        title="Recent notifications"
        action={
          <Link to={`/apps/${app.id}/notifications`} className="text-sm font-medium text-brand-600 hover:underline">
            View all
          </Link>
        }
      >
        {data.recentNotifications.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm text-slate-500">No notifications yet.</p>
            <Link to={`/apps/${app.id}/notifications/new`} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
              <Send className="h-3.5 w-3.5" /> Compose your first one
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.recentNotifications.map((n) => (
              <li key={n._id}>
                <Link to={`/apps/${app.id}/notifications/${n._id}`} className="flex items-center justify-between gap-4 py-3 hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{n.title}</p>
                    <p className="truncate text-xs text-slate-500">{truncate(n.body, 90)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-xs text-slate-500">
                    {n.ai?.generated && <Badge color="violet">AI</Badge>}
                    <StatusBadge status={n.status} />
                    <span>{timeAgo(n.sentAt || n.createdAt)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
