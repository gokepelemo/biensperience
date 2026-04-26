/**
 * MessageContent — Memoised markdown + entity-chip renderer for BienBot messages.
 *
 * Two reference formats are supported:
 * 1. Preferred (current): `⟦entity:N⟧` placeholders that index into the
 *    `entityRefs` prop (a server-validated array of {_id, name, type}).
 * 2. Legacy: inline JSON `{"_id":"...","name":"...","type":"..."}` objects
 *    embedded in the message text. Retained for one release so historical
 *    messages still render chips. New LLM output should never use this form.
 *
 * Rendered through ReactMarkdown with GFM. Memoised via React.memo so each
 * message's output is cached across parent re-renders.
 *
 * @module components/BienBotPanel/MessageContent
 */

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getEntityUrl } from '../../utilities/bienbot-entity-urls';
import styles from './BienBotPanel.module.css';

// Match ⟦entity:N⟧ placeholders that reference the entityRefs prop by index.
const PLACEHOLDER_REF_RE = /⟦entity:(\d+)⟧/g;
// Legacy: match compact JSON entity refs embedded in message text. Retained
// so messages from before the placeholder migration still render chips.
const ENTITY_JSON_RE = /\{[^{}]*"_id"\s*:\s*"[^"]*"[^{}]*"name"\s*:\s*"[^"]*"[^{}]*"type"\s*:\s*"[^"]*"[^{}]*\}/g;
// Internal placeholder used to survive markdown parsing without interacting
// with markdown syntax. Replaced with chip components after rendering.
const INTERNAL_PLACEHOLDER_RE = /entity(\d+)/g;

function buildEntityChip(ref, idx) {
  const { _id, name, type } = ref;
  const url = getEntityUrl(ref);
  const label = name || type || 'entity';
  if (url) {
    return (
      <Link
        key={`chip-${_id}-${idx}`}
        to={url}
        className={styles.inlineEntityChip}
        aria-label={`View ${type}: ${label}`}
      >
        {label}
      </Link>
    );
  }
  return <span key={`chip-nolink-${idx}`} className={styles.inlineEntityChipNoLink}>{label}</span>;
}

function substituteChips(text, entityRefs) {
  if (typeof text !== 'string') return text;
  const parts = [];
  let last = 0;
  let m;
  INTERNAL_PLACEHOLDER_RE.lastIndex = 0;
  while ((m = INTERNAL_PLACEHOLDER_RE.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const ref = entityRefs[parseInt(m[1], 10)];
    if (ref) parts.push(buildEntityChip(ref, m.index));
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  if (parts.length === 0) return text;
  if (parts.length === 1) return parts[0];
  return parts.map((p, i) => (typeof p === 'string' ? <React.Fragment key={i}>{p}</React.Fragment> : p));
}

function processChildren(children, entityRefs) {
  return React.Children.map(children, (child) => {
    if (typeof child === 'string') return substituteChips(child, entityRefs);
    return child;
  });
}

function MessageContent({ text, role, entityRefs: entityRefsProp = null }) {
  const { processedText, entityRefs } = useMemo(() => {
    if (!text) return { processedText: '', entityRefs: [] };

    // Start with server-provided entity_refs (preferred path).
    const refs = Array.isArray(entityRefsProp)
      ? entityRefsProp.filter(r => r && r._id && r.name && r.type)
      : [];

    // First pass: replace ⟦entity:N⟧ placeholders with the internal
    // entity{N} marker that survives markdown parsing.
    let out = text.replace(PLACEHOLDER_REF_RE, (match, idxStr) => {
      const idx = parseInt(idxStr, 10);
      if (idx >= 0 && idx < refs.length) {
        return `entity${idx}`;
      }
      // Out-of-range placeholder: drop it so the user doesn't see the brackets
      return '';
    });

    // Second pass (legacy): inline JSON entity blocks. Append each parsed
    // object to refs and emit an internal marker pointing at the new index.
    ENTITY_JSON_RE.lastIndex = 0;
    out = out.replace(ENTITY_JSON_RE, (match) => {
      try {
        const obj = JSON.parse(match);
        if (!obj || !obj._id || !obj.name || !obj.type) return match;
        // De-dupe against existing refs by _id
        let idx = refs.findIndex(r => r._id === obj._id);
        if (idx === -1) {
          refs.push(obj);
          idx = refs.length - 1;
        }
        return `entity${idx}`;
      } catch {
        return match;
      }
    });

    return { processedText: out, entityRefs: refs };
  }, [text, entityRefsProp]);

  if (!text) return null;

  // User messages: plain text with entity chips (no markdown parsing)
  if (role !== 'assistant') {
    const result = substituteChips(processedText, entityRefs);
    if (!Array.isArray(result)) return result;
    return result.map((p, i) => (typeof p === 'string' ? <React.Fragment key={i}>{p}</React.Fragment> : p));
  }

  // Assistant messages: full markdown rendering with entity chip substitution
  const bindChip = (children) => processChildren(children, entityRefs);
  const mdComponents = {
    p: ({ children }) => <p>{bindChip(children)}</p>,
    li: ({ children }) => <li>{bindChip(children)}</li>,
    a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
    pre: ({ children }) => <pre className={styles.codeBlock}>{children}</pre>,
    code: ({ children, className }) => <code className={className}>{children}</code>,
  };

  return (
    <div className={styles.markdownContent}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {processedText}
      </ReactMarkdown>
    </div>
  );
}

MessageContent.propTypes = {
  text: PropTypes.string,
  role: PropTypes.string,
  entityRefs: PropTypes.arrayOf(PropTypes.shape({
    _id: PropTypes.string,
    name: PropTypes.string,
    type: PropTypes.string
  }))
};

export default React.memo(MessageContent);
