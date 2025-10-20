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

export default function NewExperience() {
  const { destinations: destData, experiences: expData, addExperience } = useData();
  const { success } = useToast();
  const [newExperience, setNewExperience] = useState({});
  const [destinations, setDestinations] = useState([]);
  const [experiences, setExperiences] = useState([]);
  const [tags, setTags] = useState([]);
  const [error, setError] = useState("");
  const navigate = useNavigate();

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
      success('Experience created!');
      navigate(`/experiences/${experience._id}`);
    } catch (err) {
      const errorMsg = handleError(err, { context: 'Create experience' });
      // Check if it's a duplicate error from backend
      if (err.message && err.message.includes('already exists')) {
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
          message={error}
          className="mb-4"
        />
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
              <div className="mt-1">
                <Link to="/destinations/new" className="small">
                  {lang.en.helper.createNewDestination}
                </Link>
              </div>
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
