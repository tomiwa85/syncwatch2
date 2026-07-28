import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import ReactPlayer from "react-player";
import type { PlayerHandle } from "../realtime/sync-engine.js";

interface StreamingVideoPlayerProps {
  url: string;
  onTime?: (time: number) => void;
  onDuration?: (duration: number) => void;
}

// react-player wrapped as a PlayerHandle. react-player controls playback via the
// `playing` prop (not imperative methods), so play/pause flip local state; seek
// and getCurrentTime go through the player ref.
export const StreamingVideoPlayer = forwardRef<PlayerHandle, StreamingVideoPlayerProps>(
  ({ url, onTime, onDuration }, ref) => {
    const playerRef = useRef<ReactPlayer>(null);
    const [playing, setPlaying] = useState(false);
    const [volume, setVolume] = useState(1);

    useImperativeHandle(
      ref,
      (): PlayerHandle => ({
        play: () => setPlaying(true),
        pause: () => setPlaying(false),
        seek: (time: number) => playerRef.current?.seekTo(time, "seconds"),
        getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
        setVolume: (v: number) => setVolume(v),
      }),
      [],
    );

    return (
      <ReactPlayer
        ref={playerRef}
        url={url}
        playing={playing}
        volume={volume}
        controls={false}
        width="100%"
        height="100%"
        onProgress={(state) => onTime?.(state.playedSeconds)}
        onDuration={(d) => onDuration?.(d)}
      />
    );
  },
);
StreamingVideoPlayer.displayName = "StreamingVideoPlayer";
