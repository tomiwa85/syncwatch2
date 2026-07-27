export const SocketEvents = {
  RoomJoin: "room:join",
  RoomLeave: "room:leave",
  RoomState: "room:state",
  RoomMemberJoined: "room:member-joined",
  RoomMemberLeft: "room:member-left",
  RoomEnded: "room:ended",

  VideoSetSource: "video:set-source",
  VideoSourceChanged: "video:source-changed",

  FileVerify: "file:verify",
  FileVerifyResult: "file:verify-result",

  PlaybackPlay: "playback:play",
  PlaybackPause: "playback:pause",
  PlaybackSeek: "playback:seek",
  PlaybackSync: "playback:sync",
  PlaybackHeartbeat: "playback:heartbeat",
} as const;

export type SocketEventName = (typeof SocketEvents)[keyof typeof SocketEvents];
