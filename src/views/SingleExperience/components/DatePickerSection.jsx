/**
 * DatePickerSection Component
 * Displays date picker UI for setting/editing planned dates
 */

import Alert from '../../../components/Alert/Alert';
import { FormLabel, FormControl } from '../../../components/design-system';
import { getMinimumPlanningDate, isValidPlannedDate } from '../../../utilities/date-utils';

export default function DatePickerSection({
  // Visibility state
  showDatePicker,

  // Experience data
  experience,

  // Date picker state
  isEditingDate,
  plannedDate,
  setPlannedDate,
  loading,

  // Handlers
  handleDateUpdate,
  handleAddExperience,
  setShowDatePicker,
  setIsEditingDate,

  // Language strings
  lang
}) {
  if (!showDatePicker) return null;

  return (
    <div className="row mt-3 date-picker-modal">
      <div className="col-12">
        <Alert type="info" className="mb-0">
          <h3 className="mb-3">
            {isEditingDate
              ? lang.en.heading.editPlannedDate
              : lang.en.heading.planYourExperience}
          </h3>
          {experience.max_planning_days > 0 && (
            <p className="mb-3">
              {lang.en.helper.requiresDaysToPlan.replace(
                "{days}",
                experience.max_planning_days
              )}
            </p>
          )}
          <div className="mb-3">
            <FormLabel htmlFor="plannedDate" className="h5">
              {lang.en.label.whenDoYouWantExperience}
            </FormLabel>
            <FormControl
              type="date"
              id="plannedDate"
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
              onClick={(e) =>
                e.target.showPicker && e.target.showPicker()
              }
              min={getMinimumPlanningDate(
                experience.max_planning_days
              )}
            />
            {plannedDate &&
              experience.max_planning_days > 0 &&
              !isValidPlannedDate(
                plannedDate,
                experience.max_planning_days
              ) && (
                <Alert
                  type="warning"
                  className="mt-2"
                  message={lang.en.alert.notEnoughTimeWarning}
                />
              )}
          </div>
          <button
            className="btn btn-primary me-2"
            onClick={() => handleDateUpdate()}
            disabled={!plannedDate || loading}
            aria-label={
              isEditingDate
                ? lang.en.button.updateDate
                : lang.en.button.setDateAndAdd
            }
          >
            {isEditingDate
              ? lang.en.button.updateDate
              : lang.en.button.setDateAndAdd}
          </button>
          {!isEditingDate && (
            <button
              className="btn btn-secondary me-2"
              onClick={() => handleAddExperience({})}
              aria-label={lang.en.button.skip}
            >
              {lang.en.button.skip}
            </button>
          )}
          <button
            className="btn btn-secondary"
            onClick={() => {
              setShowDatePicker(false);
              setIsEditingDate(false);
              setPlannedDate("");
            }}
            aria-label={lang.en.button.cancel}
          >
            {lang.en.button.cancel}
          </button>
        </Alert>
      </div>
    </div>
  );
}
