import { useRef, useEffect } from "react";
import type { ConversationTurn } from "@/types/session";

interface Props {
  conversation: ConversationTurn[];
  anchorMs: number | null;
  currentTime: number;
  onSeek: (time: number) => void;
}

function turnToSeconds(turn: ConversationTurn, anchorMs: number | null): number | null {
  if (!turn.timestamp || anchorMs == null) return null;
  const turnMs = new Date(turn.timestamp).getTime();
  if (isNaN(turnMs)) return null;
  return (turnMs - anchorMs) / 1000;
}

const SPEAKER_STYLES: { label: string; color: string }[] = [
  { label: "说话人 A", color: "text-green-400" },
  { label: "说话人 B", color: "text-amber-400" },
];

export function ConversationPanel({
  conversation,
  anchorMs,
  currentTime,
  onSeek,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  // Detect mode: control group turns have `text` field, experimental have `user_text`
  const isControlMode = conversation.length > 0 && "text" in conversation[0]! && !("user_text" in conversation[0]!);

  // Auto-scroll to active turn
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentTime]);

  if (conversation.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="text-xs text-slate-400 mb-1">对话记录</div>
        <div className="flex-1 bg-slate-800 rounded flex items-center justify-center text-slate-500 text-xs">
          无对话数据
        </div>
      </div>
    );
  }

  // Find the active turn index
  let activeIndex = -1;
  for (let i = conversation.length - 1; i >= 0; i--) {
    const sec = turnToSeconds(conversation[i]!, anchorMs);
    if (sec != null && sec <= currentTime) {
      activeIndex = i;
      break;
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="text-xs text-slate-400 mb-1">
        对话记录
        {isControlMode && (
          <span className="text-slate-500 ml-1">(人人交互)</span>
        )}
      </div>
      <div
        ref={containerRef}
        className="flex-1 bg-slate-800 rounded overflow-y-auto p-3 space-y-3 max-h-[280px]"
      >
        {conversation.map((turn, i) => {
          const sec = turnToSeconds(turn, anchorMs);
          const isActive = i === activeIndex;
          return (
            <div
              key={turn.turn_id || i}
              ref={isActive ? activeRef : undefined}
              className={`text-xs cursor-pointer transition-colors ${
                isActive ? "bg-blue-900/30 rounded p-2 -mx-1" : "opacity-70 hover:opacity-100"
              }`}
              onClick={() => sec != null && onSeek(sec)}
            >
              {isControlMode ? (
                /* Control group: single utterance with speaker index */
                <div>
                  <span
                    className={`font-medium ${
                      SPEAKER_STYLES[(turn.speaker ?? 0) % 2]?.color ?? "text-slate-400"
                    }`}
                  >
                    {SPEAKER_STYLES[(turn.speaker ?? 0) % 2]?.label ?? `说话人 ${turn.speaker}`}:{" "}
                  </span>
                  <span className="text-slate-300">{turn.text}</span>
                </div>
              ) : (
                /* Experimental group: user + assistant pair */
                <>
                  {turn.user_text && (
                    <div className="mb-1">
                      <span className="text-green-400 font-medium">学员: </span>
                      <span className="text-slate-300">{turn.user_text}</span>
                    </div>
                  )}
                  {turn.assistant_text && (
                    <div>
                      <span className="text-blue-400 font-medium">Agent: </span>
                      <span className="text-slate-300">{turn.assistant_text}</span>
                    </div>
                  )}
                </>
              )}
              {sec != null && (
                <div className="text-slate-500 text-[10px] mt-0.5">
                  @ {sec.toFixed(1)}s
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
