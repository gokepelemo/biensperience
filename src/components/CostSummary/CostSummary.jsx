/**
 * CostSummary Component
 *
 * Displays a comprehensive cost breakdown with:
 * - Total cost header
 * - Breakdown by collaborator (who paid)
 * - Breakdown by plan item
 * - Breakdown by category
 * - Per-person split calculation
 * - CSV export functionality
 * - Expandable sections
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  FaDollarSign,
  FaUsers,
  FaShareAlt,
  FaUserFriends,
  FaChevronDown,
  FaChevronUp,
  FaUser,
  FaListAlt,
  FaTag,
  FaFileDownload,
  FaHome,
  FaCar,
  FaUtensils,
  FaHiking,
  FaToolbox,
  FaEllipsisH
} from 'react-icons/fa';
import { formatCurrencyDisambiguated } from '../../utilities/currency-utils';
import { convertCostToTarget, fetchRates } from '../../utilities/currency-conversion';
import { lang } from '../../lang.constants';
import UserAvatar from '../UserAvatar/UserAvatar';
import styles from './CostSummary.module.scss';

// Category icons mapping
const CATEGORY_ICONS = {
  accommodation: FaHome,
  transport: FaCar,
  food: FaUtensils,
  activities: FaHiking,
  equipment: FaToolbox,
  other: FaEllipsisH,
  uncategorized: FaTag
};

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
 * ExpandableSection - Collapsible section with header and content
 */
function ExpandableSection({ title, icon: Icon, total, currency, children, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className={styles.expandableSection}>
      <button
        className={styles.sectionHeader}
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        type="button"
      >
        <div className={styles.sectionTitle}>
          {Icon && <Icon className={styles.sectionIcon} aria-hidden="true" />}
          <span>{title}</span>
        </div>
        <div className={styles.sectionTotal}>
          <span className={styles.totalAmount}>
            {/* Use disambiguated symbol for totals to clearly identify the currency */}
            {formatCurrencyDisambiguated(total, currency)}
          </span>
          {expanded ? (
            <FaChevronUp className={styles.chevron} aria-hidden="true" />
          ) : (
            <FaChevronDown className={styles.chevron} aria-hidden="true" />
          )}
        </div>
      </button>
      {expanded && (
        <div className={styles.sectionContent}>
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * BreakdownList - List of items with amounts (non-expandable)
 */
function BreakdownList({ items, currency }) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div className={styles.breakdownList}>
      {items.map((item, index) => (
        <div key={item.id || index} className={styles.breakdownItem}>
          <span className={styles.breakdownLabel}>{item.label}</span>
          <span className={styles.breakdownValue}>
            {formatCurrencyDisambiguated(item.amount, currency)}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * CategoryBreakdown - Shows costs by category with progress bars
 */
function CategoryBreakdown({ costsByCategory, totalCost, currency }) {
  if (!costsByCategory || costsByCategory.length === 0) {
    return null;
  }

  return (
    <div className={styles.categoryBreakdown}>
      {costsByCategory.map((cat) => {
        const Icon = CATEGORY_ICONS[cat.category] || FaTag;
        const percentage = totalCost > 0 ? (cat.total / totalCost) * 100 : 0;

        return (
          <div key={cat.category} className={styles.categoryRow}>
            <div className={styles.categoryInfo}>
              <Icon className={styles.categoryIcon} aria-hidden="true" />
              <span className={styles.categoryLabel}>{cat.label}</span>
              <span className={styles.categoryCount}>({cat.costs?.length || 0})</span>
            </div>
            <div className={styles.categoryBar}>
              <div
                className={styles.categoryProgress}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <div className={styles.categoryAmount}>
              {formatCurrencyDisambiguated(cat.total, currency)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * PerPersonSplitTable - Shows per-person cost breakdown
 */
function PerPersonSplitTable({ perPersonSplit, sharedCosts, currency, collaboratorCount, presenceConnected = false, onlineUserIds = new Set() }) {
  // Check if a user is currently online
  const isUserOnline = (user) => {
    if (!presenceConnected || !onlineUserIds || onlineUserIds.size === 0) {
      return false;
    }
    const userId = user?._id?.toString() || user?.toString();
    return userId && onlineUserIds.has(userId);
  };
  const costStrings = lang.current.cost;

  if (!perPersonSplit || perPersonSplit.length <= 1) {
    return null;
  }

  return (
    <div className={styles.perPersonSplit}>
      <table className={styles.splitTable}>
        <thead>
          <tr>
            <th>Person</th>
            <th>{costStrings.individualCosts}</th>
            <th>{costStrings.sharedCosts}</th>
            <th>{costStrings.grandTotal}</th>
          </tr>
        </thead>
        <tbody>
          {perPersonSplit.map((split) => (
            <tr key={split.collaborator?._id || split.collaborator}>
              <td>
                <div className={styles.personCell}>
                  {split.collaborator && (
                    <UserAvatar
                      user={split.collaborator}
                      size="sm"
                      linkToProfile={false}
                      showPresence={presenceConnected}
                      isOnline={isUserOnline(split.collaborator)}
                    />
                  )}
                  <span>{split.collaborator?.name || split.collaborator?.email || 'Unknown'}</span>
                </div>
              </td>
              <td>{formatCurrencyDisambiguated(split.individualTotal || 0, currency)}</td>
              <td>{formatCurrencyDisambiguated(split.sharedPortion || 0, currency)}</td>
              <td className={styles.grandTotalCell}>
                {formatCurrencyDisambiguated(split.grandTotal || 0, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {sharedCosts > 0 && collaboratorCount > 1 && (
        <div className={styles.splitNote}>
          {costStrings.splitEvenly.replace('{count}', String(collaboratorCount))}
        </div>
      )}
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
  showCategoryBreakdown = true,
  showPerPersonSplit = true,
  showExport = true,
  compact = false,
  currency = 'USD',

  // Callbacks
  onCostClick,
  onExportCsv,

  // Loading state
  loading = false,

  // Additional class
  className = '',

  // Real-time presence for online indicators
  presenceConnected = false,
  onlineUserIds = new Set()
}) {
  const costStrings = lang.current.cost;
  const [ratesLoaded, setRatesLoaded] = useState(false);

  // Fetch exchange rates on mount
  useEffect(() => {
    fetchRates(currency)
      .then(() => setRatesLoaded(true))
      .catch(() => setRatesLoaded(true)); // Still render even if rates fail
  }, [currency]);

  /**
   * Get converted cost amount for a single cost item
   * NOTE: ratesLoaded is in dependency array to trigger re-render when rates become available
   */
  const getConvertedAmount = useCallback((cost) => {
    return convertCostToTarget(cost, currency);
  }, [currency, ratesLoaded]);

  // Calculate summary from costs array with currency conversion
  // NOTE: We ALWAYS calculate client-side to ensure proper currency conversion.
  // The backend summary doesn't convert currencies, so we ignore it when costs
  // are provided and use the costs array directly for accurate converted totals.
  const calculatedSummary = useMemo(() => {
    // If we have costs, always calculate client-side with conversion
    // This ensures proper currency conversion regardless of backend summary
    if (!costs || costs.length === 0) {
      // Fall back to summary if no costs provided (for display-only scenarios)
      if (summary) return summary;
      return {
        totalCost: 0,
        costCount: 0,
        costsByCollaborator: [],
        costsByPlanItem: [],
        costsByCategory: [],
        sharedCosts: { total: 0, costs: [] },
        generalCosts: { total: 0, costs: [] },
        perPersonShare: 0,
        perPersonSplit: [],
        collaboratorCount: 0,
      };
    }

    // Calculate from costs array, converting each cost to target currency
    const totalCost = costs.reduce((sum, cost) => sum + getConvertedAmount(cost), 0);

    // Group by collaborator
    const costsByCollaborator = {};
    const sharedCostsList = [];

    costs.forEach(cost => {
      const convertedAmount = getConvertedAmount(cost);
      if (cost.collaborator) {
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
          costsByCollaborator[collabId].total += convertedAmount;
          costsByCollaborator[collabId].costs.push(cost);
        }
      } else {
        sharedCostsList.push(cost);
      }
    });

    // Group by plan item
    const costsByPlanItem = {};
    const generalCostsList = [];

    costs.forEach(cost => {
      const convertedAmount = getConvertedAmount(cost);
      if (cost.plan_item) {
        const itemId = typeof cost.plan_item === 'object'
          ? cost.plan_item?._id
          : cost.plan_item;
        if (itemId && !costsByPlanItem[itemId]) {
          const item = planItems.find(i =>
            i._id === itemId || i._id?.toString() === itemId?.toString()
          );
          costsByPlanItem[itemId] = {
            item: item || { _id: itemId, text: 'Unknown item' },
            total: 0,
            costs: [],
          };
        }
        if (itemId) {
          costsByPlanItem[itemId].total += convertedAmount;
          costsByPlanItem[itemId].costs.push(cost);
        }
      } else {
        generalCostsList.push(cost);
      }
    });

    // Group by category
    const categoryCostMap = {};
    const categoryLabels = {
      accommodation: 'Accommodation',
      transport: 'Transport',
      food: 'Food & Dining',
      activities: 'Activities',
      equipment: 'Equipment',
      other: 'Other',
      uncategorized: 'Uncategorized'
    };

    costs.forEach(cost => {
      const convertedAmount = getConvertedAmount(cost);
      const category = cost.category || 'uncategorized';
      if (!categoryCostMap[category]) {
        categoryCostMap[category] = {
          category,
          label: categoryLabels[category] || category,
          total: 0,
          costs: []
        };
      }
      categoryCostMap[category].total += convertedAmount;
      categoryCostMap[category].costs.push(cost);
    });

    const costsByCategory = Object.values(categoryCostMap)
      .sort((a, b) => b.total - a.total);

    const sharedCostTotal = sharedCostsList.reduce((sum, cost) => sum + getConvertedAmount(cost), 0);
    const generalCostTotal = generalCostsList.reduce((sum, cost) => sum + getConvertedAmount(cost), 0);
    const collaboratorCount = Math.max(collaborators.length, 1);
    const perPersonShare = sharedCostTotal / collaboratorCount;

    // Calculate per-person split
    const perPersonSplit = collaborators.map(collab => {
      const collabCosts = costsByCollaborator[collab._id];
      const individualTotal = collabCosts ? collabCosts.total : 0;
      return {
        collaborator: collab,
        individualTotal,
        sharedPortion: perPersonShare,
        grandTotal: individualTotal + perPersonShare
      };
    });

    return {
      totalCost,
      costCount: costs.length,
      costsByCollaborator: Object.values(costsByCollaborator),
      costsByPlanItem: Object.values(costsByPlanItem),
      costsByCategory,
      sharedCosts: { total: sharedCostTotal, costs: sharedCostsList },
      generalCosts: { total: generalCostTotal, costs: generalCostsList },
      perPersonShare,
      perPersonSplit,
      collaboratorCount,
    };
  }, [summary, costs, collaborators, planItems, getConvertedAmount, ratesLoaded]);

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
      id: item.item?._id || item.planItem?._id,
      label: item.item?.text || item.planItem?.text || 'Unknown item',
      amount: item.total,
    }));
  }, [calculatedSummary.costsByPlanItem]);

  // CSV Export handler
  const handleExportCsv = useCallback(() => {
    if (onExportCsv) {
      onExportCsv();
      return;
    }

    // Default CSV export implementation
    const rows = [
      ['Title', 'Amount', 'Currency', 'Category', 'Date', 'Paid By', 'Plan Item']
    ];

    // Collect all costs
    const allCosts = [];
    (calculatedSummary.costsByCollaborator || []).forEach(c =>
      c.costs.forEach(cost => allCosts.push({ ...cost, paidBy: c.collaborator?.name }))
    );
    const sharedCostsList = calculatedSummary.sharedCosts?.costs || [];
    sharedCostsList.forEach(cost => {
      if (!allCosts.find(c => c._id === cost._id)) {
        allCosts.push({ ...cost, paidBy: 'Shared' });
      }
    });

    allCosts.forEach(cost => {
      rows.push([
        cost.title || '',
        cost.cost || 0,
        cost.currency || currency,
        cost.category || '',
        cost.date ? new Date(cost.date).toLocaleDateString() : '',
        cost.paidBy || '',
        cost.plan_item ? 'Yes' : ''
      ]);
    });

    // Add totals
    rows.push([]);
    rows.push(['Total', calculatedSummary.totalCost, currency, '', '', '', '']);

    // Generate CSV
    const csv = rows.map(row => row.map(cell =>
      typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell
    ).join(',')).join('\n');

    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cost-summary-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [calculatedSummary, currency, onExportCsv]);

  if (loading) {
    return (
      <div className={`${styles.costSummary} ${className}`}>
        <div className={styles.loading}>Loading cost summary...</div>
      </div>
    );
  }

  const {
    totalCost,
    costCount,
    sharedCosts,
    perPersonShare,
    perPersonSplit,
    collaboratorCount,
    costsByCategory
  } = calculatedSummary;

  // Normalize sharedCosts - API returns object, fallback returns number
  const sharedCostsAmount = typeof sharedCosts === 'object' ? sharedCosts.total : sharedCosts;
  const perPersonSplitAmount = typeof perPersonShare === 'number' ? perPersonShare : 0;

  // Compact view - just total
  if (compact) {
    return (
      <div className={`${styles.costSummary} ${styles.compact} ${className}`}>
        <div className={styles.compactTotal}>
          <FaDollarSign className={styles.compactIcon} />
          <span className={styles.compactLabel}>{costStrings.totalCosts}:</span>
          <span className={styles.compactValue}>
            {formatCurrencyDisambiguated(totalCost, currency)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.costSummary} ${className}`}>
      {/* Summary Cards */}
      <div className={styles.summaryGrid}>
        <SummaryCard
          icon={FaDollarSign}
          label={costStrings.totalCosts}
          value={formatCurrencyDisambiguated(totalCost, currency)}
          subValue={costCount > 0 ? `${costCount} ${costCount === 1 ? 'cost' : 'costs'}` : undefined}
          variant="primary"
        />

        {sharedCostsAmount > 0 && (
          <SummaryCard
            icon={FaShareAlt}
            label={costStrings.sharedCosts}
            value={formatCurrencyDisambiguated(sharedCostsAmount, currency)}
          />
        )}

        {collaboratorCount > 1 && perPersonSplitAmount > 0 && (
          <SummaryCard
            icon={FaUserFriends}
            label={costStrings.perPersonShare}
            value={formatCurrencyDisambiguated(perPersonSplitAmount, currency)}
            subValue={`${collaboratorCount} people`}
          />
        )}
      </div>

      {/* Export Button */}
      {showExport && costCount > 0 && (
        <button
          className={styles.exportButton}
          onClick={handleExportCsv}
          aria-label={costStrings.exportCsv}
          type="button"
        >
          <FaFileDownload aria-hidden="true" />
          <span>{costStrings.exportCsv}</span>
        </button>
      )}

      {/* Per-Person Split Table */}
      {showPerPersonSplit && perPersonSplit && perPersonSplit.length > 1 && (
        <ExpandableSection
          title={costStrings.perPersonShare}
          icon={FaUsers}
          total={totalCost}
          currency={currency}
          defaultExpanded={true}
        >
          <PerPersonSplitTable
            perPersonSplit={perPersonSplit}
            sharedCosts={sharedCostsAmount}
            currency={currency}
            collaboratorCount={collaboratorCount}
            presenceConnected={presenceConnected}
            onlineUserIds={onlineUserIds}
          />
        </ExpandableSection>
      )}

      {/* Category Breakdown */}
      {showCategoryBreakdown && costsByCategory && costsByCategory.length > 0 && (
        <ExpandableSection
          title={costStrings.costsByCategory}
          icon={FaTag}
          total={totalCost}
          currency={currency}
          defaultExpanded={true}
        >
          <CategoryBreakdown
            costsByCategory={costsByCategory}
            totalCost={totalCost}
            currency={currency}
          />
        </ExpandableSection>
      )}

      {/* Detailed Breakdowns */}
      {showBreakdowns && (
        <div className={styles.breakdowns}>
          {byPersonItems.length > 0 && (
            <ExpandableSection
              title={costStrings.costsByPerson}
              icon={FaUser}
              total={byPersonItems.reduce((sum, i) => sum + i.amount, 0)}
              currency={currency}
            >
              <BreakdownList items={byPersonItems} currency={currency} />
            </ExpandableSection>
          )}

          {byItemItems.length > 0 && (
            <ExpandableSection
              title={costStrings.costsByItem}
              icon={FaListAlt}
              total={byItemItems.reduce((sum, i) => sum + i.amount, 0)}
              currency={currency}
            >
              <BreakdownList items={byItemItems} currency={currency} />
            </ExpandableSection>
          )}
        </div>
      )}
    </div>
  );
}
