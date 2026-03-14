/**
 * UserLocationSection Components
 *
 * Two exports:
 *   - TravelOriginModal      – modal for a user to set/edit their own travel origin
 *                              and optional travel cost estimate.
 *   - TravelOriginsSection   – inline display showing all plan members' travel origins,
 *                              with edit/remove buttons for the current user's own entry.
 */

import { useState, useEffect } from 'react';
import { Flex, Box } from '@chakra-ui/react';
import {
  Modal,
  FormGroup,
  FormLabel,
  FormControl,
  Button as DSButton
} from '../../../components/design-system';
import { FaMapMarkerAlt, FaPencilAlt, FaTimes } from 'react-icons/fa';
import { formatCurrency } from '../../../utilities/currency-utils';

// ─────────────────────────────────────────────────────────────────────────────
// TravelOriginModal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Modal that lets a single plan member set or update their travel origin and
 * an optional estimated travel cost.
 *
 * @param {Object}   props
 * @param {boolean}  props.show                  - Visibility
 * @param {Function} props.onClose               - Called when the modal is closed
 * @param {string}   [props.currentAddress]      - Current address string (if set)
 * @param {number}   [props.currentCostEstimate] - Current travel cost estimate (if set)
 * @param {string}   [props.currentCurrency]     - Currency for the estimate
 * @param {boolean}  props.loading               - Save-in-progress flag
 * @param {Function} props.onSave                - Called with { address, travel_cost_estimate, currency }
 * @param {string}   props.planCurrency          - Default currency from the plan
 * @param {Object}   props.lang                  - Language constants
 */
export function TravelOriginModal({
  show,
  onClose,
  currentAddress,
  currentCostEstimate,
  currentCurrency,
  loading,
  onSave,
  planCurrency = 'USD',
  lang
}) {
  const [address, setAddress] = useState(currentAddress || '');
  const [costEstimate, setCostEstimate] = useState(
    currentCostEstimate != null ? String(currentCostEstimate) : ''
  );
  const [currency, setCurrency] = useState(currentCurrency || planCurrency);

  // Sync local state when the modal opens (new data)
  useEffect(() => {
    if (show) {
      setAddress(currentAddress || '');
      setCostEstimate(currentCostEstimate != null ? String(currentCostEstimate) : '');
      setCurrency(currentCurrency || planCurrency);
    }
  }, [show, currentAddress, currentCostEstimate, currentCurrency, planCurrency]);

  const handleClose = () => { onClose(); };

  const handleSave = () => {
    const parsedCost = costEstimate.trim() !== '' ? parseFloat(costEstimate) : null;
    onSave({
      address: address.trim() || null,
      travel_cost_estimate: parsedCost != null && !isNaN(parsedCost) ? parsedCost : null,
      currency: currency || planCurrency
    });
  };

  const isEditing = Boolean(currentAddress);

  const modalFooter = (
    <Flex gap="var(--space-2)" w="100%" justify="flex-end" flexWrap="nowrap">
      <DSButton
        variant="outline"
        size="md"
        onClick={handleClose}
        aria-label={lang.current.button.cancel}
      >
        {lang.current.button.cancel}
      </DSButton>
      <DSButton
        variant="gradient"
        size="md"
        onClick={handleSave}
        disabled={loading || !address.trim()}
        aria-label={isEditing ? lang.current.button.updateOrigin : lang.current.button.setOrigin}
      >
        {loading
          ? (lang.current.label.saving || 'Saving...')
          : isEditing
            ? lang.current.button.updateOrigin
            : lang.current.button.setOrigin}
      </DSButton>
    </Flex>
  );

  return (
    <Modal
      show={show}
      onClose={handleClose}
      title={lang.current.label.myTravelOrigin}
      icon={<FaMapMarkerAlt />}
      size="md"
      footer={modalFooter}
    >
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
        {lang.current.label.travelingFromTooltip}
      </p>

      <FormGroup style={{ marginBottom: 'var(--space-4)' }}>
        <FormLabel htmlFor="travelOriginAddress">
          {lang.current.label.travelingFrom}
        </FormLabel>
        <FormControl
          type="text"
          id="travelOriginAddress"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          placeholder={lang.current.label.travelingFromPlaceholder}
          autoFocus
          maxLength={200}
        />
      </FormGroup>

      <FormGroup>
        <FormLabel htmlFor="travelCostEstimate">
          {lang.current.label.travelCostEstimate}
          {' '}
          <span style={{ color: 'var(--color-text-muted)', fontWeight: 'var(--font-weight-normal)' }}>
            (optional)
          </span>
        </FormLabel>
        <FormControl
          type="number"
          id="travelCostEstimate"
          value={costEstimate}
          onChange={(e) => setCostEstimate(e.target.value)}
          placeholder={lang.current.label.travelCostEstimatePlaceholder || '0.00'}
          min="0"
          step="0.01"
        />
        <small style={{ color: 'var(--color-text-muted)' }}>
          {lang.current.label.travelCostEstimateTooltip}
        </small>
      </FormGroup>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TravelOriginsSection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inline display of every plan member's travel origin.
 * The current user's own row shows edit and remove buttons.
 * Other members' rows are read-only.
 *
 * @param {Object}   props
 * @param {Array}    props.memberLocations    - plan.member_locations array
 * @param {Object}   props.user               - Current logged-in user
 * @param {Array}    props.planCollaborators  - Populated collaborator objects [{ _id, name }]
 * @param {Object}   props.planOwner          - Populated owner object { _id, name }
 * @param {string}   props.planCurrency       - Default currency for fallback formatting
 * @param {boolean}  props.canEdit            - Whether the current user is a plan member
 * @param {Function} props.onEditOwn          - Opens the TravelOriginModal for own entry
 * @param {Function} props.onRemoveOwn        - Removes the current user's own entry
 * @param {boolean}  props.loading            - Loading state
 * @param {Object}   props.lang               - Language constants
 */
export function TravelOriginsSection({
  memberLocations = [],
  user,
  planCollaborators = [],
  planOwner,
  planCurrency = 'USD',
  canEdit,
  onEditOwn,
  onRemoveOwn,
  loading,
  lang
}) {
  if (!canEdit && memberLocations.length === 0) return null;

  // Build userId → display name map
  const nameById = {};
  if (planOwner?._id) nameById[String(planOwner._id)] = planOwner.name;
  for (const c of planCollaborators) {
    if (c._id) nameById[String(c._id)] = c.name;
  }

  const userIdStr = String(user?._id);
  const myEntry = memberLocations.find((ml) => String(ml.user?._id ?? ml.user) === userIdStr);
  const othersEntries = memberLocations.filter(
    (ml) => String(ml.user?._id ?? ml.user) !== userIdStr
  );

  const renderEntry = (entry, isOwn) => {
    const userId = String(entry.user?._id ?? entry.user);
    const displayName = isOwn ? 'You' : (nameById[userId] || 'A collaborator');
    const address = entry.location?.address || entry.location?.city || null;
    const cost = entry.travel_cost_estimate;
    const entryCurrency = entry.currency || planCurrency;

    return (
      <Box
        key={userId}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'var(--space-3)',
          padding: 'var(--space-3) 0',
          borderBottom: '1px solid var(--color-border-subtle)',
        }}
      >
        <FaMapMarkerAlt
          style={{
            color: isOwn ? 'var(--color-primary)' : 'var(--color-text-muted)',
            marginTop: '2px',
            flexShrink: 0
          }}
        />
        <Box style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 'var(--font-weight-semibold)', fontSize: 'var(--font-size-sm)' }}>
            {displayName}
          </div>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '2px' }}>
            {address || (
              <span style={{ color: 'var(--color-text-muted)' }}>
                {lang.current.label.travelingFromNotSet}
              </span>
            )}
          </div>
          {cost != null && (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', marginTop: '2px' }}>
              {lang.current.label.travelCostEstimate}: {formatCurrency(cost, { currency: entryCurrency })}
            </div>
          )}
        </Box>
        {isOwn && canEdit && (
          <Flex gap="var(--space-1)" flexShrink={0}>
            <DSButton
              variant="outline"
              size="sm"
              onClick={onEditOwn}
              disabled={loading}
              aria-label={lang.current.button.updateOrigin}
              title={lang.current.button.updateOrigin}
            >
              <FaPencilAlt />
            </DSButton>
            {myEntry && (
              <DSButton
                variant="outline"
                size="sm"
                onClick={onRemoveOwn}
                disabled={loading}
                aria-label={lang.current.label.removeOrigin}
                title={lang.current.label.removeOrigin}
                style={{ color: 'var(--color-danger)' }}
              >
                <FaTimes />
              </DSButton>
            )}
          </Flex>
        )}
      </Box>
    );
  };

  return (
    <Box
      style={{
        marginBottom: 'var(--space-6)',
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border-subtle)'
      }}
    >
      <Flex align="center" justify="space-between" mb="var(--space-3)">
        <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <FaMapMarkerAlt style={{ color: 'var(--color-primary)' }} />
          <span style={{ fontWeight: 'var(--font-weight-semibold)', fontSize: 'var(--font-size-sm)' }}>
            {lang.current.label.travelOrigins}
          </span>
        </Box>
        {canEdit && !myEntry && (
          <DSButton
            variant="outline"
            size="sm"
            onClick={onEditOwn}
            disabled={loading}
            aria-label={lang.current.button.setOrigin}
          >
            {lang.current.button.setOrigin}
          </DSButton>
        )}
      </Flex>

      {memberLocations.length === 0 && canEdit && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
          {lang.current.label.travelingFromTooltip}
        </p>
      )}

      {myEntry && renderEntry(myEntry, true)}
      {othersEntries.map((entry) => renderEntry(entry, false))}
    </Box>
  );
}

// Default export kept for backward-compat (renders the modal)
export default TravelOriginModal;
