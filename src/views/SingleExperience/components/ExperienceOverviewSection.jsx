/**
 * ExperienceOverviewSection Component
 * Displays experience photos, destination info, experience type tags, description, and map
 */

import PhotoCard from '../../../components/PhotoCard/PhotoCard';
import InfoCard from '../../../components/InfoCard/InfoCard';
import GoogleMap from '../../../components/GoogleMap/GoogleMap';
import TagPill from '../../../components/Pill/TagPill';
import { createUrlSlug } from '../../../utilities/url-utils';
import styles from '../SingleExperience.module.scss';

export default function ExperienceOverviewSection({
  // Experience data
  experience,

  // Language strings
  lang
}) {
  return (
    <div className="row my-4 fade-in">
      {/* Photo Section - Left Column */}
      <div className="col-md-6 p-3 fade-in">
        <div className="mb-4">
          <PhotoCard
            photos={experience.photos}
            photo={experience.photo}
            defaultPhotoIndex={experience.default_photo_index}
            title={experience.name}
            altText={`${experience.name}${
              experience.destination && experience.destination.name
                ? ` in ${experience.destination.name}`
                : ""
            }`}
          />
        </div>
      </div>

      {/* Info Card Section - Right Column */}
      <div className="col-md-6 p-3 fade-in">
        <div className="col-md-12 fade-in">
          <InfoCard
            title={
              !experience.destination || !experience.destination.name ? (
                <div className="loading-skeleton loading-skeleton-text" style={{ width: '70%', height: '1.5rem' }}></div>
              ) : (
                `${lang.en.label.destinationLabel}: ${experience.destination.name}`
              )
            }
            titleLink={
              experience.destination
                ? `/destinations/${experience.destination._id}`
                : null
            }
            sections={[
              experience.experience_type && experience.experience_type.length > 0
                ? {
                    title: lang.en.label.experienceType,
                    content: (
                      <div className="experience-tags-container">
                        {experience.experience_type.map((type) => (
                          <TagPill
                            key={type}
                            className={styles.experienceTagPill}
                            color="primary"
                            size="sm"
                            gradient={true}
                            to={`/experience-types/${createUrlSlug(type)}`}
                          >
                            {type}
                          </TagPill>
                        ))}
                      </div>
                    ),
                  }
                : null,
              experience.overview
                ? {
                    title: lang.en.label.overview,
                    content: <p>{experience.overview}</p>,
                  }
                : null,
            ].filter(Boolean)}
            map={
              !experience.destination || !experience.destination.name ? (
                <div className="loading-skeleton loading-skeleton-rectangle" style={{ width: '100%', height: '300px', borderRadius: 'var(--radius-md)' }}></div>
              ) : (
                <GoogleMap
                  location={`${experience.destination.name}+${experience.destination.country}`}
                  height={300}
                  title={lang.en.helper.map}
                />
              )
            }
          />
        </div>
      </div>
    </div>
  );
}
