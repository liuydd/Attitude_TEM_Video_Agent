import { useReviewStore } from "@/stores/reviewStore";
import { Crosshair } from "lucide-react";

export function TimeSpanAnnotator() {
  const { currentTime, duration, draftStart, draftEnd, setDraft } =
    useReviewStore();

  const handleSetStart = () => {
    setDraft(currentTime, draftEnd);
  };

  const handleSetEnd = () => {
    setDraft(draftStart, currentTime);
  };

  const handleClear = () => {
    setDraft(null, null);
  };

  return (
    <div className="bg-slate-800/60 rounded p-3">
      <div className="text-xs text-slate-400 mb-2 flex items-center gap-1">
        <Crosshair className="w-3 h-3" /> 标注时间段
      </div>
      <div className="flex items-center gap-3">
        <button
          className="bg-slate-700 hover:bg-slate-600 text-xs px-3 py-1.5 rounded transition-colors"
          onClick={handleSetStart}
        >
          设起点 ({draftStart != null ? `${draftStart.toFixed(1)}s` : "--"})
        </button>
        <span className="text-slate-500">→</span>
        <button
          className="bg-slate-700 hover:bg-slate-600 text-xs px-3 py-1.5 rounded transition-colors"
          onClick={handleSetEnd}
        >
          设终点 ({draftEnd != null ? `${draftEnd.toFixed(1)}s` : "--"})
        </button>
        {(draftStart != null || draftEnd != null) && (
          <button
            className="text-xs text-slate-500 hover:text-slate-300 ml-2"
            onClick={handleClear}
          >
            清除
          </button>
        )}
        <div className="ml-auto text-xs text-slate-500">
          当前: {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
        </div>
      </div>
    </div>
  );
}
