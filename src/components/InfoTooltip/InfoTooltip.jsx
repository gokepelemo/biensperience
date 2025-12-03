/**
 * InfoTooltip Component
 *
 * A touch-friendly tooltip that renders via Portal to escape container overflow.
 * Uses TooltipContext to ensure only one tooltip is visible at a time.
 *
 * @example
 * <InfoTooltip id="cost-123" content="Exact amount: $1,234.56">
 *   <FaInfoCircle />
 * </InfoTooltip>
 */

import { useState, useEffect, useCallback, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { FaInfoCircle } from 'react-icons/fa';
import { useTooltipContext } from '../../contexts/TooltipContext';
import styles from './InfoTooltip.module.scss';

export default function InfoTooltip({
  id: providedId,
  content,
  ariaLabel = 'Show more information',
  children,
  className = ''
}) {
  const generatedId = useId();
  const tooltipId = providedId || generatedId;

  const { toggleTooltip, isTooltipActive, closeTooltip } = useTooltipContext();
  const isOpen = isTooltipActive(tooltipId);

  const buttonRef = useRef(null);
  const tooltipRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0, flipBelow: false });
  const [needsReposition, setNeedsReposition] = useState(false);

  // Calculate position when tooltip opens - constrained to viewport
  const calculatePosition = useCallback((useActualDimensions = false) => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const viewportPadding = 16; // minimum distance from viewport edge
    const arrowHeight = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Get actual tooltip dimensions if available, otherwise use estimates
    let tooltipWidth = 280;
    let tooltipHeight = 80;

    if (useActualDimensions && tooltipRef.current) {
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      tooltipWidth = tooltipRect.width;
      tooltipHeight = tooltipRect.height;
    }

    // Calculate effective max width based on viewport
    const maxAllowedWidth = viewportWidth - (viewportPadding * 2);
    const effectiveWidth = Math.min(tooltipWidth, maxAllowedWidth);

    // Calculate horizontal position - center on button, clamp to viewport
    let left = rect.left + rect.width / 2;
    const minLeft = viewportPadding + effectiveWidth / 2;
    const maxLeft = viewportWidth - effectiveWidth / 2 - viewportPadding;
    left = Math.max(minLeft, Math.min(left, maxLeft));

    // Calculate vertical position - prefer above button, flip below if needed
    // Position ABOVE: tooltip bottom edge at button top - arrow height
    // Position BELOW: tooltip top edge at button bottom + arrow height
    let top;
    let flipBelow = false;

    // Space available above and below the button
    const spaceAbove = rect.top - viewportPadding;
    const spaceBelow = viewportHeight - rect.bottom - viewportPadding;

    // Prefer above, but flip below if not enough space
    if (spaceAbove >= tooltipHeight + arrowHeight) {
      // Position above: top edge of tooltip
      top = rect.top - tooltipHeight - arrowHeight;
      flipBelow = false;
    } else if (spaceBelow >= tooltipHeight + arrowHeight) {
      // Position below: top edge of tooltip at button bottom + arrow
      top = rect.bottom + arrowHeight;
      flipBelow = true;
    } else {
      // Not enough space either way - pick the side with more space
      if (spaceAbove > spaceBelow) {
        top = viewportPadding;
        flipBelow = false;
      } else {
        top = rect.bottom + arrowHeight;
        flipBelow = true;
      }
    }

    // Final safety clamp
    top = Math.max(viewportPadding, Math.min(top, viewportHeight - tooltipHeight - viewportPadding));

    setPosition({ top, left, flipBelow });
  }, []);

  // Reposition after tooltip renders to use actual dimensions
  useEffect(() => {
    if (isOpen && needsReposition && tooltipRef.current) {
      calculatePosition(true);
      setNeedsReposition(false);
    }
  }, [isOpen, needsReposition, calculatePosition]);

  // Handle toggle
  const handleToggle = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isOpen) {
      calculatePosition(false); // Initial position with estimates
      setNeedsReposition(true); // Trigger reposition after render
    }
    toggleTooltip(tooltipId);
  }, [isOpen, calculatePosition, toggleTooltip, tooltipId]);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      const isButton = buttonRef.current?.contains(e.target);
      const isTooltip = tooltipRef.current?.contains(e.target);

      if (!isButton && !isTooltip) {
        closeTooltip(tooltipId);
      }
    };

    // Small delay to prevent immediate close on touch
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }, 50);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, closeTooltip, tooltipId]);

  // Close on scroll (tooltip position becomes stale)
  useEffect(() => {
    if (!isOpen) return;

    const handleScroll = () => {
      closeTooltip(tooltipId);
    };

    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', handleScroll, { capture: true });
  }, [isOpen, closeTooltip, tooltipId]);

  // Recalculate position on window resize
  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      calculatePosition();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, calculatePosition]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.infoButton} ${className}`}
        onClick={handleToggle}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-describedby={isOpen ? `tooltip-${tooltipId}` : undefined}
      >
        {children || <FaInfoCircle aria-hidden="true" />}
      </button>

      {isOpen && createPortal(
        <div
          ref={tooltipRef}
          id={`tooltip-${tooltipId}`}
          className={`${styles.tooltipPopup} ${position.flipBelow ? styles.tooltipBelow : ''}`}
          role="tooltip"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`
          }}
        >
          {content}
          <div className={`${styles.tooltipArrow} ${position.flipBelow ? styles.arrowAbove : ''}`} />
        </div>,
        document.body
      )}
    </>
  );
}
