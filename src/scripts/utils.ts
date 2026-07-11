export const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const escapeHtml = (value: string | undefined) => {
  return String(value || "").replace(/[&<>"]/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
    };
    return entities[char];
  });
};

export const preloadImage = (src: string) => {
  return new Promise<void>((resolve) => {
    const preload = new Image();
    preload.onload = () => {
      if (preload.decode) {
        preload.decode().then(
          () => resolve(),
          () => resolve()
        );
        return;
      }
      resolve();
    };
    preload.onerror = () => resolve();
    preload.src = src;
  });
};
