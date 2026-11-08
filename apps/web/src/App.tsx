import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Play,
  Menu,
  X,
  Shield,
  Film,
  Tv,
  Star,
  ChevronRight,
  Users,
  Mic2,
  Info,
  Clapperboard,
  RefreshCw,
  Globe,
  ExternalLink, ChevronLeft, Smartphone, Download
} from 'lucide-react';

import SuperAdmin from './SuperAdmin';
import AnimeDetails from './AnimeDetails';
import Account from './Account';

import { API } from './api';

type Anime = {
  id: string;
  slug: string;
  title: string;
  synopsis: string;
  posterUrl: string;
  releaseYear?: number;
  status: string;
  genres: string[];
};

type Partner = {
  id: string;
  name: string;
  description: string;
  category: string;
  logoUrl: string;
  websiteUrl: string;
  facebookUrl: string;
  youtubeUrl: string;
  instagramUrl: string;
  isFeatured: boolean;
};

function normalizeAnime(raw: any): Anime {
  return {
    id: String(raw.id ?? ''),
    slug: String(raw.slug ?? ''),
    title: String(raw.title ?? 'Untitled Anime'),
    synopsis: String(raw.synopsis ?? raw.description ?? ''),
    posterUrl: String(raw.poster_url ?? raw.posterUrl ?? ''),
    releaseYear: raw.release_year ?? raw.releaseYear ?? undefined,
    status: String(raw.status ?? 'UNKNOWN'),
    genres: Array.isArray(raw.genres)
      ? raw.genres
          .map((genre: any) =>
            typeof genre === 'string' ? genre : genre?.name
          )
          .filter(Boolean)
      : []
  };
}

function normalizePartner(raw: any): Partner {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? 'Unnamed Partner'),
    description: String(raw.description ?? ''),
    category: String(raw.category ?? 'PARTNER'),
    logoUrl: String(raw.logo_url ?? raw.logoUrl ?? ''),
    websiteUrl: String(raw.website_url ?? raw.websiteUrl ?? ''),
    facebookUrl: String(raw.facebook_url ?? raw.facebookUrl ?? ''),
    youtubeUrl: String(raw.youtube_url ?? raw.youtubeUrl ?? ''),
    instagramUrl: String(raw.instagram_url ?? raw.instagramUrl ?? ''),
    isFeatured: Boolean(raw.is_featured ?? raw.isFeatured)
  };
}

function Home() {
  const [items, setItems] = useState<Anime[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('ALL');
  const [apiState, setApiState] = useState('Connecting to Anime Hub...');
  const [loading, setLoading] = useState(true);
  const [partnerLoading, setPartnerLoading] = useState(true);
  const [partnerError, setPartnerError] = useState(false);
  const [covers, setCovers] = useState<{ title: string; imageUrl: string; animeSlug: string; episodeId: string }[]>([]);
  const [coverIndex, setCoverIndex] = useState(0);
  const [accentTheme, setAccentTheme] = useState<'peach' | 'violet' | 'mint'>('peach');
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [siteSettings, setSiteSettings] = useState<{ siteName?: string; tagline?: string; heroTitle?: string; heroSubtitle?: string; announcement?: string; contactEmail?: string; androidApkUrl?: string; androidVersion?: string; showMovies?: boolean; showStudios?: boolean; showPartners?: boolean; showAbout?: boolean }>({});

  async function loadAnime(signal?: AbortSignal) {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API}/api/anime`, { signal });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Anime catalogue could not load.');
      }

      if (!Array.isArray(result.data)) {
        throw new Error('Invalid catalogue response from server.');
      }

      const mapped = result.data
        .map(normalizeAnime)
        .filter((anime: Anime) => anime.id && anime.slug);

      setItems(mapped);
      setApiState(
        mapped.length > 0
          ? 'Anime catalogue connected'
          : 'Connected — no anime published yet'
      );
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;

      console.error('Anime catalogue error:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Could not connect to the anime catalogue.'
      );
      setApiState('Catalogue connection unavailable');
      setItems([]);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  async function loadPartners(signal?: AbortSignal) {
    setPartnerLoading(true);
    setPartnerError(false);

    try {
      const response = await fetch(
        `${API}/api/collaboration/partners`,
        { signal }
      );

      const result = await response.json();

      if (!response.ok || !Array.isArray(result.data)) {
        throw new Error('Partner information unavailable.');
      }

      setPartners(result.data.map(normalizePartner));
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('Partner loading error:', err);
      setPartnerError(true);
      setPartners([]);
    } finally {
      if (!signal?.aborted) setPartnerLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();

    loadAnime(controller.signal);
    loadPartners(controller.signal);
    fetch(`${API}/api/cms/public/homepage`, { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(result => {
        if (result?.settings && typeof result.settings === 'object') {
          const raw = result.settings;
          const safeSettings: Record<string, string | boolean> = {};
          for (const key of ['siteName', 'tagline', 'heroTitle', 'heroSubtitle', 'announcement', 'contactEmail', 'androidApkUrl', 'androidVersion']) {
            if (typeof raw[key] === 'string') safeSettings[key] = raw[key];
          }
          for (const key of ['showMovies', 'showStudios', 'showPartners', 'showAbout']) {
            if (typeof raw[key] === 'boolean') safeSettings[key] = raw[key];
          }
          setSiteSettings(safeSettings);
          if (['peach', 'violet', 'mint'].includes(raw.accentTheme)) setAccentTheme(raw.accentTheme);
          if (Array.isArray(raw.heroCovers)) {
            setCovers(raw.heroCovers.filter((cover: any) => {
              if (typeof cover?.title !== 'string' || typeof cover?.animeSlug !== 'string' || !/^[a-z0-9-]+$/.test(cover.animeSlug) || typeof cover?.episodeId !== 'string' || !/^[0-9a-f-]{36}$/i.test(cover.episodeId)) return false;
              try { return new URL(cover.imageUrl).protocol === 'https:'; } catch { return false; }
            }).slice(0, 8));
          }
        }
      })
      .catch(err => { if (err?.name !== 'AbortError') console.warn('Homepage settings unavailable:', err); });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const handleKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [menuOpen]);

  const genres = useMemo(() => {
    const values = items.flatMap(item => item.genres);
    return ['ALL', ...Array.from(new Set(values)).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();

    return items.filter(anime => {
      const matchesSearch =
        !search ||
        anime.title.toLowerCase().includes(search) ||
        anime.synopsis.toLowerCase().includes(search) ||
        anime.genres.some(item => item.toLowerCase().includes(search));

      const matchesGenre =
        genre === 'ALL' || anime.genres.includes(genre);

      return matchesSearch && matchesGenre;
    });
  }, [items, query, genre]);

  let androidUrl = '';
  try {
    const url = new URL(siteSettings.androidApkUrl || '');
    if (url.protocol === 'https:' && !url.username && !url.password) androidUrl = url.href;
  } catch { /* no configured download */ }

  const closeMenu = () => setMenuOpen(false);
  const cover = covers[coverIndex] || null;
  const coverLink = cover ? `/anime/${encodeURIComponent(cover.animeSlug)}?episode=${encodeURIComponent(cover.episodeId)}#watch` : '';

  const navLinks = [
    { label: 'Anime', href: '#anime' },
    ...(siteSettings.showMovies !== false ? [{ label: 'Movies', href: '#movies' }] : []),
    ...(siteSettings.showStudios !== false ? [{ label: 'Studios', href: '#studios' }] : []),
    ...(siteSettings.showAbout !== false ? [{ label: 'About', href: '#about' }] : [])
  ];

  return (
    <div className={`app theme-${accentTheme}`}>
      <header className="top" id="top">
        <a className="brand" href="/">
          <span className="brandmark">AH</span>
          <span>{siteSettings.siteName || <>ANIME HUB <b>BANGLA</b></>}</span>
        </a>

        <nav aria-label="Main navigation">
          {navLinks.map(link => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="actions">
          <label className="search">
            <Search size={17} />
            <input
              value={query}
              onChange={event => {
                setQuery(event.target.value);
                setGenre('ALL');
              }}
              onKeyDown={event => {
                if (event.key === 'Enter') document.getElementById('anime')?.scrollIntoView({ behavior: 'smooth' });
              }}
              onFocus={() => {
                if (query) {
                  document.getElementById('anime')?.scrollIntoView({
                    behavior: 'smooth'
                  });
                }
              }}
              placeholder="Search anime..."
              aria-label="Search anime"
            />
          </label>

          <a className="login" href="/account">
            Sign in / Join
          </a>

          <button
            className="mobile"
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen(value => !value)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      {menuOpen && (
        <div id="mobile-navigation" className="mobile-navigation">
          <form className="mobile-search" onSubmit={event => { event.preventDefault(); closeMenu(); document.getElementById('anime')?.scrollIntoView({ behavior: 'smooth' }); }}>
            <label className="search"><Search size={17} /><input aria-label="Search anime" placeholder="Search anime..." value={query} onChange={event => { setQuery(event.target.value); setGenre('ALL'); }} /></label>
            <button type="submit">Search</button>
          </form>
          {navLinks.map(link => (
            <a
              key={link.href}
              href={link.href}
              onClick={closeMenu}
            >
              {link.label}
            </a>
          ))}

          <a href="/account" onClick={closeMenu}>
            Sign in / Join
          </a>
          {androidUrl && <a href={androidUrl} onClick={closeMenu} target="_blank" rel="noopener noreferrer">Download Android App</a>}
        </div>
      )}

      <main>
        {siteSettings.announcement && <div className="site-announcement" role="status">{siteSettings.announcement}</div>}
        <section className={`hero ${cover ? 'has-cover' : ''}`} style={cover ? { backgroundImage: `linear-gradient(90deg, rgba(12,15,29,.97) 0%, rgba(12,15,29,.85) 36%, rgba(12,15,29,.18) 100%), url(${JSON.stringify(cover.imageUrl)})` } : undefined}>
          {cover && <a className="hero-cover-link" href={coverLink} aria-label={`Watch ${cover.title}`} />}
          <div className="hero-copy">
            <div className="eyebrow">
              <span /> {siteSettings.tagline || 'BANGLA ANIME ENTERTAINMENT PLATFORM'}
            </div>

            <h1>
              {cover ? cover.title : (siteSettings.heroTitle || <>Your Anime.<br /><em>Your Language.</em></>)}
            </h1>

            <p>
              {siteSettings.heroSubtitle || 'Discover anime, explore Bangla dubbing projects and connect with creative studios. Your anime community starts here.'}
            </p>

            <div className="hero-buttons">
              <a className="primary" href={cover ? coverLink : '#anime'}>
                <Play size={17} fill="currentColor" />
                {cover ? 'Watch episode' : 'Explore Anime'}
              </a>

              {siteSettings.showStudios !== false && <a className="secondary" href="#studios">
                Discover Studios <ChevronRight size={16} />
              </a>}
            </div>

            <small className="status">{apiState}</small>
          </div>

          {covers.length > 1 && <div className="hero-slide-controls" aria-label="Featured covers"><button type="button" aria-label="Previous cover" onClick={() => setCoverIndex((coverIndex + covers.length - 1) % covers.length)}><ChevronLeft size={18} /></button><span aria-live="polite">{coverIndex + 1} / {covers.length}</span><button type="button" aria-label="Next cover" onClick={() => setCoverIndex((coverIndex + 1) % covers.length)}><ChevronRight size={18} /></button></div>}
          <div className="hero-art" aria-hidden="true">
            <div className="hero-art-caption"><span>STORIES WITHOUT BORDERS</span><strong>একসাথে দেখি,<br />একসাথে স্বপ্ন দেখি।</strong><small>ANIME HUB BANGLA · আপনার নিজের জগৎ</small></div>
          </div>
        </section>

        <section className="trust" aria-label="About Anime Hub Bangla">
          <div><Shield /><span><b>MADE WITH CARE</b>Copyright-conscious platform</span></div>
          <div><Tv /><span><b>FIND YOUR NEXT STORY</b>Anime discovery experience</span></div>
          <div><Star /><span><b>BETTER TOGETHER</b>Community-driven platform</span></div>
        </section>

        <section className="catalog" id="anime">
          <div className="section-head">
            <div>
              <div className="eyebrow">01 / EXPLORE THE LIBRARY</div>
              <h2>Discover <em>Anime</em></h2>
            </div>

            <span>
              {filtered.length} titles
              <ChevronRight size={15} />
            </span>
          </div>

          <div className="catalog-filters">
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                color: '#aaa',
                fontSize: 12
              }}
            >
              <Search size={16} />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Find anime by title or genre"
                style={{
                  width: 'min(320px, 75vw)',
                  padding: '12px 14px',
                  color: '#fff',
                  background: '#14151b',
                  border: '1px solid #34343d',
                  borderRadius: 8,
                  outline: 'none'
                }}
              />
            </label>

            <select
              value={genre}
              onChange={event => setGenre(event.target.value)}
              aria-label="Filter by genre"
              style={{
                padding: '12px 14px',
                color: '#eee',
                background: '#14151b',
                border: '1px solid #34343d',
                borderRadius: 8
              }}
            >
              {genres.map(item => (
                <option key={item} value={item}>
                  {item === 'ALL' ? 'All genres' : item}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="empty">
              Loading anime catalogue...
            </div>
          ) : error ? (
            <div className="feature-panel">
              <div className="feature-icon">
                <Film size={28} />
              </div>
              <strong>Catalogue unavailable</strong>
              <span>{error}</span>
              <button
                className="primary"
                type="button"
                onClick={() => loadAnime()}
                style={{ marginTop: 20, border: 0 }}
              >
                <RefreshCw size={15} />
                Try again
              </button>
            </div>
          ) : filtered.length > 0 ? (
            <div className="cards">
              {filtered.map(anime => (
                <a
                  className="anime-card"
                  key={anime.id}
                  href={`/anime/${encodeURIComponent(anime.slug)}`}
                >
                  <div className="poster">
                    {anime.posterUrl ? (
                      <img
                        src={anime.posterUrl}
                        alt={`${anime.title} poster`}
                        loading="lazy"
                      />
                    ) : (
                      <div className="poster-placeholder">
                        <Film size={34} />
                        <span>ANIME HUB</span>
                      </div>
                    )}

                    <span className="type">{anime.status}</span>

                    <span className="card-play">
                      <Play size={18} fill="currentColor" />
                    </span>
                  </div>

                  <h3>{anime.title}</h3>

                  <p>
                    {anime.releaseYear || 'Year not set'}
                    {anime.genres.length > 0
                      ? ` · ${anime.genres.slice(0, 2).join(' / ')}`
                      : ''}
                  </p>
                </a>
              ))}
            </div>
          ) : (
            <div className="empty">
              {items.length === 0
                ? 'No anime has been published yet.'
                : 'No anime matches your search.'}
            </div>
          )}
        </section>

        {siteSettings.showMovies !== false && <section className="catalog" id="movies">
          <div className="section-head">
            <div>
              <div className="eyebrow">02 / FEATURE FILMS</div>
              <h2>Anime <em>Movies</em></h2>
            </div>
          </div>

          <div className="feature-panel">
            <div className="feature-icon">
              <Clapperboard size={32} />
            </div>

            <strong>Anime Movies Library</strong>

            <span>
              The movie catalogue will appear here when
              movie management and publishing are available.
            </span>
          </div>
        </section>}

        {siteSettings.showStudios !== false && <section className="feature" id="studios">
          <div>
            <div className="eyebrow">03 / THE CREATIVE COMMUNITY</div>

            <h2>
              One hub for
              <br />
              <em>every voice.</em>
            </h2>

            <p>
              Discover dubbing teams, voice artists, animation
              studios and creative partners working around
              Bangla anime entertainment.
            </p>

            {siteSettings.showPartners !== false && <a className="secondary" href="#partners">
              Explore our partners <ChevronRight size={16} />
            </a>}
          </div>

          <div className="feature-panel">
            <div className="feature-icon">
              <Mic2 size={32} />
            </div>

            <strong>Bangla Dubbing Network</strong>

            <span>
              Dubbing Studios · Voice Artists · Animation Teams
            </span>

            <div className="bars">
              <i /><i /><i /><i /><i /><i />
              <i /><i /><i /><i /><i /><i />
            </div>
          </div>
        </section>}

        {siteSettings.showPartners !== false && <section className="catalog" id="partners">
          <div className="section-head">
            <div>
              <div className="eyebrow">04 / OUR NETWORK</div>
              <h2>Collaboration <em>Partners</em></h2>
            </div>

            <span>{partners.length} partners</span>
          </div>

          {partnerLoading ? (
            <p className="empty">Loading collaboration partners...</p>
          ) : partnerError ? (
            <div className="feature-panel"><strong>Partner information is unavailable</strong><span>Please try again.</span><button className="primary retry-partners" onClick={() => void loadPartners()}>Try again</button></div>
          ) : partners.length === 0 ? (
            <div className="feature-panel">
              <div className="feature-icon">
                <Users size={30} />
              </div>
              <strong>Our partner network is growing</strong>
              <span>
                Published collaboration partners will appear here.
              </span>
            </div>
          ) : (
            <div className="cards">
              {partners.map(partner => (
                <article
                  className="feature-panel"
                  key={partner.id}
                  style={{ minWidth: 0, margin: 0 }}
                >
                  <div
                    style={{
                      width: 76,
                      height: 76,
                      borderRadius: 14,
                      overflow: 'hidden',
                      display: 'grid',
                      placeItems: 'center',
                      background: '#25232a',
                      border: '1px solid #d4af3744',
                      marginBottom: 20
                    }}
                  >
                    {partner.logoUrl ? (
                      <img
                        src={partner.logoUrl}
                        alt={`${partner.name} logo`}
                        loading="lazy"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                    ) : (
                      <Users size={30} />
                    )}
                  </div>

                  <small className="eyebrow">
                    {partner.category.replace(/_/g, ' ')}
                  </small>

                  <strong>{partner.name}</strong>

                  <span>{partner.description}</span>

                  {partner.websiteUrl && (
                    <a
                      href={partner.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="secondary"
                      style={{ marginTop: 18 }}
                    >
                      Visit website <ExternalLink size={14} />
                    </a>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 12,
                      marginTop: 15,
                      fontSize: 12
                    }}
                  >
                    {partner.facebookUrl && (
                      <a href={partner.facebookUrl} target="_blank" rel="noopener noreferrer">
                        Facebook
                      </a>
                    )}
                    {partner.youtubeUrl && (
                      <a href={partner.youtubeUrl} target="_blank" rel="noopener noreferrer">
                        YouTube
                      </a>
                    )}
                    {partner.instagramUrl && (
                      <a href={partner.instagramUrl} target="_blank" rel="noopener noreferrer">
                        Instagram
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>}

        {siteSettings.showAbout !== false && <section className="catalog" id="about">
          <div className="section-head">
            <div>
              <div className="eyebrow">ABOUT THE PLATFORM</div>
              <h2>Welcome to <em>Anime Hub Bangla</em></h2>
            </div>
          </div>

          <div className="community-panel">
            <div className="community-columns">
              <div>
                <Info size={28} />
                <h3>Our Platform</h3>
                <p>
                  Anime Hub Bangla brings anime discovery,
                  Bangla dubbing communities, creative studios
                  and authorized releases together in one place.
                </p>
              </div>

              <div>
                <Users size={28} />
                <h3>Our Community</h3>
                <p>
                  A place for anime fans, dubbing teams,
                  voice artists and creative partners to connect
                  and grow together.
                </p>
              </div>
            </div>
          </div>
        </section>}

        {androidUrl && <section className="android-download" aria-labelledby="android-title">
          <div className="android-icon"><Smartphone size={29} /></div>
          <div><div className="eyebrow">TAKE YOUR STORIES WITH YOU</div><h2 id="android-title">Anime Hub, on Android.</h2><p>Download the Android app{siteSettings.androidVersion ? ` · ${siteSettings.androidVersion}` : ''} and keep your anime community close.</p></div>
          <a className="primary" href={androidUrl} target="_blank" rel="noopener noreferrer"><Download size={18} /> Download Android App</a>
        </section>}

        <section className="catalog" id="privacy">
          <div className="eyebrow">YOUR DATA</div>
          <h2>Privacy</h2>
          <p>
            We aim to protect account information and personal
            data. A complete privacy policy should be published
            before the platform opens to the public.
          </p>
        </section>

        <section className="catalog" id="terms">
          <div className="eyebrow">PLATFORM RULES</div>
          <h2>Terms of Service</h2>
          <p>
            Users must respect content ownership, community
            guidelines and applicable laws when using the platform.
          </p>
        </section>

        <section className="catalog" id="copyright">
          <div className="eyebrow">CONTENT RIGHTS</div>
          <h2>Copyright</h2>
          <p>
            Anime Hub Bangla does not claim ownership of third-party
            anime or media. Content may only be published with
            appropriate authorization from its rights holders.
          </p>
        </section>
      </main>

      <footer>
        <a className="brand" href="#top">
          <span className="brandmark">AH</span>
          <span>ANIME HUB <b>BANGLA</b></span>
        </a>

        <span>
          © {new Date().getFullYear()} Anime Hub Bangla.
          All rights belong to their respective owners.
        </span>

        <span className="footlinks">
          <a href="#privacy">Privacy</a>
          <a href="#terms">Terms</a>
          <a href="#copyright">Copyright</a>
          {androidUrl && <a href={androidUrl} target="_blank" rel="noopener noreferrer">Android App</a>}
          {siteSettings.contactEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(siteSettings.contactEmail) && <a href={`mailto:${siteSettings.contactEmail}`}>Contact</a>}
        </span>
      </footer>
    </div>
  );
}

export default function App() {
  const path = window.location.pathname;

  if (path.startsWith('/super-admin')) return <SuperAdmin />;
  if (path.startsWith('/admin')) return <SuperAdmin />;
  if (path.startsWith('/account')) return <Account />;
  if (path.startsWith('/anime/')) return <AnimeDetails />;

  return <Home />;
}
