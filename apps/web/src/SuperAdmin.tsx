
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity, BarChart3, Bell, CheckCircle, ChevronRight, Clock,
  CreditCard, Database, ExternalLink, Film, Globe, Handshake,
  LayoutDashboard, Lock, LogOut, Menu, Monitor, RefreshCw,
  Search, Server, Settings, Shield, ShieldCheck, Users, Wallet,
  X, Crown, Layers, Megaphone, MessageSquare, UserCog, Plug,
  HardDrive, Eye, Palette, FileText, AlertTriangle, Smartphone
} from 'lucide-react';

import Admin from './Admin';
import PartnerManagement from './PartnerManagement';
import HomepageCovers from './HomepageCovers';

import { API, loginError } from './api';

type RoleUser = {
  id: string;
  email: string;
  displayName?: string;
  role: string;
  status: string;
};

type Payment = {
  id: string;
  email: string;
  displayName?: string;
  plan: string;
  paymentMethod: string;
  transactionReference: string;
  amountBdt: number | string;
  status: string;
  createdAt: string;
};

type Anime = {
  id: string;
  title: string;
  slug: string;
  published: boolean;
};

type SettingsData = {
  siteName: string;
  tagline: string;
  announcement: string;
  heroTitle: string;
  heroSubtitle: string;
  contactEmail: string;
  maintenanceMode: boolean;
  showMovies: boolean;
  showStudios: boolean;
  showPartners: boolean;
  showAbout: boolean;
  accentTheme: 'peach' | 'violet' | 'mint';
  androidApkUrl: string;
  androidVersion: string;
  paymentInstructions: string;
  bkashNumber: string;
  nagadNumber: string;
  monthlyPriceBdt: number;
  yearlyPriceBdt: number;
};

const defaultSettings: SettingsData = {
  siteName: 'Anime Hub Bangla',
  tagline: 'Your Anime. Your Language.',
  announcement: '',
  heroTitle: 'Your Anime. Your Language.',
  heroSubtitle: 'Discover anime stories in Bangla.',
  contactEmail: '',
  maintenanceMode: false,
  showMovies: true,
  showStudios: true,
  showPartners: true,
  showAbout: true,
  accentTheme: 'peach',
  androidApkUrl: '',
  androidVersion: '',
  paymentInstructions: '',
  bkashNumber: '',
  nagadNumber: '',
  monthlyPriceBdt: 0,
  yearlyPriceBdt: 0
};

type Section =
  | 'overview'
  | 'website'
  | 'android'
  | 'collaborations'
  | 'users'
  | 'payments'
  | 'revenue'
  | 'content'
  | 'operations'
  | 'staff'
  | 'system'
  | 'future';

const nav: {
  id: Section;
  label: string;
  group: string;
  icon: typeof LayoutDashboard;
}[] = [
  { id: 'overview', label: 'Dashboard Overview', group: 'MAIN', icon: LayoutDashboard },
  { id: 'website', label: 'Website CMS', group: 'WEBSITE', icon: Globe },
  { id: 'android', label: 'Android App', group: 'WEBSITE', icon: Smartphone },
  { id: 'collaborations', label: 'Collaboration Partners', group: 'WEBSITE', icon: Handshake },
  { id: 'content', label: 'Anime & Episodes', group: 'CONTENT', icon: Film },
  { id: 'operations', label: 'Platform Operations', group: 'CONTENT', icon: Layers },
  { id: 'users', label: 'User Management', group: 'MANAGEMENT', icon: Users },
  { id: 'staff', label: 'Staff & Permissions', group: 'MANAGEMENT', icon: UserCog },
  { id: 'payments', label: 'Payments', group: 'FINANCE', icon: CreditCard },
  { id: 'revenue', label: 'Revenue & Analytics', group: 'FINANCE', icon: Wallet },
  { id: 'system', label: 'System & Security', group: 'SYSTEM', icon: ShieldCheck },
  { id: 'future', label: 'Future Integrations', group: 'SYSTEM', icon: Plug }
];

const groups = ['MAIN', 'WEBSITE', 'CONTENT', 'MANAGEMENT', 'FINANCE', 'SYSTEM'];

const panelStyle: React.CSSProperties = {
  background: '#171a2a',
  border: '1px solid #303447',
  borderRadius: 16,
  padding: 22,
  minWidth: 0
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#0b0d19',
  color: '#f5f5f5',
  border: '1px solid #34343e',
  borderRadius: 9,
  padding: '12px 13px',
  outline: 'none',
  marginTop: 7
};

const buttonStyle: React.CSSProperties = {
  background: '#ffb79c',
  color: '#17130a',
  border: 0,
  borderRadius: 9,
  padding: '11px 16px',
  fontWeight: 800,
  cursor: 'pointer'
};

function money(value: unknown) {
  return `৳${Number(value || 0).toLocaleString('en-BD')}`;
}

function Card({
  title,
  value,
  icon: Icon,
  detail
}: {
  title: string;
  value: ReactNode;
  icon: typeof Users;
  detail?: string;
}) {
  return (
    <div style={{ ...panelStyle, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#aaa', fontSize: 13 }}>{title}</span>
        <Icon size={20} color="#ffb79c" />
      </div>
      <strong style={{ fontSize: 28, color: '#fff' }}>{value}</strong>
      {detail && <small style={{ color: '#888' }}>{detail}</small>}
    </div>
  );
}

function SectionTitle({
  title,
  description,
  action
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 14,
      flexWrap: 'wrap',
      marginBottom: 20
    }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 23 }}>{title}</h2>
        {description && (
          <p style={{ color: '#999', margin: '7px 0 0', lineHeight: 1.6 }}>
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

function Status({ value }: { value: string }) {
  const good = ['ACTIVE', 'APPROVED', 'ONLINE', 'PUBLISHED'].includes(
    String(value).toUpperCase()
  );

  return (
    <span style={{
      display: 'inline-block',
      borderRadius: 30,
      padding: '5px 9px',
      fontSize: 11,
      fontWeight: 800,
      background: good ? '#123324' : '#332719',
      color: good ? '#70e0a0' : '#e9c27b'
    }}>
      {value || 'UNKNOWN'}
    </span>
  );
}

export default function SuperAdmin() {
  const [token, setToken] = useState(
    localStorage.getItem('ahb_admin_token') || ''
  );

  const [user, setUser] = useState<RoleUser | null>(null);
  const [section, setSection] = useState<Section>('overview');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [summary, setSummary] = useState<any>(null);
  const [users, setUsers] = useState<RoleUser[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [anime, setAnime] = useState<Anime[]>([]);
  const [revenue, setRevenue] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);

  const [settings, setSettings] =
    useState<SettingsData>(defaultSettings);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const [search, setSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');

  const api = useCallback(async (
    path: string,
    options: RequestInit = {}
  ) => {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        ...(options.body && !(options.body instanceof FormData)
          ? { 'Content-Type': 'application/json' }
          : {}),
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

  const loadHealth = useCallback(async () => {
    try {
      const response = await fetch(`${API}/api/health`);
      const data = await response.json().catch(() => ({}));
      setHealth({ online: response.ok, ...data });
    } catch {
      setHealth({ online: false, database: 'unreachable' });
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
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

    const value = (index: number) =>
      results[index].status === 'fulfilled'
        ? results[index].value
        : null;

    const summaryData = value(0);
    const userData = value(1);
    const paymentData = value(2);
    const revenueData = value(3);
    const analyticsData = value(4);
    const animeData = value(5);
    const settingsData = value(6);

    if (summaryData) setSummary(summaryData);
    if (userData) setUsers(userData.data || []);
    if (paymentData) setPayments(paymentData.data || []);
    if (revenueData) setRevenue(revenueData);
    if (analyticsData) setAnalytics(analyticsData);
    if (animeData) setAnime(animeData.data || []);

    if (settingsData?.data) {
      const clean = { ...defaultSettings };
      for (const key of Object.keys(defaultSettings) as (keyof SettingsData)[]) {
        const value = settingsData.data[key];
        if (typeof value === typeof defaultSettings[key]) {
          (clean as unknown as Record<string, unknown>)[key] = value;
        }
      }
      setSettings(clean);
      setSettingsLoaded(true);
    } else {
      setSettingsLoaded(false);
    }

    const failed = results.filter(x => x.status === 'rejected').length;

    if (failed === results.length) {
      setError('Dashboard data could not be loaded. Check API and database.');
    } else if (failed > 0) {
      setMessage(`${failed} dashboard module(s) are currently unavailable.`);
    } else {
      setMessage('');
    }

    await loadHealth();
    setLoading(false);
  }, [api, loadHealth]);

  const logout = useCallback(() => {
    localStorage.removeItem('ahb_admin_token');
    setToken('');
    setUser(null);
    setSummary(null);
    setUsers([]);
    setPayments([]);
    setAnime([]);
    setRevenue(null);
    setAnalytics(null);
    setSection('overview');
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }

    let active = true;

    api('/api/auth/me')
      .then(result => {
        if (!active) return;

        if (result.user?.role !== 'SUPER_ADMIN') {
          logout();
          setError('Access denied. Super Admin permission is required.');
          return;
        }

        setUser(result.user);
      })
      .catch(err => {
        if (!active) return;
        const message = err instanceof Error ? err.message : '';
        if (/expired|invalid session|authentication required|account changed/i.test(message)) {
          logout();
          setError('Your session expired. Please sign in again.');
        } else {
          setError('Could not verify your session. Check your connection and refresh; your session has been kept.');
        }
      });

    return () => {
      active = false;
    };
  }, [token, api, logout]);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      void loadDashboard();
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || 'Login failed.');
      }

      if (!result.token || result.user?.role !== 'SUPER_ADMIN') {
        throw new Error('This account is not an authorized Super Admin account.');
      }

      localStorage.setItem('ahb_admin_token', result.token);
      setToken(result.token);
      setUser(result.user);
      setPassword('');
    } catch (e) {
      setError(loginError(e));
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

      await loadDashboard();
      setMessage('Website settings saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save settings.');
    } finally {
      setLoading(false);
    }
  }

  async function reviewPayment(id: string, decision: 'APPROVE' | 'REJECT') {
    if (!window.confirm(`Confirm ${decision.toLowerCase()} payment?`)) return;

    setLoading(true);
    setError('');
    setMessage('');

    try {
      await api(`/api/admin/payments/${encodeURIComponent(id)}/review`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          note: 'Reviewed from Super Admin Control Center'
        })
      });

      setMessage(`Payment ${decision.toLowerCase()}d.`);
      await loadDashboard();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment review failed.');
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = useMemo(() => {
    const term = search.toLowerCase();

    return users.filter(item => {
      const matches =
        !term ||
        item.email?.toLowerCase().includes(term) ||
        item.displayName?.toLowerCase().includes(term) ||
        item.id?.toLowerCase().includes(term);

      return matches &&
        (userRoleFilter === 'ALL' || item.role === userRoleFilter);
    });
  }, [users, search, userRoleFilter]);

  const filteredPayments = useMemo(() => {
    const term = search.toLowerCase();

    return payments.filter(item => {
      const matches =
        !term ||
        item.email?.toLowerCase().includes(term) ||
        item.transactionReference?.toLowerCase().includes(term);

      return matches &&
        (paymentFilter === 'ALL' || item.status === paymentFilter);
    });
  }, [payments, search, paymentFilter]);

  const pendingPayments = payments.filter(x => x.status === 'PENDING');
  const staff = users.filter(x => !['USER', 'SUPER_ADMIN'].includes(x.role));

  if (!token || !user) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0b0d19',
        color: '#fff',
        display: 'grid',
        placeItems: 'center',
        padding: 20
      }}>
        <form onSubmit={login} style={{
          width: '100%',
          maxWidth: 430,
          background: '#171a2a',
          border: '1px solid #333',
          borderRadius: 20,
          padding: 30
        }}>
          <div style={{
            width: 55,
            height: 55,
            display: 'grid',
            placeItems: 'center',
            background: '#ffb79c',
            color: '#111',
            borderRadius: 15,
            fontWeight: 1000,
            fontSize: 21
          }}>AH</div>

          <p style={{ color: '#ffb79c', letterSpacing: 3, fontSize: 11, marginTop: 24 }}>
            ANIME HUB BANGLA
          </p>

          <h1 style={{ fontSize: 32, margin: '8px 0' }}>Super Admin</h1>
          <p style={{ color: '#999', lineHeight: 1.6 }}>
            Secure access to the complete platform control center.
          </p>

          <label style={{ display: 'block', marginTop: 24 }}>
            Email address
            <input
              style={inputStyle}
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Super Admin email"
            />
          </label>

          <label style={{ display: 'block', marginTop: 16 }}>
            Password
            <input
              style={inputStyle}
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Your password"
            />
          </label>

          {error && <p style={{ color: '#ff8585' }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{ ...buttonStyle, width: '100%', marginTop: 22 }}
          >
            {loading ? 'Signing in…' : 'Secure Sign In'}
          </button>

          <a href="/" style={{
            display: 'block',
            color: '#aaa',
            textAlign: 'center',
            marginTop: 22,
            textDecoration: 'none'
          }}>
            ← Back to website
          </a>

          <small style={{ display: 'block', color: '#777', textAlign: 'center', marginTop: 20 }}>
            <Lock size={12} style={{ verticalAlign: 'middle' }} /> Super Admin permission required
          </small>
        </form>
      </div>
    );
  }

  const current = nav.find(x => x.id === section);

  const go = (id: Section) => {
    setSection(id);
    setMenuOpen(false);
    setSearch('');
    setError('');
    setMessage('');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0b0d19',
      color: '#f4f4f5',
      display: 'flex',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      {menuOpen && (
        <button
          onClick={() => setMenuOpen(false)}
          aria-label="Close navigation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 20,
            background: '#0009',
            border: 0
          }}
        />
      )}

      <aside id="admin-navigation" style={{
        width: 260,
        flexShrink: 0,
        background: '#101320',
        borderRight: '1px solid #292933',
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        zIndex: 30,
        inset: '0 auto 0 0',
        overflowY: 'auto',
        transform: menuOpen ? 'translateX(0)' : undefined
      }} className="sa-sidebar-responsive">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 30 }}>
          <div style={{
            background: '#ffb79c',
            color: '#111',
            borderRadius: 10,
            padding: 11,
            fontWeight: 1000
          }}>AH</div>
          <div>
            <b style={{ display: 'block', letterSpacing: 1 }}>ANIME HUB</b>
            <small style={{ color: '#ffb79c', letterSpacing: 2 }}>SUPER ADMIN</small>
          </div>
          <button
            onClick={() => setMenuOpen(false)}
            aria-label="Close admin navigation"
            style={{ marginLeft: 'auto', background: 'none', color: '#aaa', border: 0 }}
          >
            <X />
          </button>
        </div>

        {groups.map(group => (
          <div key={group} style={{ marginBottom: 17 }}>
            <div style={{
              color: '#777',
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: 2,
              padding: '8px 10px'
            }}>
              {group}
            </div>

            {nav.filter(item => item.group === group).map(item => {
              const Icon = item.icon;
              const active = section === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => go(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 11,
                    width: '100%',
                    padding: '11px 10px',
                    marginBottom: 4,
                    border: 0,
                    borderRadius: 9,
                    textAlign: 'left',
                    background: active ? '#49303a' : 'transparent',
                    color: active ? '#ffd2bd' : '#aaa',
                    cursor: 'pointer',
                    fontSize: 13
                  }}
                >
                  <Icon size={17} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {active && <ChevronRight size={15} />}
                </button>
              );
            })}
          </div>
        ))}

        <div style={{
          borderTop: '1px solid #292933',
          marginTop: 'auto',
          paddingTop: 18
        }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
            <Crown color="#ffb79c" />
            <div style={{ minWidth: 0 }}>
              <b style={{ display: 'block', fontSize: 13 }}>
                {user.displayName || 'Super Admin'}
              </b>
              <small style={{ color: '#888', overflowWrap: 'anywhere' }}>{user.email}</small>
            </div>
          </div>

          <button
            onClick={logout}
            style={{
              width: '100%',
              padding: 11,
              border: '1px solid #443333',
              background: '#241616',
              color: '#ffaaaa',
              borderRadius: 9,
              display: 'flex',
              justifyContent: 'center',
              gap: 9
            }}
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      <main style={{
        flex: 1,
        minWidth: 0,
        marginLeft: 260,
        padding: '24px clamp(14px, 3vw, 34px)',
        maxWidth: 1800
      }} className="sa-main-responsive">
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
          borderBottom: '1px solid #292933',
          paddingBottom: 20,
          marginBottom: 24
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Open admin navigation"
              aria-expanded={menuOpen}
              aria-controls="admin-navigation"
              style={{
                display: 'none',
                background: '#17171e',
                border: '1px solid #333',
                color: '#fff',
                borderRadius: 8,
                padding: 9
              }}
              className="sa-mobile-menu"
            >
              <Menu />
            </button>
            <div>
              <small style={{ color: '#ffb79c', letterSpacing: 2 }}>
                PLATFORM CONTROL CENTER
              </small>
              <h1 style={{ margin: '5px 0 0', fontSize: 25 }}>
                {current?.label || 'Dashboard'}
              </h1>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
            <a href="/" target="_blank" rel="noreferrer" style={{
              color: '#ccc',
              textDecoration: 'none',
              border: '1px solid #333',
              borderRadius: 9,
              padding: '10px 12px',
              fontSize: 12
            }}>
              <Eye size={14} style={{ verticalAlign: 'middle' }} /> View Website
            </a>

            <button
              onClick={() => void loadDashboard()}
              disabled={loading}
              style={{
                ...buttonStyle,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <RefreshCw size={15} /> {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </header>

        {error && (
          <div style={{
            ...panelStyle,
            borderColor: '#733939',
            color: '#ffaaaa',
            marginBottom: 16
          }}>
            <AlertTriangle size={17} style={{ verticalAlign: 'middle' }} /> {error}
          </div>
        )}

        {message && (
          <div style={{
            ...panelStyle,
            borderColor: '#426a4c',
            color: '#a8e6b6',
            marginBottom: 16
          }}>
            <CheckCircle size={17} style={{ verticalAlign: 'middle' }} /> {message}
          </div>
        )}

        {section === 'overview' && (
          <>
            <div style={{
              ...panelStyle,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 15,
              flexWrap: 'wrap',
              marginBottom: 20
            }}>
              <div>
                <h2 style={{ margin: 0 }}>
                  Welcome back, {user.displayName || 'Super Admin'}
                </h2>
                <p style={{ color: '#999', marginBottom: 0 }}>
                  Your complete Anime Hub Bangla platform overview.
                </p>
              </div>
              <Status value={health?.online ? 'ONLINE' : 'CHECK STATUS'} />
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
              gap: 13,
              marginBottom: 20
            }}>
              <Card title="Anime Titles" value={summary?.anime ?? anime.length} icon={Film} />
              <Card title="Episodes" value={summary?.episodes ?? '—'} icon={Layers} />
              <Card title="Registered Users" value={summary?.users ?? users.length} icon={Users} />
              <Card title="Pending Payments" value={pendingPayments.length} icon={CreditCard} />
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
              gap: 15
            }}>
              <section style={panelStyle}>
                <h3><Server size={18} color="#ffb79c" /> Platform Services</h3>
                {[
                  ['API Server', health?.online ? 'ONLINE' : 'UNAVAILABLE'],
                  ['Database', String(health?.database || 'NOT REPORTED').toUpperCase()],
                  ['Admin Permission', user.role],
                  ['Authentication', 'JWT BEARER TOKEN']
                ].map(([label, value]) => (
                  <div key={label} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 10,
                    borderBottom: '1px solid #292933',
                    padding: '12px 0',
                    fontSize: 13
                  }}>
                    <span style={{ color: '#aaa' }}>{label}</span>
                    <b>{value}</b>
                  </div>
                ))}
                <a href={`${API}/api/health`} target="_blank" rel="noreferrer"
                  style={{ color: '#ffb79c', display: 'inline-block', marginTop: 17 }}>
                  Open health endpoint <ExternalLink size={13} />
                </a>
              </section>

              <section style={panelStyle}>
                <h3><Activity size={18} color="#ffb79c" /> Platform Activity</h3>
                {[
                  ['Anime catalogue', anime.length],
                  ['User accounts', users.length],
                  ['Staff accounts', staff.length],
                  ['Payment records', payments.length],
                  ['Pending payment reviews', pendingPayments.length]
                ].map(([label, value]) => (
                  <div key={String(label)} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid #292933',
                    padding: '12px 0',
                    fontSize: 13
                  }}>
                    <span style={{ color: '#aaa' }}>{label}</span>
                    <b>{value}</b>
                  </div>
                ))}
              </section>
            </div>

            <section style={{ ...panelStyle, marginTop: 16 }}>
              <SectionTitle
                title="Quick Access"
                description="Open the main platform management areas."
              />
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
                gap: 10
              }}>
                {[
                  ['Website CMS', 'website', Globe],
                  ['Android App', 'android', Smartphone],
                  ['Anime & Episodes', 'content', Film],
                  ['Partners', 'collaborations', Handshake],
                  ['Users', 'users', Users],
                  ['Payments', 'payments', CreditCard],
                  ['Revenue', 'revenue', Wallet],
                  ['Operations', 'operations', Activity],
                  ['System', 'system', Shield]
                ].map(([label, id, Icon]) => {
                  const ItemIcon = Icon as typeof LayoutDashboard;
                  return (
                    <button
                      key={String(id)}
                      onClick={() => go(id as Section)}
                      style={{
                        background: '#191920',
                        color: '#eee',
                        border: '1px solid #333',
                        borderRadius: 11,
                        padding: 16,
                        textAlign: 'left',
                        cursor: 'pointer'
                      }}
                    >
                      <ItemIcon size={20} color="#ffb79c" />
                      <b style={{ display: 'block', marginTop: 10 }}>{String(label)}</b>
                    </button>
                  );
                })}
              </div>
            </section>

            <section style={{ ...panelStyle, marginTop: 16 }}>
              <SectionTitle title="Pending Payment Reviews" />
              {pendingPayments.length === 0 ? (
                <p style={{ color: '#888' }}>No pending payments found.</p>
              ) : pendingPayments.map(payment => (
                <div key={payment.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                  borderBottom: '1px solid #292933',
                  padding: '13px 0'
                }}>
                  <div>
                    <b>{payment.email}</b>
                    <small style={{ display: 'block', color: '#999', marginTop: 5 }}>
                      {payment.plan} · {money(payment.amountBdt)} · {payment.transactionReference}
                    </small>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button disabled={loading} style={buttonStyle}
                      onClick={() => void reviewPayment(payment.id, 'APPROVE')}>
                      Approve
                    </button>
                    <button disabled={loading}
                      style={{ ...buttonStyle, background: '#532626', color: '#fff' }}
                      onClick={() => void reviewPayment(payment.id, 'REJECT')}>
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </section>
          </>
        )}

        {section === 'website' && (
          <section style={panelStyle}>
            <SectionTitle
              title="Website Content Management"
              description="Manage website identity and homepage content through the connected settings API."
              action={<a href="/" target="_blank" rel="noreferrer" style={{ color: '#ffb79c' }}>Preview Website ↗</a>}
            />

            <form onSubmit={saveSettings}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))',
                gap: 17
              }}>
                {([
                  ['siteName', 'Website Name'],
                  ['tagline', 'Website Tagline'],
                  ['heroTitle', 'Homepage Hero Title'],
                  ['heroSubtitle', 'Homepage Hero Subtitle'],
                  ['contactEmail', 'Contact Email']
                ] as [keyof SettingsData, string][]).map(([key, label]) => (
                  <label key={key} style={{ display: 'block', color: '#bbb', fontSize: 13 }}>
                    {label}
                    <input
                      style={inputStyle}
                      value={String(settings[key] || '')}
                      onChange={e => setSettings(old => ({ ...old, [key]: e.target.value }))}
                    />
                  </label>
                ))}
              </div>

              <label style={{ display: 'block', marginTop: 18, color: '#bbb', fontSize: 13 }}>
                Website Announcement / Notice
                <textarea
                  style={{ ...inputStyle, minHeight: 110, resize: 'vertical' }}
                  value={settings.announcement}
                  onChange={e => setSettings(old => ({ ...old, announcement: e.target.value }))}
                  placeholder="Write an announcement for visitors..."
                />
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                margin: '20px 0',
                color: '#ddd'
              }}>
                <input
                  type="checkbox"
                  checked={settings.maintenanceMode}
                  onChange={e => setSettings(old => ({
                    ...old,
                    maintenanceMode: e.target.checked
                  }))}
                />
                Maintenance mode setting (stored only; does not restrict access)
              </label>

              <fieldset className="sa-visibility-controls">
                <legend>Appearance &amp; premium pricing</legend>
                <p>Choose the homepage accent and display prices. Zero means not configured. Prices and instructions enable manual submissions, not automatic payment checkout. Never enter secrets.</p>
                <label>Accent theme <select value={settings.accentTheme} onChange={e => setSettings(old => ({ ...old, accentTheme: e.target.value as SettingsData['accentTheme'] }))}><option value="peach">Peach</option><option value="violet">Violet</option><option value="mint">Mint</option></select></label>
                <label>bKash number <input type="tel" inputMode="tel" pattern="(01|\+8801)[3-9][0-9]{8}" maxLength={14} value={settings.bkashNumber} onChange={e => setSettings(old => ({ ...old, bkashNumber: e.target.value.trim() }))} placeholder="01XXXXXXXXX" /></label>
                <label>Nagad number <input type="tel" inputMode="tel" pattern="(01|\+8801)[3-9][0-9]{8}" maxLength={14} value={settings.nagadNumber} onChange={e => setSettings(old => ({ ...old, nagadNumber: e.target.value.trim() }))} placeholder="01XXXXXXXXX" /></label>
                <p>Numbers are public and visible to members. Use 01… or +8801… with no spaces. Leave blank to disable a method. Never enter PINs or passwords.</p>
                <label className="sa-payment-instructions">Public manual payment instructions<textarea maxLength={1000} value={settings.paymentInstructions} onChange={e => setSettings(old => ({ ...old, paymentInstructions: e.target.value }))} placeholder="Payment recipient and instructions (public; no secret keys)" /></label>
                <label>Monthly price (BDT) <input type="number" min="0" max="1000000" step="1" value={settings.monthlyPriceBdt} onChange={e => setSettings(old => ({ ...old, monthlyPriceBdt: Number(e.target.value) }))} /></label>
                <label>Yearly price (BDT) <input type="number" min="0" max="1000000" step="1" value={settings.yearlyPriceBdt} onChange={e => setSettings(old => ({ ...old, yearlyPriceBdt: Number(e.target.value) }))} /></label>
              </fieldset>
              <fieldset className="sa-visibility-controls">
                <legend>Homepage sections</legend>
                <p>Choose which sections and navigation links visitors can see. The anime catalogue always remains visible.</p>
                {([
                  ['showMovies', 'Movies'], ['showStudios', 'Creative community'],
                  ['showPartners', 'Collaboration partners'], ['showAbout', 'About']
                ] as const).map(([key, label]) => (
                  <label key={key}><input type="checkbox" checked={settings[key]} onChange={e => setSettings(old => ({ ...old, [key]: e.target.checked }))} /> {label}</label>
                ))}
              </fieldset>
              {!settingsLoaded && <p role="alert" style={{ color: '#ffb4a4' }}>Website settings could not be loaded. Refresh before saving to avoid overwriting existing settings.</p>}
              <button disabled={loading || !settingsLoaded} style={buttonStyle}>
                {loading ? 'Saving…' : 'Save Website Settings'}
              </button>
            </form>

            <HomepageCovers anime={anime} />
            <div style={{ borderTop: '1px solid #333', marginTop: 25, paddingTop: 20 }}>
              <h3><Palette size={18} color="#ffb79c" /> Website Management Areas</h3>
              <p style={{ color: '#999', lineHeight: 1.7 }}>
                The controls above manage homepage text and section visibility. Logo and image library, homepage section ordering, SEO metadata,
                social links, custom pages, theme settings, navigation menus,
                legal pages and announcement scheduling can be added as dedicated
                CMS modules. Only the settings fields connected to the backend
                are editable here at present.
              </p>
            </div>
          </section>
        )}

        {section === 'android' && (
          <section style={panelStyle}>
            <SectionTitle title="Android App Download" description="Publish or remove the public download link for your signed Android release." />
            <div className="sa-apk-note"><Smartphone size={20} /><span>This does not build or host an APK. Build and sign the app, upload it to trusted HTTPS hosting, and test the file before publishing the link.</span></div>
            <form onSubmit={saveSettings} className="sa-apk-form">
              <label>Signed APK download URL (HTTPS)
                <input type="url" pattern="https://.+" title="Enter an HTTPS URL" maxLength={2000} value={settings.androidApkUrl} onChange={e => setSettings(old => ({ ...old, androidApkUrl: e.target.value }))} placeholder="https://example.com/app-release.apk" />
              </label>
              <label>Version label (optional)
                <input maxLength={40} value={settings.androidVersion} onChange={e => setSettings(old => ({ ...old, androidVersion: e.target.value }))} placeholder="e.g. 1.0.0" />
              </label>
              <p>Leave the URL empty and save to hide the download button. Only use a release you own and trust; the URL is public.</p>
              {!settingsLoaded && <p role="alert">Settings could not be loaded. Refresh before saving.</p>}
              <button disabled={loading || !settingsLoaded} style={buttonStyle}>{loading ? 'Saving…' : 'Save Android settings'}</button>
            </form>
          </section>
        )}

        {section === 'collaborations' && (
          <section style={panelStyle}>
            <SectionTitle
              title="Collaboration & Partner Network"
              description="Manage public partner organizations, dubbing teams, animation studios and media partners."
            />
            
<PartnerManagement />
            
          </section>
        )}

        {section === 'content' && (
          <section style={panelStyle}>
            <SectionTitle
              title="Anime & Content Management"
              description="Anime catalogue, episode publishing, video provider settings and content tools."
            />
            <div style={{ color: '#aaa', marginBottom: 15 }}>
              {anime.length} anime records loaded from the connected API.
            </div>
            <Admin view="content" />
          </section>
        )}

        {section === 'operations' && (
          <section style={panelStyle}>
            <SectionTitle
              title="Platform Operations"
              description="Operational tools are consolidated into this Super Admin workspace."
            />
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
              gap: 12,
              marginBottom: 22
            }}>
              {[
                ['Advertisement Management', 'Ad campaigns, placements and imported provider reports', Megaphone],
                ['Sponsor CRM', 'Sponsor records, deal status and revenue records', Handshake],
                ['Community Moderation', 'Comment review and moderation controls', MessageSquare],
                ['Episode Management', 'Episode publishing and video upload controls', Film],
                ['Staff Operations', 'Staff accounts and assigned roles', UserCog],
                ['Payment Operations', 'Payment verification and review tools', CreditCard]
              ].map(([title, description, Icon]) => {
                const ItemIcon = Icon as typeof LayoutDashboard;
                return (
                  <div key={String(title)} style={{
                    background: '#191920',
                    border: '1px solid #333',
                    borderRadius: 12,
                    padding: 17
                  }}>
                    <ItemIcon color="#ffb79c" size={21} />
                    <b style={{ display: 'block', marginTop: 10 }}>{String(title)}</b>
                    <small style={{ display: 'block', color: '#999', marginTop: 7, lineHeight: 1.5 }}>
                      {String(description)}
                    </small>
                  </div>
                );
              })}
            </div>
            <Admin view="operations" />
          </section>
        )}

        {section === 'users' && (
          <section style={panelStyle}>
            <SectionTitle
              title="User Management"
              description="Search and review registered accounts. Role changes and account restrictions require protected backend actions."
            />

            <div style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              marginBottom: 18
            }}>
              <div style={{ flex: 1, minWidth: 190, position: 'relative' }}>
                <Search size={17} style={{ position: 'absolute', top: 18, left: 12, color: '#888' }} />
                <input
                  style={{ ...inputStyle, paddingLeft: 38, marginTop: 0 }}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search name, email or ID..."
                />
              </div>
              <select
                style={{ ...inputStyle, width: 'auto', minWidth: 170, marginTop: 0 }}
                value={userRoleFilter}
                onChange={e => setUserRoleFilter(e.target.value)}
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

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}>
                <thead>
                  <tr>
                    {['Name', 'Email', 'Role', 'Status', 'Account ID'].map(x => (
                      <th key={x} style={{ textAlign: 'left', padding: 12, color: '#ffb79c', borderBottom: '1px solid #333' }}>{x}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(item => (
                    <tr key={item.id}>
                      <td style={{ padding: 12, borderBottom: '1px solid #292933' }}>{item.displayName || 'User'}</td>
                      <td style={{ padding: 12, borderBottom: '1px solid #292933' }}>{item.email}</td>
                      <td style={{ padding: 12, borderBottom: '1px solid #292933' }}>{item.role}</td>
                      <td style={{ padding: 12, borderBottom: '1px solid #292933' }}><Status value={item.status} /></td>
                      <td style={{ padding: 12, borderBottom: '1px solid #292933', fontSize: 11 }}>{item.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filteredUsers.length && <p style={{ color: '#888' }}>No matching users.</p>}
            <p style={{ color: '#888', fontSize: 12, marginTop: 18 }}>
              Account suspension, deletion, password resets, role changes and session revocation
              should be enabled only through audited server-side endpoints.
            </p>
          </section>
        )}

        {section === 'staff' && (
          <section style={panelStyle}>
            <SectionTitle
              title="Staff & Permissions"
              description="Staff accounts, team roles, moderation and operational permissions."
            />

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
              gap: 12,
              marginBottom: 20
            }}>
              <Card title="Staff Members" value={staff.length} icon={Users} />
              <Card title="Admins" value={staff.filter(x => x.role === 'ADMIN').length} icon={Shield} />
              <Card title="Moderators" value={staff.filter(x => x.role === 'MODERATOR').length} icon={MessageSquare} />
              <Card title="Content Managers" value={staff.filter(x => x.role === 'CONTENT_MANAGER').length} icon={Film} />
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 550 }}>
                <thead>
                  <tr>
                    {['Name', 'Email', 'Role', 'Status'].map(x => (
                      <th key={x} style={{ textAlign: 'left', padding: 12, color: '#ffb79c', borderBottom: '1px solid #333' }}>{x}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {staff.map(member => (
                    <tr key={member.id}>
                      <td style={{ padding: 12, borderBottom: '1px solid #292933' }}>{member.displayName || 'Staff'}</td>
                      <td style={{ padding: 12, borderBottom: '1px solid #292933' }}>{member.email}</td>
                      <td style={{ padding: 12, borderBottom: '1px solid #292933' }}>{member.role}</td>
                      <td style={{ padding: 12, borderBottom: '1px solid #292933' }}><Status value={member.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 22, borderTop: '1px solid #333', paddingTop: 18 }}>
              <h3>Permission architecture</h3>
              <p style={{ color: '#999', lineHeight: 1.7 }}>
                Super Admin, Admin, Content Manager, Advertisement Manager,
                Collaboration Manager, Moderator and Analyst roles are supported
                by the platform's role-based access system. Assigning or changing
                permissions must be performed through the protected staff API.
              </p>
            </div>
            <Admin view="staff" />
          </section>
        )}

        {section === 'payments' && (
          <section style={panelStyle}>
            <SectionTitle
              title="Payment Management"
              description="Review premium and membership payment submissions."
            />

            <div style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              marginBottom: 18
            }}>
              <input
                style={{ ...inputStyle, flex: 1, minWidth: 190, marginTop: 0 }}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search email or transaction reference..."
              />
              <select
                style={{ ...inputStyle, width: 'auto', marginTop: 0 }}
                value={paymentFilter}
                onChange={e => setPaymentFilter(e.target.value)}
              >
                <option value="ALL">All payments</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
              gap: 12,
              marginBottom: 20
            }}>
              <Card title="All Payments" value={payments.length} icon={CreditCard} />
              <Card title="Pending" value={pendingPayments.length} icon={Clock} />
              <Card title="Approved" value={payments.filter(x => x.status === 'APPROVED').length} icon={CheckCircle} />
              <Card title="Rejected" value={payments.filter(x => x.status === 'REJECTED').length} icon={AlertTriangle} />
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 850 }}>
                <thead>
                  <tr>
                    {['User', 'Plan', 'Method', 'Reference', 'Amount', 'Status', 'Actions'].map(x => (
                      <th key={x} style={{ textAlign: 'left', padding: 11, color: '#ffb79c', borderBottom: '1px solid #333' }}>{x}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map(payment => (
                    <tr key={payment.id}>
                      <td style={{ padding: 11, borderBottom: '1px solid #292933' }}>{payment.email}</td>
                      <td style={{ padding: 11, borderBottom: '1px solid #292933' }}>{payment.plan}</td>
                      <td style={{ padding: 11, borderBottom: '1px solid #292933' }}>{payment.paymentMethod}</td>
                      <td style={{ padding: 11, borderBottom: '1px solid #292933' }}>{payment.transactionReference}</td>
                      <td style={{ padding: 11, borderBottom: '1px solid #292933' }}>{money(payment.amountBdt)}</td>
                      <td style={{ padding: 11, borderBottom: '1px solid #292933' }}><Status value={payment.status} /></td>
                      <td style={{ padding: 11, borderBottom: '1px solid #292933' }}>
                        {payment.status === 'PENDING' ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button disabled={loading} style={buttonStyle} onClick={() => void reviewPayment(payment.id, 'APPROVE')}>Approve</button>
                            <button disabled={loading} style={{ ...buttonStyle, background: '#542626', color: '#fff' }} onClick={() => void reviewPayment(payment.id, 'REJECT')}>Reject</button>
                          </div>
                        ) : 'Reviewed'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filteredPayments.length && <p style={{ color: '#888' }}>No matching payments.</p>}
            <p style={{ color: '#888', fontSize: 12, marginTop: 15 }}>
              Verify each transaction with the payment provider before approval.
            </p>
          </section>
        )}

        {section === 'revenue' && (
          <div style={{ display: 'grid', gap: 16 }}>
            <section style={panelStyle}>
              <SectionTitle
                title="Revenue Overview"
                description="Financial records returned by the connected backend."
              />
              {revenue ? (
                <>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
                    gap: 12
                  }}>
                    <Card title="Premium Revenue" value={money(revenue.premium?.amount_bdt)} icon={Crown} detail={`${revenue.premium?.count || 0} approved payments`} />
                    <Card title="Sponsor Deal Value" value={money(revenue.sponsors?.contracted_bdt)} icon={Handshake} detail={`${revenue.sponsors?.count || 0} sponsor records`} />
                    <Card title="Ad Report Entries" value={revenue.ads?.length || 0} icon={Megaphone} detail="Imported provider data" />
                  </div>
                  <pre style={{
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                    background: '#0b0d19',
                    borderRadius: 10,
                    padding: 15,
                    color: '#ccc',
                    marginTop: 18
                  }}>
                    {JSON.stringify(revenue, null, 2)}
                  </pre>
                </>
              ) : <p style={{ color: '#888' }}>Revenue data unavailable.</p>}
              <p style={{ color: '#888', fontSize: 12 }}>
                Pending payments are not received revenue. Ad revenue requires real provider reports.
              </p>
            </section>

            <section style={panelStyle}>
              <SectionTitle
                title="Playback Analytics"
                description={`Recorded playback activity: ${analytics?.period || 'period not reported'}.`}
              />
              {analytics ? (
                <>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))',
                    gap: 12
                  }}>
                    <Card title="Play Events" value={analytics.totals?.plays ?? 0} icon={Activity} />
                    <Card title="Completions" value={analytics.totals?.completions ?? 0} icon={CheckCircle} />
                    <Card title="Active Viewers" value={analytics.totals?.active_viewers ?? 0} icon={Users} />
                  </div>

                  <h3 style={{ marginTop: 25 }}>Top Anime</h3>
                  {(analytics.topAnime || []).map((item: any, index: number) => (
                    <div key={`${item.title}-${index}`} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: 12,
                      borderBottom: '1px solid #292933'
                    }}>
                      <span>{index + 1}. {item.title}</span>
                      <b>{Number(item.plays || 0).toLocaleString()} plays</b>
                    </div>
                  ))}
                </>
              ) : <p style={{ color: '#888' }}>Analytics unavailable.</p>}
            </section>
          </div>
        )}

        {section === 'system' && (
          <section style={panelStyle}>
            <SectionTitle
              title="System & Security"
              description="Current service information and security status."
              action={<button style={buttonStyle} onClick={() => void loadHealth()}><RefreshCw size={14} /> Check Again</button>}
            />

            {[
              ['Frontend Website', window.location.origin],
              ['Backend API', API],
              ['API Status', health?.online ? 'ONLINE' : 'UNAVAILABLE'],
              ['Database', String(health?.database || 'NOT REPORTED')],
              ['Current Account', user.email],
              ['Access Role', user.role],
              ['Authentication', 'JWT Bearer Token'],
              ['Admin Access', 'SUPER_ADMIN']
            ].map(([label, value]) => (
              <div key={label} style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 15,
                flexWrap: 'wrap',
                padding: '14px 0',
                borderBottom: '1px solid #292933'
              }}>
                <span style={{ color: '#999' }}>{label}</span>
                <b style={{ overflowWrap: 'anywhere' }}>{value}</b>
              </div>
            ))}

            <div style={{ marginTop: 22 }}>
              <h3><ShieldCheck size={18} color="#ffb79c" /> Security checklist</h3>
              {[
                'Super Admin role is checked by the API',
                'Admin access uses an authenticated token',
                'Secrets should remain in provider environment variables',
                'Payment approvals require transaction verification',
                'Database backups must be configured at the database provider',
                'Audit logs and multi-factor authentication need backend support'
              ].map(item => (
                <p key={item} style={{ color: '#bbb', fontSize: 13 }}>
                  <Shield size={14} color="#ffb79c" style={{ verticalAlign: 'middle' }} /> {item}
                </p>
              ))}
            </div>

            <a href={`${API}/api/health`} target="_blank" rel="noreferrer"
              style={{ color: '#ffb79c', display: 'inline-block', marginTop: 20 }}>
              Open API Health <ExternalLink size={14} />
            </a>
          </section>
        )}

        {section === 'future' && (
          <section style={panelStyle}>
            <SectionTitle
              title="Future Integrations & Expansion"
              description="Planned platform modules. These are roadmap items, not active integrations."
            />

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))',
              gap: 12
            }}>
              {[
                ['Payment Gateways', 'bKash, Nagad, Rocket, SSLCommerz and subscription billing', CreditCard],
                ['Ad Networks', 'Adsterra API, impression tracking, click reports and revenue sync', Megaphone],
                ['Video Providers', 'Cloudflare Stream, Bunny Stream, storage and transcoding', Film],
                ['AI Services', 'AI recommendations, metadata tools, translation and moderation', Activity],
                ['Email & Notifications', 'Transactional email, OTP, push and in-app notifications', Bell],
                ['Cloud Storage', 'Object storage, upload limits, CDN and media backups', HardDrive],
                ['Analytics', 'Traffic analytics, watch time, retention and conversion reports', BarChart3],
                ['Security', 'MFA, login history, device sessions and audit logs', ShieldCheck],
                ['Website CMS', 'Visual page builder, SEO, custom pages and scheduled publishing', FileText],
                ['Community', 'Dubbing teams, applications, creator profiles and moderation', MessageSquare],
                ['Localization', 'Bangla, English, Japanese and additional language support', Globe],
                ['Automation', 'Scheduled jobs, reports, alerts and service monitoring', Clock]
              ].map(([title, description, Icon]) => {
                const ItemIcon = Icon as typeof LayoutDashboard;
                return (
                  <div key={String(title)} style={{
                    border: '1px solid #333',
                    background: '#191920',
                    borderRadius: 12,
                    padding: 17
                  }}>
                    <ItemIcon size={22} color="#ffb79c" />
                    <b style={{ display: 'block', marginTop: 10 }}>{String(title)}</b>
                    <p style={{ color: '#999', fontSize: 12, lineHeight: 1.6 }}>{String(description)}</p>
                    <Status value="PLANNED" />
                  </div>
                );
              })}
            </div>

            <p style={{ color: '#888', lineHeight: 1.7, marginTop: 22 }}>
              Future modules will need their own database migrations, backend API routes,
              provider credentials and security permissions before they can be activated.
              No provider connection or automated revenue collection is assumed to be enabled.
            </p>
          </section>
        )}

        <footer style={{
          color: '#666',
          borderTop: '1px solid #292933',
          paddingTop: 18,
          marginTop: 35,
          fontSize: 12,
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap'
        }}>
          <span>Anime Hub Bangla · Super Admin Control Center</span>
          <span>Platform management workspace</span>
        </footer>
      </main>

      <style>{`
        @media(max-width:900px) {
          .sa-sidebar-responsive {
            transform: translateX(-100%);
            transition: transform .2s ease;
          }
          .sa-sidebar-responsive[style*="translateX(0)"] {
            transform: translateX(0) !important;
          }
          .sa-main-responsive {
            margin-left: 0 !important;
            width: 100%;
          }
          .sa-mobile-menu {
            display: inline-flex !important;
          }
        }
      `}</style>
    </div>
  );
}
