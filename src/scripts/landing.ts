import { BOOKLET_IRIS_TRANSITION_MS, LANDING_EXIT_MS } from "./constants";
import { prefersReducedMotion } from "./utils";

export const initLandingVideo = () => {
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

export const initTileImageFallbacks = () => {
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

export const initEnterButton = () => {
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

export const showBooklet = (focusFirstTile = false, transitionOrigin?: HTMLElement) => {
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
