import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
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
    // Set when this device can't show the file's picture (e.g. an MKV whose
    // video is H.265/HEVC): the browser plays the audio over a black frame,
    // which otherwise looks like the app is broken.
    const [problem, setProblem] = useState<"picture" | "format" | null>(null);

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

    useEffect(() => setProblem(null), [src]);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      const handleTime = () => onTime?.(video.currentTime);
      const handleDuration = () => onDuration?.(video.duration);
      // Data has loaded but there's no picture → the video track can't be decoded here.
      const checkPicture = () => {
        if (video.videoWidth === 0 && video.videoHeight === 0) setProblem("picture");
      };
      const handleError = () => {
        const code = video.error?.code;
        if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED || code === MediaError.MEDIA_ERR_DECODE) setProblem("format");
      };
      video.addEventListener("timeupdate", handleTime);
      video.addEventListener("loadedmetadata", handleDuration);
      video.addEventListener("loadeddata", checkPicture);
      video.addEventListener("error", handleError);
      return () => {
        video.removeEventListener("timeupdate", handleTime);
        video.removeEventListener("loadedmetadata", handleDuration);
        video.removeEventListener("loadeddata", checkPicture);
        video.removeEventListener("error", handleError);
      };
    }, [onTime, onDuration]);

    return (
      <>
        <video ref={videoRef} src={src} className="h-full w-full rounded-sw bg-black" playsInline crossOrigin="anonymous">
          {trackUrl && <track kind="subtitles" src={trackUrl} srcLang="en" label="Subtitles" default />}
        </video>
        {problem && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center">
            <div className="max-w-sm rounded-sw bg-black/75 px-4 py-3 text-sm text-white backdrop-blur">
              <p className="font-semibold">
                {problem === "picture" ? "This phone can't show this video's picture" : "This video format isn't supported here"}
              </p>
              <p className="mt-1 text-xs text-white/75">
                {problem === "picture"
                  ? "The sound may still play. The file likely uses H.265/HEVC — an MP4 (H.264) version will work, and the host needs to use that same version."
                  : "Use an MP4 (H.264) version — and the host needs to use that same version."}
              </p>
            </div>
          </div>
        )}
      </>
    );
  },
);
LocalVideoPlayer.displayName = "LocalVideoPlayer";
