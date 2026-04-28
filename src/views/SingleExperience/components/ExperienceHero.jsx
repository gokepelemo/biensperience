/**
 * ExperienceHero
 *
 * Hero image, type/destination/curator/archived badge pills, and title block
 * for the SingleExperience view. Extracted from SingleExperience.jsx — pure
 * relocation.
 */

import { Box, Flex } from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import { FaMapMarkerAlt, FaRegImage } from 'react-icons/fa';
import { Pill } from '../../../components/design-system';
import { lang } from '../../../lang.constants';
import { idEquals } from '../../../utilities/id-utils';
import { getDefaultPhoto } from '../../../utilities/photo-utils';
import { createUrlSlug } from '../../../utilities/url-utils';
import { hasFeatureFlag } from '../../../utilities/feature-flags';
import { isArchiveUser, isExperienceArchived } from '../../../utilities/system-users';

export default function ExperienceHero({
  experience,
  experienceOwner,
  user,
  navigate,
  heroPhotos,
  openModal,
  setPhotoViewerIndex,
  MODAL_NAMES,
  h1Ref,
}) {
  if (!experience) return null;

  return (
    <>
      {/* Hero Image Section */}
      <Box
        borderRadius="xl"
        overflow="hidden"
        mb={{ base: '4', md: '6' }}
        h={{ base: '300px', md: '450px' }}
        bg="bg.muted"
        position="relative"
        css={{
          '& img': { width: '100%', height: '100%', objectFit: 'cover' },
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '30%',
            background: 'linear-gradient(to top, rgba(0, 0, 0, 0.3), transparent)',
            pointerEvents: 'none',
          },
        }}
      >
        {experience.photos && experience.photos.length > 0 ? (
          <img src={getDefaultPhoto(experience)?.url} alt={experience.name} />
        ) : experience.destination?.photos && experience.destination.photos.length > 0 ? (
          <img src={getDefaultPhoto(experience.destination)?.url} alt={experience.destination.name} />
        ) : (
          <Flex align="center" justify="center" h="100%" color="fg.muted">
            No image available
          </Flex>
        )}
        {/* Hero photo viewer button - opens upload modal when no photos and user can edit */}
        <Flex
          as="button"
          type="button"
          position="absolute"
          right={{ base: '8px', md: '12px' }}
          bottom={{ base: '8px', md: '12px' }}
          bg="rgba(255,255,255,0.06)"
          border="2px solid rgba(255,255,255,0.9)"
          color="white"
          minW="44px"
          h="44px"
          px={{ base: '2', md: '3' }}
          borderRadius="8px"
          align="center"
          justify="center"
          gap="2"
          cursor="pointer"
          zIndex="5"
          backdropFilter="blur(4px)"
          transition="transform 0.15s ease, box-shadow 0.15s ease"
          fontSize="sm"
          fontWeight="medium"
          _hover={{ transform: 'translateY(-2px)', boxShadow: '0 6px 18px rgba(0,0,0,0.35)' }}
          _focus={{ outline: '2px solid var(--color-primary)', outlineOffset: '2px' }}
          onClick={() => {
            const hasExperiencePhotos = experience.photos && experience.photos.length > 0;
            const canEdit = experience.permissions?.some(
              (p) =>
                p.entity === 'user' &&
                (p.type === 'owner' || p.type === 'collaborator') &&
                idEquals(p._id, user?._id)
            );

            if (!hasExperiencePhotos && canEdit) {
              openModal(MODAL_NAMES.PHOTO_UPLOAD);
            } else {
              setPhotoViewerIndex(0);
              openModal(MODAL_NAMES.PHOTO_VIEWER);
            }
          }}
          aria-label={
            heroPhotos.length > 0
              ? `View ${heroPhotos.length} photo${heroPhotos.length !== 1 ? 's' : ''}`
              : 'Add photos'
          }
        >
          <FaRegImage />
          {heroPhotos.length > 0 && (
            <Box as="span" fontSize="sm" fontWeight="medium">
              {heroPhotos.length}
            </Box>
          )}
        </Flex>
      </Box>

      {/* Tags Section */}
      {(experience.experience_type ||
        experience.destination ||
        isExperienceArchived(experience) ||
        (experienceOwner && !isArchiveUser(experienceOwner) && hasFeatureFlag(experienceOwner, 'curator'))) && (
        <Flex gap="2" mb="3" wrap="wrap" justify={{ base: 'center', lg: 'flex-start' }}>
          {/* Curated Experience Tag */}
          {experienceOwner && !isArchiveUser(experienceOwner) && hasFeatureFlag(experienceOwner, 'curator') && (
            <span
              role="button"
              tabIndex={0}
              aria-label={`Curated by ${experienceOwner.name || 'Curator'}. Double-click to view profile.`}
              title={`Curated by ${experienceOwner.name || 'Curator'}`}
              style={{ textDecoration: 'none', cursor: 'pointer' }}
              onDoubleClick={() => navigate(`/profile/${experienceOwner._id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') navigate(`/profile/${experienceOwner._id}`);
              }}
            >
              <Pill
                variant="secondary"
                css={{
                  py: '2',
                  px: '4',
                  borderRadius: 'full',
                  fontSize: 'sm',
                  background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary, #6366f1) 100%)',
                  color: 'white',
                  fontWeight: '500',
                }}
              >
                Curated Experience
              </Pill>
            </span>
          )}
          {/* Archived badge */}
          {isExperienceArchived(experience) && (
            <Pill
              variant="secondary"
              style={{
                padding: 'var(--spacing-2) var(--spacing-4)',
                borderRadius: 'var(--radii-full)',
                fontSize: 'var(--font-sizes-sm)',
                fontWeight: '500',
                background: 'var(--color-text-muted)',
                color: 'white',
              }}
            >
              Archived
            </Pill>
          )}
          {experience.experience_type &&
            (Array.isArray(experience.experience_type)
              ? experience.experience_type.map((type, index) => (
                  <Link key={index} to={`/experience-types/${createUrlSlug(type)}`} style={{ textDecoration: 'none' }}>
                    <Pill
                      variant="secondary"
                      css={{ py: '2', px: '4', borderRadius: 'full', fontSize: 'sm', bg: 'bg.muted', color: 'fg.muted', fontWeight: '500' }}
                    >
                      {type}
                    </Pill>
                  </Link>
                ))
              : typeof experience.experience_type === 'string'
              ? experience.experience_type.split(',').map((type, index) => (
                  <Link
                    key={index}
                    to={`/experience-types/${createUrlSlug(type)}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <Pill
                      variant="secondary"
                      css={{ py: '2', px: '4', borderRadius: 'full', fontSize: 'sm', bg: 'bg.muted', color: 'fg.muted', fontWeight: '500' }}
                    >
                      {type.trim()}
                    </Pill>
                  </Link>
                ))
              : null)}
          {experience.destination && experience.destination.country && (
            <Link to={`/countries/${createUrlSlug(experience.destination.country)}`} style={{ textDecoration: 'none' }}>
              <Pill
                variant="secondary"
                css={{ py: '2', px: '4', borderRadius: 'full', fontSize: 'sm', bg: 'bg.muted', color: 'fg.muted', fontWeight: '500' }}
              >
                {experience.destination.country}
              </Pill>
            </Link>
          )}
        </Flex>
      )}

      {/* Title Section */}
      <Box mb="6" css={{ '@media (max-width: 991px)': { textAlign: 'center' } }}>
        <Box as="h1" ref={h1Ref} fontSize="3xl" fontWeight="bold" color="fg" mb="3" lineHeight="1.2">
          {experience.name}
        </Box>
        {experience.destination && experience.destination.name && (
          <Box
            as="p"
            fontSize="lg"
            color="fg.muted"
            display="inline-flex"
            alignItems="baseline"
            gap="2"
            css={{ '@media (max-width: 991px)': { justifyContent: 'center' } }}
          >
            <FaMapMarkerAlt
              style={{ color: 'var(--color-primary)', flexShrink: 0, position: 'relative', top: '0.15em' }}
            />
            <Link to={`/destinations/${experience.destination._id}`}>
              {experience.destination.name}
              {experience.destination.country ? `, ${experience.destination.country}` : ''}
            </Link>
          </Box>
        )}
      </Box>

      {/* Experience Overview Card */}
      {experience.overview && (
        <Box bg="bg" border="1px solid" borderColor="border" borderRadius="lg" mb="6" overflow="visible">
          <Box p={{ base: '4', md: '6' }}>
            <Box
              as="h2"
              fontSize="xl"
              fontWeight="semibold"
              color="fg"
              mb="4"
              css={{ '@media (max-width: 991px)': { textAlign: 'center' } }}
            >
              {lang.current.label.overview}
            </Box>
            <Box
              as="p"
              fontSize="md"
              color="fg.muted"
              lineHeight="tall"
              css={{ '@media (max-width: 991px)': { textAlign: 'center' } }}
            >
              {experience.overview}
            </Box>
          </Box>
        </Box>
      )}
    </>
  );
}
