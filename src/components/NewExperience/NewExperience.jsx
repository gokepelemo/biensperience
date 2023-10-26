import "./NewExperience.css";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createExperience } from "../../utilities/experiences-api";
import { getDestinations } from "../../utilities/destinations-api";

export default function NewExperience() {
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
  }
  useEffect(() => {
    async function updateDestinations() {
      let destinationData = await getDestinations();
      setDestinations(destinationData);
    }
    updateDestinations();
  }, []);
  return (
    <>
      <h1>New Experience</h1>
      <form onSubmit={handleSubmit} className="newExperience">
        <label>Name</label>
        <input
          type="text"
          name="name"
          id="name"
          onChange={handleChange}
          className="form-control"
        />
        <label>Destination</label>
        <input
          list="destination_list"
          name="destination"
          onChange={handleChange}
          id="destination"
          className="form-control"
          autocomplete="off"
        />
        <datalist type="text" id="destination_list">
          {destinations.length &&
            destinations.map((destination, index) => {
              return (
                <option key={index} value={`${destination.name}, ${destination.country}`} />
              );
            })}
        </datalist>
        <label>Address</label>
        <input
          type="text"
          name="map_location"
          id="map_location"
          onChange={handleChange}
          className="form-control"
        />
        <label>Types</label>
        <input
          type="text"
          name="experience_type"
          id="experience_type"
          onChange={handleChange}
          className="form-control"
        />
        <label>Photo</label>
        <input type="file" name="photo" id="photo" className="form-control" />
        <button type="submit" className="btn btn-light">
          Add
        </button>
      </form>
    </>
  );
}
