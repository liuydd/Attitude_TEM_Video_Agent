import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Square, Clock, Eye, EyeOff } from "lucide-react";

import { VideoPlayer, type DiscussionPoint } from "@/components/VideoPlayer";
import { AttitudeQuestionnaire } from "@/components/AttitudeQuestionnaire";
import { LocalRecorder } from "@/components/LocalRecorder";
import { PhysioSyncButton } from "@/components/PhysioSyncButton";
import { VoiceChatPanel } from "@/components/VoiceChatPanel";
import { timeAnchor } from "@/core/TimeAnchor";
import { eventLogger } from "@/core/EventLogger";
import { MediaRecorderManager } from "@/core/MediaRecorderManager";
import { useExperimentStore } from "@/stores/experimentStore";
import { useVoiceChat } from "@/hooks/useVoiceChat";
import { api } from "@/types/api";

export function ExperimentSession() {
  const navigate = useNavigate();
  const { experiment, session, setRecordingResult, updateSessionStatus } =
    useExperimentStore();

  const [isStarted, setIsStarted] = useState(false);
  const [videoTime, setVideoTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorderManager | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [codecSupported, setCodecSupported] = useState(true);
  const [showCameraPreview, setShowCameraPreview] = useState(false);
  const [discussionPoints, setDiscussionPoints] = useState<DiscussionPoint[]>([]);
  const [pendingPoint, setPendingPoint] = useState<DiscussionPoint | null>(null);
  const [topicStage, setTopicStage] = useState<"discussion" | "questionnaire" | null>(null);
  const [completedPointIds, setCompletedPointIds] = useState<number[]>([]);
  const [resumeDiscussionId, setResumeDiscussionId] = useState<number | null>(null);
  const [eegStatus, setEegStatus] = useState("正在检查 BrainLink…");
  const [isEegRecording, setIsEegRecording] = useState(false);
  const EEG_BRIDGE_URL = "http://127.0.0.1:8765";

  const videoTimeRef = useRef(0);
  const voiceChat = useVoiceChat(session?.id ?? "", videoTimeRef);

  // Check codec support on mount
  useEffect(() => {
    const mime = MediaRecorderManager.getSupportedMime();
    if (!mime) {
      setCodecSupported(false);
    }
  }, []);

  useEffect(() => {
    fetch(`${EEG_BRIDGE_URL}/status`)
      .then((r) => r.json())
      .then((data) => setEegStatus(data.connected ? `已连接 ${data.port}` : "桥接程序未连接头箍"))
      .catch(() => setEegStatus("桥接程序未启动"));
  }, []);

  // Elapsed timer
  useEffect(() => {
    if (!isStarted) return;
    const interval = setInterval(() => {
      setElapsed(timeAnchor.elapsed());
    }, 1000);
    return () => clearInterval(interval);
  }, [isStarted]);

  // Redirect if no session
  useEffect(() => {
    if (!session) {
      navigate("/");
    }
  }, [session, navigate]);

  useEffect(() => {
    if (!experiment) return;
    api.get(`experiments/${experiment.id}/discussion-points`).json<{ items: DiscussionPoint[] }>()
      .then((data) => setDiscussionPoints(data.items))
      .catch(() => setDiscussionPoints([]));
  }, [experiment]);

  const submitTopicAttitude = async (answers: Record<string, number>) => {
    if (!session || !pendingPoint) return;
    await api.post(`sessions/${session.id}/questionnaires`, {
      json: { questionnaire_type: `topic_attitude_${pendingPoint.id}`, answers: { discussion_prompt: pendingPoint.prompt, ...answers } },
    });
    eventLogger.log("topic_attitude_submit", { topic_id: pendingPoint.id }, "questionnaire");
    setCompletedPointIds((ids) => [...ids, pendingPoint.id]);
    setResumeDiscussionId(pendingPoint.id);
    setPendingPoint(null);
    setTopicStage(null);
  };

  const handleStart = async () => {
    if (!session) return;

    // 1. Init recorder
    const recorder = new MediaRecorderManager();
    recorderRef.current = recorder;
    try {
      const mediaStream = await recorder.requestMedia();
      setStream(mediaStream);
    } catch (e) {
      alert(`摄像头/麦克风访问失败: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }

    // 2. Anchor timestamp
    const anchor = timeAnchor.start();

    let eegRecording = false;
    try {
      const response = await fetch(`${EEG_BRIDGE_URL}/recordings/start`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: session.id, anchor_timestamp_ms: anchor }),
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "EEG bridge error");
      eegRecording = true;
      setIsEegRecording(true);
      setEegStatus("EEG 原始波形采集中");
    } catch {
      setIsEegRecording(false);
      setEegStatus("EEG 未启动，本次实验不采集 EEG");
    }

    // 3. Start recording
    recorder.start();
    setIsRecording(true);

    // 4. Update session on server
    await api.patch(`sessions/${session.id}`, {
      json: {
        status: "recording",
        anchor_timestamp_ms: anchor,
        started_at: new Date().toISOString(),
      },
    });
    updateSessionStatus("recording");

    eventLogger.log("session_start", { anchor_timestamp_ms: anchor, eeg_recording: eegRecording }, "system");
    setIsStarted(true);
  };

  const handleVideoEnd = useCallback(() => {
    eventLogger.log("video_ended", {}, "video_player");
  }, []);

  const handleStop = async () => {
    if (!recorderRef.current || !session) return;

    // Stop voice chat if active
    if (voiceChat.isEnabled) {
      voiceChat.stop();
    }

    if (isEegRecording) {
      try {
        const response = await fetch(`${EEG_BRIDGE_URL}/recordings/stop`, { method: "POST" });
        const result = await response.json();
        setEegStatus(`EEG 已保存：${result.sample_count ?? 0} 个原始采样`);
      } catch (e) {
        setEegStatus(`EEG 停止请求失败：${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsEegRecording(false);
      }
    }

    // Stop recording
    const result = await recorderRef.current.stop();
    setIsRecording(false);
    setRecordingResult(result);
    recorderRef.current.release();

    eventLogger.log("session_end", { total_events: eventLogger.count, eeg_recording: isEegRecording }, "system");

    // Update session status
    await api.patch(`sessions/${session.id}`, {
      json: { status: "questionnaire" },
    });
    updateSessionStatus("questionnaire");

    navigate("/post-attitude-questionnaire");
  };

  if (!experiment || !session) return null;

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    return `${String(h).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold">{experiment.name}</h1>
          <span className="text-xs text-gray-400">
            {experiment.group_type === "control" ? "对照组" : "实验组"} ·
            会话 {session.id.slice(0, 8)}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {isStarted && (
            <div className="flex items-center gap-1 text-sm text-gray-300">
              <Clock className="w-4 h-4" />
              {formatTime(elapsed)}
            </div>
          )}
          {isStarted && (
            <PhysioSyncButton />
          )}
        </div>
      </div>

      {!codecSupported && (
        <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-200 px-4 py-2 rounded mb-4">
          当前浏览器不支持 WebM 录制，请使用 Chrome 浏览器
        </div>
      )}

      {/* Main content */}
      <div className="grid grid-cols-4 gap-4" style={{ height: "calc(100vh - 120px)" }}>
        {/* Video player - 3/4 width */}
        <div className="col-span-3">
          <VideoPlayer
            src={`/training-videos/${experiment.training_video_filename}`}
            onTimeUpdate={(t) => {
              setVideoTime(t);
              videoTimeRef.current = t;
            }}
            onEnded={handleVideoEnd}
            discussionPoints={discussionPoints}
            completedDiscussionIds={completedPointIds}
            resumeDiscussionId={resumeDiscussionId}
            onDiscussionPoint={(point) => {
              eventLogger.log("discussion_pause", { topic_id: point.id, prompt: point.prompt }, "video_player");
              setResumeDiscussionId(null);
              setPendingPoint(point);
              setTopicStage("discussion");
            }}
          />
          <div className="mt-2 text-xs text-gray-500">
            视频进度: {videoTime.toFixed(1)}s · 事件数: {eventLogger.count}
          </div>
          {pendingPoint && topicStage === "discussion" && (
            <div className="mt-3 rounded-lg border border-amber-500/60 bg-amber-950/40 p-4">
              <p className="font-medium text-amber-100">Topic {pendingPoint.id}：视频已暂停</p>
              <p className="mt-2 text-sm text-amber-50">{pendingPoint.prompt}</p>
              <p className="mt-3 text-xs text-amber-200/80">请使用右侧“开始对话”按钮与 AI 讨论；讨论结束后再填写问卷。</p>
              <button type="button" onClick={() => { eventLogger.log("discussion_complete", { topic_id: pendingPoint.id }, "discussion"); setTopicStage("questionnaire"); }} className="mt-3 rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700">讨论完成，填写问卷</button>
            </div>
          )}
        </div>

        {/* Right sidebar - 1/4 width */}
        <div className="flex flex-col gap-3 min-h-0">
          {/* Camera preview with toggle */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">
                {isRecording ? "录制中" : "录制预览"}
              </span>
              <button
                onClick={() => setShowCameraPreview(!showCameraPreview)}
                className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors"
                title={showCameraPreview ? "隐藏摄像头预览" : "显示摄像头预览"}
              >
                {showCameraPreview ? (
                  <><EyeOff className="w-3 h-3" />隐藏</>
                ) : (
                  <><Eye className="w-3 h-3" />显示</>
                )}
              </button>
            </div>
            {showCameraPreview ? (
              <LocalRecorder stream={stream} isRecording={isRecording} />
            ) : (
              <div className="flex items-center justify-center h-8 bg-gray-900 rounded-lg border border-gray-700 text-xs text-gray-500">
                {isRecording && (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    录制进行中
                  </span>
                )}
                {!isRecording && "摄像头预览已隐藏"}
              </div>
            )}
          </div>

          {/* Voice chat panel - fills remaining space */}
          {isStarted && (
            <div className="flex-1 min-h-0">
              <VoiceChatPanel
                isEnabled={voiceChat.isEnabled}
                connectionStatus={voiceChat.connectionStatus}
                voiceMode={voiceChat.voiceMode}
                turns={voiceChat.turns}
                currentPartialTranscript={voiceChat.currentPartialTranscript}
                currentPartialSpeaker={voiceChat.currentPartialSpeaker}
                isAiSpeaking={voiceChat.isAiSpeaking}
                activeSpeaker={voiceChat.activeSpeaker}
                onStart={voiceChat.start}
                onStop={voiceChat.stop}
                onInterrupt={voiceChat.interrupt}
                onSwitchSpeaker={voiceChat.switchSpeaker}
              />
            </div>
          )}

          {/* Controls */}
          {!isStarted ? (
            <button
              onClick={handleStart}
              disabled={!codecSupported}
              className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors"
            >
              <Play className="w-5 h-5" />
              开始实验
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="w-full flex items-center justify-center gap-2 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              <Square className="w-5 h-5" />
              结束实验
            </button>
          )}

          <div className="bg-gray-900 rounded-lg p-3 text-xs text-gray-400 space-y-1">
            <p>状态: {session.status}</p>
            <p>锚点: {timeAnchor.isStarted ? timeAnchor.anchorMs : "未设置"}</p>
            <p>录制: {isRecording ? "进行中" : "未开始"}</p>
            <p>EEG: {eegStatus}</p>
          </div>
        </div>
      </div>
      {pendingPoint && topicStage === "questionnaire" && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-6">
          <div className="mx-auto max-w-3xl rounded-lg bg-gray-900 p-6">
            <h2 className="mb-3 text-xl font-bold">Topic {pendingPoint.id}：态度测量</h2>
            <p className="mb-6 rounded bg-gray-800 p-4 text-gray-200">{pendingPoint.prompt}</p>
            <p className="mb-4 text-sm text-gray-400">请根据刚才与 AI 的讨论填写。提交后视频将自动继续播放。</p>
            <AttitudeQuestionnaire title="请评价本主题及当前的 AI 整体表现" topic overall onSubmit={submitTopicAttitude} />
          </div>
        </div>
      )}
    </div>
  );
}
