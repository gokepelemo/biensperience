import "./DestinationCard.css"
import { Link } from "react-router-dom";

export default function DestinationCard({ destination, user }) {
  let rand = Math.floor(Math.random() * 50)
  return (
    <div className="destination"><Link to={`/destinations/${destination._id}`}>{destination ? <div className="destinationCard" style={{backgroundImage: `url(https://picsum.photos/200?rand=${rand})`}}><span className="h3 fw-bold">{destination.name}</span></div> : <div className="destinationCard" style={{backgroundImage: `url(https://picsum.photos/200?rand=${rand})`}}><span className="h3 fw-bold">New York</span></div>}</Link></div>
  );
}
