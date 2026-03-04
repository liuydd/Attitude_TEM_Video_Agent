export interface ExperimentEvent {
  seq: number;
  ts_abs: number; // absolute timestamp in ms (Date.now())
  ts_video: number; // video currentTime in seconds
  event_type: string;
  payload: Record<string, unknown>;
  source: string;
}

export type EventType =
  | "video_state_change"
  | "video_seeked"
  | "video_time_update"
  | "recording_start"
  | "recording_stop"
  | "physio_sync"
  | "session_start"
  | "session_end"
  | "questionnaire_submit"
  | "custom";
