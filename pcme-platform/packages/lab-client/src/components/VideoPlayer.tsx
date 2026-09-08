import { useEffect, useRef, useCallback } from "react";
import { eventLogger } from "@/core/EventLogger";

interface VideoPlayerProps {
  src: string;
  onTimeUpdate?: (currentTime: number) => void;
  onEnded?: () => void;
  discussionPoints?: DiscussionPoint[];
  completedDiscussionIds?: number[];
  onDiscussionPoint?: (point: DiscussionPoint) => void;
}
export interface DiscussionPoint { id: number; pause_sec: number; prompt: string; }

/**
 * VideoPlayer - 同步视频播放器
 *
 * 挂载全事件监听，所有视频状态变化都通过 EventLogger 打点
 */
export function VideoPlayer({ src, onTimeUpdate, onEnded, discussionPoints = [], completedDiscussionIds = [], onDiscussionPoint }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const triggeredRef = useRef(new Set<number>());

  const logVideoEvent = useCallback(
    (eventType: string, payload: Record<string, unknown>) => {
      eventLogger.log(eventType, payload, "video_player");
    },
    []
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // 设置 EventLogger 的视频时间获取器
    eventLogger.setVideoTimeGetter(() => video.currentTime);

    const handlers: Array<[string, () => void]> = [
      [
        "play",
        () => logVideoEvent("video_state_change", { state: "playing" }),
      ],
      [
        "pause",
        () =>
          logVideoEvent("video_state_change", {
            state: "paused",
            currentTime: video.currentTime,
          }),
      ],
      [
        "seeked",
        () =>
          logVideoEvent("video_seeked", { currentTime: video.currentTime }),
      ],
      [
        "ended",
        () => {
          logVideoEvent("video_state_change", { state: "ended" });
          onEnded?.();
        },
      ],
      [
        "waiting",
        () => logVideoEvent("video_state_change", { state: "buffering" }),
      ],
      [
        "canplay",
        () =>
          logVideoEvent("video_state_change", {
            state: "canplay",
            duration: video.duration,
          }),
      ],
    ];

    // Time update - 节流到每秒一次
    let lastReportedTime = -1;
    const handleTimeUpdate = () => {
      const currentSec = Math.floor(video.currentTime);
      if (currentSec !== lastReportedTime) {
        lastReportedTime = currentSec;
        onTimeUpdate?.(video.currentTime);
      }
      const point = discussionPoints.find(
        (item) =>
          item.pause_sec <= video.currentTime &&
          !triggeredRef.current.has(item.id) &&
          !completedDiscussionIds.includes(item.id)
      );
      if (point) {
        triggeredRef.current.add(point.id);
        video.pause();
        onDiscussionPoint?.(point);
      }
    };

    handlers.forEach(([event, handler]) => video.addEventListener(event, handler));
    video.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      handlers.forEach(([event, handler]) =>
        video.removeEventListener(event, handler)
      );
      video.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [src, logVideoEvent, onTimeUpdate, onEnded, discussionPoints, completedDiscussionIds, onDiscussionPoint]);

  return (
    <div className="relative w-full bg-black rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        src={src}
        controls
        className="w-full h-auto max-h-[70vh]"
        playsInline
      />
    </div>
  );
}
