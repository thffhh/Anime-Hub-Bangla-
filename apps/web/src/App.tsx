import { useEffect, useState } from 'react';
import { Search, Play, Menu, Shield, Film, Tv, Star, ChevronRight } from 'lucide-react';
import Admin from './Admin';
import AnimeDetails from './AnimeDetails';
import Account from './Account';

const API = import.meta.env.VITE_API_URL || 'https://anime-hub-bangla.onrender.com';
type Anime = { id:string; slug:string; title:string; synopsis?:string; posterUrl?:string; releaseYear?:number; status:string; genres:string[] };
const fallback: Anime[] = [
 {id:'demo-1',slug:'sample-adventure',title:'Sample Adventure',synopsis:'A sample title used to demonstrate the catalogue layout. Replace with licensed Bangla-dubbed content.',releaseYear:2026,status:'ONGOING',genres:['Adventure','Fantasy']},
 {id:'demo-2',slug:'sample-journey',title:'Sample Journey',synopsis:'Demo content only. No copyrighted episodes or video streams are included.',releaseYear:2025,status:'COMPLETED',genres:['Drama','Fantasy']},
 {id:'demo-3',slug:'sample-heroes',title:'Sample Heroes',synopsis:'Connect your API and add authorized titles from the admin tools.',releaseYear:2026,status:'UPCOMING',genres:['Action']}
];
function Home(){
 const [items,setItems]=useState<Anime[]>(fallback); const [query,setQuery]=useState(''); const [apiState,setApiState]=useState('Checking API…');
 useEffect(()=>{fetch(`${API}/api/anime`).then(r=>{if(!r.ok)throw new Error();return r.json()}).then(d=>{if(Array.isArray(d.data))setItems(d.data);setApiState('API connected')}).catch(()=>setApiState('Demo catalogue — API not connected'));},[]);
 const filtered=items.filter(a=>a.title.toLowerCase().includes(query.toLowerCase()));
 return <div className="app"><header className="top"><a className="brand" href="/"><span className="brandmark">AH</span><span>ANIME HUB <b>BANGLA</b></span></a><nav><a href="#anime">Anime</a><a href="#movies">Movies</a><a href="#studios">Studios</a><a href="#about">About</a></nav><div className="actions"><label className="search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search anime"/></label><a className="login" href="/account">Sign in / Join</a><button className="mobile"><Menu/></button></div></header>
 <main><section className="hero"><div className="hero-copy"><div className="eyebrow"><span/> BANGLA DUBBED ANIME UNIVERSE</div><h1>Your Anime.<br/><em>Your Language.</em></h1><p>Discover anime stories in Bangla. Explore licensed releases, original projects and dubbing studios — all in one place.</p><div className="hero-buttons"><a className="primary" href="#anime"><Play size={17} fill="currentColor"/> Explore Anime</a><a className="secondary" href="#about">Learn more <ChevronRight size={16}/></a></div><small className="status">{apiState}</small></div><div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="poster-ghost"><Film size={76}/><span>ANIME<br/>HUB</span></div><div className="floating-tag">বাংলা ডাবড</div></div></section>
 <section className="trust"><div><Shield/> Authorized content first</div><div><Tv/> Web + Android experience</div><div><Star/> Community reviews</div></section>
 <section className="catalog" id="anime"><div className="section-head"><div><div className="eyebrow">EXPLORE THE LIBRARY</div><h2>Discover <em>Anime</em></h2></div><span>{filtered.length} titles <ChevronRight size={15}/></span></div><div className="cards">{filtered.map(a=><a className="anime-card" key={a.id} href={`/anime/${encodeURIComponent(a.slug)}`}><div className="poster">{a.posterUrl?<img src={a.posterUrl} alt=""/>:<div className="poster-placeholder"><Film size={34}/><span>ANIME HUB</span></div>}<span className="type">{a.status}</span><span className="card-play"><Play size={18} fill="currentColor"/></span></div><h3>{a.title}</h3><p>{a.releaseYear||'New'} · {a.genres?.slice(0,2).join(' / ')}</p></a>)}</div>{filtered.length===0&&<p className="empty">No titles found.</p>}</section>
 <section className="feature" id="studios"><div><div className="eyebrow">BUILT FOR THE COMMUNITY</div><h2>One hub for<br/><em>every voice.</em></h2><p>Discover dubbing studios, voice artists and creative teams. Collaboration applications and community tools can be enabled as the platform is configured.</p><a className="secondary" href="#about">Explore the platform <ChevronRight size={16}/></a></div><div className="feature-panel"><div className="feature-icon"><Film size={32}/></div><strong>Bangla Dubbing Network</strong><span>Studios · Artists · Originals · Partners</span><div className="bars"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></div></section>
 </main><footer id="about"><a className="brand" href="/"><span className="brandmark">AH</span><span>ANIME HUB <b>BANGLA</b></span></a><span>© {new Date().getFullYear()} Anime Hub Bangla. Content rights belong to their respective owners.</span><span className="footlinks"><a href="#privacy">Privacy</a><a href="#terms">Terms</a><a href="#copyright">Copyright</a></span></footer></div>
}
export default function App(){
 const path=window.location.pathname;
 if(path.startsWith('/admin')) return <Admin/>;
 if(path.startsWith('/anime/')) return <AnimeDetails/>;
 if(path.startsWith('/account')) return <Account/>;
 return <Home/>;
}
