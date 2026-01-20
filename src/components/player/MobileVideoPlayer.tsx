import { useEffect, useRef, useState, useCallback } from "react";
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  SkipBack, SkipForward, ListVideo
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Capacitor } from '@capacitor/core';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { App } from '@capacitor/app';
import { EpisodeListDrawer } from './EpisodeListDrawer';
import { useSiteSettings } from '@/contexts/SiteSettingsContext';
import shaka from "shaka-player";

interface Episode {
  id: string;
  episode_number: number;
  title?: string;
  thumbnail_url?: string;
}

interface MobileVideoPlayerProps {
  videoUrl: string;
  poster?: string;
  autoplay?: boolean;
  onBack?: () => void;
  title?: string;
  sourceType?: "mp4" | "hls" | "dash";
  episodes?: Episode[];
  currentEpisodeId?: string;
  onEpisodeSelect?: (episode: { id: string; episode_number: number }) => void;
  seriesBackdrop?: string;
}

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export function MobileVideoPlayer({
  videoUrl,
  poster,
  autoplay = false,
  onBack,
  title,
  sourceType = "hls",
  episodes = [],
  currentEpisodeId,
  onEpisodeSelect,
  seriesBackdrop,
}: MobileVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const shakaPlayerRef = useRef<shaka.Player | null>(null);
  const { settings: siteSettings } = useSiteSettings();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [showEpisodesPanel, setShowEpisodesPanel] = useState(false);
  
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup shaka player
  const cleanupPlayer = useCallback(async () => {
    if (shakaPlayerRef.current) {
      try {
        await shakaPlayerRef.current.destroy();
      } catch (e) {
        console.warn('[MobilePlayer] Cleanup error:', e);
      }
      shakaPlayerRef.current = null;
    }
  }, []);

  // Initialize video
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    const initPlayer = async () => {
      setIsLoading(true);
      
      if (sourceType === "mp4") {
        video.src = videoUrl;
        video.load();
      } else {
        // Use Shaka for HLS/DASH
        try {
          await cleanupPlayer();
          
          shaka.polyfill.installAll();
          
          if (!shaka.Player.isBrowserSupported()) {
            // Fallback to native
            video.src = videoUrl;
            video.load();
            return;
          }

          const player = new shaka.Player();
          await player.attach(video);
          shakaPlayerRef.current = player;

          player.configure({
            streaming: {
              bufferingGoal: 15,
              rebufferingGoal: 1,
              bufferBehind: 15,
            },
          });

          await player.load(videoUrl);
          setIsLoading(false);
          
          if (autoplay) {
            try {
              await video.play();
              setIsPlaying(true);
            } catch (e) {
              console.log('[MobilePlayer] Autoplay blocked');
            }
          }
        } catch (e) {
          console.error('[MobilePlayer] Shaka error:', e);
          // Fallback
          video.src = videoUrl;
          video.load();
        }
      }
    };

    initPlayer();

    return () => {
      cleanupPlayer();
    };
  }, [videoUrl, sourceType, autoplay, cleanupPlayer]);

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handleProgress = () => {
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('progress', handleProgress);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('progress', handleProgress);
    };
  }, []);

  // Controls auto-hide
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControls(true);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying]);

  // Add body class when fullscreen
  useEffect(() => {
    if (isFullscreen) {
      document.body.classList.add('mobile-video-fullscreen-active');
    } else {
      document.body.classList.remove('mobile-video-fullscreen-active');
    }
    return () => {
      document.body.classList.remove('mobile-video-fullscreen-active');
    };
  }, [isFullscreen]);

  // Handle fullscreen toggle - SIMPLIFIED for Android native
  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;

    const isNative = Capacitor.isNativePlatform();

    try {
      if (!isFullscreen) {
        // ENTERING FULLSCREEN
        console.log('[MobilePlayer] Entering fullscreen');
        
        if (isNative) {
          // Lock to landscape first
          try {
            await ScreenOrientation.lock({ orientation: 'landscape' });
          } catch (e) {
            console.warn('[MobilePlayer] Orientation lock failed:', e);
          }
        }

        // Add fullscreen class
        container.classList.add('mobile-video-fullscreen');
        document.body.classList.add('mobile-video-fullscreen-active');
        
        // Try web fullscreen API
        try {
          if (container.requestFullscreen) {
            await container.requestFullscreen({ navigationUI: 'hide' });
          } else if ((container as any).webkitRequestFullscreen) {
            await (container as any).webkitRequestFullscreen();
          }
        } catch (e) {
          console.log('[MobilePlayer] Web fullscreen not available');
        }

        setIsFullscreen(true);
      } else {
        // EXITING FULLSCREEN
        console.log('[MobilePlayer] Exiting fullscreen');

        // Remove fullscreen class
        container.classList.remove('mobile-video-fullscreen');
        document.body.classList.remove('mobile-video-fullscreen-active');

        // Exit web fullscreen
        try {
          if (document.fullscreenElement) {
            await document.exitFullscreen();
          } else if ((document as any).webkitExitFullscreen) {
            await (document as any).webkitExitFullscreen();
          }
        } catch (e) {
          console.log('[MobilePlayer] Web fullscreen exit error');
        }

        if (isNative) {
          // Unlock orientation / return to portrait
          try {
            await ScreenOrientation.lock({ orientation: 'portrait' });
            // Delay before unlocking to let portrait take effect
            setTimeout(async () => {
              try {
                await ScreenOrientation.unlock();
              } catch (e) {}
            }, 500);
          } catch (e) {
            console.warn('[MobilePlayer] Orientation unlock failed:', e);
          }
        }

        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('[MobilePlayer] Fullscreen toggle error:', error);
    }
  }, [isFullscreen]);

  // Handle app background - pause video
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listener = App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive && videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    });

    return () => {
      listener.then(l => l.remove());
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.src = '';
      }
      cleanupPlayer();
      
      // Reset orientation on unmount
      if (Capacitor.isNativePlatform()) {
        ScreenOrientation.lock({ orientation: 'portrait' }).catch(() => {});
      }
    };
  }, [cleanupPlayer]);

  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    
    if (video.paused) {
      video.play().catch(console.error);
    } else {
      video.pause();
    }
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  const handleSeek = useCallback((value: number[]) => {
    const video = videoRef.current;
    if (video && value[0] !== undefined) {
      video.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  }, []);

  const skipForward = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = Math.min(video.duration, video.currentTime + 10);
    }
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  const skipBackward = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = Math.max(0, video.currentTime - 10);
    }
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  return (
    <>
      {/* Inject fullscreen styles */}
      <style>{`
        .mobile-video-fullscreen {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100vw !important;
          width: 100dvw !important;
          height: 100vh !important;
          height: 100dvh !important;
          z-index: 99999 !important;
          background: black !important;
        }
        
        .mobile-video-fullscreen video {
          width: 100% !important;
          height: 100% !important;
          object-fit: contain !important;
        }
        
        body.mobile-video-fullscreen-active {
          overflow: hidden !important;
          position: fixed !important;
          width: 100% !important;
          height: 100% !important;
        }
        
        body.mobile-video-fullscreen-active nav,
        body.mobile-video-fullscreen-active [data-bottom-nav],
        body.mobile-video-fullscreen-active header,
        body.mobile-video-fullscreen-active footer {
          display: none !important;
        }
        
        /* Android landscape safe area */
        @media screen and (orientation: landscape) {
          .mobile-video-fullscreen {
            padding-left: env(safe-area-inset-left, 0) !important;
            padding-right: env(safe-area-inset-right, 0) !important;
          }
        }
        
        /* Ensure controls are tappable */
        .mobile-video-controls button {
          pointer-events: auto !important;
          touch-action: manipulation !important;
          min-width: 44px !important;
          min-height: 44px !important;
          z-index: 100010 !important;
          position: relative !important;
        }
      `}</style>

      <div 
        ref={containerRef}
        className="relative w-full aspect-video bg-black"
        onClick={resetControlsTimeout}
      >
        <video
          ref={videoRef}
          className="w-full h-full"
          poster={poster}
          playsInline
          webkit-playsinline="true"
          preload="metadata"
          style={{ objectFit: 'contain' }}
        />

        {/* Loading spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
            <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {/* Controls Overlay */}
        <div 
          className={`mobile-video-controls absolute inset-0 z-30 transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={(e) => {
            if (e.target === e.currentTarget) togglePlayPause();
          }}
        >
          {/* Center controls */}
          <div className="absolute inset-0 flex items-center justify-center gap-8">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={skipBackward}
              className="h-10 w-10 text-white/80 hover:text-white bg-white/5 backdrop-blur-sm rounded-full"
            >
              <SkipBack className="h-4 w-4" fill="currentColor" />
            </Button>
            
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={togglePlayPause}
              className="h-14 w-14 text-white bg-white/10 backdrop-blur-md rounded-full border border-white/20"
            >
              {isPlaying ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5 ml-0.5" fill="currentColor" />}
            </Button>
            
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={skipForward}
              className="h-10 w-10 text-white/80 hover:text-white bg-white/5 backdrop-blur-sm rounded-full"
            >
              <SkipForward className="h-4 w-4" fill="currentColor" />
            </Button>
          </div>

          {/* Bottom controls */}
          <div className="absolute bottom-0 left-0 right-0">
            {/* Progress bar - thin */}
            <div className="px-3 pb-1">
              <div className="relative h-[3px] bg-white/15 rounded-full">
                <div 
                  className="absolute h-full bg-white/25 rounded-full" 
                  style={{ width: `${(buffered / duration) * 100}%` }} 
                />
                <Slider
                  value={[currentTime]}
                  max={duration || 100}
                  step={0.1}
                  onValueChange={handleSeek}
                  className="absolute inset-0"
                />
              </div>
            </div>

            {/* Control buttons */}
            <div className="bg-gradient-to-t from-black/70 via-black/40 to-transparent backdrop-blur-[2px] px-3 pb-2 pt-1">
              <div className="flex items-center justify-between">
                {/* Left */}
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={togglePlayPause}
                    className="h-7 w-7 text-white/90 hover:bg-white/10"
                  >
                    {isPlaying ? <Pause className="h-3.5 w-3.5" fill="currentColor" /> : <Play className="h-3.5 w-3.5 ml-0.5" fill="currentColor" />}
                  </Button>
                  
                  <span className="text-white/80 text-xs ml-1 font-light">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                {/* Right */}
                <div className="flex items-center gap-0.5">
                  {/* Episodes button */}
                  {episodes.length > 0 && onEpisodeSelect && (
                    <Button 
                      variant="ghost" 
                      className="h-7 px-2 text-white/90 hover:bg-white/10 flex items-center gap-1"
                      onClick={() => setShowEpisodesPanel(true)}
                    >
                      <span className="text-[10px] font-light">EP</span>
                      <ListVideo className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {/* Fullscreen button - SIMPLIFIED for Android */}
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={toggleFullscreen}
                    className="h-7 w-7 text-white/90 hover:bg-white/10 active:bg-white/20"
                    style={{ 
                      touchAction: 'manipulation',
                      WebkitTapHighlightColor: 'transparent'
                    }}
                  >
                    {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              {/* Site name */}
              {siteSettings?.site_title && (
                <div className="flex justify-end mt-0.5">
                  <span className="text-white/40 text-[8px] font-light tracking-wide">
                    {siteSettings.site_title}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Episodes Panel */}
        {showEpisodesPanel && episodes.length > 0 && onEpisodeSelect && (
          <div className="absolute inset-0 z-[100] flex flex-col justify-end pointer-events-none">
            <div 
              className="absolute inset-0 bg-black/10 pointer-events-auto"
              onClick={() => setShowEpisodesPanel(false)}
            />
            <div className="relative pointer-events-auto">
              <EpisodeListDrawer
                episodes={episodes}
                currentEpisodeId={currentEpisodeId}
                onEpisodeSelect={(episode) => {
                  onEpisodeSelect(episode);
                  setShowEpisodesPanel(false);
                }}
                onClose={() => setShowEpisodesPanel(false)}
                seriesThumbnail={seriesBackdrop}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
