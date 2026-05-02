import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaPlus, FaShareAlt, FaRobot } from 'react-icons/fa';
import { Tooltip } from '../design-system';
import Button from '../Button/Button';
import { DETAIL_TYPE_CONFIG } from '../AddPlanItemDetailModal';
import { createSimpleFilter } from '../../utilities/trie';
import { lang } from '../../lang.constants';
import { displayInTimezone } from '../../utilities/time-utils';
import { formatPlanningTime, getPlanningTimeTooltip } from '../../utilities/planning-time-utils';
import {
  formatCostEstimate,
  formatActualCost,
  getCostEstimateTooltip,
  getTrackedCostTooltip,
} from '../../utilities/cost-utils';
import styles from './PlanItemDetailsModal.module.css';

function formatScheduledTimeDisplay(scheduledTime) {
  if (!scheduledTime) return null;
  if (/^\d{2}:\d{2}$/.test(scheduledTime)) {
    const [hours, minutes] = scheduledTime.split(':');
    const h = parseInt(hours, 10);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHour = h % 12 || 12;
    return `${displayHour}:${minutes} ${period}`;
  }
  return scheduledTime;
}

export default function CostPlanningInfoSection({
  planItem,
  currentUser,
  scheduledDate,
  scheduledTime,
  planningDays,
  costEstimate,
  currency,
  actualCosts,
  totalActualCost,
  canEdit,
  onShare,
  onAddCostForItem,
  onAddDetail,
  onEditDate,
  onSelectDetailType,
  hasBienBot,
  bienbotLabel,
  onBienBot,
}) {
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [addDropdownFilter, setAddDropdownFilter] = useState('');
  const addDropdownRef = useRef(null);
  const addDropdownFilterRef = useRef(null);

  const hasInfoToDisplay =
    scheduledDate || planningDays > 0 || costEstimate > 0 || actualCosts.length > 0;

  const detailTypeItems = useMemo(() => {
    return Object.entries(DETAIL_TYPE_CONFIG).map(([type, config]) => ({
      type,
      label: config.label,
      icon: config.icon,
      description: config.description || '',
    }));
  }, []);

  const detailTypeTrieFilter = useMemo(() => {
    return createSimpleFilter(['label', 'description']).buildIndex(detailTypeItems);
  }, [detailTypeItems]);

  const filteredDetailTypes = useMemo(() => {
    if (addDropdownFilter.trim() === '') return detailTypeItems;
    return detailTypeTrieFilter.filter(addDropdownFilter, { rankResults: true });
  }, [addDropdownFilter, detailTypeItems, detailTypeTrieFilter]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!showAddDropdown) return undefined;
    const handleClickOutside = (event) => {
      if (
        addDropdownRef.current &&
        !addDropdownRef.current.contains(event.target)
      ) {
        setShowAddDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAddDropdown]);

  // Reset filter and focus input when dropdown opens
  useEffect(() => {
    if (!showAddDropdown) return;
    setAddDropdownFilter('');
    requestAnimationFrame(() => {
      addDropdownFilterRef.current?.focus();
    });
  }, [showAddDropdown]);

  const handleToggleAddDropdown = useCallback(() => {
    setShowAddDropdown((prev) => !prev);
  }, []);

  const handleSelectDetailType = useCallback(
    (type) => {
      setShowAddDropdown(false);
      if (onSelectDetailType) onSelectDetailType(type);
    },
    [onSelectDetailType]
  );

  if (!hasInfoToDisplay) return null;

  const formattedScheduledDate = scheduledDate
    ? displayInTimezone(
        scheduledDate,
        { weekday: 'short', month: 'short', day: 'numeric' },
        currentUser
      )
    : null;
  const formattedScheduledTime = formatScheduledTimeDisplay(scheduledTime);

  const showActionStack =
    (canEdit && (onAddCostForItem || onAddDetail)) || onShare || hasBienBot;

  return (
    <div className={styles.costPlanningSection}>
      {/* Scheduled Date/Time */}
      {scheduledDate && (
        <div
          className={`${styles.infoCard} ${styles.scheduledDateCard}`}
          onClick={onEditDate}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onEditDate();
          }}
          title={lang.current.tooltip.clickToEditScheduledDate}
        >
          <span className={styles.infoIcon}>📅</span>
          <div className={styles.infoContent}>
            <span className={styles.infoLabel}>Scheduled</span>
            <span className={styles.scheduledDateValue}>
              {formattedScheduledDate}
              {scheduledTime && (
                <span className={styles.scheduledTime}> at {formattedScheduledTime}</span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Planning Days */}
      {planningDays > 0 && (
        <Tooltip content={getPlanningTimeTooltip()} placement="top">
          <div className={styles.infoCard}>
            <span className={styles.infoIcon}>⏱️</span>
            <div className={styles.infoContent}>
              <span className={styles.infoLabel}>{lang.en.label.planningTime}</span>
              <span className={styles.infoValue}>{formatPlanningTime(planningDays)}</span>
            </div>
          </div>
        </Tooltip>
      )}

      {/* Cost Estimate - forecasted by experience creator */}
      {costEstimate > 0 && (
        <Tooltip content={getCostEstimateTooltip(costEstimate, { currency })} placement="top">
          <div className={styles.infoCard}>
            <span className={styles.infoIcon}>💰</span>
            <div className={styles.infoContent}>
              <span className={styles.infoLabel}>{lang.en.heading.estimatedCost}</span>
              <span className={styles.infoValue}>
                {formatCostEstimate(costEstimate, { currency })}
              </span>
            </div>
          </div>
        </Tooltip>
      )}

      {/* Tracked Costs - shows total only (itemized on Details tab) */}
      {actualCosts.length > 0 && (
        <Tooltip
          content={getTrackedCostTooltip(totalActualCost, actualCosts.length, { currency })}
          placement="top"
        >
          <div className={styles.infoCard}>
            <span className={styles.infoIcon}>💵</span>
            <div className={styles.infoContent}>
              <span className={styles.infoLabel}>
                {lang.en.heading.trackedCosts || 'Tracked Costs'}
              </span>
              <span className={styles.infoValue}>
                {formatActualCost(totalActualCost, { currency, exact: true })}
              </span>
            </div>
          </div>
        </Tooltip>
      )}

      {/* Action buttons: Add and Share - stacked vertically */}
      {showActionStack && (
        <div className={styles.actionButtonsStack}>
          {/* + Add Button with Dropdown - add costs, transport details, etc. */}
          {canEdit && (onAddCostForItem || onAddDetail) && (
            <div className={styles.addDropdownWrapper} ref={addDropdownRef}>
              <Tooltip
                content={showAddDropdown ? '' : 'Add costs, reservations, or other details'}
                placement="top"
              >
                <Button
                  variant="gradient"
                  size="sm"
                  onClick={handleToggleAddDropdown}
                  aria-expanded={showAddDropdown}
                  aria-haspopup="menu"
                  leftIcon={<FaPlus />}
                  rightIcon={<span className={styles.addButtonCaret}>▾</span>}
                >
                  {lang.current.button.add}
                </Button>
              </Tooltip>

              {showAddDropdown && (
                <div className={styles.addDropdownMenu} role="menu">
                  <div className={styles.addDropdownFilterWrapper}>
                    <input
                      ref={addDropdownFilterRef}
                      type="text"
                      className={styles.addDropdownFilterInput}
                      placeholder={lang.current.placeholder.search}
                      value={addDropdownFilter}
                      onChange={(e) => setAddDropdownFilter(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={lang.current.aria.filterDetailTypes}
                    />
                  </div>
                  <div className={styles.addDropdownItems}>
                    {filteredDetailTypes.length > 0 ? (
                      filteredDetailTypes.map((item) => (
                        <button
                          key={item.type}
                          type="button"
                          className={styles.addDropdownItem}
                          onClick={() => handleSelectDetailType(item.type)}
                          role="menuitem"
                        >
                          <span className={styles.addDropdownIcon}>{item.icon}</span>
                          <span className={styles.addDropdownLabel}>{item.label}</span>
                        </button>
                      ))
                    ) : (
                      <div className={styles.addDropdownNoResults}>No matching types</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Share Button */}
          {onShare && (
            <Tooltip content="Share this plan item" placement="top">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onShare(planItem)}
                leftIcon={<FaShareAlt />}
                fullWidth
              >
                {lang.current.planItemDetailsModal.share}
              </Button>
            </Tooltip>
          )}

          {/* BienBot Discuss Button */}
          {hasBienBot && (
            <Tooltip content={`${bienbotLabel} this plan item with BienBot`} placement="top">
              <Button
                variant="outline"
                size="sm"
                onClick={onBienBot}
                leftIcon={<FaRobot />}
                fullWidth
              >
                {bienbotLabel}
              </Button>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  );
}
