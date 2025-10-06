import HeroBanner from "../../components/HeroBanner/HeroBanner";
import DestinationCard from "../../components/DestinationCard/DestinationCard";
import ExperienceCard from "../../components/ExperienceCard/ExperienceCard";
import PageMeta from "../../components/PageMeta/PageMeta";

export default function AppHome({ experiences, destinations, user, updateData }) {
  return (
    <>
      <PageMeta
        title="Plan your next adventure!"
        description="Discover and plan amazing travel experiences worldwide. Browse curated destinations, create your travel bucket list, and organize your adventures with Biensperience."
        keywords="travel planning, adventure, destinations, experiences, travel bucket list, trip planner, world travel, tourism"
        ogTitle="Biensperience - Plan Your Next Adventure"
        ogDescription="Discover curated travel experiences and destinations. Start planning your perfect adventure today with our comprehensive travel planning platform."
      />
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
