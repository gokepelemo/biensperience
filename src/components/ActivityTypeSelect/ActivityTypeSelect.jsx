/**
 * ActivityTypeSelect Component
 *
 * Minimal implementation using React-Bootstrap Form.Select.
 * No custom dropdowns, no portals, no complex state.
 * Emojis removed to test Chrome crash issue.
 */

import { Form } from 'react-bootstrap';
import { ACTIVITY_TYPES } from '../../constants/activity-types';

export default function ActivityTypeSelect({
  value,
  onChange,
  placeholder = 'Select activity type...',
  disabled = false,
  className = ''
}) {
  const handleChange = (e) => {
    const newValue = e.target.value || null;
    onChange(newValue);
  };

  return (
    <Form.Select
      value={value || ''}
      onChange={handleChange}
      disabled={disabled}
      className={className}
    >
      <option value="">{placeholder}</option>
      {ACTIVITY_TYPES.map(type => (
        <option key={type.value} value={type.value}>
          {type.label}
        </option>
      ))}
    </Form.Select>
  );
}
