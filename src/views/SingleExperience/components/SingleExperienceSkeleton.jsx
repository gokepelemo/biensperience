/**
 * Skeleton loader for SingleExperience view
 * Displays a layout-preserving loading state while experience data is fetched
 * Matches the actual SingleExperience layout pixel-perfectly
 */

import SkeletonLoader from '../../../components/SkeletonLoader/SkeletonLoader';
import { Breadcrumb, Container, Row, Col } from '../../../components/design-system';
import { Box, Flex } from '@chakra-ui/react';

export default function SingleExperienceSkeleton() {
  return (
    <Box minH="100vh" py="8" bg="bg">
      <Container>
        {/* Breadcrumb Skeleton */}
        <Breadcrumb loading />

        <Row>
          {/* Main Content Column (8 cols on lg+) */}
          <Col lg={8}>
            {/* Hero Image Skeleton */}
            <Box borderRadius="xl" overflow="hidden" mb={{ base: "4", lg: "6" }} h={{ base: "300px", lg: "450px" }} bg="bg.muted" position="relative" css={{ '& img': { width: '100%', height: '100%', objectFit: 'cover' }, '&::after': { content: "''", position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%', background: 'linear-gradient(to top, rgba(0,0,0,0.3), transparent)', pointerEvents: 'none' } }}>
              <SkeletonLoader
                variant="rectangle"
                width="100%"
                height="100%"
                style={{ position: 'absolute', top: 0, left: 0, borderRadius: 'var(--radius-xl)' }}
              />
              {/* Photo button skeleton */}
              <div
                style={{
                  position: 'absolute',
                  right: '12px',
                  bottom: '12px',
                  width: '60px',
                  height: '44px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '8px'
                }}
              />
            </Box>

            {/* Tags Skeleton */}
            <Flex gap="2" mb="3" flexWrap="wrap" css={{ '@media (max-width: 991px)': { justifyContent: 'center' } }}>
              <SkeletonLoader variant="rectangle" width="120px" height="28px" style={{ borderRadius: 'var(--radius-full)' }} />
              <SkeletonLoader variant="rectangle" width="90px" height="28px" style={{ borderRadius: 'var(--radius-full)' }} />
              <SkeletonLoader variant="rectangle" width="100px" height="28px" style={{ borderRadius: 'var(--radius-full)' }} />
            </Flex>

            {/* Title Section Skeleton */}
            <Box mb="6" css={{ '@media (max-width: 991px)': { textAlign: 'center' } }}>
              <SkeletonLoader variant="text" width="65%" height="42px" />
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                <SkeletonLoader variant="circle" width="18px" height="18px" />
                <SkeletonLoader variant="text" width="180px" height="20px" />
              </div>
            </Box>

            {/* Stats Bar Skeleton */}
            <Flex flexWrap="wrap" gap={{ base: "3", lg: "4" }} p={{ base: "3 4", lg: "4 6" }} bg="bg.muted" borderRadius="lg" mb={{ base: "4", lg: "6" }} border="1px solid" borderColor="border" css={{ '@media (max-width: 768px)': { justifyContent: 'center' } }}>
              {[1, 2, 3].map((i) => (
                <Flex key={i} alignItems="center" gap="2" pr="4" css={{ borderRight: '1px solid var(--color-border-light)', '&:last-child': { borderRight: 'none', paddingRight: 0 }, '@media (max-width: 768px)': { flex: '1 1 40%', justifyContent: 'center', borderRight: 'none', paddingRight: 0 } }}>
                  <SkeletonLoader variant="circle" width="24px" height="24px" />
                  <SkeletonLoader variant="text" width="30px" height="22px" />
                  <SkeletonLoader variant="text" width="60px" height="16px" />
                </Flex>
              ))}
            </Flex>

            {/* Overview Card Skeleton */}
            <Box bg="bg" border="1px solid" borderColor="border" borderRadius="lg" mb="6" overflow="visible">
              <Box p={{ base: "4", lg: "6" }}>
                <SkeletonLoader variant="text" width="100px" height="26px" style={{ marginBottom: 'var(--space-4)' }} />
                <SkeletonLoader variant="text" width="100%" height="18px" style={{ marginBottom: 'var(--space-2)' }} />
                <SkeletonLoader variant="text" width="95%" height="18px" style={{ marginBottom: 'var(--space-2)' }} />
                <SkeletonLoader variant="text" width="88%" height="18px" style={{ marginBottom: 'var(--space-2)' }} />
                <SkeletonLoader variant="text" width="70%" height="18px" />
              </Box>
            </Box>

            {/* Plan Items Card Skeleton */}
            <Box bg="bg" border="1px solid" borderColor="border" borderRadius="lg" mb="6" overflow="visible">
              <Box p={{ base: "4", lg: "6" }}>
                {/* Tabs Skeleton */}
                <div style={{
                  display: 'flex',
                  gap: 'var(--space-3)',
                  marginBottom: 'var(--space-4)',
                  borderBottom: '1px solid var(--color-border-light)',
                  paddingBottom: 'var(--space-3)'
                }}>
                  <SkeletonLoader variant="rectangle" width="110px" height="36px" style={{ borderRadius: 'var(--radius-md)' }} />
                  <SkeletonLoader variant="rectangle" width="85px" height="36px" style={{ borderRadius: 'var(--radius-md)' }} />
                </div>

                {/* Plan Items Skeleton */}
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      padding: 'var(--space-3) 0',
                      borderBottom: i < 5 ? '1px solid var(--color-border-light)' : 'none'
                    }}
                  >
                    <SkeletonLoader variant="circle" width="24px" height="24px" />
                    <div style={{ flex: 1 }}>
                      <SkeletonLoader variant="text" width={`${55 + (i * 5)}%`} height="18px" />
                    </div>
                    <SkeletonLoader variant="rectangle" width="32px" height="32px" style={{ borderRadius: 'var(--radius-sm)' }} />
                  </div>
                ))}
              </Box>
            </Box>
          </Col>

          {/* Sidebar Column (4 cols on lg+) */}
          <Col lg={4}>
            <Box position={{ base: "relative", lg: "sticky" }} top={{ lg: "6" }} mb="6" css={{ '@media (max-width: 991px)': { display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' } }}>
              <Box bg="bg.muted" border="1px solid" borderColor="border" borderRadius="lg" p={{ base: "4", lg: "6" }} w={{ base: "100%", lg: "auto" }}>
                {/* Sidebar Title Skeleton */}
                <SkeletonLoader variant="text" width="150px" height="26px" style={{ marginBottom: 'var(--space-5)' }} />

                {/* Date Picker Section Skeleton */}
                <div style={{ marginBottom: 'var(--space-5)' }}>
                  <SkeletonLoader variant="text" width="90px" height="14px" style={{ marginBottom: 'var(--space-2)' }} />
                  <SkeletonLoader variant="rectangle" width="100%" height="44px" style={{ borderRadius: 'var(--radius-md)' }} />
                </div>

                {/* Details List Skeleton */}
                <Flex direction="column" gap={{ base: "3", lg: "4" }} mb={{ base: "4", lg: "6" }}>
                  {/* Rating */}
                  <Box css={{ '@media (max-width: 991px)': { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' } }}>
                    <SkeletonLoader variant="text" width="50px" height="14px" style={{ marginBottom: 'var(--space-1)' }} />
                    <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                      {[1, 2, 3, 4, 5].map((j) => (
                        <SkeletonLoader key={j} variant="circle" width="18px" height="18px" />
                      ))}
                      <SkeletonLoader variant="text" width="30px" height="18px" style={{ marginLeft: 'var(--space-2)' }} />
                    </div>
                  </Box>

                  {/* Difficulty */}
                  <Box css={{ '@media (max-width: 991px)': { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' } }}>
                    <SkeletonLoader variant="text" width="65px" height="14px" style={{ marginBottom: 'var(--space-1)' }} />
                    <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
                      {[1, 2, 3, 4, 5].map((j) => (
                        <SkeletonLoader key={j} variant="circle" width="12px" height="12px" />
                      ))}
                      <SkeletonLoader variant="text" width="60px" height="16px" style={{ marginLeft: 'var(--space-2)' }} />
                    </div>
                  </Box>

                  {/* Estimated Cost */}
                  <Box css={{ '@media (max-width: 991px)': { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' } }}>
                    <SkeletonLoader variant="text" width="95px" height="14px" style={{ marginBottom: 'var(--space-1)' }} />
                    <SkeletonLoader variant="text" width="80px" height="22px" />
                  </Box>

                  {/* Planning Time */}
                  <Box css={{ '@media (max-width: 991px)': { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' } }}>
                    <SkeletonLoader variant="text" width="90px" height="14px" style={{ marginBottom: 'var(--space-1)' }} />
                    <SkeletonLoader variant="text" width="70px" height="22px" />
                  </Box>
                </Flex>

                {/* Action Buttons Skeleton */}
                <Flex direction="column" gap={{ base: "2", lg: "3" }} css={{ '@media (max-width: 991px)': { alignItems: 'center', width: '100%' } }}>
                  <SkeletonLoader
                    variant="rectangle"
                    width="100%"
                    height="48px"
                    style={{ borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-3)' }}
                  />
                  <SkeletonLoader
                    variant="rectangle"
                    width="100%"
                    height="44px"
                    style={{ borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-2)' }}
                  />
                  <SkeletonLoader
                    variant="rectangle"
                    width="100%"
                    height="44px"
                    style={{ borderRadius: 'var(--radius-lg)' }}
                  />
                </Flex>
              </Box>
            </Box>
          </Col>
        </Row>
      </Container>
    </Box>
  );
}
