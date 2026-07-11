import type { Episode } from "../services/episodes";
import { formatTrackTime, getEpisodeDurationSeconds, getTrackStartSeconds } from "./episode";
import { escapeHtml } from "./utils";
import { renderTrackMarkers, setWaveform } from "./waveform";

const getHearthisApiUrl = (episode: Episode) => {
  if (!episode.hearthis_url) return null;
  try {
    const url = new URL(episode.hearthis_url);
    return `https://api-v2.hearthis.at${url.pathname}`;
  } catch {
    return null;
  }
};

const renderHearthisEmbed = (container: HTMLElement, episode: Episode) => {
  const { hearthis_id, title } = episode;
  if (!hearthis_id) return false;

  container.innerHTML = `
    <iframe
      class="block h-37.5 w-full border-0"
      scrolling="no"
      src="https://app.hearthis.at/embed/${encodeURIComponent(hearthis_id)}/transparent_black/?hcolor=8c0a17&color=f0e4e4&style=2&block_size=2&block_space=1&background=1&waveform=0&cover=0&autoplay=0&css="
      title="${escapeHtml(title)}"
      allow="autoplay"
      loading="lazy"
      allowtransparency
    ></iframe>
  `;
  return true;
};

const renderHearthisAudioPlayer = async (container: HTMLElement, episode: Episode) => {
  const apiUrl = getHearthisApiUrl(episode);
  if (!apiUrl) {
    renderHearthisEmbed(container, episode);
    return;
  }

  const fallbackDuration = getEpisodeDurationSeconds(episode);

  container.dataset.playerEpisodeId = episode.id;
  container.innerHTML = `
    <div class="grid grid-cols-[40px_minmax(0,1fr)] items-center gap-3" data-native-player>
      <button class="flex h-10 w-10 items-center justify-center rounded-full bg-(--primary) font-mono text-[14px] text-(--foreground) shadow-[0_4px_14px_rgba(0,0,0,0.28)] transition-[background,transform] duration-120 hover:scale-105 hover:bg-[rgba(168,18,34,0.95)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(240,228,228,0.7)] disabled:cursor-wait disabled:opacity-45" type="button" data-player-toggle disabled aria-label="Play ${escapeHtml(episode.title)}">▶</button>
      <div class="grid gap-1.5">
        <button class="relative h-16 w-full overflow-hidden rounded-[3px] bg-[rgba(0,0,0,0.22)] shadow-[inset_0_0_0_1px_rgba(240,228,228,0.05)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(240,228,228,0.7)]" type="button" data-player-waveform aria-label="Seek ${escapeHtml(episode.title)}">
          <canvas class="pointer-events-none absolute inset-0 block h-full w-full" data-player-waveform-canvas aria-hidden="true"></canvas>
          <span class="absolute inset-0 z-10" data-player-markers>${renderTrackMarkers(episode, fallbackDuration)}</span>
        </button>
        <div class="flex items-center justify-between font-mono text-[9px] text-(--muted-foreground)">
          <span data-player-current>0:00</span>
          <span data-player-duration>${formatTrackTime(fallbackDuration)}</span>
        </div>
      </div>
      <audio class="sr-only" preload="metadata" title="${escapeHtml(episode.title)}"></audio>
    </div>
  `;

  const initialCanvas = container.querySelector<HTMLCanvasElement>("[data-player-waveform-canvas]");
  if (initialCanvas && episode.waveform?.length) setWaveform(initialCanvas, episode.waveform);

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`hearthis API returned ${response.status}`);
    const data = (await response.json()) as {
      duration?: string;
      stream_url?: string;
    };
    if (container.dataset.playerEpisodeId !== episode.id) return;

    const audio = container.querySelector<HTMLAudioElement>("audio");
    const toggle = container.querySelector<HTMLButtonElement>("[data-player-toggle]");
    const duration = container.querySelector<HTMLElement>("[data-player-duration]");
    if (!audio || !data.stream_url) throw new Error("hearthis stream URL missing");

    audio.src = data.stream_url;
    if (toggle) toggle.disabled = false;
    if (duration) duration.textContent = formatTrackTime(Number(data.duration) || fallbackDuration);
  } catch {
    if (container.dataset.playerEpisodeId === episode.id) renderHearthisEmbed(container, episode);
  }
};

export const renderPlayer = (container: HTMLElement, episode: Episode) => {
  const { mixcloud, title } = episode;
  const hasTrackStarts = episode.tracks.some((track) => getTrackStartSeconds(track) !== null);

  if (hasTrackStarts) {
    void renderHearthisAudioPlayer(container, episode);
    return;
  }

  if (renderHearthisEmbed(container, episode)) {
    return;
  }

  if (mixcloud) {
    container.innerHTML = `
      <iframe
        class="block h-15 w-full border-0"
        src="https://www.mixcloud.com/widget/iframe/?hide_cover=1&mini=1&light=1&feed=%2F${encodeURIComponent(mixcloud)}%2F"
        title="${escapeHtml(title)}"
        allow="autoplay"
        loading="lazy"
      ></iframe>
    `;
    return;
  }

  container.innerHTML = "";
};
