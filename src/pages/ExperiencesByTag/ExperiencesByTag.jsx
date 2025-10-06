import "./ExperiencesByTag.css";
import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import ExperienceCard from "../../components/ExperienceCard/ExperienceCard";
import PageMeta from "../../components/PageMeta/PageMeta";
import { createUrlSlug } from "../../utilities/url-utils";

export default function ExperiencesByTag({
  experiences,
  user,
  setUser,
  updateData
}) {
  const { tagName } = useParams();
  const [pageTitle, setPageTitle] = useState(`Experiences tagged ${tagName}`);

  // Filter experiences by tag
  const filteredExperiences = useMemo(() => {
    if (!experiences || !tagName) return [];

    return experiences.filter(experience => {
      if (!experience.experience_type) return false;

      // Handle different formats of experience_type
      let tags = [];
      if (Array.isArray(experience.experience_type)) {
        tags = experience.experience_type;
      } else if (typeof experience.experience_type === 'string') {
        tags = experience.experience_type.split(',').map(tag => tag.trim());
      } else {
        return false;
      }

      return tags.some(tag => createUrlSlug(tag) === tagName);
    });
  }, [experiences, tagName]);

  // Find the original tag name from experiences
  const originalTagName = useMemo(() => {
    if (!experiences || !tagName) return tagName;

    for (const experience of experiences) {
      if (!experience.experience_type) continue;

      let tags = [];
      if (Array.isArray(experience.experience_type)) {
        tags = experience.experience_type;
      } else if (typeof experience.experience_type === 'string') {
        tags = experience.experience_type.split(',').map(tag => tag.trim());
      }

      const matchingTag = tags.find(tag => createUrlSlug(tag) === tagName);
      if (matchingTag) {
        return matchingTag;
      }
    }

    return tagName; // Fallback to normalized name if no match found
  }, [experiences, tagName]);

  useEffect(() => {
    setPageTitle(`Experiences tagged ${originalTagName}`);
  }, [originalTagName]);

  return (
    <>
      <PageMeta
        title={`Experiences tagged ${originalTagName}`}
        description={`Discover ${filteredExperiences.length > 0 ? filteredExperiences.length : ''} travel experiences tagged as ${originalTagName}. Find unique ${originalTagName} adventures and activities around the world.`}
        keywords={`${originalTagName}, travel experiences, ${originalTagName} activities, ${originalTagName} adventures, travel planning, tourism`}
        ogTitle={`${originalTagName} Travel Experiences`}
        ogDescription={`Browse our collection of ${originalTagName} experiences${filteredExperiences.length > 0 ? `. ${filteredExperiences.length} curated experiences available` : ' from around the world'}.`}
      />
      <div className="row fade-in">
        <div className="col-md-6 fade-in">
          <h1 className="my-4 h fade-in">{pageTitle}</h1>
        </div>
        <div className="col-md-6 fade-in d-flex align-items-center justify-content-md-end">
          <Link to="/experiences" className="btn btn-light">
            View All Experiences
          </Link>
        </div>
      </div>

      {filteredExperiences.length > 0 ? (
        <div className="row my-4 fade-in">
          <div className="experiences-list fade-in">
            {filteredExperiences.map((experience) => (
              <ExperienceCard
                experience={experience}
                key={experience._id}
                user={user}
                setUser={setUser}
                updateData={updateData}
                className="fade-in"
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="row my-4 fade-in">
          <div className="col-12">
            <div className="alert alert-info">
              <h5>No experiences found with tag "{originalTagName}"</h5>
              <p>Try browsing all experiences or search for a different tag.</p>
              <Link to="/experiences" className="btn btn-primary mt-2">
                Browse All Experiences
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
