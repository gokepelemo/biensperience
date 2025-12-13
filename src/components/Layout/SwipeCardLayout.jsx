/**
 * SwipeCardLayout Component
 * Tinder-style swipeable card stack for mobile discovery.
 */

import React, { useState, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import styles from './SwipeCardLayout.module.scss';
import { lang } from '../../lang.constants';

/**
 * Individual swipeable card
 */
export function SwipeCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  threshold = 100,
  className,
}) {
  const cardRef = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  const handleDragStart = useCallback((clientX, clientY) => {
    setIsDragging(true);
    setStartPos({ x: clientX, y: clientY });
  }, []);

  const handleDragMove = useCallback(
    (clientX, clientY) => {
      if (!isDragging) return;
      const deltaX = clientX - startPos.x;
      const deltaY = clientY - startPos.y;
      setPosition({ x: deltaX, y: deltaY });
    },
    [isDragging, startPos]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);

    const { x, y } = position;

    // Determine swipe direction
    if (Math.abs(x) > threshold) {
      if (x > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (x < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    } else if (y < -threshold && onSwipeUp) {
      onSwipeUp();
    }

    // Reset position
    setPosition({ x: 0, y: 0 });
  }, [position, threshold, onSwipeLeft, onSwipeRight, onSwipeUp]);

  // Touch handlers
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    handleDragStart(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e) => {
    const touch = e.touches[0];
    handleDragMove(touch.clientX, touch.clientY);
  };

  // Mouse handlers
  const handleMouseDown = (e) => {
    handleDragStart(e.clientX, e.clientY);
  };

  const handleMouseMove = (e) => {
    handleDragMove(e.clientX, e.clientY);
  };

  const handleMouseUp = () => {
    handleDragEnd();
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      handleDragEnd();
    }
  };

  // Calculate rotation based on drag
  const rotation = position.x * 0.05;
  const opacity = Math.max(0, 1 - Math.abs(position.x) / 300);

  const cardStyle = {
    transform: `translate(${position.x}px, ${position.y}px) rotate(${rotation}deg)`,
    transition: isDragging ? 'none' : 'transform 0.3s ease, opacity 0.3s ease',
    opacity,
  };

  return (
    <div
      ref={cardRef}
      className={`${styles.card} ${isDragging ? styles.dragging : ''} ${className || ''}`}
      style={cardStyle}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleDragEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Swipe indicators */}
      <div
        className={`${styles.indicator} ${styles.indicatorLeft}`}
        style={{ opacity: Math.min(1, -position.x / threshold) }}
      >
        ✕
      </div>
      <div
        className={`${styles.indicator} ${styles.indicatorRight}`}
        style={{ opacity: Math.min(1, position.x / threshold) }}
      >
        ♥
      </div>
      <div
        className={`${styles.indicator} ${styles.indicatorUp}`}
        style={{ opacity: Math.min(1, -position.y / threshold) }}
      >
        ★
      </div>
      {children}
    </div>
  );
}

SwipeCard.propTypes = {
  children: PropTypes.node,
  onSwipeLeft: PropTypes.func,
  onSwipeRight: PropTypes.func,
  onSwipeUp: PropTypes.func,
  threshold: PropTypes.number,
  className: PropTypes.string,
};

/**
 * Action buttons for card stack
 */
export function SwipeActions({ onReject, onLike, onSuperLike, onUndo }) {
  return (
    <div className={styles.actions}>
      {onUndo && (
        <button
          className={`${styles.actionButton} ${styles.undoButton}`}
          onClick={onUndo}
          aria-label={lang.current.swipeCardLayout.undo}
        >
          ↩
        </button>
      )}
      <button
        className={`${styles.actionButton} ${styles.rejectButton}`}
        onClick={onReject}
        aria-label={lang.current.swipeCardLayout.pass}
      >
        ✕
      </button>
      {onSuperLike && (
        <button
          className={`${styles.actionButton} ${styles.superLikeButton}`}
          onClick={onSuperLike}
          aria-label={lang.current.swipeCardLayout.superLike}
        >
          ★
        </button>
      )}
      <button
        className={`${styles.actionButton} ${styles.likeButton}`}
        onClick={onLike}
        aria-label={lang.current.swipeCardLayout.like}
      >
        ♥
      </button>
    </div>
  );
}

SwipeActions.propTypes = {
  onReject: PropTypes.func.isRequired,
  onLike: PropTypes.func.isRequired,
  onSuperLike: PropTypes.func,
  onUndo: PropTypes.func,
};

/**
 * Empty state when no cards left
 */
export function SwipeEmpty({ title, message, action }) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>🎉</div>
      <h3 className={styles.emptyTitle}>{title || lang.current.swipeCardLayout.emptyTitle}</h3>
      <p className={styles.emptyMessage}>
        {message || lang.current.swipeCardLayout.emptyMessage}
      </p>
      {action}
    </div>
  );
}

SwipeEmpty.propTypes = {
  title: PropTypes.string,
  message: PropTypes.string,
  action: PropTypes.node,
};

/**
 * SwipeCardLayout
 * Container for swipeable card stack with actions
 */
export default function SwipeCardLayout({
  children,
  header,
  actions,
  emptyState,
  className,
}) {
  const hasCards = React.Children.count(children) > 0;

  return (
    <div className={`${styles.layout} ${className || ''}`}>
      {header && <div className={styles.header}>{header}</div>}
      <div className={styles.stack}>
        {hasCards ? children : emptyState}
      </div>
      {hasCards && actions && <div className={styles.actionsContainer}>{actions}</div>}
    </div>
  );
}

SwipeCardLayout.propTypes = {
  children: PropTypes.node,
  header: PropTypes.node,
  actions: PropTypes.node,
  emptyState: PropTypes.node,
  className: PropTypes.string,
};

// Export sub-components for compound pattern
SwipeCardLayout.Card = SwipeCard;
SwipeCardLayout.Actions = SwipeActions;
SwipeCardLayout.Empty = SwipeEmpty;
