import { forwardRef } from "react";

interface Props {
  src: string;
  muted?: boolean;
  onTimeUpdate?: () => void;
  onLoadedMetadata?: () => void;
  onDurationChange?: () => void;
  onEnded?: () => void;
}

export const SyncVideoPlayer = forwardRef<HTMLVideoElement, Props>(
  function SyncVideoPlayer(
    { src, muted = false, onTimeUpdate, onLoadedMetadata, onDurationChange, onEnded },
    ref
  ) {
    return (
      <video
        ref={ref}
        src={src}
        muted={muted}
        className="w-full aspect-video bg-black rounded"
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onDurationChange={onDurationChange}
        onEnded={onEnded}
        preload="metadata"
      />
    );
  }
);
