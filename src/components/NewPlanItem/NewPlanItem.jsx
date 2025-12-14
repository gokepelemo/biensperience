import styles from "./NewPlanItem.module.scss";
import { useCallback, useState, useMemo } from "react";
import Modal from "../Modal/Modal";
import { addPlanItem, updatePlanItem } from "../../utilities/experiences-api";
import { lang } from "../../lang.constants";
import { handleError } from "../../utilities/error-handler";
import { createUrlSlug } from "../../utilities/url-utils";
import { FormControl, FormLabel } from "../../components/design-system";
import { useFormPersistence } from "../../hooks/useFormPersistence";
import { formatRestorationMessage } from "../../utilities/time-utils";
import { useToast } from "../../contexts/ToastContext";
import { useUser } from "../../contexts/UserContext";

export default function NewPlanItem({
  experience,
  setExperience,
  formState,
  setFormState,
  formVisible,
  setFormVisible,
  newPlanItem,
  setNewPlanItem,
  updateData,
}) {
  const { user } = useUser();
  const { success } = useToast();

  // Determine if we're in add mode (formState === 1)
  const isAddMode = formState === 1;

  // Form persistence - only for add mode
  const formData = useMemo(() => {
    if (!isAddMode) return null;
    return {
      text: newPlanItem.text || '',
      cost_estimate: newPlanItem.cost_estimate || '',
      planning_days: newPlanItem.planning_days || '',
      parent: newPlanItem.parent || '',
      url: newPlanItem.url || ''
    };
  }, [isAddMode, newPlanItem.text, newPlanItem.cost_estimate,
      newPlanItem.planning_days, newPlanItem.parent, newPlanItem.url]);

  const setFormData = useCallback((data) => {
    if (!data || !isAddMode) return;
    setNewPlanItem(prev => ({
      ...prev,
      text: data.text !== undefined ? data.text : prev.text,
      cost_estimate: data.cost_estimate !== undefined ? data.cost_estimate : prev.cost_estimate,
      planning_days: data.planning_days !== undefined ? data.planning_days : prev.planning_days,
      parent: data.parent !== undefined ? data.parent : prev.parent,
      url: data.url !== undefined ? data.url : prev.url
    }));
  }, [isAddMode, setNewPlanItem]);

  const persistence = useFormPersistence(
    experience?._id && isAddMode ? `new-plan-item-form-${experience._id}` : null,
    formData,
    setFormData,
    {
      enabled: !!experience?._id && isAddMode && !!user?._id,
      userId: user?._id,
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      debounceMs: 1000,
      shouldSave: (data) => data?.text?.trim()?.length > 0,
      onRestore: (savedData, age) => {
        if (savedData?.text?.trim()) {
          // Auto-show the form if data is restored
          setFormVisible(true);
          setFormState(1);
          const message = formatRestorationMessage(age, 'create');
          success(message, {
            duration: 15000,
            actions: [{
              label: 'Clear',
              onClick: () => {
                setNewPlanItem({});
                persistence.clear();
              },
              variant: 'link'
            }]
          });
        }
      }
    }
  );

  const handleChange = useCallback((e) => {
    let planItem = { ...newPlanItem };
    const value = e.target.name === 'url' ? createUrlSlug(e.target.value) : e.target.value;
    setNewPlanItem(
      Object.assign(planItem, { [e.target.name]: value })
    );
  }, [newPlanItem, setNewPlanItem]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    try {
      if (formState) {
        let updatedExperience = await addPlanItem(experience._id, newPlanItem);
        setExperience(updatedExperience);
        // Show success modal offering to add another
        setFormVisible(false);
        setShowSuccessModal(true);
        setSavedParent(newPlanItem.parent || '');
        // Clear form persistence on successful add
        if (persistence) {
          persistence.clear();
        }
      } else {
        let updatedExperience = await updatePlanItem(
          experience._id,
          newPlanItem
        );
        setExperience(updatedExperience);
      }
      setNewPlanItem({});
      updateData();
    } catch (err) {
      handleError(err, { context: formState ? 'Add plan item' : 'Update plan item' });
    }
  }, [formState, experience._id, newPlanItem, setExperience, setFormVisible, formVisible, setNewPlanItem, updateData, persistence]);

  const handleVisibility = useCallback((e) => {
    e.preventDefault();
    if (formVisible) setNewPlanItem({});
    setFormVisible(!formVisible);
    setFormState(1);
  }, [formVisible, setNewPlanItem, setFormVisible, setFormState]);
  
  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedParent, setSavedParent] = useState('');

  const handleAddAnother = useCallback((sameParent = true) => {
    // Open form and preset parent as requested
    setNewPlanItem({ parent: sameParent ? savedParent : '' });
    setFormState(1);
    setFormVisible(true);
    setShowSuccessModal(false);
  }, [savedParent, setNewPlanItem, setFormState, setFormVisible]);

  const handleDone = useCallback(() => {
    setShowSuccessModal(false);
  }, []);
  return (
    <>
      <button
        className={`${styles.planItemVisibility} btn btn-light`}
        onClick={handleVisibility}
      >
        {formVisible ? lang.current.button.cancel : lang.current.button.addPlanItem}
      </button>
      {formVisible ? (
        <>
          <h5 className="lead mt-3">
            {formState ? (newPlanItem.parent ? lang.current.button.addChild : lang.current.button.add) : (newPlanItem.parent ? lang.current.button.updateChild : lang.current.button.update)} {lang.current.label.title}
          </h5>
          <form onSubmit={handleSubmit} className={styles.newPlanItem}>
            <FormLabel htmlFor="text">{lang.current.label.title}</FormLabel>
            <FormControl
              type="text"
              name="text"
              id="text"
              onChange={handleChange}
              placeholder={lang.current.placeholder.planItem}
              value={newPlanItem.text}
            />
            <FormLabel htmlFor="cost_estimate">{lang.current.label.costEstimate}</FormLabel>
            <FormControl
              type="number"
              name="cost_estimate"
              id="cost_estimate"
              onChange={handleChange}
              placeholder={lang.current.placeholder.costEstimate}
              value={newPlanItem.cost_estimate}
            />
            <FormLabel htmlFor="planning_days">{lang.current.label.planningDays}</FormLabel>
            <FormControl
              type="number"
              name="planning_days"
              id="planning_days"
              onChange={handleChange}
              placeholder={lang.current.placeholder.planningDays}
              value={newPlanItem.planning_days}
            />
            <FormLabel htmlFor="parent">{lang.current.label.parentPlanItem}</FormLabel>
            <FormControl
              as="select"
              name="parent"
              id="parent"
              onChange={handleChange}
              value={newPlanItem.parent || ''}
            >
              <option value="">{lang.current.helper.noneTopLevel}</option>
              {experience.plan_items.filter(item => !item.parent).map(item => (
                <option key={item._id} value={item._id}>{item.text}</option>
              ))}
            </FormControl>
            <FormLabel htmlFor="url">{lang.current.label.url}</FormLabel>
            <FormControl
              type="text"
              name="url"
              id="url"
              onChange={handleChange}
              placeholder={lang.current.placeholder.url}
              value={newPlanItem.url}
            />
            <button type="submit" className="btn btn-light">
              {formState ? lang.current.button.add : lang.current.button.update}
            </button>
          </form>
        </>
      ) : (
        <div></div>
      )}
      {/* Success modal shown after adding a plan item */}
      <Modal
        show={showSuccessModal}
        onClose={handleDone}
        title={lang.current.message.planItemAdded || 'Plan item added'}
        footer={(
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn btn-outline-primary" onClick={() => handleAddAnother(true)}>
              {lang.current.button.addAnotherSameParent || 'Add Another (same parent)'}
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => handleAddAnother(false)}>
              {lang.current.button.addAnotherTopLevel || 'Add Another (top-level)'}
            </button>
            <button type="button" className="btn btn-primary" onClick={handleDone}>
              {lang.current.button.done || 'Done'}
            </button>
          </div>
        )}
        showSubmitButton={false}
        showHeader={true}
      >
        <div style={{ padding: '8px 0' }}>
          <p style={{ margin: 0 }}>{lang.current.message.planItemAddSuccess || 'Plan item created successfully.'}</p>
        </div>
      </Modal>
    </>
  );
}
