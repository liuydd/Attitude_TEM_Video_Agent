import { useEffect, useRef } from "react";
import { Mic, MicOff, Hand } from "lucide-react";
import type { ChatTurn, VoiceMode } from "@/types/voice";
import type { ConnectionStatus } from "@/core/VoiceWebSocket";

const SPEAKER_COLORS: Record<string, { bg: string; label: string }> = {
  user: { bg: "bg-blue-600 text-white rounded-br-sm", label: "" },
  assistant: { bg: "bg-gray-700 text-gray-100 rounded-bl-sm", label: "" },
  speaker_0: { bg: "bg-emerald-700 text-white rounded-br-sm", label: "说话人 A" },
  speaker_1: { bg: "bg-amber-700 text-white rounded-bl-sm", label: "说话人 B" },
};

interface VoiceChatPanelProps {
  isEnabled: boolean;
  connectionStatus: ConnectionStatus;
  voiceMode: VoiceMode | null;
  turns: ChatTurn[];
  currentPartialTranscript: string;
  currentPartialSpeaker: number | null;
  isAiSpeaking: boolean;
  onStart: () => void;
  onStop: () => void;
  onInterrupt: () => void;
}

function ChatBubble({ turn }: { turn: ChatTurn }) {
  const isRight = turn.role === "user" || turn.role === "speaker_0";
  const style = SPEAKER_COLORS[turn.role] ?? SPEAKER_COLORS.user;

  return (
    <div className={`flex ${isRight ? "justify-end" : "justify-start"} mb-2`}>
      <div className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${style.bg}`}>
        {style.label && (
          <div className="text-[10px] opacity-70 mb-0.5">{style.label}</div>
        )}
        <p className="whitespace-pre-wrap break-words">{turn.text}</p>
        {turn.status === "streaming" && (
          <span className="inline-block w-1.5 h-4 bg-gray-300 animate-pulse ml-0.5 align-text-bottom" />
        )}
        {turn.status === "interrupted" && (
          <span className="text-xs text-gray-400 ml-1">(interrupted)</span>
        )}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: ConnectionStatus }) {
  const colors: Record<ConnectionStatus, string> = {
    idle: "bg-gray-500",
    connecting: "bg-yellow-500 animate-pulse",
    connected: "bg-green-500",
    disconnected: "bg-orange-500",
    error: "bg-red-500",
  };
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${colors[status]}`}
      title={status}
    />
  );
}

export function VoiceChatPanel({
  isEnabled,
  connectionStatus,
  voiceMode,
  turns,
  currentPartialTranscript,
  currentPartialSpeaker,
  isAiSpeaking,
  onStart,
  onStop,
  onInterrupt,
}: VoiceChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns, currentPartialTranscript]);

  const modeLabel = voiceMode === "control" ? "双人对话" : "语音对话";

  // Determine partial transcript bubble style
  const partialIsRight =
    voiceMode === "control"
      ? currentPartialSpeaker !== 1
      : true;
  const partialStyle =
    voiceMode === "control"
      ? currentPartialSpeaker === 1
        ? "bg-amber-700/50 text-amber-200 rounded-bl-sm"
        : "bg-emerald-700/50 text-emerald-200 rounded-br-sm"
      : "bg-blue-600/50 text-blue-200 rounded-br-sm";

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <StatusDot status={connectionStatus} />
          <span>{modeLabel}</span>
        </div>
        {voiceMode === "control" && (
          <div className="flex items-center gap-2 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-600" /> A
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-600" /> B
            </span>
          </div>
        )}
      </div>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {turns.map((turn) => (
          <ChatBubble key={turn.turn_id} turn={turn} />
        ))}

        {/* Partial transcript indicator */}
        {currentPartialTranscript && (
          <div className={`flex ${partialIsRight ? "justify-end" : "justify-start"} mb-2`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${partialStyle} italic`}>
              {currentPartialTranscript}
            </div>
          </div>
        )}

        {!isEnabled && turns.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-600 text-xs">
            点击下方按钮开始{voiceMode === "control" ? "双人对话" : "语音对话"}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-800">
        {!isEnabled ? (
          <button
            onClick={onStart}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
          >
            <Mic className="w-4 h-4" />
            开始{voiceMode === "control" ? "双人对话" : "语音对话"}
          </button>
        ) : (
          <>
            <button
              onClick={onStop}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
            >
              <MicOff className="w-4 h-4" />
              结束对话
            </button>
            {isAiSpeaking && voiceMode === "agent" && (
              <button
                onClick={onInterrupt}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded-lg transition-colors"
              >
                <Hand className="w-4 h-4" />
                打断
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
