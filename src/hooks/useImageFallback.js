import { useMemo, useState, useEffect, useRef } from 'react';
import imagePreloader from '../utilities/image-preloader';

// In-memory cache of URLs we've already successfully loaded during this session.
// This prevents skeleton re-appearing and redundant preload work on remounts.
const loadedImageUrls = new Set();

/**
 * Hook that manages image preloading with skeleton fallback.
 *
 * Handles browser-cache detection, session-level URL caching, and
 * IntersectionObserver-based lazy preloading via `imagePreloader`.
 *
 * @param {string|null} imageSrc - URL of the image to preload
 * @param {Object} [options]
 * @param {boolean} [options.forcePreload=false] - Skip lazy/intersection observer and load immediately
 * @param {string} [options.rootMargin='400px'] - IntersectionObserver root margin
 * @returns {{ containerRef: React.RefObject, imageLoaded: boolean }}
 */
export default function useImageFallback(imageSrc, { forcePreload = false, rootMargin = '400px' } = {}) {
  const containerRef = useRef(null);
  const prevImageSrcRef = useRef(null);

  // Check if image is already cached in browser to avoid skeleton flash on re-renders.
  // This runs synchronously during render to set correct initial state.
  const isImageCached = useMemo(() => {
    if (!imageSrc) return true;
    if (loadedImageUrls.has(imageSrc)) return true;
    const img = new Image();
    img.src = imageSrc;
    return img.complete && img.naturalHeight > 0;
  }, [imageSrc]);

  // Initialize from cache state so we don't render "no skeleton" and then flip it on.
  const [imageLoaded, setImageLoaded] = useState(() => isImageCached);

  useEffect(() => {
    // Only reset if image source actually changed to a different URL
    const urlChanged = prevImageSrcRef.current !== imageSrc;
    if (urlChanged) {
      prevImageSrcRef.current = imageSrc;
    }

    if (!imageSrc) {
      setImageLoaded(true);
      return;
    }

    // If we've already loaded this URL in this session, don't re-run preload.
    if (loadedImageUrls.has(imageSrc)) {
      setImageLoaded(true);
      return;
    }

    // Check cache status
    const img = new Image();
    img.src = imageSrc;
    const isCached = img.complete && img.naturalHeight > 0;

    if (isCached) {
      setImageLoaded(true);
      return;
    }

    // Not cached: show skeleton immediately and fade out on load.
    setImageLoaded(false);

    const cleanup = imagePreloader(containerRef, imageSrc, (err) => {
      if (!err) loadedImageUrls.add(imageSrc);
      // Small delay to ensure smooth transition
      setTimeout(() => setImageLoaded(true), 30);
    }, { forcePreload, rootMargin });

    return () => {
      try { cleanup && cleanup(); } catch (e) { /* ignore */ }
    };
  }, [imageSrc, forcePreload, rootMargin]);

  return { containerRef, imageLoaded };
}
