/**
 * Mentions utility for parsing and rendering mentions in text
 * Supports mentioning users (@user), destinations (@destination), and experiences (@experience)
 * Converts mentions to interactive links with popovers
 *
 * @module mentions
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { OverlayTrigger, Popover } from 'react-bootstrap';
import { logger } from '../utilities/logger';

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
 * @param {string} text - Text containing mentions
 * @returns {Array} Array of text segments and mention objects
 */
export function parseMentions(text) {
  if (!text) return [{ type: 'text', content: '' }];

  // Regex to match mentions: @user:123, @destination:456, @experience:789
  const mentionRegex = /@(\w+):(\w+)/g;
  const segments = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index)
      });
    }

    // Add the mention
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
 * Convert mention to display text
 * @param {string} entityType - Type of entity (user, destination, experience)
 * @param {Object} entity - Entity data
 * @returns {string} Display text for the mention
 */
export function getMentionDisplayText(entityType, entity) {
  if (!entity) return `@${entityType}:unknown`;

  switch (entityType) {
    case MENTION_TYPES.USER:
      return `@${entity.name || entity.username || 'Unknown User'}`;
    case MENTION_TYPES.DESTINATION:
      return `@${entity.name || 'Unknown Destination'}`;
    case MENTION_TYPES.EXPERIENCE:
      return `@${entity.name || 'Unknown Experience'}`;
    default:
      return `@${entityType}:${entity._id || 'unknown'}`;
  }
}

/**
 * Get the URL path for an entity
 * @param {string} entityType - Type of entity
 * @param {string} entityId - Entity ID
 * @returns {string} URL path
 */
export function getEntityUrl(entityType, entityId) {
  switch (entityType) {
    case MENTION_TYPES.USER:
      return `/users/${entityId}`;
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
 * @returns {ReactElement} Interactive mention link
 */
export function renderMention(mention, entity, onEntityClick) {
  const { entityType, entityId, originalText } = mention;
  const displayText = getMentionDisplayText(entityType, entity);
  const entityUrl = getEntityUrl(entityType, entityId);

  const handleClick = (e) => {
    if (onEntityClick) {
      e.preventDefault();
      onEntityClick(entityType, entityId, entity);
    }
  };

  const popoverContent = (
    <Popover id={`mention-popover-${entityType}-${entityId}`}>
      <Popover.Header as="h3">
        {getMentionDisplayText(entityType, entity)}
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
          <p>Entity not found or loading...</p>
        )}
      </Popover.Body>
    </Popover>
  );

  return (
    <OverlayTrigger
      trigger={['hover', 'focus']}
      placement="top"
      overlay={popoverContent}
    >
      <Link
        to={entityUrl}
        onClick={handleClick}
        className="mention-link"
        style={{
          color: '#007bff',
          textDecoration: 'underline',
          cursor: 'pointer'
        }}
      >
        {displayText}
      </Link>
    </OverlayTrigger>
  );
}

/**
 * Render text with mentions as interactive elements
 * @param {string} text - Text containing mentions
 * @param {Object} entities - Map of entityId -> entity data
 * @param {Function} onEntityClick - Optional click handler for mentions
 * @returns {ReactElement} Text with interactive mentions
 */
export function renderTextWithMentions(text, entities = {}, onEntityClick) {
  const segments = parseMentions(text);

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <span key={index}>{segment.content}</span>;
        } else if (segment.type === 'mention') {
          const entity = entities[segment.entityId];
          return (
            <span key={index}>
              {renderMention(segment, entity, onEntityClick)}
            </span>
          );
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
 * @param {string} entityType - Type of entity
 * @param {string} entityId - Entity ID
 * @returns {string} Mention string
 */
export function createMention(entityType, entityId) {
  return `@${entityType}:${entityId}`;
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