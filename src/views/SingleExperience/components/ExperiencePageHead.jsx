/**
 * ExperiencePageHead
 *
 * SEO/OpenGraph block for the SingleExperience view. Pure relocation.
 */

import PageOpenGraph from '../../../components/OpenGraph/PageOpenGraph';
import { buildExperienceSchema } from '../../../utilities/schema-utils';
import { formatPlanningTime } from '../../../utilities/planning-time-utils';
import { formatCostEstimate } from '../../../utilities/cost-utils';

export default function ExperiencePageHead({ experience, travelTips }) {
  if (!experience) return null;

  return (
    <PageOpenGraph
      title={experience.name}
      description={`Plan your ${experience.name} experience. ${
        experience.cost_estimate > 0
          ? `Estimated cost: ${formatCostEstimate(experience.cost_estimate)}. `
          : ''
      }${
        experience.max_planning_days > 0
          ? `Planning time: ${formatPlanningTime(experience.max_planning_days)}.`
          : ''
      }`}
      keywords={`${experience.name}, travel, experience, planning${
        experience.destination && experience.destination.name
          ? `, ${experience.destination.name}${
              experience.destination.country ? `, ${experience.destination.country}` : ''
            }`
          : ''
      }${experience.experience_type ? `, ${experience.experience_type}` : ''}`}
      ogTitle={`${experience.name}${
        experience.destination && experience.destination.name ? ` - ${experience.destination.name}` : ''
      }`}
      ogDescription={`Discover and plan ${experience.name}. ${
        travelTips.length > 0 ? travelTips[0] : 'Start planning your perfect travel experience today.'
      }`}
      entity={experience}
      entityType="experience"
      schema={buildExperienceSchema(experience, window?.location?.origin || '')}
    />
  );
}
