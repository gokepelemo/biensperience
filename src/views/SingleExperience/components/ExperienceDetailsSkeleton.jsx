/**
 * ExperienceDetailsSkeleton Component
 * Skeleton loader for the Experience Details sidebar to prevent layout shift
 */

import SkeletonLoader from '../../../components/SkeletonLoader/SkeletonLoader';
import { Box, Flex } from '@chakra-ui/react';

export default function ExperienceDetailsSkeleton() {
  return (
    <Box bg="bg.muted" border="1px solid" borderColor="border" borderRadius="lg" p={{ base: "4", lg: "6" }} w={{ base: "100%", lg: "auto" }}>
      <Box as="h3" fontSize={{ base: "xl", lg: "lg" }} fontWeight="semibold" color="fg" mb={{ base: "3", lg: "4" }} css={{ '@media (max-width: 991px)': { textAlign: 'center' } }}>Experience Details</Box>

      {/* Details List Skeleton */}
      <Flex direction="column" gap={{ base: "3", lg: "4" }} mb={{ base: "4", lg: "6" }}>
        {/* Estimated Cost */}
        <Box css={{ '@media (max-width: 991px)': { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' } }}>
          <Box color="fg.muted" fontSize={{ base: "md", lg: "sm" }} mb="1">
            <SkeletonLoader variant="text" width="100px" height="16px" />
          </Box>
          <Box color="fg" fontWeight="medium">
            <SkeletonLoader variant="text" width="80px" height="20px" />
          </Box>
        </Box>

        {/* Planning Time */}
        <Box css={{ '@media (max-width: 991px)': { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' } }}>
          <Box color="fg.muted" fontSize={{ base: "md", lg: "sm" }} mb="1">
            <SkeletonLoader variant="text" width="100px" height="16px" />
          </Box>
          <Box color="fg" fontWeight="medium">
            <SkeletonLoader variant="text" width="60px" height="20px" />
          </Box>
        </Box>

        {/* Destination */}
        <Box css={{ '@media (max-width: 991px)': { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' } }}>
          <Box color="fg.muted" fontSize={{ base: "md", lg: "sm" }} mb="1">
            <SkeletonLoader variant="text" width="80px" height="16px" />
          </Box>
          <Box color="fg" fontWeight="medium">
            <SkeletonLoader variant="text" width="100px" height="20px" />
          </Box>
        </Box>
      </Flex>

      {/* Action Buttons Skeleton */}
      <Flex direction="column" gap={{ base: "2", lg: "3" }} css={{ '@media (max-width: 991px)': { alignItems: 'center', width: '100%' } }}>
        <Flex direction="column" gap="4">
          {/* Primary Button */}
          <SkeletonLoader
            variant="rectangle"
            width="100%"
            height="52px"
            style={{ borderRadius: 'var(--radius-full)' }}
          />
          {/* Secondary Buttons Row */}
          <Flex gap="2">
            <SkeletonLoader
              variant="rectangle"
              width="100%"
              height="44px"
              style={{ borderRadius: 'var(--btn-radius-pill)', flex: 1 }}
            />
            <SkeletonLoader
              variant="rectangle"
              width="60px"
              height="44px"
              style={{ borderRadius: 'var(--btn-radius-pill)' }}
            />
            <SkeletonLoader
              variant="rectangle"
              width="60px"
              height="44px"
              style={{ borderRadius: 'var(--btn-radius-pill)' }}
            />
          </Flex>
        </Flex>
      </Flex>
    </Box>
  );
}
