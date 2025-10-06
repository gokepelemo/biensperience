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
      experience_type: newTags.join(", ")
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
      <h1>{lang.en.heading.createExperience}</h1>
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="newExperience">
        <span>
        <input
          type="text"
          name="name"
          id="name"
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
          onChange={handleChange}
          className="form-control"
        />
        <small>{lang.en.placeholder.address}</small>
        </span>
        <span>
          <label htmlFor="experience_type">{lang.en.label.experienceTypes}</label>
          <TagInput
            tags={tags}
            onChange={handleTagsChange}
            placeholder={lang.en.placeholder.experienceType}
          />
          <small>{lang.en.helper.experienceTypesOptional}</small>
        </span>
        <span>
        <ImageUpload data={newExperience} setData={setNewExperience} />
        <small>{lang.en.helper.photoOptional}</small>
        </span>
        <button type="submit" className="btn btn-light">
          {lang.en.button.create}
        </button>
      </form>
    </>
  );
}
