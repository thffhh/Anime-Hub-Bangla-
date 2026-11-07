
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Handshake, Plus, RefreshCw, Pencil, Trash2, ExternalLink,
  Globe, Youtube, Instagram, Facebook, X, Check, AlertCircle
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'https://anime-hub-bangla.onrender.com';

type Partner = {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  logoUrl?: string;
  coverUrl?: string;
  websiteUrl?: string;
  facebookUrl?: string;
  youtubeUrl?: string;
  instagramUrl?: string;
  status: 'ACTIVE' | 'PAST';
  isFeatured: boolean;
  isPublished: boolean;
  displayOrder: number;
};

type PartnerForm = {
  name: string;
  slug: string;
  description: string;
  category: string;
  logoUrl: string;
  coverUrl: string;
  websiteUrl: string;
  facebookUrl: string;
  youtubeUrl: string;
  instagramUrl: string;
  status: 'ACTIVE' | 'PAST';
  isFeatured: boolean;
  isPublished: boolean;
  displayOrder: number;
};

const emptyForm: PartnerForm = {
  name: '',
  slug: '',
  description: '',
  category: 'DUBBING_TEAM',
  logoUrl: '',
  coverUrl: '',
  websiteUrl: '',
  facebookUrl: '',
  youtubeUrl: '',
  instagramUrl: '',
  status: 'ACTIVE',
  isFeatured: false,
  isPublished: true,
  displayOrder: 0
};

const categories = [
  ['DUBBING_TEAM', 'Dubbing team'],
  ['ANIMATION_STUDIO', 'Animation studio'],
  ['MEDIA_PARTNER', 'Media partner'],
  ['COMMUNITY_PARTNER', 'Community partner'],
  ['OTHER', 'Other']
];

function readToken() {
  return localStorage.getItem('ahb_admin_token') ||
    localStorage.getItem('ahb_token') ||
    localStorage.getItem('ahb_user_token') || '';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = readToken();
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

function normalizePartner(raw: any): Partner {
  return {
    id: String(raw.id),
    name: raw.name || '',
    slug: raw.slug || '',
    description: raw.description || '',
    category: raw.category || 'OTHER',
    logoUrl: raw.logoUrl ?? raw.logo_url ?? '',
    coverUrl: raw.coverUrl ?? raw.cover_url ?? '',
    websiteUrl: raw.websiteUrl ?? raw.website_url ?? '',
    facebookUrl: raw.facebookUrl ?? raw.facebook_url ?? '',
    youtubeUrl: raw.youtubeUrl ?? raw.youtube_url ?? '',
    instagramUrl: raw.instagramUrl ?? raw.instagram_url ?? '',
    status: raw.status === 'PAST' ? 'PAST' : 'ACTIVE',
    isFeatured: Boolean(raw.isFeatured ?? raw.is_featured),
    isPublished: Boolean(raw.isPublished ?? raw.is_published),
    displayOrder: Number(raw.displayOrder ?? raw.display_order ?? 0)
  };
}

export default function PartnerManagement() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [form, setForm] = useState<PartnerForm>(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'PAST'>('ALL');
  const [showForm, setShowForm] = useState(false);

  const loadPartners = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await request<{ data: any[] }>('/api/collaboration/admin/partners');
      setPartners((result.data || []).map(normalizePartner));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load partners.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPartners();
  }, [loadPartners]);

  function update<K extends keyof PartnerForm>(key: K, value: PartnerForm[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  function startCreate() {
    setForm(emptyForm);
    setEditingId('');
    setShowForm(true);
    setNotice('');
    setError('');
  }

  function startEdit(partner: Partner) {
    setEditingId(partner.id);
    setForm({
      name: partner.name,
      slug: partner.slug,
      description: partner.description,
      category: partner.category,
      logoUrl: partner.logoUrl || '',
      coverUrl: partner.coverUrl || '',
      websiteUrl: partner.websiteUrl || '',
      facebookUrl: partner.facebookUrl || '',
      youtubeUrl: partner.youtubeUrl || '',
      instagramUrl: partner.instagramUrl || '',
      status: partner.status,
      isFeatured: partner.isFeatured,
      isPublished: partner.isPublished,
      displayOrder: partner.displayOrder
    });
    setShowForm(true);
    setNotice('');
    setError('');
  }

  function closeForm() {
    if (saving) return;
    setShowForm(false);
    setEditingId('');
    setForm(emptyForm);
  }

  function makeSlug(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    const payload = {
      ...form,
      name: form.name.trim(),
      slug: form.slug.trim() || makeSlug(form.name),
      description: form.description.trim(),
      logoUrl: form.logoUrl.trim() || null,
      coverUrl: form.coverUrl.trim() || null,
      websiteUrl: form.websiteUrl.trim() || null,
      facebookUrl: form.facebookUrl.trim() || null,
      youtubeUrl: form.youtubeUrl.trim() || null,
      instagramUrl: form.instagramUrl.trim() || null
    };

    try {
      if (editingId) {
        await request(`/api/collaboration/admin/partners/${encodeURIComponent(editingId)}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
        setNotice('Partner information updated.');
      } else {
        await request('/api/collaboration/admin/partners', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        setNotice('New partner added.');
      }
      setShowForm(false);
      setEditingId('');
      setForm(emptyForm);
      await loadPartners();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save partner.');
    } finally {
      setSaving(false);
    }
  }

  async function deletePartner(partner: Partner) {
    if (!window.confirm(`Delete "${partner.name}" permanently?`)) return;
    setDeletingId(partner.id);
    setError('');
    setNotice('');

    try {
      await request(`/api/collaboration/admin/partners/${encodeURIComponent(partner.id)}`, {
        method: 'DELETE'
      });
      setPartners(current => current.filter(item => item.id !== partner.id));
      setNotice(`${partner.name} was deleted.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete partner.');
    } finally {
      setDeletingId('');
    }
  }

  const visiblePartners = partners.filter(partner =>
    filter === 'ALL' || partner.status === filter
  );

  return (
    <div className="pm-wrap">
      <style>{`
        .pm-wrap{color:#f3f3f5;font-family:inherit}
        .pm-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:22px;flex-wrap:wrap}
        .pm-title{display:flex;align-items:center;gap:12px}
        .pm-title-icon{width:44px;height:44px;display:grid;place-items:center;border-radius:12px;background:#d4af3718;color:#d4af37}
        .pm-title h2{font-size:22px;margin:0}.pm-title p{font-size:12px;color:#999ca7;margin:5px 0 0}
        .pm-actions{display:flex;gap:9px;flex-wrap:wrap}
        .pm-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid #ffffff18;background:#171922;color:#ddd;padding:10px 13px;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer}
        .pm-btn.primary{background:#d4af37;color:#17130a;border-color:#d4af37}
        .pm-btn.danger{color:#ff9a9a}
        .pm-btn:disabled{opacity:.5;cursor:wait}
        .pm-alert{padding:12px 14px;border-radius:8px;margin:12px 0;font-size:12px;line-height:1.5;background:#d4af3712;border:1px solid #d4af3733;color:#e4cd8c}
        .pm-alert.error{background:#e45c5c12;border-color:#e45c5c44;color:#ffaaaa}
        .pm-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:20px 0;flex-wrap:wrap}
        .pm-filters{display:flex;gap:6px;flex-wrap:wrap}
        .pm-filter{border:1px solid #ffffff18;background:#11131a;color:#aeb0b8;padding:8px 12px;border-radius:20px;font-size:10px;cursor:pointer}
        .pm-filter.active{border-color:#d4af3766;color:#d4af37;background:#d4af3714}
        .pm-count{font-size:11px;color:#999ca7}
        .pm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}
        .pm-card{border:1px solid #ffffff14;background:#11131a;border-radius:11px;overflow:hidden;min-width:0}
        .pm-cover{height:105px;background:linear-gradient(135deg,#27251c,#171922);position:relative;overflow:hidden}
        .pm-cover img{width:100%;height:100%;object-fit:cover}
        .pm-logo{width:58px;height:58px;border:3px solid #11131a;border-radius:12px;background:#22242c;position:absolute;left:16px;bottom:-15px;display:grid;place-items:center;overflow:hidden;color:#d4af37;font-weight:900}
        .pm-logo img{width:100%;height:100%;object-fit:cover}
        .pm-card-body{padding:25px 16px 15px}
        .pm-card-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
        .pm-card h3{font-size:14px;margin:0 0 5px;overflow-wrap:anywhere}
        .pm-category{font-size:9px;color:#d4af37;letter-spacing:.8px;text-transform:uppercase}
        .pm-status{font-size:8px;padding:5px 7px;border-radius:20px;background:#438b6318;color:#83d9a2;white-space:nowrap}
        .pm-status.past{background:#99999918;color:#aaa}
        .pm-status.hidden{background:#e0ad3518;color:#e8cb7b}
        .pm-description{font-size:11px;line-height:1.6;color:#a0a2ac;margin:12px 0;min-height:36px;overflow-wrap:anywhere}
        .pm-links{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
        .pm-links a{color:#c9ad59;display:inline-flex;align-items:center;gap:5px;font-size:10px}
        .pm-card-footer{display:flex;align-items:center;justify-content:space-between;border-top:1px solid #ffffff12;padding-top:12px;margin-top:12px}
        .pm-card-footer small{font-size:9px;color:#777b86}
        .pm-card-buttons{display:flex;gap:6px}
        .pm-icon-btn{width:31px;height:31px;display:grid;place-items:center;border:1px solid #ffffff18;border-radius:6px;background:#191b24;color:#c6c7cc;cursor:pointer}
        .pm-icon-btn.delete{color:#ff9292}
        .pm-empty{padding:55px 20px;text-align:center;border:1px dashed #ffffff22;border-radius:10px;color:#999ca7}
        .pm-empty svg{color:#d4af37;margin-bottom:12px}.pm-empty b{display:block;color:#eee;font-size:14px}.pm-empty p{font-size:11px}
        .pm-modal-backdrop{position:fixed;inset:0;z-index:1000;background:#000b;display:grid;place-items:center;padding:16px;overflow-y:auto}
        .pm-modal{width:min(680px,100%);max-height:92vh;overflow-y:auto;background:#11131a;border:1px solid #ffffff20;border-radius:13px;padding:22px;box-shadow:0 25px 90px #000b}
        .pm-modal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
        .pm-modal-head h3{margin:0;font-size:18px}
        .pm-close{border:0;background:none;color:#aaa;cursor:pointer}
        .pm-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}
        .pm-field{display:grid;gap:7px;min-width:0}.pm-field.full{grid-column:1/-1}
        .pm-field label{font-size:10px;color:#b8bac2;font-weight:700}
        .pm-field input,.pm-field textarea,.pm-field select{width:100%;background:#090b10;color:#eee;border:1px solid #ffffff20;border-radius:7px;padding:11px;font:inherit;font-size:11px;outline:none}
        .pm-field input:focus,.pm-field textarea:focus,.pm-field select:focus{border-color:#d4af37}
        .pm-field textarea{min-height:85px;resize:vertical}
        .pm-checks{display:flex;gap:18px;flex-wrap:wrap;margin:17px 0}
        .pm-checks label{display:flex;align-items:center;gap:8px;font-size:11px;color:#c4c5cb}
        .pm-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:20px}
        .pm-preview{display:flex;align-items:center;gap:12px;padding:10px;background:#090b10;border-radius:8px;margin-top:12px}
        .pm-preview img{width:44px;height:44px;object-fit:cover;border-radius:7px}
        @media(max-width:600px){.pm-grid{grid-template-columns:1fr}.pm-form-grid{grid-template-columns:1fr}.pm-field.full{grid-column:auto}.pm-modal{padding:16px}.pm-title h2{font-size:19px}}
      `}</style>

      <div className="pm-head">
        <div className="pm-title">
          <span className="pm-title-icon"><Handshake size={22} /></span>
          <div>
            <h2>Collaboration Partners</h2>
            <p>Manage the organizations featured on the public website.</p>
          </div>
        </div>
        <div className="pm-actions">
          <button className="pm-btn" onClick={() => void loadPartners()} disabled={loading}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="pm-btn primary" onClick={startCreate}>
            <Plus size={15} /> Add partner
          </button>
        </div>
      </div>

      {error && <div className="pm-alert error"><AlertCircle size={15} /> {error}</div>}
      {notice && <div className="pm-alert">{notice}</div>}

      <div className="pm-toolbar">
        <div className="pm-filters">
          {(['ALL', 'ACTIVE', 'PAST'] as const).map(item => (
            <button key={item} className={`pm-filter ${filter === item ? 'active' : ''}`} onClick={() => setFilter(item)}>
              {item === 'ALL' ? 'All partners' : item === 'ACTIVE' ? 'Active' : 'Past'}
            </button>
          ))}
        </div>
        <span className="pm-count">{visiblePartners.length} shown · {partners.length} total</span>
      </div>

      {loading ? (
        <div className="pm-empty"><RefreshCw size={22} /><p>Loading partner directory…</p></div>
      ) : visiblePartners.length ? (
        <div className="pm-grid">
          {visiblePartners.map(partner => (
            <article className="pm-card" key={partner.id}>
              <div className="pm-cover">
                {partner.coverUrl && <img src={partner.coverUrl} alt="" />}
                <span className="pm-logo">
                  {partner.logoUrl ? <img src={partner.logoUrl} alt={`${partner.name} logo`} /> : partner.name.slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="pm-card-body">
                <div className="pm-card-top">
                  <div>
                    <h3>{partner.name}</h3>
                    <span className="pm-category">{(categories.find(item => item[0] === partner.category)?.[1] || partner.category).toString()}</span>
                  </div>
                  <span className={`pm-status ${partner.status === 'PAST' ? 'past' : ''}`}>{partner.status}</span>
                </div>
                <p className="pm-description">{partner.description || 'No description provided.'}</p>
                <div className="pm-links">
                  {partner.websiteUrl && <a href={partner.websiteUrl} target="_blank" rel="noreferrer"><Globe size={13} /> Website <ExternalLink size={10} /></a>}
                  {partner.facebookUrl && <a href={partner.facebookUrl} target="_blank" rel="noreferrer"><Facebook size={13} /> Facebook</a>}
                  {partner.youtubeUrl && <a href={partner.youtubeUrl} target="_blank" rel="noreferrer"><Youtube size={13} /> YouTube</a>}
                  {partner.instagramUrl && <a href={partner.instagramUrl} target="_blank" rel="noreferrer"><Instagram size={13} /> Instagram</a>}
                </div>
                <div className="pm-card-footer">
                  <small>
                    #{partner.displayOrder} · {partner.isFeatured ? 'Featured' : 'Standard'} · {partner.isPublished ? 'Published' : 'Hidden'}
                  </small>
                  <div className="pm-card-buttons">
                    <button className="pm-icon-btn" onClick={() => startEdit(partner)} aria-label={`Edit ${partner.name}`}><Pencil size={14} /></button>
                    <button className="pm-icon-btn delete" onClick={() => void deletePartner(partner)} disabled={deletingId === partner.id} aria-label={`Delete ${partner.name}`}><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="pm-empty">
          <Handshake size={30} />
          <b>No partners found</b>
          <p>Add a collaboration partner to feature it on the public website.</p>
        </div>
      )}

      {showForm && (
        <div className="pm-modal-backdrop" onMouseDown={event => {
          if (event.target === event.currentTarget) closeForm();
        }}>
          <form className="pm-modal" onSubmit={submit}>
            <div className="pm-modal-head">
              <h3>{editingId ? 'Edit partner' : 'Add collaboration partner'}</h3>
              <button type="button" className="pm-close" onClick={closeForm} aria-label="Close"><X /></button>
            </div>

            <div className="pm-form-grid">
              <div className="pm-field">
                <label>Organization name *</label>
                <input required minLength={2} maxLength={120} value={form.name} onChange={event => {
                  const name = event.target.value;
                  setForm(current => ({
                    ...current,
                    name,
                    slug: editingId ? current.slug : makeSlug(name)
                  }));
                }} placeholder="e.g. BlackBird Studio" />
              </div>
              <div className="pm-field">
                <label>URL slug</label>
                <input maxLength={140} value={form.slug} onChange={event => update('slug', makeSlug(event.target.value))} placeholder="blackbird-studio" />
              </div>
              <div className="pm-field">
                <label>Partner category *</label>
                <select value={form.category} onChange={event => update('category', event.target.value)}>
                  {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="pm-field">
                <label>Status</label>
                <select value={form.status} onChange={event => update('status', event.target.value as PartnerForm['status'])}>
                  <option value="ACTIVE">Active partner</option>
                  <option value="PAST">Past collaboration</option>
                </select>
              </div>
              <div className="pm-field full">
                <label>Description</label>
                <textarea maxLength={2000} value={form.description} onChange={event => update('description', event.target.value)} placeholder="Briefly describe this organization and the collaboration." />
              </div>
              <div className="pm-field">
                <label>Logo image URL</label>
                <input type="url" value={form.logoUrl} onChange={event => update('logoUrl', event.target.value)} placeholder="https://…" />
              </div>
              <div className="pm-field">
                <label>Cover image URL</label>
                <input type="url" value={form.coverUrl} onChange={event => update('coverUrl', event.target.value)} placeholder="https://…" />
              </div>
              <div className="pm-field">
                <label>Website URL</label>
                <input type="url" value={form.websiteUrl} onChange={event => update('websiteUrl', event.target.value)} placeholder="https://…" />
              </div>
              <div className="pm-field">
                <label>Facebook URL</label>
                <input type="url" value={form.facebookUrl} onChange={event => update('facebookUrl', event.target.value)} placeholder="https://facebook.com/…" />
              </div>
              <div className="pm-field">
                <label>YouTube URL</label>
                <input type="url" value={form.youtubeUrl} onChange={event => update('youtubeUrl', event.target.value)} placeholder="https://youtube.com/…" />
              </div>
              <div className="pm-field">
                <label>Instagram URL</label>
                <input type="url" value={form.instagramUrl} onChange={event => update('instagramUrl', event.target.value)} placeholder="https://instagram.com/…" />
              </div>
              <div className="pm-field">
                <label>Display order</label>
                <input type="number" min={0} max={9999} value={form.displayOrder} onChange={event => update('displayOrder', Number(event.target.value))} />
              </div>
            </div>

            <div className="pm-checks">
              <label><input type="checkbox" checked={form.isFeatured} onChange={event => update('isFeatured', event.target.checked)} /> Featured partner</label>
              <label><input type="checkbox" checked={form.isPublished} onChange={event => update('isPublished', event.target.checked)} /> Publish on website</label>
            </div>

            {(form.logoUrl || form.coverUrl) && (
              <div className="pm-preview">
                {form.logoUrl && <img src={form.logoUrl} alt="Logo preview" />}
                <div><b>{form.name || 'Partner preview'}</b><small style={{ display: 'block', color: '#999', marginTop: 4 }}>Image preview</small></div>
              </div>
            )}

            <div className="pm-modal-actions">
              <button type="button" className="pm-btn" onClick={closeForm} disabled={saving}>Cancel</button>
              <button type="submit" className="pm-btn primary" disabled={saving}>
                {saving ? 'Saving…' : <><Check size={14} /> {editingId ? 'Save changes' : 'Add partner'}</>}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
