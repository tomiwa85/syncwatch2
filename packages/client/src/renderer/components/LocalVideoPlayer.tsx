import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { PlayerHandle } from "../realtime/sync-engine.js";

interface LocalVideoPlayerProps {
  src: string;
  onTime?: (time: number) => void;
  onDuration?: (duration: number) => void;
}

// A plain <video> (no native controls) exposed as a PlayerHandle. The sync
// engine owns play/pause/seek; this component only renders and reports time.
export const LocalVideoPlayer = forwardRef<PlayerHandle, LocalVideoPlayerProps>(
  ({ src, onTime, onDuration }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useImperativeHandle(
      ref,
      (): PlayerHandle => ({
        play: () => void videoRef.current?.play().catch(() => {}),
        pause: () => videoRef.current?.pause(),
        seek: (time: number) => {
          if (videoRef.current) videoRef.current.currentTime = time;
        },
        getCurrentTime: () => videoRef.current?.currentTime ?? 0,
      }),
      [],
    );

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      const handleTime = () => onTime?.(video.currentTime);
      const handleDuration = () => onDuration?.(video.duration);
      video.addEventListener("timeupdate", handleTime);
      video.addEventListener("loadedmetadata", handleDuration);
      return () => {
        video.removeEventListener("timeupdate", handleTime);
        video.removeEventListener("loadedmetadata", handleDuration);
      };
    }, [onTime, onDuration]);

    return (
      <video
        ref={videoRef}
        src={src}
        className="h-full w-full rounded-sw bg-black"
        playsInline
      />
    );
  },
);
LocalVideoPlayer.displayName = "LocalVideoPlayer";
