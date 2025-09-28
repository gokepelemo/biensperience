import HeroBanner from "../../components/HeroBanner/HeroBanner";
import DestinationCard from "../../components/DestinationCard/DestinationCard";
import ExperienceCard from "../../components/ExperienceCard/ExperienceCard";

export default function AppHome({ experiences, destinations, user, updateData }) {
  document.title = `Plan your next adventure! - Biensperience`;
  return (
    <>
      <HeroBanner className="fade-in" />
      <div className="row d-flex justify-content-center align-items-center fade-in">
        <h2 className="my-4 fade-in">Popular Destinations</h2>
        {destinations
          .filter((destination, index) => index <= 7)
          .map((destination, index) => (
            <DestinationCard key={index} destination={destination} updateData={updateData} className="fade-in" />
          ))}
      </div>
      <div className="row d-flex justify-content-center align-items-center fade-in">
        <h2 className="my-4 fade-in">Curated Experiences</h2>
        {experiences
          .filter((experience, index) => index <= 11)
          .map((experience, index) => (
            <ExperienceCard key={index} experience={experience} user={user} updateData={updateData} className="fade-in" />))
          }
      </div>
    </>
  );
}
