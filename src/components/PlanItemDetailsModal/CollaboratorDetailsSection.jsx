/**
 * CollaboratorDetailsSection
 *
 * Inline section for the PlanItemDetailsModal "Details" tab.
 * Shows per-collaborator cards with profile location, travel origin,
 * role, member-since date, and curator bio.
 *
 * Receives the same `collaborators` array and `plan` object that the
 * parent PlanItemDetailsModal already has.
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Box, Flex } from '@chakra-ui/react';
import { FaMapMarkerAlt, FaPlane, FaUserShield, FaCalendarAlt, FaInfoCircle } from 'react-icons/fa';
import UserAvatar from '../UserAvatar/UserAvatar';
import { formatCurrency } from '../../utilities/currency-utils';
import { formatDate } from '../../utilities/date-utils';
import { idEquals } from '../../utilities/id-utils';
import { lang } from '../../lang.constants';

/* ── Helpers ────────────────────────────────────────────────────── */

function DetailRow({ icon, label, value, muted, fallback, extra, multiline }) {
  return (
    <Flex align={multiline ? 'flex-start' : 'center'} gap="var(--space-2)" py="var(--space-1)">
      <Box
        css={{
          color: muted ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
          fontSize: 'var(--font-size-xs)',
          flexShrink: 0,
          marginTop: multiline ? '2px' : '0',
        }}
      >
        {icon}
      </Box>
      <Box flex="1" minW="0">
        <span style={{
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
        }}>
          {label}
        </span>
        <div style={{
          fontSize: 'var(--font-size-sm)',
          color: muted ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
          fontStyle: muted ? 'italic' : 'normal',
          wordBreak: multiline ? 'break-word' : 'normal',
        }}>
          {value || fallback}
        </div>
        {extra && (
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            {extra}
          </div>
        )}
      </Box>
    </Flex>
  );
}

function CollaboratorCard({ user, role, memberLocation, planCurrency, isCurrentUser, styles }) {
  const profileLocation = user?.location;
  const locationDisplay = profileLocation?.displayName
    || profileLocation?.city
    || profileLocation?.country
    || null;

  const travelAddress = memberLocation?.location?.address
    || memberLocation?.location?.city
    || null;

  const travelCost = memberLocation?.travel_cost_estimate;
  const travelCurrency = memberLocation?.currency || planCurrency;

  const roleLabel = role === 'owner'
    ? lang.current.label.owner
    : role === 'collaborator'
      ? lang.current.label.collaborator
      : lang.current.label.contributor;

  const memberSince = user?.createdAt
    ? formatDate(new Date(user.createdAt), 'en-US', { year: 'numeric', month: 'short' })
    : null;

  return (
    <Box
      className={styles?.detailItem}
      css={{
        padding: 'var(--space-3)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border-subtle)',
      }}
    >
      {/* Header: Avatar + Name + Role */}
      <Flex align="center" gap="var(--space-3)" mb="var(--space-2)">
        <UserAvatar user={user} size="md" linkToProfile={true} />
        <Box flex="1" minW="0">
          <Link
            to={`/profile/${user?._id}`}
            style={{
              fontWeight: 'var(--font-weight-semibold)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-primary)',
              textDecoration: 'none',
            }}
          >
            {user?.name || 'Unknown User'}
            {isCurrentUser && (
              <span style={{ color: 'var(--color-text-muted)', fontWeight: 'var(--font-weight-normal)' }}>
                {' '}(you)
              </span>
            )}
          </Link>
          <Flex align="center" gap="var(--space-1)" mt="1px">
            <FaUserShield style={{ color: 'var(--color-primary)', fontSize: '0.65rem', flexShrink: 0 }} />
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>
              {roleLabel}
            </span>
          </Flex>
        </Box>
      </Flex>

      {/* Detail rows */}
      <Box css={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <DetailRow
          icon={<FaMapMarkerAlt />}
          label={lang.current.label.profileLocation}
          value={locationDisplay}
          muted={!locationDisplay}
          fallback={lang.current.label.noLocationSet}
        />
        <DetailRow
          icon={<FaPlane />}
          label={lang.current.label.travelOriginLabel}
          value={travelAddress}
          muted={!travelAddress}
          fallback={lang.current.label.noTravelOriginSet}
          extra={travelCost != null
            ? `${lang.current.label.travelCostEstimate}: ${formatCurrency(travelCost, { currency: travelCurrency })}`
            : null}
        />
        {memberSince && (
          <DetailRow
            icon={<FaCalendarAlt />}
            label={lang.current.label.memberSince}
            value={memberSince}
          />
        )}
        {user?.bio && (
          <DetailRow icon={<FaInfoCircle />} label="Bio" value={user.bio} multiline />
        )}
      </Box>
    </Box>
  );
}

/* ── Main Section ───────────────────────────────────────────────── */

/**
 * @param {Object}  props
 * @param {Array}   props.collaborators - Full user objects (owner + collaborators) from modal
 * @param {Object}  props.plan          - Plan object with permissions and member_locations
 * @param {Object}  props.currentUser   - The logged-in user
 * @param {Object}  props.styles        - CSS module styles from PlanItemDetailsModal
 */
export default function CollaboratorDetailsSection({
  collaborators = [],
  plan,
  currentUser,
  styles = {},
}) {
  const planCurrency = plan?.currency || 'USD';

  // Derive role for each collaborator from plan permissions
  const members = useMemo(() => {
    if (!collaborators?.length) return [];
    return collaborators.map((collab) => {
      const collabId = collab._id || collab.user?._id;
      const permission = plan?.permissions?.find(
        (p) => p.entity === 'user' && idEquals(p._id, collabId)
      );
      return { user: collab, role: permission?.type || 'collaborator' };
    });
  }, [collaborators, plan?.permissions]);

  // Build userId → member_location map
  const memberLocationMap = useMemo(() => {
    const map = {};
    if (plan?.member_locations) {
      for (const ml of plan.member_locations) {
        const uid = String(ml.user?._id ?? ml.user);
        map[uid] = ml;
      }
    }
    return map;
  }, [plan?.member_locations]);

  if (members.length === 0) return null;

  return (
    <div className={styles?.detailsCategory}>
      <h3 className={styles?.detailsCategoryTitle}>
        <span className={styles?.detailsCategoryIcon}>👥</span>
        <span>{lang.current.heading.collaboratorDetails}</span>
        <span className={styles?.detailsCategoryCount}>({members.length})</span>
      </h3>
      <div className={styles?.detailsCategoryItems}>
        {members.map(({ user, role }) => (
          <CollaboratorCard
            key={user._id || user.user?._id}
            user={user}
            role={role}
            memberLocation={memberLocationMap[String(user._id || user.user?._id)]}
            planCurrency={planCurrency}
            isCurrentUser={idEquals(user._id || user.user?._id, currentUser?._id)}
            styles={styles}
          />
        ))}
      </div>
    </div>
  );
}
