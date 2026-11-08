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
  ExternalLink
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
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [siteSettings, setSiteSettings] = useState<{ siteName?: string; tagline?: string; heroTitle?: string; heroSubtitle?: string; announcement?: string }>({});

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
      setLoading(false);
    }
  }

  async function loadPartners(signal?: AbortSignal) {
    setPartnerLoading(true);

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
      setPartners([]);
    } finally {
      setPartnerLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();

    loadAnime(controller.signal);
    loadPartners(controller.signal);
    fetch(`${API}/api/cms/public/homepage`, { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(result => {
        if (result?.settings && typeof result.settings === 'object') setSiteSettings(result.settings);
      })
      .catch(err => { if (err?.name !== 'AbortError') console.warn('Homepage settings unavailable:', err); });

    return () => controller.abort();
  }, []);

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

  const closeMenu = () => setMenuOpen(false);

  const navLinks = [
    { label: 'Anime', href: '#anime' },
    { label: 'Movies', href: '#movies' },
    { label: 'Studios', href: '#studios' },
    { label: 'About', href: '#about' }
  ];

  return (
    <div className="app">
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
            onClick={() => setMenuOpen(value => !value)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="mobile-navigation">
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
        </div>
      )}

      <main>
        {siteSettings.announcement && <div className="site-announcement" role="status">{siteSettings.announcement}</div>}
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span /> {siteSettings.tagline || 'BANGLA ANIME ENTERTAINMENT PLATFORM'}
            </div>

            <h1>
              {siteSettings.heroTitle || <>Your Anime.<br /><em>Your Language.</em></>}
            </h1>

            <p>
              {siteSettings.heroSubtitle || 'Discover anime, explore Bangla dubbing projects and connect with creative studios. Your anime community starts here.'}
            </p>

            <div className="hero-buttons">
              <a className="primary" href="#anime">
                <Play size={17} fill="currentColor" />
                Explore Anime
              </a>

              <a className="secondary" href="#studios">
                Discover Studios <ChevronRight size={16} />
              </a>
            </div>

            <small className="status">{apiState}</small>
          </div>

          <div className="hero-art">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />

            <div className="poster-ghost">
              <Film size={76} />
              <span>ANIME<br />HUB</span>
            </div>

            <div className="floating-tag">
              বাংলা অ্যানিমে
            </div>
          </div>
        </section>

        <section className="trust">
          <div><Shield /> Copyright-conscious platform</div>
          <div><Tv /> Anime discovery experience</div>
          <div><Star /> Community-driven platform</div>
        </section>

        <section className="catalog" id="anime">
          <div className="section-head">
            <div>
              <div className="eyebrow">EXPLORE THE LIBRARY</div>
              <h2>Discover <em>Anime</em></h2>
            </div>

            <span>
              {filtered.length} titles
              <ChevronRight size={15} />
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 28
            }}
          >
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

        <section className="catalog" id="movies">
          <div className="section-head">
            <div>
              <div className="eyebrow">FEATURE FILMS</div>
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
        </section>

        <section className="feature" id="studios">
          <div>
            <div className="eyebrow">THE CREATIVE COMMUNITY</div>

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

            <a className="secondary" href="#partners">
              Explore our partners <ChevronRight size={16} />
            </a>
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
        </section>

        <section className="catalog" id="partners">
          <div className="section-head">
            <div>
              <div className="eyebrow">OUR NETWORK</div>
              <h2>Collaboration <em>Partners</em></h2>
            </div>

            <span>{partners.length} partners</span>
          </div>

          {partnerLoading ? (
            <p className="empty">Loading collaboration partners...</p>
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
        </section>

        <section className="catalog" id="about">
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
        </section>

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
          <a href="/super-admin">Admin Login</a>
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
