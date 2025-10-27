import "./ExperiencesByTag.css";
import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useData } from "../../contexts/DataContext";
import { useApp } from "../../contexts/AppContext";
import ExperienceCard from "../../components/ExperienceCard/ExperienceCard";
import Alert from "../../components/Alert/Alert";
import PageMeta from "../../components/PageMeta/PageMeta";
import PageWrapper from "../../components/PageWrapper/PageWrapper";
import { createUrlSlug } from "../../utilities/url-utils";
import { logger } from "../../utilities/logger";
import * as experiencesAPI from "../../utilities/experiences-api";

export default function ExperiencesByTag() {
  const { tagName } = useParams();
  const { experiences, plans, loading } = useData();
  const { registerH1, clearActionButtons } = useApp();
  const [actualTagName, setActualTagName] = useState("");

  // Register h1 for navbar integration
  useEffect(() => {
    const h1 = document.querySelector('h1');
    if (h1) registerH1(h1);

    return () => clearActionButtons();
  }, [registerH1, clearActionButtons]);

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
        logger.error('Error fetching tag name', { tagName, error: error.message });
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
    <PageWrapper title={`${displayTagName} Experiences`}>
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

      {loading ? (
        <div className="text-center my-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading experiences...</span>
          </div>
        </div>
      ) : filteredExperiences.length > 0 ? (
        <div className="row my-4 fade-in">
          <div className="experiences-list fade-in">
            {filteredExperiences.map((experience) => (
              <ExperienceCard
                experience={experience}
                key={experience._id}
                className="fade-in"
                userPlans={plans}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="row my-4 fade-in">
          <div className="col-12">
            <Alert type="info">
              <h5>No experiences found with tag "{displayTagName}"</h5>
              <p>Try browsing all experiences or search for a different tag.</p>
              <Link to="/experiences" className="btn btn-primary mt-2">
                Browse All Experiences
              </Link>
            </Alert>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
