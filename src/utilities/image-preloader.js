/**
 * imagePreloader utility
 * Ensures a skeleton overlay exists inside the container and preloads an image.
 * Calls `onLoaded` when the image finishes loading (or errors).
 * Options: { forcePreload, rootMargin }
 */
export default function imagePreloader(containerRef, src, onLoaded, options = {}) {
  if (!containerRef || !containerRef.current) {
    // Nothing to do
    return () => {};
  }

  const { forcePreload = false, rootMargin = '400px' } = options;
  const container = containerRef.current;

  // Ensure a skeleton overlay exists so DOM always shows a loading placeholder
  let overlay = container.querySelector('[data-skeleton-overlay]');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.setAttribute('data-skeleton-overlay', 'true');
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.zIndex = '5';
    overlay.style.pointerEvents = 'none';
    overlay.style.transition = 'opacity 260ms ease';
    // Simple skeleton background so overlay is visible even if component-level skeleton isn't rendered yet
    overlay.style.background = 'var(--color-bg-tertiary)';
    overlay.style.backgroundRepeat = 'no-repeat';
    overlay.style.backgroundPosition = 'center';
    overlay.style.opacity = '1';

    // Use a simple CSS class if available to reuse SkeletonLoader styles
    overlay.className = 'skeleton-overlay';

    // Insert at start so it overlays content
    container.insertBefore(overlay, container.firstChild);
  }

  let cancelled = false;
  let observer = null;

  const removeOverlay = () => {
    try {
      if (overlay) {
        // fade out then remove
        overlay.style.opacity = '0';
        setTimeout(() => {
          if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }, 300);
      }
    } catch (e) {
      // ignore
    }
  };

  const triggerLoad = () => {
    if (cancelled) return;
    const img = new Image();
    img.src = src;
    img.onload = () => {
      if (cancelled) return;
      // let caller update their state first
      try {
        onLoaded && onLoaded(null);
      } catch (e) {
        // swallow
      }
      removeOverlay();
    };
    img.onerror = () => {
      if (cancelled) return;
      try {
        onLoaded && onLoaded(new Error('Image failed to load'));
      } catch (e) {}
      removeOverlay();
    };
  };

  if (forcePreload) {
    triggerLoad();
  } else if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          triggerLoad();
          if (observer) observer.unobserve(container);
        }
      });
    }, { rootMargin });

    observer.observe(container);
  } else {
    triggerLoad();
  }

  return () => {
    cancelled = true;
    try {
      if (observer) observer.unobserve(container);
    } catch (e) {}
    try {
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    } catch (e) {}
  };
}
