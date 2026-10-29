import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Plus, Search, Smartphone, Trash2 } from 'lucide-react';
import { Devices, errorMessage, type Device } from '../lib/api';
import { formatNumber, timeAgo } from '../lib/utils';
import { useApp } from './AppLayout';
import { Alert, Badge, Button, EmptyState, Field, Input, Modal, Select, Spinner } from '../components/ui';

export function DevicesPage() {
  const { app, refresh } = useApp();
  const [data, setData] = useState<{ devices: Device[]; total: number; pages: number } | null>(null);
  const [q, setQ] = useState('');
  const [platform, setPlatform] = useState('');
  const [active, setActive] = useState('true');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await Devices.list(app.id, { q: q || undefined, platform: platform || undefined, active, page, limit: 25 }));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [app.id, q, platform, active, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function remove(d: Device) {
    if (!confirm('Remove this device token? The device can re-register on next app launch.')) return;
    try {
      await Devices.remove(app.id, d._id);
      await load();
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Search user id, device id, model, token" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
        <Select className="w-36" value={platform} onChange={(e) => { setPlatform(e.target.value); setPage(1); }}>
          <option value="">All platforms</option>
          <option value="android">Android</option>
          <option value="ios">iOS</option>
          <option value="web">Web</option>
        </Select>
        <Select className="w-36" value={active} onChange={(e) => { setActive(e.target.value); setPage(1); }}>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
          <option value="">All</option>
        </Select>
        <Button variant="secondary" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Add token manually
        </Button>
      </div>

      {error && <Alert>{error}</Alert>}

      {!data ? (
        <Spinner />
      ) : data.devices.length === 0 ? (
        <EmptyState
          icon={<Smartphone className="h-10 w-10" />}
          title="No devices found"
          description="Devices appear here once your app registers FCM tokens through the SDK endpoint. See Settings for the integration snippet."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Device</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">Tags</th>
                <th className="px-4 py-3">Last seen</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.devices.map((d) => (
                <tr key={d._id} className={d.active ? '' : 'opacity-60'}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{d.model || d.deviceId || 'Unknown device'}</p>
                    <p className="font-mono text-[11px] text-slate-400" title={d.token}>
                      {d.token.slice(0, 18)}…{d.token.slice(-6)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{d.externalUserId || <span className="text-slate-400">anonymous</span>}</td>
                  <td className="px-4 py-3">
                    <span className="capitalize">{d.platform}</span>
                    {d.appVersion && <span className="ml-1 text-xs text-slate-400">v{d.appVersion}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {d.tags.length ? d.tags.map((t) => <Badge key={t}>{t}</Badge>) : <span className="text-slate-400">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {timeAgo(d.lastSeenAt)}
                    {!d.active && <Badge color="red">inactive</Badge>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => remove(d)} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Remove">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>{formatNumber(data.total)} devices</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span>
                Page {page} of {Math.max(1, data.pages)}
              </span>
              <Button size="sm" variant="secondary" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      <AddDeviceModal open={addOpen} onClose={() => setAddOpen(false)} onAdded={async () => { await load(); await refresh(); }} />
    </div>
  );
}

function AddDeviceModal({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
  const { app } = useApp();
  const [token, setToken] = useState('');
  const [platform, setPlatform] = useState('android');
  const [tags, setTags] = useState('');
  const [userId, setUserId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await Devices.add(app.id, {
        token: token.trim(),
        platform,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        externalUserId: userId.trim(),
      });
      setToken('');
      setTags('');
      setUserId('');
      onAdded();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a device token">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-500">Useful for testing: paste an FCM registration token from a debug build of your app.</p>
        {error && <Alert>{error}</Alert>}
        <Field label="FCM token">
          <Input value={token} onChange={(e) => setToken(e.target.value)} required className="font-mono text-xs" />
        </Field>
        <Field label="Platform">
          <Select value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="android">Android</option>
            <option value="ios">iOS</option>
            <option value="web">Web</option>
          </Select>
        </Field>
        <Field label="Tags" hint="Comma separated, e.g. beta, premium">
          <Input value={tags} onChange={(e) => setTags(e.target.value)} />
        </Field>
        <Field label="User id (optional)">
          <Input value={userId} onChange={(e) => setUserId(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy}>Add device</Button>
        </div>
      </form>
    </Modal>
  );
}
