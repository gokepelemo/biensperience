/**
 * ExperienceHeader Component
 * Displays experience title, photos, metadata, and planned date badge
 */

import { Link } from 'react-router-dom';
import PhotoCard from '../../../components/PhotoCard/PhotoCard';
import TagPill from '../../../components/Pill/TagPill';
import FadeIn from '../../../components/Animation/Animation';
import CostEstimate from '../../../components/CostEstimate/CostEstimate';
import { formatDateShort, formatDateForInput } from '../../../utilities/date-utils';

export default function ExperienceHeader({
  experience,
  travelTips,
  canEdit,
  // Planned date badge props
  userHasExperience,
  pendingUnplan,
  selectedPlan,
  showDatePicker,
  setShowDatePicker,
  setIsEditingDate,
  plannedDate,
  setPlannedDate,
  lang
}) {
  if (!experience) return null;

  // Get planned date from selected plan (updates when user switches plans in dropdown)
  const displayedPlannedDate = selectedPlan?.planned_date;

  return (
    <div id="overview" className="experience-header">
      <h1 className="experience-title animation-fade_in">{experience.name}</h1>

      {/* Planned Date Badge - shows selected plan's date */}
      {userHasExperience && !pendingUnplan && (
        <FadeIn>
          {displayedPlannedDate ? (
            <TagPill
              color="primary"
              className="cursor-pointer mb-2 planned-date-badge"
              onClick={() => {
                if (showDatePicker) {
                  setShowDatePicker(false);
                } else {
                  setIsEditingDate(true);
                  setPlannedDate(formatDateForInput(displayedPlannedDate));
                  setShowDatePicker(true);
                }
              }}
              title={showDatePicker ? "Click to close date picker" : "Click to edit planned date"}
            >
              Planned for {formatDateShort(displayedPlannedDate)}
            </TagPill>
          ) : (
            <TagPill
              color="primary"
              className="cursor-pointer mb-2 planned-date-badge"
              onClick={() => {
                if (showDatePicker) {
                  setShowDatePicker(false);
                } else {
                  setIsEditingDate(false);
                  setPlannedDate("");
                  setShowDatePicker(true);
                }
              }}
              title={showDatePicker ? "Click to close date picker" : "Click to set a planned date"}
            >
              {lang.en.label.plannedDate}: {lang.en.label.setOneNow}
            </TagPill>
          )}
        </FadeIn>
      )}

      {/* Photos */}
      {experience.photos && experience.photos.length > 0 && (
        <div id="photos" className="row mb-4">
          <div className="col-12">
            <PhotoCard
              photos={experience.photos}
              defaultPhotoId={experience.default_photo_id}
              altText={experience.name}
            />
          </div>
        </div>
      )}

      {/* Destination Link */}
      {experience.destination && (
        <div className="mb-3">
          <strong>Destination: </strong>
          <Link to={`/destinations/${experience.destination._id}`}>
            {experience.destination.name}, {experience.destination.country}
          </Link>
        </div>
      )}

      {/* Description */}
      {experience.description && (
        <div className="mb-4">
          <h3>About</h3>
          <p className="experience-description">{experience.description}</p>
        </div>
      )}

      {/* Cost Estimate */}
      {experience.cost_estimate > 0 && (
        <div className="mb-3">
          <strong>Estimated Cost: </strong>
          <CostEstimate
            cost={experience.cost_estimate}
            showTooltip={true}
            showDollarSigns={true}
          />
        </div>
      )}

      {/* Experience Type Tags */}
      {experience.experience_type && experience.experience_type.length > 0 && (
        <div className="mb-3">
          <strong>Type: </strong>
          {experience.experience_type.join(', ')}
        </div>
      )}

      {/* Travel Tips */}
      {travelTips && travelTips.length > 0 && (
        <div id="travel-tips" className="mb-4">
          <h3>Travel Tips</h3>
          <ul className="travel-tips-list">
            {travelTips.map((tip, index) => (
              <li key={index}>{tip}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Edit Button */}
      {canEdit && (
        <div className="mb-4">
          <Link
            to={`/experiences/${experience._id}/update`}
            className="btn btn-primary"
          >
            Edit Experience
          </Link>
        </div>
      )}
    </div>
  );
}
