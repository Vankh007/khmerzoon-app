/**
 * VideoPlayer - Wrapper component that routes to appropriate player
 * - Uses MobileVideoPlayer for Android native apps
 * - Uses ShakaPlayer for web and iOS
 */
import { ShakaPlayer } from "./ShakaPlayer";
import { MobileVideoPlayer } from "./player/MobileVideoPlayer";
import { VideoSource } from "@/lib/supabase";
import { useNativeMobile } from "@/hooks/useNativeMobile";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";

interface Episode {
  id: string;
  episode_number?: number;
  title?: string;
  name?: string;
  still_path?: string;
  thumbnail_url?: string;
  access?: 'free' | 'rent' | 'vip';
}

interface VideoPlayerProps {
  videoSources: VideoSource[];
  onEpisodeSelect?: (episodeId: string) => void;
  episodes?: Episode[];
  currentEpisodeId?: string;
  contentBackdrop?: string;
  accessType?: 'free' | 'rent' | 'vip';
  excludeFromPlan?: boolean;
  rentalPrice?: number;
  rentalPeriodDays?: number;
  mediaId?: string;
  mediaType?: 'movie' | 'series' | 'anime';
  title?: string;
  movieId?: string;
  onMinimize?: () => void;
  trailerUrl?: string;
  contentId?: string;
  onEnded?: () => void;
  poster?: string;
}

const VideoPlayer = ({ 
  videoSources, 
  onEpisodeSelect, 
  episodes,
  currentEpisodeId,
  contentBackdrop,
  accessType = 'free',
  excludeFromPlan,
  rentalPrice,
  rentalPeriodDays,
  mediaId,
  mediaType,
  title,
  movieId,
  onMinimize,
  trailerUrl,
  contentId,
  onEnded,
  poster,
}: VideoPlayerProps) => {
  const { isNative, isAndroid } = useNativeMobile();
  
  const currentEpisode = episodes?.find(ep => ep.id === currentEpisodeId);
  const effectiveAccessType = currentEpisode?.access || accessType;
  
  // State for mobile player video URL
  const [mobileVideoUrl, setMobileVideoUrl] = useState<string | null>(null);
  const [mobileSourceType, setMobileSourceType] = useState<"mp4" | "hls" | "dash">("hls");
  const [isLoadingMobileUrl, setIsLoadingMobileUrl] = useState(false);
  
  // Track the last fetched episode/source to prevent duplicate fetches
  const lastFetchedRef = useRef<string | null>(null);
  const prevEpisodeIdRef = useRef<string | undefined>(currentEpisodeId);

  // Convert episodes to player format
  const playerEpisodes = useMemo(() => 
    episodes?.map(ep => ({
      id: ep.id,
      episode_number: ep.episode_number || 0,
      title: ep.title || ep.name,
      thumbnail_url: ep.thumbnail_url || ep.still_path,
    })) || [], [episodes]);

  const handleEpisodeSelect = useCallback((episode: { id: string; episode_number: number }) => {
    if (onEpisodeSelect) {
      console.log('[VideoPlayer] Episode selected:', episode.id);
      lastFetchedRef.current = null;
      setMobileVideoUrl(null);
      setIsLoadingMobileUrl(true);
      onEpisodeSelect(episode.id);
    }
  }, [onEpisodeSelect]);

  // Reset when episode changes
  useEffect(() => {
    if (prevEpisodeIdRef.current !== currentEpisodeId) {
      prevEpisodeIdRef.current = currentEpisodeId;
      lastFetchedRef.current = null;
      setMobileVideoUrl(null);
      setIsLoadingMobileUrl(true);
    }
  }, [currentEpisodeId]);

  // For native Android, get the video URL for mobile player
  useEffect(() => {
    if (!isNative || !isAndroid) {
      return;
    }

    // Get default source
    const defaultSource = videoSources.find(s => s.is_default) || videoSources[0];
    if (!defaultSource) {
      setMobileVideoUrl(null);
      setIsLoadingMobileUrl(false);
      return;
    }
    
    const fetchKey = `${currentEpisodeId || movieId}-${defaultSource.id}`;
    
    // Skip if we already fetched for this exact combination
    if (lastFetchedRef.current === fetchKey && mobileVideoUrl) {
      setIsLoadingMobileUrl(false);
      return;
    }

    setIsLoadingMobileUrl(true);

    // Determine source type
    const sourceType = (defaultSource.source_type || "").toLowerCase();
    if (sourceType === "hls" || sourceType === "m3u8") {
      setMobileSourceType("hls");
    } else if (sourceType === "dash") {
      setMobileSourceType("dash");
    } else if (sourceType === "mp4") {
      setMobileSourceType("mp4");
    } else {
      setMobileSourceType("hls");
    }

    // Check if source is iframe/embed - fallback to ShakaPlayer for these
    if (sourceType === "iframe" || sourceType === "embed") {
      setMobileVideoUrl(null);
      setIsLoadingMobileUrl(false);
      return;
    }

    // For free content, use URL directly
    if (defaultSource.url) {
      setMobileVideoUrl(defaultSource.url);
      lastFetchedRef.current = fetchKey;
    } else if (defaultSource.quality_urls) {
      const firstUrl = Object.values(defaultSource.quality_urls)[0];
      setMobileVideoUrl(firstUrl || null);
      lastFetchedRef.current = fetchKey;
    } else {
      setMobileVideoUrl(null);
    }
    setIsLoadingMobileUrl(false);
  }, [isNative, isAndroid, videoSources, currentEpisodeId, movieId, mobileVideoUrl]);

  // Use mobile player for native Android apps when we have a direct video URL
  if (isNative && isAndroid && mobileVideoUrl) {
    return (
      <MobileVideoPlayer
        key={`mobile-${currentEpisodeId || movieId}-${mobileVideoUrl.substring(0, 50)}`}
        videoUrl={mobileVideoUrl}
        poster={contentBackdrop || poster || currentEpisode?.still_path || currentEpisode?.thumbnail_url}
        autoplay={false}
        onBack={onMinimize}
        title={title}
        sourceType={mobileSourceType}
        episodes={playerEpisodes}
        currentEpisodeId={currentEpisodeId}
        onEpisodeSelect={handleEpisodeSelect}
        seriesBackdrop={contentBackdrop}
      />
    );
  }
  
  // Loading state for Android native
  if (isNative && isAndroid && isLoadingMobileUrl) {
    return (
      <div className="relative w-full aspect-video bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }
  
  // Use ShakaPlayer for web, iOS, and fallback cases (including iframe/embed sources)
  return (
    <div className="relative w-full aspect-video overflow-hidden">
      <ShakaPlayer 
        key={currentEpisodeId || movieId}
        videoSources={videoSources}
        contentBackdrop={contentBackdrop || poster || currentEpisode?.still_path}
        autoplay={false}
        episodeId={currentEpisodeId}
        movieId={movieId}
        accessType={effectiveAccessType}
        excludeFromPlan={excludeFromPlan}
        rentalPrice={rentalPrice}
        rentalPeriodDays={rentalPeriodDays}
        mediaId={mediaId}
        mediaType={mediaType}
        title={title}
        onMinimize={onMinimize}
        trailerUrl={trailerUrl}
        episodes={playerEpisodes}
        onEpisodeSelect={(episodeId: string) => onEpisodeSelect?.(episodeId)}
        seriesThumbnail={contentBackdrop}
        contentId={contentId}
        onEnded={onEnded}
      />
    </div>
  );
};

export default VideoPlayer;
