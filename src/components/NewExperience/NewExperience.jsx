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

export default function NewExperience({ updateData }) {
  const [newExperience, setNewExperience] = useState({});
  const [destinations, setDestinations] = useState({});
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
    updateData();
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
              <small className="form-text text-muted">
                {lang.en.helper.nameRequired}
              </small>
            </div>

            <div className="mb-4">
              <label htmlFor="destination" className="form-label">
                {lang.en.label.destinationLabel}
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
              <small className="form-text text-muted">
                {lang.en.helper.destinationRequired}
                <Link to="/destinations/new" className="ms-1">
                  {lang.en.helper.createNewDestination}
                </Link>
              </small>
            </div>

            <div className="mb-4">
              <label htmlFor="map_location" className="form-label">
                {lang.en.label.address}
              </label>
              <input
                type="text"
                name="map_location"
                id="map_location"
                onChange={handleChange}
                className="form-control"
                placeholder={lang.en.placeholder.address}
              />
              <small className="form-text text-muted">
                {lang.en.helper.addressOptional}
              </small>
            </div>

            <div className="mb-4">
              <label htmlFor="experience_type" className="form-label">
                {lang.en.label.experienceTypes}
              </label>
              <TagInput
                tags={tags}
                onChange={handleTagsChange}
                placeholder={lang.en.placeholder.experienceType}
              />
              <small className="form-text text-muted">
                {lang.en.helper.experienceTypesOptional}
              </small>
            </div>

            <div className="mb-4">
              <label className="form-label">
                Photo
              </label>
              <ImageUpload data={newExperience} setData={setNewExperience} />
              <small className="form-text text-muted">
                {lang.en.helper.photoOptional}
              </small>
            </div>

            <div className="mb-4">
              <label htmlFor="cost_estimate" className="form-label">
                {lang.en.label.costEstimate}
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
                />
              </div>
              <small className="form-text text-muted">
                Estimated cost in dollars (optional)
              </small>
            </div>

            <div className="mb-4">
              <label htmlFor="max_planning_days" className="form-label">
                {lang.en.label.planningDays}
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
                />
                <span className="input-group-text">days</span>
              </div>
              <small className="form-text text-muted">
                Minimum days needed to plan in advance (optional)
              </small>
            </div>

            <div className="d-flex justify-content-end mt-4">
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                aria-label={lang.en.button.create}
              >
                {lang.en.button.create}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
