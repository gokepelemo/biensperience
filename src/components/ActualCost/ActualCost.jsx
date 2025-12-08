/**
 * ActualCost Component
 *
 * Displays actual costs for a plan with proper tooltips showing collaborator names.
 * Handles collaborator lookup and provides detailed cost information.
 *
 * @example
 * <ActualCost
 *   costs={plan.costs}
 *   collaborators={collaborators}
 *   planItems={plan.plan}
 *   plan={plan}
 *   currency="USD"
 * />
 */

import React from 'react';
import { Text } from '../design-system';
import CostEstimate from '../CostEstimate/CostEstimate';
import styles from './ActualCost.module.scss';

export default function ActualCosts({
  costs = [],
  collaborators = [],
  planItems = [],
  plan = null,
  currency = 'USD',
  className = ''
}) {
  // Helper function to get collaborator name by ID or user object
  const getCollaboratorName = (collaborator) => {
    if (!collaborator) return null;

    // If collaborator is already a populated user object, return the name directly
    if (typeof collaborator === 'object' && collaborator.name) {
      return collaborator.name;
    }

    // If collaborator is an ObjectId string, look it up
    const collaboratorId = collaborator?.toString();

    // First check the collaborators array (collaborators with 'collaborator' role)
    if (collaborators.length > 0) {
      const collaborator = collaborators.find(c =>
        c._id?.toString() === collaboratorId
      );
      if (collaborator?.name) return collaborator.name;
    }

    // Then check if it's the plan owner (owners can also be assigned to costs)
    if (plan?.user && plan.user._id?.toString() === collaboratorId) {
      return plan.user.name || 'Plan Owner';
    }

    return null;
  };

  // Helper function to get plan item name by ID
  const getPlanItemName = (planItemId) => {
    if (!planItemId || !planItems.length) return null;

    const planItem = planItems.find(item =>
      (item._id?.toString() === planItemId?.toString()) ||
      (item.plan_item_id?.toString() === planItemId?.toString())
    );

    return planItem?.text || null;
  };

  // Generate tooltip content for a cost entry
  const getCostTooltip = (cost) => {
    if (!cost || !cost.cost || cost.cost <= 0) {
      return 'Cost entry details';
    }

    // Use the cost's own currency for the tooltip (itemized display)
    const costCurrency = cost.currency || currency;
    const currencySymbols = {
      USD: '$', EUR: '€', GBP: '£', JPY: '¥', AUD: '$', CAD: '$',
      CHF: 'Fr.', CNY: '¥', INR: '₹', KRW: '₩', MXN: '$', NZD: '$',
      SGD: '$', THB: '฿', BRL: 'R$', ZAR: 'R', HKD: '$', TWD: '$',
      PHP: '₱', IDR: 'Rp', MYR: 'RM', VND: '₫', AED: 'د.إ', SAR: '﷼',
      ILS: '₪', TRY: '₺', RUB: '₽', PLN: 'zł', CZK: 'Kč', HUF: 'Ft',
      SEK: 'kr', NOK: 'kr', DKK: 'kr'
    };
    const symbol = currencySymbols[costCurrency] || costCurrency;
    const formatted = cost.cost.toLocaleString('en-US', {
      minimumFractionDigits: cost.cost % 1 !== 0 ? 2 : 0,
      maximumFractionDigits: 2
    });

    // Priority: Show collaborator info first if available
    if (cost.collaborator) {
      const collaboratorName = getCollaboratorName(cost.collaborator);
      if (collaboratorName) {
        return `Paid for ${collaboratorName}: ${costCurrency}${symbol}${formatted}`;
      }
      // If collaborator not found, show generic message
      return `Paid for collaborator: ${costCurrency}${symbol}${formatted}`;
    }

    // If cost is linked to a plan item, show plan item info
    if (cost.plan_item) {
      const planItemName = getPlanItemName(cost.plan_item);
      if (planItemName) {
        return `Plan item: ${planItemName} - ${costCurrency}${symbol}${formatted}`;
      }
      // If plan item not found, show generic message
      return `Plan item: ${costCurrency}${symbol}${formatted}`;
    }

    // If no specific linkage, it's a shared cost
    return `Shared cost: ${costCurrency}${symbol}${formatted}`;
  };

  if (!costs || costs.length === 0) {
    return null;
  }

  return (
    <div className={`${styles.actualCosts} ${className}`}>
      {costs.map((cost, index) => (
        <div key={cost._id || `${cost.title}-${cost.cost}-${index}`} className={styles.costItem}>
          <div className={styles.costItemContent}>
            <Text size="sm" weight="semibold" className={styles.costTitle}>
              {cost.title || 'Unnamed Cost'}
            </Text>
            <CostEstimate
              cost={cost.cost || 0}
              currency={cost.currency || currency}
              showTooltip={true}
              compact={true}
              isActual={true}
              exact={true}
              tooltipContent={getCostTooltip(cost)}
              className={styles.costValue}
            />
          </div>
          {cost.description && (
            <Text size="xs" variant="muted" className={styles.costDescription}>
              {cost.description}
            </Text>
          )}
        </div>
      ))}
    </div>
  );
}