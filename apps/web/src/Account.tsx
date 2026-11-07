
import { useEffect, useState, type FormEvent } from 'react';

const API =
  import.meta.env.VITE_API_URL ||
  'https://anime-hub-bangla.onrender.com';

type User = {
  id: string;
  email: string;
  displayName: string;
  role?: string;
};

export default function Account() {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('ahb_user_token');
    if (!token) return;

    fetch(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async response => {
        if (!response.ok) {
          throw new Error('Session expired');
        }
        return response.json();
      })
      .then(result => setUser(result.user))
      .catch(() => {
        localStorage.removeItem('ahb_user_token');
        setUser(null);
      });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('Please wait...');

    try {
      if (mode === 'register') {
        const registerResponse = await fetch(
          `${API}/api/users/register`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              displayName,
              email,
              password
            })
          }
        );

        const registerResult = await registerResponse.json();

        if (!registerResponse.ok) {
          throw new Error(registerResult.error || 'Registration failed');
        }

        setMode('login');
        setPassword('');
        setMessage('Account created! Please sign in.');
        return;
      }

      const response = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Login failed');
      }

      localStorage.setItem('ahb_user_token', result.token);
      setUser(result.user);
      setPassword('');
      setMessage('');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Something went wrong'
      );
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem('ahb_user_token');
    setUser(null);
    setEmail('');
    setPassword('');
    setMessage('You have signed out.');
  }

  if (user) {
    return (
      <div className="account-shell">
        <a className="account-brand" href="/">
          <span className="account-brand-icon">AH</span>
          <span>
            ANIME HUB <b>BANGLA</b>
            <small>YOUR ANIME UNIVERSE</small>
          </span>
        </a>

        <main className="account-auth-layout">
          <section className="account-intro">
            <div className="account-kicker">
              <span /> MEMBER ACCOUNT
            </div>
            <h1>
              Welcome
              <br />
              <em>{user.displayName}.</em>
            </h1>
            <p>
              Your Anime Hub Bangla account is ready.
              Continue exploring your anime universe.
            </p>
          </section>

          <section className="account-card">
            <div className="account-card-top">
              <span className="account-card-icon">✦</span>
              <span>YOUR PROFILE</span>
            </div>

            <h2>Account details</h2>

            <p className="account-description">
              You are signed in to Anime Hub Bangla.
            </p>

            <div className="account-field">
              <span>Display name</span>
              <strong>{user.displayName}</strong>
            </div>

            <div className="account-field">
              <span>Email address</span>
              <strong>{user.email}</strong>
            </div>

            <div className="account-field">
              <span>Account role</span>
              <strong>{user.role || 'USER'}</strong>
            </div>

            <button
              className="account-submit"
              type="button"
              onClick={logout}
            >
              Sign out <span>→</span>
            </button>

            <a href="/" className="account-back">
              ← Back to homepage
            </a>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="account-shell">
      <div className="account-glow account-glow-one" />
      <div className="account-glow account-glow-two" />

      <a className="account-brand" href="/">
        <span className="account-brand-icon">AH</span>
        <span>
          ANIME HUB <b>BANGLA</b>
          <small>YOUR ANIME UNIVERSE</small>
        </span>
      </a>

      <main className="account-auth-layout">
        <section className="account-intro">
          <div className="account-kicker">
            <span /> WELCOME TO ANIME HUB BANGLA
          </div>

          <h1>
            Every story.
            <br />
            <em>One universe.</em>
          </h1>

          <p>
            Sign in to continue your anime journey.
            Save your watch progress, build your
            personal watchlist and explore the
            Bangla anime community.
          </p>

          <div className="account-benefits">
            <div><span>01</span> Continue watching from where you left off</div>
            <div><span>02</span> Save your favourite anime</div>
            <div><span>03</span> Manage your membership</div>
          </div>
        </section>

        <form className="account-card" onSubmit={submit}>
          <div className="account-card-top">
            <span className="account-card-icon">✦</span>
            <span>MEMBER ACCESS</span>
          </div>

          <div className="account-eyebrow">
            {mode === 'login' ? 'GOOD TO SEE YOU AGAIN' : 'JOIN THE COMMUNITY'}
          </div>

          <h2>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>

          <p className="account-description">
            {mode === 'login'
              ? 'Enter your details to access your account.'
              : 'Create your free Anime Hub Bangla account.'}
          </p>

          {mode === 'register' && (
            <label className="account-field">
              <span>Display name</span>
              <input
                required
                minLength={2}
                maxLength={60}
                placeholder="Your name"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                autoComplete="name"
              />
            </label>
          )}

          <label className="account-field">
            <span>Email address</span>
            <input
              required
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>

          <label className="account-field">
            <span>Password</span>
            <input
              required
              minLength={mode === 'register' ? 8 : 1}
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>

          <button
            className="account-submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? 'Please wait...'
              : mode === 'login'
                ? 'Sign in to your account'
                : 'Create free account'}
            <span>→</span>
          </button>

          {message && (
            <div
              className={`account-message ${
                message === 'Please wait...' ||
                message.includes('created!')
                  ? 'loading'
                  : 'error'
              }`}
              role="status"
            >
              {message}
            </div>
          )}

          <div className="account-switch">
            {mode === 'login'
              ? "Don't have an account?"
              : 'Already have an account?'}

            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setMessage('');
              }}
            >
              {mode === 'login' ? 'Create account' : 'Sign in'}
            </button>
          </div>

          <div className="account-divider">
            <span>ANIME HUB BANGLA</span>
          </div>

          <a href="/" className="account-back">
            ← Back to homepage
          </a>
        </form>
      </main>

      <footer className="account-footer">
        <span>© {new Date().getFullYear()} Anime Hub Bangla</span>
        <span>MADE FOR ANIME LOVERS</span>
      </footer>
    </div>
  );
}
