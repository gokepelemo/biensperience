import "./ExperiencesByTag.css";
import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import ExperienceCard from "../../components/ExperienceCard/ExperienceCard";
import PageMeta from "../../components/PageMeta/PageMeta";
import { createUrlSlug } from "../../utilities/url-utils";
import * as experiencesAPI from "../../utilities/experiences-api";

export default function ExperiencesByTag({
  experiences,
  user,
  setUser,
  updateData
}) {
  const { tagName } = useParams();
  const [actualTagName, setActualTagName] = useState("");

  // Filter experiences by tag
  const filteredExperiences = useMemo(() => {
    if (!experiences || !tagName) return [];

    return experiences.filter(experience => {
      if (!experience.experience_type) return false;

      // Handle different formats of experience_type
      let tags = [];
      if (Array.isArray(experience.experience_type)) {
        // Flatten array - some old data has ["Tag1, Tag2"] instead of ["Tag1", "Tag2"]
        tags = experience.experience_type.flatMap(item =>
          typeof item === 'string' && item.includes(',')
            ? item.split(',').map(tag => tag.trim())
            : item
        );
      } else if (typeof experience.experience_type === 'string') {
        tags = experience.experience_type.split(',').map(tag => tag.trim());
      } else {
        return false;
      }

      return tags.some(tag => createUrlSlug(tag) === tagName);
    });
  }, [experiences, tagName]);

  // Fetch the actual tag name from the database
  useEffect(() => {
    async function fetchTagName() {
      try {
        const response = await experiencesAPI.getTagName(tagName);
        setActualTagName(response.tagName || tagName);
      } catch (error) {
        // If the API call fails, fall back to the URL slug
        console.error('Error fetching tag name:', error);
        setActualTagName(tagName);
      }
    }

    if (tagName) {
      fetchTagName();
    }
  }, [tagName]);

  // Derived value - no need for state
  const displayTagName = actualTagName || tagName;

  return (
    <>
      <PageMeta
        title={`Experiences tagged ${displayTagName}`}
        description={`Discover ${filteredExperiences.length > 0 ? filteredExperiences.length : ''} travel experiences tagged as ${displayTagName}. Find unique ${displayTagName} adventures and activities around the world.`}
        keywords={`${displayTagName}, travel experiences, ${displayTagName} activities, ${displayTagName} adventures, travel planning, tourism`}
        ogTitle={`${displayTagName} Travel Experiences`}
        ogDescription={`Browse our collection of ${displayTagName} experiences${filteredExperiences.length > 0 ? `. ${filteredExperiences.length} curated experiences available` : ' from around the world'}.`}
      />
      <div className="row fade-in">
        <div className="col-md-6 fade-in">
          <h1 className="my-4 h fade-in">Experiences tagged {displayTagName}</h1>
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
              <h5>No experiences found with tag "{displayTagName}"</h5>
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
