import type { Episode } from "../services/episodes";

declare global {
  interface Window {
    episodes: Episode[];
    initialEpisodeId?: string | null;
  }
}

export const initApp = () => {
  initLandingVideo();
  initEnterButton();
  initTileImageFallbacks();
  initAlbumOverlay();
};

const initLandingVideo = () => {
  const video = document.getElementById("video_background") as HTMLVideoElement | null;
  if (!video) return;

  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "auto";

  const playVideo = () => {
    const playPromise = video.play();
    if (playPromise) {
      playPromise.catch(() => {
        video.setAttribute("data-playback-blocked", "true");
      });
    }
  };

  video.load();
  playVideo();
  video.addEventListener("loadeddata", playVideo, { once: true });
  video.addEventListener("canplay", playVideo, { once: true });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && video.paused) playVideo();
  });
};

const OVERLAY_TRANSITION_MS = 280;
const LANDING_EXIT_MS = 260;
const BOOKLET_IRIS_TRANSITION_MS = 620;
const OVERLAY_IRIS_OPEN_MS = 460;
const OVERLAY_IRIS_CLOSE_MS = 380;
const EPISODE_PAGE_TRANSITION_OUT_MS = 220;
const EPISODE_PAGE_TRANSITION_IN_MS = 360;
const SWIPE_NAV_THRESHOLD_PX = 60;
const SWIPE_NAV_MAX_WIDTH_PX = 700;
const EPISODE_ROUTE_PATTERN = /^\/episodes\/([^/]+?)(?:\.html)?\/?$/;

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const initTileImageFallbacks = () => {
  document.querySelectorAll<HTMLImageElement>(".album-tile img").forEach((image) => {
    image.addEventListener("error", () => {
      const fallback = image.dataset.fallbackSrc || "/img/episode-bg/ahNotFound.png";
      if (image.src.endsWith(fallback)) {
        image.src = "/img/episode-bg/ahNotFound.png";
        return;
      }
      image.src = fallback;
    });
  });
};

const initEnterButton = () => {
  const enterBtn = document.getElementById("enter-btn");
  const landing = document.getElementById("landing");
  const booklet = document.getElementById("booklet");

  if (enterBtn && landing && booklet) {
    enterBtn.addEventListener("click", () => {
      showBooklet(true, enterBtn);
    });
  }
};

const measureBookletWordmarkRect = (booklet: HTMLElement) => {
  const wordmark = booklet.querySelector<HTMLElement>(".booklet-wordmark");
  if (!wordmark) return null;
  booklet.classList.add("is-measuring");
  const rect = wordmark.getBoundingClientRect();
  booklet.classList.remove("is-measuring");
  return rect;
};

const showBooklet = (focusFirstTile = false, transitionOrigin?: HTMLElement) => {
  const landing = document.getElementById("landing");
  const booklet = document.getElementById("booklet");
  if (!landing || !booklet) return;

  const finishTransition = () => {
    landing.classList.add("hidden");
    landing.classList.remove("is-iris-transition", "is-exiting");
    booklet.classList.remove("hidden", "is-iris-revealing");
    booklet.classList.add("is-visible");
    window.requestAnimationFrame(() => booklet.classList.remove("is-suppressing-wordmark"));
    if (focusFirstTile) document.querySelector<HTMLElement>(".album-tile")?.focus();
  };

  if (transitionOrigin && !prefersReducedMotion()) {
    const landingWordmark = landing.querySelector<HTMLElement>(".landing-wordmark");
    const toRect = measureBookletWordmarkRect(booklet);
    let targetCenter: { x: number; y: number } | null = null;

    if (landingWordmark && toRect && toRect.height > 0) {
      booklet.classList.add("is-suppressing-wordmark");
      const fromRect = landingWordmark.getBoundingClientRect();
      const scale = fromRect.height > 0 ? toRect.height / fromRect.height : 1;
      const fromCx = fromRect.left + fromRect.width / 2;
      const fromCy = fromRect.top + fromRect.height / 2;
      const toCx = toRect.left + toRect.width / 2;
      const toCy = toRect.top + toRect.height / 2;
      landingWordmark.style.setProperty("--wordmark-tx", `${toCx - fromCx}px`);
      landingWordmark.style.setProperty("--wordmark-ty", `${toCy - fromCy}px`);
      landingWordmark.style.setProperty("--wordmark-scale", `${scale}`);
      targetCenter = { x: toCx, y: toCy };
    }

    const target = targetCenter ?? {
      x: window.innerWidth - 80,
      y: 28,
    };
    landing.style.setProperty("--iris-target-x", `${target.x}px`);
    landing.style.setProperty("--iris-target-y", `${target.y}px`);
    landing.classList.add("is-iris-transition");

    booklet.classList.remove("hidden");
    booklet.classList.add("is-visible", "is-iris-revealing", "is-iris-entered");

    window.setTimeout(() => {
      landing.classList.add("hidden");
      landing.classList.remove("is-iris-transition");
      booklet.classList.remove("is-iris-revealing", "is-suppressing-wordmark");
      if (focusFirstTile) document.querySelector<HTMLElement>(".album-tile")?.focus();
    }, BOOKLET_IRIS_TRANSITION_MS);
    return;
  }

  landing.classList.add("is-exiting");
  window.setTimeout(() => {
    finishTransition();
  }, LANDING_EXIT_MS);
};

const getEpisodeImage = (episode: Episode) => {
  return episode.image_cover || episode.image_bg || "/img/episode-bg/ahNotFound.png";
};

const getEpisodeBackground = (episode: Episode) => {
  return episode.image_bg || episode.image_cover || "/img/episode-bg/ahNotFound.png";
};

const escapeHtml = (value: string | undefined) => {
  return String(value || "").replace(/[&<>"]/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
    };
    return entities[char];
  });
};

const renderPlayer = (container: HTMLElement, episode: Episode) => {
  const { hearthis_id, mixcloud, title } = episode;

  if (hearthis_id) {
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

const getEpisodePath = (episode: Episode) => `/episodes/${episode.id}`;

const getEpisodeIdFromPath = () => {
  const match = window.location.pathname.match(EPISODE_ROUTE_PATTERN);
  return match ? decodeURIComponent(match[1]) : null;
};

const shouldHandleTileClick = (event: MouseEvent) => {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
};

const preloadImage = (src: string) => {
  return new Promise<void>((resolve) => {
    const preload = new Image();
    preload.onload = () => {
      if (preload.decode) {
        preload.decode().then(
          () => resolve(),
          () => resolve()
        );
        return;
      }
      resolve();
    };
    preload.onerror = () => resolve();
    preload.src = src;
  });
};

const preloadEpisodeImages = (episode: Episode) => {
  return Promise.all([getEpisodeImage(episode), getEpisodeBackground(episode)].map(preloadImage));
};

type HistoryUpdate = false | "push" | "replace";
type EpisodeTransitionDirection = "next" | "prev";

const initAlbumOverlay = () => {
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
    if (!updateUrl) return;
    window.history[updateUrl === "push" ? "pushState" : "replaceState"](
      { episodeId: episode.id },
      "",
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
      .map(
        (track) => `
          <div class="track-row grid h-10.5 grid-cols-[32px_minmax(0,1fr)_minmax(0,1fr)_120px_52px] items-center gap-3 border-b border-(--border) px-8 transition-colors duration-120 hover:bg-[rgba(140,10,23,0.07)] max-[900px]:grid-cols-[32px_minmax(0,1fr)_minmax(0,1fr)_80px] max-[700px]:h-auto max-[700px]:min-h-13 max-[700px]:grid-cols-[32px_minmax(0,1fr)] max-[700px]:py-2.25">
            <span class="font-mono text-[10px] font-normal text-(--muted-foreground)">${String(track.n).padStart(2, "0")}</span>
            <strong class="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-medium tracking-[0.03em] text-(--foreground)">${escapeHtml(track.title)}</strong>
            <em class="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-light not-italic text-(--muted-foreground) max-[700px]:col-start-2">${escapeHtml(track.artist)}</em>
            <small class="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[9px] text-[rgba(154,96,104,0.7)] max-[700px]:col-start-2 max-[700px]:hidden">${escapeHtml(track.label || "-")}</small>
            <b class="text-right font-mono text-[10px] font-normal text-(--accent) max-[900px]:hidden">-</b>
          </div>
        `
      )
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
      window.history.replaceState({ episodeId: null }, "", "/");
    }
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
