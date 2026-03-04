import type { Evaluation } from "./evaluation";

export interface SessionListItem {
  id: string;
  experiment_id: string;
  experiment_name: string;
  participant_id: string;
  participant_name: string;
  group_type: string;
  status: string;
  has_evaluation: boolean;
  duration_seconds: number | null;
  created_at: string;
}

export interface ConversationTurn {
  turn_id: string;
  /** Experimental group (人机交互): user utterance */
  user_text?: string;
  /** Experimental group (人机交互): agent response */
  assistant_text?: string;
  /** Control group (人人交互): single utterance text */
  text?: string;
  timestamp: string;
  /** Control group: speaker index (0 or 1) */
  speaker?: number | null;
}

export interface RecordingInfo {
  id: string;
  track_type: string;
  file_path: string;
  mime_type: string;
  file_size_bytes: number;
  checksum_sha256: string;
  created_at: string;
}

export interface QuestionnaireInfo {
  id: string;
  questionnaire_type: string;
  answers: Record<string, number>;
  created_at: string;
}

export interface ExperimentEvent {
  seq: number;
  ts_abs: number;
  ts_video: number;
  event_type: string;
  payload: Record<string, unknown>;
  source: string;
}

export interface PhysioDataPoint {
  time: number;
  value: number;
}

export interface PhysioChannel {
  key: string;
  label: string;
  unit: string;
  source: string;
  data: PhysioDataPoint[];
}

export interface PhysioData {
  session_id: string;
  channels: PhysioChannel[];
  has_data: boolean;
}

export interface SessionDetail {
  id: string;
  experiment_id: string;
  experiment_name: string;
  participant_id: string;
  participant_name: string;
  group_type: string;
  status: string;
  anchor_timestamp_ms: number | null;
  started_at: string | null;
  ended_at: string | null;
  training_video_filename: string | null;
  recordings: RecordingInfo[];
  questionnaires: QuestionnaireInfo[];
  conversation: ConversationTurn[];
  events: ExperimentEvent[];
  evaluation: Evaluation | null;
  physio: PhysioData | null;
  created_at: string;
}
