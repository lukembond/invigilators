import type { Episode } from "../services/episodes";
import {
  EPISODE_PAGE_TRANSITION_IN_MS,
  EPISODE_PAGE_TRANSITION_OUT_MS,
  OVERLAY_IRIS_CLOSE_MS,
  OVERLAY_IRIS_OPEN_MS,
  OVERLAY_TRANSITION_MS,
  SITE_TITLE,
  SWIPE_NAV_MAX_WIDTH_PX,
  SWIPE_NAV_THRESHOLD_PX,
} from "./constants";
import {
  formatTrackTime,
  getEpisodeBackground,
  getEpisodeDurationSeconds,
  getEpisodeIdFromPath,
  getEpisodeImage,
  getEpisodePath,
  getEpisodeTitle,
  getTrackDurationSeconds,
  getTrackStartSeconds,
  preloadEpisodeImages,
  shouldHandleTileClick,
} from "./episode";
import { showBooklet } from "./landing";
import { renderPlayer } from "./player";
import type { EpisodeTransitionDirection, HistoryUpdate } from "./types";
import { escapeHtml, prefersReducedMotion } from "./utils";
import { setWaveformProgress } from "./waveform";

export const initAlbumOverlay = () => {
  const overlay = document.getElementById("mix-overlay");
  const closeButton = document.getElementById("overlay-close");
  const prevButton = document.getElementById("overlay-prev") as HTMLButtonElement | null;
  const nextButton = document.getElementById("overlay-next") as HTMLButtonElement | null;
  const counter = document.getElementById("overlay-counter");
  const navTitle = document.getElementById("overlay-nav-title");
  const image = document.getElementById("overlay-image") as HTMLImageElement | null;
  const title = document.getElementById("overlay-title");
  const date = document.getElementById("overlay-date");
  const location = document.getElementById("overlay-location");
  const length = document.getElementById("overlay-length");
  const description = document.getElementById("overlay-description");
  const player = document.getElementById("overlay-player");
  const tracks = document.getElementById("overlay-tracks");
  const trackPanel = document.getElementById("overlay-track-panel");
  const trackCount = document.getElementById("overlay-track-count");
  const detailBody = overlay?.querySelector<HTMLElement>(".mix-detail-body");
  let currentIndex = -1;
  let closeTimer: number | undefined;
  let pageTransitionTimer: number | undefined;
  let isPageTransitioning = false;

  if (
    !overlay ||
    !closeButton ||
    !prevButton ||
    !nextButton ||
    !counter ||
    !navTitle ||
    !image ||
    !title ||
    !date ||
    !location ||
    !length ||
    !description ||
    !player ||
    !tracks ||
    !trackPanel ||
    !trackCount ||
    !detailBody
  ) {
    return;
  }

  const clearEpisodePageTransition = () => {
    detailBody.classList.remove(
      "episode-page-transition",
      "episode-page-transition--next",
      "episode-page-transition--prev",
      "episode-page-transition--out",
      "episode-page-transition--in"
    );
  };

  const updateEpisodeHistory = (episode: Episode, updateUrl: HistoryUpdate) => {
    document.title = getEpisodeTitle(episode);
    if (!updateUrl) return;
    window.history[updateUrl === "push" ? "pushState" : "replaceState"](
      { episodeId: episode.id },
      getEpisodeTitle(episode),
      getEpisodePath(episode)
    );
  };

  const renderEpisode = (episode: Episode, index: number) => {
    currentIndex = index;
    image.src = getEpisodeImage(episode);
    image.alt = episode.title;
    title.textContent = episode.title;
    navTitle.textContent = episode.title;
    counter.textContent = `${index + 1} / ${window.episodes.length}`;
    date.textContent = episode.date;
    location.textContent = episode.location;
    length.textContent = episode.length;
    description.textContent = episode.description;
    trackCount.textContent = `Tracklist - ${episode.tracks.length} tracks`;
    trackPanel.style.backgroundImage = `linear-gradient(90deg, rgba(13, 2, 5, 0.94) 0%, rgba(13, 2, 5, 0.82) 42%, rgba(13, 2, 5, 0.68) 100%), linear-gradient(0deg, rgba(13, 2, 5, 0.62), rgba(13, 2, 5, 0.62)), url("${getEpisodeBackground(episode)}")`;
    prevButton.disabled = index <= 0;
    nextButton.disabled = index >= window.episodes.length - 1;
    tracks.scrollTop = 0;
    tracks.innerHTML = episode.tracks
      .map((track, trackIndex) => {
        const startSeconds = getTrackStartSeconds(track);
        const durationSeconds = getTrackDurationSeconds(episode, trackIndex);
        const element = startSeconds === null ? "div" : "button";
        const startAttributes =
          startSeconds === null
            ? ""
            : ` type="button" data-start-seconds="${startSeconds}" aria-label="Play ${escapeHtml(track.title)} at ${formatTrackTime(startSeconds)}"`;

        return `
          <${element}${startAttributes} class="track-row grid h-10.5 w-full grid-cols-[32px_minmax(0,1fr)_minmax(0,1fr)_120px_58px] items-center gap-3 border-0 border-b border-(--border) bg-transparent px-8 text-left transition-colors duration-120 aria-current:bg-[rgba(140,10,23,0.2)] aria-current:shadow-[inset_3px_0_0_var(--accent)] hover:bg-[rgba(140,10,23,0.07)] focus-visible:bg-[rgba(140,10,23,0.12)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[rgba(240,228,228,0.7)] max-[900px]:grid-cols-[32px_minmax(0,1fr)_minmax(0,1fr)_80px_50px] max-[700px]:h-auto max-[700px]:min-h-13 max-[700px]:grid-cols-[32px_minmax(0,1fr)_50px] max-[700px]:py-2.25">
            <span class="font-mono text-[10px] font-normal text-(--muted-foreground)">${String(track.n).padStart(2, "0")}</span>
            <strong class="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-medium tracking-[0.03em] text-(--foreground)">${escapeHtml(track.title)}</strong>
            <em class="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-light not-italic text-(--muted-foreground) max-[700px]:col-start-2">${escapeHtml(track.artist)}</em>
            <small class="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[9px] text-[rgba(154,96,104,0.7)] max-[700px]:hidden">${escapeHtml(track.label || "-")}</small>
            <b class="text-right font-mono text-[10px] font-normal text-(--accent) max-[700px]:col-start-3 max-[700px]:row-span-2 max-[700px]:row-start-1">${formatTrackTime(durationSeconds)}</b>
          </${element}>
        `;
      })
      .join("");

    player.innerHTML = "";
    renderPlayer(player, episode);
  };

  const closeOverlay = (updateUrl = true) => {
    const tile = document.querySelector<HTMLElement>(`.album-tile[data-index="${currentIndex}"]`);
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("overlay-open");
    clearEpisodePageTransition();
    isPageTransitioning = false;
    window.clearTimeout(pageTransitionTimer);
    if (updateUrl && window.location.pathname !== "/") {
      window.history.replaceState({ episodeId: null }, SITE_TITLE, "/");
    }
    document.title = SITE_TITLE;
    window.clearTimeout(closeTimer);

    const useIris = tile && !prefersReducedMotion();
    if (useIris) {
      const rect = tile.getBoundingClientRect();
      overlay.style.setProperty("--iris-tile-x", `${rect.left + rect.width / 2}px`);
      overlay.style.setProperty("--iris-tile-y", `${rect.top + rect.height / 2}px`);
      overlay.classList.remove("is-open", "is-iris-opening");
      overlay.classList.add("is-iris-closing");
    } else {
      overlay.classList.remove("is-open");
    }

    closeTimer = window.setTimeout(
      () => {
        overlay.classList.remove("is-iris-closing");
        overlay.classList.add("hidden");
        player.innerHTML = "";
        tile?.focus();
      },
      useIris ? OVERLAY_IRIS_CLOSE_MS : OVERLAY_TRANSITION_MS
    );
  };

  const openOverlay = (
    episode: Episode,
    index: number,
    updateUrl: HistoryUpdate = false,
    origin?: HTMLElement
  ) => {
    renderEpisode(episode, index);
    updateEpisodeHistory(episode, updateUrl);
    window.clearTimeout(closeTimer);
    window.clearTimeout(pageTransitionTimer);
    clearEpisodePageTransition();
    isPageTransitioning = false;
    overlay.classList.remove("hidden", "is-iris-closing");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("overlay-open");

    const useIris = origin && !prefersReducedMotion();
    if (useIris) {
      const rect = origin.getBoundingClientRect();
      overlay.style.setProperty("--iris-tile-x", `${rect.left + rect.width / 2}px`);
      overlay.style.setProperty("--iris-tile-y", `${rect.top + rect.height / 2}px`);
      overlay.classList.add("is-open", "is-iris-opening");
      window.setTimeout(() => {
        overlay.classList.remove("is-iris-opening");
      }, OVERLAY_IRIS_OPEN_MS);
    } else {
      window.requestAnimationFrame(() => overlay.classList.add("is-open"));
    }
    closeButton.focus();
  };

  const transitionToEpisode = async (
    episode: Episode,
    index: number,
    updateUrl: HistoryUpdate,
    direction: EpisodeTransitionDirection
  ) => {
    if (isPageTransitioning || prefersReducedMotion()) {
      openOverlay(episode, index, updateUrl);
      return;
    }

    isPageTransitioning = true;
    prevButton.disabled = true;
    nextButton.disabled = true;
    await preloadEpisodeImages(episode);

    if (!isPageTransitioning) return;

    clearEpisodePageTransition();
    detailBody.classList.add(
      "episode-page-transition",
      `episode-page-transition--${direction}`,
      "episode-page-transition--out"
    );
    window.clearTimeout(pageTransitionTimer);
    pageTransitionTimer = window.setTimeout(() => {
      renderEpisode(episode, index);
      updateEpisodeHistory(episode, updateUrl);
      detailBody.classList.remove("episode-page-transition--out");
      detailBody.classList.add("episode-page-transition--in");
      closeButton.focus();
      pageTransitionTimer = window.setTimeout(() => {
        clearEpisodePageTransition();
        isPageTransitioning = false;
      }, EPISODE_PAGE_TRANSITION_IN_MS);
    }, EPISODE_PAGE_TRANSITION_OUT_MS);
  };

  const openByIndex = (
    index: number,
    updateUrl: HistoryUpdate = false,
    direction?: EpisodeTransitionDirection,
    origin?: HTMLElement
  ) => {
    const episode = window.episodes[index];
    if (!episode) return;
    if (direction && overlay.classList.contains("is-open")) {
      transitionToEpisode(episode, index, updateUrl, direction);
      return;
    }
    openOverlay(episode, index, updateUrl, origin);
  };

  const openById = (episodeId: string | null, updateUrl: HistoryUpdate = false) => {
    if (!episodeId) return;
    const index = window.episodes.findIndex((episode) => episode.id === episodeId);
    if (index >= 0) {
      showBooklet(false);
      openByIndex(index, updateUrl);
    }
  };

  document.querySelectorAll(".album-tile").forEach((tile) => {
    tile.addEventListener("click", (event) => {
      if (!shouldHandleTileClick(event as MouseEvent)) return;
      event.preventDefault();
      const tileEl = tile as HTMLElement;
      const index = Number(tileEl.dataset.index);
      openByIndex(index, "push", undefined, tileEl);
    });
  });

  closeButton.addEventListener("click", () => closeOverlay());
  prevButton.addEventListener("click", () => openByIndex(currentIndex - 1, "replace", "prev"));
  nextButton.addEventListener("click", () => openByIndex(currentIndex + 1, "replace", "next"));

  const updatePlayerProgress = (audio: HTMLAudioElement) => {
    const duration =
      audio.duration || getEpisodeDurationSeconds(window.episodes[currentIndex]) || 0;
    const ratio = duration > 0 ? Math.min(1, Math.max(0, audio.currentTime / duration)) : 0;
    const canvas = player.querySelector<HTMLCanvasElement>("[data-player-waveform-canvas]");
    if (canvas) setWaveformProgress(canvas, ratio);
    const current = player.querySelector<HTMLElement>("[data-player-current]");
    if (current) current.textContent = formatTrackTime(audio.currentTime);
  };

  const updateActiveTrackForTime = (currentTime: number) => {
    const rows = Array.from(tracks.querySelectorAll<HTMLElement>("[data-start-seconds]")).sort(
      (a, b) => Number(a.dataset.startSeconds) - Number(b.dataset.startSeconds)
    );
    let activeRow: HTMLElement | null = null;
    for (const row of rows) {
      if (Number(row.dataset.startSeconds) <= currentTime) activeRow = row;
    }
    rows.forEach((row) => {
      if (row === activeRow) {
        row.setAttribute("aria-current", "true");
      } else {
        row.removeAttribute("aria-current");
      }
    });
  };

  player.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement | null;
    const audio = player.querySelector<HTMLAudioElement>("audio");
    if (!audio || !audio.src) return;

    if (target?.closest("[data-player-toggle]")) {
      try {
        if (audio.paused) {
          await audio.play();
        } else {
          audio.pause();
        }
      } catch {
        audio.focus();
      }
      return;
    }

    const waveform = target?.closest<HTMLElement>("[data-player-waveform]");
    if (!waveform) return;
    const rect = waveform.getBoundingClientRect();
    const clickX = "clientX" in event ? event.clientX : rect.left;
    const duration =
      audio.duration || getEpisodeDurationSeconds(window.episodes[currentIndex]) || 0;
    if (duration <= 0 || rect.width <= 0) return;
    audio.currentTime = Math.min(
      duration,
      Math.max(0, ((clickX - rect.left) / rect.width) * duration)
    );
    updatePlayerProgress(audio);
    updateActiveTrackForTime(audio.currentTime);
  });

  player.addEventListener(
    "play",
    () => {
      const toggle = player.querySelector<HTMLElement>("[data-player-toggle]");
      if (toggle) {
        toggle.textContent = "II";
        toggle.setAttribute("aria-label", "Pause");
      }
    },
    true
  );

  player.addEventListener(
    "pause",
    () => {
      const toggle = player.querySelector<HTMLElement>("[data-player-toggle]");
      if (toggle) {
        toggle.textContent = "▶";
        toggle.setAttribute("aria-label", "Play");
      }
    },
    true
  );

  player.addEventListener(
    "timeupdate",
    (event) => {
      const audio = event.target;
      if (!(audio instanceof HTMLAudioElement)) return;
      updatePlayerProgress(audio);
      updateActiveTrackForTime(audio.currentTime);
    },
    true
  );

  player.addEventListener(
    "loadedmetadata",
    (event) => {
      const audio = event.target;
      if (!(audio instanceof HTMLAudioElement)) return;
      const duration = player.querySelector<HTMLElement>("[data-player-duration]");
      if (duration && Number.isFinite(audio.duration))
        duration.textContent = formatTrackTime(audio.duration);
    },
    true
  );

  tracks.addEventListener("click", async (event) => {
    const row = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-start-seconds]");
    if (!row) return;
    const audio = player.querySelector<HTMLAudioElement>("audio");
    const startSeconds = Number(row.dataset.startSeconds);
    if (!audio || !audio.src || Number.isNaN(startSeconds)) return;

    audio.currentTime = startSeconds;
    updatePlayerProgress(audio);
    updateActiveTrackForTime(startSeconds);

    try {
      await audio.play();
    } catch {
      audio.focus();
    }
  });
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeOverlay();
  });
  document.addEventListener("keydown", (event) => {
    if (!overlay.classList.contains("is-open")) return;
    if (event.key === "Escape") closeOverlay();
    if (event.key === "ArrowLeft") openByIndex(currentIndex - 1, "replace", "prev");
    if (event.key === "ArrowRight") openByIndex(currentIndex + 1, "replace", "next");
  });
  window.addEventListener("popstate", () => {
    const episodeId = getEpisodeIdFromPath();
    if (episodeId) {
      openById(episodeId);
    } else {
      closeOverlay(false);
    }
  });

  let swipeStartX = 0;
  let swipeStartY = 0;
  let swipeActive = false;
  overlay.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length !== 1) return;
      if (window.innerWidth > SWIPE_NAV_MAX_WIDTH_PX) return;
      if (!overlay.classList.contains("is-open")) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest(".overlay-tracks, .detail-description-panel, #overlay-player")) return;
      swipeStartX = event.touches[0].clientX;
      swipeStartY = event.touches[0].clientY;
      swipeActive = true;
    },
    { passive: true }
  );
  overlay.addEventListener(
    "touchend",
    (event) => {
      if (!swipeActive) return;
      swipeActive = false;
      const touch = event.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - swipeStartX;
      const dy = touch.clientY - swipeStartY;
      if (Math.abs(dx) < SWIPE_NAV_THRESHOLD_PX) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.2) return;
      if (dx < 0) {
        openByIndex(currentIndex + 1, "replace", "next");
      } else {
        openByIndex(currentIndex - 1, "replace", "prev");
      }
    },
    { passive: true }
  );
  overlay.addEventListener("touchcancel", () => {
    swipeActive = false;
  });

  openById(window.initialEpisodeId || getEpisodeIdFromPath());
};
