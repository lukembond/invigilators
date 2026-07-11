import "./types";
import { initEnterButton, initLandingVideo, initTileImageFallbacks } from "./landing";
import { initAlbumOverlay } from "./overlay";

export const initApp = () => {
  initLandingVideo();
  initEnterButton();
  initTileImageFallbacks();
  initAlbumOverlay();
};
