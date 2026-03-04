import { RATING_LABELS, type CbtaDimension } from "@/types/evaluation";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  dimension: CbtaDimension;
  label: string;
  score: number;
  comment: string;
  onScoreChange: (score: number) => void;
  onCommentChange: (comment: string) => void;
}

export function DimensionScoreCard({
  label,
  score,
  comment,
  onScoreChange,
  onCommentChange,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-slate-700/40 rounded p-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-300">{label}</span>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((r) => (
            <button
              key={r}
              className={`w-7 h-6 rounded text-[10px] font-medium transition-colors ${
                score === r
                  ? "bg-blue-600 text-white"
                  : "bg-slate-600 text-slate-400 hover:bg-slate-500"
              }`}
              onClick={() => onScoreChange(r)}
              title={RATING_LABELS[r]}
            >
              {r}
            </button>
          ))}
          <button
            className="ml-1 p-0.5 text-slate-500 hover:text-slate-300"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>
      {expanded && (
        <input
          className="mt-1.5 w-full bg-slate-600/50 border border-slate-600 rounded px-2 py-1 text-[10px]"
          placeholder="评分备注..."
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
        />
      )}
    </div>
  );
}
