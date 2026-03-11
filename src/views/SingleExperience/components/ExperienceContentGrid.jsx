/**
 * ExperienceContentGrid Component
 *
 * Displays the main content grid for a single experience with consistent layout.
 * Encapsulates the two-column layout with hero, content cards, and sidebar.
 * Designed to match SingleDestination's grid pattern for consistency.
 */

import { FaRegImage, FaHeart, FaCalendarAlt, FaDollarSign, FaClock, FaStar } from 'react-icons/fa';
import { SkeletonLoader, Breadcrumb, Row, Col } from '../../../components/design-system';
import { Box, Flex } from '@chakra-ui/react';

/**
 * @param {Object} props
 * @param {Object} props.experience - Experience data
 * @param {boolean} props.isLoading - Whether the component is in loading state
 * @param {React.ReactNode} props.heroContent - Content for the hero section
 * @param {React.ReactNode} props.tagsContent - Content for the tags section
 * @param {React.ReactNode} props.titleContent - Content for the title section
 * @param {React.ReactNode} props.mainContent - Main column content (overview, plan items)
 * @param {React.ReactNode} props.sidebarContent - Sidebar column content
 * @param {number} props.photoCount - Number of photos
 * @param {Function} props.onPhotoButtonClick - Callback when photo button is clicked
 */
export default function ExperienceContentGrid({
  experience,
  isLoading = false,
  heroContent,
  tagsContent,
  titleContent,
  mainContent,
  sidebarContent,
  photoCount = 0,
  onPhotoButtonClick
}) {
  // Loading skeleton state
  if (isLoading) {
    return <ExperienceContentGridSkeleton />;
  }

  if (!experience) {
    return null;
  }

  return (
    <>
      {/* Breadcrumb Navigation */}
      <Breadcrumb
        items={
          experience.destination && experience.destination.name
            ? [{ label: experience.destination.name, href: `/destinations/${experience.destination._id}` }]
            : []
        }
        currentPage={experience.name}
        backTo={experience.destination ? `/destinations/${experience.destination._id}` : "/"}
        backLabel={experience.destination ? experience.destination.name : "Home"}
      />

      <Row>
        {/* Main Content Column (8 cols on lg+) */}
        <Col lg={8}>
          {/* Hero Image Section */}
          <Box borderRadius="xl" overflow="hidden" mb={{ base: "4", lg: "6" }} h={{ base: "300px", lg: "450px" }} bg="bg.muted" position="relative" css={{ '& img': { width: '100%', height: '100%', objectFit: 'cover' }, '&::after': { content: "''", position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%', background: 'linear-gradient(to top, rgba(0,0,0,0.3), transparent)', pointerEvents: 'none' } }}>
            {heroContent}
            <Box as="button"
              type="button"
              css={{ position: 'absolute', right: '12px', bottom: '12px', background: 'rgba(255,255,255,0.06)', border: '2px solid rgba(255,255,255,0.9)', color: 'white', minWidth: '44px', height: '44px', padding: '0 var(--space-3)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)', cursor: 'pointer', zIndex: 5, backdropFilter: 'blur(4px)', transition: 'transform 0.15s ease, box-shadow 0.15s ease', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 6px 18px rgba(0,0,0,0.35)' }, '&:focus': { outline: '2px solid var(--color-primary)', outlineOffset: '2px' }, '& svg': { fontSize: '1.125rem' }, '@media (max-width: 768px)': { right: '8px', bottom: '8px', padding: '0 var(--space-2)' } }}
              onClick={onPhotoButtonClick}
              aria-label={photoCount > 0 ? `View ${photoCount} photo${photoCount !== 1 ? 's' : ''}` : "Add photos"}
            >
              <FaRegImage />
              {photoCount > 0 && (
                <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>{photoCount}</span>
              )}
            </Box>
          </Box>

          {/* Tags Section */}
          {tagsContent && (
            <Flex gap="2" mb="3" flexWrap="wrap" css={{ '@media (max-width: 991px)': { justifyContent: 'center' } }}>
              {tagsContent}
            </Flex>
          )}

          {/* Title Section */}
          {titleContent && (
            <Box mb="6" css={{ '@media (max-width: 991px)': { textAlign: 'center' } }}>
              {titleContent}
            </Box>
          )}

          {/* Main Content (Overview, Plan Items, etc.) */}
          {mainContent}
        </Col>

        {/* Sidebar Column (4 cols on lg+) */}
        <Col lg={4}>
          <Box position={{ base: "relative", lg: "sticky" }} top={{ lg: "6" }} mb="6" css={{ '@media (max-width: 991px)': { display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' } }}>
            {sidebarContent}
          </Box>
        </Col>
      </Row>
    </>
  );
}

/**
 * Skeleton loader for ExperienceContentGrid
 * Provides accurate loading state that matches the actual layout
 */
export function ExperienceContentGridSkeleton() {
  return (
    <>
      {/* Breadcrumb Skeleton */}
      <Breadcrumb loading />

      <Row>
        {/* Main Content Column */}
        <Col lg={8}>
          {/* Hero Image Skeleton */}
          <Box borderRadius="xl" overflow="hidden" mb={{ base: "4", lg: "6" }} h={{ base: "300px", lg: "450px" }} bg="bg.muted" position="relative" css={{ '& img': { width: '100%', height: '100%', objectFit: 'cover' }, '&::after': { content: "''", position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%', background: 'linear-gradient(to top, rgba(0,0,0,0.3), transparent)', pointerEvents: 'none' } }}>
            <SkeletonLoader
              variant="rectangle"
              width="100%"
              height="100%"
              style={{ position: 'absolute', top: 0, left: 0 }}
            />
          </Box>

          {/* Tags Skeleton */}
          <Flex gap="2" mb="3" flexWrap="wrap" css={{ '@media (max-width: 991px)': { justifyContent: 'center' } }}>
            <SkeletonLoader variant="rectangle" width="80px" height="28px" style={{ borderRadius: 'var(--radius-full)' }} />
            <SkeletonLoader variant="rectangle" width="100px" height="28px" style={{ borderRadius: 'var(--radius-full)' }} />
            <SkeletonLoader variant="rectangle" width="70px" height="28px" style={{ borderRadius: 'var(--radius-full)' }} />
          </Flex>

          {/* Title Section Skeleton */}
          <Box mb="6" css={{ '@media (max-width: 991px)': { textAlign: 'center' } }}>
            <SkeletonLoader variant="text" width="70%" height="40px" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
              <SkeletonLoader variant="circle" width="20px" height="20px" />
              <SkeletonLoader variant="text" width="200px" height="20px" />
            </div>
          </Box>

          {/* Overview Card Skeleton */}
          <Box bg="bg" border="1px solid" borderColor="border" borderRadius="lg" mb="6" overflow="visible">
            <Box p={{ base: "4", lg: "6" }}>
              <SkeletonLoader variant="text" width="120px" height="24px" style={{ marginBottom: 'var(--space-4)' }} />
              <SkeletonLoader variant="text" width="100%" height="16px" style={{ marginBottom: 'var(--space-2)' }} />
              <SkeletonLoader variant="text" width="95%" height="16px" style={{ marginBottom: 'var(--space-2)' }} />
              <SkeletonLoader variant="text" width="80%" height="16px" style={{ marginBottom: 'var(--space-2)' }} />
              <SkeletonLoader variant="text" width="60%" height="16px" />
            </Box>
          </Box>

          {/* Plan Items Card Skeleton */}
          <Box bg="bg" border="1px solid" borderColor="border" borderRadius="lg" mb="6" overflow="visible">
            <Box p={{ base: "4", lg: "6" }}>
              {/* Tabs Skeleton */}
              <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-border-light)', paddingBottom: 'var(--space-3)' }}>
                <SkeletonLoader variant="rectangle" width="100px" height="36px" style={{ borderRadius: 'var(--radius-md)' }} />
                <SkeletonLoader variant="rectangle" width="80px" height="36px" style={{ borderRadius: 'var(--radius-md)' }} />
              </div>

              {/* Plan Items Skeleton */}
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3)', borderBottom: '1px solid var(--color-border-light)' }}>
                  <SkeletonLoader variant="circle" width="24px" height="24px" />
                  <div style={{ flex: 1 }}>
                    <SkeletonLoader variant="text" width="70%" height="18px" />
                    <SkeletonLoader variant="text" width="40%" height="14px" style={{ marginTop: 'var(--space-1)' }} />
                  </div>
                  <SkeletonLoader variant="rectangle" width="60px" height="28px" style={{ borderRadius: 'var(--radius-sm)' }} />
                </div>
              ))}
            </Box>
          </Box>
        </Col>

        {/* Sidebar Column */}
        <Col lg={4}>
          <Box position={{ base: "relative", lg: "sticky" }} top={{ lg: "6" }} mb="6" css={{ '@media (max-width: 991px)': { display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' } }}>
            <Box bg="bg.muted" border="1px solid" borderColor="border" borderRadius="lg" p={{ base: "4", lg: "6" }} w={{ base: "100%", lg: "auto" }}>
              {/* Sidebar Title Skeleton */}
              <SkeletonLoader variant="text" width="140px" height="24px" style={{ marginBottom: 'var(--space-4)' }} />

              {/* Date Picker Skeleton */}
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <SkeletonLoader variant="text" width="80px" height="14px" style={{ marginBottom: 'var(--space-2)' }} />
                <SkeletonLoader variant="rectangle" width="100%" height="44px" style={{ borderRadius: 'var(--radius-md)' }} />
              </div>

              {/* Details List Skeleton */}
              <Flex direction="column" gap={{ base: "3", lg: "4" }} mb={{ base: "4", lg: "6" }}>
                {[1, 2, 3, 4].map((i) => (
                  <Box key={i} css={{ '@media (max-width: 991px)': { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' } }}>
                    <SkeletonLoader variant="text" width="80px" height="14px" style={{ marginBottom: 'var(--space-1)' }} />
                    <SkeletonLoader variant="text" width="120px" height="20px" />
                  </Box>
                ))}
              </Flex>

              {/* Action Buttons Skeleton */}
              <Flex direction="column" gap={{ base: "2", lg: "3" }} css={{ '@media (max-width: 991px)': { alignItems: 'center', width: '100%' } }}>
                <SkeletonLoader variant="rectangle" width="100%" height="44px" style={{ borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-3)' }} />
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <SkeletonLoader variant="rectangle" width="100%" height="40px" style={{ borderRadius: 'var(--radius-md)' }} />
                  <SkeletonLoader variant="rectangle" width="44px" height="40px" style={{ borderRadius: 'var(--radius-md)', flexShrink: 0 }} />
                </div>
              </Flex>
            </Box>
          </Box>
        </Col>
      </Row>
    </>
  );
}

/**
 * Stats bar component for experience metrics
 * Similar to SingleDestination's stats bar
 */
export function ExperienceStatsBar({
  planCount = 0,
  favoriteCount = 0,
  photoCount = 0,
  planItemCount = 0
}) {
  const stats = [
    { icon: FaCalendarAlt, value: planCount, label: planCount === 1 ? 'Plan' : 'Plans', show: planCount > 0 },
    { icon: FaHeart, value: favoriteCount, label: favoriteCount === 1 ? 'Favorite' : 'Favorites', show: favoriteCount > 0 },
    { icon: FaRegImage, value: photoCount, label: photoCount === 1 ? 'Photo' : 'Photos', show: photoCount > 0 },
    { icon: FaStar, value: planItemCount, label: planItemCount === 1 ? 'Activity' : 'Activities', show: planItemCount > 0 }
  ].filter(s => s.show);

  if (stats.length === 0) return null;

  return (
    <Flex flexWrap="wrap" gap={{ base: "3", lg: "4" }} py={{ base: "3", lg: "4" }} px={{ base: "4", lg: "6" }} bg="bg.muted" borderRadius="lg" mb={{ base: "4", lg: "6" }} border="1px solid" borderColor="border" css={{ '@media (max-width: 768px)': { justifyContent: 'center' } }}>
      {stats.map((stat, index) => (
        <Flex key={index} alignItems="center" gap="2" pr="4" css={{ borderRight: '1px solid var(--color-border-light)', '&:last-child': { borderRight: 'none', paddingRight: 0 }, '@media (max-width: 768px)': { flex: '1 1 40%', justifyContent: 'center', borderRight: 'none', paddingRight: 0 } }}>
          <stat.icon style={{ color: 'var(--color-primary)', fontSize: 'var(--font-size-lg)', flexShrink: 0 }} />
          <span style={{ fontWeight: 'var(--font-weight-semibold)', fontSize: 'var(--font-size-lg)', color: 'var(--color-text-primary)' }}>{stat.value}</span>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{stat.label}</span>
        </Flex>
      ))}
    </Flex>
  );
}
