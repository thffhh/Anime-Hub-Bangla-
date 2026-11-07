
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Activity, BarChart3, CreditCard, Film, Globe, LayoutDashboard,
  LogOut, RefreshCw, Settings, ShieldCheck, Users, Wallet,
  AlertTriangle, CheckCircle, Menu, X
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL ||
  'https://anime-hub-bangla.onrender.com';

type Section =
  | 'overview'
  | 'website'
  | 'users'
  | 'payments'
  | 'revenue'
  | 'content'
  | 'system';

type User = {
  id: string;
  email: string;
  displayName?: string;
  role: string;
  status: string;
};

type Payment = {
  id: string;
  email: string;
  displayName: string;
  plan: string;
  paymentMethod: string;
  transactionReference: string;
  amountBdt: string | number;
  status: string;
  createdAt: string;
};

type SettingsData = {
  siteName: string;
  tagline: string;
  announcement: string;
  heroTitle: string;
  heroSubtitle: string;
  contactEmail: string;
  maintenanceMode: boolean;
};

const defaultSettings: SettingsData = {
  siteName: 'Anime Hub Bangla',
  tagline: 'Your Anime. Your Language.',
  announcement: '',
  heroTitle: 'Your Anime. Your Language.',
  heroSubtitle: 'Discover anime stories in Bangla.',
  contactEmail: '',
  maintenanceMode: false
};

const initialSections: {
  id: Section;
  label: string;
  icon: typeof LayoutDashboard;
}[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'website', label: 'Website Settings', icon: Globe },
  { id: 'users', label: 'User Management', icon: Users },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'revenue', label: 'Revenue & Analytics', icon: Wallet },
  { id: 'content', label: 'Content Overview', icon: Film },
  { id: 'system', label: 'System & Security', icon: ShieldCheck }
];

export default function SuperAdmin() {
  const [token, setToken] = useState(
    localStorage.getItem('ahb_admin_token') || ''
  );

  const [user, setUser] = useState<User | null>(null);
  const [section, setSection] = useState<Section>('overview');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [summary, setSummary] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [revenue, setRevenue] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [anime, setAnime] = useState<any[]>([]);
  const [settings, setSettings] =
    useState<SettingsData>(defaultSettings);

  const api = useCallback(async (
    path: string,
    options: RequestInit = {}
  ) => {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Request failed (${response.status})`);
    }

    return data;
  }, [token]);

  const logout = useCallback(() => {
    localStorage.removeItem('ahb_admin_token');
    setToken('');
    setUser(null);
    setSummary(null);
    setUsers([]);
    setPayments([]);
  }, []);

  const loadDashboard = useCallback(async () => {
    setError('');

    const results = await Promise.allSettled([
      api('/api/admin/summary'),
      api('/api/admin/users'),
      api('/api/admin/payments'),
      api('/api/admin/revenue'),
      api('/api/admin/analytics'),
      api('/api/admin/anime'),
      api('/api/admin/settings')
    ]);

    const get = (index: number) =>
      results[index].status === 'fulfilled'
        ? results[index].value
        : null;

    const s = get(0);
    const u = get(1);
    const p = get(2);
    const r = get(3);
    const a = get(4);
    const an = get(5);
    const st = get(6);

    if (s) setSummary(s);
    if (u) setUsers(u.data || []);
    if (p) setPayments(p.data || []);
    if (r) setRevenue(r);
    if (a) setAnalytics(a);
    if (an) setAnime(an.data || []);

    if (st?.data) {
      setSettings({
        ...defaultSettings,
        ...st.data
      });
    }

    if (results.every(x => x.status === 'rejected')) {
      setError('Dashboard data could not be loaded. Check API and database.');
    }
  }, [api]);

  useEffect(() => {
    if (!token) return;

    let active = true;

    api('/api/auth/me')
      .then(result => {
        if (!active) return;

        if (result.user?.role !== 'SUPER_ADMIN') {
          setError('Access denied. Super Admin permission is required.');
          logout();
          return;
        }

        setUser(result.user);
      })
      .catch(() => {
        if (active) logout();
      });

    return () => {
      active = false;
    };
  }, [token, api, logout]);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      loadDashboard();
    }
  }, [user, loadDashboard]);

  async function login(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      if (result.user?.role !== 'SUPER_ADMIN') {
        throw new Error('This account is not a Super Admin account.');
      }

      localStorage.setItem('ahb_admin_token', result.token);
      setToken(result.token);
      setUser(result.user);
      setPassword('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      await api('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
      });

      setMessage('Website settings saved successfully.');
      await loadDashboard();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save settings');
    } finally {
      setLoading(false);
    }
  }

  async function reviewPayment(
    id: string,
    decision: 'APPROVE' | 'REJECT'
  ) {
    if (!window.confirm(`Are you sure you want to ${decision.toLowerCase()} this payment?`)) {
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      await api(`/api/admin/payments/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          note: 'Reviewed from Super Admin panel'
        })
      });

      setMessage(`Payment ${decision.toLowerCase()}d.`);
      await loadDashboard();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment review failed');
    } finally {
      setLoading(false);
    }
  }

  if (!token || !user) {
    return (
      <div className="sa-login-page">
        <form className="sa-login-card" onSubmit={login}>
          <div className="sa-logo">AH</div>
          <div className="sa-eyebrow">ANIME HUB BANGLA</div>
          <h1>Super Admin</h1>
          <p>Sign in to access the platform control center.</p>

          <label>Email address</label>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Super Admin email"
          />

          <label>Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Your password"
          />

          {error && <div className="sa-error">{error}</div>}

          <button className="sa-primary" disabled={loading}>
            {loading ? 'Signing in...' : 'Secure Sign In'}
          </button>

          <a href="/">← Back to website</a>
          <small>Restricted access · Super Admin only</small>
        </form>
      </div>
    );
  }

  const card = (label: string, value: unknown, icon: typeof Users) => {
    const Icon = icon;

    return (
      <div className="sa-stat" key={label}>
        <div className="sa-stat-icon"><Icon size={20} /></div>
        <span>{label}</span>
        <strong>{String(value ?? '—')}</strong>
      </div>
    );
  };

  return (
    <div className="sa-layout">
      <aside className={`sa-sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sa-brand">
          <span className="sa-logo">AH</span>
          <div>
            <b>ANIME HUB</b>
            <small>SUPER ADMIN</small>
          </div>
          <button className="sa-close" onClick={() => setMenuOpen(false)}>
            <X />
          </button>
        </div>

        <div className="sa-nav-label">CONTROL CENTER</div>

        {initialSections.map(item => {
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              className={`sa-nav-item ${section === item.id ? 'active' : ''}`}
              onClick={() => {
                setSection(item.id);
                setMenuOpen(false);
                setError('');
                setMessage('');
              }}
            >
              <Icon size={18} />
              {item.label}
            </button>
          );
        })}

        <div className="sa-sidebar-bottom">
          <div className="sa-profile">
            <ShieldCheck />
            <div>
              <b>{user.displayName || 'Super Admin'}</b>
              <small>{user.email}</small>
            </div>
          </div>

          <button className="sa-logout" onClick={logout}>
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>

      <main className="sa-main">
        <header className="sa-topbar">
          <button className="sa-menu" onClick={() => setMenuOpen(!menuOpen)}>
            <Menu />
          </button>

          <div>
            <span className="sa-eyebrow">PLATFORM CONTROL CENTER</span>
            <h1>{initialSections.find(x => x.id === section)?.label}</h1>
          </div>

          <button
            className="sa-refresh"
            disabled={loading}
            onClick={loadDashboard}
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </header>

        {error && <div className="sa-error sa-notice"><AlertTriangle /> {error}</div>}
        {message && <div className="sa-success sa-notice"><CheckCircle /> {message}</div>}

        {section === 'overview' && (
          <>
            <div className="sa-welcome">
              <div>
                <h2>Welcome back, {user.displayName || 'Super Admin'}</h2>
                <p>Manage your Anime Hub Bangla platform from one place.</p>
              </div>
              <span className="sa-live"><i /> API dashboard</span>
            </div>

            <div className="sa-stats">
              {card('Total Anime', summary?.anime, Film)}
              {card('Total Episodes', summary?.episodes, Activity)}
              {card('Registered Users', summary?.users, Users)}
              {card('Payment Requests', payments.length, CreditCard)}
            </div>

            <div className="sa-grid">
              <section className="sa-panel">
                <h3><BarChart3 /> Platform overview</h3>
                <p>Anime catalogue: <b>{anime.length}</b> records loaded</p>
                <p>Payment requests: <b>{payments.length}</b></p>
                <p>Users loaded: <b>{users.length}</b></p>
                <p>Pending payments: <b>{payments.filter(p => p.status === 'PENDING').length}</b></p>
              </section>

              <section className="sa-panel">
                <h3><ShieldCheck /> Security status</h3>
                <p>Signed in as <b>SUPER_ADMIN</b></p>
                <p>Server-side role verification: <b>Enabled</b></p>
                <p>Website API: <b>{API}</b></p>
                <p>Dashboard data is loaded from the connected API.</p>
              </section>
            </div>
          </>
        )}

        {section === 'website' && (
          <section className="sa-panel">
            <h2><Settings /> Website Settings</h2>
            <p>Changes are saved to the existing site_settings database table.</p>

            <form className="sa-form" onSubmit={saveSettings}>
              <label>Website name</label>
              <input
                value={settings.siteName}
                onChange={e => setSettings({ ...settings, siteName: e.target.value })}
              />

              <label>Tagline</label>
              <input
                value={settings.tagline}
                onChange={e => setSettings({ ...settings, tagline: e.target.value })}
              />

              <label>Hero title</label>
              <input
                value={settings.heroTitle}
                onChange={e => setSettings({ ...settings, heroTitle: e.target.value })}
              />

              <label>Hero subtitle</label>
              <textarea
                value={settings.heroSubtitle}
                onChange={e => setSettings({ ...settings, heroSubtitle: e.target.value })}
              />

              <label>Announcement</label>
              <textarea
                value={settings.announcement}
                onChange={e => setSettings({ ...settings, announcement: e.target.value })}
              />

              <label>Contact email</label>
              <input
                type="email"
                value={settings.contactEmail}
                onChange={e => setSettings({ ...settings, contactEmail: e.target.value })}
              />

              <label className="sa-toggle">
                <input
                  type="checkbox"
                  checked={settings.maintenanceMode}
                  onChange={e => setSettings({
                    ...settings,
                    maintenanceMode: e.target.checked
                  })}
                />
                Enable maintenance mode
              </label>

              <button className="sa-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Save Website Settings'}
              </button>
            </form>

            <p className="sa-muted">
              Note: The settings API saves these values. The public homepage
              still needs to be connected to read and display them.
            </p>
          </section>
        )}

        {section === 'users' && (
          <section className="sa-panel">
            <h2><Users /> User Management</h2>
            <p>Registered accounts from the platform database.</p>

            <div className="sa-table-wrap">
              <table className="sa-table">
                <thead>
                  <tr>
                    <th>User</th><th>Email</th><th>Role</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(item => (
                    <tr key={item.id}>
                      <td>{item.displayName || 'User'}</td>
                      <td>{item.email}</td>
                      <td>{item.role}</td>
                      <td>{item.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!users.length && <p>No users loaded.</p>}
            </div>
          </section>
        )}

        {section === 'payments' && (
          <section className="sa-panel">
            <h2><CreditCard /> Payment Review</h2>
            <p>Verify each transaction in the provider's merchant dashboard before approving.</p>

            <div className="sa-table-wrap">
              <table className="sa-table">
                <thead>
                  <tr>
                    <th>User</th><th>Plan</th><th>Method</th>
                    <th>Reference</th><th>Amount</th><th>Status</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id}>
                      <td>{p.email}</td>
                      <td>{p.plan}</td>
                      <td>{p.paymentMethod}</td>
                      <td>{p.transactionReference}</td>
                      <td>৳{p.amountBdt}</td>
                      <td>{p.status}</td>
                      <td>
                        {p.status === 'PENDING' ? (
                          <div className="sa-actions">
                            <button onClick={() => reviewPayment(p.id, 'APPROVE')}>Approve</button>
                            <button onClick={() => reviewPayment(p.id, 'REJECT')}>Reject</button>
                          </div>
                        ) : 'Reviewed'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!payments.length && <p>No payment submissions found.</p>}
            </div>
          </section>
        )}

        {section === 'revenue' && (
          <div className="sa-grid">
            <section className="sa-panel">
              <h2><Wallet /> Revenue Summary</h2>
              <pre>{revenue ? JSON.stringify(revenue, null, 2) : 'Revenue data unavailable'}</pre>
              <p className="sa-muted">
                Imported advertising metrics and contracted sponsor values
                are not necessarily money received.
              </p>
            </section>

            <section className="sa-panel">
              <h2><BarChart3 /> Analytics</h2>
              <pre>{analytics ? JSON.stringify(analytics, null, 2) : 'Analytics unavailable'}</pre>
              <p className="sa-muted">
                Current playback analytics are event-based, not audited unique views.
              </p>
            </section>
          </div>
        )}

        {section === 'content' && (
          <section className="sa-panel">
            <h2><Film /> Content Overview</h2>
            <p>Anime catalogue records currently available to the Admin API.</p>

            <div className="sa-table-wrap">
              <table className="sa-table">
                <thead>
                  <tr><th>Title</th><th>Slug</th><th>Status</th><th>Published</th></tr>
                </thead>
                <tbody>
                  {anime.map(item => (
                    <tr key={item.id}>
                      <td>{item.title}</td>
                      <td>{item.slug}</td>
                      <td>{item.status}</td>
                      <td>{item.published ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!anime.length && <p>No anime records loaded.</p>}
            </div>
            <a className="sa-link" href="/admin">Open existing content manager →</a>
          </section>
        )}

        {section === 'system' && (
          <section className="sa-panel">
            <h2><ShieldCheck /> System & Security</h2>
            <div className="sa-system-row">
              <span>API endpoint</span><b>{API}</b>
            </div>
            <div className="sa-system-row">
              <span>Current account role</span><b>{user.role}</b>
            </div>
            <div className="sa-system-row">
              <span>Authentication</span><b>Bearer token</b>
            </div>
            <div className="sa-system-row">
              <span>Website settings API</span><b>Connected when available</b>
            </div>
            <div className="sa-system-row">
              <span>Database</span><b>Check API health endpoint</b>
            </div>
            <a className="sa-link" href={`${API}/api/health`} target="_blank" rel="noreferrer">
              Check API health →
            </a>
            <p className="sa-muted">
              Backup automation, MFA, provider integrations and full system
              monitoring are not enabled by this dashboard yet.
            </p>
          </section>
        )}

        <footer className="sa-footer">
          Anime Hub Bangla · Super Admin Control Center
        </footer>
      </main>
    </div>
  );
}
