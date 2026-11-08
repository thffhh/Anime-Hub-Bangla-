import { useEffect, useState, type FormEvent } from 'react';
import { API } from './api';

type Cover = { title: string; imageUrl: string; animeSlug: string; episodeId: string };
type Anime = { id: string; title: string; slug: string; published: boolean };
type Episode = { id: string; episode_number: number; title: string; published: boolean };
const empty: Cover = { title: '', imageUrl: '', animeSlug: '', episodeId: '' };

export default function HomepageCovers({ anime }: { anime: Anime[] }) {
  const [covers, setCovers] = useState<Cover[]>([]);
  const [draft, setDraft] = useState<Cover>(empty);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const token = localStorage.getItem('ahb_admin_token') || '';
  const publishedAnime = anime.filter(item => item.published);
  const chosenAnime = publishedAnime.find(item => item.slug === draft.animeSlug);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API}/api/admin/settings`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not load covers'); return data; })
      .then(data => { setCovers(Array.isArray(data.data?.heroCovers) ? data.data.heroCovers : []); setLoaded(true); })
      .catch(err => { if (err.name !== 'AbortError') setError(err.message || 'Could not load covers'); });
    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    setEpisodes([]);
    if (!chosenAnime) return;
    const controller = new AbortController();
    fetch(`${API}/api/admin/anime/${encodeURIComponent(chosenAnime.id)}/episodes`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not load episodes'); return data; })
      .then(data => setEpisodes((data.data || []).filter((episode: Episode) => episode.published)))
      .catch(err => { if (err.name !== 'AbortError') setError(err.message || 'Could not load episodes'); });
    return () => controller.abort();
  }, [chosenAnime?.id, token]);

  async function uploadImage(file: File | undefined) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Choose a JPEG, PNG or WebP image up to 5 MB.');
      return;
    }
    setUploading(true); setError(''); setMessage('');
    try {
      const body = new FormData();
      body.append('image', file);
      const response = await fetch(`${API}/api/admin/media/cover`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.url !== 'string') throw new Error(result.error || 'Could not upload image');
      setDraft(current => ({ ...current, imageUrl: result.url }));
      setMessage('Image uploaded. Add the cover and save to publish it.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not upload image'); }
    finally { setUploading(false); }
  }

  function add(event: FormEvent) {
    event.preventDefault();
    if (covers.length >= 8 || !episodes.some(item => item.id === draft.episodeId)) return;
    if (!draft.title.trim()) { setError('Please enter a cover title.'); return; }
    try { if (new URL(draft.imageUrl).protocol !== 'https:') throw new Error(); } catch { setError('Use a valid HTTPS image URL.'); return; }
    setCovers(current => [...current, { ...draft, title: draft.title.trim(), imageUrl: draft.imageUrl.trim() }]);
    setDraft(empty); setMessage('Cover added to draft. Select Save covers to publish changes.'); setError('');
  }
  async function save() {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(`${API}/api/admin/settings`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ heroCovers: covers }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save covers');
      setMessage('Homepage covers saved.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save covers'); }
    finally { setBusy(false); }
  }
  return <section className="cover-manager">
    <h3>Homepage covers</h3>
    <p>Add up to eight covers. Upload an image to configured R2 storage or use an HTTPS image URL, then select a published anime and episode. Upload the video first in Anime &amp; Episodes.</p>
    {error && <p className="cover-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <form className="cover-form" onSubmit={add}>
      <label>Cover title<input required maxLength={100} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
      <label>Upload cover image<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || uploading} onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; void uploadImage(file); }} /><small>{uploading ? 'Uploading…' : 'JPEG, PNG or WebP · maximum 5 MB · R2 configuration required'}</small></label>
      <label>HTTPS image URL<input required type="url" value={draft.imageUrl} onChange={e => setDraft({ ...draft, imageUrl: e.target.value })} placeholder="https://…" /></label>
      <label>Published anime<select required value={draft.animeSlug} onChange={e => setDraft({ ...draft, animeSlug: e.target.value, episodeId: '' })}><option value="">Select anime</option>{publishedAnime.map(item => <option key={item.id} value={item.slug}>{item.title}</option>)}</select></label>
      <label>Published episode<select required value={draft.episodeId} onChange={e => setDraft({ ...draft, episodeId: e.target.value })}><option value="">Select episode</option>{episodes.map(item => <option key={item.id} value={item.id}>Episode {item.episode_number}: {item.title}</option>)}</select></label>
      <button disabled={!loaded || busy || uploading || covers.length >= 8} type="submit">Add cover</button>
    </form>
    <div className="cover-list">{covers.map((cover, index) => <div key={`${cover.episodeId}-${index}`}><img src={cover.imageUrl} alt="" /><span><b>{cover.title}</b><small>{cover.animeSlug} · episode {cover.episodeId}</small></span><button type="button" onClick={() => setCovers(items => items.filter((_, i) => i !== index))} disabled={busy}>Remove</button></div>)}</div>
    <button className="cover-save" type="button" onClick={() => void save()} disabled={!loaded || busy || uploading}>{busy ? 'Saving…' : 'Save covers'}</button>
  </section>;
}
