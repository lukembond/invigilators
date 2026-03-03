import type { Episode } from "../services/episodes";

declare global {
  interface Window {
    episodes: Episode[];
    INITIAL_LOAD: number;
    currentEpisodeIndex: number;
    loadedCounts: Record<string, number>;
    currentFilter: string;
  }
}

export const initApp = () => {
  window.currentEpisodeIndex = 0;
  window.loadedCounts = { all: window.INITIAL_LOAD || 5 };
  window.currentFilter = "all";
  initEnterButton();
  initMixcloud();
  initInfiniteScroll();
  initKeyboardNav();
  initNavScrollBehavior();
  initFilters();
};

const initEnterButton = () => {
  const enterBtn = document.getElementById("enter-btn");
  const mainContent = document.getElementById("main-content");

  if (enterBtn && mainContent) {
    enterBtn.addEventListener("click", () => {
      enterBtn.classList.add("hidden");
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
};

const initNavScrollBehavior = () => {
  const nav = document.getElementById("nav");
  const mainContent = document.getElementById("main-content");

  if (!nav || !mainContent) return;

  const hero = document.querySelector("section");

  const handleNavVisibility = () => {
    if (!hero) return;

    const heroRect = hero.getBoundingClientRect();
    const mainContentRect = mainContent.getBoundingClientRect();

    const isPastHero = heroRect.bottom <= 0;
    const isInMainContent = mainContentRect.top <= 100;

    if (isPastHero && isInMainContent) {
      nav.style.opacity = "1";
      nav.style.pointerEvents = "auto";
    } else if (!isPastHero) {
      nav.style.opacity = "0";
      nav.style.pointerEvents = "none";
    }
  };

  window.addEventListener("scroll", handleNavVisibility, { passive: true });
  handleNavVisibility();
};

const loadMixcloudEmbed = (container: Element) => {
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
};

export const initMixcloud = () => {
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
};

export const initInfiniteScroll = () => {
  const loadMoreBtn = document.getElementById("load-more-btn");

  const getVisibleHidden = () => {
    const wrappers = document.querySelectorAll(".episode-wrapper.hidden");
    const filter = window.currentFilter || "all";
    return Array.from(wrappers).filter((w) => {
      const type = (w as HTMLElement).dataset.type;
      return filter === "all" || type === filter;
    });
  };

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => {
      const filter = window.currentFilter || "all";
      const loading = document.getElementById("loading");
      const wrappers = getVisibleHidden();

      if (wrappers.length === 0) {
        loadMoreBtn.remove();
        return;
      }

      loadMoreBtn.classList.add("hidden");
      if (loading) loading.classList.remove("hidden");

      setTimeout(() => {
        const toShow = wrappers.slice(0, 5);
        toShow.forEach((wrapper) => {
          wrapper.classList.remove("hidden");
        });

        const currentLoaded = window.loadedCounts[filter] || 0;
        window.loadedCounts[filter] = currentLoaded + toShow.length;

        if (loading) loading.classList.add("hidden");

        const remaining = getVisibleHidden();
        if (remaining.length === 0) {
          loadMoreBtn.remove();
        } else {
          loadMoreBtn.classList.remove("hidden");
        }
      }, 300);
    });
  }

  let scrollTimeout: number;
  window.addEventListener("scroll", () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = window.setTimeout(() => {
      const btn = document.getElementById("load-more-btn");
      if (!btn || btn.classList.contains("hidden")) return;

      const rect = btn.getBoundingClientRect();
      if (rect.top < window.innerHeight + 400) {
        btn.click();
      }
    }, 100);
  });
};

export const initKeyboardNav = () => {
  const navUp = document.getElementById("nav-up");
  const navDown = document.getElementById("nav-down");

  const getEpisodes = () => {
    return Array.from(document.querySelectorAll(".episode-wrapper:not(.hidden)"));
  };

  const updateNavButtons = (episodes: Element[]) => {
    if (navUp) {
      navUp.classList.toggle("opacity-30", window.currentEpisodeIndex === 0);
      navUp.classList.toggle("pointer-events-none", window.currentEpisodeIndex === 0);
    }
    if (navDown) {
      navDown.classList.toggle("opacity-30", window.currentEpisodeIndex >= episodes.length - 1);
      navDown.classList.toggle(
        "pointer-events-none",
        window.currentEpisodeIndex >= episodes.length - 1
      );
    }
  };

  const scrollToEpisode = (index: number) => {
    const episodes = getEpisodes();
    if (index < 0 || index >= episodes.length) return;
    window.currentEpisodeIndex = index;
    const ep = episodes[index] as HTMLElement;
    window.scrollTo({
      top: ep.offsetTop,
      behavior: "smooth",
    });
    updateNavButtons(episodes);
  };

  navUp?.addEventListener("click", () => scrollToEpisode(window.currentEpisodeIndex - 1));
  navDown?.addEventListener("click", () => scrollToEpisode(window.currentEpisodeIndex + 1));

  document.addEventListener("keydown", (e) => {
    const episodes = getEpisodes();
    if (e.key === "ArrowUp") {
      e.preventDefault();
      navUp?.classList.add("active");
      setTimeout(() => navUp?.classList.remove("active"), 300);
      scrollToEpisode(window.currentEpisodeIndex - 1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      navDown?.classList.add("active");
      setTimeout(() => navDown?.classList.remove("active"), 300);
      scrollToEpisode(window.currentEpisodeIndex + 1);
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
        window.currentEpisodeIndex = i;
      }
    });
    updateNavButtons(episodes);
  });

  updateNavButtons(getEpisodes());
};

export const initFilters = () => {
  const filterBtns = document.querySelectorAll(".filter-btn");
  const initialLoad = window.INITIAL_LOAD || 5;

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const filter = (btn as HTMLElement).dataset.filter || "all";
      window.currentFilter = filter;
      window.currentEpisodeIndex = 0;

      filterBtns.forEach((b) => {
        b.classList.remove("bg-white", "text-black", "border-white");
        b.classList.add("text-white/70", "border-white/20");
      });
      btn.classList.remove("text-white/70", "border-white/20");
      btn.classList.add("bg-white", "text-black", "border-white");

      const wrappers = document.querySelectorAll(".episode-wrapper");
      const loadedCount = window.loadedCounts[filter] || initialLoad;
      let visibleCount = 0;

      wrappers.forEach((wrapper) => {
        const type = (wrapper as HTMLElement).dataset.type;
        const shouldShow = filter === "all" || type === filter;

        if (shouldShow) {
          if (visibleCount < loadedCount) {
            wrapper.classList.remove("hidden");
          } else {
            wrapper.classList.add("hidden");
          }
          visibleCount++;
        } else {
          wrapper.classList.add("hidden");
        }
      });

      const loadMore = document.getElementById("load-more");
      const loadMoreBtn = document.getElementById("load-more-btn");

      if (visibleCount > loadedCount && loadMore && loadMoreBtn) {
        loadMore.classList.remove("hidden");
        loadMoreBtn.classList.remove("hidden");
      } else if (loadMore && loadMoreBtn) {
        loadMore.classList.add("hidden");
        loadMoreBtn.classList.add("hidden");
      }

      const navUp = document.getElementById("nav-up");
      const navDown = document.getElementById("nav-down");
      if (navUp) {
        navUp.classList.add("opacity-30", "pointer-events-none");
      }
      if (navDown) {
        navDown.classList.add("opacity-30", "pointer-events-none");
      }

      const episodesSection = document.getElementById("episodes");
      if (episodesSection) {
        const ep = episodesSection.querySelector(".episode-wrapper:not(.hidden)") as HTMLElement;
        if (ep) {
          window.scrollTo({ top: ep.offsetTop, behavior: "smooth" });
        }
      }
    });
  });
};
