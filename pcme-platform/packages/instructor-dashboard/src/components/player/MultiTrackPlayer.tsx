import { useRef, useEffect, useCallback, useMemo } from "react";
import { useReviewStore } from "@/stores/reviewStore";
import type { SessionDetail, ExperimentEvent } from "@/types/session";
import { SyncVideoPlayer } from "./SyncVideoPlayer";
import { PlaybackControls } from "./PlaybackControls";
import { TimelineBar } from "./TimelineBar";
import { ConversationPanel } from "./ConversationPanel";
import { PhysioChart } from "./PhysioChart";

interface Props {
  session: SessionDetail;
}

/**
 * Build a sorted lookup table: cameraTime → trainingVideoTime.
 *
 * During the experiment the training video may be paused, seeked, or rewound,
 * so its timeline is NOT monotonic.  The camera recording, however, runs
 * continuously from start to end and IS monotonic.
 *
 * Every logged event carries both `ts_abs` (absolute Unix ms) and `ts_video`
 * (training-video position in seconds at that moment).  We convert ts_abs to
 * camera-relative seconds via the anchor timestamp, giving us a mapping from
 * the camera timeline to the training-video position.
 */
function buildTimeMap(
  events: ExperimentEvent[],
  anchorMs: number | null
): { cam: number; vid: number }[] {
  if (anchorMs == null) return [];
  const pairs: { cam: number; vid: number }[] = [];
  for (const e of events) {
    if (e.ts_abs > 0 && e.ts_video >= 0) {
      pairs.push({
        cam: (e.ts_abs - anchorMs) / 1000,
        vid: e.ts_video,
      });
    }
  }
  pairs.sort((a, b) => a.cam - b.cam);
  // Deduplicate very close camera-time entries (keep latest)
  const deduped: { cam: number; vid: number }[] = [];
  for (const p of pairs) {
    if (deduped.length > 0 && Math.abs(p.cam - deduped[deduped.length - 1]!.cam) < 0.05) {
      deduped[deduped.length - 1] = p;
    } else {
      deduped.push(p);
    }
  }
  return deduped;
}

/** Given a camera time, look up the corresponding training-video time. */
function lookupVideoTime(
  timeMap: { cam: number; vid: number }[],
  cameraTime: number
): number | null {
  if (timeMap.length === 0) return null;
  // Before first event
  if (cameraTime <= timeMap[0]!.cam) return timeMap[0]!.vid;
  // After last event
  if (cameraTime >= timeMap[timeMap.length - 1]!.cam) {
    return timeMap[timeMap.length - 1]!.vid;
  }
  // Binary search for surrounding pair
  let lo = 0;
  let hi = timeMap.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (timeMap[mid]!.cam <= cameraTime) lo = mid;
    else hi = mid;
  }
  const a = timeMap[lo]!;
  const b = timeMap[hi]!;
  const ratio = (cameraTime - a.cam) / (b.cam - a.cam);
  return a.vid + ratio * (b.vid - a.vid);
}

export function MultiTrackPlayer({ session }: Props) {
  const cameraRef = useRef<HTMLVideoElement | null>(null);
  const trainingRef = useRef<HTMLVideoElement | null>(null);
  const syncInterval = useRef<ReturnType<typeof setInterval>>();

  const {
    currentTime,
    playing,
    playbackRate,
    setCurrentTime,
    setDuration,
    setPlaying,
  } = useReviewStore();

  const trainingVideoUrl = session.training_video_filename
    ? `/training-videos/${session.training_video_filename}`
    : null;
  const cameraRecording = session.recordings.find(
    (r) => r.track_type === "camera"
  );
  const cameraUrl = cameraRecording ? `/${cameraRecording.file_path}` : null;

  // Build camera→training time map from events
  const timeMap = useMemo(
    () => buildTimeMap(session.events, session.anchor_timestamp_ms),
    [session.events, session.anchor_timestamp_ms]
  );

  // Fallback duration from session timestamps (WebM files often lack duration metadata)
  const fallbackDuration = useMemo(() => {
    if (session.started_at && session.ended_at) {
      const t0 = new Date(session.started_at).getTime();
      const t1 = new Date(session.ended_at).getTime();
      if (!isNaN(t0) && !isNaN(t1) && t1 > t0) return (t1 - t0) / 1000;
    }
    // Last resort: derive from event log span
    if (timeMap.length >= 2) {
      return timeMap[timeMap.length - 1]!.cam;
    }
    return 0;
  }, [session.started_at, session.ended_at, timeMap]);

  // Set fallback duration on mount (before video loads)
  useEffect(() => {
    if (fallbackDuration > 0) setDuration(fallbackDuration);
  }, [fallbackDuration, setDuration]);

  // ---- Master clock: camera recording timeupdate → store ----
  const handleTimeUpdate = useCallback(() => {
    if (cameraRef.current) {
      setCurrentTime(cameraRef.current.currentTime);
    }
  }, [setCurrentTime]);

  const handleDurationAvailable = useCallback(() => {
    if (cameraRef.current) {
      const d = cameraRef.current.duration;
      if (isFinite(d) && d > 0) setDuration(d);
    }
  }, [setDuration]);

  // ---- Slave sync: training video follows camera via timeMap ----
  useEffect(() => {
    syncInterval.current = setInterval(() => {
      if (trainingRef.current && cameraRef.current) {
        const targetVideoTime = lookupVideoTime(
          timeMap,
          cameraRef.current.currentTime
        );
        if (targetVideoTime != null) {
          const drift = Math.abs(
            trainingRef.current.currentTime - targetVideoTime
          );
          if (drift > 0.5) {
            trainingRef.current.currentTime = targetVideoTime;
          }
        }
      }
    }, 500);
    return () => clearInterval(syncInterval.current);
  }, [timeMap]);

  // Sync playback rate
  useEffect(() => {
    if (cameraRef.current) cameraRef.current.playbackRate = playbackRate;
    if (trainingRef.current) trainingRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  // Play/Pause
  useEffect(() => {
    const cam = cameraRef.current;
    const training = trainingRef.current;
    if (playing) {
      cam?.play().catch(() => {});
      training?.play().catch(() => {});
    } else {
      cam?.pause();
      training?.pause();
    }
  }, [playing]);

  const handleSeek = useCallback(
    (time: number) => {
      // Seek camera (master)
      if (cameraRef.current) cameraRef.current.currentTime = time;
      // Seek training video to corresponding position
      if (trainingRef.current) {
        const targetVideoTime = lookupVideoTime(timeMap, time);
        if (targetVideoTime != null) {
          trainingRef.current.currentTime = targetVideoTime;
        }
      }
      setCurrentTime(time);
    },
    [setCurrentTime, timeMap]
  );

  const handleEnded = useCallback(() => {
    setPlaying(false);
  }, [setPlaying]);

  // Compute the training video time for display
  const trainingVideoTime = lookupVideoTime(timeMap, currentTime);

  return (
    <div className="flex flex-col gap-3">
      {/* Video row */}
      <div className="grid grid-cols-12 gap-3">
        {/* Camera recording - main timeline, 50% */}
        <div className="col-span-6">
          <div className="text-xs text-slate-400 mb-1">
            学员录像
            <span className="text-slate-500 ml-1">(主时间轴)</span>
          </div>
          {cameraUrl ? (
            <SyncVideoPlayer
              ref={cameraRef}
              src={cameraUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleDurationAvailable}
              onDurationChange={handleDurationAvailable}
              onEnded={handleEnded}
            />
          ) : (
            <div className="aspect-video bg-slate-800 rounded flex items-center justify-center text-slate-500">
              无学员录像
            </div>
          )}
        </div>
        {/* Training video - follows camera, 25% */}
        <div className="col-span-3">
          <div className="text-xs text-slate-400 mb-1">
            训练视频
            {trainingVideoTime != null && (
              <span className="text-slate-500 ml-1">
                @ {trainingVideoTime.toFixed(1)}s
              </span>
            )}
          </div>
          {trainingVideoUrl ? (
            <SyncVideoPlayer ref={trainingRef} src={trainingVideoUrl} muted />
          ) : (
            <div className="aspect-video bg-slate-800 rounded flex items-center justify-center text-slate-500 text-xs">
              无训练视频
            </div>
          )}
        </div>
        {/* Conversation - 25% */}
        <div className="col-span-3">
          <ConversationPanel
            conversation={session.conversation}
            anchorMs={session.anchor_timestamp_ms}
            currentTime={currentTime}
            onSeek={handleSeek}
          />
        </div>
      </div>

      {/* Controls */}
      <PlaybackControls onSeek={handleSeek} />

      {/* Timeline — uses camera time for events */}
      <TimelineBar
        events={session.events}
        anchorMs={session.anchor_timestamp_ms}
        annotations={session.evaluation?.annotations ?? []}
        onSeek={handleSeek}
      />

      {/* Physio chart — always visible (placeholder when no data) */}
      <PhysioChart
        events={session.events}
        anchorMs={session.anchor_timestamp_ms}
        currentTime={currentTime}
        physio={session.physio}
      />
    </div>
  );
}
