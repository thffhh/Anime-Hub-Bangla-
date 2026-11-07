
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  CheckCircle2, Pencil, Plus, RefreshCw, Trash2, UploadCloud,
  Video, X, AlertCircle, Play
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'https://anime-hub-bangla.onrender.com';

type Anime = { id: string; title: string };

type Episode = {
  id: string;
  episode_number: number;
  title: string;
  synopsis: string | null;
  runtime_seconds: number | null;
  thumbnail_url: string | null;
  video_provider: string | null;
  provider_video_id: string | null;
  published: boolean;
  is_premium?: boolean;
};

type EpisodeForm = {
  episodeNumber: string;
  title: string;
  synopsis: string;
  runtimeMinutes: string;
  thumbnailUrl: string;
  videoProvider: 'manual' | 'cloudflare-stream' | 'bunny';
  providerVideoId: string;
  published: boolean;
  isPremium: boolean;
};

type Props = {
  token: string;
  anime: Anime[];
  onChanged: () => void;
};

const emptyForm: EpisodeForm = {
  episodeNumber: '1',
  title: '',
  synopsis: '',
  runtimeMinutes: '',
  thumbnailUrl: '',
  videoProvider: 'manual',
  providerVideoId: '',
  published: false,
  isPremium: false
};

export default function EpisodeManager({ token, anime, onChanged }: Props) {
  const [selected, setSelected] = useState('');
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [form, setForm] = useState<EpisodeForm>(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const api = useCallback(async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : options.body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token}`,
        ...options.headers
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Request failed (${response.status})`);
    }

    return data as T;
  }, [token]);

  const load = useCallback(async () => {
    if (!selected || !token) {
      setEpisodes([]);
      return;
    }

    try {
      setError('');
      const result = await api<{ data: Episode[] }>(
        `/api/admin/anime/${encodeURIComponent(selected)}/episodes`
      );
      setEpisodes(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load episodes.');
    }
  }, [api, selected, token]);

  useEffect(() => {
    if (!selected && anime.length) setSelected(anime[0].id);
  }, [anime, selected]);

  useEffect(() => {
    void load();
  }, [load]);

  function reset() {
    setEditing(null);
    setForm(emptyForm);
  }

  function update<K extends keyof EpisodeForm>(key: K, value: EpisodeForm[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  function editEpisode(episode: Episode) {
    setEditing(episode.id);
    setForm({
      episodeNumber: String(episode.episode_number),
      title: episode.title,
      synopsis: episode.synopsis || '',
      runtimeMinutes: episode.runtime_seconds
        ? String(Math.round(episode.runtime_seconds / 60))
        : '',
      thumbnailUrl: episode.thumbnail_url || '',
      videoProvider: (episode.video_provider || 'manual') as EpisodeForm['videoProvider'],
      providerVideoId: episode.provider_video_id || '',
      published: episode.published,
      isPremium: Boolean(episode.is_premium)
    });
    setError('');
    setNotice('');
  }

  async function uploadVideo(file?: File) {
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      setError('একটি valid video file নির্বাচন করো।');
      return;
    }

    if (!token) {
      setError('Admin session পাওয়া যায়নি। আবার login করো।');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError('');
    setNotice('Cloudflare Stream upload প্রস্তুত হচ্ছে…');

    try {
      const created = await api<{ uploadURL: string; videoId: string }>(
        '/api/admin/video/cloudflare-upload-url',
        { method: 'POST', body: JSON.stringify({}) }
      );

      if (!created.uploadURL || !created.videoId) {
        throw new Error('Cloudflare upload URL পাওয়া যায়নি।');
      }

      await new Promise<void>((resolve, reject) => {
        const data = new FormData();
        data.append('file', file);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', created.uploadURL);

        xhr.upload.onprogress = event => {
          if (event.lengthComputable) {
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            update('videoProvider', 'cloudflare-stream');
            update('providerVideoId', created.videoId);
            setNotice('ভিডিও Cloudflare-এ আপলোড হয়েছে। এখন Save Episode চাপো।');
            resolve();
          } else {
            reject(new Error(`Cloudflare upload failed (${xhr.status})`));
          }
        };

        xhr.onerror = () => reject(new Error('Upload network error.'));
        xhr.onabort = () => reject(new Error('Upload cancelled.'));
        xhr.send(data);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Video upload failed.');
      setNotice('');
    } finally {
      setUploading(false);
    }
  }

  async function saveEpisode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selected) {
      setError('প্রথমে একটি anime নির্বাচন করো।');
      return;
    }

    const episodeNumber = Number(form.episodeNumber);
    const runtimeMinutes = form.runtimeMinutes ? Number(form.runtimeMinutes) : null;

    if (!Number.isInteger(episodeNumber) || episodeNumber < 1) {
      setError('Episode number অবশ্যই ১ বা তার বেশি হতে হবে।');
      return;
    }

    if (!form.title.trim()) {
      setError('Episode title লিখতে হবে।');
      return;
    }

    if (runtimeMinutes !== null &&
      (!Number.isFinite(runtimeMinutes) || runtimeMinutes < 1)) {
      setError('Runtime সঠিকভাবে লিখো।');
      return;
    }

    if (form.thumbnailUrl && !/^https:\/\//i.test(form.thumbnailUrl)) {
      setError('Thumbnail URL অবশ্যই HTTPS হতে হবে।');
      return;
    }

    if (form.providerVideoId && form.videoProvider === 'manual' &&
      !/^https:\/\//i.test(form.providerVideoId) &&
      !/^[a-zA-Z0-9_-]+$/.test(form.providerVideoId)) {
      setError('Video ID অথবা HTTPS video URL দাও।');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');

    const payload = {
      episodeNumber,
      title: form.title.trim(),
      synopsis: form.synopsis.trim() || null,
      runtimeSeconds: runtimeMinutes ? runtimeMinutes * 60 : null,
      thumbnailUrl: form.thumbnailUrl.trim() || null,
      videoProvider: form.videoProvider,
      providerVideoId: form.providerVideoId.trim() || null,
      published: form.published,
      isPremium: form.isPremium
    };

    try {
      await api(
        editing
          ? `/api/admin/episodes/${encodeURIComponent(editing)}`
          : `/api/admin/anime/${encodeURIComponent(selected)}/episodes`,
        {
          method: editing ? 'PUT' : 'POST',
          body: JSON.stringify(payload)
        }
      );

      reset();
      await load();
      onChanged();
      setNotice(editing ? 'Episode successfully updated.' : 'New episode successfully added.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save episode.');
    } finally {
      setBusy(false);
    }
  }

  async function removeEpisode(id: string) {
    if (!window.confirm('এই episode স্থায়ীভাবে delete করতে চাও?')) return;

    setError('');
    setNotice('');

    try {
      await api(`/api/admin/episodes/${encodeURIComponent(id)}`, { method: 'DELETE' });

      if (editing === id) reset();

      await load();
      onChanged();
      setNotice('Episode deleted successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete episode.');
    }
  }

  return (
    <section className="admin-panel episode-manager">
      <div className="episode-manager-heading">
        <div>
          <span className="episode-kicker">CONTENT MANAGEMENT</span>
          <h2><Video size={20} /> Episode Manager</h2>
          <p>Anime episodes, video sources and publishing controls.</p>
        </div>
        <button type="button" className="refresh" onClick={() => void load()} disabled={busy || uploading}>
          <RefreshCw size={15} /> Reload
        </button>
      </div>

      {error && <div className="episode-message error" role="alert"><AlertCircle size={16} />{error}</div>}
      {notice && <div className="episode-message success" role="status"><CheckCircle2 size={16} />{notice}</div>}

      <label className="select-label">
        Select anime
        <select value={selected} onChange={event => {
          setSelected(event.target.value);
          reset();
          setError('');
          setNotice('');
        }}>
          <option value="">Choose an anime…</option>
          {anime.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </label>

      {selected ? (
        <>
          <form className="episode-form" onSubmit={saveEpisode}>
            <div className="form-title">
              <strong>{editing ? 'Edit Episode' : 'Add New Episode'}</strong>
              {editing && <button type="button" className="icon-button" onClick={reset}><X size={15} /> Cancel</button>}
            </div>

            <div className="episode-grid">
              <label>
                Episode number
                <input type="number" min="1" step="1" required value={form.episodeNumber}
                  onChange={event => update('episodeNumber', event.target.value)} />
              </label>

              <label>
                Episode title
                <input required maxLength={200} value={form.title}
                  onChange={event => update('title', event.target.value)}
                  placeholder="Episode title" />
              </label>

              <label>
                Runtime (minutes)
                <input type="number" min="1" value={form.runtimeMinutes}
                  onChange={event => update('runtimeMinutes', event.target.value)}
                  placeholder="24" />
              </label>

              <label>
                Thumbnail URL
                <input type="url" value={form.thumbnailUrl}
                  onChange={event => update('thumbnailUrl', event.target.value)}
                  placeholder="https://example.com/thumbnail.jpg" />
              </label>

              <label>
                Video provider
                <select value={form.videoProvider}
                  onChange={event => update('videoProvider', event.target.value as EpisodeForm['videoProvider'])}>
                  <option value="manual">Manual / External</option>
                  <option value="cloudflare-stream">Cloudflare Stream</option>
                  <option value="bunny">Bunny Stream</option>
                </select>
              </label>

              <label>
                Provider video ID / URL
                <input value={form.providerVideoId}
                  onChange={event => update('providerVideoId', event.target.value)}
                  placeholder="Provider video ID or HTTPS URL" />
              </label>
            </div>

            <label className="episode-description">
              Episode synopsis
              <textarea rows={3} maxLength={5000} value={form.synopsis}
                onChange={event => update('synopsis', event.target.value)}
                placeholder="Write episode description…" />
            </label>

            <div className="upload-box">
              <div className="upload-heading">
                <UploadCloud size={22} />
                <div>
                  <strong>Cloudflare Stream Upload</strong>
                  <small>Upload video directly to your Cloudflare Stream account.</small>
                </div>
              </div>

              <input type="file" accept="video/*" disabled={uploading || busy}
                onChange={event => {
                  const file = event.target.files?.[0];
                  if (file) void uploadVideo(file);
                  event.currentTarget.value = '';
                }} />

              {uploading && (
                <>
                  <div className="upload-track"><i style={{ width: `${uploadProgress}%` }} /></div>
                  <small>Uploading… {uploadProgress}%</small>
                </>
              )}

              {!uploading && form.videoProvider === 'cloudflare-stream' && form.providerVideoId && (
                <small className="upload-success"><CheckCircle2 size={14} /> Cloudflare video ID added</small>
              )}

              <small>
                Upload শেষ হলে Save Episode চাপতে হবে। Cloudflare Account ID এবং API Token
                backend environment-এ configured থাকতে হবে।
              </small>
            </div>

            <div className="episode-options">
              <label className="publish-check">
                <input type="checkbox" checked={form.isPremium}
                  onChange={event => update('isPremium', event.target.checked)} />
                Premium episode
              </label>

              <label className="publish-check">
                <input type="checkbox" checked={form.published}
                  onChange={event => update('published', event.target.checked)} />
                Publish episode
              </label>
            </div>

            <button className="save-episode" type="submit"
              disabled={busy || uploading || !form.title.trim() || !form.episodeNumber}>
              {busy ? 'Saving…' : editing ? 'Save Changes' : 'Add Episode'}
              <Plus size={17} />
            </button>
          </form>

          <div className="episode-list-head">
            <strong>Episodes ({episodes.length})</strong>
            <span>{episodes.filter(item => item.published).length} published · {episodes.filter(item => !item.published).length} drafts</span>
          </div>

          {episodes.length ? (
            <div className="episode-list">
              {episodes.map(episode => (
                <div className="episode-row" key={episode.id}>
                  <b className="episode-number">EP {String(episode.episode_number).padStart(2, '0')}</b>

                  <div className="episode-info">
                    <strong>{episode.title}</strong>
                    <small>
                      {episode.runtime_seconds ? `${Math.round(episode.runtime_seconds / 60)} min · ` : ''}
                      {episode.video_provider || 'manual'} ·
                      {' '}{episode.provider_video_id ? 'Video configured' : 'No video ID'} ·
                      {' '}{episode.is_premium ? 'Premium' : 'Free'}
                    </small>
                  </div>

                  <span className={episode.published ? 'live' : 'draft'}>
                    {episode.published ? 'Published' : 'Draft'}
                  </span>

                  <button type="button" className="icon-button" onClick={() => editEpisode(episode)} title="Edit episode">
                    <Pencil size={15} />
                  </button>

                  <button type="button" className="icon-button danger" onClick={() => void removeEpisode(episode.id)} title="Delete episode">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted"><Play size={15} /> এই anime-তে এখনো কোনো episode যোগ করা হয়নি।</p>
          )}
        </>
      ) : (
        <p className="muted">প্রথমে একটি anime তৈরি করে নির্বাচন করো।</p>
      )}

      <style>{`
        .episode-manager-heading{display:flex;align-items:center;justify-content:space-between;gap:15px;margin-bottom:20px}
        .episode-manager-heading h2{display:flex;align-items:center;gap:9px;margin:7px 0;font-size:20px}
        .episode-manager-heading p{margin:0;color:#999;font-size:12px}
        .episode-kicker{font-size:9px;letter-spacing:1.7px;color:#d4af37;font-weight:800}
        .episode-message{display:flex;align-items:center;gap:9px;padding:11px 13px;border-radius:7px;font-size:12px;margin:12px 0}
        .episode-message.error{background:#d94b4b16;color:#ff9999;border:1px solid #d94b4b44}
        .episode-message.success{background:#399b6416;color:#91d8a9;border:1px solid #399b6444}
        .episode-options{display:flex;flex-wrap:wrap;gap:20px;margin:16px 0}
        .episode-list-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:24px 0 12px}
        .episode-list-head span{font-size:10px;color:#999}
        .upload-success{display:flex;align-items:center;gap:6px;color:#8bd6a2}
        .muted{display:flex;align-items:center;gap:8px;color:#999;font-size:12px}
        @media(max-width:600px){.episode-manager-heading{align-items:flex-start;flex-direction:column}.episode-row{flex-wrap:wrap}.episode-list-head{align-items:flex-start;flex-direction:column}}
      `}</style>
    </section>
  );
}
