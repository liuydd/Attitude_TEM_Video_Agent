import { useEffect, useRef } from "react";
import { Camera, CameraOff } from "lucide-react";

interface LocalRecorderProps {
  stream: MediaStream | null;
  isRecording: boolean;
}

/**
 * LocalRecorder - 摄像头预览 + 录制状态指示
 */
export function LocalRecorder({ stream, isRecording }: LocalRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative rounded-lg overflow-hidden bg-gray-900 border border-gray-700">
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-auto"
        />
      ) : (
        <div className="flex items-center justify-center h-32 text-gray-400">
          <CameraOff className="w-8 h-8 mr-2" />
          <span>摄像头未启用</span>
        </div>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-red-600 text-white text-xs px-2 py-1 rounded-full">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          REC
        </div>
      )}

      <div className="absolute bottom-2 left-2 flex items-center gap-1 text-white text-xs bg-black/50 px-2 py-1 rounded">
        <Camera className="w-3 h-3" />
        <span>本地录制预览</span>
      </div>
    </div>
  );
}
