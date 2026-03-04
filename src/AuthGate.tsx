import { FormEvent, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import App from './App';
import { hasSupabaseConfig, supabase } from './lib/supabase';

type Mode = 'signin' | 'signup';

function AuthGate() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;

    setMessage('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        setMessage('Проверь почту и подтверди регистрацию, если Supabase просит подтверждение.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Ошибка входа';
      setMessage(text);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  if (!hasSupabaseConfig) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <h1>Нужно подключить Supabase</h1>
          <p>Создай файл <code>.env.local</code> в корне проекта:</p>
          <pre>{`VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co\nVITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY`}</pre>
          <p>Потом перезапусти <code>npm run dev</code>.</p>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <h1>{mode === 'signin' ? 'Вход' : 'Регистрация'}</h1>

          <form onSubmit={handleSubmit} className="auth-form">
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
              />
            </label>

            <label>
              Пароль
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              />
            </label>

            <button type="submit" disabled={loading}>
              {loading ? 'Подождите...' : mode === 'signin' ? 'Войти' : 'Создать аккаунт'}
            </button>
          </form>

          <button
            className="auth-toggle"
            onClick={() => {
              setMode((prev) => (prev === 'signin' ? 'signup' : 'signin'));
              setMessage('');
            }}
          >
            {mode === 'signin' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
          </button>

          {message ? <p className="auth-message">{message}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <>
      <button className="logout-fab" onClick={logout}>
        Выйти
      </button>
      <App />
    </>
  );
}

export default AuthGate;
