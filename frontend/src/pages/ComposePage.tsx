import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Calendar, ChevronLeft, Plus, Save, Send, Sparkles, Trash2, Wand2, X } from 'lucide-react';
import { AI, Notifications, errorMessage, type AiGeneration, type AiVariant, type NotificationDraft, type Target, type TargetType } from '../lib/api';
import { cn, formatNumber, toLocalInputValue } from '../lib/utils';
import { useApp } from './AppLayout';
import { Alert, Badge, Button, Card, Field, Input, Modal, Select, Spinner, Textarea } from '../components/ui';
import { PhonePreview } from '../components/PhonePreview';

interface FormState {
  title: string;
  body: string;
  imageUrl: string;
  deepLink: string;
  data: { key: string; value: string }[];
  targetType: TargetType;
  tags: string;
  platform: 'android' | 'ios' | 'web' | '';
  tokens: string;
  users: string;
  scheduledAt: string;
  ai: { generated: boolean; prompt: string; model: string };
}

const empty: FormState = {
  title: '',
  body: '',
  imageUrl: '',
  deepLink: '',
  data: [],
  targetType: 'all',
  tags: '',
  platform: '',
  tokens: '',
  users: '',
  scheduledAt: '',
  ai: { generated: false, prompt: '', model: '' },
};

const splitList = (s: string) => s.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);

function toTarget(f: FormState): Target {
  switch (f.targetType) {
    case 'tags':
      return { type: 'tags', tags: splitList(f.tags) };
    case 'platform':
      return { type: 'platform', platform: f.platform };
    case 'tokens':
      return { type: 'tokens', tokens: splitList(f.tokens) };
    case 'users':
      return { type: 'users', externalUserIds: splitList(f.users) };
    default:
      return { type: 'all' };
  }
}

export function ComposePage() {
  const { app, refresh } = useApp();
  const { notificationId } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(notificationId);

  const [form, setForm] = useState<FormState>(empty);
  const [loaded, setLoaded] = useState(!editing);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'' | 'draft' | 'send' | 'schedule'>('');
  const [reach, setReach] = useState<number | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(true);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!notificationId) return;
    Notifications.get(app.id, notificationId)
      .then((n) => {
        setForm({
          title: n.title,
          body: n.body,
          imageUrl: n.imageUrl || '',
          deepLink: n.deepLink || '',
          data: Object.entries(n.data || {}).map(([key, value]) => ({ key, value })),
          targetType: n.target?.type || 'all',
          tags: (n.target?.tags || []).join(', '),
          platform: n.target?.platform || '',
          tokens: (n.target?.tokens || []).join('\n'),
          users: (n.target?.externalUserIds || []).join(', '),
          scheduledAt: n.scheduledAt ? toLocalInputValue(new Date(n.scheduledAt)) : '',
          ai: n.ai || empty.ai,
        });
        setLoaded(true);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [app.id, notificationId]);

  const target = useMemo(() => toTarget(form), [form]);

  useEffect(() => {
    const t = setTimeout(() => {
      Notifications.estimate(app.id, target).then(setReach).catch(() => setReach(null));
    }, 300);
    return () => clearTimeout(t);
  }, [app.id, target]);

  const buildDraft = useCallback(
    (mode: 'draft' | 'send' | 'schedule'): NotificationDraft => ({
      title: form.title.trim(),
      body: form.body.trim(),
      imageUrl: form.imageUrl.trim(),
      deepLink: form.deepLink.trim(),
      data: Object.fromEntries(form.data.filter((d) => d.key.trim()).map((d) => [d.key.trim(), d.value])),
      target,
      ai: form.ai,
      mode,
      scheduledAt: mode === 'schedule' ? new Date(form.scheduledAt).toISOString() : null,
    }),
    [form, target]
  );

  async function submit(mode: 'draft' | 'send' | 'schedule') {
    if (!form.title.trim() || !form.body.trim()) {
      setError('Title and body are required');
      return;
    }
    if (mode === 'schedule' && !form.scheduledAt) {
      setError('Choose a date and time to schedule');
      return;
    }
    if (mode === 'send' && !confirm(`Send to ${reach ?? '?'} device(s) now?`)) return;

    setBusy(mode);
    setError('');
    try {
      const draft = buildDraft(mode);
      let saved;
      if (editing && notificationId) {
        saved = await Notifications.update(app.id, notificationId, draft);
        if (mode === 'send') saved = await Notifications.sendNow(app.id, saved._id);
      } else {
        saved = await Notifications.create(app.id, draft);
      }
      await refresh();
      navigate(`/apps/${app.id}/notifications/${saved._id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy('');
    }
  }

  function applyVariant(v: AiVariant, prompt: string, model: string) {
    setForm((f) => ({
      ...f,
      title: v.emoji && !v.title.includes(v.emoji) ? `${v.emoji} ${v.title}`.slice(0, 50) : v.title,
      body: v.body,
      deepLink: f.deepLink || v.deepLink || '',
      ai: { generated: true, prompt, model },
    }));
  }

  if (!loaded) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to={`/apps/${app.id}/notifications`} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ChevronLeft className="h-4 w-4" /> All notifications
        </Link>
        <h2 className="text-lg font-semibold">{editing ? 'Edit notification' : 'New notification'}</h2>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          {/* AI assistant */}
          <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50 shadow-sm">
            <button onClick={() => setAiOpen((o) => !o)} className="flex w-full items-center justify-between px-5 py-3.5 text-left">
              <span className="flex items-center gap-2 text-sm font-semibold text-violet-900">
                <Sparkles className="h-4 w-4 text-violet-600" /> Generate with AI
              </span>
              <span className="text-xs text-violet-700">{aiOpen ? 'Hide' : 'Show'}</span>
            </button>
            {aiOpen && (
              <div className="border-t border-violet-200/60 px-5 py-4">
                <AiPanel onPick={applyVariant} current={{ title: form.title, body: form.body }} onRefined={(t, b, model) => setForm((f) => ({ ...f, title: t, body: b, ai: { ...f.ai, generated: true, model } }))} />
              </div>
            )}
          </div>

          <Card title="Message">
            <div className="space-y-4">
              <Field label="Title" right={<CharCount value={form.title} max={50} />}>
                <Input value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={100} placeholder="Your weekend deal is here" />
              </Field>
              <Field label="Body" right={<CharCount value={form.body} max={150} />}>
                <Textarea value={form.body} onChange={(e) => set('body', e.target.value)} maxLength={500} placeholder="Save 20% on all plans until Sunday. Tap to claim." />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Image URL" hint="Shown as a big picture on Android and iOS">
                  <Input value={form.imageUrl} onChange={(e) => set('imageUrl', e.target.value)} placeholder="https://..." />
                </Field>
                <Field label="Deep link" hint="Delivered in the data payload as deepLink">
                  <Input value={form.deepLink} onChange={(e) => set('deepLink', e.target.value)} placeholder="/offers/weekend" />
                </Field>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Custom data</span>
                  <button type="button" onClick={() => set('data', [...form.data, { key: '', value: '' }])} className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                    <Plus className="h-3 w-3" /> Add key
                  </button>
                </div>
                {form.data.length === 0 ? (
                  <p className="text-xs text-slate-500">Optional key/value pairs your app receives with the notification.</p>
                ) : (
                  <div className="space-y-2">
                    {form.data.map((d, i) => (
                      <div key={i} className="flex gap-2">
                        <Input className="font-mono text-xs" placeholder="key" value={d.key} onChange={(e) => set('data', form.data.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} />
                        <Input className="font-mono text-xs" placeholder="value" value={d.value} onChange={(e) => set('data', form.data.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                        <button type="button" onClick={() => set('data', form.data.filter((_, j) => j !== i))} className="rounded p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>

          <Card title="Audience" action={<Badge color={reach ? 'green' : 'amber'}>{reach === null ? 'Estimating…' : `${formatNumber(reach)} device(s)`}</Badge>}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {(
                  [
                    ['all', 'Everyone'],
                    ['platform', 'Platform'],
                    ['tags', 'Tags'],
                    ['users', 'User ids'],
                    ['tokens', 'Tokens'],
                  ] as [TargetType, string][]
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => set('targetType', k)}
                    className={cn('rounded-lg border px-3 py-2 text-sm font-medium', form.targetType === k ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {form.targetType === 'platform' && (
                <Field label="Platform">
                  <Select value={form.platform} onChange={(e) => set('platform', e.target.value as FormState['platform'])}>
                    <option value="">Choose…</option>
                    <option value="android">Android</option>
                    <option value="ios">iOS</option>
                    <option value="web">Web</option>
                  </Select>
                </Field>
              )}
              {form.targetType === 'tags' && (
                <Field label="Tags" hint="Comma separated. Devices with any of these tags are included.">
                  <Input value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="premium, beta" />
                </Field>
              )}
              {form.targetType === 'users' && (
                <Field label="User ids" hint="Comma or newline separated external user ids your app registered.">
                  <Textarea value={form.users} onChange={(e) => set('users', e.target.value)} />
                </Field>
              )}
              {form.targetType === 'tokens' && (
                <Field label="FCM tokens" hint="One per line.">
                  <Textarea className="font-mono text-xs" value={form.tokens} onChange={(e) => set('tokens', e.target.value)} />
                </Field>
              )}
            </div>
          </Card>

          <Card title="Delivery">
            <div className="flex flex-wrap items-end gap-4">
              <Field label="Schedule (optional)" hint="Local time. Leave empty to send immediately or save as draft.">
                <Input type="datetime-local" value={form.scheduledAt} min={toLocalInputValue(new Date())} onChange={(e) => set('scheduledAt', e.target.value)} className="w-64" />
              </Field>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <Button variant="secondary" onClick={() => setTestOpen(true)} disabled={!form.title || !form.body}>
                Send test
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => submit('draft')} loading={busy === 'draft'}>
                  <Save className="h-4 w-4" /> Save draft
                </Button>
                {form.scheduledAt ? (
                  <Button onClick={() => submit('schedule')} loading={busy === 'schedule'} disabled={!app.fcm.configured}>
                    <Calendar className="h-4 w-4" /> Schedule
                  </Button>
                ) : (
                  <Button onClick={() => submit('send')} loading={busy === 'send'} disabled={!app.fcm.configured}>
                    <Send className="h-4 w-4" /> Send now
                  </Button>
                )}
              </div>
            </div>
            {!app.fcm.configured && <p className="mt-3 text-xs text-amber-700">Connect Firebase in Settings to enable sending.</p>}
          </Card>
        </div>

        <div className="lg:col-span-2">
          <div className="sticky top-20">
            <PhonePreview appName={app.name} iconUrl={app.iconUrl} title={form.title} body={form.body} imageUrl={form.imageUrl} />
          </div>
        </div>
      </div>

      <TestSendModal open={testOpen} onClose={() => setTestOpen(false)} form={form} />
    </div>
  );
}

function CharCount({ value, max }: { value: string; max: number }) {
  const over = value.length > max;
  return <span className={cn('text-xs', over ? 'font-medium text-rose-600' : 'text-slate-400')}>{value.length}/{max}</span>;
}

/* ---------------- AI panel ---------------- */

function AiPanel({
  onPick,
  current,
  onRefined,
}: {
  onPick: (v: AiVariant, prompt: string, model: string) => void;
  current: { title: string; body: string };
  onRefined: (title: string, body: string, model: string) => void;
}) {
  const { app } = useApp();
  const [prompt, setPrompt] = useState('');
  const [tone, setTone] = useState(app.aiContext?.tone || 'friendly');
  const [audience, setAudience] = useState(app.aiContext?.audience || '');
  const [language, setLanguage] = useState('English');
  const [count, setCount] = useState(4);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AiGeneration | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [refineText, setRefineText] = useState('');
  const [refining, setRefining] = useState(false);
  const [refineNote, setRefineNote] = useState('');

  async function generate() {
    if (!prompt.trim()) return;
    setBusy(true);
    setError('');
    setResult(null);
    setPicked(null);
    try {
      setResult(await AI.generate(app.id, { prompt, tone, audience, language, count }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function refine(instruction: string) {
    if (!current.title || !current.body || !instruction.trim()) return;
    setRefining(true);
    setError('');
    setRefineNote('');
    try {
      const r = await AI.refine(app.id, { title: current.title, body: current.body, instruction });
      onRefined(r.title, r.body, result?.model || '');
      setRefineNote(r.changeSummary);
      setRefineText('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRefining(false);
    }
  }

  const quick = ['Make it shorter', 'Add urgency', 'Make it playful', 'More formal', 'Translate to Hindi'];

  return (
    <div className="space-y-4">
      <Field label="What do you want to announce?">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. 20% off annual plans this weekend only, new dark mode feature, remind inactive users to finish onboarding..."
          className="bg-white"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Tone">
          <Select value={tone} onChange={(e) => setTone(e.target.value)} className="bg-white">
            {['friendly', 'playful', 'urgent', 'professional', 'minimal', 'exciting'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Audience">
          <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="all users" className="bg-white" />
        </Field>
        <Field label="Language">
          <Input value={language} onChange={(e) => setLanguage(e.target.value)} className="bg-white" />
        </Field>
        <Field label="Variants">
          <Select value={count} onChange={(e) => setCount(Number(e.target.value))} className="bg-white">
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ai" onClick={generate} loading={busy} disabled={!prompt.trim()}>
          <Sparkles className="h-4 w-4" /> Generate variants
        </Button>
        {result && <span className="text-xs text-violet-700">{result.sendTimeSuggestion}</span>}
      </div>

      {error && <Alert>{error}</Alert>}

      {result && (
        <div className="grid gap-3 sm:grid-cols-2">
          {result.variants.map((v, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setPicked(i);
                onPick(v, prompt, result.model);
              }}
              className={cn(
                'rounded-lg border bg-white p-3 text-left transition hover:border-violet-400 hover:shadow-sm',
                picked === i ? 'border-violet-500 ring-2 ring-violet-500/20' : 'border-slate-200'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">
                  {v.emoji && <span className="mr-1">{v.emoji}</span>}
                  {v.title}
                </p>
                {i === result.bestVariantIndex && <Badge color="violet">Top pick</Badge>}
              </div>
              <p className="mt-1 text-sm text-slate-700">{v.body}</p>
              <p className="mt-2 text-xs text-slate-500">{v.rationale}</p>
            </button>
          ))}
        </div>
      )}

      {current.title && current.body && (
        <div className="rounded-lg border border-violet-200/70 bg-white/70 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-violet-900">
            <Wand2 className="h-3.5 w-3.5" /> Refine the current draft
          </p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {quick.map((q) => (
              <button key={q} type="button" onClick={() => refine(q)} disabled={refining} className="rounded-full border border-violet-200 bg-white px-2.5 py-1 text-xs text-violet-800 hover:bg-violet-50 disabled:opacity-50">
                {q}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={refineText} onChange={(e) => setRefineText(e.target.value)} placeholder="Or describe the change…" className="bg-white" onKeyDown={(e) => e.key === 'Enter' && refine(refineText)} />
            <Button variant="secondary" onClick={() => refine(refineText)} loading={refining} disabled={!refineText.trim()}>
              Apply
            </Button>
          </div>
          {refineNote && <p className="mt-2 text-xs text-emerald-700">{refineNote}</p>}
        </div>
      )}
    </div>
  );
}

/* ---------------- Test send ---------------- */

function TestSendModal({ open, onClose, form }: { open: boolean; onClose: () => void; form: FormState }) {
  const { app } = useApp();
  const [tokens, setTokens] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ success: number; failure: number; errors: Record<string, number> } | null>(null);
  const [error, setError] = useState('');

  async function send() {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await Notifications.sendTest(app.id, { title: form.title, body: form.body, imageUrl: form.imageUrl, deepLink: form.deepLink, tokens: splitList(tokens) }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Send a test">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">Sends the current draft to specific device tokens without creating a campaign record.</p>
        {error && <Alert>{error}</Alert>}
        {result && (
          <Alert kind={result.failure ? 'warn' : 'success'}>
            {result.success} delivered, {result.failure} failed
            {Object.keys(result.errors).length > 0 && (
              <span className="block text-xs">{Object.entries(result.errors).map(([k, v]) => `${k} ×${v}`).join(', ')}</span>
            )}
          </Alert>
        )}
        <Field label="Device tokens" hint="One per line">
          <Textarea className="font-mono text-xs" value={tokens} onChange={(e) => setTokens(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}><X className="h-4 w-4" /> Close</Button>
          <Button onClick={send} loading={busy} disabled={!splitList(tokens).length || !app.fcm.configured}><Send className="h-4 w-4" /> Send test</Button>
        </div>
      </div>
    </Modal>
  );
}
