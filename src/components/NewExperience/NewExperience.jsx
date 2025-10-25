import "./NewExperience.css";
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useData } from "../../contexts/DataContext";
import { useToast } from "../../contexts/ToastContext";
import { createExperience } from "../../utilities/experiences-api";
import { lang } from "../../lang.constants";
import ImageUpload from "../../components/ImageUpload/ImageUpload";
import TagInput from "../../components/TagInput/TagInput";
import Alert from "../Alert/Alert";
import { handleError } from "../../utilities/error-handler";
import { isDuplicateName } from "../../utilities/deduplication";
import FormField from "../FormField/FormField";
import { FormTooltip } from "../Tooltip/Tooltip";
import { Form } from "react-bootstrap";
import { useFormPersistence } from "../../hooks/useFormPersistence";

export default function NewExperience() {
  const { destinations: destData, experiences: expData, addExperience } = useData();
  const { success } = useToast();
  const [newExperience, setNewExperience] = useState({});
  const [destinations, setDestinations] = useState([]);
  const [experiences, setExperiences] = useState([]);
  const [tags, setTags] = useState([]);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Form persistence - combines newExperience and tags
  const formData = { ...newExperience, experience_type: tags };
  const setFormData = (data) => {
    const { experience_type, ...expData } = data;
    setNewExperience(expData);
    if (experience_type) {
      setTags(experience_type);
    }
  };

  const persistence = useFormPersistence(
    'new-experience-form',
    formData,
    setFormData,
    {
      enabled: true,
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      debounceMs: 1000,
      onRestore: (savedData, age) => {
        // Show toast notification
        success(
          `Form data restored from ${Math.floor(age / 60000)} minutes ago. ` +
          `You can continue editing or clear the form to start fresh.`,
          { duration: 8000 }
        );
      }
    }
  );

  function handleChange(e) {
    let experience = { ...newExperience };
    setNewExperience(
      Object.assign(experience, { [e.target.name]: e.target.value })
    );
  }

  function handleTagsChange(newTags) {
    setTags(newTags);
    setNewExperience({
      ...newExperience,
      experience_type: newTags // Store as array, not comma-separated string
    });
  }
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    // Frontend duplicate check
    if (newExperience.name && isDuplicateName(experiences, newExperience.name)) {
      setError(`An experience named "${newExperience.name}" already exists. Please choose a different name.`);
      return;
    }

    try {
      setNewExperience(
        Object.assign(newExperience, {
          destination: destinations.find(
            (destination) =>
              destination.name === newExperience.destination.split(", ")[0]
          )._id,
        })
      );
      let experience = await createExperience(newExperience);
      addExperience(experience); // Instant UI update!

      // Clear saved form data on success
      persistence.clear();

      success('Experience created!');
      navigate(`/experiences/${experience._id}`);
    } catch (err) {
      const errorMsg = handleError(err, { context: 'Create experience' });
      // Check if it's an email verification error
      if (err.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
        setError(err.response.data.error || lang.en.alert.emailNotVerifiedMessage);
      }
      // Check if it's a duplicate error from backend
      else if (err.message && err.message.includes('already exists')) {
        setError(err.message);
      } else {
        setError(errorMsg);
      }
    }
  }
  useEffect(() => {
    if (destData) setDestinations(destData);
    if (expData) setExperiences(expData);
    document.title = `New Experience - Biensperience`;
  }, [destData, expData]);
  return (
    <>
      <div className="row fade-in">
        <div className="col-md-6 fade-in">
          <h1 className="my-4 h fade-in">{lang.en.heading.createExperience}</h1>
        </div>
      </div>

      {error && (
        <Alert
          type="danger"
          className="mb-4"
        >
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

      <div className="row my-4 fade-in">
        <div className="col-12">
          <Form onSubmit={handleSubmit} className="new-experience-form">
            <FormField
              name="name"
              label={lang.en.label.title}
              type="text"
              value={newExperience.name || ''}
              onChange={handleChange}
              placeholder={lang.en.placeholder.experienceName}
              required
              tooltip={lang.en.helper.nameRequired}
              tooltipPlacement="top"
            />

            <div className="mb-4">
              <FormField
                name="destination"
                label={lang.en.label.destinationLabel}
                type="text"
                value={newExperience.destination || ''}
                onChange={handleChange}
                placeholder={lang.en.placeholder.destination}
                required
                tooltip={`${lang.en.helper.destinationRequired}${lang.en.helper.createNewDestination}`}
                tooltipPlacement="top"
                autoComplete="off"
                list="destination_list"
                className="mb-2"
              />
              <datalist type="text" id="destination_list">
                {destinations.length &&
                  destinations.map((destination, index) => {
                    return (
                      <option key={index} value={`${destination.name}, ${destination.country}`} />
                    );
                  })}
              </datalist>
              <small className="form-text text-muted">
                {lang.en.helper.destinationRequired}
                <Link to="/destinations/new" className="ms-1">
                  {lang.en.helper.createNewDestination}
                </Link>
              </small>
            </div>

            <FormField
              name="map_location"
              label={lang.en.label.address}
              type="text"
              value={newExperience.map_location || ''}
              onChange={handleChange}
              placeholder={lang.en.placeholder.address}
              tooltip={lang.en.helper.addressOptional}
              tooltipPlacement="top"
            />

            <div className="mb-4">
              <Form.Label htmlFor="experience_type">
                {lang.en.label.experienceTypes}
                <FormTooltip 
                  content={lang.en.helper.experienceTypesOptional}
                  placement="top"
                />
              </Form.Label>
              <TagInput
                tags={tags}
                onChange={handleTagsChange}
                placeholder={lang.en.placeholder.experienceType}
              />
            </div>

            <div className="mb-4">
              <Form.Label>
                Photos
                <FormTooltip 
                  content={lang.en.helper.photosOptional}
                  placement="top"
                />
              </Form.Label>
              <ImageUpload data={newExperience} setData={setNewExperience} />
            </div>

            <div className="row mb-4">
              <div className="col-md-6 mb-3 mb-md-0">
                <FormField
                  name="max_planning_days"
                  label={lang.en.label.planningDays}
                  type="number"
                  value={newExperience.max_planning_days || ''}
                  onChange={handleChange}
                  placeholder={lang.en.placeholder.planningDays}
                  min="1"
                  tooltip={lang.en.helper.planningDaysOptional}
                  tooltipPlacement="top"
                  append="days"
                />
              </div>

              <div className="col-md-6">
                <FormField
                  name="cost_estimate"
                  label={lang.en.label.costEstimate}
                  type="number"
                  value={newExperience.cost_estimate || ''}
                  onChange={handleChange}
                  placeholder={lang.en.placeholder.costEstimate}
                  min="0"
                  tooltip={lang.en.helper.costEstimateOptional}
                  tooltipPlacement="top"
                  prepend="$"
                />
              </div>
            </div>

            <div className="d-flex justify-content-end mt-4">
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                aria-label={lang.en.button.createExperience}
              >
                {lang.en.button.createExperience}
              </button>
            </div>
          </Form>
        </div>
      </div>
    </>
  );
}
