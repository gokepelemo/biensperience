/**
 * ExperienceTitleSection Component
 * Displays experience title, cost estimate, and planning days
 * Planned date badge has been moved to ActionButtonsRow
 */

import FadeIn from '../../../components/Animation/Animation';
import PlanningTime from '../../../components/PlanningTime/PlanningTime';
import CostEstimate from '../../../components/CostEstimate/CostEstimate';
import styles from './ExperienceTitleSection.module.scss';

export default function ExperienceTitleSection({
  // Experience data
  experience,
  h1Ref
}) {
  if (!experience) return null;

  return (
    <div className={styles.experienceTitleSection}>
      <h1 ref={h1Ref} className="mt-4 h fade-in">{experience.name}</h1>

      {/* Cost Estimate & Planning Days Grid */}
      <div className={styles.headerGrid}>
        {experience.cost_estimate > 0 && (
          <FadeIn>
            <h2 className={`h5 ${styles.headerItem}`}>
              <CostEstimate
                cost={experience.cost_estimate}
                showLabel={true}
                showTooltip={true}
                showDollarSigns={true}
              />
            </h2>
          </FadeIn>
        )}
        {experience.max_planning_days > 0 && (
          <FadeIn>
            <h2 className={`h5 ${styles.headerItem}`}>
              <PlanningTime
                days={experience.max_planning_days}
                showLabel={true}
                showTooltip={true}
                size="md"
              />
            </h2>
          </FadeIn>
        )}
      </div>
    </div>
  );
}
