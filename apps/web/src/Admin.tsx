import { useEffect, useState, type FormEvent } from 'react';
import {
  LogOut, Plus, RefreshCw, ShieldCheck, Film, Users, Layers,
  AlertCircle, CheckCircle2
} from 'lucide-react';
import EpisodeManager from './EpisodeManager';

const API = import.meta.env.VITE_API_URL || 'https://anime-hub-bangla.onrender.com';

type User = {
  email: string;
  displayName: string;
  role: string;
};

type Summary = {
  anime: number;
  episodes: number;
  users: number;
};

type Anime = {
  id: string;
  title: string;
  slug: string;
  published: boolean;
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

type Revenue = {
  manual: Array<{ source: string; currency: string; amount: string }>;
  ads: Array<{
    provider: string;
    currency: string;
    amount: string;
    impressions: string;
    clicks: string;
  }>;
  sponsors: { count: number; contracted_bdt: string };
  premium: { count: number; amount_bdt: string };
  note: string;
};

type Sponsor = {
  id: string;
  companyName: string;
  status: string;
  amountBdt: string | number;
  packageName?: string;
};

type Campaign = {
  id: string;
  name: string;
  provider: string;
  placement: string;
  status: string;
};

type Staff = {
  id: string;
  email: string;
  display_name?: string;
  displayName?: string;
  role: string;
  status: string;
};

type ModComment = {
  id: string;
  body: string;
  displayName: string;
  animeTitle: string;
};

type Analytics = {
  totals?: {
    plays?: number;
    completions?: number;
    active_viewers?: number;
  };
  topAnime?: Array<{ title: string; plays: number }>;
};

export default function Admin() {
  const [token, setToken] = useState(
    localStorage.getItem('ahb_admin_token') || ''
  );
  const [user, setUser] = useState<User | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [anime, setAnime] = useState<Anime[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [modComments, setModComments] = useState<ModComment[]>([]);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});

  const [sponsorName, setSponsorName] = useState('');
  const [sponsorAmount, setSponsorAmount] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [campaignProvider, setCampaignProvider] = useState('ADSTERRA');
  const [campaignPlacement, setCampaignPlacement] = useState('homepage-banner');

  const [metricDate, setMetricDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [metricImpressions, setMetricImpressions] = useState('');
  const [metricClicks, setMetricClicks] = useState('');
  const [metricRevenue, setMetricRevenue] = useState('');

  const [staffEmail, setStaffEmail] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffRole, setStaffRole] = useState('CONTENT_MANAGER');

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  async function api<T = any>(
    path: string,
    options: RequestInit = {},
    activeToken = token
  ): Promise<T> {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        ...(options.body && !(options.body instanceof FormData)
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...(activeToken
          ? { Authorization: `Bearer ${activeToken}` }
          : {}),
        ...options.headers
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Request failed (${response.status})`);
    }

    return data as T;
  }

  async function load() {
    if (!token) return;

    setLoading(true);
    setError('');

    const results = await Promise.allSettled([
      api('/api/admin/summary'),
      api<{ data: Anime[] }>('/api/admin/anime'),
      api<{ data: Payment[] }>('/api/admin/payments'),
      api<Revenue>('/api/admin/revenue'),
      api<Analytics>('/api/admin/analytics'),
      api<{ data: Sponsor[] }>('/api/admin/sponsors'),
      api<{ data: Campaign[] }>('/api/admin/campaigns'),
      api<{ data: Staff[] }>('/api/admin/users'),
      api<{ comments: ModComment[] }>('/api/admin/moderation')
    ]);

    const value = (index: number) =>
      results[index].status === 'fulfilled'
        ? results[index].value
        : null;

    const s = value(0) as Summary | null;
    const a = value(1) as { data: Anime[] } | null;
    const p = value(2) as { data: Payment[] } | null;
    const r = value(3) as Revenue | null;
    const an = value(4) as Analytics | null;
    const sp = value(5) as { data: Sponsor[] } | null;
    const ca = value(6) as { data: Campaign[] } | null;
    const st = value(7) as { data: Staff[] } | null;
    const md = value(8) as { comments: ModComment[] } | null;

    if (s) setSummary(s);
    if (a) setAnime(a.data || []);
    if (p) setPayments(p.data || []);
    if (r) setRevenue(r);
    if (an) setAnalytics(an);
    if (sp) setSponsors(sp.data || []);
    if (ca) setCampaigns(ca.data || []);
    if (st) setStaff(st.data || []);
    if (md) setModComments(md.comments || []);

    if (results.every(item => item.status === 'rejected')) {
      setError('Dashboard data could not be loaded. Check API access and your account permissions.');
    } else if (results.some(item => item.status === 'rejected')) {
      setNotice('Some dashboard sections are unavailable for your account role or are not configured.');
    } else {
      setNotice('');
    }

    setLoading(false);
  }

  useEffect(() => {
    if (!token) return;

    let active = true;

    async function verifySession() {
      try {
        const result = await api<{ user: User }>('/api/auth/me', {}, token);
        if (!active) return;

        if (!['SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER', 'ADVERTISEMENT_MANAGER', 'COLLABORATION_MANAGER', 'MODERATOR', 'ANALYST'].includes(result.user.role)) {
          throw new Error('This account does not have admin access.');
        }

        setUser(result.user);
        await load();
      } catch (err) {
        if (!active) return;

        const message = err instanceof Error ? err.message : 'Session validation failed.';
        if (message.includes('Unauthorized') || message.includes('Invalid token') || message.includes('not have admin access')) {
          localStorage.removeItem('ahb_admin_token');
          setToken('');
          setUser(null);
        } else {
          setError(message);
        }
      }
    }

    void verifySession();

    return () => {
      active = false;
    };
  }, [token]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      const result = await api<{
        token: string;
        user: User;
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      }, '');

      if (!result.token) {
        throw new Error('The server did not return a login token.');
      }

      if (!['SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER', 'ADVERTISEMENT_MANAGER', 'COLLABORATION_MANAGER', 'MODERATOR', 'ANALYST'].includes(result.user?.role || '')) {
        throw new Error('This account is not authorized for admin access.');
      }

      localStorage.setItem('ahb_admin_token', result.token);
      setToken(result.token);
      setUser(result.user);
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem('ahb_admin_token');
    setToken('');
    setUser(null);
    setSummary(null);
    setAnime([]);
    setPayments([]);
    setRevenue(null);
    setAnalytics(null);
    setSponsors([]);
    setCampaigns([]);
    setStaff([]);
    setModComments([]);
  }

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');

    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  }

  async function reviewPayment(
    id: string,
    decision: 'APPROVE' | 'REJECT'
  ) {
    await runAction(async () => {
      await api(`/api/admin/payments/${encodeURIComponent(id)}/review`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          note: reviewNote[id] || ''
        })
      });
      await load();
      setNotice(`Payment ${decision.toLowerCase()}d.`);
    });
  }

  async function createAnime(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await runAction(async () => {
      await api('/api/admin/anime', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          slug: slug.trim(),
          status: 'UPCOMING',
          contentType: 'LICENSED',
          genres: [],
          published: false
        })
      });

      setTitle('');
      setSlug('');
      await load();
      setNotice('Anime draft created.');
    });
  }

  async function addSponsor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await runAction(async () => {
      await api('/api/admin/sponsors', {
        method: 'POST',
        body: JSON.stringify({
          companyName: sponsorName.trim(),
          amountBdt: Number(sponsorAmount || 0)
        })
      });

      setSponsorName('');
      setSponsorAmount('');
      await load();
      setNotice('Sponsor record created.');
    });
  }

  async function addCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await runAction(async () => {
      await api('/api/admin/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name: campaignName.trim(),
          provider: campaignProvider,
          placement: campaignPlacement,
          status: 'DRAFT'
        })
      });

      setCampaignName('');
      await load();
      setNotice('Campaign draft created.');
    });
  }

  async function importMetrics(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await runAction(async () => {
      await api('/api/admin/ad-metrics/import', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'ADSTERRA',
          date: metricDate,
          impressions: Number(metricImpressions),
          clicks: Number(metricClicks),
          revenue: Number(metricRevenue),
          currency: 'USD'
        })
      });

      setMetricImpressions('');
      setMetricClicks('');
      setMetricRevenue('');
      await load();
      setNotice('Ad report imported.');
    });
  }

  async function createStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await runAction(async () => {
      await api('/api/admin/staff', {
        method: 'POST',
        body: JSON.stringify({
          email: staffEmail.trim(),
          displayName: staffName.trim(),
          password: staffPassword,
          role: staffRole
        })
      });

      setStaffEmail('');
      setStaffName('');
      setStaffPassword('');
      await load();
      setNotice('Staff account created.');
    });
  }

  async function moderateComment(
    id: string,
    status: 'PUBLISHED' | 'HIDDEN' | 'REMOVED'
  ) {
    await runAction(async () => {
      await api(`/api/admin/moderation/comments/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      await load();
      setNotice('Comment moderation updated.');
    });
  }

  async function updateCampaign(campaign: Campaign) {
    await runAction(async () => {
      const status = campaign.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';

      await api(`/api/admin/campaigns/${encodeURIComponent(campaign.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });

      await load();
    });
  }

  async function updateSponsor(sponsor: Sponsor, status: string) {
    await runAction(async () => {
      await api(`/api/admin/sponsors/${encodeURIComponent(sponsor.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      await load();
    });
  }

  async function updateStaff(
    member: Staff,
    changes: { role?: string; status?: string }
  ) {
    await runAction(async () => {
      await api(`/api/admin/staff/${encodeURIComponent(member.id)}`, {
        method: 'PATCH',
        body: JSON.stringify(changes)
      });
      await load();
    });
  }

  if (!token || !user) {
    return (
      <div className="admin-shell">
        <form className="admin-login" onSubmit={login}>
          <div className="brandmark">AH</div>
          <p className="eyebrow">SECURE ADMIN ACCESS</p>
          <h1>Welcome back.</h1>
          <p className="muted">Sign in with your authorized Anime Hub Bangla account.</p>

          <label>
            Email
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={event => setEmail(event.target.value)}
            />
          </label>

          <label>
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={event => setPassword(event.target.value)}
            />
          </label>

          {error && <p className="error">{error}</p>}

          <button className="admin-submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="muted tiny">
            Admin access is restricted by server-side permissions.
          </p>

          <a href="/" className="muted tiny">Back to homepage</a>
        </form>
      </div>
    );
  }

  const canManageStaff = user.role === 'SUPER_ADMIN';
  const canModerate = ['SUPER_ADMIN', 'ADMIN', 'MODERATOR'].includes(user.role);

  return (
    <div className="admin-shell">
      <header className="admin-top">
        <a className="brand" href="/">
          <span className="brandmark">AH</span>
          ANIME HUB BANGLA / ADMIN
        </a>

        <div className="admin-user-actions">
          <span>{user.displayName || user.email} · {user.role}</span>
          <button onClick={logout} className="logout">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </header>

      <main className="admin-main">
        <div className="admin-heading">
          <div>
            <p className="eyebrow">CONTROL CENTER</p>
            <h1>Admin Dashboard</h1>
            <p className="muted">
              Information shown here comes from your connected database and imported reports.
            </p>
          </div>

          <button className="refresh" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={15} /> {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {error && <p className="error"><AlertCircle size={15} /> {error}</p>}
        {notice && <p className="success"><CheckCircle2 size={15} /> {notice}</p>}

        <div className="stats">
          <div><Film /><span>Anime records</span><strong>{summary?.anime ?? '—'}</strong></div>
          <div><Layers /><span>Episodes</span><strong>{summary?.episodes ?? '—'}</strong></div>
          <div><Users /><span>Users</span><strong>{summary?.users ?? '—'}</strong></div>
        </div>

        <section className="admin-panel">
          <h2><Plus size={18} /> Add anime</h2>

          <form className="anime-form" onSubmit={createAnime}>
            <label>
              Anime title
              <input required value={title} onChange={event => setTitle(event.target.value)} />
            </label>

            <label>
              URL slug
              <input
                required
                pattern="[a-z0-9-]+"
                value={slug}
                onChange={event => setSlug(event.target.value)}
              />
            </label>

            <button disabled={busy || !title.trim() || !slug.trim()}>
              Create draft
            </button>
          </form>

          <p className="muted tiny">New anime titles are created as unpublished drafts.</p>
        </section>

        <section className="admin-panel">
          <h2>Audience analytics · last 30 days</h2>
          <p className="muted tiny">
            Only recorded playback events are counted. This is not a page-view estimate.
          </p>

          <div className="stats">
            <div><span>Play events</span><strong>{analytics?.totals?.plays ?? 0}</strong></div>
            <div><span>Completions</span><strong>{analytics?.totals?.completions ?? 0}</strong></div>
            <div><span>Active viewers</span><strong>{analytics?.totals?.active_viewers ?? 0}</strong></div>
          </div>

          <h3>Top anime</h3>
          {analytics?.topAnime?.length ? analytics.topAnime.map(item => (
            <p key={item.title}>{item.title} · {item.plays} plays</p>
          )) : <p className="muted">No playback analytics recorded yet.</p>}
        </section>

        <section className="admin-panel">
          <h2>Revenue overview</h2>
          <p className="muted tiny">
            Verified payment records and manually imported ad reports only.
          </p>

          <div className="stats">
            <div>
              <span>Approved premium</span>
              <strong>৳{revenue?.premium?.amount_bdt ?? '—'}</strong>
              <small>{revenue?.premium?.count ?? 0} payments</small>
            </div>
            <div>
              <span>Sponsor deal value</span>
              <strong>৳{revenue?.sponsors?.contracted_bdt ?? '—'}</strong>
              <small>{revenue?.sponsors?.count ?? 0} records</small>
            </div>
            <div>
              <span>Ad report rows</span>
              <strong>{revenue?.ads?.length ?? '—'}</strong>
              <small>Imported provider data</small>
            </div>
          </div>

          {revenue?.manual?.map(item => (
            <p key={item.source}>{item.source}: {item.currency} {item.amount}</p>
          ))}

          {revenue?.ads?.map((item, index) => (
            <p key={`${item.provider}-${item.currency}-${index}`}>
              {item.provider} · {item.currency} {item.amount} · {item.impressions} impressions · {item.clicks} clicks
            </p>
          ))}

          <p className="muted tiny">{revenue?.note}</p>
        </section>

        <section className="admin-panel">
          <h2>Adsterra report import</h2>
          <p className="muted tiny">
            Automatic Adsterra integration is not enabled. Import figures from your real provider report.
          </p>

          <form className="anime-form" onSubmit={importMetrics}>
            <label>Date<input type="date" required value={metricDate} onChange={event => setMetricDate(event.target.value)} /></label>
            <label>Impressions<input type="number" min="0" required value={metricImpressions} onChange={event => setMetricImpressions(event.target.value)} /></label>
            <label>Clicks<input type="number" min="0" required value={metricClicks} onChange={event => setMetricClicks(event.target.value)} /></label>
            <label>Revenue (USD)<input type="number" min="0" step="0.0001" required value={metricRevenue} onChange={event => setMetricRevenue(event.target.value)} /></label>
            <button disabled={busy}>Import report</button>
          </form>
        </section>

        <section className="admin-panel">
          <h2>Ad campaign manager</h2>

          <form className="anime-form" onSubmit={addCampaign}>
            <label>Campaign name<input required value={campaignName} onChange={event => setCampaignName(event.target.value)} /></label>
            <label>
              Provider
              <select value={campaignProvider} onChange={event => setCampaignProvider(event.target.value)}>
                <option value="ADSTERRA">Adsterra</option>
                <option value="CUSTOM">Custom / Direct</option>
              </select>
            </label>
            <label>Placement<input value={campaignPlacement} onChange={event => setCampaignPlacement(event.target.value)} /></label>
            <button disabled={busy || !campaignName.trim()}>Add campaign draft</button>
          </form>

          {campaigns.map(campaign => (
            <div className="payment-review-row" key={campaign.id}>
              <b>{campaign.name}</b>
              <small>{campaign.provider} · {campaign.placement} · {campaign.status}</small>
              <button disabled={busy} onClick={() => void updateCampaign(campaign)}>
                {campaign.status === 'ACTIVE' ? 'Pause' : 'Activate'}
              </button>
            </div>
          ))}
        </section>

        <section className="admin-panel">
          <h2>Sponsor / partnership CRM</h2>

          <form className="anime-form" onSubmit={addSponsor}>
            <label>Company / sponsor name<input required value={sponsorName} onChange={event => setSponsorName(event.target.value)} /></label>
            <label>Deal value (BDT)<input type="number" min="0" value={sponsorAmount} onChange={event => setSponsorAmount(event.target.value)} /></label>
            <button disabled={busy || !sponsorName.trim()}>Add sponsor lead</button>
          </form>

          {sponsors.map(sponsor => (
            <div className="payment-review-row" key={sponsor.id}>
              <b>{sponsor.companyName}</b>
              <small>{sponsor.packageName || 'No package'} · ৳{sponsor.amountBdt} · {sponsor.status}</small>
              <select
                value={sponsor.status}
                disabled={busy}
                onChange={event => void updateSponsor(sponsor, event.target.value)}
              >
                {['LEAD', 'CONTACTED', 'NEGOTIATION', 'ACTIVE', 'COMPLETED', 'LOST'].map(status => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </div>
          ))}
        </section>

        <section className="admin-panel">
          <h2>Premium payment review</h2>
          <p className="muted tiny">
            Verify transactions with the payment provider before approving. Approval activates the submitted membership.
          </p>

          {payments.length ? (
            <div className="admin-list">
              {payments.map(payment => (
                <div className="payment-review-row" key={payment.id}>
                  <span>
                    <b>{payment.displayName} · {payment.email}</b>
                    <small>
                      {payment.plan} · {payment.paymentMethod} · ৳{payment.amountBdt}
                    </small>
                    <small>Transaction: {payment.transactionReference}</small>
                    <small>{new Date(payment.createdAt).toLocaleString()}</small>
                  </span>

                  <span className={
                    payment.status === 'APPROVED'
                      ? 'live'
                      : payment.status === 'PENDING'
                        ? 'draft'
                        : 'muted'
                  }>
                    {payment.status}
                  </span>

                  {payment.status === 'PENDING' && (
                    <div className="payment-review-actions">
                      <input
                        aria-label="Admin review note"
                        placeholder="Optional review note"
                        value={reviewNote[payment.id] || ''}
                        onChange={event => setReviewNote(current => ({
                          ...current,
                          [payment.id]: event.target.value
                        }))}
                      />

                      <button disabled={busy} onClick={() => void reviewPayment(payment.id, 'APPROVE')}>
                        Approve
                      </button>

                      <button disabled={busy} onClick={() => void reviewPayment(payment.id, 'REJECT')}>
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : <p className="muted">No payment submissions yet.</p>}
        </section>

        {canManageStaff && (
          <section className="admin-panel">
            <h2>Staff & permissions</h2>

            <form className="anime-form" onSubmit={createStaff}>
              <label>Name<input required value={staffName} onChange={event => setStaffName(event.target.value)} /></label>
              <label>Email<input type="email" required value={staffEmail} onChange={event => setStaffEmail(event.target.value)} /></label>
              <label>Temporary password<input type="password" minLength={12} required value={staffPassword} onChange={event => setStaffPassword(event.target.value)} /></label>
              <label>
                Role
                <select value={staffRole} onChange={event => setStaffRole(event.target.value)}>
                  <option value="ADMIN">Admin</option>
                  <option value="CONTENT_MANAGER">Content Manager</option>
                  <option value="ADVERTISEMENT_MANAGER">Advertisement Manager</option>
                  <option value="COLLABORATION_MANAGER">Collaboration Manager</option>
                  <option value="MODERATOR">Moderator</option>
                  <option value="ANALYST">Analyst</option>
                </select>
              </label>
              <button disabled={busy}>Create staff account</button>
            </form>

            {staff.map(member => (
              <div className="payment-review-row" key={member.id}>
                <b>{member.displayName || member.display_name || member.email}</b>
                <small>{member.email}</small>

                <select
                  value={member.role}
                  disabled={busy}
                  onChange={event => void updateStaff(member, { role: event.target.value })}
                >
                  {['ADMIN', 'CONTENT_MANAGER', 'ADVERTISEMENT_MANAGER', 'COLLABORATION_MANAGER', 'MODERATOR', 'ANALYST'].map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>

                <select
                  value={member.status}
                  disabled={busy}
                  onChange={event => void updateStaff(member, { status: event.target.value })}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
              </div>
            ))}
          </section>
        )}

        {canModerate && (
          <section className="admin-panel">
            <h2>Comment moderation queue</h2>

            {modComments.length ? modComments.map(comment => (
              <div className="payment-review-row" key={comment.id}>
                <span>
                  <b>{comment.displayName} · {comment.animeTitle}</b>
                  <small>{comment.body}</small>
                </span>

                <div className="payment-review-actions">
                  <button disabled={busy} onClick={() => void moderateComment(comment.id, 'PUBLISHED')}>Publish</button>
                  <button disabled={busy} onClick={() => void moderateComment(comment.id, 'HIDDEN')}>Hide</button>
                  <button disabled={busy} onClick={() => void moderateComment(comment.id, 'REMOVED')}>Remove</button>
                </div>
              </div>
            )) : <p className="muted">No comments waiting for moderation.</p>}
          </section>
        )}

        <EpisodeManager token={token} anime={anime} onChanged={() => void load()} />

        <section className="admin-panel">
          <h2>Anime catalogue</h2>

          {anime.length ? (
            <div className="admin-list">
              {anime.map(item => (
                <div key={item.id}>
                  <span>{item.title}<small>{item.slug}</small></span>
                  <span className={item.published ? 'live' : 'draft'}>
                    {item.published ? 'Published' : 'Draft'}
                  </span>
                </div>
              ))}
            </div>
          ) : <p className="muted">No anime records yet.</p>}
        </section>

        <div className="secure-note">
          <ShieldCheck size={18} />
          API authorization remains the source of truth for every admin action.
        </div>
      </main>
    </div>
  );
}
