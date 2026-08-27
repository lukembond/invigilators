// Build-time helper that pulls the hearthis waveform image and stores a compact,
// normalized peak array per episode so the site can render its own waveform at
// runtime without relying on the CORS-restricted / rotating hearthis CDN.
//
// Pure Node (uses the `pngjs` dev dependency), so it is safe to run in CI.
//
// Usage:
//   node scripts/fetch-waveforms.mjs            # all episodes with a hearthis url
//   node scripts/fetch-waveforms.mjs ah002 ah010

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const episodesDir = join(rootDir, "src/content/episodes");
const waveformsDir = join(rootDir, "src/content/waveforms");

const PEAK_COUNT = 200;
const MIN_PEAK = 6;

const requestedIds = process.argv.slice(2);

const toApiUrl = (hearthisUrl) => {
  const url = new URL(hearthisUrl);
  return `https://api-v2.hearthis.at${url.pathname}`;
};

const toWaveformUrl = (hearthisId) => {
  const id = String(hearthisId || "");
  if (!/^\d{2,}$/.test(id)) return null;
  return `https://cdn.hearthis.at/_/cache/waveform_mask/${id[0]}/${id[1]}/${id}.png`;
};

const fetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} responded ${response.status}`);
  return response.json();
};

const fetchBuffer = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} responded ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
};

const extractPeaks = (pngBuffer) => {
  // The hearthis waveform mask encodes amplitude in the alpha channel. Collapse
  // each of PEAK_COUNT column buckets to its mean opacity, then normalize with a
  // min/max stretch for good visual contrast.
  const png = PNG.sync.read(pngBuffer);
  const { width, height, data } = png;
  const columnMeans = new Array(PEAK_COUNT).fill(0);

  for (let bucket = 0; bucket < PEAK_COUNT; bucket++) {
    const startX = Math.floor((bucket / PEAK_COUNT) * width);
    const endX = Math.max(startX + 1, Math.floor(((bucket + 1) / PEAK_COUNT) * width));
    let total = 0;
    let samples = 0;

    for (let x = startX; x < endX; x++) {
      for (let y = 0; y < height; y++) {
        const alpha = data[(y * width + x) * 4 + 3];
        total += alpha;
        samples++;
      }
    }

    columnMeans[bucket] = samples > 0 ? total / samples : 0;
  }

  const min = Math.min(...columnMeans);
  const max = Math.max(...columnMeans);
  const range = Math.max(1, max - min);

  return columnMeans.map((value) => {
    const normalized = ((value - min) / range) * 100;
    return Math.max(MIN_PEAK, Math.round(normalized));
  });
};

const run = async () => {
  if (!existsSync(waveformsDir)) mkdirSync(waveformsDir, { recursive: true });

  const files = readdirSync(episodesDir).filter((file) => file.endsWith(".json"));
  let written = 0;

  for (const file of files) {
    const episode = JSON.parse(readFileSync(join(episodesDir, file), "utf-8"));
    if (!episode.hearthis_url) continue;
    if (requestedIds.length > 0 && !requestedIds.includes(episode.id)) continue;

    try {
      let waveformUrl;
      try {
        const meta = await fetchJson(toApiUrl(episode.hearthis_url));
        waveformUrl = meta.waveform_url;
      } catch (error) {
        waveformUrl = toWaveformUrl(episode.hearthis_id);
        if (!waveformUrl) throw error;
        console.warn(`~ ${episode.id}: metadata unavailable, using hearthis_id`);
      }

      if (!waveformUrl) {
        console.warn(`- ${episode.id}: no waveform_url available`);
        continue;
      }

      const png = await fetchBuffer(waveformUrl);
      const peaks = extractPeaks(png);
      writeFileSync(join(waveformsDir, `${episode.id}.json`), `${JSON.stringify(peaks)}\n`);
      written++;
      console.log(`+ ${episode.id}: stored ${peaks.length} peaks`);
    } catch (error) {
      console.warn(`- ${episode.id}: ${error.message}`);
    }
  }

  console.log(`Done. ${written} waveform file(s) written to src/content/waveforms.`);
};

run();
