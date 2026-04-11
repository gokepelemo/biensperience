/**
 * CollaboratorDetailsSection
 *
 * Inline section for the PlanItemDetailsModal "Details" tab.
 * Shows collaborators in a compact scrollable table — one row per person —
 * with name, role, profile location, travel origin, and member-since date.
 *
 * Receives the same `collaborators` array and `plan` object that the
 * parent PlanItemDetailsModal already has.
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Table, TableHead, TableBody, TableRow, TableCell } from '../design-system';
import UserAvatar from '../UserAvatar/UserAvatar';
import { formatCurrency } from '../../utilities/currency-utils';
import { formatDate } from '../../utilities/date-utils';
import { idEquals } from '../../utilities/id-utils';
import { lang } from '../../lang.constants';

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

      {/* Scrollable table wrapper — max-height keeps it contained in the Details tab */}
      <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
        <Table size="sm" hover striped={false} responsive={false}>
          <TableHead>
            <TableRow>
              <TableCell header style={{ whiteSpace: 'nowrap' }}>
                {lang.current.label.name}
              </TableCell>
              <TableCell header style={{ whiteSpace: 'nowrap' }}>
                {lang.current.label.role}
              </TableCell>
              <TableCell header style={{ whiteSpace: 'nowrap' }}>
                {lang.current.label.profileLocation}
              </TableCell>
              <TableCell header style={{ whiteSpace: 'nowrap' }}>
                {lang.current.label.travelOriginLabel}
              </TableCell>
              <TableCell header style={{ whiteSpace: 'nowrap' }}>
                {lang.current.label.memberSince}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {members.map(({ user, role }) => {
              const userId = user._id || user.user?._id;
              const isCurrentUser = idEquals(userId, currentUser?._id);
              const memberLocation = memberLocationMap[String(userId)];

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
                : '—';

              return (
                <TableRow key={String(userId)}>
                  {/* Name + avatar */}
                  <TableCell style={{ whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}>
                        <UserAvatar user={user} size="xs" linkToProfile={false} />
                      </span>
                      <Link
                        to={`/profile/${userId}`}
                        style={{
                          fontWeight: 'var(--font-weight-medium)',
                          fontSize: 'var(--font-size-sm)',
                          color: 'var(--color-text-primary)',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25em',
                        }}
                      >
                        {user?.name || 'Unknown User'}
                        {isCurrentUser && (
                          <span style={{ color: 'var(--color-text-muted)', fontWeight: 'var(--font-weight-normal)' }}>
                            (you)
                          </span>
                        )}
                      </Link>
                    </div>
                  </TableCell>

                  {/* Role */}
                  <TableCell style={{ whiteSpace: 'nowrap', fontSize: 'var(--font-size-xs)', textTransform: 'capitalize', color: 'var(--color-text-secondary)' }}>
                    {roleLabel}
                  </TableCell>

                  {/* Profile location */}
                  <TableCell style={{ fontSize: 'var(--font-size-xs)', color: locationDisplay ? 'var(--color-text-secondary)' : 'var(--color-text-muted)', fontStyle: locationDisplay ? 'normal' : 'italic' }}>
                    {locationDisplay || lang.current.label.noLocationSet}
                  </TableCell>

                  {/* Travel origin + optional cost */}
                  <TableCell style={{ fontSize: 'var(--font-size-xs)', color: travelAddress ? 'var(--color-text-secondary)' : 'var(--color-text-muted)', fontStyle: travelAddress ? 'normal' : 'italic' }}>
                    {travelAddress
                      ? (
                        <>
                          {travelAddress}
                          {travelCost != null && (
                            <span style={{ display: 'block', color: 'var(--color-text-muted)' }}>
                              {formatCurrency(travelCost, { currency: travelCurrency })}
                            </span>
                          )}
                        </>
                      )
                      : lang.current.label.noTravelOriginSet
                    }
                  </TableCell>

                  {/* Member since */}
                  <TableCell style={{ whiteSpace: 'nowrap', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    {memberSince}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
