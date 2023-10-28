import "./SingleDestination.css";
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { showDestination } from "../../utilities/destinations-api";
import PhotoCard from "../../components/PhotoCard/PhotoCard";

export default function SingleDestination() {
  const [destination, setDestination] = useState({});
  const { destinationId } = useParams();
  useEffect(() => {
    async function getDestination() {
      let destinationData = await showDestination(destinationId);
      setDestination(destinationData);
    }
    getDestination();
  }, [destinationId]);
  function handleAddToFavorites(e) {
    return;
  }
  return (
    <>
      <>
        {destination && (
          <>
            <div className="row destination-detail">
              <div className="col-md-6">
                <h1 className="destinationHeading my-4">
                  {destination.name}, {destination.country}
                </h1>
              </div>
              <div className="d-flex col-md-6 justify-content-end">
                <button
                  className="btn btn-light my-4"
                  onClick={handleAddToFavorites}
                >
                  ❤️ Add to Favorites
                </button>
              </div>
            </div>
            <div className="row my-4">
              <div className="col-md-6 p-3">{destination && <PhotoCard />}</div>
              <div className="col-md-6 p-3">
                <ul className="list-group destination-detail">
                  <li className="list-group-item list-group-item-secondary fw-bold text-center h5">
                    Popular Experiences
                  </li>
                  <li className="list-group-item list-group-item-secondary"></li>
                  <>
                  <li className="list-group-item list-group-item-secondary fw-bold text-center h5">
                    Travel Tips
                  </li>
                  <li className="list-group-item list-group-item-secondary"></li>
                  </>
                </ul>
              </div>
            </div>
            <div className="row my-2">
              <div className="col-md-12 p-3">
                <h2>Experiences in {destination.name}</h2>
              </div>
            </div>
          </>
        )}
      </>
    </>
  );
}
