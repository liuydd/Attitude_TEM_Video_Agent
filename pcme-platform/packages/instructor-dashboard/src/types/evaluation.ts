/** CBTA 9 core competency dimensions. */
export const CBTA_DIMENSIONS = [
  "communication",
  "leadership_teamwork",
  "situation_awareness",
  "problem_solving",
  "workload_management",
  "knowledge_application",
  "flight_path_manual",
  "flight_path_automated",
  "application_of_procedures",
] as const;

export type CbtaDimension = (typeof CBTA_DIMENSIONS)[number];

export const CBTA_LABELS: Record<CbtaDimension, string> = {
  communication: "沟通",
  leadership_teamwork: "领导力与团队合作",
  situation_awareness: "情景意识",
  problem_solving: "问题解决与决策",
  workload_management: "工作负荷管理",
  knowledge_application: "知识应用",
  flight_path_manual: "飞行航径管理(手动)",
  flight_path_automated: "飞行航径管理(自动)",
  application_of_procedures: "程序应用",
};

export const RATING_LABELS: Record<number, string> = {
  1: "不合格",
  2: "待改进",
  3: "合格",
  4: "良好",
  5: "优秀",
};

export interface Annotation {
  id: string;
  start_time: number;
  end_time: number;
  competencies: string[];
  rating: number;
  comment: string;
  created_at: string;
}

export interface DimensionScore {
  score: number;
  comment: string;
}

export interface Evaluation {
  session_id: string;
  instructor_name: string;
  created_at: string;
  updated_at: string;
  annotations: Annotation[];
  dimension_scores: Record<string, DimensionScore>;
  overall_comment: string;
}
