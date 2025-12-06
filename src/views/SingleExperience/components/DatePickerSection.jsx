/**
 * DatePickerSection Component
 * Modal for setting/editing planned dates
 */

import Modal from '../../../components/Modal/Modal';
import Alert from '../../../components/Alert/Alert';
import { FormLabel, FormControl } from '../../../components/design-system';
import { getMinimumPlanningDate, isValidPlannedDate } from '../../../utilities/date-utils';
import { formatPlanningTime } from '../../../utilities/planning-time-utils';
import { FaCalendarAlt } from 'react-icons/fa';

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
  const handleClose = () => {
    setShowDatePicker(false);
    setIsEditingDate(false);
    setPlannedDate("");
  };

  const handleSubmit = () => {
    handleDateUpdate();
  };

  // Custom footer with all action buttons
  const modalFooter = (
    <div className="d-flex gap-2 w-100 justify-content-end flex-nowrap">
      {!isEditingDate && (
        <button
          className="btn btn-outline-secondary"
          style={{ borderRadius: 'var(--btn-radius-pill)' }}
          onClick={() => handleAddExperience({})}
          aria-label={lang.current.button.skip}
        >
          {lang.current.button.skip}
        </button>
      )}
      <button
        className="btn btn-outline-secondary"
        style={{ borderRadius: 'var(--btn-radius-pill)' }}
        onClick={handleClose}
        aria-label={lang.current.button.cancel}
      >
        {lang.current.button.cancel}
      </button>
      <button
        className="btn btn-primary"
        style={{ borderRadius: 'var(--btn-radius-pill)' }}
        onClick={handleSubmit}
        disabled={!plannedDate || loading}
        aria-label={
          isEditingDate
            ? lang.current.button.updateDate
            : lang.current.button.setDateAndAdd
        }
      >
        {loading ? "Saving..." : (isEditingDate
          ? lang.current.button.updateDate
          : lang.current.button.setDateAndAdd)}
      </button>
    </div>
  );

  return (
    <Modal
      show={showDatePicker}
      onClose={handleClose}
      title={isEditingDate
        ? lang.current.heading.editPlannedDate
        : lang.current.heading.planYourExperience}
      icon={<FaCalendarAlt />}
      size="sm"
      footer={modalFooter}
    >
      {experience.max_planning_days > 0 && formatPlanningTime(experience.max_planning_days) && (
        <p className="text-muted mb-3">
          {lang.current.helper.requiresDaysToPlan.replace(
            "{days}",
            formatPlanningTime(experience.max_planning_days)
          )}
        </p>
      )}

      <div className="mb-3">
        <FormLabel htmlFor="plannedDate" className="fw-semibold">
          {lang.current.label.whenDoYouWantExperience}
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
          autoFocus
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
              message={lang.current.alert.notEnoughTimeWarning}
            />
          )}
      </div>
    </Modal>
  );
}
