import { api } from "@/types/api";
import type { ExperimentEvent } from "@/types/event";
import type { RecordingResult } from "./MediaRecorderManager";

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

/**
 * FileUploader - 文件上传器
 *
 * Phase 1: 实验结束后整体上传（localhost 无网络瓶颈）
 * Phase 4: 可切换为 tus 协议分片上传
 */
export class FileUploader {
  /**
   * 上传录制文件
   */
  async uploadRecording(
    sessionId: string,
    recording: RecordingResult,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<{ id: string }> {
    const formData = new FormData();

    // 为 blob 创建有意义的文件名
    const ext = recording.mimeType.includes("webm") ? ".webm" : ".mp4";
    const filename = `${recording.trackType}${ext}`;
    formData.append("file", recording.blob, filename);

    // 使用 XMLHttpRequest 来获取上传进度（fetch 不支持 upload progress）
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(
        "POST",
        `/api/sessions/${sessionId}/recordings/upload?track_type=${recording.trackType}`
      );

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress({
            loaded: e.loaded,
            total: e.total,
            percent: Math.round((e.loaded / e.total) * 100),
          });
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => reject(new Error("Upload network error"));
      xhr.send(formData);
    });
  }

  /**
   * 上传事件日志批次
   */
  async uploadEvents(
    sessionId: string,
    events: ExperimentEvent[]
  ): Promise<{ batch_id: string; event_count: number }> {
    return api
      .post(`sessions/${sessionId}/events`, {
        json: { events },
      })
      .json();
  }

  /**
   * 提交问卷
   */
  async submitQuestionnaire(
    sessionId: string,
    questionnaireType: string,
    answers: Record<string, unknown>
  ): Promise<{ id: string }> {
    return api
      .post(`sessions/${sessionId}/questionnaires`, {
        json: { questionnaire_type: questionnaireType, answers },
      })
      .json();
  }
}

export const fileUploader = new FileUploader();
