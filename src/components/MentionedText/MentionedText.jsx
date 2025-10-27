/**
 * MentionedText component for rendering text with interactive mentions
 * Displays mentions as clickable links with popovers showing entity details
 *
 * @module MentionedText
 */

import React from 'react';
import { renderTextWithMentions } from '../../utilities/mentions';

/**
 * Component for rendering text with interactive mentions
 *
 * @param {Object} props
 * @param {string} props.text - Text containing mentions
 * @param {Object} props.entities - Map of entityId -> entity data for popovers
 * @param {Function} props.onEntityClick - Optional click handler for mentions
 * @param {string} props.className - Additional CSS classes
 */
const MentionedText = ({
  text,
  entities = {},
  onEntityClick,
  className = '',
  ...props
}) => {
  if (!text) return null;

  return (
    <span className={`mentioned-text ${className}`} {...props}>
      {renderTextWithMentions(text, entities, onEntityClick)}
    </span>
  );
};

export default MentionedText;