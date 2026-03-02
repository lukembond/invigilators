import type { Episode } from "../services/episodes";

declare global {
  interface Window {
    episodes: Episode[];
    INITIAL_LOAD: number;
  }
}

export function initApp() {
  initEnterButton();
  initTracklists();
  initMixcloud();
  initInfiniteScroll();
  initKeyboardNav();
}

function initEnterButton() {
  const enterBtn = document.getElementById("enter-btn");
  const mainContent = document.getElementById("main-content");
  const heroVideo = document.querySelector("video");

  if (enterBtn && mainContent) {
    enterBtn.addEventListener("click", () => {
      mainContent.classList.remove("hidden");

      const nav = document.getElementById("nav");
      if (nav) {
        nav.style.position = "fixed";
        nav.style.top = "0";
        nav.style.left = "0";
        nav.style.right = "0";
        nav.style.zIndex = "100";
        nav.style.opacity = "1";
      }

      if (heroVideo) {
        heroVideo.pause();
      }

      setTimeout(() => {
        const episodesSection = document.getElementById("episodes");
        if (episodesSection) {
          const ep = episodesSection.querySelector(".episode-wrapper") as HTMLElement;
          if (ep) {
            window.scrollTo({ top: ep.offsetTop, behavior: "smooth" });
          }
        }
      }, 100);
    });
  }
}

export function initTracklists() {
  document.querySelectorAll(".toggle-tracklist").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = (btn as HTMLElement).dataset.target;
      const tracklist = document.getElementById(targetId || "");
      if (tracklist) {
        const isExpanded = tracklist.style.maxHeight && tracklist.style.maxHeight !== "0px";
        tracklist.style.maxHeight = isExpanded ? "0px" : "2000px";
        btn.textContent = isExpanded ? "Show Tracklist" : "Hide Tracklist";
      }
    });
  });
}

function loadMixcloudEmbed(container: Element) {
  const mixcloud = (container as HTMLElement).dataset.mixcloud;
  const title = (container as HTMLElement).dataset.title;
  if (!mixcloud) return;

  // Show loading state
  container.innerHTML = `
    <div class="w-full h-full bg-gray-900/50 border border-white/10 rounded flex items-center justify-center text-gray-400 text-sm gap-2">
      <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>Loading player...</span>
    </div>
  `;

  // Actually load the iframe after a brief delay
  setTimeout(() => {
    container.innerHTML = `
      <iframe
        class="w-full h-full border-0"
        src="https://www.mixcloud.com/widget/iframe/?hide_cover=1&mini=1&light=1&feed=%2F${mixcloud}%2F"
        title="${title}"
        allow="autoplay"
        loading="lazy"
      ></iframe>
    `;
  }, 500);
}

export function initMixcloud() {
  const mixcloudObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          loadMixcloudEmbed(entry.target);
          mixcloudObserver.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "200px" }
  );

  document.querySelectorAll(".mixcloud-container").forEach((container) => {
    (container as HTMLElement).addEventListener("click", () => loadMixcloudEmbed(container), {
      once: true,
    });
    mixcloudObserver.observe(container);
  });
}

export function initInfiniteScroll() {
  const loadMoreBtn = document.getElementById("load-more-btn");
  const initialLoad = window.INITIAL_LOAD || 5;
  let currentCount = initialLoad;

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => {
      const loading = document.getElementById("loading");
      const wrappers = document.querySelectorAll(".episode-wrapper.hidden");

      if (wrappers.length === 0) {
        loadMoreBtn.remove();
        return;
      }

      loadMoreBtn.classList.add("hidden");
      if (loading) loading.classList.remove("hidden");

      setTimeout(() => {
        // Show next batch of episodes (5 at a time)
        const toShow = Array.from(wrappers).slice(0, 5);
        toShow.forEach((wrapper) => {
          wrapper.classList.remove("hidden");
        });

        currentCount += toShow.length;
        if (loading) loading.classList.add("hidden");

        // Check if there are more to load
        const remaining = document.querySelectorAll(".episode-wrapper.hidden");
        if (remaining.length === 0) {
          loadMoreBtn.remove();
        } else {
          loadMoreBtn.classList.remove("hidden");
        }
      }, 300);
    });
  }

  // Auto-load when scrolling near bottom
  let scrollTimeout: number;
  window.addEventListener("scroll", () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = window.setTimeout(() => {
      const btn = document.getElementById("load-more-btn");
      if (!btn || btn.classList.contains("hidden")) return;

      const rect = btn.getBoundingClientRect();
      if (rect.top < window.innerHeight + 200) {
        btn.click();
      }
    }, 100);
  });
}

export function initKeyboardNav() {
  const navUp = document.getElementById("nav-up");
  const navDown = document.getElementById("nav-down");
  let currentEpisodeIndex = 0;

  function getEpisodes() {
    return Array.from(document.querySelectorAll(".episode-wrapper:not(.hidden)"));
  }

  function updateNavButtons(episodes: Element[]) {
    if (navUp) {
      navUp.classList.toggle("opacity-30", currentEpisodeIndex === 0);
      navUp.classList.toggle("pointer-events-none", currentEpisodeIndex === 0);
    }
    if (navDown) {
      navDown.classList.toggle("opacity-30", currentEpisodeIndex >= episodes.length - 1);
      navDown.classList.toggle("pointer-events-none", currentEpisodeIndex >= episodes.length - 1);
    }
  }

  function scrollToEpisode(index: number) {
    const episodes = getEpisodes();
    if (index < 0 || index >= episodes.length) return;
    currentEpisodeIndex = index;
    const ep = episodes[index] as HTMLElement;
    window.scrollTo({
      top: ep.offsetTop,
      behavior: "smooth",
    });
    updateNavButtons(episodes);
  }

  navUp?.addEventListener("click", () => scrollToEpisode(currentEpisodeIndex - 1));
  navDown?.addEventListener("click", () => scrollToEpisode(currentEpisodeIndex + 1));

  document.addEventListener("keydown", (e) => {
    const episodes = getEpisodes();
    if (e.key === "ArrowUp") {
      e.preventDefault();
      navUp?.classList.add("active");
      setTimeout(() => navUp?.classList.remove("active"), 300);
      scrollToEpisode(currentEpisodeIndex - 1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      navDown?.classList.add("active");
      setTimeout(() => navDown?.classList.remove("active"), 300);
      scrollToEpisode(currentEpisodeIndex + 1);
    }
    updateNavButtons(episodes);
  });

  window.addEventListener("scroll", () => {
    const episodes = getEpisodes();
    if (episodes.length === 0) return;

    const scrollPos = window.scrollY + window.innerHeight / 2;
    episodes.forEach((ep, i) => {
      const rect = ep.getBoundingClientRect();
      const epEl = ep as HTMLElement;
      const epTop = epEl.offsetTop;
      if (scrollPos >= epTop && scrollPos < epTop + rect.height) {
        currentEpisodeIndex = i;
      }
    });
    updateNavButtons(episodes);
  });

  updateNavButtons(getEpisodes());
}
