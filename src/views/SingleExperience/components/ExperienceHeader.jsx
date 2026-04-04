/**
 * ExperienceHeader Component
 * Displays experience title, photos, metadata, and planned date badge
 */

import { Link } from 'react-router-dom';
import { Box } from "@chakra-ui/react";
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
      <h1 className="experience-title animation-fade-in">{experience.name}</h1>

      {/* Planned Date Badge - shows selected plan's date */}
      {userHasExperience && !pendingUnplan && (
        <Box mb="2">
          <FadeIn>
            {displayedPlannedDate ? (
              <TagPill
                color="primary"
                className="cursor-pointer planned-date-badge"
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
                className="cursor-pointer planned-date-badge"
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
                {lang.current.label.plannedDate}: {lang.current.label.setOneNow}
              </TagPill>
            )}
          </FadeIn>
        </Box>
      )}

      {/* Photos */}
      {experience.photos && experience.photos.length > 0 && (
        <Box id="photos" className="row" mb="6">
          <Box w="100%">
            <PhotoCard
              photos={(experience.photos || []).map(e => e?.photo).filter(Boolean)}
              defaultPhotoId={(experience.photos || []).find(e => e?.default)?.photo?._id}
              altText={experience.name}
            />
          </Box>
        </Box>
      )}

      {/* Destination Link */}
      {experience.destination && (
        <Box mb="4">
          <strong>Destination: </strong>
          <Link to={`/destinations/${experience.destination._id}`}>
            {experience.destination.name}, {experience.destination.country}
          </Link>
        </Box>
      )}

      {/* Description */}
      {experience.description && (
        <Box mb="6">
          <h3>About</h3>
          <p className="experience-description">{experience.description}</p>
        </Box>
      )}

      {/* Cost Estimate */}
      {experience.cost_estimate > 0 && (
        <Box mb="4">
          <strong>Estimated Cost: </strong>
          <CostEstimate
            cost={experience.cost_estimate}
            showTooltip={true}
            showDollarSigns={true}
          />
        </Box>
      )}

      {/* Experience Type Tags */}
      {experience.experience_type && experience.experience_type.length > 0 && (
        <Box mb="4">
          <strong>Type: </strong>
          {experience.experience_type.join(', ')}
        </Box>
      )}

      {/* Travel Tips */}
      {travelTips && travelTips.length > 0 && (
        <Box id="travel-tips" mb="6">
          <h3>Travel Tips</h3>
          <ul className="travel-tips-list">
            {travelTips.map((tip, index) => (
              <li key={index}>{tip}</li>
            ))}
          </ul>
        </Box>
      )}

      {/* Edit Button */}
      {canEdit && (
        <Box mb="6">
          <Link
            to={`/experiences/${experience._id}/update`}
            className="btn btn-primary"
          >
            Edit Experience
          </Link>
        </Box>
      )}
    </div>
  );
}
