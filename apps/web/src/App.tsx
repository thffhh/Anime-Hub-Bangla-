
import { useEffect, useState } from 'react';
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
  Clapperboard
} from 'lucide-react';

import Admin from './Admin';
import AnimeDetails from './AnimeDetails';
import Account from './Account';

const API =
  import.meta.env.VITE_API_URL ||
  'https://anime-hub-bangla.onrender.com';

type Anime = {
  id: string;
  slug: string;
  title: string;
  synopsis?: string;
  posterUrl?: string;
  releaseYear?: number;
  status: string;
  genres: string[];
};

const fallback: Anime[] = [
  {
    id: 'demo-1',
    slug: 'sample-adventure',
    title: 'Sample Adventure',
    synopsis: 'Demo content only.',
    releaseYear: 2026,
    status: 'ONGOING',
    genres: ['Adventure', 'Fantasy']
  },
  {
    id: 'demo-2',
    slug: 'sample-journey',
    title: 'Sample Journey',
    synopsis: 'Demo content only.',
    releaseYear: 2025,
    status: 'COMPLETED',
    genres: ['Drama', 'Fantasy']
  },
  {
    id: 'demo-3',
    slug: 'sample-heroes',
    title: 'Sample Heroes',
    synopsis: 'Demo content only.',
    releaseYear: 2026,
    status: 'UPCOMING',
    genres: ['Action']
  }
];

function Home() {
  const [items, setItems] = useState<Anime[]>(fallback);
  const [query, setQuery] = useState('');
  const [apiState, setApiState] = useState('Checking API...');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadAnime() {
      try {
        const response = await fetch(`${API}/api/anime`);

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status}`);
        }

        const result = await response.json();

        if (!active) return;

        if (!Array.isArray(result.data)) {
          throw new Error('Invalid anime catalogue response');
        }

        const mappedAnime: Anime[] = result.data.map((anime: any) => ({
          id: String(anime.id),
          slug: anime.slug,
          title: anime.title,
          synopsis: anime.synopsis ?? anime.description ?? '',
          posterUrl: anime.poster_url ?? anime.posterUrl ?? '',
          releaseYear: anime.release_year ?? anime.releaseYear,
          status: anime.status ?? 'ONGOING',
          genres: Array.isArray(anime.genres)
            ? anime.genres.map((genre: any) =>
                typeof genre === 'string' ? genre : genre.name
              ).filter(Boolean)
            : []
        }));

        setItems(mappedAnime);

        setApiState(
          mappedAnime.length > 0
            ? 'API connected'
            : 'API connected — no anime published yet'
        );
      } catch (error) {
        if (!active) return;

        console.error('Anime API error:', error);
        setItems(fallback);
        setApiState('Demo catalogue — API unavailable');
      }
    }

    loadAnime();

    return () => {
      active = false;
    };
  }, []);

  const filtered = items.filter(anime =>
    anime.title.toLowerCase().includes(query.toLowerCase())
  );

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
          <span>ANIME HUB <b>BANGLA</b></span>
        </a>

        <nav>
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
                document.getElementById('anime')?.scrollIntoView({
                  behavior: 'smooth'
                });
              }}
              placeholder="Search anime"
            />
          </label>

          <a className="login" href="/account">
            Sign in / Join
          </a>

          <button
            className="mobile"
            type="button"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
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

        {/* HERO */}

        <section className="hero">

          <div className="hero-copy">

            <div className="eyebrow">
              <span /> BANGLA DUBBED ANIME UNIVERSE
            </div>

            <h1>
              Your Anime.
              <br />
              <em>Your Language.</em>
            </h1>

            <p>
              Discover anime stories in Bangla. Explore licensed
              releases, original projects and dubbing studios —
              all in one place.
            </p>

            <div className="hero-buttons">
              <a className="primary" href="#anime">
                <Play size={17} fill="currentColor" />
                Explore Anime
              </a>

              <a className="secondary" href="#about">
                Learn more <ChevronRight size={16} />
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
              বাংলা ডাবড
            </div>
          </div>

        </section>

        {/* TRUST */}

        <section className="trust">
          <div><Shield /> Authorized content first</div>
          <div><Tv /> Web + Android experience</div>
          <div><Star /> Community reviews</div>
        </section>

        {/* ANIME */}

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

          <div className="cards">

            {filtered.map(anime => (
              <a
                className="anime-card"
                key={anime.id}
                href={`/anime/${encodeURIComponent(anime.slug)}`}
              >

                <div className="poster">

                  {anime.posterUrl ? (
                    <img src={anime.posterUrl} alt={anime.title} />
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
                  {anime.releaseYear || 'New'} ·{' '}
                  {anime.genres.slice(0, 2).join(' / ')}
                </p>

              </a>
            ))}

          </div>

          {filtered.length === 0 && (
            <p className="empty">No titles found.</p>
          )}

        </section>

        {/* MOVIES */}

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
              Authorized Bangla-dubbed anime movies will
              appear here when movie catalogue support is configured.
            </span>
          </div>

        </section>

        {/* STUDIOS */}

        <section className="feature" id="studios">

          <div>
            <div className="eyebrow">BUILT FOR THE COMMUNITY</div>

            <h2>
              One hub for
              <br />
              <em>every voice.</em>
            </h2>

            <p>
              Discover dubbing studios, voice artists and
              creative teams. Build connections with the
              Bangla anime dubbing community.
            </p>

            <a className="secondary" href="#about">
              About our platform <ChevronRight size={16} />
            </a>
          </div>

          <div className="feature-panel">

            <div className="feature-icon">
              <Mic2 size={32} />
            </div>

            <strong>Bangla Dubbing Network</strong>

            <span>
              Studios · Voice Artists · Originals · Partners
            </span>

            <div className="bars">
              <i /><i /><i /><i /><i /><i />
              <i /><i /><i /><i /><i /><i />
            </div>

          </div>

        </section>

        {/* ABOUT */}

        <section className="catalog" id="about">

          <div className="section-head">
            <div>
              <div className="eyebrow">ABOUT US</div>
              <h2>Welcome to <em>Anime Hub Bangla</em></h2>
            </div>
          </div>

          <div className="community-panel">

            <div className="community-columns">

              <div>
                <Info size={28} />
                <h3>Our Platform</h3>
                <p>
                  Anime Hub Bangla is designed to bring
                  Bangla-dubbed anime, authorized releases,
                  original projects and dubbing communities
                  together in one platform.
                </p>
              </div>

              <div>
                <Users size={28} />
                <h3>Our Community</h3>
                <p>
                  A place for anime fans, dubbing studios,
                  voice artists and creative teams to connect.
                </p>
              </div>

            </div>

          </div>

        </section>

        {/* PRIVACY */}

        <section className="catalog" id="privacy">
          <div className="eyebrow">YOUR DATA</div>
          <h2>Privacy</h2>
          <p>
            Account and personal information should be handled
            securely. A complete privacy policy must be published
            before public launch.
          </p>
        </section>

        {/* TERMS */}

        <section className="catalog" id="terms">
          <div className="eyebrow">PLATFORM RULES</div>
          <h2>Terms of Service</h2>
          <p>
            Users must respect content rights and platform rules.
            Complete terms must be published before public launch.
          </p>
        </section>

        {/* COPYRIGHT */}

        <section className="catalog" id="copyright">
          <div className="eyebrow">CONTENT RIGHTS</div>
          <h2>Copyright</h2>
          <p>
            Content rights belong to their respective owners.
            Only authorized content should be published on
            Anime Hub Bangla.
          </p>
        </section>

      </main>

      {/* FOOTER */}

      <footer>

        <a className="brand" href="#top">
          <span className="brandmark">AH</span>
          <span>ANIME HUB <b>BANGLA</b></span>
        </a>

        <span>
          © {new Date().getFullYear()} Anime Hub Bangla.
          Content rights belong to their respective owners.
        </span>

        <span className="footlinks">
          <a href="#privacy">Privacy</a>
          <a href="#terms">Terms</a>
          <a href="#copyright">Copyright</a>
        </span>

      </footer>

    </div>
  );
}

export default function App() {
  const path = window.location.pathname;

  if (path.startsWith('/admin')) return <Admin />;
  if (path.startsWith('/anime/')) return <AnimeDetails />;
  if (path.startsWith('/account')) return <Account />;

  return <Home />;
}
