import { useReviewStore } from "@/stores/reviewStore";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";

interface Props {
  onSeek: (time: number) => void;
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "--:--";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const RATES = [0.5, 1, 1.5, 2];

export function PlaybackControls({ onSeek }: Props) {
  const { currentTime, duration, playing, playbackRate, setPlaying, setPlaybackRate } =
    useReviewStore();

  return (
    <div className="flex items-center gap-4 bg-slate-800/60 rounded px-4 py-2">
      <button
        className="p-1 hover:text-blue-400 transition-colors"
        onClick={() => onSeek(Math.max(0, currentTime - 10))}
        title="后退 10 秒"
      >
        <SkipBack className="w-4 h-4" />
      </button>
      <button
        className="p-1 hover:text-blue-400 transition-colors"
        onClick={() => setPlaying(!playing)}
      >
        {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
      </button>
      <button
        className="p-1 hover:text-blue-400 transition-colors"
        onClick={() => onSeek(Math.min(duration, currentTime + 10))}
        title="前进 10 秒"
      >
        <SkipForward className="w-4 h-4" />
      </button>

      {/* Progress bar */}
      <input
        type="range"
        min={0}
        max={duration || 1}
        step={0.1}
        value={currentTime}
        onChange={(e) => onSeek(Number(e.target.value))}
        className="flex-1 h-1.5 accent-blue-500 cursor-pointer"
      />

      {/* Time display */}
      <span className="text-xs text-slate-400 tabular-nums whitespace-nowrap">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>

      {/* Speed selector */}
      <select
        className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs"
        value={playbackRate}
        onChange={(e) => setPlaybackRate(Number(e.target.value))}
      >
        {RATES.map((r) => (
          <option key={r} value={r}>
            {r}x
          </option>
        ))}
      </select>
    </div>
  );
}
