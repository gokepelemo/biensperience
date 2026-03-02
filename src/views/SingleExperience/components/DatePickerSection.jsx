/**
 * DatePickerSection Component
 * Modal for setting/editing planned dates
 */

import { Modal, FormGroup, FormLabel, FormControl, Alert } from '../../../components/design-system';
import { getMinimumPlanningDate, isValidPlannedDate } from '../../../utilities/date-utils';
import { formatPlanningTime } from '../../../utilities/planning-time-utils';
import { FaCalendarAlt } from 'react-icons/fa';
import styles from './DatePickerSection.module.scss';

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
    <div className={styles.footerActions}>
      {!isEditingDate && (
        <button
          className={styles.btnOutlineSecondary}
          onClick={() => handleAddExperience({})}
          aria-label={lang.current.button.skip}
        >
          {lang.current.button.skip}
        </button>
      )}
      <button
        className={styles.btnOutlineSecondary}
        onClick={handleClose}
        aria-label={lang.current.button.cancel}
      >
        {lang.current.button.cancel}
      </button>
      <button
        className={styles.btnPrimary}
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
      size="md"
      footer={modalFooter}
    >
      {experience.max_planning_days > 0 && formatPlanningTime(experience.max_planning_days) && (
        <p className={`${styles.textMuted} ${styles.mb3}`}>
          {lang.current.helper.requiresDaysToPlan.replace(
            "{days}",
            formatPlanningTime(experience.max_planning_days)
          )}
        </p>
      )}

      <FormGroup className={styles.mb3}>
        <FormLabel htmlFor="plannedDate" className={styles.fwSemibold}>
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
              className={styles.alertTopSpacing}
              message={lang.current.alert.notEnoughTimeWarning}
            />
          )}
      </FormGroup>
    </Modal>
  );
}
