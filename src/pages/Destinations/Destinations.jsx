import "./Destinations.css"
import DestinationCard from "../../components/DestinationCard/DestinationCard" 

export default function Destinations({ destinations }) {
    return (
        <>
        {destinations && (
          <>
            <div className="row destination-detail">
              <div className="col-md-6">
                <h1 className="destinationsHeading my-4">
                  Destinations
                </h1>
              </div>
            </div>
            <div className="row my-4">
              <div className="col-md-12 p-3">
                {destinations.map((destination, index) => <DestinationCard destination={destination} key={index} />)}
              </div>
            </div>
          </>
        )}
      </>
    )
}