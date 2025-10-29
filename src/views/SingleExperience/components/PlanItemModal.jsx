/**
 * PlanItemModal Component
 * Modal for adding/editing plan items
 */

import { useState, useEffect } from 'react';
import { Form } from 'react-bootstrap';
import Modal from '../../../components/Modal/Modal';
import FormField from '../../../components/FormField/FormField';

export default function PlanItemModal({
  show,
  onHide,
  onSubmit,
  isEditing = false,
  initialData = {},
  parentItems = [],
  title
}) {
  const [formData, setFormData] = useState({
    text: '',
    url: '',
    cost_estimate: '',
    planning_days: '',
    parent: '',
    ...initialData
  });

  // Reset form when modal opens/closes or initial data changes
  useEffect(() => {
    if (show) {
      setFormData({
        text: '',
        url: '',
        cost_estimate: '',
        planning_days: '',
        parent: '',
        ...initialData
      });
    }
  }, [show, initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleCancel = () => {
    setFormData({
      text: '',
      url: '',
      cost_estimate: '',
      planning_days: '',
      parent: ''
    });
    onHide();
  };

  return (
    <Modal
      show={show}
      onHide={handleCancel}
      title={title || (isEditing ? 'Edit Plan Item' : 'Add Plan Item')}
      size="lg"
    >
      <Form onSubmit={handleSubmit}>
        <FormField
          label="Item Description"
          type="text"
          name="text"
          value={formData.text}
          onChange={handleChange}
          required
          placeholder="e.g., Book flight tickets"
          tooltipText="Describe what needs to be done for this plan item"
        />

        <FormField
          label="URL (optional)"
          type="url"
          name="url"
          value={formData.url}
          onChange={handleChange}
          placeholder="https://example.com"
          tooltipText="Add a relevant link (booking site, information page, etc.)"
        />

        <FormField
          label="Cost Estimate"
          type="number"
          name="cost_estimate"
          value={formData.cost_estimate}
          onChange={handleChange}
          min="0"
          step="0.01"
          placeholder="0.00"
          prepend="$"
          tooltipText="Estimated cost for this item in USD"
        />

        <FormField
          label="Planning Days"
          type="number"
          name="planning_days"
          value={formData.planning_days}
          onChange={handleChange}
          min="0"
          placeholder="0"
          append="days"
          tooltipText="How many days before the trip should this be completed?"
        />

        {parentItems && parentItems.length > 0 && (
          <Form.Group className="mb-3">
            <Form.Label>Parent Item (optional)</Form.Label>
            <Form.Select
              name="parent"
              value={formData.parent}
              onChange={handleChange}
            >
              <option value="">None (top-level item)</option>
              {parentItems.map(item => (
                <option key={item._id} value={item._id}>
                  {item.text}
                </option>
              ))}
            </Form.Select>
            <Form.Text className="text-muted">
              Make this a sub-item of another plan item
            </Form.Text>
          </Form.Group>
        )}

        <div className="d-flex justify-content-end gap-2">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!formData.text?.trim()}
          >
            {isEditing ? 'Update' : 'Add'} Item
          </button>
        </div>
      </Form>
    </Modal>
  );
}
