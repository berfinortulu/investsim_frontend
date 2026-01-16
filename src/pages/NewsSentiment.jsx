import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_ENDPOINTS } from '../config';

const SYMBOLS = ['BTC','ETH','ADA','DOT','LINK','LTC','XRP','BCH'];
const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
];
const NEWS_CACHE_STORE_KEY = 'news:sentiment:store';

const relativeTime = (iso) => {
  try {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  } catch { return ''; }
};

const formatPct = (x) => `${(Number(x) * 100).toFixed(0)}%`;

const sentimentBadge = (score) => {
  const s = Number(score);
  if (!Number.isFinite(s)) return { text: 'Neutral', color: '#9ca3af' };
  if (s >= 0.66) return { text: 'Positive', color: '#10b981' };
  if (s >= 0.34) return { text: 'Neutral', color: '#f59e0b' };
  return { text: 'Negative', color: '#ef4444' };
};

const Donut = ({ value }) => {
  const pct = Math.max(0, Math.min(1, Number(value) || 0));
  const r = 18;
  const C = 2 * Math.PI * r;
  const filled = C * pct;
  const rest = C - filled;
  return (
    <svg width={44} height={44} viewBox="0 0 44 44">
      <circle cx={22} cy={22} r={r} stroke="#e5e7eb" strokeWidth={6} fill="none" />
      <circle cx={22} cy={22} r={r} stroke="#60a5fa" strokeWidth={6} fill="none" strokeDasharray={`${filled} ${rest}`} transform="rotate(-90 22 22)" />
      <text x={22} y={24} textAnchor="middle" fontSize={10} fill="#374151">{Math.round(pct*100)}%</text>
    </svg>
  );
};

const NewsSentiment = () => {
  const { authenticatedFetch, user } = useAuth();
  const [symbol, setSymbol] = useState('BTC');
  const [language, setLanguage] = useState('en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [cachedHit, setCachedHit] = useState(false);
  const [lastParams, setLastParams] = useState({ symbol: 'BTC', language: 'en' });
  const [cacheStore, setCacheStore] = useState({}); // { `${symbol}|${language}`: { data, fetchedAt } }

  const makeKey = (sym, lang) => `${sym}|${lang}`;

  // Load cache store on mount; hydrate current selection if present. No auto-fetch.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(NEWS_CACHE_STORE_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      setCacheStore(obj && typeof obj === 'object' ? obj : {});
      const key = makeKey(symbol, language);
      if (obj && obj[key] && obj[key].data) {
        setData(obj[key].data);
        setFetchedAt(obj[key].fetchedAt || null);
        setCachedHit(true);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When dropdown selection changes, show cached data immediately if available
  useEffect(() => {
    const key = makeKey(symbol, language);
    if (cacheStore && cacheStore[key] && cacheStore[key].data) {
      setData(cacheStore[key].data);
      setFetchedAt(cacheStore[key].fetchedAt || null);
      setCachedHit(true);
      setError('');
    } else {
      setData(null);
      setFetchedAt(null);
      setCachedHit(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, language]);

  const handleFetch = async () => {
    setLoading(true);
    setError('');
    setCachedHit(false);
    const start = performance.now();
    try {
      const url = `/api/news/sentiment/?symbol=${encodeURIComponent(symbol)}&language=${encodeURIComponent(language)}`;
      const res = await authenticatedFetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
      if (!res.ok) {
        const text = await res.text();
        if (res.status === 503 || res.status === 429) throw new Error('Rate‑limited (try again in ~15m)');
        if (res.status === 502) throw new Error('Upstream error');
        if (res.status === 500) throw new Error('NEWSAPI_KEY not set');
        if (res.status === 400) throw new Error('Symbol required');
        throw new Error(text || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
      const now = Date.now();
      setFetchedAt(now);
      const key = makeKey(symbol, language);
      const nextStore = { ...cacheStore, [key]: { data: json, fetchedAt: now } };
      setCacheStore(nextStore);
      try { localStorage.setItem(NEWS_CACHE_STORE_KEY, JSON.stringify(nextStore)); } catch {}
      const end = performance.now();
      const sameParams = lastParams.symbol === symbol && lastParams.language === language;
      if (sameParams && end - start < 300) {
        setCachedHit(true);
      }
      setLastParams({ symbol, language });
    } catch (e) {
      setError(e.message || 'Failed to fetch news');
    } finally {
      setLoading(false);
    }
  };

  const overall = Number(data?.overall_score);
  const posPct = Number(data?.positive_pct);
  const negPct = Number(data?.negative_pct);
  const badge = sentimentBadge(overall);

  // Show faint background only when there are no items
  const showPlaceholderBg = !loading && (!data || !data.items || data.items.length === 0);
  const contentStyle = showPlaceholderBg
    ? {
        backgroundImage:
          "linear-gradient(rgba(15,23,42,0.85), rgba(15,23,42,0.85)), url('/newsp.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        borderRadius: 12,
        padding: 12,
        minHeight: '40vh',
        flex: 1,
      }
    : { padding: 12, minHeight: '40vh', flex: 1 };

  return (
    <div className="page-container" style={{ padding: 20, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: 12, background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.35)', borderRadius: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0 }}>News Sentiment</h2>
          <Donut value={overall} />
        </div>
        {/* Top helper text removed per request */}
      </div>

      {/* Controls bar fixed below header */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, padding: 12, background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: 10 }}>
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)} style={{ padding: '8px 10px', borderRadius: 6 }}>
          {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ padding: '8px 10px', borderRadius: 6 }}>
          {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
        <button onClick={handleFetch} disabled={loading} style={{ padding: '8px 12px', borderRadius: 6 }}>
          {loading ? 'Loading…' : 'Fetch'}
        </button>
      </div>

      {/* Content area (background only when empty) */}
      <div style={contentStyle}>
        {error && (
          <div style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', padding: 12, borderRadius: 8, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {data && (
          <div style={{ marginBottom: 16, padding: 16, borderRadius: 10, border: '1px solid rgba(96,165,250,0.35)', background: 'rgba(59,130,246,0.12)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontWeight: 600 }}>Overall sentiment:</div>
                <span style={{ fontWeight: 700 }}>
                  {Number.isFinite(overall) ? `${Math.round(overall * 100)}%` : '—'}
                </span>
                <span style={{
                  padding: '2px 8px', borderRadius: 999, background: badge.color, color: '#fff', fontSize: 12, fontWeight: 600
                }}>{badge.text}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, color: '#9ca3af', fontSize: 12 }}>
                <span style={{ padding: '2px 6px', background: 'rgba(16,185,129,0.12)', borderRadius: 999 }}>
                  Positive {Number.isFinite(posPct) ? Math.round(posPct * 100) : 0}%
                </span>
                <span style={{ padding: '2px 6px', background: 'rgba(239,68,68,0.12)', borderRadius: 999 }}>
                  Negative {Number.isFinite(negPct) ? Math.round(negPct * 100) : 0}%
                </span>
                <span style={{ padding: '2px 6px', background: 'rgba(107,114,128,0.12)', borderRadius: 999 }}>
                  Fetched {data?.fetched ?? 0}
                </span>
              </div>
            </div>
          </div>
        )}

        {data?.items && data.items.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.items.map((it, idx) => {
              const rawScore = (it && (it.sentiment?.score ?? it.score ?? it.sentiment_score ?? (typeof it.sentiment === 'number' ? it.sentiment : null)));
              const numScore = Number(rawScore);
              const finiteScore = Number.isFinite(numScore) ? numScore : NaN;
              const s = sentimentBadge(finiteScore);
              const pillText = (it && it.sentiment && typeof it.sentiment.label === 'string' && it.sentiment.label.trim()) ? it.sentiment.label : s.text;
              return (
                <div key={idx} style={{ padding: 14, borderRadius: 10, border: '1px solid rgba(102,204,255,0.15)', background: 'rgba(17,25,40,0.6)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <a href={it?.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, color: '#e5e7eb', textDecoration: 'none' }}>
                      {it?.title || 'Untitled'}
                    </a>
                    <span style={{ padding: '2px 8px', borderRadius: 999, background: s.color, color: '#fff', fontSize: 12 }}>
                      {pillText} {Number.isFinite(finiteScore) ? finiteScore.toFixed(2) : '—'}
                    </span>
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 4 }}>
                    {it?.source || 'Unknown'} • {relativeTime(it?.published_at)}
                  </div>
                  {it?.description && (
                    <div style={{ color: '#cbd5e1', fontSize: 14, marginTop: 8 }}>
                      {String(it.description).length > 220 ? `${String(it.description).slice(0, 220)}…` : String(it.description)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!loading && !error && (!data || !data.items || data.items.length === 0) && (
          <div style={{ color: '#9ca3af', fontSize: 14 }}>
            No items
          </div>
        )}
      </div>
    </div>
  );
};

export default NewsSentiment; 