import "./NewExperience.css";
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createExperience } from "../../utilities/experiences-api";
import { getDestinations } from "../../utilities/destinations-api";
import { lang } from "../../lang.constants";
import ImageUpload from "../../components/ImageUpload/ImageUpload";

export default function NewExperience({ updateData }) {
  const [newExperience, setNewExperience] = useState({});
  const [destinations, setDestinations] = useState({});
  const navigate = useNavigate();
  function handleChange(e) {
    let experience = { ...newExperience };
    setNewExperience(
      Object.assign(experience, { [e.target.name]: e.target.value })
    );
  }
  async function handleSubmit(e) {
    e.preventDefault();
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
      console.error(err);
    }
    updateData();
  }
  useEffect(() => {
    async function updateDestinations() {
      let destinationData = await getDestinations();
      setDestinations(destinationData);
      document.title = `New Experience - Biensperience`;
    }
    updateDestinations();
  }, []);
  return (
    <>
      <h1>{lang.en.heading.createExperience}</h1>
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
        <span><input
          type="text"
          name="experience_type"
          id="experience_type"
          onChange={handleChange}
          className="form-control"
          placeholder={lang.en.placeholder.experienceType}
        /><small>{lang.en.helper.experienceTypesOptional}</small></span>
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
