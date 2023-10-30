import HeroBanner from "../../components/HeroBanner/HeroBanner";
import DestinationCard from "../../components/DestinationCard/DestinationCard";
import ExperienceCard from "../../components/ExperienceCard/ExperienceCard";

export default function AppHome({ experiences, destinations, user }) {
  document.title = `Plan your next adventure! - Biensperience`;
  return (
    <>
      <HeroBanner />
      <div className="row d-flex justify-content-center align-items-center">
        <h2 className="my-4">Popular Destinations</h2>
        {destinations
          .filter((destination, index) => index <= 7)
          .map((destination, index) => (
            <DestinationCard key={index} destination={destination} />
          ))}
      </div>
      <div className="row d-flex justify-content-center align-items-center">
        <h2 className="my-4">Curated Experiences</h2>
        {experiences
          .filter((experience, index) => index <= 11)
          .map((experience, index) => (
            <ExperienceCard key={index} experience={experience} user={user} />))
          }
      </div>
    </>
  );
}
