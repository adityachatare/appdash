import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BellRing } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { errorMessage } from '../lib/api';
import { Alert, Button, Field, Input } from '../components/ui';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(name, email, password);
      const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-slate-50 via-brand-50 to-violet-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
            <BellRing className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">AppDash</h1>
          <p className="mt-1 text-sm text-slate-500">Manage your Play Store apps and push notifications</p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">{mode === 'login' ? 'Sign in' : 'Create your account'}</h2>
          {error && <Alert>{error}</Alert>}
          {mode === 'register' && (
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
            </Field>
          )}
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </Field>
          <Field label="Password" hint={mode === 'register' ? 'At least 8 characters' : undefined}>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === 'register' ? 8 : undefined}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </Field>
          <Button type="submit" className="w-full" loading={busy}>
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>
          <p className="text-center text-sm text-slate-500">
            {mode === 'login' ? (
              <>
                No account?{' '}
                <Link to="/register" className="font-medium text-brand-600 hover:underline">
                  Register
                </Link>
              </>
            ) : (
              <>
                Already registered?{' '}
                <Link to="/login" className="font-medium text-brand-600 hover:underline">
                  Sign in
                </Link>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
