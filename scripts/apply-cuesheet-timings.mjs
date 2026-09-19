// Generates per-track metadata and start timings from the `.cue` sheets into the episode JSON.
//
// The cue sheets list tracks in play order with an `INDEX 01 MM:SS:FF` marker
// (MM can exceed 59; frames are ignored for playback timing). Some cues include
// a leading "intro" entry that is absent from the JSON tracklist.
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
const parseCue = (text) => {
  const entries = [];
  let current = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const trackMatch = line.match(/^TRACK\s+\d+\s+AUDIO$/i);
    if (trackMatch) {
      current = { performer: "", title: "", index: "", seconds: null };
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
      current.index = indexMatch[0].replace(/^INDEX\s+01\s+/i, "");
      const minutes = Number(indexMatch[1]);
      const secs = Number(indexMatch[2]);
      current.seconds = minutes * 60 + secs;
    }
  }

  return entries.filter((entry) => entry.seconds !== null);
};

const isIntro = (entry, index) => index === 0 && entry.title.trim().toLowerCase() === "intro";

const normalizeTrackValue = (value) => String(value || "").toLowerCase().trim();

const findExistingTrack = (tracks, cue) => {
  const artist = normalizeTrackValue(cue.performer);
  const title = normalizeTrackValue(cue.title);
  return (
    tracks.find(
      (track) =>
        normalizeTrackValue(track.artist) === artist && normalizeTrackValue(track.title) === title
    ) || tracks.find((track) => normalizeTrackValue(track.title) === title)
  );
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

const run = () => {
  const files = readdirSync(episodesDir).filter((file) => file.endsWith(".json"));
  const report = [];
  let written = 0;

  for (const file of files) {
    const path = join(episodesDir, file);
    const episode = JSON.parse(readFileSync(path, "utf-8"));

    if (!episode.cuesheet) {
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

    const existingTracks = Array.isArray(episode.tracks) ? episode.tracks : [];
    const tracks = cueEntries
      .filter((entry, index) => !isIntro(entry, index))
      .map((cue, index) => {
        const existingTrack = findExistingTrack(existingTracks, cue);
        return {
          n: index + 1,
          artist: cue.performer,
          title: cue.title,
          label: existingTrack?.label || "",
          index: cue.index,
          start: formatStart(cue.seconds),
          startSeconds: cue.seconds,
        };
      });

    episode.tracks = tracks;

    report.push({
      id: episode.id,
      status: "matched",
      cue: cueEntries.length,
      json: tracks.length,
    });

    if (shouldWrite) {
      writeFileSync(path, `${JSON.stringify(episode, null, 2)}\n`);
      written++;
    }
  }

  for (const entry of report.sort((a, b) => a.id.localeCompare(b.id))) {
    if (entry.status === "matched") {
      console.log(
        `+ ${entry.id}: generated ${entry.json} track(s) from ${entry.cue} cue entr${entry.cue === 1 ? "y" : "ies"}`
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
