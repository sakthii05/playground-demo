export interface TVChannel {
  id: number;
  name: string;
  src?: string;
  genre?: string;
  color?: string;
}

export type TVButtonType =
  | "power"
  | "stop"
  | "rew"
  | "play"
  | "ff"
  | "rec"
  | "channel-up"
  | "channel-down"
  | "volume-up"
  | "volume-down";

export type TVOSDType =
  | "channel"
  | "volume"
  | "play"
  | "pause"
  | "stop"
  | "rewind"
  | "fast-forward"
  | "recording"
  | "muted";

export interface TVOSDState {
  visible: boolean;
  type: TVOSDType;
  title?: string;
  subtitle?: string;
  value?: number; // 0 to 100
}

export interface InteractiveTVProps {
  channels?: TVChannel[];
  defaultChannel?: number;
  defaultVolume?: number;
  autoPlay?: boolean;
  className?: string;
}
