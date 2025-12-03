/**
 * LinkPreview Component
 * Displays a rich preview card for URLs with oEmbed or Open Graph data
 * Supports embedded content (videos, tweets, etc.) via oEmbed HTML
 */

import { useState, useEffect, useRef } from 'react';
import { fetchUrlPreview, isOEmbedUrl, getProviderName } from '../../utilities/oembed-service';
import { logger } from '../../utilities/logger';
import styles from './LinkPreview.module.scss';

/**
 * LinkPreview - Displays a preview card or embedded content for a URL
 *
 * @param {Object} props
 * @param {string} props.url - The URL to preview
 * @param {boolean} props.showEmbed - Whether to show embedded content (videos, etc.) Default: true for oEmbed URLs
 * @param {boolean} props.compact - Use compact layout. Default: false
 * @param {Function} props.onLoad - Callback when preview is loaded
 * @param {Function} props.onError - Callback when preview fails to load
 */
export default function LinkPreview({
  url,
  showEmbed = true,  // Default to true - show embeds when available
  compact = false,
  onLoad,
  onError
}) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const embedRef = useRef(null);

  useEffect(() => {
    if (!url) {
      setLoading(false);
      return;
    }

    const loadPreview = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchUrlPreview(url, {
          maxwidth: 480,
          maxheight: 270
        });

        if (data) {
          setPreview(data);
          onLoad?.(data);
        } else {
          setError('No preview available');
          onError?.('No preview available');
        }
      } catch (err) {
        logger.error('[LinkPreview] Failed to load', { url, error: err.message });
        setError(err.message);
        onError?.(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadPreview();
  }, [url, onLoad, onError]);

  // Execute any scripts in embedded HTML (for Twitter, Instagram, etc.)
  useEffect(() => {
    if (embedRef.current && preview?.html) {
      // Find and execute script tags in the embedded content
      const scripts = embedRef.current.querySelectorAll('script');
      scripts.forEach(script => {
        const newScript = document.createElement('script');
        if (script.src) {
          newScript.src = script.src;
        } else {
          newScript.textContent = script.textContent;
        }
        newScript.async = true;
        document.body.appendChild(newScript);
      });
    }
  }, [preview?.html]);

  if (loading) {
    return (
      <div className={`${styles.linkPreview} ${styles.loading} ${compact ? styles.compact : ''}`}>
        <div className={styles.loadingSpinner} />
        <span className={styles.loadingText}>Loading preview...</span>
      </div>
    );
  }

  if (error || !preview) {
    // Show minimal fallback - just the URL as a link
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`${styles.linkPreview} ${styles.fallback} ${compact ? styles.compact : ''}`}
      >
        <span className={styles.urlIcon}>🔗</span>
        <span className={styles.urlText}>{url}</span>
      </a>
    );
  }

  // Render embedded content (for video/rich types when showEmbed is true and HTML is available)
  // This renders the actual oEmbed HTML (YouTube player, Twitter embed, etc.)
  if (showEmbed && preview.html && (preview.type === 'video' || preview.type === 'rich')) {
    return (
      <div className={`${styles.linkPreview} ${styles.embedded} ${compact ? styles.compact : ''}`}>
        <div
          ref={embedRef}
          className={styles.embedContainer}
          dangerouslySetInnerHTML={{ __html: preview.html }}
        />
        <div className={styles.previewMeta}>
          {preview.provider_name && (
            <span className={styles.provider}>{preview.provider_name}</span>
          )}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.sourceLink}
          >
            Open in {preview.provider_name || 'new tab'}
          </a>
        </div>
      </div>
    );
  }

  // Standard card preview (for links without oEmbed or when showEmbed is false)
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${styles.linkPreview} ${styles.card} ${compact ? styles.compact : ''}`}
    >
      {preview.thumbnail_url && (
        <div className={styles.thumbnail}>
          <img
            src={preview.thumbnail_url}
            alt={preview.title || 'Preview'}
            loading="lazy"
          />
        </div>
      )}
      <div className={styles.content}>
        <div className={styles.title}>
          {preview.title || new URL(url).hostname}
        </div>
        {preview.description && !compact && (
          <div className={styles.description}>
            {preview.description.length > 120
              ? `${preview.description.substring(0, 120)}...`
              : preview.description}
          </div>
        )}
        <div className={styles.meta}>
          {preview.provider_name && (
            <span className={styles.provider}>
              {preview.provider_name}
            </span>
          )}
          <span className={styles.domain}>
            {new URL(url).hostname}
          </span>
        </div>
      </div>
    </a>
  );
}

/**
 * LinkPreviewList - Renders multiple link previews with embedded content
 *
 * @param {Object} props
 * @param {string[]} props.urls - Array of URLs to preview
 * @param {boolean} props.showEmbed - Whether to show embedded content (default: true)
 * @param {boolean} props.compact - Use compact layout for non-embedded previews
 * @param {number} props.maxPreviews - Maximum number of previews to show (default: 3)
 */
export function LinkPreviewList({
  urls,
  showEmbed = true,  // Default to true - show embeds
  compact = false,
  maxPreviews = 3
}) {
  if (!urls || urls.length === 0) {
    return null;
  }

  const displayUrls = urls.slice(0, maxPreviews);
  const remaining = urls.length - maxPreviews;

  return (
    <div className={styles.linkPreviewList}>
      {displayUrls.map((url, index) => (
        <LinkPreview
          key={`${url}-${index}`}
          url={url}
          showEmbed={showEmbed} // Show embeds for all oEmbed-supported URLs
          compact={compact && index > 0} // First is full, rest are compact if compact mode
        />
      ))}
      {remaining > 0 && (
        <div className={styles.moreLinks}>
          +{remaining} more link{remaining > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
