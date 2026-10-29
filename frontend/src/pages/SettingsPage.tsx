import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, KeyRound, RefreshCw, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { Apps, errorMessage, type AppItem } from '../lib/api';
import { formatDate } from '../lib/utils';
import { useApp } from './AppLayout';
import { Alert, Button, Card, Field, Input, Select, Textarea } from '../components/ui';

export function SettingsPage() {
  const { app, refresh } = useApp();
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <GeneralSettings app={app} refresh={refresh} />
        <AiSettings app={app} refresh={refresh} />
        <DangerZone app={app} />
      </div>
      <div className="space-y-6">
        <FirebaseSettings app={app} refresh={refresh} />
        <SdkIntegration app={app} refresh={refresh} />
      </div>
    </div>
  );
}

function GeneralSettings({ app, refresh }: { app: AppItem; refresh: () => Promise<void> }) {
  const [form, setForm] = useState({ name: app.name, packageName: app.packageName, platform: app.platform, description: app.description, playStoreUrl: app.playStoreUrl, iconUrl: app.iconUrl });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await Apps.update(app.id, form as Partial<AppItem>);
      await refresh();
      setMsg({ kind: 'success', text: 'Saved' });
    } catch (err) {
      setMsg({ kind: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="General">
      <form onSubmit={submit} className="space-y-4">
        {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
        <Field label="App name"><Input value={form.name} onChange={set('name')} required /></Field>
        <Field label="Package name"><Input value={form.packageName} onChange={set('packageName')} required /></Field>
        <Field label="Platform">
          <Select value={form.platform} onChange={set('platform')}>
            <option value="android">Android</option>
            <option value="ios">iOS</option>
            <option value="both">Android + iOS</option>
          </Select>
        </Field>
        <Field label="Description" hint="The AI composer reads this to understand your app."><Textarea value={form.description} onChange={set('description')} /></Field>
        <Field label="Play Store URL"><Input value={form.playStoreUrl} onChange={set('playStoreUrl')} /></Field>
        <Field label="Icon URL"><Input value={form.iconUrl} onChange={set('iconUrl')} /></Field>
        <div className="flex justify-end"><Button type="submit" loading={busy}>Save changes</Button></div>
      </form>
    </Card>
  );
}

function AiSettings({ app, refresh }: { app: AppItem; refresh: () => Promise<void> }) {
  const [form, setForm] = useState({ audience: app.aiContext?.audience || '', tone: app.aiContext?.tone || 'friendly', brandVoice: app.aiContext?.brandVoice || '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await Apps.update(app.id, { aiContext: form });
      await refresh();
      setMsg({ kind: 'success', text: 'Saved' });
    } catch (err) {
      setMsg({ kind: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="AI composer defaults">
      <form onSubmit={submit} className="space-y-4">
        {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
        <Field label="Default audience" hint="e.g. Indian college students who use the app for exam prep"><Input value={form.audience} onChange={set('audience')} /></Field>
        <Field label="Default tone">
          <Select value={form.tone} onChange={set('tone')}>
            {['friendly', 'playful', 'urgent', 'professional', 'minimal', 'exciting'].map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Brand voice" hint="Words to use or avoid, how formal to be, emoji policy, etc."><Textarea value={form.brandVoice} onChange={set('brandVoice')} /></Field>
        <div className="flex justify-end"><Button type="submit" loading={busy}>Save</Button></div>
      </form>
    </Card>
  );
}

function FirebaseSettings({ app, refresh }: { app: AppItem; refresh: () => Promise<void> }) {
  const [json, setJson] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setJson(await file.text());
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await Apps.setFcm(app.id, json);
      await refresh();
      setJson('');
      setMsg({ kind: 'success', text: 'Firebase connected. Credentials were verified with Google and stored encrypted.' });
    } catch (err) {
      setMsg({ kind: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    if (!confirm('Disconnect Firebase? You will not be able to send notifications until you upload a new service account.')) return;
    setBusy(true);
    try {
      await Apps.clearFcm(app.id);
      await refresh();
    } catch (err) {
      setMsg({ kind: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Firebase Cloud Messaging" action={app.fcm.configured ? <span className="flex items-center gap-1 text-xs font-medium text-emerald-700"><ShieldCheck className="h-3.5 w-3.5" /> Connected</span> : <span className="text-xs font-medium text-amber-700">Not connected</span>}>
      <div className="space-y-4">
        {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
        {app.fcm.configured && (
          <dl className="grid grid-cols-3 gap-y-2 rounded-lg bg-slate-50 p-3 text-sm">
            <dt className="text-slate-500">Project</dt><dd className="col-span-2 font-mono text-xs">{app.fcm.projectId}</dd>
            <dt className="text-slate-500">Service account</dt><dd className="col-span-2 truncate font-mono text-xs">{app.fcm.clientEmail}</dd>
            <dt className="text-slate-500">Configured</dt><dd className="col-span-2">{formatDate(app.fcm.configuredAt)}</dd>
          </dl>
        )}
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>Open the Firebase console for this app's project.</li>
          <li>Project settings → Service accounts → <em>Generate new private key</em>.</li>
          <li>Upload the downloaded JSON file here. The private key is encrypted before it is stored.</li>
        </ol>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600 hover:bg-slate-100">
          <Upload className="h-4 w-4" /> {json ? 'File loaded, click Save to verify' : 'Choose service-account JSON'}
          <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <Textarea className="font-mono text-xs" placeholder="…or paste the JSON here" value={json} onChange={(e) => setJson(e.target.value)} />
        <div className="flex justify-between">
          {app.fcm.configured ? (
            <Button variant="ghost" onClick={clear} disabled={busy}><Trash2 className="h-4 w-4" /> Disconnect</Button>
          ) : <span />}
          <Button onClick={save} loading={busy} disabled={!json.trim()}>{app.fcm.configured ? 'Replace credentials' : 'Save & verify'}</Button>
        </div>
      </div>
    </Card>
  );
}

function SdkIntegration({ app, refresh }: { app: AppItem; refresh: () => Promise<void> }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const base = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');

  async function copy() {
    await navigator.clipboard.writeText(app.sdkApiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function rotate() {
    if (!confirm('Rotate the SDK key? Apps using the old key will stop registering devices until updated.')) return;
    setBusy(true);
    try {
      await Apps.rotateKey(app.id);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const kotlin = `// After obtaining the FCM token (FirebaseMessaging.getInstance().token)
val body = JSONObject().apply {
    put("token", fcmToken)
    put("platform", "android")
    put("deviceId", Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID))
    put("externalUserId", currentUserId ?: "")
    put("appVersion", BuildConfig.VERSION_NAME)
    put("osVersion", Build.VERSION.RELEASE)
    put("model", Build.MODEL)
    put("locale", Locale.getDefault().toLanguageTag())
    put("timezone", TimeZone.getDefault().id)
    put("tags", JSONArray(listOf("free-tier")))
}
val request = Request.Builder()
    .url("${base}/sdk/devices/register")
    .header("x-api-key", "${app.sdkApiKey}")
    .post(body.toString().toRequestBody("application/json".toMediaType()))
    .build()
OkHttpClient().newCall(request).enqueue(/* ... */)`;

  return (
    <Card title="Mobile SDK integration">
      <div className="space-y-4 text-sm">
        <p className="text-slate-600">Your app registers each device's FCM token with this portal. Call the endpoint on every launch and whenever the token refreshes.</p>
        <Field label="SDK API key">
          <div className="flex gap-2">
            <Input readOnly value={app.sdkApiKey} className="font-mono text-xs" />
            <Button variant="secondary" onClick={copy} title="Copy">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
            <Button variant="secondary" onClick={rotate} loading={busy} title="Rotate"><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </Field>
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 font-medium text-slate-700"><KeyRound className="h-4 w-4" /> Endpoints</p>
          <ul className="space-y-1 font-mono text-xs text-slate-700">
            <li><span className="text-emerald-700">POST</span> {base}/sdk/devices/register</li>
            <li><span className="text-emerald-700">POST</span> {base}/sdk/devices/unregister</li>
            <li><span className="text-emerald-700">POST</span> {base}/sdk/devices/tags</li>
          </ul>
          <p className="mt-1 text-xs text-slate-500">All require header <code>x-api-key</code>.</p>
        </div>
        <div>
          <p className="mb-1.5 font-medium text-slate-700">Android (Kotlin + OkHttp)</p>
          <pre className="max-h-72 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">{kotlin}</pre>
        </div>
      </div>
    </Card>
  );
}

function DangerZone({ app }: { app: AppItem }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (!confirm(`Delete "${app.name}" along with all its devices and notification history? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await Apps.remove(app.id);
      navigate('/');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card title="Danger zone">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-600">Permanently delete this app, its registered devices and every notification.</p>
        <Button variant="danger" onClick={remove} loading={busy}><Trash2 className="h-4 w-4" /> Delete app</Button>
      </div>
    </Card>
  );
}
