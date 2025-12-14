import createCache from "@emotion/cache";

export const createEmotionCache = () =>
  createCache({
    key: "mui",
    prepend: true,
  });
