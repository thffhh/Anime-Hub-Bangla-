
import { useCallback, useEffect, useState, type FormEvent } from 'react';

const API = (
  import.meta.env.VITE_API_URL ||
  'https://anime-hub-bangla.onrender.com'
).replace(/\/$/, '');

type Partner = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  category: string;
  logoUrl?: string | null;
  coverUrl?: string | null;
  websiteUrl?: string | null;
  facebookUrl?: string | null;
  youtubeUrl?: string | null;
  instagramUrl?: string | null;
  status: 'ACTIVE' | 'PAST';
  isFeatured: boolean;
  isPublished: boolean;
  displayOrder: number;
};

const emptyForm = {
  name: '',
  slug: '',
  description: '',
  category: 'MEDIA_PARTNER',
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

export default function PartnerManagement({
  token
}: {
  token: string;
}) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [form, setForm] = useState<any>(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const api = useCallback(async (
    path: string,
    options: RequestInit = {}
  ) => {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Request failed (${response.status})`);
    }

    return data;
  }, [token]);

  const loadPartners = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const result = await api('/api/collaboration/admin/partners');
      setPartners(result.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load partners.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadPartners();
  }, [loadPartners]);

  function updateField(name: string, value: any) {
    setForm((previous: any) => ({
      ...previous,
      [name]: value
    }));
  }

  function editPartner(partner: Partner) {
    setEditingId(partner.id);

    setForm({
      name: partner.name || '',
      slug: partner.slug || '',
      description: partner.description || '',
      category: partner.category || 'MEDIA_PARTNER',
      logoUrl: partner.logoUrl || '',
      coverUrl: partner.coverUrl || '',
      websiteUrl: partner.websiteUrl || '',
      facebookUrl: partner.facebookUrl || '',
      youtubeUrl: partner.youtubeUrl || '',
      instagramUrl: partner.instagramUrl || '',
      status: partner.status || 'ACTIVE',
      isFeatured: partner.isFeatured,
      isPublished: partner.isPublished,
      displayOrder: partner.displayOrder || 0
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setEditingId('');
    setForm({ ...emptyForm });
  }

  async function savePartner(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const payload = {
      ...form,
      slug: form.slug.trim().toLowerCase(),
      description: form.description || null,
      logoUrl: form.logoUrl || null,
      coverUrl: form.coverUrl || null,
      websiteUrl: form.websiteUrl || null,
      facebookUrl: form.facebookUrl || null,
      youtubeUrl: form.youtubeUrl || null,
      instagramUrl: form.instagramUrl || null,
      displayOrder: Number(form.displayOrder)
    };

    try {
      await api(
        editingId
          ? `/api/collaboration/admin/partners/${editingId}`
          : '/api/collaboration/admin/partners',
        {
          method: editingId ? 'PATCH' : 'POST',
          body: JSON.stringify(payload)
        }
      );

      setMessage(editingId
        ? 'Partner updated successfully.'
        : 'Partner added successfully.'
      );

      resetForm();
      await loadPartners();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save partner.');
    } finally {
      setLoading(false);
    }
  }

  async function deletePartner(partner: Partner) {
    if (!window.confirm(`Delete ${partner.name}? This cannot be undone.`)) {
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      await api(`/api/collaboration/admin/partners/${partner.id}`, {
        method: 'DELETE'
      });

      setMessage('Partner deleted successfully.');
      await loadPartners();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete partner.');
    } finally {
      setLoading(false);
    }
  }

  const categories = [
    ['DUBBING_TEAM', 'Dubbing Team'],
    ['ANIMATION_STUDIO', 'Animation Studio'],
    ['MEDIA_PARTNER', 'Media Partner'],
    ['COMMUNITY_PARTNER', 'Community Partner'],
    ['DISTRIBUTION_PARTNER', 'Distribution Partner'],
    ['OTHER', 'Other']
  ];

  return (
    <div>
      <section className="sa-panel">
        <h2>🤝 Collaboration Management</h2>
        <p>
          Manage organizations that officially collaborate with Anime Hub Bangla.
          These partners can appear on the public Collaborations page.
        </p>

        {error && <div className="sa-error">{error}</div>}
        {message && <div className="sa-success">{message}</div>}

        <form className="sa-form" onSubmit={savePartner}>
          <h3>{editingId ? 'Edit Partner' : 'Add New Partner'}</h3>

          <label>Partner / Organization Name *</label>
          <input
            required
            minLength={2}
            maxLength={160}
            value={form.name}
            onChange={e => {
              const name = e.target.value;
              setForm((old: any) => ({
                ...old,
                name,
                slug: editingId ? old.slug : name
                  .toLowerCase()
                  .trim()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/^-|-$/g, '')
              }));
            }}
            placeholder="Example: BlackBird Studio"
          />

          <label>URL Slug *</label>
          <input
            required
            pattern="[a-z0-9-]+"
            value={form.slug}
            onChange={e => updateField('slug', e.target.value)}
            placeholder="blackbird-studio"
          />

          <label>Description</label>
          <textarea
            rows={4}
            value={form.description}
            onChange={e => updateField('description', e.target.value)}
            placeholder="Write about this collaboration..."
          />

          <label>Partner Category</label>
          <select
            value={form.category}
            onChange={e => updateField('category', e.target.value)}
          >
            {categories.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <label>Logo Image URL</label>
          <input
            type="url"
            value={form.logoUrl}
            onChange={e => updateField('logoUrl', e.target.value)}
            placeholder="https://..."
          />

          <label>Cover Image URL</label>
          <input
            type="url"
            value={form.coverUrl}
            onChange={e => updateField('coverUrl', e.target.value)}
            placeholder="https://..."
          />

          <label>Website URL</label>
          <input
            type="url"
            value={form.websiteUrl}
            onChange={e => updateField('websiteUrl', e.target.value)}
            placeholder="https://..."
          />

          <label>Facebook URL</label>
          <input
            type="url"
            value={form.facebookUrl}
            onChange={e => updateField('facebookUrl', e.target.value)}
            placeholder="https://facebook.com/..."
          />

          <label>YouTube URL</label>
          <input
            type="url"
            value={form.youtubeUrl}
            onChange={e => updateField('youtubeUrl', e.target.value)}
            placeholder="https://youtube.com/..."
          />

          <label>Instagram URL</label>
          <input
            type="url"
            value={form.instagramUrl}
            onChange={e => updateField('instagramUrl', e.target.value)}
            placeholder="https://instagram.com/..."
          />

          <label>Partner Status</label>
          <select
            value={form.status}
            onChange={e => updateField('status', e.target.value)}
          >
            <option value="ACTIVE">Active Partner</option>
            <option value="PAST">Past Partner</option>
          </select>

          <label>Display Order</label>
          <input
            type="number"
            min="0"
            value={form.displayOrder}
            onChange={e => updateField('displayOrder', e.target.value)}
          />

          <label className="sa-toggle">
            <input
              type="checkbox"
              checked={form.isFeatured}
              onChange={e => updateField('isFeatured', e.target.checked)}
            />
            Feature this partner
          </label>

          <label className="sa-toggle">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={e => updateField('isPublished', e.target.checked)}
            />
            Publish on website
          </label>

          <div className="sa-actions">
            <button className="sa-primary" disabled={loading}>
              {loading ? 'Saving...' : editingId ? 'Update Partner' : 'Add Partner'}
            </button>

            {editingId && (
              <button type="button" onClick={resetForm}>
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="sa-panel">
        <div className="sa-analytics-heading">
          <div>
            <h2>All Collaboration Partners</h2>
            <p className="sa-muted">
              {partners.length} partner record(s)
            </p>
          </div>

          <button onClick={loadPartners} disabled={loading}>
            Refresh
          </button>
        </div>

        {loading && <p>Loading partner records...</p>}

        {!loading && !partners.length && (
          <p>No partners have been added yet.</p>
        )}

        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Partner</th>
                <th>Category</th>
                <th>Status</th>
                <th>Visibility</th>
                <th>Featured</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {partners.map(partner => (
                <tr key={partner.id}>
                  <td>
                    <b>{partner.name}</b>
                    <br />
                    <small>{partner.slug}</small>
                  </td>
                  <td>{partner.category.replace(/_/g, ' ')}</td>
                  <td>{partner.status}</td>
                  <td>{partner.isPublished ? 'Published' : 'Hidden'}</td>
                  <td>{partner.isFeatured ? 'Yes' : 'No'}</td>
                  <td>
                    <div className="sa-actions">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => editPartner(partner)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => deletePartner(partner)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
