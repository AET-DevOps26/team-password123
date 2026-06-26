import { useEffect, useState } from 'react';
import { fetchBlobUrl } from '../../../shared/api/client';

/**
 * Resolve a meal imageUrl to a renderable <img src>. Local data:/blob: URLs
 * are used as-is; backend `/api/...` paths are fetched with auth into an object URL.
 */
export function useMealPhoto(imageUrl?: string): string | null {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!imageUrl) { setSrc(null); return; }
    if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
      setSrc(imageUrl);
      return;
    }

    let active = true;
    let objectUrl: string | null = null;
    fetchBlobUrl(imageUrl).then((url) => {
      if (!active) { if (url) URL.revokeObjectURL(url); return; }
      objectUrl = url;
      setSrc(url);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageUrl]);

  return src;
}
