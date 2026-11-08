import { useEffect, useState, type FormEvent } from 'react';
import {
  LogOut, Plus, RefreshCw, ShieldCheck, Film, Users, Layers,
  AlertCircle, CheckCircle2
} from 'lucide-react';
import EpisodeManager from './EpisodeManager';

import { API, loginError } from './api';

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
  originalTitle?: string | null;
  synopsis?: string | null;
  posterUrl?: string | null;
  bannerUrl?: string | null;
  releaseYear?: number | null;
  status?: string;
  genres?: string[];
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

type ModReport = { id: string; commentId: string | null; reason: string; body: string | null; reporterName: string | null; createdAt: string };

type Analytics = {
  totals?: {
    plays?: number;
    completions?: number;
    active_viewers?: number;
  };
  topAnime?: Array<{ title: string; plays: number }>;
};

type AdminView = 'content' | 'operations' | 'staff';

export default function Admin({ view = 'operations' }: { view?: AdminView }) {
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
  const [modReports, setModReports] = useState<ModReport[]>([]);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [editingAnime, setEditingAnime] = useState<Anime | null>(null);
  const [animeForm, setAnimeForm] = useState({ title: '', slug: '', originalTitle: '', synopsis: '', posterUrl: '', bannerUrl: '', releaseYear: '', status: 'UPCOMING', genres: '' });
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

    const paths = [
      '/api/admin/summary', '/api/admin/anime', '/api/admin/payments',
      '/api/admin/revenue', '/api/admin/analytics', '/api/admin/sponsors',
      '/api/admin/campaigns', '/api/admin/users', '/api/admin/moderation'
    ];
    const needed = view === 'content' ? [1] : view === 'staff' ? [7] : [2, 3, 4, 5, 6, 8];
    const results = await Promise.allSettled(paths.map((path, index) =>
      needed.includes(index) ? api(path) : Promise.resolve(null)
    ));

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
    const md = value(8) as { comments: ModComment[]; reports: ModReport[] } | null;

    if (s) setSummary(s);
    if (a) setAnime(a.data || []);
    if (p) setPayments(p.data || []);
    if (r) setRevenue(r);
    if (an) setAnalytics(an);
    if (sp) setSponsors(sp.data || []);
    if (ca) setCampaigns(ca.data || []);
    if (st) setStaff(st.data || []);
    if (md) { setModComments(md.comments || []); setModReports(md.reports || []); }

    const failed = needed.filter(index => results[index].status === 'rejected');
    if (failed.length) {
      const messages = failed.map(index => {
        const result = results[index];
        return `${paths[index].split('/').pop()}: ${result.status === 'rejected' ? (result.reason instanceof Error ? result.reason.message : 'request failed') : ''}`;
      });
      setError(`Could not load ${messages.join('; ')}. Please check API access and retry.`);
    }
    setNotice('');

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
      setError(loginError(err));
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
    setModReports([]);
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

  function editAnime(item: Anime) {
    setEditingAnime(item);
    setAnimeForm({ title: item.title, slug: item.slug, originalTitle: item.originalTitle || '', synopsis: item.synopsis || '', posterUrl: item.posterUrl || '', bannerUrl: item.bannerUrl || '', releaseYear: item.releaseYear ? String(item.releaseYear) : '', status: item.status || 'UPCOMING', genres: (item.genres || []).join(', ') });
  }

  async function saveAnime(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingAnime) return;
    await runAction(async () => {
      await api(`/api/admin/anime/${encodeURIComponent(editingAnime.id)}`, {
        method: 'PUT', body: JSON.stringify({
          title: animeForm.title.trim(), slug: animeForm.slug.trim(),
          originalTitle: animeForm.originalTitle.trim() || null,
          synopsis: animeForm.synopsis.trim() || null,
          posterUrl: animeForm.posterUrl.trim() || null,
          bannerUrl: animeForm.bannerUrl.trim() || null,
          releaseYear: animeForm.releaseYear ? Number(animeForm.releaseYear) : null,
          status: animeForm.status,
          genres: [...new Set(animeForm.genres.split(',').map(value => value.trim()).filter(Boolean))]
        })
      });
      setEditingAnime(null);
      await load();
      setNotice('Anime details saved.');
    });
  }

  async function toggleAnime(item: Anime) {
    if (!window.confirm(`${item.published ? 'Unpublish' : 'Publish'} "${item.title}"?`)) return;
    await runAction(async () => {
      await api(`/api/admin/anime/${encodeURIComponent(item.id)}`, {
        method: 'PUT', body: JSON.stringify({ published: !item.published })
      });
      await load();
      setNotice(item.published ? 'Anime unpublished.' : 'Anime published.');
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

  async function reviewReport(id: string, status: 'RESOLVED' | 'DISMISSED') {
    if (!window.confirm(`${status === 'RESOLVED' ? 'Resolve' : 'Dismiss'} this report?`)) return;
    await runAction(async () => {
      await api(`/api/admin/moderation/reports/${encodeURIComponent(id)}`, {
        method: 'PATCH', body: JSON.stringify({ status })
      });
      await load();
      setNotice(`Report ${status.toLowerCase()}.`);
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

  if (token && !user) {
    return <div className="admin-embedded-status" role="status">{error || 'Checking admin session…'}</div>;
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
      <main className="admin-main">
        <div className="admin-toolbar">
          <p className="muted">Manage this section using your connected API.</p>
          <button className="refresh" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={15} /> {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {error && <p className="error"><AlertCircle size={15} /> {error}</p>}
        {notice && <p className="success"><CheckCircle2 size={15} /> {notice}</p>}

        {view === 'content' && <section className="admin-panel">
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
        </section>}

        {view === 'operations' && <>
        <section className="admin-panel">
          <h2>Audience analytics · last 30 days</h2>
          <p className="muted tiny">
            Only recorded playback events are counted. This is not a page-view estimate.
          </p>

          <div className="stats">
            <div><span>Play events</span><strong>{analytics?.totals?.plays ?? '—'}</strong></div>
            <div><span>Completions</span><strong>{analytics?.totals?.completions ?? '—'}</strong></div>
            <div><span>Active viewers</span><strong>{analytics?.totals?.active_viewers ?? '—'}</strong></div>
          </div>

          <h3>Top anime</h3>
          {analytics?.topAnime?.length ? analytics.topAnime.map(item => (
            <p key={item.title}>{item.title} · {item.plays} plays</p>
          )) : <p className="muted">{loading ? 'Loading analytics…' : analytics ? 'No playback analytics recorded yet.' : 'Analytics unavailable.'}</p>}
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
          ) : <p className="muted">{loading ? 'Loading payments…' : error ? 'Payments may be unavailable; check the error above.' : 'No payment submissions yet.'}</p>}
        </section>

        </>}

        {view === 'staff' && canManageStaff && (
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

            {staff.filter(member => member.role !== 'USER').map(member => (
              <div className="payment-review-row" key={member.id}>
                <b>{member.displayName || member.display_name || member.email}</b>
                <small>{member.email}</small>

                <select
                  value={member.role}
                  disabled={busy || member.role === 'SUPER_ADMIN'}
                  onChange={event => void updateStaff(member, { role: event.target.value })}
                >
                  {member.role === 'SUPER_ADMIN' && <option value="SUPER_ADMIN">SUPER_ADMIN</option>}
                  {['ADMIN', 'CONTENT_MANAGER', 'ADVERTISEMENT_MANAGER', 'COLLABORATION_MANAGER', 'MODERATOR', 'ANALYST'].map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>

                <select
                  value={member.status}
                  disabled={busy || member.role === 'SUPER_ADMIN'}
                  onChange={event => void updateStaff(member, { status: event.target.value })}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
              </div>
            ))}
          </section>
        )}

        {view === 'operations' && canModerate && (
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
            )) : <p className="muted">{loading ? 'Loading moderation queue…' : error ? 'Moderation may be unavailable; check the error above.' : 'No comments waiting for moderation.'}</p>}
          </section>
        )}

        {view === 'operations' && canModerate && <section className="admin-panel">
          <h2>Open content reports</h2>
          <p className="muted">Review the report and moderate the comment separately if needed. Resolving a report does not remove the comment.</p>
          {modReports.length ? modReports.map(report => <div className="payment-review-row" key={report.id}>
            <span><b>{report.reporterName || 'Community member'}</b><small>Reason: {report.reason}</small><small>Comment: {report.body || 'Comment unavailable'}</small><small>{new Date(report.createdAt).toLocaleString()}</small></span>
            <div className="payment-review-actions">{report.commentId && <button disabled={busy} onClick={() => { if (window.confirm('Hide this reported comment?')) void moderateComment(report.commentId!, 'HIDDEN'); }}>Hide comment</button>}<button disabled={busy} onClick={() => void reviewReport(report.id, 'RESOLVED')}>Resolve</button><button disabled={busy} onClick={() => void reviewReport(report.id, 'DISMISSED')}>Dismiss</button></div>
          </div>) : <p className="muted">{loading ? 'Loading reports…' : error ? 'Reports may be unavailable; check the error above.' : 'No open reports.'}</p>}
        </section>}

        {view === 'content' && <>
        {editingAnime && <section className="admin-panel">
          <h2>Edit anime details</h2>
          <form className="anime-edit-form" onSubmit={saveAnime}>
            <label>Title<input required maxLength={200} value={animeForm.title} onChange={e => setAnimeForm({ ...animeForm, title: e.target.value })} /></label>
            <label>URL slug<input required minLength={2} pattern="[a-z0-9-]+" value={animeForm.slug} onChange={e => setAnimeForm({ ...animeForm, slug: e.target.value })} /></label>
            <label>Original title<input maxLength={200} value={animeForm.originalTitle} onChange={e => setAnimeForm({ ...animeForm, originalTitle: e.target.value })} /></label>
            <label>Release year<input type="number" min="1900" max="2200" value={animeForm.releaseYear} onChange={e => setAnimeForm({ ...animeForm, releaseYear: e.target.value })} /></label>
            <label>Poster URL<input type="url" value={animeForm.posterUrl} onChange={e => setAnimeForm({ ...animeForm, posterUrl: e.target.value })} /></label>
            <label>Banner URL<input type="url" value={animeForm.bannerUrl} onChange={e => setAnimeForm({ ...animeForm, bannerUrl: e.target.value })} /></label>
            <label>Status<select value={animeForm.status} onChange={e => setAnimeForm({ ...animeForm, status: e.target.value })}>{['UPCOMING', 'ONGOING', 'COMPLETED', 'HIATUS'].map(status => <option key={status}>{status}</option>)}</select></label>
            <label>Genres (comma separated)<input value={animeForm.genres} onChange={e => setAnimeForm({ ...animeForm, genres: e.target.value })} /></label>
            <label className="anime-edit-wide">Synopsis<textarea maxLength={10000} value={animeForm.synopsis} onChange={e => setAnimeForm({ ...animeForm, synopsis: e.target.value })} /></label>
            <div className="anime-edit-wide anime-edit-actions"><button className="admin-submit" disabled={busy}>Save changes</button><button className="icon-button" type="button" onClick={() => setEditingAnime(null)}>Cancel</button></div>
          </form>
        </section>}
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
                  <button className="icon-button" disabled={busy} onClick={() => editAnime(item)}>Edit</button>
                  <button className="icon-button" disabled={busy} onClick={() => void toggleAnime(item)}>{item.published ? 'Unpublish' : 'Publish'}</button>
                </div>
              ))}
            </div>
          ) : <p className="muted">{loading ? 'Loading anime…' : error ? 'Anime catalogue is unavailable.' : 'No anime records yet.'}</p>}
        </section>

        </>}

        <div className="secure-note">
          <ShieldCheck size={18} />
          API authorization remains the source of truth for every admin action.
        </div>
      </main>
    </div>
  );
}
