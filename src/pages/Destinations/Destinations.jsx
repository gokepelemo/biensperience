import "./Destinations.css"
import DestinationCard from "../../components/DestinationCard/DestinationCard" 

export default function Destinations({ destinations }) {
    return (
        <>
        {destinations && (
          <>
            <div className="row">
              <div className="col-md-6">
                <h1 className="my-4 h">
                  Destinations
                </h1>
              </div>
            </div>
            <div className="row my-4">
              <div className="col-md-12 p-3 d-flex flex-wrap justify-content-center align-items-center">
                {destinations.map((destination, index) => <DestinationCard destination={destination} key={index} />)}
              </div>
            </div>
          </>
        )}
      </>
    )
}