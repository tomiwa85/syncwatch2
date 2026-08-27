import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import type { PlayerHandle } from "../realtime/sync-engine.js";

interface LocalVideoPlayerProps {
  src: string;
  onTime?: (time: number) => void;
  onDuration?: (duration: number) => void;
  /** WebVTT subtitle content to display as a track (optional). */
  subtitleVtt?: string | null;
}

// A plain <video> (no native controls) exposed as a PlayerHandle. The sync
// engine owns play/pause/seek; this component only renders and reports time.
export const LocalVideoPlayer = forwardRef<PlayerHandle, LocalVideoPlayerProps>(
  ({ src, onTime, onDuration, subtitleVtt }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    // Turn broadcast VTT text into a blob URL for the <track>.
    const trackUrl = useMemo(() => {
      if (!subtitleVtt) return null;
      return URL.createObjectURL(new Blob([subtitleVtt], { type: "text/vtt" }));
    }, [subtitleVtt]);
    useEffect(() => () => { if (trackUrl) URL.revokeObjectURL(trackUrl); }, [trackUrl]);

    useImperativeHandle(
      ref,
      (): PlayerHandle => ({
        play: () => void videoRef.current?.play().catch(() => {}),
        pause: () => videoRef.current?.pause(),
        seek: (time: number) => {
          if (videoRef.current) videoRef.current.currentTime = time;
        },
        getCurrentTime: () => videoRef.current?.currentTime ?? 0,
        setVolume: (v: number) => {
          if (videoRef.current) videoRef.current.volume = v;
        },
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
      <video ref={videoRef} src={src} className="h-full w-full rounded-sw bg-black" playsInline crossOrigin="anonymous">
        {trackUrl && <track kind="subtitles" src={trackUrl} srcLang="en" label="Subtitles" default />}
      </video>
    );
  },
);
LocalVideoPlayer.displayName = "LocalVideoPlayer";
