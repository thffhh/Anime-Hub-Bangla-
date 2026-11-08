
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  ArrowLeft, Bell, Bookmark, Check, ChevronRight, Clock3, Crown,
  Film, Heart, History, LayoutDashboard, LogOut, Menu, Play,
  RefreshCw, Shield, UserRound, X
} from 'lucide-react';

import { API, loginError } from './api';

type User = {
  id: string;
  email: string;
  displayName: string;
  role?: string;
  createdAt?: string;
};

type HistoryItem = {
  episodeId: string;
  episodeNumber: number;
  episodeTitle: string;
  thumbnailUrl?: string;
  positionSeconds: number;
  completed: boolean;
  updatedAt: string;
  animeTitle: string;
  animeSlug: string;
};

type AnimeItem = {
  id: string;
  slug: string;
  title: string;
  posterUrl?: string;
};

type Membership = {
  plan: string;
  status: string;
  startsAt?: string;
  endsAt?: string;
};

type Payment = {
  id: string;
  plan: string;
  paymentMethod: string;
  transactionReference: string;
  amountBdt: number;
  status: string;
  createdAt: string;
};

type Notification = {
  id: string;
  title: string;
  body: string;
  href?: string;
  readAt?: string;
  createdAt: string;
};

type Section = 'dashboard' | 'history' | 'favorites' | 'membership' | 'notifications' | 'profile';

const navItems: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'history', label: 'Watch history', icon: History },
  { id: 'favorites', label: 'My favorites', icon: Heart },
  { id: 'membership', label: 'Membership', icon: Crown },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'profile', label: 'Account settings', icon: UserRound }
];

function readToken() {
  return localStorage.getItem('ahb_token') || localStorage.getItem('ahb_user_token');
}

function saveToken(token: string) {
  localStorage.setItem('ahb_token', token);
  localStorage.setItem('ahb_user_token', token);
}

function clearToken() {
  localStorage.removeItem('ahb_token');
  localStorage.removeItem('ahb_user_token');
}

function formatDate(value?: string) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not available'
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(seconds = 0) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

async function apiRequest<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || `Request failed (${response.status})`);
  }

  return result as T;
}

export default function Account() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState('');
  const [section, setSection] = useState<Section>('dashboard');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [mobileMenu, setMobileMenu] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [favorites, setFavorites] = useState<AnimeItem[]>([]);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState('');
  const [notice, setNotice] = useState('');
  const [planPrices, setPlanPrices] = useState<{ monthlyPriceBdt?: number; yearlyPriceBdt?: number; paymentInstructions?: string; bkashNumber?: string; nagadNumber?: string }>({});
  const [paymentPlan, setPaymentPlan] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [paymentMethod, setPaymentMethod] = useState('BKASH');
  const [transactionRef, setTransactionRef] = useState('');
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API}/api/cms/public/homepage`, { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(result => {
        const raw = result?.settings;
        if (raw) setPlanPrices({ monthlyPriceBdt: typeof raw.monthlyPriceBdt === 'number' ? raw.monthlyPriceBdt : undefined, yearlyPriceBdt: typeof raw.yearlyPriceBdt === 'number' ? raw.yearlyPriceBdt : undefined, paymentInstructions: typeof raw.paymentInstructions === 'string' ? raw.paymentInstructions : undefined, bkashNumber: typeof raw.bkashNumber === 'string' && /^(?:01|\+8801)[3-9]\d{8}$/.test(raw.bkashNumber) ? raw.bkashNumber : undefined, nagadNumber: typeof raw.nagadNumber === 'string' && /^(?:01|\+8801)[3-9]\d{8}$/.test(raw.nagadNumber) ? raw.nagadNumber : undefined });
      }).catch(err => { if (err?.name !== 'AbortError') console.warn('Plan prices unavailable'); });
    return () => controller.abort();
  }, []);

  const loadData = useCallback(async (activeToken: string) => {
    setLoading(true);
    setPageError('');

    const tasks = await Promise.allSettled([
      apiRequest<{ data: HistoryItem[] }>('/api/user/history', activeToken),
      apiRequest<{ data: AnimeItem[] }>('/api/user/favorites', activeToken),
      apiRequest<{ membership: Membership }>('/api/user/membership', activeToken),
      apiRequest<{ data: Payment[] }>('/api/user/payments', activeToken),
      apiRequest<{ data: Notification[] }>('/api/user/notifications', activeToken)
    ]);

    if (tasks[0].status === 'fulfilled') setHistory(tasks[0].value.data || []);
    if (tasks[1].status === 'fulfilled') setFavorites(tasks[1].value.data || []);
    if (tasks[2].status === 'fulfilled') setMembership(tasks[2].value.membership || null);
    if (tasks[3].status === 'fulfilled') setPayments(tasks[3].value.data || []);
    if (tasks[4].status === 'fulfilled') setNotifications(tasks[4].value.data || []);

    const failed = tasks.filter(item => item.status === 'rejected');
    if (failed.length === tasks.length) {
      setPageError('We could not load your account data. Check your connection and try again.');
    } else if (failed.length) {
      setPageError('Some account sections could not be loaded. You can refresh to try again.');
    }

    setLoading(false);
  }, []);

  const loadAccount = useCallback(async (activeToken: string) => {
    try {
      const result = await apiRequest<{ user: User }>('/api/auth/me', activeToken);
      setUser(result.user);
      setEmail(result.user.email);
      setDisplayName(result.user.displayName || '');
      await loadData(activeToken);
    } catch (error) {
      if (error instanceof TypeError) {
        setPageError('Unable to connect to the server. Your session has been kept.');
        return;
      }

      const message = error instanceof Error ? error.message : '';
      if (message.includes('expired') || message.includes('Unauthorized') || message.includes('Invalid token')) {
        clearToken();
        setToken('');
        setUser(null);
      } else {
        setPageError(message || 'Could not load your account.');
      }
    }
  }, [loadData]);

  useEffect(() => {
    const saved = readToken();
    if (saved) {
      setToken(saved);
      void loadAccount(saved);
    }
  }, [loadAccount]);

  const recipient = paymentMethod === 'BKASH' ? planPrices.bkashNumber : paymentMethod === 'NAGAD' ? planPrices.nagadNumber : undefined;
  const methodAvailable = paymentMethod === 'BKASH' || paymentMethod === 'NAGAD' ? Boolean(recipient) : Boolean(planPrices.paymentInstructions?.trim());

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = paymentPlan === 'MONTHLY' ? planPrices.monthlyPriceBdt : planPrices.yearlyPriceBdt;
    if (!token || !amount || !methodAvailable || paymentBusy) return;
    setPaymentBusy(true); setPaymentMessage('');
    try {
      const result = await apiRequest<{ message: string }>('/api/user/membership/request', token, {
        method: 'POST', body: JSON.stringify({ plan: paymentPlan, paymentMethod, transactionReference: transactionRef.trim(), amountBdt: amount })
      });
      setTransactionRef('');
      await loadData(token);
      setPaymentMessage(result.message || 'Payment submitted for manual review.');
    } catch (error) {
      setPaymentMessage(error instanceof Error ? error.message : 'Could not submit payment.');
    } finally { setPaymentBusy(false); }
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthMessage('');

    try {
      if (mode === 'register') {
        const response = await fetch(`${API}/api/user/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName, email, password })
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Registration failed');

        setMode('login');
        setPassword('');
        setAuthMessage('Your account has been created. Please sign in.');
        return;
      }

      const response = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Login failed');
      if (!result.token) throw new Error('The server did not return a login token.');

      saveToken(result.token);
      setToken(result.token);
      setUser(result.user);
      setPassword('');
      setAuthMessage('');
      await loadAccount(result.token);
    } catch (error) {
      setAuthMessage(loginError(error));
    } finally {
      setAuthLoading(false);
    }
  }

  function logout() {
    clearToken();
    setToken('');
    setUser(null);
    setHistory([]);
    setFavorites([]);
    setPayments([]);
    setNotifications([]);
    setMembership(null);
    setPassword('');
    setSection('dashboard');
    setNotice('You have signed out successfully.');
  }

  async function clearHistory() {
    if (!window.confirm('Clear your complete watch history?')) return;

    try {
      await apiRequest('/api/user/history', token, { method: 'DELETE' });
      setHistory([]);
      setNotice('Your watch history has been cleared.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not clear history.');
    }
  }

  async function markNotificationRead(id: string) {
    try {
      await apiRequest(`/api/user/notifications/${id}/read`, token, { method: 'PATCH' });
      setNotifications(items => items.map(item => item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update notification.');
    }
  }

  function changeSection(next: Section) {
    setSection(next);
    setMobileMenu(false);
    setNotice('');
  }

  if (!user) {
    return (
      <div className="ah-account-auth">
        <style>{styles}</style>
        <div className="ah-auth-glow ah-auth-glow-a" />
        <div className="ah-auth-glow ah-auth-glow-b" />

        <a href="/" className="ah-logo">
          <span className="ah-logo-mark">AH</span>
          <span>ANIME HUB <b>BANGLA</b><small>YOUR ANIME UNIVERSE</small></span>
        </a>

        <main className="ah-auth-grid">
          <section className="ah-auth-intro">
            <span className="ah-eyebrow"><i /> YOUR ANIME JOURNEY STARTS HERE</span>
            <h1>Every story.<br /><em>One universe.</em></h1>
            <p>One account for your anime experience. Keep track of your watch history, save your favourites and stay connected with the Anime Hub Bangla community.</p>
            <div className="ah-auth-perks">
              <div><History /> <span><b>Your watch history</b><small>Pick up where you left off.</small></span></div>
              <div><Heart /> <span><b>Your anime collection</b><small>Keep your favourites together.</small></span></div>
              <div><Bell /> <span><b>Community updates</b><small>Stay updated with notifications.</small></span></div>
            </div>
          </section>

          <form className="ah-auth-card" onSubmit={submitAuth}>
            <div className="ah-card-kicker"><span>✦</span> MEMBER ACCESS</div>
            <small className="ah-form-eyebrow">{mode === 'login' ? 'WELCOME BACK' : 'JOIN THE COMMUNITY'}</small>
            <h2>{mode === 'login' ? 'Sign in' : 'Create account'}</h2>
            <p>{mode === 'login' ? 'Enter your details to access your account.' : 'Create your free Anime Hub Bangla account.'}</p>

            {mode === 'register' && (
              <label className="ah-input-wrap">
                <span>Display name</span>
                <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" minLength={2} maxLength={60} autoComplete="name" required />
              </label>
            )}

            <label className="ah-input-wrap">
              <span>Email address</span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
            </label>

            <label className="ah-input-wrap">
              <span>Password</span>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" minLength={mode === 'register' ? 8 : 1} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
            </label>

            <button className="ah-primary-btn" disabled={authLoading}>
              {authLoading ? 'Please wait…' : mode === 'login' ? 'Sign in to your account' : 'Create free account'}
              <ChevronRight size={18} />
            </button>

            {(authMessage || pageError) && <div className="ah-form-message" role="status">{authMessage || pageError}</div>}

            <div className="ah-auth-switch">
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
              <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setAuthMessage(''); }}>
                {mode === 'login' ? 'Create account' : 'Sign in'}
              </button>
            </div>

            <a href="/" className="ah-back-link"><ArrowLeft size={15} /> Back to homepage</a>
          </form>
        </main>
        <footer className="ah-auth-footer">© {new Date().getFullYear()} Anime Hub Bangla <span>MADE FOR ANIME LOVERS</span></footer>
      </div>
    );
  }

  const watchedCount = history.length;
  const completedCount = history.filter(item => item.completed).length;
  const unreadCount = notifications.filter(item => !item.readAt).length;

  return (
    <div className="ah-dashboard">
      <style>{styles}</style>

      <header className="ah-topbar">
        <a href="/" className="ah-logo">
          <span className="ah-logo-mark">AH</span>
          <span>ANIME HUB <b>BANGLA</b><small>YOUR ANIME UNIVERSE</small></span>
        </a>
        <div className="ah-top-actions">
          <a href="/" className="ah-home-link"><ArrowLeft size={16} /> Homepage</a>
          <button className="ah-icon-btn ah-mobile-menu" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle menu">
            {mobileMenu ? <X /> : <Menu />}
          </button>
          <div className="ah-user-chip"><span>{(user.displayName || 'A').charAt(0).toUpperCase()}</span>{user.displayName}</div>
        </div>
      </header>

      <div className="ah-dashboard-layout">
        <aside className={`ah-sidebar ${mobileMenu ? 'is-open' : ''}`}>
          <div className="ah-side-profile">
            <div className="ah-avatar">{(user.displayName || 'A').charAt(0).toUpperCase()}</div>
            <div><b>{user.displayName}</b><small>{user.role || 'MEMBER'}</small></div>
          </div>

          <div className="ah-nav-label">YOUR ACCOUNT</div>
          <nav className="ah-nav">
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <button key={item.id} className={section === item.id ? 'active' : ''} onClick={() => changeSection(item.id)}>
                  <Icon size={18} />
                  {item.label}
                  {item.id === 'notifications' && unreadCount > 0 && <span className="ah-nav-count">{unreadCount}</span>}
                </button>
              );
            })}
          </nav>

          <div className="ah-sidebar-bottom">
            {user.role === 'SUPER_ADMIN' && <a href="/super-admin"><Shield size={17} /> Super Admin Panel <ChevronRight size={15} /></a>}
            <button onClick={logout}><LogOut size={17} /> Sign out</button>
          </div>
        </aside>

        <main className="ah-main">
          <div className="ah-page-heading">
            <div>
              <span className="ah-eyebrow"><i /> MEMBER CENTRE</span>
              <h1>{navItems.find(item => item.id === section)?.label || 'Overview'}</h1>
              <p>Welcome back, {user.displayName}. Here's your Anime Hub Bangla account.</p>
            </div>
            <button className="ah-refresh-btn" onClick={() => void loadData(token)} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'ah-spin' : ''} /> Refresh
            </button>
          </div>

          {pageError && <div className="ah-notice ah-notice-warning">{pageError}</div>}
          {notice && <div className="ah-notice">{notice}</div>}

          {loading && <div className="ah-loading-line"><span /> Loading account information…</div>}

          {section === 'dashboard' && (
            <>
              <div className="ah-stats-grid">
                <Stat icon={<History />} label="Watched titles" value={watchedCount} />
                <Stat icon={<Check />} label="Completed episodes" value={completedCount} />
                <Stat icon={<Heart />} label="Favourite anime" value={favorites.length} />
                <Stat icon={<Bell />} label="Unread updates" value={unreadCount} />
              </div>

              <section className="ah-panel">
                <div className="ah-panel-heading"><div><span className="ah-panel-kicker">PICK UP WHERE YOU LEFT OFF</span><h2>Continue watching</h2></div><button className="ah-text-link" onClick={() => changeSection('history')}>View history <ChevronRight size={15} /></button></div>
                {history.length ? (
                  <div className="ah-content-list">
                    {history.slice(0, 5).map(item => <HistoryCard key={item.episodeId} item={item} />)}
                  </div>
                ) : <EmptyState icon={<Play />} title="Your journey starts here" text="Your watch history will appear here after you watch an episode." />}
              </section>

              <div className="ah-two-columns">
                <section className="ah-panel">
                  <div className="ah-panel-heading"><div><span className="ah-panel-kicker">YOUR COLLECTION</span><h2>Favourite anime</h2></div><button className="ah-text-link" onClick={() => changeSection('favorites')}>See all <ChevronRight size={15} /></button></div>
                  {favorites.length ? <div className="ah-mini-list">{favorites.slice(0, 4).map(item => <AnimeRow key={item.id} item={item} />)}</div> : <EmptyState icon={<Heart />} title="No favourites yet" text="Save anime you love to find them here." />}
                </section>

                <section className="ah-panel">
                  <div className="ah-panel-heading"><div><span className="ah-panel-kicker">YOUR PLAN</span><h2>Membership</h2></div><Crown size={20} /></div>
                  <div className="ah-plan-card">
                    <span className="ah-plan-icon"><Crown /></span>
                    <div><small>CURRENT PLAN</small><h3>{membership?.plan || 'FREE'}</h3><span className="ah-status">{membership?.status || 'ACTIVE'}</span></div>
                  </div>
                  <button className="ah-secondary-btn" onClick={() => changeSection('membership')}>View membership details <ChevronRight size={16} /></button>
                </section>
              </div>
            </>
          )}

          {section === 'history' && (
            <section className="ah-panel">
              <div className="ah-panel-heading"><div><span className="ah-panel-kicker">YOUR ACTIVITY</span><h2>Watch history</h2></div>{history.length > 0 && <button className="ah-danger-link" onClick={() => void clearHistory()}>Clear history</button>}</div>
              {history.length ? <div className="ah-content-list">{history.map(item => <HistoryCard key={item.episodeId} item={item} />)}</div> : <EmptyState icon={<History />} title="No watch history" text="Episodes you watch will appear here." />}
            </section>
          )}

          {section === 'favorites' && (
            <section className="ah-panel">
              <div className="ah-panel-heading"><div><span className="ah-panel-kicker">SAVED BY YOU</span><h2>My favourite anime</h2></div><span className="ah-count">{favorites.length} titles</span></div>
              {favorites.length ? <div className="ah-favorites-grid">{favorites.map(item => <a className="ah-favorite-card" href={`/anime/${encodeURIComponent(item.slug)}`} key={item.id}><div className="ah-favorite-poster">{item.posterUrl ? <img src={item.posterUrl} alt={item.title} /> : <Film />}</div><b>{item.title}</b><span>View anime <ChevronRight size={14} /></span></a>)}</div> : <EmptyState icon={<Bookmark />} title="Your collection is empty" text="Add anime to your favourites from an anime details page." />}
            </section>
          )}

          {section === 'membership' && (
            <>
              <section className="ah-panel">
                <span className="ah-panel-kicker">YOUR SUBSCRIPTION</span>
                <h2>Membership overview</h2>
                <div className="ah-membership-card">
                  <div className="ah-membership-icon"><Crown size={28} /></div>
                  <div className="ah-membership-info"><small>CURRENT MEMBERSHIP</small><h2>{membership?.plan || 'FREE'} PLAN</h2><span className="ah-status">{membership?.status || 'ACTIVE'}</span></div>
                  <div className="ah-membership-dates"><small>Started</small><b>{formatDate(membership?.startsAt)}</b><small>Expires</small><b>{formatDate(membership?.endsAt)}</b></div>
                </div>
                <div className="ah-price-grid"><div><small>MONTHLY</small><strong>{planPrices.monthlyPriceBdt ? `৳${planPrices.monthlyPriceBdt.toLocaleString()}` : 'Not configured'}</strong></div><div><small>YEARLY</small><strong>{planPrices.yearlyPriceBdt ? `৳${planPrices.yearlyPriceBdt.toLocaleString()}` : 'Not configured'}</strong></div></div>
                <p className="ah-muted">Premium activates only after the team verifies your payment. This is a manual reference submission, not an automatic checkout.</p>
                {planPrices.paymentInstructions && <div className="ah-payment-instructions">{planPrices.paymentInstructions}</div>}
                <form className="ah-payment-form" onSubmit={submitPayment}>
                  <label>Plan<select value={paymentPlan} onChange={e => setPaymentPlan(e.target.value as 'MONTHLY' | 'YEARLY')}><option value="MONTHLY">Monthly</option><option value="YEARLY">Yearly</option></select></label>
                  <label>Payment method<select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}><option value="BKASH">bKash</option><option value="NAGAD">Nagad</option><option value="ROCKET">Rocket (manual reference)</option><option value="SSLCOMMERZ">SSLCommerz (manual reference)</option></select></label>
                  {(paymentMethod === 'BKASH' || paymentMethod === 'NAGAD') && <div className="ah-recipient"><small>{paymentMethod === 'BKASH' ? 'bKash' : 'Nagad'} recipient</small><strong>{recipient || 'Not configured'}</strong><span>Verify the recipient and payment instructions before sending money.</span></div>}
                  {!methodAvailable && <p className="ah-muted">This payment method is not configured. Please choose another method or contact the team before paying.</p>}
                  <label>Transaction reference<input required minLength={4} maxLength={120} value={transactionRef} onChange={e => setTransactionRef(e.target.value)} placeholder="Transaction ID" /></label>
                  <p className="ah-muted">Amount: {paymentPlan === 'MONTHLY' ? (planPrices.monthlyPriceBdt ? `৳${planPrices.monthlyPriceBdt.toLocaleString()}` : 'Not configured') : (planPrices.yearlyPriceBdt ? `৳${planPrices.yearlyPriceBdt.toLocaleString()}` : 'Not configured')}</p>
                  <button className="ah-primary-btn" disabled={paymentBusy || !methodAvailable || !(paymentPlan === 'MONTHLY' ? planPrices.monthlyPriceBdt : planPrices.yearlyPriceBdt)}>{paymentBusy ? 'Submitting…' : 'Submit for verification'}</button>
                  {paymentMessage && <div className="ah-form-message" role="status">{paymentMessage}</div>}
                </form>
              </section>

              <section className="ah-panel">
                <div className="ah-panel-heading"><div><span className="ah-panel-kicker">TRANSACTION RECORDS</span><h2>Payment history</h2></div></div>
                {payments.length ? <div className="ah-table-wrap"><table className="ah-table"><thead><tr><th>Plan</th><th>Method</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>{payments.map(payment => <tr key={payment.id}><td>{payment.plan}</td><td>{payment.paymentMethod}</td><td>৳{Number(payment.amountBdt).toLocaleString()}</td><td><span className={`ah-payment-status ${payment.status.toLowerCase()}`}>{payment.status}</span></td><td>{formatDate(payment.createdAt)}</td></tr>)}</tbody></table></div> : <EmptyState icon={<Crown />} title="No payment records" text="Your membership payment records will appear here." />}
              </section>
            </>
          )}

          {section === 'notifications' && (
            <section className="ah-panel">
              <div className="ah-panel-heading"><div><span className="ah-panel-kicker">STAY IN THE LOOP</span><h2>Notifications</h2></div><span className="ah-count">{unreadCount} unread</span></div>
              {notifications.length ? <div className="ah-notification-list">{notifications.map(item => <div className={`ah-notification ${item.readAt ? '' : 'unread'}`} key={item.id}><span className="ah-notification-icon"><Bell size={18} /></span><div className="ah-notification-content"><b>{item.title}</b><p>{item.body}</p><small>{formatDate(item.createdAt)}</small>{item.href && <a href={item.href}>Open <ChevronRight size={14} /></a>}</div>{!item.readAt && <button onClick={() => void markNotificationRead(item.id)}>Mark read</button>}</div>)}</div> : <EmptyState icon={<Bell />} title="You're all caught up" text="New account notifications will appear here." />}
            </section>
          )}

          {section === 'profile' && (
            <section className="ah-panel">
              <span className="ah-panel-kicker">PERSONAL INFORMATION</span>
              <h2>Account details</h2>
              <div className="ah-profile-avatar">{(user.displayName || 'A').charAt(0).toUpperCase()}</div>
              <div className="ah-profile-details">
                <div><small>DISPLAY NAME</small><b>{user.displayName}</b></div>
                <div><small>EMAIL ADDRESS</small><b>{user.email}</b></div>
                <div><small>ACCOUNT ROLE</small><b>{user.role || 'USER'}</b></div>
                <div><small>MEMBER SINCE</small><b>{formatDate(user.createdAt)}</b></div>
                <div><small>ACCOUNT ID</small><b className="ah-id-text">{user.id}</b></div>
              </div>
              <div className="ah-notice ah-notice-warning">Profile editing, password changes and account deletion are not available yet. Your account information is shown here in read-only mode.</div>
              <button className="ah-secondary-btn ah-logout-btn" onClick={logout}><LogOut size={16} /> Sign out of this account</button>
            </section>
          )}

          <footer className="ah-dashboard-footer">© {new Date().getFullYear()} Anime Hub Bangla <span>YOUR ANIME. YOUR LANGUAGE.</span></footer>
        </main>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="ah-stat-card"><span>{icon}</span><div><b>{value}</b><small>{label}</small></div></div>;
}

function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="ah-empty"><span>{icon}</span><b>{title}</b><p>{text}</p></div>;
}

function AnimeRow({ item }: { item: AnimeItem }) {
  return <a href={`/anime/${encodeURIComponent(item.slug)}`} className="ah-anime-row"><span>{item.posterUrl ? <img src={item.posterUrl} alt="" /> : <Film />}</span><b>{item.title}</b><ChevronRight size={16} /></a>;
}

function HistoryCard({ item }: { item: HistoryItem }) {
  const percent = item.completed ? 100 : Math.min(100, Math.max(0, Math.round((item.positionSeconds / 1440) * 100)));
  return (
    <a href={`/anime/${encodeURIComponent(item.animeSlug)}`} className="ah-history-card">
      <div className="ah-history-thumb">{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" /> : <Play size={22} />}<span><Play size={14} fill="currentColor" /></span></div>
      <div className="ah-history-info"><b>{item.animeTitle}</b><span>Episode {item.episodeNumber}{item.episodeTitle ? ` · ${item.episodeTitle}` : ''}</span><div className="ah-progress"><i style={{ width: `${percent}%` }} /></div><small>{item.completed ? 'Completed' : `Watched ${formatTime(item.positionSeconds)}`} · {formatDate(item.updatedAt)}</small></div>
      <ChevronRight className="ah-history-arrow" size={18} />
    </a>
  );
}

const styles = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,600;0,700;1,600;1,700&display=swap');
.ah-account-auth,.ah-dashboard{--gold:#d4af37;--gold2:#f0d77b;--bg:#08090d;--panel:#11131a;--muted:#9295a2;--line:rgba(255,255,255,.09);background:var(--bg);color:#f5f5f7;min-height:100vh;font-family:'DM Sans',sans-serif;position:relative;overflow:hidden}
.ah-account-auth *,.ah-dashboard *{box-sizing:border-box}
.ah-account-auth a,.ah-dashboard a{color:inherit;text-decoration:none}
.ah-logo{display:inline-flex;align-items:center;gap:12px;font-size:13px;font-weight:800;letter-spacing:1.3px;position:relative;z-index:2}
.ah-logo b{color:var(--gold)}
.ah-logo small{display:block;color:#858894;font-size:9px;letter-spacing:2px;margin-top:4px;font-weight:600}
.ah-logo-mark{width:43px;height:43px;border:1px solid var(--gold);color:var(--gold);display:grid;place-items:center;font-family:'Playfair Display',serif;font-size:18px;border-radius:12px}
.ah-auth-glow{position:absolute;width:480px;height:480px;border-radius:50%;filter:blur(120px);opacity:.11;pointer-events:none}
.ah-auth-glow-a{background:#b88b25;top:-230px;right:4%}.ah-auth-glow-b{background:#4b397b;bottom:-270px;left:0}
.ah-account-auth{padding:30px clamp(20px,7vw,110px) 20px}
.ah-auth-grid{max-width:1120px;margin:80px auto 70px;display:grid;grid-template-columns:1fr 440px;gap:clamp(40px,8vw,120px);align-items:center}
.ah-eyebrow{font-size:10px;letter-spacing:2px;font-weight:800;color:var(--gold);display:inline-flex;align-items:center;gap:9px}
.ah-eyebrow i{width:7px;height:7px;border-radius:50%;background:var(--gold);box-shadow:0 0 13px var(--gold)}
.ah-auth-intro h1{font-family:'Playfair Display',serif;font-size:clamp(45px,6vw,76px);line-height:1.08;letter-spacing:-2px;margin:24px 0}
.ah-auth-intro h1 em{color:var(--gold);font-weight:600}
.ah-auth-intro>p{color:#a3a5af;line-height:1.9;max-width:510px;font-size:15px}
.ah-auth-perks{display:grid;gap:23px;margin-top:40px}
.ah-auth-perks>div{display:flex;align-items:center;gap:16px;color:var(--gold)}
.ah-auth-perks svg{width:20px;height:20px}
.ah-auth-perks b,.ah-auth-perks small{display:block}
.ah-auth-perks b{font-size:13px;color:#eee}
.ah-auth-perks small{font-size:11px;color:#858894;margin-top:4px}
.ah-auth-card{background:linear-gradient(145deg,#151720,#101117);border:1px solid rgba(212,175,55,.2);border-radius:18px;padding:35px;box-shadow:0 25px 90px #0008;position:relative;z-index:1}
.ah-card-kicker{font-size:10px;letter-spacing:1.8px;color:#a7a9b3;font-weight:700;display:flex;gap:9px;align-items:center}
.ah-card-kicker span{color:var(--gold);font-size:19px}
.ah-form-eyebrow{display:block;color:var(--gold);font-size:9px;letter-spacing:2px;font-weight:800;margin-top:35px}
.ah-auth-card h2{font-family:'Playfair Display',serif;font-size:34px;margin:9px 0}
.ah-auth-card>p{color:#9295a2;font-size:12px;margin:0 0 25px}
.ah-input-wrap{display:block;margin:18px 0}
.ah-input-wrap>span{display:block;color:#c8c9cf;font-size:11px;font-weight:700;margin-bottom:9px}
.ah-input-wrap input{width:100%;height:48px;border:1px solid var(--line);border-radius:8px;background:#090b10;color:#fff;padding:0 14px;outline:none;font:inherit;font-size:13px}
.ah-input-wrap input:focus{border-color:var(--gold)}
.ah-primary-btn{width:100%;height:50px;background:var(--gold);color:#15120a;border:0;border-radius:8px;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;gap:12px;cursor:pointer;margin-top:25px}
.ah-primary-btn:hover{background:var(--gold2)}.ah-primary-btn:disabled{opacity:.6;cursor:wait}
.ah-form-message{font-size:12px;color:#f0bd75;background:#f0bd7510;padding:12px;border-radius:7px;margin-top:14px;line-height:1.5}
.ah-auth-switch{text-align:center;color:#9b9da6;font-size:11px;margin:23px 0}
.ah-auth-switch button{background:none;border:0;color:var(--gold);font-weight:800;margin-left:6px;cursor:pointer;font:inherit}
.ah-back-link{display:flex;align-items:center;justify-content:center;gap:7px;color:#999ba5!important;font-size:11px}
.ah-auth-footer{max-width:1120px;margin:auto;border-top:1px solid var(--line);padding:20px 0;color:#777b86;font-size:10px;display:flex;justify-content:space-between;letter-spacing:1px}
.ah-topbar{height:76px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 clamp(18px,5vw,70px);background:#0b0c11;position:sticky;top:0;z-index:10}
.ah-top-actions{display:flex;align-items:center;gap:24px}.ah-home-link{font-size:12px;color:#a8aab2!important;display:flex;align-items:center;gap:8px}
.ah-user-chip{display:flex;align-items:center;gap:10px;font-size:12px;color:#ddd}
.ah-user-chip>span{width:32px;height:32px;border-radius:50%;background:#332a17;border:1px solid #a68a3d;color:var(--gold);display:grid;place-items:center;font-weight:800}
.ah-mobile-menu{display:none!important}
.ah-dashboard-layout{display:grid;grid-template-columns:255px 1fr;min-height:calc(100vh - 76px)}
.ah-sidebar{border-right:1px solid var(--line);padding:28px 17px;display:flex;flex-direction:column;background:#0b0c11}
.ah-side-profile{display:flex;align-items:center;gap:12px;padding:10px 9px 27px;border-bottom:1px solid var(--line)}
.ah-avatar,.ah-profile-avatar{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:#302716;color:var(--gold);border:1px solid #8c7130;font-size:18px;font-weight:800}
.ah-side-profile b,.ah-side-profile small{display:block}.ah-side-profile b{font-size:12px}.ah-side-profile small{font-size:9px;color:var(--gold);letter-spacing:1px;margin-top:5px}
.ah-nav-label{font-size:9px;letter-spacing:1.7px;color:#686c78;font-weight:800;margin:28px 10px 13px}
.ah-nav{display:grid;gap:5px}.ah-nav button{border:0;background:none;color:#999ca7;text-align:left;display:flex;align-items:center;gap:12px;padding:12px 11px;border-radius:7px;font:inherit;font-size:12px;cursor:pointer}
.ah-nav button:hover,.ah-nav button.active{background:#d4af3714;color:var(--gold)}
.ah-nav-count{margin-left:auto;background:var(--gold);color:#17130a;border-radius:20px;padding:2px 7px;font-size:9px;font-weight:800}
.ah-sidebar-bottom{margin-top:auto;padding-top:25px;border-top:1px solid var(--line);display:grid;gap:8px}
.ah-sidebar-bottom a,.ah-sidebar-bottom button{display:flex;align-items:center;gap:10px;padding:11px 10px;background:none;border:0;color:#aeb0b8;font:inherit;font-size:11px;cursor:pointer}
.ah-sidebar-bottom a{color:var(--gold)}.ah-sidebar-bottom a svg:last-child{margin-left:auto}
.ah-main{padding:38px clamp(20px,4vw,58px);max-width:1500px;width:100%;margin:0 auto}
.ah-page-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:30px}
.ah-page-heading h1{font-family:'Playfair Display',serif;font-size:36px;margin:10px 0 7px}
.ah-page-heading p{font-size:12px;color:#9699a4;margin:0}
.ah-refresh-btn,.ah-secondary-btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;border:1px solid var(--line);background:#151720;color:#d7d8dd;border-radius:7px;padding:10px 14px;font:inherit;font-size:11px;cursor:pointer}
.ah-refresh-btn:disabled{opacity:.5}.ah-spin{animation:ahspin 1s linear infinite}@keyframes ahspin{to{transform:rotate(360deg)}}
.ah-stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px}
.ah-stat-card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:20px;display:flex;align-items:center;gap:14px}
.ah-stat-card>span{width:40px;height:40px;display:grid;place-items:center;border-radius:9px;background:#d4af3714;color:var(--gold)}
.ah-stat-card b,.ah-stat-card small{display:block}.ah-stat-card b{font-size:23px}.ah-stat-card small{font-size:10px;color:#999ca7;margin-top:4px}
.ah-panel{background:var(--panel);border:1px solid var(--line);border-radius:11px;padding:24px;margin-bottom:18px;min-width:0}
.ah-panel-heading{display:flex;align-items:center;justify-content:space-between;gap:15px;margin-bottom:20px}
.ah-panel-kicker{font-size:9px;letter-spacing:1.7px;color:var(--gold);font-weight:800}
.ah-panel h2{font-family:'Playfair Display',serif;font-size:23px;margin:5px 0 0}
.ah-text-link{display:flex;align-items:center;gap:4px;background:none;border:0;color:var(--gold);font:inherit;font-size:10px;cursor:pointer}
.ah-two-columns{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.ah-empty{padding:35px 15px;text-align:center;color:#858995}.ah-empty>span{display:grid;place-items:center;margin:0 auto 12px;width:42px;height:42px;border-radius:50%;background:#d4af3712;color:var(--gold)}
.ah-empty b{display:block;color:#ddd;font-size:13px}.ah-empty p{font-size:11px;line-height:1.6;margin:7px 0 0}
.ah-content-list{display:grid}
.ah-history-card{display:flex;align-items:center;gap:15px;padding:13px 0;border-bottom:1px solid var(--line)}
.ah-history-card:last-child{border-bottom:0}.ah-history-thumb{width:105px;height:65px;flex-shrink:0;background:#22242c;border-radius:6px;overflow:hidden;position:relative;display:grid;place-items:center;color:var(--gold)}
.ah-history-thumb img{width:100%;height:100%;object-fit:cover}.ah-history-thumb>span{position:absolute;inset:0;display:grid;place-items:center;background:#0005;color:white}
.ah-history-info{min-width:0;flex:1}.ah-history-info b,.ah-history-info span,.ah-history-info small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ah-history-info b{font-size:12px}.ah-history-info span{font-size:10px;color:#a3a5ae;margin-top:5px}.ah-history-info small{font-size:9px;color:#777b86;margin-top:6px}
.ah-progress{height:3px;background:#292b33;margin-top:9px;border-radius:5px;overflow:hidden}.ah-progress i{height:100%;display:block;background:var(--gold)}
.ah-history-arrow{color:#777b86;flex-shrink:0}
.ah-mini-list{display:grid}.ah-anime-row{display:flex;align-items:center;gap:11px;padding:9px 0;border-bottom:1px solid var(--line);font-size:11px}.ah-anime-row:last-child{border:0}
.ah-anime-row>span{width:34px;height:42px;border-radius:4px;background:#242630;overflow:hidden;display:grid;place-items:center;color:var(--gold);flex-shrink:0}.ah-anime-row img{width:100%;height:100%;object-fit:cover}.ah-anime-row b{flex:1}.ah-anime-row>svg{color:#888}
.ah-plan-card{display:flex;align-items:center;gap:15px;padding:17px;background:#d4af370c;border:1px solid #d4af3730;border-radius:9px;margin:20px 0}
.ah-plan-icon{width:45px;height:45px;border-radius:9px;background:#d4af3720;color:var(--gold);display:grid;place-items:center}
.ah-plan-card small,.ah-plan-card h3{display:block;margin:0}.ah-plan-card small{font-size:9px;color:#a7a9b2;letter-spacing:1px}.ah-plan-card h3{font-size:20px;margin:4px 0;color:var(--gold)}
.ah-status{display:inline-block;border-radius:20px;background:#3c9b671b;color:#75d99d;padding:4px 8px;font-size:9px;font-weight:800}
.ah-secondary-btn{width:100%;margin-top:5px}
.ah-count{font-size:10px;color:#a4a6af}
.ah-favorites-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:17px}
.ah-favorite-card{min-width:0}.ah-favorite-poster{height:190px;border-radius:7px;background:#242630;overflow:hidden;display:grid;place-items:center;color:var(--gold);margin-bottom:10px}
.ah-favorite-poster img{width:100%;height:100%;object-fit:cover}.ah-favorite-card>b{font-size:11px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ah-favorite-card>span{display:flex;align-items:center;color:var(--gold);font-size:9px;margin-top:7px}
.ah-membership-card{display:flex;align-items:center;gap:20px;background:#d4af370c;border:1px solid #d4af3730;padding:22px;border-radius:10px;margin:20px 0}
.ah-membership-icon{width:55px;height:55px;border-radius:12px;background:#d4af3720;color:var(--gold);display:grid;place-items:center}
.ah-membership-info{flex:1}.ah-membership-info small,.ah-membership-dates small{display:block;color:#a1a3ad;font-size:9px;letter-spacing:1px}
.ah-membership-info h2{color:var(--gold);font-size:24px;margin:5px 0 9px}
.ah-membership-dates{display:grid;gap:5px}.ah-membership-dates b{font-size:11px;margin-bottom:7px}
.ah-muted{font-size:11px;color:#9295a2;line-height:1.7}
.ah-table-wrap{overflow-x:auto}.ah-table{width:100%;border-collapse:collapse;min-width:560px;font-size:11px}.ah-table th{text-align:left;color:#858995;font-size:9px;letter-spacing:1px;padding:13px;border-bottom:1px solid var(--line)}.ah-table td{padding:15px 13px;border-bottom:1px solid var(--line);color:#ddd}
.ah-payment-status{font-size:9px;font-weight:800}.ah-payment-status.approved{color:#75d99d}.ah-payment-status.pending{color:#eacb70}.ah-payment-status.rejected{color:#f17e7e}
.ah-notification-list{display:grid}.ah-notification{display:flex;align-items:flex-start;gap:13px;padding:17px 0;border-bottom:1px solid var(--line)}.ah-notification:last-child{border:0}
.ah-notification-icon{width:37px;height:37px;flex-shrink:0;border-radius:8px;background:#d4af3714;color:var(--gold);display:grid;place-items:center}
.ah-notification-content{flex:1;min-width:0}.ah-notification-content>b{font-size:12px}.ah-notification-content p{font-size:11px;color:#a2a4ad;line-height:1.6;margin:5px 0}.ah-notification-content small{font-size:9px;color:#777b86}
.ah-notification-content a{display:flex;align-items:center;color:var(--gold);font-size:10px;margin-top:7px}.ah-notification>button{border:1px solid var(--line);background:#1b1d25;color:var(--gold);font-size:9px;border-radius:5px;padding:7px;cursor:pointer}
.ah-notification.unread .ah-notification-content>b{color:var(--gold)}
.ah-profile-avatar{width:65px;height:65px;font-size:25px;margin:22px 0}
.ah-profile-details{display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:20px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);margin-bottom:20px}
.ah-profile-details small,.ah-profile-details b{display:block}.ah-profile-details small{font-size:9px;letter-spacing:1px;color:#898c97;margin-bottom:7px}.ah-profile-details b{font-size:12px;overflow-wrap:anywhere}
.ah-id-text{font-size:10px!important;color:#b6b8c0}
.ah-notice{padding:12px 14px;border:1px solid #438b632e;background:#438b6310;color:#9ad5af;border-radius:7px;font-size:11px;line-height:1.6;margin:14px 0}
.ah-notice-warning{border-color:#c79e3c35;background:#c79e3c0d;color:#d9c18b}
.ah-logout-btn{width:auto;margin-top:15px}
.ah-loading-line{font-size:10px;color:#a2a4ad;display:flex;align-items:center;gap:9px;margin:-12px 0 17px}.ah-loading-line span{width:7px;height:7px;background:var(--gold);border-radius:50%;animation:ahpulse 1s infinite alternate}@keyframes ahpulse{to{opacity:.3}}
.ah-danger-link{border:0;background:none;color:#f08a8a;font-size:10px;cursor:pointer}
.ah-dashboard-footer{display:flex;justify-content:space-between;padding:25px 0;color:#777b86;font-size:9px;letter-spacing:1px}
@media(max-width:900px){.ah-auth-grid{grid-template-columns:1fr 400px;gap:35px}.ah-dashboard-layout{grid-template-columns:220px 1fr}.ah-stats-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:680px){.ah-account-auth{padding:22px 17px}.ah-auth-grid{grid-template-columns:1fr;margin:45px auto 35px;gap:35px}.ah-auth-intro h1{font-size:48px;margin:18px 0}.ah-auth-intro>p{font-size:13px}.ah-auth-perks{gap:15px;margin-top:25px}.ah-auth-card{padding:24px 20px}.ah-auth-footer{font-size:8px}.ah-topbar{height:65px;padding:0 15px}.ah-logo{font-size:10px;gap:8px}.ah-logo-mark{width:36px;height:36px}.ah-logo small{font-size:7px}.ah-home-link{display:none}.ah-mobile-menu{display:grid!important}.ah-icon-btn{background:none;border:0;color:#ddd;padding:5px}.ah-user-chip{font-size:0}.ah-user-chip>span{font-size:12px}.ah-dashboard-layout{display:block}.ah-sidebar{position:fixed;z-index:9;top:65px;bottom:0;left:0;width:270px;transform:translateX(-105%);transition:transform .25s;box-shadow:15px 0 35px #0008}.ah-sidebar.is-open{transform:translateX(0)}.ah-main{padding:27px 15px}.ah-page-heading{align-items:flex-start}.ah-page-heading h1{font-size:29px}.ah-page-heading p{font-size:10px;line-height:1.5;max-width:250px}.ah-refresh-btn{font-size:0;padding:10px}.ah-refresh-btn svg{width:17px;height:17px}.ah-stats-grid{gap:9px}.ah-stat-card{padding:13px 10px;gap:9px}.ah-stat-card>span{width:33px;height:33px}.ah-stat-card b{font-size:19px}.ah-stat-card small{font-size:9px}.ah-two-columns{grid-template-columns:1fr;gap:0}.ah-panel{padding:17px 14px}.ah-panel h2{font-size:20px}.ah-history-thumb{width:80px;height:55px}.ah-history-card{gap:10px}.ah-history-info b{font-size:11px}.ah-history-info span{font-size:9px}.ah-membership-card{align-items:flex-start;flex-wrap:wrap;padding:15px}.ah-membership-dates{width:100%;display:flex;gap:9px;align-items:center;flex-wrap:wrap}.ah-membership-dates b{margin:0 12px 0 0}.ah-profile-details{grid-template-columns:1fr;gap:16px}.ah-dashboard-footer{font-size:8px}.ah-favorites-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.ah-favorite-poster{height:190px}}
@media(max-width:380px){.ah-stat-card{display:block}.ah-stat-card>span{margin-bottom:9px}.ah-auth-intro h1{font-size:42px}.ah-auth-card{padding:20px 15px}}

/* Account workspace refresh */
.ah-account-auth,.ah-dashboard{--gold:#ffb79c;--gold2:#ffd2bd;--bg:#0b0d19;--panel:#171a2a;--line:rgba(193,201,229,.13);background:#0b0d19}
.ah-account-auth{background:linear-gradient(90deg,#0b0d19f2,#0b0d19d9),url('/hero-world.jpg') center/cover fixed}
.ah-auth-intro h1,.ah-page-heading h1{font-family:'Inter',sans-serif;font-weight:800;letter-spacing:-2px}
.ah-auth-intro h1 em{font-family:'Playfair Display',serif}
.ah-auth-card,.ah-panel,.ah-stat-card{background:#171a2a;border-color:#ffffff16;border-radius:16px;box-shadow:0 18px 55px #0003}
.ah-auth-card{padding:38px}.ah-input-wrap input{background:#0d101d;border-radius:10px}.ah-primary-btn{border-radius:10px}.ah-topbar,.ah-sidebar{background:#101320}.ah-logo-mark{background:#ffb79c;color:#251920;border:0;font-family:Inter,sans-serif;font-weight:900}.ah-nav button.active,.ah-nav button:hover{background:#ffb79c1c}.ah-main{background:radial-gradient(circle at 90% 0%,#80547320,transparent 40%)}
@media(max-width:680px){.ah-auth-card{padding:25px 20px}.ah-auth-intro h1{font-size:43px}.ah-auth-grid{margin-top:38px}}

.ah-price-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:18px 0}.ah-price-grid>div{padding:18px;border:1px solid #ffffff1c;border-radius:14px;background:#ffffff08}.ah-price-grid small,.ah-price-grid strong{display:block}.ah-price-grid small{color:#b1b5c5;font-size:10px;letter-spacing:1.5px}.ah-price-grid strong{font-size:20px;margin-top:10px;color:#ffd2bd}@media(max-width:400px){.ah-price-grid{grid-template-columns:1fr}}

.ah-payment-instructions{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6;border:1px solid #ffb79c33;background:#ffb79c0c;padding:15px;border-radius:12px;font-size:13px;color:#f1dbd2}.ah-payment-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:20px}.ah-payment-form label{display:grid;gap:7px;font-size:12px;color:#c8c9cf}.ah-payment-form select,.ah-payment-form input{width:100%;min-width:0;padding:12px;border:1px solid #ffffff25;border-radius:9px;background:#0d101d;color:#fff;font:inherit}.ah-payment-form .ah-primary-btn,.ah-payment-form .ah-form-message,.ah-payment-form .ah-muted{grid-column:1/-1;margin:0}.ah-payment-form .ah-primary-btn{width:auto;justify-self:start;padding:0 22px}@media(max-width:600px){.ah-payment-form{grid-template-columns:1fr}.ah-payment-form .ah-primary-btn,.ah-payment-form .ah-form-message,.ah-payment-form .ah-muted{grid-column:auto}}

.ah-recipient{grid-column:1/-1;display:grid;gap:7px;padding:16px;border:1px solid #ffb79c44;background:#ffb79c0c;border-radius:12px}.ah-recipient small{color:#bdc1cf;font-size:11px}.ah-recipient strong{color:#ffd2bd;font-size:20px;letter-spacing:1px;overflow-wrap:anywhere}.ah-recipient span{color:#aeb3c3;font-size:11px;line-height:1.5}@media(max-width:600px){.ah-recipient{grid-column:auto}}
`;
