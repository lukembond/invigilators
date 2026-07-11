import type { Episode } from "../services/episodes";
import { getTrackStartSeconds } from "./episode";

export const renderTrackMarkers = (episode: Episode, duration: number | null) => {
  if (!duration || duration <= 0) return "";

  return episode.tracks
    .map((track) => {
      const startSeconds = getTrackStartSeconds(track);
      if (startSeconds === null) return "";
      const position = Math.min(100, Math.max(0, (startSeconds / duration) * 100));
      return `<span class="pointer-events-none absolute inset-y-0 z-20" style="left: ${position}%" data-track-marker data-start-seconds="${startSeconds}">
        <span class="absolute inset-y-1.5 left-0 w-px -translate-x-1/2 bg-[rgba(240,228,228,0.18)]"></span>
        <span class="absolute -top-px left-0 size-0 -translate-x-1/2 border-x-[3px] border-t-4 border-x-transparent border-t-[rgba(240,228,228,0.55)]"></span>
      </span>`;
    })
    .join("");
};

const waveformPeaks = new WeakMap<HTMLCanvasElement, number[]>();
const waveformProgress = new WeakMap<HTMLCanvasElement, number>();

const paintWaveform = (canvas: HTMLCanvasElement) => {
  const peaks = waveformPeaks.get(canvas);
  const context = canvas.getContext("2d");
  if (!peaks || peaks.length === 0 || !context) return;

  const ratio = waveformProgress.get(canvas) ?? 0;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssWidth = canvas.clientWidth || 600;
  const cssHeight = canvas.clientHeight || 64;
  const width = Math.max(1, Math.round(cssWidth * dpr));
  const height = Math.max(1, Math.round(cssHeight * dpr));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;

  context.clearRect(0, 0, width, height);

  const barCount = peaks.length;
  const slot = width / barCount;
  const barWidth = Math.max(dpr, slot * 0.58);
  const radius = Math.min(barWidth / 2, 2 * dpr);
  const mid = height / 2;
  const maxBar = height * 0.92;
  const playedBars = ratio * barCount;

  const drawBar = (x: number, y: number, w: number, h: number) => {
    const r = Math.min(radius, w / 2, h / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
    context.fill();
  };

  for (let index = 0; index < barCount; index++) {
    const amplitude = Math.max(0.06, peaks[index] / 100);
    const barHeight = Math.max(dpr * 1.5, amplitude * maxBar);
    const x = index * slot + (slot - barWidth) / 2;
    const y = mid - barHeight / 2;
    context.fillStyle =
      index < playedBars ? "rgba(230, 66, 82, 0.95)" : "rgba(240, 228, 228, 0.34)";
    drawBar(x, y, barWidth, barHeight);
  }

  if (ratio > 0) {
    const playheadX = Math.min(width - dpr, ratio * width);
    context.fillStyle = "rgba(240, 228, 228, 0.9)";
    context.fillRect(playheadX, 0, dpr, height);
  }

  canvas.dataset.waveformRendered = "true";
};

const waveformResizeObserver =
  typeof ResizeObserver !== "undefined"
    ? new ResizeObserver((entries) => {
        for (const entry of entries) paintWaveform(entry.target as HTMLCanvasElement);
      })
    : null;

export const setWaveform = (canvas: HTMLCanvasElement, peaks: number[]) => {
  waveformPeaks.set(canvas, peaks);
  waveformProgress.set(canvas, 0);
  waveformResizeObserver?.observe(canvas);
  window.requestAnimationFrame(() => paintWaveform(canvas));
};

export const setWaveformProgress = (canvas: HTMLCanvasElement, ratio: number) => {
  waveformProgress.set(canvas, Math.min(1, Math.max(0, ratio)));
  paintWaveform(canvas);
};
