import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import dotenv from 'dotenv';
import * as yt from './src/server/youtube.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HISTORY_FILE = path.join(__dirname, 'data', 'watch-history.json');
const HISTORY_MAX = 100;

function ensureHistoryStore() {
  fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, '{}', 'utf8');
  }
}

function readHistoryStore(): Record<string, any[]> {
  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeHistoryStore(store: Record<string, any[]>) {
  const tempFile = `${HISTORY_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(store), 'utf8');
  fs.renameSync(tempFile, HISTORY_FILE);
}

function historyOwner(req: express.Request, res: express.Response): string {
  const match = req.headers.cookie?.match(/(?:^|;\s*)vt_history_id=([^;]+)/);
  if (match?.[1]) return decodeURIComponent(match[1]);

  const id = crypto.randomUUID();
  res.setHeader(
    'Set-Cookie',
    `vt_history_id=${encodeURIComponent(id)}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly`
  );
  return id;
}

function cleanHistoryEntry(entry: any) {
  if (!entry || typeof entry !== 'object' || typeof entry.videoId !== 'string') return null;
  const videoId = entry.videoId.trim();
  if (!videoId || videoId.length > 32) return null;
  return {
    videoId,
    title: String(entry.title || '').slice(0, 500),
    author: String(entry.author || '').slice(0, 200),
    authorId: String(entry.authorId || '').slice(0, 200),
    lengthSeconds: Number.isFinite(Number(entry.lengthSeconds)) ? Number(entry.lengthSeconds) : 0,
    viewCount: Number.isFinite(Number(entry.viewCount)) ? Number(entry.viewCount) : 0,
    published: Number.isFinite(Number(entry.published)) ? Number(entry.published) : 0,
    thumbnailUrl: entry.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    watchedAt: Number.isFinite(Number(entry.watchedAt))
      ? Number(entry.watchedAt)
      : Math.floor(Date.now() / 1000),
    note: typeof entry.note === 'string' ? entry.note.slice(0, 300) : '',
  };
}

ensureHistoryStore();

app.use(express.json({ limit: '64kb' }));

// ── Session endpoint ──
app.get('/api/session', (req, res) => {
  const cookieUser = req.headers['x-user-name'] ? { displayName: String(req.headers['x-user-name']) } : null;
  res.json({
    ok: true,
    user: cookieUser,
    googleConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  });
});

// ── Watch history API (dynamic, user-specific, editable) ──
app.get('/api/history', (req, res) => {
  const store = readHistoryStore();
  const owner = historyOwner(req, res);
  const list = Array.isArray(store[owner]) ? store[owner] : [];
  res.json({ ok: true, history: list });
});

app.post('/api/history', (req, res) => {
  const entry = cleanHistoryEntry(req.body);
  if (!entry) return res.status(400).json({ ok: false, error: 'Invalid history entry.' });

  const store = readHistoryStore();
  const owner = historyOwner(req, res);
  const current = Array.isArray(store[owner]) ? store[owner] : [];
  // Ensure watchedAt is updated to now when re-watched
  entry.watchedAt = Math.floor(Date.now() / 1000);
  store[owner] = [entry, ...current.filter(item => item.videoId !== entry.videoId)].slice(0, HISTORY_MAX);
  writeHistoryStore(store);
  res.json({ ok: true, history: store[owner] });
});

// Edit history item (e.g. edit note or custom title)
app.patch('/api/history/:videoId', (req, res) => {
  const videoId = req.params.videoId;
  const store = readHistoryStore();
  const owner = historyOwner(req, res);
  const current = Array.isArray(store[owner]) ? store[owner] : [];
  let updated = false;
  
  store[owner] = current.map(item => {
    if (item.videoId === videoId) {
      updated = true;
      return {
        ...item,
        note: typeof req.body.note === 'string' ? req.body.note.slice(0, 300) : item.note,
        title: typeof req.body.title === 'string' && req.body.title.trim() ? req.body.title.slice(0, 500) : item.title,
      };
    }
    return item;
  });

  if (updated) {
    writeHistoryStore(store);
  }
  res.json({ ok: true, history: store[owner] });
});

app.delete('/api/history/:videoId', (req, res) => {
  const store = readHistoryStore();
  const owner = historyOwner(req, res);
  store[owner] = (Array.isArray(store[owner]) ? store[owner] : []).filter(item => item.videoId !== req.params.videoId);
  writeHistoryStore(store);
  res.json({ ok: true, history: store[owner] });
});

app.delete('/api/history', (req, res) => {
  const store = readHistoryStore();
  const owner = historyOwner(req, res);
  store[owner] = [];
  writeHistoryStore(store);
  res.json({ ok: true, history: [] });
});

// ── Personalized Recommendations API (Prioritizes newer videos from frequently watched creators) ──
async function buildRecommendations(history: any[]): Promise<{ recommendations: any[]; favoriteCreators: string[] }> {
  const watchedIds = new Set(history.map(item => item.videoId));
  const creatorMap = new Map<string, { author: string; authorId: string; count: number; lastWatched: number }>();
  const keywords: string[] = [];

  for (const item of history) {
    if (item.author && item.author !== 'YouTube Creator' && item.author !== 'YouTube') {
      const name = item.author.trim();
      const existing = creatorMap.get(name) || {
        author: item.author,
        authorId: item.authorId || '',
        count: 0,
        lastWatched: 0,
      };
      existing.count += 1;
      existing.lastWatched = Math.max(existing.lastWatched, item.watchedAt || 0);
      if (!existing.authorId && item.authorId) existing.authorId = item.authorId;
      creatorMap.set(name, existing);
    }

    if (item.title) {
      const words = item.title
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter((w: string) => w.length > 3 && !['with', 'from', 'that', 'this', 'have', 'what', 'video', 'watch', 'episode', 'official'].includes(w.toLowerCase()));
      keywords.push(...words.slice(0, 3));
    }
  }

  // Rank creators by frequency and recency
  const sortedCreators = Array.from(creatorMap.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return b.lastWatched - a.lastWatched;
  });

  const topCreators = sortedCreators.slice(0, 4);
  const favoriteCreators = topCreators.map(c => c.author);

  const prioritizedCreatorVideos: any[] = [];
  const topicVideos: any[] = [];

  // 1. Fetch newest videos from each frequently watched creator
  for (const creator of topCreators) {
    try {
      let videos: any[] = [];
      if (creator.authorId && creator.authorId.startsWith('UC')) {
        const ch = await yt.getChannel(creator.authorId);
        videos = ch.videos || [];
      }
      if (!videos || videos.length === 0) {
        videos = await yt.search(creator.author, 10);
      }

      // Filter out watched videos, sort by published date descending (newest videos first)
      const unwatched = (videos || [])
        .filter((v: any) => v && v.videoId && !watchedIds.has(v.videoId))
        .sort((a: any, b: any) => (Number(b.published) || 0) - (Number(a.published) || 0))
        .slice(0, 5)
        .map((v: any) => ({
          ...v,
          isFromFavoriteCreator: true,
          recommendReason: `New from ${creator.author} • Frequently Watched`,
        }));

      prioritizedCreatorVideos.push(...unwatched);
    } catch {
      // Continue to next creator
    }
  }

  // 2. Fetch topic/keyword related videos based on watch history
  if (keywords.length > 0) {
    const uniqueKeywords = Array.from(new Set(keywords)).slice(0, 3);
    for (const kw of uniqueKeywords) {
      try {
        const kwVideos = await yt.search(kw, 6);
        const fresh = (kwVideos || [])
          .filter((v: any) => v && v.videoId && !watchedIds.has(v.videoId))
          .slice(0, 3)
          .map((v: any) => ({
            ...v,
            recommendReason: `Because you watched "${kw}" videos`,
          }));
        topicVideos.push(...fresh);
      } catch {}
    }
  }

  // 3. Fallback / Rounding with trending videos
  let trending: any[] = [];
  try {
    trending = await yt.getTrending();
  } catch {}

  const freshTrending = (trending || [])
    .filter((v: any) => v && v.videoId && !watchedIds.has(v.videoId))
    .map((v: any) => ({
      ...v,
      recommendReason: 'Trending Now',
    }));

  // Combine order:
  // Top priority: Newest videos from favorite creators
  // Second priority: Related topic videos
  // Third priority: Trending recommendations
  const allCandidates = [...prioritizedCreatorVideos, ...topicVideos, ...freshTrending];

  // Deduplicate by videoId
  const seen = new Set<string>();
  const recommendations: any[] = [];
  for (const v of allCandidates) {
    if (!seen.has(v.videoId)) {
      seen.add(v.videoId);
      recommendations.push(v);
    }
  }

  return { recommendations, favoriteCreators };
}

app.get('/api/recommended', async (req, res) => {
  try {
    const store = readHistoryStore();
    const owner = historyOwner(req, res);
    const history = Array.isArray(store[owner]) ? store[owner] : [];
    const result = await buildRecommendations(history);
    res.json({ ok: true, ...result });
  } catch (e: any) {
    const trending = await yt.getTrending().catch(() => []);
    res.json({ ok: true, recommendations: trending, favoriteCreators: [] });
  }
});

app.post('/api/recommended', async (req, res) => {
  try {
    const store = readHistoryStore();
    const owner = historyOwner(req, res);
    const clientHistory = Array.isArray(req.body?.history) ? req.body.history : null;
    const history = clientHistory && clientHistory.length > 0 ? clientHistory : (Array.isArray(store[owner]) ? store[owner] : []);
    const result = await buildRecommendations(history);
    res.json({ ok: true, ...result });
  } catch (e: any) {
    const trending = await yt.getTrending().catch(() => []);
    res.json({ ok: true, recommendations: trending, favoriteCreators: [] });
  }
});

// ── Video Direct Streaming API (Pipes byte ranges for HTML5 video player with quality choice) ──
app.get('/api/stream/:id', async (req, res) => {
  try {
    const videoId = req.params.id;
    const requestedQuality = (req.query.quality as string) || 'auto';

    if (!/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) {
      return res.status(400).send('Invalid video ID.');
    }

    let streamUrl: string;
    try {
      streamUrl = await yt.getStreamUrl(videoId, requestedQuality);
    } catch {
      // Fallback to auto/any stream quality
      streamUrl = await yt.getStreamUrl(videoId, 'auto');
    }

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    };
    if (req.headers.range) {
      headers.Range = req.headers.range as string;
    }

    let upstream = await fetch(streamUrl, { headers });

    // If upstream returned 403 or error, retry with auto quality and fresh URL
    if (!upstream.ok && upstream.status !== 206) {
      yt.rotateInvidious();
      streamUrl = await yt.getStreamUrl(videoId, '360p');
      upstream = await fetch(streamUrl, { headers });
      if (!upstream.ok && upstream.status !== 206) {
        throw new Error(`Video stream source returned HTTP ${upstream.status}`);
      }
    }

    const passthroughHeaders = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'etag',
      'last-modified',
    ];
    for (const name of passthroughHeaders) {
      const val = upstream.headers.get(name);
      if (val) res.setHeader(name, val);
    }
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, no-cache');
    res.status(upstream.status);

    if (!upstream.body) return res.end();
    Readable.fromWeb(upstream.body as any).pipe(res);
  } catch (e: any) {
    const limited = /rate-limited|not a bot|too many requests/i.test(e.message || '');
    if (!res.headersSent) {
      res.status(limited ? 429 : 502).send(
        limited
          ? 'Video streaming is temporarily paused because YouTube rate-limited this server. Switch to Privacy Embed or Alt Mirror.'
          : `Unable to stream this video: ${e.message}`
      );
    } else {
      res.destroy(e);
    }
  }
});

app.get('/api/stream/status/:id', async (req, res) => {
  try {
    const videoId = req.params.id;
    const hasCookies = fs.existsSync(COOKIES_FILE) && fs.statSync(COOKIES_FILE).size > 10;
    const hasProxy = fs.existsSync(PROXY_FILE) && fs.statSync(PROXY_FILE).size > 5;
    res.json({
      ok: true,
      videoId,
      hasCookies,
      hasProxy,
      canDirectStream: hasCookies || hasProxy,
    });
  } catch {
    res.json({ ok: false, canDirectStream: false });
  }
});

// ── Stream Qualities for Video ──
app.get('/api/video/:id/formats', async (req, res) => {
  try {
    const videoId = req.params.id;
    const qualities = await yt.getVideoQualities(videoId);
    res.json({ ok: true, qualities });
  } catch (err: any) {
    res.json({
      ok: true,
      qualities: [
        { quality: '720p', label: '720p HD', resolution: '1280x720', isHd: true },
        { quality: '360p', label: '360p (Data Saver)', resolution: '640x360', isHd: false },
      ],
    });
  }
});

// ── Cookies & Proxy Management ──
const COOKIES_FILE = path.join(__dirname, 'data', 'cookies.txt');
const PROXY_FILE = path.join(__dirname, 'data', 'proxy.txt');

app.get('/api/proxy', (_req, res) => {
  const customProxy = fs.existsSync(PROXY_FILE) ? fs.readFileSync(PROXY_FILE, 'utf8').trim() : '';
  res.json({ ok: true, customProxy });
});

app.post('/api/proxy', (req, res) => {
  try {
    const url = String(req.body.url || '').trim();
    fs.mkdirSync(path.dirname(PROXY_FILE), { recursive: true });
    if (url) {
      fs.writeFileSync(PROXY_FILE, url, 'utf8');
    } else if (fs.existsSync(PROXY_FILE)) {
      fs.unlinkSync(PROXY_FILE);
    }
    res.json({ ok: true, message: 'Custom stream proxy updated' });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/cookies', (_req, res) => {
  const hasCookies = fs.existsSync(COOKIES_FILE) && fs.statSync(COOKIES_FILE).size > 10;
  res.json({ ok: true, hasCookies });
});

app.post('/api/cookies', (req, res) => {
  try {
    const text = String(req.body.cookies || '').trim();
    if (!text) {
      return res.status(400).json({ ok: false, error: 'Empty cookies' });
    }
    fs.mkdirSync(path.dirname(COOKIES_FILE), { recursive: true });
    fs.writeFileSync(COOKIES_FILE, text, 'utf8');
    res.json({ ok: true, message: 'Cookies saved successfully' });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.delete('/api/cookies', (_req, res) => {
  try {
    if (fs.existsSync(COOKIES_FILE)) {
      fs.unlinkSync(COOKIES_FILE);
    }
    res.json({ ok: true, message: 'Cookies cleared' });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── YouTube Data APIs ──
app.get('/api/trending', async (_req, res) => {
  try {
    const videos = await yt.getTrending();
    res.json({ ok: true, videos });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message, videos: [] });
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const q = (req.query.q as string)?.trim();
    if (!q) return res.json({ ok: true, results: [], channel: null });
    const data = await yt.searchAdvanced(q, 24);
    res.json({ ok: true, results: data.results, channel: data.channel || null });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message, results: [], channel: null });
  }
});

app.get('/api/video/:id', async (req, res) => {
  try {
    const video = await yt.getVideo(req.params.id);
    res.json({ ok: true, video });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/channel/:id', async (req, res) => {
  try {
    const data = await yt.getChannel(req.params.id);
    res.json({
      ok: true,
      channel: {
        author: data.author,
        authorId: data.authorId,
        handle: data.handle,
        avatarUrl: data.avatarUrl,
        bannerUrl: data.bannerUrl,
        subCountText: data.subCountText,
        videoCountText: data.videoCountText,
        description: data.description,
        isVerified: data.isVerified,
      },
      videos: data.videos || [],
      shorts: data.shorts || [],
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Frontend integration (Vite dev or production build) ──
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ViewTube server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start ViewTube server:', err);
});
