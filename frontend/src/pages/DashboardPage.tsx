import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, CheckCircle2, Plus, Smartphone, XCircle } from 'lucide-react';
import { Apps, errorMessage, type AppItem } from '../lib/api';
import { formatNumber, timeAgo } from '../lib/utils';
import { Alert, Button, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, StatTile, Textarea } from '../components/ui';
import { AppIcon } from '../components/Layout';

export function DashboardPage() {
  const [apps, setApps] = useState<AppItem[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  async function load() {
    try {
      setApps(await Apps.list());
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  useEffect(() => {
    load();
  }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!apps) return <Spinner />;

  const totals = apps.reduce(
    (acc, a) => ({ devices: acc.devices + a.stats.activeDevices, notifications: acc.notifications + a.stats.notifications }),
    { devices: 0, notifications: 0 }
  );

  return (
    <div>
      <PageHeader
        title="Your apps"
        subtitle="Everything you have live on the Play Store, in one place."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add app
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Apps" value={apps.length} icon={<Smartphone className="h-4 w-4" />} />
        <StatTile label="Active devices" value={formatNumber(totals.devices)} icon={<Smartphone className="h-4 w-4" />} />
        <StatTile label="Campaigns" value={formatNumber(totals.notifications)} icon={<BellRing className="h-4 w-4" />} />
      </div>

      {apps.length === 0 ? (
        <EmptyState
          icon={<Smartphone className="h-10 w-10" />}
          title="No apps yet"
          description="Add your first app to start collecting device tokens and sending push notifications."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Add app
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <Link
              key={app.id}
              to={`/apps/${app.id}`}
              className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <AppIcon name={app.name} iconUrl={app.iconUrl} />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-slate-900 group-hover:text-brand-700">{app.name}</h3>
                  <p className="truncate font-mono text-xs text-slate-500">{app.packageName}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Active devices</p>
                  <p className="font-semibold">{formatNumber(app.stats.activeDevices)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Campaigns</p>
                  <p className="font-semibold">{formatNumber(app.stats.notifications)}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs">
                <span className={app.fcm.configured ? 'flex items-center gap-1 text-emerald-700' : 'flex items-center gap-1 text-amber-700'}>
                  {app.fcm.configured ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                  {app.fcm.configured ? 'FCM connected' : 'FCM not configured'}
                </span>
                <span className="text-slate-500">Last send {timeAgo(app.stats.lastSentAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <CreateAppModal open={open} onClose={() => setOpen(false)} onCreated={load} />
    </div>
  );
}

function CreateAppModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', packageName: '', platform: 'android', description: '', playStoreUrl: '', iconUrl: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await Apps.create(form as Partial<AppItem>);
      setForm({ name: '', packageName: '', platform: 'android', description: '', playStoreUrl: '', iconUrl: '' });
      onCreated();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add an app">
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label="App name">
          <Input value={form.name} onChange={set('name')} required placeholder="My Awesome App" />
        </Field>
        <Field label="Package name" hint="As on the Play Store, e.g. com.company.app">
          <Input value={form.packageName} onChange={set('packageName')} required placeholder="com.company.app" />
        </Field>
        <Field label="Platform">
          <Select value={form.platform} onChange={set('platform')}>
            <option value="android">Android</option>
            <option value="ios">iOS</option>
            <option value="both">Android + iOS</option>
          </Select>
        </Field>
        <Field label="Description" hint="Used by the AI composer to understand what your app does.">
          <Textarea value={form.description} onChange={set('description')} placeholder="A fitness tracker that..." />
        </Field>
        <Field label="Play Store URL">
          <Input value={form.playStoreUrl} onChange={set('playStoreUrl')} placeholder="https://play.google.com/store/apps/details?id=..." />
        </Field>
        <Field label="Icon URL">
          <Input value={form.iconUrl} onChange={set('iconUrl')} placeholder="https://..." />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Create app
          </Button>
        </div>
      </form>
    </Modal>
  );
}
