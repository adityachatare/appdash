import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, Copy, PenSquare, Send, Trash2, XCircle } from 'lucide-react';
import { Notifications, errorMessage, type Notification } from '../lib/api';
import { formatDate, formatNumber, truncate } from '../lib/utils';
import { useApp } from './AppLayout';
import { Alert, Badge, Button, EmptyState, Select, Spinner, StatusBadge } from '../components/ui';

function describeTarget(n: Notification) {
  const t = n.target;
  switch (t?.type) {
    case 'tags':
      return `Tags: ${(t.tags || []).join(', ') || '—'}`;
    case 'platform':
      return `Platform: ${t.platform || '—'}`;
    case 'tokens':
      return `${t.tokens?.length || 0} token(s)`;
    case 'users':
      return `${t.externalUserIds?.length || 0} user(s)`;
    default:
      return 'All devices';
  }
}

export function NotificationsPage() {
  const { app, refresh } = useApp();
  const [data, setData] = useState<{ notifications: Notification[]; total: number; pages: number } | null>(null);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await Notifications.list(app.id, { status: status || undefined, page, limit: 20 }));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [app.id, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh while something is sending.
  useEffect(() => {
    if (!data?.notifications.some((n) => n.status === 'sending')) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [data, load]);

  async function act(n: Notification, action: 'send' | 'cancel' | 'duplicate' | 'delete') {
    if (action === 'send' && !confirm(`Send "${n.title}" to ${describeTarget(n).toLowerCase()} now?`)) return;
    if (action === 'delete' && !confirm('Delete this notification? This cannot be undone.')) return;
    setBusyId(n._id);
    setError('');
    try {
      if (action === 'send') await Notifications.sendNow(app.id, n._id);
      if (action === 'cancel') await Notifications.cancel(app.id, n._id);
      if (action === 'duplicate') await Notifications.duplicate(app.id, n._id);
      if (action === 'delete') await Notifications.remove(app.id, n._id);
      await load();
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select className="w-44" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {['draft', 'scheduled', 'sending', 'sent', 'partial', 'failed', 'cancelled'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
        <Link to={`/apps/${app.id}/notifications/new`}>
          <Button>
            <PenSquare className="h-4 w-4" /> New notification
          </Button>
        </Link>
      </div>

      {error && <Alert>{error}</Alert>}

      {!data ? (
        <Spinner />
      ) : data.notifications.length === 0 ? (
        <EmptyState
          icon={<BellRing className="h-10 w-10" />}
          title="No notifications yet"
          description="Compose one by hand or let AI draft a few variants for you."
          action={
            <Link to={`/apps/${app.id}/notifications/new`}>
              <Button>
                <PenSquare className="h-4 w-4" /> Compose
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <ul className="divide-y divide-slate-100">
            {data.notifications.map((n) => (
              <li key={n._id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <Link to={`/apps/${app.id}/notifications/${n._id}`} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-slate-900 hover:text-brand-700">{n.title}</p>
                    {n.ai?.generated && <Badge color="violet">AI</Badge>}
                  </div>
                  <p className="truncate text-sm text-slate-500">{truncate(n.body, 120)}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {describeTarget(n)} ·{' '}
                    {n.status === 'scheduled'
                      ? `Scheduled for ${formatDate(n.scheduledAt)}`
                      : n.sentAt
                        ? `Sent ${formatDate(n.sentAt)}`
                        : `Created ${formatDate(n.createdAt)}`}
                  </p>
                </Link>
                <div className="flex items-center gap-4">
                  {['sent', 'partial', 'failed'].includes(n.status) && (
                    <div className="text-right text-xs text-slate-500">
                      <p>
                        <span className="font-semibold text-emerald-700">{formatNumber(n.stats.success)}</span> delivered
                      </p>
                      <p>
                        <span className="font-semibold text-rose-700">{formatNumber(n.stats.failure)}</span> failed
                      </p>
                    </div>
                  )}
                  <StatusBadge status={n.status} />
                  <div className="flex items-center gap-1">
                    {['draft', 'scheduled', 'failed'].includes(n.status) && (
                      <>
                        <Link to={`/apps/${app.id}/notifications/${n._id}/edit`} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Edit">
                          <PenSquare className="h-4 w-4" />
                        </Link>
                        <button onClick={() => act(n, 'send')} disabled={busyId === n._id} className="rounded p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-700" title="Send now">
                          <Send className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {n.status === 'scheduled' && (
                      <button onClick={() => act(n, 'cancel')} disabled={busyId === n._id} className="rounded p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-700" title="Cancel schedule">
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={() => act(n, 'duplicate')} disabled={busyId === n._id} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Duplicate as draft">
                      <Copy className="h-4 w-4" />
                    </button>
                    {n.status !== 'sending' && (
                      <button onClick={() => act(n, 'delete')} disabled={busyId === n._id} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
            <span>{formatNumber(data.total)} notifications</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span>Page {page} of {Math.max(1, data.pages)}</span>
              <Button size="sm" variant="secondary" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
