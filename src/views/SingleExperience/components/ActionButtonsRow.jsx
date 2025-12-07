/**
 * ActionButtonsRow Component
 * Displays action buttons for SingleExperience: Plan It, Edit Date, Edit Experience, Delete
 */

import { useNavigate } from 'react-router-dom';
import { useRef } from 'react';
import { FaCalendarAlt, FaPencilAlt, FaTrash, FaShareAlt } from 'react-icons/fa';
import { FadeIn } from '../../../components/design-system';
import Loading from '../../../components/Loading/Loading';
import { isOwner } from '../../../utilities/permissions';
import { formatDateForInput, formatDateOrdinal } from '../../../utilities/date-utils';
import useButtonWidth from '../../../hooks/useButtonWidth';
import styles from './ActionButtonsRow.module.scss';

export default function ActionButtonsRow({
  // User & Experience data
  user,
  experience,
  experienceId,

  // Plan state
  userHasExperience,
  loading,
  plansLoading,
  displayedPlannedDate,
  selectedPlan, // Currently selected plan (for Edit Date button visibility)

  // Button refs and sizing
  planButtonRef,
  planBtnWidth,

  // Hover state
  favHover,
  setFavHover,

  // Handlers
  handleExperience,
  setShowDeleteModal,

  // Date picker state
  showDatePicker,
  setShowDatePicker,
  setIsEditingDate,
  setPlannedDate,

  // Language strings
  lang,

  // Layout variant: "default" | "sidebar"
  variant = "default",

  // Active tab: "experience" | "myplan" - when "myplan", hide planned date in sidebar
  activeTab = "experience",

  // Share handler
  onShare
}) {
  const navigate = useNavigate();

  // Check if user owns the selected plan
  const userOwnsSelectedPlan = selectedPlan && (
    selectedPlan.user?._id?.toString() === user?._id?.toString() ||
    selectedPlan.user?.toString() === user?._id?.toString()
  );

  // Ensure we have a ref for measuring the plan button width
  const internalPlanRef = planButtonRef || useRef(null);

  // Compute the max width for the plan button using possible text states
  useButtonWidth(internalPlanRef, [
    lang.current.button.addFavoriteExp,
    lang.current.button.expPlanAdded,
    lang.current.button.removeFavoriteExp
  ], { extraPadding: 12 });

  // Sidebar variant - vertical stacking with full-width buttons
  if (variant === "sidebar") {
    return (
      <div className={styles.sidebarContainer}>
        {/* Primary Action - Plan It / Planned Button */}
        <FadeIn>
          <button
            className={`${styles.sidebarPlanButton} ${userHasExperience ? styles.planned : ''} ${userHasExperience && favHover ? styles.removeHover : ''} ${loading || plansLoading ? styles.loading : ''}`}
            ref={planButtonRef}
            onClick={handleExperience}
            aria-label={
              userHasExperience
                ? lang.current.button.removeFavoriteExp
                : lang.current.button.addFavoriteExp
            }
            aria-pressed={userHasExperience}
            onMouseEnter={() => setFavHover(true)}
            onMouseLeave={() => setFavHover(false)}
            disabled={loading || plansLoading}
            aria-busy={loading || plansLoading}
          >
            {plansLoading ? (
              <Loading size="sm" variant="inline" showMessage={false} />
            ) : userHasExperience ? (
              favHover
                ? lang.current.button.removeFavoriteExp
                : lang.current.button.expPlanAdded
            ) : (
              "Plan This Experience"
            )}
          </button>
        </FadeIn>

        {/* Planned Date Badge - Only shown when My Plan tab is active (hidden on The Plan/experience tab) */}
        {selectedPlan?.planned_date && activeTab === "myplan" && (
          <FadeIn>
            <div className="d-flex justify-content-center">
              <div
                className={`${styles.datePickerBadge} ${!userOwnsSelectedPlan ? styles.viewOnly : ''}`}
                onClick={() => {
                  if (!userOwnsSelectedPlan) return;
                  if (showDatePicker) {
                    setShowDatePicker(false);
                  } else {
                    setIsEditingDate(true);
                    setPlannedDate(formatDateForInput(selectedPlan.planned_date));
                    setShowDatePicker(true);
                  }
                }}
                title={userOwnsSelectedPlan
                  ? (showDatePicker ? "Click to close date picker" : "Click to update planned date")
                  : "Shared plan date (view only)"
                }
              >
                <FaCalendarAlt className={styles.dateIcon} />
                {formatDateOrdinal(selectedPlan.planned_date)}
              </div>
            </div>
          </FadeIn>
        )}

        {/* Secondary Actions Row */}
        <div className={styles.sidebarSecondaryRow}>
          {/* Edit Date Button - Only shown if user owns the selected plan and on My Plan tab */}
          {userOwnsSelectedPlan && activeTab === "myplan" && (
            <FadeIn>
              <button
                className={styles.secondaryButton}
                onClick={() => {
                  if (showDatePicker) {
                    setShowDatePicker(false);
                  } else {
                    setIsEditingDate(true);
                    setPlannedDate(
                      selectedPlan.planned_date
                        ? formatDateForInput(selectedPlan.planned_date)
                        : ""
                    );
                    setShowDatePicker(true);
                  }
                }}
                aria-label={lang.current.button.editDate}
                title={showDatePicker
                  ? "Click to close date picker"
                  : (selectedPlan.planned_date
                      ? "Click to update planned date"
                      : "Click to add planned date")
                }
              >
                <FaCalendarAlt /> Edit Date
              </button>
            </FadeIn>
          )}

          {/* Share Button */}
          {onShare && (
            <FadeIn>
              <button
                className={styles.shareButton}
                onClick={onShare}
                aria-label={lang.current.button.share}
                title={lang.current.button.share}
              >
                <FaShareAlt />
              </button>
            </FadeIn>
          )}

          {/* Edit & Delete Buttons - Only shown if user is owner */}
          {isOwner(user, experience) && (
            <>
              <FadeIn>
                <button
                  className={styles.secondaryButton}
                  onClick={() => navigate(`/experiences/${experienceId}/update`)}
                  aria-label={lang.current.button.updateExperience}
                  title={lang.current.button.updateExperience}
                >
                  <FaPencilAlt />
                </button>
              </FadeIn>
              <FadeIn>
                <button
                  className={styles.dangerButton}
                  onClick={() => setShowDeleteModal(true)}
                  aria-label={lang.current.button.delete}
                  title={lang.current.button.delete}
                >
                  <FaTrash />
                </button>
              </FadeIn>
            </>
          )}
        </div>
      </div>
    );
  }

  // Default variant - horizontal row layout
  return (
    <div className={`${styles.actionButtonsRow} col-md-6`}>
      {/* Plan It / Planned Button */}
      <FadeIn>
        <button
          className={`${styles.planButton} ${userHasExperience ? styles.planned : ''} ${userHasExperience && favHover ? styles.removeHover : ''} ${loading || plansLoading ? styles.loading : ''}`}
          ref={planButtonRef}
          onClick={handleExperience}
          aria-label={
            userHasExperience
              ? lang.current.button.removeFavoriteExp
              : lang.current.button.addFavoriteExp
          }
          aria-pressed={userHasExperience}
          onMouseEnter={() => setFavHover(true)}
          onMouseLeave={() => setFavHover(false)}
          disabled={loading || plansLoading}
          aria-busy={loading || plansLoading}
        >
          {plansLoading ? (
            <Loading size="sm" variant="inline" showMessage={false} />
          ) : userHasExperience ? (
            favHover
              ? lang.current.button.removeFavoriteExp
              : lang.current.button.expPlanAdded
          ) : (
            lang.current.button.addFavoriteExp
          )}
        </button>
      </FadeIn>

      {/* Planned Date Badge - Between Plan It and action buttons - Only shown on My Plan tab */}
      {selectedPlan?.planned_date && activeTab === "myplan" && (
        <FadeIn>
          <div
            className={`${styles.datePickerBadge} ${!userOwnsSelectedPlan ? styles.viewOnly : ''}`}
            onClick={() => {
              if (!userOwnsSelectedPlan) return;
              if (showDatePicker) {
                setShowDatePicker(false);
              } else {
                setIsEditingDate(true);
                setPlannedDate(formatDateForInput(selectedPlan.planned_date));
                setShowDatePicker(true);
              }
            }}
            title={userOwnsSelectedPlan
              ? (showDatePicker ? "Click to close date picker" : "Click to update planned date")
              : "Shared plan date (view only)"
            }
          >
            <FaCalendarAlt className={styles.dateIcon} />
            {formatDateOrdinal(selectedPlan.planned_date)}
          </div>
        </FadeIn>
      )}

      {/* Edit Date Button - Only shown if user owns the selected plan and on My Plan tab */}
      {userOwnsSelectedPlan && activeTab === "myplan" && (
        <FadeIn>
          <button
            className={styles.secondaryButton}
            onClick={() => {
              if (showDatePicker) {
                setShowDatePicker(false);
              } else {
                setIsEditingDate(true);
                setPlannedDate(
                  selectedPlan.planned_date
                    ? formatDateForInput(selectedPlan.planned_date)
                    : ""
                );
                setShowDatePicker(true);
              }
            }}
            aria-label={lang.current.button.editDate}
            title={showDatePicker
              ? "Click to close date picker"
              : (selectedPlan.planned_date
                  ? "Click to update planned date"
                  : "Click to add planned date")
            }
          >
            <FaCalendarAlt />
          </button>
        </FadeIn>
      )}

      {/* Share Button */}
      {onShare && (
        <FadeIn>
          <button
            className={styles.shareButton}
            onClick={onShare}
            aria-label={lang.current.button.share}
            title={lang.current.button.share}
          >
            <FaShareAlt />
          </button>
        </FadeIn>
      )}

      {/* Edit & Delete Buttons - Only shown if user is owner */}
      {isOwner(user, experience) && (
        <>
          <FadeIn>
            <button
              className={styles.secondaryButton}
              onClick={() => navigate(`/experiences/${experienceId}/update`)}
              aria-label={lang.current.button.updateExperience}
              title={lang.current.button.updateExperience}
            >
              <FaPencilAlt />
            </button>
          </FadeIn>
          <FadeIn>
            <button
              className={styles.dangerButton}
              onClick={() => setShowDeleteModal(true)}
              aria-label={lang.current.button.delete}
              title={lang.current.button.delete}
            >
              <FaTrash />
            </button>
          </FadeIn>
        </>
      )}
    </div>
  );
}
