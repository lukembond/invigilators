import { expect, type Page, test } from "@playwright/test";

type BrowserEpisode = {
  id: string;
  title: string;
  description: string;
  image_bg?: string;
  image_cover?: string;
  tracks: unknown[];
};

const getEpisodes = async (page: Page) => {
  return page.evaluate(() => (globalThis as unknown as { episodes: BrowserEpisode[] }).episodes);
};

const openBooklet = async (page: Page) => {
  await page.goto("/");
  await page.locator("#enter-btn").click();
  await expect(page.locator("#landing")).toBeHidden();
  await expect(page.locator("#booklet")).toBeVisible();
};

const getPathname = (page: Page) => new URL(page.url()).pathname;

test.describe("Render Mix collage", () => {
  test("loads the landing video and opens the collage", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("#video_background")).toBeVisible();
    await expect(page.locator("#enter-btn")).toBeVisible();
    await page.waitForFunction(() => {
      const video = document.querySelector("#video_background");
      return video instanceof HTMLVideoElement && !video.paused && video.currentTime > 0;
    });
    await expect(page.locator("#booklet")).toBeHidden();

    await page.locator("#enter-btn").click();
    await expect(page.locator("#landing")).toBeHidden();
    await expect(page.locator("#booklet")).toBeVisible();
  });

  test("uses an iris transition when opening the booklet", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");

    await page.locator("#enter-btn").click();
    await expect(page.locator("#landing")).toHaveClass(/is-iris-transition/);
    await expect(page.locator("#landing")).toHaveCSS("--iris-target-x", /px/);
    await expect(page.locator("#landing")).toHaveCSS("--iris-target-y", /px/);
    await expect(page.locator("#landing")).toBeHidden();
    await expect(page.locator("#booklet")).toBeVisible();
  });

  test("renders tiles in the current episode order", async ({ page }) => {
    await openBooklet(page);

    const episodes = await getEpisodes(page);
    const firstTileSummary = await page.evaluate(() => {
      const firstTile = document.querySelector<HTMLElement>(".album-tile");
      return {
        id: firstTile?.dataset.id,
        title: firstTile?.textContent,
      };
    });

    await expect(page.locator(".album-tile")).toHaveCount(episodes.length);
    expect(firstTileSummary.id).toBe(episodes[0]?.id);
    expect(firstTileSummary.title).toContain(episodes[0]?.title);
  });

  test("lays out a masonry-style square tile grid on desktop", async ({ page }) => {
    await openBooklet(page);

    const gridSummary = await page.evaluate(() => {
      const grid = document.querySelector<HTMLElement>(".collage-grid");
      const tile = document.querySelector<HTMLElement>(".album-tile");
      const gridStyles = grid ? getComputedStyle(grid) : null;
      const tileRect = tile?.getBoundingClientRect();
      const wrap = document.querySelector<HTMLElement>(".booklet-grid-wrap");
      const wrapStyles = wrap ? getComputedStyle(wrap) : null;
      return {
        columns: gridStyles?.gridTemplateColumns.split(" ").length,
        tileWidth: tileRect?.width,
        tileHeight: tileRect?.height,
        wrapOverflowY: wrapStyles?.overflowY,
      };
    });

    expect(gridSummary.columns).toBeGreaterThan(1);
    expect(gridSummary.columns).toBeLessThan(10);
    expect(Math.round(gridSummary.tileWidth || 0)).toBe(Math.round(gridSummary.tileHeight || 0));
    expect(gridSummary.tileWidth || 0).toBeGreaterThan(130);
    expect(gridSummary.wrapOverflowY).toBe("auto");
  });

  test("expands hovered tiles without reflowing neighboring tiles", async ({ page, isMobile }) => {
    test.skip(isMobile, "hover behavior only applies to pointer devices");
    await openBooklet(page);

    await page.mouse.move(5, 5);
    const hoverStart = await page.evaluate(() => {
      const firstTile = document.querySelector<HTMLElement>(".album-tile");
      const secondTile = document.querySelectorAll<HTMLElement>(".album-tile")[1];
      const firstRect = firstTile?.getBoundingClientRect();
      const secondRect = secondTile?.getBoundingClientRect();
      return {
        firstWidth: firstRect?.width,
        secondLeft: secondRect?.left,
      };
    });

    await page.locator(".album-tile").first().hover();
    await page.waitForFunction(
      () => getComputedStyle(document.querySelector(".album-tile") as HTMLElement).scale !== "none"
    );
    const hoverEnd = await page.evaluate(() => {
      const firstTile = document.querySelector<HTMLElement>(".album-tile");
      const image = firstTile?.querySelector("img");
      const secondTile = document.querySelectorAll<HTMLElement>(".album-tile")[1];
      const firstRect = firstTile?.getBoundingClientRect();
      const secondRect = secondTile?.getBoundingClientRect();
      return {
        firstWidth: firstRect?.width,
        secondLeft: secondRect?.left,
        imageScale: image ? getComputedStyle(image).scale : "none",
        scale: firstTile ? getComputedStyle(firstTile).scale : "none",
      };
    });

    expect(hoverEnd.firstWidth || 0).toBeGreaterThan(hoverStart.firstWidth || 0);
    expect(Math.round(hoverEnd.secondLeft || 0)).toBe(Math.round(hoverStart.secondLeft || 0));
    expect(hoverEnd.scale).not.toBe("none");
    expect(hoverEnd.imageScale).toBe("none");
  });

  test("reflows the tile grid on mobile", async ({ page, isMobile }) => {
    test.skip(isMobile, "test requires a desktop viewport before resizing to mobile");
    await openBooklet(page);

    const desktopColumns = await page.evaluate(() => {
      const grid = document.querySelector<HTMLElement>(".collage-grid");
      return getComputedStyle(grid as HTMLElement).gridTemplateColumns.split(" ").length;
    });

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileSummary = await page.evaluate(() => {
      const grid = document.querySelector<HTMLElement>(".collage-grid");
      const tile = document.querySelector<HTMLElement>(".album-tile");
      const gridStyles = grid ? getComputedStyle(grid) : null;
      const tileRect = tile?.getBoundingClientRect();
      return {
        columns: gridStyles?.gridTemplateColumns.split(" ").length,
        tileWidth: tileRect?.width,
        tileHeight: tileRect?.height,
      };
    });

    expect(mobileSummary.columns).toBeLessThan(desktopColumns);
    expect(Math.round(mobileSummary.tileWidth || 0)).toBe(
      Math.round(mobileSummary.tileHeight || 0)
    );
    expect(mobileSummary.tileWidth || 0).toBeGreaterThan(130);
  });

  test("loads visible album artwork", async ({ page }) => {
    await openBooklet(page);

    const brokenVisibleArt = await page.evaluate(() => {
      const albumImages = Array.from(
        document.querySelectorAll<HTMLImageElement>(".album-tile img")
      );
      return albumImages
        .filter((image) => image.getBoundingClientRect().top < window.innerHeight)
        .filter((image) => image.complete && image.naturalWidth === 0).length;
    });
    expect(brokenVisibleArt).toBe(0);
  });

  test("opens an overlay sourced from the selected album JSON", async ({ page }) => {
    await openBooklet(page);

    const [firstEpisode] = await getEpisodes(page);
    await page.locator(".album-tile").first().click();

    await expect(page.locator("#mix-overlay")).toHaveAttribute("aria-hidden", "false");
    await expect(page.locator("#overlay-title")).toHaveText(firstEpisode.title);
    await expect(page.locator("#overlay-description")).toHaveText(firstEpisode.description);
    await expect(page.locator("#overlay-tracks .track-row")).toHaveCount(
      firstEpisode.tracks.length
    );
    await expect(page.locator("#overlay-tracks .track-row").first().locator("b")).toBeVisible();
    await expect(
      page.locator("#overlay-player iframe, #overlay-player [data-native-player]")
    ).toHaveCount(1);
    const playerLayout = await page.locator("#overlay-player").evaluate((player) => {
      const panel = player.closest("#overlay-track-panel");
      const heading = panel?.querySelector<HTMLElement>(".tracklist-heading");
      return {
        isInTrackPanel: Boolean(panel),
        playerTop: player.getBoundingClientRect().top,
        headingTop: heading?.getBoundingClientRect().top,
      };
    });
    expect(playerLayout.isInTrackPanel).toBe(true);
    expect(playerLayout.playerTop).toBeLessThan(playerLayout.headingTop || 0);
  });

  test("opens an episode overlay from a direct deep link", async ({ page }) => {
    await page.goto("/episodes/ah001");

    const episodes = await getEpisodes(page);
    const episode = episodes.find(({ id }) => id === "ah001");

    expect(episode).toBeTruthy();
    await expect(page.locator("#landing")).toBeHidden();
    await expect(page.locator("#booklet")).toBeVisible();
    await expect(page.locator("#mix-overlay")).toHaveAttribute("aria-hidden", "false");
    await expect(page.locator("#overlay-title")).toHaveText(episode?.title || "");
    await expect(page).toHaveTitle(`${episode?.title} | The Invigilators`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/episodes\/ah001$/
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /\/img\/episode-/
    );
  });

  test("uses timestamped tracks to seek the native hearthis player", async ({ page }) => {
    await page.route("https://api-v2.hearthis.at/theinvigilators/ah002/", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          stream_url: "https://example.com/ah002.mp3",
          waveform_url:
            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1000' height='200'%3E%3Cpath fill='%23e8e8e8' d='M0 90h100v-40h100v80h100V20h100v160h100V60h100v80h100V35h100v130h100V75h100v50H0z'/%3E%3C/svg%3E",
        }),
      });
    });

    await page.goto("/episodes/ah002");
    await expect(page.locator("#mix-overlay")).toHaveAttribute("aria-hidden", "false");
    await expect(page.locator("#overlay-player [data-native-player]")).toBeVisible();
    await expect(page.locator("#overlay-player iframe")).toHaveCount(0);
    await expect(page.locator("#overlay-player audio")).toHaveAttribute("src", /ah002\.mp3/);
    await expect(page.locator("#overlay-tracks .track-row").first()).toHaveAttribute(
      "data-start-seconds",
      "54"
    );
    await expect(page.locator(".tracklist-columns span").last()).toHaveText("Length");
    await expect(page.locator("#overlay-tracks .track-row").first().locator("b")).toHaveText(
      "7:07"
    );
    await expect(page.locator("[data-track-marker]")).toHaveCount(12);
    await expect(page.locator("[data-player-waveform-canvas]")).toHaveAttribute(
      "data-waveform-rendered",
      "true"
    );

    await page.locator("#overlay-player audio").evaluate((element) => {
      const audio = element as HTMLAudioElement;
      let currentTime = 0;
      Object.defineProperty(audio, "currentTime", {
        configurable: true,
        get: () => currentTime,
        set: (value) => {
          currentTime = value;
        },
      });
      let paused = true;
      Object.defineProperty(audio, "paused", {
        configurable: true,
        get: () => paused,
      });
      audio.play = () => {
        paused = false;
        audio.dispatchEvent(new Event("play", { bubbles: true }));
        return Promise.resolve();
      };
      audio.pause = () => {
        paused = true;
        audio.dispatchEvent(new Event("pause", { bubbles: true }));
      };
    });

    await page.locator('#overlay-tracks [data-start-seconds="481"]').click();
    await expect(page.locator('#overlay-tracks [data-start-seconds="481"]')).toHaveAttribute(
      "aria-current",
      "true"
    );
    await expect(page.locator('#overlay-tracks [data-start-seconds="481"]')).toHaveAttribute(
      "data-playing",
      "true"
    );
    await page.mouse.move(0, 0);
    await expect(
      page.locator('#overlay-tracks [data-start-seconds="481"] .track-play-icon')
    ).toHaveCSS("display", "block");
    await page.locator('#overlay-tracks [data-start-seconds="481"]').hover();
    await expect(
      page.locator('#overlay-tracks [data-start-seconds="481"] .track-pause-icon')
    ).toHaveCSS("display", "block");

    await page.locator('#overlay-tracks [data-start-seconds="481"]').click();
    await expect(page.locator('#overlay-tracks [data-start-seconds="481"]')).not.toHaveAttribute(
      "data-playing"
    );
    await page.mouse.move(0, 0);
    await expect(
      page.locator('#overlay-tracks [data-start-seconds="481"] .track-play-icon')
    ).toHaveCSS("display", "block");

    await page.locator("#overlay-player audio").evaluate((element) => {
      const audio = element as HTMLAudioElement;
      audio.currentTime = 810;
      audio.dispatchEvent(new Event("timeupdate", { bubbles: true }));
    });
    await expect(page.locator('#overlay-tracks [data-start-seconds="801"]')).toHaveAttribute(
      "aria-current",
      "true"
    );

    const currentTime = await page.locator("#overlay-player audio").evaluate((element) => {
      const audio = element as HTMLAudioElement;
      return audio.currentTime;
    });
    expect(currentTime).toBe(810);
  });

  test("updates the URL when opening and closing an episode", async ({ page }) => {
    await openBooklet(page);

    const [firstEpisode] = await getEpisodes(page);
    await page.locator(".album-tile").first().click();

    await expect(page.locator("#mix-overlay")).toHaveAttribute("aria-hidden", "false");
    await expect(page).toHaveTitle(`${firstEpisode.title} | The Invigilators`);
    expect(getPathname(page)).toBe(`/episodes/${firstEpisode.id}`);

    await page.locator("#overlay-close").click();
    await expect(page.locator("#mix-overlay")).toHaveAttribute("aria-hidden", "true");
    await expect(page).toHaveTitle("The Invigilators");
    expect(getPathname(page)).toBe("/");
  });

  test("resets the URL and title when closing a direct episode deep link", async ({ page }) => {
    await page.goto("/episodes/ah033");

    const episodes = await getEpisodes(page);
    const episode = episodes.find(({ id }) => id === "ah033");

    expect(episode).toBeTruthy();
    await expect(page.locator("#mix-overlay")).toHaveAttribute("aria-hidden", "false");
    await expect(page).toHaveTitle(`${episode?.title} | The Invigilators`);
    expect(getPathname(page)).toBe("/episodes/ah033");

    await page.locator("#overlay-close").click();
    await expect(page.locator("#mix-overlay")).toHaveAttribute("aria-hidden", "true");
    await expect(page).toHaveTitle("The Invigilators");
    expect(getPathname(page)).toBe("/");
  });

  test("keeps the deep link current while navigating overlay albums", async ({ page }) => {
    await openBooklet(page);

    const episodes = await getEpisodes(page);
    await page.locator(".album-tile").first().click();
    await expect(page.locator("#mix-overlay")).toHaveAttribute("aria-hidden", "false");
    await expect(page).toHaveTitle(`${episodes[0].title} | The Invigilators`);

    await page.locator("#overlay-next").click();
    await expect(page.locator("#overlay-title")).toHaveText(episodes[1].title);
    await expect(page).toHaveTitle(`${episodes[1].title} | The Invigilators`);
    expect(getPathname(page)).toBe(`/episodes/${episodes[1].id}`);

    await page.locator("#overlay-prev").click();
    await expect(page.locator("#overlay-title")).toHaveText(episodes[0].title);
    await expect(page).toHaveTitle(`${episodes[0].title} | The Invigilators`);
    expect(getPathname(page)).toBe(`/episodes/${episodes[0].id}`);
  });

  test("uses direction-specific page transitions for overlay navigation", async ({ page }) => {
    await openBooklet(page);

    await page.locator(".album-tile").first().click();
    await expect(page.locator("#mix-overlay")).toHaveAttribute("aria-hidden", "false");

    await page.locator("#overlay-next").click();
    await expect(page.locator(".mix-detail-body")).toHaveClass(/episode-page-transition--next/);
    await expect(page.locator(".mix-detail-body")).toHaveClass(/episode-page-transition--out/);

    await expect(page.locator(".mix-detail-body")).not.toHaveClass(/episode-page-transition/);
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(".mix-detail-body")).toHaveClass(/episode-page-transition--prev/);
    await expect(page.locator(".mix-detail-body")).toHaveClass(/episode-page-transition--out/);
  });

  test("handles browser back and forward for episode overlays", async ({ page }) => {
    await openBooklet(page);

    const [firstEpisode] = await getEpisodes(page);
    await page.locator(".album-tile").first().click();
    await expect(page.locator("#mix-overlay")).toHaveAttribute("aria-hidden", "false");
    expect(getPathname(page)).toBe(`/episodes/${firstEpisode.id}`);

    await page.goBack();
    await expect(page.locator("#mix-overlay")).toHaveAttribute("aria-hidden", "true");
    expect(getPathname(page)).toBe("/");

    await page.goForward();
    await expect(page.locator("#mix-overlay")).toHaveAttribute("aria-hidden", "false");
    await expect(page.locator("#overlay-title")).toHaveText(firstEpisode.title);
    expect(getPathname(page)).toBe(`/episodes/${firstEpisode.id}`);
  });

  test("uses the selected album background behind the tracklist", async ({ page }) => {
    await openBooklet(page);

    const [firstEpisode] = await getEpisodes(page);
    const expectedImage = firstEpisode.image_bg || firstEpisode.image_cover || "ahNotFound.png";
    await page.locator(".album-tile").first().click();

    await expect(page.locator("#mix-overlay")).toHaveAttribute("aria-hidden", "false");
    const backgroundImage = await page.locator("#overlay-track-panel").evaluate((panel) => {
      return getComputedStyle(panel).backgroundImage;
    });
    expect(backgroundImage).toContain(expectedImage);
    expect(backgroundImage).toContain("linear-gradient");
  });

  test("keeps long desktop tracklists scrollable with the player visible", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await openBooklet(page);

    const longestEpisode = await page.evaluate(() => {
      const episodes = (globalThis as unknown as { episodes: BrowserEpisode[] }).episodes;
      return episodes.reduce(
        (longest, episode, index) => {
          if (episode.tracks.length > longest.trackCount) {
            return { index, trackCount: episode.tracks.length };
          }

          return longest;
        },
        { index: 0, trackCount: 0 }
      );
    });
    await page.locator(`.album-tile[data-index="${longestEpisode.index}"]`).click();
    await expect(page.locator("#mix-overlay")).toHaveAttribute("aria-hidden", "false");

    const overlayMetrics = await page.evaluate(() => {
      const tracks = document.getElementById("overlay-tracks");
      const playerPanel = document.querySelector<HTMLElement>(".detail-player-panel");
      const playerRect = playerPanel?.getBoundingClientRect();
      if (tracks) tracks.scrollTop = 160;

      return {
        tracksClientHeight: tracks?.clientHeight,
        tracksScrollHeight: tracks?.scrollHeight,
        tracksScrollTop: tracks?.scrollTop,
        playerTop: playerRect?.top,
        viewportHeight: window.innerHeight,
      };
    });

    expect(overlayMetrics.tracksScrollHeight || 0).toBeGreaterThan(
      overlayMetrics.tracksClientHeight || 0
    );
    expect(overlayMetrics.tracksScrollTop).toBe(160);
    expect(overlayMetrics.playerTop || 0).toBeLessThan(overlayMetrics.viewportHeight);
  });

  test("navigates overlay albums and closes with Escape", async ({ page }) => {
    await openBooklet(page);

    const episodes = await getEpisodes(page);
    await page.locator(".album-tile").first().click();
    await expect(page.locator("#mix-overlay")).toHaveAttribute("aria-hidden", "false");

    await page.locator("#overlay-next").click();
    await expect(page.locator("#overlay-title")).toHaveText(episodes[1].title);

    await page.locator("#overlay-prev").click();
    await expect(page.locator("#overlay-title")).toHaveText(episodes[0].title);

    await page.keyboard.press("Escape");
    await expect(page.locator("#mix-overlay")).toHaveAttribute("aria-hidden", "true");
  });

  test("uses an iris transition when opening and closing an episode overlay", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await openBooklet(page);

    await page.locator(".album-tile").first().click();
    await expect(page.locator("#mix-overlay")).toHaveClass(/is-iris-opening/);
    await expect(page.locator("#mix-overlay")).toHaveCSS("--iris-tile-x", /px/);
    await expect(page.locator("#mix-overlay")).toHaveCSS("--iris-tile-y", /px/);
    await expect(page.locator("#mix-overlay")).toHaveAttribute("aria-hidden", "false");

    await page.locator("#overlay-close").click();
    await expect(page.locator("#mix-overlay")).toHaveClass(/is-iris-closing/);
    await expect(page.locator("#mix-overlay")).toHaveAttribute("aria-hidden", "true");
  });

  test("supports swipe nav between episodes on mobile", async ({ page, isMobile }) => {
    test.skip(!isMobile, "swipe nav only enabled on mobile widths");
    await openBooklet(page);

    const episodes = await getEpisodes(page);
    await page.locator(".album-tile").first().click();
    await expect(page.locator("#mix-overlay")).toHaveAttribute("aria-hidden", "false");
    await expect(page.locator("#overlay-title")).toHaveText(episodes[0].title);

    const overlayBox = await page.locator("#mix-overlay").boundingBox();
    if (!overlayBox) throw new Error("overlay not visible");
    const centerY = overlayBox.y + overlayBox.height / 2;
    const startX = overlayBox.x + overlayBox.width - 30;
    const endX = overlayBox.x + 30;

    await page.locator("#mix-overlay").dispatchEvent("touchstart", {
      touches: [{ identifier: 0, clientX: startX, clientY: centerY }],
      changedTouches: [{ identifier: 0, clientX: startX, clientY: centerY }],
    });
    await page.locator("#mix-overlay").dispatchEvent("touchend", {
      touches: [],
      changedTouches: [{ identifier: 0, clientX: endX, clientY: centerY }],
    });

    await expect(page.locator("#overlay-title")).toHaveText(episodes[1].title);

    await page.locator("#mix-overlay").dispatchEvent("touchstart", {
      touches: [{ identifier: 1, clientX: endX, clientY: centerY }],
      changedTouches: [{ identifier: 1, clientX: endX, clientY: centerY }],
    });
    await page.locator("#mix-overlay").dispatchEvent("touchend", {
      touches: [],
      changedTouches: [{ identifier: 1, clientX: startX, clientY: centerY }],
    });

    await expect(page.locator("#overlay-title")).toHaveText(episodes[0].title);
  });
});
