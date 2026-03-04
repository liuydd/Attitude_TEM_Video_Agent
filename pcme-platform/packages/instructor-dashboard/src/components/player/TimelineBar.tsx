import { useReviewStore } from "@/stores/reviewStore";
import type { Annotation } from "@/types/evaluation";
import type { ExperimentEvent } from "@/types/session";

interface Props {
  events: ExperimentEvent[];
  anchorMs: number | null;
  annotations: Annotation[];
  onSeek: (time: number) => void;
}

export function TimelineBar({ events, anchorMs, annotations, onSeek }: Props) {
  const { currentTime, duration, draftStart, draftEnd } = useReviewStore();
  if (duration <= 0) return null;

  const pct = (t: number) => `${(t / duration) * 100}%`;

  // Convert event ts_abs to camera-relative seconds
  const eventDots =
    anchorMs != null
      ? events
          .filter((e) => e.ts_abs > 0)
          .map((e) => ({
            cameraTime: (e.ts_abs - anchorMs) / 1000,
            type: e.event_type,
          }))
          .filter((d) => d.cameraTime >= 0 && d.cameraTime <= duration)
      : [];

  return (
    <div className="relative bg-slate-800 rounded h-10 overflow-hidden cursor-pointer">
      {/* Annotation ranges */}
      {annotations.map((ann) => (
        <div
          key={ann.id}
          className="absolute top-0 h-full bg-blue-500/20 border-l border-r border-blue-400/40"
          style={{
            left: pct(ann.start_time),
            width: pct(ann.end_time - ann.start_time),
          }}
          title={`${ann.start_time.toFixed(1)}s - ${ann.end_time.toFixed(1)}s (${ann.competencies.join(", ")})`}
          onClick={(e) => {
            e.stopPropagation();
            onSeek(ann.start_time);
          }}
        />
      ))}

      {/* Draft range */}
      {draftStart != null && draftEnd != null && (
        <div
          className="absolute top-0 h-full bg-yellow-500/25 border-l border-r border-yellow-400/50"
          style={{
            left: pct(Math.min(draftStart, draftEnd)),
            width: pct(Math.abs(draftEnd - draftStart)),
          }}
        />
      )}

      {/* Event dots — positioned by camera time */}
      {eventDots.map((d, i) => (
        <div
          key={i}
          className="absolute bottom-1 w-1 h-1 rounded-full bg-slate-400/60"
          style={{ left: pct(d.cameraTime) }}
          title={`${d.type} @ ${d.cameraTime.toFixed(1)}s`}
        />
      ))}

      {/* Playhead */}
      <div
        className="absolute top-0 h-full w-0.5 bg-red-500 z-10"
        style={{ left: pct(currentTime) }}
      />

      {/* Click area */}
      <div
        className="absolute inset-0 z-20"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientX - rect.left) / rect.width;
          onSeek(ratio * duration);
        }}
      />
    </div>
  );
}
