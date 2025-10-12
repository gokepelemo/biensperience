import "./NewExperience.css";
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createExperience, getExperiences } from "../../utilities/experiences-api";
import { getDestinations } from "../../utilities/destinations-api";
import { lang } from "../../lang.constants";
import ImageUpload from "../../components/ImageUpload/ImageUpload";
import TagInput from "../../components/TagInput/TagInput";
import { handleError } from "../../utilities/error-handler";
import { isDuplicateName } from "../../utilities/deduplication";
import { Tooltip } from "bootstrap";

export default function NewExperience({ updateData }) {
  const [newExperience, setNewExperience] = useState({});
  const [destinations, setDestinations] = useState({});
  const [experiences, setExperiences] = useState([]);
  const [tags, setTags] = useState([]);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Initialize Bootstrap tooltips
  useEffect(() => {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new Tooltip(tooltipTriggerEl));
    
    return () => {
      tooltipList.forEach(tooltip => tooltip.dispose());
    };
  }, []);

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
      updateData();
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
    async function updateDestinations() {
      const [destinationData, experienceData] = await Promise.all([
        getDestinations(),
        getExperiences()
      ]);
      setDestinations(destinationData);
      setExperiences(experienceData);
      document.title = `New Experience - Biensperience`;
    }
    updateDestinations();
  }, []);
  return (
    <>
      <div className="row fade-in">
        <div className="col-md-6 fade-in">
          <h1 className="my-4 h fade-in">{lang.en.heading.createExperience}</h1>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger mb-4" role="alert">
          {error}
        </div>
      )}

      <div className="row my-4 fade-in">
        <div className="col-12">
          <form onSubmit={handleSubmit} className="new-experience-form">
            <div className="mb-4">
              <label htmlFor="name" className="form-label">
                {lang.en.label.title}
                <span 
                  className="ms-2 text-info" 
                  data-bs-toggle="tooltip" 
                  data-bs-placement="top" 
                  title={lang.en.helper.nameRequired}
                  style={{ cursor: 'help' }}
                >
                  ℹ️
                </span>
              </label>
              <input
                type="text"
                name="name"
                id="name"
                onChange={handleChange}
                className="form-control"
                placeholder={lang.en.placeholder.experienceName}
                required
              />
            </div>

            <div className="mb-4">
              <label htmlFor="destination" className="form-label">
                {lang.en.label.destinationLabel}
                <span 
                  className="ms-2 text-info" 
                  data-bs-toggle="tooltip" 
                  data-bs-placement="top" 
                  title={`${lang.en.helper.destinationRequired}${lang.en.helper.createNewDestination}`}
                  style={{ cursor: 'help' }}
                >
                  ℹ️
                </span>
              </label>
              <input
                list="destination_list"
                name="destination"
                onChange={handleChange}
                id="destination"
                className="form-control"
                autoComplete="off"
                placeholder={lang.en.placeholder.destination}
                required
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

            <div className="mb-4">
              <label htmlFor="map_location" className="form-label">
                {lang.en.label.address}
                <span 
                  className="ms-2 text-info" 
                  data-bs-toggle="tooltip" 
                  data-bs-placement="top" 
                  title={lang.en.helper.addressOptional}
                  style={{ cursor: 'help' }}
                >
                  ℹ️
                </span>
              </label>
              <input
                type="text"
                name="map_location"
                id="map_location"
                onChange={handleChange}
                className="form-control"
                placeholder={lang.en.placeholder.address}
              />
            </div>

            <div className="mb-4">
              <label htmlFor="experience_type" className="form-label">
                {lang.en.label.experienceTypes}
                <span 
                  className="ms-2 text-info" 
                  data-bs-toggle="tooltip" 
                  data-bs-placement="top" 
                  title={lang.en.helper.experienceTypesOptional}
                  style={{ cursor: 'help' }}
                >
                  ℹ️
                </span>
              </label>
              <TagInput
                tags={tags}
                onChange={handleTagsChange}
                placeholder={lang.en.placeholder.experienceType}
              />
            </div>

            <div className="mb-4">
              <label className="form-label">
                Photos
                <span 
                  className="ms-2 text-info" 
                  data-bs-toggle="tooltip" 
                  data-bs-placement="top" 
                  title={lang.en.helper.photosOptional}
                  style={{ cursor: 'help' }}
                >
                  ℹ️
                </span>
              </label>
              <ImageUpload data={newExperience} setData={setNewExperience} />
            </div>

            <div className="row mb-4">
              <div className="col-md-6 mb-3 mb-md-0">
                <label htmlFor="max_planning_days" className="form-label">
                  {lang.en.label.planningDays}
                  <span 
                    className="ms-2 text-info" 
                    data-bs-toggle="tooltip" 
                    data-bs-placement="top" 
                    title={lang.en.helper.planningDaysOptional}
                    style={{ cursor: 'help' }}
                  >
                    ℹ️
                  </span>
                </label>
                <div className="input-group">
                  <input
                    type="number"
                    className="form-control"
                    id="max_planning_days"
                    name="max_planning_days"
                    onChange={handleChange}
                    placeholder={lang.en.placeholder.planningDays}
                    min="1"
                    style={{ padding: '1rem' }}
                  />
                  <span className="input-group-text">days</span>
                </div>
              </div>

              <div className="col-md-6">
                <label htmlFor="cost_estimate" className="form-label">
                  {lang.en.label.costEstimate}
                  <span 
                    className="ms-2 text-info" 
                    data-bs-toggle="tooltip" 
                    data-bs-placement="top" 
                    title={lang.en.helper.costEstimateOptional}
                    style={{ cursor: 'help' }}
                  >
                    ℹ️
                  </span>
                </label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input
                    type="number"
                    className="form-control"
                    id="cost_estimate"
                    name="cost_estimate"
                    onChange={handleChange}
                    placeholder={lang.en.placeholder.costEstimate}
                    min="0"
                    style={{ padding: '1rem' }}
                  />
                </div>
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
          </form>
        </div>
      </div>
    </>
  );
}
