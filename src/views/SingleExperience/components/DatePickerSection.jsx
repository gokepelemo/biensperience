/**
 * DatePickerSection Component
 * Modal for setting/editing planned dates using Chakra UI DatePicker
 */

import { useMemo } from 'react';
import { DatePicker, Flex, Text, parseDate } from '@chakra-ui/react';
import { Modal, Alert, Button as DSButton } from '../../../components/design-system';
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

  // Convert plannedDate string (YYYY-MM-DD) to DateValue[] for Chakra DatePicker
  const datePickerValue = useMemo(() => {
    if (!plannedDate) return [];
    try {
      return [parseDate(plannedDate)];
    } catch {
      return [];
    }
  }, [plannedDate]);

  // Compute min date as DateValue
  const minDateValue = useMemo(() => {
    const minStr = getMinimumPlanningDate(experience.max_planning_days);
    if (!minStr) return undefined;
    try {
      return parseDate(minStr);
    } catch {
      return undefined;
    }
  }, [experience.max_planning_days]);

  // Handle Chakra DatePicker value change → update parent string state
  const handleValueChange = (details) => {
    if (details.value && details.value.length > 0) {
      setPlannedDate(details.value[0].toString());
    } else {
      setPlannedDate("");
    }
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
        <Text color="var(--color-text-muted)" mb="var(--space-4)">
          {lang.current.helper.requiresDaysToPlan.replace(
            "{days}",
            formatPlanningTime(experience.max_planning_days)
          )}
        </Text>
      )}

      <DatePicker.Root
        value={datePickerValue}
        onValueChange={handleValueChange}
        min={minDateValue}
        closeOnSelect
        inline
        width="100%"
      >
        <DatePicker.Label fontWeight="var(--font-weight-semibold)">
          {lang.current.label.whenDoYouWantExperience}
        </DatePicker.Label>
        <DatePicker.Content unstyled>
          <DatePicker.View view="day">
            <DatePicker.Header />
            <DatePicker.DayTable />
          </DatePicker.View>
          <DatePicker.View view="month">
            <DatePicker.Header />
            <DatePicker.MonthTable />
          </DatePicker.View>
          <DatePicker.View view="year">
            <DatePicker.Header />
            <DatePicker.YearTable />
          </DatePicker.View>
        </DatePicker.Content>
      </DatePicker.Root>

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
    </Modal>
  );
}
