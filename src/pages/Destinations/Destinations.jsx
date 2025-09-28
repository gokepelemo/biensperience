import "./Destinations.css";
import { useEffect } from "react";
import DestinationCard from "../../components/DestinationCard/DestinationCard";

export default function Destinations({ destinations }) {
  useEffect(() => {
    document.title = `All Destinations - Biensperience`;
  });
  return (
    <>
      {destinations && (
        <>
          <div className="row fade-in">
            <div className="col-md-6 fade-in">
              <h1 className="my-4 h fade-in">Destinations</h1>
            </div>
          </div>
          <div className="row my-4 fade-in">
            <div className="col-md-12 p-3 d-flex flex-wrap justify-content-center align-items-center fade-in">
              {destinations.map((destination, index) => (
                <DestinationCard destination={destination} key={index} className="fade-in" />
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
