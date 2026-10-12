import "./types";
import { initEnterButton, initLandingVideo, initTileImageFallbacks, showBooklet } from "./landing";
import { initAlbumOverlay } from "./overlay";

export const initApp = () => {
  initLandingVideo();
  initEnterButton();
  initTileImageFallbacks();
  initAlbumOverlay();
  if (new URLSearchParams(window.location.search).get("view") === "mixes") {
    showBooklet();
  }
};
