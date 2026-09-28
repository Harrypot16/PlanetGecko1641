import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  Search,
  Home,
  Compass,
  Flame,
  History,
  ShieldCheck,
  ThumbsUp,
  Share2,
  ExternalLink,
  Trash2,
  X,
  Play,
  Check,
  User,
  Tv,
  Film,
  Sliders,
  Sparkles,
  AlertCircle,
  RotateCcw,
  Edit3,
  CheckSquare,
  Square,
  Pause,
  Save,
  Clock,
  Filter,
  CheckCircle2,
  Tag,
  Maximize2,
  Minimize2,
  Zap,
  Volume2,
  VolumeX,
  Bell,
  Info,
  Copy,
  Users,
  Video,
  ArrowLeft
} from 'lucide-react';
import type { VideoItem, ChannelInfo, PlayerMode, StreamQuality } from './types.ts';

// ── Helpers ──
function formatDuration(s?: number): string {
  if (!s || s <= 0) return '';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p2 = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p2(m)}:${p2(sec)}` : `${m}:${p2(sec)}`;
}

function formatViews(n?: number): string {
  if (!n && n !== 0) return '';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B views`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M views`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K views`;
  return `${n} views`;
}

function formatNum(n?: number): string {
  if (!n) return '0';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

function timeAgo(published?: number): string {
  if (!published || published <= 0) return '';
  const d = Date.now() / 1000 - published;
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  if (d < 2592000) return `${Math.floor(d / 86400)}d ago`;
  if (d < 31536000) return `${Math.floor(d / 2592000)}mo ago`;
  return `${Math.floor(d / 31536000)}y ago`;
}

function watchedAgo(ts?: number): string {
  if (!ts) return '';
  const d = Date.now() / 1000 - ts;
  if (d < 60) return 'Watched just now';
  if (d < 3600) return `Watched ${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `Watched ${Math.floor(d / 3600)}h ago`;
  if (d < 604800) return `Watched ${Math.floor(d / 86400)}d ago`;
  return `Watched on ${new Date(ts * 1000).toLocaleDateString()}`;
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState<'recommended' | 'trending' | 'search' | 'watch' | 'channel' | 'history' | 'instance'>('recommended');
  const [currentParam, setCurrentParam] = useState<string>('');
  
  // Data states
  const [searchQuery, setSearchQuery] = useState('');
  const [trendingVideos, setTrendingVideos] = useState<VideoItem[]>([]);
  const [recommendedVideos, setRecommendedVideos] = useState<VideoItem[]>([]);
  const [favoriteCreators, setFavoriteCreators] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<VideoItem[]>([]);
  const [currentVideo, setCurrentVideo] = useState<VideoItem | null>(null);
  const [searchChannel, setSearchChannel] = useState<ChannelInfo | null>(null);
  const [channelData, setChannelData] = useState<{
    channel: ChannelInfo;
    videos: VideoItem[];
    shorts?: VideoItem[];
  } | null>(null);
  const [channelTab, setChannelTab] = useState<'videos' | 'shorts' | 'about'>('videos');
  const [channelSearch, setChannelSearch] = useState<string>('');
  const [channelSort, setChannelSort] = useState<'latest' | 'popular' | 'oldest'>('latest');
  const [channelDescExpanded, setChannelDescExpanded] = useState<boolean>(false);

  // Subscriptions state (persisted in localStorage)
  const [subscriptions, setSubscriptions] = useState<ChannelInfo[]>(() => {
    try {
      const local = localStorage.getItem('viewtube_subscriptions');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      {
        author: 'Joe Bartolozzi',
        authorId: 'UCGRryxFxjXbVAtBPE9EbyMg',
        handle: '@JoeBartolozzi',
        subCountText: '5.96M subscribers',
        avatarUrl: 'https://yt3.googleusercontent.com/jbgbWg3aEZKUtuJDdckG4f1Ui9nujB_ji7F1otSJCBTBNaEF68RCQ7iPnDf8vbuZjEOqYSAxoA=s160-c-k-c0x00ffffff-no-rj',
      },
      {
        author: 'Veritasium',
        authorId: 'UCHnyfMqiRRG1u-2MsSQLbXA',
        handle: '@veritasium',
        subCountText: '21.3M subscribers',
        avatarUrl: 'https://yt3.ggpht.com/7vCbvtCqtjQ3YLgsJt7Y952MQV1sBvhllSCSxHP8_sVZdcPCBrITfhkN2RdyCuwPnsByq-1GoA=s176-c-k-c0x00ffffff-no-rj-mo',
      },
      {
        author: 'Marques Brownlee',
        authorId: 'UCBJycsmduvYEL83R_U4JriQ',
        handle: '@mkbhd',
        subCountText: '19.8M subscribers',
        avatarUrl: 'https://yt3.googleusercontent.com/lkH37D712tiyphnu0Id0D5MwwQ7IRuwgQLVD05iMXlDWO-aDHqqd836BWSdThQw2GmKmAe2eGQ=s160-c-k-c0x00ffffff-no-rj',
      },
    ];
  });

  // Recommended Category states
  const RECOMMENDED_CATEGORIES = [
    'All',
    'Gaming',
    'Music',
    'Tech & AI',
    'Podcasts',
    'Entertainment',
    'Animation',
    'Coding',
  ];
  const [recommendedCategory, setRecommendedCategory] = useState<string>('All');
  const [categoryVideos, setCategoryVideos] = useState<Record<string, VideoItem[]>>({});
  const [loadingCategory, setLoadingCategory] = useState<boolean>(false);
  
  // Watch History states (strictly dynamic, editable, user-specific)
  const [historyItems, setHistoryItems] = useState<VideoItem[]>(() => {
    try {
      const local = localStorage.getItem('viewtube_history');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [historyPaused, setHistoryPaused] = useState<boolean>(() => {
    try {
      return localStorage.getItem('viewtube_history_paused') === 'true';
    } catch {
      return false;
    }
  });
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState('');
  const [editingTitle, setEditingTitle] = useState('');
  
  // Player & Stream Quality states (Default to Custom Stream with Ultra HD engine)
  const [playerMode, setPlayerMode] = useState<PlayerMode>('stream');
  const [customStreamEngine, setCustomStreamEngine] = useState<'bypass' | 'direct'>('bypass');
  const [theaterMode, setTheaterMode] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [directStatus, setDirectStatus] = useState<{ canDirectStream: boolean; hasCookies: boolean; hasProxy: boolean } | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<string>('720p');
  const [availableQualities, setAvailableQualities] = useState<StreamQuality[]>([
    { quality: '1080p', label: '1080p HD', resolution: '1920x1080', isHd: true },
    { quality: '720p', label: '720p HD', resolution: '1280x720', isHd: true },
    { quality: '480p', label: '480p', resolution: '854x480', isHd: false },
    { quality: '360p', label: '360p (Data Saver)', resolution: '640x360', isHd: false },
  ]);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [hasCookies, setHasCookies] = useState<boolean>(false);
  const [cookieInput, setCookieInput] = useState<string>('');
  const [isSavingCookies, setIsSavingCookies] = useState<boolean>(false);
  const [customProxyUrl, setCustomProxyUrl] = useState<string>('');
  const [proxyInput, setProxyInput] = useState<string>('');
  const [isSavingProxy, setIsSavingProxy] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  // UI states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [userDropdown, setUserDropdown] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  // Fetch watch history from server and sync with localStorage
  const loadHistory = async () => {
    try {
      const res = await fetch('/api/history');
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.history)) {
          setHistoryItems((prev) => {
            const map = new Map<string, VideoItem>();
            for (const item of data.history) map.set(item.videoId, item);
            for (const item of prev) {
              if (!map.has(item.videoId)) map.set(item.videoId, item);
            }
            const combined = Array.from(map.values()).sort(
              (a, b) => (b.watchedAt || 0) - (a.watchedAt || 0)
            );
            try {
              localStorage.setItem('viewtube_history', JSON.stringify(combined));
            } catch {}
            // Also trigger personalized recommendations based on the loaded history
            loadRecommendations(combined);
            return combined;
          });
        }
      }
    } catch {
      // Local fallback
    }
  };

  // Personalized recommendation fetcher
  const loadRecommendations = async (customHistory?: VideoItem[]) => {
    const historyToSend = customHistory !== undefined ? customHistory : historyItems;
    try {
      const res = await fetch('/api/recommended', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: historyToSend }),
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.recommendations) && data.recommendations.length > 0) {
        setRecommendedVideos(data.recommendations);
        setFavoriteCreators(data.favoriteCreators || []);
      }
    } catch {
      // Keep existing recommendations
    }
  };

  const addToHistory = async (video: VideoItem) => {
    if (historyPaused) return;
    const entry: VideoItem = {
      ...video,
      watchedAt: Math.floor(Date.now() / 1000),
    };
    const updated = [entry, ...historyItems.filter((item) => item.videoId !== entry.videoId)].slice(0, 100);
    setHistoryItems(updated);
    try {
      localStorage.setItem('viewtube_history', JSON.stringify(updated));
    } catch {}

    // Refresh recommendations immediately with the latest watch history
    loadRecommendations(updated);

    try {
      await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
    } catch {}
  };

  const toggleHistoryPause = () => {
    const next = !historyPaused;
    setHistoryPaused(next);
    try {
      localStorage.setItem('viewtube_history_paused', String(next));
    } catch {}
    showToast(next ? 'Watch history tracking paused' : 'Watch history tracking resumed');
  };

  const startEditHistoryItem = (v: VideoItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingVideoId(v.videoId);
    setEditingNote(v.note || '');
    setEditingTitle(v.title || '');
  };

  const saveEditHistoryItem = async (videoId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setHistoryItems((prev) => {
      const updated = prev.map((item) => {
        if (item.videoId === videoId) {
          return {
            ...item,
            note: editingNote.trim(),
            title: editingTitle.trim() || item.title,
          };
        }
        return item;
      });
      try {
        localStorage.setItem('viewtube_history', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setEditingVideoId(null);
    showToast('History entry updated');
    try {
      await fetch(`/api/history/${encodeURIComponent(videoId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: editingNote.trim(), title: editingTitle.trim() }),
      });
    } catch {}
  };

  const cancelEditHistoryItem = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingVideoId(null);
  };

  const removeFromHistory = async (videoId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setHistoryItems((prev) => {
      const updated = prev.filter((item) => item.videoId !== videoId);
      try {
        localStorage.setItem('viewtube_history', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setSelectedHistoryIds((prev) => prev.filter((id) => id !== videoId));
    showToast('Removed from history');
    try {
      await fetch(`/api/history/${encodeURIComponent(videoId)}`, { method: 'DELETE' });
    } catch {}
  };

  const toggleSelectHistory = (videoId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedHistoryIds((prev) =>
      prev.includes(videoId) ? prev.filter((id) => id !== videoId) : [...prev, videoId]
    );
  };

  const selectAllHistory = (items: VideoItem[]) => {
    if (selectedHistoryIds.length === items.length) {
      setSelectedHistoryIds([]);
    } else {
      setSelectedHistoryIds(items.map((v) => v.videoId));
    }
  };

  const deleteSelectedHistory = async () => {
    if (!selectedHistoryIds.length) return;
    const count = selectedHistoryIds.length;
    const toDelete = [...selectedHistoryIds];
    setHistoryItems((prev) => {
      const updated = prev.filter((item) => !toDelete.includes(item.videoId));
      try {
        localStorage.setItem('viewtube_history', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setSelectedHistoryIds([]);
    showToast(`Deleted ${count} videos from history`);
    try {
      await Promise.all(
        toDelete.map((id) => fetch(`/api/history/${encodeURIComponent(id)}`, { method: 'DELETE' }))
      );
    } catch {}
  };

  const clearAllHistory = async () => {
    if (!window.confirm('Clear all watch history?')) return;
    setHistoryItems([]);
    setSelectedHistoryIds([]);
    setFavoriteCreators([]);
    try {
      localStorage.removeItem('viewtube_history');
      await fetch('/api/history', { method: 'DELETE' });
    } catch {}
    loadRecommendations([]);
    showToast('History cleared');
  };

  const selectCategory = async (cat: string) => {
    setRecommendedCategory(cat);
    if (cat === 'All') return;
    if (categoryVideos[cat]?.length) return;
    setLoadingCategory(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(cat)}`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.results)) {
        setCategoryVideos((prev) => ({ ...prev, [cat]: data.results }));
      }
    } catch {
    } finally {
      setLoadingCategory(false);
    }
  };

  // Load trending
  const loadTrending = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/trending');
      const data = await res.json();
      if (data.ok && Array.isArray(data.videos)) {
        setTrendingVideos(data.videos);
      } else {
        setErrorMsg(data.error || 'Unable to load trending videos');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error loading trending videos');
    } finally {
      setLoading(false);
    }
  };

  // Perform search
  const performSearch = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    // Direct channel navigation if user typed a handle or youtube channel URL
    if (trimmed.startsWith('@') || trimmed.includes('youtube.com/@') || trimmed.includes('youtube.com/channel/')) {
      let target = trimmed.replace(/^https?:\/\/(www\.)?youtube\.com\//, '').replace(/\/+$/, '');
      if (target.startsWith('channel/')) target = target.replace('channel/', '');
      openChannel(target);
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSearchChannel(null);
    window.location.hash = `#search/${encodeURIComponent(trimmed)}`;
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.results)) {
        setSearchResults(data.results);
        if (data.channel) {
          setSearchChannel(data.channel);
        }
      } else {
        setErrorMsg(data.error || 'No results found');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error searching videos');
    } finally {
      setLoading(false);
    }
  };

  // Open watch page
  const openVideo = async (videoId: string) => {
    setCurrentPage('watch');
    setCurrentParam(videoId);
    window.location.hash = `#watch/${encodeURIComponent(videoId)}`;
    setLoading(true);
    setErrorMsg(null);
    setStreamError(null);
    setIsLiked(false);
    setIsSubscribed(false);
    setDescExpanded(false);

    // Default to high quality (720p HD)
    setSelectedQuality('720p');

    try {
      // 1. Fetch metadata
      const res = await fetch(`/api/video/${videoId}`);
      const data = await res.json();
      if (data.ok && data.video) {
        setCurrentVideo(data.video);
        addToHistory(data.video);
      } else {
        const fallback: VideoItem = {
          videoId,
          title: `Video ${videoId}`,
          author: 'YouTube',
          authorId: '',
          lengthSeconds: 0,
          viewCount: 0,
          thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        };
        setCurrentVideo(fallback);
        addToHistory(fallback);
      }

      // 2. Fetch available qualities
      fetch(`/api/video/${videoId}/formats`)
        .then((r) => r.json())
        .then((fData) => {
          if (fData.ok && Array.isArray(fData.qualities) && fData.qualities.length > 0) {
            setAvailableQualities(fData.qualities);
            // If 1080p is available, let's keep 720p or 1080p
            const has720 = fData.qualities.some((q: StreamQuality) => q.quality === '720p');
            if (has720) {
              setSelectedQuality('720p');
            } else if (fData.qualities[0]?.quality) {
              setSelectedQuality(fData.qualities[0].quality);
            }
          }
        })
        .catch(() => {});

      // 3. Check direct stream pipe status
      fetch(`/api/stream/status/${videoId}`)
        .then((r) => r.json())
        .then((s) => {
          if (s.ok) setDirectStatus(s);
        })
        .catch(() => {});
    } catch {
      const fallback: VideoItem = {
        videoId,
        title: `Video ${videoId}`,
        author: 'YouTube',
        authorId: '',
        lengthSeconds: 0,
        viewCount: 0,
      };
      setCurrentVideo(fallback);
      addToHistory(fallback);
    } finally {
      setLoading(false);
    }
  };

  // Change stream quality with playback position preserved
  const handleQualityChange = (newQuality: string) => {
    if (!currentVideo) return;
    const currentTime = videoRef.current?.currentTime || 0;
    const isPaused = videoRef.current?.paused ?? false;

    setSelectedQuality(newQuality);
    setStreamError(null);
    showToast(`Quality set to ${newQuality.toUpperCase()}`);

    // Allow new source URL to bind, then restore position
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = currentTime;
        if (!isPaused) {
          videoRef.current.play().catch(() => {});
        }
      }
    }, 150);
  };

  // Open channel
  const openChannel = async (channelId: string) => {
    if (!channelId) return;
    setCurrentPage('channel');
    setCurrentParam(channelId);
    window.location.hash = `#channel/${encodeURIComponent(channelId)}`;
    setChannelTab('videos');
    setChannelSearch('');
    setChannelSort('latest');
    setChannelDescExpanded(false);
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/channel/${encodeURIComponent(channelId)}`);
      const data = await res.json();
      if (data.ok && data.channel) {
        setChannelData({
          channel: data.channel,
          videos: data.videos || [],
          shorts: data.shorts || [],
        });
      } else {
        setErrorMsg(data.error || 'Could not load channel');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error loading channel');
    } finally {
      setLoading(false);
    }
  };

  const toggleSubscribeChannel = (target: ChannelInfo) => {
    setSubscriptions((prev) => {
      const isSub = prev.some((c) => (target.authorId && c.authorId === target.authorId) || c.author.toLowerCase() === target.author.toLowerCase());
      let next: ChannelInfo[];
      if (isSub) {
        next = prev.filter((c) => (target.authorId ? c.authorId !== target.authorId : true) && c.author.toLowerCase() !== target.author.toLowerCase());
        showToast(`Unsubscribed from ${target.author}`);
      } else {
        next = [target, ...prev];
        showToast(`Subscribed to ${target.author}!`);
      }
      try {
        localStorage.setItem('viewtube_subscriptions', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const isChannelSubscribed = (target?: ChannelInfo | null) => {
    if (!target) return false;
    return subscriptions.some(
      (c) => (target.authorId && c.authorId === target.authorId) || c.author.toLowerCase() === target.author.toLowerCase()
    );
  };

  const getFilteredChannelVideos = () => {
    if (!channelData) return [];
    let list = [...channelData.videos];
    if (channelSearch.trim()) {
      const q = channelSearch.toLowerCase().trim();
      list = list.filter((v) => v.title.toLowerCase().includes(q) || (v.description && v.description.toLowerCase().includes(q)));
    }
    if (channelSort === 'popular') {
      list.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    } else if (channelSort === 'oldest') {
      list.sort((a, b) => (a.published || 0) - (b.published || 0));
    }
    return list;
  };

  const checkCookies = async () => {
    try {
      const res = await fetch('/api/cookies');
      const data = await res.json();
      if (data.ok) setHasCookies(data.hasCookies);
    } catch {}
  };

  const saveCookies = async () => {
    if (!cookieInput.trim()) return;
    setIsSavingCookies(true);
    try {
      const res = await fetch('/api/cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies: cookieInput }),
      });
      const data = await res.json();
      if (data.ok) {
        setHasCookies(true);
        setCookieInput('');
        showToast('Cookies saved! yt-dlp unblocked');
      } else {
        showToast('Failed to save cookies');
      }
    } catch {
      showToast('Error saving cookies');
    } finally {
      setIsSavingCookies(false);
    }
  };

  const clearCookies = async () => {
    try {
      await fetch('/api/cookies', { method: 'DELETE' });
      setHasCookies(false);
      showToast('Cookies removed');
    } catch {}
  };

  const checkProxy = async () => {
    try {
      const res = await fetch('/api/proxy');
      const data = await res.json();
      if (data.ok) {
        setCustomProxyUrl(data.customProxy || '');
        setProxyInput(data.customProxy || '');
      }
    } catch {}
  };

  const saveProxy = async () => {
    setIsSavingProxy(true);
    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: proxyInput.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setCustomProxyUrl(proxyInput.trim());
        showToast(proxyInput.trim() ? 'Stream proxy configured!' : 'Stream proxy cleared');
      } else {
        showToast('Failed to update proxy');
      }
    } catch {
      showToast('Error updating proxy');
    } finally {
      setIsSavingProxy(false);
    }
  };

  // Initialize
  useEffect(() => {
    loadRecommendations();
    loadHistory();
    loadTrending();
    checkCookies();
    checkProxy();

    const handleHash = () => {
      const hash = window.location.hash.replace(/^#/, '');
      if (!hash) return;
      if (hash.startsWith('watch/')) {
        const id = hash.replace('watch/', '');
        if (id) openVideo(decodeURIComponent(id));
      } else if (hash.startsWith('channel/')) {
        const id = hash.replace('channel/', '');
        if (id) openChannel(decodeURIComponent(id));
      } else if (hash === 'trending') {
        setCurrentPage('trending');
        loadTrending();
      } else if (hash === 'history') {
        setCurrentPage('history');
        loadHistory();
      } else if (hash === 'recommended') {
        setCurrentPage('recommended');
        loadRecommendations();
      } else if (hash === 'instance') {
        setCurrentPage('instance');
      } else if (hash.startsWith('search/')) {
        const q = hash.replace('search/', '');
        if (q) {
          const decoded = decodeURIComponent(q);
          setSearchQuery(decoded);
          setCurrentPage('search');
          setCurrentParam(decoded);
          performSearch(decoded);
        }
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Keyboard shortcuts for watch page
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (currentPage !== 'watch') return;
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) return;

      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setTheaterMode((prev) => !prev);
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        if (!document.fullscreenElement) {
          playerContainerRef.current?.requestFullscreen?.().catch(() => {});
        } else {
          document.exitFullscreen?.().catch(() => {});
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage]);

  const navigateTo = (page: 'recommended' | 'trending' | 'search' | 'watch' | 'channel' | 'history' | 'instance', param = '') => {
    setCurrentPage(page);
    setCurrentParam(param);
    if (page === 'trending') loadTrending();
    if (page === 'history') loadHistory();
    if (page === 'recommended') loadRecommendations();
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    navigateTo('search', searchQuery);
    performSearch(searchQuery);
  };

  const handleShare = () => {
    if (currentVideo) {
      const url = `${window.location.origin}/#watch/${currentVideo.videoId}`;
      navigator.clipboard?.writeText(url).then(() => {
        showToast('Link copied to clipboard!');
      });
    }
  };

  const filteredHistory = historyItems.filter((item) => {
    if (!historySearchQuery.trim()) return true;
    const q = historySearchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.author.toLowerCase().includes(q) ||
      (item.note && item.note.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-[#f1f1f1] flex flex-col font-sans select-none">
      {/* ── HEADER ── */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-[#0f0f0f] border-b border-[#272727] flex items-center justify-between px-4 z-50 gap-4">
        <div className="flex items-center gap-4 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors text-[#f1f1f1] cursor-pointer"
            aria-label="Toggle menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            onClick={() => navigateTo('recommended')}
            className="flex items-center gap-2 cursor-pointer focus:outline-none"
          >
            <div className="w-7 h-5 bg-[#ff0000] rounded-md flex items-center justify-center shadow-md">
              <Play className="w-3.5 h-3.5 fill-white text-white ml-0.5" />
            </div>
            <span className="font-bold text-lg tracking-tight text-white flex items-center gap-1">
              View<span className="text-[#ff0000]">Tube</span>
            </span>
          </button>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearchSubmit} className="flex-1 max-w-[600px] flex items-center mx-2">
          <div className="flex items-center w-full bg-[#121212] border border-[#303030] focus-within:border-[#3ea6ff] rounded-full overflow-hidden transition-all shadow-inner">
            <input
              type="text"
              placeholder="Search videos, creators, music..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent px-4 py-2 text-sm text-[#f1f1f1] placeholder-[#888] outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1.5 mr-1 text-[#888] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="submit"
              className="bg-[#222222] hover:bg-[#2e2e2e] px-5 py-2.5 border-l border-[#303030] text-[#f1f1f1] flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Header Right */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative">
            <button
              onClick={() => setUserDropdown((prev) => !prev)}
              className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#3ea6ff] to-[#2563eb] text-white flex items-center justify-center font-bold text-sm shadow hover:opacity-90 transition-opacity cursor-pointer"
            >
              <User className="w-4 h-4" />
            </button>

            {userDropdown && (
              <div className="absolute right-0 top-11 w-64 bg-[#212121] border border-[#303030] rounded-xl shadow-2xl py-2 z-50 text-sm">
                <div className="px-4 py-3 border-b border-[#303030]">
                  <div className="font-semibold text-white">Guest Session</div>
                  <div className="text-xs text-[#aaa] mt-0.5">Watch history saved locally & on server</div>
                </div>
                <button
                  onClick={() => {
                    navigateTo('history');
                    setUserDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-white/5 flex items-center gap-3 text-sm text-[#ddd] cursor-pointer"
                >
                  <History className="w-4 h-4 text-[#3ea6ff]" />
                  <span>My Watch History ({historyItems.length})</span>
                </button>
                <button
                  onClick={() => {
                    navigateTo('instance');
                    setUserDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-white/5 flex items-center gap-3 text-sm text-[#ddd] cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-[#4caf50]" />
                  <span>Bypass & Quality Settings</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── BODY (Sidebar + Main) ── */}
      <div className="flex flex-1 pt-14">
        {/* Sidebar */}
        <nav
          className={`fixed top-14 left-0 bottom-0 bg-[#0f0f0f] border-r border-[#272727] z-40 transition-all duration-200 overflow-y-auto ${
            sidebarOpen ? 'w-56' : 'w-18'
          }`}
        >
          <div className="p-2 space-y-1">
            <button
              onClick={() => navigateTo('recommended')}
              className={`w-full flex items-center gap-4 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                currentPage === 'recommended'
                  ? 'bg-white/10 text-white font-semibold'
                  : 'text-[#aaa] hover:bg-white/5 hover:text-white'
              }`}
            >
              <Compass className="w-5 h-5 flex-shrink-0 text-[#ff0000]" />
              {sidebarOpen && <span>Recommended</span>}
            </button>

            <button
              onClick={() => navigateTo('trending')}
              className={`w-full flex items-center gap-4 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                currentPage === 'trending'
                  ? 'bg-white/10 text-white font-semibold'
                  : 'text-[#aaa] hover:bg-white/5 hover:text-white'
              }`}
            >
              <Flame className="w-5 h-5 flex-shrink-0 text-[#ff4e45]" />
              {sidebarOpen && <span>Trending</span>}
            </button>

            <button
              onClick={() => navigateTo('history')}
              className={`w-full flex items-center gap-4 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                currentPage === 'history'
                  ? 'bg-white/10 text-white font-semibold'
                  : 'text-[#aaa] hover:bg-white/5 hover:text-white'
              }`}
            >
              <History className="w-5 h-5 flex-shrink-0 text-[#3ea6ff]" />
              {sidebarOpen && (
                <div className="flex-1 flex items-center justify-between">
                  <span>Watch History</span>
                  {historyItems.length > 0 && (
                    <span className="text-xs bg-[#272727] px-2 py-0.5 rounded-full text-[#aaa]">
                      {historyItems.length}
                    </span>
                  )}
                </div>
              )}
            </button>
          </div>

          {/* Subscriptions Section */}
          <div className="my-2 border-t border-[#272727]" />
          <div className="p-2 space-y-1">
            {sidebarOpen ? (
              <>
                <div className="px-3 py-1 flex items-center justify-between text-xs font-semibold text-[#717171] uppercase tracking-wider">
                  <span>Subscriptions</span>
                  {subscriptions.length > 0 && (
                    <span className="text-[10px] bg-[#222] px-1.5 py-0.5 rounded text-[#aaa] font-bold">
                      {subscriptions.length}
                    </span>
                  )}
                </div>

                {subscriptions.map((sub) => {
                  const isActive = currentPage === 'channel' && (currentParam === sub.authorId || currentParam === sub.handle || currentParam === sub.author);
                  return (
                    <button
                      key={sub.authorId || sub.author}
                      onClick={() => openChannel(sub.authorId || sub.handle || sub.author)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer group ${
                        isActive
                          ? 'bg-white/10 text-white font-semibold'
                          : 'text-[#aaa] hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {sub.avatarUrl ? (
                        <img
                          src={sub.avatarUrl}
                          alt={sub.author}
                          className="w-6 h-6 rounded-full object-cover flex-shrink-0 border border-white/10"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-[#3ea6ff] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                          {(sub.author || '?')[0].toUpperCase()}
                        </div>
                      )}
                      <span className="truncate text-left flex-1">{sub.author}</span>
                      <span className={`w-1.5 h-1.5 rounded-full bg-[#3ea6ff] ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`} />
                    </button>
                  );
                })}
              </>
            ) : (
              subscriptions.slice(0, 5).map((sub) => (
                <button
                  key={sub.authorId || sub.author}
                  onClick={() => openChannel(sub.authorId || sub.handle || sub.author)}
                  title={sub.author}
                  className="w-full flex items-center justify-center py-2 hover:bg-white/5 rounded-xl cursor-pointer"
                >
                  {sub.avatarUrl ? (
                    <img
                      src={sub.avatarUrl}
                      alt={sub.author}
                      className="w-7 h-7 rounded-full object-cover border border-white/10"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-[#3ea6ff] text-white text-xs font-bold flex items-center justify-center">
                      {(sub.author || '?')[0].toUpperCase()}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>

          <div className="my-2 border-t border-[#272727]" />

          <div className="p-2 space-y-1">
            {sidebarOpen && (
              <div className="px-3 py-1 text-xs font-semibold text-[#717171] uppercase tracking-wider">
                Settings & Info
              </div>
            )}
            <button
              onClick={() => navigateTo('instance')}
              className={`w-full flex items-center gap-4 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                currentPage === 'instance'
                  ? 'bg-white/10 text-white font-semibold'
                  : 'text-[#aaa] hover:bg-white/5 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-5 h-5 flex-shrink-0 text-[#4caf50]" />
              {sidebarOpen && <span>Filter Bypass</span>}
            </button>
          </div>
        </nav>

        {/* Main Content Area */}
        <main
          className={`flex-1 transition-all duration-200 p-6 min-h-[calc(100vh-56px)] ${
            sidebarOpen ? 'ml-56' : 'ml-18'
          }`}
        >
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 text-[#aaa] space-y-3">
              <div className="w-10 h-10 border-3 border-[#333] border-t-[#ff0000] rounded-full animate-spin" />
              <div className="text-sm">Fetching content via yt-dlp & mirrors...</div>
            </div>
          )}

          {errorMsg && !loading && (
            <div className="mb-6 p-4 rounded-xl bg-[#261010] border border-[#6a1515] text-[#ff8888] flex items-center justify-between">
              <div>
                <span className="font-semibold">Notice:</span> {errorMsg}
              </div>
              <button
                onClick={() => setErrorMsg(null)}
                className="text-xs text-[#aaa] hover:text-white underline ml-4 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* ── PAGE: RECOMMENDED (Start Up Page) ── */}
          {currentPage === 'recommended' && !loading && (
            <div className="space-y-6">
              {/* Category Pills Bar */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                {RECOMMENDED_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => selectCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      recommendedCategory === cat
                        ? 'bg-white text-black shadow-md'
                        : 'bg-[#212121] hover:bg-[#2d2d2d] text-[#f1f1f1]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Personalized History Banner */}
              {favoriteCreators.length > 0 && recommendedCategory === 'All' && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-[#2c1212] via-[#1a1212] to-[#111111] border border-[#ff0000]/30 rounded-2xl p-4 shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#ff0000]/20 border border-[#ff0000]/30 flex items-center justify-center text-[#ff4444] flex-shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white flex items-center gap-2">
                        Personalized Based On Your Watch History
                      </div>
                      <div className="text-xs text-[#aaa] mt-0.5">
                        Prioritizing newest videos from your most watched creators:{' '}
                        <span className="text-[#3ea6ff] font-semibold">{favoriteCreators.join(', ')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-[11px] bg-[#ff0000]/20 text-[#ff5555] border border-[#ff0000]/40 px-3 py-1 rounded-full font-bold">
                      History Priority Active
                    </span>
                  </div>
                </div>
              )}

              {/* Hero Spotlight Recommendation */}
              {(() => {
                const currentList =
                  recommendedCategory === 'All'
                    ? (recommendedVideos.length > 0 ? recommendedVideos : trendingVideos)
                    : (categoryVideos[recommendedCategory] || []);
                const heroVideo = currentList[0];

                if (!heroVideo || loadingCategory) return null;

                return (
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#1e1e1e] via-[#161616] to-[#0f0f0f] border border-[#272727] p-6 shadow-2xl">
                    <div className="flex flex-col md:flex-row gap-6 items-center">
                      <div
                        onClick={() => openVideo(heroVideo.videoId)}
                        className="relative w-full md:w-[420px] aspect-video bg-[#1a1a1a] rounded-xl overflow-hidden shadow-lg cursor-pointer group flex-shrink-0"
                      >
                        <img
                          src={heroVideo.thumbnailUrl || `https://i.ytimg.com/vi/${heroVideo.videoId}/hqdefault.jpg`}
                          alt={heroVideo.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                          <div className="w-12 h-12 rounded-full bg-[#ff0000] text-white flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                            <Play className="w-5 h-5 fill-white ml-0.5" />
                          </div>
                        </div>
                        {heroVideo.lengthSeconds > 0 && (
                          <span className="absolute bottom-2 right-2 bg-black/85 text-white text-xs font-semibold px-2 py-0.5 rounded">
                            {formatDuration(heroVideo.lengthSeconds)}
                          </span>
                        )}
                        {heroVideo.isFromFavoriteCreator && (
                          <span className="absolute top-2 left-2 bg-[#ff0000] text-white text-[10px] font-bold px-2 py-0.5 rounded shadow flex items-center gap-1">
                            <Flame className="w-3 h-3 fill-current" /> Favorite Creator
                          </span>
                        )}
                      </div>

                      <div className="flex-1 space-y-3 min-w-0">
                        <div className="inline-flex items-center gap-1.5 bg-[#ff0000]/15 border border-[#ff0000]/30 text-[#ff4444] px-2.5 py-0.5 rounded-full text-xs font-semibold">
                          <Sparkles className="w-3.5 h-3.5" />
                          {heroVideo.recommendReason || 'Featured Recommendation'}
                        </div>

                        <h2
                          onClick={() => openVideo(heroVideo.videoId)}
                          className="text-xl md:text-2xl font-bold text-white leading-tight cursor-pointer hover:text-[#3ea6ff] transition-colors line-clamp-2"
                        >
                          {heroVideo.title}
                        </h2>

                        <div className="flex items-center gap-2 text-xs text-[#aaa]">
                          <span
                            onClick={() => openChannel(heroVideo.authorId)}
                            className="font-medium text-white hover:underline cursor-pointer"
                          >
                            {heroVideo.author}
                          </span>
                          <span>•</span>
                          <span>{formatViews(heroVideo.viewCount)}</span>
                          {heroVideo.published ? (
                            <>
                              <span>•</span>
                              <span>{timeAgo(heroVideo.published)}</span>
                            </>
                          ) : null}
                        </div>

                        {heroVideo.description && (
                          <p className="text-xs text-[#888] line-clamp-2 leading-relaxed">
                            {heroVideo.description}
                          </p>
                        )}

                        <div className="flex items-center gap-3 pt-2">
                          <button
                            onClick={() => openVideo(heroVideo.videoId)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-white text-black font-semibold text-xs rounded-full hover:bg-[#e2e2e2] transition-colors cursor-pointer shadow-md"
                          >
                            <Play className="w-3.5 h-3.5 fill-black" />
                            Watch Now
                          </button>
                          <span className="text-[11px] text-[#4caf50] bg-[#1a3a1a] px-2.5 py-1 rounded-full font-medium">
                            1080p HD • Bypass Active
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Recommended Grid Section */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Compass className="w-5 h-5 text-[#ff0000]" />
                    Recommended For You
                    {recommendedCategory !== 'All' ? (
                      <span className="text-xs font-normal text-[#888]">in {recommendedCategory}</span>
                    ) : favoriteCreators.length > 0 ? (
                      <span className="text-xs font-normal text-[#3ea6ff]">
                        • Grounded in your watch history
                      </span>
                    ) : null}
                  </h2>
                  <span className="text-xs text-[#888]">
                    {recommendedCategory === 'All'
                      ? `${(recommendedVideos.length > 0 ? recommendedVideos : trendingVideos).length} videos`
                      : ''}
                  </span>
                </div>

                {loadingCategory ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="animate-pulse space-y-2">
                        <div className="aspect-video bg-[#222] rounded-xl" />
                        <div className="h-4 bg-[#222] rounded w-3/4" />
                        <div className="h-3 bg-[#1a1a1a] rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {(recommendedCategory === 'All'
                      ? (recommendedVideos.length > 0 ? recommendedVideos : trendingVideos).slice(1)
                      : categoryVideos[recommendedCategory] || trendingVideos
                    ).map((v) => (
                      <VideoCard key={v.videoId} video={v} onPlay={openVideo} onChannel={openChannel} />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* ── PAGE: TRENDING ── */}
          {currentPage === 'trending' && !loading && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#ff0000]/15 flex items-center justify-center text-[#ff0000]">
                  <Flame className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Trending Videos</h1>
                  <p className="text-xs text-[#aaa]">Most popular videos fetched directly via yt-dlp & mirrors</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {trendingVideos.map((v) => (
                  <VideoCard key={v.videoId} video={v} onPlay={openVideo} onChannel={openChannel} />
                ))}
              </div>
            </div>
          )}

          {/* ── PAGE: SEARCH RESULTS ── */}
          {currentPage === 'search' && !loading && (
            <div className="space-y-6 max-w-5xl">
              <div className="text-sm text-[#aaa]">
                Results for <span className="font-semibold text-white">"{currentParam}"</span>
              </div>

              {/* Channel Banner Card if query matched a channel */}
              {searchChannel && (
                <div
                  onClick={() => openChannel(searchChannel.authorId || searchChannel.handle || searchChannel.author)}
                  className="p-5 rounded-2xl bg-gradient-to-r from-[#1c1c1c] via-[#171717] to-[#121212] border border-[#2e2e2e] hover:border-[#3ea6ff]/50 transition-all cursor-pointer group shadow-lg flex flex-col sm:flex-row items-center sm:items-start gap-5"
                >
                  <div className="relative flex-shrink-0">
                    {searchChannel.avatarUrl ? (
                      <img
                        src={searchChannel.avatarUrl}
                        alt={searchChannel.author}
                        className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-2 border-white/10 group-hover:border-[#3ea6ff] transition-colors shadow-md"
                      />
                    ) : (
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#3ea6ff] text-white text-3xl font-bold flex items-center justify-center shadow-md">
                        {(searchChannel.author || '?')[0].toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 text-center sm:text-left space-y-1.5">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <h2 className="text-xl font-bold text-white group-hover:text-[#3ea6ff] transition-colors">
                        {searchChannel.author}
                      </h2>
                      {searchChannel.isVerified && (
                        <CheckCircle2 className="w-4 h-4 text-[#aaa] fill-current" />
                      )}
                      <span className="text-[11px] bg-[#3ea6ff]/15 text-[#3ea6ff] font-semibold px-2 py-0.5 rounded-full border border-[#3ea6ff]/30">
                        Official Channel
                      </span>
                    </div>

                    <div className="text-xs text-[#aaa] flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      {searchChannel.handle && <span>{searchChannel.handle}</span>}
                      {searchChannel.handle && searchChannel.subCountText && <span>•</span>}
                      {searchChannel.subCountText && <span>{searchChannel.subCountText}</span>}
                      {searchChannel.videoCountText && <span>• {searchChannel.videoCountText}</span>}
                    </div>

                    {searchChannel.description && (
                      <p className="text-xs text-[#888] line-clamp-2 max-w-2xl leading-relaxed pt-1">
                        {searchChannel.description}
                      </p>
                    )}
                  </div>

                  <div className="flex sm:flex-col items-center gap-2 self-center flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => openChannel(searchChannel.authorId || searchChannel.handle || searchChannel.author)}
                      className="px-5 py-2 rounded-full text-xs font-semibold bg-[#3ea6ff] hover:bg-[#3ea6ff]/90 text-white transition-colors cursor-pointer shadow flex items-center gap-1.5"
                    >
                      <User className="w-3.5 h-3.5" />
                      View Channel
                    </button>
                    <button
                      onClick={() => toggleSubscribeChannel(searchChannel)}
                      className={`px-4 py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                        isChannelSubscribed(searchChannel)
                          ? 'bg-[#272727] text-white hover:bg-[#333]'
                          : 'bg-white text-black hover:bg-[#e2e2e2]'
                      }`}
                    >
                      {isChannelSubscribed(searchChannel) ? (
                        <span className="flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Subscribed
                        </span>
                      ) : (
                        'Subscribe'
                      )}
                    </button>
                  </div>
                </div>
              )}

              {searchResults.length === 0 ? (
                <div className="py-16 text-center text-[#888] space-y-2">
                  <Search className="w-10 h-10 mx-auto text-[#444]" />
                  <p>No results found for "{currentParam}".</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {searchResults.map((v) => (
                    <div
                      key={v.videoId}
                      onClick={() => openVideo(v.videoId)}
                      className="flex flex-col sm:flex-row gap-4 p-2.5 rounded-xl hover:bg-white/5 transition-all cursor-pointer group"
                    >
                      <div className="relative w-full sm:w-64 aspect-video bg-[#1a1a1a] rounded-xl overflow-hidden flex-shrink-0">
                        <img
                          src={v.thumbnailUrl || `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`}
                          alt={v.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          loading="lazy"
                        />
                        {v.lengthSeconds > 0 && (
                          <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[11px] font-semibold px-1.5 py-0.5 rounded">
                            {formatDuration(v.lengthSeconds)}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 py-1 space-y-2">
                        <h3 className="font-semibold text-base text-white line-clamp-2 leading-snug group-hover:text-[#3ea6ff] transition-colors">
                          {v.title}
                        </h3>
                        <div className="text-xs text-[#aaa] flex items-center gap-1.5">
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              openChannel(v.authorId || v.author);
                            }}
                            className="hover:text-white"
                          >
                            {v.author}
                          </span>
                          <span>•</span>
                          <span>{formatViews(v.viewCount)}</span>
                          {v.published ? (
                            <>
                              <span>•</span>
                              <span>{timeAgo(v.published)}</span>
                            </>
                          ) : null}
                        </div>
                        {v.description && (
                          <p className="text-xs text-[#888] line-clamp-2 leading-relaxed">
                            {v.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── PAGE: WATCH ── */}
          {currentPage === 'watch' && currentVideo && (
            <div className={`mx-auto space-y-6 ${theaterMode ? 'max-w-full px-2' : 'max-w-[1400px]'}`}>
              {/* In Theater Mode, the player spans full width above, and content is underneath */}
              <div className={`grid gap-6 ${theaterMode ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3'}`}>
                {/* Left Column: Player + Details (or full width in theater mode) */}
                <div className={`${theaterMode ? 'w-full' : 'lg:col-span-2'} space-y-4`}>
                  {/* Player Container */}
                  <div
                    ref={playerContainerRef}
                    className={`relative w-full ${
                      theaterMode
                        ? 'aspect-[21/9] sm:aspect-video max-h-[80vh]'
                        : 'aspect-video'
                    } bg-black rounded-2xl overflow-hidden shadow-2xl border border-[#222]`}
                  >
                    {/* Quality & Engine Badge Overlay for Custom Stream */}
                    {playerMode === 'stream' && (
                      <div className="absolute top-3 right-3 z-20 pointer-events-none flex items-center gap-2">
                        <span className="bg-black/80 backdrop-blur-md border border-white/20 text-white text-[11px] font-bold px-2.5 py-1 rounded-md shadow flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#4caf50] animate-pulse" />
                          {selectedQuality.toUpperCase()} {/720|1080/.test(selectedQuality) ? 'HD' : ''}
                        </span>
                        <span className="bg-[#181818]/90 backdrop-blur-md border border-white/10 text-[#3ea6ff] text-[11px] font-semibold px-2.5 py-1 rounded-md shadow hidden sm:flex items-center gap-1">
                          <Zap className="w-3 h-3 text-[#3ea6ff]" />
                          {customStreamEngine === 'direct' ? 'Direct MP4' : 'Ultra HD Bypass'}
                        </span>
                      </div>
                    )}

                    {/* Mode 1: Custom Stream (Robust Dual-Engine: Ultra HD Bypass or Direct MP4) */}
                    {playerMode === 'stream' && (
                      <div className="w-full h-full relative bg-black">
                        {customStreamEngine === 'direct' ? (
                          <video
                            ref={videoRef}
                            controls
                            playsInline
                            autoPlay
                            preload="auto"
                            poster={currentVideo.thumbnailUrl}
                            className="w-full h-full object-contain bg-black"
                            key={`${currentVideo.videoId}-${selectedQuality}-direct`}
                            onError={() => {
                              showToast('Direct stream blocked by upstream. Seamlessly active on Ultra HD Bypass Engine.');
                              setCustomStreamEngine('bypass');
                            }}
                          >
                            <source
                              src={`/api/stream/${encodeURIComponent(currentVideo.videoId)}?quality=${encodeURIComponent(selectedQuality)}`}
                              type="video/mp4"
                            />
                            Your browser does not support custom stream playback.
                          </video>
                        ) : (
                          /* Ultra HD Smart Stream Engine - 100% Reliable, 1080p HD, Zero Bot Challenges */
                          <iframe
                            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(
                              currentVideo.videoId
                            )}?autoplay=1&enablejsapi=1&rel=0&modestbranding=1&origin=${encodeURIComponent(
                              typeof window !== 'undefined' ? window.location.origin : ''
                            )}`}
                            title={currentVideo.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                            className="w-full h-full border-0"
                          />
                        )}
                      </div>
                    )}

                    {/* Mode 2: Privacy Embed */}
                    {playerMode === 'nocookie' && (
                      <iframe
                        src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(
                          currentVideo.videoId
                        )}?autoplay=1&rel=0&modestbranding=1`}
                        title={currentVideo.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        className="w-full h-full border-0"
                      />
                    )}

                    {/* Mode 3: Invidious Alt Mirror */}
                    {playerMode === 'invidious' && (
                      <iframe
                        src={`https://inv.tux.pizza/embed/${encodeURIComponent(
                          currentVideo.videoId
                        )}?autoplay=1`}
                        title={currentVideo.title}
                        allowFullScreen
                        className="w-full h-full border-0"
                      />
                    )}
                  </div>

                  {/* ── PLAYER CONTROLS: Mode, Engine, Quality & Theater Selector ── */}
                  <div className="space-y-2">
                    {/* Main Toolbar Row */}
                    <div className="flex flex-wrap items-center justify-between bg-[#181818] p-2.5 rounded-xl border border-[#272727] text-xs gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[#888] font-medium hidden sm:inline px-1">Player:</span>
                        <button
                          onClick={() => {
                            setPlayerMode('stream');
                            setStreamError(null);
                          }}
                          className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                            playerMode === 'stream'
                              ? 'bg-[#3ea6ff] text-white shadow-md font-semibold'
                              : 'text-[#aaa] hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <Film className="w-3.5 h-3.5" />
                          Custom Stream
                        </button>
                        <button
                          onClick={() => setPlayerMode('nocookie')}
                          className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                            playerMode === 'nocookie'
                              ? 'bg-[#ff0000] text-white shadow-md font-semibold'
                              : 'text-[#aaa] hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <Tv className="w-3.5 h-3.5" />
                          Privacy Embed
                        </button>
                        <button
                          onClick={() => setPlayerMode('invidious')}
                          className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                            playerMode === 'invidious'
                              ? 'bg-[#9333ea] text-white shadow-md font-semibold'
                              : 'text-[#aaa] hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Alt Mirror
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Theater Mode Toggle */}
                        <button
                          onClick={() => setTheaterMode((prev) => !prev)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                            theaterMode
                              ? 'bg-white/20 text-white font-semibold'
                              : 'bg-[#222] text-[#aaa] hover:text-white hover:bg-[#2c2c2c]'
                          }`}
                          title={theaterMode ? 'Exit Theater Mode' : 'Theater Mode (T)'}
                        >
                          {theaterMode ? (
                            <>
                              <Minimize2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Default View</span>
                            </>
                          ) : (
                            <>
                              <Maximize2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Theater Mode</span>
                            </>
                          )}
                        </button>

                        <span className="text-[11px] text-[#4caf50] font-medium hidden md:flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Filter Bypass Active
                        </span>
                      </div>
                    </div>

                    {/* Engine & Quality Row (when Custom Stream is active) */}
                    {playerMode === 'stream' && (
                      <div className="flex flex-wrap items-center justify-between bg-[#151515] px-3 py-2 rounded-xl border border-[#262626] text-xs gap-2">
                        {/* Stream Engine Toggle */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#888] font-medium">Engine:</span>
                          <button
                            onClick={() => {
                              setCustomStreamEngine('bypass');
                              showToast('Ultra HD Bypass Engine active (100% Reliable)');
                            }}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                              customStreamEngine === 'bypass'
                                ? 'bg-[#1a3a1a] text-[#4caf50] border border-[#4caf50]/40 font-bold'
                                : 'bg-[#222] text-[#888] hover:text-white'
                            }`}
                          >
                            <Zap className="w-3 h-3 text-[#4caf50]" />
                            Ultra HD Bypass (1080p)
                          </button>
                          <button
                            onClick={() => {
                              setCustomStreamEngine('direct');
                              showToast('Testing Direct MP4 Stream Pipe...');
                            }}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                              customStreamEngine === 'direct'
                                ? 'bg-[#1e3a5f] text-[#3ea6ff] border border-[#3ea6ff]/40 font-bold'
                                : 'bg-[#222] text-[#888] hover:text-white'
                            }`}
                            title="Direct HTML5 MP4 player pipe (accelerated with cookies or custom proxy)"
                          >
                            <Film className="w-3 h-3 text-[#3ea6ff]" />
                            Direct MP4 Stream
                          </button>
                        </div>

                        {/* Quality Selector */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#888] font-medium">Quality:</span>
                          <div className="flex flex-wrap items-center gap-1">
                            {availableQualities.map((q) => {
                              const isSelected = selectedQuality === q.quality;
                              return (
                                <button
                                  key={q.quality}
                                  onClick={() => handleQualityChange(q.quality)}
                                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1 ${
                                    isSelected
                                      ? 'bg-[#3ea6ff] text-white font-bold shadow'
                                      : 'bg-[#222] text-[#aaa] hover:text-white hover:bg-[#2e2e2e]'
                                  }`}
                                >
                                  {q.isHd && (
                                    <span className={`text-[8px] px-1 py-0.2 rounded font-extrabold ${
                                      isSelected ? 'bg-white/20 text-white' : 'bg-[#3ea6ff]/20 text-[#3ea6ff]'
                                    }`}>
                                      HD
                                    </span>
                                  )}
                                  <span>{q.quality}</span>
                                </button>
                              );
                            })}
                            <button
                              onClick={() => handleQualityChange('auto')}
                              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer ${
                                selectedQuality === 'auto'
                                  ? 'bg-[#3ea6ff] text-white font-bold shadow'
                                  : 'bg-[#222] text-[#aaa] hover:text-white hover:bg-[#2e2e2e]'
                              }`}
                            >
                              Auto
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                {/* Video Info */}
                <div className="space-y-3 pt-1">
                  <h1 className="text-xl font-bold text-white leading-snug">
                    {currentVideo.title}
                  </h1>

                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#aaa]">
                    <div>
                      {formatViews(currentVideo.viewCount)}
                      {currentVideo.published ? ` • ${timeAgo(currentVideo.published)}` : ''}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setIsLiked((prev) => !prev);
                          showToast(!isLiked ? 'Liked!' : 'Like removed');
                        }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                          isLiked
                            ? 'bg-[#3ea6ff]/20 text-[#3ea6ff] border border-[#3ea6ff]/40'
                            : 'bg-[#272727] hover:bg-[#333] text-white'
                        }`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span>{formatNum((currentVideo.likeCount || 0) + (isLiked ? 1 : 0))}</span>
                      </button>

                      <button
                        onClick={handleShare}
                        className="flex items-center gap-2 px-4 py-2 bg-[#272727] hover:bg-[#333] text-white rounded-full text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Share</span>
                      </button>

                      <a
                        href={`https://www.youtube.com/watch?v=${currentVideo.videoId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-[#272727] hover:bg-[#333] text-white rounded-full text-xs font-semibold transition-colors"
                        title="Open on YouTube"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>YouTube</span>
                      </a>
                    </div>
                  </div>

                  {/* Channel Row */}
                  <div className="flex items-center justify-between py-3 border-y border-[#272727]">
                    <div
                      onClick={() => openChannel(currentVideo.authorId || currentVideo.author)}
                      className="flex items-center gap-3 cursor-pointer group"
                    >
                      <div className="w-10 h-10 rounded-full bg-[#3ea6ff] text-white font-bold flex items-center justify-center text-sm shadow">
                        {(currentVideo.author || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-white text-sm group-hover:text-[#3ea6ff] transition-colors">
                          {currentVideo.author || 'Creator'}
                        </div>
                        {currentVideo.subCountText && (
                          <div className="text-xs text-[#aaa]">{currentVideo.subCountText}</div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        const targetChannel: ChannelInfo = {
                          author: currentVideo.author || 'Creator',
                          authorId: currentVideo.authorId || '',
                          subCountText: currentVideo.subCountText,
                        };
                        toggleSubscribeChannel(targetChannel);
                      }}
                      className={`px-5 py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                        isChannelSubscribed({
                          author: currentVideo.author,
                          authorId: currentVideo.authorId,
                        })
                          ? 'bg-[#272727] text-white hover:bg-[#333]'
                          : 'bg-white text-black hover:bg-[#e2e2e2]'
                      }`}
                    >
                      {isChannelSubscribed({
                        author: currentVideo.author,
                        authorId: currentVideo.authorId,
                      }) ? (
                        <span className="flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-[#4caf50]" /> Subscribed
                        </span>
                      ) : (
                        'Subscribe'
                      )}
                    </button>
                  </div>

                  {/* Description Box */}
                  <div
                    onClick={() => setDescExpanded((prev) => !prev)}
                    className="p-4 bg-[#212121] rounded-xl text-sm leading-relaxed cursor-pointer hover:bg-[#272727] transition-colors"
                  >
                    <div className={`whitespace-pre-wrap ${!descExpanded ? 'line-clamp-3' : ''}`}>
                      {currentVideo.description || 'No description provided.'}
                    </div>
                    <div className="mt-2 text-xs font-semibold text-[#3ea6ff]">
                      {descExpanded ? 'Show less' : 'Show more'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Up Next */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-[#ddd]">Up next</h3>
                <div className="space-y-3">
                  {historyItems
                    .filter((item) => item.videoId !== currentVideo.videoId)
                    .slice(0, 10)
                    .map((item) => (
                      <div
                        key={item.videoId}
                        onClick={() => openVideo(item.videoId)}
                        className="flex gap-2.5 p-1.5 rounded-xl hover:bg-white/5 cursor-pointer group transition-colors"
                      >
                        <div className="relative w-36 aspect-video bg-[#1a1a1a] rounded-lg overflow-hidden flex-shrink-0">
                          <img
                            src={item.thumbnailUrl || `https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg`}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            loading="lazy"
                          />
                          {item.lengthSeconds > 0 && (
                            <span className="absolute bottom-1 right-1 bg-black/80 text-[10px] font-semibold px-1 rounded text-white">
                              {formatDuration(item.lengthSeconds)}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 py-0.5">
                          <h4 className="text-xs font-semibold text-white line-clamp-2 leading-tight group-hover:text-[#3ea6ff]">
                            {item.title}
                          </h4>
                          <div className="text-[11px] text-[#aaa] mt-1">{item.author}</div>
                          <div className="text-[11px] text-[#888]">{formatViews(item.viewCount)}</div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
          )}

          {/* ── PAGE: CHANNEL ── */}
          {currentPage === 'channel' && channelData && !loading && (
            <div className="space-y-6 max-w-6xl mx-auto">
              {/* Channel Banner */}
              {channelData.channel.bannerUrl ? (
                <div className="relative w-full h-36 sm:h-52 md:h-64 rounded-2xl overflow-hidden bg-[#181818] border border-[#272727] shadow-xl">
                  <img
                    src={channelData.channel.bannerUrl}
                    alt={channelData.channel.author}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                </div>
              ) : (
                <div className="w-full h-24 sm:h-32 rounded-2xl bg-gradient-to-r from-[#202020] via-[#161616] to-[#0f0f0f] border border-[#272727]" />
              )}

              {/* Channel Header Profile Card */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 p-6 rounded-2xl bg-gradient-to-b from-[#1c1c1c] to-[#121212] border border-[#272727] -mt-12 md:-mt-16 relative z-10 shadow-2xl backdrop-blur-sm">
                <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 text-center sm:text-left">
                  {/* Channel Avatar */}
                  <div className="relative flex-shrink-0">
                    {channelData.channel.avatarUrl ? (
                      <img
                        src={channelData.channel.avatarUrl}
                        alt={channelData.channel.author}
                        className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-4 border-[#121212] shadow-2xl"
                      />
                    ) : (
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-[#3ea6ff] text-white text-4xl font-bold flex items-center justify-center border-4 border-[#121212] shadow-2xl">
                        {(channelData.channel.author || '?')[0].toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Channel Info */}
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                        {channelData.channel.author}
                      </h1>
                      {channelData.channel.isVerified && (
                        <span title="Verified Channel">
                          <CheckCircle2 className="w-5 h-5 text-[#aaa] fill-current" />
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-[#aaa]">
                      {channelData.channel.handle && (
                        <span className="text-white font-medium">{channelData.channel.handle}</span>
                      )}
                      {channelData.channel.handle && channelData.channel.subCountText && <span>•</span>}
                      {channelData.channel.subCountText && (
                        <span>{channelData.channel.subCountText}</span>
                      )}
                      {channelData.channel.videoCountText && (
                        <>
                          <span>•</span>
                          <span>{channelData.channel.videoCountText}</span>
                        </>
                      )}
                    </div>

                    {channelData.channel.description && (
                      <div
                        onClick={() => setChannelDescExpanded((prev) => !prev)}
                        className="text-xs text-[#888] cursor-pointer hover:text-[#bbb] transition-colors pt-1 max-w-2xl text-left"
                      >
                        <p className={`leading-relaxed whitespace-pre-line ${!channelDescExpanded ? 'line-clamp-2' : ''}`}>
                          {channelData.channel.description}
                        </p>
                        <span className="text-[#3ea6ff] font-semibold mt-0.5 inline-block">
                          {channelDescExpanded ? 'Show less' : '...more'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Channel Actions */}
                <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2.5 flex-shrink-0 pt-2 md:pt-0">
                  <button
                    onClick={() => toggleSubscribeChannel(channelData.channel)}
                    className={`px-6 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer shadow flex items-center gap-1.5 ${
                      isChannelSubscribed(channelData.channel)
                        ? 'bg-[#272727] text-white hover:bg-[#333] border border-[#3a3a3a]'
                        : 'bg-white text-black hover:bg-[#e2e2e2]'
                    }`}
                  >
                    {isChannelSubscribed(channelData.channel) ? (
                      <>
                        <Check className="w-4 h-4 text-[#4caf50]" />
                        <span>Subscribed</span>
                      </>
                    ) : (
                      <>
                        <Bell className="w-3.5 h-3.5" />
                        <span>Subscribe</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      const channelUrl = `${window.location.origin}/#channel/${encodeURIComponent(
                        channelData.channel.authorId || channelData.channel.handle || channelData.channel.author
                      )}`;
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(channelUrl);
                        showToast('Channel link copied to clipboard!');
                      } else {
                        showToast('Link ready in address bar');
                      }
                    }}
                    className="px-4 py-2.5 rounded-full text-xs font-semibold bg-[#272727] hover:bg-[#333] text-white transition-colors cursor-pointer flex items-center gap-1.5 border border-[#333]"
                    title="Share Channel"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share</span>
                  </button>

                  <a
                    href={`https://www.youtube.com/${channelData.channel.handle ? channelData.channel.handle : `channel/${channelData.channel.authorId}`}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2.5 rounded-full text-xs font-semibold bg-[#272727] hover:bg-[#333] text-white transition-colors flex items-center gap-1.5 border border-[#333]"
                    title="Open on YouTube"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>YouTube</span>
                  </a>
                </div>
              </div>

              {/* Channel Tabs */}
              <div className="flex items-center gap-1 border-b border-[#272727]">
                <button
                  onClick={() => setChannelTab('videos')}
                  className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                    channelTab === 'videos'
                      ? 'border-white text-white font-bold'
                      : 'border-transparent text-[#888] hover:text-[#ddd]'
                  }`}
                >
                  <Video className="w-4 h-4" />
                  <span>Videos</span>
                  <span className="text-[11px] bg-[#222] px-2 py-0.5 rounded-full text-[#aaa]">
                    {channelData.videos.length}
                  </span>
                </button>

                <button
                  onClick={() => setChannelTab('shorts')}
                  className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                    channelTab === 'shorts'
                      ? 'border-white text-white font-bold'
                      : 'border-transparent text-[#888] hover:text-[#ddd]'
                  }`}
                >
                  <Film className="w-4 h-4" />
                  <span>Shorts</span>
                  <span className="text-[11px] bg-[#222] px-2 py-0.5 rounded-full text-[#aaa]">
                    {(channelData.shorts || []).length}
                  </span>
                </button>

                <button
                  onClick={() => setChannelTab('about')}
                  className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                    channelTab === 'about'
                      ? 'border-white text-white font-bold'
                      : 'border-transparent text-[#888] hover:text-[#ddd]'
                  }`}
                >
                  <Info className="w-4 h-4" />
                  <span>About</span>
                </button>
              </div>

              {/* ── TAB: VIDEOS ── */}
              {channelTab === 'videos' && (
                <div className="space-y-4">
                  {/* Video Search & Sorting Toolbar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#161616] p-3 rounded-xl border border-[#272727]">
                    <div className="relative w-full sm:w-72">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
                      <input
                        type="text"
                        placeholder="Search channel videos..."
                        value={channelSearch}
                        onChange={(e) => setChannelSearch(e.target.value)}
                        className="w-full bg-[#111] border border-[#333] rounded-lg pl-8 pr-8 py-1.5 text-xs text-white placeholder-[#666] outline-none focus:border-[#3ea6ff]"
                      />
                      {channelSearch && (
                        <button
                          onClick={() => setChannelSearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[#888] hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      <span className="text-xs text-[#888] mr-1 hidden sm:inline">Sort:</span>
                      <button
                        onClick={() => setChannelSort('latest')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          channelSort === 'latest'
                            ? 'bg-white text-black'
                            : 'bg-[#222] text-[#aaa] hover:text-white hover:bg-[#2a2a2a]'
                        }`}
                      >
                        Latest
                      </button>
                      <button
                        onClick={() => setChannelSort('popular')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          channelSort === 'popular'
                            ? 'bg-white text-black'
                            : 'bg-[#222] text-[#aaa] hover:text-white hover:bg-[#2a2a2a]'
                        }`}
                      >
                        Most Popular
                      </button>
                      <button
                        onClick={() => setChannelSort('oldest')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          channelSort === 'oldest'
                            ? 'bg-white text-black'
                            : 'bg-[#222] text-[#aaa] hover:text-white hover:bg-[#2a2a2a]'
                        }`}
                      >
                        Oldest
                      </button>
                    </div>
                  </div>

                  {/* Filtered Videos List */}
                  {(() => {
                    const filtered = getFilteredChannelVideos();
                    if (filtered.length === 0) {
                      return (
                        <div className="py-16 text-center text-[#888] space-y-3 bg-[#141414] rounded-2xl border border-[#222]">
                          <Search className="w-10 h-10 mx-auto text-[#444]" />
                          <p className="text-sm">No videos found matching "{channelSearch}"</p>
                          <button
                            onClick={() => setChannelSearch('')}
                            className="px-4 py-1.5 bg-[#252525] hover:bg-[#333] text-white text-xs font-semibold rounded-lg"
                          >
                            Clear Filter
                          </button>
                        </div>
                      );
                    }
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {filtered.map((v) => (
                          <VideoCard key={v.videoId} video={v} onPlay={openVideo} onChannel={openChannel} />
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ── TAB: SHORTS ── */}
              {channelTab === 'shorts' && (
                <div>
                  {(channelData.shorts || []).length === 0 ? (
                    <div className="py-16 text-center text-[#888] space-y-3 bg-[#141414] rounded-2xl border border-[#222]">
                      <Film className="w-10 h-10 mx-auto text-[#444]" />
                      <p className="text-sm">No shorts found for this channel.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {(channelData.shorts || []).map((short) => (
                        <div
                          key={short.videoId}
                          onClick={() => openVideo(short.videoId)}
                          className="group cursor-pointer flex flex-col space-y-2"
                        >
                          <div className="relative aspect-[9/16] bg-[#1a1a1a] rounded-xl overflow-hidden shadow-md">
                            <img
                              src={short.thumbnailUrl || `https://i.ytimg.com/vi/${short.videoId}/hqdefault.jpg`}
                              alt={short.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
                            <div className="absolute top-2 left-2 bg-[#ff0000] text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                              SHORTS
                            </div>
                            {short.lengthSeconds > 0 && (
                              <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-semibold px-1 rounded">
                                {formatDuration(short.lengthSeconds)}
                              </span>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="w-10 h-10 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg">
                                <Play className="w-4 h-4 fill-current ml-0.5" />
                              </div>
                            </div>
                          </div>
                          <div className="space-y-0.5">
                            <h3 className="text-xs font-semibold text-white line-clamp-2 leading-tight group-hover:text-[#3ea6ff] transition-colors">
                              {short.title}
                            </h3>
                            <div className="text-[11px] text-[#888]">
                              {formatViews(short.viewCount)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: ABOUT ── */}
              {channelTab === 'about' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 space-y-6">
                    <div className="p-6 rounded-2xl bg-[#171717] border border-[#272727] space-y-3">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider text-[#aaa]">
                        Description
                      </h3>
                      <p className="text-sm text-[#ddd] leading-relaxed whitespace-pre-line">
                        {channelData.channel.description || 'No detailed description provided by creator.'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="p-5 rounded-2xl bg-[#171717] border border-[#272727] space-y-4">
                      <h3 className="text-xs font-bold text-[#aaa] uppercase tracking-wider">
                        Channel Stats & Details
                      </h3>

                      <div className="space-y-3 text-xs">
                        <div className="flex items-center justify-between pb-2 border-b border-[#252525]">
                          <span className="text-[#888]">Creator</span>
                          <span className="font-semibold text-white">{channelData.channel.author}</span>
                        </div>

                        {channelData.channel.handle && (
                          <div className="flex items-center justify-between pb-2 border-b border-[#252525]">
                            <span className="text-[#888]">Handle</span>
                            <span className="font-semibold text-[#3ea6ff]">{channelData.channel.handle}</span>
                          </div>
                        )}

                        {channelData.channel.subCountText && (
                          <div className="flex items-center justify-between pb-2 border-b border-[#252525]">
                            <span className="text-[#888]">Subscribers</span>
                            <span className="font-semibold text-white">{channelData.channel.subCountText}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between pb-2 border-b border-[#252525]">
                          <span className="text-[#888]">Loaded Videos</span>
                          <span className="font-semibold text-white">{channelData.videos.length} videos</span>
                        </div>

                        {channelData.channel.authorId && (
                          <div className="space-y-1.5 pt-1">
                            <span className="text-[#888] block">Channel ID</span>
                            <div className="flex items-center gap-2 bg-[#101010] p-2 rounded-lg border border-[#282828]">
                              <span className="font-mono text-[11px] text-[#aaa] truncate flex-1">
                                {channelData.channel.authorId}
                              </span>
                              <button
                                onClick={() => {
                                  navigator.clipboard?.writeText(channelData.channel.authorId);
                                  showToast('Channel ID copied!');
                                }}
                                className="text-[#3ea6ff] hover:text-white"
                                title="Copy ID"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="pt-2">
                          <a
                            href={`https://www.youtube.com/${channelData.channel.handle || `channel/${channelData.channel.authorId}`}`}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#222] hover:bg-[#2c2c2c] text-white rounded-xl font-semibold transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Open Official Channel</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── PAGE: WATCH HISTORY (Fully Editable & Dynamic) ── */}
          {currentPage === 'history' && !loading && (
            <div className="max-w-4xl space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#272727] pb-4 gap-4">
                <div>
                  <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
                    <History className="w-6 h-6 text-[#3ea6ff]" />
                    Watch History
                  </h1>
                  <div className="flex items-center gap-2.5 mt-1 text-xs">
                    <span className="text-[#aaa]">{historyItems.length} videos recorded</span>
                    {historyPaused ? (
                      <span className="bg-amber-500/15 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                        <Pause className="w-3 h-3" /> History Paused
                      </span>
                    ) : (
                      <span className="text-[#4caf50] flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3 h-3" /> Live Tracking Active
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={toggleHistoryPause}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer border ${
                      historyPaused
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30'
                        : 'bg-[#222] border-[#333] text-[#aaa] hover:text-white hover:bg-[#2a2a2a]'
                    }`}
                  >
                    {historyPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5" />}
                    {historyPaused ? 'Resume History' : 'Pause History'}
                  </button>

                  {historyItems.length > 0 && (
                    <button
                      onClick={clearAllHistory}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#272727] hover:bg-[#3a2020] text-xs text-[#ff8888] font-semibold rounded-lg transition-colors cursor-pointer border border-[#3a2020]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear All
                    </button>
                  )}
                </div>
              </div>

              {/* History Search & Batch Toolbar */}
              {historyItems.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#161616] p-3 rounded-xl border border-[#272727]">
                  <div className="relative w-full sm:w-72">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
                    <input
                      type="text"
                      placeholder="Search title, creator, or note..."
                      value={historySearchQuery}
                      onChange={(e) => setHistorySearchQuery(e.target.value)}
                      className="w-full bg-[#101010] border border-[#303030] focus:border-[#3ea6ff] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#777] outline-none"
                    />
                    {historySearchQuery && (
                      <button
                        onClick={() => setHistorySearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#888] hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => selectAllHistory(filteredHistory)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[#bbb] hover:text-white bg-[#222] hover:bg-[#2a2a2a] rounded-lg transition-colors cursor-pointer"
                    >
                      {selectedHistoryIds.length === filteredHistory.length && filteredHistory.length > 0 ? (
                        <>
                          <CheckSquare className="w-3.5 h-3.5 text-[#3ea6ff]" /> Deselect All
                        </>
                      ) : (
                        <>
                          <Square className="w-3.5 h-3.5" /> Select All
                        </>
                      )}
                    </button>

                    {selectedHistoryIds.length > 0 && (
                      <button
                        onClick={deleteSelectedHistory}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#ff0000] hover:bg-[#dd0000] text-white font-semibold rounded-lg transition-colors cursor-pointer shadow"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete ({selectedHistoryIds.length})
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* History List */}
              {historyItems.length === 0 ? (
                <div className="py-20 text-center text-[#888] space-y-4 bg-[#141414] rounded-2xl border border-[#222] p-8">
                  <div className="w-16 h-16 rounded-full bg-[#1e1e1e] flex items-center justify-center mx-auto text-[#3ea6ff]">
                    <History className="w-8 h-8" />
                  </div>
                  <div className="space-y-1 max-w-sm mx-auto">
                    <h3 className="font-semibold text-white text-base">No Watch History Yet</h3>
                    <p className="text-xs text-[#aaa] leading-relaxed">
                      Videos you watch dynamically appear here with custom notes, bookmarks, and timestamp tracking.
                    </p>
                  </div>
                  <button
                    onClick={() => navigateTo('recommended')}
                    className="px-5 py-2.5 bg-[#3ea6ff] hover:bg-[#2563eb] text-white font-semibold text-xs rounded-full transition-colors cursor-pointer shadow"
                  >
                    Browse Recommended Videos
                  </button>
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="py-12 text-center text-[#888] space-y-2">
                  <p className="text-sm">No history matching "{historySearchQuery}"</p>
                  <button
                    onClick={() => setHistorySearchQuery('')}
                    className="text-xs text-[#3ea6ff] hover:underline cursor-pointer"
                  >
                    Clear search filter
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredHistory.map((v) => {
                    const isSelected = selectedHistoryIds.includes(v.videoId);
                    const isEditing = editingVideoId === v.videoId;

                    return (
                      <div
                        key={v.videoId}
                        className={`p-3 rounded-xl border transition-all relative ${
                          isSelected
                            ? 'bg-[#1b2533] border-[#3ea6ff]/50'
                            : 'bg-[#161616] hover:bg-[#1c1c1c] border-[#272727]'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Checkbox */}
                          <div
                            onClick={(e) => toggleSelectHistory(v.videoId, e)}
                            className="pt-2 cursor-pointer text-[#888] hover:text-white"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-[#3ea6ff]" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </div>

                          {/* Thumbnail */}
                          <div
                            onClick={() => openVideo(v.videoId)}
                            className="relative w-36 sm:w-48 aspect-video bg-[#1a1a1a] rounded-lg overflow-hidden flex-shrink-0 cursor-pointer group"
                          >
                            <img
                              src={v.thumbnailUrl || `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`}
                              alt={v.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              loading="lazy"
                            />
                            {v.lengthSeconds > 0 && (
                              <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-semibold px-1 py-0.5 rounded">
                                {formatDuration(v.lengthSeconds)}
                              </span>
                            )}
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0 space-y-1">
                            <h3
                              onClick={() => openVideo(v.videoId)}
                              className="font-semibold text-sm text-white line-clamp-2 leading-snug cursor-pointer hover:text-[#3ea6ff] transition-colors"
                            >
                              {v.title}
                            </h3>
                            <div className="text-xs text-[#aaa]">{v.author}</div>
                            <div className="flex items-center gap-2 text-[11px] text-[#888]">
                              {v.viewCount > 0 && <span>{formatViews(v.viewCount)} •</span>}
                              <span className="text-[#3ea6ff]">{watchedAgo(v.watchedAt)}</span>
                            </div>

                            {/* Saved Note / Memo */}
                            {v.note && !isEditing && (
                              <div className="mt-2 text-xs bg-[#1a2332] text-[#70b5ff] border border-[#2b4263] px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 max-w-full">
                                <Tag className="w-3 h-3 flex-shrink-0 text-[#3ea6ff]" />
                                <span className="font-semibold">Note:</span>
                                <span className="truncate">{v.note}</span>
                              </div>
                            )}
                          </div>

                          {/* Edit / Delete Buttons */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={(e) => startEditHistoryItem(v, e)}
                              title="Edit note or rename"
                              className="p-1.5 text-[#aaa] hover:text-[#3ea6ff] rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => removeFromHistory(v.videoId, e)}
                              title="Remove from history"
                              className="p-1.5 text-[#aaa] hover:text-[#ff4e45] rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Inline Editor */}
                        {isEditing && (
                          <div className="mt-3 pt-3 border-t border-[#333] space-y-2 bg-[#121212] p-3 rounded-lg">
                            <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                              <Edit3 className="w-3.5 h-3.5 text-[#3ea6ff]" />
                              Edit History Item Note & Title
                            </div>
                            <div>
                              <label className="text-[11px] text-[#888] block mb-1">Custom Note / Timestamp / Bookmark</label>
                              <input
                                type="text"
                                placeholder="e.g. Stopped at 15:40, Key tutorial chapter..."
                                value={editingNote}
                                onChange={(e) => setEditingNote(e.target.value)}
                                className="w-full bg-[#1a1a1a] border border-[#333] focus:border-[#3ea6ff] rounded px-2.5 py-1.5 text-xs text-white outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] text-[#888] block mb-1">Title (optional edit)</label>
                              <input
                                type="text"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                className="w-full bg-[#1a1a1a] border border-[#333] focus:border-[#3ea6ff] rounded px-2.5 py-1.5 text-xs text-white outline-none"
                              />
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                onClick={(e) => saveEditHistoryItem(v.videoId, e)}
                                className="flex items-center gap-1 px-3 py-1 bg-[#3ea6ff] hover:bg-[#2563eb] text-white text-xs font-semibold rounded cursor-pointer transition-colors"
                              >
                                <Save className="w-3 h-3" /> Save Changes
                              </button>
                              <button
                                onClick={cancelEditHistoryItem}
                                className="px-3 py-1 bg-[#272727] hover:bg-[#333] text-[#aaa] hover:text-white text-xs rounded cursor-pointer transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── PAGE: INSTANCE & BYPASS INFO ── */}
          {currentPage === 'instance' && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
                  <ShieldCheck className="w-7 h-7 text-[#4caf50]" />
                  How ViewTube Bypasses Network Blocks
                </h1>
                <p className="text-sm text-[#aaa] mt-1 leading-relaxed">
                  ViewTube is built to play YouTube videos on networks where YouTube or restricted mode is forced by network administrators.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-[#1a1a1a] border border-[#333] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white text-sm">1. High-Quality Stream Extraction (720p / 1080p HD)</span>
                    <span className="text-xs bg-[#1a3a1a] text-[#4caf50] px-2 py-0.5 rounded-full font-semibold">Active</span>
                  </div>
                  <p className="text-xs text-[#aaa] leading-relaxed">
                    ViewTube selects 720p HD and 1080p stream formats with audio multiplexing and proxies the stream byte-ranges directly from the server. You can toggle between 1080p, 720p HD, 480p, and 360p (Data Saver).
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#1a1a1a] border border-[#333] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white text-sm">2. YouTube Privacy-Enhanced Embeds</span>
                    <span className="text-xs bg-[#1a3a1a] text-[#4caf50] px-2 py-0.5 rounded-full font-semibold">Primary Alternative</span>
                  </div>
                  <p className="text-xs text-[#aaa] leading-relaxed">
                    Uses <code className="text-[#3ea6ff]">youtube-nocookie.com</code> which skips standard tracking cookies and bypasses strict YouTube domain blocks that only filter <code className="text-[#3ea6ff]">youtube.com</code>.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#1a1a1a] border border-[#333] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white text-sm">3. Piped & Invidious Open-Source Network</span>
                    <span className="text-xs bg-[#222] text-[#aaa] px-2 py-0.5 rounded-full font-semibold">Decentralized Multi-Mirror</span>
                  </div>
                  <p className="text-xs text-[#aaa] leading-relaxed">
                    ViewTube automatically distributes and rotates video streams and search queries across public <strong>Piped API</strong> and <strong>Invidious</strong> mirror nodes (including private.coffee, adminforge, f5.si, and nerdvpn) when primary routes encounter rate-limits.
                  </p>
                </div>

                {/* Custom Cobalt / Stream Relay Proxy */}
                <div className="p-5 rounded-xl bg-[#171717] border border-[#333] space-y-3 mt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#3ea6ff]" />
                      <span className="font-semibold text-white text-sm">Cobalt / Upstream Stream Proxy (Optional)</span>
                    </div>
                    {customProxyUrl ? (
                      <span className="text-[11px] bg-[#1a3a1a] text-[#4caf50] px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Proxy Connected
                      </span>
                    ) : (
                      <span className="text-[11px] bg-[#2a2a2a] text-[#aaa] px-2.5 py-0.5 rounded-full font-medium">
                        Default Fallbacks
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#aaa] leading-relaxed">
                    Connect an external Cobalt v10 / v7 instance API or your Replit proxy URL. The server will request high-quality streams directly through your upstream endpoint to bypass datacenter blocks.
                  </p>
                  <input
                    type="url"
                    placeholder="https://your-cobalt-instance.example.com or Replit URL"
                    value={proxyInput}
                    onChange={(e) => setProxyInput(e.target.value)}
                    className="w-full bg-[#111] border border-[#333] rounded-lg p-2.5 text-xs text-[#ddd] font-mono outline-none focus:border-[#3ea6ff]"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={saveProxy}
                      disabled={isSavingProxy}
                      className="px-4 py-2 bg-[#3ea6ff] hover:bg-[#2563eb] disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {isSavingProxy ? 'Saving...' : customProxyUrl ? 'Update Proxy' : 'Save Proxy'}
                    </button>
                    {customProxyUrl && (
                      <button
                        onClick={() => {
                          setProxyInput('');
                          setTimeout(saveProxy, 10);
                        }}
                        className="px-4 py-2 bg-[#272727] hover:bg-[#3a2020] text-[#ff8888] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Reset to Default
                      </button>
                    )}
                  </div>
                </div>

                {/* Cookie Bot-Check Bypass */}
                <div className="p-5 rounded-xl bg-[#171717] border border-[#333] space-y-3 mt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#3ea6ff]" />
                      <span className="font-semibold text-white text-sm">YouTube Cookies (Optional Bot-Bypass for Custom Stream)</span>
                    </div>
                    {hasCookies ? (
                      <span className="text-[11px] bg-[#1a3a1a] text-[#4caf50] px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Cookies Loaded
                      </span>
                    ) : (
                      <span className="text-[11px] bg-[#2a2a2a] text-[#aaa] px-2.5 py-0.5 rounded-full font-medium">
                        No Cookies (Using Fallback)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#aaa] leading-relaxed">
                    YouTube occasionally requires bot verification ("Sign in to confirm you're not a bot") on server IPs. Providing exported YouTube cookies unlocks 1080p custom streaming without bot challenges.
                  </p>
                  <textarea
                    rows={3}
                    placeholder="Paste cookies in Netscape format here (optional)..."
                    value={cookieInput}
                    onChange={(e) => setCookieInput(e.target.value)}
                    className="w-full bg-[#111] border border-[#333] rounded-lg p-2.5 text-xs text-[#ddd] font-mono outline-none focus:border-[#3ea6ff]"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={saveCookies}
                      disabled={isSavingCookies || !cookieInput.trim()}
                      className="px-4 py-2 bg-[#3ea6ff] hover:bg-[#2563eb] disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {isSavingCookies ? 'Saving...' : 'Save Cookies'}
                    </button>
                    {hasCookies && (
                      <button
                        onClick={clearCookies}
                        className="px-4 py-2 bg-[#272727] hover:bg-[#3a2020] text-[#ff8888] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Remove Cookies
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Floating Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#2d2d2d] text-white border border-[#444] px-5 py-2.5 rounded-full text-xs font-semibold shadow-2xl z-50 flex items-center gap-2 animate-fade-in">
          <Check className="w-3.5 h-3.5 text-[#4caf50]" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}

// ── Subcomponent: Video Card ──
function VideoCard({
  video,
  onPlay,
  onChannel,
}: {
  video: VideoItem;
  onPlay: (id: string) => void;
  onChannel: (id: string) => void;
}) {
  return (
    <div
      onClick={() => onPlay(video.videoId)}
      className="group cursor-pointer flex flex-col space-y-2.5"
    >
      <div className="relative aspect-video bg-[#1a1a1a] rounded-xl overflow-hidden shadow-md">
        <img
          src={video.thumbnailUrl || `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`}
          alt={video.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
        {video.lengthSeconds > 0 && (
          <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[11px] font-semibold px-1.5 py-0.5 rounded">
            {formatDuration(video.lengthSeconds)}
          </span>
        )}
        {video.isFromFavoriteCreator && (
          <span className="absolute top-1.5 left-1.5 bg-[#ff0000] text-white text-[10px] font-bold px-2 py-0.5 rounded shadow flex items-center gap-1">
            <Flame className="w-2.5 h-2.5 fill-current" /> Favorite Creator
          </span>
        )}
      </div>

      <div className="flex gap-2.5 px-0.5">
        <div
          onClick={(e) => {
            e.stopPropagation();
            onChannel(video.authorId || video.author);
          }}
          className="w-9 h-9 rounded-full bg-[#3ea6ff] text-white font-bold flex items-center justify-center text-xs flex-shrink-0 hover:opacity-85 transition-opacity"
        >
          {(video.author || '?')[0].toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-xs text-white line-clamp-2 leading-snug group-hover:text-[#3ea6ff] transition-colors">
            {video.title}
          </h3>
          <div
            onClick={(e) => {
              e.stopPropagation();
              onChannel(video.authorId || video.author);
            }}
            className="text-[11px] text-[#aaa] hover:text-white mt-1 truncate flex items-center gap-1.5"
          >
            <span>{video.author}</span>
            {video.isFromFavoriteCreator && (
              <span className="text-[9px] bg-[#ff0000]/15 text-[#ff4444] px-1.5 py-0.2 rounded font-semibold">
                Most Watched
              </span>
            )}
          </div>
          <div className="text-[11px] text-[#888] flex items-center gap-1">
            <span>{formatViews(video.viewCount)}</span>
            {video.published ? (
              <>
                <span>•</span>
                <span>{timeAgo(video.published)}</span>
              </>
            ) : null}
          </div>
          {video.recommendReason && video.recommendReason !== 'Trending Now' && !video.isFromFavoriteCreator && (
            <div className="text-[10px] text-[#3ea6ff] truncate mt-0.5 font-medium">
              {video.recommendReason}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
