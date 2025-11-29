/**
 * CostSummary Component
 *
 * Displays a summary of costs for a plan including:
 * - Total costs
 * - Costs by collaborator (who paid what)
 * - Costs by plan item
 * - Shared costs
 * - Per-person share
 */

import { useMemo } from 'react';
import { FaDollarSign, FaUsers, FaListUl, FaShareAlt, FaUserFriends } from 'react-icons/fa';
import { formatActualCost } from '../../utilities/cost-utils';
import { lang } from '../../lang.constants';
import styles from './CostSummary.module.scss';

/**
 * SummaryCard - Individual summary card with icon, label, and value
 */
function SummaryCard({ icon: Icon, label, value, subValue, variant = 'default' }) {
  return (
    <div className={`${styles.summaryCard} ${styles[variant]}`}>
      <div className={styles.cardIcon}>
        <Icon />
      </div>
      <div className={styles.cardContent}>
        <div className={styles.cardLabel}>{label}</div>
        <div className={styles.cardValue}>{value}</div>
        {subValue && <div className={styles.cardSubValue}>{subValue}</div>}
      </div>
    </div>
  );
}

/**
 * BreakdownList - List of items with amounts
 */
function BreakdownList({ title, items, emptyMessage }) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div className={styles.breakdownSection}>
      <h4 className={styles.breakdownTitle}>{title}</h4>
      <div className={styles.breakdownList}>
        {items.map((item, index) => (
          <div key={item.id || index} className={styles.breakdownItem}>
            <span className={styles.breakdownLabel}>{item.label}</span>
            <span className={styles.breakdownValue}>
              {formatActualCost(item.amount, { exact: true })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CostSummary({
  // Summary data from API
  summary = null,

  // For manual calculation from costs array
  costs = [],
  collaborators = [],
  planItems = [],

  // Display options
  showBreakdowns = true,
  compact = false,
  currency = 'USD',

  // Loading state
  loading = false,
}) {
  const costStrings = lang.current.cost;

  // Calculate summary from costs array if summary not provided
  const calculatedSummary = useMemo(() => {
    if (summary) return summary;

    // Calculate from costs array
    const totalCost = costs.reduce((sum, cost) => sum + (cost.cost || 0), 0);

    // Group by collaborator
    const costsByCollaborator = {};
    const sharedCosts = [];

    costs.forEach(cost => {
      if (cost.collaborator) {
        // Handle both populated object and string ID cases
        const collabId = typeof cost.collaborator === 'object'
          ? cost.collaborator?._id
          : cost.collaborator;
        if (collabId && !costsByCollaborator[collabId]) {
          const collab = collaborators.find(c =>
            c._id === collabId || c._id?.toString() === collabId?.toString()
          );
          costsByCollaborator[collabId] = {
            collaborator: collab || { _id: collabId, name: 'Unknown' },
            total: 0,
            costs: [],
          };
        }
        if (collabId) {
          costsByCollaborator[collabId].total += cost.cost || 0;
          costsByCollaborator[collabId].costs.push(cost);
        }
      } else {
        sharedCosts.push(cost);
      }
    });

    // Group by plan item
    const costsByPlanItem = {};
    const generalCosts = [];

    costs.forEach(cost => {
      if (cost.plan_item) {
        // Handle both populated object and string ID cases
        const itemId = typeof cost.plan_item === 'object'
          ? cost.plan_item?._id
          : cost.plan_item;
        if (itemId && !costsByPlanItem[itemId]) {
          const item = planItems.find(i =>
            i._id === itemId || i._id?.toString() === itemId?.toString()
          );
          costsByPlanItem[itemId] = {
            planItem: item || { _id: itemId, text: 'Unknown item' },
            total: 0,
            costs: [],
          };
        }
        if (itemId) {
          costsByPlanItem[itemId].total += cost.cost || 0;
          costsByPlanItem[itemId].costs.push(cost);
        }
      } else {
        generalCosts.push(cost);
      }
    });

    const sharedCostTotal = sharedCosts.reduce((sum, cost) => sum + (cost.cost || 0), 0);
    const generalCostTotal = generalCosts.reduce((sum, cost) => sum + (cost.cost || 0), 0);
    const collaboratorCount = Math.max(collaborators.length, 1);
    const perPersonSplit = sharedCostTotal / collaboratorCount;

    return {
      totalCost,
      costsByCollaborator: Object.values(costsByCollaborator),
      costsByPlanItem: Object.values(costsByPlanItem),
      sharedCosts: sharedCostTotal,
      generalCosts: generalCostTotal,
      perPersonSplit,
      collaboratorCount,
    };
  }, [summary, costs, collaborators, planItems]);

  // Transform for display
  const byPersonItems = useMemo(() => {
    return (calculatedSummary.costsByCollaborator || []).map(item => ({
      id: item.collaborator._id,
      label: item.collaborator.name || item.collaborator.email || 'Unknown',
      amount: item.total,
    }));
  }, [calculatedSummary.costsByCollaborator]);

  const byItemItems = useMemo(() => {
    return (calculatedSummary.costsByPlanItem || []).map(item => ({
      id: item.planItem._id,
      label: item.planItem.text || 'Unknown item',
      amount: item.total,
    }));
  }, [calculatedSummary.costsByPlanItem]);

  if (loading) {
    return (
      <div className={styles.costSummary}>
        <div className={styles.loading}>Loading cost summary...</div>
      </div>
    );
  }

  const { totalCost, sharedCosts, perPersonShare, perPersonSplit, collaboratorCount } = calculatedSummary;

  // Normalize sharedCosts - API returns object, fallback returns number
  const sharedCostsAmount = typeof sharedCosts === 'object' ? sharedCosts.total : sharedCosts;
  const perPersonSplitAmount = typeof perPersonShare === 'number' ? perPersonShare : (typeof perPersonSplit === 'number' ? perPersonSplit : 0);

  // Compact view - just total
  if (compact) {
    return (
      <div className={`${styles.costSummary} ${styles.compact}`}>
        <div className={styles.compactTotal}>
          <FaDollarSign className={styles.compactIcon} />
          <span className={styles.compactLabel}>{costStrings.totalCosts}:</span>
          <span className={styles.compactValue}>
            {formatActualCost(totalCost, { exact: true, currency })}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.costSummary}>
      {/* Summary Cards */}
      <div className={styles.summaryGrid}>
        <SummaryCard
          icon={FaDollarSign}
          label={costStrings.totalCosts}
          value={formatActualCost(totalCost, { exact: true, currency })}
          variant="primary"
        />

        {sharedCostsAmount > 0 && (
          <SummaryCard
            icon={FaShareAlt}
            label={costStrings.sharedCosts}
            value={formatActualCost(sharedCostsAmount, { exact: true, currency })}
          />
        )}

        {collaboratorCount > 1 && perPersonSplitAmount > 0 && (
          <SummaryCard
            icon={FaUserFriends}
            label={costStrings.perPersonShare}
            value={formatActualCost(perPersonSplitAmount, { exact: true, currency })}
            subValue={`${collaboratorCount} ${lang.current.label.people}`}
          />
        )}
      </div>

      {/* Detailed Breakdowns */}
      {showBreakdowns && (
        <div className={styles.breakdowns}>
          <BreakdownList
            title={costStrings.costsByPerson}
            items={byPersonItems}
          />

          <BreakdownList
            title={costStrings.costsByItem}
            items={byItemItems}
          />
        </div>
      )}
    </div>
  );
}
