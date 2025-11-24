/**
 * ActionButtonsRow Component
 * Displays action buttons for SingleExperience: Plan It, Edit Date, Edit Experience, Delete
 */

import { useNavigate } from 'react-router-dom';
import { FadeIn } from '../../../components/design-system';
import Loading from '../../../components/Loading/Loading';
import { isOwner } from '../../../utilities/permissions';
import { formatDateForInput } from '../../../utilities/date-utils';

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
  lang
}) {
  const navigate = useNavigate();

  // Check if user owns the selected plan
  const userOwnsSelectedPlan = selectedPlan && (
    selectedPlan.user?._id?.toString() === user?._id?.toString() ||
    selectedPlan.user?.toString() === user?._id?.toString()
  );

  return (
    <div className="d-flex col-md-6 justify-content-center justify-content-md-end align-items-center flex-row experience-actions">
      {/* Plan It / Planned Button */}
      <FadeIn>
        <button
          className={`btn btn-sm btn-icon my-1 my-sm-2 ${
            userHasExperience ? "btn-plan-remove" : "btn-plan-add"
          } ${loading || plansLoading ? "loading" : ""}`}
          ref={planButtonRef}
          style={planBtnWidth ? {
            width: `${planBtnWidth}px`,
            minWidth: `${planBtnWidth}px`,
            height: '44px',
            minHeight: '44px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center'
          } : undefined}
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
            className="btn btn-sm btn-icon my-1 my-sm-2 ms-2"
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
              className="btn btn-sm btn-icon my-1 my-sm-2 ms-2"
              onClick={() => navigate(`/experiences/${experienceId}/update`)}
              aria-label={lang.en.button.updateExperience}
              title={lang.en.button.updateExperience}
            >
              ✏️
            </button>
          </FadeIn>
          <FadeIn>
            <button
              className="btn btn-sm btn-icon my-1 my-sm-2 ms-2"
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
