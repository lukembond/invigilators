import type { Episode } from "../services/episodes";

declare global {
  interface Window {
    episodes: Episode[];
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
      landing.classList.add("is-exiting");
      window.setTimeout(() => {
        landing.classList.add("hidden");
        booklet.classList.remove("hidden");
        booklet.classList.add("is-visible");
        document.querySelector<HTMLElement>(".album-tile")?.focus();
      }, 260);
    });
  }
};

const formatType = (type: string) => (type === "mykonos" ? "Mykonos Sessions" : "Aural Homework");

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

const renderPlayer = (container: HTMLElement, mixcloud: string, title: string) => {
  if (!mixcloud) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <iframe
      class="block h-15 w-full border-0"
      src="https://www.mixcloud.com/widget/iframe/?hide_cover=1&mini=1&light=1&feed=%2F${encodeURIComponent(mixcloud)}%2F"
      title="${escapeHtml(title)}"
      allow="autoplay"
      loading="lazy"
    ></iframe>
  `;
};

const initAlbumOverlay = () => {
  const overlay = document.getElementById("mix-overlay");
  const closeButton = document.getElementById("overlay-close");
  const prevButton = document.getElementById("overlay-prev") as HTMLButtonElement | null;
  const nextButton = document.getElementById("overlay-next") as HTMLButtonElement | null;
  const counter = document.getElementById("overlay-counter");
  const navTitle = document.getElementById("overlay-nav-title");
  const image = document.getElementById("overlay-image") as HTMLImageElement | null;
  const kicker = document.getElementById("overlay-kicker");
  const title = document.getElementById("overlay-title");
  const date = document.getElementById("overlay-date");
  const location = document.getElementById("overlay-location");
  const length = document.getElementById("overlay-length");
  const description = document.getElementById("overlay-description");
  const player = document.getElementById("overlay-player");
  const tracks = document.getElementById("overlay-tracks");
  const trackPanel = document.getElementById("overlay-track-panel");
  const trackCount = document.getElementById("overlay-track-count");
  let currentIndex = -1;
  let closeTimer: number | undefined;

  if (
    !overlay ||
    !closeButton ||
    !prevButton ||
    !nextButton ||
    !counter ||
    !navTitle ||
    !image ||
    !kicker ||
    !title ||
    !date ||
    !location ||
    !length ||
    !description ||
    !player ||
    !tracks ||
    !trackPanel ||
    !trackCount
  ) {
    return;
  }

  const closeOverlay = () => {
    const tile = document.querySelector<HTMLElement>(`.album-tile[data-index="${currentIndex}"]`);
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("overlay-open");
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => {
      overlay.classList.add("hidden");
      player.innerHTML = "";
      tile?.focus();
    }, OVERLAY_TRANSITION_MS);
  };

  const openOverlay = (episode: Episode, index: number) => {
    currentIndex = index;
    image.src = getEpisodeImage(episode);
    image.alt = episode.title;
    kicker.textContent = formatType(episode.type);
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
    renderPlayer(player, episode.mixcloud, episode.title);
    window.clearTimeout(closeTimer);
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("overlay-open");
    window.requestAnimationFrame(() => overlay.classList.add("is-open"));
    closeButton.focus();
  };

  const openByIndex = (index: number) => {
    const episode = window.episodes[index];
    if (episode) openOverlay(episode, index);
  };

  document.querySelectorAll(".album-tile").forEach((tile) => {
    tile.addEventListener("click", () => {
      const index = Number((tile as HTMLElement).dataset.index);
      openByIndex(index);
    });
  });

  closeButton.addEventListener("click", closeOverlay);
  prevButton.addEventListener("click", () => openByIndex(currentIndex - 1));
  nextButton.addEventListener("click", () => openByIndex(currentIndex + 1));
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeOverlay();
  });
  document.addEventListener("keydown", (event) => {
    if (!overlay.classList.contains("is-open")) return;
    if (event.key === "Escape") closeOverlay();
    if (event.key === "ArrowLeft") openByIndex(currentIndex - 1);
    if (event.key === "ArrowRight") openByIndex(currentIndex + 1);
  });
};
