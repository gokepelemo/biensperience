import "./EditExperience.css";
import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { updateExperience, showExperience } from "../../utilities/experiences-api";
import { getDestinations } from "../../utilities/destinations-api";
import { lang } from "../../lang.constants";
import ImageUpload from "../../components/ImageUpload/ImageUpload";
import TagInput from "../../components/TagInput/TagInput";
import { handleError } from "../../utilities/error-handler";

export default function EditExperience({ user, updateData }) {
  const { experienceId } = useParams();
  const [experience, setExperience] = useState(null);
  const [destinations, setDestinations] = useState([]);
  const [tags, setTags] = useState([]);
  const [originalExperience, setOriginalExperience] = useState(null);
  const [changes, setChanges] = useState({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchData() {
      try {
        const [experienceData, destinationsData] = await Promise.all([
          showExperience(experienceId),
          getDestinations()
        ]);

        // Check if user is the owner
        if (!experienceData.user || experienceData.user._id !== user._id) {
          setError("You are not authorized to edit this experience.");
          setLoading(false);
          return;
        }

        setExperience(experienceData);
        setOriginalExperience(experienceData);
        setDestinations(destinationsData);

        // Set tags from experience_type
        if (experienceData.experience_type) {
          const experienceTags = experienceData.experience_type.split(',').map(tag => tag.trim());
          setTags(experienceTags);
        }

        setLoading(false);
      } catch (err) {
        handleError(err, { context: 'Loading experience for edit' });
        navigate('/experiences');
      }
    }

    if (user && experienceId) {
      fetchData();
    }
  }, [experienceId, user, navigate]);

  function handleChange(e) {
    const { name, value } = e.target;
    const updatedExperience = { ...experience, [name]: value };

    // Track changes
    const newChanges = { ...changes };
    if (originalExperience && originalExperience[name] !== value) {
      newChanges[name] = { from: originalExperience[name], to: value };
    } else {
      delete newChanges[name];
    }

    setExperience(updatedExperience);
    setChanges(newChanges);
  }

  function handleTagsChange(newTags) {
    setTags(newTags);
    const experienceType = newTags.join(", ");
    const updatedExperience = { ...experience, experience_type: experienceType };

    // Track changes
    const newChanges = { ...changes };
    if (originalExperience && originalExperience.experience_type !== experienceType) {
      newChanges.experience_type = { from: originalExperience.experience_type, to: experienceType };
    } else {
      delete newChanges.experience_type;
    }

    setExperience(updatedExperience);
    setChanges(newChanges);
  }

  function handleDestinationChange(selectedDestination) {
    const destination = destinations.find(d => d.name === selectedDestination.split(", ")[0]);
    if (destination) {
      const updatedExperience = { ...experience, destination: destination._id };

      // Track changes
      const newChanges = { ...changes };
      if (originalExperience && originalExperience.destination !== destination._id) {
        newChanges.destination = { from: originalExperience.destination, to: destination._id };
      } else {
        delete newChanges.destination;
      }

      setExperience(updatedExperience);
      setChanges(newChanges);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (Object.keys(changes).length === 0) {
      setError("No changes detected.");
      return;
    }

    try {
      await updateExperience(experienceId, experience);
      updateData && updateData();
      navigate(`/experiences/${experienceId}`);
    } catch (err) {
      handleError(err, { context: 'Update experience' });
    }
  }

  function handleConfirmUpdate() {
    setShowConfirmModal(true);
  }

  async function confirmUpdate() {
    await handleSubmit({ preventDefault: () => {} });
  }

  if (loading) {
    return (
      <div className="container mt-5">
        <div className="row justify-content-center">
          <div className="col-md-6 text-center">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !experience) {
    return (
      <div className="container mt-5">
        <div className="alert alert-danger">
          {error || "Experience not found or you don't have permission to edit it."}
        </div>
        <div className="text-center mt-3">
          <Link to={`/experiences/${experienceId}`} className="btn btn-primary">
            Back to Experience
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="container mt-5">
        <div className="row justify-content-center">
          <div className="col-md-8">
            <div className="card shadow">
              <div className="card-header bg-primary text-white">
                <h2 className="mb-0">{lang.en.heading.editExperience}</h2>
              </div>
              <div className="card-body">
                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label htmlFor="name" className="form-label">
                      {lang.en.label.title}
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="name"
                      name="name"
                      value={experience.name || ''}
                      onChange={handleChange}
                      required
                    />
                    <div className="form-text">
                      {lang.en.helper.nameRequired}
                    </div>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="destination" className="form-label">
                      {lang.en.label.destinationLabel}
                    </label>
                    <select
                      className="form-select"
                      id="destination"
                      name="destination"
                      value={experience.destination ? `${destinations.find(d => d._id === experience.destination)?.name}, ${destinations.find(d => d._id === experience.destination)?.country}` : ''}
                      onChange={(e) => handleDestinationChange(e.target.value)}
                      required
                    >
                      <option value="">{lang.en.placeholder.destination}</option>
                      {destinations.map(destination => (
                        <option key={destination._id} value={`${destination.name}, ${destination.country}`}>
                          {destination.name}, {destination.country}
                        </option>
                      ))}
                    </select>
                    <div className="form-text">
                      {lang.en.helper.destinationRequired}
                      <Link to="/destinations/new" className="ms-1">
                        {lang.en.helper.createNewDestination}
                      </Link>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="experience_type" className="form-label">
                      {lang.en.label.experienceTypes}
                    </label>
                    <TagInput
                      tags={tags}
                      onChange={handleTagsChange}
                      placeholder={lang.en.placeholder.experienceType}
                    />
                    <div className="form-text">
                      {lang.en.helper.experienceTypesOptional}
                    </div>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="map_location" className="form-label">
                      Address
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="map_location"
                      name="map_location"
                      value={experience.map_location || ''}
                      onChange={handleChange}
                      placeholder={lang.en.placeholder.address}
                    />
                    <div className="form-text">
                      {lang.en.helper.photoOptional}
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label htmlFor="cost_estimate" className="form-label">
                        {lang.en.label.costEstimate}
                      </label>
                      <input
                        type="number"
                        className="form-control"
                        id="cost_estimate"
                        name="cost_estimate"
                        value={experience.cost_estimate || ''}
                        onChange={handleChange}
                        placeholder={lang.en.placeholder.costEstimate}
                        min="0"
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label htmlFor="max_planning_days" className="form-label">
                        {lang.en.label.planningDays}
                      </label>
                      <input
                        type="number"
                        className="form-control"
                        id="max_planning_days"
                        name="max_planning_days"
                        value={experience.max_planning_days || ''}
                        onChange={handleChange}
                        placeholder={lang.en.placeholder.planningDays}
                        min="1"
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <ImageUpload
                      data={experience}
                      setData={setExperience}
                    />
                  </div>

                  {error && (
                    <div className="alert alert-danger">
                      {error}
                    </div>
                  )}

                  <div className="d-flex justify-content-between">
                    <Link to={`/experiences/${experienceId}`} className="btn btn-secondary">
                      {lang.en.button.cancel}
                    </Link>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleConfirmUpdate}
                      disabled={Object.keys(changes).length === 0}
                    >
                      {lang.en.button.confirmUpdate}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showConfirmModal && (
        <div className="modal fade show d-block" tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{lang.en.modal.confirmExperienceUpdate}</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowConfirmModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <p>{lang.en.modal.confirmUpdateReview}</p>
                <ul className="list-group">
                  {Object.entries(changes).map(([field, change]) => (
                    <li key={field} className="list-group-item">
                      <strong>{field}:</strong> {change.from || 'None'} → {change.to || 'None'}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowConfirmModal(false)}
                >
                  {lang.en.button.cancel}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={confirmUpdate}
                >
                  {lang.en.button.updateExperience}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}