"use client";

import { CacheProvider } from "@emotion/react";
import createCache, { type Options } from "@emotion/cache";
import { PropsWithChildren, useMemo, useState } from "react";
import { useServerInsertedHTML } from "next/navigation";

type EmotionCacheProviderProps = PropsWithChildren<{
  options?: Options;
}>;

export const EmotionCacheProvider = ({ options, children }: EmotionCacheProviderProps) => {
  const [{ cache, flush }] = useState(() => {
    const cache = createCache({ key: "mui", prepend: true, ...options });
    cache.compat = true;
    const prevInsert = cache.insert;
    let inserted: string[] = [];

    cache.insert = (...args) => {
      const [, serialized] = args;
      if (!cache.inserted[serialized.name]) {
        inserted.push(serialized.name);
      }
      return prevInsert(...args);
    };

    const flush = () => {
      if (inserted.length === 0) {
        return null;
      }
      const prevInserted = inserted;
      inserted = [];
      return prevInserted;
    };

    return { cache, flush };
  });

  useServerInsertedHTML(() => {
    const names = flush();
    if (!names || names.length === 0) {
      return null;
    }

    return (
      <style
        data-emotion={`${cache.key} ${names.join(" ")}`}
        dangerouslySetInnerHTML={{
          __html: names.map((name) => cache.inserted[name]).join(""),
        }}
      />
    );
  });

  return <CacheProvider value={cache}>{children}</CacheProvider>;
};
