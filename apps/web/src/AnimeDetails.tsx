
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Hls from 'hls.js';
import {
  ArrowLeft,
  Play,
  Film,
  AlertCircle,
  Heart
} from 'lucide-react';

const API = (
  import.meta.env.VITE_API_URL ||
  'https://anime-hub-bangla.onrender.com'
).replace(/\/$/, '');

type Episode = {
  id: string;
  episodeNumber: number;
  title: string;
  synopsis?: string | null;
  runtimeSeconds?: number | null;
  thumbnailUrl?: string | null;
  videoProvider?: string | null;
  providerVideoId?: string | null;
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
  videoProvider?: string;
  providerVideoId?: string;
};

function mapEpisode(ep: any): Episode {
  return {
    id: String(ep.id ?? ''),
    episodeNumber: Number(ep.episode_number ?? ep.episodeNumber ?? 0),
    title: ep.title ?? 'Untitled Episode',
    synopsis: ep.synopsis ?? null,
    runtimeSeconds: ep.runtime_seconds ?? ep.runtimeSeconds ?? null,
    thumbnailUrl: ep.thumbnail_url ?? ep.thumbnailUrl ?? null,
    videoProvider: ep.video_provider ?? ep.videoProvider ?? null,
    providerVideoId: ep.provider_video_id ?? ep.providerVideoId ?? null,
    isPremium: Boolean(ep.is_premium ?? ep.isPremium ?? false)
  };
}

function mapAnime(raw: any): Anime {
  return {
    id: String(raw.id ?? ''),
    slug: raw.slug ?? '',
    title: raw.title ?? 'Untitled Anime',
    originalTitle: raw.original_title ?? raw.originalTitle ?? null,
    synopsis: raw.synopsis ?? raw.description ?? null,
    posterUrl: raw.poster_url ?? raw.posterUrl ?? null,
    bannerUrl: raw.banner_url ?? raw.bannerUrl ?? null,
    releaseYear: raw.release_year ?? raw.releaseYear ?? null,
    status: raw.status ?? 'UNKNOWN',
    genres: Array.isArray(raw.genres)
      ? raw.genres.map((g: any) =>
          typeof g === 'string' ? g : g.name
        ).filter(Boolean)
      : [],
    episodes: Array.isArray(raw.episodes)
      ? raw.episodes.map(mapEpisode)
      : []
  };
}

function Player({ episode }: { episode: Episode }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSaved = useRef(0);

  const [source, setSource] = useState<PlaybackSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [playError, setPlayError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadPlayback() {
      setSource(null);
      setPlayError('');
      setLoading(true);

      try {
        const token = localStorage.getItem('ahb_token');

        const response = await fetch(
          `${API}/api/episodes/${encodeURIComponent(episode.id)}/playback`,
          {
            headers: token
              ? { Authorization: `Bearer ${token}` }
              : {}
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Playback unavailable');
        }

        if (!result.data) {
          throw new Error('Playback information not found');
        }

        const data = result.data;

        if (active) {
          setSource({
            videoProvider:
              data.video_provider ?? data.videoProvider ?? '',
            providerVideoId:
              data.provider_video_id ?? data.providerVideoId ?? ''
          });
        }
      } catch (error) {
        if (active) {
          setPlayError(
            error instanceof Error
              ? error.message
              : 'Playback unavailable'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    lastSaved.current = 0;
    loadPlayback();

    return () => {
      active = false;
    };
  }, [episode.id]);

  const saveProgress = (completed = false) => {
    const token = localStorage.getItem('ahb_token');
    const video = videoRef.current;

    if (!token || !video || !episode.id) return;

    const now = Math.floor(video.currentTime);

    if (!completed && now - lastSaved.current < 15) return;

    lastSaved.current = now;

    fetch(`${API}/api/user/history`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        episodeId: episode.id,
        positionSeconds: now,
        completed
      })
    }).catch(error => {
      console.error('Watch history error:', error);
    });
  };

  const provider = (source?.videoProvider || '').toLowerCase();
  const id = source?.providerVideoId || '';

  const isHls = /\.m3u8(\?.*)?$/i.test(id);

  useEffect(() => {
    if (!isHls || !id) return;

    const video = videoRef.current;
    if (!video) return;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = id;
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls();

      hls.loadSource(id);
      hls.attachMedia(video);

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setPlayError('ভিডিও চালাতে সমস্যা হয়েছে। পরে আবার চেষ্টা করো।');
          hls.destroy();
        }
      });

      return () => hls.destroy();
    }

    setPlayError('এই Browser HLS video playback support করে না.');
  }, [id, isHls]);

  if (loading) {
    return (
      <div className="player-empty">
        <Film size={30} />
        <strong>ভিডিও যাচাই হচ্ছে...</strong>
      </div>
    );
  }

  if (playError) {
    return (
      <div className="player-empty">
        <AlertCircle size={30} />
        <strong>Playback unavailable</strong>
        <span>{playError}</span>

        {/sign in|premium|unauthorized/i.test(playError) && (
          <a className="primary" href="/account">
            Sign in / Premium
          </a>
        )}
      </div>
    );
  }

  if (!source) return null;

  if (!id) {
    return (
      <div className="player-empty">
        <Film size={38} />
        <strong>এই Episode-এর ভিডিও এখনো যুক্ত হয়নি</strong>
        <span>
          Admin Panel থেকে ভিডিও আপলোড বা Video ID যোগ করতে হবে।
        </span>
      </div>
    );
  }

  if (provider === 'cloudflare-stream') {
    return (
      <div className="video-frame">
        <iframe
          src={`https://iframe.videodelivery.net/${encodeURIComponent(id)}`}
          title={episode.title}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
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
        <span>
          Bunny Library ID এবং playback configuration যুক্ত না হওয়া
          পর্যন্ত এই ভিডিও চালানো যাবে না।
        </span>
      </div>
    );
  }

  if (isHls) {
    return (
      <div className="video-frame">
        <video
          ref={videoRef}
          controls
          playsInline
          preload="metadata"
          onTimeUpdate={() => saveProgress()}
          onPause={() => saveProgress()}
          onEnded={() => saveProgress(true)}
        />
      </div>
    );
  }

  if (/^https:\/\//i.test(id) && /\.(mp4|webm)(\?.*)?$/i.test(id)) {
    return (
      <div className="video-frame">
        <video
          ref={videoRef}
          controls
          playsInline
          preload="metadata"
          src={id}
          onTimeUpdate={() => saveProgress()}
          onPause={() => saveProgress()}
          onEnded={() => saveProgress(true)}
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
      <span>
        Cloudflare Stream ID অথবা HTTPS video/embed URL ব্যবহার করো।
      </span>
    </div>
  );
}

function Community({ animeId }: { animeId: string }) {
  const [comments, setComments] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [comment, setComment] = useState('');
  const [review, setReview] = useState('');
  const [score, setScore] = useState('10');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);

    try {
      const [commentResponse, reviewResponse] = await Promise.all([
        fetch(`${API}/api/user/comments/${encodeURIComponent(animeId)}`),
        fetch(`${API}/api/user/reviews/${encodeURIComponent(animeId)}`)
      ]);

      const [commentData, reviewData] = await Promise.all([
        commentResponse.json(),
        reviewResponse.json()
      ]);

      setComments(
        commentResponse.ok && Array.isArray(commentData.data)
          ? commentData.data
          : []
      );

      setReviews(
        reviewResponse.ok && Array.isArray(reviewData.data)
          ? reviewData.data
          : []
      );
    } catch (error) {
      console.error('Community loading error:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [animeId]);

  async function submitComment(e: FormEvent) {
    e.preventDefault();

    const token = localStorage.getItem('ahb_token');

    if (!token) {
      window.location.href = '/account';
      return;
    }

    try {
      const response = await fetch(
        `${API}/api/user/comments/${encodeURIComponent(animeId)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ body: comment })
        }
      );

      const data = await response.json();

      setNotice(data.message || data.error || 'Comment submitted');

      if (response.ok) {
        setComment('');
        await load();
      }
    } catch {
      setNotice('Comment পাঠানো যায়নি। আবার চেষ্টা করো।');
    }
  }

  async function submitReview(e: FormEvent) {
    e.preventDefault();

    const token = localStorage.getItem('ahb_token');

    if (!token) {
      window.location.href = '/account';
      return;
    }

    try {
      const response = await fetch(
        `${API}/api/user/reviews/${encodeURIComponent(animeId)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            score: Number(score),
            review
          })
        }
      );

      const data = await response.json();

      setNotice(data.message || data.error || 'Review submitted');

      if (response.ok) {
        setReview('');
        await load();
      }
    } catch {
      setNotice('Review পাঠানো যায়নি। আবার চেষ্টা করো।');
    }
  }

  return (
    <section className="community-panel">
      <h2>Community</h2>

      <div className="community-columns">

        <div>
          <h3>Rate & Review</h3>

          <form onSubmit={submitReview}>
            <label>
              Score
              <select
                value={score}
                onChange={e => setScore(e.target.value)}
              >
                {Array.from({ length: 10 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}/10
                  </option>
                ))}
              </select>
            </label>

            <textarea
              value={review}
              onChange={e => setReview(e.target.value)}
              maxLength={2000}
              placeholder="Write your review (optional)"
            />

            <button type="submit">Submit Review</button>
          </form>

          {reviews.map(r => (
            <article className="community-item" key={r.id}>
              <b>{r.displayName || 'User'} · {r.score}/10</b>
              <p>{r.review}</p>
            </article>
          ))}
        </div>

        <div>
          <h3>Comments</h3>

          <form onSubmit={submitComment}>
            <textarea
              required
              minLength={2}
              maxLength={2000}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Share your thoughts"
            />

            <button type="submit">Post Comment</button>
          </form>

          {comments.map(c => (
            <article className="community-item" key={c.id}>
              <b>{c.displayName || 'User'}</b>
              <p>{c.body}</p>
            </article>
          ))}
        </div>

      </div>

      {loading && <small>Loading community...</small>}

      {notice && (
        <small className="favorite-message">{notice}</small>
      )}
    </section>
  );
}

export default function AnimeDetails() {
  const slug = decodeURIComponent(
    window.location.pathname.split('/').filter(Boolean)[1] || ''
  );

  const [anime, setAnime] = useState<Anime | null>(null);
  const [selected, setSelected] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [favoriteMessage, setFavoriteMessage] = useState('');

  useEffect(() => {
    let active = true;

    async function loadAnime() {
      setLoading(true);
      setError('');
      setAnime(null);
      setSelected(null);

      try {
        const response = await fetch(
          `${API}/api/anime/${encodeURIComponent(slug)}`
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Could not load anime');
        }

        if (!result.data) {
          throw new Error('Anime not found');
        }

        const mapped = mapAnime(result.data);

        if (!mapped.id) {
          throw new Error('Invalid anime information');
        }

        if (!active) return;

        setAnime(mapped);
        setSelected(mapped.episodes[0] || null);

        const token = localStorage.getItem('ahb_token');

        if (token) {
          try {
            const favResponse = await fetch(
              `${API}/api/user/favorites`,
              {
                headers: {
                  Authorization: `Bearer ${token}`
                }
              }
            );

            const favData = await favResponse.json();

            if (active && favResponse.ok) {
              setFavorite(
                (favData.data || []).some(
                  (item: any) =>
                    item.id === mapped.id ||
                    item.animeId === mapped.id ||
                    item.anime_id === mapped.id
                )
              );
            }
          } catch (error) {
            console.error('Favorite loading error:', error);
          }
        }
      } catch (error) {
        if (active) {
          setError(
            error instanceof Error
              ? error.message
              : 'Could not load anime'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadAnime();

    return () => {
      active = false;
    };
  }, [slug]);

  async function toggleFavorite() {
    if (!anime) return;

    const token = localStorage.getItem('ahb_token');

    if (!token) {
      window.location.href = '/account';
      return;
    }

    try {
      const response = await fetch(
        `${API}/api/user/favorites/${encodeURIComponent(anime.id)}`,
        {
          method: favorite ? 'DELETE' : 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Favorite update failed');
      }

      setFavorite(!favorite);

      setFavoriteMessage(
        favorite
          ? 'Removed from favorites'
          : 'Added to favorites'
      );
    } catch (error) {
      setFavoriteMessage(
        error instanceof Error
          ? error.message
          : 'Favorite update failed'
      );
    }
  }

  return (
    <div className="detail-page">

      <header className="detail-top">

        <a className="brand" href="/">
          <span className="brandmark">AH</span>
          <span>ANIME HUB <b>BANGLA</b></span>
        </a>

        <a className="back-link" href="/account">
          My Account
        </a>

        <a className="back-link" href="/">
          <ArrowLeft size={16} />
          Back to Anime
        </a>

      </header>

      {loading ? (
        <div className="detail-message">
          Loading anime...
        </div>
      ) : error ? (
        <div className="detail-message error">
          {error}
          <p><a href="/">Return home</a></p>
        </div>
      ) : anime ? (
        <>

          <section
            className="detail-hero"
            style={
              anime.bannerUrl
                ? {
                    backgroundImage:
                      `linear-gradient(90deg,rgba(7,8,12,.98),rgba(7,8,12,.65)),url("${anime.bannerUrl}")`
                  }
                : {}
            }
          >

            <div className="detail-poster">
              {anime.posterUrl ? (
                <img src={anime.posterUrl} alt={anime.title} />
              ) : (
                <Film size={48} />
              )}
            </div>

            <div className="detail-copy">

              <div className="eyebrow">
                BANGLA DUBBED ANIME
              </div>

              <h1>{anime.title}</h1>

              {anime.originalTitle && (
                <p className="original-title">
                  {anime.originalTitle}
                </p>
              )}

              <div className="detail-meta">
                {anime.releaseYear || '—'}
                <span>•</span>
                {anime.status}
                <span>•</span>
                {anime.episodes.length} Episodes
              </div>

              <div className="genre-tags">
                {anime.genres.map(genre => (
                  <span key={genre}>{genre}</span>
                ))}
              </div>

              <button
                className={`favorite-button ${favorite ? 'saved' : ''}`}
                onClick={toggleFavorite}
              >
                <Heart
                  size={16}
                  fill={favorite ? 'currentColor' : 'none'}
                />
                {favorite ? 'Saved' : 'Add to favorites'}
              </button>

              {favoriteMessage && (
                <small className="favorite-message">
                  {favoriteMessage}
                </small>
              )}

              <p>
                {anime.synopsis ||
                  'এই anime-এর synopsis এখনো যোগ করা হয়নি।'}
              </p>

            </div>
          </section>

          <main className="watch-layout">

            <section className="watch-main">

              <div className="watch-heading">
                <div>
                  <div className="eyebrow">NOW WATCHING</div>

                  <h2>
                    {selected
                      ? `Episode ${selected.episodeNumber}: ${selected.title}`
                      : 'Episodes coming soon'}
                  </h2>
                </div>
              </div>

              {selected ? (
                <Player episode={selected} />
              ) : (
                <div className="player-empty">
                  <Film size={38} />
                  <strong>কোনো Published Episode নেই</strong>
                  <span>
                    Admin Panel থেকে episode publish করো।
                  </span>
                </div>
              )}

              <p className="rights-note">
                শুধু অনুমোদিত ও লাইসেন্সকৃত কনটেন্ট দেখানো হবে।
              </p>

              {selected?.synopsis && (
                <p className="episode-synopsis">
                  {selected.synopsis}
                </p>
              )}

            </section>

            <aside className="episode-sidebar">

              <h3>
                Episodes <span>{anime.episodes.length}</span>
              </h3>

              {anime.episodes.length ? (
                anime.episodes.map(ep => (
                  <button
                    key={ep.id}
                    className={`public-episode ${
                      selected?.id === ep.id ? 'active' : ''
                    }`}
                    onClick={() => setSelected(ep)}
                  >

                    <span className="ep-thumb">
                      {ep.thumbnailUrl ? (
                        <img src={ep.thumbnailUrl} alt="" />
                      ) : (
                        <Play size={17} />
                      )}
                    </span>

                    <span>
                      <b>
                        EP {String(ep.episodeNumber).padStart(2, '0')}
                      </b>

                      <small>{ep.title}</small>

                      {ep.isPremium && (
                        <small>PREMIUM</small>
                      )}

                      {ep.runtimeSeconds && (
                        <small>
                          {Math.round(ep.runtimeSeconds / 60)} min
                        </small>
                      )}
                    </span>

                  </button>
                ))
              ) : (
                <p className="muted">
                  Episodes are not available yet.
                </p>
              )}

            </aside>

          </main>

          <Community animeId={anime.id} />

        </>
      ) : null}

      <footer className="detail-footer">
        © {new Date().getFullYear()} Anime Hub Bangla ·
        Content rights belong to their respective owners.
      </footer>

    </div>
  );
}
