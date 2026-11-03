import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Maximize2,
  Volume2,
  Search,
  Heart,
  Share2,
  Sparkles,
  Radio,
  Music,
  Check,
  Copy,
  X,
  SkipForward,
  SkipBack,
  Eye,
  ExternalLink,
  ListMusic,
  Loader2,
  Flame,
  Tv
} from 'lucide-react';

export interface YouTubeVideoItem {
  videoId: string;
  title: string;
  author: string;
  views?: string;
  duration?: string;
}

const QUICK_CHIPS = [
  'Chris Brown',
  'Drake',
  'Tyla',
  'Burna Boy',
  'Kendrick Lamar',
  'Beyoncé',
  'The Weeknd',
  'Billie Eilish',
  'Amapiano Hits',
  'Afrobeats 2024',
  'Pop Hits',
  'Hip Hop',
];

export default function App() {
  // Search & Video State
  const [searchQuery, setSearchQuery] = useState('Chris Brown');
  const [currentQueryTitle, setCurrentQueryTitle] = useState('Chris Brown');
  const [videos, setVideos] = useState<YouTubeVideoItem[]>([]);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fullscreen Modal State
  const [modalVideo, setModalVideo] = useState<YouTubeVideoItem | null>(null);

  // Favorites stored in LocalStorage
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('worldtune_fav_videos');
      return saved ? JSON.parse(saved) : ['46p-IxAVJ74', 'pfxyk1glEq4'];
    } catch {
      return ['46p-IxAVJ74', 'pfxyk1glEq4'];
    }
  });

  // Active Tab
  const [activeTab, setActiveTab] = useState<'search' | 'favorites' | 'radio'>('search');

  // Iframe player references
  const topPlayerRef = useRef<HTMLIFrameElement | null>(null);
  const modalPlayerRef = useRef<HTMLIFrameElement | null>(null);

  // Feedback Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  // Listen for ad opening notification
  useEffect(() => {
    const handleAdOpening = () => {
      showToast('Ad opening - check new tab');
    };
    window.addEventListener('wt-ad-opening', handleAdOpening);
    return () => window.removeEventListener('wt-ad-opening', handleAdOpening);
  }, []);

  // Copy link state
  const [copiedVideoId, setCopiedVideoId] = useState<string | null>(null);

  const copySongLink = (videoId: string, title?: string) => {
    const songUrl = `https://www.youtube.com/watch?v=${videoId}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(songUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = songUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
    } catch (err) {
      console.warn('Clipboard write failed:', err);
    }

    setCopiedVideoId(videoId);
    showToast(title ? `Copied link: ${title}` : 'Song link copied to clipboard!');
    setTimeout(() => {
      setCopiedVideoId((current) => (current === videoId ? null : current));
    }, 2000);
  };

  // Save favorites
  useEffect(() => {
    try {
      localStorage.setItem('worldtune_fav_videos', JSON.stringify(favorites));
    } catch {}
  }, [favorites]);

  const toggleFavorite = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (favorites.includes(id)) {
      setFavorites(favorites.filter((f) => f !== id));
      showToast('Removed from favorites');
    } else {
      setFavorites([...favorites, id]);
      showToast('Saved to your favorites ❤️');
    }
  };

  // --------------------------------------------------------------------------
  // Core Search Function:
  // Fetches https://inv.nadeko.net/api/v1/search?q=SEARCH_TEXT, filter type=video, take 12,
  // with reliable server proxy fallback (/api/search?q=...)
  // --------------------------------------------------------------------------
  const searchYouTube = async (text: string) => {
    const clean = text.trim();
    if (!clean) return;

    setIsLoading(true);
    setErrorMsg(null);
    setCurrentQueryTitle(clean);
    showToast(`Searching real YouTube for "${clean}"...`);

    try {
      let fetchedVideos: YouTubeVideoItem[] = [];

      // 1. Attempt user-specified API: https://inv.nadeko.net/api/v1/search?q=SEARCH_TEXT
      try {
        const invRes = await fetch(
          `https://inv.nadeko.net/api/v1/search?q=${encodeURIComponent(clean)}`,
          { signal: AbortSignal.timeout(2500) }
        );

        if (invRes.ok) {
          const data = await invRes.json();
          if (Array.isArray(data)) {
            const vids = data
              .filter((item: any) => item.type === 'video' && item.videoId)
              .slice(0, 12)
              .map((item: any) => ({
                videoId: item.videoId,
                title: item.title,
                author: item.author || clean,
                views:
                  item.viewCountText ||
                  (item.viewCount
                    ? `${(item.viewCount / 1000000).toFixed(1)}M views`
                    : 'Popular Video'),
                duration: item.lengthSeconds
                  ? `${Math.floor(item.lengthSeconds / 60)}:${(item.lengthSeconds % 60)
                      .toString()
                      .padStart(2, '0')}`
                  : '3:30',
              }));

            if (vids.length > 0) {
              fetchedVideos = vids;
            }
          }
        }
      } catch (err) {
        console.warn('inv.nadeko.net fetch failed, falling back to server search:', err);
      }

      // 2. If inv.nadeko.net failed (e.g. endpoint disabled or CORS), fetch via /api/search
      if (fetchedVideos.length === 0) {
        const localRes = await fetch(`/api/search?q=${encodeURIComponent(clean)}`, {
          signal: AbortSignal.timeout(5000),
        });

        if (localRes.ok) {
          const data = await localRes.json();
          if (Array.isArray(data.items) && data.items.length > 0) {
            fetchedVideos = data.items.slice(0, 12);
          }
        }
      }

      // 3. Update state with results
      if (fetchedVideos.length > 0) {
        setVideos(fetchedVideos);
        // Requirement: set playing videoId to first result
        setPlayingVideoId(fetchedVideos[0].videoId);
        showToast(`Loaded ${fetchedVideos.length} real YouTube tracks for "${clean}"`);
      } else {
        setErrorMsg(`No video results found for "${clean}". Try another artist or song.`);
      }
    } catch (err: any) {
      console.error('Search error:', err);
      setErrorMsg('Failed to fetch YouTube videos. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load search for Chris Brown so real videos appear immediately
  useEffect(() => {
    searchYouTube('Chris Brown');
  }, []);

  // Unmute helpers calling player.unMute()
  const handleUnmuteTopPlayer = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (topPlayerRef.current?.contentWindow) {
      try {
        topPlayerRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'unMute', args: [] }),
          '*'
        );
        topPlayerRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'setVolume', args: [100] }),
          '*'
        );
      } catch (err) {}
    }
    showToast('Sound unmuted! 🔊');
  };

  const handleUnmuteModalPlayer = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (modalPlayerRef.current?.contentWindow) {
      try {
        modalPlayerRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'unMute', args: [] }),
          '*'
        );
        modalPlayerRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'setVolume', args: [100] }),
          '*'
        );
      } catch (err) {}
    }
    showToast('Sound unmuted! 🔊');
  };

  // Currently active video item in top player
  const currentVideoItem = videos.find((v) => v.videoId === playingVideoId) || videos[0];

  // Favorite video items
  const favoriteVideos = videos.filter((v) => favorites.includes(v.videoId));

  return (
    <div className="min-h-screen bg-[#080a12] text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-black">
      {/* Background Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-violet-600/15 rounded-full blur-[128px]" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-[140px]" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-fuchsia-600/10 rounded-full blur-[130px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#080a12]/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 py-3.5 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Brand */}
          <div
            onClick={() => {
              setActiveTab('search');
              searchYouTube('Chris Brown');
            }}
            className="flex items-center gap-3 shrink-0 cursor-pointer"
          >
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 via-fuchsia-500 to-cyan-400 p-[1.5px] shadow-lg shadow-violet-500/20">
              <div className="w-full h-full bg-[#080a12] rounded-[10px] flex items-center justify-center">
                <span className="text-lg leading-none">🌍</span>
                <span className="text-xs font-black bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent ml-0.5">
                  ♫
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent whitespace-nowrap">
                  WorldTune Global
                </h1>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold tracking-wider uppercase animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                  <span>LIVE</span>
                </div>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 font-medium hidden sm:block truncate">
                Real YouTube Search • Full Audio • 100% Genuine Hits
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-slate-300">
              <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>
                <strong className="text-white font-semibold tabular-nums">Real YouTube</strong> engine
              </span>
            </div>

            <button
              onClick={() => {
                const random = QUICK_CHIPS[Math.floor(Math.random() * QUICK_CHIPS.length)];
                setSearchQuery(random);
                searchYouTube(random);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white text-xs font-semibold shadow-md shadow-violet-500/20 active:scale-95 transition-all cursor-pointer whitespace-nowrap shrink-0"
              title="Surprise me with a random artist"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Surprise Me</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-5 pb-28 relative z-10 space-y-6">
        {/* Top Search Bar */}
        <div className="space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              searchYouTube(searchQuery);
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    searchYouTube(searchQuery);
                  }
                }}
                placeholder="Search real YouTube for any artist or song (e.g. Chris Brown, Drake)... press Enter"
                className="w-full bg-[#0e1122]/90 border border-white/15 rounded-2xl pl-10 pr-10 py-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center justify-center gap-1.5 px-6 py-3 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white font-bold text-xs sm:text-sm shadow-lg shadow-violet-600/30 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Searching...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Search</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Artist & Genre Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 no-scrollbar text-xs">
            <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap mr-1">
              Top Searches:
            </span>
            {QUICK_CHIPS.map((chip) => {
              const isSelected = currentQueryTitle.toLowerCase() === chip.toLowerCase();
              return (
                <button
                  key={chip}
                  onClick={() => {
                    setSearchQuery(chip);
                    searchYouTube(chip);
                  }}
                  className={`px-3.5 py-1.5 rounded-full font-bold text-xs whitespace-nowrap transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-gradient-to-r from-violet-600 to-cyan-500 text-white border-cyan-400 shadow-md shadow-cyan-500/30 scale-105'
                      : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10 hover:border-cyan-400/50'
                  }`}
                >
                  🔥 {chip}
                </button>
              );
            })}
          </div>
        </div>

        {/* Loading Spinner */}
        {isLoading && (
          <div className="rounded-3xl border border-white/10 bg-[#0e1122]/50 p-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
            <p className="text-sm text-slate-300 font-medium">
              Fetching real YouTube videos for "{currentQueryTitle}"...
            </p>
          </div>
        )}

        {/* Error message */}
        {errorMsg && !isLoading && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-950/30 p-4 text-center text-sm text-rose-300">
            {errorMsg}
          </div>
        )}

        {/* Top Playing Video Section: plays https://www.youtube.com/embed/VIDEOID?autoplay=1&mute=0 with sound */}
        {playingVideoId && currentVideoItem && !isLoading && (
          <section className="rounded-3xl border border-cyan-500/40 bg-gradient-to-br from-[#0c0e24] via-[#090b18] to-[#060810] p-4 sm:p-6 shadow-2xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                    Playing Real YouTube Video • Sound Enabled
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight line-clamp-1">
                  {currentVideoItem.title}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {currentVideoItem.author} •{' '}
                  <span className="text-cyan-300 font-medium">{currentVideoItem.views || 'YouTube Stream'}</span>
                </p>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => handleUnmuteTopPlayer(e)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-400 hover:bg-cyan-300 text-black font-extrabold text-xs shadow-md shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer"
                  title="Call player.unMute()"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Tap to Unmute</span>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copySongLink(currentVideoItem.videoId, currentVideoItem.title);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    copiedVideoId === currentVideoItem.videoId
                      ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 shadow-md shadow-emerald-500/20'
                      : 'bg-white/10 hover:bg-white/15 text-slate-200 hover:text-white'
                  }`}
                  title="Copy song link"
                >
                  {copiedVideoId === currentVideoItem.videoId ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300 font-extrabold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => toggleFavorite(currentVideoItem.videoId)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white transition-colors cursor-pointer"
                  title="Bookmark"
                >
                  <Heart
                    className={`w-4 h-4 ${
                      favorites.includes(currentVideoItem.videoId)
                        ? 'fill-rose-500 text-rose-500'
                        : 'text-slate-300'
                    }`}
                  />
                </button>

                <button
                  onClick={() => setModalVideo(currentVideoItem)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-cyan-300 border border-cyan-500/30 transition-colors cursor-pointer"
                  title="Fullscreen Theater Mode"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Main Iframe Player with autoplay=1&mute=0 */}
            <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-cyan-500/30 bg-black shadow-2xl">
              <iframe
                id="youtube-top-player"
                ref={topPlayerRef}
                src={`https://www.youtube.com/embed/${playingVideoId}?autoplay=1&mute=0&enablejsapi=1`}
                title={currentVideoItem.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full border-0"
              />

              {/* Overlay Unmute Button */}
              <div className="absolute top-3 left-3 z-30 pointer-events-auto">
                <button
                  onClick={(e) => handleUnmuteTopPlayer(e)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-400/95 hover:bg-cyan-300 text-black font-extrabold text-xs shadow-xl shadow-black/70 backdrop-blur-md active:scale-95 transition-all cursor-pointer"
                  title="Call player.unMute()"
                >
                  <Volume2 className="w-4 h-4 text-black" />
                  <span>Tap to Unmute</span>
                </button>
              </div>
            </div>
          </section>
        )}

        {/* 12 Real YouTube Results List */}
        {!isLoading && videos.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <ListMusic className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  12 Real YouTube Videos for "{currentQueryTitle}"
                </h3>
              </div>
              <span className="text-xs text-slate-400">Click any video to stream with sound</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
              {videos.map((item, idx) => {
                const isPlaying = playingVideoId === item.videoId;
                const isFav = favorites.includes(item.videoId);

                return (
                  <div
                    key={`${item.videoId}-${idx}`}
                    onClick={() => {
                      setPlayingVideoId(item.videoId);
                      showToast(`Now playing: ${item.title}`);
                      window.scrollTo({ top: 120, behavior: 'smooth' });
                    }}
                    className={`rounded-2xl border bg-[#0e1122]/90 backdrop-blur-md overflow-hidden flex flex-col justify-between transition-all duration-300 group cursor-pointer shadow-lg ${
                      isPlaying
                        ? 'border-cyan-400 ring-2 ring-cyan-400 shadow-cyan-500/25 bg-[#121630]'
                        : 'border-white/10 hover:border-cyan-500/40 hover:-translate-y-0.5'
                    }`}
                  >
                    {/* Real Thumbnail from img.youtube.com/vi/VIDEOID/mqdefault.jpg */}
                    <div className="relative aspect-video bg-black overflow-hidden">
                      <img
                        src={`https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`}
                        alt={item.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

                      {/* Rank Index */}
                      <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-black/75 backdrop-blur-md text-cyan-300 border border-cyan-500/30">
                        #{idx + 1}
                      </div>

                      {/* Favorite Button */}
                      <button
                        type="button"
                        onClick={(e) => toggleFavorite(item.videoId, e)}
                        className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md text-white transition-all cursor-pointer"
                        title="Bookmark"
                      >
                        <Heart
                          className={`w-3.5 h-3.5 ${
                            isFav ? 'fill-rose-500 text-rose-500' : 'text-slate-300'
                          }`}
                        />
                      </button>

                      {/* Duration */}
                      {item.duration && (
                        <div className="absolute bottom-2.5 right-2.5 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-slate-300 border border-white/10">
                          {item.duration}
                        </div>
                      )}

                      {/* Center Play Overlay */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                        <div className="w-11 h-11 rounded-full bg-cyan-400 text-black flex items-center justify-center shadow-lg">
                          <Play className="w-5 h-5 fill-black ml-0.5" />
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
                      <div>
                        <h4
                          className="font-bold text-xs sm:text-sm text-white line-clamp-2 group-hover:text-cyan-300 transition-colors"
                          title={item.title}
                        >
                          {item.title}
                        </h4>
                        <p className="text-[11px] text-slate-400 font-medium mt-1 truncate">
                          {item.author}
                        </p>
                        {item.views && (
                          <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Eye className="w-3 h-3 text-slate-500" />
                            <span>{item.views}</span>
                          </p>
                        )}
                      </div>

                      {/* Action Buttons: Play, Copy, Fullscreen */}
                      <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-white/10">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPlayingVideoId(item.videoId);
                            showToast(`Now playing: ${item.title}`);
                            window.scrollTo({ top: 120, behavior: 'smooth' });
                          }}
                          className={`flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isPlaying
                              ? 'bg-cyan-500 text-black shadow-md'
                              : 'bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white'
                          }`}
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Play</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            copySongLink(item.videoId, item.title);
                          }}
                          className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            copiedVideoId === item.videoId
                              ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 shadow-md shadow-emerald-500/20'
                              : 'bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white'
                          }`}
                          title="Copy song link"
                        >
                          {copiedVideoId === item.videoId ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-300 font-extrabold text-[11px]">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setModalVideo(item);
                          }}
                          className="flex items-center justify-center gap-1 py-1.5 px-1 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white text-xs font-bold shadow-md active:scale-95 transition-all cursor-pointer truncate"
                          title="Fullscreen Theater Mode"
                        >
                          <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="hidden xs:inline">Full</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* Fullscreen Video Modal (Full YouTube Player with mute=0) */}
      {modalVideo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Playing ${modalVideo.title}`}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-3 sm:p-6"
          onClick={() => setModalVideo(null)}
        >
          <div
            className="relative w-full max-w-4xl bg-[#0d1020] border border-white/20 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-white/10 bg-[#080a14]">
              <div className="flex items-center gap-3 truncate">
                <span className="text-xl">🌍</span>
                <div className="truncate">
                  <h3 className="font-bold text-sm sm:text-base text-white truncate">
                    {modalVideo.title}
                  </h3>
                  <p className="text-xs text-slate-400 truncate">
                    {modalVideo.author} •{' '}
                    <span className="text-cyan-300 font-medium">{modalVideo.views || 'Real YouTube'}</span>
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => handleUnmuteModalPlayer(e)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-bold text-xs shadow-md shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer"
                  title="Call player.unMute()"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Tap to Unmute</span>
                </button>

                <button
                  onClick={() => toggleFavorite(modalVideo.videoId)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white transition-colors cursor-pointer"
                  title="Bookmark"
                >
                  <Heart
                    className={`w-4 h-4 ${
                      favorites.includes(modalVideo.videoId)
                        ? 'fill-rose-500 text-rose-500'
                        : 'text-slate-300'
                    }`}
                  />
                </button>

                <button
                  onClick={() => copySongLink(modalVideo.videoId, modalVideo.title)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    copiedVideoId === modalVideo.videoId
                      ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50'
                      : 'bg-white/10 hover:bg-white/15 text-white'
                  }`}
                  title="Copy video link"
                >
                  {copiedVideoId === modalVideo.videoId ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="hidden xs:inline">Copy</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setModalVideo(null)}
                  className="p-2 rounded-xl bg-white/15 hover:bg-red-500/80 text-white transition-colors cursor-pointer ml-1"
                  title="Close player (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Video Iframe with autoplay=1&mute=0 */}
            <div className="relative aspect-video w-full bg-black group/modalplayer">
              <iframe
                id="youtube-modal-player"
                ref={modalPlayerRef}
                src={`https://www.youtube.com/embed/${modalVideo.videoId}?autoplay=1&mute=0&enablejsapi=1`}
                title={modalVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full border-0"
              />

              {/* Overlay Unmute Button */}
              <div className="absolute top-3 left-3 z-30 pointer-events-auto">
                <button
                  onClick={(e) => handleUnmuteModalPlayer(e)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-400/95 hover:bg-cyan-300 text-black font-extrabold text-xs shadow-xl shadow-black/70 backdrop-blur-md active:scale-95 transition-all cursor-pointer"
                  title="Call player.unMute()"
                >
                  <Volume2 className="w-4 h-4 text-black" />
                  <span>Tap to Unmute</span>
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-4 sm:px-6 py-3 bg-[#080a14] border-t border-white/10 flex items-center justify-between gap-4 text-xs text-slate-400">
              <span className="hidden sm:inline">Playing official stream on WorldTune</span>
              <a
                href={`https://www.youtube.com/watch?v=${modalVideo.videoId}`}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-medium ml-auto"
              >
                <span>Open in YouTube</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#080a12]/95 backdrop-blur-md border-t border-white/10 shadow-2xl">
        <div className="max-w-md sm:max-w-xl mx-auto grid grid-cols-3 items-center h-16 px-3">
          {/* Tab 1: Search */}
          <button
            onClick={() => {
              setActiveTab('search');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center justify-center min-h-[44px] transition-colors cursor-pointer ${
              activeTab === 'search' ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search className="w-5 h-5" />
            <span className="text-[11px] font-semibold tracking-tight mt-1">Search</span>
          </button>

          {/* Tab 2: Trending / Top 12 */}
          <button
            onClick={() => {
              setActiveTab('search');
              searchYouTube('Trending Global Music Hits');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex flex-col items-center justify-center min-h-[44px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <Flame className="w-5 h-5" />
            <span className="text-[11px] font-semibold tracking-tight mt-1">Trending</span>
          </button>

          {/* Tab 3: Favorites */}
          <button
            onClick={() => {
              setActiveTab('favorites');
              showToast(`${favorites.length} bookmarked videos`);
            }}
            className={`relative flex flex-col items-center justify-center min-h-[44px] transition-colors cursor-pointer ${
              activeTab === 'favorites' ? 'text-rose-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Heart className={`w-5 h-5 ${activeTab === 'favorites' ? 'fill-rose-500' : ''}`} />
            <span className="text-[11px] font-semibold tracking-tight mt-1">Favorites</span>
            {favorites.length > 0 && (
              <span className="absolute top-1.5 right-8 w-4 h-4 rounded-full bg-rose-500 text-white font-mono text-[9px] font-bold flex items-center justify-center">
                {favorites.length}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900/95 border border-white/20 text-white text-xs font-semibold shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
