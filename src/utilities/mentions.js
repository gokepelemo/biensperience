/**
 * Mentions utility for parsing and rendering mentions in text
 * Supports mentioning users (@user), destinations (@destination), and experiences (@experience)
 * Converts mentions to interactive links with popovers
 * Also supports URL detection and rendering with optional link previews
 *
 * @module mentions
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { OverlayTrigger, Popover } from 'react-bootstrap';
import { logger } from '../utilities/logger';
import HashLink from '../components/HashLink/HashLink';

// URL regex pattern for detecting URLs in text
const URL_REGEX = /https?:\/\/[-_.!~*'()a-zA-Z0-9;/?:@&=+$,%#]+/g;

/**
 * Entity types supported for mentions
 */
export const MENTION_TYPES = {
  USER: 'user',
  DESTINATION: 'destination',
  EXPERIENCE: 'experience'
};

/**
 * Parse text for mentions and return structured data
 * Format: {type/id}
 * @param {string} text - Text containing mentions
 * @returns {Array} Array of text segments and mention objects
 */
export function parseMentions(text) {
  if (!text) return [{ type: 'text', content: '' }];

  const segments = [];
  let lastIndex = 0;

  // Format: {type/id}
  const mentionRegex = /\{([^/}]+)\/([^}]+)\}/g;
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index)
      });
    }

    const entityType = match[1];
    const entityId = match[2];

    segments.push({
      type: 'mention',
      entityType,
      entityId,
      originalText: match[0]
    });

    lastIndex = mentionRegex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex)
    });
  }

  return segments;
}

/**
 * Parse text for mentions AND URLs
 * Returns segments for text, mentions, and urls
 * @param {string} text - Text containing mentions and/or URLs
 * @returns {Array} Array of text/mention/url segments
 */
export function parseMentionsAndUrls(text) {
  if (!text) return [{ type: 'text', content: '' }];

  // First, parse mentions
  const mentionSegments = parseMentions(text);

  // Then, within each text segment, parse URLs
  const finalSegments = [];

  for (const segment of mentionSegments) {
    if (segment.type === 'mention') {
      finalSegments.push(segment);
    } else if (segment.type === 'text') {
      // Parse URLs within this text segment
      const textContent = segment.content;
      let lastIndex = 0;
      let match;

      // Reset regex lastIndex
      URL_REGEX.lastIndex = 0;

      while ((match = URL_REGEX.exec(textContent)) !== null) {
        // Add text before the URL
        if (match.index > lastIndex) {
          finalSegments.push({
            type: 'text',
            content: textContent.slice(lastIndex, match.index)
          });
        }

        // Add URL segment
        finalSegments.push({
          type: 'url',
          url: match[0]
        });

        lastIndex = URL_REGEX.lastIndex;
      }

      // Add remaining text
      if (lastIndex < textContent.length) {
        finalSegments.push({
          type: 'text',
          content: textContent.slice(lastIndex)
        });
      } else if (lastIndex === 0 && textContent.length > 0) {
        // No URLs found, keep original text segment
        finalSegments.push(segment);
      }
    }
  }

  return finalSegments;
}

/**
 * Extract all URLs from text
 * @param {string} text - Text to search
 * @returns {string[]} Array of unique URLs found
 */
export function extractUrls(text) {
  if (!text) return [];
  URL_REGEX.lastIndex = 0;
  const matches = text.match(URL_REGEX);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Convert mention to display text
 * @param {string} entityType - Type of entity (user, plan-item, destination, experience)
 * @param {Object} entity - Entity data
 * @param {string} entityId - Entity ID
 * @param {Object} options - Optional settings
 * @param {boolean} options.isLoading - Whether the entity is currently being resolved
 * @returns {string} Display text for the mention
 */
export function getMentionDisplayText(entityType, entity, entityId, options = {}) {
  const { isLoading = false } = options;
  const prefix = entityType === 'plan-item' ? '#' : '@';

  // If loading, return a placeholder that indicates loading state
  if (isLoading) {
    return `${prefix}Loading...`;
  }

  // If entity not found, provide a more descriptive fallback
  if (!entity) {
    const typeLabel = entityType.charAt(0).toUpperCase() + entityType.slice(1);
    return `${prefix}${typeLabel} (not found)`;
  }

  switch (entityType) {
    case MENTION_TYPES.USER:
      return `${prefix}${entity.name || entity.username || 'Unknown User'}`;
    case 'plan-item':
      return `${prefix}${entity.name || entity.experience_name || 'Unknown Plan Item'}`;
    case MENTION_TYPES.DESTINATION:
      return `${prefix}${entity.name || 'Unknown Destination'}`;
    case MENTION_TYPES.EXPERIENCE:
      return `${prefix}${entity.name || 'Unknown Experience'}`;
    default:
      return `${prefix}${entityType}:${entity._id || 'unknown'}`;
  }
}

/**
 * Get the URL path for an entity
 * @param {string} entityType - Type of entity
 * @param {string} entityId - Entity ID
 * @param {Object} entity - Optional entity data for plan items (needs experienceId and planId)
 * @returns {string} URL path
 */
export function getEntityUrl(entityType, entityId, entity) {
  switch (entityType) {
    case MENTION_TYPES.USER:
      return `/profile/${entityId}`;
    case 'plan-item':
      // Deep link to plan item: /experiences/{expId}#plan-{planId}-item-{itemId}
      if (entity && entity.experienceId && entity.planId) {
        return `/experiences/${entity.experienceId}#plan-${entity.planId}-item-${entityId}`;
      }
      return '#';
    case MENTION_TYPES.DESTINATION:
      return `/destinations/${entityId}`;
    case MENTION_TYPES.EXPERIENCE:
      return `/experiences/${entityId}`;
    default:
      return '#';
  }
}

/**
 * Render a mention as an interactive link with popover
 * @param {Object} mention - Mention object from parseMentions
 * @param {Object} entity - Entity data for the popover
 * @param {Function} onEntityClick - Optional click handler
 * @param {Object} options - Optional settings
 * @param {boolean} options.isLoading - Whether the entity is currently being resolved
 * @returns {ReactElement} Interactive mention link
 */
export function renderMention(mention, entity, onEntityClick, options = {}) {
  const { entityType, entityId } = mention;
  const { isLoading = false } = options;
  const displayText = getMentionDisplayText(entityType, entity, entityId, { isLoading });
  const entityUrl = getEntityUrl(entityType, entityId, entity);

  // If loading, render a skeleton-style placeholder
  if (isLoading) {
    const prefix = entityType === 'plan-item' ? '#' : '@';
    return (
      <span
        className="mention-link mention-loading"
        style={{
          display: 'inline-block',
          background: 'linear-gradient(90deg, rgba(124,143,240,0.15) 25%, rgba(124,143,240,0.3) 50%, rgba(124,143,240,0.15) 75%)',
          backgroundSize: '200% 100%',
          animation: 'mentionShimmer 1.5s ease-in-out infinite',
          borderRadius: '3px',
          padding: '0 4px',
          minWidth: '60px',
          color: 'transparent'
        }}
      >
        {prefix}Loading...
      </span>
    );
  }

  const handleClick = (e) => {
    if (onEntityClick) {
      // Call the handler and check if it returns true (handled) or is for plan-item type
      // Only prevent default navigation for plan-items which need special handling (modal close + scroll)
      // For destinations, experiences, and users, allow normal Link navigation
      const shouldPreventDefault = entityType === 'plan-item';
      if (shouldPreventDefault) {
        e.preventDefault();
      }
      onEntityClick(entityType, entityId, entity);
    }
  };

  const popoverContent = (
    <Popover id={`mention-popover-${entityType}-${entityId}`}>
      <Popover.Header as="h3">
        {getMentionDisplayText(entityType, entity, entityId)}
      </Popover.Header>
      <Popover.Body>
        {entity ? (
          <div>
            {entityType === MENTION_TYPES.USER && (
              <>
                <p><strong>Name:</strong> {entity.name}</p>
                {entity.bio && <p><strong>Bio:</strong> {entity.bio}</p>}
                <Link to={entityUrl} className="btn btn-sm btn-primary">
                  View Profile
                </Link>
              </>
            )}
            {entityType === 'plan-item' && (
              <>
                <p><strong>Item:</strong> {entity.name || entity.experience_name}</p>
                {entity.description && <p><strong>Description:</strong> {entity.description.substring(0, 100)}...</p>}
                <HashLink to={entityUrl} className="btn btn-sm btn-primary">
                  View Plan Item
                </HashLink>
              </>
            )}
            {entityType === MENTION_TYPES.DESTINATION && (
              <>
                <p><strong>Location:</strong> {entity.city}, {entity.country}</p>
                {entity.description && <p><strong>Description:</strong> {entity.description.substring(0, 100)}...</p>}
                <Link to={entityUrl} className="btn btn-sm btn-primary">
                  View Destination
                </Link>
              </>
            )}
            {entityType === MENTION_TYPES.EXPERIENCE && (
              <>
                <p><strong>Destination:</strong> {entity.destination?.name}</p>
                {entity.description && <p><strong>Description:</strong> {entity.description.substring(0, 100)}...</p>}
                <Link to={entityUrl} className="btn btn-sm btn-primary">
                  View Experience
                </Link>
              </>
            )}
          </div>
        ) : (
          <div>
            <p><em>This {entityType} was mentioned but is no longer available. It may have been deleted or moved.</em></p>
            <p className="text-muted small">ID: {entityId}</p>
          </div>
        )}
      </Popover.Body>
    </Popover>
  );

  // Use HashLink for plan-item mentions to preserve hash fragments
  // Use regular Link for other entity types
  const LinkComponent = entityType === 'plan-item' ? HashLink : Link;

  return (
    <OverlayTrigger
      trigger={['hover', 'focus']}
      placement="top"
      overlay={popoverContent}
    >
      <LinkComponent
        to={entityUrl}
        onClick={handleClick}
        className="mention-link"
      >
        {displayText}
      </LinkComponent>
    </OverlayTrigger>
  );
}

/**
 * Render text content with line breaks preserved
 * Converts newlines to <br> elements for proper HTML rendering
 * @param {string} content - Text content that may contain newlines
 * @param {string} keyPrefix - Prefix for React keys
 * @returns {Array} Array of text and <br> elements
 */
function renderTextWithLineBreaks(content, keyPrefix) {
  if (!content) return null;

  const lines = content.split('\n');
  const result = [];

  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) {
      result.push(<br key={`${keyPrefix}-br-${lineIndex}`} />);
    }
    if (line) {
      result.push(line);
    }
  });

  return result;
}

/**
 * Render text with mentions as interactive elements
 * Preserves line breaks by converting \n to <br> elements
 * @param {string} text - Text containing mentions
 * @param {Object} entities - Map of entityId -> entity data
 * @param {Function} onEntityClick - Optional click handler for mentions
 * @param {Object} options - Optional settings
 * @param {Set|Array} options.loadingEntityIds - Set or array of entity IDs currently being resolved
 * @returns {ReactElement} Text with interactive mentions
 */
export function renderTextWithMentions(text, entities = {}, onEntityClick, options = {}) {
  const segments = parseMentions(text);
  const loadingIds = options.loadingEntityIds
    ? (options.loadingEntityIds instanceof Set ? options.loadingEntityIds : new Set(options.loadingEntityIds))
    : new Set();

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          // Render text with line breaks preserved
          return (
            <span key={index}>
              {renderTextWithLineBreaks(segment.content, `seg-${index}`)}
            </span>
          );
        } else if (segment.type === 'mention') {
          const entity = entities[segment.entityId];
          const isLoading = loadingIds.has(segment.entityId);

          // Log missing entities for debugging (can be removed in production)
          if (!entity && !isLoading) {
            logger.debug('[renderTextWithMentions] Entity not found in current context', {
              entityId: segment.entityId,
              entityType: segment.entityType,
              note: 'This entity may have been deleted, moved, or referenced from another context'
            });
          }

          return (
            <span key={index}>
              {renderMention(segment, entity, onEntityClick, { isLoading })}
            </span>
          );
        }
        return null;
      })}
    </>
  );
}

/**
 * Render a URL as a clickable link
 * @param {string} url - URL to render
 * @param {string} key - React key for the element
 * @returns {ReactElement} Clickable link element
 */
function renderUrl(url, key) {
  // Try to get a friendly display text from the URL
  let displayText = url;
  try {
    const urlObj = new URL(url);
    displayText = urlObj.hostname + (urlObj.pathname !== '/' ? urlObj.pathname : '');
    // Truncate if too long
    if (displayText.length > 50) {
      displayText = displayText.substring(0, 47) + '...';
    }
  } catch {
    // Use full URL if parsing fails
  }

  return (
    <a
      key={key}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="url-link"
      style={{
        color: '#0066cc',
        textDecoration: 'underline',
        wordBreak: 'break-all'
      }}
    >
      {displayText}
    </a>
  );
}

/**
 * Render text with mentions AND URLs as interactive elements
 * Preserves line breaks by converting \n to <br> elements
 * @param {string} text - Text containing mentions and/or URLs
 * @param {Object} entities - Map of entityId -> entity data
 * @param {Function} onEntityClick - Optional click handler for mentions
 * @param {Object} options - Rendering options
 * @param {boolean} options.renderUrls - Whether to render URLs as links (default: true)
 * @param {Set|Array} options.loadingEntityIds - Set or array of entity IDs currently being resolved
 * @returns {ReactElement} Text with interactive mentions and URLs
 */
export function renderTextWithMentionsAndUrls(text, entities = {}, onEntityClick, options = {}) {
  const { renderUrls = true, loadingEntityIds } = options;

  // If not rendering URLs, use the simpler function
  if (!renderUrls) {
    return renderTextWithMentions(text, entities, onEntityClick, { loadingEntityIds });
  }

  const segments = parseMentionsAndUrls(text);
  const loadingIds = loadingEntityIds
    ? (loadingEntityIds instanceof Set ? loadingEntityIds : new Set(loadingEntityIds))
    : new Set();

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          // Render text with line breaks preserved
          return (
            <span key={index}>
              {renderTextWithLineBreaks(segment.content, `seg-${index}`)}
            </span>
          );
        } else if (segment.type === 'mention') {
          const entity = entities[segment.entityId];
          const isLoading = loadingIds.has(segment.entityId);

          if (!entity && !isLoading) {
            logger.debug('[renderTextWithMentionsAndUrls] Entity not found', {
              entityId: segment.entityId,
              entityType: segment.entityType
            });
          }

          return (
            <span key={index}>
              {renderMention(segment, entity, onEntityClick, { isLoading })}
            </span>
          );
        } else if (segment.type === 'url') {
          return renderUrl(segment.url, index);
        }
        return null;
      })}
    </>
  );
}

/**
 * Convert mentions to plain text for display (without links)
 * @param {string} text - Text containing mentions
 * @param {Object} entities - Map of entityId -> entity data
 * @returns {string} Text with mentions converted to display names
 */
export function mentionsToPlainText(text, entities = {}) {
  const segments = parseMentions(text);

  return segments.map(segment => {
    if (segment.type === 'text') {
      return segment.content;
    } else if (segment.type === 'mention') {
      const entity = entities[segment.entityId];
      return getMentionDisplayText(segment.entityType, entity);
    }
    return '';
  }).join('');
}

/**
 * Create a mention string for an entity
 * @param {string} entityType - Type of entity (user, plan-item, destination, experience)
 * @param {string} entityId - Entity ID
 * @param {string} displayName - Display name for the entity (not used in new format)
 * @returns {string} Mention string in format: {entity}/{id}
 */
export function createMention(entityType, entityId, displayName) {
  // New simpler format: {entity}/{id}
  return `{${entityType}/${entityId}}`;
}

/**
 * Extract all mentions from text
 * @param {string} text - Text to parse
 * @returns {Array} Array of mention objects
 */
export function extractMentions(text) {
  const segments = parseMentions(text);
  return segments.filter(segment => segment.type === 'mention');
}

/**
 * Convert stored mention format {entity/id} to display format @{name} for editing
 * @param {string} text - Text with {entity/id} mentions
 * @param {Object} entities - Map of entityId -> entity data
 * @returns {string} Text with @{name} format for display in textarea
 */
export function mentionsToEditableText(text, entities = {}) {
  const segments = parseMentions(text);

  return segments.map(segment => {
    if (segment.type === 'text') {
      return segment.content;
    } else if (segment.type === 'mention') {
      const entity = entities[segment.entityId];
      const prefix = segment.entityType === 'plan-item' ? '#' : '@';

      if (entity) {
        let name = '';
        switch (segment.entityType) {
          case 'user':
            name = entity.name || entity.username || 'Unknown User';
            break;
          case 'plan-item':
            name = entity.name || entity.experience_name || 'Unknown Item';
            break;
          case 'destination':
            name = entity.name || 'Unknown Destination';
            break;
          case 'experience':
            name = entity.name || 'Unknown Experience';
            break;
          default:
            name = `${segment.entityType}:${segment.entityId}`;
        }
        return `${prefix}${name}`;
      }

      return segment.originalText;
    }
    return '';
  }).join('');
}

/**
 * Convert display format @{name} or #{name} back to stored format {entity/id}
 * @param {string} text - Text with @{name} or #{name} mentions
 * @param {Array} availableEntities - Array of entity objects with {id, type, displayName}
 * @returns {string} Text with {entity/id} format for storage
 */
export function editableTextToMentions(text, availableEntities = []) {
  if (!text) return '';

  // Build maps for quick lookup by displayName (case-insensitive)
  const nameToEntity = {};
  (availableEntities || []).forEach(entity => {
    const display = (entity.displayName || '').trim().toLowerCase();
    // Store by type:name for precise matching
    const key = `${entity.type}:${display}`;
    nameToEntity[key] = entity;
  });

  // Process text character by character to handle multiple mentions correctly
  let result = '';
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (char === '@' || char === '#') {
      const prefix = char;
      const isHashMention = prefix === '#';

      // Extract text after the prefix until we hit another @ or # or end
      let endPos = i + 1;
      while (endPos < text.length && text[endPos] !== '@' && text[endPos] !== '#') {
        endPos++;
      }

      const afterPrefix = text.slice(i + 1, endPos);

      // Try to find the longest matching entity name
      let foundEntity = null;
      let matchedLength = 0;

      // For # mentions, only check plan-item type
      // For @ mentions, check user, destination, experience
      const typesToCheck = isHashMention
        ? ['plan-item']
        : ['user', 'destination', 'experience'];

      // Try progressively shorter substrings to find a match
      for (let len = afterPrefix.length; len > 0; len--) {
        const candidate = afterPrefix.slice(0, len).trim().toLowerCase();
        if (!candidate) continue;

        for (const type of typesToCheck) {
          const key = `${type}:${candidate}`;
          if (nameToEntity[key]) {
            foundEntity = nameToEntity[key];
            // Match includes the trimmed name length
            matchedLength = afterPrefix.slice(0, len).trimEnd().length;
            break;
          }
        }
        if (foundEntity) break;
      }

      if (foundEntity) {
        // Convert to storage format
        result += createMention(foundEntity.type, foundEntity.id, foundEntity.displayName);
        // Move past the prefix and matched name
        i = i + 1 + matchedLength;
        // Preserve any whitespace after the matched name
        while (i < endPos && /\s/.test(text[i])) {
          result += text[i];
          i++;
        }
      } else {
        // No match found - keep the original text up to next mention or end
        result += text.slice(i, endPos);
        i = endPos;
      }
    } else {
      // Regular character
      result += char;
      i++;
    }
  }

  return result;
}

/**
 * Format entity type for display (e.g., "plan-item" -> "Plan Item")
 * @param {string} type - Entity type
 * @returns {string} Formatted type label
 */
export function formatEntityTypeLabel(type) {
  if (!type) return 'Unknown';
  return type
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}