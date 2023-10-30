import "./NewExperience.css";
import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createExperience } from "../../utilities/experiences-api";
import { getDestinations } from "../../utilities/destinations-api";
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
      <h1>New Experience</h1>
      <form onSubmit={handleSubmit} className="newExperience">
        <label>Name</label>
        <span>
        <input
          type="text"
          name="name"
          id="name"
          onChange={handleChange}
          className="form-control"
          placeholder="e.g. Winery Tour at Lakefront Brewery with a Local in Dallas"
        />
        <small>Required. A descriptive title written in natural language.</small>
        </span>
        <label>Destination</label>
        <span>
        <input
          list="destination_list"
          name="destination"
          onChange={handleChange}
          id="destination"
          className="form-control"
          autoComplete="off"
        />
        <small>Required. Select from one of the destination cities or <Link to="/destinations/new">create a new one</Link>.</small>
        </span>
        <datalist type="text" id="destination_list">
          {destinations.length &&
            destinations.map((destination, index) => {
              return (
                <option key={index} value={`${destination.name}, ${destination.country}`} />
              );
            })}
        </datalist>
        <label>Address</label>
        <span>
        <input
          type="text"
          name="map_location"
          id="map_location"
          onChange={handleChange}
          className="form-control"
        />
        <small>Optional. A specific address to the location if available.</small>
        </span>
        <label>Types</label>
        <span><input
          type="text"
          name="experience_type"
          id="experience_type"
          onChange={handleChange}
          className="form-control"
          placeholder="e.g. Culinary, Winery, Brewery, High Adrenaline"
        /><small>In a comma separated list e.g. Culinary, Winery, Brewery, High Adrenaline</small></span>
        <label>Photo</label>
        <ImageUpload data={newExperience} setData={setNewExperience} />
        <button type="submit" className="btn btn-light">
          Add
        </button>
      </form>
    </>
  );
}
