import { useEffect, useMemo, useState } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';
type Library = { id: string; libraryId: string; libraryName: string; style?: string | null; role?: string | null; profile?: Record<string, string[]> };
type Video = { id: string; title: string; filename: string; purpose?: string; visibility: string };

function api(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('bachataToken');
  return fetch(`${API}${path}`, { ...options, headers: { ...(options.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
}

function videoUrl(videoId: string) {
  const token = localStorage.getItem('bachataToken');
  const query = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${API}/videos/${videoId}/file${query}`;
}

export default function App() {
  const [user, setUser] = useState(() => localStorage.getItem('bachataUser') || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [libraryId, setLibraryId] = useState(localStorage.getItem('bachataLibraryId') || 'default');
  const [profile, setProfile] = useState<any>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [purpose, setPurpose] = useState('reference');
  const [status, setStatus] = useState('');
  const [correction, setCorrection] = useState('');
  const [review, setReview] = useState<any>(null);

  const selectedLibrary = useMemo(() => libraries.find((item) => item.libraryId === libraryId), [libraries, libraryId]);

  async function loadWorkspace() {
    const [libraryResponse, videoResponse, profileResponse] = await Promise.all([
      api('/videos/learning-libraries'), api('/videos'), api(`/videos/coach-profile?libraryId=${encodeURIComponent(libraryId)}`),
    ]);
    if (libraryResponse.ok) {
      const next = await libraryResponse.json(); setLibraries(next);
      if (!next.some((item: Library) => item.libraryId === libraryId) && next[0]) setLibraryId(next[0].libraryId);
    }
    if (videoResponse.ok) setVideos(await videoResponse.json());
    if (profileResponse.ok) setProfile(await profileResponse.json());
  }

  useEffect(() => { if (user) void loadWorkspace(); }, [user, libraryId]);

  async function authenticate(path: '/users/login' | '/users/register') {
    setStatus('Signing in…');
    const response = await api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, displayName: email.split('@')[0] }) });
    const data = await response.json();
    if (!response.ok) return setStatus(data.message || 'Authentication failed.');
    localStorage.setItem('bachataToken', data.token); localStorage.setItem('bachataUser', data.user.displayName || data.user.email); setUser(data.user.displayName || data.user.email); setStatus('');
  }

  async function createLibrary() {
    const name = window.prompt('Library name, e.g. Jack & Jill Follower'); if (!name?.trim()) return;
    const style = window.prompt('Style: Traditional, Sensual, Urban, or Mixed') || undefined;
    const role = window.prompt('Role: Leader, Follower, or Both') || undefined;
    const response = await api('/videos/learning-libraries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, style, role }) });
    if (!response.ok) return setStatus('Could not create library.');
    const created = await response.json(); setLibraryId(created.libraryId); localStorage.setItem('bachataLibraryId', created.libraryId); await loadWorkspace();
  }

  async function uploadLocal() {
    if (!file) return setStatus('Choose a video first.'); setStatus('Uploading…');
    const body = new FormData(); body.append('file', file); body.append('title', title || file.name); body.append('purpose', purpose); body.append('libraryId', libraryId);
    const response = await api('/videos', { method: 'POST', body }); const data = await response.json(); setStatus(response.ok ? 'Upload complete.' : data.message || 'Upload failed.'); if (response.ok) { setFile(null); await loadWorkspace(); }
  }

  async function uploadUrl() {
    if (!url.trim()) return setStatus('Paste a YouTube URL first.'); setStatus('Downloading reference video…');
    const response = await api('/videos/upload-from-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, title: title || undefined, purpose, libraryId }) });
    const data = await response.json(); setStatus(response.ok && data.success ? 'YouTube video added.' : data.error || 'URL import failed.'); if (response.ok && data.success) { setUrl(''); await loadWorkspace(); }
  }

  async function addCorrection() {
    if (!correction.trim()) return; const response = await api('/videos/coach-profile/corrections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correction, libraryId }) });
    if (response.ok) { setCorrection(''); setProfile(await response.json()); }
  }

  async function reviewVideo(video: Video) {
    setStatus('Analyzing video…');
    const start = await api(`/videos/${video.id}/review/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aTime: 0, bTime: 120 }) });
    const range = await start.json();
    if (!start.ok || range.error) return setStatus(range.error || 'Could not start review.');
    const chunks = [];
    for (let chunkNumber = 1; chunkNumber <= range.totalChunks; chunkNumber += 1) {
      const response = await api(`/videos/${video.id}/review/chunk/${chunkNumber}?aTime=${range.aTime}&bTime=${range.bTime}&libraryId=${encodeURIComponent(libraryId)}`);
      const data = await response.json();
      if (!response.ok || data.error) return setStatus(data.error || 'Review failed.');
      chunks.push(data);
      setStatus(`Analyzing chunk ${chunkNumber} of ${range.totalChunks}…`);
    }
    setReview({ video, data: chunks[0], chunks }); setStatus('Review complete.');
  }

  if (!user) return <main className="mx-auto flex min-h-screen max-w-md items-center px-6"><section className="panel w-full"><p className="mb-2 text-sm font-semibold text-fuchsia-400">BACHATA COACH</p><h1 className="mb-2 text-3xl font-bold">Build your own dance coach.</h1><p className="mb-6 text-slate-400">Curate reference libraries for traditional bachata and Jack & Jill practice.</p><input className="field mb-3" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} /><input className="field mb-4" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} /><div className="flex gap-3"><button className="button-primary flex-1" onClick={() => void authenticate('/users/login')}>Sign in</button><button className="button-secondary flex-1" onClick={() => void authenticate('/users/register')}>Create account</button></div>{status && <p className="mt-4 text-sm text-amber-300">{status}</p>}</section></main>;

  return <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6"><header className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-fuchsia-400">BACHATA COACH</p><h1 className="text-4xl font-bold tracking-tight">Your learning studio</h1><p className="mt-2 text-slate-400">Signed in as {user}</p></div><button className="button-secondary" onClick={() => { localStorage.clear(); setUser(''); }}>Sign out</button></header><div className="grid gap-6 lg:grid-cols-[360px_1fr]"><aside className="space-y-6"><section className="panel"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Learning library</h2><button className="text-sm text-fuchsia-400 hover:text-fuchsia-300" onClick={() => void createLibrary()}>+ New</button></div><select className="field mb-3" value={libraryId} onChange={(e) => { setLibraryId(e.target.value); localStorage.setItem('bachataLibraryId', e.target.value); }}><option value="default">My Coach</option>{libraries.filter((item) => item.libraryId !== 'default').map((item) => <option key={item.libraryId} value={item.libraryId}>{item.libraryName}</option>)}</select><p className="text-xs text-slate-400">{selectedLibrary?.style || 'Personal'} · {selectedLibrary?.role || 'All roles'}</p></section><section className="panel"><h2 className="mb-4 font-semibold">Teach the coach</h2><input className="field mb-3" placeholder="Video title" value={title} onChange={(e) => setTitle(e.target.value)} /><select className="field mb-3" value={purpose} onChange={(e) => setPurpose(e.target.value)}><option value="reference">Teaching/reference video</option><option value="practice">Practice video</option></select><input className="field mb-3" type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} /><button className="button-primary w-full" onClick={() => void uploadLocal()}>Upload video</button><div className="my-4 border-t border-slate-800" /><input className="field mb-3" placeholder="Paste a YouTube URL" value={url} onChange={(e) => setUrl(e.target.value)} /><button className="button-secondary w-full" onClick={() => void uploadUrl()}>Import YouTube video</button>{status && <p className="mt-3 text-sm text-amber-300">{status}</p>}</section><section className="panel"><h2 className="mb-3 font-semibold">Learned profile</h2><p className="mb-4 text-sm text-slate-400">{profile?.profile?.referenceSummaries?.length ? `${profile.profile.referenceSummaries.length} reference analyses in this library.` : 'Add reference videos to start this library.'}</p><div className="space-y-2 text-sm text-slate-300">{(profile?.profile?.timingPriorities || []).slice(-3).map((item: string) => <p key={item}>• {item}</p>)}{(profile?.profile?.styleInfluences || []).slice(-3).map((item: string) => <p key={item}>• {item}</p>)}</div><input className="field mt-4" placeholder="Correct this library…" value={correction} onChange={(e) => setCorrection(e.target.value)} /><button className="button-secondary mt-2 w-full" onClick={() => void addCorrection()}>Save correction</button></section></aside><section className="panel"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-semibold">My videos</h2><p className="text-sm text-slate-400">Choose a practice video to review against the selected library.</p></div><span className="rounded-full bg-fuchsia-500/10 px-3 py-1 text-sm text-fuchsia-300">{videos.length} videos</span></div>{review && <div className="mb-6 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-4"><p className="mb-1 text-sm font-semibold text-fuchsia-300">Review: {review.video.title}</p><p className="mb-3 text-slate-200">{review.data.summary}</p><p className="text-sm text-slate-300">{review.data.musicality}</p>{review.chunks?.slice(1).map((chunk: any) => <div className="mt-4 border-t border-fuchsia-500/20 pt-3" key={chunk.chunkNumber}><p className="font-semibold text-fuchsia-200">Chunk {chunk.chunkNumber}</p><p className="mt-1 text-sm text-slate-300">{chunk.summary}</p></div>)}{review.data.improvementTips?.length > 0 && <ul className="mt-3 list-disc pl-5 text-sm text-slate-300">{review.data.improvementTips.map((tip: string) => <li key={tip}>{tip}</li>)}</ul>}</div>}{videos.length === 0 ? <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center text-slate-400">Your uploaded videos will appear here.</div> : <div className="grid gap-4 md:grid-cols-2">{videos.map((video) => <article className="rounded-xl border border-slate-800 bg-slate-950 p-4" key={video.id}><div className="mb-3 aspect-video overflow-hidden rounded-lg bg-black"><video className="h-full w-full object-contain" src={videoUrl(video.id)} controls /></div><h3 className="font-semibold">{video.title}</h3><p className="mt-1 text-xs text-slate-500">{video.purpose === 'reference' ? 'Reference' : 'Practice'} · {video.filename}</p><button className="button-primary mt-4 w-full" onClick={() => void reviewVideo(video)}>Review against this library</button></article>)}</div>}</section></div></main>;
}
