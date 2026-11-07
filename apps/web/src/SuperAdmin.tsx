import PartnerManagement from './PartnerManagement';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Activity, BarChart3, CreditCard, Film, Globe, LayoutDashboard,
  LogOut, RefreshCw, Settings, ShieldCheck, Users, Wallet,
  AlertTriangle, CheckCircle, Menu, X, Search, UserCog,
  Megaphone, Handshake, MessageSquare, Server, ExternalLink,
  Database, Clock, Crown, Eye
} from 'lucide-react';

const API = (
  import.meta.env.VITE_API_URL ||
  'https://anime-hub-bangla.onrender.com'
).replace(/\/$/, '');

type Section =
  | 'overview'
  | 'website'
  | 'users'
  | 'payments'
  | 'revenue'
  | 'content'
  | 'staff'
  | 'operations'
  | 'system';
  | 'collaborations'

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

const sections: {
  id: Section;
  label: string;
  icon: typeof LayoutDashboard;
  group: string;
}[] = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard, group: 'MAIN' },
  { id: 'website', label: 'Website CMS', icon: Globe, group: 'MANAGEMENT' },
  { id: 'users', label: 'User Management', icon: Users, group: 'MANAGEMENT' },
  { id: 'staff', label: 'Staff & Roles', icon: UserCog, group: 'MANAGEMENT' },
  { id: 'payments', label: 'Payments', icon: CreditCard, group: 'FINANCE' },
  { id: 'revenue', label: 'Revenue & Analytics', icon: Wallet, group: 'FINANCE' },
  { id: 'content', label: 'Anime & Content', icon: Film, group: 'CONTENT' },
  { id: 'operations', label: 'Platform Operations', icon: Activity, group: 'CONTENT' },
  { id: 'system', label: 'System & Security', icon: ShieldCheck, group: 'SYSTEM' }
];

function formatMoney(value: unknown) {
  const amount = Number(value || 0);
  return `৳${amount.toLocaleString('en-BD')}`;
}

function StatCard({
  label,
  value,
  icon: Icon,
  description
}: {
  label: string;
  value: unknown;
  icon: typeof Users;
  description?: string;
}) {
  return (
    <article className="sa-stat">
      <div className="sa-stat-icon"><Icon size={20} /></div>
      <span>{label}</span>
      <strong>{String(value ?? '—')}</strong>
      {description && <small>{description}</small>}
    </article>
  );
}

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

  const [health, setHealth] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');

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
      throw new Error(
        data.error || `Request failed (${response.status})`
      );
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
    setAnime([]);
  }, []);

  const loadHealth = useCallback(async () => {
    try {
      const response = await fetch(`${API}/api/health`);
      const data = await response.json().catch(() => ({}));

      setHealth({
        online: response.ok,
        ...data
      });
    } catch {
      setHealth({
        online: false,
        database: 'unreachable'
      });
    }
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

    const summaryData = get(0);
    const userData = get(1);
    const paymentData = get(2);
    const revenueData = get(3);
    const analyticsData = get(4);
    const animeData = get(5);
    const settingsData = get(6);

    if (summaryData) setSummary(summaryData);
    if (userData) setUsers(userData.data || []);
    if (paymentData) setPayments(paymentData.data || []);
    if (revenueData) setRevenue(revenueData);
    if (analyticsData) setAnalytics(analyticsData);
    if (animeData) setAnime(animeData.data || []);

    if (settingsData?.data) {
      setSettings({
        ...defaultSettings,
        ...settingsData.data
      });
    }

    if (results.every(result => result.status === 'rejected')) {
      setError(
        'Dashboard data could not be loaded. Check API and database.'
      );
    } else if (results.some(result => result.status === 'rejected')) {
      setMessage(
        'Some dashboard modules could not load. Check the relevant section.'
      );
    }

    await loadHealth();
  }, [api, loadHealth]);

  useEffect(() => {
    if (!token) return;

    let active = true;

    api('/api/auth/me')
      .then(result => {
        if (!active) return;

        if (result.user?.role !== 'SUPER_ADMIN') {
          setError(
            'Access denied. Super Admin permission is required.'
          );
          logout();
          return;
        }

        setUser(result.user);
      })
      .catch(() => {
        if (active) {
          logout();
          setError('Your session expired. Please sign in again.');
        }
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

    if (loading) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: email.trim(), password })
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || 'Login failed.');
      }

      if (!result.token || result.user?.role !== 'SUPER_ADMIN') {
        throw new Error(
          'This account is not an authorized Super Admin account.'
        );
      }

      localStorage.setItem('ahb_admin_token', result.token);
      localStorage.removeItem('ahb_token');

      setToken(result.token);
      setUser(result.user);
      setPassword('');
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Login failed.'
      );
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
      setError(
        e instanceof Error ? e.message : 'Could not save settings.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function reviewPayment(
    id: string,
    decision: 'APPROVE' | 'REJECT'
  ) {
    const confirmed = window.confirm(
      `Are you sure you want to ${decision.toLowerCase()} this payment?`
    );

    if (!confirmed) return;

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
      setError(
        e instanceof Error ? e.message : 'Payment review failed.'
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = useMemo(() => {
    return users.filter(item => {
      const term = search.toLowerCase();

      const matchesSearch =
        !term ||
        item.email.toLowerCase().includes(term) ||
        (item.displayName || '').toLowerCase().includes(term) ||
        item.id.toLowerCase().includes(term);

      const matchesRole =
        userFilter === 'ALL' || item.role === userFilter;

      return matchesSearch && matchesRole;
    });
  }, [users, search, userFilter]);

  const filteredPayments = useMemo(() => {
    return payments.filter(payment => {
      const term = search.toLowerCase();

      const matchesSearch =
        !term ||
        payment.email.toLowerCase().includes(term) ||
        payment.transactionReference.toLowerCase().includes(term);

      const matchesStatus =
        paymentFilter === 'ALL' ||
        payment.status === paymentFilter;

      return matchesSearch && matchesStatus;
    });
  }, [payments, search, paymentFilter]);

  const pendingPayments = payments.filter(
    payment => payment.status === 'PENDING'
  );

  const staffUsers = users.filter(
    item => item.role !== 'USER' && item.role !== 'SUPER_ADMIN'
  );

  if (!token || !user) {
    return (
      <div className="sa-login-page">
        <form className="sa-login-card" onSubmit={login}>
          <div className="sa-logo">AH</div>
          <div className="sa-eyebrow">ANIME HUB BANGLA</div>

          <h1>Super Admin</h1>

          <p>
            Sign in to access the complete platform control center.
          </p>

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

          {error && (
            <div className="sa-error">{error}</div>
          )}

          <button className="sa-primary" disabled={loading}>
            {loading ? 'Signing in...' : 'Secure Sign In'}
          </button>

          <a href="/">← Back to website</a>

          <small>
            Restricted access · Super Admin only
          </small>
        </form>
      </div>
    );
  }

  const currentSection = sections.find(
    item => item.id === section
  );

  return (
    <div className="sa-layout">
      <aside className={`sa-sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sa-brand">
          <span className="sa-logo">AH</span>

          <div>
            <b>ANIME HUB</b>
            <small>SUPER ADMIN</small>
          </div>

          <button
            className="sa-close"
            onClick={() => setMenuOpen(false)}
          >
            <X />
          </button>
        </div>

        {['MAIN', 'MANAGEMENT', 'FINANCE', 'CONTENT', 'SYSTEM'].map(group => {
          const groupItems = sections.filter(
            item => item.group === group
          );

          return (
            <div key={group}>
              <div className="sa-nav-label">{group}</div>

              {groupItems.map(item => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    className={`sa-nav-item ${
                      section === item.id ? 'active' : ''
                    }`}
                    onClick={() => {
                      setSection(item.id);
                      setMenuOpen(false);
                      setError('');
                      setMessage('');
                      setSearch('');
                    }}
                  >
                    <Icon size={18} />
                    {item.label}
                  </button>
                );
              })}
            </div>
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
          <button
            className="sa-menu"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Menu />
          </button>

          <div>
            <span className="sa-eyebrow">
              PLATFORM CONTROL CENTER
            </span>
            <h1>{currentSection?.label}</h1>
          </div>

          <button
            className="sa-refresh"
            disabled={loading}
            onClick={loadDashboard}
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </header>

        {error && (
          <div className="sa-error sa-notice">
            <AlertTriangle /> {error}
          </div>
        )}

        {message && (
          <div className="sa-success sa-notice">
            <CheckCircle /> {message}
          </div>
        )}

        {/* DASHBOARD */}

        {section === 'overview' && (
          <>
            <div className="sa-welcome">
              <div>
                <h2>
                  Welcome back, {user.displayName || 'Super Admin'}
                </h2>
                <p>
                  Manage Anime Hub Bangla from one central workspace.
                </p>
              </div>

              <span className="sa-live">
                <i /> {health?.online ? 'API Online' : 'API Status Unknown'}
              </span>
            </div>

            <div className="sa-stats">
              <StatCard
                label="Total Anime"
                value={summary?.anime}
                icon={Film}
              />

              <StatCard
                label="Total Episodes"
                value={summary?.episodes}
                icon={Activity}
              />

              <StatCard
                label="Registered Users"
                value={summary?.users}
                icon={Users}
              />

              <StatCard
                label="Pending Payments"
                value={pendingPayments.length}
                icon={CreditCard}
              />
            </div>

            <div className="sa-grid">
              <section className="sa-panel">
                <h3><BarChart3 /> Platform Overview</h3>

                <div className="sa-system-row">
                  <span>Anime catalogue</span>
                  <b>{anime.length} loaded</b>
                </div>

                <div className="sa-system-row">
                  <span>Registered accounts</span>
                  <b>{users.length}</b>
                </div>

                <div className="sa-system-row">
                  <span>Staff accounts</span>
                  <b>{staffUsers.length}</b>
                </div>

                <div className="sa-system-row">
                  <span>Payment submissions</span>
                  <b>{payments.length}</b>
                </div>

                <div className="sa-system-row">
                  <span>Pending reviews</span>
                  <b>{pendingPayments.length}</b>
                </div>
              </section>

              <section className="sa-panel">
                <h3><Server /> Service Status</h3>

                <div className="sa-system-row">
                  <span>API server</span>
                  <b>{health?.online ? 'Online' : 'Unavailable'}</b>
                </div>

                <div className="sa-system-row">
                  <span>Database</span>
                  <b>{String(health?.database || 'Not reported')}</b>
                </div>

                <div className="sa-system-row">
                  <span>Current role</span>
                  <b>SUPER_ADMIN</b>
                </div>

                <div className="sa-system-row">
                  <span>Authentication</span>
                  <b>Bearer token</b>
                </div>

                <a
                  className="sa-link"
                  href={`${API}/api/health`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View API health <ExternalLink size={14} />
                </a>
              </section>
            </div>

            <section className="sa-panel">
              <h3><Clock /> Pending Payment Reviews</h3>

              {pendingPayments.length ? (
                <div className="sa-table-wrap">
                  <table className="sa-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Plan</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {pendingPayments.slice(0, 5).map(payment => (
                        <tr key={payment.id}>
                          <td>{payment.email}</td>
                          <td>{payment.plan}</td>
                          <td>{formatMoney(payment.amountBdt)}</td>
                          <td>{payment.paymentMethod}</td>
                          <td>
                            <button
                              onClick={() => {
                                setSection('payments');
                                setPaymentFilter('PENDING');
                              }}
                            >
                              Review
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>No pending payment reviews.</p>
              )}
            </section>
          </>
        )}

        {/* WEBSITE CMS */}

        {section === 'website' && (
          <section className="sa-panel">
            <h2><Settings /> Website CMS & Settings</h2>

            <p>
              Update the settings supported by the existing website
              settings API.
            </p>

            <form className="sa-form" onSubmit={saveSettings}>
              <label>Website name</label>
              <input
                value={settings.siteName}
                onChange={e =>
                  setSettings({
                    ...settings,
                    siteName: e.target.value
                  })
                }
              />

              <label>Tagline</label>
              <input
                value={settings.tagline}
                onChange={e =>
                  setSettings({
                    ...settings,
                    tagline: e.target.value
                  })
                }
              />

              <label>Hero title</label>
              <input
                value={settings.heroTitle}
                onChange={e =>
                  setSettings({
                    ...settings,
                    heroTitle: e.target.value
                  })
                }
              />

              <label>Hero subtitle</label>
              <textarea
                value={settings.heroSubtitle}
                onChange={e =>
                  setSettings({
                    ...settings,
                    heroSubtitle: e.target.value
                  })
                }
              />

              <label>Announcement</label>
              <textarea
                value={settings.announcement}
                onChange={e =>
                  setSettings({
                    ...settings,
                    announcement: e.target.value
                  })
                }
              />

              <label>Contact email</label>
              <input
                type="email"
                value={settings.contactEmail}
                onChange={e =>
                  setSettings({
                    ...settings,
                    contactEmail: e.target.value
                  })
                }
              />

              <label className="sa-toggle">
                <input
                  type="checkbox"
                  checked={settings.maintenanceMode}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      maintenanceMode: e.target.checked
                    })
                  }
                />
                Enable maintenance mode
              </label>

              <button className="sa-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Save Website Settings'}
              </button>
            </form>

            <p className="sa-muted">
              The settings API stores these values. The public
              homepage must read these settings to display changes.
            </p>
          </section>
        )}
        
        {/* COLLABORATION PARTNERS */}

{section === 'collaborations' && (
  <PartnerManagement token={token} />
)}

        {/* USER MANAGEMENT */}

        {section === 'users' && (
          <section className="sa-panel">
            <h2><Users /> User Management</h2>

            <p>
              Search registered accounts and review their current roles
              and account statuses.
            </p>

            <div className="sa-toolbar">
              <div className="sa-search">
                <Search size={17} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search name, email or ID..."
                />
              </div>

              <select
                value={userFilter}
                onChange={e => setUserFilter(e.target.value)}
              >
                <option value="ALL">All roles</option>
                <option value="USER">Users</option>
                <option value="ADMIN">Admins</option>
                <option value="MODERATOR">Moderators</option>
                <option value="CONTENT_MANAGER">Content Managers</option>
                <option value="ADVERTISEMENT_MANAGER">Ad Managers</option>
                <option value="COLLABORATION_MANAGER">Collaboration Managers</option>
                <option value="ANALYST">Analysts</option>
                <option value="SUPER_ADMIN">Super Admins</option>
              </select>
            </div>

            <div className="sa-table-wrap">
              <table className="sa-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Account ID</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredUsers.map(item => (
                    <tr key={item.id}>
                      <td>{item.displayName || 'User'}</td>
                      <td>{item.email}</td>
                      <td>{item.role}</td>
                      <td>{item.status}</td>
                      <td>{item.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!filteredUsers.length && (
                <p>No matching users found.</p>
              )}
            </div>

            <p className="sa-muted">
              User role and suspension changes require a protected
              backend permission-management endpoint. This view does
              not pretend to change account permissions.
            </p>
          </section>
        )}

        {/* STAFF */}

        {section === 'staff' && (
          <section className="sa-panel">
            <h2><UserCog /> Staff & Role Overview</h2>

            <p>
              Review staff accounts and their assigned roles.
              Super Admin accounts are excluded from staff totals.
            </p>

            <div className="sa-stats">
              <StatCard
                label="Total Staff"
                value={staffUsers.length}
                icon={Users}
              />

              <StatCard
                label="Admins"
                value={staffUsers.filter(x => x.role === 'ADMIN').length}
                icon={ShieldCheck}
              />

              <StatCard
                label="Moderators"
                value={staffUsers.filter(x => x.role === 'MODERATOR').length}
                icon={MessageSquare}
              />

              <StatCard
                label="Content Managers"
                value={staffUsers.filter(x => x.role === 'CONTENT_MANAGER').length}
                icon={Film}
              />
            </div>

            <div className="sa-table-wrap">
              <table className="sa-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {staffUsers.map(member => (
                    <tr key={member.id}>
                      <td>{member.displayName || 'Staff'}</td>
                      <td>{member.email}</td>
                      <td>{member.role}</td>
                      <td>{member.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!staffUsers.length && (
                <p>No staff accounts found.</p>
              )}
            </div>

            <a className="sa-link" href="/admin">
              Open Admin Panel for staff operations
              <ExternalLink size={14} />
            </a>

            <p className="sa-muted">
              Role changes and staff creation must be handled through
              server-authorized endpoints. The Super Admin interface
              will not expose an unverified permission action.
            </p>
          </section>
        )}

        {/* PAYMENTS */}

        {section === 'payments' && (
          <section className="sa-panel">
            <h2><CreditCard /> Payment Management</h2>

            <p>
              Verify transactions in the relevant merchant account
              before approving a payment.
            </p>

            <div className="sa-toolbar">
              <div className="sa-search">
                <Search size={17} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search email or transaction ID..."
                />
              </div>

              <select
                value={paymentFilter}
                onChange={e => setPaymentFilter(e.target.value)}
              >
                <option value="ALL">All payments</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            <div className="sa-stats">
              <StatCard
                label="All Submissions"
                value={payments.length}
                icon={CreditCard}
              />

              <StatCard
                label="Pending"
                value={pendingPayments.length}
                icon={Clock}
              />

              <StatCard
                label="Approved"
                value={payments.filter(x => x.status === 'APPROVED').length}
                icon={CheckCircle}
              />

              <StatCard
                label="Rejected"
                value={payments.filter(x => x.status === 'REJECTED').length}
                icon={AlertTriangle}
              />
            </div>

            <div className="sa-table-wrap">
              <table className="sa-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Plan</th>
                    <th>Method</th>
                    <th>Reference</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredPayments.map(payment => (
                    <tr key={payment.id}>
                      <td>{payment.email}</td>
                      <td>{payment.plan}</td>
                      <td>{payment.paymentMethod}</td>
                      <td>{payment.transactionReference}</td>
                      <td>{formatMoney(payment.amountBdt)}</td>
                      <td>{payment.status}</td>
                      <td>
                        {payment.status === 'PENDING' ? (
                          <div className="sa-actions">
                            <button
                              disabled={loading}
                              onClick={() =>
                                reviewPayment(payment.id, 'APPROVE')
                              }
                            >
                              Approve
                            </button>

                            <button
                              disabled={loading}
                              onClick={() =>
                                reviewPayment(payment.id, 'REJECT')
                              }
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          'Reviewed'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!filteredPayments.length && (
                <p>No matching payment submissions.</p>
              )}
            </div>
          </section>
        )}

        {/* REVENUE */}

        {section === 'revenue' && (
          <div className="sa-grid">
            <section className="sa-panel">
              <h2><Wallet /> Revenue Summary</h2>

              {revenue ? (
                <pre>{JSON.stringify(revenue, null, 2)}</pre>
              ) : (
                <p>Revenue data unavailable.</p>
              )}

              <p className="sa-muted">
                Payment requests, pending transactions, advertising
                estimates and actual received revenue are different
                figures. Only verified financial records should be
                treated as received revenue.
              </p>
            </section>

            <section className="sa-panel">
              <h2><BarChart3 /> Platform Analytics</h2>

              {analytics ? (
                <pre>{JSON.stringify(analytics, null, 2)}</pre>
              ) : (
                <p>Analytics unavailable.</p>
              )}

              <p className="sa-muted">
                Playback analytics depend on the events collected
                by the backend. They should not be treated as audited
                unique viewers unless deduplication is implemented.
              </p>
            </section>
          </div>
        )}

        
        {/* REVENUE */}

        {section === 'revenue' && (
          <div className="sa-analytics">
            <section className="sa-panel">
              <div className="sa-analytics-heading">
                <div>
                  <h2><Wallet /> Revenue Summary</h2>
                  <p className="sa-muted">
                    Financial records from the platform API.
                  </p>
                </div>
                <span className="sa-live">Live API data</span>
              </div>

              {revenue ? (
                <pre>{JSON.stringify(revenue, null, 2)}</pre>
              ) : (
                <p>Revenue data unavailable.</p>
              )}

              <p className="sa-muted">
                Pending payments are not confirmed revenue.
                Only verified financial records count as received income.
              </p>
            </section>

            <section className="sa-panel">
              <div className="sa-analytics-heading">
                <div>
                  <h2><BarChart3 /> Playback Analytics</h2>
                  <p className="sa-muted">
                    Activity collected during the last {analytics?.period || '30 days'}.
                  </p>
                </div>
                <span className="sa-live">Last 30 days</span>
              </div>

              {analytics ? (
                <>
                  <div className="sa-stats">
                    <StatCard
                      label="Total Plays"
                      value={analytics.totals?.plays ?? 0}
                      icon={Activity}}
                    />
                    <StatCard
                      label="Completions"
                      value={analytics.totals?.completions ?? 0}
                      icon={CheckCircle}
                    />
                    <StatCard
                      label="Active Viewers"
                      value={analytics.totals?.active_viewers ?? 0}
                      icon={Users}
                    />
                    <StatCard
                      label="Watch Time"
                      value={`${Math.round(Number(analytics.daily?.reduce(
                        (sum: number, item: any) =>
                          sum + Number(item.watched_seconds || 0), 0
                      ) || 0) / 3600)} hrs`}
                      icon={Clock}
                    />
                  </div>

                  <div className="sa-grid">
                    <div className="sa-panel">
                      <h3><Activity /> Daily Playback Activity</h3>

                      {analytics.daily?.length ? (
                        <div className="sa-activity-list">
                          {analytics.daily.slice(-14).map((item: any) => {
                            const maxPlays = Math.max(
                              1,
                              ...analytics.daily.map((day: any) =>
                                Number(day.plays || 0)
                              )
                            );

                            const percentage =
                              Number(item.plays || 0) / maxPlays * 100;

                            return (
                              <div className="sa-activity-row" key={String(item.day)}>
                                <div>
                                  <span>{String(item.day).slice(0, 10)}</span>
                                  <b>{Number(item.plays || 0)} plays</b>
                                </div>
                                <div className="sa-activity-track">
                                  <i style={{ width: `${percentage}%` }} />
                                </div>
                                <small>
                                  {Number(item.completions || 0)} completed
                                </small>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p>No playback activity recorded yet.</p>
                      )}
                    </div>

                    <div className="sa-panel">
                      <h3><Film /> Top Anime</h3>

                      {analytics.topAnime?.length ? (
                        <div className="sa-ranking-list">
                          {analytics.topAnime.map((item: any, index: number) => (
                            <div className="sa-ranking-row" key={`${item.title}-${index}`}>
                              <span>{index + 1}</span>
                              <b>{item.title}</b>
                              <strong>
                                {Number(item.plays || 0).toLocaleString()}
                              </strong>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p>No ranking data available yet.</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <p>Analytics data unavailable. Check the API connection.</p>
              )}

              <p className="sa-muted">
                These figures represent recorded playback events.
                They are not the same as website visits or verified unique visitors.
              </p>
            </section>
          </div>
        )}


        {/* OPERATIONS */}

        {section === 'operations' && (
          <>
            <section className="sa-panel">
              <h2><Activity /> Platform Operations</h2>

              <p>
                Open the existing Admin Panel modules for operational
                tasks. These links do not create fake integrations.
              </p>

              <div className="sa-operations-grid">
                <a className="sa-operation-card" href="/admin">
                  <Megaphone />
                  <b>Advertisement Management</b>
                  <small>Ad campaigns, placements and reports</small>
                  <span>Open Admin Panel →</span>
                </a>

                <a className="sa-operation-card" href="/admin">
                  <Handshake />
                  <b>Sponsors & Partnerships</b>
                  <small>Manage sponsor and collaboration workflows</small>
                  <span>Open Admin Panel →</span>
                </a>

                <a className="sa-operation-card" href="/admin">
                  <MessageSquare />
                  <b>Community Moderation</b>
                  <small>Review community content and reports</small>
                  <span>Open Admin Panel →</span>
                </a>

                <a className="sa-operation-card" href="/admin">
                  <Film />
                  <b>Content Operations</b>
                  <small>Anime catalogue and episode management</small>
                  <span>Open Admin Panel →</span>
                </a>

                <a className="sa-operation-card" href="/admin">
                  <Users />
                  <b>Staff Workspace</b>
                  <small>Open the staff administration tools</small>
                  <span>Open Admin Panel →</span>
                </a>

                <a className="sa-operation-card" href="/admin">
                  <CreditCard />
                  <b>Payment Operations</b>
                  <small>Review and manage payment submissions</small>
                  <span>Open Admin Panel →</span>
                </a>
              </div>
            </section>
          </>
        )}

        {/* SYSTEM */}

        {section === 'system' && (
          <section className="sa-panel">
            <h2><ShieldCheck /> System & Security</h2>

            <div className="sa-system-row">
              <span><Server size={17} /> API endpoint</span>
              <b>{API}</b>
            </div>

            <div className="sa-system-row">
              <span><Activity size={17} /> API server</span>
              <b>{health?.online ? 'Online' : 'Unavailable'}</b>
            </div>

            <div className="sa-system-row">
              <span><Database size={17} /> Database</span>
              <b>{String(health?.database || 'Not reported')}</b>
            </div>

            <div className="sa-system-row">
              <span><ShieldCheck size={17} /> Current account role</span>
              <b>{user.role}</b>
            </div>

            <div className="sa-system-row">
              <span><Crown size={17} /> Access level</span>
              <b>Super Admin</b>
            </div>

            <div className="sa-system-row">
              <span><Settings size={17} /> Website settings API</span>
              <b>Available when API responds</b>
            </div>

            <a
              className="sa-link"
              href={`${API}/api/health`}
              target="_blank"
              rel="noreferrer"
            >
              Open API health endpoint
              <ExternalLink size={14} />
            </a>

            <button
              className="sa-primary"
              onClick={loadHealth}
            >
              <RefreshCw size={16} /> Check services again
            </button>

            <p className="sa-muted">
              Backup automation, multi-factor authentication,
              provider integrations and advanced audit monitoring
              must be configured on the backend before they can
              be reported as enabled.
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
