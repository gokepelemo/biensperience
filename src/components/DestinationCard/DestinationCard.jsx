import "./DestinationCard.css"
import { Link } from "react-router-dom";

export default function DestinationCard({ destination }) {
  return (
    <div className="destination"><Link to="/">{destination ? <div>DestinationCard</div> : <div className="destinationCard" style={{backgroundImage: "url(https://picsum.photos/200)"}}><span className="h3 fw-bold">New York</span></div>}</Link></div>
  );
}
