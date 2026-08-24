'use client';

import { useEffect, useState } from 'react';
import { getRepo } from '@/lib/db';

/**
 * Resolve a stored `image_url` to something an `<img>` can actually load.
 *
 * A photo added with no signal is a blob parked in the device mirror, and the recipe
 * carries an `idb:` sentinel until the queue drains. That is not a URL, so it is
 * swapped here for an object URL — which is revoked on the way out, because leaking
 * one per render would pin the whole image in memory for the life of the tab.
 *
 * Everything else passes straight through.
 */
export function useImageSrc(url: string | null): string | null {
  const [src, setSrc] = useState<string | null>(() => (isSentinel(url) ? null : url));

  useEffect(() => {
    if (!isSentinel(url)) {
      setSrc(url);
      return;
    }

    let alive = true;
    let objectUrl: string | null = null;

    void getRepo()
      .readBlob(url.slice(4))
      .then((blob) => {
        if (!alive || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      });

    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return src;
}

function isSentinel(url: string | null): url is string {
  return Boolean(url && url.startsWith('idb:'));
}
