// Applies per-track start timings from the `.cue` sheets into the episode JSON.
//
// The cue sheets list tracks in play order with an `INDEX 01 MM:SS:FF` marker
// (MM can exceed 59; frames are ignored to match the existing data). Some cues
// include a leading "intro" entry that is absent from the JSON tracklist, so we
// pick the leading offset that best aligns cue entries to JSON tracks by title
// similarity, and only write when the alignment is confident.
//
// Usage:
//   node scripts/apply-cuesheet-timings.mjs           # dry-run report
//   node scripts/apply-cuesheet-timings.mjs --write   # write into episode JSON

import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const episodesDir = join(rootDir, "src/content/episodes");

const shouldWrite = process.argv.includes("--write");
const MIN_AVG_SIMILARITY = 0.5;

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const levenshtein = (a, b) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    let prev = previous[0];
    previous[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const temp = previous[j + 1];
      previous[j + 1] =
        a[i] === b[j] ? prev : Math.min(prev + 1, previous[j + 1] + 1, previous[j] + 1);
      prev = temp;
    }
  }
  return previous[b.length];
};

const similarity = (a, b) => {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na && !nb) return 1;
  const maxLen = Math.max(na.length, nb.length) || 1;
  return 1 - levenshtein(na, nb) / maxLen;
};

const trackKey = (artist, title) => `${artist} ${title}`;

const parseCue = (text) => {
  const entries = [];
  let current = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const trackMatch = line.match(/^TRACK\s+\d+\s+AUDIO$/i);
    if (trackMatch) {
      current = { performer: "", title: "", seconds: null };
      entries.push(current);
      continue;
    }
    if (!current) continue;

    const performerMatch = line.match(/^PERFORMER\s+"(.*)"$/i);
    if (performerMatch) {
      current.performer = performerMatch[1];
      continue;
    }
    const titleMatch = line.match(/^TITLE\s+"(.*)"$/i);
    if (titleMatch) {
      current.title = titleMatch[1];
      continue;
    }
    const indexMatch = line.match(/^INDEX\s+01\s+(\d+):(\d+):(\d+)$/i);
    if (indexMatch && current.seconds === null) {
      const minutes = Number(indexMatch[1]);
      const secs = Number(indexMatch[2]);
      current.seconds = minutes * 60 + secs;
    }
  }

  return entries.filter((entry) => entry.seconds !== null);
};

const formatStart = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const scoreOffset = (tracks, cueEntries, offset) => {
  if (cueEntries.length - offset < tracks.length) return -1;
  let total = 0;
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    const cue = cueEntries[i + offset];
    total += similarity(trackKey(track.artist, track.title), trackKey(cue.performer, cue.title));
  }
  return total / tracks.length;
};

const run = () => {
  const files = readdirSync(episodesDir).filter((file) => file.endsWith(".json"));
  const report = [];
  let written = 0;

  for (const file of files) {
    const path = join(episodesDir, file);
    const episode = JSON.parse(readFileSync(path, "utf-8"));

    if (!episode.cuesheet || !Array.isArray(episode.tracks) || episode.tracks.length === 0) {
      continue;
    }

    const cuePath = resolve(episodesDir, episode.cuesheet);
    if (!existsSync(cuePath)) {
      report.push({ id: episode.id, status: "no-cue-file" });
      continue;
    }

    const cueEntries = parseCue(readFileSync(cuePath, "utf-8"));
    if (cueEntries.length === 0) {
      report.push({ id: episode.id, status: "empty-cue" });
      continue;
    }

    const maxOffset = Math.max(0, cueEntries.length - episode.tracks.length);
    let bestOffset = 0;
    let bestScore = -1;
    for (let offset = 0; offset <= maxOffset; offset++) {
      const score = scoreOffset(episode.tracks, cueEntries, offset);
      if (score > bestScore) {
        bestScore = score;
        bestOffset = offset;
      }
    }

    if (bestScore < MIN_AVG_SIMILARITY) {
      report.push({
        id: episode.id,
        status: "low-confidence",
        score: bestScore.toFixed(2),
        offset: bestOffset,
        cue: cueEntries.length,
        json: episode.tracks.length,
      });
      continue;
    }

    for (let i = 0; i < episode.tracks.length; i++) {
      const cue = cueEntries[i + bestOffset];
      episode.tracks[i].start = formatStart(cue.seconds);
      episode.tracks[i].startSeconds = cue.seconds;
    }

    report.push({
      id: episode.id,
      status: "matched",
      score: bestScore.toFixed(2),
      offset: bestOffset,
      cue: cueEntries.length,
      json: episode.tracks.length,
    });

    if (shouldWrite) {
      writeFileSync(path, `${JSON.stringify(episode, null, 2)}\n`);
      written++;
    }
  }

  for (const entry of report.sort((a, b) => a.id.localeCompare(b.id))) {
    if (entry.status === "matched") {
      console.log(
        `+ ${entry.id}: offset ${entry.offset}, score ${entry.score} (cue ${entry.cue} / json ${entry.json})`
      );
    } else {
      console.log(`? ${entry.id}: ${entry.status}${entry.score ? ` score ${entry.score}` : ""}`);
    }
  }

  console.log(
    shouldWrite
      ? `\nWrote timings into ${written} episode file(s).`
      : `\nDry run. Re-run with --write to apply.`
  );
};

run();
