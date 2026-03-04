import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { QuestionnaireForm } from "@/components/QuestionnaireForm";
import { eventLogger } from "@/core/EventLogger";
import { useExperimentStore } from "@/stores/experimentStore";
import { api } from "@/types/api";

export function Questionnaire() {
  const navigate = useNavigate();
  const { session, updateSessionStatus } = useExperimentStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!session) {
    navigate("/");
    return null;
  }

  const handleSubmit = async (answers: Record<string, number>) => {
    setIsSubmitting(true);
    try {
      // Log questionnaire submission event
      eventLogger.log(
        "questionnaire_submit",
        { questionnaire_type: "nasa_tlx" },
        "questionnaire"
      );

      // Submit to server
      await api.post(`sessions/${session.id}/questionnaires`, {
        json: {
          questionnaire_type: "nasa_tlx",
          answers,
        },
      });

      // Update session status
      await api.patch(`sessions/${session.id}`, {
        json: { status: "uploading" },
      });
      updateSessionStatus("uploading");

      navigate("/complete");
    } catch (e) {
      alert(`提交失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-gray-900 p-6 rounded-lg">
        <QuestionnaireForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
      </div>
    </div>
  );
}
