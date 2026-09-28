import ytdl from '@distube/ytdl-core';
import NodeCache from 'node-cache';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import util from 'util';

const execFileAsync = util.promisify(execFile);
const COOKIES_PATH = path.join(process.cwd(), 'data', 'cookies.txt');
const YTDLP_BIN = path.join(process.cwd(), 'bin', 'yt-dlp');

async function extractWithYtDlp(videoId: string, quality: string): Promise<string | null> {
  const binPath = fs.existsSync(YTDLP_BIN) ? YTDLP_BIN : (fs.existsSync('/tmp/yt-dlp') ? '/tmp/yt-dlp' : null);
  if (!binPath) return null;

  const args = ['-g', '--no-warnings', '--no-check-certificates'];
  if (fs.existsSync(COOKIES_PATH) && fs.statSync(COOKIES_PATH).size > 10) {
    args.push('--cookies', COOKIES_PATH);
  }

  // Format selection
  if (quality === '1080p') {
    args.push('-f', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best');
  } else if (quality === '720p') {
    args.push('-f', '22/bestvideo[height<=720]+bestaudio/best[height<=720]/best');
  } else if (quality === '480p') {
    args.push('-f', 'bestvideo[height<=480]+bestaudio/best[height<=480]/best');
  } else if (quality === '360p') {
    args.push('-f', '18/best[height<=360]/best');
  } else {
    args.push('-f', '22/18/best');
  }
  args.push(`https://www.youtube.com/watch?v=${videoId}`);

  try {
    const { stdout } = await execFileAsync(binPath, args, { timeout: 8000 });
    const lines = stdout.trim().split('\n').map(l => l.trim()).filter(l => l.startsWith('http'));
    if (lines.length > 0) return lines[0];
  } catch {
    try {
      const fallbackArgs = ['-g', '--no-warnings', '--no-check-certificates'];
      if (fs.existsSync(COOKIES_PATH) && fs.statSync(COOKIES_PATH).size > 10) {
        fallbackArgs.push('--cookies', COOKIES_PATH);
      }
      fallbackArgs.push('-f', '18/best', `https://www.youtube.com/watch?v=${videoId}`);
      const { stdout } = await execFileAsync(binPath, fallbackArgs, { timeout: 7000 });
      const lines = stdout.trim().split('\n').map(l => l.trim()).filter(l => l.startsWith('http'));
      if (lines.length > 0) return lines[0];
    } catch {}
  }
  return null;
}

function getYtdlOptions(): any {
  if (fs.existsSync(COOKIES_PATH)) {
    try {
      const cookieStr = fs.readFileSync(COOKIES_PATH, 'utf-8');
      // If valid cookie string, can pass cookie header or agent
      return {
        requestOptions: {
          headers: {
            cookie: cookieStr.trim(),
          },
        },
      };
    } catch {}
  }
  return {};
}

const cache = new NodeCache({ stdTTL: 1800, checkperiod: 300 });
const streamInflight = new Map<string, Promise<string>>();

export interface VideoItem {
  videoId: string;
  title: string;
  author: string;
  authorId: string;
  description?: string;
  viewCount: number;
  likeCount?: number;
  subCountText?: string;
  lengthSeconds: number;
  published?: number;
  thumbnailUrl?: string;
  formats?: Array<{ format_id?: string; url?: string; ext?: string; height?: number; acodec?: string; vcodec?: string }>;
  webpage_url?: string;
}

export interface StreamQuality {
  quality: string;
  label: string;
  resolution: string;
  isHd: boolean;
}

export interface ChannelData {
  channelId: string;
  author: string;
  authorId: string;
  handle?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  subCountText?: string;
  videoCountText?: string;
  description?: string;
  isVerified?: boolean;
  videos: VideoItem[];
  shorts?: VideoItem[];
}

const INVIDIOUS_INSTANCES = [
  'https://invidious.f5.si',
  'https://invidious.nerdvpn.de',
  'https://inv.nadeko.net',
  'https://yt.chocolatemoo53.com',
  'https://invidious.tiekoetter.com',
];

let invidiousIndex = 0;
export function getInvidiousInstance(): string {
  return INVIDIOUS_INSTANCES[invidiousIndex % INVIDIOUS_INSTANCES.length];
}
export function rotateInvidious() {
  invidiousIndex = (invidiousIndex + 1) % INVIDIOUS_INSTANCES.length;
}

export async function fetchFromInvidious<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T> {
  let attempts = 0;
  while (attempts < INVIDIOUS_INSTANCES.length) {
    const base = getInvidiousInstance();
    try {
      const res = await axios.get(`${base}/api/v1${endpoint}`, {
        params,
        timeout: 4000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });
      if (res.data) return res.data as T;
    } catch {
      rotateInvidious();
    }
    attempts++;
  }
  throw new Error('All instance fallbacks unavailable');
}

/**
 * Direct YouTube Web Scraper for channels & searches (never throws ENOENT)
 */
const WEB_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

function parseViewsStr(str?: string): number {
  if (!str) return 0;
  const mult = str.match(/([KkMmBb])/i)?.[1]?.toUpperCase();
  const cleaned = str.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  if (mult === 'B') return Math.round(num * 1e9);
  if (mult === 'M') return Math.round(num * 1e6);
  if (mult === 'K') return Math.round(num * 1e3);
  return Math.round(num);
}

function formatSubs(subCount: number): string {
  if (!subCount) return '';
  if (subCount >= 1e6) return `${(subCount / 1e6).toFixed(1)}M subscribers`;
  if (subCount >= 1e3) return `${(subCount / 1e3).toFixed(1)}K subscribers`;
  return `${subCount} subscribers`;
}

function normalise(item: any): VideoItem | null {
  if (!item || (!item.videoId && !item.id)) return null;
  const id = item.videoId || item.id;
  return {
    videoId: id,
    title: item.title || '',
    author: item.author || item.authorText || '',
    authorId: item.authorId || item.ucid || '',
    description: item.description || '',
    viewCount: typeof item.viewCount === 'number' ? item.viewCount : parseViewsStr(item.viewCountText || String(item.viewCount || 0)),
    likeCount: item.likeCount || 0,
    subCountText: item.subCountText || '',
    lengthSeconds: typeof item.lengthSeconds === 'number' ? item.lengthSeconds : (item.duration ? Number(item.duration) : 0),
    published: item.published || Math.floor(Date.now() / 1000),
    thumbnailUrl: item.videoThumbnails?.slice(-1)[0]?.url || `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
  };
}

async function resolveChannelUrl(input: string): Promise<string> {
  let clean = input.trim();
  clean = clean.replace(/^https?:\/\/(www\.)?youtube\.com\//, '');
  clean = clean.replace(/\/videos$/, '').replace(/\/featured$/, '').replace(/\/$/, '');

  if (clean.startsWith('@')) {
    return `https://www.youtube.com/${clean}/videos`;
  }
  if (clean.startsWith('UC')) {
    return `https://www.youtube.com/channel/${clean}/videos`;
  }
  if (clean.startsWith('c/') || clean.startsWith('user/')) {
    return `https://www.youtube.com/${clean}/videos`;
  }

  // If query / creator name, search for channel to get canonical ID
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(clean)}&sp=EgIQAg%253D%253D`;
    const res = await axios.get(searchUrl, { headers: WEB_HEADERS, timeout: 5000 });
    const match = (res.data as string).match(/var ytInitialData = ({.*?});<\/script>/);
    if (match && match[1]) {
      const d = JSON.parse(match[1]);
      let foundId = '';
      const findCh = (obj: any) => {
        if (!obj || foundId) return;
        if (typeof obj === 'object') {
          if (obj.channelRenderer && obj.channelRenderer.channelId) {
            foundId = obj.channelRenderer.channelId;
            return;
          }
          for (const k of Object.keys(obj)) findCh(obj[k]);
        } else if (Array.isArray(obj)) {
          for (const item of obj) findCh(item);
        }
      };
      findCh(d);
      if (foundId) {
        return `https://www.youtube.com/channel/${foundId}/videos`;
      }
    }
  } catch {}

  return `https://www.youtube.com/@${clean}/videos`;
}

async function scrapeYouTubeChannel(channelInput: string): Promise<ChannelData> {
  const targetUrl = await resolveChannelUrl(channelInput);
  const res = await axios.get(targetUrl, { headers: WEB_HEADERS, timeout: 7000 });
  const html = res.data as string;

  const initialDataMatch = html.match(/var ytInitialData = ({.*?});<\/script>/);
  if (!initialDataMatch || !initialDataMatch[1]) {
    throw new Error('Unable to parse channel page');
  }

  const data = JSON.parse(initialDataMatch[1]);
  const meta = data.metadata?.channelMetadataRenderer;
  const headerVm = data.header?.pageHeaderRenderer?.content?.pageHeaderViewModel;
  const c4Header = data.header?.c4TabbedHeaderRenderer;

  const author = meta?.title
    || headerVm?.title?.dynamicTextViewModel?.text?.content
    || c4Header?.title
    || channelInput;

  const canonicalId = meta?.externalId || (channelInput.startsWith('UC') ? channelInput : '');
  
  // Handle (e.g. @JoeBartolozzi)
  let handle = '';
  const rows = headerVm?.metadata?.contentMetadataViewModel?.metadataRows;
  if (rows && rows[0]?.metadataParts?.[0]?.text?.content) {
    handle = rows[0].metadataParts[0].text.content;
  } else if (meta?.vanityChannelUrl) {
    const parts = meta.vanityChannelUrl.split('/');
    handle = parts[parts.length - 1];
  }

  // Subscriber count & video count
  let subCountText = '';
  let videoCountText = '';
  if (rows && rows[1]?.metadataParts) {
    subCountText = rows[1].metadataParts[0]?.text?.content || '';
    videoCountText = rows[1].metadataParts[1]?.text?.content || '';
  } else if (c4Header?.subscriberCountText?.simpleText) {
    subCountText = c4Header.subscriberCountText.simpleText;
  }

  // Avatar URL (high quality)
  let avatarUrl = '';
  const avatarSources = headerVm?.image?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.sources;
  if (avatarSources && avatarSources.length > 0) {
    avatarUrl = avatarSources[avatarSources.length - 1]?.url || '';
  } else if (meta?.avatar?.thumbnails && meta.avatar.thumbnails.length > 0) {
    avatarUrl = meta.avatar.thumbnails[meta.avatar.thumbnails.length - 1]?.url || '';
  }
  if (avatarUrl && avatarUrl.startsWith('//')) avatarUrl = 'https:' + avatarUrl;

  // Banner URL
  let bannerUrl = '';
  const bannerSources = headerVm?.banner?.imageBannerViewModel?.image?.sources
    || c4Header?.banner?.imageBannerRenderer?.image?.sources;
  if (bannerSources && bannerSources.length > 0) {
    bannerUrl = bannerSources[bannerSources.length - 1]?.url || '';
  }
  if (bannerUrl && bannerUrl.startsWith('//')) bannerUrl = 'https:' + bannerUrl;

  // Description
  const description = meta?.description
    || headerVm?.description?.descriptionPreviewViewModel?.description?.content
    || '';

  // Verified check
  const isVerified = JSON.stringify(data.header || {}).includes('CHECK_CIRCLE_FILLED');

  // Video items
  const vms: any[] = [];
  const findRenderers = (obj: any) => {
    if (!obj) return;
    if (typeof obj === 'object') {
      if (obj.lockupViewModel && obj.lockupViewModel.contentId) {
        vms.push({ type: 'lockup', data: obj.lockupViewModel });
      } else if (obj.videoRenderer && obj.videoRenderer.videoId) {
        vms.push({ type: 'renderer', data: obj.videoRenderer });
      }
      for (const k of Object.keys(obj)) {
        findRenderers(obj[k]);
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        findRenderers(item);
      }
    }
  };
  findRenderers(data);

  const videos: VideoItem[] = [];
  const shorts: VideoItem[] = [];
  const seenIds = new Set<string>();

  for (const entry of vms) {
    if (entry.type === 'lockup') {
      const item = entry.data;
      const id = item.contentId;
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);

      const title = item.metadata?.lockupMetadataViewModel?.title?.content || `Video ${id}`;
      
      // Duration
      let lengthSec = 0;
      const badgeText = item.contentImage?.thumbnailViewModel?.overlays?.[0]?.thumbnailBottomOverlayViewModel?.badges?.[0]?.thumbnailBadgeViewModel?.text;
      if (badgeText) {
        const parts = badgeText.split(':').map(Number);
        if (parts.length === 2) lengthSec = parts[0] * 60 + parts[1];
        else if (parts.length === 3) lengthSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
      }

      // Views
      let viewsNum = 0;
      const metaRows = item.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows;
      if (metaRows && metaRows[0]?.metadataParts) {
        const vText = metaRows[0].metadataParts[0]?.text?.content || '';
        viewsNum = parseViewsStr(vText);
      }

      const thumbSources = item.contentImage?.thumbnailViewModel?.image?.sources;
      const thumb = (thumbSources && thumbSources.length > 0)
        ? thumbSources[thumbSources.length - 1].url
        : `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

      const vItem: VideoItem = {
        videoId: id,
        title,
        author,
        authorId: canonicalId || channelInput,
        viewCount: viewsNum,
        lengthSeconds: lengthSec,
        thumbnailUrl: thumb,
        published: Math.floor(Date.now() / 1000),
      };

      if (lengthSec > 0 && lengthSec <= 60) {
        shorts.push(vItem);
      }
      videos.push(vItem);
    } else {
      const r = entry.data;
      const id = r.videoId;
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);

      const title = r.title?.runs?.[0]?.text || r.title?.simpleText || `Video ${id}`;
      const lengthSec = r.lengthText?.simpleText
        ? r.lengthText.simpleText.split(':').reduce((acc: number, time: string) => 60 * acc + +time, 0)
        : 0;

      const vItem: VideoItem = {
        videoId: id,
        title,
        author,
        authorId: canonicalId || channelInput,
        viewCount: parseViewsStr(r.viewCountText?.simpleText || ''),
        lengthSeconds: lengthSec,
        thumbnailUrl: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
        published: Math.floor(Date.now() / 1000),
      };

      if (lengthSec > 0 && lengthSec <= 60) {
        shorts.push(vItem);
      }
      videos.push(vItem);
    }
  }

  return {
    channelId: canonicalId || channelInput,
    author,
    authorId: canonicalId || channelInput,
    handle,
    avatarUrl,
    bannerUrl,
    subCountText,
    videoCountText,
    description,
    isVerified,
    videos,
    shorts,
  };
}

export interface SearchResultData {
  results: VideoItem[];
  channel?: {
    author: string;
    authorId: string;
    handle?: string;
    avatarUrl?: string;
    subCountText?: string;
    videoCountText?: string;
    description?: string;
  } | null;
}

async function scrapeYouTubeSearch(query: string, limit = 20): Promise<SearchResultData> {
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const res = await axios.get(url, { headers: WEB_HEADERS, timeout: 6000 });
    const html = res.data as string;
    const initialDataMatch = html.match(/var ytInitialData = ({.*?});<\/script>/);
    if (!initialDataMatch || !initialDataMatch[1]) return { results: [] };

    const data = JSON.parse(initialDataMatch[1]);
    const items: VideoItem[] = [];
    let foundChannel: any = null;

    const findItems = (obj: any) => {
      if (!obj) return;
      if (typeof obj === 'object') {
        if (!foundChannel && obj.channelRenderer && obj.channelRenderer.channelId) {
          const r = obj.channelRenderer;
          let av = r.thumbnail?.thumbnails?.slice(-1)[0]?.url || '';
          if (av && av.startsWith('//')) av = 'https:' + av;
          foundChannel = {
            author: r.title?.simpleText || '',
            authorId: r.channelId,
            handle: r.subscriberCountText?.simpleText || '',
            avatarUrl: av,
            subCountText: r.videoCountText?.runs?.[0]?.text
              ? `${r.subscriberCountText?.simpleText || ''} • ${r.videoCountText.runs[0].text}`
              : r.subscriberCountText?.simpleText || '',
            videoCountText: r.videoCountText?.runs?.[0]?.text || '',
            description: r.descriptionSnippet?.runs?.[0]?.text || '',
          };
        }
        if (obj.videoRenderer && obj.videoRenderer.videoId) {
          const r = obj.videoRenderer;
          const id = r.videoId;
          const title = r.title?.runs?.[0]?.text || r.title?.simpleText || '';
          const author = r.ownerText?.runs?.[0]?.text || '';
          const authorId = r.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId || '';
          const lengthSec = r.lengthText?.simpleText
            ? r.lengthText.simpleText.split(':').reduce((acc: number, time: string) => 60 * acc + +time, 0)
            : 0;
          items.push({
            videoId: id,
            title,
            author,
            authorId,
            lengthSeconds: lengthSec,
            viewCount: parseViewsStr(r.viewCountText?.simpleText || ''),
            thumbnailUrl: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
            published: Math.floor(Date.now() / 1000),
          });
        }
        for (const k of Object.keys(obj)) {
          findItems(obj[k]);
        }
      } else if (Array.isArray(obj)) {
        for (const item of obj) {
          findItems(item);
        }
      }
    };
    findItems(data);
    return { results: items.slice(0, limit), channel: foundChannel };
  } catch {
    return { results: [] };
  }
}

export async function getTrending(): Promise<VideoItem[]> {
  const key = 'trending';
  const hit = cache.get<VideoItem[]>(key);
  if (hit) return hit;

  // 1. Try Invidious first for trending (fast & rich metadata)
  try {
    const invData = await fetchFromInvidious<any[]>('/trending', { region: 'US' });
    const items = (Array.isArray(invData) ? invData : []).map(normalise).filter(Boolean) as VideoItem[];
    if (items.length > 0) {
      cache.set(key, items, 1800);
      return items;
    }
  } catch {
    // Seamless fallback to web scrape
  }

  // 2. Direct web scrape search for trending
  try {
    const scraped = await scrapeYouTubeSearch('trending videos 2026', 24);
    if (scraped.results && scraped.results.length > 0) {
      cache.set(key, scraped.results, 1800);
      return scraped.results;
    }
  } catch {}

  // Fallback curated popular list
  return [
    {
      videoId: 'DD6vmZWCuh4',
      title: 'We Played EVERY Rank In Rainbow 6 Siege..',
      author: 'Joe Bart Games',
      authorId: 'UCeBPTBz1oRnsWsUBnKNNKNw',
      lengthSeconds: 8889,
      viewCount: 1830506,
      published: Math.floor(Date.now() / 1000) - 86400 * 2,
      thumbnailUrl: 'https://i.ytimg.com/vi/DD6vmZWCuh4/mqdefault.jpg',
    },
    {
      videoId: 'WaAD5dZT-7s',
      title: 'The Best Purge Survival Method.',
      author: 'Joe Bartolozzi',
      authorId: 'UCGRryxFxjXbVAtBPE9EbyMg',
      lengthSeconds: 1303,
      viewCount: 2365473,
      published: Math.floor(Date.now() / 1000) - 86400 * 4,
      thumbnailUrl: 'https://i.ytimg.com/vi/WaAD5dZT-7s/mqdefault.jpg',
    },
    {
      videoId: 'j706EYnY9Lw',
      title: 'Yet Another You Laugh You Lose…',
      author: 'Joe Bartolozzi',
      authorId: 'https://www.youtube.com/@JoeBartolozzi',
      lengthSeconds: 980,
      viewCount: 1450200,
      published: Math.floor(Date.now() / 1000) - 86400 * 5,
      thumbnailUrl: 'https://i.ytimg.com/vi/j706EYnY9Lw/mqdefault.jpg',
    },
    {
      videoId: 'dQw4w9WgXcQ',
      title: 'Rick Astley - Never Gonna Give You Up (Official Music Video)',
      author: 'Rick Astley',
      authorId: 'UCuAXFkgsw1L7xaCfnd5JJOw',
      lengthSeconds: 213,
      viewCount: 1540000000,
      published: 1256428800,
      thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
    },
  ];
}

export async function searchAdvanced(query: string, limit = 20): Promise<SearchResultData> {
  const key = `search_adv:${query}:${limit}`;
  const hit = cache.get<SearchResultData>(key);
  if (hit) return hit;

  // 1. Direct Web Scraper (Fast, accurate, no bot blocks on search, zero ENOENT)
  try {
    const scraped = await scrapeYouTubeSearch(query, limit);
    if (scraped.results.length > 0 || scraped.channel) {
      cache.set(key, scraped, 600);
      return scraped;
    }
  } catch {}

  // 2. Piped public API search fallback
  try {
    const pipedData = await fetchFromPiped<any>('/search', { q: query, filter: 'all' });
    const rawItems = pipedData?.items || (Array.isArray(pipedData) ? pipedData : []);
    const items = rawItems
      .filter((i: any) => i.url && i.title)
      .map((i: any) => {
        const vid = i.url.replace('/watch?v=', '').split('&')[0];
        return {
          videoId: vid,
          title: i.title,
          author: i.uploaderName || 'YouTube Creator',
          authorId: i.uploaderUrl?.replace('/channel/', '') || '',
          viewCount: Number(i.views || 0),
          lengthSeconds: Number(i.duration || 0),
          thumbnailUrl: i.thumbnail || `https://i.ytimg.com/vi/${vid}/mqdefault.jpg`,
          published: Math.floor(Date.now() / 1000),
        };
      }) as VideoItem[];
    if (items.length > 0) {
      const res: SearchResultData = { results: items, channel: null };
      cache.set(key, res, 600);
      return res;
    }
  } catch {}

  // 3. Invidious search fallback
  try {
    const invData = await fetchFromInvidious<any[]>('/search', { q: query, type: 'video', page: 1 });
    const items = (Array.isArray(invData) ? invData : []).map(normalise).filter(Boolean) as VideoItem[];
    if (items.length > 0) {
      const res: SearchResultData = { results: items, channel: null };
      cache.set(key, res, 600);
      return res;
    }
  } catch {}

  return { results: [], channel: null };
}

export async function search(query: string, limit = 20): Promise<VideoItem[]> {
  const data = await searchAdvanced(query, limit);
  return data.results;
}

export async function getVideo(videoId: string): Promise<VideoItem> {
  const key = `video:${videoId}`;
  const hit = cache.get<VideoItem>(key);
  if (hit) return hit;

  // 1. Try Invidious
  try {
    const invData = await fetchFromInvidious<any>(`/videos/${videoId}`);
    const v = normalise(invData);
    if (v) {
      cache.set(key, v, 600);
      return v;
    }
  } catch {}

  // 2. Try ytdl.getBasicInfo in-process
  try {
    const info = await ytdl.getBasicInfo(videoId, getYtdlOptions());
    const details = info.videoDetails;
    if (details) {
      const item: VideoItem = {
        videoId,
        title: details.title || `Video (${videoId})`,
        author: details.author?.name || 'YouTube Creator',
        authorId: details.author?.id || '',
        description: details.description || '',
        viewCount: Number(details.viewCount || 0),
        lengthSeconds: Number(details.lengthSeconds || 0),
        thumbnailUrl: details.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        published: Math.floor(Date.now() / 1000),
      };
      cache.set(key, item, 600);
      return item;
    }
  } catch {}

  return {
    videoId,
    title: `Video (${videoId})`,
    author: 'YouTube Creator',
    authorId: '',
    lengthSeconds: 0,
    viewCount: 0,
    published: Math.floor(Date.now() / 1000),
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    description: 'Video details fetched directly through ViewTube bypass player.',
  };
}

export async function getVideoQualities(_videoId: string): Promise<StreamQuality[]> {
  return [
    { quality: '1080p', label: '1080p HD', resolution: '1920x1080', isHd: true },
    { quality: '720p', label: '720p HD (Recommended)', resolution: '1280x720', isHd: true },
    { quality: '480p', label: '480p', resolution: '854x480', isHd: false },
    { quality: '360p', label: '360p (Data Saver)', resolution: '640x360', isHd: false },
  ];
}

const CUSTOM_PROXY_PATH = path.join(process.cwd(), 'data', 'proxy.txt');

// Cobalt instances to try for stream extraction
const COBALT_INSTANCES = [
  'https://cobalt.canine.tools',
  'https://api.cobalt.tools',
];

// Piped public API instances (fallback for stream extraction, video details & searches)
const PIPED_INSTANCES = [
  'https://api.piped.private.coffee',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.smnz.de',
  'https://piped-api.hostux.net',
  'https://pipedapi.drgns.space',
];

let pipedIndex = 0;
export function getPipedInstance(): string {
  return PIPED_INSTANCES[pipedIndex % PIPED_INSTANCES.length];
}
export function rotatePiped() {
  pipedIndex = (pipedIndex + 1) % PIPED_INSTANCES.length;
}

export async function fetchFromPiped<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T> {
  let attempts = 0;
  while (attempts < PIPED_INSTANCES.length) {
    const base = getPipedInstance();
    try {
      const res = await axios.get(`${base}${endpoint}`, {
        params,
        timeout: 4000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });
      if (res.data) return res.data as T;
    } catch {
      rotatePiped();
    }
    attempts++;
  }
  throw new Error('All Piped instance fallbacks unavailable');
}

export async function fetchPipedStream(videoId: string, quality: string): Promise<string | null> {
  let attempts = 0;
  while (attempts < PIPED_INSTANCES.length) {
    const base = getPipedInstance();
    try {
      const res = await axios.get(`${base}/streams/${videoId}`, {
        timeout: 4500,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });
      const data = res.data;
      if (data) {
        const videoStreams = data.videoStreams || [];
        // First look for combined audio+video or requested quality
        if (quality === '1080p') {
          const s1080 = videoStreams.find((s: any) => s.url && s.quality === '1080p' && !s.videoOnly)
            || videoStreams.find((s: any) => s.url && s.quality === '1080p');
          if (s1080?.url) return s1080.url;
        }
        if (quality === '720p' || quality === 'auto' || quality === '1080p') {
          const s720 = videoStreams.find((s: any) => s.url && s.quality === '720p' && !s.videoOnly)
            || videoStreams.find((s: any) => s.url && s.quality === '720p');
          if (s720?.url) return s720.url;
        }
        // Default / 480p / 360p
        const sMuxed = videoStreams.find((s: any) => s.url && !s.videoOnly)
          || videoStreams.find((s: any) => s.url);
        if (sMuxed?.url) return sMuxed.url;
      }
    } catch {
      rotatePiped();
    }
    attempts++;
  }
  return null;
}

export async function fetchCobaltStream(videoId: string, quality: string): Promise<string | null> {
  const normQuality = quality.toLowerCase().trim();
  const vQuality = normQuality === '1080p' ? '1080' : normQuality === '720p' ? '720' : normQuality === '480p' ? '480' : '360';
  const targetUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // If user configured a custom upstream proxy/cobalt instance URL
  let customUrl = '';
  if (fs.existsSync(CUSTOM_PROXY_PATH)) {
    try {
      customUrl = fs.readFileSync(CUSTOM_PROXY_PATH, 'utf-8').trim();
    } catch {}
  }

  const instances = customUrl ? [customUrl, ...COBALT_INSTANCES] : COBALT_INSTANCES;

  for (const instance of instances) {
    try {
      const cleanBase = instance.replace(/\/+$/, '');
      const ep = cleanBase.endsWith('/api/json') ? cleanBase : cleanBase;
      
      const payload: any = {
        url: targetUrl,
        videoQuality: vQuality,
        audioFormat: 'mp3',
        downloadMode: 'auto',
      };

      const res = await axios.post(ep, payload, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
        timeout: 6000,
      });

      const data = res.data;
      if (data && (data.url || data.status === 'tunnel' || data.status === 'redirect')) {
        const streamUrl = data.url || data.stream;
        if (streamUrl && typeof streamUrl === 'string' && streamUrl.startsWith('http')) {
          return streamUrl;
        }
      }
    } catch {
      // Try next instance
    }
  }

  return null;
}

/**
 * High-Quality Stream URL Extractor
 * Selects 720p HD / 1080p HD by default, or specific quality requested.
 */
export async function getStreamUrl(videoId: string, quality = 'auto'): Promise<string> {
  const normQuality = quality.toLowerCase().trim();
  const cacheKey = `stream:${videoId}:${normQuality}`;
  const hit = cache.get<string>(cacheKey);
  if (hit) return hit;

  if (streamInflight.has(cacheKey)) return streamInflight.get(cacheKey)!;

  const request = (async () => {
    try {
      // 1. Try yt-dlp binary (with cookies if available)
      try {
        const ytdlpUrl = await extractWithYtDlp(videoId, normQuality);
        if (ytdlpUrl) {
          cache.set(cacheKey, ytdlpUrl, 300);
          return ytdlpUrl;
        }
      } catch {}

      // 2. Try Cobalt stream extraction
      try {
        const cobaltUrl = await fetchCobaltStream(videoId, normQuality);
        if (cobaltUrl) {
          cache.set(cacheKey, cobaltUrl, 300);
          return cobaltUrl;
        }
      } catch {}

      // 3. Try Piped public API stream extraction
      try {
        const pipedUrl = await fetchPipedStream(videoId, normQuality);
        if (pipedUrl) {
          cache.set(cacheKey, pipedUrl, 300);
          return pipedUrl;
        }
      } catch {}

      // 3. Try Invidious formatStreams / adaptiveFormats
      try {
        const invData = await fetchFromInvidious<any>(`/videos/${videoId}`);
        const fStreams = invData?.formatStreams || [];
        const aFormats = invData?.adaptiveFormats || [];

        // Quality selection logic:
        if (normQuality === '1080p') {
          const f1080 = aFormats.find((f: any) => f.url && (f.qualityLabel === '1080p' || f.resolution === '1080p') && f.type?.includes('mp4'));
          if (f1080?.url) {
            cache.set(cacheKey, f1080.url, 240);
            return f1080.url;
          }
        }

        if (normQuality === '720p' || normQuality === 'auto' || normQuality === '1080p') {
          const f720 = fStreams.find((f: any) => f.url && (f.qualityLabel === '720p' || f.resolution === '720p') && f.container === 'mp4');
          if (f720?.url) {
            cache.set(cacheKey, f720.url, 240);
            return f720.url;
          }
        }

        if (normQuality === '480p') {
          const f480 = aFormats.find((f: any) => f.url && (f.qualityLabel === '480p' || f.resolution === '480p') && f.type?.includes('mp4'));
          if (f480?.url) {
            cache.set(cacheKey, f480.url, 240);
            return f480.url;
          }
        }

        if (normQuality === '360p' || normQuality === 'saver') {
          const f360 = fStreams.find((f: any) => f.url && (f.qualityLabel === '360p' || f.resolution === '360p') && f.container === 'mp4');
          if (f360?.url) {
            cache.set(cacheKey, f360.url, 240);
            return f360.url;
          }
        }

        const anyFStream = fStreams.find((f: any) => f.url && f.container === 'mp4');
        if (anyFStream?.url) {
          cache.set(cacheKey, anyFStream.url, 240);
          return anyFStream.url;
        }

        const anyAdaptive = aFormats.find((f: any) => f.url && f.type?.includes('video/mp4'));
        if (anyAdaptive?.url) {
          cache.set(cacheKey, anyAdaptive.url, 240);
          return anyAdaptive.url;
        }
      } catch {
        // Fallback to pure in-process @distube/ytdl-core
      }

      // 3. Try @distube/ytdl-core in-process extractor (no binary, no ENOENT)
      try {
        const info = await ytdl.getInfo(videoId, getYtdlOptions());
        const formats = info.formats || [];

        if (normQuality === '1080p') {
          const f1080 = formats.find(f => f.url && f.qualityLabel === '1080p' && f.hasVideo);
          if (f1080?.url) {
            cache.set(cacheKey, f1080.url, 240);
            return f1080.url;
          }
        }

        if (normQuality === '720p' || normQuality === 'auto' || normQuality === '1080p') {
          const f720 = formats.find(f => f.url && f.hasVideo && f.hasAudio && (f.qualityLabel === '720p' || f.itag === 22));
          if (f720?.url) {
            cache.set(cacheKey, f720.url, 240);
            return f720.url;
          }
        }

        // Standard pre-muxed format 18 (360p audio+video) or any combined stream
        const combined = ytdl.chooseFormat(formats, { quality: '18' }) || ytdl.chooseFormat(formats, { filter: 'audioandvideo' });
        if (combined?.url) {
          cache.set(cacheKey, combined.url, 240);
          return combined.url;
        }
      } catch (err: any) {
        // In-memory ytdl fallback failed
      }

      throw new Error('Unable to extract playable stream URL.');
    } finally {
      streamInflight.delete(cacheKey);
    }
  })();

  streamInflight.set(cacheKey, request);
  return request;
}

export async function getChannel(channelId: string): Promise<ChannelData> {
  const key = `channel:${channelId}`;
  const hit = cache.get<ChannelData>(key);
  if (hit) return hit;

  // 1. Direct YouTube Web Scraper (Fast, reliable, zero ENOENT errors)
  try {
    const scraped = await scrapeYouTubeChannel(channelId);
    if (scraped && scraped.videos && scraped.videos.length > 0) {
      cache.set(key, scraped, 600);
      return scraped;
    }
  } catch (err: any) {
    // Continue to Invidious fallback
  }

  // 2. Invidious channel fallback
  try {
    const invChannel = await fetchFromInvidious<any>(`/channels/${channelId}`);
    const videos = (invChannel?.latestVideos || []).map(normalise).filter(Boolean) as VideoItem[];
    const result: ChannelData = {
      channelId,
      author: invChannel?.author || channelId,
      authorId: channelId,
      subCountText: invChannel?.subCount ? formatSubs(invChannel.subCount) : '',
      description: invChannel?.description || '',
      avatarUrl: invChannel?.authorThumbnails?.slice(-1)[0]?.url || '',
      bannerUrl: invChannel?.authorBanners?.slice(-1)[0]?.url || '',
      videos,
      shorts: videos.filter((v: VideoItem) => v.lengthSeconds > 0 && v.lengthSeconds <= 60),
    };
    cache.set(key, result, 600);
    return result;
  } catch {
    // Fallback to default
  }

  return {
    channelId,
    author: channelId,
    authorId: channelId,
    videos: [],
    shorts: [],
  };
}
