import { useNavigate } from "react-router-dom";
import { AttitudeQuestionnaire } from "@/components/AttitudeQuestionnaire";
import { eventLogger } from "@/core/EventLogger";
import { useExperimentStore } from "@/stores/experimentStore";
import { api } from "@/types/api";

export function PreQuestionnaire() {
  const navigate = useNavigate();
  const { session } = useExperimentStore();
  if (!session) { navigate("/"); return null; }
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="mx-auto max-w-3xl rounded-lg bg-gray-900 p-6">
        <section className="mb-6 rounded-lg border border-blue-900/60 bg-blue-950/30 p-4 text-sm text-gray-200">
          <h1 className="mb-2 text-base font-semibold text-blue-200">即将使用的 AI 助手</h1>
          <p>
            本实验将使用一名支持实时语音交互的 AI 助手。在讨论阶段，您可以通过语音与它围绕视频内容和讨论主题进行交流。
          </p>
          <p className="mt-2">
            该助手会根据当前讨论主题与您的观点进行分析，并给出一定的建议与反馈，您可以与其反复交流直到您对讨论结果满意为止。请注意，该助手的建议仅供参考，您可以根据自己的判断进行采纳或忽略。
          </p>
        </section>
        <AttitudeQuestionnaire
          title="实验前：您对该 AI 助手的预期"
          overall
          expectation
          intro="以下题目用于了解您在实际互动前，对即将使用的 AI 助手的预期。请根据以上介绍作答。"
          onSubmit={async (answers) => {
            await api.post(`sessions/${session.id}/questionnaires`, {
              json: { questionnaire_type: "pre_ai_assistant_expectation", answers },
            });
            eventLogger.log(
              "questionnaire_submit",
              { questionnaire_type: "pre_ai_assistant_expectation" },
              "questionnaire"
            );
            navigate("/session");
          }}
        />
      </div>
    </div>
  );
}
