
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Hls from 'hls.js';
import {
  ArrowLeft, Play, Film, AlertCircle, Heart, Star,
  MessageCircle, Clock3, RefreshCw
} from 'lucide-react';

import { API } from './api';

type Episode = {
  id: string;
  episodeNumber: number;
  title: string;
  synopsis?: string | null;
  runtimeSeconds?: number | null;
  thumbnailUrl?: string | null;
  isPremium?: boolean;
};

type Anime = {
  id: string;
  slug: string;
  title: string;
  originalTitle?: string | null;
  synopsis?: string | null;
  posterUrl?: string | null;
  bannerUrl?: string | null;
  releaseYear?: number | null;
  status: string;
  genres: string[];
  episodes: Episode[];
};

type PlaybackSource = {
  videoProvider: string;
  providerVideoId: string;
};

type Review = {
  id: string;
  score: number;
  review: string;
  spoiler?: boolean;
  createdAt: string;
  displayName: string;
};

type Comment = {
  id: string;
  body: string;
  createdAt: string;
  displayName: string;
};

function getToken() {
  return localStorage.getItem('ahb_token') || localStorage.getItem('ahb_user_token');
}

function mapEpisode(raw: any): Episode {
  return {
    id: String(raw.id || ''),
    episodeNumber: Number(raw.episode_number ?? raw.episodeNumber ?? 0),
    title: raw.title || 'Untitled Episode',
    synopsis: raw.synopsis ?? null,
    runtimeSeconds: raw.runtime_seconds ?? raw.runtimeSeconds ?? null,
    thumbnailUrl: raw.thumbnail_url ?? raw.thumbnailUrl ?? null,
    isPremium: Boolean(raw.is_premium ?? raw.isPremium)
  };
}

function mapAnime(raw: any): Anime {
  return {
    id: String(raw.id || ''),
    slug: raw.slug || '',
    title: raw.title || 'Untitled Anime',
    originalTitle: raw.original_title ?? raw.originalTitle ?? null,
    synopsis: raw.synopsis ?? raw.description ?? null,
    posterUrl: raw.poster_url ?? raw.posterUrl ?? null,
    bannerUrl: raw.banner_url ?? raw.bannerUrl ?? null,
    releaseYear: raw.release_year ?? raw.releaseYear ?? null,
    status: raw.status || 'UNKNOWN',
    genres: Array.isArray(raw.genres)
      ? raw.genres.map((genre: any) => typeof genre === 'string' ? genre : genre?.name).filter(Boolean)
      : [],
    episodes: Array.isArray(raw.episodes) ? raw.episodes.map(mapEpisode) : []
  };
}

function Player({ episode }: { episode: Episode }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSaved = useRef(0);
  const playRecorded = useRef(false);
  const [source, setSource] = useState<PlaybackSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError('');
      setSource(null);
      lastSaved.current = 0;
      playRecorded.current = false;

      try {
        const token = getToken();
        const response = await fetch(`${API}/api/episodes/${encodeURIComponent(episode.id)}/playback`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) throw new Error(result.error || 'Playback unavailable');

        const data = result.data;
        if (!data) throw new Error('Playback information was not found.');

        if (active) {
          setSource({
            videoProvider: String(data.video_provider ?? data.videoProvider ?? '').toLowerCase(),
            providerVideoId: String(data.provider_video_id ?? data.providerVideoId ?? '')
          });
        }
      } catch (err) {
        if (active && !(err instanceof DOMException && err.name === 'AbortError')) {
          setError(err instanceof Error ? err.message : 'Playback unavailable');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [episode.id]);

  const saveProgress = (completed = false) => {
    const token = getToken();
    const video = videoRef.current;
    if (!token || !video) return;

    const positionSeconds = Math.floor(video.currentTime);
    if (!completed && positionSeconds - lastSaved.current < 15) return;
    lastSaved.current = positionSeconds;

    fetch(`${API}/api/user/history`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ episodeId: episode.id, positionSeconds, completed })
    }).catch(err => console.error('Watch progress could not be saved:', err));
  };

  // Native video exposes playback events. Embedded providers do not, so do not
  // invent analytics for iframe loads or guest viewers.
  const recordPlayback = (eventType: 'PLAY' | 'COMPLETE') => {
    const token = getToken();
    if (!token) return;
    const seconds = Math.min(86400, Math.max(0, Math.floor(videoRef.current?.currentTime || 0)));
    fetch(`${API}/api/user/playback-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ episodeId: episode.id, eventType, watchedSeconds: seconds })
    }).catch(err => console.error('Playback event could not be saved:', err));
  };

  const id = source?.providerVideoId || '';
  const provider = source?.videoProvider || '';
  const isHls = /\.m3u8(\?.*)?$/i.test(id);

  useEffect(() => {
    if (!isHls || !id) return;

    const video = videoRef.current;
    if (!video) return;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = id;
      return;
    }

    if (!Hls.isSupported()) {
      setError('এই browser HLS video playback support করে না।');
      return;
    }

    const hls = new Hls();
    hls.loadSource(id);
    hls.attachMedia(video);

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        setError('ভিডিও চালাতে সমস্যা হয়েছে। পরে আবার চেষ্টা করো।');
        hls.destroy();
      }
    });

    return () => hls.destroy();
  }, [id, isHls]);

  if (loading) {
    return <div className="player-empty"><RefreshCw className="spin" /><strong>ভিডিও যাচাই হচ্ছে...</strong></div>;
  }

  if (error) {
    return (
      <div className="player-empty">
        <AlertCircle size={32} />
        <strong>Playback unavailable</strong>
        <span>{error}</span>
        {/sign in|premium|unauthorized|login/i.test(error) && <a className="primary" href="/account">Sign in / Membership</a>}
      </div>
    );
  }

  if (!source || !id) {
    return (
      <div className="player-empty">
        <Film size={38} />
        <strong>এই Episode-এর ভিডিও এখনো যুক্ত হয়নি</strong>
        <span>Admin Panel থেকে অনুমোদিত ভিডিও source যুক্ত করতে হবে।</span>
      </div>
    );
  }

  if (provider === 'cloudflare-stream') {
    return (
      <div className="video-frame">
        <iframe
          src={`https://iframe.videodelivery.net/${encodeURIComponent(id)}`}
          title={episode.title}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (provider === 'bunny') {
    return (
      <div className="player-empty">
        <AlertCircle size={30} />
        <strong>Bunny Stream configuration প্রয়োজন</strong>
        <span>এই provider-এর playback configuration এখনো সম্পূর্ণ নয়।</span>
      </div>
    );
  }

  if (isHls || (/^https:\/\//i.test(id) && /\.(mp4|webm)(\?.*)?$/i.test(id))) {
    return (
      <div className="video-frame">
        <video
          ref={videoRef}
          controls
          playsInline
          preload="metadata"
          src={isHls ? undefined : id}
          onPlay={() => { if (!playRecorded.current) { playRecorded.current = true; recordPlayback('PLAY'); } }}
          onTimeUpdate={() => saveProgress()}
          onPause={() => saveProgress()}
          onEnded={() => { saveProgress(true); recordPlayback('COMPLETE'); }}
        />
      </div>
    );
  }

  if (/^https:\/\//i.test(id)) {
    return (
      <div className="video-frame">
        <iframe
          src={id}
          title={episode.title}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className="player-empty">
      <AlertCircle size={30} />
      <strong>Unsupported video source</strong>
      <span>Cloudflare Stream ID অথবা HTTPS video/embed URL ব্যবহার করো।</span>
    </div>
  );
}

function Community({ animeId }: { animeId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [comment, setComment] = useState('');
  const [review, setReview] = useState('');
  const [score, setScore] = useState('10');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const [commentResponse, reviewResponse] = await Promise.all([
        fetch(`${API}/api/user/comments/${encodeURIComponent(animeId)}`),
        fetch(`${API}/api/user/reviews/${encodeURIComponent(animeId)}`)
      ]);

      const [commentData, reviewData] = await Promise.all([
        commentResponse.json(),
        reviewResponse.json()
      ]);

      if (!commentResponse.ok || !reviewResponse.ok) throw new Error('Community information unavailable');
      setComments(commentResponse.ok && Array.isArray(commentData.data) ? commentData.data : []);
      setReviews(reviewResponse.ok && Array.isArray(reviewData.data) ? reviewData.data : []);
    } catch {
      setLoadError(true);
      setNotice('Community information could not be loaded. Please try again later.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [animeId]);

  async function submitComment(event: FormEvent) {
    event.preventDefault();
    const token = getToken();
    if (!token) {
      window.location.href = '/account';
      return;
    }

    setSending(true);
    setNotice('');
    try {
      const response = await fetch(`${API}/api/user/comments/${encodeURIComponent(animeId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ body: comment })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Comment could not be submitted.');
      setNotice(data.message || 'Comment submitted.');
      setComment('');
      await load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Comment could not be submitted.');
    } finally {
      setSending(false);
    }
  }

  async function reportComment(id: string) {
    const token = getToken();
    if (!token) { window.location.href = '/account'; return; }
    const reason = window.prompt('Why are you reporting this comment? (at least 3 characters)');
    if (reason === null) return;
    if (reason.trim().length < 3 || reason.trim().length > 500) {
      setNotice('Please enter a reason between 3 and 500 characters.');
      return;
    }
    setSending(true);
    setNotice('');
    try {
      const response = await fetch(`${API}/api/user/comments/${encodeURIComponent(id)}/report`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: reason.trim() })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not submit report.');
      setNotice('Report submitted for moderation.');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not submit report.');
    } finally { setSending(false); }
  }

  async function submitReview(event: FormEvent) {
    event.preventDefault();
    const token = getToken();
    if (!token) {
      window.location.href = '/account';
      return;
    }

    setSending(true);
    setNotice('');
    try {
      const response = await fetch(`${API}/api/user/reviews/${encodeURIComponent(animeId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ score: Number(score), review })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Review could not be submitted.');
      setNotice('Your review has been saved.');
      setReview('');
      await load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Review could not be submitted.');
    } finally {
      setSending(false);
    }
  }

  const average = reviews.length
    ? (reviews.reduce((sum, item) => sum + Number(item.score || 0), 0) / reviews.length).toFixed(1)
    : '—';

  return (
    <section className="community-panel">
      <div className="community-heading">
        <div><span className="eyebrow">ANIME HUB COMMUNITY</span><h2>Community & Reviews</h2></div>
        <span className="community-average"><Star size={15} fill="currentColor" /> {average}/10</span>
      </div>

      <div className="community-columns">
        <div className="community-form-column">
          <h3>Rate & Review</h3>
          <form onSubmit={submitReview}>
            <label>Rating
              <select value={score} onChange={event => setScore(event.target.value)}>
                {Array.from({ length: 10 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} / 10</option>)}
              </select>
            </label>
            <textarea value={review} onChange={event => setReview(event.target.value)} maxLength={2000} placeholder="Share your review (optional)" />
            <button type="submit" disabled={sending}>{sending ? 'Submitting…' : 'Submit review'}</button>
          </form>
          <div className="community-feed">
            {reviews.map(item => (
              <article className="community-item" key={item.id}>
                <div className="community-item-top"><b>{item.displayName || 'Anime fan'}</b><span><Star size={12} fill="currentColor" /> {item.score}/10</span></div>
                {item.review && <p>{item.review}</p>}
                <small>{new Date(item.createdAt).toLocaleDateString()}</small>
              </article>
            ))}
            {!loading && !loadError && !reviews.length && <p className="muted">No reviews yet. Be the first to review.</p>}
          </div>
        </div>

        <div className="community-form-column">
          <h3><MessageCircle size={17} /> Comments</h3>
          <form onSubmit={submitComment}>
            <textarea required minLength={2} maxLength={2000} value={comment} onChange={event => setComment(event.target.value)} placeholder="Share your thoughts…" />
            <button type="submit" disabled={sending}>{sending ? 'Posting…' : 'Post comment'}</button>
          </form>
          <div className="community-feed">
            {comments.map(item => (
              <article className="community-item" key={item.id}>
                <b>{item.displayName || 'Anime fan'}</b>
                <p>{item.body}</p>
                <small>{new Date(item.createdAt).toLocaleDateString()}</small>
                <button type="button" className="report-comment" disabled={sending} onClick={() => void reportComment(item.id)}>Report comment</button>
              </article>
            ))}
            {!loading && !loadError && !comments.length && <p className="muted">No comments yet. Start the conversation.</p>}
          </div>
        </div>
      </div>

      {loading && <small className="community-loading">Loading community…</small>}
      {notice && <div className="favorite-message">{notice}</div>}
    </section>
  );
}

export default function AnimeDetails() {
  const slug = (() => {
    const value = window.location.pathname.split('/').filter(Boolean)[1] || '';
    try { return decodeURIComponent(value); } catch { return value; }
  })();
  const [anime, setAnime] = useState<Anime | null>(null);
  const [selected, setSelected] = useState<Episode | null>(null);
  const [episodeUnavailable, setEpisodeUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [favoriteMessage, setFavoriteMessage] = useState('');

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function loadAnime() {
      setLoading(true);
      setError('');
      setAnime(null);
      setSelected(null);

      try {
        const response = await fetch(`${API}/api/anime/${encodeURIComponent(slug)}`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not load anime.');
        if (!result.data) throw new Error('Anime not found.');

        const mapped = mapAnime(result.data);
        if (!mapped.id) throw new Error('Anime information is incomplete.');
        if (!active) return;

        setAnime(mapped);
        const requestedEpisode = new URLSearchParams(window.location.search).get('episode');
        const matchedEpisode = requestedEpisode ? mapped.episodes.find(item => item.id === requestedEpisode) : undefined;
        setEpisodeUnavailable(Boolean(requestedEpisode && !matchedEpisode));
        setSelected(requestedEpisode ? matchedEpisode || null : mapped.episodes[0] || null);

        const token = getToken();
        if (token) {
          try {
            const favResponse = await fetch(`${API}/api/user/favorites`, {
              headers: { Authorization: `Bearer ${token}` },
              signal: controller.signal
            });
            const favData = await favResponse.json();
            if (active && favResponse.ok) {
              setFavorite((favData.data || []).some((item: any) => item.id === mapped.id));
            }
          } catch (err) {
            if (!(err instanceof DOMException && err.name === 'AbortError')) {
              console.error('Could not load favorites:', err);
            }
          }
        }
      } catch (err) {
        if (active && !(err instanceof DOMException && err.name === 'AbortError')) {
          setError(err instanceof Error ? err.message : 'Could not load anime.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadAnime();
    return () => {
      active = false;
      controller.abort();
    };
  }, [slug]);

  useEffect(() => {
    if (!loading && anime && window.location.hash === '#watch') {
      const frame = requestAnimationFrame(() => document.getElementById('watch')?.scrollIntoView());
      return () => cancelAnimationFrame(frame);
    }
  }, [loading, anime]);

  async function toggleFavorite() {
    if (!anime || favoriteLoading) return;
    const token = getToken();

    if (!token) {
      window.location.href = '/account';
      return;
    }

    setFavoriteLoading(true);
    setFavoriteMessage('');

    try {
      const response = await fetch(`${API}/api/user/favorites/${encodeURIComponent(anime.id)}`, {
        method: favorite ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not update favorites.');

      setFavorite(!favorite);
      setFavoriteMessage(favorite ? 'Removed from your favorites.' : 'Added to your favorites.');
    } catch (err) {
      setFavoriteMessage(err instanceof Error ? err.message : 'Could not update favorites.');
    } finally {
      setFavoriteLoading(false);
    }
  }

  return (
    <div className="detail-page">
      <header className="detail-top">
        <a className="brand" href="/"><span className="brandmark">AH</span><span>ANIME HUB <b>BANGLA</b></span></a>
        <nav><a className="back-link" href="/account">My Account</a><a className="back-link" href="/"><ArrowLeft size={16} /> Back to Anime</a></nav>
      </header>

      {loading ? (
        <div className="detail-message"><RefreshCw className="spin" /> Loading anime…</div>
      ) : error ? (
        <div className="detail-message error">{error}<p><a href="/">Return home</a></p></div>
      ) : anime ? (
        <>
          <section className="detail-hero" style={anime.bannerUrl ? { backgroundImage: `linear-gradient(90deg,rgba(7,8,12,.98),rgba(7,8,12,.65)),url("${anime.bannerUrl}")` } : {}}>
            <div className="detail-poster">
              {anime.posterUrl ? <img src={anime.posterUrl} alt={anime.title} /> : <Film size={48} />}
            </div>

            <div className="detail-copy">
              <div className="eyebrow">ANIME HUB BANGLA</div>
              <h1>{anime.title}</h1>
              {anime.originalTitle && <p className="original-title">{anime.originalTitle}</p>}
              <div className="detail-meta">
                {anime.releaseYear || 'Year unavailable'} <span>•</span> {anime.status} <span>•</span> {anime.episodes.length} Episodes
              </div>
              <div className="genre-tags">{anime.genres.map(genre => <span key={genre}>{genre}</span>)}</div>

              <button className={`favorite-button ${favorite ? 'saved' : ''}`} onClick={() => void toggleFavorite()} disabled={favoriteLoading}>
                <Heart size={16} fill={favorite ? 'currentColor' : 'none'} />
                {favoriteLoading ? 'Saving…' : favorite ? 'Saved to favorites' : 'Add to favorites'}
              </button>
              {favoriteMessage && <small className="favorite-message">{favoriteMessage}</small>}
              <p>{anime.synopsis || 'এই anime-এর synopsis এখনো যোগ করা হয়নি।'}</p>
            </div>
          </section>

          <main className="watch-layout" id="watch">
            <section className="watch-main">
              <div className="watch-heading">
                <div><div className="eyebrow">NOW WATCHING</div><h2>{selected ? `Episode ${selected.episodeNumber}: ${selected.title}` : 'Episodes coming soon'}</h2></div>
              </div>

              {selected ? <Player episode={selected} /> : (
                <div className="player-empty"><Film size={38} /><strong>{episodeUnavailable ? 'এই episode এখন উপলব্ধ নয়' : 'কোনো Published Episode নেই'}</strong><span>{episodeUnavailable ? 'অন্য একটি episode নির্বাচন করুন।' : 'Admin Panel থেকে episode publish করতে হবে।'}</span></div>
              )}

              <p className="rights-note">শুধু অনুমোদিত ও লাইসেন্সকৃত কনটেন্ট দেখানো হবে।</p>
              {selected?.synopsis && <p className="episode-synopsis">{selected.synopsis}</p>}
            </section>

            <aside className="episode-sidebar">
              <h3>Episodes <span>{anime.episodes.length}</span></h3>
              {anime.episodes.length ? anime.episodes.map(episode => (
                <button key={episode.id} className={`public-episode ${selected?.id === episode.id ? 'active' : ''}`} onClick={() => { setSelected(episode); setEpisodeUnavailable(false); }}>
                  <span className="ep-thumb">{episode.thumbnailUrl ? <img src={episode.thumbnailUrl} alt="" /> : <Play size={17} />}</span>
                  <span>
                    <b>EP {String(episode.episodeNumber).padStart(2, '0')}</b>
                    <small>{episode.title}</small>
                    {episode.isPremium && <small className="premium-label">PREMIUM</small>}
                    {episode.runtimeSeconds && <small><Clock3 size={11} /> {Math.round(episode.runtimeSeconds / 60)} min</small>}
                  </span>
                </button>
              )) : <p className="muted">Episodes are not available yet.</p>}
            </aside>
          </main>

          <Community animeId={anime.id} />
        </>
      ) : null}

      <footer className="detail-footer">© {new Date().getFullYear()} Anime Hub Bangla · Content rights belong to their respective owners.</footer>
    </div>
  );
}
