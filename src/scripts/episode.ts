import type { Episode } from "../services/episodes";
import { EPISODE_ROUTE_PATTERN, SITE_TITLE } from "./constants";
import { preloadImage } from "./utils";

export const getEpisodeImage = (episode: Episode) => {
  return episode.image_cover || episode.image_bg || "/img/episode-bg/ahNotFound.png";
};

export const getEpisodeBackground = (episode: Episode) => {
  return episode.image_bg || episode.image_cover || "/img/episode-bg/ahNotFound.png";
};

export const getTrackStartSeconds = (track: Episode["tracks"][number]) => {
  if (typeof track.startSeconds === "number") return track.startSeconds;
  if (!track.start) return null;

  const parts = track.start.split(":").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
};

export const formatTrackTime = (seconds: number | null) => {
  if (seconds === null) return "-";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return `${mins}:${String(secs).padStart(2, "0")}`;
};

export const getEpisodeDurationSeconds = (episode: Episode) => {
  const parts = episode.length.split(":").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
};

export const getTrackDurationSeconds = (episode: Episode, trackIndex: number) => {
  const trackStart = getTrackStartSeconds(episode.tracks[trackIndex]);
  if (trackStart === null) return null;

  const nextTrack = episode.tracks[trackIndex + 1];
  const nextTrackStart = nextTrack ? getTrackStartSeconds(nextTrack) : null;
  const trackEnd = nextTrackStart ?? getEpisodeDurationSeconds(episode);
  if (trackEnd === null || trackEnd <= trackStart) return null;

  return trackEnd - trackStart;
};

export const getEpisodePath = (episode: Episode) => `/episodes/${episode.id}`;

export const getEpisodeTitle = (episode: Episode) => `${episode.title} | ${SITE_TITLE}`;

export const getEpisodeIdFromPath = () => {
  const match = window.location.pathname.match(EPISODE_ROUTE_PATTERN);
  return match ? decodeURIComponent(match[1]) : null;
};

export const shouldHandleTileClick = (event: MouseEvent) => {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
};

export const preloadEpisodeImages = (episode: Episode) => {
  return Promise.all([getEpisodeImage(episode), getEpisodeBackground(episode)].map(preloadImage));
};
