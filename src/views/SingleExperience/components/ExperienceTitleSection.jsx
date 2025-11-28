/**
 * ExperienceTitleSection Component
 * Displays experience title, planned date badge, cost estimate, and planning days
 * Replaces duplicate Mobile/Desktop header sections in SingleExperience
 */

import TagPill from '../../../components/Pill/TagPill';
import FadeIn from '../../../components/Animation/Animation';
import { formatDateShort, formatDateForInput } from '../../../utilities/date-utils';
import PlanningTime from '../../../components/PlanningTime/PlanningTime';
import CostEstimate from '../../../components/CostEstimate/CostEstimate';
import styles from './ExperienceTitleSection.module.scss';

export default function ExperienceTitleSection({
  // Experience data
  experience,
  h1Ref,

  // User data
  user,

  // Planned date badge state
  userHasExperience, // Controls button state only
  pendingUnplan,
  selectedPlan, // Badge shows selectedPlan date (updates with dropdown)
  showDatePicker,
  setShowDatePicker,
  setIsEditingDate,
  setPlannedDate,

  // Language strings
  lang
}) {
  if (!experience) return null;

  // Check if user owns the selected plan
  const userOwnsSelectedPlan = selectedPlan && user && (
    selectedPlan.user?._id?.toString() === user._id?.toString() ||
    selectedPlan.user?.toString() === user._id?.toString()
  );

  return (
    <div className={styles.experienceTitleSection}>
      <h1 ref={h1Ref} className="mt-4 h fade-in">{experience.name}</h1>

      {/* Planned Date Badge - Shows selectedPlan date (updates with dropdown) */}
      {/* Separate row with fixed min-height to prevent layout shift */}
      <div style={{ minHeight: selectedPlan ? '2.5rem' : '0', marginBottom: '0.5rem' }}>
        {selectedPlan && !pendingUnplan && (
          <FadeIn>
            {selectedPlan.planned_date ? (
              <TagPill
                color="primary"
                className={userOwnsSelectedPlan ? "cursor-pointer" : ""}
                onClick={() => {
                  // Only allow editing if user owns this plan
                  if (!userOwnsSelectedPlan) return;

                  if (showDatePicker) {
                    setShowDatePicker(false);
                  } else {
                    setIsEditingDate(true);
                    setPlannedDate(formatDateForInput(selectedPlan.planned_date));
                    setShowDatePicker(true);
                  }
                }}
                title={userOwnsSelectedPlan
                  ? (showDatePicker ? "Click to close date picker" : "Click to update planned date")
                  : "Collaborative plan date (view only)"
                }
              >
                Planned for {formatDateShort(selectedPlan.planned_date)}
              </TagPill>
            ) : (
              userOwnsSelectedPlan && (
                <TagPill
                  color="primary"
                  className="cursor-pointer"
                  onClick={() => {
                    if (showDatePicker) {
                      setShowDatePicker(false);
                    } else {
                      setIsEditingDate(false);
                      setPlannedDate("");
                      setShowDatePicker(true);
                    }
                  }}
                  title={showDatePicker ? "Click to close date picker" : "Click to add a planned date"}
                >
                  {lang.en.label.plannedDate}: {lang.en.label.setOneNow}
                </TagPill>
              )
            )}
          </FadeIn>
        )}
      </div>

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
