import { X, Play, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRef } from "react";

interface Episode {
  id: string;
  episode_number: number;
  title?: string;
  thumbnail_url?: string;
}

interface EpisodeListDrawerProps {
  episodes: Episode[];
  currentEpisodeId?: string;
  onEpisodeSelect: (episode: Episode) => void;
  onClose: () => void;
  seriesThumbnail?: string;
}

export const EpisodeListDrawer = ({
  episodes,
  currentEpisodeId,
  onEpisodeSelect,
  onClose,
  seriesThumbnail,
}: EpisodeListDrawerProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[60] bg-white/5 backdrop-blur-[2px] animate-in slide-in-from-bottom duration-300 border-t border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-1.5">
        <span className="text-white font-medium text-sm">Episodes</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-7 w-7 text-white hover:bg-white/10 rounded-full"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Episode List */}
      <div className="relative px-2 py-2">
        {/* Left Arrow */}
        <Button
          variant="ghost"
          size="icon"
          onClick={scrollLeft}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 text-white bg-black/30 hover:bg-black/50 rounded-full"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        {/* Scrollable Container */}
        <div 
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide px-10"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {episodes.map((episode) => {
            const isActive = episode.id === currentEpisodeId;
            // Use episode thumbnail if available, otherwise fall back to series backdrop
            const thumbnail = episode.thumbnail_url || seriesThumbnail;

            return (
              <button
                key={episode.id}
                onClick={() => {
                  onEpisodeSelect(episode);
                  onClose();
                }}
                className={`relative flex-shrink-0 w-24 aspect-video rounded-lg overflow-hidden group transition-all ${
                  isActive ? 'ring-2 ring-primary' : 'hover:ring-2 hover:ring-white/50'
                }`}
              >
                {/* Thumbnail */}
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: thumbnail
                      ? `url(${thumbnail})`
                      : 'linear-gradient(135deg, #374151, #1f2937)',
                  }}
                />
                
                {/* Overlay */}
                <div className={`absolute inset-0 ${isActive ? 'bg-primary/20' : 'bg-black/30 group-hover:bg-black/20'} transition-all`} />

                {/* Now Badge for Active Episode */}
                {isActive && (
                  <div className="absolute top-1 left-1 bg-primary text-primary-foreground rounded px-1.5 py-0.5 text-[9px] font-medium flex items-center gap-0.5">
                    <Check className="h-2.5 w-2.5" />
                    Now
                  </div>
                )}

                {/* Episode Number - Large bold styling */}
                <div className="absolute bottom-1 left-1.5 text-white font-bold text-xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  {episode.episode_number}
                </div>

                {/* Play Icon (not shown on active) */}
                {!isActive && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Play className="h-7 w-7 text-white opacity-90 group-hover:opacity-100 transition-opacity drop-shadow-lg" fill="white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Right Arrow */}
        <Button
          variant="ghost"
          size="icon"
          onClick={scrollRight}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 text-white bg-black/30 hover:bg-black/50 rounded-full"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};
