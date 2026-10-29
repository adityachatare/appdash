import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Copy, PenSquare, Send, Sparkles, XCircle } from 'lucide-react';
import { Notifications, errorMessage, type Notification } from '../lib/api';
import { formatDate, formatNumber } from '../lib/utils';
import { useApp } from './AppLayout';
import { Alert, Badge, Button, Card, Spinner, StatTile, StatusBadge } from '../components/ui';
import { PhonePreview } from '../components/PhonePreview';

export function NotificationDetailPage() {
  const { app, refresh } = useApp();
  const { notificationId = '' } = useParams();
  const navigate = useNavigate();
  const [n, setN] = useState<Notification | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setN(await Notifications.get(app.id, notificationId));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [app.id, notificationId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (n?.status !== 'sending') return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [n?.status, load]);

  async function act(action: 'send' | 'cancel' | 'duplicate') {
    if (!n) return;
    if (action === 'send' && !confirm(`Send "${n.title}" now?`)) return;
    setBusy(true);
    setError('');
    try {
      if (action === 'send') setN(await Notifications.sendNow(app.id, n._id));
      if (action === 'cancel') setN(await Notifications.cancel(app.id, n._id));
      if (action === 'duplicate') {
        const copy = await Notifications.duplicate(app.id, n._id);
        navigate(`/apps/${app.id}/notifications/${copy._id}/edit`);
        return;
      }
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (error && !n) return <Alert>{error}</Alert>;
  if (!n) return <Spinner />;

  const data = Object.entries(n.data || {});
  const successRate = n.stats.targeted ? Math.round((n.stats.success / n.stats.targeted) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to={`/apps/${app.id}/notifications`} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ChevronLeft className="h-4 w-4" /> All notifications
        </Link>
        <div className="flex items-center gap-2">
          {['draft', 'scheduled', 'failed'].includes(n.status) && (
            <>
              <Link to={`/apps/${app.id}/notifications/${n._id}/edit`}>
                <Button variant="secondary"><PenSquare className="h-4 w-4" /> Edit</Button>
              </Link>
              <Button onClick={() => act('send')} loading={busy}><Send className="h-4 w-4" /> Send now</Button>
            </>
          )}
          {n.status === 'scheduled' && (
            <Button variant="secondary" onClick={() => act('cancel')} loading={busy}><XCircle className="h-4 w-4" /> Cancel</Button>
          )}
          <Button variant="secondary" onClick={() => act('duplicate')} loading={busy}><Copy className="h-4 w-4" /> Duplicate</Button>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold text-slate-900">{n.title}</h2>
                  {n.ai?.generated && <Badge color="violet"><Sparkles className="mr-1 h-3 w-3" />AI</Badge>}
                </div>
                <p className="mt-2 text-slate-700">{n.body}</p>
              </div>
              <StatusBadge status={n.status} />
            </div>
            <dl className="mt-6 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Row label="Target" value={describeTarget(n)} />
              <Row label="Created" value={formatDate(n.createdAt)} />
              {n.scheduledAt && <Row label="Scheduled for" value={formatDate(n.scheduledAt)} />}
              {n.sentAt && <Row label="Sent" value={formatDate(n.sentAt)} />}
              {n.deepLink && <Row label="Deep link" value={<code className="font-mono text-xs">{n.deepLink}</code>} />}
              {n.imageUrl && <Row label="Image" value={<a className="text-brand-600 hover:underline" href={n.imageUrl} target="_blank" rel="noreferrer">{n.imageUrl}</a>} />}
              {n.ai?.generated && n.ai.prompt && <Row label="AI prompt" value={n.ai.prompt} />}
              {n.ai?.model && <Row label="AI model" value={<code className="font-mono text-xs">{n.ai.model}</code>} />}
            </dl>
            {data.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Custom data</p>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {data.map(([k, v]) => (
                      <tr key={k}>
                        <td className="py-1.5 pr-4 font-mono text-xs text-slate-600">{k}</td>
                        <td className="py-1.5 font-mono text-xs text-slate-800">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {n.error && (
              <div className="mt-5">
                <Alert kind={n.status === 'partial' ? 'warn' : 'error'}>{n.error}</Alert>
              </div>
            )}
          </Card>

          {['sent', 'partial', 'failed', 'sending'].includes(n.status) && (
            <div className="grid gap-4 sm:grid-cols-4">
              <StatTile label="Targeted" value={formatNumber(n.stats.targeted)} />
              <StatTile label="Delivered" value={formatNumber(n.stats.success)} sub={`${successRate}% of targeted`} />
              <StatTile label="Failed" value={formatNumber(n.stats.failure)} />
              <StatTile label="Tokens pruned" value={formatNumber(n.stats.invalidTokensRemoved)} sub="Stale tokens deactivated" />
            </div>
          )}
        </div>

        <div>
          <PhonePreview appName={app.name} iconUrl={app.iconUrl} title={n.title} body={n.body} imageUrl={n.imageUrl} />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-slate-800">{value}</dd>
    </div>
  );
}

function describeTarget(n: Notification) {
  const t = n.target;
  switch (t?.type) {
    case 'tags':
      return `Devices tagged ${(t.tags || []).join(', ')}`;
    case 'platform':
      return `All ${t.platform} devices`;
    case 'tokens':
      return `${t.tokens?.length || 0} specific token(s)`;
    case 'users':
      return `Users: ${(t.externalUserIds || []).join(', ')}`;
    default:
      return 'All active devices';
  }
}
