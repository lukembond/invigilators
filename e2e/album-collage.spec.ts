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

  test("expands hovered tiles without reflowing neighboring tiles", async ({ page }) => {
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
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".album-tile") as HTMLElement).scale !== "none");
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

  test("reflows the tile grid on mobile", async ({ page }) => {
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
    expect(Math.round(mobileSummary.tileWidth || 0)).toBe(Math.round(mobileSummary.tileHeight || 0));
    expect(mobileSummary.tileWidth || 0).toBeGreaterThan(130);
  });

  test("loads visible album artwork", async ({ page }) => {
    await openBooklet(page);

    const brokenVisibleArt = await page.evaluate(() => {
      const albumImages = Array.from(document.querySelectorAll<HTMLImageElement>(".album-tile img"));
      return albumImages
        .filter((image) => image.getBoundingClientRect().top < window.innerHeight)
        .filter((image) => image.complete && image.naturalWidth === 0)
        .length;
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
    await expect(page.locator("#overlay-tracks .track-row")).toHaveCount(firstEpisode.tracks.length);
    await expect(page.locator("#overlay-player iframe")).toHaveAttribute("src", /mixcloud\.com/);
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
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/episodes\/ah001$/);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/img\/episode-/);
  });

  test("updates the URL when opening and closing an episode", async ({ page }) => {
    await openBooklet(page);

    const [firstEpisode] = await getEpisodes(page);
    await page.locator(".album-tile").first().click();

    await expect(page.locator("#mix-overlay")).toHaveAttribute("aria-hidden", "false");
    expect(getPathname(page)).toBe(`/episodes/${firstEpisode.id}`);

    await page.locator("#overlay-close").click();
    await expect(page.locator("#mix-overlay")).toHaveAttribute("aria-hidden", "true");
    expect(getPathname(page)).toBe("/");
  });

  test("keeps the deep link current while navigating overlay albums", async ({ page }) => {
    await openBooklet(page);

    const episodes = await getEpisodes(page);
    await page.locator(".album-tile").first().click();
    await expect(page.locator("#mix-overlay")).toHaveAttribute("aria-hidden", "false");

    await page.locator("#overlay-next").click();
    await expect(page.locator("#overlay-title")).toHaveText(episodes[1].title);
    expect(getPathname(page)).toBe(`/episodes/${episodes[1].id}`);

    await page.locator("#overlay-prev").click();
    await expect(page.locator("#overlay-title")).toHaveText(episodes[0].title);
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
        playerBottom: playerRect?.bottom,
        playerTop: playerRect?.top,
        viewportHeight: window.innerHeight,
      };
    });

    expect(overlayMetrics.tracksScrollHeight || 0).toBeGreaterThan(overlayMetrics.tracksClientHeight || 0);
    expect(overlayMetrics.tracksScrollTop).toBe(160);
    expect(overlayMetrics.playerTop || 0).toBeLessThan(overlayMetrics.viewportHeight);
    expect(overlayMetrics.playerBottom || 0).toBeLessThanOrEqual(overlayMetrics.viewportHeight);
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
      touches: [{ clientX: startX, clientY: centerY }],
      changedTouches: [{ clientX: startX, clientY: centerY }],
    });
    await page.locator("#mix-overlay").dispatchEvent("touchend", {
      touches: [],
      changedTouches: [{ clientX: endX, clientY: centerY }],
    });

    await expect(page.locator("#overlay-title")).toHaveText(episodes[1].title);

    await page.locator("#mix-overlay").dispatchEvent("touchstart", {
      touches: [{ clientX: endX, clientY: centerY }],
      changedTouches: [{ clientX: endX, clientY: centerY }],
    });
    await page.locator("#mix-overlay").dispatchEvent("touchend", {
      touches: [],
      changedTouches: [{ clientX: startX, clientY: centerY }],
    });

    await expect(page.locator("#overlay-title")).toHaveText(episodes[0].title);
  });
});