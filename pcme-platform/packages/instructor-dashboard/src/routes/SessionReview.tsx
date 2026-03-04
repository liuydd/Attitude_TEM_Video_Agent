import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useReviewStore } from "@/stores/reviewStore";
import { SessionInfoCard } from "@/components/display/SessionInfoCard";
import { MultiTrackPlayer } from "@/components/player/MultiTrackPlayer";
import { AnnotationList } from "@/components/annotation/AnnotationList";
import { TimeSpanAnnotator } from "@/components/annotation/TimeSpanAnnotator";
import { CbtaScoringForm } from "@/components/scoring/CbtaScoringForm";
import { NasaTlxRadar } from "@/components/scoring/NasaTlxRadar";
import { ArrowLeft, Download } from "lucide-react";

export function SessionReview() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { session, loading, error, fetchSession } = useReviewStore();

  useEffect(() => {
    if (sessionId) fetchSession(sessionId);
  }, [sessionId, fetchSession]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        加载会话数据...
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-red-400">{error ?? "会话未找到"}</div>
        <button
          className="text-blue-400 hover:text-blue-300"
          onClick={() => navigate("/")}
        >
          返回列表
        </button>
      </div>
    );
  }

  const nasaTlx = session.questionnaires.find(
    (q) => q.questionnaire_type === "nasa_tlx"
  );

  return (
    <div className="min-h-screen p-4 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="w-4 h-4" /> 返回
          </button>
          <SessionInfoCard session={session} />
        </div>
        <button
          className="flex items-center gap-1 text-sm text-slate-400 hover:text-white bg-slate-800 px-3 py-1.5 rounded"
          onClick={() => {
            const blob = new Blob(
              [JSON.stringify(session.evaluation, null, 2)],
              { type: "application/json" }
            );
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `evaluation-${session.id}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          disabled={!session.evaluation}
        >
          <Download className="w-4 h-4" /> 导出评估
        </button>
      </div>

      {/* Multi-track player */}
      <MultiTrackPlayer session={session} />

      {/* Bottom section: Annotations + Scoring */}
      <div className="grid grid-cols-12 gap-4 mt-4">
        {/* Annotation panel - 60% */}
        <div className="col-span-7 space-y-3">
          <TimeSpanAnnotator />
          <AnnotationList />
        </div>

        {/* Scoring panel - 40% */}
        <div className="col-span-5 space-y-3">
          <CbtaScoringForm />
          {nasaTlx && <NasaTlxRadar answers={nasaTlx.answers} />}
        </div>
      </div>
    </div>
  );
}
