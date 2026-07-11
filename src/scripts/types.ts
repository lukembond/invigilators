import type { Episode } from "../services/episodes";

declare global {
  interface Window {
    episodes: Episode[];
    initialEpisodeId?: string | null;
  }
}

export type HistoryUpdate = false | "push" | "replace";
export type EpisodeTransitionDirection = "next" | "prev";

export {};
