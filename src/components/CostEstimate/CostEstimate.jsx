/**
 * CostEstimate Component
 *
 * Displays cost estimates with optional tooltip showing exact amount.
 * Inherits all typography styles from parent container for seamless integration.
 * Touch-friendly with tap-to-show tooltip.
 *
 * @example
 * // Basic usage - inherits parent styles
 * <CostEstimate cost={1500} />
 *
 * // With label
 * <CostEstimate cost={1500} showLabel />
 *
 * // With dollar signs indicator
 * <CostEstimate cost={1500} showDollarSigns />
 *
 * // Badge variant (self-contained styling)
 * <CostEstimate cost={1500} variant="badge" />
 *
 * // Custom tooltip content
 * <CostEstimate cost={1500} tooltipContent="Custom tooltip text" />
 */

import { useMemo } from 'react';
import { FaDollarSign } from 'react-icons/fa';
import {
  formatCostEstimate,
  getCostEstimateTooltip,
  getCostEstimateLabel,
  getDollarSigns
} from '../../utilities/cost-utils';
import InfoTooltip from '../InfoTooltip/InfoTooltip';
import styles from './CostEstimate.module.scss';

export default function CostEstimate({
  cost,
  showLabel = false,
  showTooltip = true,
  showDollarSigns = false,
  variant = 'inline', // 'inline' | 'badge'
  currency = 'USD',
  compact = true,
  isActual = false, // New prop to distinguish actual vs estimated costs
  exact = false, // New prop to show exact amounts without rounding
  tooltipContent, // Custom tooltip content (overrides default)
  className = ''
}) {
  // Format the cost using the utility
  const formattedCost = useMemo(() => {
    return formatCostEstimate(cost, { currency, compact, exact });
  }, [cost, currency, compact, exact]);

  // Get tooltip text - use custom content if provided, otherwise default
  const tooltipText = useMemo(() => {
    return tooltipContent !== undefined ? tooltipContent : getCostEstimateTooltip(cost, { currency, isActual });
  }, [cost, currency, isActual, tooltipContent]);

  // Get dollar signs for visual indicator
  const dollarSignsData = useMemo(() => {
    return getDollarSigns(cost);
  }, [cost]);

  // Don't render if no valid cost
  if (!formattedCost) {
    return null;
  }

  // Badge variant - self-contained styling
  if (variant === 'badge') {
    return (
      <span className={`${styles.badge} ${className}`}>
        <FaDollarSign className={styles.badgeIcon} aria-hidden="true" />
        <span>{formattedCost}</span>
        {showTooltip && (
          <InfoTooltip
            content={tooltipText}
            ariaLabel={tooltipText}
          />
        )}
      </span>
    );
  }

  // Inline variant - inherits parent styles
  return (
    <span className={`${styles.costEstimate} ${className}`}>
      {showDollarSigns && (
        <>
          <span className={styles.dollarSignsFilled} aria-hidden="true">
            {dollarSignsData.filledStr}
          </span>
          <span className={styles.dollarSignsEmpty} aria-hidden="true">
            {dollarSignsData.emptyStr}
          </span>
          <span className={styles.srOnly}>
            {dollarSignsData.filled} out of {dollarSignsData.total} dollar signs
          </span>
        </>
      )}
      {showLabel && (
        <span className={styles.label}>{getCostEstimateLabel()}: </span>
      )}
      <span className={styles.value}>{formattedCost}</span>
      {showTooltip && (
        <InfoTooltip
          content={tooltipText}
          ariaLabel="Show actual cost estimate"
        />
      )}
    </span>
  );
}
