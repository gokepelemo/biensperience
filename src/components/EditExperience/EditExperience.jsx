import "./EditExperience.css";
import { useState, useEffect } from "react";
import { useNavigate, Link, useParams } from "react-router-dom";
import { updateExperience, showExperience } from "../../utilities/experiences-api";
import { getDestinations } from "../../utilities/destinations-api";
import ImageUpload from "../../components/ImageUpload/ImageUpload";
import { lang } from "../../lang.constants";

export default function EditExperience({ updateData }) {
  const { experienceId } = useParams();
  const [experience, setExperience] = useState({});
  const [originalExperience, setOriginalExperience] = useState({});
  const [destinations, setDestinations] = useState({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [changes, setChanges] = useState({});
  const navigate = useNavigate();

  function handleChange(e) {
    let updatedExperience = { ...experience };
    setExperience(
      Object.assign(updatedExperience, { [e.target.name]: e.target.value })
    );
  }

  function calculateChanges() {
    const changes = {};
    Object.keys(experience).forEach(key => {
      if (experience[key] !== originalExperience[key]) {
        changes[key] = {
          from: originalExperience[key] || 'Not set',
          to: experience[key] || 'Not set'
        };
      }
    });
    return changes;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const detectedChanges = calculateChanges();
    if (Object.keys(detectedChanges).length === 0) {
      // No changes, just navigate back
      navigate(`/experiences/${experienceId}`);
      return;
    }
    setChanges(detectedChanges);
    setShowConfirmModal(true);
  }

  async function confirmUpdate() {
    try {
      // Convert destination name back to ID if it was changed
      let experienceToUpdate = { ...experience };
      if (experience.destination && typeof experience.destination === 'string' && !experience.destination.match(/^[0-9a-fA-F]{24}$/)) {
        const destination = destinations.find(
          (dest) => dest.name === experience.destination.split(", ")[0]
        );
        if (destination) {
          experienceToUpdate.destination = destination._id;
        }
      } else if (experience.destination && typeof experience.destination === 'object') {
        // Keep the existing destination ID
        experienceToUpdate.destination = experience.destination._id;
      }

      await updateExperience(experienceId, experienceToUpdate);
      navigate(`/experiences/${experienceId}`);
      updateData();
    } catch (err) {
      console.error(err);
    }
    setShowConfirmModal(false);
  }

  useEffect(() => {
    async function loadExperience() {
      try {
        const experienceData = await showExperience(experienceId);
        const destinationData = await getDestinations();

        // Convert destination ID to name for display
        let destinationName = '';
        if (experienceData.destination && destinationData.length) {
          const dest = destinationData.find(d => d._id === experienceData.destination._id || d._id === experienceData.destination);
          if (dest) {
            destinationName = `${dest.name}, ${dest.country}`;
          }
        }

        const experienceWithName = {
          ...experienceData,
          destination: destinationName
        };

        setExperience(experienceWithName);
        setOriginalExperience(experienceWithName);
        setDestinations(destinationData);
        document.title = `Edit Experience - Biensperience`;
      } catch (err) {
        console.error('Failed to load experience:', err);
      }
    }
    loadExperience();
  }, [experienceId]);

  return (
    <>
      <h1>{lang.en.heading.editExperience}</h1>
      <form onSubmit={handleSubmit} className="newExperience">
        <span>
        <input
          type="text"
          name="name"
          id="name"
          value={experience.name || ''}
          onChange={handleChange}
          className="form-control"
          placeholder={lang.en.placeholder.experienceName}
        />
        <small>{lang.en.helper.nameRequired}</small>
        </span>
        <span>
        <input
          list="destination_list"
          name="destination"
          value={experience.destination || ''}
          onChange={handleChange}
          id="destination"
          className="form-control"
          autoComplete="off"
        />
        <small>{lang.en.helper.destinationRequired}<Link to="/destinations/new">{lang.en.helper.createNewDestination}</Link>.</small>
        </span>
        <datalist type="text" id="destination_list">
          {destinations.length &&
            destinations.map((destination, index) => {
              return (
                <option key={index} value={`${destination.name}, ${destination.country}`} />
              );
            })}
        </datalist>
        <span>
        <input
          type="text"
          name="map_location"
          id="map_location"
          value={experience.map_location || ''}
          onChange={handleChange}
          className="form-control"
        />
        <small>{lang.en.placeholder.address}</small>
        </span>
        <span><input
          type="text"
          name="experience_type"
          id="experience_type"
          value={experience.experience_type || ''}
          onChange={handleChange}
          className="form-control"
          placeholder={lang.en.placeholder.experienceType}
        /><small>{lang.en.helper.experienceTypesOptional}</small></span>
        <span>
        <ImageUpload data={experience} setData={setExperience} />
        <small>{lang.en.helper.photoOptional}</small>
        </span>
        <div className="d-flex gap-2 w-100">
          <button type="submit" className="btn btn-light">
            {lang.en.button.updateExperience}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(`/experiences/${experienceId}`)}>
            {lang.en.button.cancel}
          </button>
        </div>
      </form>

      {showConfirmModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{lang.en.modal.confirmExperienceUpdate}</h5>
                <button type="button" className="btn-close" onClick={() => setShowConfirmModal(false)}></button>
              </div>
              <div className="modal-body">
                <p>{lang.en.modal.confirmUpdateReview}</p>
                <div className="changes-summary">
                  {Object.entries(changes).map(([field, change]) => (
                    <div key={field} className="change-item mb-2">
                      <strong>{field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</strong>
                      <div className="text-muted small">From: {change.from}</div>
                      <div className="text-success small">To: {change.to}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowConfirmModal(false)}>
                  {lang.en.button.cancel}
                </button>
                <button type="button" className="btn btn-primary" onClick={confirmUpdate}>
                  {lang.en.button.confirmUpdate}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}