/**
 * ActionButtonsRow Component
 * Displays action buttons for SingleExperience: Plan It, Edit Date, Edit Experience, Delete
 */

import { useNavigate } from 'react-router-dom';
import { useRef } from 'react';
import { FadeIn } from '../../../components/design-system';
import Loading from '../../../components/Loading/Loading';
import { isOwner } from '../../../utilities/permissions';
import { formatDateForInput } from '../../../utilities/date-utils';
import useButtonWidth from '../../../utilities/useButtonWidth';

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
  variant = "default"
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
    lang.en.button.addFavoriteExp,
    lang.en.button.expPlanAdded,
    lang.en.button.removeFavoriteExp
  ], { extraPadding: 12 });

  // Sidebar variant - vertical stacking with full-width buttons
  if (variant === "sidebar") {
    return (
      <div className="d-flex flex-column gap-3">
        {/* Primary Action - Plan It / Planned Button */}
        <FadeIn>
          <button
            className={`btn btn-lg w-100 ${
              userHasExperience ? "btn-plan-remove" : "btn-primary"
            } ${loading || plansLoading ? "loading" : ""}`}
            style={{
              borderRadius: 'var(--radius-full)',
              fontWeight: 'var(--font-weight-semibold)',
              minHeight: '52px', // Fixed height to prevent layout shift
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            ref={planButtonRef}
            onClick={handleExperience}
            aria-label={
              userHasExperience
                ? lang.en.button.removeFavoriteExp
                : lang.en.button.addFavoriteExp
            }
            aria-pressed={userHasExperience}
            onMouseEnter={() => setFavHover(true)}
            onMouseLeave={() => setFavHover(false)}
            disabled={loading || plansLoading}
            aria-busy={loading || plansLoading}
          >
            {plansLoading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', height: '24px' }}>
                <Loading size="sm" variant="inline" showMessage={false} />
              </span>
            ) : userHasExperience ? (
              favHover
                ? lang.en.button.removeFavoriteExp
                : lang.en.button.expPlanAdded
            ) : (
              "Plan This Experience"
            )}
          </button>
        </FadeIn>

        {/* Secondary Actions Row */}
        <div className="d-flex gap-2">
          {/* Edit Date Button - Only shown if user owns the selected plan */}
          {userOwnsSelectedPlan && (
            <FadeIn>
              <button
                className="btn btn-outline-secondary flex-grow-1"
                style={{ borderRadius: 'var(--btn-radius-pill)', minHeight: '44px' }}
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
                aria-label={lang.en.button.editDate}
                title={showDatePicker
                  ? "Click to close date picker"
                  : (selectedPlan.planned_date
                      ? "Click to update planned date"
                      : "Click to add planned date")
                }
              >
                📅 Edit Date
              </button>
            </FadeIn>
          )}

          {/* Edit & Delete Buttons - Only shown if user is owner */}
          {isOwner(user, experience) && (
            <>
              <FadeIn>
                <button
                  className="btn btn-outline-secondary"
                  style={{ borderRadius: 'var(--btn-radius-pill)', minWidth: '60px', minHeight: '44px' }}
                  onClick={() => navigate(`/experiences/${experienceId}/update`)}
                  aria-label={lang.en.button.updateExperience}
                  title={lang.en.button.updateExperience}
                >
                  ✏️
                </button>
              </FadeIn>
              <FadeIn>
                <button
                  className="btn btn-outline-danger"
                  style={{ borderRadius: 'var(--btn-radius-pill)', minWidth: '60px', minHeight: '44px' }}
                  onClick={() => setShowDeleteModal(true)}
                  aria-label={lang.en.button.delete}
                  title={lang.en.button.delete}
                >
                  ❌
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
    <div className="d-flex col-md-6 justify-content-center justify-content-md-end align-items-center flex-row experience-actions">
      {/* Plan It / Planned Button */}
      <FadeIn>
          <button
            className={`btn btn-sm btn-icon my-1 my-sm-2 ${
              userHasExperience ? "btn-plan-remove" : "btn-plan-add"
            } ${loading || plansLoading ? "loading" : ""}`}
            ref={planButtonRef}
          onClick={handleExperience}
          aria-label={
            userHasExperience
              ? lang.en.button.removeFavoriteExp
              : lang.en.button.addFavoriteExp
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
              ? lang.en.button.removeFavoriteExp
              : lang.en.button.expPlanAdded
          ) : (
            lang.en.button.addFavoriteExp
          )}
        </button>
      </FadeIn>

      {/* Edit Date Button - Only shown if user owns the selected plan */}
      {userOwnsSelectedPlan && (
        <FadeIn>
          <button
            className="btn btn-sm btn-outline-secondary my-1 my-sm-2 ms-2"
            style={{ borderRadius: 'var(--btn-radius-pill)', minWidth: '44px' }}
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
            aria-label={lang.en.button.editDate}
            title={showDatePicker
              ? "Click to close date picker"
              : (selectedPlan.planned_date
                  ? "Click to update planned date"
                  : "Click to add planned date")
            }
          >
            📅
          </button>
        </FadeIn>
      )}

      {/* Edit & Delete Buttons - Only shown if user is owner */}
      {isOwner(user, experience) && (
        <>
          <FadeIn>
            <button
              className="btn btn-sm btn-outline-secondary my-1 my-sm-2 ms-2"
              style={{ borderRadius: 'var(--btn-radius-pill)', minWidth: '44px' }}
              onClick={() => navigate(`/experiences/${experienceId}/update`)}
              aria-label={lang.en.button.updateExperience}
              title={lang.en.button.updateExperience}
            >
              ✏️
            </button>
          </FadeIn>
          <FadeIn>
            <button
              className="btn btn-sm btn-outline-danger my-1 my-sm-2 ms-2"
              style={{ borderRadius: 'var(--btn-radius-pill)', minWidth: '44px' }}
              onClick={() => setShowDeleteModal(true)}
              aria-label={lang.en.button.delete}
              title={lang.en.button.delete}
            >
              ❌
            </button>
          </FadeIn>
        </>
      )}
    </div>
  );
}
