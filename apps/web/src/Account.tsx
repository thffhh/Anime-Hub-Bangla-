
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Heart, History, Crown, LogOut, UserRound,
  Play, Trash2
} from 'lucide-react';

const API =
  import.meta.env.VITE_API_URL ||
  'https://anime-hub-bangla.onrender.com';

type User = {
  id: string;
  email: string;
  displayName: string;
  role: string;
};

type Notice = {
  id: string;
  title: string;
  body: string;
  href?: string;
  readAt?: string;
  createdAt: string;
};

type Item = {
  episodeId?: string;
  episodeTitle?: string;
  episodeNumber?: number;
  animeTitle?: string;
  animeSlug?: string;
  positionSeconds?: number;
  completed?: boolean;
  id?: string;
  title?: string;
  slug?: string;
  posterUrl?: string;
};

const STAFF_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'MODERATOR',
  'CONTENT_MANAGER',
  'ADVERTISEMENT_MANAGER',
  'COLLABORATION_MANAGER',
  'ANALYST'
];

export default function Account() {
  const [token, setToken] = useState(
    localStorage.getItem('ahb_token') || ''
  );
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState<
    'history' | 'favorites' | 'premium' | 'notifications'
  >('history');

  const [history, setHistory] = useState<Item[]>([]);
  const [favorites, setFavorites] = useState<Item[]>([]);
  const [membership, setMembership] = useState<any>({
    plan: 'FREE',
    status: 'ACTIVE'
  });
  const [paymentMethod, setPaymentMethod] = useState('BKASH');
  const [transactionReference, setTransactionReference] = useState('');
  const [amountBdt, setAmountBdt] = useState('');
  const [payments, setPayments] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<Notice[]>([]);

  const headers = {
    Authorization: `Bearer ${token}`
  };

  async function load() {
    try {
      const [me, h, f, pay, notices] = await Promise.all([
        fetch(`${API}/api/user/me`, { headers }),
        fetch(`${API}/api/user/history`, { headers }),
        fetch(`${API}/api/user/favorites`, { headers }),
        fetch(`${API}/api/user/payments`, { headers }),
        fetch(`${API}/api/user/notifications`, { headers })
      ]);

      if (!me.ok) {
        logout();
        return;
      }

      const md = await me.json();
      setUser(md.user);
      setMembership(md.membership || {
        plan: 'FREE',
        status: 'ACTIVE'
      });

      setHistory((await h.json()).data || []);
      setFavorites((await f.json()).data || []);
      setPayments((await pay.json()).data || []);
      setNotifications((await notices.json()).data || []);
    } catch {
      setMessage('Could not connect to the account server.');
    }
  }

  useEffect(() => {
    if (token) load();
  }, [token]);

  function logout() {
    localStorage.removeItem('ahb_token');
    localStorage.removeItem('ahb_admin_token');
    setToken('');
    setUser(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('Please wait...');

    try {
      if (mode === 'register') {
        const response = await fetch(`${API}/api/user/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email,
            password,
            displayName
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Registration failed');
        }

        setMessage('Account created successfully. Please sign in.');
        setMode('login');
        setPassword('');
        return;
      }

      const response = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      const role = String(data.user?.role || '').toUpperCase();

      if (STAFF_ROLES.includes(role)) {
        localStorage.removeItem('ahb_token');
        localStorage.setItem('ahb_admin_token', data.token);
        window.location.href = '/admin';
        return;
      }

      localStorage.removeItem('ahb_admin_token');
      localStorage.setItem('ahb_token', data.token);
      setToken(data.token);
      setMessage('');
      setPassword('');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Something went wrong'
      );
    }
  }

  async function requestPremium(plan: 'MONTHLY' | 'YEARLY') {
    if (
      !transactionReference.trim() ||
      !amountBdt ||
      Number(amountBdt) <= 0
    ) {
      setMessage('Enter transaction ID and exact amount paid first.');
      return;
    }

    const response = await fetch(
      `${API}/api/user/membership/request`,
      {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          plan,
          paymentMethod,
          transactionReference,
          amountBdt: Number(amountBdt)
        })
      }
    );

    const data = await response.json();

    setMessage(
      response.ok
        ? data.message
        : data.error || 'Payment submission failed'
    );

    if (response.ok) {
      setTransactionReference('');
      setAmountBdt('');
      load();
    }
  }

  if (!user) {
    return (
      <div className="account-shell">
        <a className="brand" href="/">
          ANIME HUB <b>BANGLA</b>
        </a>

        <form className="account-card" onSubmit={submit}>
          <div className="eyebrow">YOUR ANIME HUB ACCOUNT</div>

          <h1>
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h1>

          <p>
            Save your progress, build your watchlist and manage membership.
          </p>

          {mode === 'register' && (
            <input
              required
              minLength={2}
              maxLength={60}
              placeholder="Display name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
            />
          )}

          <input
            required
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />

          <input
            required
            minLength={mode === 'register' ? 8 : 1}
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />

          <button className="primary" type="submit">
            {mode === 'login' ? 'Sign in' : 'Create free account'}
          </button>

          {message && <small>{message}</small>}

          <button
            className="text-button"
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setMessage('');
            }}
          >
            {mode === 'login'
              ? 'New here? Create an account'
              : 'Already registered? Sign in'}
          </button>

          <a href="/" className="text-button">
            ← Back to Anime Hub
          </a>
        </form>
      </div>
    );
  }

  return (
    <div className="account-shell">
      <header className="account-top">
        <a className="brand" href="/">
          ANIME HUB <b>BANGLA</b>
        </a>

        <button className="text-button" onClick={logout}>
          <LogOut size={16} /> Sign out
        </button>
      </header>

      <main className="account-main">
        <div className="account-welcome">
          <div className="avatar">
            <UserRound />
          </div>

          <div>
            <div className="eyebrow">MY ACCOUNT</div>
            <h1>{user.displayName}</h1>
            <p>{user.email}</p>
          </div>
        </div>

        <div className="account-tabs">
          <button
            className={tab === 'history' ? 'active' : ''}
            onClick={() => setTab('history')}
          >
            <History /> Watch history
          </button>

          <button
            className={tab === 'favorites' ? 'active' : ''}
            onClick={() => setTab('favorites')}
          >
            <Heart /> Favorites
          </button>

          <button
            className={tab === 'premium' ? 'active' : ''}
            onClick={() => setTab('premium')}
          >
            <Crown /> Premium
          </button>

          <button
            className={tab === 'notifications' ? 'active' : ''}
            onClick={() => setTab('notifications')}
          >
            Notifications
          </button>
        </div>

        {tab === 'history' && (
          <section className="account-section">
            <h2>Continue watching</h2>

            {history.length ? history.map(item => (
              <a
                className="account-row"
                key={item.episodeId}
                href={`/anime/${item.animeSlug}`}
              >
                <span><Play /></span>
                <div>
                  <b>
                    {item.animeTitle} · Episode {item.episodeNumber}
                  </b>
                  <small>
                    {item.episodeTitle} · {
                      item.completed
                        ? 'Completed'
                        : `${Math.floor((item.positionSeconds || 0) / 60)} min watched`
                    }
                  </small>
                </div>
              </a>
            )) : (
              <p>No watch history yet. Start watching an anime to see it here.</p>
            )}

            <button
              className="text-button"
              onClick={async () => {
                await fetch(`${API}/api/user/history`, {
                  method: 'DELETE',
                  headers
                });
                load();
              }}
            >
              <Trash2 size={15} /> Clear history
            </button>
          </section>
        )}

        {tab === 'favorites' && (
          <section className="account-section">
            <h2>My favorites</h2>

            {favorites.length ? favorites.map(item => (
              <a
                className="account-row"
                key={item.id}
                href={`/anime/${item.slug}`}
              >
                <Heart />
                <b>{item.title}</b>
              </a>
            )) : (
              <p>Your saved anime will appear here.</p>
            )}
          </section>
        )}

        {tab === 'notifications' && (
          <section className="account-section">
            <h2>Notifications</h2>

            {notifications.length ? notifications.map(notice => (
              <article className="community-item" key={notice.id}>
                <b>{notice.title}</b>
                <p>{notice.body}</p>
                <small>
                  {new Date(notice.createdAt).toLocaleString()}
                </small>

                {!notice.readAt && (
                  <button
                    className="text-button"
                    onClick={async () => {
                      await fetch(
                        `${API}/api/user/notifications/${notice.id}/read`,
                        { method: 'PATCH', headers }
                      );
                      load();
                    }}
                  >
                    Mark as read
                  </button>
                )}
              </article>
            )) : (
              <p>No notifications yet.</p>
            )}
          </section>
        )}

        {tab === 'premium' && (
          <section className="account-section">
            <h2>Membership</h2>

            <div className="membership-status">
              <Crown />
              <div>
                <b>{membership.plan || 'FREE'} PLAN</b>
                <small>Status: {membership.status || 'ACTIVE'}</small>
              </div>
            </div>

            <p>
              After paying through the official channel provided by
              Anime Hub Bangla, submit the exact transaction details below.
              This form does not collect your PIN or OTP.
            </p>

            <div className="plan-grid">
              <article>
                <h3>Monthly Premium</h3>
                <p>Submit your monthly payment for manual review.</p>
                <button
                  className="primary"
                  onClick={() => requestPremium('MONTHLY')}
                >
                  Submit monthly payment
                </button>
              </article>

              <article>
                <h3>Yearly Premium</h3>
                <p>Submit your yearly payment for manual review.</p>
                <button
                  className="primary"
                  onClick={() => requestPremium('YEARLY')}
                >
                  Submit yearly payment
                </button>
              </article>
            </div>

            <div className="payment-submit-form">
              <label>
                Payment method
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                >
                  <option value="BKASH">bKash</option>
                  <option value="NAGAD">Nagad</option>
                  <option value="ROCKET">Rocket</option>
                  <option value="SSLCOMMERZ">SSLCOMMERZ</option>
                </select>
              </label>

              <label>
                Transaction ID
                <input
                  value={transactionReference}
                  onChange={e => setTransactionReference(e.target.value)}
                  placeholder="Enter transaction reference"
                />
              </label>

              <label>
                Amount paid (BDT)
                <input
                  type="number"
                  min="1"
                  value={amountBdt}
                  onChange={e => setAmountBdt(e.target.value)}
                  placeholder="Exact amount paid"
                />
              </label>

              <small>
                Fill in all three fields, then choose the plan above.
                Never enter your PIN or OTP here.
              </small>
            </div>

            {message && <small>{message}</small>}

            <h3>Payment submissions</h3>

            {payments.length ? payments.map(payment => (
              <div className="account-row" key={payment.id}>
                <div>
                  <b>{payment.plan} · ৳{payment.amountBdt}</b>
                  <small>
                    {payment.paymentMethod} · {payment.transactionReference}
                  </small>
                </div>
                <strong>{payment.status}</strong>
              </div>
            )) : (
              <p>No payment submissions yet.</p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
