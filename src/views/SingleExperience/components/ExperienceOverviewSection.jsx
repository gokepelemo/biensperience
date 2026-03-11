/**
 * ExperienceOverviewSection Component
 * Displays experience photos, destination info, experience type tags, description, and map
 *
 * Wrapped with React.memo to prevent unnecessary re-renders - this component
 * displays mostly static experience content and only needs to re-render when
 * the experience data actually changes.
 */

import { memo } from 'react';
import { Box, Flex } from '@chakra-ui/react';
import PhotoCard from '../../../components/PhotoCard/PhotoCard';
import InfoCard from '../../../components/InfoCard/InfoCard';
import GoogleMap from '../../../components/GoogleMap/GoogleMap';
import TagPill from '../../../components/Pill/TagPill';
import { createUrlSlug } from '../../../utilities/url-utils';

function ExperienceOverviewSection({
  // Experience data
  experience,

  // Language strings
  lang
}) {
  return (
    <Flex flexWrap="wrap" mt="var(--space-4)" mb="var(--space-4)" className="fade-in">
      {/* Photo Section - Left Column */}
      <Box flex={{ base: "0 0 100%", md: "0 0 50%" }} maxW={{ base: "100%", md: "50%" }} p="var(--space-3)" className="fade-in">
        <Box mb="var(--space-4)">
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
        </Box>
      </Box>

      {/* Info Card Section - Right Column */}
      <Box flex={{ base: "0 0 100%", md: "0 0 50%" }} maxW={{ base: "100%", md: "50%" }} p="var(--space-3)" className="fade-in">
        <Box w="100%" className="fade-in">
          <InfoCard
            title={
              !experience.destination || !experience.destination.name ? (
                <div className="loading-skeleton loading-skeleton-text" style={{ width: '70%', height: '1.5rem' }}></div>
              ) : (
                `${lang.current.label.destinationLabel}: ${experience.destination.name}`
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
                    title: lang.current.label.experienceType,
                    content: (
                      <div className="experience-tags-container">
                        {experience.experience_type.map((type) => (
                          <TagPill
                            key={type}
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
                    title: lang.current.label.overview,
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
                  title={lang.current.helper.map}
                />
              )
            }
          />
        </Box>
      </Box>
    </Flex>
  );
}

export default memo(ExperienceOverviewSection);
