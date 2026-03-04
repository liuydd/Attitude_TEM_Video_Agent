export type GroupType = "control" | "experimental";

export type SessionStatus =
  | "created"
  | "started"
  | "recording"
  | "questionnaire"
  | "uploading"
  | "completed"
  | "aborted";

export interface Experiment {
  id: string;
  name: string;
  description: string | null;
  group_type: GroupType;
  training_video_filename: string;
  config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Participant {
  id: string;
  student_id: string;
  name: string;
  age: number | null;
  gender: string | null;
  flight_hours: number | null;
  demographics: Record<string, unknown> | null;
  created_at: string;
}

export interface Session {
  id: string;
  experiment_id: string;
  participant_id: string;
  status: SessionStatus;
  anchor_timestamp_ms: number | null;
  started_at: string | null;
  ended_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
