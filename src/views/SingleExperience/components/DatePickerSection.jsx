/**
 * DatePickerSection Component
 * Modal for setting/editing planned dates
 */

import { Flex } from '@chakra-ui/react';
import { Modal, FormGroup, FormLabel, FormControl, Alert, Button as DSButton } from '../../../components/design-system';
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
    <Flex gap="var(--space-2)" w="100%" justify="flex-end" flexWrap="nowrap">
      {!isEditingDate && (
        <DSButton
          variant="outline"
          size="md"
          onClick={() => handleAddExperience({})}
          aria-label={lang.current.button.skip}
        >
          {lang.current.button.skip}
        </DSButton>
      )}
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
      </DSButton>
    </Flex>
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
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
          {lang.current.helper.requiresDaysToPlan.replace(
            "{days}",
            formatPlanningTime(experience.max_planning_days)
          )}
        </p>
      )}

      <FormGroup style={{ marginBottom: 'var(--space-4)' }}>
        <FormLabel htmlFor="plannedDate" style={{ fontWeight: 'var(--font-weight-semibold)' }}>
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
              style={{ marginTop: 'var(--space-2)' }}
              message={lang.current.alert.notEnoughTimeWarning}
            />
          )}
      </FormGroup>
    </Modal>
  );
}
