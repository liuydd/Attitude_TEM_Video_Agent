import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, Upload, Loader2 } from "lucide-react";

import { eventLogger } from "@/core/EventLogger";
import { fileUploader } from "@/core/FileUploader";
import { timeAnchor } from "@/core/TimeAnchor";
import { useExperimentStore } from "@/stores/experimentStore";
import { api } from "@/types/api";

type UploadStep = "events" | "recording" | "done";

export function SessionComplete() {
  const navigate = useNavigate();
  const {
    session,
    recordingResult,
    uploadProgress,
    setUploadProgress,
    updateSessionStatus,
    reset,
  } = useExperimentStore();

  const [currentStep, setCurrentStep] = useState<UploadStep>("events");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      navigate("/");
      return;
    }
    runUpload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runUpload = async () => {
    if (!session) return;

    try {
      // Step 1: Upload events
      setCurrentStep("events");
      const events = eventLogger.getEvents();
      if (events.length > 0) {
        await fileUploader.uploadEvents(session.id, events);
      }

      // Step 2: Upload recording
      setCurrentStep("recording");
      if (recordingResult) {
        await fileUploader.uploadRecording(
          session.id,
          recordingResult,
          (progress) => setUploadProgress(progress.percent)
        );
      }

      // Step 3: Mark session complete
      await api.patch(`sessions/${session.id}`, {
        json: {
          status: "completed",
          ended_at: new Date().toISOString(),
        },
      });
      updateSessionStatus("completed");

      // Cleanup
      eventLogger.clear();
      timeAnchor.reset();

      setCurrentStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleNewExperiment = () => {
    reset();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        {currentStep === "done" ? (
          <>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
            <h1 className="text-2xl font-bold">实验完成</h1>
            <p className="text-gray-400">
              所有数据已成功上传并保存。
            </p>
          </>
        ) : (
          <>
            <Upload className="w-16 h-16 text-blue-500 mx-auto" />
            <h1 className="text-2xl font-bold">正在上传数据...</h1>
          </>
        )}

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-2 rounded text-sm">
            上传失败: {error}
            <button
              onClick={runUpload}
              className="ml-2 underline hover:text-white"
            >
              重试
            </button>
          </div>
        )}

        {/* Progress steps */}
        <div className="bg-gray-900 rounded-lg p-4 space-y-3 text-left text-sm">
          <StepItem
            label="上传事件日志"
            status={
              currentStep === "events"
                ? "active"
                : currentStep === "recording" || currentStep === "done"
                  ? "done"
                  : "pending"
            }
          />
          <StepItem
            label={`上传录制文件${uploadProgress > 0 && currentStep === "recording" ? ` (${uploadProgress}%)` : ""}`}
            status={
              currentStep === "recording"
                ? "active"
                : currentStep === "done"
                  ? "done"
                  : "pending"
            }
          />
          {currentStep === "recording" && uploadProgress > 0 && (
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
        </div>

        {currentStep === "done" && (
          <button
            onClick={handleNewExperiment}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
          >
            开始新实验
          </button>
        )}
      </div>
    </div>
  );
}

function StepItem({
  label,
  status,
}: {
  label: string;
  status: "pending" | "active" | "done";
}) {
  return (
    <div className="flex items-center gap-2">
      {status === "done" && <CheckCircle className="w-4 h-4 text-green-500" />}
      {status === "active" && (
        <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
      )}
      {status === "pending" && (
        <div className="w-4 h-4 rounded-full border border-gray-600" />
      )}
      <span
        className={
          status === "done"
            ? "text-green-400"
            : status === "active"
              ? "text-blue-400"
              : "text-gray-500"
        }
      >
        {label}
      </span>
    </div>
  );
}
