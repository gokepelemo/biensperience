/**
 * AddDateModal Component
 * Simple modal for adding a scheduled date and time to a plan item.
 * Properly handles user timezone for date/time storage and display.
 */

import { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FaCalendarAlt, FaClock } from 'react-icons/fa';
import Modal from '../Modal/Modal';
import styles from './AddDateModal.module.scss';
import { logger } from '../../utilities/logger';
import { lang } from '../../lang.constants';
import { useUser } from '../../contexts/UserContext';
import {
  formatForDateInput,
  localToUTC,
  displayDateWithDay,
  getEffectiveTimezone
} from '../../utilities/time-utils';

/**
 * Format date for input[type="date"] (YYYY-MM-DD) in user's timezone
 */
function formatDateForInputTz(date, profile = null) {
  if (!date) return '';
  return formatForDateInput(date, profile);
}

/**
 * Format time for input[type="time"] (HH:MM)
 */
function formatTimeForInput(time) {
  if (!time) return '';
  // If already in HH:MM format, return as is
  if (/^\d{2}:\d{2}$/.test(time)) return time;
  // If it's a date object or ISO string, extract time
  const d = new Date(time);
  if (!isNaN(d.getTime())) {
    return d.toTimeString().slice(0, 5);
  }
  return '';
}

export default function AddDateModal({
  show,
  onClose,
  onSave,
  initialDate = null,
  initialTime = null,
  planItemText = 'Plan Item',
  minDate = null // Minimum allowed date (e.g., plan's planned_date)
}) {
  const { user } = useUser();
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get user's timezone for display
  const userTimezone = getEffectiveTimezone(user);

  // Compute minimum date for the input (formatted in user's timezone)
  const minDateForInput = minDate ? formatDateForInputTz(minDate, user) : '';

  // Reset state when modal opens/closes
  useEffect(() => {
    if (show) {
      setSelectedDate(formatDateForInputTz(initialDate, user));
      setSelectedTime(formatTimeForInput(initialTime) || '');
      setError(null);
    }
  }, [show, initialDate, initialTime, user]);

  // Get modal strings
  const modalStrings = lang.current.modal.addDateModal;

  // Handle save
  const handleSave = useCallback(async () => {
    if (!selectedDate) {
      setError(modalStrings.selectDate);
      return;
    }

    // Validate that selected date is not before minDate
    if (minDateForInput && selectedDate < minDateForInput) {
      setError(modalStrings.dateBeforeMinDate || 'Scheduled date cannot be before the planned date');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Build date/time data - convert local date to UTC for storage
      // The date input gives us YYYY-MM-DD which we combine with time
      // to create a proper local datetime before converting to UTC
      let dateTimeStr = selectedDate;
      if (selectedTime) {
        dateTimeStr = `${selectedDate}T${selectedTime}:00`;
      } else {
        // If no time specified, use noon in local timezone to avoid date shift issues
        dateTimeStr = `${selectedDate}T12:00:00`;
      }

      const dateData = {
        scheduled_date: localToUTC(dateTimeStr, user),
        scheduled_time: selectedTime || null
      };

      logger.info('[AddDateModal] Saving date', {
        ...dateData,
        timezone: userTimezone,
        localInput: dateTimeStr
      });

      await onSave(dateData);
      onClose();
    } catch (err) {
      logger.error('[AddDateModal] Save failed', { error: err.message });
      setError(err.message || 'Failed to save date');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedTime, onSave, onClose, user, userTimezone, minDateForInput, modalStrings.dateBeforeMinDate]);

  // Handle clear date
  const handleClear = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Clear both date and time
      const dateData = {
        scheduled_date: null,
        scheduled_time: null
      };

      logger.info('[AddDateModal] Clearing date');

      await onSave(dateData);
      onClose();
    } catch (err) {
      logger.error('[AddDateModal] Clear failed', { error: err.message });
      setError(err.message || 'Failed to clear date');
    } finally {
      setLoading(false);
    }
  }, [onSave, onClose]);

  // Format display date for preview (using timezone-aware formatting)
  const getDisplayDate = useCallback(() => {
    if (!selectedDate) return null;
    // Create a date string that will be interpreted in local timezone
    const dateStr = `${selectedDate}T12:00:00`;
    return displayDateWithDay(dateStr, user);
  }, [selectedDate, user]);

  // Format display time for preview
  const getDisplayTime = useCallback(() => {
    if (!selectedTime) return null;
    const [hours, minutes] = selectedTime.split(':');
    const h = parseInt(hours, 10);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHour = h % 12 || 12;
    return `${displayHour}:${minutes} ${period}`;
  }, [selectedTime]);

  if (!show) return null;

  // Build footer with standard Modal buttons
  const modalFooter = (
    <>
      {/* Clear button - only show if there's an existing date */}
      {initialDate && (
        <button
          type="button"
          className="btn btn-danger me-auto"
          onClick={handleClear}
          disabled={loading}
        >
          {modalStrings.clearDate}
        </button>
      )}
      <button
        type="button"
        className="btn btn-primary"
        onClick={handleSave}
        disabled={loading || !selectedDate}
      >
        {loading ? modalStrings.saving : modalStrings.save}
      </button>
    </>
  );

  return (
    <Modal
      show={show}
      onClose={onClose}
      title={modalStrings.title}
      size="sm"
      footer={modalFooter}
      loading={loading}
    >
      <div className={styles.addDateModal}>
        {/* Plan item name */}
        <div className={styles.planItemInfo}>
          <span className={styles.planItemLabel}>{modalStrings.forLabel}</span>
          <span className={styles.planItemText}>{planItemText}</span>
        </div>

        {/* Error message */}
        {error && (
          <div className={styles.errorMessage}>
            {error}
          </div>
        )}

        {/* Date input */}
        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>
            <FaCalendarAlt className={styles.inputIcon} />
            {modalStrings.dateLabel}
          </label>
          <input
            type="date"
            className={styles.dateInput}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            disabled={loading}
            min={minDateForInput || undefined}
          />
        </div>

        {/* Time input (optional) */}
        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>
            <FaClock className={styles.inputIcon} />
            {modalStrings.timeLabel} <span className={styles.optional}>{modalStrings.timeOptional}</span>
          </label>
          <input
            type="time"
            className={styles.timeInput}
            value={selectedTime}
            onChange={(e) => setSelectedTime(e.target.value)}
            disabled={loading}
          />
        </div>

        {/* Timezone indicator */}
        <div className={styles.timezoneInfo}>
          {modalStrings.timezoneInfo} <strong>{userTimezone}</strong>
        </div>

        {/* Preview */}
        {selectedDate && (
          <div className={styles.preview}>
            <div className={styles.previewIcon}>
              <FaCalendarAlt />
            </div>
            <div className={styles.previewContent}>
              <div className={styles.previewDate}>{getDisplayDate()}</div>
              {selectedTime && (
                <div className={styles.previewTime}>at {getDisplayTime()}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

AddDateModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  initialDate: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  initialTime: PropTypes.string,
  planItemText: PropTypes.string,
  minDate: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)])
};
