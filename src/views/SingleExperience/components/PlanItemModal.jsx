/**
 * PlanItemModal Component
 * Unified modal for adding or editing plan items (experience or plan instance)
 * Handles form state, validation, and submission
 */

import { Form } from 'react-bootstrap';
import Modal from '../../../components/Modal/Modal';

const { Label: FormLabel, Control: FormControl } = Form;

export default function PlanItemModal({
  // Modal state
  show,
  onHide,

  // Form state
  editingPlanItem,
  setEditingPlanItem,
  planItemFormState, // 1 = add, 2 = edit

  // Context
  activeTab, // "experience" or "myplan"

  // Handlers
  onSaveExperiencePlanItem,
  onSavePlanInstanceItem,

  // UI state
  loading,

  // Language strings
  lang
}) {
  const handleSubmit = activeTab === "experience"
    ? onSaveExperiencePlanItem
    : onSavePlanInstanceItem;

  const modalTitle = planItemFormState === 1
    ? (editingPlanItem.parent ? "Add Child Plan Item" : "Add Plan Item")
    : "Edit Plan Item";

  const submitText = loading
    ? "Saving..."
    : planItemFormState === 1
    ? "Add Item"
    : "Update Item";

  return (
    <Modal
      show={show}
      onClose={onHide}
      title={modalTitle}
      dialogClassName="responsive-modal-dialog"
      onSubmit={handleSubmit}
      submitText={submitText}
      cancelText={lang.en.button.cancel}
      loading={loading}
      disableSubmit={!editingPlanItem.text}
    >
      <form className="plan-item-modal-form">
        {/* Item Description */}
        <div className="mb-3">
          <FormLabel htmlFor="planItemText">
            {lang.en.label.itemDescription}{" "}
            <span style={{ color: 'var(--bs-danger)' }}>*</span>
          </FormLabel>
          <FormControl
            type="text"
            id="planItemText"
            value={editingPlanItem.text || ""}
            onChange={(e) =>
              setEditingPlanItem({
                ...editingPlanItem,
                text: e.target.value,
              })
            }
            placeholder={lang.en.placeholder.itemDescription}
            required
          />
        </div>

        {/* URL (Optional) */}
        <div className="mb-3">
          <FormLabel htmlFor="planItemUrl">
            {lang.en.label.urlOptional}
          </FormLabel>
          <FormControl
            type="url"
            id="planItemUrl"
            value={editingPlanItem.url || ""}
            onChange={(e) =>
              setEditingPlanItem({
                ...editingPlanItem,
                url: e.target.value,
              })
            }
            placeholder={lang.en.placeholder.urlPlaceholder}
          />
        </div>

        {/* Cost */}
        <div className="mb-3">
          <label htmlFor="planItemCost" className="form-label">
            {lang.en.label.cost}
          </label>
          <div className="input-group">
            <span className="input-group-text">$</span>
            <input
              type="number"
              className="form-control"
              id="planItemCost"
              value={editingPlanItem.cost || ""}
              onChange={(e) =>
                setEditingPlanItem({
                  ...editingPlanItem,
                  cost: parseFloat(e.target.value) || 0,
                })
              }
              onFocus={(e) => {
                if (e.target.value === "0" || e.target.value === 0) {
                  setEditingPlanItem({
                    ...editingPlanItem,
                    cost: "",
                  });
                }
              }}
              onBlur={(e) => {
                if (e.target.value === "") {
                  setEditingPlanItem({
                    ...editingPlanItem,
                    cost: 0,
                  });
                }
              }}
              min="0"
              step="0.01"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Planning Days */}
        <div className="mb-3">
          <label htmlFor="planItemDays" className="form-label">
            {lang.en.label.planningTimeLabel}
          </label>
          <div className="input-group">
            <input
              type="number"
              className="form-control"
              id="planItemDays"
              value={editingPlanItem.planning_days || ""}
              onChange={(e) =>
                setEditingPlanItem({
                  ...editingPlanItem,
                  planning_days: parseInt(e.target.value) || 0,
                })
              }
              onFocus={(e) => {
                if (e.target.value === "0" || e.target.value === 0) {
                  setEditingPlanItem({
                    ...editingPlanItem,
                    planning_days: "",
                  });
                }
              }}
              onBlur={(e) => {
                if (e.target.value === "") {
                  setEditingPlanItem({
                    ...editingPlanItem,
                    planning_days: 0,
                  });
                }
              }}
              min="0"
              placeholder="0"
            />
            <span className="input-group-text">days</span>
          </div>
        </div>
      </form>
    </Modal>
  );
}
