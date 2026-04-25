/**
 * MessageContent — Memoised markdown + entity-chip renderer for BienBot messages.
 *
 * Extracts and renders inline entity JSON refs as clickable chips, and renders
 * assistant messages through ReactMarkdown with GFM support. Memoised via
 * React.memo so each message's output is cached across parent re-renders.
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

// Match compact JSON entity refs embedded in LLM output
const ENTITY_JSON_RE = /\{[^{}]*"_id"\s*:\s*"[^"]*"[^{}]*"name"\s*:\s*"[^"]*"[^{}]*"type"\s*:\s*"[^"]*"[^{}]*\}/g;
// Placeholder token used to survive markdown parsing: entity{n} (Private Use Area - safe through remark)
const PLACEHOLDER_RE = /entity(\d+)/g;

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
  PLACEHOLDER_RE.lastIndex = 0;
  while ((m = PLACEHOLDER_RE.exec(text)) !== null) {
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

function MessageContent({ text, role }) {
  const { processedText, entityRefs } = useMemo(() => {
    if (!text) return { processedText: '', entityRefs: [] };
    const refs = [];
    ENTITY_JSON_RE.lastIndex = 0;
    const out = text.replace(ENTITY_JSON_RE, (match) => {
      try {
        refs.push(JSON.parse(match));
        return `entity${refs.length - 1}`;
      } catch {
        return match;
      }
    });
    return { processedText: out, entityRefs: refs };
  }, [text]);

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
};

export default React.memo(MessageContent);
