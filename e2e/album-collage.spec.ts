import { expect, test } from "@playwright/test";

type BrowserEpisode = {
  id: string;
  title: string;
  description: string;
  tracks: unknown[];
};

test.describe("album collage", () => {
  test("opens the Figma Make booklet and renders JSON-backed tiles in current order", async ({ page }) => {
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

    const episodeSummary = await page.evaluate(() => {
      const episodes = (globalThis as unknown as { episodes: BrowserEpisode[] }).episodes;
      const firstTile = document.querySelector<HTMLElement>(".album-tile");
      const grid = document.querySelector<HTMLElement>(".collage-grid");
      const tile = document.querySelector<HTMLElement>(".album-tile");
      const gridStyles = grid ? getComputedStyle(grid) : null;
      const tileRect = tile?.getBoundingClientRect();
      const wrap = document.querySelector<HTMLElement>(".booklet-grid-wrap");
      const wrapStyles = wrap ? getComputedStyle(wrap) : null;
      return {
        totalEpisodes: episodes.length,
        firstEpisodeId: episodes[0]?.id,
        firstEpisodeTitle: episodes[0]?.title,
        firstTileId: firstTile?.dataset.id,
        firstTileTitle: firstTile?.textContent,
        columns: gridStyles?.gridTemplateColumns.split(" ").length,
        tileWidth: tileRect?.width,
        tileHeight: tileRect?.height,
        wrapOverflowY: wrapStyles?.overflowY,
      };
    });

    await expect(page.locator(".album-tile")).toHaveCount(episodeSummary.totalEpisodes);
    expect(episodeSummary.firstTileId).toBe(episodeSummary.firstEpisodeId);
    expect(episodeSummary.firstTileTitle).toContain(episodeSummary.firstEpisodeTitle);
    expect(episodeSummary.columns).toBeGreaterThan(1);
    expect(episodeSummary.columns).toBeLessThan(10);
    expect(Math.round(episodeSummary.tileWidth || 0)).toBe(Math.round(episodeSummary.tileHeight || 0));
    expect(episodeSummary.tileWidth || 0).toBeGreaterThan(130);
    expect(episodeSummary.wrapOverflowY).toBe("auto");

    await page.mouse.move(5, 5);
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".album-tile") as HTMLElement).transform === "none");
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
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".album-tile") as HTMLElement).transform !== "none");
    const hoverEnd = await page.evaluate(() => {
      const firstTile = document.querySelector<HTMLElement>(".album-tile");
      const secondTile = document.querySelectorAll<HTMLElement>(".album-tile")[1];
      const firstRect = firstTile?.getBoundingClientRect();
      const secondRect = secondTile?.getBoundingClientRect();
      return {
        firstWidth: firstRect?.width,
        secondLeft: secondRect?.left,
        transform: firstTile ? getComputedStyle(firstTile).transform : "none",
      };
    });
    expect(hoverEnd.firstWidth || 0).toBeGreaterThan(hoverStart.firstWidth || 0);
    expect(Math.round(hoverEnd.secondLeft || 0)).toBe(Math.round(hoverStart.secondLeft || 0));
    expect(hoverEnd.transform).not.toBe("none");

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
    expect(mobileSummary.columns).toBeLessThan(episodeSummary.columns || 10);
    expect(Math.round(mobileSummary.tileWidth || 0)).toBe(Math.round(mobileSummary.tileHeight || 0));
    expect(mobileSummary.tileWidth || 0).toBeGreaterThan(130);

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
    await page.goto("/");
    await page.locator("#enter-btn").click();
    await expect(page.locator("#booklet")).toBeVisible();

    const firstEpisode = await page.evaluate(() => {
      return (globalThis as unknown as { episodes: BrowserEpisode[] }).episodes[0];
    });
    await page.locator(".album-tile").first().click();

    await expect(page.locator("#mix-overlay")).toHaveAttribute("aria-hidden", "false");
    await expect(page.locator("#overlay-title")).toHaveText(firstEpisode.title);
    await expect(page.locator("#overlay-description")).toHaveText(firstEpisode.description);
    await expect(page.locator("#overlay-tracks .track-row")).toHaveCount(firstEpisode.tracks.length);
    await expect(page.locator("#overlay-player iframe")).toHaveAttribute("src", /mixcloud\.com/);

    await page.locator("#overlay-next").click();
    const secondEpisode = await page.evaluate(() => {
      return (globalThis as unknown as { episodes: BrowserEpisode[] }).episodes[1];
    });
    await expect(page.locator("#overlay-title")).toHaveText(secondEpisode.title);

    await page.locator("#overlay-prev").click();
    await expect(page.locator("#overlay-title")).toHaveText(firstEpisode.title);

    await page.keyboard.press("Escape");
    await expect(page.locator("#mix-overlay")).toHaveAttribute("aria-hidden", "true");
  });
});