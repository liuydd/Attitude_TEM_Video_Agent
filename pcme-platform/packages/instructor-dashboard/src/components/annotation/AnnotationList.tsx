import { useReviewStore } from "@/stores/reviewStore";
import { AnnotationForm } from "./AnnotationForm";
import { CompetencyBadge } from "./CompetencyBadge";
import { CBTA_LABELS, type CbtaDimension } from "@/types/evaluation";
import { Trash2 } from "lucide-react";

export function AnnotationList() {
  const { session, deleteAnnotation } = useReviewStore();
  const annotations = session?.evaluation?.annotations ?? [];

  return (
    <div className="bg-slate-800/60 rounded p-3">
      <div className="text-xs text-slate-400 mb-2">
        时间段标注 ({annotations.length})
      </div>

      {/* Existing annotations */}
      <div className="space-y-2 mb-3 max-h-[300px] overflow-y-auto">
        {annotations.length === 0 && (
          <div className="text-xs text-slate-500 py-2">暂无标注</div>
        )}
        {annotations.map((ann) => (
          <div
            key={ann.id}
            className="bg-slate-700/50 rounded p-2 flex items-start gap-2"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-slate-300 tabular-nums">
                  {ann.start_time.toFixed(1)}s - {ann.end_time.toFixed(1)}s
                </span>
                <span className="text-yellow-400 text-xs">
                  {"★".repeat(ann.rating)}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 mb-1">
                {ann.competencies.map((c) => (
                  <CompetencyBadge
                    key={c}
                    dimension={c}
                    label={CBTA_LABELS[c as CbtaDimension] ?? c}
                    selected
                    onClick={() => {}}
                    small
                  />
                ))}
              </div>
              {ann.comment && (
                <div className="text-xs text-slate-400">{ann.comment}</div>
              )}
            </div>
            <button
              className="text-slate-500 hover:text-red-400 transition-colors p-1"
              onClick={() => deleteAnnotation(ann.id)}
              title="删除标注"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* New annotation form */}
      <AnnotationForm />
    </div>
  );
}
