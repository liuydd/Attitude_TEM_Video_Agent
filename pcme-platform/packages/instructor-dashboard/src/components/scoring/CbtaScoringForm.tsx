import { useState, useEffect } from "react";
import { useReviewStore } from "@/stores/reviewStore";
import {
  CBTA_DIMENSIONS,
  CBTA_LABELS,
  type CbtaDimension,
  type DimensionScore,
} from "@/types/evaluation";
import { DimensionScoreCard } from "./DimensionScoreCard";
import { Save } from "lucide-react";

export function CbtaScoringForm() {
  const { session, saveEvaluation } = useReviewStore();
  const evaluation = session?.evaluation;

  const [instructorName, setInstructorName] = useState("");
  const [scores, setScores] = useState<Record<string, DimensionScore>>({});
  const [overallComment, setOverallComment] = useState("");
  const [saving, setSaving] = useState(false);

  // Sync from loaded evaluation
  useEffect(() => {
    if (evaluation) {
      setInstructorName(evaluation.instructor_name);
      setScores(evaluation.dimension_scores);
      setOverallComment(evaluation.overall_comment);
    }
  }, [evaluation]);

  const handleScoreChange = (dim: string, score: number) => {
    setScores((prev) => ({
      ...prev,
      [dim]: { score, comment: prev[dim]?.comment ?? "" },
    }));
  };

  const handleCommentChange = (dim: string, comment: string) => {
    setScores((prev) => ({
      ...prev,
      [dim]: { score: prev[dim]?.score ?? 3, comment },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveEvaluation({
        instructor_name: instructorName,
        dimension_scores: scores,
        overall_comment: overallComment,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-slate-800/60 rounded p-3">
      <div className="text-xs text-slate-400 mb-3">CBTA 9 维度评分</div>

      {/* Instructor name */}
      <div className="mb-3">
        <input
          className="bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-xs w-full"
          placeholder="教员姓名"
          value={instructorName}
          onChange={(e) => setInstructorName(e.target.value)}
        />
      </div>

      {/* Dimension cards */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {CBTA_DIMENSIONS.map((dim) => (
          <DimensionScoreCard
            key={dim}
            dimension={dim as CbtaDimension}
            label={CBTA_LABELS[dim]}
            score={scores[dim]?.score ?? 0}
            comment={scores[dim]?.comment ?? ""}
            onScoreChange={(s) => handleScoreChange(dim, s)}
            onCommentChange={(c) => handleCommentChange(dim, c)}
          />
        ))}
      </div>

      {/* Overall comment */}
      <div className="mt-3">
        <div className="text-xs text-slate-400 mb-1">总评备注</div>
        <textarea
          className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-xs resize-none h-20"
          placeholder="对学员的整体评价..."
          value={overallComment}
          onChange={(e) => setOverallComment(e.target.value)}
        />
      </div>

      <button
        className="mt-3 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs px-4 py-2 rounded flex items-center justify-center gap-2 transition-colors"
        onClick={handleSave}
        disabled={saving}
      >
        <Save className="w-3.5 h-3.5" />
        {saving ? "保存中..." : "保存评估"}
      </button>
    </div>
  );
}
