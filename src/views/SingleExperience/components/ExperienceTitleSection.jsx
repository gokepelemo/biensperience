/**
 * ExperienceTitleSection Component
 * Displays experience title, cost estimate, and planning days
 * Planned date badge has been moved to ActionButtonsRow
 */

import { Box, Flex } from '@chakra-ui/react';
import FadeIn from '../../../components/Animation/Animation';
import PlanningTime from '../../../components/PlanningTime/PlanningTime';
import CostEstimate from '../../../components/CostEstimate/CostEstimate';

export default function ExperienceTitleSection({
  // Experience data
  experience,
  h1Ref
}) {
  if (!experience) return null;

  return (
    <Box textAlign={{ base: "center", md: "start" }}>
      <h1 ref={h1Ref} className="h fade-in" style={{ marginTop: 'var(--space-6)' }}>{experience.name}</h1>

      {/* Cost Estimate & Planning Days Grid */}
      <Flex
        flexWrap="wrap"
        gap="var(--space-3)"
        align="center"
        my="var(--space-2)"
        justify={{ base: "center", md: "flex-start" }}
      >
        {experience.cost_estimate > 0 && (
          <FadeIn>
            <Box as="h2" className="h5" display="inline-flex" alignItems="center" minH="44px" m={0}>
              <CostEstimate
                cost={experience.cost_estimate}
                showLabel={true}
                showTooltip={true}
                showDollarSigns={true}
              />
            </Box>
          </FadeIn>
        )}
        {experience.max_planning_days > 0 && (
          <FadeIn>
            <Box as="h2" className="h5" display="inline-flex" alignItems="center" minH="44px" m={0}>
              <PlanningTime
                days={experience.max_planning_days}
                showLabel={true}
                showTooltip={true}
                size="md"
              />
            </Box>
          </FadeIn>
        )}
      </Flex>
    </Box>
  );
}
