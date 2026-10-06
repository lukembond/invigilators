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

const fetchEncodedWaveform = async (episode) => {
  const meta = await fetchJson(toApiUrl(episode.hearthis_url));
  if (!/^\d+$/.test(String(meta.user_id)) || !/^\d+$/.test(String(meta.id))) {
    throw new Error("waveform IDs unavailable");
  }
  const [imageBuffer, maskBuffer] = await Promise.all([
    fetchBuffer(`https://hearthis.at/_/cache/waveform_png/${meta.user_id}/${meta.id}.png`),
    fetchBuffer("https://hearthis.at/_/images/logo_mask.png"),
  ]);
  const image = PNG.sync.read(imageBuffer);
  const mask = PNG.sync.read(maskBuffer);
  if (image.width !== mask.width || image.height !== mask.height) {
    throw new Error("waveform image and mask dimensions differ");
  }
  const samples = [];
  for (let pixel = image.width * image.height - 1; pixel >= 0 && samples.length < 3000; pixel--) {
    const offset = pixel * 4;
    if (mask.data[offset] === 0) continue;
    for (let channel = 0; channel < 3 && samples.length < 3000; channel++) {
      samples.push(mask.data[offset + channel] - image.data[offset + channel]);
    }
  }
  if (samples.length !== 3000 || samples.some((value) => value < 0 || value > 255)) {
    throw new Error("invalid encoded waveform samples");
  }
  return samples;
};

const fetchWaveData = async (episode) => {
  const response = await fetch(episode.hearthis_url);
  if (!response.ok) throw new Error(`${episode.hearthis_url} responded ${response.status}`);
  const html = await response.text();
  const canvas = [...html.matchAll(/<canvas\b[^>]*>/g)].map(([tag]) => tag).find((tag) =>
    tag.includes('is="waveform-display"') && tag.includes(`data-track_id="${episode.hearthis_id}"`),
  );
  const dataUrl = canvas?.match(/data-url="([^"]+)"/)?.[1];
  if (!dataUrl) throw new Error("waveform data URL unavailable");
  const data = await fetchJson(new URL(dataUrl, episode.hearthis_url));
  if (!Array.isArray(data) || !data.length || !data.every((value) => Number.isInteger(value) && value >= 0 && value <= 255)) {
    throw new Error("invalid waveform data");
  }
  return data;
};

const extractDataPeaks = (data) => {
  const peaks = Array.from({ length: PEAK_COUNT }, (_, bucket) => {
    const start = Math.floor((bucket / PEAK_COUNT) * data.length);
    const end = Math.max(start + 1, Math.ceil(((bucket + 1) / PEAK_COUNT) * data.length));
    const samples = data.slice(start, end);
    return samples.reduce((total, value) => total + Math.abs(value - 128), 0) / samples.length;
  });
  const max = Math.max(1, ...peaks);
  return peaks.map((peak) => Math.max(MIN_PEAK, Math.round((peak / max) * 100)));
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
      let peaks;
      try {
        peaks = extractDataPeaks(await fetchEncodedWaveform(episode));
      } catch (error) {
        console.warn(`~ ${episode.id}: ${error.message}; trying waveform data`);
        try {
          peaks = extractDataPeaks(await fetchWaveData(episode));
        } catch (dataError) {
          console.warn(`~ ${episode.id}: ${dataError.message}; trying waveform mask`);
          let waveformUrl;
          try {
            const meta = await fetchJson(toApiUrl(episode.hearthis_url));
            waveformUrl = meta.waveform_url;
          } catch {
            waveformUrl = toWaveformUrl(episode.hearthis_id);
          }
          if (!waveformUrl) throw dataError;
          peaks = extractPeaks(await fetchBuffer(waveformUrl));
        }
      }
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
