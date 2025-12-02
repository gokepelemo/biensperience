import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { lang } from "../../lang.constants";
import { createDestination } from "../../utilities/destinations-api";
import { useData } from "../../contexts/DataContext";
import { useUser } from "../../contexts/UserContext";
import { useToast } from "../../contexts/ToastContext";
import { useFormPersistence } from "../../hooks/useFormPersistence";
import { useFormChangeHandler } from "../../hooks/useFormChangeHandler";
import { useTravelTipsManager } from "../../hooks/useTravelTipsManager";
import { useFormErrorHandling } from "../../hooks/useFormErrorHandling";
import { formatRestorationMessage } from "../../utilities/time-utils";
import PhotoUpload from "../PhotoUpload/PhotoUpload";
import Alert from "../Alert/Alert";
import ConfirmModal from "../ConfirmModal/ConfirmModal";
import SuccessModal from "../SuccessModal/SuccessModal";
import FormField from "../FormField/FormField";
import TravelTipsManager from "../TravelTipsManager/TravelTipsManager";
import { Form } from "react-bootstrap";

export default function NewDestination() {
  const { destinations: destData, addDestination } = useData();
  const { user } = useUser();
  const { success } = useToast();
  const navigate = useNavigate();

  const [newDestination, setNewDestination] = useState({});
  const [destinations, setDestinations] = useState([]);
  const [error, setError] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tipToDelete, setTipToDelete] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdDestination, setCreatedDestination] = useState(null);

  // Use custom hooks
  const handleChange = useFormChangeHandler(newDestination, setNewDestination);

  const {
    travelTips,
    newTravelTip,
    setTravelTips,
    addTravelTip,
    deleteTravelTip,
    handleNewTipChange,
    handleNewTipKeyPress,
    // Structured tip management
    tipMode,
    setTipMode,
    structuredTip,
    addStructuredTip,
    updateStructuredTipField,
    updateCallToAction
  } = useTravelTipsManager([]);

  const handleFormError = useFormErrorHandling(setError, {
    onEmailNotVerified: (data) => {
      setError(data.error || lang.current.alert.emailNotVerifiedMessage);
    }
  });

  // Form persistence - combines newDestination and travelTips
  const formData = { ...newDestination, travel_tips: travelTips };
  const setFormData = (data) => {
    const { travel_tips, ...destData } = data;
    setNewDestination(destData);
    if (travel_tips) {
      setTravelTips(travel_tips);
    }
  };

  const persistence = useFormPersistence(
    'new-destination-form',
    formData,
    setFormData,
    {
      enabled: true,
      userId: user?._id,
      ttl: 24 * 60 * 60 * 1000,
      debounceMs: 1000,
      excludeFields: [],
      onRestore: (savedData, age) => {
        const message = formatRestorationMessage(age, 'create');
        success(message, {
          duration: 20000,
          actions: [{
            label: lang.current.button.clearForm,
            onClick: () => {
              setNewDestination({});
              setTravelTips([]);
              persistence.clear();
            },
            variant: 'link'
          }]
        });
      }
    }
  );

  useEffect(() => {
    if (destData) setDestinations(destData);
    document.title = `New Destination - Biensperience`;
  }, [destData]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    // Frontend duplicate check
    if (newDestination.name && newDestination.country) {
      const duplicate = destinations.find(dest =>
        dest.name.toLowerCase().trim() === newDestination.name.toLowerCase().trim() &&
        dest.country.toLowerCase().trim() === newDestination.country.toLowerCase().trim()
      );

      if (duplicate) {
        setError(`A destination named "${newDestination.name}, ${newDestination.country}" already exists. Please choose a different destination.`);
        return;
      }
    }

    try {
      const destination = await createDestination(
        Object.assign({ ...newDestination }, { travel_tips: travelTips })
      );
      addDestination(destination);
      persistence.clear();

      // Show success modal instead of navigating directly
      setCreatedDestination(destination);
      setShowSuccessModal(true);
    } catch (err) {
      handleFormError(err, { context: 'Create destination' });
    }
  }

  function handleAddTravelTip() {
    if (newTravelTip.trim()) {
      addTravelTip();
    }
  }

  function handleDeleteTravelTip(index) {
    setTipToDelete(index);
    setShowDeleteModal(true);
  }

  return (
    <>
      <div className="row animation-fade-in">
        <div className="col-12">
          <h1 className="form-title">{lang.current.heading.createDestination}</h1>
        </div>
      </div>

      {error && (
        <Alert type="danger" className="mb-4">
          <div>
            {error}
            {error.includes('verify your email') && (
              <div className="mt-2">
                <a href="/resend-confirmation" className="btn btn-sm btn-outline-primary">
                  Resend Verification Email
                </a>
              </div>
            )}
          </div>
        </Alert>
      )}

      <div className="row my-4 animation-fade-in justify-content-center">
        <div className="col-12">
          <Form onSubmit={handleSubmit} className="form-unified">
            <FormField
              name="name"
              label="City / Town"
              type="text"
              value={newDestination.name || ''}
              onChange={handleChange}
              placeholder={lang.current.placeholder.city}
              required
              tooltip={lang.current.helper.cityRequired}
              tooltipPlacement="top"
            />

            <div className="row mb-4">
              <div className="col-md-6 mb-3 mb-md-0">
                <FormField
                  name="state"
                  label="State / Province"
                  type="text"
                  value={newDestination.state || ''}
                  onChange={handleChange}
                  placeholder={lang.current.placeholder.stateProvince}
                  tooltip={lang.current.helper.stateProvinceRequired}
                  tooltipPlacement="top"
                  className="mb-0"
                />
              </div>

              <div className="col-md-6">
                <FormField
                  name="country"
                  label="Country"
                  type="text"
                  value={newDestination.country || ''}
                  onChange={handleChange}
                  placeholder={lang.current.placeholder.country}
                  required
                  tooltip={lang.current.helper.countryRequired}
                  tooltipPlacement="top"
                  className="mb-0"
                />
              </div>
            </div>

            <FormField
              name="overview"
              label="Overview"
              type="textarea"
              value={newDestination.overview || ''}
              onChange={handleChange}
              placeholder={lang.current.placeholder.destinationOverview}
              rows={4}
              tooltip={lang.current.helper.overviewOptional}
              tooltipPlacement="top"
              showCounter
              maxLength={300}
            />

            <div className="mb-4">
              <Form.Label>
                {lang.current.heading.photos}
              </Form.Label>
              <PhotoUpload data={newDestination} setData={setNewDestination} />
            </div>

            <TravelTipsManager
              tips={travelTips}
              newTip={newTravelTip}
              onNewTipChange={handleNewTipChange}
              onNewTipKeyPress={handleNewTipKeyPress}
              onAddTip={handleAddTravelTip}
              onDeleteTip={handleDeleteTravelTip}
              label={lang.current.heading.travelTips}
              placeholder="Share an insider tip (e.g., 'Best time to visit is spring')"
              addButtonText="Add Tip"
              deleteButtonText="Remove"
              // Enhanced props for structured tips
              mode={tipMode}
              onModeChange={setTipMode}
              structuredTip={structuredTip}
              onStructuredTipFieldChange={updateStructuredTipField}
              onCallToActionChange={updateCallToAction}
              onAddStructuredTip={addStructuredTip}
            />

            <div className="d-flex justify-content-end mt-4">
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                aria-label="Create destination and continue to experience"
              >
                Create Destination
              </button>
            </div>
          </Form>
        </div>
      </div>

      <ConfirmModal
        show={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={() => {
          deleteTravelTip(tipToDelete);
          setShowDeleteModal(false);
        }}
        title="Delete Travel Tip?"
        message="You are about to permanently delete this travel tip"
        confirmText="Delete Permanently"
        confirmVariant="danger"
      />

      <SuccessModal
        show={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          // Reset form for creating another
          setNewDestination({});
          setTravelTips([]);
          setCreatedDestination(null);
        }}
        title="Destination Created!"
        message="Your destination has been created successfully"
        entityName={createdDestination ? `${createdDestination.name}, ${createdDestination.country}` : ''}
        entityType="destination"
        entityId={createdDestination?._id}
      />
    </>
  );
}
