import { useState } from "react";
import { useReviewStore } from "@/stores/reviewStore";
import { CBTA_DIMENSIONS, CBTA_LABELS, RATING_LABELS } from "@/types/evaluation";
import { CompetencyBadge } from "./CompetencyBadge";

export function AnnotationForm() {
  const { draftStart, draftEnd, addAnnotation } = useReviewStore();
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>([]);
  const [rating, setRating] = useState(3);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const canSubmit =
    draftStart != null &&
    draftEnd != null &&
    draftEnd > draftStart &&
    selectedDimensions.length > 0;

  const toggleDimension = (dim: string) => {
    setSelectedDimensions((prev) =>
      prev.includes(dim) ? prev.filter((d) => d !== dim) : [...prev, dim]
    );
  };

  const handleSubmit = async () => {
    if (!canSubmit || draftStart == null || draftEnd == null) return;
    setSaving(true);
    try {
      await addAnnotation({
        start_time: Math.min(draftStart, draftEnd),
        end_time: Math.max(draftStart, draftEnd),
        competencies: selectedDimensions,
        rating,
        comment,
      });
      setSelectedDimensions([]);
      setRating(3);
      setComment("");
    } finally {
      setSaving(false);
    }
  };

  if (draftStart == null || draftEnd == null) {
    return (
      <div className="text-xs text-slate-500 py-2">
        请先在时间轴上设置标注的起点和终点
      </div>
    );
  }

  return (
    <div className="bg-slate-800/40 rounded p-3 space-y-3">
      <div className="text-xs text-slate-400">
        标注区间: {Math.min(draftStart, draftEnd).toFixed(1)}s -{" "}
        {Math.max(draftStart, draftEnd).toFixed(1)}s
      </div>

      {/* Competency selection */}
      <div>
        <div className="text-xs text-slate-400 mb-1">胜任力维度 (可多选)</div>
        <div className="flex flex-wrap gap-1.5">
          {CBTA_DIMENSIONS.map((dim) => (
            <CompetencyBadge
              key={dim}
              dimension={dim}
              label={CBTA_LABELS[dim]}
              selected={selectedDimensions.includes(dim)}
              onClick={() => toggleDimension(dim)}
            />
          ))}
        </div>
      </div>

      {/* Rating */}
      <div>
        <div className="text-xs text-slate-400 mb-1">评级</div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((r) => (
            <button
              key={r}
              className={`w-10 h-8 rounded text-xs font-medium transition-colors ${
                rating === r
                  ? "bg-blue-600 text-white"
                  : "bg-slate-700 text-slate-400 hover:bg-slate-600"
              }`}
              onClick={() => setRating(r)}
              title={RATING_LABELS[r]}
            >
              {r}
            </button>
          ))}
          <span className="text-xs text-slate-500 self-center ml-1">
            {RATING_LABELS[rating]}
          </span>
        </div>
      </div>

      {/* Comment */}
      <div>
        <textarea
          className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-xs resize-none h-16"
          placeholder="备注（可选）"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>

      <button
        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs px-4 py-2 rounded transition-colors"
        disabled={!canSubmit || saving}
        onClick={handleSubmit}
      >
        {saving ? "保存中..." : "添加标注"}
      </button>
    </div>
  );
}
